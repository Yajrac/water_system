// Keep the preview open after saving so only a saved receipt can be printed.
function reviewPaymentReceipt(payment, customer, bill, office, savePayment) {
  if (document.getElementById('receiptDialog')) return Promise.resolve(false);
  return new Promise((resolve) => {
    let saved = false;
    let saving = false;
    const dialog = document.createElement('dialog');
    dialog.id = 'receiptDialog';
    dialog.className = 'receipt-dialog payment-receipt';
    dialog.setAttribute('aria-labelledby', 'paymentReceiptTitle');
    dialog.innerHTML =
      '<header class="receipt-heading"><img src="../assets/images/water_system_logo.jpg" alt="PWSS logo"><div><h2 id="paymentReceiptTitle">Payment receipt</h2><p class="receipt-office"></p></div></header><p class="receipt-state" role="status">REVIEW • Not yet saved</p><div class="receipt-details"></div><p class="receipt-feedback" role="alert"></p><div class="receipt-actions"><button type="button" class="btn receipt-close back-icon-button" aria-label="Back" data-tooltip="Back" autofocus><i class="bi bi-arrow-left" aria-hidden="true"></i></button><button type="button" class="btn btn-primary receipt-save">Confirm payment</button><button type="button" class="btn receipt-print" hidden>Print receipt</button></div>';
    dialog.querySelector('.receipt-heading').hidden = true;
    const details = dialog.querySelector('.receipt-details');
    renderReceiptPaper(details, payment, customer, office);
    const confirm = dialog.querySelector('.receipt-save');
    const close = dialog.querySelector('.receipt-close');
    const print = dialog.querySelector('.receipt-print');
    confirm.addEventListener('click', async () => {
      if (saving || saved) return;
      saving = true;
      confirm.disabled = true;
      close.disabled = true;
      dialog.querySelector('.receipt-feedback').textContent = 'Saving payment...';
      try {
        const result = await savePayment();
        if (result) {
          payment = result.payment;
          customer = result.customer;
          office = result.office;
          renderReceiptPaper(details, payment, customer, office);
        }
        saved = true;
        dialog.querySelector('.receipt-feedback').textContent = '';
        dialog.querySelector('.receipt-state').textContent = 'PAYMENT SAVED';
        confirm.hidden = true;
        print.hidden = false;
        close.textContent = 'Done';
        print.focus();
        await showNotice('Payment saved successfully', 'Receipt: ' + payment.receipt);
      } catch (error) {
        dialog.querySelector('.receipt-feedback').textContent =
          error.message || 'Payment could not be saved. Please try again.';
        confirm.disabled = false;
      } finally {
        saving = false;
        close.disabled = false;
      }
    });
    dialog.addEventListener('cancel', (event) => {
      if (saving) event.preventDefault();
    });
    close.addEventListener('click', () => {
      if (!saving) dialog.close();
    });
    print.addEventListener('click', () => {
      if (!saved) return;
      document.body.classList.add('printing-receipt');
      window.print();
    });
    const afterPrint = () => document.body.classList.remove('printing-receipt');
    window.addEventListener('afterprint', afterPrint);
    dialog.addEventListener(
      'close',
      () => {
        afterPrint();
        window.removeEventListener('afterprint', afterPrint);
        dialog.remove();
        resolve(saved);
      },
      { once: true },
    );
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

// Snapshot each covered bill so its readings and allocation remain on the receipt.
function appendReceiptAllocations(details, payment) {
  (payment.allocations || []).forEach((item) => {
    const rows = [
      ['Billing month', item.cycle],
      ...(Number.isFinite(item.ratePerCubic)
        ? [['Rate per cubic meter', WaterStore.money(item.ratePerCubic)]]
        : []),
      [
        'Previous \u2192 current reading',
        [item.previous, item.current].every(Number.isFinite)
          ? item.previous + ' \u2192 ' + item.current + ' m\u00b3'
          : 'Not recorded',
      ],
      [
        'Water consumed',
        Number.isFinite(item.consumption) ? item.consumption + ' m\u00b3' : 'Not recorded',
      ],
      ['Applied payment', WaterStore.money(item.amount)],
      ['Bill balance after payment', WaterStore.money(item.balanceAfter)],
    ];
    rows.forEach(([label, value], index) => {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      if (index === 0) {
        term.className = 'receipt-allocation-start';
        description.className = 'receipt-allocation-start';
      }
      details.append(term, description);
    });
  });
}

// One receipt layout for payment review, saved history and printing.
function renderReceiptPaper(container, payment, customer, office) {
  container.replaceChildren();
  container.className = 'receipt-paper';
  const records = { bills: [] };
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  const header = element('header', 'receipt-paper-header');
  const logo = element('img', 'receipt-paper-logo');
  logo.src = '../assets/images/water_system_logo.jpg';
  logo.alt = 'Pio Duran Water Supply System logo';
  logo.width = 72;
  logo.height = 72;
  const brand = element('div', 'receipt-header-brand');
  const brandText = element('div', 'receipt-header-brand-text');
  brandText.append(
    element('h2', '', office.name || 'PIO DURAN WATER SUPPLY SYSTEM'),
    element('p', '', 'Monitoring & Billing System'),
    element('p', '', 'Pio Duran, Albay'),
  );
  brand.append(logo, brandText);
  const documentInfo = element('div', 'receipt-header-document');
  documentInfo.append(element('h3', '', 'OFFICIAL RECEIPT'));
  header.append(brand, documentInfo);
  container.append(header);
  const meta = element('dl', 'receipt-paper-meta');
  function detail(label, value) {
    const group = element('div');
    group.append(element('dt', '', label), element('dd', '', value || 'Not recorded'));
    meta.append(group);
  }
  const date = payment.createdAt
    ? new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Asia/Manila',
      }).format(new Date(payment.createdAt))
    : payment.date;
  const allocations = payment.allocations || [{ billId: payment.billId, amount: payment.amount }];
  const cycles = [
    ...new Set(
      allocations
        .map((item) => item.cycle || records.bills.find((b) => b.id === item.billId)?.cycle)
        .filter(Boolean),
    ),
  ];
  const coverage = cycles
    .map((cycle) =>
      /^\d{4}-\d{2}$/.test(cycle)
        ? new Intl.DateTimeFormat('en-PH', {
            month: 'long',
            year: 'numeric',
            timeZone: 'Asia/Manila',
          }).format(new Date(cycle + '-01T12:00:00+08:00'))
        : cycle,
    )
    .join(', ');
  documentInfo.append(
    element('p', '', 'Billing coverage: ' + (coverage || 'Not recorded')),
    element('p', '', 'Date paid: ' + date),
  );
  detail('Receipt no.', payment.receipt);
  detail('Date paid', date);
  detail('Submitter no.', customer?.submitterNumber || customer?.account);
  detail('Billing month', cycles.join(', '));
  detail('Customer', customer?.name);
  detail(
    'Service address',
    [customer?.address, customer?.street, customer?.barangay].filter(Boolean).join(', '),
  );
  container.append(meta);
  const table = element('table', 'receipt-paper-table');
  const head = table.createTHead().insertRow();
  head.append(element('th', '', 'Statement description'), element('th', '', 'Value'));
  const body = table.createTBody();
  function row(label, value, className = '') {
    const tr = body.insertRow();
    tr.className = className;
    tr.append(element('td', '', label), element('td', '', value));
  }
  function reading(value) {
    return Number.isFinite(value)
      ? value.toFixed(3).replace(/\.?0+$/, '') + ' m\u00b3'
      : 'Not recorded';
  }
  allocations.forEach((item) => {
    const bill = records.bills.find((b) => b.id === item.billId) || {};
    const value = { ...bill, ...item };
    if (allocations.length > 1)
      row('Billing month', value.cycle || 'Not recorded', 'receipt-section-row');
    row('Previous meter reading', reading(value.previous));
    row('Current meter reading', reading(value.current));
    row('Water consumed', reading(value.consumption), 'receipt-section-row');
    row(
      'Rate per cubic meter',
      Number.isFinite(value.ratePerCubic)
        ? WaterStore.money(value.ratePerCubic) + ' / m\u00b3'
        : 'Not recorded',
    );
    for (const [label, key] of [
      ['Water charge', 'water'],
      ['Connection / reconnection fee', 'connection'],
      ['Late fee', 'late'],
      ['Other charges', 'other'],
    ])
      row(label, Number.isFinite(value[key]) ? WaterStore.money(value[key]) : 'Not recorded');
    if (allocations.length > 1) row('Payment applied', WaterStore.money(item.amount));
  });
  const before = Number.isFinite(payment.balanceBefore)
    ? payment.balanceBefore
    : allocations.reduce(
        (sum, item) => sum + (records.bills.find((b) => b.id === item.billId)?.total || 0),
        0,
      );
  row('Amount due before this payment', WaterStore.money(before), 'receipt-due-row');
  row('Total payment received', WaterStore.money(payment.amount), 'receipt-paid-row');
  row(
    'Remaining balance after payment',
    Number.isFinite(payment.balanceAfter) ? WaterStore.money(payment.balanceAfter) : 'Not recorded',
  );
  container.append(table);
  const notes = element('div', 'receipt-paper-notes');
  notes.append(
    element('p', '', 'Collected by: ' + (payment.collectedBy || 'Not recorded')),
    element('p', '', 'Payment method: ' + payment.method),
    element('p', '', 'Remarks: ' + (payment.remarks || 'No remarks recorded.')),
  );
  if (payment.reference) notes.appendChild(element('p', '', 'Transaction reference: ' + payment.reference));
  container.append(notes);
  const footer = element('footer', 'receipt-paper-footer');
  footer.append(
    element('p', '', 'Acknowledgment of the payment recorded above.'),
    element('strong', '', 'AUTHORIZED CASHIER'),
  );
  container.append(footer);
}
