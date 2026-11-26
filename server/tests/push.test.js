import test from 'node:test';
import assert from 'node:assert/strict';
import { createPushService, pushMessage, validPushToken } from '../src/services/push.service.js';

const token = 'ExponentPushToken[abcDEF123456xyz]';

test('push tokens must be Expo tokens', () => {
  assert.equal(validPushToken(token), token);
  for (const bad of ['', 'abc', 'ExponentPushToken[]', 'ExponentPushToken[a b]', 12, null, 'x'.repeat(300)])
    assert.throws(() => validPushToken(bad), { statusCode: 400 });
});

test('push messages use the ting sound, the alerts channel and open the Alerts tab', () => {
  const message = pushMessage(token, { id: 'bill-1', title: 'New water bill', body: 'x'.repeat(300) });
  assert.equal(message.sound, 'ting.wav');
  assert.equal(message.channelId, 'pwss-alerts');
  assert.equal(message.data.url, '/announcements');
  assert.equal(message.body.length, 240);
});

function fakeDb({ devices = [], deliveries = [] } = {}) {
  const calls = [];
  const execute = async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes('FROM push_devices d')) return [devices];
    if (sql.includes('FROM push_deliveries WHERE device_id')) return [deliveries];
    if (sql.startsWith('SELECT id, user_id AS userId FROM push_devices')) return [[]];
    if (sql.startsWith('INSERT INTO push_devices')) return [{ insertId: 77 }];
    return [{}];
  };
  const connection = {
    execute,
    async beginTransaction() { calls.push({ sql: 'BEGIN' }); },
    async commit() { calls.push({ sql: 'COMMIT' }); },
    async rollback() { calls.push({ sql: 'ROLLBACK' }); },
    release() {},
  };
  return { calls, db: { execute, getConnection: async () => connection } };
}

test('registering a phone marks the existing feed as delivered so history is not pushed', async () => {
  const { calls, db } = fakeDb();
  const feed = async () => [{ id: 'bill-1', read: false }, { id: 'payment-2', read: true }];
  await createPushService({ db, feed }).register('5', token);
  const seeded = calls.filter((call) => call.sql.includes("'Delivered'")).map((call) => call.params[1]);
  assert.deepEqual(seeded, ['bill-1', 'payment-2']);
  assert.equal(calls.at(-1).sql, 'COMMIT');
});

test('only new unread notices are sent; failures retry and uninstalled phones are switched off', async () => {
  const { calls, db } = fakeDb({
    devices: [{ id: 1, userId: '5', token }, { id: 2, userId: '6', token: 'ExpoPushToken[zzzzzzzzzzzz]' }],
    deliveries: [{ id: 'old', status: 'Delivered', attempts: 0, due: 1 }],
  });
  const feed = async (userId) => userId === '5'
    ? [{ id: 'old', title: 'a', body: 'b', read: false }, { id: 'new', title: 'New bill', body: 'PHP 10', read: false }, { id: 'seen', title: 'c', body: 'd', read: true }]
    : [{ id: 'other', title: 'Notice', body: 'Hi', read: false }];
  let sent;
  const fetchImpl = async (url, options) => {
    sent = JSON.parse(options.body);
    return { ok: true, json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }] }) };
  };
  const result = await createPushService({ db, feed, fetchImpl }).sendPending();
  assert.equal(result.sent, 2);
  assert.deepEqual(sent.map((message) => message.data.id), ['new', 'other']);
  assert.ok(calls.some((call) => call.sql.includes("'Accepted'") && call.params[1] === 'new'));
  assert.ok(calls.some((call) => call.sql.startsWith('UPDATE push_devices SET is_active = 0 WHERE id') && call.params[0] === 2));

  // When Expo cannot be reached, the notice stays Pending for a retry.
  const second = fakeDb({ devices: [{ id: 1, userId: '5', token }] });
  await createPushService({
    db: second.db,
    feed: async () => [{ id: 'new', title: 'x', body: 'y', read: false }],
    fetchImpl: async () => { throw new Error('offline'); },
    log: () => {},
  }).sendPending();
  assert.ok(second.calls.some((call) => call.sql.includes("'Pending'") && call.params[1] === 'new'));
});
