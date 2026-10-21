function renderDashboard(data) {
  const summary = document.getElementById('summary');
  summary.replaceChildren();
  const s = data.summary;
  [
    [
      'Total customers',
      s.totalCustomers,
      s.registeredCustomers + ' approved or installed',
      'people-fill',
    ],
    [
      'Registered service areas',
      s.barangays,
      s.activeBarangays + ' active barangays',
      'geo-alt-fill',
    ],
    ['Generated bills', s.bills, 'All billing periods', 'file-earmark-text-fill'],
    ['Unpaid bills', s.unpaidBills, s.overdue + ' overdue bills', 'hourglass-split'],
    [
      'Outstanding balance',
      WaterStore.money(Number(s.outstanding)),
      'Remaining unpaid amount',
      'wallet2',
    ],
    [
      'Collections today',
      WaterStore.money(Number(s.todayCollections)),
      'Philippine calendar day',
      'cash-stack',
    ],
    [
      'Collections this month',
      WaterStore.money(Number(s.monthCollections)),
      'Current Philippine month',
      'calendar-check-fill',
    ],
    [
      'Payments received',
      WaterStore.money(Number(s.totalCollections)),
      'Total recorded payments',
      'cash-coin',
    ],
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
