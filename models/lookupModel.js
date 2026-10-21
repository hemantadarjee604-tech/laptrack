// One generic model for the three small "setup" tables. Table and column names come from
// the whitelist below (never from user input), so the dynamic SQL is safe.
const db = require('../config/db'), { UserError } = require('../utils/helpers');
const T = {
  categories: { table: 'categories', title: 'Categories', single: 'category', fk: 'category_id', order: 'name',
    fields: [{ n: 'name', l: 'Name', req: 1 }, { n: 'description', l: 'Description', type: 'textarea' },
             { n: 'is_chemical', l: 'Chemical category (asks for received, opened and expiry dates)', type: 'checkbox' }],
    cols: [{ k: 'name', l: 'Name' }, { k: 'description', l: 'Description' }, { k: 'is_chemical', l: 'Chemical', bool: 1 }] },
  suppliers: { table: 'suppliers', title: 'Suppliers', single: 'supplier', fk: 'supplier_id', order: 'name',
    fields: [{ n: 'name', l: 'Supplier name', req: 1 }, { n: 'contact', l: 'Phone' }, { n: 'email', l: 'Email' }, { n: 'address', l: 'Address', type: 'textarea' }],
    cols: [{ k: 'name', l: 'Name' }, { k: 'contact', l: 'Phone' }, { k: 'email', l: 'Email' }, { k: 'address', l: 'Address' }] },
  locations: { table: 'locations', title: 'Locations', single: 'location', fk: 'location_id', order: 'building,room,cabinet,shelf,position',
    fields: [{ n: 'building', l: 'Building', req: 1 }, { n: 'room', l: 'Room' }, { n: 'storage_area', l: 'Storage area' }, { n: 'cabinet', l: 'Cabinet' }, { n: 'shelf', l: 'Shelf' }, { n: 'position', l: 'Position' }],
    cols: [{ k: 'building', l: 'Building' }, { k: 'room', l: 'Room' }, { k: 'storage_area', l: 'Area' }, { k: 'cabinet', l: 'Cabinet' }, { k: 'shelf', l: 'Shelf' }, { k: 'position', l: 'Position' }] }
};
exports.T = T;
exports.all = async k => { const c = T[k]; return (await db.query(`SELECT t.*,(SELECT COUNT(*) FROM items WHERE ${c.fk}=t.id) AS used FROM ${c.table} t ORDER BY ${c.order}`)).rows; };
exports.one = async (k, id) => (await db.query(`SELECT * FROM ${T[k].table} WHERE id=$1`, [id])).rows[0];
exports.save = async (k, id, b) => {
  const c = T[k];
  const vals = c.fields.map(f => f.type === 'checkbox' ? b[f.n] === 'on' : (String(b[f.n] || '').trim() || null));
  c.fields.forEach((f, i) => { if (f.req && !vals[i]) throw new UserError(`${f.l} is required.`); });
  if (id) await db.query(`UPDATE ${c.table} SET ${c.fields.map((f, i) => `${f.n}=$${i + 1}`).join(',')} WHERE id=$${vals.length + 1}`, [...vals, id]);
  else await db.query(`INSERT INTO ${c.table}(${c.fields.map(f => f.n).join(',')}) VALUES(${vals.map((_, i) => '$' + (i + 1)).join(',')})`, vals);
};
exports.remove = async (k, id) => {
  const c = T[k];
  const n = (await db.query(`SELECT COUNT(*) n FROM items WHERE ${c.fk}=$1`, [id])).rows[0].n;
  if (n > 0) throw new UserError(`Cannot delete: ${n} item(s) still use this ${c.single}.`);
  await db.query(`DELETE FROM ${c.table} WHERE id=$1`, [id]);
};
// Dropdown data for forms and filters.
exports.options = async () => ({
  categories: (await db.query('SELECT id,name,is_chemical FROM categories ORDER BY name')).rows,
  suppliers: (await db.query('SELECT id,name FROM suppliers ORDER BY name')).rows,
  locations: (await db.query(`SELECT id,CONCAT_WS(' › ',building,room,storage_area,cabinet,shelf,position) AS label FROM locations ORDER BY label`)).rows
});
