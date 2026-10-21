const r = require('express').Router(), c = require('../controllers/authController');
r.get('/', c.root);
r.get('/login', c.loginPage); r.post('/login', c.login);
r.get('/register', c.registerPage); r.post('/register', c.register);
r.post('/logout', c.logout);
module.exports = r;
