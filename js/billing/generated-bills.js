const billRecords = WaterStore.load();
const billPager = createPagination('billPagination', showGeneratedBills);
function showGeneratedBills() {
  const body = document.getElementById('billRows');
  const search = document.getElementById('billSearch').value.trim().toLowerCase();
  const cycle = document.getElementById('billCycle').value;
  const status = document.getElementById('billStatus').value;
  const due = document.getElementById('billDueDate').value;
  const bills = billRecords.bills
    .slice()
    .reverse()
    .filter((bill) => {
      const customer = billRecords.customers.find((item) => item.id === bill.customerId);
      const balance = WaterStore.balance(bill, billRecords);
      const matchesStatus =
        !status ||
        (status === 'outstanding' ? balance > 0 : WaterStore.status(bill, billRecords) === status);
      return (
        (!cycle || bill.cycle === cycle) &&
        matchesStatus &&
        (!due || (bill.due === due && balance > 0)) &&
        ((customer?.account || '') + ' ' + (customer?.name || '')).toLowerCase().includes(search)
      );
    });
  billPager.update(bills.length);
  body.replaceChildren();
  billPager.items(bills).forEach((bill) => {
    const customer = billRecords.customers.find((item) => item.id === bill.customerId);
    const row = body.insertRow();
    const values = [
      customer?.account || 'Unknown account',
      customer?.name || 'Unknown customer',
      bill.cycle,
      bill.consumption,
      WaterStore.money(bill.water),
      WaterStore.money(bill.monthly),
      WaterStore.money(bill.connection),
      WaterStore.money(bill.late),
      WaterStore.money(bill.other),
      WaterStore.money(bill.total),
      WaterStore.money(WaterStore.balance(bill, billRecords)),
      bill.generatedOn || 'Not recorded',
      bill.due,
      WaterStore.status(bill, billRecords),
    ];
    const labels = [
      'Account',
      'Customer',
      'Cycle',
      'Consumption',
      'Water charge',
      'Monthly charge',
      'Connection',
      'Late fee',
      'Other charge',
      'Total',
      'Balance',
      'Generated on',
      'Due date',
      'Status',
    ];
    values.forEach((value, index) => AdminUI.cell(row, value, labels[index]));
  });
  AdminUI.empty(
    body,
    14,
    due
      ? 'No outstanding bills are due on this date with the selected filters.'
      : 'No generated bills match these filters.',
  );
  document.getElementById('billDueSummary').textContent = due
    ? bills.length +
      ' outstanding bills due on ' +
      due +
      ' · Remaining balance: ' +
      WaterStore.money(bills.reduce((sum, bill) => sum + WaterStore.balance(bill, billRecords), 0))
    : '';
}
['billSearch', 'billCycle', 'billStatus'].forEach((id) => {
  document.getElementById(id).addEventListener(id === 'billSearch' ? 'input' : 'change', () => {
    billPager.page = 1;
    showGeneratedBills();
  });
});
document.getElementById('billDueDate').addEventListener('change', () => {
  const selected = Boolean(document.getElementById('billDueDate').value);
  const status = document.getElementById('billStatus');
  status.querySelector('option[value="Paid"]').disabled = selected;
  if (selected) status.value = 'outstanding';
  billPager.page = 1;
  showGeneratedBills();
});
showGeneratedBills();
