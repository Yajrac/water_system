const AdminAuth = {
  user: null,
  sessionError: '',
  checking: null,
  expiryTimer: null,
  idleTimer: null,
  idleExpired: false,
  idleKey: 'pwss-admin-last-activity',
  idleLimitMs: 8 * 60 * 60 * 1000,
  checkIdle() {
    if (!AdminAPI.getToken() && !localStorage.getItem('pwss-admin-refresh-token')) return true;
    const last = Number(localStorage.getItem(this.idleKey));
    if (last > 0 && Date.now() - last >= this.idleLimitMs) {
      this.clear();
      this.idleExpired = true;
      this.redirectToLogin('idle');
      return false;
    }
    if (!last) localStorage.setItem(this.idleKey, String(Date.now()));
    return true;
  },
  scheduleIdle() {
    clearTimeout(this.idleTimer);
    if (!this.checkIdle() || !AdminAPI.getToken()) return;
    const last = Number(localStorage.getItem(this.idleKey));
    this.idleTimer = setTimeout(() => this.scheduleIdle(), Math.max(1, this.idleLimitMs - (Date.now() - last)));
  },
  recordActivity() {
    if (!this.checkIdle() || !AdminAPI.getToken()) return;
    const last = Number(localStorage.getItem(this.idleKey));
    if (Date.now() - last < 30000) return;
    localStorage.setItem(this.idleKey, String(Date.now()));
    this.scheduleIdle();
  },
  loggedIn() {
    return Boolean(this.user && AdminAPI.getToken());
  },
  clear() {
    clearTimeout(this.expiryTimer);
    clearTimeout(this.idleTimer);
    localStorage.removeItem(this.idleKey);
    sessionStorage.removeItem(AdminAPI.tokenKey);
    localStorage.removeItem(AdminAPI.tokenKey);
    localStorage.removeItem('pwss-admin-refresh-token');
    sessionStorage.removeItem('pwss-admin-session');
    this.user = null;
  },
  scheduleExpiry(token) {
    clearTimeout(this.expiryTimer);
    try {
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const expires = JSON.parse(atob(part)).exp * 1000;
      if (!Number.isFinite(expires)) return;
      const delay = Math.max(0, Math.min(expires - Date.now() - 60000, 2147483647));
      this.expiryTimer = setTimeout(async () => {
        if (AdminAPI.getToken() !== token) return;
        if (!localStorage.getItem('pwss-admin-refresh-token')) {
          this.clear();
          this.redirectToLogin('expired');
          return;
        }
        try { await this.renewSession(); }
        catch (error) {
          if (error.status === 401) { this.clear(); this.redirectToLogin('expired'); }
          else this.expiryTimer = setTimeout(() => this.scheduleExpiry(token), 30000);
        }
      }, delay);
    } catch {
      // Authentication decisions still come from /auth/me and API 401 responses.
    }
  },
  renewing: null,
  async renewSession() {
    if (!this.checkIdle()) throw new AdminApiError('Session ended after 8 hours of inactivity.', 401);
    if (this.renewing) return this.renewing;
    const refreshToken = localStorage.getItem('pwss-admin-refresh-token');
    if (!refreshToken) return;
    this.renewing = (async () => {
      const result = await AdminAPI.request('/auth/refresh', {
        method: 'POST', body: { refreshToken }, authenticated: false,
      });
      if (localStorage.getItem('pwss-admin-refresh-token') !== refreshToken) return;
      sessionStorage.removeItem(AdminAPI.tokenKey);
      localStorage.setItem(AdminAPI.tokenKey, result.accessToken);
      localStorage.setItem('pwss-admin-refresh-token', result.refreshToken);
      this.user = result.user;
      this.scheduleExpiry(result.accessToken);
    })();
    try { await this.renewing; } finally { this.renewing = null; }
  },
  async verifySession() {
    if (!this.checkIdle()) return null;
    // AdminAPI renews expiring credentials before authenticated requests.
    if (!AdminAPI.getToken() && localStorage.getItem('pwss-admin-refresh-token')) await this.renewSession();
    const token = AdminAPI.getToken();
    if (!token) {
      this.user = null;
      return null;
    }
    if (this.checking) return this.checking;
    this.checking = (async () => {
      const result = await AdminAPI.request('/auth/me');
      if (!AdminAPI.getToken()) return null;
      if (result?.user?.role !== 'admin') {
        this.clear();
        throw new AdminApiError('This account does not have admin access.', 403);
      }
      this.user = result.user;
      this.scheduleExpiry(AdminAPI.getToken());
      this.scheduleIdle();
      return this.user;
    })();
    try {
      return await this.checking;
    } finally {
      this.checking = null;
    }
  },
  async login(username, password) {
    const result = await AdminAPI.request('/auth/login', {
      method: 'POST',
      body: { username, password },
      authenticated: false,
    });
    if (result?.user?.role !== 'admin') {
      throw new AdminApiError('This account does not have admin access.', 403);
    }
    if (typeof result.accessToken !== 'string' || !result.accessToken) {
      throw new AdminApiError('The server returned an unexpected login response.');
    }
    this.clear();
    this.idleExpired = false;
    localStorage.setItem(AdminAPI.tokenKey, result.accessToken);
    if (result.refreshToken) localStorage.setItem('pwss-admin-refresh-token', result.refreshToken);
    this.user = result.user;
    localStorage.setItem(this.idleKey, String(Date.now()));
    this.scheduleExpiry(result.accessToken);
    this.scheduleIdle();
    return this.user;
  },
  async logout() {
    const refreshToken = localStorage.getItem('pwss-admin-refresh-token');
    this.clear();
    if (refreshToken) {
      try { await AdminAPI.request('/auth/logout', { method: 'POST', body: { refreshToken }, authenticated: false }); }
      catch { /* Local credentials stay cleared even if the server is unreachable. */ }
    }
    location.replace('login.html');
  },
  destination() {
    if (this.user?.mustChangePassword) return 'settings.html#passwordSettingsPanel';
    const next = new URLSearchParams(location.search).get('next') || 'index.html';
    const allowed = [
      'index.html',
      'customers.html',
      'customer-form.html',
      'customer-application.html',
      'customer-profile.html',
      'barangays.html',
      'disconnected.html',
      'feedback.html',
      'billing.html',
      'generated-bills.html',
      'rates-fees.html',
      'payment-history.html',
      'broadcast.html',
      'reports.html',
      'settings.html',
      'record-payment.html',
      'bill-balances.html',
    ];
    return allowed.includes(next.split('?')[0]) ? next : 'index.html';
  },
  redirectToLogin(reason = '') {
    if (isPublicAuthPage) return;
    const query = new URLSearchParams({ next: currentAuthPage + location.search });
    if (this.idleExpired) reason = 'idle';
    if (reason) query.set('reason', reason);
    location.replace('login.html?' + query);
  },
};

const currentAuthPage = location.pathname.split('/').pop();
const isPublicAuthPage = currentAuthPage === 'login.html';
let initialRequests = 0;
let initialSessionReady = false;
let initialDocumentReady = document.readyState !== 'loading';
let initialLoadingFinished = false;
let initialFinishTimer;
function finishInitialLoading() {
  clearTimeout(initialFinishTimer);
  if (!initialSessionReady || !initialDocumentReady || initialRequests || initialLoadingFinished) return;
  // Let page initialization start dependent requests and finish rendering first.
  initialFinishTimer = setTimeout(() => {
    if (initialRequests) return;
    initialLoadingFinished = true;
    document.documentElement.classList.remove('auth-pending');
  }, 0);
}
const originalAdminRequest = AdminAPI.request;
AdminAPI.request = async function (...args) {
  const track = !initialLoadingFinished;
  if (track) initialRequests++;
  try { return await originalAdminRequest.apply(this, args); }
  finally {
    if (track) { initialRequests--; finishInitialLoading(); }
  }
};
document.addEventListener('DOMContentLoaded', () => {
  initialDocumentReady = true;
  finishInitialLoading();
}, { once: true });

// Keep navigation visible while the protected content is being verified.
const authGateStyle = document.createElement('style');
authGateStyle.textContent = `
  html.auth-pending main > :not(.page-header):not(.admin-session-loading) {
    display: none !important;
  }
  html.auth-pending.auth-dashboard:not(.auth-session-error) main > #summary,
  html.auth-pending.auth-dashboard:not(.auth-session-error) main > .dashboard-charts {
    display: grid !important;
  }
  html.auth-pending.auth-dashboard:not(.auth-session-error) .admin-session-loading {
    display: none;
  }
  html.auth-pending main > .page-header :is(button, a, input, select) {
    visibility: hidden;
  }
  .admin-session-loading { display: none; }
  html.auth-pending .admin-session-loading {
    visibility: visible;
    position: relative;
    width: 100%;
    min-height: 320px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    box-sizing: border-box;
    background: var(--card-bg, #fff);
    color: var(--color-text, inherit);
    border-radius: 12px;
    font: 500 16px/1.5 system-ui, sans-serif;
    text-align: center;
  }
  .admin-session-loading p { margin: 0; }
  .admin-session-loading small { font-size: 13px; }
  .admin-session-skeleton { display: grid; gap: 20px; width: 100%; }
  .admin-skeleton-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .admin-skeleton-block { height: 16px; }
  .admin-skeleton-card { padding: 20px; border: 1px solid var(--color-border); border-radius: 10px; }
  .admin-skeleton-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
  .admin-skeleton-field .skeleton-number { width: 100%; height: 42px; margin: 0; }
  .admin-skeleton-plots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
  .admin-skeleton-cards .admin-skeleton-block { height: 88px; }
  .admin-skeleton-row { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 24px; padding: 16px 0; }
  .admin-session-label[hidden], .admin-session-hint[hidden],
  .admin-session-retry[hidden], .admin-session-skeleton[hidden] { display: none; }
  @media (max-width: 600px) {
    .admin-skeleton-cards { grid-template-columns: 1fr; }
    .admin-skeleton-fields, .admin-skeleton-plots { grid-template-columns: 1fr; }
    .admin-skeleton-cards .admin-skeleton-block { height: 56px; }
    .admin-skeleton-row { gap: 12px; }
  }
`;
document.head.appendChild(authGateStyle);
function mountSessionLoading() {
  if (isPublicAuthPage) return;
  const loading = document.createElement('div');
  loading.className = 'admin-session-loading';
  loading.setAttribute('role', 'status');
  loading.setAttribute('aria-live', 'polite');
  loading.setAttribute('aria-label', 'Loading page content');
  const skeleton = document.createElement('div');
  skeleton.className = 'admin-session-skeleton';
  skeleton.setAttribute('aria-hidden', 'true');
  const cards = document.createElement('div');
  cards.className = 'admin-skeleton-cards';
  function placeholder() {
    const block = document.createElement('span');
    block.className = 'skeleton-block skeleton-row-text admin-skeleton-block';
    return block;
  }
  const dashboard = Boolean(document.getElementById('summary') && document.getElementById('collectionsChart'));
  if (dashboard) document.documentElement.classList.add('auth-dashboard');
  const isForm = !document.querySelector('main table') && Boolean(document.querySelector('main form'));
  for (let index = 0; index < (dashboard ? 8 : 3); index++) {
    const card = document.createElement('div');
    card.className = 'admin-skeleton-card';
    for (const kind of ['heading', 'number', 'caption']) {
      const block = placeholder();
      block.className = 'skeleton-block skeleton-' + kind;
      card.appendChild(block);
    }
    cards.appendChild(card);
  }
  if (dashboard) cards.className = 'admin-summary';
  skeleton.appendChild(cards);
  if (dashboard || isForm) {
    const fields = document.createElement('div');
    fields.className = dashboard ? 'admin-skeleton-plots' : 'admin-skeleton-fields';
    for (let index = 0; index < (dashboard ? 3 : 6); index++) {
      const field = document.createElement('div');
      field.className = 'admin-skeleton-field';
      const title = placeholder();
      title.className = 'skeleton-block skeleton-heading';
      const value = placeholder();
      value.className = 'skeleton-block ' + (dashboard ? 'skeleton-plot' : 'skeleton-number');
      field.append(title, value);
      fields.appendChild(field);
    }
    skeleton.appendChild(fields);
  }
  for (let index = 0; index < (dashboard || isForm ? 0 : 5); index++) {
    const row = document.createElement('div');
    row.className = 'admin-skeleton-row';
    row.append(placeholder(), placeholder(), placeholder());
    skeleton.appendChild(row);
  }
  const label = document.createElement('p');
  label.className = 'admin-session-label';
  label.hidden = true;
  const hint = document.createElement('small');
  hint.className = 'admin-session-hint';
  hint.hidden = true;
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn btn-primary admin-session-retry';
  retry.textContent = 'Retry connection';
  retry.hidden = true;
  retry.addEventListener('click', () => location.reload());
  loading.append(skeleton, label, hint, retry);
  const content = document.querySelector('main');
  if (!content) return;
  content.appendChild(loading);
  if (AdminAuth.sessionError) showSessionConnectionError();
}
function showSessionConnectionError() {
  const loading = document.querySelector('.admin-session-loading');
  if (!loading) return;
  document.documentElement.classList.add('auth-session-error');
  loading.removeAttribute('aria-label');
  loading.querySelector('.admin-session-skeleton').hidden = true;
  loading.querySelector('.admin-session-label').hidden = false;
  loading.querySelector('.admin-session-hint').hidden = false;
  loading.querySelector('.admin-session-label').textContent = 'Unable to load this page';
  loading.querySelector('.admin-session-hint').textContent = AdminAuth.sessionError;
  loading.querySelector('.admin-session-retry').hidden = false;
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountSessionLoading, { once: true });
} else {
  mountSessionLoading();
}

let adminPageVerified = false;
async function requireAdminSession({ background = false } = {}) {
  const checkInBackground = background && adminPageVerified && initialLoadingFinished;
  if (!isPublicAuthPage && !checkInBackground) document.documentElement.classList.add('auth-pending');
  AdminAuth.sessionError = '';
  try {
    sessionStorage.removeItem('pwss-admin-session');
    const user = await AdminAuth.verifySession();
    if (!user && !isPublicAuthPage) {
      AdminAuth.redirectToLogin();
      return null;
    }
    if (user?.mustChangePassword && currentAuthPage !== 'settings.html' && !isPublicAuthPage) {
      location.replace('settings.html#passwordSettingsPanel');
      return null;
    }
    adminPageVerified = Boolean(user);
    if (checkInBackground || isPublicAuthPage) {
      document.documentElement.classList.remove('auth-pending');
    } else {
      initialSessionReady = true;
      finishInitialLoading();
    }
    return user;
  } catch (error) {
    if ([401, 403].includes(error.status)) AdminAuth.clear();
    AdminAuth.sessionError = error.message;
    // A connection failure does not prove that the existing session is invalid.
    // Protected API requests continue to enforce authentication on the server.
    if (checkInBackground && ![401, 403].includes(error.status)) return null;
    if (!isPublicAuthPage && ![401, 403].includes(error.status)) {
      showSessionConnectionError();
      return null;
    }
    AdminAuth.redirectToLogin(error.status === 401 ? 'expired' : 'unavailable');
    return null;
  }
}

window.addEventListener('admin:unauthorized', (event) => {
  if (event.detail.token !== AdminAPI.getToken()) return;
  AdminAuth.clear();
  AdminAuth.redirectToLogin('expired');
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) requireAdminSession({ background: true });
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !isPublicAuthPage) requireAdminSession({ background: true });
});
for (const activity of ['pointerdown', 'keydown', 'touchstart', 'scroll']) {
  document.addEventListener(activity, () => AdminAuth.recordActivity(), { passive: true, capture: true });
}
AdminAuth.ready = requireAdminSession();

window.addEventListener('storage', (event) => {
  if (event.key === 'pwss-admin-refresh-token' && !event.newValue) {
    AdminAuth.clear();
    AdminAuth.redirectToLogin();
  }
});
