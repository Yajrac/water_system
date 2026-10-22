import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const XLSX = require('../../js/vendor/xlsx.full.min.js');
const context = vm.createContext({
  XLSX,
  CustomerAPI: { barangays: [{ id: '1', name: 'Barangay Agol' }] },
});
for (const name of ['customer-csv.js', 'customer-excel.js']) {
  vm.runInContext(
    await readFile(new URL('../../js/customers/' + name, import.meta.url), 'utf8'),
    context,
  );
}
const headers = vm.runInContext('customerCSVColumns', context);
const record = [
  'PWSS-001',
  'Ana',
  '',
  'Reyes',
  '',
  'Female',
  '+639171234567',
  'Purok 1',
  '',
  'Barangay Agol',
  'Residential',
];
function file(rows, formula = false) {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  if (formula) sheet.A2 = { t: 's', v: 'PWSS-001', f: '"PWSS-001"' };
  XLSX.utils.book_append_sheet(book, sheet, 'Customers');
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx', compression: true });
  return { arrayBuffer: async () => buffer };
}

test('real compressed Excel import preserves contact text and maps barangay IDs', async () => {
  const rows = await context.readCustomerExcel(file([headers, record]));
  assert.equal(rows[0].contact, '+639171234567');
  assert.equal(rows[0].barangayId, '1');
  assert.equal(rows[0].serviceStatus, '');
  assert.equal(rows[0].password, undefined);
});

test('Excel import rejects empty sheets and header-only files', async () => {
  await assert.rejects(context.readCustomerExcel(file([])), /No data to import/);
  await assert.rejects(context.readCustomerExcel(file([headers])), /No data to import/);
  await assert.rejects(context.readCustomerExcel(file([headers, [' ', '']])), /No data to import/);
});

test('Excel accepts Purok in street and barangay names without a prefix or matching case', async () => {
  const alternateHeaders = headers.filter((key) => key !== 'address');
  const alternateRecord = [
    'PWSS-2026-A7C92F104B63',
    'Juan',
    '',
    'Cruz',
    '',
    'Male',
    '09123456789',
    'Purok 7',
    'agol',
    'Residential',
  ];
  const rows = await context.readCustomerExcel(file([alternateHeaders, alternateRecord]));
  assert.equal(rows[0].address, 'Purok 7');
  assert.equal(rows[0].street, '');
  assert.equal(rows[0].barangayId, '1');
  const unknown = [...alternateRecord];
  unknown[8] = 'Not Registered';
  const pending = await context.readCustomerExcel(file([alternateHeaders, unknown]));
  assert.equal(pending[0].barangayName, 'Not Registered');
  assert.equal(pending[0].barangayId, undefined);
  const missingPurok = [...alternateRecord];
  missingPurok[7] = 'Mabini Street';
  const invalid = await context.readCustomerExcel(file([alternateHeaders, missingPurok]));
  assert.equal(invalid[0].address, '');
});

test('Excel import rejects formulas, excess rows, and password columns', async () => {
  await assert.rejects(context.readCustomerExcel(file([headers, record], true)), /formulas/);
  await assert.rejects(
    context.readCustomerExcel(file([headers, ...Array(101).fill(record)])),
    /100 rows/,
  );
  await assert.rejects(
    context.readCustomerExcel(
      file([
        [...headers, 'password'],
        [...record, 'secret'],
      ]),
    ),
    /columns/,
  );
});

test('Excel export uses allowlisted text fields and cannot include password hashes', () => {
  let captured;
  const original = XLSX.writeFile;
  XLSX.writeFile = (book) => {
    captured = book;
  };
  try {
    context.downloadCustomerExcel(
      [{ firstName: '=1+1', contact: '+639171234567', password_hash: 'secret' }],
      'customers.xlsx',
    );
    const sheet = captured.Sheets.Customers;
    assert.equal(sheet.B2.t, 's');
    assert.equal(sheet.B2.f, undefined);
    assert.equal(sheet.B2.v, '=1+1');
    assert.equal(JSON.stringify(captured).includes('secret'), false);
  } finally {
    XLSX.writeFile = original;
  }
});

test('exported form details survive real Excel export and re-import without credentials', async () => {
  const customer = Object.fromEntries(headers.map((key) => [key, '']));
  Object.assign(customer, {
    account: 'RESTORE-001',
    firstName: 'Ana',
    lastName: 'Reyes',
    gender: 'Female',
    contact: '+639171234567',
    address: 'Purok 1',
    barangay: 'Barangay Agol',
    customerType: 'Commercial',
    submitterNumber: 'SUB-001',
    applicationNumber: 'APP-001',
    username: 'ana@sample',
    serviceStatus: 'Installed',
    connectionStatus: 'Disconnected',
    natureOfWork: 'New connection',
    dateApplied: '2025-01-01',
    dateApproved: '2025-01-02',
    dateInstalled: '2025-01-03',
    meterNumber: 'MTR-001',
    meterKind: 'Mechanical',
    meterSize: '1/2',
    initialReading: '1.250',
    reading: '12.345',
    certificateReceived: true,
    contractReceived: false,
    acknowledgementReceived: true,
    ctcNumber: '0000123',
    ctcDate: '2025-01-01',
    documentNotes: 'Verified, existing record',
    installationFee: '1000.00',
    setbackLength: '1.500',
    setbackRate: '12.50',
    reinstallationFee: '0.00',
    violationFee: '1.00',
    password: 'never-export',
    password_hash: 'never-export',
    revision: 'never-export',
  });
  let buffer;
  const original = XLSX.writeFile;
  XLSX.writeFile = (book) => {
    buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx', compression: true });
  };
  try {
    context.downloadCustomerExcel([customer], 'customers.xlsx');
  } finally {
    XLSX.writeFile = original;
  }
  const [restored] = await context.readCustomerExcel({ arrayBuffer: async () => buffer });
  for (const key of headers) {
    if (key === 'barangay') continue;
    if (restored[key] === undefined && customer[key] === '') continue;
    assert.equal(restored[key], customer[key], key);
  }
  assert.equal(restored.barangayId, '1');
  assert.equal(restored.password, undefined);
  assert.equal(restored.password_hash, undefined);
  assert.equal(restored.revision, undefined);
});
