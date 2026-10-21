// Keep database IDs and directory codes separate: writes target the database ID.
const BarangayAPI = {
  async list() {
    const rows = await AdminAPI.request('/barangays');
    if (!Array.isArray(rows)) throw new Error('The server returned an invalid barangay list.');
    return rows.map((row) => ({
      id: String(row.id),
      code: row.psgc_code,
      name: row.name,
      municipality: row.municipality,
      province: row.province,
      active: Number(row.is_active) === 1,
      customers: Number(row.customer_count || 0),
    }));
  },
  save(entry) {
    return AdminAPI.request('/barangays', {
      method: 'POST',
      body: {
        psgcCode: entry.code,
        name: entry.displayName,
        municipality: 'Pio Duran',
        province: 'Albay',
      },
    });
  },
  remove(id) {
    return AdminAPI.request('/barangays/' + encodeURIComponent(id), { method: 'DELETE' });
  },
};
