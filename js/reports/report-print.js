// Build a print preview from the exact records selected by the report filters.
document.getElementById('printReport').addEventListener('click', () => {
  if (document.getElementById('reportPrintPreview')) return;
  const consumption =
    document.getElementById('barangayConsumptionTab').getAttribute('aria-selected') === 'true';
  const title = consumption
    ? 'CONSUMPTION BY BARANGAY'
    : reportStatus.value === 'Paid'
      ? 'PAID ACCOUNTS REPORT'
      : reportStatus.value === 'Unpaid'
        ? 'UNPAID ACCOUNTS REPORT'
        : reportStatus.value === 'Overdue'
          ? 'OVERDUE ACCOUNTS REPORT'
          : 'ACCOUNTS REPORT';
  const dialog = document.createElement('dialog');
  dialog.id = 'reportPrintPreview';
  dialog.setAttribute('aria-label', title);
  function node(tag, text, className) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (className) n.className = className;
    return n;
  }
  const controls = node('div', undefined, 'report-print-controls');
  const close = node('button', 'Close', 'btn');
  close.type = 'button';
  close.addEventListener('click', () => dialog.close());
  const print = node('button', 'Print report', 'btn btn-primary');
  print.type = 'button';
  const exportExcel = node('button', 'Export Excel', 'btn btn-primary');
  exportExcel.type = 'button';
  exportExcel.addEventListener('click', exportCurrentReport);
  controls.append(close, print, exportExcel);
  const paper = node('article', undefined, 'report-print-paper');
  const header = node('header', undefined, 'report-document-header');
  const brand = node('div', undefined, 'report-document-brand');
  const logo = node('img');
  logo.src = '../assets/images/water_system_logo.jpg';
  logo.alt = 'PWSS logo';
  const identity = node('div');
  identity.append(
    node('h2', 'PIO DURAN WATER SUPPLY SYSTEM'),
    node('p', 'Monitoring & Billing System'),
    node('p', 'Pio Duran, Albay'),
  );
  brand.append(logo, identity);
  const info = node('div', undefined, 'report-document-info');
  const coverage = reportCycle.value
    ? new Intl.DateTimeFormat('en-PH', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Manila',
      }).format(new Date(reportCycle.value + '-01T12:00:00+08:00'))
    : 'All billing months';
  info.append(
    node('h3', title),
    node('p', 'Billing coverage: ' + coverage),
    node('p', 'Report generated: ' + WaterStore.today()),
  );
  header.append(brand, info);
  paper.append(header);
  if (reportBarangay.value || document.getElementById('reportSearch').value.trim()) {
    paper.append(
      node(
        'p',
        'Filters: ' +
          [reportBarangay.value, document.getElementById('reportSearch').value.trim()]
            .filter(Boolean)
            .join(' / '),
        'report-print-filter-note',
      ),
    );
  }
  const table = node('table');
  const head = table.createTHead().insertRow();
  const labels = consumption
    ? ['Barangay', 'Billed accounts', 'Consumption', 'Average / account']
    : [
        '#',
        'Submitter no.',
        'Customer name',
        'Address',
        'Consumption',
        reportStatus.value === 'Paid' ? 'Amount paid' : 'Bill / paid / balance',
        'Status',
      ];
  labels.forEach((label) => head.append(node('th', label)));
  const body = table.createTBody();
  if (consumption) {
    consumptionReportRows.forEach((values) => {
      const row = body.insertRow();
      values.forEach((value) => row.append(node('td', String(value))));
    });
  } else
    reportMatchedBills.forEach(({ bill, customer, status }, index) => {
      const balance = WaterStore.balance(bill, reportRecords);
      const amount =
        reportStatus.value === 'Paid'
          ? WaterStore.money(bill.total - balance)
          : [bill.total, bill.total - balance, balance]
              .map((value) => WaterStore.money(value))
              .join(' / ');
      const row = body.insertRow();
      [
        index + 1,
        customer.submitterNumber || customer.account,
        customer.name,
        [customer.address, customer.street, customer.barangay].filter(Boolean).join(', '),
        bill.consumption + ' m\u00b3',
        amount,
        status,
      ].forEach((value) => row.append(node('td', value)));
    });
  if (!body.rows.length) {
    const row = body.insertRow();
    const cell = node('td', 'No records match the selected filters.');
    cell.colSpan = labels.length;
    row.append(cell);
  }
  paper.append(table);
  const signatures = node('footer', undefined, 'report-signatures');
  signatures.append(node('strong', 'PREPARED BY'), node('strong', 'APPROVED BY'));
  paper.append(signatures);
  dialog.append(controls, paper);
  document.body.append(dialog);
  print.addEventListener('click', async () => {
    if (logo.decode) await logo.decode().catch(() => {});
    if (document.fonts) await document.fonts.ready;
    document.body.classList.add('printing-report');
    window.print();
  });
  const cleanup = () => document.body.classList.remove('printing-report');
  window.addEventListener('afterprint', cleanup);
  dialog.addEventListener(
    'close',
    () => {
      cleanup();
      window.removeEventListener('afterprint', cleanup);
      dialog.remove();
    },
    { once: true },
  );
  dialog.showModal();
});
