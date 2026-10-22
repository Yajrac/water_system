import { validateCustomerQuery } from './customer.validator.js';
import { AppError } from '../utils/app-error.js';

export function activityFilters(query) {
  const paging = validateCustomerQuery({ page: query.page, search: query.search });
  const role = query.role || 'admin';
  if (!['admin', 'consumer'].includes(role)) throw new AppError('Choose a valid log type.', 400);
  const date = query.date || '';
  if (
    typeof date !== 'string' ||
    (date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date))
  )
    throw new AppError('Choose a valid log date.', 400);
  const start = date ? new Date(date + 'T00:00:00+08:00') : null;
  return {
    ...paging,
    role,
    start: start ? start.toISOString().slice(0, 19).replace('T', ' ') : '',
    end: start
      ? new Date(start.getTime() + 86400000).toISOString().slice(0, 19).replace('T', ' ')
      : '',
  };
}
