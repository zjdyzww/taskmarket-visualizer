const $=s=>document.querySelector(s)
let CHAIN='4217', RANGE='30d', DATA=null
const fmt=n=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(1)+'k':String(n)
async function load(){
  const r=await fetch('/api/data'); const j=await r.json()
  DATA=j; $('#asof').textContent=`data as of ${new Date(j.at).toUTCString()} · cached ${j.ageSec}s ago`
  render()
}
function c(){return DATA.data.chains[CHAIN]}
function render(){
  const s=c().stats
  const heads=[['Open tasks',s.openTasks],['Active agents 7d',s.activeAgents7d],['Active wallets',s.activeWallets],['Paid workers',s.paidWorkers],['Registered workers',s.registeredWorkers]]
  $('#headline').innerHTML=heads.map(([l,n])=>`<div class="card"><div class="n">${fmt(n)}</div><div class="l">${l}</div></div>`).join('')
  drawTs(); drawBreakdowns(); drawHeatmap(); drawFeed(); drawPosters()
}
function lineCanvas(id,labels,series){
  const cv=document.createElement('canvas'); cv.id=id
  const dpr=window.devicePixelRatio||1; cv.width=cv.clientWidth*dpr; cv.height=220*dpr
  const g=cv.getContext('2d'); g.scale(dpr,dpr); const W=cv.clientWidth,H=220,p=30
  const max=Math.max(...series.flatMap(s=>s.values),1)
  g.strokeStyle='#23272e';g.fillStyle='#9aa0a6';g.font='11px sans-serif'
  for(let i=0;i<=4;i++){const y=p+(H-2*p)*i/4;g.beginPath();g.moveTo(p,y);g.lineTo(W-6,y);g.stroke();g.fillText(fmt(max*(1-i/4)),0,y+4)}
  series.forEach((s,si)=>{g.strokeStyle=['#3b82f6','#22c55e','#f59e0b'][si];g.beginPath()
    s.values.forEach((v,i)=>{const x=p+(W-p-6)*i/(labels.length-1||1);const y=p+(H-2*p)*(1-v/max);i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke()})
  const lg=series.map((s,i)=>`<span style="color:${['#3b82f6','#22c55e','#f59e0b'][i]}">●</span> ${s.name}`).join('  ')
  return `<div>${lg}</div><canvas id="${id}">${''}</canvas>`
}
function drawTs(){
  const ts=c().timeSeries; const labels=ts.labels||ts.dates||[]
  const series=[
    {name:'Active agents',values:(ts.activeAgents||[]).map(v=>v??0)},
    {name:'Tasks posted',values:(ts.tasksPosted||[]).map(v=>v??0)},
    {name:'Rewards paid',values:(ts.rewardsPaid||[]).map(v=>v??0)},
  ].filter(s=>s.values.length)
  if(!series.length){$('#ts-charts').innerHTML='<p class="dim">no time-series data</p>';return}
  $('#ts-charts').innerHTML=series.map((s,i)=>`<h3 style="color:var(--dim);font-size:13px;margin:12px 0 4px">${s.name}</h3>`+spark(labels,s.values,i)).join('')
}
function spark(labels,vals,idx){
  const cv=document.createElement('canvas');cv.style.width='100%';cv.style.height='120px'
  const dpr=window.devicePixelRatio||1;cv.width=cv.clientWidth*dpr||600*dpr;cv.height=120*dpr
  const g=cv.getContext('2d');g.scale(dpr,dpr);const W=cv.clientWidth||600,H=120,p=10
  const max=Math.max(...vals,1);g.strokeStyle=['#3b82f6','#22c55e','#f59e0b'][idx];g.beginPath()
  vals.forEach((v,i)=>{const x=p+(W-2*p)*i/(vals.length-1||1);const y=p+(H-2*p)*(1-v/max);i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke()
  return cv
}
function drawBreakdowns(){
  const b=c().breakdowns
  const parts=[]
  if(b.byMode)parts.push(bar('Tasks by mode',b.byMode))
  if(b.byStatus)parts.push(bar('Tasks by status',b.byStatus))
  $('#breakdowns').innerHTML=parts.join('')||'<p class="dim">no breakdowns</p>'
}
function bar(title,obj){
  const entries=Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,8)
  const max=Math.max(...entries.map(e=>e[1]),1)
  return `<h3 style="color:var(--dim);font-size:13px;margin:12px 0 6px">${title}</h3>`+entries.map(([k,v])=>
    `<div style="display:flex;align-items:center;gap:8px;margin:3px 0"><span style="width:110px;font-size:13px;color:var(--dim)">${k}</span>
     <div style="flex:1;background:var(--card);height:14px;border-radius:3px"><div style="width:${(v/max*100).toFixed(1)}%;height:100%;background:var(--accent);border-radius:3px"></div></div>
     <span style="font-size:12px;color:var(--dim)">${fmt(v)}</span></div>`).join('')
}
function drawHeatmap(){
  const h=c().heatmap
  const cells=(h.cells||h.grid||[]).map(c=>c.value??c.count??0)
  if(!cells.length){$('#heatmap').innerHTML='<p class="dim">no heatmap</p>';return}
  const max=Math.max(...cells,1)
  const cols=24;const rows=Math.ceil(cells.length/cols)
  $('#heatmap').innerHTML=`<h3 style="color:var(--dim);font-size:13px">Activity by hour of week</h3><div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:2px">`
    +cells.map(v=>`<div style="aspect-ratio:1;border-radius:2px;background:rgba(59,130,246,${(v/max).toFixed(2)})" title="${v}"></div>`).join('')+'</div>'
}
function drawFeed(){
  const f=DATA.data.feed[CHAIN]
  const items=(f.items||f.feed||[]).slice(0,15)
  $('#feed-list').innerHTML=items.map(it=>`<li>${new Date(it.at||it.timestamp||it.createdAt).toUTCString().slice(0,22)} · ${it.kind||it.type||''} · ${it.detail||it.summary||JSON.stringify(it).slice(0,80)}</li>`).join('')||'<li>no feed</li>'
}
function drawPosters(){
  const tasks=DATA.data.tasks[CHAIN]||[]
  const byWeek={}
  tasks.forEach(t=>{
    const d=new Date(t.createdAt||t.postedAt||0); const wk=Math.floor(d.getTime()/6048e5)
    const p=t.requester||t.postedBy||t.requesterAddress||'?'
    (byWeek[wk]??=new Set()).add(p)
  })
  const weeks=Object.entries(byWeek).sort((a,b)=>a[0]-b[0]).slice(-8)
  const max=Math.max(...weeks.map(w=>w[1].size),1)
  $('#poster-chart').innerHTML=weeks.map(([wk,set])=>
    `<div style="display:flex;align-items:center;gap:8px;margin:3px 0"><span style="width:80px;font-size:12px;color:var(--dim)">${new Date(wk*6048e5).toISOString().slice(0,10)}</span>
     <div style="flex:1;background:var(--card);height:12px;border-radius:3px"><div style="width:${(set.size/max*100).toFixed(1)}%;height:100%;background:#22c55e;border-radius:3px"></div></div>
     <span style="font-size:12px;color:var(--dim)">${set.size}</span></div>`).join('')||'<p class="dim">no open tasks to count</p>'
}
document.querySelectorAll('#chain-switch button').forEach(b=>b.onclick=()=>{CHAIN=b.dataset.chain;document.querySelectorAll('#chain-switch button').forEach(x=>x.classList.toggle('on',x===b));load()})
document.querySelectorAll('#range button').forEach(b=>b.onclick=()=>{RANGE=b.dataset.range;document.querySelectorAll('#range button').forEach(x=>x.classList.toggle('on',x===b));load()})
load()
