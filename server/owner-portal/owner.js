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
  const views = {
    customers: { title: 'Customers', sub: 'Find a customer and delete their records permanently.' },
    history: { title: 'Delete history', sub: 'Customers removed through this portal, newest first.' },
  };
  let token = null;
  let selected = null;
  let page = 1;
  let query = '';
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
    $('appView').hidden = !signedIn;
    if (signedIn) {
      showView('customers');
      loadCustomers();
    } else {
      setMenu(false);
      $('password').focus();
    }
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

  // ---------- Navigation ----------
  function setMenu(open) {
    $('appView').classList.toggle('menu-open', open);
    $('scrim').hidden = !open;
    $('menuButton').setAttribute('aria-expanded', String(open));
  }

  function showView(name) {
    for (const key of Object.keys(views)) $(key + 'View').hidden = key !== name;
    document.querySelectorAll('.nav-item').forEach((item) => {
      const active = item.dataset.view === name;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    $('pageTitle').textContent = views[name].title;
    $('pageSub').textContent = views[name].sub;
    if (name === 'history') loadHistory();
    setMenu(false);
  }

  document.querySelectorAll('.nav-item').forEach((item) =>
    item.addEventListener('click', () => {
      $('doneMessage').hidden = true;
      showView(item.dataset.view);
    }),
  );
  $('menuButton').addEventListener('click', () => setMenu(!$('appView').classList.contains('menu-open')));
  $('scrim').addEventListener('click', () => setMenu(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenu(false);
  });

  // ---------- Sign in / out ----------
  $('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('loginButton');
    button.disabled = true;
    button.textContent = 'Signing in…';
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
      button.textContent = 'Sign in';
    }
  });

  $('signOut').addEventListener('click', () => {
    saveToken(null);
    closePreview();
    $('results').replaceChildren();
    $('searchStatus').textContent = '';
    $('pager').hidden = true;
    $('doneMessage').hidden = true;
    show(false);
  });

  // ---------- Customers ----------
  async function loadCustomers() {
    $('searchStatus').textContent = 'Loading…';
    try {
      const data = await api('customers?q=' + encodeURIComponent(query) + '&page=' + page);
      const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
      $('searchStatus').textContent = data.total
        ? data.total + ' customer' + (data.total === 1 ? '' : 's') + (query ? ' found' : '')
        : '';
      $('results').replaceChildren(
        ...(data.rows.length
          ? data.rows.map(resultRow)
          : [emptyRow(query ? 'No customer matches "' + query + '".' : 'No customers yet.')]),
      );
      $('pager').hidden = pages < 2;
      $('pageLabel').textContent = 'Page ' + data.page + ' of ' + pages;
      $('prevPage').disabled = data.page <= 1;
      $('nextPage').disabled = data.page >= pages;
    } catch (error) {
      $('searchStatus').textContent = '';
      $('results').replaceChildren(emptyRow(error.message));
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

  function emptyRow(message) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.className = 'empty';
    td.textContent = message;
    tr.appendChild(td);
    return tr;
  }

  // data-label gives each value its heading when rows turn into cards on phones.
  function cell(text, label, className) {
    const td = document.createElement('td');
    if (className) td.className = className;
    td.dataset.label = label;
    td.textContent = text;
    return td;
  }

  function resultRow(row) {
    const tr = document.createElement('tr');
    const status = cell('', 'Status');
    const pill = document.createElement('span');
    pill.className = 'pill pill-' + String(row.status).toLowerCase();
    pill.textContent = row.status;
    status.appendChild(pill);
    const action = cell('', '', 'action');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-danger-soft';
    button.textContent = 'Delete';
    button.setAttribute('aria-label', 'Delete ' + row.name);
    button.addEventListener('click', () => openPreview(row.id, tr));
    action.appendChild(button);
    tr.append(
      cell(row.accountNumber, 'Account no.', 'mono'),
      cell(row.name, 'Name', 'name'),
      cell(row.barangay, 'Barangay'),
      status,
      cell(row.bills, 'Bills', 'num'),
      cell(row.payments, 'Payments', 'num'),
      cell(row.userId ? 'Yes' : '—', 'App login'),
      action,
    );
    return tr;
  }

  async function openPreview(id, row) {
    document.querySelectorAll('#results tr').forEach((r) => r.classList.remove('selected'));
    row.classList.add('selected');
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
  $('closePreview').addEventListener('click', closePreview);
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      $('deleteError').textContent = error.message;
      button.disabled = false;
    } finally {
      button.textContent = 'Delete permanently';
    }
  });

  // ---------- Delete history ----------
  async function loadHistory() {
    $('historyStatus').textContent = 'Loading…';
    const list = $('historyList');
    try {
      const rows = await api('history');
      $('historyStatus').textContent = rows.length ? rows.length + ' deleted' : '';
      if (!rows.length) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'No customers have been deleted yet.';
        list.replaceChildren(li);
        return;
      }
      list.replaceChildren(...rows.map((row) => {
        const li = document.createElement('li');
        const dot = document.createElement('span');
        dot.className = 'dot';
        const body = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = row.description.replace(/^Owner portal permanently deleted /, '');
        const time = document.createElement('time');
        time.dateTime = row.deletedAt;
        const date = new Date(row.deletedAt);
        time.textContent = Number.isNaN(date.getTime())
          ? row.deletedAt
          : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
        body.append(title, time);
        li.append(dot, body);
        return li;
      }));
    } catch (error) {
      $('historyStatus').textContent = '';
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = error.message;
      list.replaceChildren(li);
    }
  }

  show(Boolean(token));
})();
