import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('report Excel preserves identifiers and exports financial cells as numbers, not formulas', async () => {
  const context = vm.createContext({ Blob, TextEncoder });
  vm.runInContext(
    await readFile(new URL('../../js/vendor/xlsx.full.min.js', import.meta.url), 'utf8'),
    context,
  );
  vm.runInContext(
    await readFile(new URL('../../js/reports/report-excel.js', import.meta.url), 'utf8'),
    context,
  );
  const values = [
    ['Account', 'Customer', 'Total', 'Paid', 'Balance'],
    ['000123', '=HYPERLINK("bad")', 14, 4, 10],
  ];
  const blob = context.excelWorkbook(values);
  const workbook = context.XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: 'array' });
  const sheet = workbook.Sheets.Report;
  assert.equal(sheet.A2.v, '000123');
  assert.equal(sheet.B2.v, '=HYPERLINK("bad")');
  assert.equal(sheet.B2.f, undefined);
  assert.equal(sheet.C2.t, 'n');
  assert.equal(sheet.D2.v, 4);
  assert.equal(sheet.E2.v, 10);
});
