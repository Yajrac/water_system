const barangayForm = document.getElementById('barangayForm');
const barangayChoice = document.getElementById('barangayChoice');
const barangaySearchChoice = document.getElementById('barangaySearchChoice');
const barangayOptions = document.getElementById('barangayOptions');
let registeredBarangays = [];
let activeOption = -1;
function closeBarangayOptions() {
  barangayOptions.hidden = true;
  barangaySearchChoice.setAttribute('aria-expanded', 'false');
  barangaySearchChoice.removeAttribute('aria-activedescendant');
}
function renderBarangayOptions(query = '') {
  barangayOptions.replaceChildren();
  activeOption = -1;
  barangaySearchChoice.removeAttribute('aria-activedescendant');
  const matches = barangayDirectory
    .filter((item) =>
      (item.name + ' ' + item.displayName).toLowerCase().includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  matches.forEach((item) => {
    const used = registeredBarangays.some((entry) => entry.code === item.code);
    const unavailable = used && item.code !== originalBarangayCode;
    const option = document.createElement('li');
    option.id = 'barangay-option-' + item.code;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-disabled', String(unavailable));
    option.setAttribute('aria-selected', String(barangayChoice.value === item.code));
    const name = document.createElement('span');
    name.textContent = item.displayName;
    option.appendChild(name);
    if (used) {
      const badge = document.createElement('span');
      badge.className = 'payment-status status-paid';
      badge.textContent = 'Registered';
      option.appendChild(badge);
    }
    option.addEventListener('pointerdown', (event) => event.preventDefault());
    option.addEventListener('click', () => {
      if (!unavailable) selectBarangay(item);
    });
    option.dataset.code = item.code;
    barangayOptions.appendChild(option);
  });
  if (!matches.length) {
    const empty = document.createElement('li');
    empty.className = 'barangay-no-results';
    empty.textContent = 'No matching barangays.';
    barangayOptions.appendChild(empty);
  }
  barangayOptions.hidden = false;
  barangaySearchChoice.setAttribute('aria-expanded', 'true');
}
function selectBarangay(item) {
  barangayChoice.value = item.code;
  barangaySearchChoice.value = item.displayName;
  barangaySearchChoice.setCustomValidity('');
  closeBarangayOptions();
}
barangaySearchChoice.addEventListener('focus', () => renderBarangayOptions());
barangaySearchChoice.addEventListener('input', () => {
  barangayChoice.value = '';
  barangaySearchChoice.setCustomValidity('Select a barangay from the matching results.');
  renderBarangayOptions(barangaySearchChoice.value);
});
barangaySearchChoice.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeBarangayOptions();
    return;
  }
  if (event.key === 'Tab') {
    closeBarangayOptions();
    return;
  }
  if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
  if (barangayOptions.hidden && event.key === 'Enter') return;
  event.preventDefault();
  if (barangayOptions.hidden) renderBarangayOptions(barangaySearchChoice.value);
  const options = Array.from(
    barangayOptions.querySelectorAll('[role="option"][aria-disabled="false"]'),
  );
  if (!options.length) return;
  if (event.key === 'Enter') {
    if (activeOption >= 0)
      selectBarangay(
        barangayDirectory.find((item) => item.code === options[activeOption].dataset.code),
      );
    return;
  }
  activeOption =
    event.key === 'ArrowDown'
      ? (activeOption + 1) % options.length
      : activeOption <= 0
        ? options.length - 1
        : activeOption - 1;
  options.forEach((option, index) =>
    option.classList.toggle('is-highlighted', index === activeOption),
  );
  barangaySearchChoice.setAttribute('aria-activedescendant', options[activeOption].id);
  options[activeOption].scrollIntoView({ block: 'nearest' });
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.barangay-combobox')) closeBarangayOptions();
});
const saveBarangay = document.getElementById('saveBarangay');
const retryBarangays = document.getElementById('retryBarangays');
const originalBarangayCode = new URLSearchParams(location.search).get('code') || '';
let barangayDirectory = [];
let savingBarangay = false;
async function loadBarangayChoices() {
  saveBarangay.disabled = true;
  barangayChoice.disabled = true;
  barangaySearchChoice.disabled = true;
  retryBarangays.hidden = true;
  document.getElementById('barangayDirectoryStatus').textContent = 'Loading Pio Duran barangays...';
  try {
    const response = await fetch('../data/pio-duran-barangays.json');
    if (!response.ok) throw new Error('The barangay directory could not be loaded.');
    const data = await response.json();
    if (
      data.municipality !== 'Pio Duran' ||
      data.province !== 'Albay' ||
      !Array.isArray(data.barangays) ||
      !data.barangays.length ||
      data.barangays.some(
        (item) => !/^0500513\d{3}$/.test(item.code) || !item.name || !item.displayName,
      )
    )
      throw new Error('The barangay directory is invalid.');
    barangayDirectory = data.barangays;
    const registry = WaterStore.barangayRegistry(WaterStore.load());
    registeredBarangays = registry;
    if (originalBarangayCode && !registry.some((item) => item.code === originalBarangayCode))
      throw new Error('The barangay entry no longer exists. Return to the registry.');
    barangayChoice.value = originalBarangayCode;
    barangaySearchChoice.value =
      barangayDirectory.find((item) => item.code === originalBarangayCode)?.displayName || '';
    barangaySearchChoice.disabled = false;
    barangayChoice.disabled = false;
    saveBarangay.disabled = false;
    document.getElementById('barangayDirectoryStatus').textContent =
      'Official Pio Duran choices from the PSA PSGC directory.';
    if (originalBarangayCode) {
      document.getElementById('barangayFormTitle').textContent = 'Edit Barangay';
      saveBarangay.textContent = 'Save changes';
    }
  } catch (error) {
    document.getElementById('barangayDirectoryStatus').textContent =
      error.message + ' Use a local web preview if opening files directly.';
    retryBarangays.hidden = false;
  }
}
barangayForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (savingBarangay) return;
  savingBarangay = true;
  saveBarangay.disabled = true;
  try {
    const records = WaterStore.load();
    const snapshot = JSON.stringify(records);
    const entry = BarangayRegistry.save(
      records,
      barangayDirectory,
      barangayChoice.value,
      originalBarangayCode,
    );
    const accepted = await confirmAction(
      originalBarangayCode ? 'Save barangay changes?' : 'Save barangay?',
      'Barangay: ' + entry.name + '\nMunicipality: Pio Duran\nProvince: Albay',
      originalBarangayCode ? 'Save changes' : 'Save barangay',
    );
    if (!accepted) return;
    if (JSON.stringify(WaterStore.load()) !== snapshot) {
      throw new Error('Records changed while confirming. Please review the barangay and try again.');
    }
    WaterStore.save(records);
    await showNotice('Barangay saved', entry.name + '\nPio Duran, Albay');
    location.href = 'barangays.html';
  } catch (error) {
    AdminUI.message(error.message);
  } finally {
    savingBarangay = false;
    saveBarangay.disabled = false;
  }
});
retryBarangays.addEventListener('click', loadBarangayChoices);
loadBarangayChoices();
