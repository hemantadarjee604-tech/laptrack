const db = require('../config/db');
exports.CONDITIONS = ['Good', 'Damaged', 'Under Maintenance', 'Lost', 'Disposed'];

// One query that joins everything and DERIVES stock_status and expiry_status.
const BASE = `SELECT i.id,i.item_code,i.name,i.category_id,i.quantity,i.unit,i.minimum_stock,i.supplier_id,i.location_id,
  i.condition,i.description,i.created_at,i.updated_at,
  c.name AS category,c.is_chemical,s.name AS supplier,
  NULLIF(CONCAT_WS(' › ',l.building,l.room,l.storage_area,l.cabinet,l.shelf,l.position),'') AS location,
  cd.date_received,cd.opening_date,cd.expiry_date,
  CASE WHEN i.quantity<=0 THEN 'Out of stock' WHEN i.quantity<=i.minimum_stock THEN 'Low stock' ELSE 'Available' END AS stock_status,
  CASE WHEN cd.expiry_date IS NULL THEN NULL WHEN cd.expiry_date<CURRENT_DATE THEN 'Expired'
       WHEN cd.expiry_date<=CURRENT_DATE+30 THEN 'Expiring soon' ELSE 'Safe' END AS expiry_status
  FROM items i JOIN categories c ON c.id=i.category_id
  LEFT JOIN suppliers s ON s.id=i.supplier_id LEFT JOIN locations l ON l.id=i.location_id
  LEFT JOIN chemical_details cd ON cd.item_id=i.id`;

exports.list = async (f = {}) => {
  const w = [], p = [];
  if (f.q) { p.push('%' + f.q + '%'); const n = '$' + p.length;
    w.push(`(name ILIKE ${n} OR item_code ILIKE ${n} OR category ILIKE ${n} OR COALESCE(location,'') ILIKE ${n} OR COALESCE(supplier,'') ILIKE ${n})`); }
  if (f.category) { p.push(+f.category); w.push(`category_id=$${p.length}`); }
  if (f.location) { p.push(+f.location); w.push(`location_id=$${p.length}`); }
  if (f.condition) { p.push(f.condition); w.push(`condition=$${p.length}`); }
  const stock = { low: "stock_status='Low stock'", out: "stock_status='Out of stock'", available: "stock_status='Available'" }[f.stock];
  const exp = { expired: "expiry_status='Expired'", soon: "expiry_status='Expiring soon'", safe: "expiry_status='Safe'" }[f.expiry];
  if (stock) w.push(stock); if (exp) w.push(exp);
  if (f.inStock) w.push('quantity>0');
  return (await db.query(`SELECT * FROM (${BASE}) t ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY name`, p)).rows;
};
exports.find = async id => (await db.query(`SELECT * FROM (${BASE}) t WHERE id=$1`, [id])).rows[0];

async function chem(c, id, d) {   // chemical_details only exists for chemical categories
  const { rows } = await c.query('SELECT is_chemical FROM categories WHERE id=$1', [d.category_id]);
  if (rows[0] && rows[0].is_chemical)
    await c.query(`INSERT INTO chemical_details(item_id,date_received,opening_date,expiry_date) VALUES($1,$2,$3,$4)
      ON CONFLICT (item_id) DO UPDATE SET date_received=$2,opening_date=$3,expiry_date=$4`, [id, d.date_received, d.opening_date, d.expiry_date]);
  else await c.query('DELETE FROM chemical_details WHERE item_id=$1', [id]);
}
exports.create = (d, userId) => db.tx(async c => {
  const { rows } = await c.query(`INSERT INTO items(item_code,name,category_id,quantity,unit,minimum_stock,supplier_id,location_id,condition,description)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [d.item_code, d.name, d.category_id, d.quantity, d.unit, d.minimum_stock, d.supplier_id, d.location_id, d.condition, d.description]);
  const id = rows[0].id;
  await chem(c, id, d);
  if (d.quantity > 0) await c.query("INSERT INTO stock_transactions(item_id,user_id,supplier_id,transaction_type,quantity,reason) VALUES($1,$2,$3,'IN',$4,'Opening stock')", [id, userId, d.supplier_id, d.quantity]);
  return id;
});
// Quantity is NOT editable here - it only changes through Stock In / Stock Out / issued requests.
exports.update = (id, d) => db.tx(async c => {
  await c.query(`UPDATE items SET item_code=$1,name=$2,category_id=$3,unit=$4,minimum_stock=$5,supplier_id=$6,location_id=$7,condition=$8,description=$9,updated_at=now() WHERE id=$10`,
    [d.item_code, d.name, d.category_id, d.unit, d.minimum_stock, d.supplier_id, d.location_id, d.condition, d.description, id]);
  await chem(c, id, d);
});
exports.remove = id => db.query('DELETE FROM items WHERE id=$1', [id]);
