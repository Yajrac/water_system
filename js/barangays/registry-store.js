// Registry changes retain customer history and accept only directory selections.
const BarangayRegistry = {
  customerCount(records, name) {
    return records.customers.filter(
      (customer) =>
        WaterStore.normalizeBarangay(customer.barangay) === WaterStore.normalizeBarangay(name),
    ).length;
  },
  save(records, directory, code, originalCode = '') {
    const selected = directory.find((item) => item.code === code);
    if (!selected || !/^0500513\d{3}$/.test(code))
      throw new Error('Choose a barangay from the Pio Duran directory.');
    const registry = WaterStore.barangayRegistry(records);
    const original = originalCode ? registry.find((item) => item.code === originalCode) : null;
    if (originalCode && !original) throw new Error('This registry entry no longer exists.');
    if (registry.some((item) => item.code === code && item !== original))
      throw new Error('This barangay is already registered.');
    if (original && original.code !== code && this.customerCount(records, original.name))
      throw new Error(
        'This barangay has customer records and cannot be replaced. Add the other barangay separately.',
      );
    const entry = {
      code,
      name: selected.displayName,
      officialName: selected.name,
      municipality: 'Pio Duran',
      province: 'Albay',
    };
    if (original) registry[registry.indexOf(original)] = entry;
    else registry.push(entry);
    return entry;
  },
  remove(records, code) {
    const registry = WaterStore.barangayRegistry(records);
    const entry = registry.find((item) => item.code === code);
    if (!entry) throw new Error('This registry entry no longer exists.');
    if (this.customerCount(records, entry.name))
      throw new Error('This barangay has customer records and cannot be deleted.');
    records.barangays = registry.filter((item) => item.code !== code);
  },
};
