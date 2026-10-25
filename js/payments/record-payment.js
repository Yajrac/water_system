const paymentForm = document.getElementById('paymentForm');
const cashierPager = createPagination('cashierPagination', renderCashierRegistry);
let cashierBills = [],
  selectedBill = null,
  cashierVersion = 0,
  paying = false,
  requestKey = null;
let cashierTimer;
let openingVersion = 0;
const cashierCustomer = new URLSearchParams(location.search).get('customer') || '';
function fillCashierDetails(id, rows) {
  const container = document.getElementById(id);
  container.replaceChildren();
  for (const [label, value] of rows) {
    const group = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = label;
    const text = document.createElement('dd');
    text.textContent = value;
    group.append(term, text);
    container.appendChild(group);
  }
}
async function renderCashierRegistry() {
  const version = ++cashierVersion;
  const body = document.getElementById('cashierRows');
  if (!body.children.length) AdminUI.empty(body, 5, 'Loading unpaid bills...');
  try {
    const query = new URLSearchParams({
      page: cashierPager.page,
      limit: 10,
      status: 'outstanding',
      search: document.getElementById('cashierSearch').value.trim(),
      barangayId: document.getElementById('cashierBarangay').value,
      customerId: cashierCustomer,
    });
    const data = await AdminAPI.request('/bills?' + query);
    if (version !== cashierVersion) return;
    cashierBills = data.bills;
    cashierPager.page = data.pagination.page;
    cashierPager.update(data.pagination.total);
    body.replaceChildren();
    for (const bill of cashierBills) {
      const row = body.insertRow();
      for (const [value, label] of [
        [bill.submitterNumber || bill.account, 'Submitter / account no.'],
        [bill.name, 'Full name'],
        [bill.barangay, 'Barangay'],
        [bill.cycle, 'Billing month'],
      ])
        AdminUI.cell(row, value, label);
      const actions = AdminUI.cell(row, '', 'Action');
      AdminUI.button(actions, 'Process payment', () => openCashierBill(bill.id));
    }
    AdminUI.empty(body, 5, 'No unpaid bills match your search.');
  } catch (error) {
    if (version !== cashierVersion) return;
    body.replaceChildren();
    AdminUI.empty(body, 5, error.message);
    cashierPager.update(0);
  }
}
async function openCashierBill(id) {
  if (paying) return;
  const version = ++openingVersion;
  try {
    const data = await AdminAPI.request(
      '/bills?' + new URLSearchParams({ billId: id, status: 'outstanding' }),
    );
    const bill = data.bills[0];
    if (version !== openingVersion || paying) return;
    if (!bill)
      return showNotice('Bill no longer unpaid', 'Reload the list to see the latest bills.');
    selectedBill = bill;
    requestKey = null;
    paymentForm.reset();
    const select = document.getElementById('paymentBill');
    select.replaceChildren(new Option(bill.cycle, bill.id));
    select.value = bill.id;
    paymentForm.elements.amount.value = bill.balance;
    fillCashierDetails('cashierContext', [
      ['Submitter / account no.', bill.submitterNumber || bill.account],
      ['Customer name', bill.name],
      ['Billing month', bill.cycle],
      ['Due date', bill.due],
    ]);
    fillCashierDetails('cashierReadings', [
      ['Previous reading', bill.previous + ' m3'],
      ['Current reading', bill.current + ' m3'],
      ['Consumption', bill.consumption + ' m3'],
    ]);
    fillCashierDetails('cashierCharges', [
      ['Water charge', WaterStore.money(Number(bill.water))],
      ['Connection / reconnection', WaterStore.money(Number(bill.connection))],
      ['Late fee', WaterStore.money(Number(bill.late))],
      ['Other charges', WaterStore.money(Number(bill.other))],
      ['Bill total', WaterStore.money(Number(bill.total))],
      ['Previously paid', WaterStore.money(Number(bill.total) - Number(bill.balance))],
    ]);
    document.getElementById('cashierAmountDue').textContent = WaterStore.money(
      Number(bill.balance),
    );
    document.getElementById('cashierRegistry').hidden = true;
    document.getElementById('cashierSettlement').hidden = false;
    updateCashierValidation();
    paymentForm.elements.amount.focus();
  } catch (error) {
    await showNotice('Payment unavailable', error.message);
  }
}
function updateCashierValidation() {
  const amount = paymentForm.elements.amount.value.trim();
  const balance = Number(selectedBill?.balance || 0);
  const valid = Validation.money(amount) && Number(amount) > 0 && Number(amount) <= balance;
  const message = document.getElementById('cashierValidation');
  message.textContent = !valid
    ? 'Enter a valid amount'
    : Number(amount) === balance
      ? 'Exact amount verified'
      : 'Partial payment';
  message.parentElement.classList.toggle('is-valid', valid);
  document.getElementById('recordPaymentButton').disabled = paying || !valid;
  const bank = paymentForm.elements.method.value === 'Bank transfer';
  paymentForm.elements.reference.required = bank;
}
function showCashierRegistry() {
  if (paying) return;
  openingVersion++;
  document.getElementById('cashierSettlement').hidden = true;
  document.getElementById('cashierRegistry').hidden = false;
  selectedBill = null;
  requestKey = null;
  renderCashierRegistry();
}
document.getElementById('backToCashier').addEventListener('click', showCashierRegistry);
for (const event of ['input', 'change'])
  paymentForm.addEventListener(event, () => {
    requestKey = null;
    updateCashierValidation();
  });
for (const id of ['cashierSearch', 'cashierBarangay'])
  document.getElementById(id).addEventListener(id === 'cashierSearch' ? 'input' : 'change', () => {
    cashierPager.page = 1;
    cashierVersion++;
    clearTimeout(cashierTimer);
    cashierTimer = setTimeout(renderCashierRegistry, id === 'cashierSearch' ? 250 : 0);
  });
paymentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (paying || !selectedBill) return;
  updateCashierValidation();
  if (document.getElementById('recordPaymentButton').disabled || !paymentForm.checkValidity())
    return paymentForm.reportValidity();
  const bill = selectedBill;
  requestKey ||= crypto.randomUUID();
  const body = {
    billId: bill.id,
    amount: paymentForm.elements.amount.value.trim(),
    expectedBalance: bill.balance,
    method: paymentForm.elements.method.value,
    reference: paymentForm.elements.reference.value.trim(),
    remarks: paymentForm.elements.remarks.value.trim(),
    requestKey,
  };
  const numericBill = {
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
      ].map((key) => [key, Number(bill[key])]),
    ),
  };
  const amount = Number(body.amount),
    before = Number(bill.balance);
  const preview = {
    receipt: 'Assigned on save',
    amount,
    method: body.method,
    reference: body.reference,
    remarks: body.remarks,
    date: WaterStore.today(),
    balanceBefore: before,
    balanceAfter: Math.round((before - amount) * 100) / 100,
    allocations: [
      {
        ...numericBill,
        billId: bill.id,
        amount,
        balanceAfter: Math.round((before - amount) * 100) / 100,
      },
    ],
  };
  paying = true;
  paymentForm.inert = true;
  try {
    const saved = await reviewPaymentReceipt(
      preview,
      bill,
      numericBill,
      { name: 'PIO DURAN WATER SUPPLY SYSTEM' },
      async () =>
        PaymentAPI.receiptData(await AdminAPI.request('/payments', { method: 'POST', body })),
    );
    if (saved) {
      paying = false;
      showCashierRegistry();
    }
  } finally {
    paying = false;
    paymentForm.inert = false;
    updateCashierValidation();
  }
});
AdminAuth.ready.then(async (user) => {
  if (!user) return;
  try {
    const areas = await AdminAPI.request('/barangays');
    for (const area of areas)
      document.getElementById('cashierBarangay').add(new Option(area.name, String(area.id)));
  } catch (error) {
    AdminUI.message(error.message);
  }
  await renderCashierRegistry();
});
