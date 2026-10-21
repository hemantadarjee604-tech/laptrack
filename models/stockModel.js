const db = require('../config/db'), { UserError } = require('../utils/helpers');

// Core stock rule. Locks the item row, refuses to go below zero, updates quantity and
// writes the audit-trail row. Always call inside a transaction (see record()).
exports.move = async (c, { itemId, userId, type, qty, reason, supplierId = null, requestId = null }) => {
  const { rows } = await c.query('SELECT quantity,name,unit FROM items WHERE id=$1 FOR UPDATE', [itemId]);
  if (!rows[0]) throw new UserError('Item not found.');
  if (type === 'OUT' && qty > rows[0].quantity)
    throw new UserError(`Only ${rows[0].quantity} ${rows[0].unit} of ${rows[0].name} in stock.`);
  await c.query('UPDATE items SET quantity=quantity+$1,updated_at=now() WHERE id=$2', [type === 'IN' ? qty : -qty, itemId]);
  await c.query('INSERT INTO stock_transactions(item_id,user_id,transaction_type,quantity,reason,supplier_id,request_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [itemId, userId, type, qty, reason, supplierId, requestId]);
};
exports.record = o => db.tx(c => exports.move(c, o));

exports.history = async (f = {}) => {
  const w = [], p = [];
  if (f.type === 'IN' || f.type === 'OUT') { p.push(f.type); w.push(`t.transaction_type=$${p.length}`); }
  if (f.item) { p.push(+f.item); w.push(`t.item_id=$${p.length}`); }
  if (f.q) { p.push('%' + f.q + '%'); w.push(`(i.name ILIKE $${p.length} OR i.item_code ILIKE $${p.length} OR t.reason ILIKE $${p.length})`); }
  const sql = `SELECT t.*,i.name item_name,i.item_code,i.unit,u.name user_name,s.name supplier
    FROM stock_transactions t JOIN items i ON i.id=t.item_id LEFT JOIN users u ON u.id=t.user_id LEFT JOIN suppliers s ON s.id=t.supplier_id
    ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY t.transaction_date DESC, t.id DESC LIMIT ${+f.limit || 300}`;
  return (await db.query(sql, p)).rows;
};
