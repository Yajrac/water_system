// Monthly billing uses database setups, eligible meters and saved entries.
(async function initializeBillingLedger() {
  if (!(await AdminAuth.ready)) return;
  const get = (id) => document.getElementById(id);
  const cycle = WaterStore.today().slice(0, 7);
  const form = get('ledgerEntryForm');
  const setupForm = get('ledgerSetupForm');
  const setupDialog = get('ledgerSetupDialog');
  const setupArea = get('ledgerSetupBarangay');
  const saveButton = get('saveLedgerEntry');
  get('changeLedgerSetup').disabled = true;
  let areas = [],
    setups = new Map(),
    customers = [],
    entries = new Map();
  let selectedArea = '',
    selectedId = null,
    loading = false,
    saving = false,
    savingSetup = false,
    generating = false,
    dirty = false;
  let loadVersion = 0;
  const monthLabel = new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(new Date(cycle + '-01T12:00:00+08:00'));
  get('ledgerMonth').textContent = monthLabel;
  get('ledgerSetupMonth').value = monthLabel;
  get('generationDateLabel').textContent = 'Generation date: ' + WaterStore.today();

  function currentSetup() {
    return setups.get(selectedArea);
  }
  function selectedCustomer() {
    return customers.find((customer) => customer.id === selectedId);
  }
  function setFieldsDisabled(disabled) {
    form.querySelectorAll('input:not([readonly]),select,button').forEach((field) => {
      field.disabled = disabled;
    });
    saveButton.disabled = disabled;
  }
  function totals() {
    const customer = selectedCustomer();
    const raw = form.elements.consumption.value;
    const usage = /^\d+(\.\d{1,3})?$/.test(raw) ? Number(raw) : 0;
    form.elements.current.value =
      customer && raw !== '' ? String(Number((Number(customer.previous) + usage).toFixed(3))) : '';
    const water = Math.round(usage * Number(currentSetup()?.rate || 0) * 100) / 100;
    const extra = ['connection', 'late', 'other'].reduce(
      (sum, key) => sum + (Number(form.elements[key].value) || 0),
      0,
    );
    get('ledgerUsage').textContent = usage + ' m\u00b3';
    get('ledgerWater').textContent = WaterStore.money(water);
    get('ledgerTotal').textContent = WaterStore.money(water + extra);
  }
  function clearEntry() {
    dirty = false;
    selectedId = null;
    form.reset();
    for (const key of ['consumption', 'current']) form.elements[key].value = '';
    for (const key of ['connection', 'late', 'other']) form.elements[key].value = '0';
    get('ledgerPrevious').value = '';
    get('ledgerSelected').textContent = 'Select a consumer';
    get('ledgerEntryStatus').textContent = '';
    setFieldsDisabled(true);
    totals();
  }
  function render() {
    const query = get('ledgerSearch').value.trim().toLowerCase();
    const list = get('ledgerConsumers');
    list.replaceChildren();
    customers
      .filter((customer) => (customer.name + ' ' + customer.account).toLowerCase().includes(query))
      .forEach((customer) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ledger-consumer';
        button.disabled = saving || loading || generating;
        button.setAttribute('aria-pressed', String(customer.id === selectedId));
        const identity = document.createElement('span');
        const name = document.createElement('strong');
        name.textContent = customer.name;
        const account = document.createElement('small');
        account.textContent = customer.account;
        identity.append(name, account);
        const status = document.createElement('span');
        const complete = entries.has(customer.id);
        status.className = 'ledger-completion' + (complete ? ' is-completed' : '');
        if (complete) {
          status.setAttribute('aria-label', 'Completed');
          const icon = document.createElement('i');
          icon.className = 'bi bi-check-lg';
          icon.setAttribute('aria-hidden', 'true');
          status.appendChild(icon);
        } else status.textContent = 'Pending';
        button.append(identity, status);
        button.addEventListener('click', () => selectCustomer(customer.id));
        list.appendChild(button);
      });
    if (!customers.length || !list.childElementCount) {
      const text = document.createElement('p');
      text.className = 'form-help';
      text.textContent = loading
        ? 'Loading customer meters...'
        : selectedArea
          ? 'No eligible installed customers match this barangay or search.'
          : 'Choose a barangay in Billing setup.';
      list.appendChild(text);
    }
    const completed = customers.filter((customer) => entries.has(customer.id)).length;
    get('draftCount').textContent = completed + ' / ' + customers.length + ' completed';
    get('ledgerProgress').textContent = loading
      ? 'Loading entries...'
      : customers.length
        ? completed === customers.length
          ? 'All consumer entries are saved.'
          : 'Save the meter entries for this barangay.'
        : 'No eligible customers awaiting a bill.';
    get('ledgerBarangay').textContent = selectedArea || 'Select barangay';
    get('ledgerDue').textContent = currentSetup()?.due || 'Not configured';
    get('ledgerRate').textContent = currentSetup()
      ? WaterStore.money(Number(currentSetup().rate))
      : 'Not configured';
    get('generateLedgerBills').disabled =
      generating ||
      saving ||
      loading ||
      dirty ||
      !customers.length ||
      customers.some((customer) => !entries.has(customer.id));
  }
  function selectCustomer(id) {
    if (saving || loading || generating) return;
    selectedId = id;
    dirty = false;
    const customer = selectedCustomer();
    if (!customer) return clearEntry();
    const saved = entries.get(id);
    get('ledgerPrevious').value = customer.previous;
    get('ledgerSelected').textContent = customer.name;
    form.elements.consumption.value = saved?.consumption ?? '';
    form.elements.connection.value = saved?.connectionCharge ?? '0';
    form.elements.late.value = saved?.late ?? customer.suggestedLate ?? '0';
    form.elements.other.value = saved?.other ?? '0';
    get('ledgerEntryStatus').textContent = saved ? 'Saved' : 'Unsaved entry';
    setFieldsDisabled(false);
    render();
    totals();
  }
  async function loadEntries({ preserve = false } = {}) {
    const version = ++loadVersion;
    const previousId = selectedId;
    if (!preserve) {
      customers = [];
      entries = new Map();
      clearEntry();
    }
    if (!currentSetup()) {
      render();
      return;
    }
    loading = true;
    if (!preserve) render();
    try {
      const data = await MeterEntryAPI.list(currentSetup().id);
      if (version !== loadVersion) return;
      customers = data.customers;
      entries = new Map(
        data.entries
          .filter((entry) => entry.status === 'Saved')
          .map((entry) => [entry.customerId, entry]),
      );
      setups.set(selectedArea, data.setup);
      AdminUI.message('');
    } catch (error) {
      if (version === loadVersion)
        AdminUI.message(error.message + ' Reopen Billing setup and continue to retry.');
    } finally {
      if (version === loadVersion) {
        loading = false;
        if (preserve && dirty) render();
        else if (customers.length && !generating) selectCustomer(
          preserve && customers.some((customer) => customer.id === previousId) ? previousId : customers[0].id,
        );
        else render();
      }
    }
  }
  form.addEventListener('input', () => {
    dirty = true;
    totals();
    get('ledgerEntryStatus').textContent = 'Unsaved changes';
    render();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving || loading || generating) return;
    const customer = selectedCustomer();
    if (!customer || !currentSetup())
      return showNotice(
        'Select a consumer first',
        'Choose a billing setup and customer before saving.',
      );
    if (
      !/^\d+(\.\d{1,3})?$/.test(form.elements.consumption.value) ||
      !['connection', 'late', 'other'].every((key) =>
        Validation.money(form.elements[key].value || '0'),
      )
    )
      return showNotice(
        'Entry not saved',
        'Enter non-negative consumption (up to 3 decimals) and charges (up to 2 decimals).',
      );
    saving = true;
    setFieldsDisabled(true);
    get('changeLedgerSetup').disabled = true;
    get('ledgerEntryStatus').textContent = 'Saving entry...';
    render();
    try {
      const saved = await MeterEntryAPI.save(
        currentSetup().id,
        customer,
        form.elements,
        entries.get(customer.id),
      );
      entries.set(customer.id, saved);
      dirty = false;
      get('ledgerEntryStatus').textContent = 'Saved';
      const index = customers.findIndex((item) => item.id === customer.id);
      const ordered = [...customers.slice(index + 1), ...customers.slice(0, index)];
      const next = ordered.find((item) => !entries.has(item.id));
      saving = false;
      if (next) {
        get('ledgerSearch').value = '';
        selectCustomer(next.id);
        AdminUI.message(customer.name + ' entry saved. Next consumer: ' + next.name + '.');
      } else {
        render();
        AdminUI.message('All consumer entries are saved. You can now generate bills.');
      }
    } catch (error) {
      get('ledgerEntryStatus').textContent = 'Entry not saved';
      await showNotice('Entry not saved', error.message);
    } finally {
      saving = false;
      setFieldsDisabled(false);
      get('changeLedgerSetup').disabled = false;
      render();
      if (!dirty && selectedId !== customer.id) form.elements.consumption.focus();
    }
  });
  function loadSetupFields() {
    const setup = setups.get(setupArea.value);
    get('ledgerSetupDue').min = WaterStore.today();
    get('ledgerSetupDue').value = setup?.due || WaterStore.today();
    get('ledgerSetupRate').value = setup?.rate || '';
  }
  setupArea.addEventListener('change', loadSetupFields);
  get('changeLedgerSetup').addEventListener('click', () => {
    setupArea.value = selectedArea;
    loadSetupFields();
    setupDialog.showModal();
  });
  for (const id of ['cancelLedgerSetup', 'closeLedgerSetup'])
    get(id).addEventListener('click', () => {
      if (!savingSetup) setupDialog.close();
    });
  setupDialog.addEventListener('cancel', (event) => {
    if (savingSetup) event.preventDefault();
  });
  setupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (savingSetup) return;
    const area = areas.find((item) => item.name === setupArea.value);
    const due = get('ledgerSetupDue').value;
    const rate = get('ledgerSetupRate').value;
    if (
      !area ||
      !Validation.date(due) ||
      due < WaterStore.today() ||
      !Validation.money(rate) ||
      Number(rate) <= 0
    )
      return AdminUI.message('Choose a registered barangay, valid due date and positive rate.');
    savingSetup = true;
    const button = setupForm.querySelector('.btn-primary');
    button.disabled = true;
    setupDialog.close();
    try {
      if (
        !(await confirmAction(
          'Save billing setup?',
          area.name + ' | ' + monthLabel + ' | Due: ' + due + ' | Rate: ' + rate,
          'Confirm setup',
        ))
      ) {
        setupDialog.showModal();
        return;
      }
      const saved = await AdminAPI.request('/billing-setups', {
        method: 'PUT',
        body: { barangayId: String(area.id), month: cycle, due, rate },
      });
      setups.set(saved.barangay, saved);
      selectedArea = saved.barangay;
      await loadEntries();
      await showNotice(
        'Billing setup saved successfully',
        saved.barangay + ' setup was saved for ' + monthLabel + '.',
      );
    } catch (error) {
      await showNotice('Billing setup not saved', error.message);
      setupDialog.showModal();
    } finally {
      savingSetup = false;
      button.disabled = false;
    }
  });
  get('ledgerSearch').addEventListener('input', render);
  get('generateLedgerBills').addEventListener('click', async () => {
    if (generating || saving || loading || dirty || !currentSetup()) return;
    generating = true;
    get('changeLedgerSetup').disabled = true;
    setFieldsDisabled(true);
    render();
    try {
      const setupId = currentSetup().id;
      const preview = await AdminAPI.request('/bills/preview', {
        method: 'POST',
        body: { setupId },
      });
      const rows = preview.bills.map((bill) => ({
        ...bill,
        ...Object.fromEntries(
          ['previous', 'current', 'consumption', 'ratePerCubic', 'total'].map((key) => [
            key,
            Number(bill[key]),
          ]),
        ),
      }));
      if (!(await confirmGeneratedBills(rows, { customers }))) return;
      const result = await AdminAPI.request('/bills/generate', {
        method: 'POST',
        body: { setupId, revision: preview.revision },
      });
      await loadEntries();
      await showNotice(
        'Bills generated successfully',
        result.count + ' bills saved. Open Generated Bills to review them.',
      );
    } catch (error) {
      await showNotice('Bills not generated', error.message);
    } finally {
      generating = false;
      get('changeLedgerSetup').disabled = false;
      setFieldsDisabled(!selectedCustomer());
      render();
    }
  });
  document.addEventListener('admin:refresh-content', (event) => {
    if (dirty || generating || saving || savingSetup || loading) {
      AdminUI.message('Save your meter reading before refreshing.');
      return;
    }
    event.detail.tasks.push(loadEntries({ preserve: true }));
  });
  clearEntry();
  render();
  try {
    const [registered, saved] = await Promise.all([
      AdminAPI.request('/barangays'),
      AdminAPI.request('/billing-setups?month=' + cycle),
    ]);
    areas = registered.filter((area) => Number(area.is_active) === 1);
    get('changeLedgerSetup').disabled = false;
    setups = new Map(saved.map((setup) => [setup.barangay, setup]));
    areas.forEach((area) => setupArea.add(new Option(area.name, area.name)));
    const requested = new URLSearchParams(location.search).get('barangay');
    if (areas.some((area) => area.name === requested)) selectedArea = requested;
    await loadEntries();
    if (!currentSetup()) {
      loadSetupFields();
      setupDialog.showModal();
    }
  } catch (error) {
    get('changeLedgerSetup').disabled = true;
    await showNotice('Billing setup unavailable', error.message + ' Reload the page to try again.');
  }
})();
