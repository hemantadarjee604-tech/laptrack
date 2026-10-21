const db = require('../config/db'), stock = require('./stockModel'), { UserError } = require('../utils/helpers');
const SEL = `SELECT r.*,i.name item_name,i.item_code,i.unit,i.quantity available,c.name category,u.name requester,u.department,h.name handler
  FROM requests r JOIN items i ON i.id=r.item_id JOIN categories c ON c.id=i.category_id
  JOIN users u ON u.id=r.user_id LEFT JOIN users h ON h.id=r.handled_by`;

exports.all = async status => (await db.query(`${SEL} ${status ? 'WHERE r.status=$1' : ''} ORDER BY (r.status='pending') DESC, r.created_at DESC`, status ? [status] : [])).rows;
exports.byUser = async uid => (await db.query(`${SEL} WHERE r.user_id=$1 ORDER BY r.created_at DESC`, [uid])).rows;
exports.pendingCount = async () => (await db.query("SELECT COUNT(*) n FROM requests WHERE status='pending'")).rows[0].n;
exports.counts = async () => (await db.query('SELECT status,COUNT(*) n FROM requests GROUP BY status')).rows.reduce((a, r) => (a[r.status] = r.n, a), {});

exports.create = r => db.query('INSERT INTO requests(user_id,item_id,quantity,purpose,needed_by) VALUES($1,$2,$3,$4,$5)', [r.user_id, r.item_id, r.quantity, r.purpose, r.needed_by]);

// pending -> approved | rejected (only while still pending)
exports.decide = async (id, status, by, note) => {
  const r = await db.query("UPDATE requests SET status=$2,handled_by=$3,admin_note=$4,updated_at=now() WHERE id=$1 AND status='pending'", [id, status, by, note]);
  if (!r.rowCount) throw new UserError('This request has already been handled.');
};
// approved -> issued : takes the stock OUT and logs the transaction in one transaction.
exports.issue = (id, by) => db.tx(async c => {
  const { rows } = await c.query('SELECT * FROM requests WHERE id=$1 FOR UPDATE', [id]);
  const r = rows[0];
  if (!r || r.status !== 'approved') throw new UserError('Only approved requests can be issued.');
  await stock.move(c, { itemId: r.item_id, userId: by, type: 'OUT', qty: r.quantity, reason: `Issued for request #${id}`, requestId: id });
  await c.query("UPDATE requests SET status='issued',updated_at=now() WHERE id=$1", [id]);
});
// requester can cancel their own request while it is still pending
exports.cancel = async (id, uid) => {
  const r = await db.query("UPDATE requests SET status='cancelled',updated_at=now() WHERE id=$1 AND user_id=$2 AND status='pending'", [id, uid]);
  if (!r.rowCount) throw new UserError('Only your pending requests can be cancelled.');
};
