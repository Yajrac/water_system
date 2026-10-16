const customerRecords = WaterStore.load();
const customerForm = document.getElementById('customerForm');
const registerCustomerButton = document.getElementById('registerCustomer');
const printApplicationButton = document.getElementById('printApplication');
let editingCustomerId = null;
let savingCustomer = false;
const contactField = customerForm.elements.contact;
const registrationFields = [
  'certificateReceived',
  'contractReceived',
  'dateApproved',
  'approvedBy',
];
const installationFields = [
  'acknowledgementReceived',
  'dateInstalled',
  'meterNumber',
  'installedBy',
];
const conditionalLabels = [...registrationFields, ...installationFields].map((name) => {
  const label = customerForm.elements[name].closest('label');
  const node = Array.from(label.childNodes).find(
    (node) => node.nodeType === 3 && node.textContent.trim(),
  );
  return { name, node, text: node.textContent };
});
let lastContactValue = '';
contactField.addEventListener('beforeinput', (event) => {
  if (event.data && /\D/.test(event.data)) event.preventDefault();
});
contactField.addEventListener('input', () => {
  if (/^\d{0,10}$/.test(contactField.value)) lastContactValue = contactField.value;
  else contactField.value = lastContactValue;
});
contactField.addEventListener('paste', (event) => {
  event.preventDefault();
  const raw = event.clipboardData.getData('text').trim();
  const value = raw.replace(/^(\+63|0)/, '');
  if (!/^9\d{9}$/.test(value))
    return AdminUI.message(
      'Paste a valid Philippine mobile number, such as 09123456789 or +639123456789.',
    );
  contactField.value = value;
  lastContactValue = value;
});

function openCustomer(customer) {
  editingCustomerId = customer ? customer.id : null;
  customerForm.reset();
  document.getElementById('customerTitle').textContent = customer
    ? 'Edit customer'
    : 'Add customer';
  if (customer) {
    Array.from(customerForm.elements)
      .filter((field) => field.name)
      .forEach((field) => {
        if (field.type === 'checkbox') field.checked = Boolean(customer[field.name]);
        else field.value = customer[field.name] ?? (field.type === 'number' ? '0' : '');
      });
  }
  if (customer) {
    customerForm.elements.contact.value = (customer.contact || '').replace(/^(\+63|0)/, '');
  }
  lastContactValue = contactField.value;
  const purok = customer?.address?.match(/^Purok\s*([1-7])(?:\b|,)/i);
  customerForm.elements.address.value = purok ? 'Purok ' + purok[1] : '';
  customerForm.elements.street.value =
    customer?.street ||
    (purok
      ? customer.address.slice(purok[0].length).replace(/^[,\s]+/, '')
      : customer?.address || '');
  customerForm.elements.dateApplied.max = WaterStore.today();
  customerForm.elements.dateApproved.max = WaterStore.today();
  customerForm.elements.dateInstalled.max = WaterStore.today();
  if (!customer) {
    customerForm.elements.dateApplied.value = WaterStore.today();
    customerForm.elements.serviceStatus.value = 'Approved';
  }
  // Meter readings are changed through billing after the first bill is generated.
  customerForm.elements.reading.disabled = Boolean(
    customer && customerRecords.bills.some((bill) => bill.customerId === customer.id),
  );
  updateInstallationTotal();
  updateRegistrationButtons();
}

function registrationReady() {
  const fields = customerForm.elements;
  if (
    !fields.certificateReceived.checked ||
    !fields.contractReceived.checked ||
    !fields.dateApproved.value ||
    !fields.approvedBy.value.trim()
  )
    return false;
  if (fields.serviceStatus.value === 'Pending') return false;
  if (fields.serviceStatus.value === 'Installed') {
    return (
      fields.acknowledgementReceived.checked &&
      Boolean(
        fields.dateInstalled.value &&
        fields.meterNumber.value.trim() &&
        fields.installedBy.value.trim(),
      )
    );
  }
  return true;
}
function updateRegistrationButtons() {
  const status = customerForm.elements.serviceStatus.value;
  conditionalLabels.forEach((label) => {
    const required =
      status !== 'Pending' && (!installationFields.includes(label.name) || status === 'Installed');
    label.node.textContent = label.text.trimEnd() + (required ? ' *' : '') + ' ';
  });
  const existing = customerRecords.customers.find((customer) => customer.id === editingCustomerId);
  const alreadyRegistered = existing && WaterStore.isRegistered(existing);
  registerCustomerButton.textContent = alreadyRegistered
    ? 'Save registered customer'
    : 'Register customer';
  registerCustomerButton.disabled = !registrationReady();
}

customerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (savingCustomer) return;
  if (!customerForm.checkValidity()) return customerForm.reportValidity();
  if (!registrationReady())
    return AdminUI.message('Complete the required verification before registering this customer.');
  // Refresh the saved records before assigning numbers.
  Object.assign(customerRecords, WaterStore.load());
  const input = CustomerValidation.read(customerForm);
  const validationError = CustomerValidation.error(input, customerForm);
  if (validationError) return AdminUI.message(validationError);
  const customer = {
    ...customerRecords.customers.find((item) => item.id === editingCustomerId),
    ...input,
    id: editingCustomerId || WaterStore.id(),
  };
  const savedCustomer = customerRecords.customers.find((item) => item.id === editingCustomerId);
  if (editingCustomerId && !savedCustomer)
    return AdminUI.message('Customer no longer exists. Return to the customer list.');
  if (
    savedCustomer &&
    customerRecords.bills.some((bill) => bill.customerId === savedCustomer.id) &&
    customer.reading !== savedCustomer.reading
  ) {
    return AdminUI.message(
      'This meter reading has billing records. Update readings through Meter Entry.',
    );
  }
  customer.contact = '+63' + customer.contact;
  customer.registrationStatus = 'Registered';
  customer.installationTotal = installationTotal();
  if (
    !Number.isFinite(customer.installationTotal) ||
    customer.installationTotal > Number.MAX_SAFE_INTEGER / 100
  )
    return AdminUI.message('The installation estimate is too large. Check quantities and charges.');
  customer.account =
    savedCustomer?.account || WaterStore.nextReference(customerRecords, 'PWSS', 'account');
  customer.applicationNumber =
    savedCustomer?.applicationNumber ||
    WaterStore.nextReference(customerRecords, 'APP', 'applicationNumber');
  if (
    customerRecords.customers.some(
      (item) =>
        item.id !== customer.id && item.account.toLowerCase() === customer.account.toLowerCase(),
    )
  ) {
    return AdminUI.message('That account number is already registered.');
  }
  const index = customerRecords.customers.findIndex((item) => item.id === editingCustomerId);
  if (index === -1) customerRecords.customers.push(customer);
  else customerRecords.customers[index] = customer;
  try {
    WaterStore.save(customerRecords);
  } catch {
    return AdminUI.message('Customer could not be saved. Please try again.');
  }
  savingCustomer = true;
  registerCustomerButton.disabled = true;
  await showNotice(
    'Customer saved successfully',
    'Please check the saved details:\n\n' +
      'Customer: ' +
      customer.name +
      '\n' +
      'Account number: ' +
      customer.account +
      '\n' +
      'Application number: ' +
      customer.applicationNumber +
      '\n' +
      'Contact: ' +
      customer.contact +
      '\n' +
      'Address: ' +
      [customer.address, customer.street, customer.barangay].filter(Boolean).join(', ') +
      '\n' +
      'Status: ' +
      customer.registrationStatus,
  );
  savingCustomer = false;
  openCustomer(customer);
  history.replaceState(null, '', 'customer-form.html?id=' + encodeURIComponent(customer.id));
  document.getElementById('cancelCustomer').textContent = 'Back to customers';
});

function installationTotal() {
  const fields = customerForm.elements;
  return (
    Math.round(
      (Number(fields.installationFee.value || 0) +
        Number(fields.setbackLength.value || 0) * Number(fields.setbackRate.value || 0) +
        Number(fields.reinstallationFee.value || 0) +
        Number(fields.violationFee.value || 0)) *
        100,
    ) / 100
  );
}
function updateInstallationTotal() {
  document.getElementById('installationTotal').textContent = WaterStore.money(installationTotal());
}
customerForm.addEventListener('input', updateInstallationTotal);
customerForm.addEventListener('input', updateRegistrationButtons);
customerForm.addEventListener('change', updateRegistrationButtons);
printApplicationButton.addEventListener('click', () => {
  if (!customerForm.checkValidity()) return customerForm.reportValidity();
  const details = CustomerValidation.read(customerForm);
  const error = CustomerValidation.error(details, customerForm);
  if (error) return AdminUI.message(error);
  const existing = customerRecords.customers.find((customer) => customer.id === editingCustomerId);
  const preview = {
    ...existing,
    ...details,
    contact: '+63' + details.contact,
    installationTotal: installationTotal(),
  };
  try {
    sessionStorage.setItem('pwss-application-print-preview', JSON.stringify(preview));
  } catch {
    return AdminUI.message('Print preview could not be prepared. Please try again.');
  }
  location.href = 'customer-application.html?preview=1';
});

document.getElementById('cancelCustomer').addEventListener('click', () => {
  location.href = 'customers.html';
});
const requestedCustomerId = new URLSearchParams(location.search).get('id');
const requestedCustomer = customerRecords.customers.find(
  (customer) => customer.id === requestedCustomerId,
);
if (requestedCustomerId && !requestedCustomer) {
  customerForm.hidden = true;
  AdminUI.message('Customer not found. Return to the customer list to choose an existing record.');
} else {
  openCustomer(requestedCustomer || null);
}
