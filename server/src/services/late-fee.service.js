import { pool } from '../database/pool.js';
import { scaled } from '../utils/decimal.js';
import { today } from '../validators/customer.validator.js';
import { AppError } from '../utils/app-error.js';

const dayNumber = (day) => Date.parse(day + 'T00:00:00Z') / 86400000;
const dayString = (day) => new Date(day * 86400000).toISOString().slice(0, 10);
const positive = (amount) => amount > 0n ? amount : 0n;
const maxFee = 999999999999n;
export const feeMoney = (cents) => (cents / 100n) + '.' + (cents % 100n).toString().padStart(2, '0');

// Payments settle a bill's ordinary charges first, then its carried penalties
// in assessment order. Existing billed penalties retain their original due clock.
export function suggestLateFee({ bills, payments, assessments }, asOf = today()) {
  const outstanding = (bill, day) => {
    if (bill.generated > day) return { principal: 0n, fees: new Map() };
    const parts = assessments.filter((item) => String(item.chargedBillId) === String(bill.id));
    let paid = payments.filter((item) => String(item.billId) === String(bill.id) && item.day <= day)
      .reduce((sum, item) => sum + scaled(item.amount, 2), 0n);
    const principal = scaled(bill.total, 2) - parts.reduce((sum, item) => sum + scaled(item.amount, 2), 0n);
    const result = { principal: positive(principal - paid), fees: new Map() };
    paid = positive(paid - principal);
    for (const part of parts) {
      const amount = scaled(part.amount, 2);
      result.fees.set(String(part.id), positive(amount - paid));
      paid = positive(paid - amount);
    }
    return result;
  };
  let total = 0n;
  const basis = [];
  for (const bill of bills) {
    const origin = dayNumber(bill.due);
    const periods = Math.floor((dayNumber(asOf) - origin) / 7);
    if (periods < 1) continue;
    const prior = assessments.filter((item) => String(item.sourceBillId) === String(bill.id));
    const previousThrough = prior.reduce((last, item) => item.through > last ? item.through : last, bill.due);
    const first = Math.floor((dayNumber(previousThrough) - origin) / 7) + 1;
    if (first > periods) continue;
    let added = 0n;
    for (let period = first; period <= periods; period++) {
      const boundary = dayString(origin + period * 7);
      let balance = outstanding(bill, boundary).principal + added;
      for (const charge of prior) {
        const chargedBill = bills.find((candidate) => String(candidate.id) === String(charge.chargedBillId));
        if (chargedBill) balance += outstanding(chargedBill, boundary).fees.get(String(charge.id)) || 0n;
      }
      added += (balance + 5n) / 10n;
      if (added + total > maxFee) throw new AppError('Late fee exceeds the supported amount. Review this account.', 400);
    }
    // Zero assessments also record waived/settled periods and prevent backcharging.
    basis.push({ sourceBillId: String(bill.id), previousThrough,
      through: dayString(origin + periods * 7), amount: feeMoney(added) });
    total += added;
  }
  return { amount: feeMoney(total), basis };
}

export async function loadLateFeeData(customerIds, connection = pool) {
  if (!customerIds.length) return { bills: [], payments: [], assessments: [] };
  const marks = customerIds.map(() => '?').join(',');
  const [bills] = await connection.execute(`SELECT id, customer_id AS customerId,
    CAST(total_amount AS CHAR) AS total, DATE_FORMAT(due_date, '%Y-%m-%d') AS due,
    DATE_FORMAT(generated_on, '%Y-%m-%d') AS \`generated\` FROM bills WHERE customer_id IN (${marks})`, customerIds);
  const [payments] = await connection.execute(`SELECT p.bill_id AS billId, CAST(p.amount AS CHAR) AS amount,
    DATE_FORMAT(CONVERT_TZ(p.paid_at, '+00:00', '+08:00'), '%Y-%m-%d') AS day
    FROM payments p JOIN bills b ON b.id = p.bill_id WHERE b.customer_id IN (${marks})`, customerIds);
  const [assessments] = await connection.execute(`SELECT f.id, f.source_bill_id AS sourceBillId,
    b.id AS chargedBillId, DATE_FORMAT(f.through_date, '%Y-%m-%d') AS through,
    CAST(f.amount AS CHAR) AS amount FROM late_fee_assessments f
    JOIN bills b ON b.meter_entry_id = f.meter_entry_id
    WHERE b.customer_id IN (${marks}) ORDER BY f.id`, customerIds);
  return { bills, payments, assessments };
}

export function customerLateFee(data, customerId, asOf = today()) {
  const bills = data.bills.filter((bill) => String(bill.customerId) === String(customerId));
  const ids = new Set(bills.map((bill) => String(bill.id)));
  return suggestLateFee({ bills, payments: data.payments.filter((p) => ids.has(String(p.billId))),
    assessments: data.assessments.filter((item) => ids.has(String(item.sourceBillId))) }, asOf);
}

export async function recordLateFee(entry, customerId, connection) {
  const basis = typeof entry.lateFeeBasis === 'string' ? JSON.parse(entry.lateFeeBasis) : entry.lateFeeBasis || [];
  if (!basis.length) return;
  const expected = basis.reduce((sum, item) => sum + scaled(item.amount, 2), 0n);
  let remaining = scaled(entry.late, 2);
  for (const [index, item] of basis.entries()) {
    const [rows] = await connection.execute(`SELECT DATE_FORMAT(COALESCE(MAX(f.through_date), b.due_date), '%Y-%m-%d') AS through
      FROM bills b LEFT JOIN late_fee_assessments f ON f.source_bill_id = b.id
      WHERE b.id = ? AND b.customer_id = ? GROUP BY b.id, b.due_date`, [item.sourceBillId, customerId]);
    if (!rows[0] || rows[0].through !== item.previousThrough)
      throw new AppError('Late-fee periods changed. Reload and save the meter entry again.', 409);
    const amount = index === basis.length - 1 ? remaining :
      expected ? scaled(entry.late, 2) * scaled(item.amount, 2) / expected : 0n;
    remaining -= amount;
    await connection.execute(`INSERT INTO late_fee_assessments
      (source_bill_id, meter_entry_id, through_date, amount) VALUES (?, ?, ?, ?)`,
    [item.sourceBillId, entry.id, item.through, feeMoney(amount)]);
  }
}
