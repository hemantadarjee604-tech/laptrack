const rq = require('../models/requestModel'), items = require('../models/itemModel'), lk = require('../models/lookupModel');
const { wrap, guard, nn, UserError } = require('../utils/helpers');

const requestable = list => list.filter(i => i.expiry_status !== 'Expired' && !['Lost', 'Disposed'].includes(i.condition));

/* ---------- portal (role: user) ---------- */
exports.portalHome = wrap(async (req, res) => {
  const mine = await rq.byUser(req.session.user.id);
  const counts = mine.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {});
  res.render('portal/home', { title: 'My dashboard', mine: mine.slice(0, 5), counts, total: mine.length, cats: (await lk.options()).categories });
});
exports.catalogue = wrap(async (req, res) => res.render('portal/catalogue', {
  title: 'Catalogue', items: requestable(await items.list({ q: req.query.q, category: req.query.category })), f: req.query, opts: await lk.options() }));
exports.newForm = wrap(async (req, res) => res.render('portal/request-form', {
  title: 'New request', items: requestable(await items.list({ inStock: 1 })), sel: +req.query.item || 0 }));
exports.create = guard('/portal/request/new', async (req, res) => {
  const b = req.body, qty = +b.quantity, it = await items.find(+b.item_id);
  if (!it) throw new UserError('Choose an item to request.');
  if (!(qty > 0)) throw new UserError('Quantity must be greater than zero.');
  if (qty > it.quantity) throw new UserError(`Only ${it.quantity} ${it.unit} of ${it.name} available right now.`);
  if (!nn(b.purpose)) throw new UserError('Please say what you need it for.');
  await rq.create({ user_id: req.session.user.id, item_id: it.id, quantity: qty, purpose: b.purpose.trim(), needed_by: nn(b.needed_by) });
  req.flash('success', 'Request sent. You will see its status here.'); res.redirect('/portal/requests');
});
exports.mine = wrap(async (req, res) => res.render('portal/requests', { title: 'My requests', rows: await rq.byUser(req.session.user.id) }));
exports.cancel = guard('/portal/requests', async (req, res) => {
  await rq.cancel(req.params.id, req.session.user.id); req.flash('success', 'Request cancelled.'); res.redirect('/portal/requests');
});

/* ---------- admin ---------- */
const STATUSES = ['pending', 'approved', 'issued', 'rejected', 'cancelled'];
exports.adminList = wrap(async (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : '';
  res.render('admin/requests', { title: 'Requests', rows: await rq.all(status), status, statuses: STATUSES, counts: await rq.counts() });
});
const back = '/admin/requests?status=pending';
exports.approve = guard(back, async (req, res) => { await rq.decide(req.params.id, 'approved', req.session.user.id, nn(req.body.note)); req.flash('success', 'Request approved. Issue it when the item is handed over.'); res.redirect('/admin/requests?status=approved'); });
exports.reject = guard(back, async (req, res) => {
  if (!nn(req.body.note)) throw new UserError('Please give a reason so the requester knows why.');
  await rq.decide(req.params.id, 'rejected', req.session.user.id, req.body.note.trim()); req.flash('success', 'Request rejected.'); res.redirect(back);
});
exports.issue = guard('/admin/requests?status=approved', async (req, res) => { await rq.issue(req.params.id, req.session.user.id); req.flash('success', 'Issued. Stock has been reduced automatically.'); res.redirect('/admin/requests?status=issued'); });
