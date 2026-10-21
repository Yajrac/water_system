import { AppError } from '../utils/app-error.js';
import { decimal, scaled } from '../utils/decimal.js';
import { customerId, validateCustomerQuery } from './customer.validator.js';

export function validatePayment(body) {
  const keys = [
    'billId',
    'amount',
    'expectedBalance',
    'method',
    'reference',
    'remarks',
    'requestKey',
  ];
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !keys.includes(key))
  )
    throw new AppError('Provide valid payment fields only.', 400);
  const result = { billId: customerId(body.billId) };
  for (const key of ['amount', 'expectedBalance']) {
    if (!['string', 'number'].includes(typeof body[key]) || body[key] === '')
      throw new AppError('Enter a valid ' + key + '.', 400);
    result[key] = decimal(body[key], 2, 13, key);
  }
  if (scaled(result.amount, 2) <= 0n)
    throw new AppError('Payment amount must be greater than zero.', 400);
  if (!['Cash', 'Bank transfer'].includes(body.method))
    throw new AppError('Choose Cash or Bank transfer.', 400);
  result.method = body.method;
  for (const [key, limit] of [
    ['reference', 100],
    ['remarks', 500],
  ]) {
    const value = body[key] ?? '';
    if (
      typeof value !== 'string' ||
      value.length > limit ||
      /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    )
      throw new AppError('Enter valid plain text for ' + key + '.', 400);
    result[key] = value.trim();
  }
  if (result.method === 'Bank transfer' && !result.reference)
    throw new AppError('Enter the bank transfer reference number.', 400);
  if (typeof body.requestKey !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(body.requestKey))
    throw new AppError('Prepare a new payment review before saving.', 400);
  result.requestKey = body.requestKey;
  return result;
}

export function validatePaymentQuery(query) {
  const result = validateCustomerQuery({
    page: query.page,
    limit: query.limit,
    search: query.search,
  });
  result.customerId = query.customerId ? customerId(query.customerId) : '';
  result.method = query.method || '';
  if (!['', 'Cash', 'Bank transfer'].includes(result.method))
    throw new AppError('Choose a valid payment method.', 400);
  for (const key of ['from', 'to']) {
    const value = query[key] || '';
    if (
      typeof value !== 'string' ||
      (value &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          !Number.isFinite(Date.parse(value)) ||
          new Date(value).toISOString().slice(0, 10) !== value))
    )
      throw new AppError('Choose a valid ' + key + ' date.', 400);
    result[key] = value;
  }
  if (result.from && result.to && result.from > result.to)
    throw new AppError('From date must be on or before To date.', 400);
  return result;
}
