import { readFile } from 'node:fs/promises';

import { AppError } from '../utils/app-error.js';

const directory = JSON.parse(
  await readFile(new URL('../data/pio-duran-barangays.json', import.meta.url), 'utf8'),
);
const normalizeName = (value) => value.trim().replace(/\s+/g, ' ').toLowerCase();

export function resolveImportBarangay(value) {
  if (typeof value !== 'string' || value.trim().length > 100)
    throw new AppError('Enter a valid Pio Duran barangay name.', 400);
  const name = normalizeName(value).replace(/^(?:barangay|brgy\.?)\s+/, '');
  const official = directory.barangays.find((entry) =>
    [entry.name, entry.displayName].some(
      (candidate) => normalizeName(candidate).replace(/^barangay\s+/, '') === name,
    ),
  );
  if (!official) throw new AppError('Unknown Pio Duran barangay: ' + value.trim() + '.', 400);
  return {
    psgcCode: official.code,
    name: official.displayName,
    municipality: directory.municipality,
    province: directory.province,
  };
}

export function validateBarangayId(value) {
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d{0,19}$/.test(value) ||
    BigInt(value) > 18446744073709551615n
  ) {
    throw new AppError('Provide a valid barangay ID.', 400);
  }
  return value;
}

export function validateBarangay(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError('Provide valid barangay details.', 400);
  }
  const allowed = ['psgcCode', 'name', 'municipality', 'province'];
  if (Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new AppError('Unexpected barangay fields provided.', 400);
  }
  const { psgcCode, name, municipality = 'Pio Duran', province = 'Albay' } = body;
  if (typeof psgcCode !== 'string' || !/^0500513\d{3}$/.test(psgcCode.trim())) {
    throw new AppError('Provide a valid Pio Duran PSGC code.', 400);
  }
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
    throw new AppError('Barangay name must contain 1–100 characters.', 400);
  }
  if (
    typeof municipality !== 'string' ||
    municipality.trim() !== 'Pio Duran' ||
    typeof province !== 'string' ||
    province.trim() !== 'Albay'
  ) {
    throw new AppError('Only Pio Duran, Albay is supported.', 400);
  }
  const official = directory.barangays.find((entry) => entry.code === psgcCode.trim());
  if (
    !official ||
    ![official.name, official.displayName].some(
      (candidate) => normalizeName(candidate) === normalizeName(name),
    )
  ) {
    throw new AppError('Barangay code and name must match the Pio Duran directory.', 400);
  }
  return {
    psgcCode: official.code,
    name: official.displayName,
    municipality: directory.municipality,
    province: directory.province,
  };
}
