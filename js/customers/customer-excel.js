// SheetJS CE 0.20.3 is stored locally in js/vendor; see SHEETJS-LICENSE.txt.
function downloadCustomerExcel(customers, filename) {
  const rows = [
    customerCSVColumns,
    ...customers.map((customer) => customerCSVColumns.map((key) => String(customer[key] ?? ''))),
  ];
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = customerCSVColumns.map(() => ({ wch: 24 }));
  XLSX.utils.book_append_sheet(workbook, sheet, 'Customers');
  XLSX.writeFile(workbook, filename, { compression: true });
}

async function readCustomerExcel(file) {
  let workbook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', sheetRows: 102 });
  } catch {
    throw new Error('Could not read this Excel file. Upload a valid customer .xlsx file.');
  }
  if (workbook.SheetNames.length !== 1) throw new Error('Use one Customers worksheet per import.');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (Object.values(sheet).some((cell) => cell && typeof cell === 'object' && cell.f))
    throw new Error('Replace Excel formulas with plain values before importing.');
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  }).filter((row) => row.some((value) => String(value).trim() !== ''));
  if (rows.length < 2)
    throw new Error('No data to import. This Excel file has no customer records.');
  // Share the existing column, row-count, and barangay validation with CSV imports.
  const csv = rows
    .map((row) => row.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(','))
    .join('\n');
  return customerCSVRecords(csv);
}
