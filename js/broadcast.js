const noticeRecords = WaterStore.load();
const noticeForm = document.getElementById('noticeForm');
const audienceSelect = document.getElementById('noticeAudience');
const targetSelect = document.getElementById('noticeTarget');

function selectedRecipients() {
  const registered = noticeRecords.customers.filter(customer => WaterStore.isRegistered(customer));
  if (audienceSelect.value === 'all') return registered;
  if (audienceSelect.value === 'barangay') return registered.filter(customer => customer.barangay === targetSelect.value);
  return registered.filter(customer => customer.id === targetSelect.value);
}
function showRecipientCount() {
  document.getElementById('recipientCount').textContent = selectedRecipients().length + ' customers selected';
}
function changeAudience() {
  const audience = audienceSelect.value;
  document.getElementById('noticeTargetLabel').hidden = audience === 'all';
  targetSelect.required = audience !== 'all';
  targetSelect.replaceChildren();
  if (audience === 'barangay') {
    WaterStore.barangays.forEach(barangay => targetSelect.add(new Option(barangay, barangay)));
  } else if (audience === 'customer') AdminUI.options(targetSelect, noticeRecords.customers.filter(customer => WaterStore.isRegistered(customer)));
  showRecipientCount();
}
function showNotices() {
  const body = document.getElementById('noticeRows');
  body.replaceChildren();
  noticeRecords.notices.slice().reverse().forEach(notice => {
    const row = body.insertRow();
    [notice.date, notice.type, notice.audience, notice.customerIds.length, notice.message, 'Draft — not sent']
      .forEach((value, index) => AdminUI.cell(row, value, ['Created', 'Type', 'Audience', 'Recipients', 'Message', 'Status'][index]));
  });
  AdminUI.empty(body, 6, 'No notification drafts yet.');
}
noticeForm.addEventListener('submit', event => {
  event.preventDefault();
  const recipients = selectedRecipients();
  const message = noticeForm.elements.message.value.trim();
  if (!recipients.length || !message) return AdminUI.message('Select at least one recipient and enter a message.');
  let audience = 'All customers';
  if (audienceSelect.value === 'barangay') audience = targetSelect.value;
  if (audienceSelect.value === 'customer') audience = recipients[0].account + ' — ' + recipients[0].name;
  noticeRecords.notices.push({ id: WaterStore.id(), date: WaterStore.today(), type: noticeForm.elements.type.value, audience, customerIds: recipients.map(customer => customer.id), message });
  WaterStore.save(noticeRecords);
  noticeForm.reset(); changeAudience(); showNotices();
  AdminUI.message('Draft saved. No SMS or app notification was sent.');
});
audienceSelect.addEventListener('change', changeAudience);
targetSelect.addEventListener('change', showRecipientCount);
changeAudience(); showNotices();
