// Public API address only. Never put database credentials or JWT secrets here.
// Set true to use XAMPP/local API while previewing on this computer.
// Set false to test the hosted API from Live Server or a deployed frontend.
const useLocalAdminApi = false;
const AdminApiConfig = {
  baseUrl: useLocalAdminApi && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
    ? 'http://' + location.hostname + ':3000/api/v1'
    : 'https://water-system-1.onrender.com/api/v1',
  timeoutMs: 15000,
};
