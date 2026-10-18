export const customer = {
  name: 'Ana Reyes',
  account: 'PWSS-00001',
  submitter: 'PWSS-20260401-000001',
  address: 'Purok 1, Barangay 1, Pio Duran, Albay',
  contact: '+639990000001',
  meter: 'MTR-00001',
  status: 'Active',
};

export const demoLogin = { username: 'ana.reyes', password: 'AnaDemo123!' };

export const bills = [
  {
    id: 'oct',
    month: 'October 2026',
    previous: 100,
    current: 125,
    rate: 4,
    total: 100,
    paid: 0,
    due: 'October 31, 2026',
  },
  {
    id: 'sep',
    month: 'September 2026',
    previous: 78,
    current: 100,
    rate: 4,
    total: 88,
    paid: 88,
    due: 'September 30, 2026',
  },
  {
    id: 'aug',
    month: 'August 2026',
    previous: 58,
    current: 78,
    rate: 4,
    total: 80,
    paid: 80,
    due: 'August 31, 2026',
  },
];

export const payments = [
  {
    receipt: 'RCP-2026-00002',
    month: 'September 2026',
    amount: 88,
    date: 'September 27, 2026',
    billId: 'sep',
  },
  {
    receipt: 'RCP-2026-00001',
    month: 'August 2026',
    amount: 80,
    date: 'August 28, 2026',
    billId: 'aug',
  },
];

export const announcements = [
  {
    id: '1',
    category: 'Maintenance',
    title: 'Scheduled water interruption',
    date: 'October 20, 2026',
    body: 'Maintenance in Barangay 1 from 9:00 AM to 12:00 PM. Please store enough water ahead of the scheduled work.',
  },
  {
    id: '2',
    category: 'Reminder',
    title: 'October billing reminder',
    date: 'October 19, 2026',
    body: 'Please review your monthly bill and settle payments at the PWSS office on or before the due date. Keep your receipt for reference.',
  },
];
