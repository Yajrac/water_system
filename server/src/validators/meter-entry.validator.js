import { createHash } from 'node:crypto';
import { AppError } from '../utils/app-error.js';
import { decimal, scaled } from '../utils/decimal.js';
import { customerId } from './customer.validator.js';

export function entryRevision(row) {
  return createHash('sha256').update(JSON.stringify(row)).digest('hex');
}

export function validateMeterEntry(body) {
  const keys = [
    'setupId',
    'customerId',
    'meterId',
    'previous',
    'consumption',
    'connectionCharge',
    'late',
    'other',
    'revision',
  ];
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !keys.includes(key))
  )
    throw new AppError('Provide valid meter entry fields only.', 400);
  for (const key of ['previous', 'consumption'])
    if (body[key] === undefined || body[key] === '')
      throw new AppError('Enter the previous reading and consumption.', 400);
  const result = {
    setupId: customerId(body.setupId),
    customerId: customerId(body.customerId),
    meterId: customerId(body.meterId),
  };
  for (const key of ['previous', 'consumption', 'connectionCharge', 'late', 'other']) {
    if (body[key] !== undefined && typeof body[key] !== 'string' && typeof body[key] !== 'number')
      throw new AppError('Enter a numeric value for ' + key + '.', 400);
  }
  for (const key of ['previous', 'consumption']) result[key] = decimal(body[key], 3, 12, key);
  for (const key of ['connectionCharge', 'late', 'other'])
    result[key] = decimal(body[key] ?? '0', 2, 10, key);
  if (scaled(result.previous, 3) + scaled(result.consumption, 3) > 999999999999999n)
    throw new AppError('The current reading exceeds the meter reading limit.', 400);
  if (
    body.revision !== undefined &&
    (typeof body.revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.revision))
  )
    throw new AppError('Reload the meter entry before saving changes.', 409);
  result.revision = body.revision;
  return result;
}
