const registrySearch = document.getElementById('barangaySearch');
const registryPager = createPagination('barangayPagination', showBarangays);
function registryAction(parent, title, path, callback, href) {
  const button = document.createElement('button');
  button.type = 'button';
  button.addEventListener('click', href
    ? () => openBarangayModal(new URL(href, location.href).searchParams.get('code'))
    : callback);
  button.className = 'btn barangay-action' + (href ? ' action-edit' : '');
  button.title = title;
  button.setAttribute('aria-label', title);
  const icon = document.createElement('i');
  icon.className = 'bi bi-' + (href ? 'pencil-square' : 'trash');
  icon.setAttribute('aria-hidden', 'true');
  button.appendChild(icon);
  parent.appendChild(button);
}
function showBarangays() {
  const records = WaterStore.load();
  const registry = WaterStore.barangayRegistry(records);
  const query = registrySearch.value.trim().toLowerCase();
  const matches = registry.filter((item) =>
    [item.name, item.officialName, item.municipality, item.province]
      .join(' ')
      .toLowerCase()
      .includes(query),
  );
  const body = document.getElementById('barangayRows');
  body.replaceChildren();
  registryPager.update(matches.length);
  registryPager.items(matches).forEach((entry) => {
    const row = body.insertRow();
    [
      entry.name,
      entry.municipality,
      entry.province,
      BarangayRegistry.customerCount(records, entry.name),
    ].forEach((value, index) =>
      AdminUI.cell(row, value, ['Barangay', 'Municipality', 'Province', 'Customers'][index]),
    );
    const badge = document.createElement('span');
    badge.className = 'payment-status status-paid registry-status';
    badge.textContent = 'Registered';
    row.cells[0].appendChild(badge);
    const actions = AdminUI.cell(row, '', 'Actions');
    const group = document.createElement('div');
    group.className = 'barangay-actions';
    actions.appendChild(group);
    registryAction(
      group,
      'Edit ' + entry.name,
      'M15 5l4 4M4 20l5-1L20 8a3 3 0 0 0-4-4L5 15z',
      null,
      'barangay-form.html?code=' + encodeURIComponent(entry.code),
    );
    registryAction(
      group,
      'Delete ' + entry.name,
      'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
      async () => {
        if (BarangayRegistry.customerCount(WaterStore.load(), entry.name))
          return showNotice(
            'Barangay in use',
            'This barangay has customer records and cannot be deleted.',
          );
        const accepted = await confirmAction(
          'Delete barangay?',
          entry.name + ' will be removed from the service registry and new-customer choices.',
          'Delete barangay',
        );
        if (!accepted) return;
        try {
          const latest = WaterStore.load();
          BarangayRegistry.remove(latest, entry.code);
          WaterStore.save(latest);
          showBarangays();
          AdminUI.message('Barangay removed.');
        } catch (error) {
          AdminUI.message(error.message);
        }
      },
    );
  });
  AdminUI.empty(body, 5, 'No registered barangays match your search.');
  document.getElementById('barangayCount').textContent = registry.length + ' registered barangays';
}
registrySearch.addEventListener('input', () => {
  registryPager.page = 1;
  showBarangays();
});
showBarangays();
