import { getDashboard } from '../services/dashboard.service.js';
export async function dashboard(req, res) {
  res.json({ success: true, data: await getDashboard(req.query) });
}
