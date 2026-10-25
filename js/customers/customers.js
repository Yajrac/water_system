const customerPagination = createPagination('customerPagination', loadCustomers);
const customerImportDialog = document.getElementById('customerImportDialog');
let customerLoadVersion = 0;
let searchTimer;
let importingCustomers = false;

function renderCustomerRows(customers) {
  const body = document.getElementById('customerRows');
  body.replaceChildren();
  customers.forEach((customer) => {
    const row = body.insertRow();
    const displayName = customer.lastName
      ? [customer.lastName, customer.extensionName].filter(Boolean).join(' ') +
        ', ' +
        [customer.firstName, customer.middleName].filter(Boolean).join(' ')
      : customer.name;
    AdminUI.customer(row, { ...customer, name: displayName });
    AdminUI.cell(row, customer.barangay, 'Barangay');
    AdminUI.cell(row, customer.contact, 'Contact');
    AdminUI.cell(row, customer.reading + ' m\u00b3', 'Meter reading');
    const status = document.createElement('span');
    status.className = 'customer-status ' + (customer.active ? 'is-registered' : 'status-overdue');
    status.textContent = customer.active ? 'Registered' : customer.connectionStatus;
    if (customer.serviceStatus === 'Pending') {
      status.textContent = 'Pending';
      status.className = 'customer-status is-pending';
    }
    if (customer.serviceStatus === 'Approved' && !customer.active) {
      status.textContent = 'Approved';
      status.className = 'customer-status is-registered';
    }
    const statusCell = AdminUI.cell(row, '', 'Status');
    statusCell.appendChild(status);
    if (customer.mustChangePassword) {
      const flag = document.createElement('span');
      flag.className = 'customer-temporary-password';
      const icon = document.createElement('i');
      icon.className = 'bi bi-flag-fill';
      icon.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = 'Temporary password';
      flag.append(icon, label);
      statusCell.appendChild(flag);
    }
    const actions = document.createElement('div');
    actions.className = 'customer-row-actions';
    for (const [label, page, icon, className] of [
      ['Edit', 'customer-form.html', 'pencil-square', 'action-edit'],
      ['View profile', 'customer-profile.html', 'eye', 'action-view'],
    ]) {
      const link = document.createElement('a');
      link.href = page + '?id=' + encodeURIComponent(customer.id);
      link.className = 'btn ' + className;
      link.title = label;
      link.setAttribute('aria-label', label + ' ' + displayName);
      const image = document.createElement('i');
      image.className = 'bi bi-' + icon;
      image.setAttribute('aria-hidden', 'true');
      link.appendChild(image);
      actions.appendChild(link);
    }
    AdminUI.cell(row, '', 'Actions').appendChild(actions);
  });
  AdminUI.empty(body, 6, 'No database customers match your filters.');
}

async function loadCustomers() {
  const version = ++customerLoadVersion;
  const body = document.getElementById('customerRows');
  body.setAttribute('aria-busy', 'true');
  if (!body.children.length) AdminUI.empty(body, 6, 'Loading customers...');
  document.getElementById('retryCustomers').hidden = true;
  try {
    const result = await CustomerAPI.list({
      page: customerPagination.page,
      limit: 10,
      search: document.getElementById('customerSearch').value.trim(),
      barangayId: document.getElementById('barangayFilter').value,
      status: document.getElementById('customerStatusFilter').value,
      type: document.getElementById('customerTypeFilter').value,
    });
    if (version !== customerLoadVersion) return;
    customerPagination.page = result.pagination.page;
    customerPagination.update(result.pagination.total);
    renderCustomerRows(result.customers);
    document.getElementById('customerCount').textContent =
      result.pagination.total + ' matching customers';
    document.getElementById('totalCustomers').textContent = result.summary.total;
    document.getElementById('registeredCustomers').textContent = result.summary.registered;
    document.getElementById('pendingCustomers').textContent = result.summary.pending;
  } catch (error) {
    if (version !== customerLoadVersion) return;
    body.replaceChildren();
    AdminUI.empty(body, 6, error.message);
    document.getElementById('customerCount').textContent = 'Could not load customers';
    document.getElementById('retryCustomers').hidden = false;
    customerPagination.update(0);
  } finally {
    if (version === customerLoadVersion) body.setAttribute('aria-busy', 'false');
  }
}
function resetCustomerPage() {
  customerPagination.page = 1;
  loadCustomers();
}
for (const id of ['barangayFilter', 'customerStatusFilter', 'customerTypeFilter'])
  document.getElementById(id).addEventListener('change', resetCustomerPage);
document.getElementById('customerSearch').addEventListener('input', () => {
  clearTimeout(searchTimer);
  customerLoadVersion++;
  searchTimer = setTimeout(resetCustomerPage, 250);
});
document.getElementById('retryCustomers').addEventListener('click', loadCustomers);
document.getElementById('openCustomerImport').addEventListener('click', () => {
  if (importingCustomers) return;
  document.getElementById('customerImportMessage').textContent = '';
  document.getElementById('importForm').reset();
  customerImportDialog.showModal();
});
document.getElementById('closeCustomerImport').addEventListener('click', () => {
  if (!importingCustomers) customerImportDialog.close();
});
customerImportDialog.addEventListener('cancel', (event) => {
  if (importingCustomers) event.preventDefault();
});
const customerExportDialog = document.getElementById('customerExportDialog');
let exportCustomers = [];
let exportVersion = 0;
customerExportDialog.addEventListener('close', () => {
  exportVersion++;
  exportCustomers = [];
});
document
  .getElementById('closeCustomerExport')
  .addEventListener('click', () => customerExportDialog.close());
document.getElementById('exportCustomers').addEventListener('click', async () => {
  const version = ++exportVersion;
  const message = document.getElementById('customerExportMessage');
  const confirm = document.getElementById('confirmCustomerExport');
  exportCustomers = [];
  confirm.disabled = true;
  message.textContent = 'Checking customer records. Please wait...';
  message.setAttribute('data-state', 'checking');
  customerExportDialog.showModal();
  customerExportDialog.setAttribute('aria-busy', 'true');
  try {
    const filters = {
      limit: 100,
      search: document.getElementById('customerSearch').value.trim(),
      barangayId: document.getElementById('barangayFilter').value,
      status: document.getElementById('customerStatusFilter').value,
      type: document.getElementById('customerTypeFilter').value,
    };
    const customers = [];
    let page = 1;
    let total;
    do {
      const result = await CustomerAPI.list({ ...filters, page });
      if (version !== exportVersion) return;
      customers.push(...result.customers);
      total = result.pagination.total;
      if (!result.customers.length) break;
      page++;
    } while (customers.length < total);
    exportCustomers = customers;
    if (!customers.length) {
      message.textContent =
        'No data to export. Add or bulk upload customer records, or clear your filters.';
      message.setAttribute('data-state', 'error');
      return;
    }
    message.textContent =
      customers.length + ' customer records ready to export. Passwords are excluded.';
    message.setAttribute('data-state', 'ready');
    confirm.disabled = false;
  } catch (error) {
    if (version !== exportVersion) return;
    message.textContent = error.message;
    message.setAttribute('data-state', 'error');
  } finally {
    if (version === exportVersion) customerExportDialog.setAttribute('aria-busy', 'false');
  }
});
document.getElementById('confirmCustomerExport').addEventListener('click', async () => {
  if (!exportCustomers.length) return;
  const button = document.getElementById('confirmCustomerExport');
  if (button.disabled) return;
  button.disabled = true;
  const count = exportCustomers.length;
  try {
    downloadCustomerExcel(exportCustomers, 'customers.xlsx');
    customerExportDialog.close();
    await showNotice(
      'Customers exported successfully',
      count + ' customer records are ready. Your Excel download has started.',
    );
  } catch (error) {
    document.getElementById('customerExportMessage').textContent = error.message;
    document.getElementById('customerExportMessage').setAttribute('data-state', 'error');
    button.disabled = false;
  }
});

document.getElementById('importForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (importingCustomers) return;
  const importMessage = document.getElementById('customerImportMessage');
  const progress = document.getElementById('customerImportProgress');
  importMessage.textContent = '';
  importMessage.setAttribute('data-state', 'error');
  const file = document.getElementById('customerFile').files[0];
  if (!file || !file.name.toLowerCase().endsWith('.xlsx') || file.size > 1000000) {
    importMessage.textContent =
      'Choose an Excel (.xlsx) file up to 1 MB, with at most 100 customer rows.';
    return;
  }
  importingCustomers = true;
  progress.hidden = false;
  progress.removeAttribute('value');
  const button = event.target.querySelector('[type="submit"], button');
  const uploadLabel = button.querySelector?.('span') || button;
  button.disabled = true;
  const originalLabel = uploadLabel.textContent;
  uploadLabel.textContent = 'Checking Excel...';
  importMessage.setAttribute('data-state', 'checking');
  importMessage.textContent = 'Checking Excel file and customer records. Please wait...';
  event.target.setAttribute('aria-busy', 'true');
  document.getElementById('customerFile').disabled = true;
  try {
    // Let the browser paint the checking state before parsing the workbook.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const customers = await readCustomerExcel(file);
    importMessage.textContent =
      'Checking ' + customers.length + ' customers and resolving their barangays...';
    uploadLabel.textContent = 'Checking barangays...';
    const preview = await AdminAPI.request('/customers/import/preview', {
      method: 'POST',
      body: { customers },
    });
    const newAreas = preview.barangaysToRegister;
    const ready = preview.count;
    const reviewTable = renderCustomerImportReview(preview.rows);
    event.target.setAttribute('aria-busy', 'false');
    progress.hidden = true;
    importMessage.setAttribute('data-state', 'ready');
    importMessage.textContent =
      ready +
      ' ready · ' +
      preview.rejectedCount +
      ' rejected. ' +
      newAreas.length +
      ' barangays will be automatically registered.';
    uploadLabel.textContent = 'Confirm upload';
    if (!ready) {
      await showNotice(
        'No valid customers to import',
        'Review the rejected rows below and correct the Excel file.',
        reviewTable,
      );
      return;
    }
    if (
      !(await confirmAction(
        'Review customer import',
        ready +
          ' ready · ' +
          preview.rejectedCount +
          ' rejected. Only ready rows will be saved. Saved status, dates, meter details and document checks from the file will be preserved. The submitter number will be the temporary password, requiring a change at first login.' +
          (newAreas.length
            ? ' Registering: ' + newAreas.join(', ') + '.'
            : ' All barangays are already registered.'),
        'Import ' + ready + ' customers',
        reviewTable,
      ))
    )
      return;
    uploadLabel.textContent = 'Importing customers...';
    event.target.setAttribute('aria-busy', 'true');
    progress.hidden = false;
    importMessage.setAttribute('data-state', 'checking');
    importMessage.textContent =
      (newAreas.length ? 'Registering ' + newAreas.length + ' barangays and saving ' : 'Saving ') +
      ready +
      ' customers. Please wait...';
    const result = await AdminAPI.request('/customers/import', {
      method: 'POST',
      body: { customers, reviewRevision: preview.revision },
    });
    customerImportDialog.close();
    event.target.reset();
    document.getElementById('customerSearch').value = '';
    for (const id of ['barangayFilter', 'customerStatusFilter', 'customerTypeFilter'])
      document.getElementById(id).value = '';
    customerPagination.page = 1;
    clearTimeout(searchTimer);
    try {
      const barangays = await CustomerAPI.loadBarangays();
      const filter = document.getElementById('barangayFilter');
      filter.replaceChildren(new Option('All barangays', ''));
      barangays.forEach((item) => filter.add(new Option(item.name, String(item.id))));
    } catch (error) {
      AdminUI.message('Import saved. Reload to refresh the barangay filter. ' + error.message);
    }
    await loadCustomers();
    await showNotice(
      'Customers imported successfully',
      result.count +
        ' customers imported; ' +
        result.rejectedCount +
        ' rejected rows skipped. ' +
        result.barangaysRegistered +
        ' barangays automatically registered.',
    );
  } catch (error) {
    importMessage.setAttribute('data-state', 'error');
    importMessage.textContent = error.message;
    importMessage.focus();
  } finally {
    importingCustomers = false;
    progress.hidden = true;
    button.disabled = false;
    uploadLabel.textContent = originalLabel;
    document.getElementById('customerFile').disabled = false;
    event.target.setAttribute('aria-busy', 'false');
  }
});
AdminAuth.ready.then(async (user) => {
  if (!user) return;
  try {
    const barangays = await CustomerAPI.loadBarangays();
    const filter = document.getElementById('barangayFilter');
    filter.replaceChildren(new Option('All barangays', ''));
    barangays.forEach((item) => filter.add(new Option(item.name, String(item.id))));
  } catch (error) {
    AdminUI.message(error.message);
  }
  await loadCustomers();
});
