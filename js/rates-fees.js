const billingRecords = WaterStore.load();
const ratesForm = document.getElementById('ratesForm');

function loadRates() {
  billingRecords.rates.tiers.forEach((rate, index) => { ratesForm.elements['tier' + index].value = rate; });
  ['monthly', 'connection', 'reconnection'].forEach(name => { ratesForm.elements[name].value = billingRecords.rates[name]; });
}
ratesForm.addEventListener('submit', event => {
  event.preventDefault();
  const names = ['tier0', 'tier1', 'tier2', 'tier3', 'monthly', 'connection', 'reconnection'];
  if (names.some(name => !Validation.money(ratesForm.elements[name].value.trim()))) {
    return AdminUI.message('Rates and fees must be non-negative numbers with at most two decimal places.');
  }
  const tiers = [0, 1, 2, 3].map(index => Number(ratesForm.elements['tier' + index].value));
  const monthly = Number(ratesForm.elements.monthly.value);
  const connection = Number(ratesForm.elements.connection.value);
  const reconnection = Number(ratesForm.elements.reconnection.value);
  const latest = WaterStore.load();
  latest.rates = { tiers, monthly, connection, reconnection };
  WaterStore.save(latest);
  Object.assign(billingRecords, latest);
  AdminUI.message('Rates saved. Existing bills were not changed.');
});
loadRates();

