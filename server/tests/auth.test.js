import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';

// Standalone tests never load .env or connect to a real database.
process.env.JWT_SECRET ||= randomBytes(48).toString('hex');
process.env.DB_HOST ||= '127.0.0.1';
process.env.DB_NAME ||= 'water_system_test';
process.env.DB_USER ||= 'test';

const { authConfig } = await import('../src/config/auth.js');
const { createAuthenticate } = await import('../src/middleware/authenticate.js');
const { requireRole } = await import('../src/middleware/require-role.js');
const { getCurrentUser } = await import('../src/controllers/auth.controller.js');

function token(overrides = {}, secret = authConfig.secret) {
  return jwt.sign({ role: 'admin' }, secret, {
    algorithm: 'HS256',
    subject: '1',
    expiresIn: '15m',
    issuer: authConfig.issuer,
    audience: authConfig.audience,
    ...overrides,
  });
}

function request(authorization) {
  return { get: () => authorization };
}

function response() {
  return {
    headers: {},
    set(name, value) {
      this.headers[name] = value;
    },
    vary(value) {
      this.headers.Vary = value;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

test('missing/malformed authorization is rejected before a database lookup', async () => {
  const authenticate = createAuthenticate(() => assert.fail('Unexpected lookup'));
  for (const header of [undefined, '', 'Basic abc', 'Bearer', 'Bearer abc extra']) {
    await assert.rejects(
      authenticate(request(header), response(), () => assert.fail()),
      { statusCode: 401 },
    );
  }
});

test('invalid, expired, wrong audience/issuer and wrong algorithm tokens are rejected', async () => {
  const authenticate = createAuthenticate(() => assert.fail('Unexpected lookup'));
  const tokens = [
    'bad-token',
    token({}, randomBytes(48).toString('hex')),
    token({ expiresIn: -10 }),
    token({ issuer: 'other-api' }),
    token({ audience: 'other-app' }),
    token({ algorithm: 'HS384' }),
    token({ subject: 'not-an-id' }),
    token({ subject: '18446744073709551616' }),
  ];
  for (const value of tokens) {
    await assert.rejects(
      authenticate(request('Bearer ' + value), response(), () => assert.fail()),
      { statusCode: 401 },
    );
  }
  const noExpiry = jwt.sign({ sub: '1' }, authConfig.secret, {
    algorithm: 'HS256',
    issuer: authConfig.issuer,
    audience: authConfig.audience,
  });
  await assert.rejects(
    authenticate(request('Bearer ' + noExpiry), response(), () => assert.fail()),
    { statusCode: 401 },
  );
});

test('deleted and inactive users cannot use an otherwise valid token', async () => {
  for (const user of [null, { id: '1', role: 'admin', is_active: 0 }]) {
    await assert.rejects(
      createAuthenticate(async () => user)(request('Bearer ' + token()), response(), () =>
        assert.fail(),
      ),
      { statusCode: 401 },
    );
  }
});

test('authentication exposes safe fields and uses current role instead of the token role', async () => {
  const req = request('Bearer ' + token());
  const res = response();
  let passed = false;
  await createAuthenticate(async (id) => {
    assert.equal(id, '1');
    return {
      id: '1',
      username: 'sample',
      role: 'consumer',
      is_active: '1',
      password_hash: 'private',
    };
  })(req, res, () => {
    passed = true;
  });
  assert.equal(passed, true);
  assert.deepEqual(req.user, {
    id: '1',
    username: 'sample',
    role: 'consumer',
    mustChangePassword: false,
  });
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.throws(() => requireRole('admin')(req, res, () => assert.fail()), { statusCode: 403 });
  getCurrentUser(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.user.password_hash, undefined);
});

test('database errors are forwarded as server failures, not invalid credentials', async () => {
  const failure = new Error('Database unavailable');
  await assert.rejects(
    createAuthenticate(async () => {
      throw failure;
    })(request('Bearer ' + token()), response(), () => assert.fail()),
    (error) => error === failure,
  );
});

test('admin permission allows admins and rejects requests without authentication', () => {
  let passed = false;
  requireRole('admin')({ user: { role: 'admin' } }, response(), () => {
    passed = true;
  });
  assert.equal(passed, true);
  assert.throws(() => requireRole('admin')({}, response(), () => assert.fail()), {
    statusCode: 401,
  });
});

test('temporary password sessions allow only current-user and change-password requests', async () => {
  const authenticate = createAuthenticate(async () => ({
    id: '1',
    username: 'consumer',
    role: 'consumer',
    is_active: 1,
    must_change_password: 1,
  }));
  for (const [method, path, allowed] of [
    ['GET', '/api/v1/auth/me', true],
    ['POST', '/api/v1/auth/change-password', true],
    ['POST', '/api/v1/auth/me', false],
    ['GET', '/api/v1/customers', false],
  ]) {
    let passed = false;
    const req = { ...request('Bearer ' + token()), method, originalUrl: path };
    const work = authenticate(req, response(), () => {
      passed = true;
    });
    if (allowed) {
      await work;
      assert.equal(passed, true);
    } else {
      await assert.rejects(work, { statusCode: 403 });
      assert.equal(passed, false);
    }
  }
});

test('password changes invalidate tokens issued with an older account version', async () => {
  const authenticate = createAuthenticate(async () => ({
    id: '1',
    role: 'consumer',
    is_active: 1,
    auth_version: 1,
  }));
  await assert.rejects(
    authenticate(request('Bearer ' + token()), response(), () => assert.fail()),
    { statusCode: 401 },
  );
});
