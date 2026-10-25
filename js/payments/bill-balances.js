const balancePager = createPagination('balancePagination', showBalances);
let balanceVersion = 0,
  balanceTimer;
async function showBalances() {
  const version = ++balanceVersion,
    body = document.getElementById('balanceRows');
  if (!body.children.length) AdminUI.loading(body, 6, 'Loading bill balances...');
  try {
    const query = new URLSearchParams({
      page: balancePager.page,
      limit: 10,
      search: document.getElementById('balanceSearch').value.trim(),
      status: document.getElementById('balanceStatus').value,
      customerId: new URLSearchParams(location.search).get('customer') || '',
    });
    const data = await AdminAPI.request('/bills?' + query);
    if (version !== balanceVersion) return;
    balancePager.page = data.pagination.page;
    balancePager.update(data.pagination.total);
    body.replaceChildren();
    for (const bill of data.bills) {
      const row = body.insertRow();
      AdminUI.customer(row, { id: bill.customerId, name: bill.name, account: bill.account });
      for (const [value, label] of [
        [bill.cycle, 'Cycle'],
        [WaterStore.money(Number(bill.total)), 'Bill total'],
        [WaterStore.money(Number(bill.total) - Number(bill.balance)), 'Paid'],
        [WaterStore.money(Number(bill.balance)), 'Balance'],
        [bill.status, 'Status'],
      ])
        AdminUI.cell(row, value, label);
    }
    AdminUI.empty(body, 6, 'No bills match your filters.');
  } catch (error) {
    if (version !== balanceVersion) return;
    body.replaceChildren();
    AdminUI.empty(body, 6, error.message);
    balancePager.update(0);
  }
}
for (const id of ['balanceSearch', 'balanceStatus'])
  document.getElementById(id).addEventListener(id === 'balanceSearch' ? 'input' : 'change', () => {
    balancePager.page = 1;
    balanceVersion++;
    clearTimeout(balanceTimer);
    balanceTimer = setTimeout(showBalances, id === 'balanceSearch' ? 250 : 0);
  });
AdminAuth.ready.then((user) => {
  if (user) showBalances();
});
