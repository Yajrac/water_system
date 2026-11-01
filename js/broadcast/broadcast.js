const noticeForm = document.getElementById('noticeForm');
const audienceSelect = document.getElementById('noticeAudience');
const targetSelect = document.getElementById('noticeTarget');
const customerSearch = document.getElementById('noticeCustomerSearch');
const customerOptions = document.getElementById('noticeCustomerOptions');
const customerHint = document.getElementById('noticeCustomerHint');
const customerChoices = new Map();
function customerChoiceLabel(customer) {
  return [customer.name, customer.account, customer.submitterNumber, customer.username]
    .filter(Boolean).join(' — ') + ' [ID ' + customer.id + ']';
}
function selectCustomerChoice() {
  targetSelect.value = customerChoices.get(customerSearch.value) || '';
  customerSearch.setCustomValidity(targetSelect.value ? '' : 'Choose a customer from the suggestions.');
  showRecipientCount();
}
let noticeCustomers = [], noticeAreas = [], noticeSaving = false, noticeReady = false;
function selectedRecipients() {
  if (audienceSelect.value === 'all') return noticeCustomers;
  return noticeCustomers.filter((customer) => String(audienceSelect.value === 'barangay'
    ? customer.barangayId : customer.id) === targetSelect.value);
}
function showRecipientCount() {
  document.getElementById('recipientCount').textContent = selectedRecipients().length + ' customers selected';
}
function changeAudience() {
  const audience = audienceSelect.value;
  document.getElementById('noticeTargetLabel').hidden = audience === 'all';
  targetSelect.required = audience === 'barangay';
  targetSelect.hidden = audience === 'customer';
  customerSearch.hidden = audience !== 'customer';
  customerSearch.required = audience === 'customer';
  customerHint.hidden = audience !== 'customer';
  customerSearch.value = '';
  customerSearch.setCustomValidity('');
  customerChoices.clear();
  customerOptions.replaceChildren();
  targetSelect.replaceChildren();
  if (audience !== 'all') targetSelect.add(new Option('Select recipient', ''));
  if (audience === 'barangay') noticeAreas.forEach((area) => targetSelect.add(new Option(area.name, String(area.id))));
  if (audience === 'customer') noticeCustomers.forEach((customer) => {
    const label = customerChoiceLabel(customer);
    customerChoices.set(label, String(customer.id));
    targetSelect.add(new Option(label, String(customer.id)));
    customerOptions.append(new Option(label, label));
  });
  showRecipientCount();
}
async function showNotices() {
  const body = document.getElementById('noticeRows');
  const notices = await AdminAPI.request('/notifications');
  body.replaceChildren();
  for (const notice of notices) {
    const row = body.insertRow();
    [notice.date,notice.type,notice.audience,notice.recipients,notice.message,notice.status]
      .forEach((value,index)=>AdminUI.cell(row,value,['Created','Type','Audience','Recipients','Message','Status'][index]));
  }
  AdminUI.empty(body,6,'No notifications yet.');
}
noticeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (noticeSaving || !noticeReady) return;
  if (!selectedRecipients().length) return AdminUI.message('Select at least one customer.');
  const status = 'Published';
  noticeSaving = true;
  noticeForm.querySelector('button[type="submit"]').disabled = true;
  try {
    if (!(await confirmAction('Publish notification?',
      selectedRecipients().length + ' recipients. ' + 'This message will appear in their app.',
      'Publish'))) return;
    const saved = await AdminAPI.request('/notifications',{method:'POST',body:{
      type:noticeForm.elements.type.value,audience:audienceSelect.value,target:targetSelect.value,
      message:noticeForm.elements.message.value.trim(),status,
    }});
    noticeForm.reset(); changeAudience(); await showNotices();
    document.getElementById('notificationHistoryTab').click();
    await showNotice('Notification published successfully', 'Published to ' + saved.recipients + ' customer in-app feeds.');
  } catch(error) { AdminUI.message(error.message); }
  finally { noticeSaving=false; noticeForm.querySelector('button[type="submit"]').disabled=false; }
});
audienceSelect.addEventListener('change',changeAudience);
targetSelect.addEventListener('change',showRecipientCount);
customerSearch.addEventListener('input',selectCustomerChoice);
customerSearch.addEventListener('change',selectCustomerChoice);
noticeForm.inert=true;
AdminAuth.ready.then(async (user)=>{
  if (!user) return;
  try {
    [noticeCustomers,noticeAreas]=await Promise.all([AdminAPI.request('/notifications/recipients'),AdminAPI.request('/barangays')]);
    await showNotices(); changeAudience(); noticeReady=true; noticeForm.inert=false; AdminUI.message('');
  } catch(error) { AdminUI.message(error.message + ' Reload to retry.'); }
});
