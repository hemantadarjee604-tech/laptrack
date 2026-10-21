// npm run db:init  -> runs database/schema.sql (alternative to pasting it into pgAdmin)
const fs = require('fs'), path = require('path'), { pool } = require('../config/db');
(async () => {
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  console.log('Schema created.'); await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
