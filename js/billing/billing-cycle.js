// Period controls share the Monthly Billing card. No unrestricted month picker.
function adjacentBillingMonth(cycle, offset) {
  const date = new Date(cycle + '-01T00:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
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
  const next = adjacentBillingMonth(cycle, 1);
  const previous = adjacentBillingMonth(cycle, -1);
  const current = WaterStore.today().slice(0, 7);
  document.getElementById('nextBillingMonth').disabled = next > current;
  document.getElementById('reopenBillingMonth').disabled =
    previous.slice(0, 4) !== current.slice(0, 4);
  document.getElementById('periodAvailability').textContent =
    next > current
      ? 'Next month becomes available in ' + next + '.'
      : 'Next available month: ' + next;
}
let changingBillingPeriod = false;
async function changeBillingPeriod(reopen) {
  if (changingBillingPeriod) return;
  changingBillingPeriod = true;
  try {
    const records = WaterStore.load();
    const period = WaterStore.billingPeriod(records);
    const today = WaterStore.today();
    const target = adjacentBillingMonth(period.active, reopen ? -1 : 1);
    if (target > today.slice(0, 7) || target.slice(0, 4) !== today.slice(0, 4)) {
      await showNotice(
        'Month unavailable',
        'Billing can only be opened within the current year, up to the current month.',
      );
      return;
    }
    const progress = billingProgress(records, period.active);
    const draft = sessionStorage.getItem('pio-duran-meter-drafts-' + period.active);
    let hasDraft = false;
    try {
      hasDraft = Object.values(JSON.parse(draft)?.readings || {}).some(
        (item) => item.current !== '',
      );
    } catch {
      /* Invalid drafts are handled on the meter page. */
    }
    let preview = null;
    let reason;
    if (reopen) {
      preview = document.createElement('label');
      preview.className = 'period-reason';
      preview.textContent = 'Reason for reopening *';
      reason = document.createElement('textarea');
      reason.rows = 3;
      reason.maxLength = 300;
      reason.required = true;
      reason.placeholder = 'Explain the correction or missing billing entry';
      preview.appendChild(reason);
    }
    const accepted = await confirmAction(
      reopen ? 'Reopen previous cycle?' : 'Move to next month?',
      'Current month: ' +
        period.active +
        '\nSelected month: ' +
        target +
        (progress.remaining
          ? '\n\n' + progress.remaining + ' customers still have no bill for the current period.'
          : '') +
        (hasDraft
          ? '\nUnfinished readings will stay in this month and will not move to the other period.'
          : '') +
        '\n\nExisting bills and payments are kept. Duplicate bills remain blocked.',
      reopen ? 'Reopen period' : 'Move to next month',
      preview,
    );
    if (!accepted) return;
    const explanation = reason ? reason.value.trim() : '';
    if (reopen && (!explanation || explanation.length > 300 || /[<>]/.test(explanation))) {
      await showNotice(
        'Reason required',
        'Enter a reason of 1?300 characters without HTML tags before reopening a period.',
      );
      return;
    }
    if (
      WaterStore.today() !== today ||
      JSON.stringify(WaterStore.load()) !== JSON.stringify(records)
    ) {
      AdminUI.message('Records or dates changed. Review the period and try again.');
      return;
    }
    const previousActive = period.active;
    if (!reopen && !period.closed.includes(previousActive)) period.closed.push(previousActive);
    period.active = target;
    period.closed = period.closed.filter((month) => month !== target);
    period.history = period.history || [];
    period.history.push({
      date: today,
      from: previousActive,
      to: target,
      action: reopen ? 'reopen' : 'advance',
      reason: explanation,
    });
    WaterStore.save(records);
    location.reload();
  } catch {
    AdminUI.message('The billing period could not be changed. Please try again.');
  } finally {
    changingBillingPeriod = false;
  }
}
document
  .getElementById('nextBillingMonth')
  .addEventListener('click', () => changeBillingPeriod(false));
document
  .getElementById('reopenBillingMonth')
  .addEventListener('click', () => changeBillingPeriod(true));
const periodMenu = document.querySelector('.period-menu');
document.addEventListener('click', (event) => {
  if (!periodMenu.contains(event.target)) periodMenu.open = false;
});
periodMenu.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    periodMenu.open = false;
    periodMenu.querySelector('summary').focus();
  }
});
updateBillingProgress();
