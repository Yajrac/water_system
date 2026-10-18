// Customer overview and account activation controls.
const profileRecords = WaterStore.load();
const profileId = new URLSearchParams(location.search).get('id');
const profileCustomer = profileRecords.customers.find((customer) => customer.id === profileId);

function profileDetails(containerId, rows) {
  const container = document.getElementById(containerId);
  rows.forEach(([label, value]) => {
    const item = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value === '' || value == null ? 'Not recorded' : value;
    item.append(term, description);
    container.appendChild(item);
  });
}

if (!profileCustomer) {
  document.getElementById('profileContent').hidden = true;
  AdminUI.message('Customer not found. Return to Customers and choose a saved profile.');
} else {
  const customer = profileCustomer;
  profileDetails('coreRegistryDetails', [
    ['Full name', customer.name],
    ['Submitter number', customer.submitterNumber],
    ['Registered barangay', customer.barangay],
    ['Username', customer.username],
  ]);
  const bills = profileRecords.bills.filter((bill) => bill.customerId === profileId);
  const payments = profileRecords.payments.filter((payment) => payment.customerId === profileId);
  const balance = bills.reduce((sum, bill) => sum + WaterStore.balance(bill, profileRecords), 0);
  document.getElementById('profileName').textContent = customer.name;
  document.getElementById('profileAccount').textContent = 'Account ID: ' + customer.account;
  const avatar = document.getElementById('profileAvatar');
  const gender =
    customer.gender === 'Male' ? 'male' : customer.gender === 'Female' ? 'female' : 'neutral';
  const image = document.createElement('img');
  image.src = '../assets/images/avatar-' + gender + '.svg';
  image.alt = '';
  image.width = 88;
  image.height = 88;
  avatar.replaceChildren(image);
  const status = document.getElementById('profileStatus');
  status.textContent = WaterStore.isRegistered(customer) ? 'Registered' : 'Pending application';
  status.className =
    'customer-status ' + (WaterStore.isRegistered(customer) ? 'is-registered' : 'is-pending');
  const activity = document.createElement('span');
  activity.className =
    'customer-status ' + (WaterStore.isActive(customer) ? 'status-paid' : 'status-overdue');
  activity.textContent =
    customer.connectionStatus === 'Disconnected'
      ? 'Disconnected'
      : WaterStore.isActive(customer)
        ? 'Active'
        : 'Inactive';
  status.after(activity);
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn ' + (WaterStore.isActive(customer) ? 'action-deactivate' : 'action-view');
  toggle.textContent = WaterStore.isActive(customer) ? 'Deactivate account' : 'Activate account';
  if (customer.connectionStatus === 'Disconnected') toggle.textContent = 'View disconnection';
  document.querySelector('.profile-actions').appendChild(toggle);
  toggle.addEventListener('click', async () => {
    if (customer.connectionStatus === 'Disconnected') {
      location.href = 'disconnected.html';
      return;
    }
    toggle.disabled = true;
    const active = WaterStore.isActive(customer);
    const accepted = await confirmAction(
      active ? 'Deactivate customer?' : 'Activate customer?',
      active
        ? 'New bills cannot be generated for this account while inactive. Existing records and outstanding payments remain available.'
        : 'This account will be available for new billing if its registration is complete.',
      active ? 'Deactivate' : 'Activate',
    );
    if (!accepted) {
      toggle.disabled = false;
      return;
    }
    const latest = WaterStore.load();
    const account = latest.customers.find((item) => item.id === profileId);
    if (!account) {
      toggle.disabled = false;
      return AdminUI.message('Customer no longer exists.');
    }
    account.active = !active;
    account.statusChangedOn = WaterStore.today();
    try {
      WaterStore.save(latest);
      location.reload();
    } catch {
      toggle.disabled = false;
      AdminUI.message('Could not save the account status. Please try again.');
    }
  });
  const latestBill = bills.slice().sort((a, b) => b.cycle.localeCompare(a.cycle))[0];
  const reading = (value) => (Number.isFinite(value) ? value + ' m³' : 'Not recorded');
  document.getElementById('meterCycle').textContent = latestBill
    ? 'Latest billed consumption · ' + latestBill.cycle
    : 'No billed consumption yet';
  document.getElementById('meterPrevious').textContent = latestBill
    ? reading(latestBill.previous)
    : '—';
  document.getElementById('meterCurrent').textContent = latestBill
    ? reading(latestBill.current)
    : reading(customer.reading);
  document.getElementById('meterConsumption').textContent = latestBill
    ? reading(latestBill.consumption)
    : '—';
  document.getElementById('meterNumberLabel').textContent =
    customer.meterNumber || 'Meter number not recorded';
  document.getElementById('profileBalance').textContent = WaterStore.money(balance);
  document.getElementById('profilePaid').textContent = WaterStore.money(
    payments.reduce((sum, payment) => sum + payment.amount, 0),
  );
  document.getElementById('profileReading').textContent = (customer.reading ?? 0) + ' m³';
  document.getElementById('profileBillCount').textContent = bills.length;
  document.getElementById('editProfile').href =
    'customer-form.html?id=' + encodeURIComponent(profileId);
  document.getElementById('profilePayments').href =
    'payment-history.html?customer=' + encodeURIComponent(profileId);
  document.getElementById('profileApplication').href =
    'customer-application.html?id=' + encodeURIComponent(profileId);
  profileDetails('personalDetails', [
    ['Full name', customer.name],
    ['Contact number', customer.contact],
    ['Purok / street', [customer.address, customer.street].filter(Boolean).join(', ')],
    ['Barangay', customer.barangay],
    ['Customer type', customer.customerType],
    ['Application number', customer.applicationNumber],
  ]);
  profileDetails('connectionDetails', [
    [
      'Connection status',
      customer.connectionStatus || (WaterStore.isActive(customer) ? 'Connected' : 'Inactive'),
    ],
    [
      'Disconnection reason',
      profileRecords.disconnections?.find(
        (item) => item.customerId === profileId && !item.reconnectedOn,
      )?.reason || '—',
    ],
    ['Service status', customer.serviceStatus],
    ['Meter number', customer.meterNumber],
    ['Meter kind / size', [customer.meterKind, customer.meterSize].filter(Boolean).join(' / ')],
    ['Cluster', customer.clusterNumber],
    ['Date applied', customer.dateApplied],
    ['Date approved', customer.dateApproved],
    ['Date installed', customer.dateInstalled],
    ['Installed by', customer.installedBy],
  ]);
  profileDetails('documentStatus', [
    ['Barangay certification', customer.certificateReceived ? 'Verified' : 'Pending verification'],
    ['Signed service contract', customer.contractReceived ? 'Received' : 'Pending verification'],
    [
      'Accessories acknowledgement',
      customer.acknowledgementReceived ? 'Received' : 'Pending verification',
    ],
  ]);
  const body = document.getElementById('profileBillRows');
  bills
    .sort((a, b) => b.cycle.localeCompare(a.cycle))
    .slice(0, 5)
    .forEach((bill) => {
      const row = body.insertRow();
      [
        bill.cycle,
        bill.due,
        WaterStore.money(bill.total),
        WaterStore.money(WaterStore.balance(bill, profileRecords)),
        WaterStore.status(bill, profileRecords),
      ].forEach((value, index) =>
        AdminUI.cell(row, value, ['Month', 'Due date', 'Total', 'Balance', 'Status'][index]),
      );
    });
  AdminUI.empty(body, 5, 'No bills generated for this customer yet.');
  const paymentBody = document.getElementById('profilePaymentRows');
  payments
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .forEach((payment) => {
      const row = paymentBody.insertRow();
      [payment.receipt, payment.date, payment.method, WaterStore.money(payment.amount)].forEach(
        (value, index) => AdminUI.cell(row, value, ['Receipt', 'Date', 'Method', 'Amount'][index]),
      );
    });
  AdminUI.empty(paymentBody, 4, 'No payments recorded for this customer yet.');
}

const profileTabs = Array.from(document.querySelectorAll('.profile-tabs [role="tab"]'));
function selectProfileTab(selected) {
  profileTabs.forEach((tab) => {
    const active = tab === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
  });
}
profileTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectProfileTab(tab));
  tab.addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % profileTabs.length;
    if (event.key === 'ArrowLeft') next = (index + profileTabs.length - 1) % profileTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = profileTabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectProfileTab(profileTabs[next]);
    profileTabs[next].focus();
  });
});

// Inline SVG icons inherit the current theme and stay decorative beside text.
function addProfileIcon(selector, path) {
  document.querySelectorAll(selector).forEach((element) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('profile-icon');
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shape.setAttribute('d', path);
    svg.appendChild(shape);
    element.prepend(svg);
  });
}
addProfileIcon('#editProfile', 'M15 5l4 4M4 20l5-1L20 8a3 3 0 0 0-4-4L5 15z');
addProfileIcon('#profileApplication', 'M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h5');
addProfileIcon('#profilePayments', 'M4 8a9 9 0 1 1-1 8M3 3v5h5M12 7v5l3 2');
addProfileIcon('.profile-summary > div:nth-child(1) span', 'M3 6h18v14H3zM3 10h18M16 14h5');
addProfileIcon('.profile-summary > div:nth-child(2) span', 'M5 12l4 4L19 6M4 21h16');
addProfileIcon(
  '.profile-summary > div:nth-child(3) span',
  'M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12z',
);
addProfileIcon(
  '.profile-summary > div:nth-child(4) span',
  'M5 3h14v18l-3-2-4 2-4-2-3 2zM8 8h8M8 12h8',
);
