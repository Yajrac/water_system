const settingsRecords = WaterStore.load();
const officeForm = document.getElementById('officeForm');
['name', 'address', 'contact'].forEach((name) => {
  officeForm.elements[name].value = settingsRecords.office[name];
});
officeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = officeForm.elements.name.value.trim();
  if (!name) return AdminUI.message('Enter a utility name.');
  settingsRecords.office = {
    name,
    address: officeForm.elements.address.value.trim(),
    contact: officeForm.elements.contact.value.trim(),
  };
  WaterStore.save(settingsRecords);
  showNotice('Saved successfully', 'Office details have been updated.');
});
