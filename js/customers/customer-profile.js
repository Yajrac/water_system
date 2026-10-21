// Customer overview and account activation controls.
const profileRecords = { customers: [], bills: [], payments: [], disconnections: [] };
const profileId = new URLSearchParams(location.search).get('id');
let profileCustomer = null;

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

function renderCustomerProfile() {
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
    toggle.className =
      'btn ' + (WaterStore.isActive(customer) ? 'action-deactivate' : 'action-view');
    toggle.textContent = WaterStore.isActive(customer) ? 'Deactivate account' : 'Activate account';

    document.querySelector('.profile-actions').appendChild(toggle);
    toggle.addEventListener('click', async () => {
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
      try {
        await CustomerAPI.changeStatus(
          customer,
          active ? 'Inactive' : 'Active',
          active ? 'Deactivated by administrator.' : 'Activated by administrator.',
        );
        await showNotice(
          'Status updated successfully',
          active ? 'Account deactivated.' : 'Account activated.',
        );
        location.reload();
      } catch (error) {
        toggle.disabled = false;
        AdminUI.message(error.message);
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
    const paymentLink = document.getElementById('profilePayments');
    paymentLink.href = '#profilePaymentRows';
    paymentLink.addEventListener('click', (event) => {
      event.preventDefault();
      selectProfileTab(
        profileTabs.find((tab) => tab.getAttribute('aria-controls') === 'billingPanel'),
      );
      document.getElementById('profilePaymentRows').scrollIntoView({ block: 'center' });
    });
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
      ['Date applied', customer.dateApplied],
      ['Date approved', customer.dateApproved],
      ['Date installed', customer.dateInstalled],
      ['Approved by', customer.approvedBy],
      ['Nature of work', customer.natureOfWork],
    ]);
    const missingDocuments = [
      ['certificateReceived', 'Barangay certification / property-right document'],
      ['contractReceived', 'Signed service contract'],
      ['acknowledgementReceived', 'Meter / accessories acknowledgement'],
    ]
      .filter(([key]) => !customer[key])
      .map(([, label]) => label);
    const documentSummary = document.getElementById('documentSummary');
    documentSummary.textContent = missingDocuments.length
      ? 'Incomplete documents: ' + missingDocuments.join(', ')
      : 'Complete documents';
    documentSummary.setAttribute('data-complete', String(!missingDocuments.length));
    profileDetails('documentStatus', [
      [
        'Barangay certification',
        customer.certificateReceived ? 'Verified' : 'Pending verification',
      ],
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
          (value, index) =>
            AdminUI.cell(row, value, ['Receipt', 'Date', 'Method', 'Amount'][index]),
        );
      });
    AdminUI.empty(paymentBody, 4, 'No payments recorded for this customer yet.');
  }
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

// Decorative icon fonts keep profile actions and summary cards consistent.
function addProfileIcon(selector) {
  const names = {
    '#editProfile': 'pencil-square',
    '#profileApplication': 'file-earmark-text',
    '#profilePayments': 'clock-history',
    '.profile-summary > div:nth-child(1) span': 'wallet2',
    '.profile-summary > div:nth-child(2) span': 'check-circle-fill',
    '.profile-summary > div:nth-child(3) span': 'droplet-fill',
    '.profile-summary > div:nth-child(4) span': 'receipt',
  };
  document.querySelectorAll(selector).forEach((element) => {
    if (element.querySelector('svg, .bi')) return;
    const icon = document.createElement('i');
    icon.className = 'profile-icon bi bi-' + names[selector];
    icon.setAttribute('aria-hidden', 'true');
    element.prepend(icon);
  });
}
addProfileIcon('#editProfile');
addProfileIcon('#profileApplication');
addProfileIcon('#profilePayments');
addProfileIcon('.profile-summary > div:nth-child(1) span');
addProfileIcon('.profile-summary > div:nth-child(2) span');
addProfileIcon('.profile-summary > div:nth-child(3) span');
addProfileIcon('.profile-summary > div:nth-child(4) span');

AdminAuth.ready.then(async (user) => {
  if (!user) return;
  document.getElementById('profileContent').hidden = true;
  AdminUI.message('Loading customer profile...');
  try {
    if (!profileId) throw new Error('Choose a customer from the table.');
    const result = await CustomerAPI.profile(profileId);
    profileCustomer = result.customer;
    profileRecords.customers = [result.customer];
    profileRecords.bills = result.bills;
    profileRecords.payments = result.payments;
    renderCustomerProfile();
    document.getElementById('profileContent').hidden = false;
    AdminUI.message('');
  } catch (error) {
    AdminUI.message(error.message + ' Reload the page to try again.');
  }
});
