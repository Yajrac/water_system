// Monthly progress for active registered customers.
function billingProgress(records, cycle) {
  const customers = records.customers.filter(
    (customer) => WaterStore.isRegistered(customer) && WaterStore.isActive(customer),
  );
  const billed = customers.filter((customer) =>
    records.bills.some((bill) => bill.customerId === customer.id && bill.cycle === cycle),
  ).length;
  return { total: customers.length, billed, remaining: customers.length - billed };
}
function updateBillingProgress() {
  const records = WaterStore.load();
  const cycle = WaterStore.billingPeriod(records).active;
  const progress = billingProgress(records, cycle);
  document.getElementById('billingProgress').textContent =
    progress.billed + ' of ' + progress.total + ' customers billed';
  const bar = document.getElementById('billingProgressBar');
  bar.max = progress.total || 1;
  bar.value = progress.billed;
}
updateBillingProgress();
