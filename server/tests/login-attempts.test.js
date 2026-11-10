import test from 'node:test';
import assert from 'node:assert/strict';
import { loginAttemptState, checkLoginAttempt } from '../src/services/login-attempts.js';

test('five failures lock for five minutes; expiry and success reset failures', () => {
  let state = { failures: 0, locked_until: null };
  for (let i = 1; i <= 5; i++) {
    const next = loginAttemptState(state, true, 1000);
    assert.equal(next.failures, i);
    assert.equal(next.retryAfterSeconds, i === 5 ? 300 : 0);
    state = { failures: next.failures, locked_until: next.lockedUntil };
  }
  assert.equal(loginAttemptState(state, false, 2000).retryAfterSeconds, 299);
  assert.equal(loginAttemptState(state, true, 301000).failures, 1);
  assert.equal(loginAttemptState({ failures: 4 }, false, 1000).failures, 0);
});

test('failures are committed before returning errors; active lock skips password checks', async () => {
  const state = { failures: 0, locked_until: null, now: new Date(1000) };
  let committed = 0;
  let verified = 0;
  const connection = {
    async beginTransaction() {},
    async execute(sql, values) {
      if (sql.startsWith('SELECT')) return [[{ ...state }]];
      if (sql.startsWith('UPDATE')) { state.failures = values[0]; state.locked_until = values[1]; }
      return [[]];
    },
    async commit() { committed++; },
    async rollback() { assert.fail('credential failure must not roll back counters'); },
    release() {},
  };
  const pool = { async getConnection() { return connection; } };
  const verify = async () => { verified++; return new Error('wrong password'); };
  for (let i = 1; i <= 5; i++) {
    await assert.rejects(checkLoginAttempt(pool, 'user:1', verify), error => i < 5 ? error.message === 'wrong password' : error.statusCode === 429 && error.details.retryAfterSeconds === 300);
  }
  await assert.rejects(checkLoginAttempt(pool, 'user:1', verify), { statusCode: 429 });
  assert.equal(verified, 5);
  assert.equal(committed, 6);
  state.now = new Date(301000);
  await checkLoginAttempt(pool, 'user:1', async () => null);
  assert.equal(state.failures, 0);
  assert.equal(state.locked_until, null);
});
