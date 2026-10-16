// Load the JSON fixtures before drawing charts; saved records still work offline.
async function startDashboard() {
  try { await fetchSampleCustomers(); }
  catch { AdminUI.message('Sample chart data could not load. Showing saved records. Use a local web preview to load the JSON.'); }
  renderDashboard();
  renderDashboardCharts();
}
startDashboard();
