import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('dashboard loads authenticated database data, prevents concurrent refresh, and supports retry', async () => {
  const source = await readFile(
    new URL('../../js/dashboard/dashboard-init.js', import.meta.url),
    'utf8',
  );
  const nodes = new Map();
  const document = {
    getElementById(id) {
      if (!nodes.has(id))
        nodes.set(id, {
          replaceChildren() {},
          addEventListener(type, handler) {
            this[type] = handler;
          },
        });
      return nodes.get(id);
    },
  };
  let resolveRequest;
  let requests = 0;
  const renders = [];
  const messages = [];
  const payload = { summary: {} };
  const context = vm.createContext({
    document,
    AdminAuth: { ready: Promise.resolve({ id: '1' }) },
    AdminAPI: {
      request(path) {
        assert.equal(path, '/dashboard');
        requests++;
        return new Promise((resolve) => {
          resolveRequest = resolve;
        });
      },
    },
    Skeleton: {
      start() {
        return () => {};
      },
    },
    AdminUI: {
      message(value) {
        messages.push(value);
      },
    },
    renderDashboard(data) {
      renders.push(data);
    },
    renderDashboardCharts(data) {
      renders.push(data);
    },
  });
  vm.runInContext(source, context);
  await new Promise(setImmediate);
  assert.equal(requests, 1);
  assert.equal(nodes.get('refreshDashboard').disabled, true);
  await nodes.get('refreshDashboard').click();
  assert.equal(requests, 1);
  resolveRequest(payload);
  await new Promise(setImmediate);
  assert.deepEqual(renders, [payload, payload]);
  assert.equal(nodes.get('refreshDashboard').disabled, false);
  context.AdminAPI.request = async () => {
    throw new Error('Unavailable');
  };
  await nodes.get('refreshDashboard').click();
  assert.match(messages.at(-1), /Unavailable.*Refresh/);
  assert.equal(nodes.get('refreshDashboard').disabled, false);
  assert.equal(renders.length, 2);
});
