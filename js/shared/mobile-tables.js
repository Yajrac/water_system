(() => {
  const phone = window.matchMedia('(max-width: 600px)');
  const layouts = {
    billRows: [0, 4, 6, 8, 9], paymentRows: [0, 1, 3, 5, 6],
    balanceRows: [0, 2, 4, 5], reportRows: [0, 3, 4, 5],
    consumptionRows: [0, 1, 2, 3], feedbackRows: [0, 1, 4, 5],
    disconnectRows: [0, 3, 4, 5], barangayRows: [0, 3, 4],
    cashierRows: [0, 1, 3, 4], activityRows: [0, 1, 3], consumerActivityRows: [0, 1, 3],
  };
  const titles = { 'Billing month': 'Month', 'Previous reading': 'Previous',
    'Current reading': 'Reading', 'Outstanding balance': 'Balance',
    'Submitter / account no.': 'Account', 'Full name': 'Name',
    'Total consumption (m³)': 'Usage (m³)', 'Average per billed account (m³)': 'Average (m³)',
    'Billed accounts': 'Accounts', 'Date / time': 'Date' };
  let sequence = 0;
  const syncMenu = (menu) => {
    if (phone.matches) menu.setAttribute('popover', 'auto');
    else menu.removeAttribute('popover');
  };
  for (const [id, visible] of Object.entries(layouts)) {
    const body = document.getElementById(id);
    if (!body) continue;
    const table = body.closest('table');
    table.classList.add('mobile-record-table');
    [...table.tHead.rows[0].cells].forEach((header, index) => {
      if (!visible.includes(index)) header.setAttribute('data-mobile-hide', '');
      const title = header.textContent.trim();
      if (!titles[title]) return;
      const full = document.createElement('span');
      full.className = 'mobile-table-heading-full';
      full.textContent = title;
      const short = document.createElement('span');
      short.className = 'mobile-table-heading-short';
      short.textContent = titles[title];
      short.setAttribute('aria-hidden', 'true');
      header.replaceChildren(full, short);
    });
    const enhance = () => {
      [...body.rows].forEach((row) => {
        if (row.dataset.mobileReady || row.cells.length <= 1) return;
        row.dataset.mobileReady = 'true';
        [...row.cells].forEach((cell, index) => {
          if (!visible.includes(index)) cell.setAttribute('data-mobile-hide', '');
          cell.querySelectorAll('small').forEach((reference) => {
            reference.classList.add('mobile-table-reference');
            reference.title = reference.textContent;
          });
          const heading = table.tHead.rows[0].cells[index].textContent.trim();
          if (/Receipt|Account|Submitter/i.test(heading) && !cell.querySelector('button,a,input')) {
            const value = cell.textContent;
            const reveal = document.createElement('button');
            reveal.type = 'button';
            reveal.className = 'mobile-reference-button';
            reveal.textContent = value;
            reveal.title = value;
            reveal.addEventListener('click', () => showNotice('Reference details', value));
            cell.replaceChildren(reveal);
          }
          if (!/^(Actions?|View)$/.test(heading)) return;
          const controls = [...cell.querySelectorAll('a,button')];
          if (controls.length < 2) return;
          const menu = document.createElement('div');
          menu.className = 'mobile-record-actions';
          menu.id = 'record-actions-' + (++sequence);
          controls.forEach((control) => {
            const label = document.createElement('span');
            label.className = 'mobile-record-action-label';
            label.textContent = control.title || control.getAttribute('aria-label') || control.textContent.trim() || 'View details';
            if (control.querySelector('i,svg') || !control.textContent.trim()) control.appendChild(label);
            menu.appendChild(control);
          });
          const toggle = document.createElement('button');
          toggle.type = 'button';
          toggle.className = 'btn mobile-record-more';
          toggle.setAttribute('popovertarget', menu.id);
          toggle.setAttribute('aria-label', 'Actions for ' + row.cells[0].textContent.trim());
          const icon = document.createElement('i');
          icon.className = 'bi bi-three-dots-vertical';
          icon.setAttribute('aria-hidden', 'true');
          toggle.appendChild(icon);
          toggle.addEventListener('click', () => {
            const rect = toggle.getBoundingClientRect();
            menu.style.left = Math.max(8, Math.min(rect.right - 190, window.innerWidth - 198)) + 'px';
            menu.style.top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - (controls.length * 48 + 20))) + 'px';
          });
          menu.addEventListener('click', (event) => {
            if (phone.matches && event.target.closest('a,button')) menu.hidePopover();
          });
          cell.replaceChildren(menu, toggle);
          syncMenu(menu);
        });
      });
    };
    new MutationObserver(enhance).observe(body, { childList: true, subtree: true });
    enhance();
    phone.addEventListener('change', () => body.querySelectorAll('.mobile-record-actions').forEach(syncMenu));
  }
})();
