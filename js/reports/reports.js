const reportRecords = WaterStore.load();
const reportBarangay = document.getElementById('reportBarangay');
const reportCycle = document.getElementById('reportCycle');
const reportStatus = document.getElementById('reportStatus');
let consumptionReportRows = [];
const accountReportPager = createPagination('accountReportPagination', showReport);
const consumptionReportPager = createPagination('consumptionReportPagination', showReport);
let reportRows = [];
let reportMatchedBills = [];
const reportHeadings = ['Account', 'Customer', 'Barangay', 'Cycle', 'Total', 'Balance', 'Status'];

function showReport() {
  const search = document.getElementById('reportSearch').value.trim().toLowerCase();
  const body = document.getElementById('reportRows');
  const consumptionBody = document.getElementById('consumptionRows');
  body.replaceChildren();
  consumptionBody.replaceChildren();
  reportRows = [];
  reportMatchedBills = [];
  // A barangay name is a record key, including names such as "constructor".
  const groups = Object.create(null);
  reportRecords.bills.forEach((bill) => {
    const customer = reportRecords.customers.find((item) => item.id === bill.customerId);
    if (!customer || !(customer.name + ' ' + customer.account).toLowerCase().includes(search))
      return;
    const status = WaterStore.status(bill, reportRecords);
    if (reportBarangay.value && customer.barangay !== reportBarangay.value) return;
    if (reportCycle.value && bill.cycle !== reportCycle.value) return;
    if (reportStatus.value && status !== reportStatus.value) return;
    const values = [
      customer.account,
      customer.name,
      customer.barangay,
      bill.cycle,
      bill.total.toFixed(2),
      WaterStore.balance(bill, reportRecords).toFixed(2),
      status,
    ];
    reportRows.push(values);
    reportMatchedBills.push({ bill, customer, status });
    if (!groups[customer.barangay])
      groups[customer.barangay] = { customers: new Set(), consumption: 0 };
    groups[customer.barangay].customers.add(customer.id);
    groups[customer.barangay].consumption += bill.consumption;
  });
  accountReportPager.update(reportMatchedBills.length);
  accountReportPager.items(reportMatchedBills).forEach(({ customer }, index) => {
    const values = reportRows[(accountReportPager.page - 1) * accountReportPager.size + index];
    const row = body.insertRow();
    AdminUI.customer(row, customer);
    values
      .slice(2)
      .forEach((value, index) =>
        AdminUI.cell(
          row,
          index === 2 || index === 3 ? WaterStore.money(Number(value)) : value,
          reportHeadings[index + 2],
        ),
      );
  });
  consumptionReportRows = Object.entries(groups)
    .sort((a, b) => b[1].consumption - a[1].consumption)
    .map(([barangay, group]) => [barangay, group.customers.size,
      Number(group.consumption.toFixed(3)),
      Number((group.consumption / group.customers.size).toFixed(3))]);
  consumptionReportPager.update(consumptionReportRows.length);
  consumptionReportPager.items(consumptionReportRows).forEach((values) => {
    const row = consumptionBody.insertRow();
    values.forEach((value, index) => AdminUI.cell(row, value,
      ['Barangay', 'Billed accounts', 'Total consumption', 'Average per billed account'][index]));
  });
  AdminUI.empty(body, 6, 'No bills match the selected filters.');
  AdminUI.empty(consumptionBody, 4, 'No consumption records match the selected filters.');
}
WaterStore.barangays.forEach((barangay) => reportBarangay.add(new Option(barangay, barangay)));
[reportBarangay, reportCycle, reportStatus].forEach((filter) =>
  filter.addEventListener('change', resetReportPages),
);
function resetReportPages() {
  accountReportPager.page = 1;
  consumptionReportPager.page = 1;
  showReport();
}
document.getElementById('reportSearch').addEventListener('input', resetReportPages);
showReport();
