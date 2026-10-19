const feedbackForm = document.getElementById('feedbackForm');
const feedbackPager = createPagination('feedbackPagination', showFeedback);
let savingFeedback = false;
AdminUI.options(document.getElementById('feedbackCustomer'), WaterStore.load().customers);
function feedbackBadge(parent, status) {
  const badge = document.createElement('span');
  badge.className =
    'payment-status ' +
    (status === 'Resolved'
      ? 'status-paid'
      : status === 'In progress'
        ? 'status-unpaid'
        : 'feedback-new');
  badge.textContent = status;
  parent.appendChild(badge);
}
function showFeedback() {
  const records = WaterStore.load();
  const query = document.getElementById('feedbackSearch').value.trim().toLowerCase();
  const status = document.getElementById('feedbackStatus').value;
  const entries = (records.feedback || [])
    .slice()
    .reverse()
    .filter((entry) => {
      const customer = records.customers.find((item) => item.id === entry.customerId);
      return (
        (!status || entry.status === status) &&
        [customer?.name, customer?.account, entry.message, entry.category]
          .join(' ')
          .toLowerCase()
          .includes(query)
      );
    });
  const body = document.getElementById('feedbackRows');
  body.replaceChildren();
  feedbackPager.update(entries.length);
  feedbackPager.items(entries).forEach((entry) => {
    const row = body.insertRow();
    AdminUI.customer(
      row,
      records.customers.find((item) => item.id === entry.customerId),
    );
    AdminUI.cell(row, entry.date, 'Date');
    AdminUI.cell(row, entry.category, 'Category');
    AdminUI.cell(
      row,
      entry.message.length > 100 ? entry.message.slice(0, 100) + '...' : entry.message,
      'Feedback',
    );
    feedbackBadge(AdminUI.cell(row, '', 'Status'), entry.status);
    const actions = AdminUI.cell(row, '', 'View');
    AdminUI.button(actions, 'View', () => viewFeedback(entry.id));
    const view = actions.querySelector('button');
    view.classList.add('action-view', 'table-icon-button');
    view.title = 'View feedback';
    view.setAttribute('aria-label', 'View feedback');
    view.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  });
  AdminUI.empty(body, 6, 'No feedback matches your filters.');
}
async function viewFeedback(id) {
  const records = WaterStore.load();
  const entry = (records.feedback || []).find((item) => item.id === id);
  if (!entry) return AdminUI.message('Feedback no longer exists.');
  const preview = document.createElement('div');
  preview.className = 'feedback-review';
  const message = document.createElement('p');
  message.textContent = entry.message;
  message.className = 'feedback-message';
  const label = document.createElement('label');
  label.textContent = 'Status';
  const status = document.createElement('select');
  ['New', 'In progress', 'Resolved'].forEach((value) => status.add(new Option(value, value)));
  status.value = entry.status;
  label.appendChild(status);
  const notesLabel = document.createElement('label');
  notesLabel.textContent = 'Admin notes';
  const notes = document.createElement('textarea');
  notes.rows = 3;
  notes.maxLength = 1500;
  notes.value = entry.notes || '';
  notesLabel.appendChild(notes);
  const replyHistory = document.createElement('section');
  replyHistory.className = 'feedback-replies';
  const replyHeading = document.createElement('h3');
  replyHeading.textContent = 'Admin replies';
  replyHistory.appendChild(replyHeading);
  if (!entry.replies?.length) {
    const empty = document.createElement('p');
    empty.className = 'feedback-reply-empty';
    empty.textContent = 'No admin replies yet.';
    replyHistory.appendChild(empty);
  }
  (entry.replies || []).forEach((reply) => {
    const item = document.createElement('article');
    item.className = 'feedback-reply';
    const meta = document.createElement('small');
    const timestamp = new Date(reply.createdAt);
    meta.textContent =
      'Admin · ' +
      (!Number.isNaN(timestamp.getTime())
        ? new Intl.DateTimeFormat('en-PH', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Manila',
          }).format(timestamp)
        : reply.date);
    const text = document.createElement('p');
    text.textContent = reply.message;
    item.append(meta, text);
    replyHistory.appendChild(item);
  });
  const replyLabel = document.createElement('label');
  replyLabel.textContent = 'Write an admin reply';
  const replyInput = document.createElement('textarea');
  replyInput.rows = 3;
  replyInput.maxLength = 1500;
  replyInput.placeholder = 'Enter your response to this customer concern';
  replyInput.addEventListener('input', () =>
    replyInput.setCustomValidity(
      /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(replyInput.value)
        ? 'HTML tags and control characters are not allowed.'
        : '',
    ),
  );
  replyLabel.appendChild(replyInput);
  preview.append(message, replyHistory, replyLabel, label, notesLabel);
  const customer = records.customers.find((item) => item.id === entry.customerId);
  const accepted = await confirmAction(
    'Customer feedback',
    (customer?.name || 'Unknown customer') + '\n' + entry.category + ' · ' + entry.date,
    'Save changes',
    preview,
  );
  if (!accepted) return;
  try {
    const latest = WaterStore.load();
    const current = (latest.feedback || []).find((item) => item.id === id);
    if (JSON.stringify(current) !== JSON.stringify(entry))
      throw new Error('Feedback changed while open. Review it again.');
    AccountRecords.updateFeedback(latest, id, status.value, notes.value);
    if (replyInput.value.trim()) AccountRecords.replyToFeedback(latest, id, replyInput.value);
    WaterStore.save(latest);
    showFeedback();
    await showNotice(
      'Feedback saved successfully',
      replyInput.value.trim() ? 'Admin reply saved to the feedback record.' : 'Feedback updated.',
    );
  } catch (error) {
    AdminUI.message(error.message);
  }
}
feedbackForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (savingFeedback) return;
  savingFeedback = true;
  document.getElementById('feedbackSave').disabled = true;
  try {
    const records = WaterStore.load();
    const entry = AccountRecords.addFeedback(
      records,
      document.getElementById('feedbackCustomer').value,
      document.getElementById('feedbackCategory').value,
      document.getElementById('feedbackMessage').value,
    );
    const accepted = await confirmAction(
      'Save customer feedback?',
      entry.category + '\n\n' + entry.message,
      'Save feedback',
    );
    if (!accepted) return;
    const latest = WaterStore.load();
    AccountRecords.addFeedback(latest, entry.customerId, entry.category, entry.message);
    WaterStore.save(latest);
    feedbackForm.reset();
    showFeedback();
    document.querySelector('.service-entry').open = false;
    await showNotice('Feedback saved successfully', 'Customer feedback recorded.');
  } catch (error) {
    AdminUI.message(error.message);
  } finally {
    savingFeedback = false;
    document.getElementById('feedbackSave').disabled = false;
  }
});
document.getElementById('feedbackSearch').addEventListener('input', () => {
  feedbackPager.page = 1;
  showFeedback();
});
document.getElementById('feedbackStatus').addEventListener('change', () => {
  feedbackPager.page = 1;
  showFeedback();
});
showFeedback();
async function loadSampleFeedback() {
  const button = document.getElementById('feedbackSave');
  button.disabled = true;
  document.getElementById('feedbackRows').setAttribute('aria-busy', 'true');
  try {
    await fetchSampleServiceRecords();
    AdminUI.options(document.getElementById('feedbackCustomer'), WaterStore.load().customers);
    showFeedback();
  } catch {
    AdminUI.message(
      'Could not load sample records. Use a local web preview; existing records are still available.',
    );
  } finally {
    button.disabled = false;
    document.getElementById('feedbackRows').setAttribute('aria-busy', 'false');
  }
}
loadSampleFeedback();
