// Keep the preview open after saving so only a saved receipt can be printed.
function reviewPaymentReceipt(payment, customer, bill, office, savePayment) {
  if (document.getElementById('receiptDialog')) return Promise.resolve(false);
  return new Promise(resolve => {
    let saved = false;
    const dialog = document.createElement('dialog');
    dialog.id = 'receiptDialog';
    dialog.className = 'receipt-dialog payment-receipt';
    dialog.setAttribute('aria-labelledby', 'paymentReceiptTitle');
    dialog.innerHTML = '<header class="receipt-heading"><img src="../water_system_logo.jpg" alt="PWSS logo"><div><h2 id="paymentReceiptTitle">Payment receipt</h2><p class="receipt-office"></p></div></header><p class="receipt-state" role="status">REVIEW • Not yet saved</p><dl class="receipt-details"></dl><p class="receipt-feedback" role="alert"></p><div class="receipt-actions"><button type="button" class="btn receipt-close" autofocus>Back</button><button type="button" class="btn btn-primary receipt-save">Confirm payment</button><button type="button" class="btn receipt-print" hidden>Print receipt</button></div>';
    dialog.querySelector('.receipt-office').textContent = office.name;
    const details = dialog.querySelector('.receipt-details');
    const date = new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' }).format(new Date(payment.date + 'T12:00:00+08:00'));
    const rows = [
      ['Receipt number', payment.receipt], ['Date', date],
      ['Customer', customer.name], ['Account', customer.account],
      ['Payment method', payment.method],
      ...(payment.allocations ? [['Payment covers', payment.scope === 'account' ? 'Outstanding account balance ? oldest bills first' : 'Selected billing month']] : [
        ['Billing month', bill.cycle],
        ['Previous reading', Number.isFinite(bill.previous) ? bill.previous + ' m?' : 'Not recorded'],
        ['Current reading', Number.isFinite(bill.current) ? bill.current + ' m?' : 'Not recorded'],
        ['Water consumed', Number.isFinite(bill.consumption) ? bill.consumption + ' m?' : 'Not recorded'],
        ['Bill total', WaterStore.money(payment.billTotal)]
      ]),
      ['Balance before payment', WaterStore.money(payment.balanceBefore)],
      ['Amount paid', WaterStore.money(payment.amount)],
      ['Remaining balance', WaterStore.money(payment.balanceAfter)]
    ];
    rows.forEach(([label, value]) => {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      details.append(term, description);
    });
    appendReceiptAllocations(details, payment);
    const confirm = dialog.querySelector('.receipt-save');
    const close = dialog.querySelector('.receipt-close');
    const print = dialog.querySelector('.receipt-print');
    confirm.addEventListener('click', () => {
      confirm.disabled = true;
      try {
        savePayment();
        saved = true;
        dialog.querySelector('.receipt-state').textContent = 'PAYMENT SAVED';
        confirm.hidden = true;
        print.hidden = false;
        close.textContent = 'Done';
        print.focus();
      } catch (error) {
        dialog.querySelector('.receipt-feedback').textContent = error.message || 'Payment could not be saved. Please try again.';
        confirm.disabled = false;
      }
    });
    close.addEventListener('click', () => dialog.close());
    print.addEventListener('click', () => {
      document.body.classList.add('printing-receipt');
      window.print();
    });
    const afterPrint = () => document.body.classList.remove('printing-receipt');
    window.addEventListener('afterprint', afterPrint);
    dialog.addEventListener('close', () => {
      afterPrint();
      window.removeEventListener('afterprint', afterPrint);
      dialog.remove();
      resolve(saved);
    }, { once: true });
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

// Snapshot each covered bill so its readings and allocation remain on the receipt.
function appendReceiptAllocations(details, payment) {
  (payment.allocations || []).forEach(item => {
    const rows = [
      ['Billing month', item.cycle],
      ['Previous ? current reading', [item.previous, item.current].every(Number.isFinite) ? item.previous + ' ? ' + item.current + ' m?' : 'Not recorded'],
      ['Water consumed', Number.isFinite(item.consumption) ? item.consumption + ' m?' : 'Not recorded'],
      ['Applied payment', WaterStore.money(item.amount)],
      ['Bill balance after payment', WaterStore.money(item.balanceAfter)]
    ];
    rows.forEach(([label, value], index) => {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label; description.textContent = value;
      if (index === 0) { term.className = 'receipt-allocation-start'; description.className = 'receipt-allocation-start'; }
      details.append(term, description);
    });
  });
}
