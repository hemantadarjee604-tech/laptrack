const bcrypt = require('bcryptjs'), users = require('../models/userModel'), { wrap, guard, UserError } = require('../utils/helpers');
const ROLES = ['admin', 'user'];
exports.list = wrap(async (req, res) => res.render('admin/users', { title: 'Users', rows: await users.all(), roles: ROLES }));
exports.create = guard('/admin/users', async (req, res) => {
  const b = req.body, email = (b.email || '').trim().toLowerCase();
  if (!(b.name || '').trim() || !email) throw new UserError('Name and email are required.');
  if ((b.password || '').length < 6) throw new UserError('Password must be at least 6 characters.');
  if (!ROLES.includes(b.role)) throw new UserError('Choose a role.');
  await users.create({ name: b.name.trim(), email, hash: await bcrypt.hash(b.password, 10), role: b.role, department: (b.department || '').trim() || null });
  req.flash('success', 'User created.'); res.redirect('/admin/users');
});
exports.role = guard('/admin/users', async (req, res) => {
  if (+req.params.id === req.session.user.id) throw new UserError('You cannot change your own role.');
  if (!ROLES.includes(req.body.role)) throw new UserError('Invalid role.');
  await users.setRole(req.params.id, req.body.role); req.flash('success', 'Role updated.'); res.redirect('/admin/users');
});
exports.password = guard('/admin/users', async (req, res) => {
  if ((req.body.password || '').length < 6) throw new UserError('New password must be at least 6 characters.');
  await users.setPassword(req.params.id, await bcrypt.hash(req.body.password, 10)); req.flash('success', 'Password reset.'); res.redirect('/admin/users');
});
exports.remove = guard('/admin/users', async (req, res) => {
  if (+req.params.id === req.session.user.id) throw new UserError('You cannot delete your own account.');
  await users.remove(req.params.id); req.flash('success', 'User deleted.'); res.redirect('/admin/users');
});
