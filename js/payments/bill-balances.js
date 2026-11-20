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
      const paid = Number(bill.total) - Number(bill.balance);
      // Cycle as "Oct 2026"; paid in green, balance red while owed and green when settled.
      const cycle = /^\d{4}-\d{2}$/.test(String(bill.cycle))
        ? new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' })
          .format(new Date(bill.cycle + '-01T00:00:00Z'))
        : bill.cycle;
      const cells = [
        [cycle, 'Cycle'],
        [WaterStore.money(Number(bill.total)), 'Bill total'],
        [WaterStore.money(paid), 'Paid'],
        [WaterStore.money(Number(bill.balance)), 'Balance'],
        [bill.status, 'Status'],
      ].map(([value, label]) => AdminUI.cell(row, value, label));
      if (paid > 0) cells[2].className = 'balance-paid-amount';
      cells[3].className = Number(bill.balance) > 0 ? 'balance-due-amount' : 'balance-settled-amount';
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
