// Explicit rules are checked again on save, independent of HTML input attributes.
const CustomerValidation = {
  workTypes: ['New connection', 'Reconnection', 'Meter replacement', 'Service repair'],
  extensions: ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'V'],
  fullName(customer) {
    return [customer.firstName, customer.middleName, customer.lastName, customer.extensionName]
      .map((part) => (part || '').trim())
      .filter(Boolean)
      .join(' ');
  },
  textLimits: {
    firstName: 60,
    middleName: 60,
    lastName: 60,
    username: 40,
    name: 120,
    street: 200,
    approvedBy: 120,
    meterNumber: 120,
    meterKind: 120,
    meterSize: 40,
    natureOfWork: 500,
  },
  amounts: ['installationFee', 'setbackRate', 'reinstallationFee', 'violationFee'],
  quantities: ['reading', 'setbackLength'],
  dates: ['dateApplied', 'dateApproved', 'dateInstalled'],
  checks: ['certificateReceived', 'contractReceived', 'acknowledgementReceived'],
  read(form) {
    const customer = {};
    const textNames = [
      ...Object.keys(this.textLimits),
      ...this.dates,
      'address',
      'barangay',
      'customerType',
      'gender',
      'extensionName',
      'serviceStatus',
      'contact',
    ];
    textNames.forEach((name) => {
      customer[name] = form.elements[name].value.trim();
    });
    customer.contact = customer.contact.replace(/^(?:\+?63|0)/, '');
    this.checks.forEach((name) => {
      customer[name] = form.elements[name].checked;
    });
    customer.name = this.fullName(customer);
    return customer;
  },
  error(customer, form, existingNatureOfWork = '') {
    if (!customer.firstName || !customer.lastName) return 'Enter the first and last name.';
    for (const key of ['firstName', 'middleName', 'lastName']) {
      if (
        customer[key] &&
        (!/^[\p{L}\p{M} .,'-]+$/u.test(customer[key]) || !/\p{L}/u.test(customer[key]))
      )
        return 'Name fields accept letters, spaces and name punctuation only.';
    }
    if (!this.extensions.includes(customer.extensionName)) return 'Select a valid extension name.';
    if (!['Male', 'Female'].includes(customer.gender)) return 'Select Male or Female for gender.';
    if (customer.username && !/^[A-Za-z0-9._-]{3,40}$/.test(customer.username))
      return 'Username must contain 3–40 letters, numbers, periods, underscores or hyphens.';
    if (
      !customer.name ||
      !customer.address ||
      !customer.barangay ||
      !customer.dateApplied ||
      !form.elements.reading.value.trim()
    )
      return 'Complete the required fields marked *.';
    if (!/^[\p{L}\p{M} .,'-]+$/u.test(customer.name) || !/\p{L}/u.test(customer.name))
      return 'Applicant name must contain letters. Numbers and symbols are not allowed.';
    if (!/^(?:0|\+?63)?9\d{9}$/.test(customer.contact))
      return 'Enter a valid mobile number starting with 09, 9, 63 or +63, such as 09123456789 or 9123456789.';
    if (!/^Purok [1-7]$/.test(customer.address)) return 'Select Purok 1 to Purok 7.';
    if (
      customer.natureOfWork &&
      !this.workTypes.includes(customer.natureOfWork) &&
      customer.natureOfWork !== existingNatureOfWork
    )
      return 'Select a valid nature of work from the dropdown.';
    if (!CustomerAPI.barangays.some((item) => item.name === customer.barangay))
      return 'Choose a barangay from the registered service areas.';
    if (
      !['Residential', 'Commercial'].includes(customer.customerType) ||
      !['Pending', 'Approved', 'Installed'].includes(customer.serviceStatus)
    )
      return 'Choose a valid customer type and service status.';
    for (const [name, limit] of Object.entries(this.textLimits)) {
      const value = customer[name];
      if (value.length > limit || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
        return (
          'Check ' +
          name +
          ': maximum ' +
          limit +
          ' characters; HTML tags and control characters are not accepted.'
        );
    }
    for (const name of this.dates) {
      if (
        customer[name] &&
        (!Validation.date(customer[name]) || customer[name] > WaterStore.today())
      )
        return 'Check ' + name + ': enter a valid date that is not in the future.';
    }
    if (customer.dateApproved && customer.dateApproved < customer.dateApplied)
      return 'Approval date cannot be before the application date.';
    if (
      customer.dateInstalled &&
      customer.dateInstalled < (customer.dateApproved || customer.dateApplied)
    )
      return 'Installation date cannot be before application or approval.';
    for (const name of [...this.amounts, ...this.quantities]) {
      const raw = form.elements[name].value.trim();
      if (form.elements[name].validity?.badInput) return 'Enter a valid number for ' + name + '.';
      const valid = this.amounts.includes(name)
        ? Validation.money(raw)
        : /^\d+(\.\d{1,3})?$/.test(raw);
      if (
        raw &&
        (!valid || !Number.isFinite(Number(raw)) || Number(raw) > Number.MAX_SAFE_INTEGER / 1000)
      )
        return (
          'Check ' +
          name +
          ': use non-negative numbers, up to 2 decimals for charges or 3 for quantities.'
        );
      customer[name] = Number(raw || 0);
    }
    return '';
  },
};
