import { createHash } from 'node:crypto';
import { installationTotal } from '../utils/decimal.js';

export function customerView(row) {
  if (!row) return null;
  const customer = Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !key.startsWith('_'))
      .map(([key, value]) => [key, value ?? '']),
  );
  for (const key of [
    'id',
    'userId',
    'barangayId',
    'applicationId',
    'meterId',
    'documentsId',
    'estimatesId',
    'approverId',
  ]) {
    customer[key] = row[key] == null ? '' : String(row[key]);
  }
  for (const key of [
    'certificateReceived',
    'contractReceived',
    'acknowledgementReceived',
    'hasBills',
    'hasMeterEntries',
    'mustChangePassword',
  ]) {
    customer[key] = Number(row[key]) === 1;
  }
  customer.name = [
    customer.firstName,
    customer.middleName,
    customer.lastName,
    customer.extensionName,
  ]
    .filter(Boolean)
    .join(' ');
  customer.active = customer.connectionStatus === 'Active';
  customer.serviceStatus ||= 'Pending';
  customer.registrationStatus = customer.serviceStatus === 'Pending' ? 'Application' : 'Registered';
  const amounts = [
    'reading',
    'initialReading',
    'installationFee',
    'setbackLength',
    'setbackRate',
    'reinstallationFee',
    'violationFee',
  ];
  const decimals = Object.fromEntries(amounts.map((key) => [key, row[key] || '0']));
  customer.installationTotal = installationTotal(decimals);
  for (const key of amounts) customer[key] = Number(row[key] || 0);
  customer.revision = createHash('sha256').update(JSON.stringify(row)).digest('hex');
  return customer;
}

export function financialView(records) {
  return {
    bills: records.bills.map((row) => ({
      ...row,
      id: String(row.id),
      customerId: String(row.customerId),
      ...Object.fromEntries(
        [
          'previous',
          'current',
          'consumption',
          'ratePerCubic',
          'water',
          'connection',
          'late',
          'other',
          'total',
        ].map((key) => [key, Number(row[key])]),
      ),
      monthly: 0,
      billingMode: 'flat',
      rateVersion: 3,
    })),
    payments: records.payments.map((row) => ({
      ...row,
      id: String(row.id),
      customerId: String(row.customerId),
      billId: String(row.billId),
      amount: Number(row.amount),
      allocations: [{ billId: String(row.billId), amount: Number(row.amount) }],
    })),
  };
}
