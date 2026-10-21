// Session helpers, flash messages and role checks.
exports.home = role => role === 'user' ? '/portal' : '/admin';

exports.attach = (req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null; delete req.session.flash;
  res.locals.pending = 0;
  req.flash = (type, msg) => { req.session.flash = { type, msg }; };
  next();
};
exports.requireLogin = (req, res, next) =>
  req.session.user ? next() : (req.flash('warn', 'Please log in to continue.'), res.redirect('/login'));

exports.requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.session.user.role) ? next()
    : res.status(403).render('error', { title: 'Not allowed', code: 403, message: 'You do not have permission to open this page.' });
