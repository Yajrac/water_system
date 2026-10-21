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
  AdminUI.message('');
  const containers = ['summary', 'collectionsChart', 'statusChart', 'consumptionChart'];
  const finish = containers.map((id) => {
    const container = document.getElementById(id);
    container.chartResizeObserver?.disconnect();
    container.replaceChildren();
    return Skeleton.start(container, id === 'summary' ? 'cards' : 'chart', id === 'summary' ? 8 : 1);
  });
  try {
    const data = await AdminAPI.request('/dashboard');
    finish.forEach((stop) => stop());
    renderDashboard(data);
    renderDashboardCharts(data);
  } catch (error) {
    finish.forEach((stop) => stop());
    containers.forEach((id) => document.getElementById(id).replaceChildren());
    AdminUI.message(error.message + ' Select Refresh to try again.');
  } finally {
    dashboardLoading = false;
    button.disabled = false;
  }
}
document.getElementById('refreshDashboard').addEventListener('click', startDashboard);
startDashboard();
