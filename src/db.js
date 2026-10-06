const { Pool } = require('pg');
require('dotenv').config();

// Prefer a single DATABASE_URL; fall back to discrete PG* env vars.
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'javlearn',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
    });

pool.on('error', (err) => {
  // Catches errors on idle clients so a bad connection doesn't crash the process.
  console.error('Unexpected error on idle PostgreSQL client', err);
});

/**
 * Run a query against the pool.
 * @param {string} text - SQL text (parameterized with $1, $2, ...)
 * @param {Array} params
 */
function query(text, params) {
  return pool.query(text, params);
}

/**
 * Quick connectivity check used by the /health route.
 */
async function checkConnection() {
  const result = await pool.query('SELECT 1 AS ok');
  return result.rows[0].ok === 1;
}

module.exports = { pool, query, checkConnection };
