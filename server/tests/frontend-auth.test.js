import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const sources = await Promise.all(
  ['js/shared/api-config.js', 'js/shared/api.js', 'js/auth/auth.js'].map((file) =>
    readFile(new URL('../../' + file, import.meta.url), 'utf8'),
  ),
);

test('API config uses Render and allows switching local preview back to the local API', () => {
  for (const [local, hostname, expected] of [
    [false, '127.0.0.1', 'https://water-system-1.onrender.com/api/v1'],
    [true, 'localhost', 'http://localhost:3000/api/v1'],
    [true, '127.0.0.1', 'http://127.0.0.1:3000/api/v1'],
    [true, 'water.example.com', 'https://water-system-1.onrender.com/api/v1'],
  ]) {
    const context = vm.createContext({ location: { hostname } });
    vm.runInContext(sources[0].replace(/const useLocalAdminApi = (?:true|false);/, 'const useLocalAdminApi = ' + local + ';'), context);
    assert.equal(vm.runInContext('AdminApiConfig.baseUrl', context), expected);
  }
});

function browser({ page = 'login.html', search = '', stored = {}, respond } = {}) {
  const storage = new Map(Object.entries(stored));
  const redirects = [];
  const requests = [];
  const timers = new Map();
  const classes = new Set();
  const window = new EventTarget();
  let nextTimer = 0;
  const context = vm.createContext({
    location: {
      hostname: '127.0.0.1',
      pathname: '/html/' + page,
      search,
      replace: (value) => redirects.push(value),
    },
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    sessionStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    document: {
      head: { appendChild() {} },
      createElement: () => ({}),
      documentElement: {
        classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
      },
      addEventListener() {},
    },
    window,
    CustomEvent,
    AbortController,
    URLSearchParams,
    atob,
    setTimeout: (callback, delay) => {
      timers.set(++nextTimer, { callback, delay });
      return nextTimer;
    },
    clearTimeout: (id) => timers.delete(id),
    fetch: async (url, options) => {
      requests.push({ url, options });
      const response = await respond?.(url, options);
      if (response instanceof Error) throw response;
      return {
        status: response?.status || 200,
        ok: (response?.status || 200) < 400,
        json: async () => response?.body ?? { success: true, data: {} },
      };
    },
  });
  for (const source of sources) vm.runInContext(source, context);
  return {
    auth: vm.runInContext('AdminAuth', context),
    api: vm.runInContext('AdminAPI', context),
    storage,
    redirects,
    requests,
    timers,
    classes,
  };
}

const user = { id: '1', username: 'admin', role: 'admin' };
const token =
  'header.' +
  Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url') +
  '.signature';
const key = 'pwss-admin-access-token';

test('legacy demo session cannot grant frontend access', async () => {
  const app = browser({ page: 'reports.html', stored: { 'pwss-admin-session': 'active' } });
  assert.equal(await app.auth.ready, null);
  assert.equal(app.storage.has('pwss-admin-session'), false);
  assert.ok(app.redirects[0].startsWith('login.html?next=reports.html'));
  assert.equal(app.requests.length, 0);
});

test('protected page stays hidden until the server verifies an active admin', async () => {
  let release;
  const app = browser({
    page: 'reports.html',
    stored: { [key]: token },
    respond: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  assert.equal(app.classes.has('auth-pending'), true);
  release({ body: { success: true, data: { user } } });
  assert.equal((await app.auth.ready).role, 'admin');
  assert.equal(app.classes.has('auth-pending'), false);
  assert.equal(app.requests[0].options.headers.Authorization, 'Bearer ' + token);
});

test('invalid/expired tokens are cleared and redirected to login', async () => {
  const app = browser({
    page: 'barangays.html',
    stored: { [key]: token },
    respond: () => ({ status: 401, body: { success: false, message: 'Expired.' } }),
  });
  await app.auth.ready;
  assert.equal(app.storage.has(key), false);
  assert.ok(app.redirects.some((url) => url.includes('reason=expired')));
});

test('consumer token cannot open admin pages', async () => {
  const app = browser({
    page: 'index.html',
    stored: { [key]: token },
    respond: () => ({
      body: { success: true, data: { user: { ...user, role: 'consumer' } } },
    }),
  });
  await app.auth.ready;
  assert.equal(app.storage.has(key), false);
  assert.equal(app.auth.user, null);
  assert.ok(app.redirects.length > 0);
});

test('API login sends credentials without an old bearer token and stores no password', async () => {
  const app = browser({
    respond: () => ({ body: { success: true, data: { user, accessToken: token } } }),
  });
  await app.auth.ready;
  assert.equal((await app.auth.login('admin', 'test-only-password')).role, 'admin');
  const { url, options } = app.requests[0];
  assert.ok(url.endsWith('/api/v1/auth/login'));
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Authorization, undefined);
  assert.equal(options.credentials, 'omit');
  assert.equal(app.storage.get(key), token);
  assert.equal([...app.storage.values()].includes('test-only-password'), false);
});

test('wrong password and rate limit messages reach the login form unchanged', async () => {
  for (const [status, message] of [
    [401, 'Invalid username or password.'],
    [429, 'Too many login attempts.'],
  ]) {
    const app = browser({ respond: () => ({ status, body: { success: false, message } }) });
    await app.auth.ready;
    await assert.rejects(
      app.auth.login('admin', 'wrong'),
      (error) => error.status === status && error.message === message,
    );
    assert.equal(app.storage.has(key), false);
  }
});

test('network failure does not masquerade as invalid credentials or erase the token', async () => {
  const app = browser({
    page: 'reports.html',
    stored: { [key]: token },
    respond: () => new TypeError('Network down'),
  });
  await app.auth.ready;
  assert.equal(app.storage.get(key), token);
  assert.ok(app.auth.sessionError.includes('Cannot reach the server'));
  assert.ok(app.redirects[0].includes('reason=unavailable'));
});

test('logout clears local access and expiry callback ends a verified session', async () => {
  const app = browser({
    page: 'reports.html',
    stored: { [key]: token },
    respond: () => ({ body: { success: true, data: { user } } }),
  });
  await app.auth.ready;
  const expiry = [...app.timers.values()][0];
  expiry.callback();
  assert.equal(app.storage.has(key), false);
  assert.ok(app.redirects[0].includes('reason=expired'));
  app.storage.set(key, token);
  app.auth.logout();
  assert.equal(app.storage.has(key), false);
  assert.equal(app.redirects.at(-1), 'login.html');
});

test('return URL allows only known local admin pages', async () => {
  for (const next of ['https://evil.example', '//evil.example', '../index.html']) {
    const app = browser({ search: '?next=' + encodeURIComponent(next) });
    await app.auth.ready;
    assert.equal(app.auth.destination(), 'index.html');
  }
  const app = browser({ search: '?next=customer-profile.html%3Fid%3D12' });
  await app.auth.ready;
  assert.equal(app.auth.destination(), 'customer-profile.html?id=12');
});

test('every auth-protected HTML page loads config and API helper before authentication', async () => {
  const { readdir } = await import('node:fs/promises');
  const directory = new URL('../../html/', import.meta.url);
  let checked = 0;
  for (const name of await readdir(directory)) {
    if (!name.endsWith('.html')) continue;
    const html = await readFile(new URL(name, directory), 'utf8');
    if (!html.includes('../js/auth/auth.js')) continue;
    const config = html.indexOf('../js/shared/api-config.js');
    const api = html.indexOf('../js/shared/api.js');
    const auth = html.indexOf('../js/auth/auth.js');
    assert.ok(config >= 0 && config < api && api < auth, name);
    checked++;
  }
  assert.ok(checked >= 18);
});


test('saved admin session renews on reload and before expiry without redirecting', async () => {
  const app = browser({
    page: 'reports.html',
    stored: { [key]: token, 'pwss-admin-refresh-token': 'session-credential' },
    respond: (url) => ({ body: { success: true, data: url.endsWith('/auth/refresh')
      ? { user, accessToken: token, refreshToken: 'session-credential' } : { user } } }),
  });
  await app.auth.ready;
  assert.equal(app.auth.user.role, 'admin');
  assert.equal(app.redirects.length, 0);
  assert.ok(app.requests.some(({ url }) => url.endsWith('/auth/refresh')));
  const expiry = [...app.timers.values()][0];
  await expiry.callback();
  assert.equal(app.storage.get(key), token);
  assert.equal(app.redirects.length, 0);
  await app.auth.logout();
  assert.equal(app.storage.has('pwss-admin-refresh-token'), false);
  assert.ok(app.requests.some(({ url }) => url.endsWith('/auth/logout')));
});
