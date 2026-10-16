const billingRecords = WaterStore.load();
const ratesForm = document.getElementById('ratesForm');
const rateTypes = ['residential', 'commercial'];
const rateKeys = ['minimum', 'tier0', 'tier1', 'tier2', 'tier3'];
function loadRates() {
  rateTypes.forEach((type) => {
    ratesForm.elements[type + '_above50'].value = billingRecords.rates[type].above50 ?? '';
    ratesForm.elements[type + '_minimum'].value = billingRecords.rates[type].minimum;
    billingRecords.rates[type].tiers.forEach((value, index) => {
      ratesForm.elements[type + '_tier' + index].value = value;
    });
  });
  ['connection', 'reconnection'].forEach((name) => {
    ratesForm.elements[name].value = billingRecords.rates[name];
  });
}
ratesForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const names = [
    ...rateTypes.flatMap((type) => rateKeys.map((key) => type + '_' + key)),
    'connection',
    'reconnection',
  ];
  if (
    names.some(
      (name) =>
        !Validation.money(ratesForm.elements[name].value.trim()) ||
        Number(ratesForm.elements[name].value) > Number.MAX_SAFE_INTEGER / 100,
    )
  )
    return AdminUI.message(
      'Rates and fees must be valid non-negative amounts with at most two decimal places.',
    );
  const latest = WaterStore.load();
  for (const type of rateTypes) {
    const value = ratesForm.elements[type + '_above50'].value.trim();
    if (ratesForm.elements[type + '_above50'].validity.badInput || (value && (!Validation.money(value) || Number(value) > Number.MAX_SAFE_INTEGER / 100))) return AdminUI.message('The rate above 50 m³ must be blank or a non-negative amount with up to two decimal places.');
  }
  const rates = { ...latest.rates, version: 2, monthly: 0 };
  rateTypes.forEach((type) => {
    rates[type] = {
      minimum: Number(ratesForm.elements[type + '_minimum'].value),
      tiers: [0, 1, 2, 3].map((index) => Number(ratesForm.elements[type + '_tier' + index].value)),
      above50: ratesForm.elements[type + '_above50'].value.trim() === '' ? null : Number(ratesForm.elements[type + '_above50'].value),
    };
  });
  ['connection', 'reconnection'].forEach((name) => {
    rates[name] = Number(ratesForm.elements[name].value);
  });
  latest.rates = rates;
  try {
    WaterStore.save(latest);
  } catch {
    return AdminUI.message('Rates could not be saved. Please try again.');
  }
  Object.assign(billingRecords, latest);
  AdminUI.message('Rates saved for new bills. Existing bills and payments were not changed.');
});
loadRates();
