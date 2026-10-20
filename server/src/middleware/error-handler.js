import { AppError } from '../utils/app-error.js';

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON request body.',
    });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request body is too large.',
    });
  }

  console.error('Request failed:', {
    method: req.method,
    path: req.path,
    code: error.code || 'INTERNAL_ERROR',
  });

  return res.status(500).json({
    success: false,
    message: 'An unexpected error occurred.',
  });
}