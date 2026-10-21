import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('Generated Bills displays the server page and balances without browser financial records', async () => {
  const source = await readFile(
    new URL('../../js/billing/generated-bills.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /WaterStore\.(load|save|balance|status)/);
  const node = () => ({
    value: '',
    textContent: '',
    children: [],
    rows: [],
    setAttribute() {},
    addEventListener() {},
    append(...items) {
      this.children.push(...items);
    },
    replaceChildren() {
      this.rows = [];
    },
    insertRow() {
      const row = node();
      this.rows.push(row);
      return row;
    },
    querySelector: () => ({ classList: { add() {} }, setAttribute() {} }),
  });
  const nodes = new Map();
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, node());
    return nodes.get(id);
  };
  const pager = {
    page: 2,
    update(total) {
      this.total = total;
    },
  };
  let failed = false;
  const context = vm.createContext({
    document: { getElementById: get, createElement: node },
    createPagination: () => pager,
    AdminAuth: { ready: Promise.resolve(null) },
    AdminAPI: {
      request: async (path) => {
        if (failed) throw new Error('API unavailable');
        assert.match(path, /page=2/);
        return {
          pagination: { total: 13, page: 2 },
          bills: Array.from({ length: 3 }, (_, index) => ({
            id: String(index),
            customerId: '1',
            name: 'Ana',
            total: '700',
            balance: '600',
            previous: '400',
            current: '500',
            consumption: '100',
            status: 'Unpaid',
          })),
        };
      },
    },
    AdminUI: {
      cell: node,
      button() {},
      empty(body, columns, message) {
        if (!body.rows.length) body.textContent = message;
      },
    },
    WaterStore: { money: String },
    URLSearchParams,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(source, context);
  await context.showGeneratedBills();
  assert.equal(get('billRows').rows.length, 3);
  assert.equal(pager.total, 13);
  failed = true;
  await context.showGeneratedBills();
  assert.match(get('billRows').textContent, /API unavailable/);
  assert.equal(pager.total, 0);
});
