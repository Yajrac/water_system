import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const apiSource = await readFile(
  new URL('../../js/barangays/barangay-api.js', import.meta.url),
  'utf8',
);
const formSource = await readFile(
  new URL('../../js/barangays/barangay-form.js', import.meta.url),
  'utf8',
);

test('barangay API maps database rows and sends writes by ID, never by directory code', async () => {
  const calls = [];
  const context = vm.createContext({
    AdminAPI: {
      request: async (...args) => {
        calls.push(args);
        if (args[1]) return {};
        return [
          {
            id: '42',
            psgc_code: '0500513001',
            name: 'Barangay Agol',
            is_active: '1',
            customer_count: '5',
          },
        ];
      },
    },
  });
  vm.runInContext(apiSource, context);
  const api = vm.runInContext('BarangayAPI', context);
  const [row] = await api.list();
  assert.equal(row.code, '0500513001');
  assert.equal(row.customers, 5);
  const entry = { code: row.code, displayName: row.name };
  await api.save(entry);
  await api.save(entry, '42');
  await api.remove('42');
  assert.equal(calls[1][0], '/barangays');
  assert.equal(calls[1][1].method, 'POST');
  assert.equal(calls[2][0], '/barangays');
  assert.equal(calls[2][1].method, 'POST');
  assert.equal(calls[3][1].method, 'DELETE');
});

function formBrowser({ edit = false, accepted = true, error = null } = {}) {
  const nodes = new Map();
  const calls = [];
  const node = () => ({
    value: '',
    hidden: false,
    disabled: false,
    events: {},
    textContent: '',
    addEventListener(name, callback) {
      this.events[name] = callback;
    },
    setAttribute() {},
    removeAttribute() {},
    replaceChildren() {},
    setCustomValidity() {},
    reset() {},
    showModal() {},
    close() {
      calls.push('close');
    },
  });
  for (const id of [
    'addBarangayDialog',
    'barangayForm',
    'barangayChoice',
    'barangaySearchChoice',
    'barangayOptions',
    'saveBarangay',
    'retryBarangays',
    'barangayDirectoryStatus',
    'barangayFormTitle',
    'openAddBarangay',
    'closeAddBarangay',
    'cancelAddBarangay',
  ])
    nodes.set(id, node());
  const entry = { code: '0500513001', name: 'Agol', displayName: 'Barangay Agol' };
  const context = vm.createContext({
    URLSearchParams,
    location: { search: edit ? '?code=0500513001' : '' },
    document: {
      getElementById: (id) => nodes.get(id),
      addEventListener() {},
      createElement: node,
      createTextNode: (text) => text,
    },
    fetch: async () => ({
      ok: true,
      json: async () => ({ municipality: 'Pio Duran', province: 'Albay', barangays: [entry] }),
    }),
    BarangayAPI: {
      list: async () => (edit ? [{ id: '42', code: entry.code }] : []),
      save: async (item, id) => {
        calls.push({ code: item.code, id });
        if (error) throw error;
      },
    },
    confirmAction: async () => accepted,
    showNotice: async () => calls.push('success'),
    loadBarangays: async () => calls.push('refresh'),
    AdminAuth: { ready: Promise.resolve({ role: 'admin' }) },
    AdminUI: { message() {} },
  });
  vm.runInContext(formSource, context);
  return { nodes, calls, context };
}

test('Add modal saves through API and refreshes only after confirmation', async () => {
  const app = formBrowser();
  await vm.runInContext('loadBarangayChoices()', app.context);
  app.nodes.get('barangayChoice').value = '0500513001';
  await app.nodes.get('barangayForm').events.submit({ preventDefault() {} });
  assert.equal(app.calls[0].id, undefined);
  assert.deepEqual(app.calls.slice(1), ['close', 'refresh', 'success']);
});

test('old edit query parameters cannot enable barangay editing', async () => {
  const app = formBrowser({ edit: true });
  await vm.runInContext('loadBarangayChoices()', app.context);
  assert.equal(app.nodes.get('barangayChoice').value, '');
});

test('cancelled confirmation does not save, and failed saves keep modal data for retry', async () => {
  const cancelled = formBrowser({ accepted: false });
  await vm.runInContext('loadBarangayChoices()', cancelled.context);
  cancelled.nodes.get('barangayChoice').value = '0500513001';
  await cancelled.nodes.get('barangayForm').events.submit({ preventDefault() {} });
  assert.equal(cancelled.calls.length, 0);
  const failed = formBrowser({ error: new Error('Already registered.') });
  await vm.runInContext('loadBarangayChoices()', failed.context);
  failed.nodes.get('barangayChoice').value = '0500513001';
  await failed.nodes.get('barangayForm').events.submit({ preventDefault() {} });
  assert.equal(failed.nodes.get('barangayDirectoryStatus').textContent, 'Already registered.');
  assert.equal(failed.nodes.get('barangayChoice').value, '0500513001');
  assert.ok(!failed.calls.includes('success'));
  assert.equal(failed.nodes.get('saveBarangay').disabled, false);
});

test('barangay frontend no longer reads or writes browser business records', async () => {
  const table = await readFile(new URL('../../js/barangays/barangays.js', import.meta.url), 'utf8');
  assert.ok(!/WaterStore|BarangayRegistry|localStorage/.test(table + formSource));
});
