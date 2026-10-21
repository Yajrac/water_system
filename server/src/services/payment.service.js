import { pool } from '../database/pool.js';
import * as paymentModel from '../models/payment.model.js';
import { AppError } from '../utils/app-error.js';
import { scaled } from '../utils/decimal.js';
import { today, customerId } from '../validators/customer.validator.js';
import { validatePayment, validatePaymentQuery } from '../validators/payment.validator.js';

function money(value) {
  return (value / 100n).toString() + '.' + (value % 100n).toString().padStart(2, '0');
}
function receiptView(result) {
  if (!result) throw new AppError('Payment receipt not found.', 404);
  const { row, office } = result;
  const bill = Object.fromEntries(
    [
      'cycle',
      'due',
      'previous',
      'current',
      'consumption',
      'ratePerCubic',
      'water',
      'connection',
      'late',
      'other',
      'total',
      'billNumber',
    ].map((key) => [key, row[key]]),
  );
  const balanceBefore = String(row.balanceBefore),
    balanceAfter = money(scaled(balanceBefore, 2) - scaled(row.amount, 2));
  return {
    office,
    bill: { ...bill, id: String(row.billId) },
    customer: {
      id: String(row.customerId),
      name: row.name,
      account: row.account,
      submitterNumber: row.submitterNumber,
      address: row.address,
      street: row.street || '',
      barangay: row.barangay,
    },
    payment: {
      id: String(row.id),
      billId: String(row.billId),
      customerId: String(row.customerId),
      receipt: row.receipt,
      amount: row.amount,
      method: row.method,
      reference: row.reference,
      remarks: row.remarks,
      date: row.date,
      createdAt: row.createdAt,
      collectedBy: row.collectedBy,
      balanceBefore,
      balanceAfter,
      allocations: [{ ...bill, billId: String(row.billId), amount: row.amount, balanceAfter }],
    },
  };
}

export function createPaymentService({ database = pool, model = paymentModel } = {}) {
  return {
    list: (query) => model.listPayments(validatePaymentQuery(query)),
    async receipt(id) {
      customerId(id);
      return receiptView(await model.getReceipt(id));
    },
    async save(body, actorId) {
      const details = validatePayment(body);
      const connection = await database.getConnection();
      try {
        await connection.beginTransaction();
        const bill = await model.lockBill(details.billId, connection);
        if (!bill) throw new AppError('Bill not found.', 404);
        const previous = await model.findRequest(details.requestKey, connection);
        let id;
        if (previous) {
          if (
            String(previous.billId) !== details.billId ||
            String(previous.actorId) !== String(actorId) ||
            previous.amount !== details.amount ||
            previous.method !== details.method ||
            previous.reference !== details.reference ||
            previous.remarks !== details.remarks
          )
            throw new AppError('This request key belongs to a different payment.', 409);
          id = previous.id;
        } else {
          const balance =
            scaled(bill.total, 2) - scaled(await model.paidForBill(details.billId, connection), 2);
          if (bill.generatedOn > today())
            throw new AppError('Payment cannot precede bill generation.', 409);
          if (balance <= 0n) throw new AppError('This bill is already fully paid.', 409);
          if (balance !== scaled(details.expectedBalance, 2))
            throw new AppError('The balance changed. Reload and review the payment.', 409);
          if (scaled(details.amount, 2) > balance)
            throw new AppError('Payment cannot exceed the remaining balance.', 400);
          id = await model.insertPayment(details, actorId, connection);
        }
        const receipt = receiptView(await model.getReceipt(id, connection));
        await connection.commit();
        return receipt;
      } catch (error) {
        await connection.rollback();
        if (['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error.code))
          throw new AppError(
            'Payment data changed. Retry the same review or reload the bill.',
            409,
          );
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}
export const paymentService = createPaymentService();
