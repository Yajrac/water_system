function renderDashboard() {
  const dashboardRecords = WaterStore.load();
  const summary = document.getElementById('summary');
  const outstanding = dashboardRecords.bills.reduce(
    (total, bill) => total + WaterStore.balance(bill, dashboardRecords),
    0,
  );
  const received = dashboardRecords.payments.reduce((total, payment) => total + payment.amount, 0);
  [
    [
      'Registered customers',
      dashboardRecords.customers.filter((customer) => WaterStore.isRegistered(customer)).length,
      'Verified customer accounts',
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0a4 4 0 0 1 8 0',
    ],
    [
      'Generated bills',
      dashboardRecords.bills.length,
      'Saved billing records',
      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5',
    ],
    [
      'Outstanding balance',
      WaterStore.money(outstanding),
      'Remaining unpaid amount',
      'M12 3v18 M16 7H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H7',
    ],
    [
      'Payments received',
      WaterStore.money(received),
      'Total recorded payments',
      'M3 5h18v14H3z M3 9h18 M7 15h4',
    ],
  ].forEach(([label, value, description, iconPath]) => {
    const item = document.createElement('div');
    item.className = 'record-card';
    const top = document.createElement('div');
    top.className = 'record-card-top';
    const heading = document.createElement('h3');
    heading.textContent = label;
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    const drawing = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    drawing.setAttribute('d', iconPath);
    icon.appendChild(drawing);
    top.append(heading, icon);
    const number = document.createElement('strong');
    number.textContent = value;
  if (typeof value === 'string' && value.includes('\u20b1')) number.classList.add('money-value');
    const caption = document.createElement('p');
    caption.textContent = description;
    item.append(top, number, caption);
    if (label === 'Outstanding balance') {
      const link = document.createElement('a');
      link.href = 'bill-balances.html';
      link.className = 'dashboard-balance-link';
      link.textContent = 'View balances ?';
      item.appendChild(link);
    }
    summary.appendChild(item);
  });
}
