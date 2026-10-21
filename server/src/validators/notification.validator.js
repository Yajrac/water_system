import { AppError } from '../utils/app-error.js';

export function validateNotice(body) {
  const types = ['Due date', 'Unpaid bill', 'Disconnection', 'Reconnection', 'Announcement'];
  if (!body || !types.includes(body.type) || !['all', 'barangay', 'customer'].includes(body.audience) ||
      !['Draft', 'Published'].includes(body.status) || typeof body.message !== 'string' ||
      !body.message.trim() || body.message.trim().length > 2000)
    throw new AppError('Choose a valid notice type, audience, status and message (up to 2000 characters).', 400);
  if (body.audience !== 'all' && (typeof body.target !== 'string' || !/^[1-9]\d{0,19}$/.test(body.target)))
    throw new AppError('Select a valid recipient.', 400);
  return { ...body, message: body.message.trim() };
}

