// Keep identifiers as text (so leading zeroes are not lost).
const Validation = {
  identifier(value) {
    return /^[A-Za-z0-9][A-Za-z0-9 /-]{0,59}$/.test(value);
  },
  money(value) {
    return /^\d+(\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value));
  },
  date(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  },
  phone(value) {
    // Philippine mobile numbers in local or international format.
    return /^(09\d{9}|\+639\d{9})$/.test(value);
  },
};
