// Monthly billed consumption, with mouse, touch and keyboard inspection.
function renderConsumptionChart(container, months, values) {
  const format = value => Number(value.toFixed(3)).toLocaleString() + ' m³';
  const label = month => new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(month + '-01T00:00:00Z'));
  const node = (tag, attributes = {}, text = '') => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    element.textContent = text;
    return element;
  };
  const summary = document.createElement('div');
  summary.className = 'consumption-summary';
  const total = values.reduce((sum, value) => sum + value, 0);
  const latest = values[values.length - 1];
  const peak = Math.max(...values);
  [['Billed volume · six months', format(total)], [label(months.at(-1)) + ' · billed so far', format(latest)], ['Highest monthly volume', format(peak)]]
    .forEach(([title, value]) => {
      const item = document.createElement('div');
      const heading = document.createElement('span'); heading.textContent = title;
      const number = document.createElement('strong'); number.textContent = value;
      item.append(heading, number); summary.appendChild(item);
    });
  container.appendChild(summary);
  const caption = document.createElement('p');
  caption.className = 'consumption-caption';
  caption.textContent = label(months[0]) + ' – ' + label(months.at(-1)) + ' · Total billed water consumption';
  container.appendChild(caption);

  const plot = document.createElement('div');
  plot.className = 'consumption-plot';
  const svg = node('svg', { viewBox: '0 0 900 300', role: 'group', 'aria-label': 'Monthly billed water consumption. Focus each point for its exact value.' });
  const defs = node('defs');
  const gradient = node('linearGradient', { id: 'consumption-area-fill', x1: 0, y1: 0, x2: 0, y2: 1 });
  gradient.append(node('stop', { offset: '0%', 'stop-color': '#20bfc5', 'stop-opacity': '.32' }), node('stop', { offset: '100%', 'stop-color': '#20bfc5', 'stop-opacity': '.02' }));
  defs.appendChild(gradient); svg.appendChild(defs);
  const step = Math.pow(10, Math.floor(Math.log10(Math.max(peak, 1))));
  const maximum = Math.ceil(Math.max(peak, 1) * 1.15 / step) * step;
  const points = values.map((value, index) => ({ x: 86 + index * 154, y: 242 - value / maximum * 208 }));
  for (let index = 0; index <= 4; index++) {
    const y = 242 - index * 52;
    svg.appendChild(node('line', { x1: 86, y1: y, x2: 856, y2: y, class: 'chart-grid' }));
    svg.appendChild(node('text', { x: 70, y: y + 4, 'text-anchor': 'end', class: 'chart-label' }, Number((maximum * index / 4).toFixed(2)).toLocaleString()));
  }
  svg.appendChild(node('text', { x: 70, y: 15, 'text-anchor': 'end', class: 'chart-label' }, 'm³'));
  // Horizontal control points keep each segment inside its actual data range.
  let path = 'M' + points[0].x + ' ' + points[0].y;
  points.slice(1).forEach((point, index) => {
    const before = points[index];
    const middle = (before.x + point.x) / 2;
    path += ' C' + middle + ' ' + before.y + ' ' + middle + ' ' + point.y + ' ' + point.x + ' ' + point.y;
  });
  svg.appendChild(node('path', { d: path + ' L856 242 L86 242 Z', class: 'consumption-area' }));
  svg.appendChild(node('path', { d: path, class: 'consumption-trend' }));
  const guide = node('line', { x1: 0, y1: 28, x2: 0, y2: 242, class: 'consumption-guide', visibility: 'hidden' });
  svg.appendChild(guide);
  const tooltip = document.createElement('div');
  tooltip.className = 'consumption-tooltip';
  tooltip.id = 'consumptionTooltip'; tooltip.setAttribute('role', 'tooltip'); tooltip.hidden = true;
  const tooltipMonth = document.createElement('span');
  const tooltipValue = document.createElement('strong');
  tooltip.append(tooltipMonth, tooltipValue);
  const hide = () => { tooltip.hidden = true; guide.setAttribute('visibility', 'hidden'); };
  points.forEach((point, index) => {
    const dot = node('circle', { cx: point.x, cy: point.y, r: 6, class: 'consumption-dot', tabindex: 0, role: 'img', 'aria-label': label(months[index]) + ': ' + format(values[index]) });
    const show = () => {
      tooltipMonth.textContent = label(months[index]); tooltipValue.textContent = format(values[index]);
      tooltip.hidden = false;
      const plotBounds = plot.getBoundingClientRect();
      const bounds = dot.getBoundingClientRect();
      tooltip.style.left = Math.max(80, Math.min(plotBounds.width - 80, bounds.left - plotBounds.left + bounds.width / 2)) + 'px';
      tooltip.style.top = Math.max(0, bounds.top - plotBounds.top - 70) + 'px';
      guide.setAttribute('x1', point.x); guide.setAttribute('x2', point.x); guide.setAttribute('visibility', 'visible');
    };
    dot.addEventListener('mouseenter', show); dot.addEventListener('focus', show); dot.addEventListener('click', show);
    dot.addEventListener('mouseleave', hide); dot.addEventListener('blur', hide);
    svg.appendChild(dot);
    svg.appendChild(node('text', { x: point.x, y: 276, 'text-anchor': 'middle', class: 'chart-label' }, label(months[index])));
  });
  plot.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  plot.append(svg, tooltip); container.appendChild(plot);
  const note = document.createElement('p'); note.className = 'consumption-note';
  note.textContent = total === 0 ? 'No billed consumption in this period yet.' : 'Hover or select a point to see monthly volume. Current month includes generated bills so far.';
  container.appendChild(note);
}
