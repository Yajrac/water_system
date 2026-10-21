// Public API address only. Never put database credentials or JWT secrets here.
// Override baseUrl here when the frontend and API use different production origins.
const AdminApiConfig = {
  baseUrl: ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
    ? 'http://' + location.hostname + ':3000/api/v1'
    : '/api/v1',
  timeoutMs: 15000,
};
