// Import fictional service records once; preserve subsequent edits/reconnections.
async function fetchSampleServiceRecords() {
  await fetchSampleCustomers();
  const response = await fetch('../data/sample-service-records.json');
  if (!response.ok) throw new Error('Sample service records could not be loaded.');
  const data = await response.json();
  if (
    data.isTestData !== true ||
    !Array.isArray(data.disconnections) ||
    !Array.isArray(data.feedback)
  )
    throw new Error('Sample service data has an invalid format.');
  const records = WaterStore.load();
  records.disconnections = records.disconnections || [];
  records.feedback = records.feedback || [];
  records.sampleServiceImports = records.sampleServiceImports || [];
  let changed = false;
  const validDate = (value) => Validation.date(value) && value <= WaterStore.today();
  data.disconnections.forEach((entry) => {
    if (
      !entry.isTestData ||
      !entry.id ||
      !validDate(entry.disconnectedOn) ||
      !entry.reason ||
      (entry.reconnectedOn &&
        (!validDate(entry.reconnectedOn) || entry.reconnectedOn < entry.disconnectedOn))
    )
      return;
    if (
      records.sampleServiceImports.includes(entry.id) ||
      records.disconnections.some((item) => item.id === entry.id)
    )
      return;
    const customer = records.customers.find(
      (item) => item.id === entry.customerId && item.isTestData,
    );
    if (!customer || !WaterStore.isRegistered(customer)) return;
    if (!entry.reconnectedOn) {
      if (
        !WaterStore.isActive(customer) ||
        records.disconnections.some(
          (item) => item.customerId === customer.id && !item.reconnectedOn,
        )
      )
        return;
      customer.active = false;
      customer.connectionStatus = 'Disconnected';
      customer.statusChangedOn = entry.disconnectedOn;
    }
    records.disconnections.push(entry);
    records.sampleServiceImports.push(entry.id);
    changed = true;
  });
  data.feedback.forEach((entry) => {
    if (
      !entry.isTestData ||
      !entry.id ||
      !validDate(entry.date) ||
      !['New', 'In progress', 'Resolved'].includes(entry.status) ||
      !['Billing', 'Water supply', 'Meter', 'Other'].includes(entry.category) ||
      !entry.message
    )
      return;
    if (
      !records.customers.some((customer) => customer.id === entry.customerId && customer.isTestData)
    )
      return;
    if (
      records.sampleServiceImports.includes(entry.id) ||
      records.feedback.some((item) => item.id === entry.id)
    )
      return;
    records.feedback.push(entry);
    records.sampleServiceImports.push(entry.id);
    changed = true;
  });
  if (changed) WaterStore.save(records);
  return records;
}
