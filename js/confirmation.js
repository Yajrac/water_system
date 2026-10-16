// Reusable confirmation dialog. Nothing is saved until Confirm is selected.
function confirmAction(title, message, confirmLabel, preview = null) {
  if (document.getElementById('actionConfirmation')) return Promise.resolve(false);
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.id = 'actionConfirmation';
    dialog.className = 'confirmation-dialog';
    dialog.setAttribute('aria-labelledby', 'confirmationTitle');
    dialog.setAttribute('aria-describedby', 'confirmationMessage');
    const heading = document.createElement('h2');
    heading.id = 'confirmationTitle';
    heading.textContent = title;
    const description = document.createElement('p');
    description.id = 'confirmationMessage';
    description.textContent = message;
    const form = document.createElement('form');
    form.method = 'dialog';
    form.className = 'confirmation-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn'; cancel.value = 'cancel'; cancel.textContent = 'Cancel'; cancel.autofocus = true;
    const confirm = document.createElement('button');
    confirm.className = 'btn btn-primary'; confirm.value = 'confirm'; confirm.textContent = confirmLabel;
    form.append(cancel, confirm);
    dialog.append(heading, description, form);
    if (preview) {
      dialog.classList.add('has-preview');
      dialog.insertBefore(preview, form);
    }
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => {
      const accepted = dialog.returnValue === 'confirm';
      dialog.remove();
      resolve(accepted);
    }, { once: true });
    dialog.showModal();
  });
}

// Informational messages need only one acknowledgment button.
function showNotice(title, message) {
  if (document.getElementById('actionConfirmation')) return Promise.resolve();
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.id = 'actionConfirmation';
    dialog.className = 'confirmation-dialog';
    dialog.setAttribute('aria-labelledby', 'noticeTitle');
    dialog.setAttribute('aria-describedby', 'noticeMessage');
    const heading = document.createElement('h2'); heading.id = 'noticeTitle'; heading.textContent = title;
    const description = document.createElement('p'); description.id = 'noticeMessage'; description.textContent = message;
    const form = document.createElement('form'); form.method = 'dialog'; form.className = 'confirmation-actions';
    const button = document.createElement('button'); button.type = 'submit'; button.className = 'btn btn-primary'; button.textContent = 'Got it'; button.autofocus = true;
    form.appendChild(button); dialog.append(heading, description, form);
    dialog.addEventListener('close', () => { dialog.remove(); resolve(); }, { once: true });
    document.body.appendChild(dialog); dialog.showModal();
  });
}
