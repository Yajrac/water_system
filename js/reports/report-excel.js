// A small, dependency-free XLSX writer using uncompressed ZIP entries.
function excelWorkbook(rows) {
  const encode = (text) => new TextEncoder().encode(text);
  const xml = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (character) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character],
    );
  const cells = rows
    .map(
      (row, index) =>
        '<row r="' +
        (index + 1) +
        '">' +
        row
          .map((value) =>
            typeof value === 'number' && Number.isFinite(value)
              ? '<c><v>' + value + '</v></c>'
              : '<c t="inlineStr"><is><t xml:space="preserve">' + xml(value) + '</t></is></c>',
          )
          .join('') +
        '</row>',
    )
    .join('');
  const files = {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':
      '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="12" width="24" customWidth="1"/></cols><sheetData>' +
      cells +
      '</sheetData></worksheet>',
  };
  function crc32(bytes) {
    let crc = 0xffffffff;
    bytes.forEach((byte) => {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    });
    return (crc ^ 0xffffffff) >>> 0;
  }
  const parts = [],
    directory = [];
  let offset = 0;
  Object.entries(files).forEach(([path, content]) => {
    const name = encode(path),
      data = encode(content),
      crc = crc32(data);
    const local = new Uint8Array(30 + name.length),
      view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length),
      centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    parts.push(local, data);
    directory.push(central);
    offset += local.length + data.length;
  });
  const end = new Uint8Array(22),
    endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, directory.length, true);
  endView.setUint16(10, directory.length, true);
  endView.setUint32(
    12,
    directory.reduce((sum, entry) => sum + entry.length, 0),
    true,
  );
  endView.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, end], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function exportCurrentReport() {
  const consumption =
    document.getElementById('barangayConsumptionTab').getAttribute('aria-selected') === 'true';
  const rows = [];
  if (consumption) {
    rows.push(['Barangay', 'Billed accounts', 'Consumption (m³)', 'Average per account (m³)']);
    consumptionReportRows.forEach((values) => rows.push([...values]));
  } else {
    rows.push([
      'Submitter no.',
      'Account',
      'Customer',
      'Address',
      'Billing month',
      'Consumption (m³)',
      'Bill total (PHP)',
      'Paid (PHP)',
      'Balance (PHP)',
      'Status',
    ]);
    reportMatchedBills.forEach(({ bill, customer, status }) => {
      const balance = WaterStore.balance(bill, reportRecords);
      rows.push([
        customer.submitterNumber || '',
        customer.account,
        customer.name,
        [customer.address, customer.street, customer.barangay].filter(Boolean).join(', '),
        bill.cycle,
        bill.consumption,
        bill.total,
        Math.round((bill.total - balance) * 100) / 100,
        balance,
        status,
      ]);
    });
  }
  const url = URL.createObjectURL(excelWorkbook(rows));
  const link = document.createElement('a');
  link.href = url;
  link.download =
    'PWSS-' + (consumption ? 'consumption' : 'accounts') + '-' + WaterStore.today() + '.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
