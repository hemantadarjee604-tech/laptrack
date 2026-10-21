// PostgreSQL connection pool + small helpers used by every model.
require('dotenv').config();
const { Pool, types } = require('pg');
types.setTypeParser(1082, v => v);        // DATE      -> 'YYYY-MM-DD' string (no timezone shifts)
types.setTypeParser(1700, parseFloat);    // NUMERIC   -> number
types.setTypeParser(20, parseInt);        // COUNT()   -> number

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: +process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'labtrack',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

const query = (text, params) => pool.query(text, params);

// Run several queries as one all-or-nothing transaction.
async function tx(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}
module.exports = { pool, query, tx };
