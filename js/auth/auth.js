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
    sessionStorage.removeItem('pwss-admin-session');
    this.user = null;
  },
  scheduleExpiry(token) {
    clearTimeout(this.expiryTimer);
    try {
      // Used only to schedule re-login; /auth/me verifies the token on the server.
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const expires = JSON.parse(atob(part)).exp * 1000;
      if (!Number.isFinite(expires)) return;
      const delay = Math.max(0, Math.min(expires - Date.now(), 2147483647));
      this.expiryTimer = setTimeout(() => {
        if (AdminAPI.getToken() !== token) return;
        this.clear();
        this.redirectToLogin('expired');
      }, delay);
    } catch {
      // Authentication decisions still come from /auth/me and API 401 responses.
    }
  },
  async verifySession() {
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
    sessionStorage.setItem(AdminAPI.tokenKey, result.accessToken);
    this.user = result.user;
    this.scheduleExpiry(result.accessToken);
    return this.user;
  },
  logout() {
    this.clear();
    location.replace('login.html');
  },
  destination() {
    const next = new URLSearchParams(location.search).get('next') || 'index.html';
    const allowed = [
      'index.html',
      'customers.html',
      'customer-form.html',
      'customer-application.html',
      'customer-profile.html',
      'barangays.html',
      'barangay-form.html',
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
const isPublicAuthPage = ['login.html', 'forgot-password.html'].includes(currentAuthPage);

// Hide protected content until the API has verified the current account.
const authGateStyle = document.createElement('style');
authGateStyle.textContent = 'html.auth-pending body { visibility: hidden; }';
document.head.appendChild(authGateStyle);

async function requireAdminSession() {
  if (!isPublicAuthPage) document.documentElement.classList.add('auth-pending');
  AdminAuth.sessionError = '';
  try {
    sessionStorage.removeItem('pwss-admin-session');
    const user = await AdminAuth.verifySession();
    if (!user && !isPublicAuthPage) {
      AdminAuth.redirectToLogin();
      return null;
    }
    document.documentElement.classList.remove('auth-pending');
    return user;
  } catch (error) {
    if ([401, 403].includes(error.status)) AdminAuth.clear();
    AdminAuth.sessionError = error.message;
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
  if (event.persisted) requireAdminSession();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !isPublicAuthPage) requireAdminSession();
});
AdminAuth.ready = requireAdminSession();
