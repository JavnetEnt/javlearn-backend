-- 002_create_enrollments.sql
-- Tracks which users are enrolled in which courses.
-- Any authenticated user can enroll (instructors browsing other courses
-- included) - enrollment itself carries no role restriction, only the
-- target course must be published.

CREATE TABLE enrollments (
    id            SERIAL PRIMARY KEY,
    student_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id     INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, course_id)
);

CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
