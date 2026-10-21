function renderCustomerImportReview(rows) {
  const container = document.createElement('div');
  container.className = 'customer-import-review';
  const table = document.createElement('table');
  const header = table.createTHead().insertRow();
  for (const label of ['Row', 'Account no.', 'Customer', 'Status', 'Reason']) {
    const cell = document.createElement('th');
    cell.textContent = label;
    cell.scope = 'col';
    header.appendChild(cell);
  }
  const body = table.createTBody();
  for (const item of rows) {
    const row = body.insertRow();
    row.className = item.status === 'rejected' ? 'import-row-rejected' : 'import-row-ready';
    for (const value of [
      item.row,
      item.account || '—',
      item.name || '—',
      item.status === 'rejected' ? 'Rejected' : 'Ready',
      item.reason || '—',
    ]) {
      const cell = document.createElement('td');
      cell.textContent = String(value);
      row.appendChild(cell);
    }
  }
  container.appendChild(table);
  return container;
}
