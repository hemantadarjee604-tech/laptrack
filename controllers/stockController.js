const stock = require('../models/stockModel'), items = require('../models/itemModel'), lk = require('../models/lookupModel');
const { wrap, guard, nn, UserError } = require('../utils/helpers');
const TYPE = { in: 'IN', out: 'OUT' };

exports.form = wrap(async (req, res) => res.render('admin/stock-form', {
  title: req.params.type === 'in' ? 'Stock in' : 'Stock out', type: req.params.type,
  items: await items.list(), suppliers: (await lk.options()).suppliers, sel: +req.query.item || 0 }));

exports.record = guard(req => '/admin/stock/' + req.params.type, async (req, res) => {
  const type = TYPE[req.params.type], qty = +req.body.quantity;
  if (!+req.body.item_id) throw new UserError('Choose an item.');
  if (!(qty > 0)) throw new UserError('Quantity must be greater than zero.');
  await stock.record({ itemId: +req.body.item_id, userId: req.session.user.id, type, qty,
    reason: nn(req.body.reason) || (type === 'IN' ? 'Stock received' : 'Stock used'), supplierId: type === 'IN' ? nn(req.body.supplier_id) : null });
  req.flash('success', type === 'IN' ? 'Stock added.' : 'Stock removed.'); res.redirect('/admin/transactions');
});
exports.history = wrap(async (req, res) => res.render('admin/transactions', { title: 'Transaction history', rows: await stock.history(req.query), f: req.query }));
