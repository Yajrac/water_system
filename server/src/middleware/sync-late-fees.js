import { automaticLateFees } from '../services/automatic-late-fee.service.js';

// Run only after authentication/role checks. Reads and the timer share the
// same transactional, idempotent bill updater.
export async function syncLateFees(req, res, next) {
  if (req.method === 'GET') {
    await automaticLateFees.accrueDue(req.user.role === 'consumer' ? { userId: req.user.id } : {});
  }
  next();
}
