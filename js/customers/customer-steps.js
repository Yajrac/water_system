// Keep the existing form and save validation, showing one section at a time.
const customerSteps = Array.from(customerForm.querySelectorAll('.customer-section'));
const previousCustomerStep = document.getElementById('previousCustomerStep');
const nextCustomerStep = document.getElementById('nextCustomerStep');
let currentCustomerStep = 0;
const customerStepLabels = ['Applicant', 'Installation', 'Estimate', 'Verification', 'App account'];
const customerStepTrack = document.getElementById('customerStepTrack');
const customerStepMarkers = customerSteps.map((section, index) => {
  const marker = document.createElement('li');
  const number = document.createElement('span');
  number.className = 'step-number';
  number.textContent = index + 1;
  const label = document.createElement('span');
  label.className = 'step-label';
  label.textContent = customerStepLabels[index];
  marker.append(number, label);
  customerStepTrack.appendChild(marker);
  return marker;
});

function showCustomerStep(index, focus = true) {
  currentCustomerStep = index;
  customerStepMarkers.forEach((marker, position) => {
    marker.classList.toggle('is-current', position === index);
    marker.classList.toggle('is-complete', position < index);
    if (position === index) marker.setAttribute('aria-current', 'step');
    else marker.removeAttribute('aria-current');
    marker.querySelector('.step-number').textContent = position < index ? '\u2713' : position + 1;
  });
  customerSteps.forEach((section, position) => {
    section.hidden = position !== index;
  });
  const title = document.getElementById('customerStepTitle');
  title.textContent = customerSteps[index].querySelector('legend').textContent;
  title.tabIndex = -1;
  previousCustomerStep.hidden = index === 0;
  nextCustomerStep.hidden = index === customerSteps.length - 1;
  registerCustomerButton.hidden = index !== customerSteps.length - 1;
  printApplicationButton.hidden = index !== customerSteps.length - 1;
  if (focus) title.focus();
}

previousCustomerStep.addEventListener('click', () => showCustomerStep(currentCustomerStep - 1));
function customerStepError(field) {
  const value = field.value.trim();
  const fields = customerForm.elements;
  if (field.name === 'gender' && !['Male', 'Female'].includes(value))
    return 'Select a gender before continuing.';
  if (['firstName', 'lastName'].includes(field.name) && !value)
    return 'Complete this required name field.';
  if (
    ['firstName', 'middleName', 'lastName'].includes(field.name) &&
    value &&
    (!/^[\p{L}\p{M} .,'-]+$/u.test(value) || !/\p{L}/u.test(value))
  )
    return 'Enter letters and name punctuation only.';
  if (field.name === 'extensionName' && !CustomerValidation.extensions.includes(value))
    return 'Select a valid extension name.';
  if (field.name === 'name' && !/^[\p{L}\p{M} .,'-]+$/u.test(value))
    return 'Enter the applicant name using letters and name punctuation only.';
  if (field.name === 'name' && !/\p{L}/u.test(value)) return 'Enter the applicant name.';
  if (field.name === 'contact' && !/^0?9\d{9}$/.test(value))
    return 'Enter a valid mobile number: 11 digits starting with 09 or 10 starting with 9.';
  if (field.name === 'address' && !/^Purok [1-7]$/.test(value)) return 'Select a valid purok.';
  if (field.name === 'barangay' && !CustomerAPI.barangays.some((item) => item.name === value))
    return 'Select a registered barangay.';
  if (field.name === 'serviceStatus' && !['Approved', 'Installed'].includes(value))
    return 'Select Approved or Installed to register the customer.';
  if (field.name === 'dateApproved' && !value) return 'Enter the approval date.';
  if (
    field.name === 'approvedBy' &&
    (!/^[\p{L}\p{M} .,'-]+$/u.test(value) || !/\p{L}/u.test(value))
  )
    return 'Enter the approver name using letters and name punctuation.';
  if (
    fields.serviceStatus.value === 'Installed' &&
    ['dateInstalled', 'meterNumber'].includes(field.name) &&
    !value
  )
    return 'Complete this field for an installed service.';
  if (
    CustomerValidation.dates.includes(field.name) &&
    value &&
    (!Validation.date(value) || value > WaterStore.today())
  )
    return 'Enter a valid date that is not in the future.';
  if (field.name === 'dateApproved' && value < fields.dateApplied.value)
    return 'Approval date cannot be before the application date.';
  if (
    field.name === 'dateInstalled' &&
    value &&
    value < (fields.dateApproved.value || fields.dateApplied.value)
  )
    return 'Installation date cannot be before approval.';
  if (
    [...CustomerValidation.amounts, ...CustomerValidation.quantities].includes(field.name) &&
    value
  ) {
    const valid = CustomerValidation.amounts.includes(field.name)
      ? Validation.money(value)
      : /^\d+(\.\d{1,3})?$/.test(value);
    if (!valid || !Number.isFinite(Number(value)) || Number(value) > Number.MAX_SAFE_INTEGER / 1000)
      return 'Enter a valid non-negative number within the allowed range.';
  }
  return '';
}
customerForm.addEventListener('input', (event) => {
  event.target.setCustomValidity?.('');
  event.target.removeAttribute('aria-invalid');
});
customerForm.addEventListener('change', (event) => {
  event.target.setCustomValidity?.('');
  event.target.removeAttribute('aria-invalid');
});
nextCustomerStep.addEventListener('click', async () => {
  if (currentCustomerStep === 0 && !(await checkCustomerIdentity())) return;
  const invalid = Array.from(
    customerSteps[currentCustomerStep].querySelectorAll('input, select, textarea'),
  ).find((field) => {
    if (field.disabled || field.readOnly) return false;
    field.setCustomValidity(customerStepError(field));
    return !field.checkValidity();
  });
  if (invalid) {
    invalid.setAttribute('aria-invalid', 'true');
    return invalid.reportValidity();
  }
  showCustomerStep(currentCustomerStep + 1);
});
// Reveal any invalid field before the browser tries to focus it during final validation.
customerForm.addEventListener(
  'invalid',
  (event) => {
    const index = customerSteps.findIndex((section) => section.contains(event.target));
    if (index >= 0 && customerSteps[index].hidden) showCustomerStep(index, false);
    event.target.setAttribute('aria-invalid', 'true');
    AdminUI.message(event.target.validationMessage || 'Check the highlighted field before saving.');
  },
  true,
);
customerForm.addEventListener('keydown', (event) => {
  if (
    event.key === 'Enter' &&
    event.target.tagName === 'INPUT' &&
    currentCustomerStep < customerSteps.length - 1
  ) {
    event.preventDefault();
    nextCustomerStep.click();
  }
});
showCustomerStep(0, false);

let identityVersion = 0;
let identityTimer;
async function checkCustomerIdentity() {
  const version = ++identityVersion;
  const fields = customerForm.elements;
  const message = document.getElementById('customerDuplicateMessage');
  const body = Object.fromEntries(
    ['firstName', 'middleName', 'lastName', 'extensionName', 'contact'].map((key) => [
      key,
      fields[key].value.trim(),
    ]),
  );
  const barangay = CustomerAPI.barangays.find(
    (item) => item.name === fields.barangay.value || String(item.id) === fields.barangay.value,
  );
  body.barangayId = barangay ? String(barangay.id) : '';
  body.address = fields.address.value;
  if (editingCustomerId) body.excludeId = editingCustomerId;
  if (
    !body.firstName ||
    !body.lastName ||
    !/^0?9\d{9}$/.test(body.contact) ||
    !body.barangayId ||
    !body.address
  ) {
    message.textContent = '';
    nextCustomerStep.disabled = false;
    return true;
  }
  nextCustomerStep.disabled = true;
  message.textContent = 'Checking for an existing customer...';
  try {
    const result = await AdminAPI.request('/customers/check-duplicate', { method: 'POST', body });
    if (version !== identityVersion) return false;
    message.textContent = result.exists
      ? 'Possible duplicate: the same name, mobile, barangay and purok are already recorded. Review this before saving a separate connection.'
      : '';
    message.style.color = result.exists ? '#b45309' : '';
    nextCustomerStep.disabled = false;
    return true;
  } catch (error) {
    if (version !== identityVersion) return false;
    message.textContent = 'Could not check customer: ' + error.message + ' Try Next again.';
    nextCustomerStep.disabled = false;
    return false;
  }
}
customerForm.addEventListener('input', (event) => {
  if (
    ![
      'firstName',
      'middleName',
      'lastName',
      'extensionName',
      'contact',
      'barangay',
      'address',
    ].includes(event.target.name)
  )
    return;
  ++identityVersion;
  clearTimeout(identityTimer);
  nextCustomerStep.disabled = false;
  document.getElementById('customerDuplicateMessage').textContent = '';
  identityTimer = setTimeout(checkCustomerIdentity, 400);
});
customerForm.addEventListener('change', (event) => {
  if (['extensionName', 'barangay', 'address'].includes(event.target.name)) checkCustomerIdentity();
});
