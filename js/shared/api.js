class AdminApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

const AdminAPI = {
  tokenKey: 'pwss-admin-access-token',
  getToken() {
    return localStorage.getItem(this.tokenKey) || sessionStorage.getItem(this.tokenKey);
  },
  async request(path, { method = 'GET', body, authenticated = true, retryAuth = true } = {}) {
    if (location.protocol === 'file:') {
      throw new AdminApiError('Open the admin website with Live Server, then sign in again.');
    }
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw new Error('API paths must start with a single slash.');
    }
    if (authenticated && typeof AdminAuth !== 'undefined' && !AdminAuth.checkIdle()) {
      throw new AdminApiError('Session ended after 8 hours of inactivity.', 401);
    }
    if (authenticated && typeof AdminAuth !== 'undefined' && localStorage.getItem('pwss-admin-refresh-token')) {
      const current = this.getToken();
      let renew = !current;
      try {
        const part = current.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        renew = JSON.parse(atob(part)).exp * 1000 <= Date.now() + 60000;
      } catch { renew = true; }
      if (renew) await AdminAuth.renewSession();
    }
    const token = authenticated ? this.getToken() : null;
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AdminApiConfig.timeoutMs);
    try {
      const response = await fetch(AdminApiConfig.baseUrl.replace(/\/$/, '') + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 401 && token && retryAuth && typeof AdminAuth !== 'undefined' &&
          localStorage.getItem('pwss-admin-refresh-token')) {
        try {
          await AdminAuth.renewSession();
        } catch (error) {
          if (error.status === 401) window.dispatchEvent(new CustomEvent('admin:unauthorized', { detail: { token } }));
          throw error;
        }
        return await this.request(path, { method, body, authenticated, retryAuth: false });
      }
      if (response.status === 401 && token) {
        window.dispatchEvent(new CustomEvent('admin:unauthorized', { detail: { token } }));
      }
      if (!response.ok) {
        throw new AdminApiError(
          payload?.message || 'The request could not be completed. Please try again.',
          response.status,
        );
      }
      if (!payload || payload.success !== true) {
        throw new AdminApiError('The server returned an unexpected response.', response.status);
      }
      return payload.data;
    } catch (error) {
      if (error instanceof AdminApiError) throw error;
      throw new AdminApiError(
        error.name === 'AbortError'
          ? 'The server took too long to respond. Please try again.'
          : 'Cannot reach the server. Check your connection and try again.',
      );
    } finally {
      clearTimeout(timer);
    }
  },
};
