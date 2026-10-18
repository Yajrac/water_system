const paymentRecords = WaterStore.load();
const paymentForm = document.getElementById('paymentForm');
const billSelect = document.getElementById('paymentBill');
const paymentButton = document.getElementById('recordPaymentButton');
let selectedCustomerId = '';
const cashierPager = createPagination('cashierPagination', renderCashierRegistry);
WaterStore.barangays.forEach((name) =>
  document.getElementById('cashierBarangay').add(new Option(name, name)),
);
function selectedPaymentBills() {
  return paymentRecords.bills.filter(
    (bill) =>
      bill.customerId === selectedCustomerId &&
      WaterStore.balance(bill, paymentRecords) > 0 &&
      bill.id === billSelect.value,
  );
}
function readableCycle(cycle) {
  return /^\d{4}-\d{2}$/.test(cycle)
    ? new Intl.DateTimeFormat('en-PH', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Manila',
      }).format(new Date(cycle + '-01T12:00:00+08:00'))
    : cycle;
}
function renderCashierRegistry() {
  Object.assign(paymentRecords, WaterStore.load());
  const query = document.getElementById('cashierSearch').value.trim().toLowerCase();
  const barangay = document.getElementById('cashierBarangay').value;
  const bills = paymentRecords.bills
    .filter((bill) => {
      const c = paymentRecords.customers.find((c) => c.id === bill.customerId);
      return (
        c &&
        WaterStore.balance(bill, paymentRecords) > 0 &&
        (!barangay || c.barangay === barangay) &&
        (c.name + ' ' + c.account + ' ' + (c.submitterNumber || '')).toLowerCase().includes(query)
      );
    })
    .sort((a, b) => a.cycle.localeCompare(b.cycle));
  cashierPager.update(bills.length);
  const body = document.getElementById('cashierRows');
  body.replaceChildren();
  cashierPager.items(bills).forEach((bill) => {
    const customer = paymentRecords.customers.find((c) => c.id === bill.customerId);
    const row = body.insertRow();
    AdminUI.cell(row, customer.submitterNumber || customer.account, 'Submitter / account no.');
    AdminUI.cell(row, customer.name, 'Full name');
    AdminUI.cell(row, customer.barangay, 'Barangay');
    AdminUI.cell(row, readableCycle(bill.cycle), 'Billing month');
    const action = AdminUI.cell(row, '', 'Action');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn cashier-process';
    button.textContent = 'Process payment';
    button.addEventListener('click', () => openCashierBill(bill.id));
    action.appendChild(button);
  });
  AdminUI.empty(body, 5, 'No unpaid bills match your search.');
}
function fillCashierDetails(id, rows) {
  const container = document.getElementById(id);
  container.replaceChildren();
  rows.forEach(([label, value]) => {
    const item = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    item.append(dt, dd);
    container.appendChild(item);
  });
}
function openCashierBill(id) {
  Object.assign(paymentRecords, WaterStore.load());
  const bill = paymentRecords.bills.find((b) => b.id === id);
  const customer = paymentRecords.customers.find((c) => c.id === bill?.customerId);
  if (!bill || !customer || WaterStore.balance(bill, paymentRecords) <= 0) {
    renderCashierRegistry();
    return showNotice('Bill no longer unpaid', 'This bill has changed or has already been paid.');
  }
  selectedCustomerId = customer.id;
  paymentForm.reset();
  billSelect.replaceChildren(new Option(bill.cycle, bill.id));
  billSelect.value = bill.id;
  const balance = WaterStore.balance(bill, paymentRecords);
  paymentForm.elements.amount.value = balance.toFixed(2);
  fillCashierDetails('cashierContext', [
    ['Submitter / account no.', customer.submitterNumber || customer.account],
    ['Customer name', customer.name],
    ['Billing month', readableCycle(bill.cycle)],
    ['Due date', bill.due],
  ]);
  fillCashierDetails('cashierReadings', [
    ['Previous reading', bill.previous + ' m\u00b3'],
    ['Current reading', bill.current + ' m\u00b3'],
    ['Consumption', bill.consumption + ' m\u00b3'],
  ]);
  fillCashierDetails('cashierCharges', [
    ['Water charge', WaterStore.money(bill.water || 0)],
    ['Connection / reconnection', WaterStore.money(bill.connection || 0)],
    ['Late fee', WaterStore.money(bill.late || 0)],
    ['Other charges', WaterStore.money(bill.other || 0)],
    ['Bill total', WaterStore.money(bill.total)],
    ['Previously paid', WaterStore.money(bill.total - balance)],
  ]);
  document.getElementById('cashierAmountDue').textContent = WaterStore.money(balance);
  document.getElementById('cashierRegistry').hidden = true;
  document.getElementById('cashierSettlement').hidden = false;
  updateCashierValidation();
  paymentForm.elements.amount.focus();
}
function updateCashierValidation() {
  const amount = paymentForm.elements.amount.value.trim();
  const bills = selectedPaymentBills();
  const due = bills.reduce((sum, b) => sum + WaterStore.balance(b, paymentRecords), 0);
  const valid = Validation.money(amount) && Number(amount) > 0 && Number(amount) <= due;
  const label = document.getElementById('cashierValidation');
  label.textContent = !valid
    ? 'Enter a valid amount'
    : Number(amount) === due
      ? 'Exact amount verified'
      : 'Partial payment';
  label.parentElement.classList.toggle('is-valid', valid);
  paymentButton.disabled = !valid;
}
function showCashierRegistry() {
  document.getElementById('cashierSettlement').hidden = true;
  document.getElementById('cashierRegistry').hidden = false;
  selectedCustomerId = '';
  renderCashierRegistry();
}
document.getElementById('backToCashier').addEventListener('click', showCashierRegistry);
paymentForm.elements.amount.addEventListener('input', updateCashierValidation);
['cashierSearch', 'cashierBarangay'].forEach((id) =>
  document.getElementById(id).addEventListener(id === 'cashierSearch' ? 'input' : 'change', () => {
    cashierPager.page = 1;
    renderCashierRegistry();
  }),
);
paymentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  Object.assign(paymentRecords, WaterStore.load());
  const bills = selectedPaymentBills();
  const amountText = paymentForm.elements.amount.value.trim();
  const amount = Number(amountText);
  const date = WaterStore.today();
  const remarks = paymentForm.elements.remarks.value.trim();
  if (remarks.length > 500 || /[<>\u0000-\u001f]/.test(remarks.replace(/[\r\n]/g, '')))
    return AdminUI.message('Use plain text notes of up to 500 characters.');
  if (!bills.length || !selectedCustomerId || amount <= 0 || !Number.isFinite(amount))
    return AdminUI.message(
      'Select a customer with outstanding bills and enter a valid payment amount.',
    );
  if (!Validation.money(amountText))
    return AdminUI.message(
      'Amount must be a positive number with at most two decimal places. Letters and scientific notation are not accepted.',
    );
  if (!Validation.date(date)) return AdminUI.message('Choose a valid payment date.');
  if (!['Cash', 'Bank transfer', 'GCash'].includes(paymentForm.elements.method.value))
    return AdminUI.message('Choose a supported payment method.');
  const balanceBefore =
    Math.round(
      bills.reduce((sum, bill) => sum + WaterStore.balance(bill, paymentRecords), 0) * 100,
    ) / 100;
  if (amount > balanceBefore)
    return AdminUI.message('Payment cannot exceed the selected outstanding balance.');
  const allocations = WaterStore.allocatePayment(bills, amount, paymentRecords);
  if (
    allocations.some((item) => {
      const bill = bills.find((bill) => bill.id === item.billId);
      return date < (bill.generatedOn || bill.cycle + '-01');
    })
  )
    return AdminUI.message('Payment cannot be recorded before bill generation.');
  const balanceAfter = Math.round((balanceBefore - amount) * 100) / 100;
  const snapshot = JSON.stringify(paymentRecords);
  const method = paymentForm.elements.method.value;
  // Preview the next reference without storing it or consuming it on cancel.
  const receipt = WaterStore.nextReference(paymentRecords, 'RCP', 'receipt', 'payments');
  const customer = paymentRecords.customers.find((item) => item.id === selectedCustomerId);
  if (!customer) return AdminUI.message('Customer no longer exists. Search again before saving.');
  const payment = {
    id: WaterStore.id(),
    customerId: selectedCustomerId,
    receipt,
    amount,
    date,
    method,
    allocations: allocations.map((item) => {
      const source = bills.find((bill) => bill.id === item.billId);
      return {
        ...item,
        water: source.water,
        connection: source.connection,
        late: source.late,
        other: source.other,
        monthly: source.monthly,
      };
    }),
    createdAt: new Date().toISOString(),
    collectedBy: 'Administrator',
    remarks,
    scope: billSelect.value === 'all' ? 'account' : 'bill',
    balanceBefore,
    balanceAfter,
  };
  const saved = await reviewPaymentReceipt(payment, customer, null, paymentRecords.office, () => {
    if (JSON.stringify(WaterStore.load()) !== snapshot || WaterStore.today() !== date) {
      throw new Error(
        'Records or the payment date changed. Close this preview and review the payment again.',
      );
    }
    paymentRecords.payments.push(payment);
    try {
      WaterStore.save(paymentRecords);
    } catch (error) {
      paymentRecords.payments.pop();
      throw error;
    }
  });
  if (!saved) {
    Object.assign(paymentRecords, WaterStore.load());
    return;
  }
  paymentForm.reset();
  showCashierRegistry();
  AdminUI.message(
    'Payment saved. Receipt: ' +
      receipt +
      '. Remaining selected balance: ' +
      WaterStore.money(balanceAfter),
  );
});

const requestedCustomerId = new URLSearchParams(location.search).get('customer');
const requestedCustomer = paymentRecords.customers.find((c) => c.id === requestedCustomerId);
if (requestedCustomer) document.getElementById('cashierSearch').value = requestedCustomer.account;
renderCashierRegistry();
