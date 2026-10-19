// Consumer events stay separate from actions performed through the admin website.
function setupActivityTable({ searchId, dateId, rowsId, pagerId, clearId, consumer }) {
  const search = document.getElementById(searchId),
    date = document.getElementById(dateId);
  const pager = createPagination(pagerId, render);
  const dayFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  function render() {
    const records = WaterStore.load();
    const events = consumer
      ? [
          ...(records.consumerActivityLogs || []),
          ...(records.activityLogs || []).filter((log) => log.actorType === 'consumer'),
        ]
      : (records.activityLogs || []).filter((log) => log.actorType !== 'consumer');
    const query = search.value.trim().toLowerCase();
    const logs = events
      .filter(
        (log) =>
          Number.isFinite(Date.parse(log.timestamp)) &&
          (!date.value || dayFormat.format(new Date(log.timestamp)) === date.value) &&
          [log.action, log.target, log.details, log.actor].join(' ').toLowerCase().includes(query),
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    pager.update(logs.length);
    const body = document.getElementById(rowsId);
    body.replaceChildren();
    pager.items(logs).forEach((log) => {
      const row = body.insertRow();
      const stamp = new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Manila',
      }).format(new Date(log.timestamp));
      [stamp, log.action, log.target, log.details, log.actor].forEach((value, index) =>
        AdminUI.cell(
          row,
          value,
          ['Date / time', 'Action', 'Account / record', 'Details', consumer ? 'Consumer' : 'Admin'][
            index
          ],
        ),
      );
    });
    AdminUI.empty(
      body,
      5,
      consumer
        ? 'No consumer activity logs match your filters.'
        : 'No admin activity logs match your filters.',
    );
  }
  const refresh = () => {
    pager.page = 1;
    render();
  };
  search.addEventListener('input', refresh);
  date.addEventListener('change', refresh);
  document.getElementById(clearId).addEventListener('click', () => {
    search.value = '';
    date.value = '';
    refresh();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === WaterStore.key) render();
  });
  officeForm.addEventListener('submit', render);
  render();
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
