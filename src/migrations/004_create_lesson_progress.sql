-- 004_create_lesson_progress.sql
-- One row per (student, lesson) they've marked complete. Course-level
-- progress is computed on the fly from this + the course's lesson count,
-- rather than stored redundantly.

CREATE TABLE lesson_progress (
    id            SERIAL PRIMARY KEY,
    student_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id     INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, lesson_id)
);

CREATE INDEX idx_lesson_progress_student_id ON lesson_progress(student_id);
CREATE INDEX idx_lesson_progress_lesson_id ON lesson_progress(lesson_id);
