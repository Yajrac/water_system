import { billingSetupService } from '../services/billing-setup.service.js';

export async function listBillingSetups(req, res) {
  const data = await billingSetupService.list(req.query.month);
  res.status(200).json({ success: true, data });
}

export async function saveBillingSetup(req, res) {
  const data = await billingSetupService.save(req.body, req.user.id);
  res.status(200).json({ success: true, data });
}
