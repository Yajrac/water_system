function renderDashboardCharts(data) {
  for (const id of ['collectionsChart', 'statusChart', 'consumptionChart']) {
    const container = document.getElementById(id);
    container.chartResizeObserver?.disconnect();
    container.replaceChildren();
  }
  const monthKeys = data.period.months;
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
  function renderMonthlyChart(
    id,
    title,
    values,
    format,
    line = false,
    labels = monthKeys.map(monthLabel),
  ) {
    const container = document.getElementById(id);
    const availableWidth = Math.max(0, container.clientWidth - 44);
    const chartWidth = Math.max(
      560,
      110 + values.length * 90,
      id === 'consumptionChart' ? availableWidth : 0,
    );
    const svg = chartNode('svg', {
      viewBox: '0 0 ' + chartWidth + ' 260',
      role: 'img',
      'aria-label': title,
    });
    if (labels.length > 6) {
      svg.style.minWidth = chartWidth + 'px';
      container.style.overflowX = 'auto';
    }
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
      svg.appendChild(
        chartNode('line', { x1: 90, y1: y, x2: chartWidth - 20, y2: y, class: 'chart-grid' }),
      );
      svg.appendChild(
        chartNode(
          'text',
          { x: 80, y: y + 4, 'text-anchor': 'end', class: 'chart-label' },
          format((maximum * tick) / 4),
        ),
      );
    }
    values.forEach((value, index) => {
      const x = 125 + index * ((chartWidth - 180) / Math.max(values.length - 1, 1));
      const y = 210 - (value / maximum) * 180;
      points.push(x + ',' + y);
      const mark = chartNode(
        line ? 'circle' : 'rect',
        line
          ? { cx: x, cy: y, r: 5, class: 'chart-point' }
          : { x: x - 19, y, width: 38, height: 210 - y, rx: 4, class: 'chart-bar' },
      );
      if (!line) mark.setAttribute('fill', 'url(#' + id + '-gradient-' + (index % 3) + ')');
      mark.appendChild(chartNode('title', {}, labels[index] + ': ' + format(value)));
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
          labels[index].replace(/^Barangay /, 'Brgy '),
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
    chartTable(container, labels, values, format);
    if (id === 'consumptionChart') {
      container.chartResizeObserver?.disconnect();
      const initialWidth = container.clientWidth;
      container.chartResizeObserver = new ResizeObserver(() => {
        if (Math.abs(container.clientWidth - initialWidth) < 2) return;
        container.chartResizeObserver.disconnect();
        container.replaceChildren();
        renderMonthlyChart(id, title, values, format, line, labels);
      });
      container.chartResizeObserver.observe(container);
    }
  }
  const collections = data.monthlyCollections.map((row) => Number(row.amount));
  renderMonthlyChart(
    'collectionsChart',
    'Monthly collections — last six months',
    collections,
    (value) => WaterStore.money(value),
  );
  // Use the same six-month coverage and bar style as monthly collections.
  const barangayVolumes = new Map(
    data.barangayConsumption.map((row) => [row.barangay, Number(row.volume)]),
  );
  const barangayNames = [...barangayVolumes.keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  renderMonthlyChart(
    'consumptionChart',
    'Barangay consumption - last six months',
    barangayNames.map((name) => barangayVolumes.get(name)),
    (value) => Number(value.toFixed(3)).toLocaleString() + ' m\u00b3',
    false,
    barangayNames,
  );

  const statusLabels = ['Paid', 'Unpaid', 'Overdue'];
  const counts = statusLabels.map(
    (status) => data.billStatuses.find((row) => row.status === status)?.count || 0,
  );
  const statusContainer = document.getElementById('statusChart');
  const pie = chartNode('svg', {
    viewBox: '0 0 260 260',
    role: 'img',
    'aria-label': counts.map((count, index) => statusLabels[index] + ': ' + count).join(', '),
  });
  pie.appendChild(chartNode('title', {}, 'Bill status across all periods'));
  if (!data.summary.bills) {
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
    const fraction = count / data.summary.bills;
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
  billCount.textContent = data.summary.bills + ' total bills · All periods';
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
      (data.summary.bills ? Math.round((counts[index] / data.summary.bills) * 100) : 0) +
      '%';
    item.append(badge, count);
    legend.appendChild(item);
  });
  statusContainer.appendChild(legend);
}
