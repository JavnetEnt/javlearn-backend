const express = require('express');
const enrollments = require('../models/enrollments');
const courses = require('../models/courses');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Enroll the current user in a published course.
// No role restriction - instructors can enroll in other instructors' courses too.
router.post('/', requireAuth, async (req, res) => {
  const { courseId } = req.body;

  if (!Number.isInteger(courseId)) {
    return res.status(400).json({ error: 'courseId (integer) is required' });
  }

  try {
    const course = await courses.findById(courseId);
    if (!course || !course.is_published) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const existing = await enrollments.find(req.user.id, courseId);
    if (existing) {
      return res.status(409).json({ error: 'Already enrolled in this course' });
    }

    const enrollment = await enrollments.create(req.user.id, courseId);
    res.status(201).json({ enrollment });
  } catch (err) {
    console.error('Enroll error:', err);
    res.status(500).json({ error: 'Something went wrong enrolling in the course' });
  }
});

// Courses the current user is enrolled in.
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const list = await enrollments.listByStudent(req.user.id);
    res.json({ enrollments: list });
  } catch (err) {
    console.error('List my enrollments error:', err);
    res.status(500).json({ error: 'Something went wrong listing your enrollments' });
  }
});

module.exports = router;
