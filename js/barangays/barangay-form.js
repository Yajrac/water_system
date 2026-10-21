const addBarangayDialog = document.getElementById('addBarangayDialog');
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
    const unavailable = used;
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
let choicesLoadVersion = 0;
let barangayDirectory = [];
let savingBarangay = false;
async function loadBarangayChoices() {
  const version = ++choicesLoadVersion;
  saveBarangay.disabled = true;
  barangayChoice.disabled = true;
  barangaySearchChoice.disabled = true;
  retryBarangays.hidden = true;
  document.getElementById('barangayDirectoryStatus').textContent = 'Loading Pio Duran barangays...';
  try {
    const [response, registry] = await Promise.all([
      fetch('../data/pio-duran-barangays.json'),
      BarangayAPI.list(),
    ]);
    if (version !== choicesLoadVersion) return;
    if (!response.ok) throw new Error('The barangay directory could not be loaded.');
    const data = await response.json();
    if (version !== choicesLoadVersion) return;
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
    registeredBarangays = registry;
    barangayChoice.value = '';
    barangaySearchChoice.value = '';
    barangaySearchChoice.disabled = false;
    barangayChoice.disabled = false;
    saveBarangay.disabled = false;
    document.getElementById('barangayDirectoryStatus').textContent =
      'Official Pio Duran choices from the PSA PSGC directory.';
  } catch (error) {
    if (version !== choicesLoadVersion) return;
    document.getElementById('barangayDirectoryStatus').textContent = error.message;
    retryBarangays.hidden = false;
  }
}
barangayForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (savingBarangay) return;
  savingBarangay = true;
  saveBarangay.disabled = true;
  try {
    const entry = barangayDirectory.find((item) => item.code === barangayChoice.value);
    if (!entry) throw new Error('Choose a barangay from the Pio Duran directory.');
    const accepted = await confirmAction(
      'Save barangay?',
      'Barangay: ' + entry.displayName + '\nMunicipality: Pio Duran\nProvince: Albay',
      'Save barangay',
    );
    if (!accepted) return;
    await BarangayAPI.save(entry);
    if (addBarangayDialog) {
      addBarangayDialog.close();
      await loadBarangays();
    }
    await showNotice('Barangay saved successfully', entry.displayName + '\nPio Duran, Albay');
    if (!addBarangayDialog) location.href = 'barangays.html';
  } catch (error) {
    if (addBarangayDialog) {
      document.getElementById('barangayDirectoryStatus').textContent = error.message;
    } else AdminUI.message(error.message);
  } finally {
    savingBarangay = false;
    saveBarangay.disabled = false;
  }
});
retryBarangays.addEventListener('click', loadBarangayChoices);
function openBarangayModal() {
  if (savingBarangay) return;
  barangayForm.reset();
  barangaySearchChoice.setCustomValidity('');
  closeBarangayOptions();
  const heading = document.getElementById('barangayFormTitle');
  const icon = document.createElement('i');
  icon.className = 'modal-heading-icon bi bi-geo-alt-fill';
  icon.setAttribute('aria-hidden', 'true');
  heading.replaceChildren(icon, document.createTextNode('Add Barangay'));
  saveBarangay.textContent = 'Save barangay';
  addBarangayDialog.showModal();
  loadBarangayChoices();
}
if (addBarangayDialog) {
  document.getElementById('openAddBarangay').addEventListener('click', () => openBarangayModal());
  for (const id of ['closeAddBarangay', 'cancelAddBarangay']) {
    document.getElementById(id).addEventListener('click', () => {
      if (!savingBarangay) {
        choicesLoadVersion++;
        addBarangayDialog.close();
      }
    });
  }
  addBarangayDialog.addEventListener('cancel', (event) => {
    if (savingBarangay) event.preventDefault();
    else choicesLoadVersion++;
  });
} else
  AdminAuth.ready.then((user) => {
    if (user) loadBarangayChoices();
  });
