// npm run seed -> default accounts and sample items so you can demo immediately.
const bcrypt = require('bcryptjs'), { pool } = require('../config/db');
(async () => {
  const users = [
    ['Lab Admin', 'admin@labtrack.test', 'Admin@123', 'admin', 'Science Department'],
    ['Student User', 'student@labtrack.test', 'User@123', 'user', 'Class XI Science']
  ];
  for (const [n, e, p, r, d] of users)
    await pool.query('INSERT INTO users(name,email,password,role,department) VALUES($1,$2,$3,$4,$5) ON CONFLICT (email) DO NOTHING', [n, e, await bcrypt.hash(p, 10), r, d]);

  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*) n FROM items');
  if (n === 0) {
    const cat = async name => (await pool.query('SELECT id FROM categories WHERE name=$1', [name])).rows[0].id;
    const [ch, gl, eq, tl, sf] = await Promise.all(['Chemical', 'Glassware', 'Equipment', 'Tool', 'Safety'].map(cat));
    // code, name, category, qty, unit, min, supplier, location, condition, expiry offset (days) or null
    const items = [
      ['CHM-001', 'Hydrochloric Acid 1M', ch, 12, 'bottle', 4, 2, 1, 'Good', 400],
      ['CHM-002', 'Sodium Hydroxide Pellets', ch, 3, 'bottle', 5, 2, 1, 'Good', 20],
      ['CHM-003', 'Ethanol 95%', ch, 8, 'litre', 3, 2, 1, 'Good', -15],
      ['CHM-004', 'Copper Sulphate', ch, 6, 'bottle', 2, 2, 1, 'Good', 700],
      ['GLS-001', 'Beaker 250 ml', gl, 40, 'piece', 15, 1, 2, 'Good', null],
      ['GLS-002', 'Conical Flask 500 ml', gl, 14, 'piece', 10, 1, 2, 'Good', null],
      ['GLS-003', 'Burette 50 ml', gl, 0, 'piece', 4, 1, 2, 'Good', null],
      ['EQP-001', 'Microscope', eq, 10, 'piece', 2, 3, 3, 'Good', null],
      ['EQP-002', 'Electronic Balance', eq, 3, 'piece', 1, 3, 3, 'Under Maintenance', null],
      ['TLS-001', 'Forceps', tl, 25, 'piece', 10, 3, 3, 'Good', null],
      ['SAF-001', 'Safety Gloves', sf, 8, 'pair', 20, 1, 4, 'Good', null],
      ['SAF-002', 'Safety Goggles', sf, 30, 'piece', 15, 1, 4, 'Good', null]
    ];
    for (const [code, name, c, q, u, min, s, l, cond, exp] of items) {
      const { rows: [it] } = await pool.query('INSERT INTO items(item_code,name,category_id,quantity,unit,minimum_stock,supplier_id,location_id,condition) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id', [code, name, c, q, u, min, s, l, cond]);
      if (exp !== null) await pool.query('INSERT INTO chemical_details(item_id,date_received,opening_date,expiry_date) VALUES($1,CURRENT_DATE-60,CURRENT_DATE-30,CURRENT_DATE+$2::int)', [it.id, exp]);
      if (q > 0) await pool.query("INSERT INTO stock_transactions(item_id,user_id,transaction_type,quantity,reason) VALUES($1,1,'IN',$2,'Opening stock')", [it.id, q]);
    }
  }
  console.log('Seed complete.\n  admin@labtrack.test / Admin@123\n  student@labtrack.test / User@123');
  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
