const noticeForm = document.getElementById('noticeForm');
const audienceSelect = document.getElementById('noticeAudience');
const targetSelect = document.getElementById('noticeTarget');
const customerSearch = document.getElementById('noticeCustomerSearch');
const customerOptions = document.getElementById('noticeCustomerOptions');
const customerHint = document.getElementById('noticeCustomerHint');
let customerMatches = [], customerActive = -1;
function closeCustomerOptions() {
  customerOptions.hidden = true;
  customerSearch.setAttribute('aria-expanded', 'false');
  customerSearch.removeAttribute('aria-activedescendant');
}
function matchingCustomers(customers, query) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return customers.filter(customer => {
    const text = customerChoiceLabel(customer).toLocaleLowerCase();
    return words.every(word => text.includes(word));
  });
}
function chooseCustomer(customer) {
  customerSearch.value = customer.name;
  targetSelect.value = String(customer.id);
  customerSearch.setCustomValidity('');
  closeCustomerOptions();
  showRecipientCount();
}
function renderCustomerOptions() {
  if (audienceSelect.value !== 'customer') return;
  const matches = matchingCustomers(noticeCustomers, customerSearch.value);
  customerMatches = matches.slice(0, 50); customerActive = -1;
  customerOptions.replaceChildren();
  customerSearch.removeAttribute('aria-activedescendant');
  customerMatches.forEach((customer, index) => {
    const option = document.createElement('div');
    option.id = 'notice-customer-option-' + index;
    option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false');
    const name = document.createElement('strong'); name.textContent = customer.name;
    const details = document.createElement('small');
    details.textContent = [customer.account, customer.submitterNumber, customer.username].filter(Boolean).join(' / ');
    option.append(name, details);
    option.addEventListener('mousedown', event => event.preventDefault());
    option.addEventListener('click', () => chooseCustomer(customer));
    customerOptions.append(option);
  });
  if (!matches.length || matches.length > 50) {
    const message = document.createElement('p');
    message.textContent = matches.length ? 'Showing 50 matches. Keep typing to narrow the list.' : 'No matching customers.';
    customerOptions.append(message);
  }
  customerOptions.hidden = false;
  customerSearch.setAttribute('aria-expanded', 'true');
}
function customerChoiceLabel(customer) {
  return [customer.name, customer.account, customer.submitterNumber, customer.username]
    .filter(Boolean).join(' — ');
}
function selectCustomerChoice() {
  targetSelect.value = '';
  customerSearch.setCustomValidity('Choose a customer from the suggestions.');
  showRecipientCount();
  renderCustomerOptions();
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
  closeCustomerOptions();
  customerOptions.replaceChildren();
  targetSelect.replaceChildren();
  if (audience !== 'all') targetSelect.add(new Option('Select recipient', ''));
  if (audience === 'barangay') noticeAreas.forEach((area) => targetSelect.add(new Option(area.name, String(area.id))));
  if (audience === 'customer') noticeCustomers.forEach((customer) => {
    const label = customerChoiceLabel(customer);
    targetSelect.add(new Option(label, String(customer.id)));
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
customerSearch.addEventListener('focus',renderCustomerOptions);
customerSearch.addEventListener('click',renderCustomerOptions);
customerSearch.addEventListener('blur',closeCustomerOptions);
customerSearch.addEventListener('keydown',event=>{
  if(event.key==='Escape' || event.key==='Tab'){closeCustomerOptions();return;}
  if(!['ArrowDown','ArrowUp','Enter'].includes(event.key))return;
  if(event.key==='Enter'){
    if(!customerOptions.hidden){event.preventDefault();if(customerActive>=0)chooseCustomer(customerMatches[customerActive]);}
    return;
  }
  event.preventDefault();
  if(customerOptions.hidden)renderCustomerOptions();
  if(!customerMatches.length)return;
  customerActive=(customerActive+(event.key==='ArrowDown'?1:-1)+customerMatches.length)%customerMatches.length;
  Array.from(customerOptions.querySelectorAll('[role="option"]')).forEach((option,index)=>{
    option.setAttribute('aria-selected',String(index===customerActive));
    if(index===customerActive){customerSearch.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});}
  });
});
noticeForm.inert=true;
AdminAuth.ready.then(async (user)=>{
  if (!user) return;
  try {
    [noticeCustomers,noticeAreas]=await Promise.all([AdminAPI.request('/notifications/recipients'),AdminAPI.request('/barangays')]);
    await showNotices(); changeAudience(); noticeReady=true; noticeForm.inert=false; AdminUI.message('');
  } catch(error) { AdminUI.message(error.message + ' Reload to retry.'); }
});
