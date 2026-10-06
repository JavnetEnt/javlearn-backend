const { query } = require('../db');

async function create(studentId, courseId) {
  const result = await query(
    `INSERT INTO enrollments (student_id, course_id)
     VALUES ($1, $2)
     RETURNING *`,
    [studentId, courseId]
  );
  return result.rows[0];
}

async function find(studentId, courseId) {
  const result = await query(
    'SELECT * FROM enrollments WHERE student_id = $1 AND course_id = $2',
    [studentId, courseId]
  );
  return result.rows[0] || null;
}

// Courses a given user is enrolled in, with course details joined in -
// this is what powers a student's "my learning" page.
async function listByStudent(studentId) {
  const result = await query(
    `SELECT e.id AS enrollment_id, e.enrolled_at, c.*
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.student_id = $1
     ORDER BY e.enrolled_at DESC`,
    [studentId]
  );
  return result.rows;
}

// Students enrolled in a given course, with basic user info joined in -
// this is what powers an instructor's roster view for their own course.
async function listByCourse(courseId) {
  const result = await query(
    `SELECT e.id AS enrollment_id, e.enrolled_at, u.id AS student_id, u.name, u.email
     FROM enrollments e
     JOIN users u ON u.id = e.student_id
     WHERE e.course_id = $1
     ORDER BY e.enrolled_at DESC`,
    [courseId]
  );
  return result.rows;
}

module.exports = { create, find, listByStudent, listByCourse };
