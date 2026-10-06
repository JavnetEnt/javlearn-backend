-- 001_create_users_and_courses.sql
-- Core tables for Javlearn: users (with roles) and courses (owned by an instructor).

CREATE TYPE user_role AS ENUM ('student', 'instructor', 'admin');

CREATE TABLE users (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    role           user_role NOT NULL DEFAULT 'student',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE courses (
    id             SERIAL PRIMARY KEY,
    title          VARCHAR(255) NOT NULL,
    description    TEXT,
    instructor_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    price_cents    INTEGER NOT NULL DEFAULT 0,
    is_published   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Speeds up "courses by instructor" lookups, which will be a common query
-- once instructor dashboards exist.
CREATE INDEX idx_courses_instructor_id ON courses(instructor_id);

-- Enforce at the database level that only instructors/admins own courses.
-- (Belt-and-braces alongside application-layer checks.)
CREATE OR REPLACE FUNCTION enforce_instructor_role()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = NEW.instructor_id
          AND role IN ('instructor', 'admin')
    ) THEN
        RAISE EXCEPTION 'instructor_id % does not reference a user with role instructor/admin', NEW.instructor_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_courses_instructor_role
    BEFORE INSERT OR UPDATE OF instructor_id ON courses
    FOR EACH ROW
    EXECUTE FUNCTION enforce_instructor_role();
