// Small UI helpers used by each page.
// Numeric entry helpers also cover meter fields created after the page loads.
function isNumericField(field) {
  return (
    field instanceof HTMLInputElement && (field.type === 'number' || field.inputMode === 'decimal')
  );
}
document.addEventListener('beforeinput', (event) => {
  const field = event.target;
  if (!isNumericField(field) || !event.data) return;
  if (/[^0-9.]/.test(event.data)) event.preventDefault();
});
document.addEventListener('paste', (event) => {
  if (!isNumericField(event.target)) return;
  const text = event.clipboardData.getData('text');
  if (!/^\d+(\.\d+)?$/.test(text)) event.preventDefault();
});
document.addEventListener('keydown', (event) => {
  if (
    isNumericField(event.target) &&
    ['e', 'E', '+', '-'].includes(event.key) &&
    !event.ctrlKey &&
    !event.metaKey
  )
    event.preventDefault();
});
document.addEventListener(
  'input',
  (event) => {
    const field = event.target;
    if (!isNumericField(field)) return;
    const decimals = field.type === 'number' ? (field.step.split('.')[1] || '').length : 2;
    const pattern = new RegExp('^\\d+' + (decimals ? '(\\.\\d{1,' + decimals + '})?' : '') + '$');
    const valid =
      !field.value || (pattern.test(field.value) && Number.isFinite(Number(field.value)));
    field.setCustomValidity(
      valid
        ? ''
        : 'Enter a non-negative number' +
            (decimals ? ' with at most ' + decimals + ' decimal places.' : ' without decimals.'),
    );
  },
  true,
);
function updatePaymentLinks(customerId) {
  document.querySelectorAll('.payment-navigation a').forEach((link) => {
    link.search = customerId ? '?customer=' + encodeURIComponent(customerId) : '';
  });
}
updatePaymentLinks(new URLSearchParams(location.search).get('customer'));
const AdminUI = {
  customer(row, customer) {
    const cell = this.cell(row, '', 'Customer');
    cell.className = 'table-customer';
    const name = document.createElement('strong');
    name.textContent = customer?.name || 'Unknown customer';
    const account = document.createElement('small');
    account.textContent = customer?.account || 'Not recorded';
    cell.append(name, account);
    return cell;
  },
  cell(row, value, label) {
    const cell = document.createElement('td');
    cell.textContent = value;
    if (typeof value === 'string' && value.includes('\u20b1')) cell.classList.add('money-value');
    if (label === 'Status' && ['Paid', 'Unpaid', 'Overdue'].includes(value)) {
      const badge = document.createElement('span');
      badge.className = 'payment-status status-' + value.toLowerCase();
      badge.textContent = value;
      cell.replaceChildren(badge);
    }
    cell.dataset.label = label;
    row.appendChild(cell);
    return cell;
  },
  button(parent, label, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = label;
    button.addEventListener('click', action);
    parent.appendChild(button);
  },
  empty(table, columns, message) {
    if (table.children.length) return;
    const row = table.insertRow();
    const cell = row.insertCell();
    cell.colSpan = columns;
    cell.textContent = message;
  },
  options(select, customers) {
    select.replaceChildren(new Option('Select customer', ''));
    customers.forEach((customer) =>
      select.add(new Option(customer.account + ' — ' + customer.name, customer.id)),
    );
  },
  download(filename, text, type = 'text/csv') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  csv(rows) {
    return rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? '');
            if (/^[=+@-]/.test(text)) text = "'" + text;
            return '"' + text.replaceAll('"', '""') + '"';
          })
          .join(','),
      )
      .join('\r\n');
  },
  message(text) {
    let box = document.getElementById('pageMessage');
    const dialog = document.querySelector('dialog[open]');
    if (dialog) {
      box = dialog.querySelector('[role="status"]');
      if (!box) {
        box = document.createElement('p');
        box.setAttribute('role', 'status');
        box.tabIndex = -1;
        dialog.prepend(box);
      }
    }
    box.textContent = text;
    box.focus();
  },
};

const menuButton = document.getElementById('menuToggle');
// Filter popovers share the same heading, dismissal and keyboard behavior.
document.querySelectorAll('.payment-filter-dropdown').forEach((dropdown) => {
  const panel = dropdown.querySelector('.payment-history-filters');
  const header = document.createElement('div');
  header.className = 'filter-panel-heading';
  const title = document.createElement('strong');
  title.textContent = 'Filter records';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'filter-panel-close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close filters');
  const dismiss = () => {
    dropdown.open = false;
    dropdown.querySelector('summary').focus();
  };
  close.addEventListener('click', dismiss);
  header.append(title, close);
  panel.prepend(header);
  dropdown.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
    }
  });
  document.addEventListener('click', (event) => {
    if (!dropdown.contains(event.target) && !event.target.closest('.calendar-dialog, dialog'))
      dropdown.open = false;
  });
});
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const officeDetails = WaterStore.load().office;
const mainContent = document.querySelector('main.main-content');
if (mainContent) {
  const footer = document.createElement('footer');
  footer.className = 'admin-footer';
  const copyright = document.createElement('span');
  copyright.textContent = '© ' + WaterStore.today().slice(0, 4) + ' ' + officeDetails.name;
  const office = document.createElement('span');
  office.className = 'admin-footer-office';
  office.textContent = 'Municipal Waterworks Office · Pio Duran, Albay';
  footer.append(copyright, office);
  mainContent.after(footer);
}
const logoutButton = document.createElement('button');
logoutButton.type = 'button';
logoutButton.className = 'btn logout-button';
logoutButton.textContent = 'Log out';
logoutButton.addEventListener('click', () => AdminAuth.logout());
document.querySelector('.sidebar-tools').appendChild(logoutButton);
// Keep the same sidebar on every page, with an optional compact desktop view.
function sidebarIcon(path) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  shape.setAttribute('d', path);
  svg.appendChild(shape);
  return svg;
}
const collapseButton = document.createElement('button');
collapseButton.type = 'button';
collapseButton.className = 'sidebar-collapse';
collapseButton.setAttribute('aria-controls', 'sidebar');
collapseButton.appendChild(sidebarIcon('M4 4h16v16H4zM9 4v16M16 9l-3 3 3 3'));
sidebar.querySelector('.sidebar-brand').after(collapseButton);
function setSidebarCompact(compact) {
  document.documentElement.classList.toggle('sidebar-compact', compact);
  collapseButton.setAttribute('aria-expanded', String(!compact));
  collapseButton.setAttribute('aria-label', compact ? 'Expand sidebar' : 'Collapse sidebar');
  collapseButton.title = compact ? 'Expand sidebar' : 'Collapse sidebar';
}
try {
  setSidebarCompact(localStorage.getItem('pio-duran-sidebar-compact') === 'true');
} catch {
  setSidebarCompact(false);
}
collapseButton.addEventListener('click', () => {
  const compact = !document.documentElement.classList.contains('sidebar-compact');
  setSidebarCompact(compact);
  try {
    localStorage.setItem('pio-duran-sidebar-compact', String(compact));
  } catch {
    /* Keep the choice for this page. */
  }
});
sidebar.querySelectorAll('.sidebar-menu-item').forEach((link) => {
  link.setAttribute('aria-label', link.textContent.trim());
});
const sidebarTheme = document.getElementById('themeToggle');
[sidebarTheme, logoutButton].filter(Boolean).forEach((button) => {
  const label = document.createElement('span');
  label.className = 'sidebar-tool-label';
  label.textContent = button.textContent;
  button.replaceChildren(
    sidebarIcon(
      button === logoutButton
        ? 'M9 4H4v16h5M13 8l4 4-4 4M8 12h13'
        : 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z',
    ),
    label,
  );
  button.setAttribute(
    'aria-label',
    button === logoutButton ? 'Log out' : button.getAttribute('aria-label') || 'Switch theme',
  );
  button.title = button.getAttribute('aria-label');
});
// A fixed tooltip stays visible outside the scrolling menu container.
const sidebarTooltip = document.createElement('div');
sidebarTooltip.id = 'sidebarTooltip';
sidebarTooltip.className = 'sidebar-tooltip';
sidebarTooltip.setAttribute('role', 'tooltip');
sidebarTooltip.setAttribute('aria-hidden', 'true');
document.body.appendChild(sidebarTooltip);
let tooltipTarget = null;
function hideSidebarTooltip() {
  sidebarTooltip.classList.remove('is-visible');
  sidebarTooltip.setAttribute('aria-hidden', 'true');
  if (tooltipTarget) tooltipTarget.removeAttribute('aria-describedby');
  tooltipTarget = null;
}
sidebar.querySelectorAll('.sidebar-menu-item, .sidebar-tools .btn').forEach((item) => {
  item.removeAttribute('title');
  const show = () => {
    if (
      !document.documentElement.classList.contains('sidebar-compact') ||
      !window.matchMedia('(min-width: 861px)').matches
    )
      return;
    hideSidebarTooltip();
    tooltipTarget = item;
    sidebarTooltip.textContent = item.getAttribute('aria-label');
    const bounds = item.getBoundingClientRect();
    sidebarTooltip.style.left = sidebar.getBoundingClientRect().right + 12 + 'px';
    sidebarTooltip.style.top =
      Math.max(26, Math.min(window.innerHeight - 26, bounds.top + bounds.height / 2)) + 'px';
    sidebarTooltip.setAttribute('aria-hidden', 'false');
    item.setAttribute('aria-describedby', sidebarTooltip.id);
    sidebarTooltip.classList.add('is-visible');
  };
  item.addEventListener('mouseenter', show);
  item.addEventListener('focus', show);
  item.addEventListener('mouseleave', hideSidebarTooltip);
  item.addEventListener('blur', hideSidebarTooltip);
  item.addEventListener('click', hideSidebarTooltip);
});
collapseButton.addEventListener('click', hideSidebarTooltip);
window.addEventListener('resize', hideSidebarTooltip);
sidebar.querySelector('.sidebar-menu').addEventListener('scroll', hideSidebarTooltip);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') hideSidebarTooltip();
});
document.querySelectorAll('.brand-title').forEach((title) => {
  title.textContent = officeDetails.name;
});
function closeMenu() {
  sidebar.classList.remove('is-open');
  overlay.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
}
menuButton.addEventListener('click', () => {
  const opened = sidebar.classList.toggle('is-open');
  overlay.classList.toggle('is-open', opened);
  menuButton.setAttribute('aria-expanded', String(opened));
});
overlay.addEventListener('click', closeMenu);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});
// Reload when another tab saves records, so forms do not use stale balances.
window.addEventListener('storage', (event) => {
  if (event.key === WaterStore.key) location.reload();
});
window.addEventListener('error', (event) => {
  AdminUI.message('The operation could not finish. ' + event.message);
});
