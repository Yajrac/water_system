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
  if (registryLoading || registryFailure) {
    AdminUI.empty(body, 5, registryLoading ? 'Loading barangays...' : registryFailure);
    document.getElementById('retryBarangayList').hidden = !registryFailure;
    return;
  }
  document.getElementById('retryBarangayList').hidden = true;
  registryPager.items(matches).forEach((entry) => {
    const row = body.insertRow();
    [entry.name, entry.municipality, entry.province, entry.customers].forEach((value, index) =>
      AdminUI.cell(row, value, ['Barangay', 'Municipality', 'Province', 'Customers'][index]),
    );
    const group = document.createElement('div');
    group.className = 'barangay-actions';
    AdminUI.cell(row, '', 'Actions').appendChild(group);
    registryAction(group, 'Unregister ' + entry.name, 'box-arrow-right', () => removeRegisteredBarangay(entry));
  });
  AdminUI.empty(body, 5, 'No registered barangays match your search.');
}

async function loadBarangays() {
  const version = ++registryLoadVersion;
  registryLoading = true;
  registryFailure = '';
  showBarangays();
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
