const express = require('express');
const lessons = require('../models/lessons');
const courses = require('../models/courses');
const enrollments = require('../models/enrollments');
const progress = require('../models/progress');
const { requireAuth, requireRole, optionalAuth } = require('../middleware/auth');

// mergeParams lets this router read :courseId from the parent mount path.
const router = express.Router({ mergeParams: true });

function isOwnerOrAdmin(req, course) {
  return req.user && (req.user.role === 'admin' || course.instructor_id === req.user.id);
}

async function canSeeUnpublished(req, course) {
  return isOwnerOrAdmin(req, course);
}

// List lessons for a course - titles/order only, no content.
// Published courses: visible to anyone (even logged out) as a curriculum preview.
// Unpublished courses: owner/admin only.
router.get('/', optionalAuth, async (req, res) => {
  try {
    const course = await courses.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (!course.is_published && !(await canSeeUnpublished(req, course))) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const list = await lessons.listSummaryByCourse(req.params.courseId);

    // If the requester is logged in, attach which of these lessons they've
    // completed - lets the UI show per-lesson checkmarks in one request.
    if (req.user) {
      const completedIds = new Set(
        await progress.listCompletedLessonIds(req.user.id, req.params.courseId)
      );
      const withCompletion = list.map((lesson) => ({
        ...lesson,
        completed: completedIds.has(lesson.id),
      }));
      return res.json({ lessons: withCompletion });
    }

    res.json({ lessons: list });
  } catch (err) {
    console.error('List lessons error:', err);
    res.status(500).json({ error: 'Something went wrong listing lessons' });
  }
});

// Full lesson content - only the course owner/admin, or a student enrolled
// in the course, can see this.
router.get('/:lessonId', requireAuth, async (req, res) => {
  try {
    const course = await courses.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const lesson = await lessons.findById(req.params.lessonId);
    if (!lesson || lesson.course_id !== course.id) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const owner = isOwnerOrAdmin(req, course);
    if (!owner) {
      const enrollment = await enrollments.find(req.user.id, course.id);
      if (!enrollment) {
        return res.status(403).json({ error: 'You must be enrolled in this course to view this lesson' });
      }
    }

    res.json({ lesson });
  } catch (err) {
    console.error('Get lesson error:', err);
    res.status(500).json({ error: 'Something went wrong fetching the lesson' });
  }
});

router.post('/', requireAuth, requireRole('instructor', 'admin'), async (req, res) => {
  const { title, content, videoUrl, position } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (position !== undefined && !Number.isInteger(position)) {
    return res.status(400).json({ error: 'position must be an integer' });
  }

  try {
    const course = await courses.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (!isOwnerOrAdmin(req, course)) {
      return res.status(403).json({ error: 'You do not own this course' });
    }

    const lesson = await lessons.create({
      courseId: course.id,
      title: title.trim(),
      content,
      videoUrl,
      position,
    });
    res.status(201).json({ lesson });
  } catch (err) {
    console.error('Create lesson error:', err);
    res.status(500).json({ error: 'Something went wrong creating the lesson' });
  }
});

router.patch('/:lessonId', requireAuth, requireRole('instructor', 'admin'), async (req, res) => {
  try {
    const course = await courses.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (!isOwnerOrAdmin(req, course)) {
      return res.status(403).json({ error: 'You do not own this course' });
    }

    const existing = await lessons.findById(req.params.lessonId);
    if (!existing || existing.course_id !== course.id) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const { title, content, videoUrl, position } = req.body;
    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return res.status(400).json({ error: 'title must be a non-empty string' });
    }
    if (position !== undefined && !Number.isInteger(position)) {
      return res.status(400).json({ error: 'position must be an integer' });
    }

    const updated = await lessons.update(req.params.lessonId, {
      title: title !== undefined ? title.trim() : undefined,
      content,
      videoUrl,
      position,
    });
    res.json({ lesson: updated });
  } catch (err) {
    console.error('Update lesson error:', err);
    res.status(500).json({ error: 'Something went wrong updating the lesson' });
  }
});

router.delete('/:lessonId', requireAuth, requireRole('instructor', 'admin'), async (req, res) => {
  try {
    const course = await courses.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (!isOwnerOrAdmin(req, course)) {
      return res.status(403).json({ error: 'You do not own this course' });
    }

    const existing = await lessons.findById(req.params.lessonId);
    if (!existing || existing.course_id !== course.id) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    await lessons.remove(req.params.lessonId);
    res.status(204).send();
  } catch (err) {
    console.error('Delete lesson error:', err);
    res.status(500).json({ error: 'Something went wrong deleting the lesson' });
  }
});

// Mark a lesson complete. Only an enrolled student can track their own
// progress - course owners don't "complete" their own lessons.
router.post('/:lessonId/complete', requireAuth, async (req, res) => {
  try {
    const course = await courses.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const lesson = await lessons.findById(req.params.lessonId);
    if (!lesson || lesson.course_id !== course.id) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const enrollment = await enrollments.find(req.user.id, course.id);
    if (!enrollment) {
      return res.status(403).json({ error: 'You must be enrolled in this course to track progress' });
    }

    const record = await progress.markComplete(req.user.id, lesson.id);
    res.status(201).json({ progress: record });
  } catch (err) {
    console.error('Mark lesson complete error:', err);
    res.status(500).json({ error: 'Something went wrong marking the lesson complete' });
  }
});

// Un-mark a lesson (in case someone wants to redo it / marked it by mistake).
router.delete('/:lessonId/complete', requireAuth, async (req, res) => {
  try {
    const course = await courses.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const lesson = await lessons.findById(req.params.lessonId);
    if (!lesson || lesson.course_id !== course.id) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    await progress.markIncomplete(req.user.id, lesson.id);
    res.status(204).send();
  } catch (err) {
    console.error('Mark lesson incomplete error:', err);
    res.status(500).json({ error: 'Something went wrong updating progress' });
  }
});

module.exports = router;
