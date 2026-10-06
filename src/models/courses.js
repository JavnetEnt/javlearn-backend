const { query } = require('../db');

async function create({ title, description, instructorId, priceCents, thumbnailUrl }) {
  const result = await query(
    `INSERT INTO courses (title, description, instructor_id, price_cents, thumbnail_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [title, description || null, instructorId, priceCents || 0, thumbnailUrl || null]
  );
  return result.rows[0];
}

async function findById(id) {
  const result = await query('SELECT * FROM courses WHERE id = $1', [id]);
  return result.rows[0] || null;
}

const SORT_COLUMNS = {
  newest: 'created_at DESC',
  price_asc: 'price_cents ASC',
  price_desc: 'price_cents DESC',
  title_asc: 'title ASC',
};

// Public course list: only published courses. Supports a free-text search
// over title/description and a choice of sort order.
async function listPublished({ limit = 50, offset = 0, search, sort } = {}) {
  const conditions = ['is_published = true'];
  const values = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(title ILIKE $${values.length} OR description ILIKE $${values.length})`);
  }

  const orderBy = SORT_COLUMNS[sort] || SORT_COLUMNS.newest;

  values.push(limit, offset);
  const limitParam = values.length - 1;
  const offsetParam = values.length;

  const result = await query(
    `SELECT * FROM courses
     WHERE ${conditions.join(' AND ')}
     ORDER BY ${orderBy}
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values
  );
  return result.rows;
}

// An instructor's own courses, published or not - for their dashboard.
async function listByInstructor(instructorId) {
  const result = await query(
    `SELECT * FROM courses
     WHERE instructor_id = $1
     ORDER BY created_at DESC`,
    [instructorId]
  );
  return result.rows;
}

const UPDATABLE_FIELDS = {
  title: 'title',
  description: 'description',
  priceCents: 'price_cents',
  isPublished: 'is_published',
  thumbnailUrl: 'thumbnail_url',
};

// Builds `SET col1 = $1, col2 = $2 ...` from only the fields actually passed in.
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

  setClauses.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE courses SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

async function remove(id) {
  const result = await query('DELETE FROM courses WHERE id = $1 RETURNING id', [id]);
  return result.rowCount > 0;
}

module.exports = { create, findById, listPublished, listByInstructor, update, remove };
