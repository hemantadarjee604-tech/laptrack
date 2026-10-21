const db = require('../config/db');
exports.byEmail = async e => (await db.query('SELECT * FROM users WHERE email=$1', [e])).rows[0];
exports.find = async id => (await db.query('SELECT id,name,email,role,department FROM users WHERE id=$1', [id])).rows[0];
exports.all = async () => (await db.query('SELECT u.id,u.name,u.email,u.role,u.department,u.created_at,(SELECT COUNT(*) FROM requests WHERE user_id=u.id) AS requests FROM users u ORDER BY u.role, u.name')).rows;
exports.create = (u) => db.query('INSERT INTO users(name,email,password,role,department) VALUES($1,$2,$3,$4,$5)', [u.name, u.email, u.hash, u.role, u.department]);
exports.setRole = (id, role) => db.query('UPDATE users SET role=$2 WHERE id=$1', [id, role]);
exports.setPassword = (id, hash) => db.query('UPDATE users SET password=$2 WHERE id=$1', [id, hash]);
exports.remove = id => db.query('DELETE FROM users WHERE id=$1', [id]);
