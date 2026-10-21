// Small shared helpers.
class UserError extends Error {}                       // a mistake the user can fix (shown as a flash message)
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const nn = v => (v === undefined || v === null || String(v).trim() === '') ? null : String(v).trim();

// guard(): wrap a POST handler; friendly errors are flashed and the user is sent back.
const guard = (back, fn) => wrap(async (req, res, next) => {
  try { await fn(req, res, next); }
  catch (e) {
    if (e instanceof UserError || e.code === '23505') {
      req.flash('error', e instanceof UserError ? e.message : 'That code or email is already in use.');
      return res.redirect(typeof back === 'function' ? back(req) : back);
    }
    throw e;
  }
});
const csv = (cols, rows) => [cols.map(c => c.l)].concat(rows.map(r => cols.map(c => r[c.k] ?? '')))
  .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');

module.exports = { UserError, wrap, nn, guard, csv };
