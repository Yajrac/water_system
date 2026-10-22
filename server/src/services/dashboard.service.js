import { readDashboard } from '../models/dashboard.model.js';
import { AppError } from '../utils/app-error.js';
import { today } from '../validators/customer.validator.js';

export function dashboardPeriod(day, selectedYear) {
  const currentYear = Number(day.slice(0, 4));
  if (
    selectedYear !== undefined &&
    (typeof selectedYear !== 'string' ||
      !/^\d{4}$/.test(selectedYear) ||
      Number(selectedYear) < 1900 ||
      Number(selectedYear) > currentYear)
  )
    throw new AppError('Choose a valid collection year.', 400);
  const year = selectedYear === undefined ? currentYear : Number(selectedYear);
  const months = Array.from(
    { length: 12 },
    (_, index) => year + '-' + String(index + 1).padStart(2, '0'),
  );
  const monthEnd = new Date(Date.UTC(currentYear, Number(day.slice(5, 7)), 1))
    .toISOString()
    .slice(0, 10);
  const consumptionStart = new Date(Date.UTC(currentYear, Number(day.slice(5, 7)) - 6, 1))
    .toISOString()
    .slice(0, 10);
  return {
    day,
    month: day.slice(0, 7),
    year,
    currentYear,
    months,
    start: year + '-01-01',
    end: year + 1 + '-01-01',
    monthEnd,
    consumptionStart,
  };
}

export function createDashboardService({ read = readDashboard, date = today } = {}) {
  return async function getDashboard(query = {}) {
    const period = dashboardPeriod(date(), query.year);
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
      period: {
        year: period.year,
        months: period.months,
        from: period.start,
        through: period.year === period.currentYear ? period.day : period.year + '-12-31',
      },
      currentYear: period.currentYear,
      availableYears: [
        ...new Set([
          period.currentYear,
          period.year,
          ...(data.years || []).map((row) => Number(row.year)),
        ]),
      ].sort((a, b) => b - a),
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
