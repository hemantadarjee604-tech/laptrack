// Admin area (guard applied in server.js).
const r = require('express').Router(), { requireRole } = require('../middleware/auth'), ADMIN = requireRole('admin');
const imp = require('../controllers/importController'),
  dash = require('../controllers/dashboardController'), items = require('../controllers/itemController'),
  stock = require('../controllers/stockController'), rq = require('../controllers/requestController'),
  lk = require('../controllers/lookupController'), users = require('../controllers/userController'), reports = require('../controllers/reportController');

r.param('id', (q, s, n, v) => /^\d+$/.test(v) ? n() : n('route'));
r.get('/', dash.index);

r.get('/items', items.list); r.get('/items/new', items.newForm); r.post('/items', items.create);
r.get('/items/:id', items.show); r.get('/items/:id/edit', items.editForm); r.post('/items/:id', items.update);
r.post('/items/:id/delete', ADMIN, items.remove);

r.get('/import', ADMIN, imp.page); r.get('/import/template', ADMIN, imp.template); r.post('/import', ADMIN, imp.upload, imp.run);

r.get('/stock/:type(in|out)', stock.form); r.post('/stock/:type(in|out)', stock.record);
r.get('/transactions', stock.history);

r.get('/requests', rq.adminList);
r.post('/requests/:id/approve', rq.approve); r.post('/requests/:id/reject', rq.reject); r.post('/requests/:id/issue', rq.issue);

r.get('/reports', (q, s) => s.redirect('/admin/reports/inventory')); r.get('/reports/:type', reports.show);

['categories', 'suppliers', 'locations'].forEach(k => {
  r.get('/' + k, ADMIN, lk.list(k)); r.post('/' + k + '/save', ADMIN, lk.save(k)); r.post('/' + k + '/:id/delete', ADMIN, lk.remove(k));
});
r.get('/users', ADMIN, users.list); r.post('/users', ADMIN, users.create);
r.post('/users/:id/role', ADMIN, users.role); r.post('/users/:id/password', ADMIN, users.password); r.post('/users/:id/delete', ADMIN, users.remove);
module.exports = r;
