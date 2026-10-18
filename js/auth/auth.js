// Local prototype session only. Replace with server authentication before deployment.
const AdminAuth = {
  key: 'pwss-admin-session',
  loggedIn() {
    return sessionStorage.getItem(this.key) === 'active';
  },
  login(username, password) {
    if (username !== 'admin' || password !== 'Admin123!') return false;
    sessionStorage.setItem(this.key, 'active');
    return true;
  },
  logout() {
    sessionStorage.removeItem(this.key);
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
};
const currentAuthPage = location.pathname.split('/').pop();
function requireAdminSession() {
  if (!['login.html', 'forgot-password.html'].includes(currentAuthPage) && !AdminAuth.loggedIn()) {
    location.replace('login.html?next=' + encodeURIComponent(currentAuthPage + location.search));
  }
}
requireAdminSession();
window.addEventListener('pageshow', requireAdminSession);
