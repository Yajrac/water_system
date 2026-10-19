const customerRecords = WaterStore.load();
const customerForm = document.getElementById('customerForm');
customerForm.elements.barangay.replaceChildren(new Option('Select barangay', ''));
WaterStore.barangays.forEach((name) => customerForm.elements.barangay.add(new Option(name, name)));
const registerCustomerButton = document.getElementById('registerCustomer');
const printApplicationButton = document.getElementById('printApplication');
let editingCustomerId = null;
let savingCustomer = false;
let approvalDateEdited = false;
customerForm.elements.dateApproved.addEventListener('input', () => {
  approvalDateEdited = true;
});
customerForm.elements.dateApplied.addEventListener('change', () => {
  if (!editingCustomerId && !approvalDateEdited) {
    customerForm.elements.dateApproved.value = customerForm.elements.dateApplied.value;
    customerForm.elements.dateApproved.setCustomValidity('');
    updateRegistrationButtons();
  }
});
let draftSubmitterNumber = '';
const passwordPreview = document.getElementById('customerPassword');
const passwordToggle = document.getElementById('toggleCustomerPassword');
let usernameEdited = false;
let passwordEdited = false;
customerForm.elements.username.addEventListener('input', () => {
  usernameEdited = true;
});
passwordPreview.addEventListener('input', () => {
  passwordEdited = true;
});
passwordToggle.addEventListener('click', () => {
  const visible = passwordPreview.type === 'password';
  passwordPreview.type = visible ? 'text' : 'password';
  passwordToggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  passwordToggle.setAttribute('aria-pressed', String(visible));
  document.getElementById('customerPasswordSlash').style.display = visible ? 'block' : 'none';
});
function newSubmitterNumber() {
  let number;
  do {
    const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
    number = 'PWSS-' + WaterStore.today().replaceAll('-', '') + '-' + suffix;
  } while (customerRecords.customers.some((customer) => customer.submitterNumber === number));
  return number;
}
function syncContractDate() {
  const existing = customerRecords.customers.find((item) => item.id === editingCustomerId);
  customerForm.elements.contractDate.value = existing?.contractDate || WaterStore.today();
}
customerForm.elements.contractReceived.addEventListener('change', syncContractDate);
const contactField = customerForm.elements.contact;
const applicantNameField = customerForm.elements.name;
function generateCustomerCredentials() {
  const name = applicantNameField.value.trim();
  const existing = customerRecords.customers.find((item) => item.id === editingCustomerId);
  if (!name) {
    if (!usernameEdited) customerForm.elements.username.value = existing?.username || '';
    if (!passwordEdited) passwordPreview.value = '';
    return;
  }
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '.')
    .slice(0, 32);
  const stem = base.length >= 3 ? base : 'customer';
  let username = stem;
  let suffix = 2;
  while (
    customerRecords.customers.some(
      (item) =>
        item.id !== editingCustomerId &&
        (item.username || '').toLowerCase() === username.toLowerCase(),
    )
  ) {
    username = stem + '.' + suffix++;
  }
  if (!usernameEdited) customerForm.elements.username.value = existing?.username || username;
  // Preview only. Actual customer credentials need server-side provisioning.
  const firstName = base.split('.')[0] || 'Customer';
  if (!passwordEdited)
    passwordPreview.value =
      firstName.charAt(0).toUpperCase() +
      firstName.slice(1) +
      '@' +
      draftSubmitterNumber.split('-').pop();
}
const applicantCharacters = /^[\p{L}\p{M} .,'-]*$/u;
function syncApplicantName() {
  applicantNameField.value = CustomerValidation.fullName({
    firstName: customerForm.elements.firstName.value,
    middleName: customerForm.elements.middleName.value,
    lastName: customerForm.elements.lastName.value,
    extensionName: customerForm.elements.extensionName.value,
  });
  generateCustomerCredentials();
}
['firstName', 'middleName', 'lastName'].forEach((name) => {
  const field = customerForm.elements[name];
  field.addEventListener('beforeinput', (event) => {
    if (!event.isComposing && event.data && !applicantCharacters.test(event.data))
      event.preventDefault();
  });
  field.addEventListener('input', () => {
    field.setCustomValidity(
      applicantCharacters.test(field.value) ? '' : 'Use letters and name punctuation only.',
    );
    syncApplicantName();
  });
});
customerForm.elements.extensionName.addEventListener('change', syncApplicantName);
const registrationFields = [
  'certificateReceived',
  'contractReceived',
  'dateApproved',
  'approvedBy',
];
const installationFields = ['acknowledgementReceived', 'dateInstalled', 'meterNumber'];
const conditionalLabels = [...registrationFields, ...installationFields].map((name) => {
  const label = customerForm.elements[name].closest('label');
  const node = Array.from(label.childNodes).find(
    (node) => node.nodeType === 3 && node.textContent.trim(),
  );
  const marker = document.createElement('span');
  marker.className = 'required-marker';
  marker.textContent = '*';
  node.after(marker);
  return { name, node, marker, text: node.textContent };
});
let lastContactValue = '';
customerForm.querySelectorAll('label').forEach((label) => {
  const marker = Array.from(label.children).find((child) =>
    child.classList.contains('required-marker'),
  );
  if (!marker) return;
  const caption = document.createElement('span');
  label.insertBefore(caption, label.firstChild);
  while (caption.nextSibling) {
    const node = caption.nextSibling;
    caption.appendChild(node);
    if (node === marker) break;
  }
});
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
  approvalDateEdited = false;
  usernameEdited = false;
  passwordEdited = false;
  draftSubmitterNumber = customer?.submitterNumber || newSubmitterNumber();
  document.getElementById('submitterNumber').textContent = draftSubmitterNumber;
  passwordPreview.value = '';
  passwordPreview.type = 'password';
  passwordToggle.setAttribute('aria-label', 'Show password');
  passwordToggle.setAttribute('aria-pressed', 'false');
  document.getElementById('customerPasswordSlash').style.display = 'none';
  customerForm.elements.natureOfWork
    .querySelectorAll('[data-legacy]')
    .forEach((option) => option.remove());
  if (customer?.natureOfWork && !CustomerValidation.workTypes.includes(customer.natureOfWork)) {
    const legacy = new Option(customer.natureOfWork + ' (existing record)', customer.natureOfWork);
    legacy.dataset.legacy = 'true';
    customerForm.elements.natureOfWork.add(legacy);
  }
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
  if (customer && !customer.firstName && !customer.lastName) {
    // Legacy records keep all name words; staff can adjust compound surnames when editing.
    const parts = customer.name.trim().split(/\s+/);
    const suffix = parts[parts.length - 1];
    if (CustomerValidation.extensions.includes(suffix)) {
      customerForm.elements.extensionName.value = parts.pop();
    }
    customerForm.elements.lastName.value = parts.length > 1 ? parts.pop() : '';
    customerForm.elements.firstName.value = parts.join(' ');
  }
  syncApplicantName();
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
    customerForm.elements.dateApproved.value = customerForm.elements.dateApplied.value;
    customerForm.elements.serviceStatus.value = 'Approved';
  }
  // Meter readings are changed through billing after the first bill is generated.
  customerForm.elements.reading.disabled = Boolean(
    customer && customerRecords.bills.some((bill) => bill.customerId === customer.id),
  );
  updateApplicationDateDisplays();
  updateInstallationTotal();
  syncContractDate();
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
      Boolean(fields.dateInstalled.value && fields.meterNumber.value.trim())
    );
  }
  return true;
}
function updateRegistrationButtons() {
  const status = customerForm.elements.serviceStatus.value;
  conditionalLabels.forEach((label) => {
    const required =
      status !== 'Pending' && (!installationFields.includes(label.name) || status === 'Installed');
    label.node.textContent = label.text.trimEnd() + ' ';
    label.marker.hidden = !required;
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
  const reviewSnapshot = JSON.stringify(customerRecords);
  const reviewDate = WaterStore.today();
  syncContractDate();
  generateCustomerCredentials();
  const input = CustomerValidation.read(customerForm);
  const validationError = CustomerValidation.error(
    input,
    customerForm,
    customerRecords.customers.find((item) => item.id === editingCustomerId)?.natureOfWork,
  );
  if (validationError) return AdminUI.message(validationError);
  if (
    passwordPreview.value &&
    (passwordPreview.value.length < 8 || passwordPreview.value.length > 128)
  )
    return AdminUI.message('Password preview must contain 8–128 characters.');
  if (
    input.username &&
    customerRecords.customers.some(
      (item) =>
        item.id !== editingCustomerId &&
        (item.username || '').toLowerCase() === input.username.toLowerCase(),
    )
  )
    return AdminUI.message('That username is already assigned to another customer.');
  const customer = {
    ...customerRecords.customers.find((item) => item.id === editingCustomerId),
    ...input,
    id: editingCustomerId || WaterStore.id(),
  };
  const savedCustomer = customerRecords.customers.find((item) => item.id === editingCustomerId);
  if (
    customerRecords.customers.some(
      (item) => item.id !== customer.id && item.submitterNumber === draftSubmitterNumber,
    )
  )
    draftSubmitterNumber = newSubmitterNumber();
  customer.submitterNumber = savedCustomer?.submitterNumber || draftSubmitterNumber;
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
  savingCustomer = true;
  registerCustomerButton.disabled = true;
  try {
    const accepted = await confirmAction(
      'Review customer application',
      'Check the details before confirming registration.',
      'Confirm and save',
      customerRegistrationSummary(customer),
    );
    if (!accepted) return;
    if (JSON.stringify(WaterStore.load()) !== reviewSnapshot || WaterStore.today() !== reviewDate)
      return AdminUI.message(
        'Records or dates changed. Review the application again before saving.',
      );
    const index = customerRecords.customers.findIndex((item) => item.id === editingCustomerId);
    if (index === -1) customerRecords.customers.push(customer);
    else customerRecords.customers[index] = customer;
    WaterStore.save(customerRecords);
  } catch {
    return AdminUI.message('Customer could not be saved. Please try again.');
  } finally {
    savingCustomer = false;
    updateRegistrationButtons();
  }
  await showNotice(
    'Customer saved successfully',
    customer.name + ' has been registered.\nAccount number: ' + customer.account,
  );
  openCustomer(null);
  customerForm.querySelectorAll('input, select, textarea').forEach((field) => {
    field.setCustomValidity('');
    field.removeAttribute('aria-invalid');
  });
  history.replaceState(null, '', 'customer-form.html');
  showCustomerStep(0, false);
  customerForm.elements.firstName.focus();
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
  syncContractDate();
  const details = CustomerValidation.read(customerForm);
  const error = CustomerValidation.error(
    details,
    customerForm,
    customerRecords.customers.find((item) => item.id === editingCustomerId)?.natureOfWork,
  );
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

function customerRegistrationSummary(customer) {
  const paper = document.createElement('section');
  paper.className = 'registration-paper';
  const header = document.createElement('header');
  const logo = document.createElement('img');
  logo.src = '../assets/images/water_system_logo.jpg';
  logo.alt = 'PWSS logo';
  const title = document.createElement('div');
  const name = document.createElement('strong');
  name.textContent = 'PIO DURAN WATER SUPPLY SYSTEM';
  const subtitle = document.createElement('p');
  subtitle.textContent = 'Customer registration record';
  title.append(name, subtitle);
  header.append(logo, title);
  paper.appendChild(header);
  const details = document.createElement('dl');
  const rows = [
    ['Account number', customer.account],
    ['Submitter number', customer.submitterNumber],
    ['Application number', customer.applicationNumber],
    ['Registration status', customer.registrationStatus],
    ['Full name', customer.name],
    ['Gender', customer.gender],
    ['Mobile number', customer.contact],
    ['Customer type', customer.customerType],
    [
      'Service address',
      [customer.address, customer.street, customer.barangay].filter(Boolean).join(', '),
    ],
    ['Date applied', customer.dateApplied],
    ['Date approved', customer.dateApproved],
    ['Approved by', customer.approvedBy],
    ['Service status', customer.serviceStatus],
    ['Meter number', customer.meterNumber],
    ['Initial / current reading', customer.reading + ' m\u00b3'],
    ['Username', customer.username],
  ];
  rows.forEach(([label, value]) => {
    const group = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value || 'Not recorded';
    group.append(term, description);
    details.appendChild(group);
  });
  paper.appendChild(details);
  return paper;
}

function updateApplicationDateDisplays() {
  ['dateApplied', 'dateApproved'].forEach((name) => {
    const value = customerForm.elements[name].value;
    const display = document.getElementById(name + 'Display');
    display.dateTime = value;
    display.textContent =
      value && Validation.date(value)
        ? new Intl.DateTimeFormat('en-PH', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'Asia/Manila',
          }).format(new Date(value + 'T12:00:00+08:00'))
        : 'Not recorded';
  });
}
