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
    if (bounds.bottom > bottom)
      window.scrollBy({ top: bounds.bottom - bottom, behavior: 'instant' });
    else if (bounds.top < top + 24)
      window.scrollBy({ top: bounds.top - top - 24, behavior: 'instant' });
  });
}
loginForm.addEventListener('focusin', keepLoginFieldVisible);
loginForm.addEventListener('focusout', () => setTimeout(keepLoginFieldVisible, 0));
window.addEventListener('resize', keepLoginFieldVisible);
if (loginViewport) loginViewport.addEventListener('resize', keepLoginFieldVisible);
const loginSubmit = loginForm.querySelector('[type="submit"]');
const loginSubmitLabel = loginSubmit.querySelector('.auth-submit-label');
const loginSpinner = loginSubmit.querySelector('.auth-submit-spinner');
function setLoginProgress(busy, label) {
  loginSubmit.disabled = busy;
  loginSubmit.setAttribute('aria-busy', String(busy));
  loginSpinner.hidden = !busy;
  loginSubmitLabel.textContent = label;
}
let loginBusy = true;
setLoginProgress(true, 'Checking session...');
AdminAuth.ready.then((user) => {
  if (user) {
    location.replace(AdminAuth.destination());
    return;
  }
  const reason = new URLSearchParams(location.search).get('reason');
  loginMessage.textContent =
    AdminAuth.sessionError ||
    (reason === 'password-changed'
      ? 'Password changed successfully. Sign in with your new password.'
      : reason === 'idle'
      ? 'You were signed out after 8 hours of inactivity. Please sign in again.'
      : reason === 'expired'
      ? 'Your session has expired. Please sign in again.'
      : reason === 'unavailable'
        ? 'Cannot verify your session. Check the server connection and sign in again.'
        : '');
  loginBusy = false;
  setLoginProgress(false, 'Sign in');
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (loginBusy) return;
  loginBusy = true;
  setLoginProgress(true, 'Signing in...');
  loginForm.setAttribute('aria-busy', 'true');
  loginMessage.textContent = '';
  try {
    const username = loginForm.elements.username.value.trim();
    const password = loginForm.elements.password.value;
    await AdminAuth.login(username, password);
    loginForm.elements.password.value = '';
    location.replace(AdminAuth.destination());
  } catch (error) {
    loginMessage.textContent = error.message;
    loginMessage.focus();
  } finally {
    loginBusy = false;
    setLoginProgress(false, 'Sign in');
    loginForm.removeAttribute('aria-busy');
  }
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
