const paymentSearch = document.getElementById('paymentSearch');
const paymentPager = createPagination('paymentPagination', showPayments);
const receiptDialog = document.getElementById('receiptDialog');
let receiptVersion = 0;
let paymentVersion = 0,
  paymentTimer;
const historyCustomer = new URLSearchParams(location.search).get('customer') || '';
async function showPayments() {
  const version = ++paymentVersion;
  const body = document.getElementById('paymentRows');
  if (!body.children.length) AdminUI.empty(body, 7, 'Loading payments...');
  try {
    const query = new URLSearchParams({
      page: paymentPager.page,
      limit: 10,
      search: paymentSearch.value.trim(),
      from: document.getElementById('paymentFrom').value,
      to: document.getElementById('paymentTo').value,
      method: document.getElementById('paymentMethod').value,
      customerId: historyCustomer,
    });
    const data = await AdminAPI.request('/payments?' + query);
    if (version !== paymentVersion) return;
    document.getElementById('paymentFilterHelp').textContent = '';
    paymentPager.page = data.pagination.page;
    paymentPager.update(data.pagination.total);
    body.replaceChildren();
    for (const payment of data.payments) {
      const row = body.insertRow();
      AdminUI.cell(row, payment.receipt, 'Receipt');
      AdminUI.customer(row, {
        id: payment.customerId,
        name: payment.name,
        account: payment.account,
      });
      for (const [value, label] of [
        [payment.cycle, 'Cycle'],
        [WaterStore.money(Number(payment.amount)), 'Amount'],
        [payment.method, 'Method'],
        [payment.date, 'Date'],
      ])
        AdminUI.cell(row, value, label);
      const actions = AdminUI.cell(row, '', 'View receipt');
      const view = document.createElement('button');
      view.type = 'button';
      view.className = 'btn action-view receipt-icon-button';
      view.title = 'View receipt';
      view.setAttribute('aria-label', 'View receipt');
      const icon = document.createElement('i');
      icon.className = 'bi bi-eye';
      icon.setAttribute('aria-hidden', 'true');
      view.appendChild(icon);
      view.addEventListener('click', () => showReceipt(payment));
      actions.appendChild(view);
    }
    AdminUI.empty(body, 7, 'No payments match your filters.');
    document.getElementById('paymentSummary').textContent =
      data.pagination.total + ' payment records';
    document.getElementById('collectedToday').textContent = WaterStore.money(
      Number(data.summary.today),
    );
    document.getElementById('collectedTotal').textContent = WaterStore.money(
      Number(data.summary.collected),
    );
    document.getElementById('receiptCount').textContent = data.pagination.total;
  } catch (error) {
    if (version !== paymentVersion) return;
    body.replaceChildren();
    AdminUI.empty(body, 7, error.message);
    paymentPager.update(0);
    document.getElementById('paymentFilterHelp').textContent = error.message;
    document.getElementById('paymentSummary').textContent = 'Could not load payments';
    for (const id of ['collectedToday', 'collectedTotal', 'receiptCount'])
      document.getElementById(id).textContent = '-';
  }
}
async function showReceipt(payment) {
  const version = ++receiptVersion;
  try {
    const data = await PaymentAPI.receipt(payment.id);
    if (version !== receiptVersion) return;
    const heading = receiptDialog.querySelector('.receipt-heading');
    if (heading) heading.hidden = true;
    const help = receiptDialog.querySelector('.form-help');
    if (help) help.hidden = true;
    renderReceiptPaper(
      document.getElementById('receiptDetails'),
      data.payment,
      data.customer,
      data.office,
    );
    receiptDialog.showModal();
  } catch (error) {
    AdminUI.message(error.message);
  }
}
for (const id of ['paymentSearch', 'paymentFrom', 'paymentTo', 'paymentMethod'])
  document.getElementById(id).addEventListener(id === 'paymentSearch' ? 'input' : 'change', () => {
    paymentPager.page = 1;
    paymentVersion++;
    clearTimeout(paymentTimer);
    paymentTimer = setTimeout(showPayments, id === 'paymentSearch' ? 250 : 0);
  });
document.getElementById('clearPaymentFilters').addEventListener('click', () => {
  for (const id of ['paymentSearch', 'paymentFrom', 'paymentTo', 'paymentMethod'])
    document.getElementById(id).value = '';
  paymentPager.page = 1;
  showPayments();
});
document.getElementById('closeReceipt').addEventListener('click', () => receiptDialog.close());
document.getElementById('printReceipt').addEventListener('click', () => {
  document.body.classList.add('printing-receipt');
  window.print();
});
window.addEventListener('afterprint', () => document.body.classList.remove('printing-receipt'));
receiptDialog.addEventListener('close', () => document.body.classList.remove('printing-receipt'));

AdminAuth.ready.then((user) => {
  if (user) showPayments();
});
