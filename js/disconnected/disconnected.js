const disconnectPager = createPagination('disconnectPagination',showDisconnections);
let changingAccount=false,disconnectVersion=0,disconnectTimer;
async function showDisconnections() {
  const version=++disconnectVersion;
  const body=document.getElementById('disconnectRows');
  if(!body.children.length)AdminUI.loading(body,6,'Loading service records...');
  try {
    const query=new URLSearchParams({page:disconnectPager.page,limit:10,
      search:document.getElementById('disconnectSearch').value.trim(),
      state:document.getElementById('disconnectStatus').value});
    const result=await AdminAPI.request('/customers/connections?'+query);
    if(version!==disconnectVersion)return;
    disconnectPager.page=result.pagination.page;disconnectPager.update(result.pagination.total);
    body.replaceChildren();
    for(const customer of result.customers) {
      const row=body.insertRow();AdminUI.customer(row,customer);
      AdminUI.cell(row,customer.disconnectedOn || 'Not recorded','Disconnected on');
      AdminUI.cell(row,customer.disconnectionReason || 'Not recorded','Reason');
      AdminUI.cell(row,WaterStore.money(Number(customer.outstanding)),'Outstanding balance');
      const status=AdminUI.cell(row,'','Status');const text=document.createElement('span');
      text.className=customer.active?'status-paid':'status-overdue';
      text.textContent=customer.connectionStatus;status.appendChild(text);
      const actions=AdminUI.cell(row,'','Actions');
      const profile=document.createElement('a');profile.className='btn action-view';
      profile.href='customer-profile.html?id='+encodeURIComponent(customer.id);
      profile.title='View customer';profile.setAttribute('aria-label','View customer');
      const icon=document.createElement('i');icon.className='bi bi-eye';icon.setAttribute('aria-hidden','true');profile.appendChild(icon);actions.appendChild(profile);
      const button=document.createElement('button');button.type='button';
      button.className='btn '+(customer.active?'action-deactivate':'action-reconnect');
      button.textContent=customer.active?'Disconnect':customer.connectionStatus==='Disconnected'?'Reconnect':'Activate';button.disabled=changingAccount;
      button.addEventListener('click',()=>changeConnection(customer));actions.appendChild(button);
    }
    AdminUI.empty(body,6,'No customer accounts match your filters.');
  } catch(error) { if(version===disconnectVersion){body.replaceChildren();AdminUI.empty(body,6,error.message);AdminUI.message(error.message);} }
}
async function changeConnection(customer) {
  if(changingAccount)return;
  changingAccount=true;
  document.querySelectorAll('#disconnectRows button').forEach(button=>button.disabled=true);
  try {
    const reason=document.createElement('textarea');reason.required=true;reason.maxLength=500;reason.rows=3;
    const label=document.createElement('label');label.textContent='Reason (required)';label.appendChild(reason);
    const preview=document.createElement('section');preview.appendChild(label);
    const disconnect=customer.active;
    const reconnect=customer.connectionStatus==='Disconnected';
    if(!disconnect && (customer.serviceStatus!=='Installed' || !customer.meterId)) {
      await showNotice('Installation required', 'Complete the installation date, meter number and Installed service status in Edit Customer before activation.');
      return;
    }
    if(!(await confirmAction(disconnect?'Disconnect service?':reconnect?'Reconnect service?':'Activate account?',customer.name+
      '\nOutstanding balance: '+WaterStore.money(Number(customer.outstanding))+
      '\nExisting bills and payments are retained. '+(disconnect?'New billing will be blocked.':'Installed meter details are required.'),
      disconnect?'Confirm disconnection':reconnect?'Confirm reconnection':'Confirm activation',preview)))return;
    if(!reason.value.trim())return AdminUI.message('Enter a reason before changing service status.');
    await AdminAPI.request('/customers/'+encodeURIComponent(customer.id)+'/status',{method:'PATCH',body:{
      status:disconnect?'Disconnected':'Active',reason:reason.value.trim(),revision:customer.revision}});
    await showNotice('Service status updated successfully',disconnect?'Service disconnected.':reconnect?'Service reconnected.':'Account activated.');
    await showDisconnections();
  } catch(error) {AdminUI.message(error.message);}
  finally {changingAccount=false;document.querySelectorAll('#disconnectRows button').forEach(button=>button.disabled=false);}
}
document.getElementById('disconnectSearch').addEventListener('input',()=>{
  clearTimeout(disconnectTimer);++disconnectVersion;disconnectPager.page=1;
  disconnectTimer=setTimeout(showDisconnections,300);
});
document.getElementById('disconnectStatus').addEventListener('change',()=>{disconnectPager.page=1;showDisconnections();});
AdminAuth.ready.then(user=>{if(user)showDisconnections();});
