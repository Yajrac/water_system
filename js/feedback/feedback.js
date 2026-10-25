const feedbackPager=createPagination('feedbackPagination',showFeedback);
let feedbackVersion=0,feedbackTimer,feedbackSaving=false;
async function showFeedback(){
  const version=++feedbackVersion,body=document.getElementById('feedbackRows');
  if(!body.children.length)AdminUI.empty(body,6,'Loading feedback...');
  try{
    const query=new URLSearchParams({page:feedbackPager.page,search:document.getElementById('feedbackSearch').value.trim(),status:document.getElementById('feedbackStatus').value});
    const result=await AdminAPI.request('/feedback?'+query);if(version!==feedbackVersion)return;
    feedbackPager.update(result.pagination.total);body.replaceChildren();
    for(const entry of result.feedback){
      const row=body.insertRow();AdminUI.customer(row,{id:entry.customerId,name:entry.name,account:entry.account});
      AdminUI.cell(row,entry.date,'Date');AdminUI.cell(row,entry.category,'Category');
      AdminUI.cell(row,(entry.message||'').slice(0,100),'Feedback');
      const status=AdminUI.cell(row,entry.status,'Status');status.style.color=['New','Resolved'].includes(entry.status)?'#15803d':'#b45309';
      const actions=AdminUI.cell(row,'','View');const button=document.createElement('button');
      button.type='button';button.className='btn action-view';button.title='View feedback';button.setAttribute('aria-label','View feedback');
      const icon=document.createElement('i');icon.className='bi bi-eye';icon.setAttribute('aria-hidden','true');button.appendChild(icon);
      button.addEventListener('click',()=>viewFeedback(entry));actions.appendChild(button);
    }
    AdminUI.empty(body,6,'No feedback matches your filters.');
  }catch(error){if(version===feedbackVersion){body.replaceChildren();AdminUI.empty(body,6,error.message);AdminUI.message(error.message);}}
}
async function viewFeedback(entry){
  if(feedbackSaving)return;feedbackSaving=true;
  try{
    const preview=document.createElement('section'),message=document.createElement('p');message.textContent=entry.message||'';
    preview.appendChild(message);
    const notice=showNotice('Customer feedback',entry.name+' | '+entry.category+' | '+entry.date,preview);
    try {
      await AdminAPI.request('/feedback/'+encodeURIComponent(entry.id)+'/read',{method:'POST'});
      window.dispatchEvent(new Event('feedback-read'));
    } catch(error) { AdminUI.message(error.message); }
    await notice;
  }catch(error){AdminUI.message(error.message);}finally{feedbackSaving=false;}
}
document.getElementById('feedbackSearch').addEventListener('input',()=>{
  ++feedbackVersion;clearTimeout(feedbackTimer);feedbackPager.page=1;feedbackTimer=setTimeout(showFeedback,300);
});
document.getElementById('feedbackStatus').addEventListener('change',()=>{feedbackPager.page=1;showFeedback();});
AdminAuth.ready.then(user=>{if(user)showFeedback();});
