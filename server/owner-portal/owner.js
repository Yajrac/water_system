(() => {
  const $ = (id) => document.getElementById(id);
  const labels = {
    payments: 'Payments',
    bill_late_fee_events: 'Late fee events',
    late_fee_assessments: 'Late fee assessments',
    bills: 'Bills',
    meter_entries: 'Meter readings',
    water_meters: 'Water meters',
    application_documents: 'Application documents',
    application_estimates: 'Application estimates',
    customer_applications: 'Applications',
    announcement_recipients: 'Announcement recipients',
    connection_events: 'Connection events',
    feedback_messages: 'Feedback messages',
    feedback_threads: 'Feedback threads',
    notification_reads: 'Notification reads',
    push_deliveries: 'Push deliveries',
    push_devices: 'Push devices',
    activity_logs: 'Consumer activity logs',
    login_attempts: 'Login attempts',
    customers: 'Customer record',
    users: 'Consumer app login',
  };
  let token = null;
  let selected = null;
  try { token = sessionStorage.getItem('ownerToken'); } catch {}

  function saveToken(value) {
    token = value;
    try {
      if (value) sessionStorage.setItem('ownerToken', value);
      else sessionStorage.removeItem('ownerToken');
    } catch {}
  }

  function show(signedIn) {
    $('loginView').hidden = signedIn;
    $('workView').hidden = !signedIn;
    $('signOut').hidden = !signedIn;
    if (signedIn) { $('query').focus(); loadCustomers(); }
    else $('password').focus();
  }

  async function api(path, options = {}) {
    const response = await fetch('api/' + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 && token) {
      saveToken(null);
      show(false);
      $('loginError').textContent = body.message || 'Session expired. Sign in again.';
    }
    if (!response.ok) throw new Error(body.message || 'Request failed.');
    return body.data;
  }

  $('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('loginButton');
    button.disabled = true;
    $('loginError').textContent = '';
    try {
      const data = await api('login', { method: 'POST', body: JSON.stringify({ password: $('password').value }) });
      saveToken(data.token);
      $('password').value = '';
      show(true);
    } catch (error) {
      $('loginError').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  $('signOut').addEventListener('click', () => {
    saveToken(null);
    closePreview();
    $('results').replaceChildren();
    $('searchStatus').textContent = '';
    $('pager').hidden = true;
    show(false);
  });

  let page = 1;
  let query = '';

  async function loadCustomers() {
    $('searchStatus').textContent = 'Loading…';
    try {
      const data = await api('customers?q=' + encodeURIComponent(query) + '&page=' + page);
      const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
      $('searchStatus').textContent = data.total
        ? data.total + ' customer' + (data.total === 1 ? '' : 's') + (query ? ' found' : '')
        : query ? 'No customer matches "' + query + '".' : 'No customers yet.';
      $('results').replaceChildren(...data.rows.map(resultRow));
      $('pager').hidden = pages < 2;
      $('pageLabel').textContent = 'Page ' + data.page + ' of ' + pages;
      $('prevPage').disabled = data.page <= 1;
      $('nextPage').disabled = data.page >= pages;
    } catch (error) {
      $('searchStatus').textContent = error.message;
    }
  }

  $('searchForm').addEventListener('submit', (event) => {
    event.preventDefault();
    query = $('query').value.trim();
    page = 1;
    $('doneMessage').hidden = true;
    closePreview();
    loadCustomers();
  });
  $('prevPage').addEventListener('click', () => { page -= 1; closePreview(); loadCustomers(); });
  $('nextPage').addEventListener('click', () => { page += 1; closePreview(); loadCustomers(); });

  function cell(text, className) {
    const td = document.createElement('td');
    if (className) td.className = className;
    td.textContent = text;
    return td;
  }

  function resultRow(row) {
    const tr = document.createElement('tr');
    const status = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = 'pill pill-' + String(row.status).toLowerCase();
    pill.textContent = row.status;
    status.appendChild(pill);
    const action = document.createElement('td');
    action.className = 'action';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-danger-soft';
    button.textContent = 'Delete';
    button.setAttribute('aria-label', 'Delete ' + row.name);
    button.addEventListener('click', () => openPreview(row.id, tr));
    action.appendChild(button);
    tr.append(
      cell(row.accountNumber, 'mono'),
      cell(row.name, 'name'),
      cell(row.barangay),
      status,
      cell(row.bills, 'num'),
      cell(row.payments, 'num'),
      cell(row.userId ? 'Yes' : '—'),
      action,
    );
    return tr;
  }

  async function openPreview(id, button) {
    document.querySelectorAll('#results tr').forEach((r) => r.classList.remove('selected'));
    button.classList.add('selected');
    $('deleteError').textContent = '';
    try {
      const data = await api('customers/' + encodeURIComponent(id));
      selected = data.customer;
      const facts = [
        ['Name', selected.name],
        ['Account number', selected.accountNumber],
        ['Barangay', selected.barangay],
        ['Status', selected.status],
        ['Consumer app login', selected.userId ? 'Yes' : 'None'],
      ];
      $('customerFacts').replaceChildren(...facts.flatMap(([term, value]) => {
        const dt = document.createElement('dt');
        dt.textContent = term;
        const dd = document.createElement('dd');
        dd.textContent = value;
        return [dt, dd];
      }));
      $('counts').replaceChildren(...data.records.map((record) => {
        const li = document.createElement('li');
        if (!record.count) li.className = 'zero';
        const label = document.createElement('span');
        label.textContent = labels[record.table] || record.table;
        const count = document.createElement('b');
        count.textContent = record.count;
        li.append(label, count);
        return li;
      }));
      $('confirmHint').textContent = selected.accountNumber;
      $('confirm').value = '';
      $('deleteButton').disabled = true;
      $('previewCard').hidden = false;
      $('previewCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('confirm').focus({ preventScroll: true });
    } catch (error) {
      $('searchStatus').textContent = error.message;
    }
  }

  function closePreview() {
    selected = null;
    $('previewCard').hidden = true;
    document.querySelectorAll('#results tr').forEach((r) => r.classList.remove('selected'));
  }

  $('cancelDelete').addEventListener('click', closePreview);
  $('confirm').addEventListener('input', () => {
    $('deleteButton').disabled = !selected || $('confirm').value.trim() !== selected.accountNumber;
  });

  $('deleteForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selected || $('confirm').value.trim() !== selected.accountNumber) return;
    const button = $('deleteButton');
    button.disabled = true;
    button.textContent = 'Deleting…';
    $('deleteError').textContent = '';
    try {
      const data = await api('customers/' + encodeURIComponent(selected.id), {
        method: 'DELETE',
        body: JSON.stringify({ confirm: $('confirm').value.trim() }),
      });
      const total = data.removed.reduce((sum, row) => sum + row.count, 0);
      $('doneMessage').textContent =
        'Deleted ' + data.customer.name + ' (' + data.customer.accountNumber + '): ' + total +
        ' records removed. Backup: ' + data.backupFile;
      $('doneMessage').hidden = false;
      closePreview();
      loadCustomers();
    } catch (error) {
      $('deleteError').textContent = error.message;
      button.disabled = false;
    } finally {
      button.textContent = 'Delete permanently';
    }
  });

  show(Boolean(token));
})();
