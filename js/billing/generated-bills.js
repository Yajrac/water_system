// Generated bills are read from the database, with server filters and pagination.
const billRecords = { customers: [], bills: [] };
const billPager = createPagination('billPagination', showGeneratedBills);
let billLoadVersion = 0;
let billSearchTimer;
async function showGeneratedBills() {
  const version = ++billLoadVersion;
  const body = document.getElementById('billRows');
  body.setAttribute('aria-busy', 'true');
  if (!body.children.length) AdminUI.empty(body, 10, 'Loading generated bills...');
  try {
    const query = new URLSearchParams({
      page: billPager.page,
      limit: 10,
      search: document.getElementById('billSearch').value.trim(),
      month: document.getElementById('billCycle').value,
      due: document.getElementById('billDueDate').value,
      status: document.getElementById('billStatus').value,
    });
    const result = await AdminAPI.request('/bills?' + query);
    if (version !== billLoadVersion) return;
    billPager.page = result.pagination.page;
    billPager.update(result.pagination.total);
    billRecords.customers = result.bills.map((bill) => ({
      id: bill.customerId,
      name: bill.name,
      account: bill.account,
      customerType: bill.customerType,
    }));
    billRecords.bills = result.bills.map((bill) => ({
      ...bill,
      ...Object.fromEntries(
        [
          'previous',
          'current',
          'consumption',
          'ratePerCubic',
          'water',
          'connection',
          'late',
          'other',
          'total',
          'balance',
        ].map((key) => [key, Number(bill[key])]),
      ),
    }));
    body.replaceChildren();
    billRecords.bills.forEach((bill) => {
      const row = body.insertRow();
      const identity = AdminUI.cell(row, '', 'Customer');
      const name = document.createElement('strong');
      name.textContent = bill.name;
      const account = document.createElement('small');
      account.textContent = bill.account;
      identity.append(name, account);
      [
        bill.cycle,
        bill.previous + ' m\u00b3',
        bill.current + ' m\u00b3',
        bill.consumption + ' m\u00b3',
        WaterStore.money(bill.total),
        WaterStore.money(bill.balance),
        bill.due,
        bill.status,
      ].forEach((value, index) =>
        AdminUI.cell(
          row,
          value,
          [
            'Billing month',
            'Previous reading',
            'Current reading',
            'Consumption',
            'Bill total',
            'Balance',
            'Due date',
            'Status',
          ][index],
        ),
      );
      const actions = AdminUI.cell(row, '', 'View');
      AdminUI.button(actions, 'View bill', () => showBillDetails(bill));
      const button = actions.querySelector('button');
      button.classList.add('action-view', 'bill-view-button');
      button.setAttribute('aria-label', 'View bill for ' + bill.name + ', ' + bill.cycle);
      button.innerHTML = '<i class="bi bi-eye" aria-hidden="true"></i>';
    });
    AdminUI.empty(body, 10, 'No generated bills match these filters.');
    const due = document.getElementById('billDueDate').value;
    document.getElementById('billDueSummary').textContent = due
      ? result.pagination.total + ' outstanding bills due on ' + due
      : '';
  } catch (error) {
    if (version !== billLoadVersion) return;
    body.replaceChildren();
    AdminUI.empty(body, 10, error.message);
    billPager.update(0);
    document.getElementById('billDueSummary').textContent =
      'Could not load generated bills. Change a filter or reload to retry.';
  } finally {
    if (version === billLoadVersion) body.setAttribute('aria-busy', 'false');
  }
}
for (const id of ['billSearch', 'billCycle', 'billStatus', 'billDueDate']) {
  document.getElementById(id).addEventListener(id === 'billSearch' ? 'input' : 'change', () => {
    billPager.page = 1;
    clearTimeout(billSearchTimer);
    if (id === 'billDueDate') {
      const due = Boolean(document.getElementById(id).value);
      const status = document.getElementById('billStatus');
      status.querySelector('option[value="Paid"]').disabled = due;
      if (due) status.value = 'outstanding';
    }
    billLoadVersion++;
    if (id === 'billSearch') billSearchTimer = setTimeout(showGeneratedBills, 250);
    else showGeneratedBills();
  });
}
AdminAuth.ready.then((user) => {
  if (user) showGeneratedBills();
});

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
    ...(bill.billingMode === 'flat'
      ? [['Rate per cubic meter', WaterStore.money(bill.ratePerCubic)]]
      : []),
    ['Water charge', WaterStore.money(bill.water)],
    ['Monthly charge', WaterStore.money(bill.monthly || 0)],
    ['Connection / reconnection', WaterStore.money(bill.connection || 0)],
    ['Late fee', WaterStore.money(bill.late || 0)],
    ['Other charge', WaterStore.money(bill.other || 0)],
    ['Bill total', WaterStore.money(bill.total)],
    ['Balance', WaterStore.money(bill.balance)],
    ['Status', bill.status],
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
