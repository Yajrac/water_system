const MeterEntryAPI = {
  list(setupId) {
    return AdminAPI.request('/meter-entries?setupId=' + encodeURIComponent(setupId));
  },
  save(setupId, customer, fields, existing) {
    return AdminAPI.request('/meter-entries', {
      method: 'PUT',
      body: {
        setupId: String(setupId),
        customerId: String(customer.id),
        meterId: String(customer.meterId),
        previous: customer.previous,
        consumption: fields.consumption.value.trim(),
        connectionCharge: fields.connection.value.trim() || '0',
        late: fields.late.value.trim() || '0',
        other: fields.other.value.trim() || '0',
        ...(existing ? { revision: existing.revision } : {}),
      },
    });
  },
};
