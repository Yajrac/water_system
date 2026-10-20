import {
  findAllBarangays,
} from '../models/barangay.model.js';

export async function getBarangays() {
  return findAllBarangays();
}