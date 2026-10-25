async function loadCustomerApplication() {
  const applicationRecords = { bills: [] };
  const applicationId = new URLSearchParams(location.search).get('id');
  let applicationCustomer = null;
  const isPreview = new URLSearchParams(location.search).get('preview') === '1';
  if (!isPreview) {
    if (!applicationId) throw new Error('Choose a saved application from Customer Management.');
    const result = await CustomerAPI.profile(applicationId);
    applicationCustomer = result.customer;
    applicationRecords.bills = result.bills;
  }
  if (isPreview) {
    try {
      applicationCustomer = JSON.parse(sessionStorage.getItem('pwss-application-print-preview'));
    } catch {
      applicationCustomer = null;
    }
    document.getElementById('printMessage').textContent =
      'Form preview. Unsaved changes are not registered by printing.';
    const back = document.querySelector('.print-tools a');
    back.href = applicationCustomer?.id
      ? 'customer-form.html?id=' + encodeURIComponent(applicationCustomer.id)
      : 'customer-form.html';
    back.setAttribute('aria-label', 'Back to customer form');
  }
  const printButton = document.getElementById('printForm');
  if (!applicationCustomer) {
    document.getElementById('printMessage').textContent =
      'No saved application found. Open the application from Customer Management.';
    printButton.disabled = true;
  } else {
    printButton.disabled = false;
    const firstBill = applicationRecords.bills
      .filter((bill) => bill.customerId === applicationCustomer.id)
      .sort((a, b) => a.cycle.localeCompare(b.cycle))[0];
    const printable = {
      ...applicationCustomer,
      address: [applicationCustomer.address, applicationCustomer.street].filter(Boolean).join(', '),
      initialReading: firstBill ? firstBill.previous : applicationCustomer.reading,
    };
    document.querySelectorAll('[data-field]').forEach((element) => {
      element.textContent = printable[element.dataset.field] ?? '—';
    });
    document.querySelectorAll('[data-money]').forEach((element) => {
      element.textContent = WaterStore.money(Number(printable[element.dataset.money] || 0));
    });
    document.getElementById('setbackTotal').textContent = WaterStore.money(
      (printable.setbackLength || 0) * (printable.setbackRate || 0),
    );
    const details = document.getElementById('documentDetails');
    const labels = {
      certificateReceived: 'Barangay certification verified',
      contractReceived: 'Signed contract received',
      acknowledgementReceived: 'Signed acknowledgement received',
      natureOfWork: 'Nature of work',
      removedMeter: 'Removed meter no.',
      removedReading: 'Removed reading (m³)',
      removedKind: 'Removed meter kind',
      removedSize: 'Removed meter size',
      estimatedLiters: 'Estimated water consumed (liters)',
    };
    Object.entries(labels).forEach(([field, label]) => {
      const heading = document.createElement('dt');
      heading.textContent = label;
      const value = document.createElement('dd');
      value.textContent =
        typeof printable[field] === 'boolean'
          ? printable[field]
            ? 'Yes'
            : 'No'
          : (printable[field] ?? '—');
      details.append(heading, value);
    });
    document.getElementById('applicationPaper').hidden = false;
    document.getElementById('applicationAppendix').hidden = false;
  }
  printButton.addEventListener('click', async () => {
    if (!applicationCustomer) return;
    printButton.disabled = true;
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      await Promise.allSettled(Array.from(document.images, (image) => image.decode()));
      window.print();
    } finally {
      printButton.disabled = false;
    }
  });
}
document.getElementById('printForm').disabled = true;
AdminAuth.ready.then(async (user) => {
  if (!user) return;
  try {
    await loadCustomerApplication();
  } catch (error) {
    document.getElementById('printMessage').textContent = error.message;
  }
});
