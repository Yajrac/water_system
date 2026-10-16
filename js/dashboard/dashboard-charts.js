function renderDashboardCharts() {
  // Six calendar months ending this month, using Philippine dates from the store.
  const chartRecords = WaterStore.load();
  const chartToday = WaterStore.today();
  const monthKeys = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      Date.UTC(Number(chartToday.slice(0, 4)), Number(chartToday.slice(5, 7)) - 6 + index, 1),
    );
    return date.toISOString().slice(0, 7);
  });
  const monthLabel = (key) =>
    new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(
      new Date(key + '-01T00:00:00Z'),
    );
  function chartNode(tag, attributes = {}, text = '') {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    node.textContent = text;
    return node;
  }
  function chartTable(container, labels, values, format) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'View exact values';
    const table = document.createElement('table');
    labels.forEach((label, index) => {
      const row = table.insertRow();
      const heading = document.createElement('th');
      heading.scope = 'row';
      heading.textContent = label;
      row.appendChild(heading);
      row.insertCell().textContent = format(values[index]);
    });
    details.append(summary, table);
    container.appendChild(details);
  }
  function renderMonthlyChart(id, title, values, format, line = false) {
    const container = document.getElementById(id);
    const svg = chartNode('svg', { viewBox: '0 0 560 260', role: 'img', 'aria-label': title });
    svg.appendChild(chartNode('title', {}, title));
    const defs = chartNode('defs');
    const colors = [
      ['#38d9ec', '#087bb5'],
      ['#9292ff', '#5450cf'],
      ['#fb83b2', '#ce3971'],
    ];
    colors.forEach(([top, bottom], index) => {
      const gradient = chartNode('linearGradient', {
        id: id + '-gradient-' + index,
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 1,
      });
      gradient.append(
        chartNode('stop', { offset: '0%', 'stop-color': top }),
        chartNode('stop', { offset: '100%', 'stop-color': bottom }),
      );
      defs.appendChild(gradient);
    });
    svg.appendChild(defs);
    const maximum = Math.max(...values, 1) * 1.2;
    const points = [];
    for (let tick = 0; tick <= 4; tick++) {
      const y = 210 - tick * 45;
      svg.appendChild(chartNode('line', { x1: 90, y1: y, x2: 540, y2: y, class: 'chart-grid' }));
      svg.appendChild(
        chartNode(
          'text',
          { x: 80, y: y + 4, 'text-anchor': 'end', class: 'chart-label' },
          format((maximum * tick) / 4),
        ),
      );
    }
    values.forEach((value, index) => {
      const x = 125 + index * 76;
      const y = 210 - (value / maximum) * 180;
      points.push(x + ',' + y);
      const mark = chartNode(
        line ? 'circle' : 'rect',
        line
          ? { cx: x, cy: y, r: 5, class: 'chart-point' }
          : { x: x - 19, y, width: 38, height: 210 - y, rx: 4, class: 'chart-bar' },
      );
      if (!line) mark.setAttribute('fill', 'url(#' + id + '-gradient-' + (index % 3) + ')');
      mark.appendChild(chartNode('title', {}, monthLabel(monthKeys[index]) + ': ' + format(value)));
      svg.appendChild(mark);
      svg.appendChild(
        chartNode(
          'text',
          { x, y: y - 12, 'text-anchor': 'middle', class: 'chart-value' },
          line ? Number(value.toFixed(1)) : Math.round(value).toLocaleString(),
        ),
      );
      svg.appendChild(
        chartNode(
          'text',
          { x, y: 239, 'text-anchor': 'middle', class: 'chart-label' },
          monthLabel(monthKeys[index]),
        ),
      );
    });
    if (line) {
      const path = chartNode('polyline', { points: points.join(' '), class: 'chart-line' });
      svg.insertBefore(path, svg.querySelector('.chart-point'));
    }
    container.appendChild(svg);
    const total = document.createElement('p');
    total.className = 'chart-period-total';
    total.textContent = 'Six-month total: ' + format(values.reduce((sum, value) => sum + value, 0));
    container.appendChild(total);
    if (!values.some((value) => value > 0)) {
      const empty = document.createElement('p');
      empty.className = 'chart-caption';
      empty.textContent = 'No records for these months yet.';
      container.appendChild(empty);
    }
    chartTable(container, monthKeys.map(monthLabel), values, format);
  }
  const collections = monthKeys.map((month) =>
    chartRecords.payments
      .filter((payment) => payment.date?.slice(0, 7) === month)
      .reduce((sum, payment) => sum + payment.amount, 0),
  );
  const consumption = monthKeys.map((month) =>
    chartRecords.bills
      .filter((bill) => bill.cycle === month)
      .reduce((sum, bill) => sum + (Number.isFinite(bill.consumption) ? bill.consumption : 0), 0),
  );
  renderMonthlyChart(
    'collectionsChart',
    'Monthly collections — last six months',
    collections,
    (value) => WaterStore.money(value),
  );
  renderConsumptionChart(document.getElementById('consumptionChart'), monthKeys, consumption);
  chartTable(
    document.getElementById('consumptionChart'),
    monthKeys.map(monthLabel),
    consumption,
    (value) => Number(value.toFixed(3)).toLocaleString() + ' m³',
  );

  const statusLabels = ['Paid', 'Unpaid', 'Overdue'];
  const counts = statusLabels.map(
    (status) =>
      chartRecords.bills.filter((bill) => WaterStore.status(bill, chartRecords) === status).length,
  );
  const statusContainer = document.getElementById('statusChart');
  const pie = chartNode('svg', {
    viewBox: '0 0 260 260',
    role: 'img',
    'aria-label': counts.map((count, index) => statusLabels[index] + ': ' + count).join(', '),
  });
  pie.appendChild(chartNode('title', {}, 'Bill status across all periods'));
  if (!chartRecords.bills.length) {
    pie.appendChild(chartNode('circle', { cx: 130, cy: 130, r: 108, class: 'chart-pie-empty' }));
    pie.appendChild(
      chartNode(
        'text',
        { x: 130, y: 134, 'text-anchor': 'middle', class: 'chart-label' },
        'No bills yet',
      ),
    );
  }
  let angle = -Math.PI / 2;
  counts.forEach((count, index) => {
    if (!count) return;
    const fraction = count / chartRecords.bills.length;
    const end = angle + fraction * Math.PI * 2;
    const point = (a) => [130 + 108 * Math.cos(a), 130 + 108 * Math.sin(a)];
    const startPoint = point(angle),
      endPoint = point(end);
    const slice =
      fraction === 1
        ? chartNode('circle', { cx: 130, cy: 130, r: 108 })
        : chartNode('path', {
            d:
              'M130 130 L' +
              startPoint.join(' ') +
              ' A108 108 0 ' +
              (fraction > 0.5 ? 1 : 0) +
              ' 1 ' +
              endPoint.join(' ') +
              ' Z',
          });
    slice.setAttribute('class', 'chart-slice chart-' + statusLabels[index].toLowerCase());
    slice.appendChild(
      chartNode(
        'title',
        {},
        statusLabels[index] + ': ' + count + ' (' + Math.round(fraction * 100) + '%)',
      ),
    );
    pie.appendChild(slice);
    if (fraction >= 0.08) {
      const mid = angle + fraction * Math.PI;
      pie.appendChild(
        chartNode(
          'text',
          {
            x: 130 + 69 * Math.cos(mid),
            y: 135 + 69 * Math.sin(mid),
            'text-anchor': 'middle',
            class: 'chart-pie-label',
          },
          Math.round(fraction * 100) + '%',
        ),
      );
    }
    angle = end;
  });
  statusContainer.appendChild(pie);
  const billCount = document.createElement('p');
  billCount.className = 'chart-period-total';
  billCount.textContent = chartRecords.bills.length + ' total bills · All periods';
  statusContainer.appendChild(billCount);
  const legend = document.createElement('ul');
  legend.className = 'chart-legend';
  statusLabels.forEach((status, index) => {
    const item = document.createElement('li');
    const badge = document.createElement('span');
    badge.className = 'payment-status status-' + status.toLowerCase();
    badge.textContent = status;
    const count = document.createElement('strong');
    count.textContent =
      counts[index] +
      ' bills · ' +
      (chartRecords.bills.length
        ? Math.round((counts[index] / chartRecords.bills.length) * 100)
        : 0) +
      '%';
    item.append(badge, count);
    legend.appendChild(item);
  });
  statusContainer.appendChild(legend);
}
