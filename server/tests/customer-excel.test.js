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
  assert.equal(rows[0].serviceStatus, 'Pending');
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
