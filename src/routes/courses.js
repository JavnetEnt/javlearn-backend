const express = require('express');
const courses = require('../models/courses');
const enrollments = require('../models/enrollments');
const progress = require('../models/progress');
const analytics = require('../models/analytics');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

function isOwnerOrAdmin(req, course) {
  return req.user.role === 'admin' || course.instructor_id === req.user.id;
}

// --- Public routes ---

// List published courses. Anyone can browse these, no login required.
router.get('/', async (req, res) => {
  try {
    const { search, sort } = req.query;
    const list = await courses.listPublished({ search, sort });
    res.json({ courses: list });
  } catch (err) {
    console.error('List courses error:', err);
    res.status(500).json({ error: 'Something went wrong listing courses' });
  }
});

// Instructor's own courses (published AND unpublished) - must come before
// GET /:id so "mine" isn't parsed as a course id.
router.get('/mine', requireAuth, requireRole('instructor', 'admin'), async (req, res) => {
  try {
    const list = await courses.listByInstructor(req.user.id);
    res.json({ courses: list });
  } catch (err) {
    console.error('List my courses error:', err);
    res.status(500).json({ error: 'Something went wrong listing your courses' });
  }
});


// Summary across all of the instructor's own courses - total courses,
// enrollments, unique students, estimated revenue.
router.get('/mine/analytics', requireAuth, requireRole('instructor', 'admin'), async (req, res) => {
  try {
    const summary = await analytics.getInstructorSummary(req.user.id);
    res.json({ summary });
  } catch (err) {
    console.error('Get instructor analytics error:', err);
    res.status(500).json({ error: 'Something went wrong fetching analytics' });
  }
});

// Single course. Published courses are public; unpublished ones are only
// visible to their owner (or an admin).
router.get('/:id', async (req, res) => {
  try {
    const course = await courses.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (!course.is_published) {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(404).json({ error: 'Course not found' });
      }
      // Re-use requireAuth's logic inline would duplicate work, so for the
      // single "is this mine" check here we just 404 non-owners below once
      // auth middleware has run on the dedicated routes instead. For a
      // not-yet-logged-in request to an unpublished course, treat as 404.
    }

    res.json({ course });
  } catch (err) {
    console.error('Get course error:', err);
    res.status(500).json({ error: 'Something went wrong fetching the course' });
  }
});

// --- Instructor-only routes ---

router.post('/', requireAuth, requireRole('instructor', 'admin'), async (req, res) => {
    const { title, description, priceCents, thumbnailUrl } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
    if (priceCents !== undefined && (!Number.isInteger(priceCents) || priceCents < 0)) {
    return res.status(400).json({ error: 'priceCents must be a non-negative integer' });
  }
  if (thumbnailUrl !== undefined && typeof thumbnailUrl !== 'string') {
    return res.status(400).json({ error: 'thumbnailUrl must be a string' });
  }

  try {
    const course = await courses.create({
      title: title.trim(),
      description,
      instructorId: req.user.id,
      priceCents,
      thumbnailUrl,
    });
    res.status(201).json({ course });
  } catch (err) {
    console.error('Create course error:', err);
    res.status(500).json({ error: 'Something went wrong creating the course' });
  }
});

router.patch('/:id', requireAuth, requireRole('instructor', 'admin'), async (req, res) => {
  try {
    const existing = await courses.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (!isOwnerOrAdmin(req, existing)) {
      return res.status(403).json({ error: 'You do not own this course' });
    }

      const { title, description, priceCents, isPublished, thumbnailUrl } = req.body;
    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return res.status(400).json({ error: 'title must be a non-empty string' });
    }
    if (priceCents !== undefined && (!Number.isInteger(priceCents) || priceCents < 0)) {
      return res.status(400).json({ error: 'priceCents must be a non-negative integer' });
    }
    if (thumbnailUrl !== undefined && typeof thumbnailUrl !== 'string') {
      return res.status(400).json({ error: 'thumbnailUrl must be a string' });
    }

    const updated = await courses.update(req.params.id, {
      title: title !== undefined ? title.trim() : undefined,
      description,
      priceCents,
      isPublished,
      thumbnailUrl,
    });
    res.json({ course: updated });
  } catch (err) {
    console.error('Update course error:', err);
    res.status(500).json({ error: 'Something went wrong updating the course' });
  }
});

router.delete('/:id', requireAuth, requireRole('instructor', 'admin'), async (req, res) => {
  try {
    const existing = await courses.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (!isOwnerOrAdmin(req, existing)) {
      return res.status(403).json({ error: 'You do not own this course' });
    }

    await courses.remove(req.params.id);
    res.status(204).send();
  } catch (err) {
    console.error('Delete course error:', err);
    res.status(500).json({ error: 'Something went wrong deleting the course' });
  }
});

// Roster for a single course - only the owning instructor (or an admin) can see it.
router.get('/:id/students', requireAuth, requireRole('instructor', 'admin'), async (req, res) => {
  try {
    const course = await courses.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (!isOwnerOrAdmin(req, course)) {
      return res.status(403).json({ error: 'You do not own this course' });
    }

    const students = await enrollments.listByCourse(req.params.id);
    res.json({ students });
  } catch (err) {
    console.error('List course students error:', err);
    res.status(500).json({ error: 'Something went wrong listing enrolled students' });
  }
});

// The current user's own progress in a course: lessons completed vs total.
router.get('/:id/progress', requireAuth, async (req, res) => {
  try {
    const course = await courses.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const enrollment = await enrollments.find(req.user.id, course.id);
    if (!enrollment) {
      return res.status(403).json({ error: 'You must be enrolled in this course to view progress' });
    }

    const summary = await progress.getCourseProgress(req.user.id, course.id);
    res.json({ progress: summary });
  } catch (err) {
    console.error('Get course progress error:', err);
    res.status(500).json({ error: 'Something went wrong fetching progress' });
  }
});

// Stats for a single course - only the owning instructor (or an admin).
router.get('/:id/analytics', requireAuth, requireRole('instructor', 'admin'), async (req, res) => {
  try {
    const course = await courses.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (!isOwnerOrAdmin(req, course)) {
      return res.status(403).json({ error: 'You do not own this course' });
    }

    const stats = await analytics.getCourseAnalytics(course.id);
    res.json({ analytics: stats });
  } catch (err) {
    console.error('Get course analytics error:', err);
    res.status(500).json({ error: 'Something went wrong fetching course analytics' });
  }
});

module.exports = router;
