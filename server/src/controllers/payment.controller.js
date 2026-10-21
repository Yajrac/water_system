import { paymentService } from '../services/payment.service.js';
export async function listPayments(req, res) {
  res.json({ success: true, data: await paymentService.list(req.query) });
}
export async function showReceipt(req, res) {
  res.json({ success: true, data: await paymentService.receipt(req.params.id) });
}
export async function recordPayment(req, res) {
  res.json({ success: true, data: await paymentService.save(req.body, req.user.id) });
}
