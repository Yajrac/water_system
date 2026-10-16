// Apply the theme before the page is drawn, then wire up the switch.
const themeKey = 'pio-duran-theme';
// Restore sidebar width in the head, before the browser paints the layout.
try {
  document.documentElement.classList.toggle(
    'sidebar-compact',
    localStorage.getItem('pio-duran-sidebar-compact') === 'true',
  );
} catch {
  /* Use the expanded sidebar if storage is unavailable. */
}
let savedTheme = null;
try {
  savedTheme = localStorage.getItem(themeKey);
} catch {
  /* Use the device preference if storage is unavailable. */
}
let currentTheme =
  savedTheme === 'dark' || savedTheme === 'light'
    ? savedTheme
    : window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  const button = document.getElementById('themeToggle');
  if (button) {
    const label = button.querySelector('.sidebar-tool-label') || button;
    label.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    button.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
    );
    button.title = button.getAttribute('aria-label');
  }
}
applyTheme(currentTheme);
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(currentTheme);
  const button = document.getElementById('themeToggle');
  if (!button) return;
  let switching = false;
  button.addEventListener('click', () => {
    if (switching) return;
    switching = true;
    button.disabled = true;
    document.documentElement.classList.add('theme-switching');
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    try {
      localStorage.setItem(themeKey, currentTheme);
    } catch {
      /* The switch still works for this page. */
    }
    setTimeout(() => {
      switching = false;
      button.disabled = false;
      document.documentElement.classList.remove('theme-switching');
    }, 700);
  });
});
window.addEventListener('storage', (event) => {
  if (event.key === themeKey && (event.newValue === 'dark' || event.newValue === 'light'))
    applyTheme(event.newValue);
});
