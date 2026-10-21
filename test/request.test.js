// JEST 3: request lifecycle rule (models/requestModel.js -> issue)
// Only an APPROVED request can be issued, and issuing reduces stock.
jest.mock('../config/db', () => ({ query: jest.fn(), tx: jest.fn(), pool: {} }));
const db = require('../config/db');
const rq = require('../models/requestModel');
const { UserError } = require('../utils/helpers');

// Fake client that "contains" request #9 (3 units of item 4) in the given status, and 10 units in stock.
const clientWith = status => ({
  query: jest.fn(async sql => {
    if (/FROM requests WHERE id/.test(sql)) return { rows: [{ id: 9, item_id: 4, quantity: 3, status }] };
    if (/FROM items/.test(sql)) return { rows: [{ quantity: 10, name: 'Ethanol 95%', unit: 'litre' }] };
    return { rows: [] };
  })
});
const run = c => { db.tx.mockImplementation(fn => fn(c)); return rq.issue(9, 1); };
const sqlOf = c => c.query.mock.calls.map(call => call[0]);

test('3. Only an approved request can be issued; issuing reduces stock and marks it issued', async () => {
  // a) still pending -> refused, nothing changes
  const pending = clientWith('pending');
  const err = await run(pending).catch(e => e);
  expect(err).toBeInstanceOf(UserError);
  expect(err.message).toBe('Only approved requests can be issued.');
  expect(sqlOf(pending).some(s => /^\s*UPDATE/.test(s))).toBe(false);

  // b) approved -> stock reduced by 3 and request marked issued
  const approved = clientWith('approved');
  await run(approved);
  expect(approved.query.mock.calls.find(x => /UPDATE items/.test(x[0]))[1]).toEqual([-3, 4]);
  expect(sqlOf(approved).some(s => /UPDATE requests SET status='issued'/.test(s))).toBe(true);
});
