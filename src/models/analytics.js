const { query } = require('../db');

// Stats for a single course: how many students, how many lessons, and the
// average completion percentage across enrolled students.
async function getCourseAnalytics(courseId) {
  const lessonCountResult = await query(
    'SELECT COUNT(*)::int AS count FROM lessons WHERE course_id = $1',
    [courseId]
  );
  const lessonCount = lessonCountResult.rows[0].count;

  const enrollmentCountResult = await query(
    'SELECT COUNT(*)::int AS count FROM enrollments WHERE course_id = $1',
    [courseId]
  );
  const enrollmentCount = enrollmentCountResult.rows[0].count;

  if (enrollmentCount === 0 || lessonCount === 0) {
    return { enrollmentCount, lessonCount, averageCompletionPercent: 0 };
  }

  const perStudentResult = await query(
    `SELECT e.student_id, COUNT(lp.id)::int AS completed
     FROM enrollments e
     LEFT JOIN lesson_progress lp
       ON lp.student_id = e.student_id
       AND lp.lesson_id IN (SELECT id FROM lessons WHERE course_id = $1)
     WHERE e.course_id = $1
     GROUP BY e.student_id`,
    [courseId]
  );

  const totalPercent = perStudentResult.rows.reduce(
    (sum, row) => sum + (row.completed / lessonCount) * 100,
    0
  );
  const averageCompletionPercent = Math.round(totalPercent / perStudentResult.rows.length);

  return { enrollmentCount, lessonCount, averageCompletionPercent };
}

async function getInstructorSummary(instructorId) {
  const result = await query(
    `SELECT
       COUNT(DISTINCT c.id)::int AS total_courses,
       COUNT(e.id)::int AS total_enrollments,
       COUNT(DISTINCT e.student_id)::int AS unique_students,
       COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN c.price_cents ELSE 0 END), 0)::bigint
         AS estimated_revenue_cents
     FROM courses c
     LEFT JOIN enrollments e ON e.course_id = c.id
     WHERE c.instructor_id = $1`,
    [instructorId]
  );
  const row = result.rows[0];
  return {
    totalCourses: row.total_courses,
    totalEnrollments: row.total_enrollments,
    uniqueStudents: row.unique_students,
    estimatedRevenueCents: Number(row.estimated_revenue_cents),
  };
}

module.exports = { getCourseAnalytics, getInstructorSummary };