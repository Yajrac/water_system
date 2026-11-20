const registrySearch = document.getElementById('barangaySearch');
const registryPager = createPagination('barangayPagination', showBarangays);
let registryEntries = [];
let registryLoading = false;
let registryFailure = '';
let registryLoadVersion = 0;
let deletingBarangay = false;

function registryAction(parent, title, iconName, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn barangay-action action-' + 'delete';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.disabled = deletingBarangay;
  const icon = document.createElement('i');
  icon.className = 'bi bi-' + iconName;
  icon.setAttribute('aria-hidden', 'true');
  button.appendChild(icon);
  button.addEventListener('click', action);
  parent.appendChild(button);
}

function showBarangays() {
  const query = registrySearch.value.trim().toLowerCase();
  const matches = registryEntries.filter((entry) =>
    [entry.name, entry.code, entry.municipality, entry.province]
      .join(' ')
      .toLowerCase()
      .includes(query),
  );
  const body = document.getElementById('barangayRows');
  body.replaceChildren();
  body.setAttribute('aria-busy', String(registryLoading));
  registryPager.update(matches.length);
  document.getElementById('barangayCount').textContent = registryLoading
    ? 'Loading barangays...'
    : registryFailure
      ? 'Could not load barangays'
      : registryEntries.length + ' registered barangays';
  showRegistryTotals();
  if (registryLoading || registryFailure) {
    if (registryLoading) AdminUI.loading(body, 4, 'Loading barangays...');
    else AdminUI.empty(body, 4, registryFailure);
    document.getElementById('retryBarangayList').hidden = !registryFailure;
    return;
  }
  document.getElementById('retryBarangayList').hidden = true;
  registryPager.items(matches).forEach((entry) => {
    const row = body.insertRow();
    // Name with its PSGC code underneath; one Location column instead of two repeated ones.
    const nameCell = AdminUI.cell(row, '', 'Barangay');
    nameCell.className = 'barangay-name-cell';
    // Colored initial tile; the same barangay always gets the same of six colors.
    const shortName = entry.name.replace(/^Barangay\s+/i, '');
    const tone = [...entry.name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 6;
    const avatar = document.createElement('span');
    avatar.className = 'barangay-avatar tone-' + tone;
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = (shortName.match(/^\d+/)?.[0] || shortName.charAt(0)).toUpperCase();
    const text = document.createElement('span');
    text.className = 'barangay-name-text';
    const name = document.createElement('strong');
    // Named areas drop the "Barangay" prefix (Banawan); numbered ones keep it (Barangay 2).
    name.textContent = /^\d+$/.test(shortName) ? entry.name : shortName;
    name.title = entry.name;
    text.append(name);
    nameCell.append(avatar, text);
    AdminUI.cell(row, entry.municipality + ', ' + entry.province, 'Location').className = 'barangay-location-cell';
    const customers = document.createElement('span');
    // The column header already says "Customers": show the number only, colored by count.
    customers.className = 'barangay-customer-pill' + (entry.customers ? '' : ' is-empty');
    customers.textContent = entry.customers.toLocaleString();
    customers.setAttribute('aria-label', entry.customers + (entry.customers === 1 ? ' customer' : ' customers'));
    AdminUI.cell(row, '', 'Customers').appendChild(customers);
    const group = document.createElement('div');
    group.className = 'barangay-actions';
    AdminUI.cell(row, '', 'Actions').appendChild(group);
    registryAction(group, 'Unregister ' + entry.name, 'box-arrow-right', () => removeRegisteredBarangay(entry));
  });
  AdminUI.empty(body, 4, 'No registered barangays match your search.');
}

// Summary tiles above the table (all registered areas, not only the current search).
function showRegistryTotals() {
  const ready = !registryLoading && !registryFailure;
  const served = registryEntries.reduce((sum, entry) => sum + entry.customers, 0);
  document.getElementById('statServiceAreas').textContent = ready ? registryEntries.length : '—';
  document.getElementById('statCustomersServed').textContent = ready ? served.toLocaleString() : '—';
  document.getElementById('statEmptyAreas').textContent = ready
    ? registryEntries.filter((entry) => !entry.customers).length
    : '—';
}

async function loadBarangays() {
  const version = ++registryLoadVersion;
  registryLoading = true;
  registryFailure = '';
  if (!registryEntries.length) showBarangays();
  try {
    const entries = await BarangayAPI.list();
    if (version !== registryLoadVersion) return;
    registryEntries = entries;
  } catch (error) {
    if (version !== registryLoadVersion) return;
    registryEntries = [];
    registryFailure = error.message;
  } finally {
    if (version === registryLoadVersion) {
      registryLoading = false;
      showBarangays();
    }
  }
}

async function removeRegisteredBarangay(entry) {
  if (deletingBarangay) return;
  if (entry.customers)
    return showNotice(
      'Cannot unregister barangay',
      'This service area still has registered customers.',
    );
  deletingBarangay = true;
  document.querySelectorAll('#barangayRows .barangay-action').forEach((button) => {
    button.disabled = true;
  });
  try {
    if (
      !(await confirmAction(
        'Unregister barangay?',
        entry.name + ' will be unregistered and removed from service area selections. You can register it again later.',
        'Unregister barangay',
      ))
    )
      return;
    await BarangayAPI.remove(entry.id);
    // Keep the current table visible until the delete succeeds; no loading-row flash.
    registryEntries = registryEntries.filter((item) => item.id !== entry.id);
    showBarangays();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await showNotice(
      'Barangay unregistered successfully',
      entry.name + ' was removed from the registry.',
    );
  } catch (error) {
    await showNotice('Cannot unregister barangay', error.message);
  } finally {
    deletingBarangay = false;
    document.querySelectorAll('#barangayRows .barangay-action').forEach((button) => {
      button.disabled = false;
    });
  }
}

registrySearch.addEventListener('input', () => {
  registryPager.page = 1;
  showBarangays();
});
document.getElementById('retryBarangayList').addEventListener('click', loadBarangays);
AdminAuth.ready.then((user) => {
  if (user) loadBarangays();
});
