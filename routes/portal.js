// Requester portal - role "user" only (guard is applied in server.js)
const r = require('express').Router(), c = require('../controllers/requestController');
r.param('id', (q, s, n, v) => /^\d+$/.test(v) ? n() : n('route'));
r.get('/', c.portalHome);
r.get('/catalogue', c.catalogue);
r.get('/request/new', c.newForm);
r.post('/requests', c.create);
r.get('/requests', c.mine);
r.post('/requests/:id/cancel', c.cancel);
module.exports = r;
