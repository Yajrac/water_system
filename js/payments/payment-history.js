const paymentRecords = WaterStore.load();
const paymentSearch = document.getElementById('paymentSearch');
const paymentPager = createPagination('paymentPagination', showPayments);
const receiptDialog = document.getElementById('receiptDialog');

function showPayments() {
  const search = paymentSearch.value.trim().toLowerCase();
  const from = document.getElementById('paymentFrom').value;
  const to = document.getElementById('paymentTo').value;
  const method = document.getElementById('paymentMethod').value;
  const invalidDates = from && to && from > to;
  document.getElementById('paymentFilterHelp').textContent = invalidDates
    ? 'From date must be on or before To date.'
    : '';
  const payments = paymentRecords.payments
    .filter((payment) => {
      const customer = paymentRecords.customers.find((item) => item.id === payment.customerId);
      const text = [customer?.name, customer?.account, payment.receipt].join(' ').toLowerCase();
      return (
        !invalidDates &&
        text.includes(search) &&
        (!from || payment.date >= from) &&
        (!to || payment.date <= to) &&
        (!method || payment.method === method)
      );
    })
    .slice()
    .reverse();
  const body = document.getElementById('paymentRows');
  body.replaceChildren();
  paymentPager.update(payments.length);
  paymentPager.items(payments).forEach((payment) => {
    const customer = paymentRecords.customers.find((item) => item.id === payment.customerId);
    const bill = paymentRecords.bills.find((item) => item.id === payment.billId);
    const cycle = payment.allocations
      ? payment.allocations.map((item) => item.cycle).join(', ')
      : bill?.cycle;
    const row = body.insertRow();
    [
      payment.receipt,
      customer?.account || '—',
      customer?.name || 'Unknown customer',
      cycle || '—',
      WaterStore.money(payment.amount),
      payment.method,
      payment.date,
    ].forEach((value, index) =>
      AdminUI.cell(
        row,
        value,
        ['Receipt', 'Account', 'Customer', 'Cycle', 'Amount', 'Method', 'Date'][index],
      ),
    );
    const actions = AdminUI.cell(row, '', 'View report');
    AdminUI.button(actions, 'View receipt', () => showReceipt(payment));
    const receiptButton = actions.querySelector('button');
    receiptButton.classList.add('action-receipt', 'receipt-icon-button');
    receiptButton.setAttribute('aria-label', 'View receipt ' + payment.receipt);
    receiptButton.title = 'View receipt';
    receiptButton.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  });
  AdminUI.empty(
    body,
    8,
    invalidDates
      ? 'Correct the date range to view payments.'
      : 'No payments match your search or filters.',
  );
  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const todayTotal = payments
    .filter((payment) => payment.date === WaterStore.today())
    .reduce((sum, payment) => sum + payment.amount, 0);
  document.getElementById('paymentSummary').textContent = payments.length + ' payment records';
  document.getElementById('collectedToday').textContent = WaterStore.money(todayTotal);
  document.getElementById('collectedTotal').textContent = WaterStore.money(total);
  document.getElementById('receiptCount').textContent = payments.length;
}

function showReceipt(payment) {
  const customer = paymentRecords.customers.find((item) => item.id === payment.customerId);
  const bill = paymentRecords.bills.find((item) => item.id === payment.billId);
  if (payment.allocations) {
    const details = document.getElementById('receiptDetails');
    details.replaceChildren();
    document.getElementById('receiptOffice').textContent = paymentRecords.office.name;
    const currentBalance = paymentRecords.bills
      .filter((item) => item.customerId === payment.customerId)
      .reduce((sum, item) => sum + WaterStore.balance(item, paymentRecords), 0);
    [
      ['Receipt number', payment.receipt],
      ['Customer', customer?.name || 'Unknown customer'],
      ['Account', customer?.account || '—'],
      ['Date paid', payment.date],
      ['Payment method', payment.method],
      [
        'Payment covers',
        payment.scope === 'account'
          ? 'Outstanding account balance · oldest bills first'
          : 'Selected billing month',
      ],
      ['Selected balance before payment', WaterStore.money(payment.balanceBefore)],
      ['This payment', WaterStore.money(payment.amount)],
      ['Selected balance after payment', WaterStore.money(payment.balanceAfter)],
      ['Current account balance', WaterStore.money(currentBalance)],
    ].forEach(([label, value]) => {
      const term = document.createElement('dt');
      term.textContent = label;
      const description = document.createElement('dd');
      description.textContent = value;
      details.append(term, description);
    });
    appendReceiptAllocations(details, payment);
    receiptDialog.showModal();
    return;
  }
  if (!bill) return AdminUI.message('The bill for this receipt could not be found.');
  // Older receipts have no balance snapshot. Reconstruct it in recording order.
  const position = paymentRecords.payments.indexOf(payment);
  const paidThroughReceipt = paymentRecords.payments
    .slice(0, position + 1)
    .reduce((sum, item) => sum + WaterStore.paymentForBill(item, bill.id), 0);
  const after = Number.isFinite(payment.balanceAfter)
    ? payment.balanceAfter
    : Math.max(0, Math.round((bill.total - paidThroughReceipt) * 100) / 100);
  const details = document.getElementById('receiptDetails');
  details.replaceChildren();
  document.getElementById('receiptOffice').textContent = paymentRecords.office.name;
  const fields = [
    ['Receipt number', payment.receipt],
    ['Customer', customer?.name || 'Unknown customer'],
    ['Account', customer?.account || '—'],
    ['Barangay', customer?.barangay || '—'],
    ['Billing month', bill.cycle],
    ['Date paid', payment.date],
    ['Payment method', payment.method],
    ['Previous reading', Number.isFinite(bill.previous) ? bill.previous + ' m³' : 'Not recorded'],
    ['Current reading', Number.isFinite(bill.current) ? bill.current + ' m³' : 'Not recorded'],
    [
      'Water consumed',
      Number.isFinite(bill.consumption) ? bill.consumption + ' m³' : 'Not recorded',
    ],
    [
      'Bill total',
      WaterStore.money(Number.isFinite(payment.billTotal) ? payment.billTotal : bill.total),
    ],
    ['This payment', WaterStore.money(payment.amount)],
    ['Balance after this receipt', WaterStore.money(after)],
    ['Current remaining balance', WaterStore.money(WaterStore.balance(bill, paymentRecords))],
  ];
  fields.forEach(([label, value]) => {
    const heading = document.createElement('dt');
    heading.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value;
    details.append(heading, description);
  });
  receiptDialog.showModal();
}
function refreshPaymentFilters() {
  paymentPager.page = 1;
  showPayments();
  // Searching is independent of the old selected-customer query.
  updatePaymentLinks('');
  if (location.search) history.replaceState(null, '', 'payment-history.html');
}
['paymentSearch', 'paymentFrom', 'paymentTo', 'paymentMethod'].forEach((id) => {
  document
    .getElementById(id)
    .addEventListener(id === 'paymentSearch' ? 'input' : 'change', refreshPaymentFilters);
});
document.getElementById('clearPaymentFilters').addEventListener('click', () => {
  ['paymentSearch', 'paymentFrom', 'paymentTo', 'paymentMethod'].forEach((id) => {
    document.getElementById(id).value = '';
  });
  refreshPaymentFilters();
});
document.getElementById('closeReceipt').addEventListener('click', () => receiptDialog.close());
document.getElementById('printReceipt').addEventListener('click', () => {
  document.body.classList.add('printing-receipt');
  window.print();
});
window.addEventListener('afterprint', () => document.body.classList.remove('printing-receipt'));
receiptDialog.addEventListener('close', () => document.body.classList.remove('printing-receipt'));
const requestedCustomerId = new URLSearchParams(location.search).get('customer');
const requestedCustomer = paymentRecords.customers.find(
  (customer) => customer.id === requestedCustomerId,
);
if (requestedCustomer) paymentSearch.value = requestedCustomer.account;
showPayments();
