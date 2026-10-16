// One local record shared by the admin pages. No server or login is connected yet.
const WaterStore = {
  key: 'pio-duran-admin-v1',
  barangays: ['Brgy 1', 'Brgy 2', 'Brgy 3', 'Brgy 4', 'Brgy 5', 'Caratagan', 'Banawan'],
  normalizeBarangay(value) {
    const cleaned = value
      .trim()
      .toLowerCase()
      .replace(/^barangay\s*/, 'brgy ')
      .replace(/^brgy\.?\s*/, 'brgy ');
    return this.barangays.find((barangay) => barangay.toLowerCase() === cleaned) || value.trim();
  },
  load() {
    const saved = localStorage.getItem(this.key);
    if (saved) return JSON.parse(saved);
    return {
      customers: [],
      bills: [],
      payments: [],
      notices: [],
      rates: { tiers: [8.5, 11, 14.5, 18], monthly: 75, connection: 1500, reconnection: 250 },
      office: { name: 'Pio Duran Water Supply', address: '', contact: '' },
    };
  },
  save(records) {
    localStorage.setItem(this.key, JSON.stringify(records));
  },
  billingPeriod(records) {
    if (!records.billingPeriod)
      records.billingPeriod = { active: this.today().slice(0, 7), closed: [] };
    return records.billingPeriod;
  },
  cycleError(records, cycle) {
    const today = this.today();
    const period = this.billingPeriod(records);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(cycle)) return 'Choose a valid billing month.';
    if (cycle.slice(0, 4) !== today.slice(0, 4))
      return 'New bills can only be generated for the current year.';
    if (cycle > today.slice(0, 7)) return 'Future billing cycles are not open yet.';
    if (period.closed.includes(cycle))
      return 'This billing period was closed. Select it in Billing cycle management and choose Open to reopen it.';
    if (period.active !== cycle)
      return 'Generate bills only for the active cycle. Manage it on the Meter Entry page.';
    return '';
  },
  id() {
    return crypto.randomUUID();
  },
  nextReference(records, prefix, field, collection = 'customers') {
    const referencePrefix = prefix + '-' + this.today().slice(0, 4) + '-';
    records.sequences = records.sequences || {};
    let last = records.sequences[referencePrefix] || 0;
    records[collection].forEach((record) => {
      const reference = record[field] || '';
      if (!reference.startsWith(referencePrefix)) return;
      const suffix = reference.slice(referencePrefix.length);
      if (/^\d+$/.test(suffix)) last = Math.max(last, Number(suffix));
    });
    records.sequences[referencePrefix] = last + 1;
    return referencePrefix + String(last + 1).padStart(5, '0');
  },
  isRegistered(customer) {
    if (customer.registrationStatus) return customer.registrationStatus === 'Registered';
    return ['Approved', 'Installed'].includes(customer.serviceStatus);
  },
  isActive(customer) {
    return customer.active !== false;
  },
  money(value) {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
  },
  balance(bill, records) {
    const paid = records.payments.reduce(
      (total, payment) => total + this.paymentForBill(payment, bill.id),
      0,
    );
    return Math.max(0, Math.round((bill.total - paid) * 100) / 100);
  },
  paymentForBill(payment, billId) {
    if (Array.isArray(payment.allocations))
      return payment.allocations
        .filter((item) => item.billId === billId)
        .reduce((sum, item) => sum + item.amount, 0);
    return payment.billId === billId ? payment.amount : 0;
  },
  allocatePayment(bills, amount, records) {
    let remaining = Math.round(amount * 100);
    const allocations = [];
    bills
      .slice()
      .sort((a, b) => a.cycle.localeCompare(b.cycle) || a.due.localeCompare(b.due))
      .forEach((bill) => {
        const balance = Math.round(this.balance(bill, records) * 100);
        const applied = Math.min(remaining, balance);
        if (applied <= 0) return;
        allocations.push({
          billId: bill.id,
          cycle: bill.cycle,
          amount: applied / 100,
          balanceBefore: balance / 100,
          balanceAfter: (balance - applied) / 100,
          total: bill.total,
          previous: bill.previous,
          current: bill.current,
          consumption: bill.consumption,
        });
        remaining -= applied;
      });
    if (remaining) throw new Error('Payment exceeds the selected outstanding balance.');
    return allocations;
  },
  status(bill, records) {
    if (this.balance(bill, records) === 0) return 'Paid';
    return bill.due < this.today() ? 'Overdue' : 'Unpaid';
  },
  today() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  },
  consumptionCharge(consumption, tiers) {
    let remaining = consumption;
    let total = 0;
    tiers.forEach((rate, index) => {
      const amount = index === 3 ? remaining : Math.min(10, remaining);
      total += amount * rate;
      remaining -= amount;
    });
    return Math.round(total * 100) / 100;
  },
};
