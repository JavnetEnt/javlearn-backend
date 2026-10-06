const { query } = require('../db');

// Mark a lesson complete. Safe to call twice - ON CONFLICT means re-marking
// an already-completed lesson just no-ops rather than erroring.
async function markComplete(studentId, lessonId) {
  const result = await query(
    `INSERT INTO lesson_progress (student_id, lesson_id)
     VALUES ($1, $2)
     ON CONFLICT (student_id, lesson_id) DO NOTHING
     RETURNING *`,
    [studentId, lessonId]
  );
  if (result.rows[0]) {
    return result.rows[0];
  }
  // Already existed - fetch and return the existing row.
  const existing = await query(
    'SELECT * FROM lesson_progress WHERE student_id = $1 AND lesson_id = $2',
    [studentId, lessonId]
  );
  return existing.rows[0];
}

async function markIncomplete(studentId, lessonId) {
  const result = await query(
    'DELETE FROM lesson_progress WHERE student_id = $1 AND lesson_id = $2 RETURNING id',
    [studentId, lessonId]
  );
  return result.rowCount > 0;
}

// Course-level summary: how many of the course's lessons this student has
// completed, out of how many lessons the course has.
async function getCourseProgress(studentId, courseId) {
  const result = await query(
    `SELECT
       COUNT(l.id)::int AS total_lessons,
       COUNT(lp.id)::int AS completed_lessons
     FROM lessons l
     LEFT JOIN lesson_progress lp
       ON lp.lesson_id = l.id AND lp.student_id = $1
     WHERE l.course_id = $2`,
    [studentId, courseId]
  );
  const { total_lessons, completed_lessons } = result.rows[0];
  const percent = total_lessons === 0 ? 0 : Math.round((completed_lessons / total_lessons) * 100);
  return { totalLessons: total_lessons, completedLessons: completed_lessons, percent };
}

// Which of a course's lessons this student has completed - used to show
// per-lesson checkmarks alongside the overall percentage.
async function listCompletedLessonIds(studentId, courseId) {
  const result = await query(
    `SELECT lp.lesson_id
     FROM lesson_progress lp
     JOIN lessons l ON l.id = lp.lesson_id
     WHERE lp.student_id = $1 AND l.course_id = $2`,
    [studentId, courseId]
  );
  return result.rows.map((row) => row.lesson_id);
}

async function isComplete(studentId, lessonId) {
  const result = await query(
    'SELECT 1 FROM lesson_progress WHERE student_id = $1 AND lesson_id = $2',
    [studentId, lessonId]
  );
  return result.rows.length > 0;
}

module.exports = {
  markComplete,
  markIncomplete,
  getCourseProgress,
  isComplete,
  listCompletedLessonIds,
};
