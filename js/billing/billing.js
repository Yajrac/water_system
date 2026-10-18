const billingRecords = WaterStore.load();
// Monthly Billing always works on the current Philippine calendar month.
const currentBillingMonth = WaterStore.today().slice(0, 7);
const currentPeriod = WaterStore.billingPeriod(billingRecords);
currentPeriod.active = currentBillingMonth;
currentPeriod.closed = currentPeriod.closed.filter((month) => month !== currentBillingMonth);
const billingForm = document.getElementById('billingForm');
const meterBody = document.getElementById('meterRows');
function updateGenerationDate() {
  const today = WaterStore.today();
  document.getElementById('generationDateLabel').textContent = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'long',
    timeZone: 'Asia/Manila',
  }).format(new Date(today + 'T12:00:00+08:00'));
  billingForm.elements.due.min = today;
}
updateGenerationDate();
window.addEventListener('focus', updateGenerationDate);
let generatingBills = false;
const draftKey = 'pio-duran-meter-drafts-' + WaterStore.billingPeriod(billingRecords).active;
let meterDrafts = {};
const activePeriod = WaterStore.billingPeriod(billingRecords);
function needsBill(customer) {
  return (
    WaterStore.isRegistered(customer) &&
    WaterStore.isActive(customer) &&
    !billingRecords.bills.some(
      (bill) => bill.customerId === customer.id && bill.cycle >= activePeriod.active,
    )
  );
}
WaterStore.save(billingRecords);
document.getElementById('activeCycleLabel').textContent = activePeriod.active
  ? new Intl.DateTimeFormat('en-PH', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    }).format(new Date(activePeriod.active + '-01T00:00:00Z'))
  : 'No open cycle';
billingForm.elements.due.min = WaterStore.today();
billingForm.elements.due.value = WaterStore.today();
// Session storage keeps unfinished readings while visiting Bills or Rates.
try {
  const saved = JSON.parse(
    sessionStorage.getItem(draftKey) || sessionStorage.getItem('pio-duran-meter-drafts'),
  );
  if (
    saved &&
    saved.cycle === activePeriod.active &&
    !WaterStore.cycleError(billingRecords, saved.cycle)
  ) {
    billingForm.elements.due.value =
      saved.due >= WaterStore.today() ? saved.due : WaterStore.today();
    meterDrafts = saved.readings || {};
    sessionStorage.removeItem('pio-duran-meter-drafts');
  } else if (saved)
    AdminUI.message(
      'The saved draft belongs to a different or closed cycle. It has not been moved into this cycle.',
    );
} catch {
  AdminUI.message('The saved meter draft could not be restored. Start a new entry.');
}
// Already generated accounts must not keep blocking new entries through old drafts.
Object.keys(meterDrafts).forEach((id) => {
  const customer = billingRecords.customers.find((item) => item.id === id);
  if (!customer || !needsBill(customer)) delete meterDrafts[id];
});
const meterPager = createPagination('meterPagination', showMeterRows);
WaterStore.barangays.forEach((barangay) =>
  document.getElementById('meterBarangay').add(new Option(barangay, barangay)),
);

function showFlatBillingSetup() {
  const barangay = document.getElementById('meterBarangay').value;
  const setup = WaterStore.flatBillingSetup(WaterStore.load(), activePeriod.active, barangay);
  document.getElementById('flatRateSummary').textContent = setup
    ? barangay + ' · ' + WaterStore.money(setup.rate) + ' per cubic meter'
    : 'Configure a billing setup for each barangay before generating bills.';
  billingForm.elements.due.value = setup?.due || WaterStore.today();
}
const requestedBillingBarangay = new URLSearchParams(location.search).get('barangay');
if (WaterStore.barangays.includes(requestedBillingBarangay))
  document.getElementById('meterBarangay').value = requestedBillingBarangay;
document.getElementById('meterBarangay').addEventListener('change', showFlatBillingSetup);
showFlatBillingSetup();

function saveMeterDraft() {
  sessionStorage.setItem(
    draftKey,
    JSON.stringify({
      cycle: activePeriod.active,
      due: billingForm.elements.due.value,
      readings: meterDrafts,
    }),
  );
  const count = Object.values(meterDrafts).filter((draft) => draft.current !== '').length;
  document.getElementById('draftCount').textContent = count + ' readings entered across all pages';
}
function setDraft(customer, field, value) {
  if (!meterDrafts[customer.id])
    meterDrafts[customer.id] = {
      previous: customer.reading,
      current: '',
      connection: 'None',
      late: '0',
      other: '0',
    };
  meterDrafts[customer.id][field] = value;
  saveMeterDraft();
}
function showMeterRows() {
  const search = document.getElementById('meterSearch').value.trim().toLowerCase();
  const barangay = document.getElementById('meterBarangay').value;
  const customers = billingRecords.customers.filter(
    (customer) =>
      needsBill(customer) &&
      (!barangay || customer.barangay === barangay) &&
      (customer.account + ' ' + customer.name).toLowerCase().includes(search),
  );
  meterPager.update(customers.length);
  meterBody.replaceChildren();
  meterPager.items(customers).forEach((customer) => {
    const draft = meterDrafts[customer.id] || {
      current: '',
      connection: 'None',
      late: '0',
      other: '0',
    };
    const row = meterBody.insertRow();
    row.dataset.customerId = customer.id;
    AdminUI.customer(row, customer);
    AdminUI.cell(row, customer.reading, 'Previous reading');
    const current = document.createElement('input');
    current.type = 'number';
    current.min = customer.reading;
    current.step = '0.001';
    current.value = draft.current;
    current.className = 'reading-field';
    current.setAttribute('aria-label', 'Current reading for ' + customer.account);
    AdminUI.cell(row, '', 'Current reading').appendChild(current);
    const consumption = AdminUI.cell(
      row,
      draft.current === '' ? '—' : Number((Number(draft.current) - customer.reading).toFixed(3)),
      'Consumption',
    );
    current.addEventListener('input', () => {
      setDraft(customer, 'current', current.value);
      const amount = Number(current.value) - customer.reading;
      consumption.textContent =
        current.value === '' ? '—' : amount < 0 ? 'Invalid reading' : Number(amount.toFixed(3));
    });
    const connection = document.createElement('select');
    connection.setAttribute('aria-label', 'Connection charge for ' + customer.account);
    ['None', 'New connection', 'Reconnection'].forEach((value) =>
      connection.add(new Option(value, value)),
    );
    connection.value = draft.connection;
    connection.addEventListener('change', () => setDraft(customer, 'connection', connection.value));
    AdminUI.cell(row, '', 'Connection charge').appendChild(connection);
    [
      ['Late fee', 'late'],
      ['Other charge', 'other'],
    ].forEach(([label, field]) => {
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = '0.01';
      input.value = draft[field];
      input.className = 'reading-field';
      input.setAttribute('aria-label', label + ' for ' + customer.account);
      input.addEventListener('input', () => setDraft(customer, field, input.value));
      AdminUI.cell(row, '', label).appendChild(input);
    });
  });
  AdminUI.empty(
    meterBody,
    7,
    'No customers awaiting a bill for this cycle match your search. Generated bills are in Generated Bills.',
  );
}

billingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (generatingBills) return;
  if (!Object.values(meterDrafts).some((draft) => draft.current !== '')) {
    const available = billingRecords.customers.some(needsBill);
    await showNotice(
      available ? 'No readings entered' : 'No bills to generate',
      available
        ? 'Enter at least one current meter reading before generating bills. Readings entered on other pages are included.'
        : 'No customers are awaiting a bill for this billing cycle. Review Generated Bills, or open the next billing month when it is available.',
    );
    return;
  }
  if (!billingForm.checkValidity()) {
    const invalid = billingForm.querySelector(':invalid');
    AdminUI.message(
      invalid?.getAttribute('aria-label')
        ? 'Please check ' +
            invalid.getAttribute('aria-label') +
            '. Current reading must be at least the previous reading; amounts must be valid non-negative numbers.'
        : 'Please enter a valid due date on or after today.',
    );
    billingForm.reportValidity();
    return;
  }
  const pending = [];
  const cycle = activePeriod.active;
  const due = billingForm.elements.due.value;
  const generatedOn = WaterStore.today();
  updateGenerationDate();
  billingForm.elements.due.min = generatedOn;
  if (!Validation.date(due) || due < generatedOn)
    return AdminUI.message(
      'Due date cannot be earlier than the generation date (' + generatedOn + ').',
    );
  // Recheck current balances and meter readings before generating any bills.
  const latest = WaterStore.load();
  const cycleError = WaterStore.cycleError(latest, cycle);
  if (cycleError) return AdminUI.message(cycleError);
  for (const [customerId, draft] of Object.entries(meterDrafts)) {
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
  generatingBills = true;
  const generateButton = document.querySelector('.billing-submit button');
  generateButton.disabled = true;
  let accepted;
  try {
    accepted = await confirmGeneratedBills(pending, latest);
  } finally {
    generatingBills = false;
    generateButton.disabled = false;
  }
  if (!accepted) return;
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
  saveMeterDraft();
  showMeterRows();
  AdminUI.message(pending.length + ' bills generated. Open Generated Bills to review them.');
  updateBillingProgress();
});
['meterSearch', 'meterBarangay'].forEach((id) =>
  document.getElementById(id).addEventListener(id === 'meterSearch' ? 'input' : 'change', () => {
    meterPager.page = 1;
    showMeterRows();
  }),
);
billingForm.elements.due.addEventListener('change', saveMeterDraft);
showMeterRows();
saveMeterDraft();
const periodError = WaterStore.cycleError(billingRecords, activePeriod.active);
document.getElementById('activeCycleStatus').textContent = periodError || '';
document.querySelector('.billing-submit button').disabled = Boolean(periodError);
