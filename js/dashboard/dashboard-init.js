// Load the JSON fixtures before drawing charts; saved records still work offline.
async function startDashboard() {
  const finish = [
    Skeleton.start(document.getElementById('summary'), 'cards'),
    ...['collectionsChart', 'statusChart', 'consumptionChart'].map((id) =>
      Skeleton.start(document.getElementById(id), 'chart', 1),
    ),
  ];
  try {
    await fetchSampleCustomers();
  } catch {
    AdminUI.message(
      'Sample chart data could not load. Showing saved records. Use a local web preview to load the JSON.',
    );
  } finally {
    finish.forEach((stop) => stop());
  }
  renderDashboard();
  renderDashboardCharts();
}
startDashboard();
