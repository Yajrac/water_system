import { pool } from '../database/pool.js';
import * as entryModel from '../models/meter-entry.model.js';
import { AppError } from '../utils/app-error.js';
import { customerId, today } from '../validators/customer.validator.js';
import { validateMeterEntry, entryRevision } from '../validators/meter-entry.validator.js';
import { scaled } from '../utils/decimal.js';

function entryView(row) {
  return {
    ...row,
    id: String(row.id),
    customerId: String(row.customerId),
    meterId: String(row.meterId),
    recordedBy: String(row.recordedBy),
    revision: entryRevision(row),
  };
}

export function createMeterEntryService({ database = pool, model = entryModel } = {}) {
  return {
    async list(id) {
      customerId(id);
      const setup = await model.findSetup(id);
      if (!setup) throw new AppError('Billing setup not found.', 404);
      const [consumers, entries] = await Promise.all([
        model.listConsumers(setup),
        model.listEntries(id),
      ]);
      return {
        setup: { ...setup, id: String(setup.id), barangayId: String(setup.barangayId) },
        customers: consumers.map((row) => ({
          ...row,
          id: String(row.id),
          barangayId: String(row.barangayId),
          meterId: String(row.meterId),
        })),
        entries: entries.map(entryView),
      };
    },
    async save(body, actorId) {
      const details = validateMeterEntry(body);
      const connection = await database.getConnection();
      try {
        await connection.beginTransaction();
        const setup = await model.findSetup(details.setupId, connection, true);
        if (!setup) throw new AppError('Billing setup not found.', 404);
        if (setup.month !== today().slice(0, 7) || Number(setup.active) !== 1)
          throw new AppError(
            'Select an active barangay setup for the current Philippine month.',
            409,
          );
        const consumer = await model.lockConsumer(details.customerId, connection);
        if (
          !consumer ||
          String(consumer.barangayId) !== String(setup.barangayId) ||
          consumer.connectionStatus !== 'Active' ||
          consumer.serviceStatus !== 'Installed'
        )
          throw new AppError('This customer is not eligible for the selected billing setup.', 409);
        if (await model.hasBill(details.customerId, setup.month, connection))
          throw new AppError('This customer already has a bill for this or a later month.', 409);
        if (scaled(consumer.previous, 3) !== scaled(details.previous, 3))
          throw new AppError('The meter reading changed. Reload the customer before saving.', 409);
        if (String(consumer.meterId) !== details.meterId)
          throw new AppError('The assigned meter changed. Reload the customer before saving.', 409);
        const existing = await model.findEntry(details, connection);
        if (
          existing &&
          (existing.status !== 'Saved' ||
            String(existing.meterId) !== String(consumer.meterId) ||
            details.revision !== entryRevision(existing))
        )
          throw new AppError('This entry changed or was billed. Reload before saving.', 409);
        if (!existing && details.revision)
          throw new AppError('The saved entry no longer exists. Reload before saving.', 409);
        const saved = await model.saveEntry(details, consumer, actorId, existing, connection);
        await connection.commit();
        return entryView(saved);
      } catch (error) {
        await connection.rollback();
        if (['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code))
          throw new AppError('Another session changed this entry. Reload and try again.', 409);
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}

export const meterEntryService = createMeterEntryService();
