const paymentRecords = WaterStore.load();

function showBalances() {
  const search = document.getElementById('balanceSearch').value.trim().toLowerCase();
  const statusFilter = document.getElementById('balanceStatus').value;
  const body = document.getElementById('balanceRows');
  body.replaceChildren();
  paymentRecords.bills.forEach((bill) => {
    const customer = paymentRecords.customers.find((item) => item.id === bill.customerId);
    const balance = WaterStore.balance(bill, paymentRecords);
    if (!customer || !(customer.name + ' ' + customer.account).toLowerCase().includes(search))
      return;
    if (
      statusFilter === 'outstanding'
        ? balance <= 0
        : statusFilter && WaterStore.status(bill, paymentRecords) !== statusFilter
    )
      return;
    const row = body.insertRow();
    [
      customer.account,
      customer.name,
      bill.cycle,
      WaterStore.money(bill.total),
      WaterStore.money(bill.total - balance),
      WaterStore.money(balance),
      WaterStore.status(bill, paymentRecords),
    ].forEach((value, index) =>
      AdminUI.cell(
        row,
        value,
        ['Account', 'Customer', 'Cycle', 'Bill total', 'Paid', 'Balance', 'Status'][index],
      ),
    );
  });
  AdminUI.empty(body, 7, 'No bills match your search and filters.');
}
const requestedCustomer = new URLSearchParams(location.search).get('customer');
const matchedCustomer = paymentRecords.customers.find(
  (customer) => customer.id === requestedCustomer,
);
if (matchedCustomer) document.getElementById('balanceSearch').value = matchedCustomer.account;
document.getElementById('balanceSearch').addEventListener('input', showBalances);
document.getElementById('balanceStatus').addEventListener('change', showBalances);
showBalances();
