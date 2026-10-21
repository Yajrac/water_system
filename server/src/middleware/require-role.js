import { AppError } from '../utils/app-error.js';

export function requireRole(...roles) {
  return function checkRole(req, res, next) {
    if (!req.user) throw new AppError('Sign in to continue.', 401);
    if (!roles.includes(req.user.role)) {
      throw new AppError('You do not have permission to access this resource.', 403);
    }
    next();
  };
}
