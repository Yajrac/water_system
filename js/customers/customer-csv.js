function readCSV(text) {
  const rows = [];
  let row = [],
    field = '',
    quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index++;
      } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index++;
      row.push(field.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += character;
  }
  if (quoted) throw new Error('Unclosed quotation mark in CSV.');
  row.push(field.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

const customerCSVColumns = [
  'account',
  'firstName',
  'middleName',
  'lastName',
  'extensionName',
  'gender',
  'contact',
  'address',
  'street',
  'barangay',
  'customerType',
  'submitterNumber',
  'applicationNumber',
  'username',
  'serviceStatus',
  'connectionStatus',
  'natureOfWork',
  'dateApplied',
  'dateApproved',
  'dateInstalled',
  'meterNumber',
  'meterKind',
  'meterSize',
  'initialReading',
  'reading',
  'certificateReceived',
  'contractReceived',
  'acknowledgementReceived',
  'contractDate',
  'acknowledgementDate',
  'ctcNumber',
  'ctcDate',
  'ctcPlace',
  'representativeCtc',
  'representativeCtcDate',
  'representativeCtcPlace',
  'documentNotes',
  'installationFee',
  'setbackLength',
  'setbackRate',
  'reinstallationFee',
  'violationFee',
];
function customerCSVRecords(text) {
  const rows = readCSV(text);
  const headers = rows.shift();
  const required = ['account', 'firstName', 'lastName', 'gender', 'contact', 'barangay'];
  if (
    !headers ||
    new Set(headers).size !== headers.length ||
    required.some((key) => !headers.includes(key)) ||
    (!headers.includes('address') && !headers.includes('street')) ||
    headers.some((key) => !customerCSVColumns.includes(key))
  )
    throw new Error('Use the same customer columns as Export Excel.');
  if (!rows.length || rows.length > 100)
    throw new Error('Import between 1 and 100 rows at a time.');
  return rows.map((row, index) => {
    if (row.length !== headers.length)
      throw new Error('Invalid column count on row ' + (index + 2) + '.');
    const values = Object.fromEntries(headers.map((key, position) => [key, row[position]]));
    for (const key of ['certificateReceived', 'contractReceived', 'acknowledgementReceived']) {
      if (values[key] !== undefined) {
        const value = values[key].toLowerCase();
        if (!['true', 'false', '1', '0', 'yes', 'no', ''].includes(value))
          throw new Error('Invalid document check on row ' + (index + 2) + ': ' + key);
        values[key] = ['true', '1', 'yes'].includes(value);
      }
    }
    for (const key of [
      'initialReading',
      'reading',
      'installationFee',
      'setbackLength',
      'setbackRate',
      'reinstallationFee',
      'violationFee',
    ])
      if (values[key] === '') delete values[key];
    if (!values.address) {
      const purok = /^purok\s+([1-7])$/i.exec(values.street || '');
      values.address = purok ? 'Purok ' + purok[1] : '';
      if (purok) values.street = '';
    }
    const normalizeBarangay = (name) =>
      String(name)
        .trim()
        .replace(/^(?:barangay|brgy\.?)\s+/i, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();
    const matches = CustomerAPI.barangays.filter(
      (item) => normalizeBarangay(item.name) === normalizeBarangay(values.barangay),
    );
    if (matches.length > 1)
      throw new Error('Barangay on row ' + (index + 2) + ' matches multiple registered barangays.');
    const barangayName = values.barangay.trim();
    const barangay = matches[0];
    delete values.barangay;
    return {
      ...values,
      ...(barangay ? { barangayId: String(barangay.id) } : { barangayName }),
    };
  });
}
