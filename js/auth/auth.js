const AdminAuth = {
  user: null,
  sessionError: '',
  checking: null,
  expiryTimer: null,
  loggedIn() {
    return Boolean(this.user && AdminAPI.getToken());
  },
  clear() {
    clearTimeout(this.expiryTimer);
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
    if (localStorage.getItem('pwss-admin-refresh-token')) await this.renewSession();
    const token = AdminAPI.getToken();
    if (!token) {
      this.user = null;
      return null;
    }
    if (this.checking) return this.checking;
    this.checking = (async () => {
      const result = await AdminAPI.request('/auth/me');
      if (AdminAPI.getToken() !== token) return null;
      if (result?.user?.role !== 'admin') {
        this.clear();
        throw new AdminApiError('This account does not have admin access.', 403);
      }
      this.user = result.user;
      this.scheduleExpiry(token);
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
    localStorage.setItem(AdminAPI.tokenKey, result.accessToken);
    if (result.refreshToken) localStorage.setItem('pwss-admin-refresh-token', result.refreshToken);
    this.user = result.user;
    this.scheduleExpiry(result.accessToken);
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
    if (reason) query.set('reason', reason);
    location.replace('login.html?' + query);
  },
};

const currentAuthPage = location.pathname.split('/').pop();
const isPublicAuthPage = currentAuthPage === 'login.html';

// Hide protected content until the API has verified the current account.
const authGateStyle = document.createElement('style');
authGateStyle.textContent = `
  html.auth-pending body { visibility: hidden; }
  .admin-session-loading { display: none; }
  html.auth-pending .admin-session-loading {
    visibility: visible;
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    box-sizing: border-box;
    background: var(--bg-color, #edf8fc);
    color: var(--text-color, #15384a);
    font: 500 16px/1.5 system-ui, sans-serif;
    text-align: center;
  }
  .admin-session-loading p { margin: 0; }
  .admin-session-loading small { font-size: 13px; }
  .admin-session-spinner {
    width: 30px;
    height: 30px;
    border: 3px solid #bddce9;
    border-top-color: #0783b5;
    border-radius: 50%;
    animation: admin-session-spin .8s linear infinite;
  }
  @keyframes admin-session-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .admin-session-spinner { animation: none; }
  }
`;
document.head.appendChild(authGateStyle);
function mountSessionLoading() {
  if (isPublicAuthPage) return;
  const loading = document.createElement('div');
  loading.className = 'admin-session-loading';
  loading.setAttribute('role', 'status');
  loading.setAttribute('aria-live', 'polite');
  const spinner = document.createElement('span');
  spinner.className = 'admin-session-spinner';
  spinner.setAttribute('aria-hidden', 'true');
  const label = document.createElement('p');
  label.textContent = 'Checking session...';
  const hint = document.createElement('small');
  hint.textContent = 'Connecting securely. This may take a moment.';
  loading.append(spinner, label, hint);
  document.body.appendChild(loading);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountSessionLoading, { once: true });
} else {
  mountSessionLoading();
}

let adminPageVerified = false;
async function requireAdminSession({ background = false } = {}) {
  const checkInBackground = background && adminPageVerified;
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
    document.documentElement.classList.remove('auth-pending');
    return user;
  } catch (error) {
    if ([401, 403].includes(error.status)) AdminAuth.clear();
    AdminAuth.sessionError = error.message;
    // A connection failure does not prove that the existing session is invalid.
    // Protected API requests continue to enforce authentication on the server.
    if (checkInBackground && ![401, 403].includes(error.status)) return null;
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
AdminAuth.ready = requireAdminSession();

window.addEventListener('storage', (event) => {
  if (event.key === 'pwss-admin-refresh-token' && !event.newValue) {
    AdminAuth.clear();
    AdminAuth.redirectToLogin();
  }
});
