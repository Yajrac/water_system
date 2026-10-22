let dashboardLoading = false;
async function startDashboard() {
  if (dashboardLoading) return;
  dashboardLoading = true;
  if (!(await AdminAuth.ready)) {
    dashboardLoading = false;
    return;
  }
  const button = document.getElementById('refreshDashboard');
  button.disabled = true;
  const yearSelect = document.getElementById('collectionsYear');
  yearSelect.disabled = true;
  AdminUI.message('');
  const containers = ['summary', 'collectionsChart', 'statusChart', 'consumptionChart'];
  const finish = containers.map((id) => {
    const container = document.getElementById(id);
    container.chartResizeObserver?.disconnect();
    container.replaceChildren();
    return Skeleton.start(
      container,
      id === 'summary' ? 'cards' : 'chart',
      id === 'summary' ? 8 : 1,
    );
  });
  try {
    const data = await AdminAPI.request(
      '/dashboard' + (yearSelect.value ? '?year=' + encodeURIComponent(yearSelect.value) : ''),
    );
    finish.forEach((stop) => stop());
    const selected = yearSelect.value;
    yearSelect.replaceChildren(new Option(String(data.currentYear), ''));
    data.availableYears
      .filter((year) => year !== data.currentYear)
      .forEach((year) => yearSelect.add(new Option(String(year), String(year))));
    yearSelect.value = selected;
    document.getElementById('collectionsTitle').textContent =
      'Monthly collections - ' + data.period.year;
    renderDashboard(data);
    renderDashboardCharts(data);
  } catch (error) {
    finish.forEach((stop) => stop());
    containers.forEach((id) => document.getElementById(id).replaceChildren());
    AdminUI.message(error.message + ' Select Refresh to try again.');
  } finally {
    dashboardLoading = false;
    button.disabled = false;
    yearSelect.disabled = false;
  }
}
document.getElementById('refreshDashboard').addEventListener('click', startDashboard);
document.getElementById('collectionsYear').addEventListener('change', startDashboard);
startDashboard();
