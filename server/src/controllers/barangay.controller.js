import { addBarangay, getBarangays, removeBarangay } from '../services/barangay.service.js';

export async function listBarangays(req, res) {
  const barangays = await getBarangays();

  res.status(200).json({
    success: true,
    data: barangays,
  });
}

export async function registerBarangay(req, res) {
  const barangay = await addBarangay(req.body, req.user.id);
  res.status(201).json({ success: true, data: barangay });
}

export async function unregisterBarangay(req, res) {
  const result = await removeBarangay(req.params.id, req.user.id);
  res.status(200).json({ success: true, data: result });
}
