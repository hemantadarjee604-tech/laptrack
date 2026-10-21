const lk = require('../models/lookupModel'), { wrap, guard } = require('../utils/helpers');
exports.list = key => wrap(async (req, res) => res.render('admin/lookup', {
  title: lk.T[key].title, key, cfg: lk.T[key], rows: await lk.all(key), edit: req.query.edit ? await lk.one(key, +req.query.edit) : null }));
exports.save = key => guard('/admin/' + key, async (req, res) => {
  await lk.save(key, +req.body.id || null, req.body); req.flash('success', 'Saved.'); res.redirect('/admin/' + key);
});
exports.remove = key => guard('/admin/' + key, async (req, res) => { await lk.remove(key, req.params.id); req.flash('success', 'Deleted.'); res.redirect('/admin/' + key); });
