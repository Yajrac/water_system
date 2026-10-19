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
    AdminUI.cell(row, payment.receipt, 'Receipt');
    AdminUI.customer(row, customer);
    [
      cycle || 'Not recorded',
      WaterStore.money(payment.amount),
      payment.method,
      payment.date,
    ].forEach((value, index) =>
      AdminUI.cell(row, value, ['Cycle', 'Amount', 'Method', 'Date'][index]),
    );
    const actions = AdminUI.cell(row, '', 'View report');
    AdminUI.button(actions, 'View receipt', () => showReceipt(payment));
    const receiptButton = actions.querySelector('button');
    receiptButton.classList.add('action-receipt', 'receipt-icon-button');
    receiptButton.setAttribute('aria-label', 'View receipt ' + payment.receipt);
    receiptButton.title = 'View receipt';
    receiptButton.innerHTML =
      '<i class="bi bi-eye" aria-hidden="true"></i>';
  });
  AdminUI.empty(
    body,
    7,
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
  const heading = receiptDialog.querySelector('.receipt-heading');
  if (heading) heading.hidden = true;
  const help = receiptDialog.querySelector('.form-help');
  if (help) help.hidden = true;
  renderReceiptPaper(
    document.getElementById('receiptDetails'),
    payment,
    customer,
    paymentRecords.office,
  );
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
