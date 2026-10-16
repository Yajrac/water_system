// Small shared pager: ten records at a time, with Previous and Next controls.
function createPagination(containerId, onChange) {
  const container = document.getElementById(containerId);
  const summary = document.createElement('span');
  summary.setAttribute('aria-live', 'polite');
  const controls = document.createElement('div');
  controls.className = 'pager-controls';
  const previous = document.createElement('button');
  previous.type = 'button';
  previous.className = 'btn';
  previous.textContent = 'Previous';
  const label = document.createElement('span');
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'btn';
  next.textContent = 'Next';
  controls.append(previous, label, next);
  container.append(summary, controls);
  const pager = {
    page: 1,
    size: 10,
    update(total) {
      const pages = Math.max(1, Math.ceil(total / this.size));
      this.page = Math.min(this.page, pages);
      const first = total ? (this.page - 1) * this.size + 1 : 0;
      summary.textContent =
        'Showing ' + first + '–' + Math.min(this.page * this.size, total) + ' of ' + total;
      label.textContent = 'Page ' + this.page + ' of ' + pages;
      previous.disabled = this.page === 1;
      next.disabled = this.page === pages;
    },
    items(records) {
      return records.slice((this.page - 1) * this.size, this.page * this.size);
    },
  };
  previous.addEventListener('click', () => {
    pager.page--;
    onChange();
  });
  next.addEventListener('click', () => {
    pager.page++;
    onChange();
  });
  return pager;
}
