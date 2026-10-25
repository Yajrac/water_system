// Small UI helpers used by each page.
// Refresh handlers update records in place; they must never reload forms.
function prepareRefreshIcon(icon) {
  if (!icon) return;
  icon.classList.remove('bi', 'bi-arrow-clockwise');
  icon.classList.add('admin-refresh-icon');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M20 4v5h-5 M19.1 9a7.5 7.5 0 1 0 .4 5');
  svg.appendChild(path);
  icon.replaceChildren(svg);
}
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#refreshDashboard i, #refreshReport i').forEach(prepareRefreshIcon);
  const page = location.pathname.split('/').pop();
  const loaders = {
    'customers.html': () => loadCustomers(),
    'barangays.html': () => loadBarangays(),
    'generated-bills.html': () => showGeneratedBills(),
    'bill-balances.html': () => showBalances(),
    'payment-history.html': () => showPayments(),
    'record-payment.html': () => renderCashierRegistry(),
    'feedback.html': () => showFeedback(),
    'disconnected.html': () => showDisconnections(),
    'broadcast.html': () => showNotices(),
    'customer-profile.html': () => refreshCustomerProfile(),
    'customer-form.html': () => refreshCustomerChoices(),
    'settings.html': () => refreshPageSections(),
    'billing.html': () => refreshPageSections(),
  };
  function refreshPageSections() {
    const tasks = [];
    document.dispatchEvent(new CustomEvent('admin:refresh-content', { detail: { tasks } }));
    return Promise.all(tasks);
  }
  const load = loaders[page];
  const header = document.querySelector('main > .page-header');
  if (page === 'reports.html' && header) {
    const existing = document.getElementById('refreshReport');
    existing.classList.add('admin-content-refresh');
    header.appendChild(existing);
  }
  let headerActions;
  if (header) {
    header.classList.add('admin-page-header');
    headerActions = header.querySelector(':scope > .customer-header-actions, :scope > .barangay-header-actions');
    if (!headerActions) {
      headerActions = document.createElement('div');
      header.appendChild(headerActions);
    }
    headerActions.classList.add('admin-header-actions');
    Array.from(header.children)
      .filter((child) => child.matches('button, a.btn'))
      .forEach((control) => headerActions.appendChild(control));
  }
  if (!load || !header) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn admin-content-refresh';
  const icon = document.createElement('i');
  icon.className = 'bi bi-arrow-clockwise';
  icon.setAttribute('aria-hidden', 'true');
  prepareRefreshIcon(icon);
  button.append(icon, document.createTextNode(' Refresh'));
  headerActions.appendChild(button);
  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    icon.classList.add('admin-refresh-spinning');
    try {
      if (await AdminAuth.ready) await load();
    } catch (error) { AdminUI.message(error.message); }
    finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      icon.classList.remove('admin-refresh-spinning');
    }
  });
});
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
let logoutConfirming = false;
logoutButton.addEventListener('click', async () => {
  if (logoutConfirming) return;
  logoutConfirming = true;
  try {
    const accepted = await confirmAction(
      'Log out?',
      'Are you sure you want to log out?',
      'Yes, log out',
    );
    if (accepted) await AdminAuth.logout();
  } finally {
    logoutConfirming = false;
  }
});
document.querySelector('.sidebar-tools').appendChild(logoutButton);
// Keep the same sidebar on every page, with an optional compact desktop view.
function sidebarIcon(name) {
  const icon = document.createElement('i');
  icon.className = 'bi bi-' + name;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}
const collapseButton = document.createElement('button');
collapseButton.type = 'button';
collapseButton.className = 'sidebar-collapse';
collapseButton.setAttribute('aria-controls', 'sidebar');
collapseButton.appendChild(sidebarIcon('layout-sidebar-inset'));
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
// Read state belongs to the signed-in admin and is shared across their devices.
const feedbackMenu = sidebar.querySelector('a[href="feedback.html"]');
if (feedbackMenu) {
  const dot = document.createElement('span');
  dot.className = 'feedback-unread-dot';
  dot.hidden = true;
  dot.setAttribute('aria-hidden', 'true');
  feedbackMenu.appendChild(dot);
  let checkingFeedback = false;
  async function refreshFeedbackBadge() {
    if (checkingFeedback || document.hidden) return;
    checkingFeedback = true;
    try {
      const result = await AdminAPI.request('/feedback/unread');
      dot.hidden = !result.unread;
      dot.textContent = result.unread > 99 ? '99+' : String(result.unread);
      feedbackMenu.setAttribute('aria-label', result.unread ? 'Feedback, ' + result.unread + ' unread' : 'Feedback');
    } catch {
      // Keep the last known state while the server is unavailable.
    } finally {
      checkingFeedback = false;
    }
  }
  AdminAuth.ready.then(user => {
    if (!user || user.mustChangePassword) return;
    refreshFeedbackBadge();
    setInterval(refreshFeedbackBadge, 30000);
    window.addEventListener('focus', refreshFeedbackBadge);
    window.addEventListener('feedback-read', refreshFeedbackBadge);
    document.addEventListener('visibilitychange', refreshFeedbackBadge);
  });
}
const sidebarTheme = document.getElementById('themeToggle');
[sidebarTheme, logoutButton].filter(Boolean).forEach((button) => {
  const label = document.createElement('span');
  label.className = 'sidebar-tool-label';
  label.textContent = button.textContent;
  button.replaceChildren(
    sidebarIcon(button === logoutButton ? 'box-arrow-right' : 'moon-stars'),
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

// Use the same arrow and close icons on static and dynamically created controls.
function applyNavigationIcon(button) {
  if (/^(Previous|Next|Back)(\s|$)/i.test(button.textContent.trim()) ||
      /^(Previous|Next|Back)(\s|$)/i.test(button.getAttribute('aria-label') || '')) {
    button.classList.add('step-navigation-button');
  }
  const actionLabel = button.textContent.trim();
  if (/^(Edit|View)(\s|$)/i.test(actionLabel) && !button.querySelector('svg, .bi')) {
    const icon = document.createElement('i');
    icon.className = 'bi bi-' + (/^Edit/i.test(actionLabel) ? 'pencil-square' : 'eye');
    icon.setAttribute('aria-hidden', 'true');
    button.prepend(icon);
  }
  if (button.querySelector('svg, .bi')) return;
  const label = button.textContent.trim();
  const icons = {
    Previous: 'arrow-left',
    Back: 'arrow-left',
    Next: 'arrow-right',
    Close: 'x-lg',
  };
  if (!icons[label]) return;
  const svg = document.createElement('i');
  svg.className = 'bi bi-' + icons[label];
  svg.setAttribute('aria-hidden', 'true');
  const caption = document.createElement('span');
  caption.textContent = label;
  button.classList.add('navigation-icon-control');
  button.replaceChildren(...(label === 'Next' ? [caption, svg] : [svg, caption]));
}
function scanNavigationIcons(root) {
  if (!(root instanceof Element)) return;
  if (root.matches('button, a.btn')) applyNavigationIcon(root);
  root.querySelectorAll('button, a.btn').forEach(applyNavigationIcon);
  const parent = root.closest('button');
  if (parent) applyNavigationIcon(parent);
}
scanNavigationIcons(document.body);
new MutationObserver((changes) => {
  changes.forEach((change) => {
    if (change.target instanceof Element && change.target.matches('button'))
      applyNavigationIcon(change.target);
    change.addedNodes.forEach(scanNavigationIcons);
  });
}).observe(document.body, { childList: true, subtree: true });
