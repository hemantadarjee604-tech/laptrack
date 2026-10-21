// JEST 5: CSV / Excel import (controllers/importController.js) through the real Express app.
// Database and models are mocked, so this runs without PostgreSQL.
jest.mock('../config/db', () => ({ query: jest.fn(), tx: jest.fn(), pool: {} }));
jest.mock('../models/userModel', () => ({ byEmail: jest.fn() }));
jest.mock('../models/itemModel', () => ({
  CONDITIONS: ['Good', 'Damaged', 'Under Maintenance', 'Lost', 'Disposed'], create: jest.fn(), list: jest.fn()
}));
const request = require('supertest'), bcrypt = require('bcryptjs');
const db = require('../config/db'), users = require('../models/userModel'), items = require('../models/itemModel');
const app = require('../server');

beforeEach(() => {
  items.create.mockReset().mockResolvedValue(1);
  db.query.mockReset().mockImplementation(async sql => {            // tiny fake database
    if (/FROM categories/.test(sql)) return { rows: [{ id: 1, name: 'Chemical', is_chemical: true }, { id: 2, name: 'Glassware', is_chemical: false }] };
    if (/COUNT\(\*\) n FROM requests/.test(sql)) return { rows: [{ n: 0 }] };
    return { rows: [] };                                            // suppliers, locations
  });
});

test('5. Admin CSV import saves valid rows, reports bad rows, and requesters cannot import', async () => {
  const hash = await bcrypt.hash('Pass@123', 4);
  const account = role => ({ id: role === 'admin' ? 1 : 2, name: 'Tester', email: 't@x.test', password: hash, role });

  // log in as admin
  users.byEmail.mockResolvedValueOnce(account('admin'));
  const admin = request.agent(app);
  await admin.post('/login').type('form').send({ email: 't@x.test', password: 'Pass@123' }).expect(302).expect('Location', '/admin');

  // upload: one good row, one row with a category that does not exist
  const csv = 'item_code,name,category,quantity\nTST-1,Good Item,Glassware,5\nTST-2,Bad Category,Metals,3\n';
  await admin.post('/admin/import').attach('file', Buffer.from(csv), 'items.csv').expect(302).expect('Location', '/admin/import');

  expect(items.create).toHaveBeenCalledTimes(1);                                   // only the valid row is saved
  expect(items.create.mock.calls[0][0]).toMatchObject({ item_code: 'TST-1', name: 'Good Item', category_id: 2, quantity: 5 });
  expect(items.create.mock.calls[0][1]).toBe(1);                                   // created by user id 1

  const page = await admin.get('/admin/import').expect(200);                       // result report
  expect(page.text).toMatch(/Added<b>1<\/b>/);
  expect(page.text).toMatch(/Failed<b>1<\/b>/);
  expect(page.text).toMatch(/Metals.*does not exist/);

  // a requester is refused
  users.byEmail.mockResolvedValueOnce(account('user'));
  const user = request.agent(app);
  await user.post('/login').type('form').send({ email: 't@x.test', password: 'Pass@123' }).expect(302).expect('Location', '/portal');
  await user.post('/admin/import').attach('file', Buffer.from(csv), 'items.csv').expect(403);
  expect(items.create).toHaveBeenCalledTimes(1);                                   // nothing new saved
});
