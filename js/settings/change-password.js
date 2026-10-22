const adminPasswordForm = document.getElementById('adminPasswordForm');
const passwordMessage = document.getElementById('passwordMessage');
const passwordSubmit = adminPasswordForm.querySelector('[type="submit"]');
let passwordBusy = false;

AdminAuth.ready.then(user => {
  if (!user) return;
  passwordSubmit.disabled = false;
  if (user.mustChangePassword) {
    document.getElementById('passwordSettingsTab').click();
    document.getElementById('passwordInstructions').textContent =
      'Replace your temporary password before continuing. Choose 8–128 characters; letters, numbers and symbols are allowed.';
    for (const id of ['adminLogsTab', 'consumerLogsTab']) document.getElementById(id).hidden = true;
  }
});

document.getElementById('showAdminPasswords').addEventListener('change', event => {
  for (const name of ['currentPassword', 'newPassword', 'confirmPassword']) {
    adminPasswordForm.elements[name].type = event.target.checked ? 'text' : 'password';
  }
});

adminPasswordForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (passwordBusy || !adminPasswordForm.reportValidity()) return;
  const currentPassword = adminPasswordForm.elements.currentPassword.value;
  const newPassword = adminPasswordForm.elements.newPassword.value;
  if (newPassword !== adminPasswordForm.elements.confirmPassword.value) {
    passwordMessage.textContent = 'Passwords do not match.';
    adminPasswordForm.elements.confirmPassword.focus();
    return;
  }
  if (currentPassword === newPassword) {
    passwordMessage.textContent = 'Choose a different password.';
    return;
  }
  passwordBusy = true;
  passwordSubmit.disabled = true;
  passwordSubmit.textContent = 'Changing password...';
  adminPasswordForm.setAttribute('aria-busy', 'true');
  passwordMessage.textContent = '';
  try {
    await AdminAPI.request('/auth/change-password', {
      method: 'POST', body: { currentPassword, newPassword },
    });
    AdminAuth.clear();
    adminPasswordForm.reset();
    location.replace('login.html?reason=password-changed');
  } catch (error) {
    passwordMessage.textContent = error.message;
    passwordMessage.focus();
    passwordBusy = false;
    passwordSubmit.disabled = false;
    passwordSubmit.textContent = 'Change password';
  } finally {
    adminPasswordForm.removeAttribute('aria-busy');
  }
});
