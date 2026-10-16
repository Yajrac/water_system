const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
// Keep the focused field inside the visible area when a phone keyboard opens.
const loginViewport = window.visualViewport;
let loginViewportHeight = loginViewport ? loginViewport.height : window.innerHeight;
let loginScrollFrame = 0;
function keepLoginFieldVisible() {
  cancelAnimationFrame(loginScrollFrame);
  loginScrollFrame = requestAnimationFrame(() => {
    const field = document.activeElement;
    const mobile = window.matchMedia('(max-width: 700px)').matches;
    if (!mobile || !loginForm.contains(field) || field.tagName !== 'INPUT') {
      document.body.style.removeProperty('--auth-keyboard-space');
      loginViewportHeight = loginViewport ? loginViewport.height : window.innerHeight;
      return;
    }
    const visibleHeight = loginViewport ? loginViewport.height : window.innerHeight;
    const keyboardSpace = Math.max(0, loginViewportHeight - visibleHeight);
    document.body.style.setProperty('--auth-keyboard-space', keyboardSpace + 'px');
    const top = loginViewport ? loginViewport.offsetTop : 0;
    const bounds = field.getBoundingClientRect();
    const bottom = top + visibleHeight - 24;
    if (bounds.bottom > bottom) window.scrollBy({ top: bounds.bottom - bottom, behavior: 'instant' });
    else if (bounds.top < top + 24) window.scrollBy({ top: bounds.top - top - 24, behavior: 'instant' });
  });
}
loginForm.addEventListener('focusin', keepLoginFieldVisible);
loginForm.addEventListener('focusout', () => setTimeout(keepLoginFieldVisible, 0));
window.addEventListener('resize', keepLoginFieldVisible);
if (loginViewport) loginViewport.addEventListener('resize', keepLoginFieldVisible);
if (AdminAuth.loggedIn()) location.replace(AdminAuth.destination());

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const username = loginForm.elements.username.value.trim();
  const password = loginForm.elements.password.value;
  if (!AdminAuth.login(username, password)) {
    loginMessage.textContent = 'Incorrect username or password. Please try again.';
    loginMessage.focus();
    return;
  }
  location.replace(AdminAuth.destination());
});
document.getElementById('showPassword').addEventListener('click', (event) => {
  const input = loginForm.elements.password;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  document.getElementById('passwordEyeSlash').toggleAttribute('hidden', !show);
  event.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  event.currentTarget.title = show ? 'Hide password' : 'Show password';
  event.currentTarget.setAttribute('aria-pressed', String(show));
});
