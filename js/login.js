const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
if (AdminAuth.loggedIn()) location.replace(AdminAuth.destination());

loginForm.addEventListener('submit', event => {
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
document.getElementById('showPassword').addEventListener('click', event => {
  const input = loginForm.elements.password;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  document.getElementById('passwordEyeSlash').toggleAttribute('hidden', !show);
  event.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  event.currentTarget.title = show ? 'Hide password' : 'Show password';
  event.currentTarget.setAttribute('aria-pressed', String(show));
});
