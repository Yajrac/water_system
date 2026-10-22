const CustomerAPI = {
  barangays: [],
  async loadBarangays() {
    this.barangays = await AdminAPI.request('/barangays');
    return this.barangays;
  },
  list(filters = {}) {
    const query = new URLSearchParams(
      Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined),
    );
    return AdminAPI.request('/customers?' + query);
  },
  profile(id) {
    return AdminAPI.request('/customers/' + encodeURIComponent(id));
  },
  payload(input, password = '') {
    const keys = [
      'firstName',
      'middleName',
      'lastName',
      'extensionName',
      'gender',
      'contact',
      'address',
      'street',
      'customerType',
      'serviceStatus',
      'natureOfWork',
      'dateApplied',
      'dateApproved',
      'dateInstalled',
      'certificateReceived',
      'contractReceived',
      'acknowledgementReceived',
      'meterNumber',
      'meterKind',
      'meterSize',
      'reading',
      'installationFee',
      'setbackLength',
      'setbackRate',
      'reinstallationFee',
      'violationFee',
      'username',
      'revision',
    ];
    const result = Object.fromEntries(
      keys.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]),
    );
    const barangay = this.barangays.find(
      (item) => item.name === input.barangay || String(item.id) === String(input.barangayId),
    );
    if (!barangay) throw new Error('Select a registered barangay.');
    result.barangayId = String(barangay.id);
    if (password) result.password = password;
    return result;
  },
  async save(input, password, id = null) {
    const payload = this.payload(input, password);
    if (payload.firstName && payload.lastName && payload.contact && payload.address) {
      const result = await AdminAPI.request('/customers/check-duplicate', {
        method: 'POST',
        body: {
          ...Object.fromEntries(
            [
              'firstName',
              'middleName',
              'lastName',
              'extensionName',
              'contact',
              'barangayId',
              'address',
            ].map((key) => [key, payload[key]]),
          ),
          ...(id ? { excludeId: id } : {}),
        },
      });
      if (result.exists) {
        const accepted = await confirmAction(
          'Possible duplicate customer',
          'A record has the same full name, mobile number, barangay and purok. Verify this is a separate customer or water connection before continuing.',
          'Reviewed ? save separate record',
        );
        if (!accepted)
          throw new Error(
            'Save cancelled. Review the existing customer before adding another record.',
          );
        payload.duplicateReviewed = true;
      }
    }
    return AdminAPI.request('/customers' + (id ? '/' + encodeURIComponent(id) : ''), {
      method: id ? 'PUT' : 'POST',
      body: payload,
    });
  },
  changeStatus(customer, status, reason) {
    return AdminAPI.request('/customers/' + encodeURIComponent(customer.id) + '/status', {
      method: 'PATCH',
      body: { status, reason, revision: customer.revision },
    });
  },
};
