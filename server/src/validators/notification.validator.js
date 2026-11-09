import { AppError } from '../utils/app-error.js';

export function validateNotice(body) {
  const types = ['Due date', 'Unpaid bill', 'Disconnection', 'Reconnection', 'Announcement'];
  if (!body || !types.includes(body.type) || !['all', 'barangay', 'customer'].includes(body.audience) ||
      !['Draft', 'Published'].includes(body.status) || typeof body.message !== 'string' ||
      !body.message.trim() || body.message.trim().length > 2000)
    throw new AppError('Choose a valid notice type, audience, status and message (up to 2000 characters).', 400);
  const validId = value => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value) && BigInt(value)<=18446744073709551615n;
  if (body.audience === 'customer' && body.targets !== undefined) {
    if (!Array.isArray(body.targets) || !body.targets.length || body.targets.length>1000 || !body.targets.every(validId))
      throw new AppError('Select 1 to 1000 valid customers.',400);
    return {...body,targets:[...new Set(body.targets)],message:body.message.trim()};
  }
  if (body.audience !== 'all' && !validId(body.target))
    throw new AppError('Select a valid recipient.', 400);
  return { ...body, message: body.message.trim() };
}

