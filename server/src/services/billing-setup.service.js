import { pool } from '../database/pool.js';
import * as setupModel from '../models/billing-setup.model.js';
import { AppError } from '../utils/app-error.js';
import { validateBillingSetup, billingMonth } from '../validators/billing-setup.validator.js';

export function createBillingSetupService({ database = pool, model = setupModel } = {}) {
  return {
    list: (month) => model.listBillingSetups(billingMonth(month)),
    async save(body, actorId) {
      const details = validateBillingSetup(body);
      const connection = await database.getConnection();
      try {
        await connection.beginTransaction();
        const barangay = await model.lockServiceArea(details.barangayId, connection);
        if (!barangay || Number(barangay.is_active) !== 1)
          throw new AppError('Select an active registered barangay.', 400);
        const existing = await model.findSetup(details, connection);
        let id = existing ? String(existing.id) : null;
        const changed = !existing || existing.rate !== details.rate || existing.due !== details.due;
        if (changed) {
          if (existing && (await model.setupInUse(id, connection)))
            throw new AppError(
              'This setup has meter entries. Its rate and due date cannot be changed.',
              409,
            );
          id = await model.writeSetup(details, actorId, existing, connection);
          await model.logSetup(id, details, actorId, Boolean(existing), connection);
        }
        const rows = await model.listBillingSetups(details.month, connection);
        const saved = rows.find((row) => String(row.id) === id);
        if (!saved) throw new Error('Saved billing setup was not found.');
        await connection.commit();
        return saved;
      } catch (error) {
        await connection.rollback();
        if (['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code))
          throw new AppError(
            'Billing setup changed in another session. Reload and try again.',
            409,
          );
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}

export const billingSetupService = createBillingSetupService();
