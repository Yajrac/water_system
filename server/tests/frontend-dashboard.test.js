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
          value: '',
          replaceChildren() {},
          add() {},
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
  const payload = {
    summary: {},
    currentYear: 2027,
    availableYears: [2027, 2026],
    period: { year: 2027 },
  };
  const context = vm.createContext({
    document,
    Option: function (text, value) {
      this.text = text;
      this.value = value;
    },
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
  nodes.get('collectionsYear').value = '2026';
  context.AdminAPI.request = async (path) => {
    assert.equal(path, '/dashboard?year=2026');
    return { ...payload, period: { year: 2026 } };
  };
  await nodes.get('collectionsYear').change();
  assert.equal(nodes.get('collectionsTitle').textContent, 'Monthly collections - 2026');
  assert.equal(nodes.get('collectionsYear').disabled, false);
  context.AdminAPI.request = async () => {
    throw new Error('Unavailable');
  };
  await nodes.get('refreshDashboard').click();
  assert.match(messages.at(-1), /Unavailable.*Refresh/);
  assert.equal(nodes.get('refreshDashboard').disabled, false);
  assert.equal(renders.length, 4);
});
