// Placeholders are shown only while an actual async load is pending.
const Skeleton = {
  block(className) {
    const block = document.createElement('span');
    block.className = 'skeleton-block ' + className;
    block.setAttribute('aria-hidden', 'true');
    return block;
  },
  start(container, type, count = 4, columns = 1) {
    container.replaceChildren();
    container.setAttribute('aria-busy', 'true');
    const status = document.createElement('span');
    status.className = 'loading-announcement';
    status.setAttribute('role', 'status');
    status.textContent = 'Loading records…';
    container.before(status);
    for (let index = 0; index < count; index++) {
      if (type === 'table') {
        const row = container.insertRow();
        row.setAttribute('aria-hidden', 'true');
        for (let column = 0; column < columns; column++) {
          row.insertCell().appendChild(this.block('skeleton-row-text'));
        }
      } else {
        const card = document.createElement('div');
        card.className = type === 'chart' ? 'skeleton-chart' : 'record-card';
        card.setAttribute('aria-hidden', 'true');
        card.append(this.block('skeleton-heading'), this.block(type === 'chart' ? 'skeleton-plot' : 'skeleton-number'), this.block('skeleton-caption'));
        container.appendChild(card);
      }
    }
    return () => {
      container.replaceChildren();
      container.setAttribute('aria-busy', 'false');
      status.remove();
    };
  },
};
