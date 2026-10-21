import { AppError } from '../utils/app-error.js';
export function validateFeedback(body) {
  if (!body || Object.keys(body).some(key => !['category','message'].includes(key)) ||
    !['Billing','Water supply','Meter','Other'].includes(body.category) ||
    typeof body.message !== 'string' || !body.message.trim() || body.message.trim().length > 1500)
    throw new AppError('Select a category and enter feedback of 1 to 1500 characters.',400);
  return {category:body.category,message:body.message.trim()};
}
