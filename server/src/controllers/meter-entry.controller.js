import { meterEntryService } from '../services/meter-entry.service.js';

export async function listMeterEntries(req, res) {
  const data = await meterEntryService.list(req.query.setupId);
  res.status(200).json({ success: true, data });
}

export async function saveMeterEntry(req, res) {
  const data = await meterEntryService.save(req.body, req.user.id);
  res.status(200).json({ success: true, data });
}
