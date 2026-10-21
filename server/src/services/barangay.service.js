import { pool } from '../database/pool.js';
import * as barangayModel from '../models/barangay.model.js';
import { recordBarangayActivity } from '../models/activity-log.model.js';
import { AppError } from '../utils/app-error.js';
import { validateBarangay, validateBarangayId } from '../validators/barangay.validator.js';

export function createBarangayService({
  database = pool,
  model = barangayModel,
  recordActivity = recordBarangayActivity,
} = {}) {
  async function save(body, actorId) {
    const details = validateBarangay(body);
    const connection = await database.getConnection();
    try {
      await connection.beginTransaction();
      if (await model.findConflictingBarangay(details, null, connection)) {
        throw new AppError('This barangay is already registered.', 409);
      }
      const barangay = await model.createBarangay(details, connection);
      await recordActivity(connection, actorId, 'barangay.created', barangay);
      await connection.commit();
      return barangay;
    } catch (error) {
      await connection.rollback();
      // Database unique constraints also stop concurrent duplicate requests.
      if (error.code === 'ER_DUP_ENTRY') {
        throw new AppError('This barangay is already registered.', 409);
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  return {
    getBarangays: () => model.findAllBarangays(),
    addBarangay: (body, actorId) => save(body, actorId),
    async removeBarangay(id, actorId) {
      validateBarangayId(id);
      const connection = await database.getConnection();
      try {
        await connection.beginTransaction();
        const barangay = await model.lockBarangayById(id, connection);
        if (!barangay) throw new AppError('Barangay not found.', 404);
        if (await model.isBarangayInUse(id, connection)) {
          throw new AppError(
            'This barangay is linked to existing records and cannot be deleted.',
            409,
          );
        }
        await model.deleteBarangay(id, connection);
        await recordActivity(connection, actorId, 'barangay.deleted', barangay);
        await connection.commit();
        return { id: String(barangay.id) };
      } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
          throw new AppError(
            'This barangay is linked to existing records and cannot be deleted.',
            409,
          );
        }
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}

export const { getBarangays, addBarangay, removeBarangay } = createBarangayService();
