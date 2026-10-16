const paymentRecords = WaterStore.load();
const paymentForm = document.getElementById('paymentForm');
const billSelect = document.getElementById('paymentBill');
const customerSearch = document.getElementById('paymentCustomerSearch');
const customerResults = document.getElementById('paymentCustomerResults');
const paymentButton = document.getElementById('recordPaymentButton');
let selectedCustomerId = '';

function loadPaymentChoices() {
  Object.assign(paymentRecords, WaterStore.load());
  paymentForm.elements.amount.value = '';
  paymentForm.elements.amount.setCustomValidity('');
  paymentButton.disabled = true;
  billSelect.replaceChildren(new Option('Select an outstanding bill', ''));
  const customer = paymentRecords.customers.find(item => item.id === selectedCustomerId);
  const bills = paymentRecords.bills.filter(bill => bill.customerId === selectedCustomerId && WaterStore.balance(bill, paymentRecords) > 0)
    .sort((a, b) => a.cycle.localeCompare(b.cycle) || a.due.localeCompare(b.due));
  bills.forEach(bill => {
    billSelect.add(new Option(bill.cycle + ' · Due ' + bill.due + ' · Balance ' + WaterStore.money(WaterStore.balance(bill, paymentRecords)), bill.id));
  });
  billSelect.disabled = !bills.length;
  if (bills.length) billSelect.add(new Option('All outstanding bills · ' + WaterStore.money(bills.reduce((sum, bill) => sum + WaterStore.balance(bill, paymentRecords), 0)), 'all'), 1);
  document.getElementById('selectedPaymentCustomer').hidden = !customer;
  if (customer) {
    document.getElementById('selectedCustomerName').textContent = customer.name;
    document.getElementById('selectedCustomerAccount').textContent = customer.account;
    document.getElementById('selectedCustomerBarangay').textContent = customer.barangay;
    document.getElementById('selectedCustomerBalance').textContent = WaterStore.money(bills.reduce((sum, bill) => sum + WaterStore.balance(bill, paymentRecords), 0));
  }
  document.getElementById('customerBillHelp').textContent = !customer ? 'Search for a customer to see their outstanding bills.' : bills.length ? bills.length + ' outstanding bills. Choose the billing month to pay below.' : 'This customer has no outstanding bills.';
  updatePaymentLinks(selectedCustomerId);
  if (bills.length) {
    billSelect.value = 'all';
    updateSelectedBill();
    document.getElementById('customerBillHelp').textContent = 'Total unpaid balance is filled in below. Enter the amount the customer can pay; it is applied to the oldest bills first. You may also choose a specific billing month.';
  }
}
function updateSelectedBill() {
  const bills = selectedPaymentBills();
  const balance = bills.reduce((sum, bill) => sum + WaterStore.balance(bill, paymentRecords), 0);
  paymentForm.elements.amount.value = bills.length ? balance.toFixed(2) : '';
  paymentForm.elements.amount.setCustomValidity('');
  paymentButton.disabled = !bills.length || balance <= 0;
}
function selectedPaymentBills() {
  return paymentRecords.bills.filter(bill => bill.customerId === selectedCustomerId && WaterStore.balance(bill, paymentRecords) > 0 && (billSelect.value === 'all' || bill.id === billSelect.value));
}
function searchPaymentCustomers() {
  const search = customerSearch.value.trim().toLowerCase();
  customerResults.replaceChildren();
  selectedCustomerId = '';
  loadPaymentChoices();
  if (!search) {
    document.getElementById('customerSearchCount').textContent = 'Type a customer name or account number.';
    return;
  }
  const matches = paymentRecords.customers.filter(customer => (customer.name + ' ' + customer.account).toLowerCase().includes(search));
  const exactAccount = matches.find(customer => customer.account.toLowerCase() === search);
  if (exactAccount || matches.length === 1) {
    selectPaymentCustomer(exactAccount || matches[0]);
  }
  if (!selectedCustomerId) document.getElementById('customerSearchCount').textContent = !matches.length ? 'No matching customers found.' : matches.length + ' matches. Choose the correct account below' + (matches.length > 20 ? ' or refine your search (first 20 shown).' : '.');
  matches.slice(0, 20).forEach(customer => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'customer-result-button';
    const name = document.createElement('strong'); name.textContent = customer.name;
    const account = document.createElement('span'); account.textContent = customer.account + ' · ' + customer.barangay;
    button.append(name, account);
    button.addEventListener('click', () => selectPaymentCustomer(customer));
    item.appendChild(button);
    customerResults.appendChild(item);
  });
}
function selectPaymentCustomer(customer) {
  selectedCustomerId = customer.id;
  customerResults.replaceChildren();
  document.getElementById('customerSearchCount').textContent = 'Customer found: ' + customer.name + ' · ' + customer.account;
  loadPaymentChoices();
}
paymentForm.addEventListener('submit', async event => {
  event.preventDefault();
  Object.assign(paymentRecords, WaterStore.load());
  const bills = selectedPaymentBills();
  const amountText = paymentForm.elements.amount.value.trim();
  const amount = Number(amountText);
  const date = WaterStore.today();
  if (!bills.length || !selectedCustomerId || amount <= 0 || !Number.isFinite(amount)) return AdminUI.message('Select a customer with outstanding bills and enter a valid payment amount.');
  if (!Validation.money(amountText)) return AdminUI.message('Amount must be a positive number with at most two decimal places. Letters and scientific notation are not accepted.');
  if (!Validation.date(date)) return AdminUI.message('Choose a valid payment date.');
  if (!['Cash', 'Bank transfer', 'GCash'].includes(paymentForm.elements.method.value)) return AdminUI.message('Choose a supported payment method.');
  const balanceBefore = Math.round(bills.reduce((sum, bill) => sum + WaterStore.balance(bill, paymentRecords), 0) * 100) / 100;
  if (amount > balanceBefore) return AdminUI.message('Payment cannot exceed the selected outstanding balance.');
  const allocations = WaterStore.allocatePayment(bills, amount, paymentRecords);
  if (allocations.some(item => {
    const bill = bills.find(bill => bill.id === item.billId);
    return date < (bill.generatedOn || bill.cycle + '-01');
  })) return AdminUI.message('Payment cannot be recorded before bill generation.');
  const balanceAfter = Math.round((balanceBefore - amount) * 100) / 100;
  const snapshot = JSON.stringify(paymentRecords);
  const method = paymentForm.elements.method.value;
  // Preview the next reference without storing it or consuming it on cancel.
  const receipt = WaterStore.nextReference(paymentRecords, 'RCP', 'receipt', 'payments');
  const customer = paymentRecords.customers.find(item => item.id === selectedCustomerId);
  if (!customer) return AdminUI.message('Customer no longer exists. Search again before saving.');
  const payment = { id: WaterStore.id(), customerId: selectedCustomerId, receipt, amount, date, method, allocations, scope: billSelect.value === 'all' ? 'account' : 'bill', balanceBefore, balanceAfter };
  const saved = await reviewPaymentReceipt(payment, customer, null, paymentRecords.office, () => {
    if (JSON.stringify(WaterStore.load()) !== snapshot || WaterStore.today() !== date) {
      throw new Error('Records or the payment date changed. Close this preview and review the payment again.');
    }
    paymentRecords.payments.push(payment);
    try { WaterStore.save(paymentRecords); }
    catch (error) { paymentRecords.payments.pop(); throw error; }
  });
  if (!saved) { Object.assign(paymentRecords, WaterStore.load()); return; }
  paymentForm.reset();
  loadPaymentChoices();
  AdminUI.message('Payment saved. Receipt: ' + receipt + '. Remaining selected balance: ' + WaterStore.money(balanceAfter));
});
billSelect.addEventListener('change', updateSelectedBill);
paymentForm.addEventListener('invalid', event => {
  const name = event.target.name;
  const labels = { receipt: 'receipt number', amount: 'amount paid', date: 'payment date', billId: 'bill to pay' };
  AdminUI.message('Please check the ' + (labels[name] || 'required field') + ' before saving.');
}, true);
customerSearch.addEventListener('input', searchPaymentCustomers);
searchPaymentCustomers();
const requestedCustomerId = new URLSearchParams(location.search).get('customer');
const requestedCustomer = paymentRecords.customers.find(customer => customer.id === requestedCustomerId);
if (requestedCustomer) {
  customerSearch.value = requestedCustomer.account;
  searchPaymentCustomers();
  selectPaymentCustomer(requestedCustomer);
}
