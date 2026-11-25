const $=s=>document.querySelector(s)
let CHAIN='4217', RANGE='30d', DATA=null
const fmt=n=>{n=+n;return n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(1)+'k':String(n)}
const usdc=v=>{try{return (+v)/1e6}catch{return v}}
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
function drawTs(){
  const ts=c().timeSeries||[]
  if(!ts.length){$('#ts-charts').innerHTML='<p class="dim">no time-series data</p>';return}
  const labels=ts.map(p=>p.bucket||p.date||'')
  const series=[
    ['Active agents',ts.map(p=>p.activeAgents??0)],
    ['Tasks created',ts.map(p=>p.tasksCreated??0)],
    ['Reward volume (OUSD)',ts.map(p=>usdc(p.rewardVolume))],
  ]
  $('#ts-charts').innerHTML=series.map(([name,vals],i)=>`<h3 style="color:var(--dim);font-size:13px;margin:14px 0 4px">${name}</h3>`+spark(labels,vals,i)).join('')
}
function spark(labels,vals,idx){
  const cv=document.createElement('canvas');cv.style.width='100%';cv.style.height='120px'
  const dpr=window.devicePixelRatio||1;cv.width=(cv.clientWidth||600)*dpr;cv.height=120*dpr
  const g=cv.getContext('2d');g.scale(dpr,dpr);const W=cv.clientWidth||600,H=120,p=8
  const max=Math.max(...vals,1);g.strokeStyle=['#3b82f6','#22c55e','#f59e0b'][idx];g.lineWidth=2;g.beginPath()
  vals.forEach((v,i)=>{const x=p+(W-2*p)*i/(vals.length-1||1);const y=p+(H-2*p)*(1-v/max);i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke()
  return cv
}
function drawBreakdowns(){
  const b=c().breakdowns||{}
  const parts=[]
  if(b.mode)parts.push(bar('Tasks by mode',b.mode,'mode'))
  if(b.status)parts.push(bar('Tasks by status',b.status,'status'))
  if(b.actorType)parts.push(bar('By actor type',b.actorType,'actorType'))
  $('#breakdowns').innerHTML=parts.join('')||'<p class="dim">no breakdowns</p>'
}
function bar(title,arr,key){
  const entries=(arr||[]).sort((a,b)=>b.count-a.count).slice(0,8)
  const max=Math.max(...entries.map(e=>e.count),1)
  return `<h3 style="color:var(--dim);font-size:13px;margin:14px 0 6px">${title}</h3>`+entries.map(e=>
    `<div style="display:flex;align-items:center;gap:8px;margin:3px 0"><span style="width:120px;font-size:13px;color:var(--dim)">${e[key]}</span>
     <div style="flex:1;background:var(--card);height:14px;border-radius:3px"><div style="width:${(e.count/max*100).toFixed(1)}%;height:100%;background:var(--accent);border-radius:3px"></div></div>
     <span style="font-size:12px;color:var(--dim)">${fmt(e.count)}</span></div>`).join('')
}
function drawHeatmap(){
  const h=c().heatmap
  if(!h||!h.cells){$('#heatmap').innerHTML='<p class="dim">no heatmap</p>';return}
  const max=h.maxCount||Math.max(...h.cells.map(c=>c.count),1)
  const cols=h.colKeys?.length||24
  $('#heatmap').innerHTML=`<h3 style="color:var(--dim);font-size:13px">Activity by ${h.colKeys? 'hour of week':'week'} (rows=${h.rowKeys?.length}, cols=${cols})</h3>
    <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:2px">`
    +h.cells.map(c=>`<div style="aspect-ratio:1;border-radius:2px;background:rgba(59,130,246,${(c.count/max).toFixed(2)})" title="row ${c.row} col ${c.col}: ${c.count}"></div>`).join('')+'</div>'
}
function drawFeed(){
  const f=DATA.data.feed?.[CHAIN]
  const items=(f?.items||[]).slice(0,15)
  $('#feed-list').innerHTML=items.map(it=>`<li>${(it.timestamp||'').slice(0,19)} · ${it.type||''} · ${it.taskTitle||it.detail||JSON.stringify(it).slice(0,80)}</li>`).join('')||'<li>no feed</li>'
}
function drawPosters(){
  const tasks=DATA.data.tasks?.[CHAIN]||[]
  const byWeek={}
  tasks.forEach(t=>{
    const d=new Date(t.createdAt||t.postedAt||0); const wk=Math.floor(d.getTime()/6048e5)
    const p=t.requester||t.requesterPubkey||'?'
    (byWeek[wk]??=new Set()).add(p)
  })
  const weeks=Object.entries(byWeek).sort((a,b)=>a[0]-b[0]).slice(-8)
  const max=Math.max(...weeks.map(w=>w[1].size),1)
  $('#poster-chart').innerHTML=weeks.map(([wk,set])=>
    `<div style="display:flex;align-items:center;gap:8px;margin:3px 0"><span style="width:80px;font-size:12px;color:var(--dim)">${new Date(wk*6048e5).toISOString().slice(0,10)}</span>
     <div style="flex:1;background:var(--card);height:12px;border-radius:3px"><div style="width:${(set.size/max*100).toFixed(1)}%;height:100%;background:#22c55e;border-radius:3px"></div></div>
     <span style="font-size:12px;color:var(--dim)">${set.size} distinct</span></div>`).join('')||'<p class="dim">no open tasks to count</p>'
}
document.querySelectorAll('#chain-switch button').forEach(b=>b.onclick=()=>{CHAIN=b.dataset.chain;document.querySelectorAll('#chain-switch button').forEach(x=>x.classList.toggle('on',x===b));load()})
document.querySelectorAll('#range button').forEach(b=>b.onclick=()=>{RANGE=b.dataset.range;document.querySelectorAll('#range button').forEach(x=>x.classList.toggle('on',x===b));load()})
load()
