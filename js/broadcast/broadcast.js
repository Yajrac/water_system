const noticeForm = document.getElementById('noticeForm');
const audienceSelect = document.getElementById('noticeAudience');
const targetSelect = document.getElementById('noticeTarget');
const customerSearch = document.getElementById('noticeCustomerSearch');
const customerOptions = document.getElementById('noticeCustomerOptions');
const customerHint = document.getElementById('noticeCustomerHint');
const selectedCustomerIds = new Set();
let noticeCustomers = [], noticeAreas = [], noticeSaving = false, noticeReady = false;
function customerChoiceLabel(customer) {
  return [customer.name,customer.account,customer.submitterNumber,customer.username].filter(Boolean).join(' / ');
}
function matchingCustomers(customers,query) {
  const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return customers.filter(customer=>words.every(word=>customerChoiceLabel(customer).toLocaleLowerCase().includes(word)));
}
function eligibleCustomers() {
  return noticeCustomers.filter(customer=>!['Due date','Unpaid bill'].includes(noticeForm.elements.type.value) || Number(customer.balance)>0);
}
function selectedRecipients() {
  return eligibleCustomers().filter(customer=>audienceSelect.value==='all' ||
    (audienceSelect.value==='barangay' ? String(customer.barangayId)===targetSelect.value : selectedCustomerIds.has(String(customer.id))));
}
function showRecipientCount() {
  document.getElementById('recipientCount').textContent=selectedRecipients().length+' customers selected';
}
function renderCustomerOptions() {
  const eligible=eligibleCustomers();
  for(const id of selectedCustomerIds) if(!eligible.some(customer=>String(customer.id)===id)) selectedCustomerIds.delete(id);
  const matches=matchingCustomers(eligible,customerSearch.value);
  customerOptions.replaceChildren();
  for(const customer of matches) {
    const label=document.createElement('label'); label.className='recipient-choice';
    const checkbox=document.createElement('input'); checkbox.type='checkbox'; checkbox.checked=selectedCustomerIds.has(String(customer.id));
    checkbox.addEventListener('change',()=>{
      if(checkbox.checked) selectedCustomerIds.add(String(customer.id)); else selectedCustomerIds.delete(String(customer.id));
      showRecipientCount();
    });
    const details=document.createElement('span'); details.className='recipient-identity';
    const name=document.createElement('strong'); name.textContent=customer.name;
    details.append(name);
    label.title = customer.account || customer.name;
    label.append(checkbox,details);
    {
      const financials=document.createElement('span'); financials.className='recipient-financials';
      const balanceLabel=document.createElement('small'); balanceLabel.textContent='Balance';
      const balance=document.createElement('strong');balance.textContent=WaterStore.money(Number(customer.balance));
      financials.append(balanceLabel,balance);label.append(financials);
    }
    customerOptions.append(label);
  }
  customerHint.textContent=matches.length ? matches.length+' '+(matches.length===1?'customer matches':'customers match')+' your search. Selections are kept while searching.' : 'No eligible customers match your search.';
  showRecipientCount();
}
function changeAudience() {
  document.getElementById('noticeRecipientPanel').hidden=audienceSelect.value==='all';
  document.getElementById('noticeBarangayPicker').hidden=audienceSelect.value!=='barangay';
  document.getElementById('noticeCustomerPicker').hidden=audienceSelect.value!=='customer';
  targetSelect.required=audienceSelect.value==='barangay';
  targetSelect.replaceChildren(new Option('Select barangay',''));
  noticeAreas.forEach(area=>targetSelect.add(new Option(area.name,String(area.id))));
  renderCustomerOptions();
}
function changeNoticeType() {
  audienceSelect.value = 'customer';
  changeAudience();
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
  const publishButton = noticeForm.querySelector('button[type="submit"]');
  const publishContents = Array.from(publishButton.childNodes);
  publishButton.disabled = true;
  try {
    if (!(await confirmAction('Publish notification?',
      selectedRecipients().length + ' recipients: ' + selectedRecipients().slice(0,8).map(customer=>customer.name).join(', ') +
      (selectedRecipients().length>8?' and more. ':'. ') + 'This message will appear in their app.',
      'Publish'))) return;
    const spinner = document.createElement('span');
    spinner.className = 'notice-publish-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    publishButton.replaceChildren(spinner, document.createTextNode('Publishing…'));
    publishButton.setAttribute('aria-busy', 'true');
    const saved = await AdminAPI.request('/notifications',{method:'POST',body:{
      type:noticeForm.elements.type.value,audience:audienceSelect.value,target:targetSelect.value,
      ...(audienceSelect.value==='customer'?{targets:selectedRecipients().map(customer=>String(customer.id))}:{}),
      message:noticeForm.elements.message.value.trim(),status,
    }});
    noticeForm.reset(); selectedCustomerIds.clear(); changeNoticeType(); await showNotices();
    document.getElementById('notificationHistoryTab').click();
    await showNotice('Notification published successfully', 'Published to ' + saved.recipients + ' customer in-app feeds.');
  } catch(error) { AdminUI.message(error.message); }
  finally {
    noticeSaving=false;
    publishButton.replaceChildren(...publishContents);
    publishButton.removeAttribute('aria-busy');
    publishButton.disabled=false;
  }
});
audienceSelect.addEventListener('change',changeAudience);
targetSelect.addEventListener('change',showRecipientCount);
customerSearch.addEventListener('input',renderCustomerOptions);
noticeForm.elements.type.addEventListener('change',changeNoticeType);
document.getElementById('selectMatchingCustomers').addEventListener('click',()=>{
  matchingCustomers(eligibleCustomers(),customerSearch.value).forEach(customer=>selectedCustomerIds.add(String(customer.id)));
  renderCustomerOptions();
});
document.getElementById('clearSelectedCustomers').addEventListener('click',()=>{selectedCustomerIds.clear();renderCustomerOptions();});
noticeForm.inert=true;
AdminAuth.ready.then(async (user)=>{
  if (!user) return;
  try {
    [noticeCustomers,noticeAreas]=await Promise.all([AdminAPI.request('/notifications/recipients'),AdminAPI.request('/barangays')]);
    await showNotices(); changeNoticeType(); noticeReady=true; noticeForm.inert=false; AdminUI.message('');
  } catch(error) { AdminUI.message(error.message + ' Reload to retry.'); }
});
