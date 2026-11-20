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
    if (signedIn) $('query').focus();
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
    show(false);
  });

  $('searchForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = $('query').value.trim();
    $('doneMessage').hidden = true;
    closePreview();
    if (query.length < 2) {
      $('searchStatus').textContent = 'Type at least 2 characters.';
      return;
    }
    $('searchStatus').textContent = 'Searching…';
    try {
      const rows = await api('customers?q=' + encodeURIComponent(query));
      $('searchStatus').textContent = rows.length ? rows.length + ' found' + (rows.length === 20 ? ' (first 20)' : '') : 'No customer found.';
      $('results').replaceChildren(...rows.map(resultItem));
    } catch (error) {
      $('searchStatus').textContent = error.message;
    }
  });

  function resultItem(row) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    const name = document.createElement('strong');
    name.textContent = row.name;
    const meta = document.createElement('span');
    meta.textContent = row.accountNumber + ' · ' + row.barangay;
    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.textContent = row.status;
    button.append(name, pill, meta);
    button.addEventListener('click', () => openPreview(row.id, button));
    item.appendChild(button);
    return item;
  }

  async function openPreview(id, button) {
    document.querySelectorAll('.results button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    button.setAttribute('aria-pressed', 'true');
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
    document.querySelectorAll('.results button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
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
      $('results').replaceChildren();
      $('searchStatus').textContent = '';
    } catch (error) {
      $('deleteError').textContent = error.message;
      button.disabled = false;
    } finally {
      button.textContent = 'Delete permanently';
    }
  });

  show(Boolean(token));
})();
