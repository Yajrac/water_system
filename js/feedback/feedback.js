const feedbackPager=createPagination('feedbackPagination',showFeedback);
let feedbackVersion=0,feedbackTimer,feedbackSaving=false;
function feedbackRelativeDate(value,now=new Date()){
  const match=/^(\d{4})-(\d{2})-(\d{2})/.exec(value||'');
  if(!match)return value||'';
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=type=>Number(parts.find(item=>item.type===type).value);
  const days=Math.round((Date.UTC(part('year'),part('month')-1,part('day'))-Date.UTC(+match[1],+match[2]-1,+match[3]))/86400000);
  return days===0?'Today':days===1?'Yesterday':days>1?days+' days ago':value;
}
function refreshFeedbackDates(){
  document.querySelectorAll('#feedbackRows [data-feedback-date]').forEach(cell=>{
    cell.textContent=feedbackRelativeDate(cell.dataset.feedbackDate);
    cell.setAttribute('aria-label',cell.textContent+', '+cell.dataset.feedbackDate);
  });
}
async function showFeedback(){
  const version=++feedbackVersion,body=document.getElementById('feedbackRows');
  if(!body.children.length)AdminUI.loading(body,6,'Loading feedback...');
  try{
    const query=new URLSearchParams({page:feedbackPager.page,search:document.getElementById('feedbackSearch').value.trim(),status:document.getElementById('feedbackStatus').value});
    const result=await AdminAPI.request('/feedback?'+query);if(version!==feedbackVersion)return;
    feedbackPager.update(result.pagination.total);body.replaceChildren();
    for(const entry of result.feedback){
      const row=body.insertRow();AdminUI.customer(row,{id:entry.customerId,name:entry.name,account:entry.account});
      const dateCell=AdminUI.cell(row,feedbackRelativeDate(entry.date),'Date');
      dateCell.dataset.feedbackDate=entry.date;dateCell.title=entry.date;
      dateCell.setAttribute('aria-label',feedbackRelativeDate(entry.date)+', '+entry.date);
      AdminUI.cell(row,entry.category,'Category');
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
setInterval(refreshFeedbackDates,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshFeedbackDates();});
