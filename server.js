// LabTrack entry point: Express setup, sessions, route mounting, error pages.
require('dotenv').config();
const path = require('path'), express = require('express'), session = require('express-session');
const { attach, requireLogin, requireRole } = require('./middleware/auth');
const requests = require('./models/requestModel');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-secret', resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 3600 * 1000 }
}));
app.use(attach);

// Helpers available inside every EJS view
app.locals.d = v => v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : '–';
app.locals.dt = v => v ? new Date(v).toISOString().slice(0, 16).replace('T', ' ') : '–';
app.locals.cls = s => String(s || '').toLowerCase().replace(/[^a-z]+/g, '-');   // 'Low stock' -> 'low-stock' (badge colour)
app.locals.today = () => new Date().toISOString().slice(0, 10);

// Pending-request badge in the sidebar for the admin
app.use(async (req, res, next) => {
  try { if (req.session.user && req.session.user.role === 'admin') res.locals.pending = await requests.pendingCount(); next(); }
  catch (e) { next(e); }
});

app.use('/', require('./routes/auth'));
app.use('/portal', requireLogin, requireRole('user'), require('./routes/portal'));
app.use('/admin', requireLogin, requireRole('admin'), require('./routes/admin'));

app.use((req, res) => res.status(404).render('error', { title: 'Page not found', code: 404, message: 'We could not find that page.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Something went wrong', code: 500, message: 'An unexpected error happened. Please try again.' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) app.listen(PORT, () => console.log(`LabTrack running at http://localhost:${PORT}`));
module.exports = app;
