// Explicit rules are checked again on save, independent of HTML input attributes.
const CustomerValidation = {
  textLimits: {
    name: 120,
    street: 200,
    installationReference: 120,
    clusterNumber: 120,
    approvedBy: 120,
    installedBy: 120,
    meterNumber: 120,
    meterKind: 120,
    meterSize: 40,
    natureOfWork: 500,
    ctcNumber: 120,
    ctcPlace: 120,
    representativeCtc: 120,
    representativeCtcPlace: 120,
    documentNotes: 1000,
  },
  amounts: ['installationFee', 'setbackRate', 'reinstallationFee', 'violationFee'],
  quantities: ['reading', 'setbackLength'],
  dates: [
    'dateApplied',
    'dateApproved',
    'dateInstalled',
    'contractDate',
    'acknowledgementDate',
    'ctcDate',
    'representativeCtcDate',
  ],
  checks: ['certificateReceived', 'contractReceived', 'acknowledgementReceived'],
  read(form) {
    const customer = {};
    const textNames = [
      ...Object.keys(this.textLimits),
      ...this.dates,
      'address',
      'barangay',
      'customerType',
      'serviceStatus',
      'contact',
    ];
    textNames.forEach((name) => {
      customer[name] = form.elements[name].value.trim();
    });
    this.checks.forEach((name) => {
      customer[name] = form.elements[name].checked;
    });
    return customer;
  },
  error(customer, form) {
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
    if (!/^9\d{9}$/.test(customer.contact))
      return 'Mobile number must contain exactly 10 digits starting with 9. The +63 prefix is already included.';
    if (!/^Purok [1-7]$/.test(customer.address)) return 'Select Purok 1 to Purok 7.';
    if (!WaterStore.barangays.includes(customer.barangay))
      return 'Choose one of the seven project barangays.';
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
    for (const name of ['approvedBy', 'installedBy']) {
      if (customer[name] && !/^[\p{L}\p{M} .,'-]+$/u.test(customer[name]))
        return 'Approver and installer names must contain letters, spaces or name punctuation.';
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
