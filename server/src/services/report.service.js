import { pool } from '../database/pool.js';
import { listBills } from '../models/bill.model.js';
import { validateBillQuery } from '../validators/bill.validator.js';
import { scaled } from '../utils/decimal.js';
import { today } from '../validators/customer.validator.js';

const fixed = (value, scale) => {
  const unit = 10n ** BigInt(scale);
  return `${value / unit}.${String(value % unit).padStart(scale, '0')}`;
};

export function summarizeReport(bills) {
  const groups = new Map();
  let total = 0n,
    balance = 0n;
  for (const bill of bills) {
    total += scaled(bill.total, 2);
    balance += scaled(bill.balance, 2);
    const key = String(bill.barangayId);
    if (!groups.has(key))
      groups.set(key, {
        barangay: bill.barangay,
        customers: new Set(),
        volume: 0n,
      });
    const group = groups.get(key);
    group.customers.add(String(bill.customerId));
    group.volume += scaled(bill.consumption, 3);
  }
  return {
    summary: {
      bills: bills.length,
      total: fixed(total, 2),
      paid: fixed(total - balance, 2),
      balance: fixed(balance, 2),
    },
    consumption: [...groups.values()]
      .sort((a, b) =>
        a.volume === b.volume ? a.barangay.localeCompare(b.barangay) : a.volume > b.volume ? -1 : 1,
      )
      .map((group) => ({
        barangay: group.barangay,
        accounts: group.customers.size,
        volume: fixed(group.volume, 3),
        average: fixed(
          (group.volume + BigInt(Math.floor(group.customers.size / 2))) /
            BigInt(group.customers.size),
          3,
        ),
      })),
  };
}

export async function readReport(query) {
  const filters = validateBillQuery(query);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { bills } = await listBills(filters, connection, { all: true });
    const data = {
      asOf: today(),
      bills: bills.map((bill) => ({
        ...bill,
        paid: fixed(scaled(bill.total, 2) - scaled(bill.balance, 2), 2),
      })),
      ...summarizeReport(bills),
    };
    await connection.commit();
    return data;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
