const customerRecords = WaterStore.load();
const customerForm = document.getElementById('customerForm');
const saveApplicationButton = document.getElementById('saveApplication');
const registerCustomerButton = document.getElementById('registerCustomer');
const printApplicationButton = document.getElementById('printApplication');
let editingCustomerId = null;

function openCustomer(customer) {
  editingCustomerId = customer ? customer.id : null;
  customerForm.reset();
  document.getElementById('customerTitle').textContent = customer ? 'Edit customer' : 'Add customer';
  if (customer) {
    Array.from(customerForm.elements).filter(field => field.name).forEach(field => {
      if (field.type === 'checkbox') field.checked = Boolean(customer[field.name]);
      else field.value = customer[field.name] ?? (field.type === 'number' ? '0' : '');
    });
  }
  customerForm.elements.dateApplied.max = WaterStore.today();
  customerForm.elements.dateApproved.max = WaterStore.today();
  customerForm.elements.dateInstalled.max = WaterStore.today();
  if (!customer) customerForm.elements.dateApplied.value = WaterStore.today();
  // Meter readings are changed through billing after the first bill is generated.
  customerForm.elements.reading.disabled = Boolean(customer && customerRecords.bills.some(bill => bill.customerId === customer.id));
  printApplicationButton.disabled = !customer;
  updateInstallationTotal();
  updateRegistrationButtons();
}

function registrationReady() {
  const fields = customerForm.elements;
  if (!fields.certificateReceived.checked || !fields.contractReceived.checked || !fields.dateApproved.value || !fields.approvedBy.value.trim()) return false;
  if (fields.serviceStatus.value === 'Pending') return false;
  if (fields.serviceStatus.value === 'Installed') {
    return fields.acknowledgementReceived.checked && Boolean(fields.dateInstalled.value && fields.meterNumber.value.trim() && fields.installedBy.value.trim());
  }
  return true;
}
function updateRegistrationButtons() {
  const existing = customerRecords.customers.find(customer => customer.id === editingCustomerId);
  const alreadyRegistered = existing && WaterStore.isRegistered(existing);
  saveApplicationButton.hidden = Boolean(alreadyRegistered);
  registerCustomerButton.textContent = alreadyRegistered ? 'Save registered customer' : 'Register customer';
  registerCustomerButton.disabled = !registrationReady();
  document.getElementById('registrationHelp').textContent = registrationReady()
    ? 'Verification is complete. Registration is available after the form fields are validated.'
    : 'To register: verify the barangay certificate and signed contract, select Approved or Installed, and enter the approval date and approver. Installed service also needs its signed acknowledgement, date, meter number and installer. Pending applications can be saved separately.';
}

customerForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!customerForm.checkValidity()) return customerForm.reportValidity();
  const existing = customerRecords.customers.find(item => item.id === editingCustomerId);
  const registering = event.submitter === registerCustomerButton || (existing && WaterStore.isRegistered(existing));
  if (registering && !registrationReady()) return AdminUI.message('Complete the required verification before registering this customer.');
  // Refresh the saved records before assigning numbers.
  Object.assign(customerRecords, WaterStore.load());
  const amountFields = ['installationFee', 'setbackRate', 'reinstallationFee', 'violationFee'];
  const readingFields = ['reading', 'setbackLength', 'removedReading', 'estimatedLiters'];
  if (amountFields.some(name => !Validation.money(customerForm.elements[name].value || '0')) ||
      readingFields.some(name => !/^\d+(\.\d{1,3})?$/.test(customerForm.elements[name].value || (name === 'reading' ? '' : '0')) || !Number.isFinite(Number(customerForm.elements[name].value)))) {
    return AdminUI.message('Enter non-negative numbers only: up to two decimals for charges and three for meter readings or quantities.');
  }
  const customer = {
    ...customerRecords.customers.find(item => item.id === editingCustomerId),
    id: editingCustomerId || WaterStore.id(),
    account: customerForm.elements.account.value.trim(),
    name: customerForm.elements.name.value.trim(),
    barangay: customerForm.elements.barangay.value.trim(),
    address: customerForm.elements.address.value.trim(),
    contact: customerForm.elements.contact.value.trim(),
    reading: Number(customerForm.elements.reading.value)
  };
  Array.from(customerForm.elements).filter(field => field.name).forEach(field => {
    if (field.type === 'checkbox') customer[field.name] = field.checked;
    else if (field.type === 'number') customer[field.name] = Number(field.value || 0);
    else customer[field.name] = field.value.trim();
  });
  if (!customer.name || !customer.barangay) return AdminUI.message('Applicant name and barangay are required.');
  if (!Number.isFinite(customer.reading) || customer.reading < 0) return AdminUI.message('Enter a valid non-negative meter reading.');
  if (!/^[\p{L}\p{M} .,'-]+$/u.test(customer.name)) return AdminUI.message('Applicant name should contain letters, spaces, commas, apostrophes, periods or hyphens.');
  if (!Validation.phone(customer.contact)) return AdminUI.message('Enter a Philippine mobile number: 09 followed by 9 digits, or +639 followed by 9 digits.');
  if (!WaterStore.barangays.includes(customer.barangay)) return AdminUI.message('Choose one of the seven project barangays.');
  if (!['Residential', 'Commercial'].includes(customer.customerType) || !['Pending', 'Approved', 'Installed'].includes(customer.serviceStatus)) return AdminUI.message('Choose a supported customer type and service status.');
  for (const field of Array.from(customerForm.elements).filter(field => field.type === 'date')) {
    if (field.value && (!Validation.date(field.value) || field.value > WaterStore.today())) return AdminUI.message('Enter a valid date that is not in the future.');
  }
  if (customer.dateApproved && customer.dateApplied && customer.dateApproved < customer.dateApplied) return AdminUI.message('Approval date cannot be before the application date.');
  if (customer.dateInstalled && customer.dateApproved && customer.dateInstalled < customer.dateApproved) return AdminUI.message('Installation date cannot be before the approval date.');
  customer.registrationStatus = registering ? 'Registered' : 'Application';
  if (!registering) customer.serviceStatus = 'Pending';
  customer.installationTotal = installationTotal();
  customer.account = existing?.account || WaterStore.nextReference(customerRecords, 'PWSS', 'account');
  customer.applicationNumber = existing?.applicationNumber || WaterStore.nextReference(customerRecords, 'APP', 'applicationNumber');
  if (customerRecords.customers.some(item => item.id !== customer.id && item.account.toLowerCase() === customer.account.toLowerCase())) {
    return AdminUI.message('That account number is already registered.');
  }
  const index = customerRecords.customers.findIndex(item => item.id === editingCustomerId);
  if (index === -1) customerRecords.customers.push(customer);
  else customerRecords.customers[index] = customer;
  WaterStore.save(customerRecords);
  location.href = 'customers.html?saved=' + encodeURIComponent(customer.id);
});

function installationTotal() {
  const fields = customerForm.elements;
  return Math.round((Number(fields.installationFee.value || 0) +
    Number(fields.setbackLength.value || 0) * Number(fields.setbackRate.value || 0) +
    Number(fields.reinstallationFee.value || 0) + Number(fields.violationFee.value || 0)) * 100) / 100;
}
function updateInstallationTotal() {
  document.getElementById('installationTotal').textContent = WaterStore.money(installationTotal());
}
customerForm.addEventListener('input', updateInstallationTotal);
customerForm.addEventListener('input', updateRegistrationButtons);
customerForm.addEventListener('change', updateRegistrationButtons);
printApplicationButton.addEventListener('click', () => {
  location.href = 'customer-application.html?id=' + encodeURIComponent(editingCustomerId);
});

document.getElementById('cancelCustomer').addEventListener('click', () => { location.href = 'customers.html'; });
const requestedCustomerId = new URLSearchParams(location.search).get('id');
const requestedCustomer = customerRecords.customers.find(customer => customer.id === requestedCustomerId);
if (requestedCustomerId && !requestedCustomer) {
  customerForm.hidden = true;
  AdminUI.message('Customer not found. Return to the customer list to choose an existing record.');
} else {
  openCustomer(requestedCustomer || null);
}
