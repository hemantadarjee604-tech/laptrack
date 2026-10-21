// JEST 1 + 2: the core stock rule (models/stockModel.js -> move)
// No database needed: the PostgreSQL client is replaced by a fake.
jest.mock('../config/db', () => ({ query: jest.fn(), tx: jest.fn(), pool: {} }));
const stock = require('../models/stockModel');
const { UserError } = require('../utils/helpers');

// Fake DB client: the item lookup returns the given stock level, everything else returns nothing.
const fakeClient = qty => ({
  query: jest.fn(async sql => /FROM items/.test(sql)
    ? { rows: [{ quantity: qty, name: 'Beaker 250 ml', unit: 'piece' }] }
    : { rows: [] })
});
const sqlOf = c => c.query.mock.calls.map(call => call[0]);

test('1. Stock OUT is refused when it would take stock below zero', async () => {
  const c = fakeClient(10);
  const err = await stock.move(c, { itemId: 1, userId: 1, type: 'OUT', qty: 15, reason: 'Experiment' }).catch(e => e);

  expect(err).toBeInstanceOf(UserError);
  expect(err.message).toBe('Only 10 piece of Beaker 250 ml in stock.');
  expect(sqlOf(c).some(s => /UPDATE items/.test(s))).toBe(false);                    // quantity untouched
  expect(sqlOf(c).some(s => /INSERT INTO stock_transactions/.test(s))).toBe(false);  // nothing logged
});

test('2. Stock IN adds the quantity and writes an IN transaction; OUT within limit subtracts', async () => {
  const cIn = fakeClient(10);
  await stock.move(cIn, { itemId: 7, userId: 2, type: 'IN', qty: 5, reason: 'New purchase', supplierId: 3 });
  expect(cIn.query.mock.calls.find(x => /UPDATE items/.test(x[0]))[1]).toEqual([5, 7]);                     // +5 on item 7
  expect(cIn.query.mock.calls.find(x => /INSERT INTO stock_transactions/.test(x[0]))[1])
    .toEqual([7, 2, 'IN', 5, 'New purchase', 3, null]);

  const cOut = fakeClient(10);
  await stock.move(cOut, { itemId: 7, userId: 2, type: 'OUT', qty: 4, reason: 'Used' });
  expect(cOut.query.mock.calls.find(x => /UPDATE items/.test(x[0]))[1]).toEqual([-4, 7]);                   // -4 on item 7
});
