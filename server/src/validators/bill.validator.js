import { AppError } from '../utils/app-error.js';
import { customerId, validateCustomerQuery } from './customer.validator.js';
import { billingMonth } from './billing-setup.validator.js';
import { scaled } from '../utils/decimal.js';

export function validateGeneration(body, generating = false) {
  const keys = generating ? ['setupId', 'revision'] : ['setupId'];
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !keys.includes(key))
  )
    throw new AppError('Provide a valid billing setup.', 400);
  if (generating && (typeof body.revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.revision)))
    throw new AppError('Preview the bills again before generating.', 409);
  return { setupId: customerId(body.setupId), revision: body.revision };
}

export function billAmounts(entry, rate) {
  const water = (scaled(entry.consumption, 3) * scaled(rate, 2) + 500n) / 1000n;
  const total =
    water + scaled(entry.connectionCharge, 2) + scaled(entry.late, 2) + scaled(entry.other, 2);
  if (water > 999999999999999n || total > 999999999999999n)
    throw new AppError('Bill amount exceeds the supported limit.', 400);
  const money = (value) =>
    (value / 100n).toString() + '.' + (value % 100n).toString().padStart(2, '0');
  return { water: money(water), total: money(total) };
}

export function validateBillQuery(query) {
  const paging = validateCustomerQuery({
    page: query.page,
    limit: query.limit,
    search: query.search,
  });
  const month = query.month ? billingMonth(query.month) : '';
  const due = query.due || '';
  if (
    typeof due !== 'string' ||
    (due &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(due) ||
        !Number.isFinite(Date.parse(due)) ||
        new Date(due).toISOString().slice(0, 10) !== due))
  )
    throw new AppError('Choose a valid due date.', 400);
  const status = query.status || '';
  if (!['', 'Paid', 'Unpaid', 'Overdue', 'outstanding'].includes(status))
    throw new AppError('Choose a valid bill status.', 400);
  return {
    page: paging.page,
    limit: paging.limit,
    search: paging.search,
    month,
    due,
    status,
    barangayId: query.barangayId ? customerId(query.barangayId) : '',
    customerId: query.customerId ? customerId(query.customerId) : '',
    billId: query.billId ? customerId(query.billId) : '',
  };
}
