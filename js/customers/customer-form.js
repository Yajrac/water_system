const customerRecords = { customers: [], bills: [] };
let customerFormLoading = true;
const customerForm = document.getElementById('customerForm');
customerForm.elements.barangay.replaceChildren(new Option('Select barangay', ''));
customerForm.inert = true;
const registerCustomerButton = document.getElementById('registerCustomer');
const printApplicationButton = document.getElementById('printApplication');
document.getElementById('generateMeterNumber').addEventListener('click', async () => {
  const field = customerForm.elements.meterNumber;
  if (field.value.trim() && !(await confirmAction(
    'Replace meter number?',
    'Generate a new suggested meter number to replace the current value?',
    'Generate number',
  ))) return;
  field.value = 'MTR-' + crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
  field.setCustomValidity('');
  field.removeAttribute('aria-invalid');
  updateRegistrationButtons();
});
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
let credentialSeed = '';
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
  let username = stem + '.' + credentialSeed.slice(0, 4).toLowerCase();
  let suffix = 2;
  while (
    customerRecords.customers.some(
      (item) =>
        item.id !== editingCustomerId &&
        (item.username || '').toLowerCase() === username.toLowerCase(),
    )
  ) {
    username = stem + '.' + credentialSeed.slice(0, 4).toLowerCase() + suffix++;
  }
  if (!usernameEdited) customerForm.elements.username.value = existing?.username || username;
  // Existing passwords stay unchanged unless staff explicitly enter a replacement.
  if (existing?.userId && !passwordEdited) {
    passwordPreview.value = '';
    return;
  }
  if (!passwordEdited) passwordPreview.value = credentialSeed;
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
  field.addEventListener('input', (event) => {
    if (event?.isComposing) return;
    const capitalized = field.value.replace(
      /(^|[\s\-'’])(\p{L})/gu,
      (_, prefix, letter) => prefix + letter.toUpperCase(),
    );
    if (field.value !== capitalized) {
      const start = field.selectionStart;
      const end = field.selectionEnd;
      field.value = capitalized;
      if (start !== null && start !== undefined) field.setSelectionRange(start, end);
    }
    field.setCustomValidity(
      applicantCharacters.test(field.value) ? '' : 'Use letters and name punctuation only.',
    );
    syncApplicantName();
  });
});
customerForm.elements.extensionName.addEventListener('change', syncApplicantName);
const registrationFields = ['dateApproved', 'approvedBy'];
const installationFields = ['dateInstalled', 'meterNumber'];
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
  if (!event.data) return;
  const start = contactField.selectionStart ?? contactField.value.length;
  const end = contactField.selectionEnd ?? start;
  const next = contactField.value.slice(0, start) + event.data + contactField.value.slice(end);
  if (!CustomerValidation.mobileDraft(next)) event.preventDefault();
});
contactField.addEventListener('input', () => {
  if (CustomerValidation.mobileDraft(contactField.value)) lastContactValue = contactField.value;
  else contactField.value = lastContactValue;
  contactField.maxLength = contactField.value.startsWith('9') ? 10 : 11;
});
contactField.addEventListener('paste', (event) => {
  event.preventDefault();
  const raw = event.clipboardData.getData('text').trim();
  const value = raw;
  if (!/^0?9\d{9}$/.test(value))
    return AdminUI.message(
      'Paste 11 digits starting with 09 or 10 digits starting with 9.',
    );
  contactField.value = value;
  lastContactValue = value;
  contactField.maxLength = value.startsWith('9') ? 10 : 11;
});

function openCustomer(customer) {
  editingCustomerId = customer ? customer.id : null;
  customerForm.reset();
  approvalDateEdited = false;
  usernameEdited = false;
  passwordEdited = false;
  // Twelve random characters; encode UUID randomness without customer-name prefixes.
  const randomHex = crypto.randomUUID().replaceAll('-', '')
    .split('').filter((_, index) => index !== 12 && index !== 16).join('');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  credentialSeed = Array.from({ length: 12 }, (_, index) => {
    const chunk = Number.parseInt(randomHex.slice(index * 2, index * 2 + 2), 16);
    return alphabet[chunk % alphabet.length];
  }).join('');
  document.getElementById('submitterNumber').textContent =
    customer?.submitterNumber || 'Assigned on save';
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
    customerForm.elements.contact.value = (customer.contact || '').replace(/^(\+?63|0)/, '');
  }
  lastContactValue = contactField.value;
  contactField.maxLength = contactField.value.startsWith('9') ? 10 : 11;
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
  customerForm.elements.approvedBy.value = customer?.approvedBy || AdminAuth.user?.username || '';
  customerForm.elements.approvedBy.readOnly = true;
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
  for (const name of CustomerValidation.dates) customerForm.elements[name].max = WaterStore.today();
  if (!customer) {
    customerForm.elements.dateApplied.value = WaterStore.today();
    customerForm.elements.dateApproved.value = customerForm.elements.dateApplied.value;
    customerForm.elements.serviceStatus.value = 'Approved';
  }
  // Meter readings are changed through billing after the first bill is generated.
  customerForm.elements.reading.disabled = Boolean(
    customer && (customer.hasBills || customer.hasMeterEntries),
  );
  updateApplicationDateDisplays();
  updateInstallationTotal();
  updateRegistrationButtons();
}

function registrationReady() {
  const fields = customerForm.elements;
  if (!fields.dateApproved.value || !fields.approvedBy.value.trim()) return false;
  if (fields.serviceStatus.value === 'Pending') return false;
  if (fields.serviceStatus.value === 'Installed') {
    return Boolean(fields.dateInstalled.value && fields.meterNumber.value.trim());
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
  registerCustomerButton.disabled = customerFormLoading || savingCustomer;
}

customerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (savingCustomer || customerFormLoading) return;
  const invalidField = Array.from(customerForm.elements).find(
    (field) => field.willValidate && !field.validity.valid,
  );
  if (invalidField) {
    const section = invalidField.closest('.customer-section');
    const index = customerSteps.indexOf(section);
    if (index >= 0) showCustomerStep(index, false);
    AdminUI.message(invalidField.validationMessage || 'Check the highlighted field.');
    invalidField.focus();
    invalidField.reportValidity();
    return;
  }
  if (!registrationReady()) {
    const fields = customerForm.elements;
    const missing = !fields.approvedBy.value.trim()
      ? 'Enter the approver name in the Installation step.'
      : fields.serviceStatus.value === 'Pending'
        ? 'Select Approved or Installed in the Installation step.'
        : 'Complete the approval date and, for Installed service, the installation date and meter number.';
    showCustomerStep(1, false);
    return AdminUI.message(missing);
  }
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
    return AdminUI.message('Password must contain 8–128 characters.');
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
    id: editingCustomerId || null,
  };
  const savedCustomer = customerRecords.customers.find((item) => item.id === editingCustomerId);
  customer.contact = '+63' + customer.contact;
  customer.registrationStatus = 'Registered';
  customer.installationTotal = installationTotal();
  customer.account = savedCustomer?.account || 'Assigned on save';
  customer.applicationNumber = savedCustomer?.applicationNumber || 'Assigned on save';
  customer.submitterNumber = savedCustomer?.submitterNumber || 'Assigned on save';
  let persisted;
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
    persisted = await CustomerAPI.save(customer, passwordPreview.value, editingCustomerId);
    customerRecords.customers = [persisted];
  } catch (error) {
    return AdminUI.message(error.message);
  } finally {
    savingCustomer = false;
    updateRegistrationButtons();
  }
  await showNotice(
    savedCustomer ? 'Customer updated successfully' : 'Customer saved successfully',
    customer.name +
      (savedCustomer ? ' has been updated.' : ' has been registered.') +
      '\nAccount number: ' +
      persisted.account,
  );
  if (savedCustomer) {
    location.href = 'customers.html';
    return;
  }
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
if (typeof window !== 'undefined') window.addEventListener('unhandledrejection', (event) => {
  AdminUI.message('Customer operation failed: ' + (event.reason?.message || 'Please reload and try again.'));
});
async function loadCustomerForm() {
  customerFormLoading = true;
  customerForm.inert = true;
  AdminUI.message('Loading customer form...');
  try {
    const barangays = await CustomerAPI.loadBarangays();
    const requested = requestedCustomerId ? await CustomerAPI.profile(requestedCustomerId) : null;
    customerForm.elements.barangay.replaceChildren(new Option('Select barangay', ''));
    barangays
      .filter(
        (item) =>
          Number(item.is_active) === 1 || String(item.id) === requested?.customer.barangayId,
      )
      .forEach((item) => customerForm.elements.barangay.add(new Option(item.name, item.name)));
    customerRecords.customers = requested ? [requested.customer] : [];
    customerRecords.bills = requested?.bills || [];
    customerFormLoading = false;
    customerForm.inert = false;
    openCustomer(requested?.customer || null);
    AdminUI.message('');
  } catch (error) {
    AdminUI.message(error.message + ' Reload this page to try again.');
  }
}
// Update reference choices only; never overwrite an applicant's unsaved fields.
async function refreshCustomerChoices() {
  if (customerFormLoading) return;
  const select = customerForm.elements.barangay;
  const barangays = await CustomerAPI.loadBarangays();
  const selected = select.value;
  const previous = select.selectedOptions[0]?.textContent;
  select.replaceChildren(new Option('Select barangay', ''));
  barangays.filter((item) => Number(item.is_active) === 1 || item.name === selected)
    .forEach((item) => select.add(new Option(item.name, item.name)));
  if (selected && !Array.from(select.options).some((option) => option.value === selected)) {
    select.add(new Option(previous || selected, selected));
  }
  select.value = selected;
}
AdminAuth.ready.then((user) => {
  if (user) loadCustomerForm();
});

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

customerForm.elements.serviceStatus.addEventListener('change', () => {
  if (
    customerForm.elements.serviceStatus.value !== 'Pending' &&
    !customerForm.elements.dateApproved.value
  ) {
    customerForm.elements.dateApproved.value = WaterStore.today();
    updateApplicationDateDisplays();
    updateRegistrationButtons();
  }
});
