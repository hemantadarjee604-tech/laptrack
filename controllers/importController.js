// Bulk import of inventory items from a .csv or .xlsx file (admin only).
// Flow: upload -> read rows -> validate each row -> insert the good rows -> show a result report.
const path = require('path'), { Readable } = require('stream'), ExcelJS = require('exceljs'), multer = require('multer');
const db = require('../config/db'), items = require('../models/itemModel'), lk = require('../models/lookupModel');
const { wrap, guard, UserError } = require('../utils/helpers');

const COLS = [
  ['item_code', 'Yes', 'Unique code, e.g. CHM-101'], ['name', 'Yes', 'Item name'],
  ['category', 'Yes', 'Must match an existing category name'], ['quantity', 'No', 'Opening stock, default 0'],
  ['unit', 'No', 'bottle, piece, litre… default "piece"'], ['minimum_stock', 'No', 'Low-stock level, default 0'],
  ['supplier', 'No', 'Supplier name. Created automatically if new'], ['location', 'No', 'Must match an existing location (see list below)'],
  ['condition', 'No', 'Good, Damaged, Under Maintenance, Lost, Disposed. Default Good'], ['description', 'No', 'Free text'],
  ['date_received', 'No', 'Chemicals only. YYYY-MM-DD or DD/MM/YYYY'], ['opening_date', 'No', 'Chemicals only'], ['expiry_date', 'No', 'Chemicals only']
];
const ALIAS = { code: 'item_code', itemcode: 'item_code', item_name: 'name', item: 'name', qty: 'quantity', min_stock: 'minimum_stock', minimum: 'minimum_stock',
  min: 'minimum_stock', received: 'date_received', opened: 'opening_date', expiry: 'expiry_date', expiry_date: 'expiry_date', cat: 'category', desc: 'description' };
const MAX_ROWS = 2000;

/* ---------- upload (multer keeps the file in memory; nothing is saved to disk) ---------- */
const uploader = multer({
  storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, f, cb) => /\.(csv|xlsx)$/i.test(f.originalname) ? cb(null, true)
    : cb(new UserError('Only .csv or .xlsx files are allowed. (Old .xls files: open in Excel and Save As .xlsx.)'))
}).single('file');
exports.upload = (req, res, next) => uploader(req, res, e => {
  if (!e) return next();
  req.flash('error', e instanceof UserError ? e.message : e.code === 'LIMIT_FILE_SIZE' ? 'That file is larger than 5 MB.' : 'Upload failed. Please try again.');
  res.redirect('/admin/import');
});

/* ---------- reading the file ---------- */
const norm = h => { const k = String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); return ALIAS[k] || k; };
function text(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') return v.result !== undefined ? text(v.result) : v.richText ? v.richText.map(t => t.text).join('') : v.text !== undefined ? text(v.text) : '';
  return String(v).trim();
}
async function readRows(file) {
  const wb = new ExcelJS.Workbook(); let ws;
  try {
    if (/\.csv$/i.test(file.originalname)) ws = await wb.csv.read(Readable.from(file.buffer), { map: v => v });   // keep every CSV cell as text
    else { await wb.xlsx.load(file.buffer); ws = wb.worksheets[0]; }
  } catch (e) { throw new UserError('Could not read that file. Make sure it is a valid .csv or .xlsx file.'); }
  if (!ws || ws.rowCount < 2) throw new UserError('The file has no data rows. Row 1 must be the column names.');
  const head = []; ws.getRow(1).eachCell({ includeEmpty: true }, (c, i) => { head[i] = norm(text(c.value)); });
  const miss = ['item_code', 'name', 'category'].filter(c => !head.includes(c));
  if (miss.length) throw new UserError(`Missing column(s): ${miss.join(', ')}. Download the template to see the expected headings.`);
  const rows = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const o = {}; let any = false;
    head.forEach((h, i) => { if (!h) return; const v = text(row.getCell(i).value); o[h] = v; if (v) any = true; });
    if (any) rows.push({ n, o });
  });
  if (rows.length > MAX_ROWS) throw new UserError(`Too many rows (${rows.length}). Import at most ${MAX_ROWS} at a time.`);
  return rows;
}

/* ---------- checking one row ---------- */
function toDate(s, label, err) {
  if (!s) return null;
  let y, m, d, x;
  if ((x = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) [, y, m, d] = x;
  else if ((x = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s))) [, d, m, y] = x;
  const dt = new Date(+y, +m - 1, +d);
  if (!y || dt.getFullYear() !== +y || dt.getMonth() !== +m - 1 || dt.getDate() !== +d) { err.push(`${label} "${s}" is not a valid date`); return null; }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
const locKey = s => String(s).toLowerCase().replace(/\s*[>›]\s*/g, ' › ').trim();
function check(o, ctx) {
  const err = [], d = {};
  d.item_code = (o.item_code || '').toUpperCase(); d.name = o.name || '';
  if (!d.item_code) err.push('item_code is empty'); if (!d.name) err.push('name is empty');
  const cat = ctx.cats.get((o.category || '').toLowerCase());
  if (!cat) err.push(`category "${o.category || ''}" does not exist`); d.category_id = cat || null;
  const num = (k) => { if (!o[k]) return 0; const n = Number(o[k]); if (!isFinite(n) || n < 0) { err.push(`${k} must be a number, 0 or more`); return 0; } return n; };
  d.quantity = num('quantity'); d.minimum_stock = num('minimum_stock'); d.unit = o.unit || 'piece';
  d.condition = o.condition ? items.CONDITIONS.find(c => c.toLowerCase() === o.condition.toLowerCase()) : 'Good';
  if (!d.condition) err.push(`condition "${o.condition}" is not valid`);
  d.location_id = null;
  if (o.location) { d.location_id = ctx.locs.get(locKey(o.location)) || null; if (!d.location_id) err.push(`location "${o.location}" does not exist`); }
  d.date_received = toDate(o.date_received, 'date_received', err); d.opening_date = toDate(o.opening_date, 'opening_date', err); d.expiry_date = toDate(o.expiry_date, 'expiry_date', err);
  d.description = o.description || null; d.supplier_name = o.supplier || '';
  return { d, err };
}
async function context() {
  const cats = new Map(), locs = new Map(), sups = new Map();
  (await db.query('SELECT id,name FROM categories')).rows.forEach(r => cats.set(r.name.toLowerCase(), r.id));
  (await db.query('SELECT id,name FROM suppliers')).rows.forEach(r => sups.set(r.name.toLowerCase(), r.id));
  (await db.query(`SELECT id,CONCAT_WS(' › ',building,room,storage_area,cabinet,shelf,position) AS label FROM locations`)).rows.forEach(r => locs.set(locKey(r.label), r.id));
  return { cats, locs, sups };
}

/* ---------- pages ---------- */
exports.page = wrap(async (req, res) => {
  const result = req.session.importResult || null; delete req.session.importResult;
  res.render('admin/import', { title: 'Import items', cols: COLS, opts: await lk.options(), result, conditions: items.CONDITIONS });
});
exports.template = (req, res) => {
  const rows = [COLS.map(c => c[0]).join(','),
    'CHM-101,Sulphuric Acid 1M,Chemical,10,bottle,3,ChemWorld,Science Block › Chemistry Lab › Chemical Store › C02 › B › B-03,Good,Dilute acid,2026-01-10,2026-02-01,2028-01-10',
    'GLS-101,Test Tube 15 ml,Glassware,100,piece,30,SciSupply Ltd,Science Block › Chemistry Lab › Glassware Store › G01 › A › A-01,Good,,,,'];
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="labtrack-import-template.csv"' });
  res.send('\uFEFF' + rows.join('\r\n'));       // BOM so Excel shows the › character correctly
};
exports.run = guard('/admin/import', async (req, res) => {
  if (!req.file) throw new UserError('Choose a .csv or .xlsx file first.');
  const rows = await readRows(req.file), ctx = await context();
  const out = { file: req.file.originalname, total: rows.length, added: 0, skipped: [], failed: [] };
  for (const { n, o } of rows) {
    const { d, err } = check(o, ctx);
    if (err.length) { out.failed.push({ row: n, msg: err.join('; ') }); continue; }
    try {
      if (d.supplier_name) {
        const k = d.supplier_name.toLowerCase();
        if (!ctx.sups.has(k)) ctx.sups.set(k, (await db.query('INSERT INTO suppliers(name) VALUES($1) RETURNING id', [d.supplier_name])).rows[0].id);
        d.supplier_id = ctx.sups.get(k);
      } else d.supplier_id = null;
      await items.create(d, req.session.user.id); out.added++;
    } catch (e) {
      if (e.code === '23505') out.skipped.push({ row: n, msg: `item code ${d.item_code} already exists` });
      else { console.error(e); out.failed.push({ row: n, msg: 'Could not save this row (database error).' }); }
    }
  }
  out.skipped = out.skipped.slice(0, 100); out.failed = out.failed.slice(0, 100);
  req.session.importResult = out;
  res.redirect('/admin/import');
});
