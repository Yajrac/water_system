import { pool } from '../database/pool.js';
import { scaled } from '../utils/decimal.js';
import { today } from '../validators/customer.validator.js';
import { AppError } from '../utils/app-error.js';

const numberOfDay = (day) => Date.parse(day + 'T00:00:00Z') / 86400000;
const dateOfDay = (day) => new Date(day * 86400000).toISOString().slice(0, 10);
export const lateFeeMoney = (value) => `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
const maxFee = 999999999999n;
const maxTotal = 999999999999999n;

// First period starts at midnight in the Philippines after the due date.
// Later periods start every seven days. Catch-up uses payments made BEFORE
// each boundary, not today's aggregate, so a later payment cannot erase a fee.
export function automaticLateFeePlan(bill, payments, asOf = today()) {
  let total = scaled(bill.total, 2);
  let late = scaled(bill.late, 2);
  const paid = payments.reduce((sum, payment) => sum + scaled(payment.amount, 2), 0n);
  const events = [];
  // Existing fully settled bills are never reopened by this policy change.
  if (paid >= total) return { events, total: bill.total, late: bill.late, next: bill.next };
  const first = numberOfDay(bill.due) + 1;
  let next = bill.next ? numberOfDay(bill.next) : first;
  if (!bill.next && bill.legacyThrough) {
    // Prior approved/carried or waived periods remain covered; no double charge.
    next = first + Math.max(0, Math.floor((numberOfDay(bill.legacyThrough) - first) / 7) + 1) * 7;
  }
  for (; next <= numberOfDay(asOf); next += 7) {
    const day = dateOfDay(next);
    const paidBefore = payments.filter((payment) => payment.day < day)
      .reduce((sum, payment) => sum + scaled(payment.amount, 2), 0n);
    const balance = total > paidBefore ? total - paidBefore : 0n;
    const amount = (balance + 5n) / 10n;
    if (late + amount > maxFee || total + amount > maxTotal)
      throw new AppError('Automatic late fee exceeds the supported amount. Review this bill.', 409);
    events.push({ day, balance: lateFeeMoney(balance), amount: lateFeeMoney(amount) });
    total += amount;
    late += amount;
  }
  return { events, total: lateFeeMoney(total), late: lateFeeMoney(late), next: dateOfDay(next) };
}

export function createAutomaticLateFees({ database = pool, date = today } = {}) {
  async function accrueBill(id, asOf = date()) {
    const connection = await database.getConnection();
    try {
      await connection.beginTransaction();
      const [[bill]] = await connection.execute(`SELECT id,
        CAST(total_amount AS CHAR) AS total, CAST(late_fee AS CHAR) AS late,
        DATE_FORMAT(due_date, '%Y-%m-%d') AS due,
        DATE_FORMAT(late_fee_next_on, '%Y-%m-%d') AS \`next\`
        FROM bills WHERE id = ? FOR UPDATE`, [id]);
      if (!bill || bill.due >= asOf || (bill.next && bill.next > asOf)) {
        await connection.commit();
        return { changed: false, day: asOf };
      }
      const [payments] = await connection.execute(`SELECT CAST(amount AS CHAR) AS amount,
        DATE_FORMAT(CONVERT_TZ(paid_at, '+00:00', '+08:00'), '%Y-%m-%d') AS day
        FROM payments WHERE bill_id = ? ORDER BY id FOR UPDATE`, [id]);
      if (!bill.next) {
        const [[prior]] = await connection.execute(`SELECT DATE_FORMAT(MAX(through_date), '%Y-%m-%d') AS through
          FROM late_fee_assessments WHERE source_bill_id = ?`, [id]);
        bill.legacyThrough = prior.through;
      }
      const plan = automaticLateFeePlan(bill, payments, asOf);
      for (const event of plan.events) {
        await connection.execute(`INSERT INTO bill_late_fee_events
          (bill_id, assessed_on, balance_before, amount) VALUES (?, ?, ?, ?)`,
        [id, event.day, event.balance, event.amount]);
      }
      if (plan.events.length) {
        await connection.execute(`UPDATE bills SET late_fee = ?, total_amount = ?, late_fee_next_on = ? WHERE id = ?`,
          [plan.late, plan.total, plan.next, id]);
      }
      await connection.commit();
      return { changed: plan.events.length > 0, day: asOf };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }

  async function accrueDue({ userId } = {}) {
    const day = date();
    let cursor = '0';
    for (;;) {
      const values = [cursor, day, day];
      if (userId) values.push(userId);
      const [bills] = await database.execute(`SELECT b.id FROM bills b
        JOIN customers c ON c.id = b.customer_id
        WHERE b.id > ? AND b.due_date < ? AND (b.late_fee_next_on IS NULL OR b.late_fee_next_on <= ?)
        AND b.total_amount > COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.bill_id = b.id), 0)
        ${userId ? 'AND c.user_id = ?' : ''} ORDER BY b.id LIMIT 100`, values);
      if (!bills.length) return;
      for (const bill of bills) await accrueBill(String(bill.id), day);
      cursor = String(bills.at(-1).id);
    }
  }
  return { accrueBill, accrueDue };
}
export const automaticLateFees = createAutomaticLateFees();

export function startAutomaticLateFeeWorker({ fees = automaticLateFees, interval = 60000, log = console.error } = {}) {
  let pending = false;
  async function tick() {
    if (pending) return;
    pending = true;
    try { await fees.accrueDue(); }
    catch (error) { log('Automatic late fees failed:', error.code || error.message); }
    finally { pending = false; }
  }
  const timer = setInterval(tick, interval);
  timer.unref?.();
  void tick();
  return () => clearInterval(timer);
}
