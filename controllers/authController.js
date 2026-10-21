const bcrypt = require('bcryptjs'), users = require('../models/userModel');
const { home } = require('../middleware/auth'), { wrap, guard, UserError } = require('../utils/helpers');

exports.root = (req, res) => res.redirect(req.session.user ? home(req.session.user.role) : '/login');
exports.loginPage = (req, res) => req.session.user ? res.redirect(home(req.session.user.role)) : res.render('auth/login', { title: 'Log in' });
exports.registerPage = (req, res) => res.render('auth/register', { title: 'Create account', f: {} });

exports.login = wrap(async (req, res, next) => {
  const u = await users.byEmail((req.body.email || '').trim().toLowerCase());
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password))) {
    req.flash('error', 'Wrong email or password.'); return res.redirect('/login');
  }
  req.session.regenerate(err => {                       // new session id on login (prevents session fixation)
    if (err) return next(err);
    req.session.user = { id: u.id, name: u.name, role: u.role };
    req.session.flash = { type: 'success', msg: `Welcome back, ${u.name.split(' ')[0]}.` };
    res.redirect(home(u.role));
  });
});
exports.register = guard('/register', async (req, res) => {
  const b = req.body, email = (b.email || '').trim().toLowerCase();
  if (!(b.name || '').trim() || !email) throw new UserError('Name and email are required.');
  if ((b.password || '').length < 6) throw new UserError('Password must be at least 6 characters.');
  if (b.password !== b.confirm) throw new UserError('Passwords do not match.');
  await users.create({ name: b.name.trim(), email, hash: await bcrypt.hash(b.password, 10), role: 'user', department: (b.department || '').trim() || null });
  req.flash('success', 'Account created. You can log in now.'); res.redirect('/login');
});
exports.logout = (req, res) => req.session.destroy(() => res.redirect('/login'));
