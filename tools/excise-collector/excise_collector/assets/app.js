'use strict';
const $ = (id) => document.getElementById(id);
let state = null;
let busy = false;
let paused = sessionStorage.getItem('collector-paused') === 'yes';
const labels = {downloaded:'PDF saved',unavailable:'Unavailable',review:'Needs review',retry:'Retry needed',awaiting_code:'Awaiting code',submitting:'Checking…'};
function notice(message='', error=false) { $('notice').textContent=message; $('notice').classList.toggle('error',error); $('notice').hidden=!message; }
async function api(path, body) {
  const response = await fetch(path, body === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed. Refresh the page to check saved progress.');
  return result;
}
function lock(value) {
  busy=value;
  document.querySelectorAll('button').forEach(b => b.disabled=value);
  $('pause').disabled=value || !state?.active;
}
function cell(row,text) { const td=document.createElement('td'); td.textContent=text; row.append(td); return td; }
function render(next) {
  const first=state===null;
  state=next;
  if(first && next.focus?.years) {
    const scope=$('scope');
    scope.elements.office.value=next.focus.office;
    scope.elements.years.value=next.focus.years.length===2?'both':String(next.focus.years[0]);
    scope.elements.era.value=next.focus.era;
    scope.elements.start.value=next.focus.start_cr;scope.elements.end.value=next.focus.end_cr;
  }
  const r=next.report, s=r.statuses;
  $('folder').textContent=r.raw_data_folder;
  $('progress').max=r.planned_lookups || 1; $('progress').value=r.checked_lookups;
  $('coverage').textContent=`${r.checked_lookups.toLocaleString()} of ${r.planned_lookups.toLocaleString()} queries checked across ${r.office_year_streams} office/year groups`;
  $('saved').textContent=(s.downloaded || 0).toLocaleString();
  $('unavailable').textContent=(s.unavailable || 0).toLocaleString();
  $('review').textContent=(s.review || 0).toLocaleString();
  $('remaining').textContent=r.remaining_lookups.toLocaleString();
  $('requests').textContent=`${next.portal_requests} / ${next.request_budget} portal requests this run`;
  const active=next.active;
  $('empty').hidden=!!active; $('active').hidden=!active; $('pause').disabled=busy || !active;
  if (active) {
    const t=active.task;
    $('reference').textContent=`CR ${String(t.cr_number).padStart(3,'0')} / ${t.year}`;
    $('office-name').textContent=t.office_name;
    $('period').textContent=`NDPS · Office ${t.office_id} · ${t.era==='before'?'Before':'From'} 1 June 2025`;
    $('security-image').src=active.image;
  }
  $('offices').replaceChildren();
  for (const o of next.catalogue?.offices || []) {
    const option=document.createElement('option'); option.value=`${o.era}:${o.id}`; option.label=o.name; $('offices').append(option);
  }
  $('register').replaceChildren(); $('no-results').hidden=next.recent.length>0;
  for (const item of next.recent) {
    const tr=document.createElement('tr');
    cell(tr,`CR ${String(item.cr_number).padStart(3,'0')} / ${item.year}`);
    const office=cell(tr,item.office_name), officeMeta=document.createElement('small');
    officeMeta.textContent=`${item.office_id} · ${item.era==='before'?'Earlier':'Newer'} office system`; office.append(officeMeta);
    const result=cell(tr,''), badge=document.createElement('span'); badge.className=`badge ${item.status}`; badge.textContent=labels[item.status] || item.status; result.append(badge);
    if(item.message) { const detail=document.createElement('small');detail.textContent=item.message;result.append(detail); }
    const action=cell(tr,'');
    if(item.sha256) { const link=document.createElement('a');link.href=`/files/${item.sha256}.pdf`;link.textContent='Download PDF';action.append(link); }
    if(['review','retry','unavailable'].includes(item.status)) {
      const button=document.createElement('button');button.textContent='Retry';button.type='button';button.addEventListener('click',()=>run(async()=>{await api('/api/retry',{task_id:item.id});await prepare();}));action.append(button);
    }
    $('register').append(tr);
  }
}
async function refresh() { render(await api('/api/state')); }
async function run(fn) {
  if(busy)return;
  lock(true);notice();
  try { await fn(); }
  catch(error) { notice(error.message,true); }
  finally { try { await refresh(); } catch(error) { notice(`Collector unavailable. Restart it to resume. ${error.message}`,true); } lock(false); }
}
async function prepare() {
  $('code').value='';
  const result=await api('/api/next',{});
  if(result.empty) { await refresh();notice(result.message); }
  else { render(result);setTimeout(()=>$('code').focus(),0); }
}
$('discover').addEventListener('click',()=>run(async()=>{await api('/api/discover',{});notice('Office catalogue refreshed. Add a scope to the queue.');}));
$('next').addEventListener('click',()=>run(async()=>{paused=false;sessionStorage.removeItem('collector-paused');await prepare();}));
$('refresh').addEventListener('click',()=>run(prepare));
$('pause').addEventListener('click',()=>run(async()=>{paused=true;sessionStorage.setItem('collector-paused','yes');await api('/api/pause',{});$('code').value='';notice('Paused. The current case stays queued.');}));
$('scope').addEventListener('submit',(event)=>{event.preventDefault();run(async()=>{
  const data=new FormData(event.target),years=data.get('years');
  await api('/api/pause',{});
  const result=await api('/api/plan',{office:data.get('office').trim(),years:years==='both'?[2025,2026]:[Number(years)],era:data.get('era'),start:Number(data.get('start')),end:Number(data.get('end'))});
  paused=false;sessionStorage.removeItem('collector-paused');
  notice(`Now checking ${result.selected_streams} office/year groups, covering ${result.selected_lookups.toLocaleString()} query positions. Previous results are preserved.`);
  await prepare();
});});
$('security').addEventListener('submit',(event)=>{event.preventDefault();run(async()=>{
  if(!state?.active)throw new Error('Prepare a new security image first.');
  const code=$('code').value;
  $('code').value='';
  let reply;
  try { reply=await api('/api/submit',{id:state.active.id,code}); }
  catch(error) {
    if(/security image.*(?:expired|no longer current)/i.test(error.message)) {notice(error.message,true);await prepare();return;}
    throw error;
  }
  render(reply.state);
  const result=reply.result;
  $('last-result').hidden=false; $('last-result').textContent=`${labels[result.outcome] || result.outcome}: ${result.message}`;
  if(['downloaded','unavailable','captcha'].includes(result.outcome) && $('auto-next').checked) {
    if(result.outcome==='captcha')notice('Security code was rejected. Enter the fresh image for the same case.',true);
    await prepare();
  }
  else if(['captcha','retry','review'].includes(result.outcome)) notice(`${result.message} Prepare a new image to retry, or review the query in the register.`,true);
});});
if(matchMedia('(max-width:760px)').matches)document.querySelector('aside details').open=false;
run(async()=>{
  await refresh();
  if(state.active && state.active.expires_at>Date.now()/1000){$('code').focus();return;}
  if(!paused && state.report.planned_lookups>state.report.checked_lookups) await prepare();
});
