import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const read = (name) => readFile(new URL('../../js/payments/' + name, import.meta.url), 'utf8');

test('receipt review waits for the server, blocks close while saving, and prints only the saved receipt', async () => {
  const source = await read('payment-receipt.js');
  assert.doesNotMatch(source, /WaterStore\.(load|save)/);
  const nodes = new Map();
  function node() {
    const selectors = new Map();
    return {
      events: {},
      hidden: false,
      textContent: '',
      setAttribute() {},
      focus() {},
      showModal() {},
      addEventListener(event, callback) {
        this.events[event] = callback;
      },
      querySelector(selector) {
        if (!selectors.has(selector)) selectors.set(selector, node());
        return selectors.get(selector);
      },
      close() {
        this.events.close?.();
      },
      remove() {
        nodes.delete(this.id);
      },
    };
  }
  let prints = 0,
    renderPayment,
    finishSave;
  const context = vm.createContext({
    document: {
      getElementById: (id) => nodes.get(id),
      createElement: node,
      body: {
        appendChild: (dialog) => nodes.set(dialog.id, dialog),
        classList: { add() {}, remove() {} },
      },
    },
    window: { addEventListener() {}, removeEventListener() {}, print: () => prints++ },
    renderReceiptPaper: (details, payment) => {
      renderPayment = payment;
    },
    showNotice: async () => {},
  });
  vm.runInContext(source.slice(0, source.indexOf('// Snapshot')), context);
  const review = context.reviewPaymentReceipt(
    { receipt: 'Assigned on save' },
    {},
    {},
    {},
    () =>
      new Promise((resolve) => {
        finishSave = resolve;
      }),
  );
  const dialog = nodes.get('receiptDialog');
  const print = dialog.querySelector('.receipt-print');
  print.hidden = true;
  print.events.click();
  assert.equal(prints, 0);
  const saving = dialog.querySelector('.receipt-save').events.click();
  assert.equal(dialog.querySelector('.receipt-close').disabled, true);
  let prevented = false;
  dialog.events.cancel({
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(print.hidden, true);
  finishSave({ payment: { receipt: 'OR-REAL' }, customer: {}, office: {} });
  await saving;
  assert.equal(renderPayment.receipt, 'OR-REAL');
  assert.equal(print.hidden, false);
  print.events.click();
  assert.equal(prints, 1);
  dialog.querySelector('.receipt-close').events.click();
  assert.equal(await review, true);
});

test('cashier reuses the request key on a failed review and sends the exact opening balance', async () => {
  function node() {
    return {
      value: '',
      hidden: false,
      textContent: '',
      events: {},
      children: [],
      setAttribute() {},
      focus() {},
      reset() {},
      checkValidity: () => true,
      reportValidity() {},
      parentElement: { classList: { toggle() {} } },
      addEventListener(name, callback) {
        this.events[name] = callback;
      },
      replaceChildren(...items) {
        this.children = items;
        if (items[0]?.value) this.value = items[0].value;
      },
      append(...items) {
        this.children.push(...items);
      },
      appendChild(item) {
        this.children.push(item);
      },
      add() {},
    };
  }
  const nodes = new Map();
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, node());
    return nodes.get(id);
  };
  const form = get('paymentForm');
  form.elements = Object.fromEntries(
    ['amount', 'method', 'reference', 'remarks'].map((key) => [key, node()]),
  );
  form.elements.method.value = 'Cash';
  const attempts = [];
  const bill = {
    id: '1',
    customerId: '2',
    name: 'Ana',
    balance: '10.00',
    total: '14.00',
    water: '14.00',
    connection: '0',
    late: '0',
    other: '0',
    previous: '400',
    current: '402',
    consumption: '2',
    ratePerCubic: '7',
    cycle: '2026-10',
  };
  let reviews = 0;
  const context = vm.createContext({
    document: { getElementById: get, createElement: node },
    createPagination: () => ({ page: 1 }),
    AdminAuth: { ready: Promise.resolve(null) },
    AdminAPI: {
      request: async (path, options) => {
        if (options) {
          attempts.push(options.body);
          throw new Error('Network failed');
        }
        return { bills: [bill] };
      },
    },
    PaymentAPI: { receiptData: (value) => value },
    WaterStore: { money: String, today: () => '2026-10-21' },
    Validation: { money: (value) => /^\d+(\.\d{1,2})?$/.test(value) },
    AdminUI: { message() {} },
    showNotice: async () => {},
    reviewPaymentReceipt: async (payment, customer, source, office, save) => {
      reviews++;
      await assert.rejects(save(), /Network failed/);
      return false;
    },
    crypto: { randomUUID: () => 'request-key-123456789' },
    location: { search: '' },
    URLSearchParams,
    setTimeout,
    clearTimeout,
    Option: function (text, value) {
      this.value = value;
    },
  });
  vm.runInContext(await read('record-payment.js'), context);
  await context.openCashierBill('1');
  form.elements.amount.value = '4.00';
  for (let index = 0; index < 2; index++) await form.events.submit({ preventDefault() {} });
  assert.equal(reviews, 2);
  assert.equal(attempts[0].requestKey, attempts[1].requestKey);
  assert.equal(attempts[0].expectedBalance, '10.00');
  assert.equal(form.elements.amount.value, '4.00');
});

test('payment pages do not read or write browser financial records', async () => {
  for (const name of [
    'record-payment.js',
    'payment-history.js',
    'bill-balances.js',
    'payment-receipt.js',
  ])
    assert.doesNotMatch(
      await read(name),
      /WaterStore\.(load|save|balance|allocatePayment|nextReference)/,
      name,
    );
});
