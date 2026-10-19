const billingRecords = WaterStore.load();
const cycle = WaterStore.today().slice(0, 7);
const activePeriod = { active: cycle };
const storedPeriod = WaterStore.billingPeriod(billingRecords);
if (storedPeriod.active !== cycle || storedPeriod.closed.includes(cycle)) {
  storedPeriod.active = cycle;
  storedPeriod.closed = storedPeriod.closed.filter((month) => month !== cycle);
  WaterStore.save(billingRecords);
}
const ledgerEntryKey = 'pwss-saved-meter-entries-' + cycle;
function loadLedgerEntries() {
  try {
    const entries = JSON.parse(localStorage.getItem(ledgerEntryKey) || '{}');
    return entries && typeof entries === 'object' && !Array.isArray(entries) ? entries : {};
  } catch {
    return {};
  }
}
let meterDrafts = loadLedgerEntries();
let selectedBarangay = '';
let selectedConsumerId = null;
let generatingBills = false;
const entryForm = document.getElementById('ledgerEntryForm');
const setupDialog = document.getElementById('ledgerSetupDialog');
const setupForm = document.getElementById('ledgerSetupForm');
const setupBarangay = document.getElementById('ledgerSetupBarangay');
const setupDue = document.getElementById('ledgerSetupDue');
const setupRate = document.getElementById('ledgerSetupRate');
const monthLabel = new Intl.DateTimeFormat('en-PH', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Manila',
}).format(new Date(cycle + '-01T12:00:00+08:00'));
document.getElementById('ledgerMonth').textContent = monthLabel;
document.getElementById('ledgerSetupMonth').value = monthLabel;
document.getElementById('generationDateLabel').textContent =
  'Generation date: ' + WaterStore.today();
WaterStore.barangays.forEach((name) => setupBarangay.add(new Option(name, name)));
function eligibleConsumers(records = billingRecords) {
  return records.customers.filter(
    (c) =>
      c.barangay === selectedBarangay &&
      WaterStore.isRegistered(c) &&
      WaterStore.isActive(c) &&
      !records.bills.some((b) => b.customerId === c.id && b.cycle >= cycle),
  );
}
function setupForBarangay() {
  return WaterStore.flatBillingSetup(WaterStore.load(), cycle, selectedBarangay);
}
function persistEntries() {
  localStorage.setItem(ledgerEntryKey, JSON.stringify(meterDrafts));
}
function validDraft(customer, draft) {
  return (
    draft &&
    /^\d+(\.\d{1,3})?$/.test(String(draft.current)) &&
    Validation.money(String(draft.late)) &&
    Validation.money(String(draft.other)) &&
    [draft.current, draft.late, draft.other].every(
      (v) =>
        Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= Number.MAX_SAFE_INTEGER / 1000,
    ) &&
    Number(draft.current) >= customer.reading &&
    draft.previous === customer.reading &&
    ['None', 'New connection', 'Reconnection'].includes(draft.connection)
  );
}
function isCompleted(customer) {
  const draft = meterDrafts[customer.id];
  return draft?.completed && validDraft(customer, draft);
}
function renderLedger() {
  const consumers = eligibleConsumers();
  const query = document.getElementById('ledgerSearch').value.trim().toLowerCase();
  const list = document.getElementById('ledgerConsumers');
  list.replaceChildren();
  consumers
    .filter((c) => (c.name + ' ' + c.account).toLowerCase().includes(query))
    .forEach((customer) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ledger-consumer';
      button.classList.toggle('is-selected', customer.id === selectedConsumerId);
      button.setAttribute('aria-pressed', String(customer.id === selectedConsumerId));
      const identity = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = customer.name;
      const account = document.createElement('small');
      account.textContent = customer.account;
      identity.append(name, account);
      const state = document.createElement('span');
      state.className = 'ledger-completion';
      state.classList.toggle('is-completed', Boolean(isCompleted(customer)));
      if (isCompleted(customer)) {
        state.setAttribute('aria-label', 'Completed');
        state.title = 'Completed';
        const check = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        check.setAttribute('viewBox', '0 0 24 24');
        check.setAttribute('fill', 'none');
        check.setAttribute('stroke', 'currentColor');
        check.setAttribute('stroke-width', '3');
        check.setAttribute('stroke-linecap', 'round');
        check.setAttribute('stroke-linejoin', 'round');
        check.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'm5 12 4 4L19 6');
        check.appendChild(path);
        state.appendChild(check);
      } else state.textContent = 'Pending';
      button.append(identity, state);
      button.addEventListener('click', () => selectConsumer(customer.id));
      list.appendChild(button);
    });
  if (!list.childElementCount) {
    const empty = document.createElement('p');
    empty.className = 'form-help';
    empty.textContent = selectedBarangay
      ? 'No consumers awaiting a bill match your search.'
      : 'Choose a barangay in Billing setup.';
    list.appendChild(empty);
  }
  const completed = consumers.filter(isCompleted).length;
  document.getElementById('draftCount').textContent =
    completed + ' / ' + consumers.length + ' completed';
  document.getElementById('ledgerProgress').textContent = consumers.length
    ? completed === consumers.length
      ? 'All consumer entries are ready.'
      : 'Save all ' + consumers.length + ' entries to generate barangay bills.'
    : 'No bills awaiting generation.';
  document.getElementById('generateLedgerBills').disabled = generatingBills;
  const setup = setupForBarangay();
  document.getElementById('ledgerBarangay').textContent = selectedBarangay || 'Select barangay';
  document.getElementById('ledgerDue').textContent = setup?.due || 'Not configured';
  document.getElementById('ledgerRate').textContent = setup
    ? WaterStore.money(setup.rate)
    : 'Not configured';
}
function clearEntry() {
  entryForm.reset();
  entryForm
    .querySelectorAll('input:not([readonly]),select,button')
    .forEach((f) => (f.disabled = true));
  document.getElementById('saveLedgerEntry').disabled = false;
  document.getElementById('ledgerPrevious').value = '';
  document.getElementById('ledgerSelected').textContent = 'Select a consumer';
  document.getElementById('ledgerEntryStatus').textContent = '';
  updateTotals();
}
function selectConsumer(id) {
  const customer = eligibleConsumers().find((c) => c.id === id);
  if (!customer) return;
  selectedConsumerId = id;
  entryForm
    .querySelectorAll('input:not([readonly]),select,button')
    .forEach((f) => (f.disabled = false));
  const draft = meterDrafts[id] || { current: '', connection: 'None', late: '0', other: '0' };
  document.getElementById('ledgerPrevious').value = customer.reading;
  entryForm.elements.current.min = customer.reading;
  for (const key of ['current', 'connection', 'late', 'other'])
    entryForm.elements[key].value = draft[key];
  document.getElementById('ledgerSelected').textContent = customer.name;
  document.getElementById('ledgerEntryStatus').textContent = isCompleted(customer)
    ? '\u2713 Completed'
    : 'Unsaved entry';
  renderLedger();
  updateTotals();
}
function readEntry() {
  const customer = billingRecords.customers.find((c) => c.id === selectedConsumerId);
  return {
    previous: customer?.reading,
    current: entryForm.elements.current.value,
    connection: entryForm.elements.connection.value,
    late: entryForm.elements.late.value,
    other: entryForm.elements.other.value,
    completed: false,
  };
}
function updateTotals() {
  const draft = readEntry();
  const setup = setupForBarangay();
  const usage =
    draft.current === '' ? 0 : Math.max(0, Number(draft.current) - Number(draft.previous || 0));
  let water = 0;
  try {
    if (setup) water = WaterStore.flatWaterCharge(usage, setup.rate);
  } catch {}
  const connection =
    draft.connection === 'New connection'
      ? billingRecords.rates.connection
      : draft.connection === 'Reconnection'
        ? billingRecords.rates.reconnection
        : 0;
  document.getElementById('ledgerUsage').textContent = Number(usage.toFixed(3)) + ' m\u00b3';
  document.getElementById('ledgerWater').textContent = WaterStore.money(water);
  document.getElementById('ledgerTotal').textContent = WaterStore.money(
    water + connection + Number(draft.late || 0) + Number(draft.other || 0),
  );
}
entryForm.addEventListener('input', () => {
  if (!selectedConsumerId) return;
  meterDrafts = loadLedgerEntries();
  meterDrafts[selectedConsumerId] = readEntry();
  try {
    persistEntries();
  } catch {
    AdminUI.message('Draft could not be kept in this browser.');
  }
  document.getElementById('ledgerEntryStatus').textContent = 'Unsaved changes';
  renderLedger();
  updateTotals();
});
entryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedConsumerId)
    return showNotice(
      'Select a consumer first',
      'Choose a barangay in Billing setup, then select a consumer to save a meter entry. No entry has been saved.',
    );
  const latest = WaterStore.load();
  const customer = eligibleConsumers(latest).find((c) => c.id === selectedConsumerId);
  const draft = readEntry();
  if (!customer || !validDraft(customer, draft))
    return showNotice(
      'Entry not saved',
      'Check the reading and charges. Current reading must be at least the previous reading.',
    );
  meterDrafts = loadLedgerEntries();
  meterDrafts[customer.id] = { ...draft, completed: true };
  try {
    persistEntries();
  } catch {
    return AdminUI.message('Entry could not be saved. Please try again.');
  }
  document.getElementById('ledgerEntryStatus').textContent = '\u2713 Completed';
  renderLedger();
  const saveButton = document.getElementById('saveLedgerEntry');
  saveButton.disabled = true;
  await showNotice(
    'Entry saved successfully',
    customer.name + '\nThe meter entry is ready for bill generation.',
  );
  saveButton.disabled = false;
  Object.assign(billingRecords, latest);
  const consumers = eligibleConsumers();
  if (!selectedBarangay || !setupForBarangay())
    return showNotice(
      'Billing setup required',
      'Choose a barangay, due date and rate before generating bills. No bills have been generated.',
    );
  if (!consumers.length)
    return showNotice(
      'No bills to generate',
      'No eligible consumers are awaiting a bill in this barangay for the current month. Check Generated Bills for existing records.',
    );
  const savedIndex = consumers.findIndex((item) => item.id === customer.id);
  const next = [...consumers.slice(savedIndex + 1), ...consumers.slice(0, savedIndex)].find(
    (item) => !isCompleted(item),
  );
  if (next) {
    document.getElementById('ledgerSearch').value = '';
    selectConsumer(next.id);
    entryForm.elements.current.focus();
    return;
  }
  renderLedger();
});
function loadSetupFields() {
  const setup = WaterStore.flatBillingSetup(WaterStore.load(), cycle, setupBarangay.value);
  setupDue.min = WaterStore.today();
  setupDue.value =
    setup?.due ||
    new Date(Date.UTC(Number(cycle.slice(0, 4)), Number(cycle.slice(5)), 0))
      .toISOString()
      .slice(0, 10);
  setupRate.value = setup?.rate || '';
}
setupBarangay.addEventListener('change', loadSetupFields);
document.getElementById('changeLedgerSetup').addEventListener('click', () => {
  setupBarangay.value = selectedBarangay;
  loadSetupFields();
  setupDialog.showModal();
});
document.getElementById('cancelLedgerSetup').addEventListener('click', () => setupDialog.close());
document.getElementById('closeLedgerSetup').addEventListener('click', () => setupDialog.close());
setupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const barangay = setupBarangay.value,
    rate = Number(setupRate.value),
    due = setupDue.value;
  if (
    !WaterStore.barangays.includes(barangay) ||
    !Validation.money(setupRate.value) ||
    !Number.isFinite(rate) ||
    rate <= 0 ||
    rate > Number.MAX_SAFE_INTEGER / 1000 ||
    !Validation.date(due) ||
    due < WaterStore.today() ||
    cycle !== WaterStore.today().slice(0, 7)
  )
    return AdminUI.message('Choose a valid barangay, due date and positive rate.');
  setupDialog.close();
  if (
    !(await confirmAction(
      'Save billing setup?',
      barangay + '\n' + monthLabel + '\nDue: ' + due + '\nRate: ' + WaterStore.money(rate),
      'Confirm setup',
    ))
  ) {
    setupDialog.showModal();
    return;
  }
  const records = WaterStore.load();
  records.billingSetups ??= {};
  records.billingSetups[cycle] ??= {};
  records.billingSetups[cycle][barangay] = { rate, due, mode: 'flat', savedOn: WaterStore.today() };
  const period = WaterStore.billingPeriod(records);
  period.active = cycle;
  period.closed = period.closed.filter((m) => m !== cycle);
  try {
    WaterStore.save(records);
  } catch {
    return AdminUI.message('Setup could not be saved.');
  }
  Object.assign(billingRecords, records);
  selectedBarangay = barangay;
  selectedConsumerId = null;
  clearEntry();
  renderLedger();
});
document.getElementById('ledgerSearch').addEventListener('input', renderLedger);
document.getElementById('generateLedgerBills').addEventListener('click', async () => {
  if (generatingBills) return;
  Object.assign(billingRecords, WaterStore.load());
  meterDrafts = loadLedgerEntries();
  const consumers = eligibleConsumers();
  if (!selectedBarangay || !setupForBarangay())
    return showNotice(
      'Billing setup required',
      'Choose a barangay, due date and rate before generating bills. No bills have been generated.',
    );
  if (!consumers.length)
    return showNotice(
      'No bills to generate',
      'No eligible consumers are awaiting a bill in this barangay for the current month. Check Generated Bills for existing records.',
    );
  if (!selectedBarangay || !consumers.length || !consumers.every(isCompleted))
    return showNotice(
      'Complete consumer entries',
      'Save every eligible consumer entry in the selected barangay first. No bills have been generated.',
    );
  const pending = [];
  const cycle = activePeriod.active;
  const due = setupForBarangay()?.due;
  const generatedOn = WaterStore.today();

  if (!Validation.date(due) || due < generatedOn)
    return AdminUI.message(
      'Due date cannot be earlier than the generation date (' + generatedOn + ').',
    );
  // Recheck current balances and meter readings before generating any bills.
  const latest = WaterStore.load();
  const cycleError = WaterStore.cycleError(latest, cycle);
  if (cycleError) return AdminUI.message(cycleError);
  for (const consumer of eligibleConsumers(latest)) {
    const customerId = consumer.id;
    const draft = meterDrafts[customerId];
    if (!draft?.completed)
      return showNotice('Incomplete entries', 'Save every consumer entry first.');
    if (draft.current === '') continue;
    const customer = latest.customers.find((item) => item.id === customerId);
    if (
      !customer ||
      !WaterStore.isRegistered(customer) ||
      !WaterStore.isActive(customer) ||
      customer.reading !== draft.previous
    )
      return AdminUI.message(
        'Customer status or reading changed. Reload and review the draft before generating bills.',
      );
    if (latest.bills.some((bill) => bill.customerId === customer.id && bill.cycle >= cycle))
      return AdminUI.message(
        'Account ' +
          customer.account +
          ' already has a bill for this or a later cycle. No bills were generated.',
      );
    const current = Number(draft.current);
    const late = Number(draft.late),
      other = Number(draft.other);
    if (
      !/^\d+(\.\d{1,3})?$/.test(draft.current) ||
      !Validation.money(draft.late) ||
      !Validation.money(draft.other) ||
      ![current, late, other].every(Number.isFinite) ||
      current < customer.reading
    )
      return AdminUI.message(
        'Invalid reading or charge for ' + customer.account + ', including entries on other pages.',
      );
    const consumption = Number((current - customer.reading).toFixed(3));
    const connection =
      draft.connection === 'New connection'
        ? latest.rates.connection
        : draft.connection === 'Reconnection'
          ? latest.rates.reconnection
          : 0;
    const setup = WaterStore.flatBillingSetup(latest, cycle, customer.barangay);
    if (!setup || setup.mode !== 'flat')
      return showNotice(
        'Billing setup required',
        'Configure the price per cubic meter for ' + customer.barangay + ' in Rates & Fees.',
      );
    if (!Validation.date(setup.due) || setup.due < generatedOn)
      return showNotice(
        'Check due date',
        'Update the billing setup due date for ' + customer.barangay + ' before generating bills.',
      );
    let water;
    try {
      water = WaterStore.flatWaterCharge(consumption, setup.rate);
    } catch (error) {
      return showNotice('Check water rates', customer.account + ': ' + error.message);
    }
    const monthly = 0;
    if (![water, connection, late, other].every((value) => Number.isFinite(value) && value >= 0))
      return AdminUI.message('Charges must be valid non-negative amounts. Review Rates & Fees.');
    const total = Math.round((water + monthly + connection + late + other) * 100) / 100;
    if (!Number.isFinite(total))
      return AdminUI.message('The bill amount is too large. Review the rates and readings.');
    pending.push({
      id: WaterStore.id(),
      customerId,
      cycle,
      generatedOn,
      due: setup.due,
      previous: customer.reading,
      current,
      consumption,
      customerType: customer.customerType,
      rateVersion: 3,
      billingMode: 'flat',
      ratePerCubic: setup.rate,
      rateSnapshot: { mode: 'flat', rate: setup.rate, barangay: customer.barangay },
      water,
      monthly,
      connection,
      late,
      other,
      total,
    });
  }
  if (!pending.length)
    return showNotice(
      'No readings entered',
      'Enter at least one current meter reading before generating bills.',
    );
  const entrySnapshot = localStorage.getItem(ledgerEntryKey);
  generatingBills = true;
  const generateButton = document.getElementById('generateLedgerBills');
  generateButton.disabled = true;
  let accepted;
  try {
    accepted = await confirmGeneratedBills(pending, latest);
  } finally {
    generatingBills = false;
    generateButton.disabled = false;
  }
  if (!accepted) return;
  if (entrySnapshot !== localStorage.getItem(ledgerEntryKey))
    return AdminUI.message('Saved entries changed. Reload before generating.');
  if (
    WaterStore.today() !== generatedOn ||
    JSON.stringify(WaterStore.load()) !== JSON.stringify(latest)
  )
    return AdminUI.message(
      'Records or dates changed while confirming. Review the entries and try again.',
    );
  pending.forEach((bill) => {
    latest.customers.find((customer) => customer.id === bill.customerId).reading = bill.current;
    latest.bills.push(bill);
  });
  try {
    WaterStore.save(latest);
  } catch {
    return AdminUI.message('Bills could not be saved. Your entries are kept; please try again.');
  }
  Object.assign(billingRecords, latest);
  pending.forEach((bill) => {
    delete meterDrafts[bill.customerId];
  });
  persistEntries();
  selectedConsumerId = null;
  renderLedger();
  clearEntry();
  await showNotice(
    'Bills generated successfully',
    pending.length +
      ' bills saved for ' +
      selectedBarangay +
      '. Open Generated Bills to review them.',
  );
});

const requested = new URLSearchParams(location.search).get('barangay');
if (WaterStore.barangays.includes(requested)) selectedBarangay = requested;
clearEntry();
renderLedger();
if (!setupForBarangay()) {
  setupBarangay.value = selectedBarangay;
  loadSetupFields();
  setupDialog.showModal();
}
