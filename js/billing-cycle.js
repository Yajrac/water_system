// Select a working billing cycle, or return to the current month.
const cycleForm = document.getElementById('cycleForm');
const cycleMonth = cycleForm.elements.month;
const cycleYear = cycleForm.elements.year;
const currentYear = WaterStore.today().slice(0, 4);
const availableYears = new Set([currentYear, ...WaterStore.load().bills.map(bill => bill.cycle.slice(0, 4))]);
[...availableYears].sort().reverse().forEach(year => {
  const option = new Option(year === currentYear ? year : year + ' (historical)', year);
  option.disabled = year !== currentYear;
  cycleYear.add(option);
});
['January','February','March','April','May','June','July','August','September','October','November','December'].forEach((month, index) => {
  cycleMonth.add(new Option(month, String(index + 1).padStart(2, '0')));
});
function updateCycleMonths() {
  Array.from(cycleMonth.options).forEach(option => {
    const cycle = cycleYear.value + '-' + option.value;
    option.disabled = cycle > WaterStore.today().slice(0, 7);
  });
}
cycleYear.addEventListener('change', updateCycleMonths);

function showBillingPeriod() {
  const records = WaterStore.load();
  const period = WaterStore.billingPeriod(records);
  WaterStore.save(records);
  const selected = period.active || WaterStore.today().slice(0, 7);
  cycleYear.value = currentYear;
  cycleMonth.value = selected.slice(5, 7);
  updateCycleMonths();
  document.getElementById('periodSummary').textContent = period.active ? 'Active cycle: ' + period.active : 'No active billing cycle. Open the next cycle before generating bills.';
  document.getElementById('closedCycles').textContent = period.closed.length ? 'Previously closed: ' + period.closed.slice().sort().join(', ') + '. Select a month and choose Open to reopen it.' : '';
  document.getElementById('backToCurrentMonth').disabled = period.active === WaterStore.today().slice(0, 7);
}
cycleForm.addEventListener('submit', async event => {
  event.preventDefault();
  const records = WaterStore.load();
  const period = WaterStore.billingPeriod(records);
  const cycle = cycleYear.value + '-' + cycleMonth.value;
  const today = WaterStore.today();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(cycle) || cycle.slice(0, 4) !== today.slice(0, 4) || cycle > today.slice(0, 7)) return AdminUI.message('Choose a billing month within the current year, up to the current month.');
  if (period.active === cycle && !period.closed.includes(cycle)) return AdminUI.message('This billing cycle is already open.');
  const reopening = period.closed.includes(cycle);
  const accepted = await confirmAction(reopening ? 'Reopen billing cycle?' : 'Open billing cycle?', 'Selected cycle: ' + cycle + '\n\nThis becomes the working cycle. Existing bills, payments and meter readings remain unchanged. Duplicate bills are still blocked.', reopening ? 'Reopen cycle' : 'Open cycle');
  if (!accepted) return;
  if (JSON.stringify(WaterStore.load()) !== JSON.stringify(records) || WaterStore.today() !== today) return AdminUI.message('Records or dates changed. Review the selected cycle and try again.');
  period.active = cycle;
  period.closed = period.closed.filter(closed => closed !== cycle);
  WaterStore.save(records);
  Object.assign(billingRecords, records);
  showBillingPeriod();
  location.reload();
});
document.getElementById('backToCurrentMonth').addEventListener('click', () => {
  const records = WaterStore.load();
  const period = WaterStore.billingPeriod(records);
  const current = WaterStore.today().slice(0, 7);
  period.active = current;
  period.closed = period.closed.filter(closed => closed !== current);
  WaterStore.save(records);
  Object.assign(billingRecords, records);
  showBillingPeriod();
  location.reload();
});
showBillingPeriod();
