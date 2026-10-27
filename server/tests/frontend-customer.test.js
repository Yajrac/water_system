import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';

const source = async (file) => readFile(new URL('../../' + file, import.meta.url), 'utf8');
const formSource = await source('js/customers/customer-form.js');
const apiSource = await source('js/customers/customer-api.js');
const csvSource = await source('js/customers/customer-csv.js');

test('mobile typing accepts only 09 or 9 and rejects country code entry', async () => {
  const context = vm.createContext({});
  vm.runInContext(await source('js/customers/customer-validation.js'), context);
  const validation = vm.runInContext('CustomerValidation', context);
  for (const complete of ['09123456789', '9123456789']) {
    for (let end = 0; end <= complete.length; end++) {
      assert.equal(validation.mobileDraft(complete.slice(0, end)), true, complete.slice(0, end));
    }
    assert.equal(validation.mobileDraft(complete + '0'), false, complete);
  }
  for (const invalid of [
    '091234567890',
    '91234567890',
    '6391234567890',
    '+6391234567890',
    '9+123',
    '63abc',
    '63',
    '+63',
    '639123456789',
    '+639123456789',
  ]) {
    assert.equal(validation.mobileDraft(invalid), false, invalid);
  }
});

test('customer and receipt pages load shared dialog helpers before their callers', async () => {
  for (const [page, script] of [
    ['customers.html', 'customers/customers.js'],
    ['payment-history.html', 'payments/payment-receipt.js'],
  ]) {
    const html = await source('html/' + page);
    const helper = html.indexOf('shared/confirmation.js');
    assert.ok(helper >= 0 && helper < html.indexOf(script), page);
  }
});

test('customer API only sends application fields; blank edit password is omitted', async () => {
  const calls = [];
  const context = vm.createContext({
    URLSearchParams,
    AdminAPI: {
      request: async (...args) => {
        calls.push(args);
        return {};
      },
    },
  });
  vm.runInContext(apiSource, context);
  const api = vm.runInContext('CustomerAPI', context);
  api.barangays = [{ id: '1', name: 'Barangay Agol' }];
  await api.save(
    {
      firstName: 'Ana',
      barangay: 'Barangay Agol',
      revision: 'version',
      role: 'admin',
      account: 'FORGED',
    },
    '',
    '7',
  );
  assert.equal(calls[0][0], '/customers/7');
  assert.equal(calls[0][1].method, 'PUT');
  assert.equal(calls[0][1].body.password, undefined);
  assert.equal(calls[0][1].body.role, undefined);
  assert.equal(calls[0][1].body.account, undefined);
  assert.equal(calls[0][1].body.revision, 'version');
  assert.equal(calls[0][1].body.barangayId, '1');
});

test('Next accepts both mobile formats and checks database barangays rather than the local directory', async () => {
  const steps = await source('js/customers/customer-steps.js');
  const start = steps.indexOf('function customerStepError(field)');
  const end = steps.indexOf("customerForm.addEventListener('input'", start);
  const context = vm.createContext({
    customerForm: { elements: { serviceStatus: { value: 'Approved' } } },
    CustomerAPI: { barangays: [{ name: 'Registered Barangay' }] },
    CustomerValidation: { dates: [], amounts: [], quantities: [] },
    WaterStore: { barangays: ['Unregistered Barangay'] },
  });
  vm.runInContext(steps.slice(start, end), context);
  for (const value of ['09123456789', '9123456789'])
    assert.equal(context.customerStepError({ name: 'contact', value }), '');
  assert.match(context.customerStepError({ name: 'contact', value: '08123456789' }), /mobile/);
  assert.equal(context.customerStepError({ name: 'barangay', value: 'Registered Barangay' }), '');
  assert.match(
    context.customerStepError({ name: 'barangay', value: 'Unregistered Barangay' }),
    /registered/,
  );
});

test('CSV import parses quoted values and maps barangays to database IDs', () => {
  const context = vm.createContext({
    CustomerAPI: { barangays: [{ id: '1', name: 'Barangay Agol' }] },
  });
  vm.runInContext(csvSource, context);
  const parse = vm.runInContext('customerCSVRecords', context);
  const records = parse(
    'account,firstName,lastName,gender,contact,address,barangay,street\nOLD-001,Ana,Reyes,Female,09123456789,Purok 1,Barangay Agol,"Street, Block 2"',
  );
  assert.equal(records[0].barangayId, '1');
  assert.equal(records[0].street, 'Street, Block 2');
  assert.equal(records[0].account, 'OLD-001');
  assert.equal(records[0].serviceStatus, undefined);
  assert.throws(() => parse('name,barangay\nAna,Barangay Agol'), /columns/);
});

function element() {
  let value = '';
  const label = { childNodes: [{ nodeType: 3, textContent: 'Label ', after() {} }] };
  return {
    get value() {
      return value;
    },
    set value(v) {
      value = String(v ?? '');
    },
    checked: false,
    type: 'text',
    disabled: false,
    hidden: false,
    events: {},
    style: {},
    validity: {},
    children: [],
    addEventListener(name, handler) {
      this.events[name] = handler;
    },
    setAttribute() {},
    removeAttribute() {},
    setCustomValidity() {},
    classList: { contains: () => false },
    closest: () => label,
    querySelectorAll: () => [],
    replaceChildren() {
      this.children = [];
    },
    appendChild(child) {
      this.children.push(child);
    },
    prepend(child) {
      this.children.unshift(child);
    },
    append(...children) {
      this.children.push(...children);
    },
    after() {},
    add() {},
    focus() {},
  };
}

async function formBrowser(edit = false, saveError = null) {
  const nodes = new Map();
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  const fields = [];
  const html = await source('html/customer-form.html');
  for (const [, name] of html.matchAll(/name="([^"]+)"/g)) {
    const field = element();
    field.name = name;
    fields.push(field);
    fields[name] = field;
  }
  const checks = ['certificateReceived', 'contractReceived', 'acknowledgementReceived'];
  const numeric = [
    'reading',
    'installationFee',
    'setbackLength',
    'setbackRate',
    'reinstallationFee',
    'violationFee',
  ];
  checks.forEach((key) => {
    fields[key].type = 'checkbox';
  });
  numeric.forEach((key) => {
    fields[key].type = 'number';
    fields[key].value = '0';
  });
  const form = get('customerForm');
  form.elements = fields;
  form.reset = () => {
    fields.forEach((field) => {
      field.value = numeric.includes(field.name) ? '0' : '';
      field.checked = false;
    });
  };
  form.checkValidity = () => true;
  form.querySelectorAll = (selector) => (selector === 'input, select, textarea' ? fields : []);
  const saved = {
    id: '7',
    firstName: 'Ana',
    middleName: '',
    lastName: 'Reyes',
    extensionName: '',
    name: 'Ana Reyes',
    gender: 'Female',
    contact: '+639123456789',
    address: 'Purok 1',
    street: '',
    barangay: 'Barangay Agol',
    barangayId: '1',
    customerType: 'Residential',
    natureOfWork: 'New connection',
    serviceStatus: 'Approved',
    dateApplied: '2026-10-20',
    dateApproved: '2026-10-20',
    approvedBy: 'admin',
    certificateReceived: true,
    contractReceived: true,
    acknowledgementReceived: false,
    reading: 0,
    userId: '2',
    username: 'ana.reyes',
    account: 'PWSS-TEST',
    applicationNumber: 'APP-TEST',
    submitterNumber: 'PWSS-SUBMITTER',
    revision: 'version',
  };
  const calls = [];
  const context = vm.createContext({
    URLSearchParams,
    Option: function (text, value) {
      return { text, value, dataset: {} };
    },
    crypto: { randomUUID },
    location: { search: edit ? '?id=7' : '', href: '' },
    history: { replaceState: (...args) => calls.push({ resetURL: args[2] }) },
    document: { getElementById: get, createElement: element },
    WaterStore: {
      today: () => '2026-10-20',
      money: (value) => String(value),
      isRegistered: () => true,
    },
    AdminAuth: { user: { username: 'admin' }, ready: Promise.resolve({ role: 'admin' }) },
    CustomerAPI: {
      barangays: [{ id: '1', name: 'Barangay Agol' }],
      loadBarangays: async () => [{ id: '1', name: 'Barangay Agol', is_active: 1 }],
      profile: async () => ({ customer: saved, bills: [], payments: [] }),
      save: async (customer, password, id) => {
        calls.push({ customer, password, id });
        if (saveError) throw saveError;
        return { ...saved, ...customer, id: '7', account: 'PWSS-SERVER' };
      },
    },
    AdminUI: { message: (message) => calls.push({ message }) },
    confirmAction: async () => true,
    showNotice: async () => calls.push({ success: true }),
    showCustomerStep: (index) => calls.push({ step: index }),
  });
  vm.runInContext(await source('js/shared/validation.js'), context);
  vm.runInContext(await source('js/customers/customer-validation.js'), context);
  vm.runInContext(formSource, context);
  await new Promise((resolve) => setImmediate(resolve));
  return { context, form, fields, nodes, calls };
}

test('editing keeps password blank and returns to customer table after successful API save', async () => {
  const app = await formBrowser(true);
  assert.equal(app.nodes.get('customerPassword').value, '');
  await app.form.events.submit({ preventDefault() {} });
  const write = app.calls.find((call) => call.customer);
  assert.ok(write, JSON.stringify(app.calls));
  assert.equal(write.id, '7');
  assert.equal(write.password, '');
  assert.equal(write.customer.revision, 'version');
  assert.equal(vm.runInContext('location.href', app.context), 'customers.html');
});

test('adding resets the form to first step after success; failed save preserves typed fields', async () => {
  for (const failed of [false, true]) {
    const app = await formBrowser(false, failed ? new Error('Username already registered.') : null);
    for (const [key, value] of Object.entries({
      firstName: 'Ana',
      lastName: 'Reyes',
      gender: 'Female',
      name: 'Ana Reyes',
      contact: '9123456789',
      address: 'Purok 1',
      barangay: 'Barangay Agol',
      customerType: 'Residential',
    })) {
      app.fields[key].value = value;
    }
    app.fields.certificateReceived.checked = true;
    app.fields.contractReceived.checked = true;
    await app.form.events.submit({ preventDefault() {} });
    assert.ok(
      app.calls.some((call) => call.customer),
      JSON.stringify(app.calls),
    );
    if (failed) {
      assert.equal(app.fields.firstName.value, 'Ana');
      assert.ok(!app.calls.some((call) => call.success));
    } else {
      assert.equal(app.fields.firstName.value, '');
      assert.ok(app.calls.some((call) => call.step === 0));
      assert.equal(vm.runInContext('location.href', app.context), '');
    }
  }
});

test('integrated customer pages do not fall back to local business records or sample loaders', async () => {
  for (const file of [
    'customer-form.js',
    'customers.js',
    'customer-profile.js',
    'customer-application.js',
  ]) {
    assert.ok(
      !/WaterStore\.(load|save)|fetchSampleCustomers/.test(await source('js/customers/' + file)),
      file,
    );
  }
});

test('customer list renders the server page without slicing it a second time and handles load errors', async () => {
  const nodes = new Map();
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  const body = get('customerRows');
  body.rows = [];
  body.replaceChildren = () => {
    body.rows = [];
  };
  body.insertRow = () => {
    const row = element();
    body.rows.push(row);
    return row;
  };
  let failure = false;
  const pager = {
    page: 2,
    update(total) {
      this.total = total;
    },
  };
  const customers = Array.from({ length: 3 }, (_, index) => ({
    id: String(11 + index),
    name: 'Customer',
    account: 'TEST',
    barangay: 'Barangay Agol',
    reading: 0,
    active: true,
    mustChangePassword: index === 0,
  }));
  const cells = [];
  const checkboxes = [];
  const context = vm.createContext({
    document: { getElementById: get, createElement: element, querySelectorAll: () => checkboxes },
    createPagination: () => pager,
    AdminUI: {
      customer(row) { row.cells = [{ prepend(checkbox) { checkboxes.push(checkbox); } }]; },
      cell: () => {
        const cell = element();
        const append = cell.appendChild.bind(cell);
        cell.appendChild = (child) => { if (child.className === 'customer-select') checkboxes.push(child); append(child); };
        cells.push(cell);
        return cell;
      },
      empty() {},
      loading() {},
      message() {},
    },
    CustomerAPI: {
      loadBarangays: async () => [],
      list: async () => {
        if (failure) throw new Error('Server unavailable.');
        return {
          customers,
          pagination: { page: 2, total: 13 },
          summary: { total: 13, registered: 1, pending: 12 },
        };
      },
    },
    AdminAuth: { ready: Promise.resolve({ role: 'admin' }) },
    Option: function () {},
    customerCSVColumns: [],
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(await source('js/customers/customers.js'), context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(body.rows.length, 3);
  const flags = cells
    .flatMap((cell) => cell.children)
    .filter((child) => child.className === 'customer-temporary-password');
  assert.equal(flags.length, 1);
  assert.equal(flags[0].children[1].textContent, 'Temporary password');
  assert.equal(pager.total, 13);
  assert.equal(get('totalCustomers').textContent, 13);
  checkboxes[0].checked = true;
  checkboxes[0].events.change();
  assert.equal(get('deleteSelectedCustomers').textContent, 'Delete selected (1)');
  assert.equal(get('selectAllCustomers').indeterminate, true);
  get('selectAllCustomers').checked = true;
  get('selectAllCustomers').events.change({ target: get('selectAllCustomers') });
  assert.equal(get('deleteSelectedCustomers').textContent, 'Delete selected (3)');
  assert.ok(checkboxes.every((checkbox) => checkbox.checked));
  assert.equal(get('selectAllCustomers').indeterminate, false);
  await vm.runInContext('loadCustomers()', context);
  assert.equal(get('deleteSelectedCustomers').disabled, true);
  failure = true;
  await vm.runInContext('loadCustomers()', context);
  assert.equal(body.rows.length, 0);
  assert.equal(get('retryCustomers').hidden, false);
});

test('customer deletion API sends only the selected IDs and uses DELETE for a single row', async () => {
  const calls = [];
  const context = vm.createContext({ AdminAPI: { request: async (...args) => { calls.push(args); return { count: 1 }; } } });
  vm.runInContext(apiSource, context);
  await vm.runInContext("CustomerAPI.remove(['11'])", context);
  await vm.runInContext("CustomerAPI.remove(['11', '12'])", context);
  assert.equal(calls[0][0], '/customers/11');
  assert.equal(calls[0][1].method, 'DELETE');
  assert.equal(calls[1][0], '/customers/delete-selected');
  assert.deepEqual(Array.from(calls[1][1].body.ids), ['11', '12']);
});

test('empty customer exports show a modal without downloading a workbook', async () => {
  const nodes = new Map();
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  const notices = [];
  let downloads = 0;
  const context = vm.createContext({
    document: { getElementById: get },
    createPagination: () => ({ page: 1 }),
    AdminAuth: { ready: Promise.resolve(null) },
    CustomerAPI: { list: async () => ({ customers: [], pagination: { total: 0 } }) },
    downloadCustomerExcel: () => downloads++,
    showNotice: async (...args) => notices.push(args),
  });
  vm.runInContext(await source('js/customers/customers.js'), context);
  get('customerExportDialog').showModal = () => {};
  get('customerExportDialog').close = () => {};
  const button = get('exportCustomers');
  const confirm = get('confirmCustomerExport');
  await button.events.click();
  assert.match(get('customerExportMessage').textContent, /No data to export/);
  assert.equal(confirm.disabled, true);
  await confirm.events.click();
  assert.equal(downloads, 0);
  context.CustomerAPI.list = async () => ({
    customers: [{ account: 'PWSS-001' }],
    pagination: { total: 1 },
  });
  await button.events.click();
  assert.equal(confirm.disabled, false);
  assert.equal(downloads, 0);
  await confirm.events.click();
  assert.equal(downloads, 1);
  assert.match(notices.at(-1)[0], /exported successfully/);
});

test('Excel import shows loading, refreshes unfiltered records, then reports success', async () => {
  const nodes = new Map();
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  const button = element();
  button.textContent = 'Import customers';
  const form = get('importForm');
  form.querySelector = () => button;
  form.reset = () => {};
  get('customerFile').files = [{ name: 'customers.xlsx', size: 100 }];
  get('customerImportDialog').close = () => {};
  const pager = { page: 4, update() {} };
  const order = [];
  const context = vm.createContext({
    document: { getElementById: get, createElement: element },
    createPagination: () => pager,
    AdminAuth: { ready: Promise.resolve(null) },
    readCustomerExcel: async () => [{ account: 'PWSS-001' }],
    renderCustomerImportReview: () => element(),
    confirmAction: async () => true,
    AdminAPI: {
      request: async (path) => {
        assert.equal(button.disabled, true);
        if (path.endsWith('/preview')) {
          order.push('check');
          return {
            count: 1,
            rejectedCount: 0,
            rows: [],
            revision: 'review-token',
            barangaysToRegister: ['Barangay Caratagan'],
          };
        }
        assert.equal(button.textContent, 'Importing customers...');
        order.push('save');
        return { count: 1, rejectedCount: 0, barangaysRegistered: 1 };
      },
    },
    CustomerAPI: {
      loadBarangays: async () => [],
      list: async (filters) => {
        assert.equal(filters.page, 1);
        assert.equal(filters.search, '');
        order.push('refresh');
        return { customers: [], pagination: { page: 1, total: 0 }, summary: {} };
      },
    },
    AdminUI: { empty() {}, loading() {} },
    showNotice: async (title) => {
      assert.match(title, /successfully/);
      order.push('success');
    },
    Option: function () {},
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(await source('js/customers/customers.js'), context);
  await form.events.submit({ preventDefault() {}, target: form });
  assert.deepEqual(order, ['check', 'save', 'refresh', 'success']);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'Import customers');
});

test('an import with no ready rows shows the rejection table without a save confirmation', async () => {
  const nodes = new Map();
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  const button = element();
  button.textContent = 'Bulk Upload';
  const form = get('importForm');
  form.querySelector = () => button;
  get('customerFile').files = [{ name: 'customers.xlsx', size: 100 }];
  let confirmation = false,
    saved = false,
    notice = '';
  const table = element();
  const context = vm.createContext({
    document: { getElementById: get },
    createPagination: () => ({ page: 1 }),
    AdminAuth: { ready: Promise.resolve(null) },
    readCustomerExcel: async () => [{ account: 'EXISTS' }],
    renderCustomerImportReview: () => table,
    AdminAPI: {
      request: async (path) => {
        if (!path.endsWith('/preview')) saved = true;
        return { count: 0, rejectedCount: 1, rows: [], barangaysToRegister: [] };
      },
    },
    confirmAction: async () => {
      confirmation = true;
      return true;
    },
    showNotice: async (title, message, preview) => {
      notice = title;
      assert.equal(preview, table);
    },
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(await source('js/customers/customers.js'), context);
  await form.events.submit({ preventDefault() {}, target: form });
  assert.match(notice, /No valid customers/);
  assert.equal(confirmation, false);
  assert.equal(saved, false);
  assert.equal(button.disabled, false);
});

test('profile loads database fields and activation uses the API instead of browser storage', async () => {
  const nodes = new Map();
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  for (const id of ['profileBillRows', 'profilePaymentRows']) {
    get(id).insertRow = () => element();
  }
  const customer = {
    id: '7',
    name: 'Ana Reyes',
    account: 'PWSS-TEST',
    barangay: 'Barangay Agol',
    gender: 'Female',
    active: true,
    connectionStatus: 'Active',
    reading: 400,
    revision: 'version',
  };
  let changed;
  let reloaded = false;
  const context = vm.createContext({
    URLSearchParams,
    location: {
      search: '?id=7',
      reload: () => {
        reloaded = true;
      },
    },
    document: {
      getElementById: get,
      createElement: element,
      querySelectorAll: () => [],
      querySelector: () => get('actions'),
    },
    AdminAuth: { ready: Promise.resolve({ role: 'admin' }) },
    CustomerAPI: {
      profile: async () => ({ customer, bills: [], payments: [] }),
      changeStatus: async (...args) => {
        changed = args;
      },
    },
    WaterStore: {
      isRegistered: () => true,
      isActive: (c) => c.active,
      money: (value) => String(value),
    },
    AdminUI: { message() {}, empty() {} },
    confirmAction: async () => true,
    showNotice: async () => {},
  });
  vm.runInContext(await source('js/customers/customer-profile.js'), context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(get('profileContent').hidden, false);
  assert.equal(get('profileName').textContent, 'Ana Reyes');
  const toggle = get('actions').children[0];
  await toggle.events.click();
  assert.equal(changed[0].revision, 'version');
  assert.equal(changed[1], 'Inactive');
  assert.equal(reloaded, true);
});


test('possible customer duplicates require explicit review before saving a separate connection', async () => {
  for (const accepted of [false, true]) {
    const calls = [];
    const context = vm.createContext({URLSearchParams,
      confirmAction:async()=>accepted,
      AdminAPI:{request:async(path, options)=>{calls.push([path,options]);return path.includes('check-duplicate') ? {exists:true} : {id:'2'};}}
    });
    vm.runInContext(apiSource,context);
    const api=vm.runInContext('CustomerAPI',context);
    api.barangays=[{id:'1',name:'Barangay Agol'}];
    const input={firstName:'Ana',lastName:'Reyes',contact:'09123456789',barangay:'Barangay Agol',address:'Purok 1'};
    if (accepted) {
      await api.save(input,'password123');
      assert.equal(calls[1][1].body.duplicateReviewed,true);
      assert.equal(calls[1][0],'/customers');
    } else {
      await assert.rejects(api.save(input,'password123'),/Save cancelled/);
      assert.equal(calls.length,1);
    }
    assert.equal(calls[0][1].body.barangayId,'1');
    assert.equal(calls[0][1].body.address,'Purok 1');
  }
});
