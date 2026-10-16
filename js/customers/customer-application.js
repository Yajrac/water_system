const applicationRecords = WaterStore.load();
const applicationId = new URLSearchParams(location.search).get('id');
const applicationCustomer = applicationRecords.customers.find(
  (customer) => customer.id === applicationId,
);
const printButton = document.getElementById('printForm');
if (!applicationCustomer) {
  document.getElementById('printMessage').textContent =
    'No saved application found. Open the application from Customer Management.';
  printButton.disabled = true;
} else {
  const firstBill = applicationRecords.bills
    .filter((bill) => bill.customerId === applicationId)
    .sort((a, b) => a.cycle.localeCompare(b.cycle))[0];
  const printable = {
    ...applicationCustomer,
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
    contractDate: 'Contract date',
    acknowledgementDate: 'Acknowledgement date',
    ctcNumber: 'Applicant CTC no.',
    ctcDate: 'CTC issue date',
    ctcPlace: 'CTC place of issue',
    representativeCtc: 'Representative CTC no.',
    representativeCtcDate: 'Representative CTC issue date',
    representativeCtcPlace: 'Representative CTC place of issue',
    natureOfWork: 'Nature of work',
    removedMeter: 'Removed meter no.',
    removedReading: 'Removed reading (m³)',
    removedKind: 'Removed meter kind',
    removedSize: 'Removed meter size',
    estimatedLiters: 'Estimated water consumed (liters)',
    documentNotes: 'Remarks',
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
printButton.addEventListener('click', () => window.print());
