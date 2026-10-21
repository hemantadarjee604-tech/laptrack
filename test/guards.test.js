// JEST 4: route guards (middleware/auth.js) - the security rule behind the admin/requester split.
const { requireLogin, requireRole } = require('../middleware/auth');
const makeRes = () => ({ status: jest.fn().mockReturnThis(), render: jest.fn(), redirect: jest.fn() });

test('4. Anonymous users go to login, requesters are blocked from admin pages, admins pass', () => {
  // anonymous -> redirected to /login
  let req = { session: {}, flash: jest.fn() }, res = makeRes(), next = jest.fn();
  requireLogin(req, res, next);
  expect(res.redirect).toHaveBeenCalledWith('/login');
  expect(next).not.toHaveBeenCalled();

  // requester (role "user") -> 403 error page
  req = { session: { user: { role: 'user' } } }; res = makeRes(); next = jest.fn();
  requireRole('admin')(req, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.render).toHaveBeenCalledWith('error', expect.objectContaining({ code: 403 }));
  expect(next).not.toHaveBeenCalled();

  // admin -> allowed through
  req = { session: { user: { role: 'admin' } } }; res = makeRes(); next = jest.fn();
  requireRole('admin')(req, res, next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(res.status).not.toHaveBeenCalled();
});
