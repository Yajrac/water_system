import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
process.env.DB_HOST ||= '127.0.0.1';
process.env.DB_NAME ||= 'water_system_test';
process.env.DB_USER ||= 'test';
const { reviewCustomerImport } = await import('../src/services/customer-import-review.js');
const customer = {
  account: 'IMPORT-001',
  firstName: 'Juan',
  lastName: 'Cruz',
  contact: '09123456789',
  gender: 'Male',
  address: 'Purok 1',
  barangayId: '1',
};

test('review isolates duplicates and invalid rows without rejecting valid customers', async () => {
  const connection = {
    execute: async (sql, values) => [
      sql.includes('FROM customers')
        ? values[0] === 'EXISTS-001'
          ? [{ id: '1' }]
          : []
        : [{ id: '1', is_active: 1 }],
    ],
  };
  const result = await reviewCustomerImport(
    {
      customers: [
        customer,
        { ...customer, account: 'EXISTS-001' },
        { ...customer },
        { ...customer, account: 'BAD-001', contact: '123' },
      ],
    },
    connection,
  );
  assert.equal(result.preview.count, 1);
  assert.equal(result.preview.rejectedCount, 3);
  assert.match(result.preview.rows[1].reason, /already exists/);
  assert.match(result.preview.rows[2].reason, /within this Excel/);
  assert.equal(result.preview.rows[1].row, 3);
  const changed = await reviewCustomerImport(
    { customers: [customer] },
    { execute: async () => [[{ id: '1' }]] },
  );
  const original = await reviewCustomerImport({ customers: [customer] }, connection);
  assert.notEqual(changed.preview.revision, original.preview.revision);
});

test('review table uses text nodes and marks rejected rows for red styling', async () => {
  const node = () => ({
    children: [],
    appendChild(child) {
      this.children.push(child);
    },
    insertRow() {
      const row = node();
      this.children.push(row);
      return row;
    },
    createTHead() {
      const head = node();
      this.children.push(head);
      return head;
    },
    createTBody() {
      const body = node();
      this.children.push(body);
      return body;
    },
  });
  const context = vm.createContext({ document: { createElement: node } });
  vm.runInContext(
    await readFile(
      new URL('../../js/customers/customer-import-review.js', import.meta.url),
      'utf8',
    ),
    context,
  );
  const result = context.renderCustomerImportReview([
    { row: 2, name: '<script>', status: 'rejected', reason: 'Already exists' },
  ]);
  const row = result.children[0].children[1].children[0];
  assert.equal(row.className, 'import-row-rejected');
  assert.equal(row.children[2].textContent, '<script>');
});
