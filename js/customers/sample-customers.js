// Read the local JSON like an API, keeping edits and existing records intact.
async function fetchSampleCustomers() {
  const response = await fetch('../data/sample-customers.json');
  if (!response.ok) throw new Error('Could not load sample customers (' + response.status + ').');
  const customers = await response.json();
  if (
    !Array.isArray(customers) ||
    customers.some(
      (customer) =>
        customer.isTestData !== true ||
        !customer.id ||
        !customer.account ||
        !customer.applicationNumber ||
        !customer.name ||
        !Number.isFinite(customer.reading),
    )
  )
    throw new Error('The sample customer file has an invalid format.');

  // Reload here so records saved while the request was running are preserved.
  const records = WaterStore.load();
  const ids = new Set(records.customers.map((customer) => customer.id));
  const accounts = new Set(records.customers.map((customer) => customer.account.toLowerCase()));
  const applications = new Set(
    records.customers.map((customer) => customer.applicationNumber?.toLowerCase()).filter(Boolean),
  );
  let added = 0;
  // Update only unchanged sample references already loaded in this browser.
  customers.forEach((sample) => {
    const existing = records.customers.find(customer => customer.id === sample.id && customer.isTestData);
    if (!existing || existing.account !== 'TEST-' + sample.account || accounts.has(sample.account.toLowerCase())) return;
    accounts.delete(existing.account.toLowerCase());
    existing.account = sample.account;
    accounts.add(existing.account.toLowerCase());
    added++;
  });
  customers.forEach((customer) => {
    if (
      ids.has(customer.id) ||
      accounts.has(customer.account.toLowerCase()) ||
      applications.has(customer.applicationNumber.toLowerCase())
    )
      return;
    const { sampleBills, samplePayments, ...details } = customer;
    records.customers.push(details);
    ids.add(customer.id);
    accounts.add(customer.account.toLowerCase());
    applications.add(customer.applicationNumber.toLowerCase());
    added++;
  });
  // Fixtures live in the JSON; existing customer edits and billing cycles win.
  customers.forEach((customer) => {
    if (!records.customers.some((item) => item.id === customer.id)) return;
    (customer.sampleBills || []).forEach((bill) => {
      if (
        !bill.isTestData ||
        bill.customerId !== customer.id ||
        !Number.isFinite(bill.total) ||
        bill.total < 0 ||
        bill.current - bill.previous !== bill.consumption
      )
        return;
      if (
        records.bills.some(
          (item) =>
            item.id === bill.id ||
            (item.customerId === bill.customerId && item.cycle === bill.cycle),
        )
      )
        return;
      records.bills.push(bill);
      added++;
    });
    (customer.samplePayments || []).forEach((payment) => {
      const bill = records.bills.find(
        (item) => item.id === payment.billId && item.customerId === customer.id && item.isTestData,
      );
      if (
        !bill ||
        !payment.isTestData ||
        payment.customerId !== customer.id ||
        !Number.isFinite(payment.amount) ||
        payment.amount <= 0 ||
        payment.amount > bill.total
      )
        return;
      if (
        records.payments.some(
          (item) =>
            item.id === payment.id || item.receipt === payment.receipt || item.billId === bill.id,
        )
      )
        return;
      records.payments.push(payment);
      added++;
    });
  });
  if (added) WaterStore.save(records);
  return records;
}
