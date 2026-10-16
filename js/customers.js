const customerRecords = WaterStore.load();
const importFields = [
  {
    "name": "name",
    "type": "text"
  },
  {
    "name": "contact",
    "type": "tel"
  },
  {
    "name": "address",
    "type": "text"
  },
  {
    "name": "barangay",
    "type": "text"
  },
  {
    "name": "customerType",
    "type": "text"
  },
  {
    "name": "account",
    "type": "text"
  },
  {
    "name": "applicationNumber",
    "type": "text"
  },
  {
    "name": "installationReference",
    "type": "text"
  },
  {
    "name": "clusterNumber",
    "type": "text"
  },
  {
    "name": "dateApplied",
    "type": "date"
  },
  {
    "name": "dateApproved",
    "type": "date"
  },
  {
    "name": "serviceStatus",
    "type": "text"
  },
  {
    "name": "approvedBy",
    "type": "text"
  },
  {
    "name": "installedBy",
    "type": "text"
  },
  {
    "name": "dateInstalled",
    "type": "date"
  },
  {
    "name": "meterNumber",
    "type": "text"
  },
  {
    "name": "reading",
    "type": "number"
  },
  {
    "name": "meterKind",
    "type": "text"
  },
  {
    "name": "meterSize",
    "type": "text"
  },
  {
    "name": "natureOfWork",
    "type": "text"
  },
  {
    "name": "installationFee",
    "type": "number"
  },
  {
    "name": "setbackLength",
    "type": "number"
  },
  {
    "name": "setbackRate",
    "type": "number"
  },
  {
    "name": "reinstallationFee",
    "type": "number"
  },
  {
    "name": "violationFee",
    "type": "number"
  },
  {
    "name": "certificateReceived",
    "type": "checkbox"
  },
  {
    "name": "contractReceived",
    "type": "checkbox"
  },
  {
    "name": "acknowledgementReceived",
    "type": "checkbox"
  },
  {
    "name": "contractDate",
    "type": "date"
  },
  {
    "name": "acknowledgementDate",
    "type": "date"
  },
  {
    "name": "ctcNumber",
    "type": "text"
  },
  {
    "name": "ctcDate",
    "type": "date"
  },
  {
    "name": "ctcPlace",
    "type": "text"
  },
  {
    "name": "representativeCtc",
    "type": "text"
  },
  {
    "name": "representativeCtcDate",
    "type": "date"
  },
  {
    "name": "representativeCtcPlace",
    "type": "text"
  },
  {
    "name": "documentNotes",
    "type": "text"
  },
  {
    "name": "accessories",
    "type": "text"
  },
  {
    "name": "removedMeter",
    "type": "text"
  },
  {
    "name": "removedReading",
    "type": "number"
  },
  {
    "name": "removedKind",
    "type": "text"
  },
  {
    "name": "removedSize",
    "type": "text"
  },
  {
    "name": "estimatedLiters",
    "type": "number"
  }
];

function showCustomers() {
  const body = document.getElementById('customerRows');
  const search = document.getElementById('customerSearch').value.trim().toLowerCase();
  const barangay = document.getElementById('barangayFilter').value;
  body.replaceChildren();
  const customers = customerRecords.customers.filter(customer =>
    (!barangay || customer.barangay === barangay) &&
    (customer.name + ' ' + customer.account).toLowerCase().includes(search));
  customers.forEach(customer => {
    const row = body.insertRow();
    AdminUI.cell(row, customer.account, 'Account').className = 'customer-account';
    const nameCell = AdminUI.cell(row, '', 'Customer');
    const identity = document.createElement('div');
    identity.className = 'customer-identity';
    const avatar = document.createElement('span');
    avatar.className = 'customer-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = customer.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
    const details = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = customer.name;
    const type = document.createElement('small');
    type.textContent = customer.customerType || 'Service account';
    details.append(name, type);
    identity.append(avatar, details);
    nameCell.appendChild(identity);
    AdminUI.cell(row, customer.barangay, 'Barangay');
    AdminUI.cell(row, customer.contact || '—', 'Contact');
    AdminUI.cell(row, customer.reading + ' m³', 'Meter reading');
    const statusCell = AdminUI.cell(row, '', 'Status');
    const status = document.createElement('span');
    status.className = 'customer-status ' + (WaterStore.isRegistered(customer) ? 'is-registered' : 'is-pending');
    status.textContent = !WaterStore.isActive(customer) ? 'Inactive' : WaterStore.isRegistered(customer) ? 'Registered' : 'Pending';
    if (!WaterStore.isActive(customer)) status.className = 'customer-status status-overdue';
    statusCell.appendChild(status);
    const actionCell = AdminUI.cell(row, '', 'Actions');
    const actions = document.createElement('div');
    actions.className = 'customer-row-actions';
    actionCell.appendChild(actions);
    const edit = document.createElement('a');
    edit.className = 'btn action-edit';
    edit.href = 'customer-form.html?id=' + encodeURIComponent(customer.id);
    edit.textContent = 'Edit';
    actions.appendChild(edit);
    const history = document.createElement('a');
    history.className = 'btn action-view';
    history.href = 'customer-profile.html?id=' + encodeURIComponent(customer.id);
    history.textContent = 'View profile';
    actions.appendChild(history);
  });
  AdminUI.empty(body, 7, 'No customers found. Add a customer or import a CSV file.');
  document.getElementById('customerCount').textContent = customers.length + ' of ' + customerRecords.customers.length + ' customers';
  const registered = customerRecords.customers.filter(customer => WaterStore.isRegistered(customer)).length;
  document.getElementById('totalCustomers').textContent = customerRecords.customers.length;
  document.getElementById('registeredCustomers').textContent = registered;
  document.getElementById('pendingCustomers').textContent = customerRecords.customers.length - registered;
}

function updateBarangays() {
  const select = document.getElementById('barangayFilter');
  const selected = select.value;
  select.replaceChildren(new Option('All barangays', ''));
  WaterStore.barangays.forEach(barangay => select.add(new Option(barangay, barangay)));
  // Keep old records visible; an unsupported barangay must be corrected when editing.
  [...new Set(customerRecords.customers.map(customer => customer.barangay))]
    .filter(barangay => !WaterStore.barangays.includes(barangay))
    .forEach(barangay => select.add(new Option(barangay + ' (old record)', barangay)));
  select.value = selected;
}

// Read quoted CSV fields, including commas, escaped quotes and line breaks.
function readCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index++; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(field.trim()); field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index++;
      row.push(field.trim());
      if (row.some(value => value !== '')) rows.push(row);
      row = []; field = '';
    } else field += character;
  }
  if (quoted) throw new Error('Unclosed quotation mark in CSV.');
  row.push(field.trim());
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
}

document.getElementById('importForm').addEventListener('submit', async event => {
  event.preventDefault();
  const file = document.getElementById('customerFile').files[0];
  if (!file || !file.name.toLowerCase().endsWith('.csv') || file.size > 5 * 1024 * 1024) return AdminUI.message('Select a CSV file no larger than 5 MB.');
  try {
    const rows = readCSV(await file.text());
    const headers = rows.shift()?.map(value => value.toLowerCase());
    const required = ['account', 'name', 'barangay', 'address', 'contact', 'reading'];
    if (!headers || required.some(name => !headers.includes(name)) || new Set(headers).size !== headers.length) throw new Error('Use the CSV template headers.');
    const accounts = new Set(customerRecords.customers.map(customer => customer.account.toLowerCase()));
    const applications = new Set(customerRecords.customers.map(customer => customer.applicationNumber?.toLowerCase()).filter(Boolean));
    const imported = rows.map((row, index) => {
      const customer = { id: WaterStore.id() };
      required.forEach(name => { customer[name] = row[headers.indexOf(name)] ?? ''; });
      importFields.filter(field => field.name && !required.includes(field.name)).forEach(field => {
        const value = row[headers.indexOf(field.name.toLowerCase())] || '';
        if (field.type === 'checkbox') customer[field.name] = ['true', 'yes', '1'].includes(value.toLowerCase());
        else if (field.type === 'number') {
          if (value && (!Number.isFinite(Number(value)) || Number(value) < 0)) throw new Error('Invalid ' + field.name + ' on CSV row ' + (index + 2) + '.');
          customer[field.name] = Number(value || 0);
        } else {
          if (field.type === 'date' && value && (!Validation.date(value) || value > WaterStore.today())) throw new Error('Invalid date on CSV row ' + (index + 2) + '.');
          customer[field.name] = value;
        }
      });
      if (row.length !== headers.length || !customer.account || !customer.name || !customer.barangay || customer.reading === '' || !Number.isFinite(Number(customer.reading)) || Number(customer.reading) < 0) throw new Error('Invalid fields on CSV row ' + (index + 2) + '.');
      if (accounts.has(customer.account.toLowerCase())) throw new Error('Duplicate account on CSV row ' + (index + 2) + ': ' + customer.account);
      accounts.add(customer.account.toLowerCase());
      customer.reading = Number(customer.reading);
      customer.barangay = WaterStore.normalizeBarangay(customer.barangay);
      if (!WaterStore.barangays.includes(customer.barangay)) throw new Error('Unsupported barangay on CSV row ' + (index + 2) + '.');
      if (!Validation.identifier(customer.account) || !/^[\p{L}\p{M} .,'-]+$/u.test(customer.name) || (customer.contact && !Validation.phone(customer.contact))) throw new Error('Invalid account, name or contact on CSV row ' + (index + 2) + '.');
      customer.customerType = customer.customerType || 'Residential';
      // Imported accounts stay pending until their documents are checked in the form.
      customer.serviceStatus = 'Pending';
      customer.registrationStatus = 'Application';
      if (customer.applicationNumber) {
        if (!Validation.identifier(customer.applicationNumber) || applications.has(customer.applicationNumber.toLowerCase())) throw new Error('Invalid or duplicate application number on CSV row ' + (index + 2) + '.');
        applications.add(customer.applicationNumber.toLowerCase());
      }
      if (!['Residential', 'Commercial'].includes(customer.customerType)) throw new Error('Invalid customer type on CSV row ' + (index + 2) + '.');
      customer.installationTotal = Math.round((customer.installationFee + customer.setbackLength * customer.setbackRate + customer.reinstallationFee + customer.violationFee) * 100) / 100;
      return customer;
    });
    if (!imported.length) throw new Error('The CSV has no customer rows.');
    const importRecords = { ...customerRecords, customers: [...customerRecords.customers, ...imported], sequences: { ...customerRecords.sequences } };
    imported.forEach(customer => {
      if (!customer.applicationNumber) customer.applicationNumber = WaterStore.nextReference(importRecords, 'APP', 'applicationNumber');
    });
    WaterStore.save(importRecords);
    Object.assign(customerRecords, importRecords);
    updateBarangays(); showCustomers();
    event.target.reset();
    AdminUI.message(imported.length + ' customers imported.');
  } catch (error) { AdminUI.message(error.message + ' No rows were imported.'); }
});

document.getElementById('downloadTemplate').addEventListener('click', () => {
  const names = importFields.filter(field => field.name && field.name !== 'serviceStatus').map(field => field.name);
  AdminUI.download('customers-template.csv', names.join(',') + '\r\n');
});

document.getElementById('customerSearch').addEventListener('input', showCustomers);
document.getElementById('barangayFilter').addEventListener('change', showCustomers);
customerRecords.customers.forEach(customer => { customer.barangay = WaterStore.normalizeBarangay(customer.barangay); });
updateBarangays();
showCustomers();
const savedCustomerId = new URLSearchParams(location.search).get('saved');
const savedCustomer = customerRecords.customers.find(customer => customer.id === savedCustomerId);
if (savedCustomer) {
  AdminUI.message((WaterStore.isRegistered(savedCustomer) ? 'Customer registered. ' : 'Pending application saved. ') + 'Account: ' + savedCustomer.account + ' · Application: ' + savedCustomer.applicationNumber);
  history.replaceState(null, '', 'customers.html');
}

async function loadSampleCustomerList() {
  const table = document.getElementById('customerRows');
  table.setAttribute('aria-busy', 'true');
  try {
    const records = await fetchSampleCustomers();
    Object.assign(customerRecords, records);
    updateBarangays();
    showCustomers();
  } catch (error) {
    AdminUI.message(error.message + ' Use your editor’s local web preview to load the JSON file.');
  } finally {
    table.setAttribute('aria-busy', 'false');
  }
}
loadSampleCustomerList();
