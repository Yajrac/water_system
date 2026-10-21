import { billService } from '../services/bill.service.js';
export async function previewBills(req, res) {
  res.json({ success: true, data: await billService.preview(req.body) });
}
export async function generateBills(req, res) {
  res.status(201).json({ success: true, data: await billService.generate(req.body, req.user.id) });
}
export async function listBills(req, res) {
  res.json({ success: true, data: await billService.list(req.query) });
}
