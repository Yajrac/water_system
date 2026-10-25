// Read audit records from the API; never substitute browser history.
function setupActivityTable({ searchId, dateId, rowsId, pagerId, clearId, consumer }) {
  const search = document.getElementById(searchId);
  const date = document.getElementById(dateId);
  const body = document.getElementById(rowsId);
  const pager = createPagination(pagerId, render);
  const container = document.getElementById(pagerId);
  let version = 0,
    timer;
  const stampFormat = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  });
  function pending() {
    if (!body.children.length) AdminUI.loading(body, 5, 'Loading activity logs...');
    container.querySelectorAll('button').forEach((button) => {
      button.disabled = true;
    });
  }
  async function render() {
    const request = ++version;
    pending();
    const query = new URLSearchParams({
      role: consumer ? 'consumer' : 'admin',
      page: pager.page,
      search: search.value.trim(),
      date: date.value,
    });
    try {
      const result = await AdminAPI.request('/activity-logs?' + query);
      if (request !== version) return;
      pager.page = result.pagination.page;
      pager.update(result.pagination.total);
      body.replaceChildren();
      for (const log of result.logs) {
        const row = body.insertRow();
        const target = [log.entityType, log.entityId ? '#' + log.entityId : '']
          .filter(Boolean)
          .join(' ');
        [
          stampFormat.format(new Date(log.timestamp)),
          log.action,
          target || '?',
          log.details,
          log.actor,
        ].forEach((value, index) =>
          AdminUI.cell(
            row,
            value,
            [
              'Date / time',
              'Action',
              'Account / record',
              'Details',
              consumer ? 'Consumer' : 'Admin',
            ][index],
          ),
        );
      }
      AdminUI.empty(body, 5, 'No activity logs match your filters.');
    } catch (error) {
      if (request !== version) return;
      pager.page = 1;
      pager.update(0);
      body.replaceChildren();
      AdminUI.empty(body, 5, error.message);
    }
  }
  function refresh() {
    ++version;
    clearTimeout(timer);
    pager.page = 1;
    pending();
    timer = setTimeout(render, 300);
  }
  search.addEventListener('input', refresh);
  date.addEventListener('change', refresh);
  document.getElementById(clearId).addEventListener('click', () => {
    search.value = '';
    date.value = '';
    refresh();
  });
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.className = 'btn';
  reload.textContent = 'Refresh logs';
  document.getElementById(clearId).after(reload);
  reload.addEventListener('click', () => {
    clearTimeout(timer);
    render();
  });
  AdminAuth.ready.then((user) => {
    if (user && !user.mustChangePassword) render();
  });
  document.addEventListener('admin:refresh-content', (event) => {
    clearTimeout(timer);
    event.detail.tasks.push(render());
  });
}
setupActivityTable({
  searchId: 'activitySearch',
  dateId: 'activityDate',
  rowsId: 'activityRows',
  pagerId: 'activityPagination',
  clearId: 'clearActivityFilters',
  consumer: false,
});
setupActivityTable({
  searchId: 'consumerActivitySearch',
  dateId: 'consumerActivityDate',
  rowsId: 'consumerActivityRows',
  pagerId: 'consumerActivityPagination',
  clearId: 'clearConsumerActivityFilters',
  consumer: true,
});
