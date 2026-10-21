const items = require('../models/itemModel'), lk = require('../models/lookupModel'), stock = require('../models/stockModel');
const { wrap, guard, nn, UserError } = require('../utils/helpers');

const parse = b => ({
  item_code: (b.item_code || '').trim().toUpperCase(), name: (b.name || '').trim(), category_id: +b.category_id,
  quantity: Math.max(0, +b.quantity || 0), unit: (b.unit || 'piece').trim(), minimum_stock: Math.max(0, +b.minimum_stock || 0),
  supplier_id: nn(b.supplier_id), location_id: nn(b.location_id), condition: b.condition || 'Good', description: nn(b.description),
  date_received: nn(b.date_received), opening_date: nn(b.opening_date), expiry_date: nn(b.expiry_date)
});
const check = d => { if (!d.item_code || !d.name || !d.category_id) throw new UserError('Item code, name and category are required.'); };
const blank = { item_code: '', name: '', category_id: '', quantity: 0, unit: 'piece', minimum_stock: 0, supplier_id: '', location_id: '', condition: 'Good', description: '', date_received: '', opening_date: '', expiry_date: '' };
const notFound = res => res.status(404).render('error', { title: 'Not found', code: 404, message: 'That item does not exist.' });

exports.list = wrap(async (req, res) => res.render('admin/items', { title: 'Inventory', items: await items.list(req.query), f: req.query, opts: await lk.options(), conditions: items.CONDITIONS }));
exports.newForm = wrap(async (req, res) => res.render('admin/item-form', { title: 'Add item', item: blank, isNew: true, opts: await lk.options(), conditions: items.CONDITIONS }));
exports.create = guard('/admin/items/new', async (req, res) => {
  const d = parse(req.body); check(d);
  const id = await items.create(d, req.session.user.id);
  req.flash('success', 'Item added to the inventory.'); res.redirect('/admin/items/' + id);
});
exports.show = wrap(async (req, res) => {
  const item = await items.find(req.params.id); if (!item) return notFound(res);
  res.render('admin/item', { title: item.name, item, history: await stock.history({ item: item.id, limit: 8 }) });
});
exports.editForm = wrap(async (req, res) => {
  const item = await items.find(req.params.id); if (!item) return notFound(res);
  res.render('admin/item-form', { title: 'Edit item', item, isNew: false, opts: await lk.options(), conditions: items.CONDITIONS });
});
exports.update = guard(req => `/admin/items/${req.params.id}/edit`, async (req, res) => {
  const d = parse(req.body); check(d);
  await items.update(req.params.id, d);
  req.flash('success', 'Item updated.'); res.redirect('/admin/items/' + req.params.id);
});
exports.remove = wrap(async (req, res) => {
  await items.remove(req.params.id); req.flash('success', 'Item deleted.'); res.redirect('/admin/items');
});
