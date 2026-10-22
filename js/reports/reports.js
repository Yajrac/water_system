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
    [
      customer.barangay,
      bill.cycle,
      WaterStore.money(bill.total),
      WaterStore.money(bill.balance),
      status,
    ].forEach((value, index) =>
      AdminUI.cell(row, value, ['Barangay', 'Cycle', 'Total', 'Balance', 'Status'][index]),
    );
  });
  consumptionReportPager.update(consumptionReportRows.length);
  consumptionReportPager.items(consumptionReportRows).forEach((values) => {
    const row = consumptionBody.insertRow();
    values.forEach((value, index) =>
      AdminUI.cell(
        row,
        value,
        ['Barangay', 'Billed accounts', 'Total consumption', 'Average per billed account'][index],
      ),
    );
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
  clearReport();
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
    document.getElementById('reportSummary').textContent =
      data.summary.bills +
      ' bills | Total: ' +
      WaterStore.money(data.summary.total) +
      ' | Paid toward these bills: ' +
      WaterStore.money(data.summary.paid) +
      ' | Outstanding: ' +
      WaterStore.money(data.summary.balance);
    reportMessage.textContent = '';
    document.getElementById('printReport').disabled = false;
    showReport();
  } catch (error) {
    if (request !== reportRequest) return;
    reportMessage.textContent = error.message;
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
    for (const barangay of data) reportBarangay.add(new Option(barangay.name, barangay.id));
  } catch (error) {
    reportMessage.textContent = error.message;
  }
  await loadReport();
})();
