import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(
  new URL('../../js/billing/billing-ledger.js', import.meta.url),
  'utf8',
);
async function browser(fail = false, failSave = false, customerCount = 1) {
  const nodes = new Map();
  const node = () => ({
    value: '',
    textContent: '',
    events: {},
    children: [],
    addEventListener(name, callback) {
      this.events[name] = callback;
    },
    setAttribute() {},
    reset() {},
    focus() { this.focused = true; },
    querySelectorAll: () => [],
    querySelector() {
      return get('submitSetup');
    },
    replaceChildren() {
      this.children = [];
    },
    appendChild(child) {
      this.children.push(child);
    },
    append(...children) {
      this.children.push(...children);
    },
    add(option) {
      this.children.push(option);
    },
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
  });
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, node());
    return nodes.get(id);
  };
  get('ledgerEntryForm').elements = Object.fromEntries(
    ['consumption', 'connection', 'late', 'other', 'current'].map((key) => [key, node()]),
  );
  const calls = [];
  const notices = [];
  let meterEntries = [];
  const records = { customers: [], bills: [], rates: {} };
  const day = '2026-10-21';
  const stored = {
    id: '9',
    barangayId: '1',
    barangay: 'Barangay Agol',
    month: '2026-10',
    due: day,
    rate: '7.00',
  };
  const context = vm.createContext({
    document: { getElementById: get, createElement: node, addEventListener() {} },
    AdminAuth: { ready: Promise.resolve({ role: 'admin' }) },
    AdminAPI: {
      request: async (path, options) => {
        calls.push({ path, options });
        if (fail) throw new Error('API unavailable');
        if (path.startsWith('/meter-entries')) {
          if (options) {
            if (failSave) throw new Error('Stale meter reading');
            const saved = {
              ...options.body,
              id: '10',
              customerId: options.body.customerId,
              current: '500.000',
              status: 'Saved',
              revision: 'a'.repeat(64),
            };
            meterEntries = [...meterEntries.filter((entry) => entry.customerId !== saved.customerId), saved];
            return saved;
          }
          return {
            setup: stored,
            customers: Array.from({ length: customerCount }, (_, index) => (
              {
                id: String(2 + index),
                meterId: String(4 + index),
                name: index === 0 ? 'Ana Reyes' : 'Consumer ' + index,
                account: 'PWSS-00' + (index + 1),
                previous: '400.000',
                suggestedLate: '10.00',
              }
            )),
            entries: meterEntries,
          };
        }
        if (options) {
          Object.assign(stored, options.body);
          return stored;
        }
        return path === '/barangays'
          ? [
              { id: '1', name: stored.barangay, is_active: 1 },
              { id: '2', name: 'Inactive', is_active: 0 },
            ]
          : [stored];
      },
    },
    WaterStore: {
      today: () => day,
      load: () => records,
      billingPeriod: () => ({ active: '2026-10', closed: [] }),
      money: String,
      flatWaterCharge: () => 0,
    },
    AdminUI: { message() {} },
    Validation: { money: (value) => /^\d+(\.\d{1,2})?$/.test(value), date: () => true },
    showNotice: async (...args) => notices.push(args),
    confirmAction: async () => true,
    localStorage: { getItem: () => null },
    location: { search: '?barangay=Barangay%20Agol' },
    URLSearchParams,
    Intl,
    Option: function (text, value) {
      this.text = text;
      this.value = value;
    },
  });
  vm.runInContext(
    await readFile(new URL('../../js/billing/meter-entry-api.js', import.meta.url), 'utf8'),
    context,
  );
  await vm.runInContext(source, context);
  return { get, calls, notices, context };
}

test('setup loads from API, offers registered active areas and saves without local setup writes', async () => {
  const app = await browser();
  assert.equal(app.get('ledgerSetupBarangay').children.length, 1);
  assert.equal(app.get('ledgerRate').textContent, '7');
  app.get('ledgerSetupBarangay').value = 'Barangay Agol';
  app.get('ledgerSetupDue').value = '2026-10-21';
  app.get('ledgerSetupRate').value = '8.50';
  await app.get('ledgerSetupForm').events.submit({ preventDefault() {} });
  const write = app.calls.find((call) => call.options);
  assert.equal(write.path, '/billing-setups');
  assert.equal(write.options.method, 'PUT');
  assert.equal(write.options.body.barangayId, '1');
  assert.equal(app.get('ledgerRate').textContent, '8.5');
  assert.match(app.notices.at(-1)[0], /saved successfully/);
});

test('setup API failure prevents a silent local-storage fallback', async () => {
  const app = await browser(true);
  assert.equal(app.get('changeLedgerSetup').disabled, true);
  assert.equal(app.get('generateLedgerBills').disabled, true);
  assert.match(app.notices[0][0], /unavailable/);
});

test('meter entry sends consumption to API, reloads saved rows and preserves input on failure', async () => {
  assert.doesNotMatch(source, /WaterStore\.(load|save)|localStorage|sessionStorage/);
  for (const failSave of [false, true]) {
    const app = await browser(false, failSave);
    app.get('ledgerConsumers').children[0].events.click();
    const form = app.get('ledgerEntryForm');
    assert.equal(form.elements.late.value, '10.00');
    form.elements.late.value = '5.00';
    form.elements.consumption.value = '100';
    form.events.input();
    assert.equal(form.elements.current.value, '500');
    await form.events.submit({ preventDefault() {} });
    const write = app.calls.find((call) => call.path === '/meter-entries' && call.options);
    assert.equal(write.options.body.previous, '400.000');
    assert.equal(write.options.body.consumption, '100');
    assert.equal(write.options.body.current, undefined);
    assert.equal(write.options.body.late, '5.00');
    if (failSave) {
      assert.equal(form.elements.consumption.value, '100');
      assert.equal(app.get('ledgerEntryStatus').textContent, 'Entry not saved');
    } else {
      assert.equal(app.get('draftCount').textContent, '1 / 1 completed');
      app.get('changeLedgerSetup').events.click();
      app.get('ledgerSetupBarangay').value = 'Barangay Agol';
      app.get('ledgerSetupDue').value = '2026-10-21';
      app.get('ledgerSetupRate').value = '7.00';
      await app.get('ledgerSetupForm').events.submit({ preventDefault() {} });
      assert.equal(app.get('draftCount').textContent, '1 / 1 completed');
    }
  }
});

test('bill generation requires review and sends only the server preview revision', async () => {
  const app = await browser();
  app.get('ledgerConsumers').children[0].events.click();
  const form = app.get('ledgerEntryForm');
  form.elements.consumption.value = '100';
  await form.events.submit({ preventDefault() {} });
  assert.equal(app.get('generateLedgerBills').disabled, false);
  const original = app.context.AdminAPI.request;
  let generated = 0;
  app.context.AdminAPI.request = async (path, options) => {
    if (path === '/bills/preview')
      return {
        revision: 'server-revision',
        bills: [
          {
            customerId: '2',
            previous: '400',
            current: '500',
            consumption: '100',
            ratePerCubic: '7',
            total: '700',
          },
        ],
      };
    if (path === '/bills/generate') {
      generated++;
      assert.deepEqual(JSON.parse(JSON.stringify(options.body)), {
        setupId: '9',
        revision: 'server-revision',
      });
      return { count: 1 };
    }
    return original(path, options);
  };
  app.context.confirmGeneratedBills = async () => false;
  await app.get('generateLedgerBills').events.click();
  assert.equal(generated, 0);
  app.context.confirmGeneratedBills = async () => true;
  await app.get('generateLedgerBills').events.click();
  assert.equal(generated, 1);
  assert.match(app.notices.at(-1)[0], /Bills generated successfully/);
});

test('successful entry saves advance across unsaved consumers, wrap skipped entries and unlock generation only at completion', async () => {
  const app = await browser(false, false, 3);
  const form = app.get('ledgerEntryForm');
  // Start with the second consumer, leaving the first unsaved.
  app.get('ledgerConsumers').children[1].events.click();
  for (const [expectedNext, completed] of [['Consumer 2', 1], ['Ana Reyes', 2], ['Ana Reyes', 3]]) {
    form.elements.consumption.value = '10';
    form.events.input();
    await form.events.submit({ preventDefault() {} });
    assert.equal(app.get('ledgerSelected').textContent, expectedNext);
    assert.equal(app.get('draftCount').textContent, completed + ' / 3 completed');
    assert.equal(app.get('generateLedgerBills').disabled, completed !== 3);
    if (completed < 3) {
      assert.equal(form.elements.consumption.value, '');
      assert.equal(form.elements.consumption.focused, true);
      assert.equal(app.get('ledgerEntryStatus').textContent, 'Unsaved entry');
    }
  }
  assert.equal(app.notices.length, 0, 'saving readings requires no extra success-modal click');
});

test('failed entry save does not advance to another consumer', async () => {
  const app = await browser(false, true, 2);
  const form = app.get('ledgerEntryForm');
  form.elements.consumption.value = '15';
  form.events.input();
  await form.events.submit({ preventDefault() {} });
  assert.equal(app.get('ledgerSelected').textContent, 'Ana Reyes');
  assert.equal(form.elements.consumption.value, '15');
  assert.equal(app.get('draftCount').textContent, '0 / 2 completed');
  assert.equal(app.get('generateLedgerBills').disabled, true);
});
