import * as service from '../services/customer.service.js';
export async function previewImport(req, res) {
  res.json({ success: true, data: await service.previewCustomerImport(req.body) });
}

export async function list(req, res) {
  res.json({ success: true, data: await service.getCustomers(req.query) });
}
export async function profile(req, res) {
  res.json({ success: true, data: await service.getCustomer(req.params.id) });
}
export async function create(req, res) {
  res.status(201).json({ success: true, data: await service.saveCustomer(req.body, req.user.id) });
}
export async function update(req, res) {
  res.json({
    success: true,
    data: await service.saveCustomer(req.body, req.user.id, req.params.id),
  });
}
export async function importRecords(req, res) {
  res
    .status(201)
    .json({ success: true, data: await service.importCustomers(req.body, req.user.id) });
}
export async function status(req, res) {
  res.json({
    success: true,
    data: await service.changeCustomerStatus(req.params.id, req.body, req.user.id),
  });
}
