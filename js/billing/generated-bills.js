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
    const identity = AdminUI.cell(row, '', 'Customer');
    const name = document.createElement('strong');
    name.textContent = customer?.name || 'Unknown customer';
    const account = document.createElement('small');
    account.textContent = customer?.account || 'Unknown account';
    identity.append(name, account);
    [
      bill.cycle,
      WaterStore.money(bill.total),
      WaterStore.money(WaterStore.balance(bill, billRecords)),
      bill.due,
      WaterStore.status(bill, billRecords),
    ].forEach((value, index) =>
      AdminUI.cell(
        row,
        value,
        ['Billing month', 'Bill total', 'Balance', 'Due date', 'Status'][index],
      ),
    );
    const actions = AdminUI.cell(row, '', 'View');
    AdminUI.button(actions, 'View bill', () => showBillDetails(bill));
    const button = actions.querySelector('button');
    button.classList.add('action-view', 'bill-view-button');
    button.setAttribute(
      'aria-label',
      'View bill for ' + (customer?.name || 'customer') + ', ' + bill.cycle,
    );
    button.title = 'View bill';
    button.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  });
  AdminUI.empty(
    body,
    7,
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

function showBillDetails(bill) {
  if (document.getElementById('billDetailsDialog')) return;
  const customer = billRecords.customers.find((item) => item.id === bill.customerId);
  const dialog = document.createElement('dialog');
  dialog.id = 'billDetailsDialog';
  dialog.className = 'bill-details-dialog';
  dialog.setAttribute('aria-labelledby', 'billDetailsTitle');
  dialog.innerHTML =
    '<h2 id="billDetailsTitle">Bill details</h2><dl class="receipt-details"></dl><form method="dialog" class="confirmation-actions"><button class="btn btn-primary" autofocus>Close</button></form>';
  const details = dialog.querySelector('dl');
  const volume = (value) => (Number.isFinite(value) ? value + ' m³' : 'Not recorded');
  [
    ['Customer', customer?.name || 'Unknown customer'],
    ['Account', customer?.account || 'Not recorded'],
    ['Customer type', bill.customerType || customer?.customerType || 'Not recorded'],
    ['Billing month', bill.cycle],
    ['Generated on', bill.generatedOn || 'Not recorded'],
    ['Due date', bill.due],
    ['Previous reading', volume(bill.previous)],
    ['Current reading', volume(bill.current)],
    ['Water consumed', volume(bill.consumption)],
    ['Water charge', WaterStore.money(bill.water)],
    ['Monthly charge', WaterStore.money(bill.monthly || 0)],
    ['Connection / reconnection', WaterStore.money(bill.connection || 0)],
    ['Late fee', WaterStore.money(bill.late || 0)],
    ['Other charge', WaterStore.money(bill.other || 0)],
    ['Bill total', WaterStore.money(bill.total)],
    ['Balance', WaterStore.money(WaterStore.balance(bill, billRecords))],
    ['Status', WaterStore.status(bill, billRecords)],
  ].forEach(([label, value]) => {
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value;
    details.append(term, description);
  });
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  document.body.appendChild(dialog);
  dialog.showModal();
}
