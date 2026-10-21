import { readDashboard } from '../models/dashboard.model.js';
import { today } from '../validators/customer.validator.js';

export function dashboardPeriod(day) {
  const months = Array.from({ length: 6 }, (_, index) =>
    new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 6 + index, 1))
      .toISOString()
      .slice(0, 7),
  );
  const end = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 1))
    .toISOString()
    .slice(0, 10);
  return { day, month: day.slice(0, 7), months, start: months[0] + '-01', end };
}

export function createDashboardService({ read = readDashboard, date = today } = {}) {
  return async function getDashboard() {
    const period = dashboardPeriod(date());
    const data = await read(period);
    const summary = { ...data.customers, ...data.areas, ...data.billing, ...data.payments };
    for (const key of [
      'totalCustomers',
      'registeredCustomers',
      'barangays',
      'activeBarangays',
      'bills',
      'unpaidBills',
      'paid',
      'unpaid',
      'overdue',
    ])
      summary[key] = Number(summary[key]);
    for (const key of ['outstanding', 'totalCollections', 'todayCollections', 'monthCollections'])
      summary[key] = String(summary[key]);
    const values = new Map(data.collections.map((row) => [row.month, String(row.amount)]));
    return {
      asOf: period.day,
      period: { months: period.months, from: period.start, through: period.day },
      summary,
      monthlyCollections: period.months.map((month) => ({
        month,
        amount: values.get(month) || '0.00',
      })),
      billStatuses: [
        { status: 'Paid', count: summary.paid },
        { status: 'Unpaid', count: summary.unpaid },
        { status: 'Overdue', count: summary.overdue },
      ],
      barangayConsumption: data.consumption.map((row) => ({
        barangayId: String(row.barangayId),
        barangay: row.barangay,
        volume: String(row.volume),
      })),
    };
  };
}
export const getDashboard = createDashboardService();
