
"use strict";
const BLOB="https://mo-tfr-library.mo-podcast-feed.workers.dev";
// ease of use (2026-09-02): command-palette reflexes · press ⌘K or / to find a star;
// the intro card bows out after the first travel
addEventListener("keydown",e=>{
  if(((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k")||(e.key==="/"&&!/input|textarea|select/i.test((document.activeElement||{}).tagName||""))){
    e.preventDefault();const q=document.getElementById("q");q.focus();q.select();}
  if(e.key==="Escape"){const px=document.getElementById("px");if(document.getElementById("panel").classList.contains("open"))px.click();}});
addEventListener("pointerdown",function _f(){document.body.classList.add("moved");removeEventListener("pointerdown",_f);},{once:true});
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const gz=async u=>{const r=await fetch(u);if(!r.ok)throw new Error(u+" "+r.status);
  if(!u.split("?")[0].endsWith(".gz"))return r.json();
  const _b=new Uint8Array(await r.arrayBuffer());if(!(_b[0]===31&&_b[1]===139))return JSON.parse(new TextDecoder().decode(_b));const ds=new DecompressionStream("gzip");return JSON.parse(await new Response(new Blob([_b]).stream().pipeThrough(ds)).text());};
const J=u=>fetch(u).then(r=>{if(!r.ok)throw 0;return r.json();});

/* ── the corpus ─────────────────────────────────────────────────────────────── */
let ERAC={};
const ERAL={E:"Early patristic",L:"Later patristic",C:"Carolingian",H:"High medieval",R:"Reformation",P:"17th century onward"};
const ERAMID={E:275,L:480,C:850,H:1230,R:1545,P:1660};
const COMC={};const COMPAL=["#E8A94C","#D07A50","#7FA3C2","#B287AD","#7FB397","#A8B86A","#C9A96E"];
let NODES=[],BYS={},EDGES=[],EXAMPLE_EDGES=[],ADJ=null,READY=false;
const SHN={pl:"Latin Fathers",gf:"Greek Fathers",po:"Eastern Fathers",ed:"English Divines",md:"Medieval",rc:"Roman Catholic",lu:"Lutheran",rf:"Continental Reformed",hl:"Humanism and Law"};

function eraOf(y){return y<400?"E":y<700?"L":y<1050?"C":y<1450?"H":y<1610?"R":"P";}
function biographyYear(b){const text=b&&typeof b==='object'?(b.dates||String(b.bio||'').slice(0,160)):b;const match=String(text||'').match(/\b([1-9]\d{2,3})\b/);return match?+match[1]:0;}
function refineBiographyDates(nodes,original,initial,bios){let changed=false;nodes.forEach(n=>{if(original[n.i].y||biographyYear(initial[n.a]))return;const year=biographyYear(bios[n.a]);if(year&&(!n.yok||n.y!==year)){n.y=year;n.yok=true;n.e=eraOf(year);changed=true;}});return changed;}
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0)/4294967295;};

async function boot(){
  const _gb="?d="+Math.floor(Date.now()/6e5);
  const graphReady=Promise.all([gz(BLOB+"/v1/graph/authors.json.gz"+_gb),gz(BLOB+"/v1/graph/edges.json.gz"+_gb),J(BLOB+"/v1/authors.json").catch(()=>({}))]);
  // Shelf metadata is required for the same date/shelf fallbacks. Start it with
  // the graph, rather than adding a second network wave before the first draw.
  const rost={};
  const rostersReady=Promise.all(Object.keys(SHN).map(sh=>J(BLOB+`/v1/bible/${sh}/rooms/index.json`)
    .then(d=>{(d.authors||d||[]).forEach(r=>{if(r&&r.s&&(!rost[r.s]||(r.w||0)>rost[r.s].w))rost[r.s]={y:r.y,e:r.e,sh,w:r.w||0};});}).catch(()=>{})));
  const [g,e,bios]=await graphReady;
  const initialBios={...bios}; // First layout must not depend on biography request timing.
  window.__BIOS=bios;
  // the full biographies live in four per-shelf shards · merged in the background,
  // awaited briefly by the dossier so the profile is there on first open
  window.__BIOSP=Promise.all(["latin-fathers","greek-fathers","eastern-fathers","english-divines"]
    .map(f=>J(BLOB+"/v1/authors/"+f+".json").catch(()=>({}))))
    .then(shards=>{shards.forEach(d=>Object.entries(d).forEach(([k,v])=>{if(!window.__BIOS[k])window.__BIOS[k]=v;}));});
  // era + years from the shelf rosters: the rooms know their people
  await rostersReady;
  window.__ROOMS=rost;   // who actually HAS a room · the dossier's room door checks first
  const shsel=$("#shsel");
  if(shsel)Object.entries(SHN).forEach(([k,l])=>{const o=document.createElement("option");
    o.value=k;o.textContent=l;shsel.appendChild(o);});
  // the BIOS are the authority on dates · the ed roster filed Ussher under 'Later
  // patristic' with no year, and a dateless node drifts toward its sources' century
  const bioY={};
  Object.entries(initialBios).forEach(([name,b])=>{const year=biographyYear(b);if(year)bioY[name]=year;});
  const coms=[...new Set(g.nodes.map(n=>n.com))];
  coms.forEach((c,i)=>COMC[c]=COMPAL[i%COMPAL.length]);
  NODES=g.nodes.map((n,i)=>{
    const r=rost[n.s]||{};
    // BAKED YEAR FIRST (2026-09-01): the graph now ships n.y from the bios at build time —
    // placement no longer races the bio-shard fetches (Jerome sat at ~1550 on slow loads)
    let y=+n.y||bioY[n.a]||+r.y||0;
    const yok=!!y;                 // a MEASURED date; estimates place the star but are never printed
    if(!y){const e0=n.e||r.e;if(e0&&ERAMID[e0])y=ERAMID[e0]+Math.round((hash(n.s)-.5)*120);}
    // an anthology filed under its own title is a COLLECTION, not a person
    const coll=n.a.length>42||/gospels?|versions?|variants?|fragments|anthology|apocryph|texts on|documents relatifs|miracles de/i.test(n.a);
    return {...n,i,sh:n.sh||r.sh,y,yok,coll,e:y?eraOf(y):null};
  });
  BYS={};NODES.forEach(n=>BYS[n.s]=n);
  // unknown years borrow the average of their neighbours, twice over
  ADJ=NODES.map(()=>[]);
  e.edges.forEach(([a,b,w])=>{ADJ[a].push([b,w]);ADJ[b].push([a,w]);});
  for(let pass=0;pass<2;pass++)NODES.forEach(n=>{
    if(n.y)return;
    let s=0,c=0;ADJ[n.i].forEach(([j,w])=>{const m=NODES[j];if(m.y){s+=m.y*w;c+=w;}});
    if(c)n.y=Math.round(s/c);
  });
  NODES.forEach(n=>{if(!n.y)n.y=1000;if(!n.e)n.e=eraOf(n.y);});
  EDGES=e.edges;EXAMPLE_EDGES=EDGES.slice().sort((a,b)=>b[2]-a[2]);
  prepAmb();                     // the ambient index must exist before the first draw
  layout();READY=true;
  $("#legend").innerHTML=Object.entries(ERAL).map(([k,l])=>
      `<button class="lg" data-e="${k}" title="Show or hide this era"><i style="background:${ERAC[k]}"></i>${l}</button>`).join("")
    +'<span style="opacity:.75">size · citation rank</span>';
  $("#legend").addEventListener("click",e=>{const b=e.target.closest(".lg");if(!b)return;
    const k=b.dataset.e;
    if(ERA_OFF.has(k))ERA_OFF.delete(k);else ERA_OFF.add(k);
    if(ERA_OFF.size===Object.keys(ERAL).length)ERA_OFF.clear();   // all off = nothing left; snap back to all
    document.querySelectorAll("#legend .lg").forEach(x=>x.classList.toggle("off",ERA_OFF.has(x.dataset.e)));
    updFstat();draw();drawBrush();});
  // influence floor: percentile over pr, so the slider is meaningful whatever the distribution
  PRSORT=NODES.map(n=>n.pr).sort((a,b)=>a-b);
  const pr=$("#prq");if(pr)pr.addEventListener("input",()=>{
    const q=+pr.value;
    MINPR=q?PRSORT[Math.min(PRSORT.length-1,Math.floor(PRSORT.length*q/100))]:0;
    const pl=$("#prql");if(pl)pl.textContent=q?("top "+(100-q)+"%"):"All entries";
    updFstat();draw();drawBrush();});
  $("#period-key").innerHTML=Object.entries(ERAL).map(([k,label])=>`<span data-era="${k}"><i aria-hidden="true"></i>${label}</span>`).join("");
  initExplorer();route();draw();drawBrush();
  // Late biographies can replace an estimate, but never override a published
  // graph date or a date already present in the primary biography index.
  window.__BIOSP.then(()=>{
    if(refineBiographyDates(NODES,g.nodes,initialBios,bios)){updFstat();draw();drawBrush();}
  });
  // mobile first-paint race (audit 2026-09-03): the sky sat blank on phones until an
  // interaction forced a repaint · settle with two delayed redraws after boot
  setTimeout(()=>{resize();},400);
  setTimeout(()=>{resize();},1600);
}

/* ── the sky ────────────────────────────────────────────────────────────────── */
const cv=$("#sky"),ctx=cv.getContext("2d");
const bcv=$("#brushcv"),bctx=bcv.getContext("2d");
let W=0,H=0,DPR=1;
let view={y0:-120,y1:1860,cy:0.5,zy:1};        // year window + vertical center/zoom
let LENS="era",FOCUS=null,PATHV=null,SUBSET=null,HOV=null,SHELF_F="",SCOPE=null;
/* SAVE TO NOTEBOOK (2026-09-10): the same buttons as the research pages, through FRResearchNotebook only */
let SAVED=new Set();const refreshSaved=()=>{try{SAVED=window.FRResearchNotebook?.savedKeys?FRResearchNotebook.savedKeys():new Set();}catch(_){SAVED=new Set();}};refreshSaved();addEventListener('fr-notebook-updated',refreshSaved);
const refKey=(w,p)=>'fr|'+w+'|'+(p==null||p===''?'':String(p));
const saveBtn=(w,p,title,author,label)=>{if(!w||p==null||p==='')return '';const on=SAVED.has(refKey(w,p));return `<button type="button" class="pinb${on?' on':''}" data-save-passage="${esc(w)}" data-page="${esc(String(p))}" data-title="${esc(String(title||'').slice(0,90))}" data-author="${esc(String(author||'').slice(0,60))}" data-label="${esc(String(label||'').slice(0,240))}" aria-pressed="${on}">${on?'Saved':'Save passage'}</button>`;};
const saveWorkBtn=(w,title,author)=>{if(!w)return '';const on=SAVED.has(refKey(w,null));return `<button type="button" class="pinb pinb-work${on?' on':''}" data-save-work="${esc(w)}" data-title="${esc(String(title||'').slice(0,120))}" data-author="${esc(String(author||'').slice(0,60))}" aria-pressed="${on}">${on?'Saved':'Save work'}</button>`;};
document.addEventListener('click',async e=>{const b=e.target.closest('[data-save-passage],[data-save-work]');if(!b||b.closest('.ce-records'))return;e.preventDefault();e.stopPropagation();
  const N=window.FRResearchNotebook;if(!N?.saveWork){b.title='The notebook could not load.';return;}
  const isWork=b.hasAttribute('data-save-work'),slug=isWork?b.dataset.saveWork:b.dataset.savePassage,page=isWork?null:b.dataset.page,on=b.getAttribute('aria-pressed')==='true';b.disabled=true;
  try{if(on)await N.unsave(slug,page);else if(isWork)await N.saveWork({slug,title:b.dataset.title,author:b.dataset.author});else await N.savePassage({slug,page,title:b.dataset.title,author:b.dataset.author,label:b.dataset.label});}
  catch(err){b.title=(err&&err.message)||'This could not be saved.';b.disabled=false;return;}
  refreshSaved();const now=!on;document.querySelectorAll(isWork?`[data-save-work="${CSS.escape(slug)}"]`:`[data-save-passage="${CSS.escape(slug)}"][data-page="${CSS.escape(String(page))}"]`).forEach(x=>{x.classList.toggle('on',now);x.setAttribute('aria-pressed',String(now));x.textContent=now?'Saved':(x.hasAttribute('data-save-work')?'Save work':'Save passage');x.disabled=false;});b.disabled=false;});
// REAL FILTERS (owner 2026-09-06 "filtering should visibly change the web to have fewer
// nodes"): filters HIDE stars outright · dimming is reserved for hover/path emphasis.
let ERA_OFF=new Set(),MINPR=0,PRSORT=null;
const anyFilter=()=>!!(SCOPE||ERA_OFF.size||MINPR>0||brushWin);
function updFstat(){
  indexCounts=null;
  if(READY){renderAuthorIndex();renderConnectionExamples();}
  const el=document.getElementById("fstat");if(!el)return;
  if(!anyFilter()){el.style.display="none";return;}
  let v=0;NODES.forEach(n=>{if(!hidden(n))v++;});
  el.style.display="flex";
  el.innerHTML=`<b>${v.toLocaleString()}</b>&nbsp;of ${NODES.length.toLocaleString()} authors<button id="fclr" title="Clear every filter">clear ✕</button>`;
  const c=document.getElementById("fclr");if(c)c.onclick=clearFilters;
}
function clearFilters(){
  ERA_OFF.clear();MINPR=0;brushWin=null;$("#era-select").value="";$("#year-from").value="";$("#year-to").value="";$("#date-feedback").textContent="";
  const pr=document.getElementById("prq");if(pr)pr.value=0;
  const pl=document.getElementById("prql");if(pl)pl.textContent="All entries";
  document.querySelectorAll("#legend .lg").forEach(b=>b.classList.remove("off"));
  scopeShelf("");   // also resets SCOPE + view + fstat via its own path
  updFstat();drawBrush();
}
let brushWin=null;                            // [y0,y1] highlight window, else null
function resize(){DPR=Math.min(devicePixelRatio||1,2);const rect=$("#graph-frame").getBoundingClientRect();W=Math.max(1,rect.width);H=Math.max(1,rect.height);
  cv.width=W*DPR;cv.height=H*DPR;cv.style.width=W+"px";cv.style.height=H+"px";ctx.setTransform(DPR,0,0,DPR,0,0);
  const bw=bcv.parentElement.clientWidth,bh=bcv.parentElement.clientHeight;
  bcv.width=bw*DPR;bcv.height=bh*DPR;bctx.setTransform(DPR,0,0,DPR,0,0);
  if(READY){draw();drawBrush();}}
addEventListener("resize",resize);resize();

function layout(){
  // x = time; y = community band with a settled jitter
  const coms=[...new Set(NODES.map(n=>n.com))];
  const bandOf={};coms.forEach((c,i)=>bandOf[c]=i);
  const nb=coms.length;
  NODES.forEach(n=>{
    const b=bandOf[n.com];
    n.ny=.08+.84*hash(n.s+"|y");     // 0..1 vertical
    n.r=Math.max(2.5,Math.min(7,1.6+Math.sqrt(n.pr)*1.2));
  });
}
const xOf=n=>n.px??PLOTPOS.get(n.i)?.px??(((n.y-view.y0)/(view.y1-view.y0))*(W-80)+40);
const yOf=n=>{if(n.py!=null)return n.py;if(PLOTPOS.has(n.i))return PLOTPOS.get(n.i).py;const t=34,b=H-44;return t+((n.ny-view.cy)*view.zy+0.5)*(b-t);};
function graphColor(hex,alpha=1){const h=hex.replace('#','');return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${alpha})`;}
function nodeCol(n,a=1){return graphColor(ERAC[n.e]||GRAPH_FG,a);}
let GRAPH_FG='#1C1C1A',GRAPH_SOURCE='#8B641F',GRAPH_RECEPTION='#3C7567',GRAPH_PATH='#86607F';

function hidden(n,noBrush){
  if(SCOPE&&!SCOPE.has(n.i))return true;
  if(ERA_OFF.size&&ERA_OFF.has(n.e))return true;
  if(MINPR>0&&n.pr<MINPR)return true;
  if(!noBrush&&brushWin&&(n.y<brushWin[0]||n.y>brushWin[1]))return true;
  return false;
}
function dimmed(n){
  if(hidden(n))return true;
  if(SHELF_F&&n.sh!==SHELF_F)return true;
  if(SUBSET&&!SUBSET.has(n.i))return true;
  return false;
}
let GRAPH_DARK=false,PLOT=new Set(),PLOTPOS=new Map(),PLOTINST=[];
function preparePlot(){
 PLOTPOS.clear();PLOTINST=[];
 if(FOCUS!=null){
  const side=(keys,end)=>[...new Set(keys.map(k=>EDGES[k][end]).filter(i=>i!==FOCUS&&!hidden(NODES[i])))].slice(0,8);
  const left=side(NOUT[FOCUS],1),right=side(NIN[FOCUS],0);
  PLOT=new Set([FOCUS,...left,...right]);
  const add=(i,side,x,y)=>{const n={...NODES[i],px:x,py:y};PLOTINST.push(n);PLOTPOS.set(i+':'+side,n);if(!PLOTPOS.has(i))PLOTPOS.set(i,n);};
  add(FOCUS,'center',W*.48,H*.5);
  [left,right].forEach((list,side)=>list.forEach((i,k)=>add(i,side?'in':'out',W*(side?.83:.12),62+(k+.5)*(H-138)/Math.max(1,list.length))));
  $('#map-summary').textContent='Showing '+left.length+' sources and '+right.length+' citing authors (up to 8 each). Authors may appear on both sides.';
 }else{let ns=NODES.filter(n=>!hidden(n)&&(!SUBSET||SUBSET.has(n.i))).sort((a,b)=>(b.din||0)-(a.din||0));const limit=+$('#map-density').value;if(!SUBSET&&limit)ns=ns.slice(0,limit);PLOT=new Set(ns.map(n=>n.i));}
 $('#web-zoom').hidden=FOCUS!=null;
 $('#map-key').textContent=FOCUS!=null?'Sources on the left · Citing authors on the right':'Earlier authors to the left · Later authors to the right';
}
const graphInk=a=>graphColor(GRAPH_FG,a);
function draw(){
  if(!READY)return;
  preparePlot();ctx.clearRect(0,0,W,H);
  GRAPH_DARK=document.documentElement.dataset.theme==="dark"||(!document.documentElement.dataset.theme&&matchMedia("(prefers-color-scheme:dark)").matches);
  const palette=getComputedStyle(document.documentElement),token=k=>palette.getPropertyValue(k).trim();
  ERAC=Object.fromEntries(Object.keys(ERAL).map(k=>[k,token('--era-'+k)]));GRAPH_FG=token('--fg');GRAPH_SOURCE=token('--graph-source');GRAPH_RECEPTION=token('--graph-reception');GRAPH_PATH=token('--graph-path');
  ctx.fillStyle=token('--bg');ctx.fillRect(0,0,W,H);
  // century gridlines, whisper quiet
  ctx.strokeStyle=graphInk(.07);ctx.fillStyle=graphInk(.64);
  ctx.font="11px 'Source Serif Pro',serif";ctx.textAlign="center";
  const tickStep=[10,20,50,100,200,500,1000,2000].find(step=>(W-80)*step/(view.y1-view.y0)>=52)||2000;
  for(let y=Math.ceil(view.y0/tickStep)*tickStep;FOCUS==null&&y<view.y1;y+=tickStep){
    const x=((y-view.y0)/(view.y1-view.y0))*(W-80)+40;
    ctx.beginPath();ctx.moveTo(x,18);ctx.lineTo(x,H-28);ctx.stroke();
    ctx.fillText(String(y),x,H-12);
  }
  // ambient edges: the heaviest threads give the sky its texture
  const EGO=(FOCUS!=null)?FOCUS:((HOV!=null&&!PATHV)?HOV:null);
  const focusSet=EGO!=null?new Set([EGO, ...ADJ[EGO].map(([j])=>j)]):null;
  const edge=(k,style,lw)=>{const [a2,b2]=EDGES[k];if(!PLOT.has(a2)||!PLOT.has(b2))return;
    const na=FOCUS===b2?(PLOTPOS.get(a2+":in")||NODES[a2]):NODES[a2],nb=FOCUS===a2?(PLOTPOS.get(b2+":out")||NODES[b2]):NODES[b2];
    const x1=xOf(na),y1=yOf(na),x2=xOf(nb),y2=yOf(nb);
    ctx.strokeStyle=style;ctx.lineWidth=lw;
    ctx.beginPath();ctx.moveTo(x1,y1);
    ctx.quadraticCurveTo((x1+x2)/2,(y1+y2)/2-(x2-x1)*0.07,x2,y2);ctx.stroke();};
  // A JOURNEY draws the current author's own threads in the direction being followed (owner 2026-09-10 "follow
  // sources should be exactly like follow reception": the old ambient fallback happened to include a reader's
  // edges and none of a source's). Sources in amber, reception in verdigris, exactly as the focus view.
  const JD=(PATHV&&PATHV.length&&window.__JDIR&&NOUT.length)?{i:PATHV[PATHV.length-1],dir:window.__JDIR}:null;
  if(JD){ctx.lineWidth=.8;
    if(JD.dir!=='in')NOUT[JD.i].slice(0,120).forEach(k=>{const nb=NODES[EDGES[k][1]];if(dimmed(nb))return;edge(k,graphColor(GRAPH_SOURCE,.8),1.2);});
    if(JD.dir!=='out')NIN[JD.i].slice(0,120).forEach(k=>{const na=NODES[EDGES[k][0]];if(dimmed(na))return;edge(k,graphColor(GRAPH_RECEPTION,.8),1.2);});
  }else if(EGO!=null&&NOUT.length){
    // the star's own web, directional: whom he DRAWS ON in amber, who RECEIVED him in verdigris
    ctx.lineWidth=.8;
    NOUT[EGO].slice(0,80).forEach(k=>{const nb=NODES[EDGES[k][1]];if(dimmed(nb))return;
      edge(k,graphColor(GRAPH_SOURCE,.8),1.2);});
    NIN[EGO].slice(0,80).forEach(k=>{const na=NODES[EDGES[k][0]];if(dimmed(na))return;
      edge(k,graphColor(GRAPH_RECEPTION,.8),1.2);});
  }else{
    ctx.lineWidth=.6;
    const lim=Math.min(AMB.length, 4200);
    for(let k=0;k<Math.min(lim,100);k++){
      const [a,b,w]=EDGES[AMB[k]];
      const na=NODES[a],nb=NODES[b];
      if(dimmed(na)||dimmed(nb))continue;
      edge(AMB[k],graphInk(.50),.6);
    }
  }
  // the path, drawn as a golden thread
  if(PATHV){ctx.lineWidth=2;ctx.strokeStyle=graphColor(GRAPH_PATH,.95);
    ctx.beginPath();
    PATHV.forEach((i,k)=>{const n=NODES[i];k?ctx.lineTo(xOf(n),yOf(n)):ctx.moveTo(xOf(n),yOf(n));});
    ctx.stroke();ctx.shadowBlur=0;}
  // stars
  (PLOTINST.length?PLOTINST:NODES).forEach(n=>{
    if(!PLOT.has(n.i)||hidden(n)||(focusSet&&!focusSet.has(n.i))||(SUBSET&&!SUBSET.has(n.i)))return;
    const x=xOf(n),y=yOf(n);
    if(x<-20||x>W+20||y<20||y>H-40)return;
    const dim=dimmed(n)||(focusSet&&!focusSet.has(n.i));
    const a=dim?(FOCUS!=null?0.10:0.30):0.92;   // hover-ego dims gently; a click commits
    ctx.beginPath();ctx.arc(x,y,n.r,0,7);
    ctx.fillStyle=nodeCol(n,a);ctx.fill();

    if(FOCUS===n.i||PATHV&&PATHV.includes(n.i)){
      ctx.beginPath();ctx.arc(x,y,n.r+5,0,7);ctx.strokeStyle=graphInk(.9);ctx.lineWidth=1.4;ctx.stroke();}
  });
  if(FOCUS!=null){ctx.textAlign="center";ctx.font="12px Source Serif Pro";ctx.fillStyle=GRAPH_SOURCE;ctx.fillText("Cites",W*.12,28);ctx.fillStyle=GRAPH_RECEPTION;ctx.fillText("Cited by",W*.83,28);}
  // names for the bright and the chosen · biggest stars first, never overlapping
  ctx.textAlign="left";
  const placed=[],labelLimit=W<640?12:32,labelGap=W<640?8:5;
  const labelPoints=(PLOTINST.length?PLOTINST:NODES).filter(n=>PLOT.has(n.i)&&!hidden(n)).map(n=>({i:n.i,x:xOf(n),y:yOf(n),r:n.r+2}));
  const cand=(PLOTINST.length?PLOTINST:NODES).filter(n=>{
    if(!PLOT.has(n.i))return false;
    const chosen=FOCUS===n.i||(PATHV&&PATHV.includes(n.i))||HOV===n.i;
    if(n.coll&&!chosen)return false;
    if(!(n.r>=3||chosen||FOCUS!=null))return false;
    if(dimmed(n)&&!chosen)return false;
    if(focusSet&&!focusSet.has(n.i)&&!chosen)return false;
    return true;
  }).sort((a2,b2)=>{
    const ca=FOCUS===a2.i||HOV===a2.i,cb2=FOCUS===b2.i||HOV===b2.i;
    return (cb2?1:0)-(ca?1:0)||b2.r-a2.r;});
  cand.forEach(n=>{
    const x=xOf(n),y=yOf(n);
    if(x<-20||x>W+20||y<20||y>H-40)return;
    const chosen=FOCUS===n.i||(PATHV&&PATHV.includes(n.i))||HOV===n.i;
    if(!chosen&&FOCUS==null&&placed.length>=labelLimit)return;
    let t=n.a;if(t.length>(FOCUS!=null?22:26))t=t.slice(0,FOCUS!=null?21:25).replace(/[ ,·]+\S*$/,"")+"…";
    ctx.font=(chosen?"15px":"14px")+" 'EB Garamond',serif";
    const w2=ctx.measureText(t).width;
    let lx=x+n.r+5,flip=false;
    if(FOCUS!=null){lx=Math.max(6,Math.min(W-w2-6,x-w2/2));}
    if(lx+w2>W-8){lx=x-n.r-5-w2;flip=true;}          // flip to the left rather than clip
    if(lx<4&&!chosen)return;                          // still cut: no label at all
    const labelY=FOCUS!=null?y+n.r+20:y+4;const box=[lx-labelGap,labelY-15-labelGap,lx+w2+labelGap,labelY+4+labelGap];
    if(!chosen&&placed.some(b4=>!(box[2]<b4[0]||box[0]>b4[2]||box[3]<b4[1]||box[1]>b4[3])))return;
    if(!chosen&&FOCUS==null&&labelPoints.some(p=>p.i!==n.i&&p.x+p.r>box[0]&&p.x-p.r<box[2]&&p.y+p.r>box[1]&&p.y-p.r<box[3]))return;
    placed.push(box);
    ctx.fillStyle=graphInk(chosen?1:.82);
    ctx.fillText(t,lx,labelY);
  });
}
let AMB=[],NOUT=[],NIN=[];
function prepAmb(){AMB=EDGES.map((e,i)=>i).sort((i,j)=>EDGES[j][2]-EDGES[i][2]);
  // directed ego index (2026-09-01): every star knows its own threads, both directions —
  // hover/focus draws THEM (amber = draws on, verdigris = received by) instead of the
  // single-tone undirected wash
  NOUT=NODES.map(()=>[]);NIN=NODES.map(()=>[]);
  EDGES.forEach(([a2,b2],k)=>{if(NOUT[a2])NOUT[a2].push(k);if(NIN[b2])NIN[b2].push(k);});
  const byW=(x,y2)=>EDGES[y2][2]-EDGES[x][2];
  NOUT.forEach(l=>l.sort(byW));NIN.forEach(l=>l.sort(byW));}
function drawBrush(){
  const w=bcv.clientWidth||bcv.parentElement.clientWidth,h=bcv.clientHeight||44;
  bctx.clearRect(0,0,w,h);
  const bins=new Float32Array(120);
  NODES.forEach(n=>{if(hidden(n,true))return;
    const b=Math.max(0,Math.min(119,Math.floor((n.y-40)/(1740)*120)));bins[b]+=n.win+n.wout;});
  const mx=Math.max(...bins)||1;
  for(let i=0;i<120;i++){const v=Math.pow(bins[i]/mx,0.4);
    bctx.fillStyle=graphInk(.16+v*.65);
    const bw=w/120;bctx.fillRect(i*bw,h-6-v*(h-16),bw-1,v*(h-16)+2);}
  bctx.fillStyle=graphInk(.55);bctx.font="10px 'Source Serif Pro',serif";bctx.textAlign="center";
  [200,600,1000,1400,1700].forEach(y=>{bctx.fillText(y,(y-40)/1740*w,h-1);});
  if(brushWin){const x0=(brushWin[0]-40)/1740*w,x1=(brushWin[1]-40)/1740*w;
    bctx.fillStyle=graphInk(.14);bctx.fillRect(x0,0,x1-x0,h);
    bctx.strokeStyle=graphInk(.8);bctx.strokeRect(x0+.5,.5,x1-x0-1,h-1);}
}
/* brush drag = travel in time */
(function(){let d=null;
  const yAt=e=>{const r=bcv.getBoundingClientRect();
    return 40+Math.max(0,Math.min(1,((e.touches?e.touches[0].clientX:e.clientX)-r.left)/r.width))*1740;};
  const dn=e=>{d=yAt(e);brushWin=[d,d];e.preventDefault();};
  const mv=e=>{if(d==null)return;const y=yAt(e);brushWin=[Math.min(d,y),Math.max(d,y)];draw();drawBrush();};
  const up=()=>{if(d==null)return;if(brushWin&&brushWin[1]-brushWin[0]<24)brushWin=null;d=null;updFstat();draw();drawBrush();};
  bcv.addEventListener("mousedown",dn);addEventListener("mousemove",mv);addEventListener("mouseup",up);
  bcv.addEventListener("touchstart",dn,{passive:false});bcv.addEventListener("touchmove",mv,{passive:true});bcv.addEventListener("touchend",up);
})();
/* pan + zoom + hover + tap */
(function(){
  let drag=null,moved=false,pinch=null;
  const pt=e=>{const r=cv.getBoundingClientRect(),p=e.touches?e.touches[0]:e;return {x:p.clientX-r.left,y:p.clientY-r.top};};
  cv.addEventListener("mousedown",e=>{drag={...pt(e),v:{...view}};moved=false;cv.classList.add("drag");});
  addEventListener("mousemove",e=>{
    if(drag&&FOCUS==null){const p=pt(e),dy=(p.x-drag.x)/(W-40)*(drag.v.y1-drag.v.y0);
      const span=drag.v.y1-drag.v.y0;
      view.y0=drag.v.y0-dy;view.y1=drag.v.y1-dy;
      view.cy=drag.v.cy-(p.y-drag.y)/(H-140)/view.zy;
      if(Math.abs(p.x-drag.x)+Math.abs(p.y-drag.y)>4)moved=true;
      draw();return;}
    if(e.target!==cv)return;const n=pick(pt(e));HOV=n?n.i:null;cv.style.cursor=n?"pointer":"";
    const tip=$("#tip");
    if(n){tip.style.display="block";
      const cr=cv.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(innerWidth-280,e.clientX+14))+"px";tip.style.top=Math.min(innerHeight-110,e.clientY+12)+"px";
      tip.innerHTML=`<b>${esc(n.a)}</b><span>${n.yok?"c. "+n.y+" · ":""}${esc(ERAL[n.e]||"")}${n.sh?" · "+esc(SHN[n.sh]||n.sh):""}</span><br><span>PageRank ${n.pr.toFixed(1)} · cited by ${n.din} · community: ${esc(n.com)}</span>`;
    } else tip.style.display="none";
    draw();
  });
  addEventListener("mouseup",e=>{if(drag&&!moved){const n=pick(pt(e));if(n)openAuthor(n.s);}
    drag=null;cv.classList.remove("drag");});
  cv.addEventListener("wheel",e=>{e.preventDefault();
    if(FOCUS!=null)return;const f=Math.exp(-e.deltaY*0.0016);
    const px=(pt(e).x-20)/(W-40);
    const y=view.y0+px*(view.y1-view.y0);
    let span=(view.y1-view.y0)/f;span=Math.max(80,Math.min(1900,span));
    view.y0=y-px*span;view.y1=view.y0+span;draw();
  },{passive:false});
  cv.addEventListener("touchstart",e=>{
    if(e.touches.length===2){const [a,b]=e.touches;
      pinch={d:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),v:{...view}};}
    else{drag={...pt(e),v:{...view}};moved=false;}
  },{passive:true});
  cv.addEventListener("touchmove",e=>{
    if(pinch&&e.touches.length===2){const [a,b]=e.touches;
      const d2=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
      const mid=(a.clientX+b.clientX)/2-cv.getBoundingClientRect().left;
      const px=(mid-20)/(W-40);
      const y=pinch.v.y0+px*(pinch.v.y1-pinch.v.y0);
      let span=(pinch.v.y1-pinch.v.y0)*pinch.d/d2;span=Math.max(80,Math.min(1900,span));
      view.y0=y-px*span;view.y1=view.y0+span;draw();return;}
    if(drag&&FOCUS==null){const p=pt(e),dy=(p.x-drag.x)/(W-40)*(drag.v.y1-drag.v.y0);
      view.y0=drag.v.y0-dy;view.y1=drag.v.y1-dy;
      view.cy=drag.v.cy-(p.y-drag.y)/(H-140)/view.zy;
      if(Math.abs(p.x-drag.x)+Math.abs(p.y-drag.y)>6)moved=true;draw();}
  },{passive:true});
  cv.addEventListener("touchend",e=>{
    if(pinch){pinch=null;return;}
    if(drag&&!moved){const n=pick(drag);if(n)openAuthor(n.s);}
    drag=null;
  });
  function pick(p){let best=null,bd=14;
    (PLOTINST.length?PLOTINST:NODES).forEach(n=>{if(!PLOT.has(n.i)||dimmed(n))return;
      const d=Math.hypot(xOf(n)-p.x,yOf(n)-p.y)-n.r;
      if(d<bd){bd=d;best=n;}});
    return best;}
})();
$("#lens").addEventListener("click",e=>{const b=e.target.closest("button.lensb");if(!b)return;
  LENS=b.dataset.l;document.querySelectorAll("button.lensb").forEach(x=>x.classList.toggle("on",x===b));draw();});
// the web of ONE shelf (owner 2026-08-30 "just the web of English divines"; 2026-09-03
// "when I click a shelf I want the web to be changed, to be smaller"): choosing a shelf
// CONTRACTS the sky · the shelf's own authors plus the outside anchors they cite most —
// and refits the year window to the survivors. SHELF_F still dims (search/paths respect
// it); SUBSET carries the contraction. v1/graph/shelves.json is the membership map.
let _SHELVES=null,SHELF_SEQ=0;
async function scopeShelf(sh,push){
  const run=++SHELF_SEQ;
  const sel=$("#shsel");if(sel){sel.value=sh;sel.classList.toggle("on",!!sh);}
  if(!sh){SCOPE=null;SHELF_F="";view={y0:-120,y1:1860,cy:0.5,zy:1};updFstat();draw();drawBrush();
    if(push!==false)history.pushState(null,"","#");return;}
  if(!_SHELVES)_SHELVES=await J(BLOB+"/v1/graph/shelves.json").catch(()=>({}));
  if(run!==SHELF_SEQ)return;const mem=new Set();NODES.forEach(n=>{
    if(n.sh===sh||(_SHELVES[n.s]||[]).includes(sh))mem.add(n.i);});
  // the anchors: outside authors the shelf itself reads most (weighted in-degree
  // from members), capped so the shelf stays the subject of its own sky
  const pull={};
  EDGES.forEach(ed=>{const[a,b,w]=ed;
    if(mem.has(a)&&!mem.has(b))pull[b]=(pull[b]||0)+w;
    if(mem.has(b)&&!mem.has(a))pull[a]=(pull[a]||0)+w;});
  Object.entries(pull).sort((x,y)=>y[1]-x[1]).slice(0,Math.max(12,Math.round(mem.size*0.15)))
    .forEach(([i])=>mem.add(+i));
  SCOPE=mem;SHELF_F="";
  // refit the year window to the visible sky, with air on both sides
  let lo=Infinity,hi=-Infinity;
  NODES.forEach(n=>{if(mem.has(n.i)&&n.y){lo=Math.min(lo,n.y);hi=Math.max(hi,n.y);}});
  if(lo<hi){const pad=Math.max(60,(hi-lo)*0.09);view={y0:lo-pad,y1:hi+pad,cy:0.5,zy:1};}
  updFstat();draw();drawBrush();
  if(push!==false)history.pushState(null,"","#sh="+sh);
}
$("#shsel").addEventListener("change",e=>{scopeShelf(e.target.value);});

/* ── the paper panel ────────────────────────────────────────────────────────── */
const panel=$("#panel"),pbody=$("#pbody");
function openPanel(t,sub){$("#atlas").inert=false;$("#explorer").inert=false;document.body.classList.remove("shelf-comparison");panel.inert=false;const key=location.hash.slice(1).split("=")[0],mode=({v:"verse",t:"topic",p:"path",paths:"path",topics:"topic",shelves:"shelves"})[key]||"sky";document.querySelectorAll("#mnav [data-m]").forEach(a=>a.classList.toggle("on",a.dataset.m===mode));$("#pt").innerHTML=t;$("#ps").innerHTML=sub||"";panel.classList.add("open");document.body.classList.add("popen");requestAnimationFrame(resize);$("#pt").focus({preventScroll:true});renderAuthorIndex();}
$("#px").onclick=()=>{$("#atlas").inert=false;$("#explorer").inert=false;document.body.classList.remove("shelf-comparison");++__PSEQ;panel.inert=true;panel.classList.remove("open");document.body.classList.remove("popen");FOCUS=null;SUBSET=null;PATHV=null;window.__JDIR=null;draw();
  history.pushState(null,"","#");$("#map-title").textContent="The citation network";document.querySelectorAll("#mnav [data-m]").forEach(a=>a.classList.toggle("on",a.dataset.m==="sky"));fitNodes(NODES.filter(n=>!hidden(n)).map(n=>n.i));renderAuthorIndex();requestAnimationFrame(resize);restoreExplorerFocus();};
const shard=s=>gz(BLOB+"/v1/reception/"+s+".json.gz");
let _COMMS=null;
async function comms(){
  if(_COMMS)return _COMMS;
  const d=await J(BLOB+"/v1/commentaries.json").catch(()=>null);
  const m={};
  if(d){
    (d.sentences||[]).forEach(c=>m[c.w]={l:"Commentary on Peter Lombard’s Sentences"+(c.bk?" · Book "+c.bk:""),k:"sent"});
    (d.summa||[]).forEach(c=>m[c.w]={l:"Commentary on Thomas Aquinas’s Summa"+(c.p?" · "+c.p:""),k:"sum"});
    (d.bible||[]).forEach(c=>m[c.w]={l:"Scripture commentary: "+c.bk.replace(/-/g," ").replace(/\b\w/g,x=>x.toUpperCase()),k:"bib"});
    (d.compilations||[]).forEach(c=>m[c.w]={l:"Compilation · a reference may belong to a collected source",k:"comp"});
  }
  _COMMS={map:m,raw:d||{}};
  return _COMMS;}
const fmt=n=>n>=1000?(n/1000).toFixed(1).replace(/\.0$/,"")+"k":String(n);

let __PSEQ=0;   // dossier sequence guard (owner 2026-09-05: two quick opens raced · the
                // EARLIER author's shard resolved last and painted Eulogius's dossier
                // under Augustine's title; only the LATEST open may render)
async function openAuthor(slug,push=true){
  const n=BYS[slug];if(!n){++__PSEQ;openPanel("Author not found","This link does not match the citation index.");pbody.innerHTML='<p class="loading">Close this panel and search the author index for another spelling.</p>';return;}
  const __my=++__PSEQ;
  // the sky TRAVELS to a found star (owner 2026-08-29 'fix how the search bar works'):
  // a search means 'take me there' · center the century window and the vertical band
  fitNodes([n.i,...ADJ[n.i].slice().sort((a,b)=>b[1]-a[1]).slice(0,60).map(x=>x[0])]);
  FOCUS=n.i;SUBSET=null;PATHV=null;window.__JDIR=null;draw();
  if(push)history.pushState(null,"","#a="+slug);
  // SIGNED GRAPH (2026-09-02): a star whose received citations are largely refutations
  // is a battleground, not an authority · say so where the reader first looks
  const ctr=(n.ctr&&n.nin>=40)?` · <span style="color:var(--fg)" title="${n.nin} of ${n.win} received citations are refutations">contested ${Math.round(n.ctr*100)}%</span>`:"";
  openPanel(esc(n.a),`${n.yok?"c. "+n.y+" · ":""}${esc(ERAL[n.e]||"")}${n.sh?" · "+esc(SHN[n.sh]||""):""}${ctr}`);
  pbody.innerHTML='<p class="loading" role="status">Loading author connections…</p>';
  $("#map-title").textContent=n.a;$("#map-summary").textContent="Recorded citations to and from this author";
  let d=null;try{d=await shard(slug);if(__my!==__PSEQ)return;}catch(_){
    if(__my!==__PSEQ)return;
    // a star cited under a name that holds no works has no shard · the WEB still knows
    // its neighbors: build the dossier from the edges themselves (owner 2026-09-02, Jerome)
    const inn=[],out=[];
    EDGES.forEach(ed=>{if(ed[1]===n.i&&NODES[ed[0]])inn.push([ed[0],ed[2]]);
      if(ed[0]===n.i&&NODES[ed[1]])out.push([ed[1],ed[2]]);});
    inn.sort((x,y)=>y[1]-x[1]);out.sort((x,y)=>y[1]-x[1]);
    const row=([i2,w2])=>{const m=NODES[i2];
      return `<div class="edge"><div class="er"><span class="nm">${esc(m.a)} <i data-go="${esc(m.s)}" style="cursor:pointer;color:var(--accent)">View author</i></span><span class="n">${fmt(w2)}</span></div></div>`;};
    pbody.innerHTML=`
      <div class="metr"><div><b>${fmt(n.win)}</b>received citations</div><div><b>${fmt(n.wout)}</b>given</div><div><b>${n.pr.toFixed(1)}</b>PageRank</div></div>
      ${inn.length?`<h3 class="psect">Cited by</h3>${inn.map(row).join("")}`:""}
      ${out.length?`<h3 class="psect">Cites</h3>${out.map(row).join("")}`:""}
      <p style="color:var(--faint);font-size:.78rem;margin-top:.9rem">Cited under this name across the corpus; the passages live on each citing author's page.</p>`;
    pbody.querySelectorAll("[data-go]").forEach(el=>el.onclick=()=>openAuthor(el.dataset.go));
    return;}
  const hows={};[["in","Read by"],["out","Reads"]].forEach(([k])=>
    ((d[k]||{}).rows||[]).forEach(r=>Object.entries(r.how||{}).forEach(([h,c])=>hows[h]=(hows[h]||0)+c)));
  const eRow=(r,dir)=>{
    const link=BYS[r.fk]?` <i data-go="${esc(r.fk)}" style="cursor:pointer;color:var(--accent)">View author</i>`:"";
    const sms=(r.sm||[]).slice(0,4).map(s=>{const u=FRScripture.readerURL(s.cw,s.p),hl=s.sf?u.replace('#','&hl='+encodeURIComponent(String(s.sf).slice(0,120))+'#'):u;return `<div class="sm"><div class="q">“${esc(s.sf||s.loc||"")}”</div>
      <div class="m"><span>${esc(s.ct||s.cw||"")}${s.loc?" · "+esc(s.loc):""}</span>
      <a href="${hl}" target="_blank">open p. ${s.p} →</a>${saveBtn(s.cw,s.p,s.ct||s.cw,dir==="in"?r.a:n.a,(s.sf||'')+(s.loc?' — '+s.loc:''))}</div>${FRShelfMap.previewHTML(hl)}</div>`;}).join("")
      ||'<div class="sm"><div class="m">no sampled passages on this edge</div></div>';
    const cslug=dir==="in"?r.fk:slug, tslug2=dir==="in"?slug:r.fk;
    const pu2=pairURL(slug,r.fk);
    const allBtn=`<button class="pbtn" style="font-size:.74rem;padding:.2rem .7rem" data-edge="${esc(cslug)}|${esc(tslug2)}">Why connected · read ${fmt(r.n)} references</button>${pu2?` <a class="pbtn" style="font-size:.74rem;padding:.2rem .7rem" href="${pu2}">Compare the two authors</a>`:''}`;
    const tw=(r.tw||[]).slice(0,3).map(t=>`<a href="/the-faith-received/read/?w=${esc(t[0])}" target="_blank">${esc(t[1])}</a>`).join(" · ");
    return `<details class="edge" data-fk="${esc(r.fk||"")}" data-dir="${dir}"><summary class="er"><span class="nm">${esc(r.a)}</span>
      <span class="n">${fmt(r.n)} citations</span></summary>
      <div class="ev">${tw?`<div style="font-size:.8rem;margin:.2rem 0">${dir==="in"?"into":"of"} ${tw}</div>`:""}${sms}${allBtn}<span style="margin-left:.6rem">${link}</span></div></details>`;};
  const inn=((d.in||{}).rows||[]).slice().sort((a,b)=>b.n-a.n);
  const out=((d.out||{}).rows||[]).slice().sort((a,b)=>b.n-a.n);
  try{await Promise.race([window.__BIOSP,new Promise(r=>setTimeout(r,1400))]);}catch(_){}
  if(__my!==__PSEQ)return;
  const _b=window.__BIOS&&window.__BIOS[n.a];
  const _bt=_b&&(typeof _b==="object"?_b.bio:_b);
  const bioH=_bt?`<p style="font-size:.88rem;line-height:1.55;color:var(--muted);margin:.2rem 0 .6rem">${esc(String(_bt).slice(0,340))}${String(_bt).length>340?"…":""}</p>`:"";
  const collH=n.coll?`<p style="font-size:.8rem;color:var(--gold);margin:.2rem 0 .5rem">A collection or edition, not a person · its edges transmit the texts it gathers.</p>`:"";
  // traditional attributions read honestly: Walafrid's dossier says what he actually
  // holds (the Glossa Ordinaria) and whose work it really is
  let attrH="";
  try{const cm=await comms();
    const mine=(cm.raw.compilations||[]).filter(c=>c.a===n.a&&c.note);
    if(mine.length){const note=mine[0].note;
      attrH=`<p style="font-size:.8rem;color:var(--gold);margin:.2rem 0 .5rem">${esc(mine.length>1?mine.length+" of his shelved volumes are "+note:note)}</p>`;}
  }catch(_){}
  if(__my!==__PSEQ)return;
  pbody.innerHTML=`${collH}${attrH}${bioH}
    <div class="metr">
      <div><b>${inn.length.toLocaleString()}</b>citing authors</div>
      <div><b>${fmt(n.win)}</b>times cited</div>
      <div><b>${fmt(n.wout)}</b>citations made</div>
    </div>
    ${inn.length!==(n.din||0)?`<p class="index-coverage">The passage index lists ${inn.length.toLocaleString()} citing authors; the graph index lists ${(n.din||0).toLocaleString()}. Their coverage differs.</p>`:""}
    <div class="hows">${Object.entries(hows).sort((a,b)=>b[1]-a[1]).map(([h,c])=>`<span><b>${fmt(c)}</b> ${esc(h)}</span>`).join("")}</div>
    <div class="pbtns">
      <a class="pbtn warm" href="${journeyURL([slug],'in')}">Follow reception</a><a class="pbtn" href="${journeyURL([slug],'out')}">Follow sources</a><button class="pbtn" id="bpath">Find a connecting path</button>
      ${window.__ROOMS&&window.__ROOMS[slug]?`<a class="pbtn" href="/the-faith-received/fathers/?sh=${esc(window.__ROOMS[slug].sh)}#${esc(slug)}">Author room</a><a class="pbtn" href="${pairURL(slug,'')}">Compare with another author</a>`:""}
    </div>
    <div class="relation-tools"><label for="relation-query">Find a connection<input id="relation-query" type="search" placeholder="Filter connected authors"></label></div>
    <p id="relation-feedback" role="status"></p><h3 class="psect" id="relations-in-count">Cited by ${inn.length} authors</h3><div class="web-pane" data-relations="in">${inn.map(r=>eRow(r,"in")).join("")}</div>
    <h3 class="psect" id="relations-out-count">Cites ${out.length} authors</h3><div class="web-pane" data-relations="out">${out.map(r=>eRow(r,"out")).join("")}</div>`;
  pbody.querySelectorAll(".edge .er").forEach(el=>el.addEventListener("click",e=>{
    const go=e.target.closest("[data-go]");
    if(go){openAuthor(go.dataset.go);return;}
    if(el.tagName!=="SUMMARY")el.parentElement.classList.toggle("open");}));
  pbody.querySelectorAll("[data-edge]").forEach(el=>el.onclick=()=>{
    const [c2,t2]=el.dataset.edge.split("|");openEdge(c2,t2,slug);});
  pbody.querySelectorAll('[data-relations="out"] details.edge').forEach(det=>{
     det.addEventListener('toggle',async()=>{
       if(!det.open||det.dataset.citesLoaded)return;det.dataset.citesLoaded='1';
       const host=document.createElement('div');host.className='edge-inline';det.appendChild(host);
       const mount=async()=>{
         host.innerHTML='<p class="loading">Loading every citation…</p>';
         try{
           window.__FULL_SELF=window.__FULL_SELF||FRConnectionEvidence.json('/v1/reception/full/'+encodeURIComponent(slug)+'.json.gz');
           const d2=await window.__FULL_SELF;
           const fk=det.dataset.fk;const tn2=BYS[fk]||{s:fk,a:det.querySelector('.nm')?.textContent||fk};
           host.innerHTML='';
           FRConnectionEvidence.mountCitation(host,{data:d2,citing:{s:slug,a:n.a},target:tn2,hideSave:true});
         }catch(e){host.innerHTML='<p class="loading">The reference file could not load. Use “Why connected” instead.</p>';}
       };
       if(det.querySelector('.sm .q')){
         const b=document.createElement('button');b.className='pbtn';b.style.cssText='font-size:.74rem;padding:.2rem .7rem;margin:.3rem 0';
         b.textContent='Read all the citations here';b.onclick=e=>{e.preventDefault();b.remove();mount();};
         host.appendChild(b);
       } else { mount(); }
     });
   });
   FRShelfMap.bindPreviews(pbody);
  $("#bpath").onclick=()=>{openPathPicker();$("#path-from").value=n.a;$("#path-to").focus();};
  $("#relation-query").oninput=e=>{const term=e.target.value.trim().toLowerCase();let all=0;[['in','Cited by'],['out','Cites']].forEach(([dir,label])=>{const rows=[...pbody.querySelectorAll('[data-relations="'+dir+'"] .edge')];let visible=0;rows.forEach(row=>{row.hidden=!row.querySelector('.nm').textContent.toLowerCase().includes(term);if(!row.hidden)visible++;});all+=visible;$('#relations-'+dir+'-count').textContent=label+' '+visible+(term?' of '+rows.length:'')+' authors';});$('#relation-feedback').textContent=all?'':'No connected authors match this name. Try another spelling.';};
  pbody.scrollTop=0;
}

/* ── every place on one edge, readable (owner 2026-08-29: "i want to see the
   places and read them"). v1/reception/full/<citing>.json.gz holds EVERY row; rows from
   commentary works carry their mediation · a citation inside a Summa commentary reads
   Augustine THROUGH Thomas, and the tag says so. ── */
// /authors#A/with/B — the pair page (citations both ways, shared topics, Scripture); only for authors with a room
const pairURL=(a,b)=>{const R=window.__ROOMS||{};const first=R[a]?a:R[b]?b:null;if(!first)return null;const second=first===a?b:a;return `/the-faith-received/fathers/?sh=${encodeURIComponent(R[first].sh)}#${encodeURIComponent(first)}/with${second?'/'+encodeURIComponent(second):''}`;};
async function openEdge(citing, target, backSlug, push=true){
  const token=++__PSEQ;if(push)history.pushState(null,"","#e="+encodeURIComponent(citing)+","+encodeURIComponent(target));
  const cn=BYS[citing]||{s:citing,a:citing},tn=BYS[target]||{s:target,a:target};
  openPanel(`${esc(cn.a)} <span style="color:var(--muted)">cites</span> ${esc(tn.a)}`,"Why connected · recorded citation evidence");
  pbody.innerHTML='<p class="loading" role="status">Loading recorded passages…</p>';
  try{
    const [d,cm]=await Promise.all([FRConnectionEvidence.json('/v1/reception/full/'+encodeURIComponent(citing)+'.json.gz'),comms()]);
    if(token!==__PSEQ)return;
    const pu=pairURL(citing,target);
    pbody.innerHTML=`<div class="pbtns">${backSlug?'<button class="pbtn" id="ebk">Back to author</button>':''}${pu?`<a class="pbtn warm" href="${pu}">Full comparison · both directions, shared topics</a>`:''}<a class="pbtn" href="${journeyURL([target,citing],'in')}">Follow this reception</a><a class="pbtn" href="${journeyURL([citing,target],'out')}">Follow these sources</a></div><div id="edge-evidence"></div>`;
    FRConnectionEvidence.mountCitation($('#edge-evidence'),{data:d,citing:cn,target:tn,commentaries:cm});
    if($('#ebk'))$('#ebk').onclick=()=>openAuthor(backSlug);pbody.scrollTop=0;
  }catch(_){if(token!==__PSEQ)return;pbody.innerHTML='<p class="loading">The full reference file could not load. Your selected connection is kept.</p><button class="pbtn" id="edge-retry">Retry references</button><button class="pbtn" id="edge-fallback">View citing author</button>';$('#edge-retry').onclick=()=>openEdge(citing,target,backSlug,false);$('#edge-fallback').onclick=()=>openAuthor(citing);}
}

/* ── paths: the golden thread ───────────────────────────────────────────────── */
let PATHFROM=null,PATHEXT=null;
function bfsPath(a,b,direction='either'){return FRConnectionEvidence.directedPath(NODES,EDGES,a,b,direction);}
function citationStep(data,from,to){return FRConnectionEvidence.citationDirection(data,from,to);}
async function openPath(...args){
 let push=true,direction='either';
 if(typeof args.at(-1)==='boolean')push=args.pop();
 if(args.at(-1)&&!Array.isArray(args.at(-1))&&typeof args.at(-1)==='object')direction=args.pop().direction||'either';
 const stops=args.length===1&&Array.isArray(args[0])?args[0]:args,ns=stops.map(s=>BYS[s]);
 if(ns.length<2||ns.some(n=>!n))return;
 let path=[];
 for(let k=0;k<ns.length-1;k++){const leg=bfsPath(ns[k].i,ns[k+1].i,direction);if(!leg){++__PSEQ;openPanel('No path in this direction','The published graph contains no matching route.');pbody.innerHTML='<p class="ce-note">A missing indexed path does not establish that no historical connection existed.</p><button class="pbtn" id="path-again">Choose another path</button>';$('#path-again').onclick=()=>openPathPicker();return;}path=path.length?path.concat(leg.slice(1)):leg;}
 const chain=path.map(i=>NODES[i].s);
 openJourney(chain,direction,{push});
}
const journeyBranches=[],journeySelections=new Map();
function journeyURL(chain,direction='in',work='',targetWork=''){return '/the-faith-received/web/#journey='+chain.map(encodeURIComponent).join(',')+'?'+new URLSearchParams({direction,...work?{work}:{},...targetWork?{targetWork}:{}});}
function rememberJourney(chain,direction,work,targetWork){if(chain.length<2)return;const url=journeyURL(chain,direction,work,targetWork);if(!journeyBranches.some(b=>b.url===url))journeyBranches.unshift({url,label:chain.map(s=>BYS[s]?.a||s).join(' · ')});if(journeyBranches.length>12)journeyBranches.length=12;}
async function openJourney(chain,direction='in',options={}){
 const token=++__PSEQ;direction=['in','out','either'].includes(direction)?direction:'in';const work=options.work||'',targetWork=options.targetWork||'';
 const nodes=chain.map(s=>BYS[s]);
 if(!nodes.length||nodes.some(n=>!n)){openPanel('Citation journey','An author in this link is not present in the citation graph.');pbody.innerHTML='<p class="ce-note">Use the author index to choose a published graph entry.</p>';return;}
 const repeated=chain.findIndex((s,i)=>chain.indexOf(s)!==i);
 if(repeated>=0){openPanel('This journey returns to an earlier author','Repeated authors can create a cycle.');pbody.innerHTML=`<p class="ce-note">${esc(nodes[repeated].a)} already appears at step ${chain.indexOf(chain[repeated])+1}. Return to the preceding step to explore another branch.</p><a class="pbtn" href="${journeyURL(chain.slice(0,repeated),direction,work,targetWork)}">Open the preceding steps</a>`;return;}
 const steps=[];
 for(let i=0;i<nodes.length-1;i++){
   const left=nodes[i],right=nodes[i+1],out=EDGES.find(e=>e[0]===left.i&&e[1]===right.i),incoming=EDGES.find(e=>e[0]===right.i&&e[1]===left.i);
   const edge=direction==='out'?out:direction==='in'?incoming:out||incoming;
   if(!edge){openPanel('A step is not recorded','This link contains an edge absent from the published graph.');pbody.innerHTML=`<a class="pbtn" href="${journeyURL(chain.slice(0,i+1),direction,work,targetWork)}">Return to the last recorded step</a>`;return;}
   steps.push({citing:NODES[edge[0]],target:NODES[edge[1]],n:edge[2],key:NODES[edge[0]].s+'|'+NODES[edge[1]].s});
 }
 if(options.push!==false)history.pushState(null,'',journeyURL(chain,direction,work,targetWork));
 const current=nodes.at(-1),mode=direction==='in'?'Following reception':direction==='out'?'Following sources':'Connecting authors in either direction';
 // the map keeps the current author's neighbourhood in the chosen direction (owner 2026-09-10 "why does web disappear
 // when I click follow sources": the chain alone was one point). The chain stays the highlighted path.
 PATHV=nodes.map(n=>n.i);window.__CHAIN=chain;FOCUS=null;
 const showAround=sel=>{window.__JDIR=sel;const rows=[];for(const e of EDGES){if(e[0]===current.i&&sel!=='in')rows.push([e[1],e[2]]);if(e[1]===current.i&&sel!=='out')rows.push([e[0],e[2]]);}const around=rows.sort((a,b)=>b[1]-a[1]).slice(0,80).map(x=>x[0]);SUBSET=new Set([...PATHV,...around]);fitNodes([...SUBSET]);draw();};
 showAround(direction);
 openPanel('Citation journey',mode+' · '+current.a);
 pbody.innerHTML=`<div class="ce-journey"><p>${direction==='in'?'Each next author cites the preceding author.':direction==='out'?'Each next author is cited by the preceding author.':'This route can alternate citation directions; each step states who cites whom.'} These are documented references, not a verified chain of identical quotations.</p><ol class="ce-chain">${nodes.map((n,i)=>`<li><a href="${journeyURL(chain.slice(0,i+1),direction,work,targetWork)}">${esc(n.a)}</a><small>${esc(ERAL[n.e]||'Period not supplied')}${n.sh?' · '+esc(SHN[n.sh]||n.sh):''}</small></li>`).join('')}</ol><p class="ce-note">Period labels orient the authors. They are not dates of composition or publication.</p><div class="ce-path-steps">${steps.map((step,i)=>`<details class="ce-journey-step" data-journey-step="${i}"${i===steps.length-1?' open':''}><summary>${i+1}. ${esc(step.citing.a)} cites ${esc(step.target.a)}</summary><div class="ce-step-body"><p class="ce-note">Open this step to read its recorded references.</p></div></details>`).join('')}</div>${steps.length?'<button class="ce-save-path" disabled>Save selected journey</button><p class="ce-journey-feedback" id="journey-selection" role="status">Select source passages within a step to save this journey.</p>':''}<h3>Continue from ${esc(current.a)}</h3><label>Follow a direction<select id="journey-direction"><option value="in">Reception: authors who cite this author</option><option value="out">Sources: authors cited by this author</option><option value="either">Connections in either direction</option></select></label><label>Find the next author<input type="search" id="journey-query" placeholder="Filter recorded connections"></label><p class="ce-journey-feedback" id="journey-next-count" role="status"></p><div class="ce-next-list"></div><button class="ce-next-more" hidden>Show more authors</button><details class="ce-branch-history"><summary>Recently explored branches</summary><div></div></details></div>`;
 $('#journey-direction').value=direction;
 const historyBox=$('.ce-branch-history div');historyBox.innerHTML=journeyBranches.filter(b=>b.url!==journeyURL(chain,direction,work,targetWork)).map(b=>`<a href="${esc(b.url)}">${esc(b.label)}</a>`).join('')||'<p class="ce-note">Branches visited in this session appear here.</p>';
 const picked=new Map(steps.filter(step=>journeySelections.has(step.key)).map(step=>[step.key,journeySelections.get(step.key)]));
 const update=()=>{const sources=[...picked.values()].flat();if($('#journey-selection'))$('#journey-selection').textContent=sources.length?sources.length+' selected source passages across '+[...picked.values()].filter(s=>s.length).length+' steps':'Select source passages within a step to save this journey.';if($('.ce-save-path')){$('.ce-save-path').disabled=!sources.length;$('.ce-save-path').textContent='Save selected journey';}};
 if($('.ce-save-path'))$('.ce-save-path').onclick=()=>{const evidenceSteps=steps.filter(s=>picked.get(s.key)?.length).map(s=>({citing:s.citing.s,target:s.target.s,sources:picked.get(s.key)}));return FRConnectionEvidence.save($('.ce-save-path'),FRConnectionEvidence.researchNote('citation-journey',nodes.map(n=>n.a).join(' · '),[...picked.values()].flat(),{url:journeyURL(chain,direction,work,targetWork),authors:nodes.map(n=>n.a),research:{direction,chain:chain.slice(),steps:evidenceSteps}}));};
 pbody.querySelectorAll('[data-journey-step]').forEach(details=>{
   let loading=false,loaded=false;const step=steps[+details.dataset.journeyStep];
   const load=async()=>{if(!details.open||loading||loaded)return;loading=true;const body=details.querySelector('.ce-step-body');body.innerHTML='<p class="ce-note" role="status">Loading this step’s source references…</p>';
     try{const [data,cm]=await Promise.all([FRConnectionEvidence.json('/v1/reception/full/'+encodeURIComponent(step.citing.s)+'.json.gz'),comms()]);if(token!==__PSEQ)return;FRConnectionEvidence.mountCitation(body,{data,citing:step.citing,target:step.target,commentaries:cm,initialWork:+details.dataset.journeyStep===0?work:'',initialTarget:+details.dataset.journeyStep===0?targetWork:'',initialSources:picked.get(step.key)||[],hideSave:true,onSelection:sources=>{picked.set(step.key,sources);journeySelections.set(step.key,sources);update();}});loaded=true;}
     catch(_){if(token!==__PSEQ)return;body.innerHTML='<p class="ce-note">References for this step could not load.</p><button class="ce-step-retry">Retry this step</button>';body.querySelector('button').onclick=load;}finally{loading=false;}
   };details.addEventListener('toggle',load);if(details.open)load();
 });
 let nextLimit=30;
 const candidates=()=>{const selected=$('#journey-direction').value,rows=[];for(const e of EDGES){if(e[0]===current.i&&selected!=='in')rows.push({n:NODES[e[1]],weight:e[2],relation:'cites'});if(e[1]===current.i&&selected!=='out')rows.push({n:NODES[e[0]],weight:e[2],relation:'cited by'});}return rows.sort((a,b)=>b.weight-a.weight);};
 const renderNext=()=>{const q=$('#journey-query').value.trim().toLowerCase(),rows=candidates().filter(r=>!q||r.n.a.toLowerCase().includes(q)),box=$('.ce-next-list');$('#journey-next-count').textContent='Showing '+Math.min(nextLimit,rows.length)+' of '+rows.length+' recorded connections';$('.ce-next-more').hidden=rows.length<=nextLimit;box.innerHTML=rows.slice(0,nextLimit).map(r=>`<button data-next-author="${esc(r.n.s)}" data-next-relation="${r.relation}"><span>${esc(r.n.a)}${chain.includes(r.n.s)?'<small>Already at step '+(chain.indexOf(r.n.s)+1)+'; return here to branch</small>':''}</span><small>${esc(r.relation)} · ${fmt(r.weight)}</small></button>`).join('')||'<p class="ce-note">No recorded connections match this selection.</p>';box.querySelectorAll('button').forEach(button=>button.onclick=()=>{rememberJourney(chain,direction,work,targetWork);const slug=button.dataset.nextAuthor,prior=chain.indexOf(slug),selected=$('#journey-direction').value,newDirection=chain.length===1?selected:selected===direction?direction:'either';openJourney(prior>=0?chain.slice(0,prior+1):[...chain,slug],newDirection,{work,targetWork});});};
 $('#journey-query').oninput=()=>{nextLimit=30;renderNext();};$('#journey-direction').onchange=()=>{nextLimit=30;renderNext();showAround($('#journey-direction').value);};$('.ce-next-more').onclick=()=>{nextLimit+=30;renderNext();};renderNext();update();pbody.scrollTop=0;
}

/* ── doctrine flow ──────────────────────────────────────────────────────────── */
async function openTopic(slug,push=true){
 const token=++__PSEQ;if(push)history.pushState(null,'','#t='+encodeURIComponent(slug));openPanel('Topic connections','Loading available evidence…');pbody.innerHTML='<p class="loading" role="status">Loading topic…</p>';
 const d=await J(BLOB+'/v1/mine/topic2-all/'+slug+'.json').catch(()=>null);if(token!==__PSEQ)return;if(!d){pbody.innerHTML='<p class="index-note">This topic could not load.</p><button class="pbtn" id="topic-retry">Retry topic</button><a class="pbtn" href="/the-faith-received/topics/">Browse topics</a>';$('#topic-retry').onclick=()=>openTopic(slug,false);return;}
 const voices=FRResearch.voices(d),mapped=voices.map(r=>BYS[r.s]||NODES.find(n=>n.a===r.a)).filter(Boolean);SUBSET=new Set(mapped.map(n=>n.i));FOCUS=null;PATHV=null;window.__JDIR=null;draw();
 openPanel(esc(d.t),fmt(d.n_pages)+' indexed pages · '+fmt(d.n_pos)+' recorded positions');
 pbody.innerHTML=`${FRResearch.isRawTopic(d.t)?'<p class="index-note">This is an unreviewed extraction label. Its passages remain available, but the label is not an established topic.</p>':''}<p class="index-note">${fmt((d.pos||[]).length)} excerpts are available here. The map shows citation links among ${mapped.length} contributors with graph records; it does not show agreement about ${esc(d.t)}.</p><a class="pbtn warm" href="/the-faith-received/topics/#${encodeURIComponent(d.s||slug)}">Compare authors and explore this topic</a><label class="web-topic-search">Search available passages<input id="web-topic-evidence-q" type="search" placeholder="Author, work, or phrase"></label><p id="web-topic-evidence-count" role="status"></p><div id="web-topic-evidence" class="web-pane"></div><details class="web-topic-contributors"><summary>Browse ${voices.length} contributing authors</summary><label>Find a contributor<input id="web-topic-author-q" type="search" placeholder="Search contributors"></label><div id="web-topic-contributors" class="web-pane"></div></details>`;
 const render=()=>{const q=$('#web-topic-evidence-q').value.trim().toLowerCase(),rows=(d.pos||[]).filter(r=>!q||[r.a,r.wt,r.q].join(' ').toLowerCase().includes(q));$('#web-topic-evidence-count').textContent=rows.length+' available excerpts';$('#web-topic-evidence').innerHTML=rows.map(r=>`<article class="quote"><p class="q">${esc(r.q||'')}</p><div class="m"><strong>${esc(r.a||'')}</strong><span>${esc(r.wt||r.w||'')}</span>${r.w?`<a href="${FRScripture.readerURL(r.w,r.p)}">Read passage${r.p!=null?' · '+esc(r.p):''}</a>${saveBtn(r.w,r.p,r.wt||r.w,r.a,r.q)}`:''}</div>${r.w?FRShelfMap.previewHTML(FRScripture.readerURL(r.w,r.p)):''}</article>`).join('')||'<p class="index-note">No matching excerpts. Try another phrase.</p>';FRShelfMap.bindPreviews($('#web-topic-evidence'));};$('#web-topic-evidence-q').oninput=render;render();
 const renderAuthors=()=>{const q=$('#web-topic-author-q').value.trim().toLowerCase(),hits=voices.filter(r=>!q||r.a.toLowerCase().includes(q));$('#web-topic-contributors').innerHTML=hits.map(r=>{const n=BYS[r.s]||NODES.find(n=>n.a===r.a);return n?`<button class="web-topic-row" data-a="${esc(n.s)}"><span>${esc(r.a)}</span><small>View citations</small></button>`:r.s?`<a class="web-topic-row" href="${FRResearch.authorURL(r,d.t)}"><span>${esc(r.a)}</span><small>Read topic evidence</small></a>`:`<div class="web-topic-row"><span>${esc(r.a)}</span><small>No graph record</small></div>`;}).join('')||'<p class="index-note">No matching contributors.</p>';$('#web-topic-contributors').querySelectorAll('[data-a]').forEach(el=>el.onclick=()=>openAuthor(el.dataset.a));};$('#web-topic-author-q').oninput=renderAuthors;renderAuthors();pbody.scrollTop=0;
}

/* ── verse 360 ──────────────────────────────────────────────────────────────── */
let BOOKS=null,COMMS=null;
async function openVerse(book,ch,push=true){
  const token=++__PSEQ;
  if(push)history.pushState(null,'','#v='+book+'/'+ch);
  openPanel('Scripture','Loading chapter connections…');pbody.innerHTML='<p class="loading" role="status">Loading Scripture…</p>';
  BOOKS=BOOKS||await J(BLOB+'/v1/bible/all/books.json').catch(()=>null);
  let d;try{d=await gz(BLOB+`/v1/bible/all/${book}/${ch}.json.gz`);}catch(_){if(token!==__PSEQ)return;openPanel('Scripture','This chapter could not load.');pbody.innerHTML='<a class="pbtn" href="/the-faith-received/bible/">Browse Scripture</a><button class="pbtn" id="retry-verse">Retry chapter</button>';$('#retry-verse').onclick=()=>openVerse(book,ch,false);return;}
  if(token!==__PSEQ)return;
  const seen=new Map();(d.verses||[]).forEach(v=>(v.rows||[]).forEach(r=>{const cur=seen.get(r.a)||{a:r.a,n:0};cur.n++;seen.set(r.a,cur);}));
  const names=[...seen.values()],slugged=names.map(r=>NODES.find(n=>n.a===r.a)?.i).filter(i=>i!=null);
  SUBSET=new Set(slugged);FOCUS=null;PATHV=null;window.__JDIR=null;draw();
  const books=BOOKS?.books||[],B=books.find(b=>b.slug===book),chapters=B?.chapters||[];
  const controls=`<div class="web-scripture-nav"><label>Book<select id="pkb" class="pk">${books.map(b=>`<option value="${esc(b.slug)}"${b.slug===book?' selected':''}>${esc(b.book)}</option>`).join('')}</select></label><label>Chapter<select id="pkc" class="pk">${chapters.map(x=>`<option value="${x.c}"${x.c===+ch?' selected':''}>${x.c}</option>`).join('')}</select></label></div>`;
  openPanel(`${esc(d.book)} ${ch}`,`${names.length} authors in the indexed passages · ${slugged.length} shown on the graph`);
  const vs=(d.verses||[]).map(v=>{const rows=v.rows||[],authors=new Map();rows.forEach(r=>{if(!authors.has(r.a))authors.set(r.a,r);});return `<article class="vrow"><div class="vt"><a class="vn" href="${FRScripture.bibleURL(book,ch,v.v)}" aria-label="Read ${esc(d.book)} ${ch}:${v.v}">${v.v}</a>${esc(v.t||'')}</div>${rows.length?`<details class="web-verse-sources"><summary>${authors.size} authors · ${rows.length} indexed passages</summary>${[...authors].map(([name,r])=>`<div class="web-verse-source"><span>${esc(name)}</span><a href="${FRScripture.readerURL(r.w,r.p)}" target="_blank" rel="noopener">Read source</a></div>`).join('')}<a class="web-all-citations" href="${FRScripture.bibleURL(book,ch,v.v)}">Explore all citations for verse ${v.v}</a></details>`:''}</article>`;}).join('');
  pbody.innerHTML=`${controls}<nav class="web-chapter-links"><a href="${FRScripture.bibleURL(book,ch)}">Read chapter</a><a href="${FRScripture.bibleURL(book,ch,null,'commentaries')}">Commentaries</a><a href="${FRScripture.bibleURL(book,ch,null,'annotations')}">Whole-Bible annotations</a></nav><p class="scripture-status">Select an author on the graph to trace their connections, or open a verse’s sources below.</p>${vs}`;
  $('#pkb').onchange=e=>openVerse(e.target.value,1);$('#pkc').onchange=e=>openVerse(book,+e.target.value);pbody.scrollTop=0;
}
function openChainPicker(chain){
 ++__PSEQ;openPanel('Extend this path',chain.map(s=>esc(BYS[s]?.a||s)).join(' → '));
 pbody.innerHTML=`<form id="extend-path-form"><label for="extend-author">Add an author</label><input id="extend-author" list="extend-authors" required placeholder="Find the next author"><datalist id="extend-authors">${NODES.filter(n=>!n.coll).map(n=>`<option value="${esc(n.a)}"></option>`).join('')}</datalist><button class="pbtn warm" type="submit">Extend path</button><p id="extend-feedback" role="status"></p></form>`;
 $('#extend-path-form').onsubmit=e=>{e.preventDefault();const n=NODES.find(n=>n.a.toLowerCase()===$('#extend-author').value.trim().toLowerCase());if(!n||chain[chain.length-1]===n.s){$('#extend-feedback').textContent='Choose another author from the available names.';return;}openPath([...chain,n.s]);};
 $('#extend-author').focus();
}
function openPathPicker(push=true){
  if(push)history.pushState(null,'','#paths');
  ++__PSEQ;openPanel('Trace a connection','Choose two authors to follow the chain of citations.');
  pbody.innerHTML=`<form id="web-path-form"><label>From author<input id="path-from" list="path-authors" required placeholder="Augustine of Hippo"></label><label>To author<input id="path-to" list="path-authors" required placeholder="Thomas Aquinas"></label><datalist id="path-authors">${NODES.filter(n=>!n.coll).sort((a,b)=>a.a.localeCompare(b.a)).map(n=>`<option value="${esc(n.a)}"></option>`).join('')}</datalist><label>Direction<select id="path-direction"><option value="either">Either citation direction</option><option value="in">Follow reception</option><option value="out">Follow cited sources</option></select></label><button class="pbtn" type="submit">Find connection</button><p id="path-feedback" role="status"></p></form>`;
  $('#web-path-form').onsubmit=e=>{e.preventDefault();const find=id=>NODES.find(n=>n.a.toLowerCase()===$(id).value.trim().toLowerCase());const a=find('#path-from'),b=find('#path-to');if(!a||!b){$('#path-feedback').textContent='Select both authors from the available names.';return;}if(a.s===b.s){$('#path-feedback').textContent='Choose two different authors.';return;}openPath([a.s,b.s],{direction:$('#path-direction').value});};
}

/* ── find + modes + routing ─────────────────────────────────────────────────── */
const q=$("#q"),fl=$("#findlist");
q.addEventListener("keydown",e=>{const first=$('#author-index [data-author]');if(e.key==='ArrowDown'&&first){e.preventDefault();first.focus();}if(e.key==='Enter'&&first){e.preventDefault();first.click();}if(e.key==='Escape'&&!panel.classList.contains('open')){q.value='';indexQuery='';renderAuthorIndex();}});
function go(slug){fl.style.display="none";q.placeholder="Name or author…";
  if(PATHEXT){const ch=PATHEXT.concat([slug]);PATHEXT=null;openPath(ch);return;}
  if(PATHFROM){const from=PATHFROM;PATHFROM=null;openPath([from,slug]);return;}
  openAuthor(slug);}
$("#mnav").addEventListener("click",e=>{
  const el=e.target.closest("[data-m]");if(!el)return;e.preventDefault();
  document.querySelectorAll("#mnav a").forEach(x=>x.classList.toggle("on",x===el));
  const m=el.dataset.m;
  if(m==="shelves")openShelfMaps();
  if(m==="sky"){$("#px").click();}
  if(m==="path")openPathPicker();
  if(m==="topic")openTopicIndex();
  if(m==="verse")openVerse("romans",8);
});
async function openShelfMaps(shelf='english-divines',kind='authors',push=true){
 const token=++__PSEQ;if(push)history.pushState(null,'','#shelves='+encodeURIComponent(shelf)+'/'+kind);
 openPanel('Shelf connections','Explore Scripture citation patterns and topics recorded together.');document.body.classList.add('shelf-comparison');$('#atlas').inert=true;$('#explorer').inert=true;pbody.innerHTML='<p class="loading" role="status">Loading shelf maps…</p>';
 const idx=await J(BLOB+'/v1/mine/constellations/index.json').catch(()=>null);if(token!==__PSEQ)return;
 const shelves=idx?.shelves||[],entry=shelves.find(s=>s.slug===shelf||s.s===shelf)||shelves.find(s=>s.shelf==='English Divines')||shelves[0];
 if(!entry){pbody.innerHTML='<p class="index-note">Shelf maps could not load.</p><button class="pbtn" id="shelf-retry">Retry shelf maps</button>';$('#shelf-retry').onclick=()=>openShelfMaps(shelf,kind,false);return;}
 const slugOf=s=>s.slug||s.s||s.shelf.toLowerCase().replace(/[^a-z0-9]+/g,'-'),sl=slugOf(entry),labels={authors:'Authors',works:'Works',doctrines:'Topics'},available=Object.keys(labels).filter(k=>Object.prototype.hasOwnProperty.call(entry.have||{},k));
 if(!available.includes(kind))kind=available[0]||'';history.replaceState(null,'','#shelves='+encodeURIComponent(sl)+(kind?'/'+kind:''));
 pbody.innerHTML=`<div class="shelf-map-controls"><label>Shelf or group<select id="shelf-map-shelf">${shelves.map(s=>`<option value="${esc(slugOf(s))}">${esc(s.shelf)}</option>`).join('')}</select></label><label>Explore connections between<select id="shelf-map-kind"${available.length?"":" disabled"}>${available.length?available.map(k=>`<option value="${k}">${labels[k]}</option>`).join(''):'<option>No maps published</option>'}</select></label></div><div id="shelf-map-host"><p class="loading" role="status">Loading this constellation…</p></div>`;
 $('#shelf-map-shelf').value=sl;$('#shelf-map-kind').value=kind;$('#shelf-map-shelf').onchange=e=>openShelfMaps(e.target.value,kind);$('#shelf-map-kind').onchange=e=>openShelfMaps(sl,e.target.value);
 if(!available.length){$('#shelf-map-host').innerHTML='<p class="index-note">No constellation exports are published for this group. Choose another shelf or group.</p>';return;}
 const base=BLOB+'/v1/mine/constellations/'+sl+'/',d=await J(base+kind+'.json').catch(()=>null);if(token!==__PSEQ)return;
 if(!d){$('#shelf-map-host').innerHTML='<p class="index-note">This constellation could not load. Your shelf and map selection are kept.</p><button class="pbtn" id="shelf-graph-retry">Retry constellation</button>';$('#shelf-graph-retry').onclick=()=>openShelfMaps(sl,kind,false);return;}
 if(!d.nodes?.length){$('#shelf-map-host').innerHTML='<p class="index-note">This export contains no '+(kind==='doctrines'?'topics':kind)+'. Choose another map or shelf.</p>';return;}
 const K={name:n=>n.t||n.a,size:n=>n.n,unit:'Scripture citations',href:n=>kind==='works'&&n.w?FRScripture.readerURL(n.w):kind==='authors'?'/the-faith-received/fathers/?q='+encodeURIComponent(n.a):'',goLabel:kind==='works'?'Read work':'Find author works',rowLabel:kind==='authors'?'Available works':kind==='works'?'Recorded Scripture chapters':'Available topic passages',ask:(n,nm)=>'/the-faith-received/ask/?q='+encodeURIComponent('Explore '+nm+' in '+entry.shelf)};
 FRShelfMap.render($('#shelf-map-host'),d,K,{kind,shelf:sl,rowsUrl:base+kind+'.rows.json',blob:BLOB});pbody.scrollTop=0;
}

async function openTopicIndex(push=true){
  if(push)history.pushState(null,'','#topics');
  const token=++__PSEQ;openPanel('Doctrine','Find a teaching and follow its sources.');
  pbody.innerHTML='<p class="loading" role="status">Loading topics…</p>';
  const idx=await J(BLOB+'/v1/mine/topic2-all/index.json').catch(()=>null);if(token!==__PSEQ)return;
  const rows=(idx?.topics||[]).filter(t=>!FRResearch.isRawTopic(t.t)).sort((a,b)=>(b.n||0)-(a.n||0)),raw=(idx?.topics||[]).filter(t=>FRResearch.isRawTopic(t.t));
  pbody.innerHTML='<label class="web-topic-search">Find a topic<input id="web-topic-query" type="search" placeholder="Grace, Trinity, justification"></label><p id="web-topic-count" role="status"></p><div id="web-topics"></div><button id="web-topics-more" class="pbtn">Show more topics</button><div id="web-topic-review"></div>';
  let topicLimit=60;
  const render=()=>{const query=$('#web-topic-query').value.trim().toLowerCase(),hits=rows.filter(t=>String(t.t).toLowerCase().includes(query));$('#web-topic-count').textContent=hits.length+' topics'+(hits.length>topicLimit?' · showing '+topicLimit:'');$('#web-topics-more').hidden=hits.length<=topicLimit;$('#web-topics').innerHTML=hits.slice(0,topicLimit).map(t=>`<button class="web-topic-row" data-t="${esc(t.s)}"><span>${esc(t.t)}</span><small>${fmt(t.n||0)} pages</small></button>`).join('')||'<p class="index-note">'+(idx?'No matching topics. Try another word.':'Topics could not load. Open Topics again to retry.')+'</p>';const review=raw.filter(t=>String(t.t).toLowerCase().includes(query));$('#web-topic-review').innerHTML=review.length?`<details class="web-topic-contributors"><summary>Inspect ${review.length} extraction labels</summary><p class="index-note">These labels contain extraction notes and need editorial review. Their source passages remain available here.</p>${review.map(t=>`<button class="web-topic-row" data-t="${esc(t.s)}"><span>${esc(t.t)}</span><small>Inspect sources</small></button>`).join('')}</details>`:'';pbody.querySelectorAll('[data-t]').forEach(el=>el.onclick=()=>openTopic(el.dataset.t));};
  $('#web-topic-query').oninput=()=>{topicLimit=60;render();};$('#web-topics-more').onclick=()=>{topicLimit+=60;render();};render();
}

function route(){
  const h=location.hash.slice(1);const kind=h.split("=")[0],mode=({v:"verse",t:"topic",topics:"topic",shelves:"shelves",paths:"path",p:"path",journey:"path"})[kind]||"sky";document.querySelectorAll("#mnav [data-m]").forEach(a=>a.classList.toggle("on",a.dataset.m===mode));
  if(!h){$("#atlas").inert=false;$("#explorer").inert=false;document.body.classList.remove("shelf-comparison");++__PSEQ;panel.inert=true;panel.classList.remove("open");document.body.classList.remove("popen");FOCUS=null;SUBSET=null;PATHV=null;window.__JDIR=null;renderAuthorIndex();requestAnimationFrame(resize);draw();return;}
  if(h==="shelves"||h.startsWith("shelves=")){const [sh,kind]=(h.split("=")[1]||"english-divines/authors").split("/");openShelfMaps(decodeURIComponent(sh),kind||"authors",false);return;}
  if(h.startsWith('journey=')){const [path,query='']=h.slice(8).split('?'),params=new URLSearchParams(query);openJourney(path.split(',').filter(Boolean).map(decodeURIComponent),params.get('direction')||'in',{work:params.get('work')||'',targetWork:params.get('targetWork')||'',push:false});return;}
  if(h==="paths"){openPathPicker(false);return;}if(h==="topics"){openTopicIndex(false);return;}
  const [k,v]=h.split("=");
  if(k==="a"&&v){
    let sl=decodeURIComponent(v);
    if(!BYS[sl]){const t=sl.toLowerCase();
      const hit=NODES.find(n=>n.a.toLowerCase()===t);
      if(hit)sl=hit.s;}
    openAuthor(sl,false);}
  else if(k==="sh"&&v){scopeShelf(decodeURIComponent(v),false);}
  else if(k==="p"&&v){const st=v.split(",").filter(Boolean);if(st.length>=2)openPath(st,false);}
  else if(k==="e"&&v){const [from,to]=v.split(",").map(decodeURIComponent);if(from&&to)openEdge(from,to,null,false);}
  else if(k==="t"&&v)openTopic(v,false);
  else if(k==="v"&&v){const [bk,ch]=v.split("/");openVerse(bk,+ch||1,false);}
}
addEventListener("hashchange",route);
addEventListener("popstate",route);

$('#web-theme').onclick=()=>{const r=document.documentElement;const dark=r.dataset.theme==='dark'||(!r.dataset.theme&&matchMedia('(prefers-color-scheme:dark)').matches);r.dataset.theme=dark?'light':'dark';localStorage.setItem('fr_theme',r.dataset.theme);draw();drawBrush();};
new MutationObserver(()=>{if(READY){draw();drawBrush();}}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>{if(READY){draw();drawBrush();}});
$('#zoom-in').onclick=()=>{const mid=(view.y0+view.y1)/2,span=Math.max(100,(view.y1-view.y0)*.7);view.y0=mid-span/2;view.y1=mid+span/2;draw();};
$('#zoom-out').onclick=()=>{const mid=(view.y0+view.y1)/2,span=Math.min(4000,(view.y1-view.y0)/.7);view.y0=mid-span/2;view.y1=mid+span/2;draw();};
$('#zoom-reset').onclick=()=>{fitNodes(FOCUS!=null?[FOCUS,...ADJ[FOCUS].map(x=>x[0])]:NODES.filter(n=>!hidden(n)).map(n=>n.i));draw();};
new MutationObserver(()=>pbody.querySelectorAll('[data-a],[data-t],[data-edge],[data-go]').forEach(el=>{if(el.tagName==='A'||el.tagName==='BUTTON')return;el.tabIndex=0;el.setAttribute('role','button');el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}};})).observe(pbody,{childList:true,subtree:true});
let indexLimit=40,indexQuery='',indexReady=false,lastExplorerSlug=null,indexCounts=null;
function fitNodes(ids){const ns=ids.map(i=>NODES[i]).filter(Boolean);if(!ns.length)return;const years=ns.map(n=>n.y),ys=ns.map(n=>n.ny),lo=Math.min(...years),hi=Math.max(...years),bottom=Math.min(...ys),top=Math.max(...ys),pad=Math.max(65,(hi-lo)*.1);view={y0:lo-pad,y1:hi+pad,cy:(bottom+top)/2,zy:Math.min(5,.86/Math.max(.17,top-bottom))};}
function restoreExplorerFocus(){const btn=[...document.querySelectorAll('#author-index [data-author]')].find(b=>b.dataset.author===lastExplorerSlug);(btn||$('#q')).focus({preventScroll:true});}
function renderAuthorIndex(){
 if(!indexReady)return;
 const sort=$('#index-sort').value;
 const rows=NODES.filter(n=>!hidden(n)&&(!indexQuery||n.a.toLowerCase().includes(indexQuery))).sort((a,b)=>sort==='name'?a.a.localeCompare(b.a):sort==='citations'?(b.win||0)-(a.win||0):(b.din||0)-(a.din||0));
 $('#index-count').textContent=rows.length.toLocaleString()+(rows.length===1?' entry':' entries');
 $('#filter-count').textContent=anyFilter()?'Active':'';
 $('#map-empty').hidden=rows.length>0;
 if(FOCUS==null){if(!indexCounts){const visible=new Set(NODES.filter(n=>!hidden(n)).map(n=>n.i));indexCounts={nodes:visible.size,edges:EDGES.reduce((count,[a,b])=>count+(visible.has(a)&&visible.has(b)?1:0),0)};}$('#map-summary').textContent=indexCounts.nodes.toLocaleString()+' entries · '+indexCounts.edges.toLocaleString()+' recorded connections';}
 $('#author-index').innerHTML=rows.slice(0,indexLimit).map(n=>`<button class="author-entry${FOCUS===n.i?' selected':''}" data-author="${esc(n.s)}" data-era="${n.e}" aria-pressed="${FOCUS===n.i}"><span><strong>${esc(n.a)}</strong><small><i class="era-dot" aria-hidden="true"></i>${n.yok?'c. '+n.y+' · ':''}${esc(SHN[n.sh]||ERAL[n.e]||'Indexed author')}${n.coll?' · collection':''}</small></span><span class="author-measure"><b>${fmt(sort==='citations'?(n.win||0):(n.din||0))}</b><small>${sort==='citations'?'citations':'citing authors'}</small></span></button>`).join('')||'<p class="index-note">No matching authors. Try another name or clear the filters.</p>';
 $('#index-more').hidden=rows.length<=indexLimit;
}
function connectionExamples(){
 const used=new Set(),examples=[];
 for(const edge of EXAMPLE_EDGES){const [a,b]=edge;if(a===b||hidden(NODES[a])||hidden(NODES[b])||NODES[a].coll||NODES[b].coll||used.has(a))continue;used.add(a);examples.push(edge);if(examples.length===3)break;}
 return examples;
}
function renderConnectionExamples(){if(!indexReady)return;const examples=connectionExamples();$('#connection-examples').innerHTML=examples.map(([a,b,n])=>`<button data-connection="${esc(NODES[a].s)}|${esc(NODES[b].s)}"><span>${esc(NODES[a].a)} <small>cites</small> ${esc(NODES[b].a)}</span><small>${fmt(n)} recorded citations <span aria-hidden="true">→</span></small></button>`).join('')||'<p class="index-note">No recorded connections in this selection.</p>';}
function initExplorer(){
 indexReady=true;if(innerWidth<=760)$("#map-density").value="20";
 $("#atlas-ask").onclick=()=>$("#fra-launcher")?.click();Object.entries(ERAL).forEach(([k,v])=>$('#era-select').insertAdjacentHTML('beforeend',`<option value="${k}">${esc(v)}</option>`));
 $('#q').addEventListener('input',()=>{indexQuery=$('#q').value.trim().toLowerCase();indexLimit=40;renderAuthorIndex();});
 $('#map-density').onchange=()=>{draw();};
 $('#index-sort').onchange=()=>{indexLimit=40;renderAuthorIndex();};
 $('#index-more').onclick=()=>{const offset=indexLimit;indexLimit+=40;renderAuthorIndex();$('#author-index').children[offset]?.focus();};
 $('#author-index').onclick=e=>{const btn=e.target.closest('[data-author]');if(btn){lastExplorerSlug=btn.dataset.author;go(btn.dataset.author);renderAuthorIndex();}};
 $('#connection-examples').onclick=e=>{const btn=e.target.closest('[data-connection]');if(btn)openEdge(...btn.dataset.connection.split('|'),null);};
 $('#era-select').onchange=e=>{ERA_OFF=new Set(e.target.value?Object.keys(ERAL).filter(k=>k!==e.target.value):[]);updFstat();draw();};
 $('#apply-years').onclick=()=>{const lo=$('#year-from').value,hi=$('#year-to').value;if((lo&&!$('#year-from').checkValidity())||(hi&&!$('#year-to').checkValidity())||(lo&&hi&&+lo>+hi)){$('#date-feedback').textContent='Enter a start year before the end year, between −500 and 2000.';return;}$('#date-feedback').textContent='';brushWin=(lo||hi)?[lo?+lo:-500,hi?+hi:2000]:null;updFstat();fitNodes(NODES.filter(n=>!hidden(n)).map(n=>n.i));draw();};
 $('#clear-map-filters').onclick=clearFilters;$('#map-empty button').onclick=clearFilters;
 $('#map-help-button').onclick=e=>{const open=e.currentTarget.getAttribute('aria-expanded')!=='true';e.currentTarget.setAttribute('aria-expanded',String(open));$('#map-help').hidden=!open;};
 $('#mobile-view').onclick=e=>{const btn=e.target.closest('[data-view]');if(!btn)return;document.body.dataset.view=btn.dataset.view;$('#mobile-view').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));requestAnimationFrame(resize);};
 new ResizeObserver(()=>resize()).observe($('#graph-frame'));
 cv.addEventListener('mouseleave',()=>{HOV=null;$('#tip').style.display='none';draw();});
 matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>{draw();});
 renderAuthorIndex();renderConnectionExamples();
}

boot().catch(e=>{
  $("#index-count").textContent="The citation index could not load.";$("#author-index").innerHTML='<p class="index-note">Check your connection and try again.</p><button class="pbtn" onclick="location.reload()">Reload index</button>';$("#map-summary").textContent="Connection unavailable";});
