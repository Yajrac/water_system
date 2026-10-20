import { getBarangays } from '../services/barangay.service.js';

export async function listBarangays(req, res) {
  const barangays = await getBarangays();

  res.status(200).json({
    success: true,
    data: barangays,
  });
}