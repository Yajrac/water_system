import { AppError } from '../utils/app-error.js';
import { decimal, scaled } from '../utils/decimal.js';
import { customerId, today } from './customer.validator.js';

export function billingMonth(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) ||
    Number(value.slice(0, 4)) < 1000
  )
    throw new AppError('Provide a valid billing month (YYYY-MM).', 400);
  return value;
}

export function validateBillingSetup(body) {
  const keys = ['barangayId', 'month', 'due', 'rate'];
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !keys.includes(key))
  )
    throw new AppError('Provide valid billing setup fields only.', 400);
  const month = billingMonth(body.month);
  if (month !== today().slice(0, 7))
    throw new AppError('Billing setup can only be saved for the current Philippine month.', 400);
  const due = body.due;
  if (
    typeof due !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(due) ||
    !Number.isFinite(Date.parse(due)) ||
    new Date(due).toISOString().slice(0, 10) !== due ||
    due < today()
  )
    throw new AppError('Choose a valid due date that is not in the past.', 400);
  if (typeof body.rate !== 'string' && typeof body.rate !== 'number')
    throw new AppError('Enter a positive water rate.', 400);
  const rate = decimal(body.rate, 2, 10, 'Water rate');
  if (scaled(rate, 2) <= 0n) throw new AppError('Water rate must be greater than zero.', 400);
  return { barangayId: customerId(body.barangayId), month, due, rate };
}
