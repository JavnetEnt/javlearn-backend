# Javlearn — Backend (Stage 1)

Multi-instructor online course platform. Stack: React (frontend, not yet
scaffolded) + Node/Express + PostgreSQL.

## Stage 1 scope

- Express server with a `/health` route (checks both the API and the DB)
- PostgreSQL connection via `pg`
- First migration: `users` and `courses` tables, with instructor/student
  roles and course ownership

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a local Postgres database:
   ```bash
   createdb javlearn
   ```
   (Or use whatever Postgres user/db setup you prefer — just make sure it
   matches your `.env`.)

3. Copy the env file and fill in your local values:
   ```bash
   cp .env.example .env
   ```

4. Run the migration:
   ```bash
   npm run migrate
   ```

5. Start the server:
   ```bash
   npm run dev
   ```

6. Check it's alive:
   ```bash
   curl http://localhost:4000/health
   ```
   Expect: `{"status":"ok","db":"connected", ...}`

## Schema notes

- `users.role` is a Postgres ENUM (`student`, `instructor`, `admin`).
- `courses.instructor_id` references `users.id`. A trigger
  (`enforce_instructor_role`) blocks assigning a course to a user whose
  role isn't `instructor` or `admin` — this is enforced at the DB level
  in addition to whatever you check in application code later.
- `schema_migrations` tracks which migration files have run, so
  `npm run migrate` is safe to re-run — it only applies new files.

## Next steps (not yet built)

- Auth (signup/login, password hashing, JWT or sessions)
- Course CRUD routes
- Enrollment table (students ↔ courses)
- React frontend scaffold
