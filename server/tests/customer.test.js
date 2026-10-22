import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCustomer,
  validateCustomerQuery,
  customerId,
  today,
} from '../src/validators/customer.validator.js';
import { decimal, installationTotal } from '../src/utils/decimal.js';
import { customerView } from '../src/services/customer-mapper.js';

const input = {
  firstName: 'Ana',
  middleName: '',
  lastName: 'Reyes',
  gender: 'Female',
  contact: '09123456789',
  address: 'Purok 1',
  barangayId: '1',
  serviceStatus: 'Approved',
  certificateReceived: true,
  contractReceived: true,
  contractDate: today(),
};

test('bulk import preserves explicit status and checks, with Approved defaults for legacy files', () => {
  const body = {
    ...input,
    serviceStatus: 'Pending',
    certificateReceived: false,
    contractReceived: false,
  };
  const imported = validateCustomer({ ...body, account: 'OLD-001' }, { importing: true });
  assert.equal(imported.serviceStatus, 'Pending');
  assert.equal(imported.dateApproved, '');
  assert.equal(imported.certificateReceived, false);
  assert.equal(imported.contractReceived, false);
  const legacy = { ...body, account: 'OLD-002' };
  delete legacy.serviceStatus;
  delete legacy.certificateReceived;
  delete legacy.contractReceived;
  const approved = validateCustomer(legacy, { importing: true });
  assert.equal(approved.serviceStatus, 'Approved');
  assert.equal(approved.certificateReceived, true);
  assert.equal(validateCustomer(body).serviceStatus, 'Pending');
});

test('customer validation normalizes contact and server-controlled application dates', () => {
  for (const contact of ['09123456789', '9123456789', '639123456789', '+639123456789'])
    assert.equal(validateCustomer({ ...input, contact }).contact, '+639123456789');
  const result = validateCustomer(input);
  assert.equal(result.contact, '+639123456789');
  assert.equal(result.dateApplied, today());
  assert.equal(result.dateApproved, today());
  assert.equal(result.reading, '0.000');
  assert.equal(result.contractDate, today());
});

test('customer validation rejects overposting, invalid names, dates, unsafe IDs and incomplete proofs', () => {
  for (const body of [
    { ...input, role: 'admin' },
    { ...input, firstName: '<script>' },
    { ...input, dateInstalled: '2026-02-30' },
    { ...input, barangayId: '1 OR 1=1' },
    { ...input, contractDate: '2999-01-01' },
    { ...input, reading: '-1' },
    { ...input, reading: '1.1234' },
    { ...input, serviceStatus: 'Installed' },
    { ...input, password: 'short', username: 'ana.reyes' },
    { ...input, address: ['Purok 1'] },
    { ...input, account: 'FORGED-REFERENCE' },
  ]) {
    assert.throws(() => validateCustomer(body), { statusCode: 400 });
  }
  assert.throws(() => customerId('18446744073709551616'), { statusCode: 400 });
});

test('consumer chosen passwords accept 8 to 128 characters', () => {
  for (const password of ['password123', 'abcdefgh', 'x'.repeat(128)]) {
    assert.equal(
      validateCustomer({ ...input, username: 'ana.reyes', password }).password,
      password,
    );
  }
  for (const password of ['1234567', 'x'.repeat(129)]) {
    assert.throws(() => validateCustomer({ ...input, username: 'ana.reyes', password }), {
      statusCode: 400,
    });
  }
});

test('existing consumer password can be left blank and edited records require revision', () => {
  const existing = { userId: '1', dateApplied: '2020-01-01', dateApproved: '2020-01-01' };
  assert.throws(() => validateCustomer({ ...input, username: 'ana.reyes' }, { existing }), {
    statusCode: 409,
  });
  const result = validateCustomer(
    { ...input, username: 'ana.reyes', revision: 'version' },
    { existing },
  );
  assert.equal(result.password, '');
  assert.equal(result.dateApplied, '2020-01-01');
});

test('simplified checklist saves without document dates and preserves omitted legacy details', () => {
  const { contractDate, ...body } = input;
  assert.equal(validateCustomer(body).contractDate, '');
  const result = validateCustomer(
    { ...body, revision: 'v1' },
    {
      existing: {
        contractDate: '2020-01-01',
        ctcNumber: '123',
        documentNotes: 'Existing reference',
      },
    },
  );
  assert.equal(result.contractDate, '2020-01-01');
  assert.equal(result.ctcNumber, '123');
  assert.equal(result.documentNotes, 'Existing reference');
});

test('only imports can resolve official unregistered barangay names', () => {
  const { barangayId, ...row } = input;
  const imported = validateCustomer(
    { ...row, account: 'AUTO-001', barangayName: 'caratagan' },
    { importing: true },
  );
  assert.equal(imported.barangayName, 'Barangay Caratagan');
  assert.equal(
    validateCustomer(
      { ...row, account: 'AUTO-002', barangayName: 'barangay 4' },
      { importing: true },
    ).barangayName,
    'Barangay 4',
  );
  assert.throws(() => validateCustomer({ ...row, barangayName: 'caratagan' }), { statusCode: 400 });
  assert.throws(
    () =>
      validateCustomer(
        { ...row, account: 'AUTO-003', barangayName: 'Unknown place' },
        { importing: true },
      ),
    { statusCode: 400 },
  );
});

test('decimal estimates use exact integer arithmetic and reject out-of-range input', () => {
  const result = validateCustomer({
    ...input,
    installationFee: '0.10',
    setbackLength: '0.100',
    setbackRate: '0.20',
    reinstallationFee: '0.20',
    violationFee: '0',
  });
  assert.equal(installationTotal(result), 0.32);
  assert.throws(() => decimal('10000000000', 2, 10, 'Fee'), { statusCode: 400 });
  assert.throws(() => decimal('1e3', 2, 10, 'Fee'), { statusCode: 400 });
});

test('query validation limits page size, search length and supported filters', () => {
  assert.equal(validateCustomerQuery({}).limit, 10);
  assert.equal(validateCustomerQuery({ page: '2', status: 'pending' }).page, 2);
  for (const query of [
    { limit: '1000' },
    { page: '0' },
    { status: 'arbitrary' },
    { search: ['bad'] },
  ]) {
    assert.throws(() => validateCustomerQuery(query), { statusCode: 400 });
  }
});

test('customer view maps IDs, registration flags and fingerprint without password fields', () => {
  const row = {
    id: '1',
    firstName: 'Ana',
    lastName: 'Reyes',
    serviceStatus: 'Approved',
    connectionStatus: 'Inactive',
  };
  const view = customerView(row);
  assert.equal(view.name, 'Ana Reyes');
  assert.equal(view.active, false);
  assert.equal(view.registrationStatus, 'Registered');
  assert.notEqual(customerView({ ...row, firstName: 'Anna' }).revision, view.revision);
  assert.equal(view.password_hash, undefined);
});

test('consumer usernames accept symbols while rejecting whitespace, markup and invalid lengths', () => {
  for (const username of ['test', 'test@', 'test1', 'test!#$%&*+=?', 'name@email.com']) {
    assert.equal(
      validateCustomer({ ...input, username, password: 'password123' }).username,
      username,
    );
  }
  for (const username of ['ab', 'a'.repeat(41), 'test name', 'test<', 'test>', 'ab\u0000cd']) {
    assert.throws(() => validateCustomer({ ...input, username, password: 'password123' }));
  }
});
