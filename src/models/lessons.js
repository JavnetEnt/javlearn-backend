const { query } = require('../db');

async function countByCourse(courseId) {
  const result = await query(
    'SELECT COUNT(*)::int AS count FROM lessons WHERE course_id = $1',
    [courseId]
  );
  return result.rows[0].count;
}

async function create({ courseId, title, content, videoUrl, position }) {
  // If no explicit position given, append to the end of the course's lesson list.
  const resolvedPosition =
    position !== undefined ? position : await countByCourse(courseId);

  const result = await query(
    `INSERT INTO lessons (course_id, title, content, video_url, position)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [courseId, title, content || null, videoUrl || null, resolvedPosition]
  );
  return result.rows[0];
}

async function findById(id) {
  const result = await query('SELECT * FROM lessons WHERE id = $1', [id]);
  return result.rows[0] || null;
}

// Titles/order only - safe to show to anyone browsing a published course,
// even before enrolling (like a course curriculum preview).
async function listSummaryByCourse(courseId) {
  const result = await query(
    `SELECT id, course_id, title, position, created_at
     FROM lessons WHERE course_id = $1
     ORDER BY position ASC, id ASC`,
    [courseId]
  );
  return result.rows;
}

// Full lesson rows (with content/video_url) - only for the owner or an
// enrolled student, checked at the route level.
async function listFullByCourse(courseId) {
  const result = await query(
    `SELECT * FROM lessons WHERE course_id = $1
     ORDER BY position ASC, id ASC`,
    [courseId]
  );
  return result.rows;
}

const UPDATABLE_FIELDS = {
  title: 'title',
  content: 'content',
  videoUrl: 'video_url',
  position: 'position',
};

async function update(id, fields) {
  const setClauses = [];
  const values = [];
  let i = 1;

  for (const [key, column] of Object.entries(UPDATABLE_FIELDS)) {
    if (fields[key] !== undefined) {
      setClauses.push(`${column} = $${i}`);
      values.push(fields[key]);
      i += 1;
    }
  }

  if (setClauses.length === 0) {
    return findById(id);
  }

  setClauses.push('updated_at = NOW()');
  values.push(id);

  const result = await query(
    `UPDATE lessons SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

async function remove(id) {
  const result = await query('DELETE FROM lessons WHERE id = $1 RETURNING id', [id]);
  return result.rowCount > 0;
}

module.exports = {
  create,
  findById,
  listSummaryByCourse,
  listFullByCourse,
  update,
  remove,
  countByCourse,
};
