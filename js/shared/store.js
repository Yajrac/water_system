// One local record shared by the admin pages. No server or login is connected yet.
const WaterStore = {
  key: 'pio-duran-admin-v1',
  get barangays() {
    return this.barangayRegistry(this.load()).map((barangay) => barangay.name);
  },
  barangayRegistry(records) {
    if (!Array.isArray(records.barangays)) {
      records.barangays = [
        ['Brgy 1', '0500513023'],
        ['Brgy 2', '0500513024'],
        ['Brgy 3', '0500513025'],
        ['Brgy 4', '0500513026'],
        ['Brgy 5', '0500513027'],
        ['Caratagan', '0500513009'],
        ['Banawan', '0500513005'],
      ].map(([name, code]) => ({ name, code, municipality: 'Pio Duran', province: 'Albay' }));
    }
    records.barangays.forEach((entry) => {
      entry.name = this.normalizeBarangay(entry.name);
    });
    return records.barangays;
  },
  normalizeBarangay(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    let name = raw.replace(/^(?:barangay|brgy\.?)\s+/i, '').trim();
    const roman = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };
    name = roman[name.toLowerCase()] || name;
    name = String(name).replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
    return 'Barangay ' + name;
  },
  load() {
    const saved = localStorage.getItem(this.key);
    if (saved) {
      const records = JSON.parse(saved);
      records.rates = this.currentRates(records.rates);
      if (Array.isArray(records.barangays)) this.barangayRegistry(records);
      records.customers.forEach((customer) => {
        customer.barangay = this.normalizeBarangay(customer.barangay);
      });
      return records;
    }
    return {
      customers: [],
      bills: [],
      payments: [],
      notices: [],
      rates: this.currentRates(),
      office: { name: 'Pio Duran Water Supply', address: '', contact: '' },
    };
  },
  currentRates(existing = {}) {
    if (existing.version === 2) return existing;
    // Replace provisional tariffs for future billing only; retain historical records.
    return {
      version: 2,
      residential: { minimum: 70, tiers: [8, 8.5, 9, 9.5], above50: null },
      commercial: { minimum: 100, tiers: [12, 13, 14, 15], above50: null },
      monthly: 0,
      connection: existing.connection ?? 1500,
      reconnection: existing.reconnection ?? 250,
    };
  },
  save(records) {
    const previous = this.load();
    const changes = this.activityChanges(previous, records);
    const activityLogs = [...(previous.activityLogs || []), ...changes];
    // Store the records and their log entries together: failed saves produce no success log.
    localStorage.setItem(this.key, JSON.stringify({ ...records, activityLogs }));
    records.activityLogs = activityLogs;
  },
  activityChanges(previous, records) {
    const changes = [];
    const add = (action, target, details) =>
      changes.push({
        id: this.id(),
        timestamp: new Date().toISOString(),
        actor: 'Administrator',
        action,
        target: String(target || ''),
        details,
      });
    const collections = [
      ['customers', 'Customer'],
      ['bills', 'Bill'],
      ['payments', 'Payment'],
      ['barangays', 'Barangay'],
      ['feedback', 'Feedback'],
      ['notices', 'Announcement'],
      ['disconnections', 'Disconnection'],
    ];
    collections.forEach(([key, label]) => {
      const before = previous[key] || [];
      const after = records[key] || [];
      const identity = (item) => item.id || item.code || item.name;
      after.forEach((item) => {
        const old = before.find((entry) => identity(entry) === identity(item));
        if (JSON.stringify(old) === JSON.stringify(item) || (!old && item.isTestData)) return;
        const customer = records.customers.find((entry) => entry.id === item.customerId);
        const target =
          item.account || customer?.account || item.name || item.receipt || identity(item);
        let action = label + (old ? ' updated' : ' added');
        let details = item.receipt || item.cycle || item.name || label;
        if (key === 'customers' && old && this.isActive(old) !== this.isActive(item))
          action = this.isActive(item) ? 'Customer activated' : 'Customer deactivated';
        if (key === 'bills' && !old) action = 'Bill generated';
        if (key === 'payments' && !old) {
          action = 'Payment recorded';
          details = (item.receipt || '') + ' - ' + this.money(item.amount);
        }
        if (key === 'feedback' && old && (item.replies || []).length > (old.replies || []).length)
          action = 'Feedback reply added';
        add(action, target, details);
      });
      before
        .filter((item) => !after.some((entry) => identity(entry) === identity(item)))
        .forEach((item) =>
          add(label + ' removed', item.account || item.name || identity(item), label),
        );
    });
    if (JSON.stringify(previous.office) !== JSON.stringify(records.office))
      add('Office settings updated', records.office?.name, 'Office details changed');
    Object.entries(records.billingSetups || {}).forEach(([month, setups]) => {
      Object.entries(setups).forEach(([barangay, setup]) => {
        if (JSON.stringify(previous.billingSetups?.[month]?.[barangay]) !== JSON.stringify(setup))
          add(
            'Billing setup saved',
            barangay,
            month + ' - ' + this.money(setup.rate) + ' / m\u00b3',
          );
      });
    });
    return changes;
  },
  flatBillingSetup(records, cycle, barangay) {
    return records.billingSetups?.[cycle]?.[this.normalizeBarangay(barangay)] || null;
  },
  flatWaterCharge(consumption, rate) {
    if (!Number.isFinite(consumption) || consumption < 0 || !Number.isFinite(rate) || rate <= 0)
      throw new Error('Enter valid consumption and a positive rate per cubic meter.');
    const total = Math.round(consumption * rate * 100) / 100;
    if (!Number.isSafeInteger(Math.round(total * 100)))
      throw new Error('The water charge is too large.');
    return total;
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
      return 'This billing month is closed. Use Manage period to reopen it.';
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
    return customer.active !== false && customer.connectionStatus !== 'Disconnected';
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
          ratePerCubic: bill.ratePerCubic,
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
  consumptionCharge(consumption, customerType, rates) {
    if (!Number.isFinite(consumption) || consumption < 0)
      throw new Error('Enter a valid non-negative consumption.');
    if (!['Residential', 'Commercial'].includes(customerType))
      throw new Error('Select Residential or Commercial in the customer profile before billing.');
    const schedule = rates[customerType.toLowerCase()];
    if (
      !schedule ||
      !Number.isFinite(schedule.minimum) ||
      schedule.minimum < 0 ||
      !Array.isArray(schedule.tiers) ||
      schedule.tiers.length !== 4 ||
      schedule.tiers.some((rate) => !Number.isFinite(rate) || rate < 0)
    )
      throw new Error('The water rate configuration is invalid. Review Rates & Fees.');
    if (consumption > 50 && (!Number.isFinite(schedule.above50) || schedule.above50 < 0))
      throw new Error(
        customerType + ' consumption above 50 m³ needs a confirmed rate. No bills were generated.',
      );
    let remaining = Math.max(0, consumption - 10);
    let total = schedule.minimum;
    schedule.tiers.forEach((rate) => {
      const amount = Math.min(10, remaining);
      total += amount * rate;
      remaining -= amount;
    });
    if (remaining > 0) total += remaining * schedule.above50;
    return Math.round(total * 100) / 100;
  },
};
