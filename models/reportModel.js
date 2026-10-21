const db = require('../config/db'), items = require('./itemModel'), stock = require('./stockModel'), requests = require('./requestModel');

exports.dashboard = async () => {
  const q = async (s) => (await db.query(s)).rows;
  const [stats] = await q(`SELECT COUNT(*) total,
    COUNT(*) FILTER (WHERE c.is_chemical) chemicals,
    COUNT(*) FILTER (WHERE lower(c.name)='equipment') equipment,
    COUNT(*) FILTER (WHERE i.quantity>0 AND i.quantity<=i.minimum_stock) low,
    COUNT(*) FILTER (WHERE i.quantity<=0) outofstock,
    COUNT(*) FILTER (WHERE cd.expiry_date<=CURRENT_DATE+30) expiring
    FROM items i JOIN categories c ON c.id=i.category_id LEFT JOIN chemical_details cd ON cd.item_id=i.id`);
  const byCategory = await q('SELECT c.name,COUNT(i.id) n FROM categories c LEFT JOIN items i ON i.category_id=c.id GROUP BY c.name ORDER BY n DESC');
  const all = await items.list();
  const attention = all.filter(i => i.stock_status !== 'Available' || ['Expired', 'Expiring soon'].includes(i.expiry_status)).slice(0, 8);
  return { stats, byCategory, attention, recent: await stock.history({ limit: 6 }), pendingList: (await requests.all('pending')).slice(0, 5), reqCounts: await requests.counts() };
};

const fmt = v => v instanceof Date ? v.toISOString().slice(0, 16).replace('T', ' ') : v;
const REPORTS = {
  inventory: { title: 'Inventory report', note: 'Every item with its current stock, location and condition.',
    cols: [['item_code', 'Code'], ['name', 'Item'], ['category', 'Category'], ['quantity', 'Qty'], ['unit', 'Unit'], ['location', 'Location'], ['condition', 'Condition', 1], ['stock_status', 'Stock', 1]],
    rows: () => items.list() },
  low: { title: 'Low stock report', note: 'Items at or below their minimum stock level.',
    cols: [['item_code', 'Code'], ['name', 'Item'], ['quantity', 'Qty'], ['minimum_stock', 'Minimum'], ['unit', 'Unit'], ['supplier', 'Supplier'], ['stock_status', 'Status', 1]],
    rows: async () => (await items.list()).filter(i => i.stock_status !== 'Available') },
  expiry: { title: 'Expiry report', note: 'Chemicals that are expired or expire within 30 days.',
    cols: [['item_code', 'Code'], ['name', 'Chemical'], ['date_received', 'Received'], ['opening_date', 'Opened'], ['expiry_date', 'Expiry'], ['location', 'Location'], ['expiry_status', 'Status', 1]],
    rows: async () => (await items.list()).filter(i => ['Expired', 'Expiring soon'].includes(i.expiry_status)).sort((a, b) => a.expiry_date < b.expiry_date ? -1 : 1) },
  movement: { title: 'Stock movement report', note: 'The latest 300 stock-in and stock-out transactions.',
    cols: [['transaction_date', 'Date'], ['item_name', 'Item'], ['transaction_type', 'Type', 1], ['quantity', 'Qty'], ['reason', 'Reason'], ['user_name', 'User']],
    rows: async () => (await stock.history()).map(r => ({ ...r, transaction_date: fmt(r.transaction_date) })) },
  location: { title: 'Location report', note: 'Items grouped by where they are stored.',
    cols: [['location', 'Location'], ['item_code', 'Code'], ['name', 'Item'], ['quantity', 'Qty'], ['unit', 'Unit']],
    rows: async () => (await items.list()).map(i => ({ ...i, location: i.location || 'Not assigned' })).sort((a, b) => a.location.localeCompare(b.location)) },
  requests: { title: 'Requests report', note: 'All laboratory item requests and their outcome.',
    cols: [['id', '#'], ['requester', 'Requested by'], ['item_name', 'Item'], ['quantity', 'Qty'], ['needed_by', 'Needed by'], ['status', 'Status', 1], ['handler', 'Handled by']],
    rows: () => requests.all() }
};
exports.types = Object.keys(REPORTS).map(k => [k, REPORTS[k].title]);
exports.run = async type => {
  const r = REPORTS[type]; if (!r) return null;
  return { type, title: r.title, note: r.note, cols: r.cols.map(([k, l, badge]) => ({ k, l, badge })), rows: await r.rows() };
};
