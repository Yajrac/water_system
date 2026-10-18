// Preview the exact bills that will be saved, including entries on other pages.
function confirmGeneratedBills(bills, records) {
  const preview = document.createElement('div');
  const totals = document.createElement('div');
  totals.className = 'bill-preview-totals';
  const cycle = bills[0].cycle;
  const total = bills.reduce((sum, bill) => sum + bill.total, 0);
  [
    ['Billing month', cycle],
    ['Generation date', bills[0].generatedOn],
    [
      'Due date',
      new Set(bills.map((bill) => bill.due)).size === 1
        ? bills[0].due
        : 'As configured per barangay',
    ],
    ['Bills to generate', bills.length],
    ['Total charges', WaterStore.money(total)],
  ].forEach(([label, value]) => {
    const item = document.createElement('div');
    const title = document.createElement('span');
    title.textContent = label;
    const number = document.createElement('strong');
    number.textContent = value;
    item.append(title, number);
    totals.appendChild(item);
  });
  const scroll = document.createElement('div');
  scroll.className = 'bill-preview-table';
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  ['Customer', 'Previous', 'Current', 'Consumed', 'Rate / m³', 'Due date', 'Bill total'].forEach(
    (label) => {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = label;
      head.appendChild(cell);
    },
  );
  const body = table.createTBody();
  bills.forEach((bill) => {
    const customer = records.customers.find((item) => item.id === bill.customerId);
    const row = body.insertRow();
    [
      customer.name + ' · ' + customer.account,
      bill.previous + ' m³',
      bill.current + ' m³',
      bill.consumption + ' m³',
      WaterStore.money(bill.ratePerCubic),
      bill.due,
      WaterStore.money(bill.total),
    ].forEach((value, index) =>
      AdminUI.cell(
        row,
        value,
        ['Customer', 'Previous', 'Current', 'Consumed', 'Rate / m³', 'Due date', 'Bill total'][
          index
        ],
      ),
    );
  });
  scroll.appendChild(table);
  preview.append(totals, scroll);
  return confirmAction(
    'Review bills before generating',
    'Review all entered readings below. Confirming will save these bills and update the customer meter readings. Cancel keeps your entries.',
    'Confirm and generate',
    preview,
  );
}
