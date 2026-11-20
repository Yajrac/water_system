const reportBarangay = document.getElementById('reportBarangay');
const reportCycle = document.getElementById('reportCycle');
const reportStatus = document.getElementById('reportStatus');
const reportSearch = document.getElementById('reportSearch');
const reportMessage = document.getElementById('pageMessage');
let consumptionReportRows = [];
let reportMatchedBills = [];
let reportReady = false;
let reportRequest = 0;
let reportTimer;
const accountReportPager = createPagination('accountReportPagination', showReport);
const consumptionReportPager = createPagination('consumptionReportPagination', showReport);

function showReport() {
  const body = document.getElementById('reportRows');
  const consumptionBody = document.getElementById('consumptionRows');
  body.replaceChildren();
  consumptionBody.replaceChildren();
  accountReportPager.update(reportMatchedBills.length);
  accountReportPager.items(reportMatchedBills).forEach(({ bill, customer, status }) => {
    const row = body.insertRow();
    AdminUI.customer(row, customer);
    const cycle = /^\d{4}-\d{2}$/.test(String(bill.cycle))
      ? new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(bill.cycle + '-01T00:00:00Z'))
      : bill.cycle;
    const cells = [
      globalThis.barangayLabel?.(customer.barangay) ?? customer.barangay,
      cycle,
      WaterStore.money(bill.total),
      WaterStore.money(bill.balance),
      status,
    ].map((value, index) =>
      AdminUI.cell(row, value, ['Barangay', 'Cycle', 'Total', 'Balance', 'Status'][index]),
    );
    // Balance red while owed, green once settled.
    cells[3].className = Number(bill.balance) > 0 ? 'report-balance-due' : 'report-balance-clear';
  });
  consumptionReportPager.update(consumptionReportRows.length);
  // Bars in the Total consumption column are scaled to the largest barangay.
  const largestVolume = Math.max(0, ...consumptionReportRows.map((values) => Number(values[2]) || 0));
  consumptionReportPager.items(consumptionReportRows).forEach((values) => {
    const row = consumptionBody.insertRow();
    const cells = values.map((value, index) =>
      AdminUI.cell(
        row,
        index === 0 ? globalThis.barangayLabel?.(value) ?? value : value,
        ['Barangay', 'Billed accounts', 'Total consumption', 'Average per billed account'][index],
      ),
    );
    cells[0].className = 'report-area-name';
    const volume = document.createElement('span');
    volume.className = 'report-volume';
    const bar = document.createElement('span');
    bar.className = 'report-volume-bar';
    const share = largestVolume ? Math.round(((Number(values[2]) || 0) / largestVolume) * 100) : 0;
    bar.setAttribute('style', '--share: ' + share + '%');
    bar.setAttribute('aria-hidden', 'true');
    const amount = document.createElement('strong');
    amount.textContent = values[2] + ' m³';
    volume.append(amount, bar);
    cells[2].replaceChildren(volume);
  });
  AdminUI.empty(
    body,
    6,
    reportReady ? 'No bills match the selected filters.' : 'Report not loaded.',
  );
  AdminUI.empty(
    consumptionBody,
    4,
    reportReady ? 'No consumption records match the selected filters.' : 'Report not loaded.',
  );
}

function clearReport() {
  reportReady = false;
  reportMatchedBills = [];
  consumptionReportRows = [];
  document.getElementById('printReport').disabled = true;
  document.getElementById('reportSummary').textContent = '';
  showReport();
}

async function loadReport() {
  const request = ++reportRequest;
  const refresh = document.getElementById('refreshReport');
  refresh.disabled = true;
  refresh.setAttribute('aria-busy', 'true');
  const icon = refresh.querySelector('i');
  icon?.classList.add('admin-refresh-spinning');
  reportMessage.textContent = 'Loading report...';
  const params = new URLSearchParams();
  if (reportSearch.value.trim()) params.set('search', reportSearch.value.trim());
  if (reportBarangay.value) params.set('barangayId', reportBarangay.value);
  if (reportCycle.value) params.set('month', reportCycle.value);
  if (reportStatus.value) params.set('status', reportStatus.value);
  try {
    const data = await AdminAPI.request('/reports?' + params);
    if (request !== reportRequest) return;
    reportMatchedBills = data.bills.map((bill) => ({ bill, customer: bill, status: bill.status }));
    consumptionReportRows = data.consumption.map((group) => [
      group.barangay,
      group.accounts,
      group.volume,
      group.average,
    ]);
    reportReady = true;
    accountReportPager.page = consumptionReportPager.page = 1;
    const summary = document.getElementById('reportSummary');
    summary.replaceChildren();
    for (const [label, value, description, iconName, tone] of [
      ['Bills', data.summary.bills, 'Bills in selected report', 'file-earmark-text', 'info'],
      ['Total', WaterStore.money(data.summary.total), 'Total billed amount', 'receipt', 'violet'],
      ['Paid', WaterStore.money(data.summary.paid), 'Payments toward these bills', 'cash-stack', 'success'],
      ['Outstanding', WaterStore.money(data.summary.balance), 'Remaining unpaid amount', 'wallet2',
        Number(data.summary.balance) > 0 ? 'danger' : 'success'],
    ]) {
      // Icon tile on the left, label / amount / caption on the right.
      const card = document.createElement('div'); card.className = 'record-card report-stat tone-' + tone;
      const tile = document.createElement('span'); tile.className = 'report-stat-icon';
      const icon = document.createElement('i'); icon.className = 'bi bi-' + iconName;
      icon.setAttribute('aria-hidden', 'true'); tile.appendChild(icon);
      const body = document.createElement('div'); body.className = 'report-stat-body';
      const heading = document.createElement('h3'); heading.textContent = label;
      const amount = document.createElement('strong'); amount.textContent = value;
      if (label !== 'Bills') amount.className = 'money-value';
      const caption = document.createElement('p'); caption.textContent = description;
      body.append(heading, amount, caption);
      card.append(tile, body); summary.appendChild(card);
    }
    reportMessage.textContent = '';
    document.getElementById('printReport').disabled = false;
    showReport();
  } catch (error) {
    if (request !== reportRequest) return;
    reportMessage.textContent = error.message;
  } finally {
    if (request === reportRequest) {
      refresh.disabled = false;
      refresh.removeAttribute('aria-busy');
      icon?.classList.remove('admin-refresh-spinning');
    }
  }
}

function scheduleReport() {
  ++reportRequest;
  clearTimeout(reportTimer);
  clearReport();
  reportMessage.textContent = 'Loading report...';
  reportTimer = setTimeout(loadReport, 300);
}
[reportBarangay, reportCycle, reportStatus].forEach((filter) =>
  filter.addEventListener('change', scheduleReport),
);
reportSearch.addEventListener('input', scheduleReport);
document.getElementById('refreshReport').addEventListener('click', () => {
  clearTimeout(reportTimer);
  loadReport();
});
(async () => {
  try {
    const data = await AdminAPI.request('/barangays');
    for (const barangay of data) reportBarangay.add(new Option(globalThis.barangayLabel?.(barangay.name) ?? barangay.name, barangay.id));
  } catch (error) {
    reportMessage.textContent = error.message;
  }
  await loadReport();
})();
