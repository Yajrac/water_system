const disconnectPager = createPagination('disconnectPagination', showDisconnections);
let changingAccount = false;
function showDisconnections() {
  const records = WaterStore.load();
  const query = document.getElementById('disconnectSearch').value.trim().toLowerCase();
  const status = document.getElementById('disconnectStatus').value;
  const customers = records.customers.filter((customer) => {
    const active = WaterStore.isActive(customer);
    return (
      (status === 'all' || (status === 'open' ? !active : active)) &&
      [customer.name, customer.account, customer.submitterNumber]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  });
  const body = document.getElementById('disconnectRows');
  body.replaceChildren();
  disconnectPager.update(customers.length);
  disconnectPager.items(customers).forEach((customer) => {
    const entries = (records.disconnections || []).filter(
      (entry) => entry.customerId === customer.id,
    );
    const open = entries.find((entry) => !entry.reconnectedOn);
    const latest = entries[entries.length - 1];
    const active = WaterStore.isActive(customer);
    const row = body.insertRow();
    AdminUI.customer(row, customer);
    AdminUI.cell(
      row,
      open?.disconnectedOn || latest?.disconnectedOn || 'Not recorded',
      'Disconnected on',
    );
    AdminUI.cell(row, open?.reason || latest?.reason || 'Not recorded', 'Reason');
    const balance = records.bills
      .filter((bill) => bill.customerId === customer.id)
      .reduce((sum, bill) => sum + WaterStore.balance(bill, records), 0);
    AdminUI.cell(row, WaterStore.money(balance), 'Outstanding balance');
    const statusCell = AdminUI.cell(row, '', 'Status');
    const badge = document.createElement('span');
    badge.className = 'payment-status ' + (active ? 'status-paid' : 'status-overdue');
    badge.textContent = active
      ? 'Active'
      : customer.connectionStatus === 'Disconnected'
        ? 'Disconnected'
        : 'Inactive';
    statusCell.appendChild(badge);
    const actions = AdminUI.cell(row, '', 'Actions');
    const profile = document.createElement('a');
    profile.className = 'btn action-view';
    profile.href = 'customer-profile.html?id=' + encodeURIComponent(customer.id);
    profile.textContent = 'Profile';
    actions.appendChild(profile);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn ' + (active ? 'action-deactivate' : 'action-view');
    button.textContent = active ? 'Deactivate' : 'Activate';
    actions.appendChild(button);
    button.addEventListener('click', async () => {
      if (changingAccount) return;
      changingAccount = true;
      button.disabled = true;
      try {
        const accepted = await confirmAction(
          active ? 'Deactivate account?' : 'Activate account?',
          customer.name +
            '\n' +
            (active
              ? 'New billing will be blocked while inactive.'
              : 'This account will be enabled for billing if registration is complete.') +
            '\nExisting bills, payments and balances remain unchanged.',
          active ? 'Deactivate' : 'Activate',
        );
        if (!accepted) return;
        const fresh = WaterStore.load();
        const account = fresh.customers.find((item) => item.id === customer.id);
        if (!account || WaterStore.isActive(account) !== active)
          throw Error('Account status changed. Reload and try again.');
        const disconnection = (fresh.disconnections || []).find(
          (entry) => entry.customerId === customer.id && !entry.reconnectedOn,
        );
        if (!active && disconnection) AccountRecords.reconnect(fresh, disconnection.id);
        else {
          account.active = !active;
          account.statusChangedOn = WaterStore.today();
          if (!active && account.connectionStatus === 'Disconnected')
            account.connectionStatus = 'Connected';
        }
        WaterStore.save(fresh);
        showDisconnections();
        AdminUI.message(active ? 'Account deactivated.' : 'Account activated.');
      } catch (error) {
        AdminUI.message(error.message);
      } finally {
        changingAccount = false;
        button.disabled = false;
      }
    });
  });
  AdminUI.empty(body, 6, 'No accounts match your search and status filter.');
}
['disconnectSearch', 'disconnectStatus'].forEach((id) =>
  document
    .getElementById(id)
    .addEventListener(id === 'disconnectSearch' ? 'input' : 'change', () => {
      disconnectPager.page = 1;
      showDisconnections();
    }),
);
showDisconnections();
async function loadSampleDisconnections() {
  const rows = document.getElementById('disconnectRows');
  rows.setAttribute('aria-busy', 'true');
  try {
    await fetchSampleServiceRecords();
    showDisconnections();
  } catch {
    AdminUI.message('Could not load sample records. Existing records are still available.');
  } finally {
    rows.setAttribute('aria-busy', 'false');
  }
}
loadSampleDisconnections();
