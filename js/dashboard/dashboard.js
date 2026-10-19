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
      'people-fill',
    ],
    [
      'Generated bills',
      dashboardRecords.bills.length,
      'Saved billing records',
      'file-earmark-text-fill',
    ],
    ['Outstanding balance', WaterStore.money(outstanding), 'Remaining unpaid amount', 'wallet2'],
    ['Payments received', WaterStore.money(received), 'Total recorded payments', 'cash-coin'],
  ].forEach(([label, value, description, iconName]) => {
    const item = document.createElement('div');
    item.className = 'record-card';
    const top = document.createElement('div');
    top.className = 'record-card-top';
    const heading = document.createElement('h3');
    heading.textContent = label;
    const icon = document.createElement('i');
    icon.className = 'bi bi-' + iconName;
    icon.setAttribute('aria-hidden', 'true');
    top.append(heading, icon);
    const number = document.createElement('strong');
    number.textContent = value;
    if (typeof value === 'string' && value.includes('\u20b1')) number.classList.add('money-value');
    const caption = document.createElement('p');
    caption.textContent = description;
    item.append(top, number, caption);
    summary.appendChild(item);
  });
}
