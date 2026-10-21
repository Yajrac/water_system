import { createHash } from 'node:crypto';
import { pool } from '../database/pool.js';
import * as meters from '../models/meter-entry.model.js';
import * as bills from '../models/bill.model.js';
import { AppError } from '../utils/app-error.js';
import { today } from '../validators/customer.validator.js';
import { scaled } from '../utils/decimal.js';
import {
  validateGeneration,
  billAmounts,
  validateBillQuery,
} from '../validators/bill.validator.js';

export function createBillService({ database = pool, model = { ...meters, ...bills } } = {}) {
  async function run(body, actorId, generating) {
    const details = validateGeneration(body, generating);
    const connection = await database.getConnection();
    try {
      await connection.beginTransaction();
      const day = today();
      const setup = await model.findSetup(details.setupId, connection, true);
      if (!setup) throw new AppError('Billing setup not found.', 404);
      if (Number(setup.active) !== 1 || setup.month !== day.slice(0, 7) || setup.due < day)
        throw new AppError('Review the current month setup and due date before generating.', 409);
      const candidates = await model.listConsumers(setup, connection);
      if (!candidates.length)
        throw new AppError('No eligible customers are awaiting bills for this setup.', 409);
      candidates.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
      const pending = [];
      for (const candidate of candidates) {
        const customer = await model.lockConsumer(candidate.id, connection);
        if (
          !customer ||
          customer.connectionStatus !== 'Active' ||
          customer.serviceStatus !== 'Installed' ||
          String(customer.barangayId) !== String(setup.barangayId)
        )
          throw new AppError('Customer eligibility changed. Reload before generating.', 409);
        const entry = await model.findEntry(
          { setupId: details.setupId, customerId: String(customer.id) },
          connection,
        );
        if (!entry || entry.status !== 'Saved')
          throw new AppError(
            'Save all eligible customer meter entries before generating bills.',
            409,
          );
        if (
          String(entry.meterId) !== String(customer.meterId) ||
          scaled(entry.previous, 3) !== scaled(customer.previous, 3) ||
          (await model.hasBill(customer.id, setup.month, connection))
        )
          throw new AppError(
            'A meter reading or billing record changed. Reload and review entries.',
            409,
          );
        pending.push({ customer, entry, amounts: billAmounts(entry, setup.rate) });
      }
      const revision = createHash('sha256')
        .update(JSON.stringify({ day, setup, pending }))
        .digest('hex');
      if (generating && revision !== details.revision)
        throw new AppError(
          'The bill preview changed. Review the latest preview before generating.',
          409,
        );
      if (today() !== day)
        throw new AppError('The calendar date changed. Preview the bills again.', 409);
      if (generating) {
        for (const item of pending)
          await model.insertBill(
            setup,
            item.customer,
            item.entry,
            item.amounts,
            actorId,
            day,
            connection,
          );
        await model.logGeneration(setup, actorId, pending.length, connection);
      }
      await connection.commit();
      return {
        revision,
        count: pending.length,
        bills: pending.map(({ customer, entry, amounts }) => ({
          customerId: String(customer.id),
          name: customer.name,
          account: customer.account,
          cycle: setup.month,
          generatedOn: day,
          due: setup.due,
          previous: entry.previous,
          current: entry.current,
          consumption: entry.consumption,
          ratePerCubic: setup.rate,
          ...amounts,
        })),
      };
    } catch (error) {
      await connection.rollback();
      if (['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code))
        throw new AppError(
          'Billing data changed in another session. Reload and review before generating.',
          409,
        );
      throw error;
    } finally {
      connection.release();
    }
  }
  return {
    preview: (body) => run(body, null, false),
    generate: (body, actorId) => run(body, actorId, true),
    list: (query) => model.listBills(validateBillQuery(query)),
  };
}

export const billService = createBillService();
