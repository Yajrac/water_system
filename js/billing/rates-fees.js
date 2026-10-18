const ratesForm = document.getElementById('ratesForm');
const setupBarangay = document.getElementById('setupBarangay');
const setupMonth = document.getElementById('setupMonth');
const setupDue = document.getElementById('setupDue');
const setupRate = document.getElementById('setupRate');
const saveRates = document.getElementById('saveRates');
let savingRates = false;
const currentSetupMonth = WaterStore.today().slice(0, 7);
setupMonth.value = currentSetupMonth;
setupDue.min = WaterStore.today();
const endOfMonth = new Date(
  Date.UTC(Number(currentSetupMonth.slice(0, 4)), Number(currentSetupMonth.slice(5, 7)), 0),
)
  .toISOString()
  .slice(0, 10);
WaterStore.barangays.forEach((name) => setupBarangay.add(new Option(name + ', Pio Duran', name)));
function updateSetupExample() {
  document.getElementById('setupExample').textContent =
    Validation.money(setupRate.value) &&
    Number(setupRate.value) > 0 &&
    Number(setupRate.value) <= Number.MAX_SAFE_INTEGER / 1000
      ? '25 cubic meters = ' +
        WaterStore.money(WaterStore.flatWaterCharge(25, Number(setupRate.value)))
      : 'Consumption \u00d7 rate = water charge';
}
function loadSetup() {
  const existing = WaterStore.flatBillingSetup(
    WaterStore.load(),
    currentSetupMonth,
    setupBarangay.value,
  );
  setupDue.value = existing && existing.due >= WaterStore.today() ? existing.due : endOfMonth;
  setupRate.value = existing?.rate ?? '';
  updateSetupExample();
}
setupBarangay.addEventListener('change', loadSetup);
setupRate.addEventListener('input', updateSetupExample);
ratesForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (savingRates) return;
  const today = WaterStore.today();
  const barangay = setupBarangay.value;
  const due = setupDue.value;
  const rateText = setupRate.value.trim();
  if (!WaterStore.barangays.includes(barangay))
    return showNotice('Select barangay', 'Choose a registered barangay.');
  if (currentSetupMonth !== today.slice(0, 7) || setupMonth.value !== currentSetupMonth)
    return showNotice('Check billing month', 'Reload this page to work on the current month.');
  if (!Validation.date(due) || due < today)
    return showNotice('Check due date', 'Payment due date must be today or later.');
  if (
    !Validation.money(rateText) ||
    Number(rateText) <= 0 ||
    Number(rateText) > Number.MAX_SAFE_INTEGER / 1000
  )
    return showNotice(
      'Check rate',
      'Enter a positive price per cubic meter with at most two decimal places.',
    );
  const records = WaterStore.load();
  const snapshot = JSON.stringify(records);
  const rate = Number(rateText);
  savingRates = true;
  saveRates.disabled = true;
  try {
    const accepted = await confirmAction(
      'Continue with billing setup?',
      'Barangay: ' +
        barangay +
        '\nBilling month: ' +
        currentSetupMonth +
        '\nDue date: ' +
        due +
        '\nRate per cubic meter: ' +
        WaterStore.money(rate) +
        '\n\nWater charge = consumption \u00d7 rate. Existing generated bills will not change.',
      'Confirm and continue',
    );
    if (!accepted) return;
    if (WaterStore.today() !== today || JSON.stringify(WaterStore.load()) !== snapshot)
      return AdminUI.message('Records or dates changed. Review the setup and try again.');
    records.billingSetups = records.billingSetups || {};
    records.billingSetups[currentSetupMonth] = records.billingSetups[currentSetupMonth] || {};
    records.billingSetups[currentSetupMonth][barangay] = {
      rate,
      due,
      mode: 'flat',
      savedOn: today,
    };
    WaterStore.save(records);
    location.href = 'billing.html?barangay=' + encodeURIComponent(barangay);
  } catch {
    AdminUI.message('Billing setup could not be saved. Please try again.');
  } finally {
    savingRates = false;
    saveRates.disabled = false;
  }
});
loadSetup();
