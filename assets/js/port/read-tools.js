async function __initReview(){
  let me={};try{me=await jget("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/me");}catch(e){}
  if(!me.owner)return;
  document.body.classList.add("review");
  $("#sub").textContent=[DATA.author,DATA.tradition||DATA.group].filter(Boolean).concat(["owner review — double-click a page to edit it (⌘↵ save · esc cancel) · OK / Needs / Redo per page"]).join(" · ");
  let prog={};try{prog=await jget("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/progress");}catch(e){}
  const okS=new Set(prog.ok_pages||[]),ndS=new Set(prog.needs_agent_pages||[]),vwS=new Set(prog.viewed_pages||[]),agS=new Set(prog.agent_pages||[]);
  const statusOf=n=>okS.has(n)?"ok":ndS.has(n)?"needs":vwS.has(n)?"viewed":"new";
  const setStatus=(n,st)=>{okS.delete(n);ndS.delete(n);              // live registry: marks update the pills instantly
    if(st==="ok")okS.add(n);else if(st==="needs")ndS.add(n);
    if(st!=="new")vwS.add(n);renderSum();};
  const wsq=encodeURIComponent(new URLSearchParams(location.search).get("ws")||"");
  document.querySelectorAll("#reading .folio").forEach((sec,pi)=>{
    const n=+sec.dataset.page;
    const bar=el("div","rvbar");
    bar.innerHTML=`<span class="fol-n">§ ${n}</span><span class="st ${statusOf(n)}">${statusOf(n)}</span>`+
      (agS.has(n)?`<span class="ag" title="An agent has re-transcribed this page">↻ agent</span>`:``)+`<span class="grow"></span>`+
      `<button class="edit">Edit</button><button class="ok">✓ OK</button><button class="needs">⚑ Needs work</button><button class="redo">↻ Redo</button><span class="msg"></span>`;
    const ed=el("div","rv-edit");
    ed.innerHTML=`<div><div class="lbl">Latin · source</div><textarea class="la"></textarea></div>`+
      `<div><div class="lbl">English</div><textarea class="en"></textarea></div>`+
      `<div class="save"><button class="primary act-save">Save page</button><button class="act-cancel">Cancel</button><span class="kbd"><b>⌘↵</b> save · <b>esc</b> cancel</span></div>`;
    sec.insertBefore(bar,sec.firstChild);sec.appendChild(ed);
    ed.querySelectorAll("textarea").forEach(t=>t.addEventListener("keydown",ev=>{
      if((ev.metaKey||ev.ctrlKey)&&ev.key==="Enter"){ev.preventDefault();ed.querySelector(".act-save").click();}
      else if(ev.key==="Escape"){ev.preventDefault();ed.querySelector(".act-cancel").click();}}));
    const setSt=s=>{const b=bar.querySelector(".st");b.className="st "+s;b.textContent=s;setStatus(n,s);};
    const msg=t=>bar.querySelector(".msg").textContent=t||"";
    const openEdit=side=>{
      ed.querySelector("textarea.la").value=DATA.pages[pi].la||"";ed.querySelector("textarea.en").value=DATA.pages[pi].en||"";
      sec.classList.add("editing");
      const ph=$(".ph");sec.style.scrollMarginTop=((ph?ph.offsetHeight:120)+10)+"px";   // land below the sticky header
      sec.scrollIntoView({block:"start"});
      (ed.querySelector(side==="en"?"textarea.en":"textarea.la")).focus();
    };
    bar.querySelector(".edit").onclick=()=>openEdit("la");
    // click into the page while reading: double-click the text to edit that page in place
    sec.addEventListener("dblclick",ev=>{
      if(sec.classList.contains("editing"))return;
      if(ev.target.closest(".rvbar")||ev.target.closest(".rv-edit"))return;
      openEdit(ev.target.closest(".en")?"en":"la");
    });
    ed.querySelector(".act-cancel").onclick=()=>sec.classList.remove("editing");
    ed.querySelector(".act-save").onclick=async()=>{const la=ed.querySelector(".la").value,en=ed.querySelector(".en").value;
      const nb=t=>t.split(/\n\s*\n/).filter(b=>b.trim()&&b.trim()!=="##").length;
      if(nb(la)!==nb(en)&&!confirm(`Latin has ${nb(la)} blocks but English has ${nb(en)} — the side-by-side pairing will misalign. Save anyway?`))return;
      const mk="[[p."+String(n).padStart(4,"0")+"]]\n\n";   // server.py requires the page marker in the saved text
      sec.classList.add("rv-busy");try{await jpost("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/page",{page:n,span:1,latin:mk+la,english:mk+en});DATA.pages[pi].la=la;DATA.pages[pi].en=en;rerenderFolio(sec,pi);setSt("viewed");msg("saved ✓");}
      catch(e){msg("save failed: "+e.message);}sec.classList.remove("rv-busy","editing");};
    bar.querySelector(".ok").onclick=async()=>{try{await jpost("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/mark",{page:n,span:1,status:"ok"});setSt("ok");msg("");}catch(e){msg(e.message);}};
    bar.querySelector(".needs").onclick=async()=>{try{await jpost("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/mark",{page:n,span:1,status:"needs_agent"});setSt("needs");msg("");}catch(e){msg(e.message);}};
    bar.querySelector(".redo").onclick=async()=>{
      if(!confirm("Re-run the agent to re-transcribe page "+n+" from the source scan? It proposes a fresh Latin + English (~1–3 min); you review it before it's saved."))return;
      sec.classList.add("rv-busy");msg("running agent… 0s");
      try{
        const before=((await jget("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/agent-results?page="+n+"&span=1")).results||[]).length;
        await jpost("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/run-agent",{page:n,span:1,force:true,provider:"openrouter",model:"google/gemini-3.1-flash-lite"});
        let got=null;
        for(let i=1;i<=100;i++){await sleep(3000);
          let d;try{d=await jget("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/agent-results?page="+n+"&span=1");}catch(e){msg("running agent… "+(i*3)+"s");continue;}
          const rs=d.results||[];
          if(rs.length>before){got={r:rs[rs.length-1],cur:d.current};break;}
          msg("running agent… "+(i*3)+"s");
        }
        sec.classList.remove("rv-busy");
        if(!got){msg("timed out — agent may still be running (see ⚙ Full tools)");return;}
        const r=got.r,cur=got.cur||{};
        if(r.status==="error"){msg("agent error: "+String(r.summary||"").slice(0,90));return;}
        ed.querySelector(".la").value=stripPM(r.latin_replacement!=null?r.latin_replacement:(cur.latin||DATA.pages[pi].la));
        ed.querySelector(".en").value=stripPM(r.english_replacement!=null?r.english_replacement:(cur.english||DATA.pages[pi].en));
        sec.classList.add("editing");
        msg("agent proposal ready — review & Save to apply, or Cancel to discard");
      }catch(e){sec.classList.remove("rv-busy");msg("redo failed: "+e.message);}
    };
  });
  function renderSum(){const un=DATA.pages.filter(g=>statusOf(g.n)==="new").length;
    $("#rvsum").innerHTML=`<span class="pill"><span class="dot" style="background:#2f7d52"></span><b>${okS.size}</b> ok</span>`+
    `<span class="pill"><span class="dot" style="background:#9a2420"></span><b>${ndS.size}</b> needs</span>`+
    `<span class="pill"><span class="dot" style="background:var(--accent)"></span><b>${vwS.size}</b> viewed</span>`+
    `<span class="pill"><span class="dot" style="background:var(--accent-soft)"></span><b>${agS.size}</b> agent-redone</span>`+
    `<span class="pill"><b>${un}</b> unreviewed · <b>${DATA.pages.length}</b> pages</span>`+
    `<button class="pill" id="rvNext" title="Jump to the next unreviewed page  (u)">→ next unreviewed</button>`+
    `<span class="tools"><a href="/classic?ws=${wsq}">⚙ Full tools · spine · TOC · assembly · bulk swarm</a></span>`;
    const b=$("#rvNext");if(b)b.onclick=nextUnreviewed;}
  function nextUnreviewed(){const order=DATA.pages.map(g=>g.n);
    const start=order.indexOf(cur);                                   // wrap-around search from the current folio
    for(let k=1;k<=order.length;k++){const n2=order[(start+k)%order.length];
      if(statusOf(n2)==="new"){jump(n2);return;}}
    alert("Every page in this work has been reviewed ✓");}
  document.addEventListener("click",e=>{const a=e.target.closest&&e.target.closest(".fn-ret");if(!a)return;e.preventDefault();
  const id=a.dataset.fn,sec=a.closest(".folio");if(!sec)return;
  const sup=[...sec.querySelectorAll("sup.fnref,[data-fn]")].find(x=>x!==a&&(x.dataset.fn===id||x.textContent.trim()===id));
  if(sup){sup.scrollIntoView({block:"center",behavior:"smooth"});sup.classList.add("flash");setTimeout(()=>sup.classList.remove("flash"),1400);}});
document.addEventListener("keydown",e=>{if(e.key==="u"&&!e.metaKey&&!e.ctrlKey&&!e.target.closest("textarea,input"))nextUnreviewed();});
  renderSum();
}
// ---- public reader tools: highlight · note · copy-with-citation · my-translation ----
// localStorage-first, mirroring the aquinas-studies/PLD model; window._frSync* hooks let the
// Vercel deployment sync to Firestore (users/{uid}/meta/fr_tr, fr_notes, fr_hl) when signed in.
// typeset quote-card (always the light editorial look, for sharing) → downloads a 1200×630 PNG
// that doubles as the Open Graph image dimension.
function makeCard(text,cite,onReady){
  const W=1200,H=630,c=el("canvas");c.width=W;c.height=H;const x=c.getContext("2d");
  const SITE={"faith-received":{a:"#775B43",o:"❧"},aquinas:{a:"#9A3328",o:"✚"},pld:{a:"#7E2E22",o:"§"},graeca:{a:"#2E6E66",o:"☩"}};
  const S=SITE[document.documentElement.dataset.site]||SITE["faith-received"];
  const own=S===SITE["faith-received"],paper=own?"#FFFFFF":"#FCFBF8",ink=own?"#1C1C1A":"#2A231D",accent=S.a,soft=own?"#C6B7A7":"#C9A96E",disp="Georgia,'IM Fell Great Primer',serif";
  x.fillStyle=paper;x.fillRect(0,0,W,H);
  x.strokeStyle=soft;x.lineWidth=3;x.strokeRect(30,30,W-60,H-60);
  x.fillStyle=accent;x.textAlign="center";x.font="36px Georgia";x.fillText(S.o,W/2,104);
  let fs=text.length>500?26:text.length>360?30:text.length>210?36:44;x.font="italic "+fs+"px "+disp;x.fillStyle=ink;
  const max=W-220,words=("“"+text+"”").split(/\s+/),lines=[];let ln="";
  for(const w of words){const tst=ln?ln+" "+w:w;if(x.measureText(tst).width>max&&ln){lines.push(ln);ln=w;}else ln=tst;}
  if(ln)lines.push(ln);
  const shown=lines.slice(0,8);if(lines.length>8)shown[7]=shown[7].replace(/\s+\S*$/,"")+"…";
  const lh=fs*1.42,top=Math.max(150,(H-shown.length*lh)/2-10);
  shown.forEach((l,i)=>x.fillText(l,W/2,top+i*lh));
  // attribution: AUTHOR on its own line, the work + page beneath — with generous breathing room from the quote
  {const auth=(typeof DATA!=="undefined"&&DATA&&DATA.author)?DATA.author:"";x.fillStyle=accent;
   const qBot=top+(shown.length-1)*lh+fs*0.86;                       // bottom of the last quote line (baseline + descenders)
   const cy=Math.min(auth?H-118:H-90, qBot+62);                      // >=62px gap below the quote so it never crowds the author
   // CITE MUST FIT THE CARD (owner 2026-08-19 Baxter screenshot: long titles ran off both
   // edges). Drop the author prefix (already drawn on its own line), wrap to the card
   // width, and if it still needs >2 lines keep the title's start + the year/§ tail.
   let cline=String(cite||"");
   const A0=(typeof AUTHOR!=="undefined"&&AUTHOR)?AUTHOR:String(auth||"");
   if(A0&&cline.toLowerCase().startsWith(A0.toLowerCase()+", "))cline=cline.slice(A0.length+2);
   const fitCite=(fpx)=>{x.font="italic "+fpx+"px "+disp;
     const maxw=W-150,ws=cline.split(/\s+/),ls=[];let ln="";
     for(const w of ws){const t2=ln?ln+" "+w:w;if(x.measureText(t2).width>maxw&&ln){ls.push(ln);ln=w;}else ln=t2;}
     if(ln)ls.push(ln);
     return ls.length>2?[ls[0].replace(/[,;\s]+$/,"")+" …",ls[ls.length-1]]:ls;};
   if(auth){x.font="italic 27px "+disp;x.fillText("— "+auth,W/2,cy);
            x.globalAlpha=.9;const cls=fitCite(19);
            cls.forEach((l,i)=>{x.font="italic 19px "+disp;x.fillText(l,W/2,cy+32+i*24);});x.globalAlpha=1;}
   else{const cls=fitCite(21);cls.forEach((l,i)=>{x.font="italic 21px "+disp;x.fillText(l,W/2,cy+i*26);});}}
  x.font="600 17px -apple-system,Segoe UI,sans-serif";x.fillStyle=ink;x.globalAlpha=.65;
  x.fillText("THE FAITH RECEIVED",W/2,H-52);x.globalAlpha=1;
  const _au=(typeof DATA!=="undefined"&&DATA&&DATA.author)?DATA.author+" — ":"";  // file title = Author — Work, pg. N
  const fn=(_au+cite).replace(/[^\w .,—-]+/g," ").replace(/ +/g," ").trim().slice(0,90)||"faith-received-passage";
  c.toBlob(b=>{if(!b)return;const url=URL.createObjectURL(b);if(onReady){onReady({url,name:fn+'.png'});return;}const a=el("a");a.href=url;a.download=fn+".png";a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);});
}
// ---- in-reader search: this work (instant, client-side) · corpus (vector) · ✦ Ask (RAG) ----
// ---- in-reading find: paint every match in the body as <mark>, step through them with a small bar.
// A MutationObserver re-paints as progressively-rendered folios arrive (disconnected during our own
// edits so it never loops). This is the "search → words highlighted in the text" layer. ----
let FIND={terms:[],marks:[],occurrences:[],i:0,selected:null,obs:null,layoutObs:null,_t:null,open:false,trigger:null,sequence:0,forcedPages:new Map()};
function findHash(value){let hash=2166136261;for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);return (hash>>>0).toString(36);}
function findVisible(node,clip=false){
  if(!node?.isConnected)return false;
  const rect=clip?node.getBoundingClientRect():null;
  for(let current=node;current&&current.id!=='scroll';current=current.parentElement){
    if(current.hidden||current.getAttribute?.('aria-hidden')==='true')return false;
    const style=getComputedStyle(current);if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||style.contentVisibility==='hidden')return false;
    if(current.tagName==='DETAILS'&&!current.open&&!node.closest('summary'))return false;
    if(clip&&current!==node&&/^(hidden|clip)$/.test(style.overflowY||style.overflow||'')){
      const bounds=current.getBoundingClientRect();if(rect.top<bounds.top-1||rect.bottom>bounds.bottom+1)return false;
    }
  }
  return !clip||node.getClientRects().length>0&&rect.height>0&&rect.width>0;
}
function findRuns(root){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
    const parent=node.parentElement;if(!node.nodeValue||!parent||parent.closest('script,style,button,input,textarea,sup,.fnref,.fn-ret,.pganchor,.la-rev,.rv-edit,.rowx,.rm-original,.rl,.fmark,.furn')||!findVisible(parent))return NodeFilter.FILTER_REJECT;
    return parent.closest('.en,.la,.hen,.hla,.csub,.mnote')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }});
  const runs=[];let node,last=null;
  while((node=walker.nextNode())){
    const block=node.parentElement.closest('p,li,td,th,figcaption,h1,h2,h3,h4,h5,h6,.mnote,.csub')||node.parentElement.closest('.en,.la'),lane=node.parentElement.closest('.en,.la,.hen,.hla'),owner=block||lane;
    if(!owner)continue;
    if(!last||last.owner!==owner||last.lane!==lane){last={owner,lane,nodes:[],text:'',map:[]};runs.push(last);}last.nodes.push(node);
    for(let offset=0;offset<node.nodeValue.length;offset++){
      const char=node.nodeValue[offset];if(/\s/.test(char)&&last.text.endsWith(' '))continue;
      last.text+=/\s/.test(char)?' ':char;last.map.push({node,offset});
    }
  }
  return runs;
}
function findCanonicalTarget(node){
  const element=node.nodeType===3?node.parentElement:node,row=element.closest('.row[id]'),folio=element.closest('.folio'),note=element.closest('.rapp[data-fnid]'),lane=element.closest('.en,.la,.hen,.hla');
  const id=row?.id||folio?.id||'';let page=(id.match(/^b(.+)-\d+$/)||[])[1]||String(folio?.dataset.page??''),pageBoundary=false;
  for(const anchor of lane?.querySelectorAll('.pganchor[data-page]')||[]){
    if(anchor.closest('.en,.la,.hen,.hla')!==lane||!findVisible(anchor)||!(anchor.compareDocumentPosition(node)&4))continue;
    page=String(anchor.dataset.page);pageBoundary=true;
  }
  return {id,page,pageBoundary,note:note?.dataset.fnid||'',lane:element.closest('.en,.hen')?'en':element.closest('.la,.hla')?'la':''};
}
function findOccurrenceScore(candidate,selected){
  if(!selected||candidate.text.toLowerCase()!==selected.text.toLowerCase())return -1;
  let score=candidate.canonicalId===selected.canonicalId?20:0;if(candidate.lane!==selected.lane)return -1;
  const left=selected.before.slice(-45),right=selected.after.slice(0,45);
  if(left&&candidate.before.endsWith(left))score+=left.length;if(right&&candidate.after.startsWith(right))score+=right.length;
  return score;
}
function _findUnpaint(){document.querySelectorAll('#reading mark.findhit').forEach(mark=>mark.replaceWith(...mark.childNodes));$('#reading')?.normalize();}
function findPaint(){
  const selected=FIND.selected;FIND.obs?.disconnect();FIND.layoutObs?.disconnect();_findUnpaint();
  const root=$('#reading'),occurrences=[];
  if(FIND.terms.length&&root){
    const pattern=FIND.terms.slice().sort((a,b)=>b.length-a.length).map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),rx=new RegExp(pattern,'gi');
    const ordinals=new Map();
    for(const run of findRuns(root)){
      const target=findCanonicalTarget(run.owner),base=target.id||target.page+'|note:'+target.note,ordinal=ordinals.get(base+'|'+target.lane)||0;ordinals.set(base+'|'+target.lane,ordinal+1);
      const matches=[];let match;rx.lastIndex=0;while((match=rx.exec(run.text))){
        const place=findCanonicalTarget(run.map[match.index].node);
        const key=base+'|'+target.lane+'|'+ordinal+'|'+match.index+'|'+match[0].toLowerCase(),id='fr-find-'+findHash(FIND.terms.join('|'))+'-'+findHash(key);
        const occurrence={key,id,canonicalId:place.id,page:place.page,pageBoundary:place.pageBoundary,lane:place.lane,note:place.note,text:match[0],before:run.text.slice(Math.max(0,match.index-90),match.index),after:run.text.slice(match.index+match[0].length,match.index+match[0].length+90),marks:[]};
        matches.push({start:match.index,end:match.index+match[0].length,occurrence});occurrences.push(occurrence);if(!match[0].length)rx.lastIndex++;
      }
      for(const item of matches.reverse()){
        const parts=[];for(let i=item.start;i<item.end;i++){const entry=run.map[i],part=parts.at(-1);if(part?.node===entry.node)part.end=entry.offset+1;else parts.push({node:entry.node,start:entry.offset,end:entry.offset+1});}
        for(const part of parts.reverse()){
          let text=part.node;if(part.end<text.nodeValue.length)text.splitText(part.end);if(part.start)text=text.splitText(part.start);
          const mark=document.createElement('mark');mark.className='findhit';mark.dataset.findKey=item.occurrence.key;text.parentNode.insertBefore(mark,text);mark.appendChild(text);item.occurrence.marks.unshift(mark);
        }
        item.occurrence.marks[0].id=item.occurrence.id;
      }
    }
  }
  FIND.occurrences=occurrences.filter(item=>item.marks.length&&item.marks.every(mark=>findVisible(mark,true)));FIND.marks=FIND.occurrences.map(item=>item.marks[0]);
  let index=selected?FIND.occurrences.findIndex(item=>item.key===selected.key):-1;
  if(index<0&&selected){let best=35;FIND.occurrences.forEach((item,i)=>{const score=findOccurrenceScore(item,selected);if(score>best){best=score;index=i;}});}
  FIND.i=index>=0?index:Math.min(FIND.i,Math.max(0,FIND.marks.length-1));FIND.selected=FIND.occurrences[FIND.i]||null;
  FIND.selected?.marks.forEach(mark=>mark.classList.add('cur'));
  FIND.obs?.observe(root,{childList:true,subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['class','style','hidden','open','aria-hidden','data-rf-bank-open']});
  const app=document.getElementById('app');if(app)FIND.layoutObs?.observe(app,{attributes:true,attributeOldValue:true,attributeFilter:['class','style']});_findBar();
}
function findSet(terms,options={}){
  for(const [folio,value]of FIND.forcedPages)folio.style.contentVisibility=value;FIND.forcedPages.clear();
  FIND.sequence++;FIND.terms=[...new Set((terms||[]).map(term=>String(term).replace(/\s+/g,' ').trim()).filter(Boolean))];FIND.i=0;FIND.selected=null;FIND.open=options.open!==false;
  const changed=records=>{if(records?.length&&records.every(record=>record.type==='attributes'&&(record.target.closest?.('mark.findhit')||record.oldValue===record.target.getAttribute(record.attributeName))))return;clearTimeout(FIND._t);FIND._t=setTimeout(()=>{if(FIND.terms.length)findPaint();},100);};
  if(!FIND.resizeBound){window.addEventListener?.('resize',()=>changed());FIND.resizeBound=true;}
  if(!FIND.obs)FIND.obs=new MutationObserver(changed);if(!FIND.layoutObs)FIND.layoutObs=new MutationObserver(changed);findPaint();
}
function findScrollCur(){
  const occurrence=FIND.occurrences[FIND.i];if(!occurrence||!occurrence.marks.every(mark=>findVisible(mark,true)))return false;
  FIND.selected=occurrence;FIND.sequence++;
  return window.__frRestoreReaderPosition?.({page:occurrence.page,id:occurrence.canonicalId||'b'+occurrence.page+'-0',focusId:occurrence.id,anchor:true,choice:true,offset:null})===true;
}
function findStep(direction){
  findPaint();if(!FIND.occurrences.length)return;
  FIND.selected?.marks.forEach(mark=>mark.classList.remove('cur'));FIND.i=(FIND.i+direction+FIND.occurrences.length)%FIND.occurrences.length;FIND.selected=FIND.occurrences[FIND.i];
  FIND.selected.marks.forEach(mark=>mark.classList.add('cur'));findScrollCur();_findBar();
}
function findClear(){
  const position=window.__readerChoice?.focusId?window.__frCaptureReaderPosition?.():null;
  FIND.sequence++;clearTimeout(FIND._inputTimer);clearTimeout(FIND._t);FIND.obs?.disconnect();FIND.layoutObs?.disconnect();FIND.terms=[];FIND.i=0;FIND.open=false;FIND.selected=null;
  _findUnpaint();FIND.marks=[];FIND.occurrences=[];for(const [folio,value]of FIND.forcedPages)folio.style.contentVisibility=value;FIND.forcedPages.clear();_findBar();if(position)window.__frRestoreReaderPosition?.(position);if(FIND.trigger?.isConnected)FIND.trigger.focus({preventScroll:true});
}
function findOpen(){
  FIND.trigger=document.activeElement;FIND.open=true;_findBar();
  document.documentElement.classList.remove("mh-hide","mh-mini");
  const input=$("#findInput");input.focus({preventScroll:true});input.select();
}
async function findWholeWork(){
  const query=($('#findInput')?.value??FIND.terms.join(' ')).trim();clearTimeout(FIND._inputTimer);FIND.sequence++;
  if(!window.__frSearchWork){$('#findHelp').textContent='Research tools are loading. Try again.';return false;}
  FIND.open=false;_findBar();
  try{await window.__frSearchWork(query);return true;}catch(_){FIND.open=true;_findBar();$('#findHelp').textContent='Research search could not open. Try again.';return false;}
}
function _findBar(){
  let b=$("#findbar");
  if(!b){
    b=el("div","findbar");b.id="findbar";b.setAttribute("role","search");b.setAttribute("aria-label","Find in reading text");
    b.innerHTML='<input id="findInput" type="search" placeholder="Find in text" aria-label="Find in text" aria-describedby="findHelp" autocomplete="off" spellcheck="false">'
      +'<button id="findPrev" aria-label="Previous match" title="Previous match (Shift+Enter)">↑</button>'
      +'<button id="findNext" aria-label="Next match" title="Next match (Enter)">↓</button>'
      +'<button id="findX" aria-label="Close search" title="Close search (Escape)">×</button>'
      +'<div class="findmeta"><span id="findCount" role="status" aria-live="polite"></span><span id="findHelp">In shown, loaded text</span><button type="button" id="findWholeWork">Search whole work</button></div>';
    const reading=$("#reading");if(reading)reading.before(b);else document.body.appendChild(b);
    const input=$("#findInput");
    input.addEventListener("input",()=>{clearTimeout(FIND._inputTimer);FIND._inputTimer=setTimeout(()=>{findSet(input.value.trim()?[input.value.trim()]:[]);findScrollCur();},160);});
    input.addEventListener("keydown",e=>{
      if(e.isComposing)return;
      if(e.key==="Enter"){e.preventDefault();clearTimeout(FIND._inputTimer);
        if(input.value.trim()!==FIND.terms.join(" ")){findSet(input.value.trim()?[input.value.trim()]:[]);findScrollCur();}else findStep(e.shiftKey?-1:1);
      }else if(e.key==="Escape"){e.preventDefault();e.stopPropagation();findClear();}
    });
    $("#findPrev").onclick=()=>findStep(-1);$("#findNext").onclick=()=>findStep(1);$("#findX").onclick=findClear;
    $('#findWholeWork').onclick=findWholeWork;
    document.addEventListener("keydown",e=>{
      if(!FIND.open||e.defaultPrevented)return;
      const inField=/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(document.activeElement.tagName)||document.activeElement.isContentEditable||document.activeElement.closest('[role="dialog"]');
      if(inField||document.querySelector(".rsov.open,.fra-shell:not([hidden])"))return;
      if(e.key==="Enter"){e.preventDefault();findStep(e.shiftKey?-1:1);}
      else if(e.key==="Escape"){e.preventDefault();findClear();}
    });
  }
  b.classList.toggle("on",FIND.open);b.hidden=!FIND.open;
  if(!FIND.open)return;
  const input=$("#findInput");if(document.activeElement!==input)input.value=FIND.terms.join(" ");
  $("#findCount").textContent=!FIND.terms.length?"Find a word or phrase":FIND.marks.length?((FIND.i+1)+" of "+FIND.marks.length):"No matches";
  $("#findPrev").disabled=$("#findNext").disabled=!FIND.marks.length;
}

function __initSearch(){
  if(document.getElementById("rsov"))return;
  const ov=el("div","rsov");ov.id="rsov";
  ov.innerHTML='<div class=rsp role=dialog aria-label=Research>'
    +'<div class=rsh><input id=rsq placeholder="Search this work…" autocomplete=off spellcheck=false>'
    +'<button id=rsGo class=rsgo title="Search (Enter)">⌕</button>'
    +'<div class=rss role=group aria-label=Scope><button id=rsThis aria-pressed=true>This work</button><button id=rsAll aria-pressed=false>All works</button><button id=rsAsk aria-pressed=false title="Ask a question — answered from the corpus with citations">✦ Ask</button></div>'
    +'<div class=rscope id=rsScope role=group aria-label="Search scope">'
    /* data-tr must match the BAKED Pagefind filter value; the index still says "Catholic"
       (covers Roman Catholic + Medieval works) until the next full search-corpus rebuild —
       flip to data-tr="Roman Catholic" + add Medieval when that ships (shelf split 2026-07-16) */
    +'<button data-tr="" aria-pressed=true>All traditions</button><button data-tr=Reformed>Reformed</button><button data-tr=Lutheran>Lutheran</button><button data-tr=Catholic>Roman Catholic &amp; Medieval</button>'
    +'<span class=rsc-sep aria-hidden=true></span>'
    +'<button data-c=pl title="Patrologia Latina — the Latin Fathers">PL</button><button data-c=pg title="Patrologia Graeca — the Greek Fathers">PG</button><button data-c=po title="Patrologia Orientalis — the Eastern Fathers">PO</button></div>'
    +'<button id=rsX class=rsx aria-label=Close>✕</button></div><div id=rsb class=rsb aria-live=polite></div></div>';
  document.body.appendChild(ov);
  const q=$("#rsq"),body=$("#rsb");let mode="this",wi=null,tmr,ASK=[];
  try{ASK=JSON.parse(lsGet("fr_askthread")||"[]");}catch(e){ASK=[];}           // an investigation resumes where it stopped
  const saveAsk=()=>{try{lsSet("fr_askthread",JSON.stringify(ASK.slice(-16)));}catch(e){}};
  // scope: one tradition (or all) + any subset of the patristic corpora — one or all
  let SCOPE={tr:"",pl:true,pg:true,po:true};
  try{Object.assign(SCOPE,JSON.parse(lsGet("fr_scope")||"{}"));}catch(e){}
  const scopeEl=$("#rsScope");
  function paintScope(){scopeEl.querySelectorAll("[data-tr]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.tr===SCOPE.tr?"true":"false"));
    scopeEl.querySelectorAll("[data-c]").forEach(b=>b.setAttribute("aria-pressed",SCOPE[b.dataset.c]?"true":"false"));}
  scopeEl.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
    if(b.dataset.tr!==undefined)SCOPE.tr=b.dataset.tr;
    else if(b.dataset.c)SCOPE[b.dataset.c]=!SCOPE[b.dataset.c];
    lsSet("fr_scope",JSON.stringify(SCOPE));paintScope();if(mode==="all")run();});
  paintScope();
  // Ask mode = a text-message chat thread inside #rsb (mirrors the landing-page Ask)
  function askShell(){body.classList.add("askmode");const here=DATA&&DATA.slug;
    /* ONE CHAT BOX (owner 2026-09-05 "audit every ask surface … as close to our version of
       chatgpt as possible"): the same composer as the landing and /search — borderless input
       + round send inside a bordered card, controls as a quiet tools line beneath. */
    body.innerHTML='<div class=rsa-thread id=rsathread></div>'
      +'<div class=rsa-composer><div class=rsa-box>'
      +'<input id=rsaInput placeholder="Ask anything" autocomplete=off spellcheck=false>'
      +'<button class=rsa-send id=rsaSend aria-label="Ask">↑</button>'
      +'<div class=rsa-tools>'
      +(here?'<label class=rsa-t for=rsAskWork><input type=checkbox id=rsAskWork checked>this work</label>':'')
      +'<input id=rsAskAuth list=rsAuthL placeholder="any author…" title="Narrow to one author. Optional." autocomplete=off><datalist id=rsAuthL></datalist>'
      +'<label class=rsa-t for=rsAskDeep><input type=checkbox id=rsAskDeep>Deep</label>'
      +'<button type=button id=rsResearch class=rsa-fc title="Sweep every page of this work against your brief — visible plan, live progress, evidence">⌖ Research</button>'
      +'<span class=rsa-sp></span><button class=rsa-new id=rsaNew title="New conversation">＋</button>'
      +'</div></div><div id=rsaScopeRow></div></div>';
    window.__rsFC=window.__rsFC||[];
    body.querySelectorAll(".rsa-fc").forEach(c=>{const sync=()=>c.classList.toggle("on",window.__rsFC.includes(c.dataset.c));sync();
      c.onclick=()=>{const s=new Set(window.__rsFC);s.has(c.dataset.c)?s.delete(c.dataset.c):s.add(c.dataset.c);window.__rsFC=[...s];
        body.querySelectorAll(".rsa-fc").forEach(x=>x.classList.toggle("on",window.__rsFC.includes(x.dataset.c)));};});
    const authIn=$("#rsAskAuth");
    if(authIn)authIn.addEventListener("focus",()=>{const dl=$("#rsAuthL");if(!dl||dl.children.length)return;
      fetch(BLOB+"/v1/works-index.json"+VER).then(r=>r.json()).then(d=>{window.__rsWIDX=d.works||[];
        [...new Set((d.works||[]).map(w=>w.author).filter(Boolean))].sort().forEach(au=>{const o=document.createElement("option");o.value=au;dl.appendChild(o);});}).catch(()=>{});},{once:true});
    const rbtn=$("#rsResearch");
    if(rbtn)rbtn.onclick=()=>{window.__rsResearchMode=!window.__rsResearchMode;
      rbtn.classList.toggle("on",!!window.__rsResearchMode);
      const ip=$("#rsaInput");if(ip)ip.placeholder=window.__rsResearchMode
        ?"Research brief — what should be exhaustively studied in this work? (every page is swept)"
        :"Ask a question of the corpus…";};
    const inp=$("#rsaInput"),send=()=>{const v=inp.value.trim();if(v.length>1){inp.value="";
      if(window.__rsResearchMode)runResearch(v);else runAsk(v);}};
    $("#rsaSend").onclick=send;
    inp.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();send();}});
    $("#rsaNew").onclick=()=>{ASK=[];saveAsk();paintAsk();const a=$("#rsaInput");if(a)a.focus();};
    if(window.__frScopePaint)window.__frScopePaint();
    paintAsk();}
  function paintAsk(){const t=$("#rsathread");if(!t)return;
    const runs=loadRuns();
    const strip=runs.length?'<div class="rr-strip"><span class="rr-strip-h">Research runs</span>'+runs.slice(0,8).map(r=>'<button class="rr-chip" data-run="'+esc(r.id)+'" title="'+esc(r.brief||"")+'">'+esc((r.title||"run").slice(0,42))+'</button>').join("")+"</div>":"";
    if(!ASK.length){t.innerHTML=strip+'<div class=rsa-intro>Ask a question of the corpus — answered with citations you can open. Follow-ups keep the thread.'+((DATA&&DATA.slug)?' <b>This work</b> confines answers to what you’re reading; scope to any author, or hand-pick works across the whole family with <b>choose works…</b> For an exhaustive study of a whole work — every page swept against your brief — use <b>⌖&hairsp;Research</b>.':'')+'</div>';}
    else{t.innerHTML=strip;ASK.forEach(m=>{if(m.role==="user")addQ(m.content);else addA(m.content,m.sources);});}
    t.querySelectorAll(".rr-chip").forEach(b=>b.onclick=()=>window.__frOpenRun&&window.__frOpenRun(b.dataset.run));}
  function addQ(text){const t=$("#rsathread"),d=el("div","rsa-turn");d.innerHTML='<div class=rsa-q></div>';d.firstChild.textContent=text;t.appendChild(d);return d;}
  function addA(ans,sources){const t=$("#rsathread"),d=el("div","rsa-turn"),a=el("div","rsa-a");a.innerHTML=ansHTML(ans,sources);t.appendChild(d);d.appendChild(a);return a;}
  const ansHTML=(ans,sources,deepGap)=>(deepGap?'<div class=rsa-deep title="What the Deep critic judged missing after round 1">⚲ Deep pass: '+esc(deepGap)+'</div>':'')+'<div class=rsa-body>'+mdLite(ans||"…")+'</div>'+((sources&&sources.length)?(sources.length>4?'<details class=rsa-srcwrap><summary class=rsn2>Sources ('+sources.length+')</summary><div class=rsa-src>'+sources.map(srcCard).join("")+'</div></details>':'<div class=rsa-src><span class=rsn2>Sources</span>'+sources.map(srcCard).join("")+'</div>'):"");
  const srcCard=s=>s.link   // sister-corpus source (the works-scope picker): absolute link out, cited by its bracketed label
    ?'<a class=rsr href="'+esc(s.link)+'" target=_blank rel=noopener><span class=rst>'+esc(s.cit||s.title||"")+'</span><span class=rsm>'+esc({pld:"Patrologia Latina",pg:"Patrologia Graeca",po:"Patrologia Orientalis",aq:"Aquinas"}[s.sister]||"sister corpus")+"</span></a>"
    :'<a class=rsr href="/the-faith-received/read/?w='+encodeURIComponent(s.slug)+"#b"+(s.page||1)+'-0" target=_blank><span class=rst>'+esc(s.title||s.slug)+"</span><span class=rsm>"+esc(s.author||"")+(s.author?" · ":"")+"pg. "+(s.page||"")+'</span><button class=rspin data-slug="'+esc(s.slug)+'" data-page="'+(s.page||1)+'" data-title="'+esc(s.title||s.slug)+'" data-author="'+esc(s.author||"")+'" title="Save to your notebook">★</button></a>';
  document.addEventListener("click",async ev=>{const b=ev.target.closest(".rspin");if(!b)return;ev.preventDefault();ev.stopPropagation();
    // one save path (2026-09-10): the notebook keeps the reference; fr_pins is its mirror
    const N=window.FRResearchNotebook;const slug=b.dataset.slug,page=String(+b.dataset.page||1);if(!N?.savePassage){b.title='The notebook could not load.';return;}
    const on=!N.hasReference(slug,page);b.disabled=true;
    try{if(on)await N.savePassage({slug,page,title:b.dataset.title,author:b.dataset.author});else await N.unsave(slug,page);b.classList.toggle("on",on);}catch(e){b.title=e?.message||'Could not save';}finally{b.disabled=false;}});
  const toBottom=()=>{body.scrollTop=body.scrollHeight;};
  const open=()=>{if(mode==="this"){findOpen();return;}ov.classList.add("open");q.style.display=mode==="ask"?"none":"";if(mode==="ask"){askShell();const ai=$("#rsaInput");if(ai)ai.focus();}else{body.classList.remove("askmode");q.focus();q.select();run();}
    loadPF();};   // prewarm the ranked index while the user types — first Enter answers instantly
  // selection-chip hook: open the palette in Ask mode with the selected passage pre-seeded
  window.__openAsk=(seed)=>{if(window.FRAsk){ov.classList.remove("open");return window.FRAsk.open({q:seed||""});}setMode("ask");open();const ai=$("#rsaInput");
    if(ai){ai.value=seed||"";ai.focus();ai.setSelectionRange(ai.value.length,ai.value.length);}};
  const close=()=>{ov.classList.remove("open");
    // iOS: focusing the sheet's input scrolls the WINDOW behind the fixed overlay; the app shell
    // is overflow:hidden so that offset never heals — the reader comes back dead/half-shifted
    // (owner report 2026-07-21). Blur and reset the window scroll on the way out.
    try{if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();}catch(e){}
    setTimeout(()=>{try{window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0;}catch(e){}},60);};
  ov.addEventListener("click",e=>{if(e.target===ov)close();});
  $("#rsX").onclick=close;
  document.addEventListener("keydown",e=>{
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();open();}
    else if(e.key==="/"&&!/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)&&!document.activeElement.isContentEditable){e.preventDefault();open();}
    else if(e.key==="Escape"&&ov.classList.contains("open")){e.preventDefault();close();}});
  // reader shortcuts: r = Related panel · ? = shortcut help
  document.addEventListener("keydown",e=>{
    if(/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)||document.activeElement.isContentEditable)return;
    if(e.key==="r"&&!e.metaKey&&!e.ctrlKey){const b=$("#rdRel");if(b){e.preventDefault();b.click();}}
    else if(e.key==="?"){e.preventDefault();
      let h=$("#kbdhelp");
      if(h){h.remove();return;}
      h=el("div","kbdhelp");h.id="kbdhelp";h.style.animation="khIn .15s var(--ease)";
      h.innerHTML='<div class=kh-box><b>Keyboard</b><table>'
        +'<tr><td>← →</td><td>previous / next page</td></tr>'
        +'<tr><td>⌘K or /</td><td>find in reading text</td></tr>'
        +'<tr><td>r</td><td>related passages (library + the Fathers)</td></tr>'
        +'<tr><td>Enter or ⌕</td><td>next match (Shift for previous)</td></tr>'
        +'<tr><td>[ or ]</td><td>hide / show the contents sidebar</td></tr>'
        +'<tr><td>Esc</td><td>close panels</td></tr>'
        +'<tr><td>click a page pill</td><td>copy the citation + link</td></tr></table>'
        +'<span class=kh-x>press ? to close</span></div>';
      h.onclick=()=>h.remove();document.body.appendChild(h);}});
  {const kb=$("#kbdBtn");if(kb)kb.onclick=()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"?"}));}
  const setMode=m=>{if(m==="ask"&&window.FRAsk){ov.classList.remove("open");window.FRAsk.open();return;}mode=m;$("#rsThis").setAttribute("aria-pressed",m==="this");$("#rsAll").setAttribute("aria-pressed",m==="all");$("#rsAsk").setAttribute("aria-pressed",m==="ask");
    q.placeholder=m==="this"?"Search this work…":m==="all"?"Search the corpus…":"Ask a question of the corpus…";
    q.style.display=m==="ask"?"none":"";
    {const sc=$("#rsScope");if(sc)sc.style.display=m==="all"?"flex":"none";}
    if(m==="ask"){askShell();const ai=$("#rsaInput");if(ai)ai.focus();}else{body.classList.remove("askmode");run();q.focus();}};
  $("#rsThis").onclick=()=>setMode("this");$("#rsAll").onclick=()=>setMode("all");$("#rsAsk").onclick=()=>setMode("ask");
  // Search runs on Enter or ⌕ — never per keystroke (a half-typed "d" used to fan out
  // pagefind + vector calls on every letter). Emptying the box resets the hint.
  q.addEventListener("input",()=>{if(mode==="ask")return;if(!q.value.trim()){clearTimeout(tmr);run();}});
  q.addEventListener("keydown",e=>{if(e.key!=="Enter"||mode==="ask")return;run();});
  $("#rsGo").onclick=()=>{if(mode!=="ask")run();};
  const idx=()=>{if(!wi)wi=fetch(BLOB+"/v1/works-index.json"+(window.__FR_VER?("?v="+window.__FR_VER):"")).then(r=>r.json()).then(d=>{const m={};(d.works||[]).forEach(w=>m[w.slug]=w);return m;}).catch(()=>({}));return wi;};
  const hlt=(s,terms)=>{let h=esc(s);terms.forEach(t=>{if(t.length>1){h=h.replace(new RegExp("("+t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","gi"),"<mark>$1</mark>");}});return h;};
  // render the Ask answer's markdown (headings/emphasis/paragraphs) + turn [slug/pNNN] citations into chips
  const slugCite=s=>s.replace(/\[([a-z0-9-]+)\/p(\d+)\]/gi,(m,sl,pg)=>`<a href="/the-faith-received/read/?w=${sl}#b${pg}-0" target="_blank" class="cite" title="${esc(sl)} · pg. ${pg}">${pg}</a>`);
  const mdLite=s=>{s=esc(s).replace(/^#{2,4}\s+(.+)$/gm,'<h4 class=ask-h>$1</h4>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g,'<em>$1</em>').replace(/\n{2,}/g,'</p><p>').replace(/\n/g,'<br>');return slugCite('<p>'+s+'</p>').replace(/<p>\s*(<h4)/g,'$1').replace(/(<\/h4>)\s*<\/p>/g,'$1');};
  function run(){if(mode==="ask")return;const t=q.value.trim();   // Ask is driven by its own in-thread composer
    if(!t){body.innerHTML="<div class=rsn>"+(mode==="this"?"Search the text you’re reading.":"Search the whole corpus — by topic or wording, ranked by relevance.")+"</div>";return;}
    if(mode==="all")return runCorpus(t);return runThis(t);}
  // ── within-work search: Pagefind (stemmed, relevance-ranked, real excerpts) scoped to this work,
  // with the exact substring scan as the always-available fallback/complement. The Pagefind index is
  // corpus-wide with slug in each record's meta — we post-filter resolved results to DATA.slug.
  let _pfP=null;
  function loadPF(){if(!BLOB)return Promise.resolve(null);if(_pfP)return _pfP;
    _pfP=(async()=>{const man=await fetch(BLOB+"/v1/search/pagefind/manifest.json?v=4").then(r=>r.json()).catch(()=>({buckets:9}));
      const p=await import(BLOB+"/v1/search/pagefind/b0/pagefind.js?v=4");
      const dirs=(man.list&&man.list.length)?man.list.map(e=>e.path.replace(/\/pagefind$/,"")).filter(d=>d!=="b0")
        :Array.from({length:(man.buckets||9)-1},(_,i)=>"b"+(i+1));
      await Promise.all(dirs.map(d=>p.mergeIndex(BLOB+"/v1/search/pagefind/"+d+"/").catch(()=>null)));
      return p;})().catch(()=>{_pfP=null;return null;});
    return _pfP;}
  const pfVariants=s=>{const o=new Set([s]);o.add(s.replace(/v/g,"u"));o.add(s.replace(/j/g,"i").replace(/v/g,"u"));return [...o].slice(0,3);};   // early-modern orthography: u/v, i/j
  async function pfThis(term){
    const p=await loadPF();if(!p||!DATA||!DATA.slug)return null;
    const seen={};
    for(const v of pfVariants(term)){try{const s=await p.search(v);(s.results||[]).slice(0,260).forEach(r=>{if(!seen[r.id])seen[r.id]=r;});}catch(e){}}
    const rs=Object.values(seen).sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,260);
    const ds=await Promise.all(rs.map(r=>r.data().catch(()=>null)));
    const mine=[];const got={};
    ds.forEach(d=>{if(d&&d.meta&&d.meta.slug===DATA.slug){const m=(d.meta.url||"").match(/#b(\d+)/),pg=m?+m[1]:1;
      if(!got[pg]){got[pg]=1;mine.push({pg,ex:d.excerpt||""});}}});
    return mine;}
  function runThis(term){
    close();if(window.__frSearchWork){window.__frSearchWork(term);return;}
    findSet([term]);findScrollCur();
  }
  async function runCorpus(term){body.innerHTML="<div class=rsn>Searching the corpus…</div>";
    try{const m=await idx();
      const enc=encodeURIComponent;
      const legs=[fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/vsearch?q="+enc(term)+"&k=120"+(SCOPE.tr?"&tr="+enc(SCOPE.tr):"")).then(r=>r.json()).catch(()=>null)];
      const order=[];
      [["pl",8],["pg",8],["po",4]].forEach(([c,k])=>{if(SCOPE[c]){order.push(c);
        legs.push(fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/vsearch?q="+enc(term)+"&k="+k+"&corpus="+c).then(r=>r.json()).catch(()=>null));}});
      const [lib,...pats]=await Promise.all(legs);
      if(term!==q.value.trim()||mode!=="all")return;
      const res=(lib&&lib.results)||[];
      let h=res.length?("<div class=rsn>"+res.length+" results across the library"+(SCOPE.tr?" — "+esc(SCOPE.tr)+" works":"")+"</div>"+res.map(x=>{const w=m[x.slug]||{};
        const en=(window.__TEN||{})[x.slug]||"";
        return '<a class=rsr href="/the-faith-received/read/?w='+encodeURIComponent(x.slug)+"#b"+x.page+'-0"><span class=rst>'+esc(en||w.title||x.slug)+(w.tradition?'<span class=rtrad>'+esc(w.tradition)+'</span>':'')+"</span><span class=rsm>"+esc(w.author||"")+(w.author?" · ":"")+"pg. "+x.page+"</span></a>";}).join("")):"<div class=rsn>No library results"+(SCOPE.tr?" among "+esc(SCOPE.tr)+" works":"")+".</div>";
      const NAME={pl:"Patrologia Latina — Latin Fathers",pg:"Patrologia Graeca — Greek Fathers",po:"Patrologia Orientalis — Eastern Fathers"};
      const BASE={pl:"https://pld-patrologia-latina.vercel.app",pg:"https://patrologia-graeca.vercel.app",po:"https://patrologia-orientalis.vercel.app"};
      order.forEach((c,i)=>{const rs=(((pats[i]||{}).results)||[]).filter(x=>x.score>=(c==="pg"?0.55:0.6));
        if(!rs.length)return;
        h+='<div class=rp-sec style="margin:1rem 0 .5rem">'+NAME[c]+'</div>'
          +rs.map(f=>{const inner='<span class=cit>'+esc(f.cit)+(f.era?' <span class=era>s. '+_rom(f.era)+'</span>':'')+'</span><span class=tx>'+esc(f.tx)+'…</span>';
            return f.doc?'<a class=rp-f href="'+BASE[c]+'/the-faith-received/read/'+encodeURIComponent(f.doc)+'.html#b'+(f.anchor||'')+'" target=_blank style="display:block;text-decoration:none;color:inherit">'+inner+'</a>'
                        :'<div class=rp-f>'+inner+'</div>';}).join("");});
      body.innerHTML=h;
    }catch(e){body.innerHTML="<div class=rsn>Corpus search unavailable.</div>";}}
  // ── DEEP RESEARCH (owner 2026-07-21): brief → visible plan → exhaustive page sweep of the
  // work (every page, not top-k) → classification → synthesized report + page-cited evidence.
  // Runs PERSIST (fr_research, capped) and each run is a CONVERSATION — follow-ups are grounded
  // in the run's own evidence. Past runs re-open from the "Runs" strip in the Ask panel.
  const loadRuns=()=>{try{return JSON.parse(localStorage.getItem("fr_research")||"[]");}catch(e){return[];}};
  const saveRuns=rs=>{try{localStorage.setItem("fr_research",JSON.stringify(rs.slice(0,12)));}catch(e){
    try{localStorage.setItem("fr_research",JSON.stringify(rs.slice(0,5)));}catch(e2){}}};
  function persistRun(run){
    const rs=loadRuns().filter(r=>r.id!==run.id);
    run.evidence=(run.evidence||[]).slice(0,220).map(f=>({slug:f.slug,page:f.page,props:f.props,quote:String(f.quote||"").slice(0,300),note:String(f.note||"").slice(0,120)}));
    run.md=String(run.md||"").slice(0,26000);
    rs.unshift(run);saveRuns(rs);}
  function evTable(evd){
    if(!evd||!evd.length)return "";
    const row=f=>'<tr><td><a href="/the-faith-received/read/?w='+encodeURIComponent(f.slug)+"#b"+f.page+'-0" target=_blank>p.'+f.page+"</a></td><td>"+esc((f.props||[]).join(","))+"</td><td>"+esc(f.quote)+"</td></tr>";
    const first=evd.slice(0,20).map(row).join(""),rest=evd.slice(20).map(row).join("");
    return '<div class="rr-evh">Evidence — '+evd.length+' passages</div><div class="rr-evwrap"><table class="rr-ev">'+first+(rest?'</table><details><summary>show all '+evd.length+'</summary><table class="rr-ev">'+rest+"</table></details>":"</table>")+"</div>";}
  const rrMd=md=>String(md||"").split("\n").map(l=>{
    if(/^\s*-{3,}\s*$/.test(l))return "";                       // horizontal rules → drop
    const m=/^(#{1,4})\s+(.*)$/.exec(l);
    return m?("**"+m[2].trim()+"**"):l;                          // # headings → bold lines (mdLite renders **)
  }).join("\n");
  function renderRunCard(run,card){
    card.innerHTML='<div class="rsrch"><div class="rr-title">'+esc(run.title||"Research run")+'</div>'
      +'<div class="rr-meta">'+esc((run.works||[]).join(" · "))+(run.stats?' · '+run.stats.pages+' pages · '+run.stats.unique+' passages':'')+' · '+new Date(run.ts).toLocaleDateString()+'</div>'
      +'<div class="rr-report"><div class=rsa-body>'+mdLite(rrMd(run.md||""))+"</div>"+evTable(run.evidence)+"</div>"
      +'<div class="rr-thread"></div>'
      +'<div class="rr-ask"><input placeholder="Ask about these findings — the conversation stays grounded in the evidence…"><button>›</button></div></div>';
    const th=card.querySelector(".rr-thread");
    (run.thread||[]).forEach(x=>{th.innerHTML+='<div class="rr-q">'+esc(x.q)+'</div><div class="rr-a rsa-body">'+mdLite(rrMd(x.a))+"</div>";});
    const inp=card.querySelector(".rr-ask input"),btn=card.querySelector(".rr-ask button");
    const go=async()=>{const q=inp.value.trim();if(q.length<2)return;inp.value="";
      th.innerHTML+='<div class="rr-q">'+esc(q)+'</div><div class="rr-a rsa-body">…</div>';toBottom();
      const slot=th.lastElementChild;
      try{
        const r=await fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/research",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({mode:"follow",question:q,brief:run.brief,summary:(run.md||"").slice(0,2500),evidence:run.evidence,prior:(run.thread||[]).slice(-6)})});
        const j=await r.json();
        slot.innerHTML=mdLite(rrMd(j.md||"(no answer)"));
        run.thread=(run.thread||[]).concat([{q,a:j.md||""}]).slice(-12);persistRun(run);
      }catch(e){slot.textContent="Unavailable — try again.";}
      toBottom();};
    btn.onclick=go;inp.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();go();}});}
  window.__frOpenRun=id=>{const run=loadRuns().find(r=>r.id===id);if(!run)return;
    if(!$("#rsathread"))askShell();
    {const it=$("#rsathread")&&$("#rsathread").querySelector(".rsa-intro");if(it)it.remove();}
    const card=el("div","rsa-turn");$("#rsathread").appendChild(card);renderRunCard(run,card);toBottom();};
  async function runResearch(brief){
    if(window.FRAsk){ov.classList.remove("open");return window.FRAsk.open({q:brief,mode:"deep",works:DATA&&DATA.slug?[DATA.slug]:[]});}
    if(!$("#rsathread"))askShell();
    {const it=$("#rsathread")&&$("#rsathread").querySelector(".rsa-intro");if(it)it.remove();}
    const scopeSel=window.__frScope&&window.__frScope.get&&window.__frScope.get();
    const works=(scopeSel&&scopeSel.tfr&&scopeSel.tfr.length)?scopeSel.tfr.slice(0,3):(DATA&&DATA.slug?[DATA.slug]:[]);
    if(!works.length){addA("Open a work (or pick works in the scope) to run research.",null);return;}
    addQ("⌖ "+brief);
    const t=$("#rsathread"),card=el("div","rsa-turn");
    card.innerHTML='<div class="rsrch"><div class="rr-title">Research run</div><div class="rr-steps"></div><div class="rr-prog">planning…</div><div class="rr-report"></div></div>';
    t.appendChild(card);toBottom();
    const stepsEl=card.querySelector(".rr-steps"),progEl=card.querySelector(".rr-prog");
    let steps=[],title="Research run";
    const paint=()=>{stepsEl.innerHTML=steps.map((s,i)=>'<div class="rr-step '+(s.st||"")+'"><span class="rr-tick">'+(s.st==="done"?"✓":(s.st==="run"?"▸":"◯"))+"</span> "+esc(s.label)+(s.note?' <span class="rr-note">· '+esc(s.note)+"</span>":"")+"</div>").join("");};
    try{
      const r=await fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/research",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({brief,works})});
      const rd=r.body.getReader(),dc=new TextDecoder();let buf="";
      for(;;){const {done,value}=await rd.read();if(done)break;
        buf+=dc.decode(value,{stream:true});
        const lines=buf.split("\n");buf=lines.pop();
        for(const ln of lines){
          let ev=null;try{ev=JSON.parse(ln);}catch(e){continue;}
          if(ev.t==="plan"){title=ev.title||title;card.querySelector(".rr-title").textContent=title;steps=ev.steps.map(l=>({label:l}));paint();}
          else if(ev.t==="step"){if(steps[ev.i]){steps[ev.i].st=ev.status;if(ev.note)steps[ev.i].note=ev.note;paint();}}
          else if(ev.t==="progress"){progEl.textContent="sweeping "+ev.done+"/"+ev.total+" · "+ev.found+" passages";}
          else if(ev.t==="error"){progEl.textContent="error: "+(ev.msg||"failed");}
          else if(ev.t==="report"){
            const run={id:"rr"+Date.now(),ts:Date.now(),title,brief,works,stats:ev.stats,md:ev.md,evidence:ev.evidence,thread:[]};
            persistRun(run);
            renderRunCard(run,card);
            if(ev.stats)card.querySelector(".rr-meta").textContent+=(ev.stats.capped?" · capped":"");
          }
          toBottom();
        }
      }
    }catch(e){progEl.textContent="Research unavailable — try again.";}
  }
  async function runAsk(term){
    if(window.FRAsk){ov.classList.remove("open");return window.FRAsk.open({q:term,autoSend:true});}
    if(!$("#rsathread"))askShell();
    {const it=$("#rsathread")&&$("#rsathread").querySelector(".rsa-intro");if(it)it.remove();}
    const here=$("#rsAskWork")&&$("#rsAskWork").checked;
    ASK.push({role:"user",content:term});if(ASK.length>16)ASK=ASK.slice(-16);saveAsk();
    addQ(term);const aEl=addA("…",null);toBottom();
    const deepOn=$("#rsAskDeep")&&$("#rsAskDeep").checked;
    // hand-picked works scope (the sisters' multi-work picker): when active it IS the pool —
    // this-work / author / Fathers-strip scoping all yield to the explicit selection
    const scopeSel=window.__frScope&&window.__frScope.get&&window.__frScope.get();
    let filters=!scopeSel&&here&&DATA&&DATA.slug?{slug:DATA.slug}:undefined;
    if(!scopeSel&&window.__rsFC&&window.__rsFC.length){filters=filters||{};filters.fathersCorpora=window.__rsFC.slice();}
    const av=($("#rsAskAuth")&&$("#rsAskAuth").value||"").trim();
    if(av&&!here&&!scopeSel){filters=filters||{};filters.author=av;
      const set=(window.__rsWIDX||[]).filter(w=>w.author===av).map(w=>w.slug);
      if(set.length&&set.length<=50)filters.works=set;}
    const msgs=ASK.map(m=>({role:m.role,content:m.content}));
    if(scopeSel){const nw=Object.values(scopeSel).reduce((a,x)=>a+(x||[]).length,0);
      const pill=el("div","rsa-scopepill");
      pill.innerHTML='Answering within your hand-picked scope ('+nw+' work'+(nw>1?'s':'')+') — not this work\u2019s text alone. <button type=button>clear scope</button>';
      pill.querySelector("button").onclick=()=>{window.__frScope.set(null);pill.remove();};
      aEl.parentElement.insertBefore(pill,aEl);}
    let sources=null,ans="";
    try{await idx();const r=await fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.assign(filters?{messages:msgs,filters}:{messages:msgs},deepOn?{deep:true}:{},scopeSel?{scope:scopeSel}:{},(DATA&&DATA.slug&&!scopeSel)?{hint_w:DATA.slug}:{}))});
      const rd=r.body.getReader(),dc=new TextDecoder();let buf="";
      for(;;){const {done,value}=await rd.read();if(done)break;buf+=dc.decode(value,{stream:true});
        // progress frames ({"t":"p","m":"..."}) arrive on their own lines BEFORE the sources
        // preamble — surface them as the live stage line, never as answer text
        while(sources===null){const nl=buf.indexOf("\n");if(nl<0)break;
          const line=buf.slice(0,nl);let pre={};try{pre=JSON.parse(line)||{};}catch(e){}
          buf=buf.slice(nl+1);
          if(pre&&pre.t){if(pre.t==="p"&&pre.m)aEl.innerHTML='<span class="sbusy" style="color:var(--muted);font-style:italic">'+String(pre.m).replace(/</g,"&lt;")+'</span>';continue;}
          sources=pre.sources||[];if(pre.deep)aEl.dataset.deep=pre.deep;}
        if(sources!==null){ans=buf;aEl.innerHTML=ansHTML(ans,sources,aEl.dataset.deep);toBottom();}}
      ASK.push({role:"assistant",content:ans,sources:sources||[]});if(ASK.length>16)ASK=ASK.slice(-16);saveAsk();
      // shared conversation store (owner 2026-08-19 'connect chats to work'): rail asks persist
      // to the SAME fr_chats the search page lists/restores, tagged with this work
      try{
        var _st=JSON.parse(localStorage.getItem("fr_chats")||"{}");var _cs=Array.isArray(_st.chats)?_st.chats:[];
        window.__frRailChat=window.__frRailChat||("c"+Date.now());
        var _c=_cs.filter(function(x){return x.id===window.__frRailChat;})[0];
        if(!_c){_c={id:window.__frRailChat,ts:Date.now(),t:term.slice(0,90),w:DATA&&DATA.slug||"",turns:[]};_cs.unshift(_c);}
        _c.turns.push({q:term,a:String(ans).slice(0,16000),src:(sources||[]).slice(0,14).map(function(s2){return {slug:s2.slug,page:s2.page};}),graph:null,ts:Date.now()});
        _c.ts=Date.now();
        _cs=[_c].concat(_cs.filter(function(x){return x.id!==_c.id;}));
        localStorage.setItem("fr_chats",JSON.stringify({v:1,chats:_cs.slice(0,20)}));
        if(window._frSyncChats)try{window._frSyncChats(JSON.parse(localStorage.getItem("fr_chats")));}catch(e){}
      }catch(e){}
    }catch(e){aEl.innerHTML='<div class=rsa-body>Ask unavailable. Please try again.</div>';ASK.push({role:"assistant",content:"(unavailable)",sources:[]});}}
  // masthead trigger (all modes)
  const btn=el("button","tgl");btn.id="rsBtn";btn.title="Search (⌘K or /)";btn.setAttribute("aria-label","Search");btn.textContent="⌕";btn.onclick=open;
  window.__frOpenSearch=findOpen;   // thumb-bar hook (mobile shell)
  const ctr=document.querySelector(".ctr");if(ctr)ctr.insertBefore(btn,ctr.firstChild);
  window._frSearch=findOpen;
}
/* ── Ask works-scope (the sisters' research-rail picker, TFR edition, 2026-07-20) ──────────────────
   Pick up to 60 works across the embedded family (TFR · PL · PG · PO · AQ) and every Ask runs
   against exactly that pool. Catalog: /data/embcat.json (emitted from the shared Upstash
   namespaces — a work is listed IFF it has vectors, so everything here is askable). Selection
   persists in localStorage fr_ask_scope_v1; runAsk sends it as body.scope and the explicit
   selection overrides this-work / author / Fathers-strip scoping. Family register: quiet row,
   calm overlay, no eyebrows. */
(function(){
  var LSK="fr_ask_scope_v1";
  var CORP=[["tfr","TFR"],["pld","PL"],["pg","PG"],["po","PO"],["aq","AQ"]];
  var CNAME={tfr:"The Faith Received",pld:"Patrologia Latina",pg:"Patrologia Graeca",po:"Patrologia Orientalis",aq:"Aquinas"};
  var TTL=24*3600*1000;   // a scope silently outliving its session hijacks later asks (owner 2026-07-21) — expire after 24h idle; every use refreshes
  function getScope(){try{var w=JSON.parse(localStorage.getItem(LSK))||null;if(!w||typeof w!=="object")return null;
    if(!w.sel||!w.ts){localStorage.removeItem(LSK);return null;}          // legacy bare format = untracked age → clear
    if(Date.now()-w.ts>TTL){localStorage.removeItem(LSK);return null;}
    var s=w.sel,n=0;CORP.forEach(function(c){n+=(s[c[0]]||[]).length;});
    if(!n)return null;
    w.ts=Date.now();try{localStorage.setItem(LSK,JSON.stringify(w));}catch(e){}
    return s;}catch(e){return null;}}
  function setScope(s){try{if(s)localStorage.setItem(LSK,JSON.stringify({sel:s,ts:Date.now()}));else localStorage.removeItem(LSK);}catch(e){}paintRow();}
  function scopeCount(s){var n=0;CORP.forEach(function(c){n+=(s&&s[c[0]]||[]).length;});return n;}
  window.__frScope={get:getScope,set:setScope};
  var CAT=null,CATP=null;
  function loadCat(){if(CATP)return CATP;
    CATP=fetch("https://mo-tfr-library.mo-podcast-feed.workers.dev/v1/data/embcat.json").then(function(r){if(!r.ok)throw 0;return r.json();})
      .then(function(j){var W=j.works||[];j.works=W.filter(function(w){return w.c==="tfr";}).concat(W.filter(function(w){return w.c!=="tfr";}));CAT=j;return j;})   // home corpus first in the idle view
      .catch(function(){CAT={works:[],counts:{}};return CAT;});
    return CATP;}
  var fold=function(s){return String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();};
  var css=document.createElement("style");
  css.textContent=
    ".psc-row{display:flex;align-items:center;gap:.45rem;margin:.3rem 0 .05rem;font-size:.76rem;color:var(--muted,#6f6a64)}"+
    ".psc-row b{font-weight:600;color:var(--fg,#2b2620)}"+
    ".psc-link{background:none;border:0;padding:0;color:var(--accent,#8b2f24);cursor:pointer;font:inherit;text-decoration:underline;text-underline-offset:2px}"+
    ".psc-ov{position:fixed;inset:0;z-index:1400;background:rgba(30,24,18,.42);display:flex;align-items:center;justify-content:center}"+
    ".psc{width:min(680px,94vw);max-height:82vh;display:flex;flex-direction:column;background:var(--card-bg,var(--bg,#fffaf3));color:var(--fg,#2b2620);border:1px solid var(--border,rgba(0,0,0,.12));border-radius:12px;box-shadow:0 4px 10px rgba(60,30,15,.08),0 24px 60px -18px rgba(60,30,15,.4);padding:1rem 1.1rem}"+
    ".psc h3{margin:.1rem 0 .15rem;font:400 1.15rem/1.2 var(--font-display,serif)}"+
    ".psc-meta{font-size:.72rem;color:var(--muted,#6f6a64);margin-bottom:.6rem}"+
    ".psc-q{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:.45rem .6rem;border:1px solid var(--border,rgba(0,0,0,.16));border-radius:8px;background:var(--bg,#fdf9f2);color:inherit}"+
    ".psc-pills{display:flex;gap:.35rem;margin:.5rem 0;flex-wrap:wrap}"+
    ".psc-pill{border:1px solid var(--border,rgba(0,0,0,.14));background:none;color:var(--muted,#6f6a64);border-radius:999px;padding:.18rem .6rem;font:inherit;font-size:.74rem;cursor:pointer}"+
    ".psc-pill.on{color:var(--accent,#8b2f24);border-color:var(--accent,#8b2f24)}"+
    ".psc-list{flex:1 1 auto;overflow:auto;border-top:1px solid var(--border,rgba(0,0,0,.1));margin-top:.35rem;padding-top:.35rem}"+
    ".psc-it{display:flex;align-items:baseline;gap:.5rem;padding:.26rem .15rem;cursor:pointer;border-radius:6px}"+
    ".psc-it:hover{background:rgba(139,47,36,.05)}"+
    ".psc-it input{flex:none;transform:translateY(1px)}"+
    ".psc-t{flex:1 1 auto;min-width:0;font-size:.86rem}"+
    ".psc-a{color:var(--muted,#6f6a64);font-size:.76rem;font-style:italic}"+
    ".psc-b{flex:none;font-size:.66rem;color:var(--muted,#6f6a64);font-variant-numeric:tabular-nums}"+
    ".psc-foot{display:flex;align-items:center;gap:.6rem;padding-top:.6rem;border-top:1px solid var(--border,rgba(0,0,0,.1));margin-top:.4rem}"+
    ".psc-btn{font:inherit;font-size:.8rem;padding:.34rem .85rem;border-radius:8px;border:1px solid var(--border,rgba(0,0,0,.16));background:none;color:inherit;cursor:pointer}"+
    ".psc-btn.pri{background:var(--accent,#8b2f24);border-color:var(--accent,#8b2f24);color:#fff}"+
    '[data-theme="dark"] .psc{background:#2a2320;border-color:rgba(255,255,255,.14)}';
  document.head.appendChild(css);
  function escT(s){var d=document.createElement("div");d.textContent=s==null?"":s;return d.innerHTML;}
  function openPicker(){
    loadCat().then(function(cat){
      var sel=getScope()||{};CORP.forEach(function(c){sel[c[0]]=(sel[c[0]]||[]).map(String);});
      var corpOn={};
      var ov=document.createElement("div");ov.className="psc-ov";
      var box=document.createElement("div");box.className="psc";
      var total=(cat.works||[]).length;
      box.innerHTML='<h3>Ask scope — pick the works</h3>'
        +'<div class="psc-meta">'+total.toLocaleString()+" embedded works · catalog "+(cat.generated||"").slice(0,10)
        +" · only embedded works are listed, so everything here is askable</div>"
        +'<input class="psc-q" type="search" placeholder="Search by title or author…" aria-label="Search works">'
        +'<div class="psc-pills"></div><div class="psc-list" role="listbox"></div>'
        +'<div class="psc-foot"><span class="psc-n" style="flex:1 1 auto;font-size:.78rem;color:var(--muted,#6f6a64)"></span>'
        +'<button class="psc-btn psc-clear">Clear</button><button class="psc-btn pri psc-done">Done</button></div>';
      ov.appendChild(box);document.body.appendChild(ov);
      var q=box.querySelector(".psc-q"),list=box.querySelector(".psc-list"),pills=box.querySelector(".psc-pills"),nEl=box.querySelector(".psc-n");
      CORP.forEach(function(c){
        var b=document.createElement("button");b.className="psc-pill";b.type="button";
        b.textContent=c[1]+" "+((cat.counts||{})[c[0]]||0).toLocaleString();b.title=CNAME[c[0]];
        b.addEventListener("click",function(){corpOn[c[0]]=!corpOn[c[0]];b.classList.toggle("on",!!corpOn[c[0]]);paint();});
        pills.appendChild(b);});
      function selCount(){var n=0;CORP.forEach(function(c){n+=sel[c[0]].length;});return n;}
      function dispT(w){if(w.c==="tfr"&&window.__TEN&&window.__TEN[w.s])return window.__TEN[w.s];return w.t;}
      function paint(){
        var term=fold(q.value.trim());
        var anyC=CORP.some(function(c){return corpOn[c[0]];});
        var rows=[],works=cat.works||[];
        var selKeys={};CORP.forEach(function(c){sel[c[0]].forEach(function(s){selKeys[c[0]+"|"+s]=1;});});
        for(var i=0;i<works.length&&rows.length<400;i++){
          var w=works[i],k=w.c+"|"+w.s,isSel=!!selKeys[k];
          if(!isSel){
            if(anyC&&!corpOn[w.c])continue;
            if(term&&fold(dispT(w)+" "+w.t+" "+w.a).indexOf(term)<0)continue;
            if(!term&&!anyC&&rows.length>=60)continue;}
          rows.push([w,isSel]);}
        rows.sort(function(a,z){return z[1]-a[1];});
        list.innerHTML="";
        rows.forEach(function(rw){
          var w=rw[0];
          var it=document.createElement("label");it.className="psc-it";
          it.innerHTML='<input type="checkbox"'+(rw[1]?" checked":"")+">"
            +'<span class="psc-t">'+escT(dispT(w))+(w.a?' <span class="psc-a">— '+escT(w.a)+"</span>":"")+"</span>"
            +'<span class="psc-b">'+(CORP.filter(function(c){return c[0]===w.c;})[0]||["",w.c])[1]+" · "+w.n+"</span>";
          it.querySelector("input").addEventListener("change",function(e){
            var arr=sel[w.c],sv=String(w.s),ix=arr.indexOf(sv);
            if(e.target.checked&&ix<0){if(selCount()>=60){e.target.checked=false;return;}arr.push(sv);}
            if(!e.target.checked&&ix>=0)arr.splice(ix,1);
            nEl.textContent=selCount()+" selected (max 60)";});
          list.appendChild(it);});
        nEl.textContent=selCount()+" selected (max 60)";}
      q.addEventListener("input",paint);
      box.querySelector(".psc-clear").addEventListener("click",function(){CORP.forEach(function(c){sel[c[0]]=[];});paint();});
      box.querySelector(".psc-done").addEventListener("click",function(){
        var out={},n=0;
        CORP.forEach(function(c){if(sel[c[0]].length){out[c[0]]=(c[0]==="pld"||c[0]==="pg")?sel[c[0]].map(Number):sel[c[0]];n+=sel[c[0]].length;}});
        setScope(n?out:null);closeOv();});
      function closeOv(){if(ov.parentNode)ov.parentNode.removeChild(ov);}
      ov.addEventListener("click",function(e){if(e.target===ov)closeOv();});
      document.addEventListener("keydown",function esc2(e){if(e.key==="Escape"){closeOv();document.removeEventListener("keydown",esc2);}});
      paint();q.focus();});}
  function paintRow(){
    var rowEl=document.getElementById("rsaScopeRow");
    if(!rowEl)return;
    rowEl.className="psc-row";
    var sc=getScope();
    if(!sc){rowEl.innerHTML='<span>Scope:</span> <b>default</b> <button class="psc-link" type="button">choose works…</button>';}
    else{var parts=[];CORP.forEach(function(c){var n=(sc[c[0]]||[]).length;if(n)parts.push(c[1]+" "+n);});
      rowEl.innerHTML='<span class="psc-live">●</span> <span>Scope:</span> <b>'+scopeCount(sc)+" work"+(scopeCount(sc)>1?"s":"")+"</b> <span>("+parts.join(" · ")+")</span> "
        +'<button class="psc-link" type="button">change</button> <button class="psc-link psc-x" type="button">clear</button>'
        +' <span class="psc-warn">answers use ONLY these works</span>';}
    var tw=document.getElementById("rsAskWork");if(tw){tw.disabled=!!sc;var lb=tw.parentElement;if(lb)lb.style.opacity=sc?".45":"";}
    rowEl.querySelectorAll(".psc-link").forEach(function(b){
      b.addEventListener("click",function(){if(b.classList.contains("psc-x"))setScope(null);else openPicker();});});}
  window.__frScopePaint=paintRow;
})();
// Research rail search indexes detached canonical pages, never the virtualized reading window.
function frReaderSearchText(nodes,omitNotes=false){
  const block=/^(p|ab|head|item|label|l|cell|row|div|li|tr|td|h[1-6]|note|figDesc|lb)$/i;
  const text=node=>{
    if(node.nodeType===3)return node.nodeValue||'';
    if(/^(fw|script|style|button|input|textarea|ref)$/i.test(node.localName||'')||omitNotes&&node.localName==='note')return '';
    const value=node.childNodes?Array.from(node.childNodes).map(text).join(''):(node.textContent||'');
    return block.test(node.localName||'')?' '+value+' ':value;
  };
  return Array.from(nodes||[]).map(text).join(' ').replace(/\s+/g,' ').trim();
}
function frReaderSearchPageKey(value){const key=String(value??'');return /^\d+$/.test(key)?key.replace(/^0+(?=\d)/,''):key;}
function frReaderSearchResultLabel(page,location){
  const reference=String(page??''),label=String(location||'').trim(),literal=reference.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(!reference||label===reference||new RegExp('(?:^|\\s)(?:p\\.|pg\\.|page|col\\.|§)\\s*'+literal+'(?=$|[\\s,;·])','i').test(label))return label||reference;
  return (label?label+' · ':'')+'p. '+reference;
}
function frReaderSearchProvenance(node){
  let sourceRegion='',sourcePath='';
  for(let current=node;current;current=current.parentElement||current.parentNode){
    const region=current.getAttribute?.('data-source-region');if(!sourceRegion&&['body','contents','frontmatter'].includes(region))sourceRegion=region;
    if(!sourcePath)sourcePath=current.getAttribute?.('data-source-path')||'';
    if(sourceRegion&&sourcePath)break;
  }
  return {sourceRegion,sourcePath};
}
function frReaderSearchPassages(nodes,lane){
  const passages=[];
  const add=(node,kind)=>{const text=frReaderSearchText([node],kind!=='note');if(text)passages.push({text,lower:text.toLowerCase(),lane,kind,...frReaderSearchProvenance(node),noteId:kind==='note'?String(node.getAttribute?.('xml:id')||'').replace(/^n-/,'').replace(/^(fn\d*)-(?:la|en)-/,'$1-'):'',margin:kind==='note'&&node.getAttribute?.('place')==='margin'});};
  const walk=node=>{
    if(node.nodeType===3){if(node.nodeValue?.trim())add(node,'body');return;}
    if(node.localName==='note'){add(node,'note');return;}
    if(['list','table','div','body','front','back'].includes(node.localName)){for(const child of node.childNodes||[])walk(child);return;}
    add(node,'body');const notes=child=>{for(const item of child.childNodes||[]){if(item.localName==='note')add(item,'note');else notes(item);}};notes(node);
  };
  for(const node of nodes||[])walk(node);return passages;
}
async function frBuildReaderSearchIndex({tei,pages=[],loaded=[],sourceLabel='Source'},yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))){
  const canonical=!!tei&&['en','la'].some(lane=>Object.keys(tei[lane]||{}).length),records=[],lanes=[];
  if(canonical){
    const names={en:'English',la:sourceLabel};for(const lane of ['en','la'])if(Object.keys(tei[lane]||{}).length)lanes.push(names[lane]);
    const references=new Map(pages.map(page=>[frReaderSearchPageKey(page.n),String(page.n)]));
    const keys=[...new Set([...Object.keys(tei.en||{}),...Object.keys(tei.la||{})])];
    for(let i=0;i<keys.length;i++){
      const key=keys[i],passages=[...frReaderSearchPassages(tei.en?.[key]||[],'en'),...frReaderSearchPassages(tei.la?.[key]||[],'la')],text=passages.map(passage=>passage.text).join(' ');
      if(text)records.push({page:references.get(frReaderSearchPageKey(key))||key,text,lower:text.toLowerCase(),passages});
      if(i%32===31)await yieldTask();
    }
  }else{
    for(const page of loaded){const text=frReaderSearchText(page.nodes);if(text)records.push({page:String(page.page),text,lower:text.toLowerCase()});}
  }
  return {kind:canonical?'canonical':'loaded',lanes,records,pages:records.length};
}
function frSearchReaderIndex(index,query){
  const terms=[...new Set(String(query||'').toLowerCase().trim().split(/\s+/).filter(Boolean))];
  const hits=[];if(terms.length)for(const record of index.records){const passage=(record.passages||[record]).find(passage=>terms.every(term=>passage.lower.includes(term)));if(passage)hits.push({...record,...passage});}
  const regionOrder={body:0,contents:1,frontmatter:2};hits.sort((a,b)=>(regionOrder[a.sourceRegion]??0)-(regionOrder[b.sourceRegion]??0));return {terms,hits};
}
function frReaderSearchSnippet(text,terms){
  const first=Math.max(0,text.toLowerCase().indexOf(terms[0]||'')),start=Math.max(0,first-65),end=Math.min(text.length,first+180);
  return (start?'…':'')+text.slice(start,end).trim()+(end<text.length?'…':'');
}
function frReaderSearchMarkup(text,terms){
  if(!terms.length)return esc(text);
  const pattern=terms.slice().sort((a,b)=>b.length-a.length).map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  return String(text).split(new RegExp('('+pattern+')','gi')).map((part,i)=>i%2?'<mark>'+esc(part)+'</mark>':esc(part)).join('');
}
function findResultOccurrence(occurrences,hit,term,hosts=new Set()){
  const index=hit.text.toLowerCase().indexOf(term.toLowerCase());if(index<0)return null;
  const before=hit.text.slice(Math.max(0,index-90),index).toLowerCase(),after=hit.text.slice(index+term.length,index+term.length+90).toLowerCase();
  const available=Math.min(60,before.length)+Math.min(60,after.length),letters=(before.slice(-60)+after.slice(0,60)).replace(/[^\p{L}\p{N}]/gu,'').length,candidates=[];
  for(const occurrence of occurrences){
    if(occurrence.text.toLowerCase()!==term.toLowerCase()||hit.lane&&occurrence.lane!==hit.lane)continue;
    if(hit.kind==='note'&&!hit.margin&&!occurrence.note||hit.kind==='body'&&occurrence.note)continue;
    const exactPage=occurrence.page===String(hit.page);if(!exactPage&&(!hosts.has(occurrence.canonicalId)||occurrence.pageBoundary))continue;
    let matchedLeft=0,matchedRight=0;const left=occurrence.before.toLowerCase(),right=occurrence.after.toLowerCase();
    for(let n=1;n<=Math.min(60,before.length,left.length);n++)if(before.slice(-n)===left.slice(-n))matchedLeft=n;
    for(let n=1;n<=Math.min(60,after.length,right.length);n++)if(after.slice(0,n)===right.slice(0,n))matchedRight=n;
    const matchedLetters=(left.slice(left.length-matchedLeft)+right.slice(0,matchedRight)).replace(/[^\p{L}\p{N}]/gu,'').length;
    let score=matchedLeft+matchedRight;
    // A shared Flow host is not evidence that this is the requested source passage.
    if(!exactPage&&(letters<6||score<Math.min(24,available)||matchedLetters<Math.min(12,letters)))continue;
    if(exactPage&&letters>=6&&(score<Math.min(12,available)||matchedLetters<Math.min(6,letters)))continue;
    if(hit.noteId&&occurrence.note===hit.noteId)score+=100;
    candidates.push({occurrence,score,exactPage});
  }
  const exact=candidates.filter(candidate=>candidate.exactPage),ranked=(exact.length?exact:candidates).sort((a,b)=>b.score-a.score);
  if(!ranked.length||!ranked[0].exactPage&&ranked.length>1&&ranked[0].score===ranked[1].score)return null;
  return ranked[0].occurrence;
}
async function findReadSearchResult(hit,terms,{current=()=>true,status=()=>{}}={}){
  findSet(terms,{open:true});
  const request=++FIND.sequence,readerSerial=window.__readerNavSerial||0;
  const active=()=>current()&&request===FIND.sequence&&(window.__readerNavSerial||0)===readerSerial;
  const button=hit.lane==='la'?document.getElementById('m-par'):hit.lane==='en'?document.getElementById('m-en'):null;
  if(button?.getAttribute('aria-pressed')==='false')button.click();
  status('Finding the matching words in '+(hit.kind==='note'?'the note':'the text')+'…');
  for(let attempt=0;attempt<120;attempt++){
    if(!active())return false;
    window.__ensurePage?.(hit.page);
    if(typeof DATA!=='undefined'&&DATA?.__loadRest&&!DATA.pages.some(page=>String(page.n)===String(hit.page)))DATA.__loadRest().catch(()=>{});
    const reading=document.getElementById('reading'),hosts=new Set(),folios=Array.from(reading.querySelectorAll('.folio')).filter(folio=>String(folio.dataset.page)===String(hit.page));
    for(const anchor of reading.querySelectorAll('.pganchor'))if(String(anchor.dataset.page)===String(hit.page)){const row=anchor.closest('.row[id]');if(row)hosts.add(row.id);const host=anchor.closest('.folio');if(host&&!folios.includes(host))folios.push(host);}
    for(const folio of folios){if(!FIND.forcedPages.has(folio))FIND.forcedPages.set(folio,folio.style.contentVisibility||'');if(folio.style.contentVisibility!=='visible')folio.style.contentVisibility='visible';
      if(hit.kind==='note'&&!hit.margin)for(const row of folio.querySelectorAll('.rapp')){
        if(hit.noteId?row.dataset.fnid!==hit.noteId:!row.textContent.toLowerCase().includes(terms[0].toLowerCase()))continue;
        const toggle=window.FRFootnotes?.bankToggle(row);if(toggle){toggle.classList.add('open');window.FRFootnotes.syncBank(toggle);const label=toggle.dataset.noteLabel||toggle.textContent.replace(/^(?:show |hide |hide the )/i,'');toggle.textContent='Hide '+label;}row.classList.remove('cl');
      }
    }
    FIND.terms=terms;FIND.open=true;findPaint();
    const occurrence=findResultOccurrence(FIND.occurrences,hit,terms[0],hosts);
    if(occurrence){FIND.selected?.marks.forEach(mark=>mark.classList.remove('cur'));occurrence.page=String(hit.page);FIND.i=FIND.occurrences.indexOf(occurrence);FIND.selected=occurrence;occurrence.marks.forEach(mark=>mark.classList.add('cur'));_findBar();const moved=findScrollCur();if(moved)status('Showing the matching words'+(hit.kind==='note'?' in the note':'')+'. Your results are retained.');return moved;}
    if(hit.margin){
      const wanted=hit.text.toLowerCase().replace(/\s+/g,' ').trim(),note=Array.from(reading.querySelectorAll('.mnote')).find(note=>note.textContent.toLowerCase().replace(/\s+/g,' ').trim()===wanted);
      const marker=note?.previousElementSibling?.matches('.rm-marker')?note.previousElementSibling:note?.closest('.rm-group')?.querySelector('.rm-marker');
      if(marker){marker.click();const panel=document.querySelector('#readerMarginPopover .rm-panel-body'),walker=panel&&document.createTreeWalker(panel,NodeFilter.SHOW_TEXT);let node;
        while(walker&&(node=walker.nextNode())){const index=node.nodeValue.toLowerCase().indexOf(terms[0].toLowerCase());if(index<0)continue;let text=node;if(index+terms[0].length<text.nodeValue.length)text.splitText(index+terms[0].length);if(index)text=text.splitText(index);const mark=document.createElement('mark');mark.className='findhit cur';text.parentNode.insertBefore(mark,text);mark.appendChild(text);mark.scrollIntoView({block:'center',behavior:'auto'});status('Showing the matching words in the margin note. Your results are retained.');return true;}
      }
    }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(active())status('This passage is indexed, but its matching words could not be located in the current view. Your results are retained.');return false;
}
// End research rail search index helpers.
function canTranslateSource(data=DATA,reader=document.getElementById('app')){
  return String(data?.src_lang||'').toLowerCase().split('-')[0]!=='en'&&data?.en_only!==true&&!reader?.classList.contains('en-only');
}
function __initReaderTools(){
  const reading=$("#reading"), WORK=[DATA.title,DATA.volume].filter(Boolean).join(", ")||"";  // cite incl. volume / part
  const WORK_SLUG=DATA.slug||new URLSearchParams(location.search).get("w")||new URLSearchParams(location.search).get("ws")||DATA.workspace||"", WSID=DATA.workspace||WORK_SLUG, K=r=>WSID+"|"+r.id;   // workspace-scoped storage key (row ids repeat across works)
  const lj=k=>{try{return JSON.parse(lsGet(k))||{}}catch(e){return{}}};
  function applyTranslationPolicy(){
    const allowed=canTranslateSource();document.documentElement.classList.toggle('fr-no-personal-translation',!allowed);
    document.querySelectorAll('#spTr,[data-reader-action="translate"],.nb-mytr').forEach(control=>{control.hidden=!allowed;});
    const toggle=$('#nbMyTr');if(toggle){toggle.disabled=!allowed;toggle.checked=allowed&&lsGet('fr_mytr')==='1';}
    if(!allowed){
      reading.querySelectorAll('.rowx.tr,.trpencil,.la-rev').forEach(node=>node.remove());
      reading.querySelectorAll('.en[data-orig],.en.mytr').forEach(lane=>{if('orig' in lane.dataset){lane.innerHTML=lane.dataset.orig;delete lane.dataset.orig;}lane.classList.remove('mytr');});
      reading.querySelectorAll('.row.la-on').forEach(row=>row.classList.remove('la-on'));
    }
    return allowed;
  }
  applyTranslationPolicy();
  {const previous=window._afterBuild;window._afterBuild=()=>{previous?.();applyTranslationPolicy();};}
  // Citation/research targets can be merged Flow rows spanning many pages. Centering a tall
  // row lands in its middle instead of at the cited opening; short passages still read best
  // centered. The shell owns the shared implementation so early hash landing and deferred
  // reader tools use the same rule.
  const placeReaderAnchor=(target,opts={})=>{
    if(!target)return null;
    if(window.__frPlaceReaderAnchor)return window.__frPlaceReaderAnchor(target,opts);
    const sc=document.getElementById("scroll"),view=(sc&&sc.clientHeight)||innerHeight||0,h=target.getBoundingClientRect().height||0;
    const block=opts.block||(target.classList.contains("pganchor")||h>Math.max(240,view-24)?"start":"center");
    target.scrollIntoView({block,behavior:opts.behavior||"auto"});return block;
  };
  const save=(k,v,hook)=>{lsSet(k,JSON.stringify(v));if(window[hook])try{window[hook](v)}catch(e){}};
  const AUTHOR=(Array.isArray(DATA.author)?DATA.author.filter(Boolean).join(", "):(DATA.author||"")).toString().trim();
  const CITEWORK=AUTHOR?(AUTHOR+", "+WORK):WORK;   // citation = "Author, Title, Volume" — author included for copy/paste & cite
  const rowCite=r=>{const f=r.closest(".folio");const base=f?(CITEWORK+", "+locOf(f.dataset.page)):CITEWORK;
    const ed=r&&r.dataset&&r.dataset.edit;   // editors'-apparatus rows cite as the EDITORS', in the work — never as the author's own words
    return ed?(ed+" (Wadding–Vivès editors’ apparatus), in "+base):base;};
  function rowx(r,kind){return reading.querySelector('.rowx[data-for="'+r.id+'"][data-kind="'+kind+'"]');}
  function placeAfter(r,node){let ref=r; const tr=rowx(r,"tr"); if(kindOrder(node)==="note"&&tr)ref=tr; ref.after(node);}
  function kindOrder(n){return n.dataset.kind;}
  // ---- highlights ----
  // deletion tombstones: without these, mergeIn's union resurrects anything deleted on a
  // device that hadn't synced (UX hunt 2026-07-12). fr_del = {"<key>|<id>": ts}; synced like
  // the other maps, honored during merge, pruned at 90 days, cleared on re-create.
  function tomb(key,id){try{const d=lj("fr_del"),now=Date.now();d[key+"|"+id]=now;
    for(const k in d)if(now-d[k]>90*864e5)delete d[k];
    save("fr_del",d,"_frSyncDel");}catch(e){}}
  function untomb(key,id){try{const d=lj("fr_del");if(d[key+"|"+id]!=null){delete d[key+"|"+id];save("fr_del",d,"_frSyncDel");}}catch(e){}}
  function rowFp(r){const t=(r.querySelector(".en")||r).textContent||"";return t.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,60);}
  window.__frRowFp=rowFp;
  // Keep a citation-bearing snapshot of the displayed canonical passage for Desk.
  // fr_hl retains its existing color map and sync contract.
  function captureHl(r,c,store){
    const key=K(r);if(!c){delete store[key];return;}
    const lane=r.querySelector(".en")||r.querySelector(".la")||r;
    const clone=lane.cloneNode(true);if(lane.dataset.orig)clone.innerHTML=lane.dataset.orig;clone.querySelectorAll("button,.rowx,.la-rev,.rv-edit,.rm-original,textarea,input").forEach(x=>x.remove());
    store[key]={text:clone.textContent.trim(),cite:rowCite(r),slug:WORK_SLUG,page:r.closest(".folio")?.dataset.page||"",row:r.id,url:rowAnchor(r),work:WORK,author:AUTHOR,title:DATA.title_en||DATA.title||WORK,color:c,notebookId:store[key]?.notebookId||'',ts:store[key]?.ts||Date.now()};
  }
  function applyHl(){const m=lj("fr_hl"),passages=lj("fr_highlight_passages_v1");let changed=false;
    reading.querySelectorAll(".row[id],.en[id^=b],.la[id^=b]").forEach(r=>{if(m[K(r)]){r.dataset.hl=m[K(r)];captureHl(r,m[K(r)],passages);changed=true;}else r.removeAttribute("data-hl");});
    if(changed)lsSet("fr_highlight_passages_v1",JSON.stringify(passages));
  }
  function setHl(r,c){const m=lj("fr_hl");if(c){m[K(r)]=c;untomb("fr_hl",K(r));}else{delete m[K(r)];tomb("fr_hl",K(r));}
    save("fr_hl",m,"_frSyncHl");m[K(r)]?r.dataset.hl=c:r.removeAttribute("data-hl");
    const passages=lj("fr_highlight_passages_v1");captureHl(r,c,passages);if(c&&passages[K(r)])passages[K(r)].notebookId=activeNotebookId();lsSet("fr_highlight_passages_v1",JSON.stringify(passages));window.dispatchEvent(new Event("fr-notebook-updated"));
  }
  // ---- my translation ----
  function renderTr(r){const ex=rowx(r,"tr");if(ex)ex.remove();if(!canTranslateSource())return;const e=lj("fr_tr")[K(r)];if(!e||!e.t){updateCount();return;}
    const _drift=e.fp&&rowFp(r)&&e.fp!==rowFp(r);   // row content changed since this was written
    const by=(e.by?esc(e.by)+"’s translation":"My translation")+(_drift?' <span class="fpdrift" title="The passage under this may have shifted since you wrote it (the text was re-edited). Check its citation.">⚠</span>':"");
    const d=el("div","rowx tr");d.dataset.for=r.id;d.dataset.kind="tr";
    d.innerHTML='<button class="x" title="Edit your translation">✎</button><span class="by">'+by+'</span>'+inl(e.t);
    r.after(d);d.querySelector(".x").onclick=()=>editTr(r);updateCount();}
  function editTr(r){if(!canTranslateSource()){applyTranslationPolicy();return;}if(reading.querySelector('.rowx.editing[data-for="'+r.id+'"]'))return;
    const cur=(lj("fr_tr")[K(r)]||{}).t||"";const ex=rowx(r,"tr");if(ex)ex.remove();
    const d=el("div","rowx tr editing");d.dataset.for=r.id;d.dataset.kind="tr";
    d.innerHTML='<span class="by">My translation</span><textarea placeholder="Type your own English here…"></textarea>'+
      '<div class="act"><button class="primary sv">Save</button><button class="cx">Cancel</button><button class="dl">Remove</button></div>';
    r.after(d);const ta=d.querySelector("textarea");ta.value=cur;ta.focus();
    d.querySelector(".cx").onclick=()=>{renderTr(r);};
    d.querySelector(".sv").onclick=()=>{if(!canTranslateSource()){applyTranslationPolicy();return;}const m=lj("fr_tr"),v=ta.value.trim();
      if(v){m[K(r)]=Object.assign({t:v,by:window._frUser||"",cite:rowCite(r),work:WORK,ts:Date.now(),fp:rowFp(r)},tqsOf(r));untomb("fr_tr",K(r));}else{delete m[K(r)];tomb("fr_tr",K(r));}
      save("fr_tr",m,"_frSyncTr");renderTr(r);};
    d.querySelector(".dl").onclick=()=>{if(!canTranslateSource()){applyTranslationPolicy();return;}const m=lj("fr_tr");delete m[K(r)];tomb("fr_tr",K(r));save("fr_tr",m,"_frSyncTr");renderTr(r);};
    ta.addEventListener("keydown",ev=>{if((ev.metaKey||ev.ctrlKey)&&ev.key==="Enter"){ev.preventDefault();d.querySelector(".sv").click();}else if(ev.key==="Escape"){ev.preventDefault();renderTr(r);}});}
  // ---- notes ----
  function renderNote(r){const ex=rowx(r,"note");if(ex)ex.remove();const e=lj("fr_notes")[K(r)];if(!e||!e.t){updateCount();return;}
    const _drift=e.fp&&rowFp(r)&&e.fp!==rowFp(r);
    const d=el("div","rowx note");d.dataset.for=r.id;d.dataset.kind="note";
    d.innerHTML='<button class="x" title="Edit note">✎</button><span class="by">Note</span>'+(_drift?' <span class="fpdrift" title="The passage under this may have shifted since you wrote it. Check its citation.">⚠</span>':'')+''+inl(e.t);
    placeAfter(r,d);d.querySelector(".x").onclick=()=>editNote(r);updateCount();}
  function editNote(r){if(reading.querySelector('.rowx.note.editing[data-for="'+r.id+'"]'))return;
    const cur=(lj("fr_notes")[K(r)]||{}).t||"";const ex=rowx(r,"note");if(ex)ex.remove();
    const d=el("div","rowx note editing");d.dataset.for=r.id;d.dataset.kind="note";
    d.innerHTML='<span class="by">Note</span><textarea placeholder="Your note on this passage…"></textarea>'+
      '<div class="act"><button class="primary sv">Save</button><button class="cx">Cancel</button><button class="dl">Remove</button></div>';
    placeAfter(r,d);const ta=d.querySelector("textarea");ta.value=cur;ta.focus();
    d.querySelector(".cx").onclick=()=>{renderNote(r);};
    d.querySelector(".sv").onclick=()=>{const m=lj("fr_notes"),v=ta.value.trim();
      if(v){m[K(r)]=Object.assign({t:v,notebookId:m[K(r)]?.notebookId||activeNotebookId(),cite:rowCite(r),work:WORK,author:AUTHOR,title:DATA.title_en||DATA.title||WORK,slug:WORK_SLUG,row:r.id,page:r.closest(".folio").dataset.page,ts:Date.now(),fp:rowFp(r)},tqsOf(r));untomb("fr_notes",K(r));}else{delete m[K(r)];tomb("fr_notes",K(r));}
      save("fr_notes",m,"_frSyncNotes");renderNote(r);window.dispatchEvent(new Event("fr-notebook-updated"));};
    d.querySelector(".dl").onclick=()=>{const m=lj("fr_notes");delete m[K(r)];tomb("fr_notes",K(r));save("fr_notes",m,"_frSyncNotes");renderNote(r);window.dispatchEvent(new Event("fr-notebook-updated"));};
    ta.addEventListener("keydown",ev=>{if((ev.metaKey||ev.ctrlKey)&&ev.key==="Enter"){ev.preventDefault();d.querySelector(".sv").click();}else if(ev.key==="Escape"){ev.preventDefault();renderNote(r);}});}
  // ---- selection popup ----
  const pop=$("#selpop");let popRow=null,passage=null,selectionTimer=null,selecting=false;
  function hidePop(){pop.classList.remove("show");}
  function captureSelection(){
    const s=getSelection();if(!s||s.isCollapsed||s.toString().trim().length<2)return false;
    const start=s.getRangeAt(0).startContainer,node=start.nodeType===1?start:start.parentElement,row=node&&node.closest(".row[id],.en[id^=b],.la[id^=b]");
    if(!row||!reading.contains(row))return false;
    popRow=row;passage={author:AUTHOR,title:DATA.title_en||DATA.title||WORK,text:s.toString().replace(/\s+/g," ").trim(),cite:rowCite(row),slug:WORK_SLUG,page:row.closest(".folio")?.dataset.page||"",row:row.id,url:rowAnchor(row)};
    paintPassage();return true;
  }
  function passageRow(){if(!passage)return null;let r=document.getElementById(passage.row);if(!r&&window.__ensurePage){window.__ensurePage(passage.page);r=document.getElementById(passage.row);}return r;}
  function passageText(){return passage?.text||getSelection()?.toString().trim()||"";}
  const showSelPop=()=>{
    if(!captureSelection()){hidePop();return;}
    const rc=getSelection().getRangeAt(0).getBoundingClientRect();pop.classList.add("show");
    pop.style.left=Math.max(8,Math.min(rc.left,innerWidth-pop.offsetWidth-8))+"px";
    pop.style.top=Math.max(8,Math.min(rc.bottom+8,innerHeight-pop.offsetHeight-12))+"px";};
  reading.addEventListener("pointerdown",()=>{selecting=true;hidePop();});
  document.addEventListener("pointerup",()=>{if(selecting){selecting=false;setTimeout(showSelPop,0);}});
  document.addEventListener("selectionchange",()=>{clearTimeout(selectionTimer);if(!selecting)selectionTimer=setTimeout(()=>{if(getSelection()?.isCollapsed){hidePop();return;}showSelPop();},160);});
  document.addEventListener("contextmenu",e=>{if(captureSelection()){e.preventDefault();showSelPop();}});
  document.addEventListener("mousedown",e=>{if(!pop.contains(e.target))hidePop();});
  pop.addEventListener("pointerdown",e=>{if(e.pointerType==='mouse'&&e.target.closest('button'))e.preventDefault();});
  $("#spMore").onclick=()=>{hidePop();openNotebook('passage');};
  pop.querySelectorAll(".sw").forEach(sw=>sw.onclick=e=>{e.preventDefault();if(popRow)setHl(popRow,sw.dataset.hl);hidePop();getSelection().removeAllRanges();});
  $("#spNote").onclick=()=>{if(popRow)editNote(popRow);hidePop();getSelection().removeAllRanges();};
  $("#spPar").onclick=()=>{const t2=passageText();hidePop();getSelection().removeAllRanges();
    if(t2.length>=10&&window.__frParallels)window.__frParallels(t2);};
  $("#spAsk").onclick=()=>askPassage();
  $("#spPin").onclick=function(){const m=popRow&&popRow.id.match(/^b(\d+)-/);hidePop();getSelection().removeAllRanges();
    if(m&&window.__frPinToggle){const on=window.__frPinToggle(+m[1]);cpFlash(this,on?"Pinned \u2605":"Unpinned");}};
  $("#spTr").onclick=()=>{if(popRow)editTr(popRow);hidePop();getSelection().removeAllRanges();};
  function cpFlash(btn,txt){const o=btn.textContent;btn.textContent=txt||"Copied ✓";setTimeout(()=>{btn.textContent=o;},1100);}
  function rowAnchor(r){return location.origin+location.pathname+location.search+"#"+r.id;}
  const cw=t=>navigator.clipboard&&navigator.clipboard.writeText(t);
  $("#spCopy").onclick=function(){const t=passageText();const cite=popRow?rowCite(popRow):WORK;
    cw(t+"\n\n— "+cite+(popRow?"\n"+rowAnchor(popRow):""));cpFlash(this);};
  // deep-link to this exact passage
  $("#spLink").onclick=function(){if(popRow)cw(rowAnchor(popRow));cpFlash(this,"Link ✓");};
  // citation: stable locus + permalink (Chicago-ish; scholars can paste & adapt)
  $("#spCite").onclick=function(){const cite=popRow?rowCite(popRow):WORK,url=popRow?rowAnchor(popRow):location.href;
    const loc=popRow&&WORK_SLUG?(()=>{const m=popRow.id.match(/^b(\d+)-(\d+)$/);return m?` [${WORK_SLUG}/p${m[1]}/b${m[2]}]`:"";})():"";
    cw(cite+loc+". The Faith Received. "+url+".");cpFlash(this,"Cited ✓");};
  // BibTeX export (locus + permalink)
  $("#spBib")&&($("#spBib").onclick=function(){const fol=popRow&&popRow.closest(".folio");
    const loc=fol?locOf(+fol.dataset.page):"",url=popRow?rowAnchor(popRow):location.href;
    const key=((DATA.author||WORK).split(/[\s,]+/)[0]||"work").replace(/[^A-Za-z]/g,"")+(WORK.split(/\s+/)[0]||"");
    cw("@book{"+key+",\n  author = {"+(DATA.author||"")+"},\n  title = {"+WORK+(DATA.volume?", "+DATA.volume:"")+"},\n  note = {The Faith Received"+(loc?", "+loc:"")+"},\n  url = {"+url+"}\n}");
    cpFlash(this,"BibTeX ✓");});
  // typeset quote-card image
  $("#spCard")&&($("#spCard").onclick=function(){saveQuoteImage();hidePop();getSelection().removeAllRanges();});
  // native copy → append citation (owner 2026-08-19: opt-out setting — plain copy for
  // readers pasting into their own drafts; the notebook toggle persists per device)
  document.addEventListener("copy",e=>{const s=getSelection();if(!s||s.isCollapsed)return;
    if(lsGet("fr_nocite")==="1")return;
    const node=s.anchorNode&&s.anchorNode.parentElement,row=node&&node.closest&&node.closest(".row[id],.en[id^=b],.la[id^=b]");
    if(!row||!reading.contains(row))return;
    e.clipboardData.setData("text/plain",s.toString().replace(/\s+/g," ").trim()+"\n\n"+rowCite(row));e.preventDefault();});
  // per-paragraph Latin reveal (English-primary "Read" mode) + hover pencil for translation
  reading.querySelectorAll(".row[id],.en[id^=b],.la[id^=b]").forEach(r=>{
    if(!canTranslateSource())return;
    const lat=r.querySelector(".la");
    if(lat&&lat.textContent.trim()){const rv=el("button","la-rev");rv.type="button";
      const SNM=window.__SRCNAME||"Latin";rv.textContent=SNM;   // PG works read Greek, not Latin (owner 2026-08-31 pg-584)
      rv.title="Show the "+SNM+" for this paragraph";rv.setAttribute("aria-expanded","false");
      rv.onclick=()=>{const on=r.classList.toggle("la-on");rv.setAttribute("aria-expanded",on?"true":"false");rv.textContent=on?("Hide "+SNM):SNM;};
      r.appendChild(rv);}                              // flex order places it between English and the revealed Latin
    const p=el("button","trpencil");p.title="Add your translation";p.textContent="✎";p.onclick=()=>editTr(r);r.appendChild(p);});
  // header notes count + sync note
  function updateCount(){const here=k=>k.startsWith(WSID+'|'),n=['fr_notes','fr_tr','fr_hl'].reduce((n,k)=>n+Object.keys(lj(k)).filter(here).length,0);
    const b=$("#nbCount");if(b){b.textContent='Research';b.setAttribute('aria-label','Open research'+(n?', '+n+' saved passages':''));b.dataset.zero='0';}const count=$("#nbSavedCount");if(count)count.textContent=n||'';}
  const ctr=document.querySelector(".ctr");
  if(ctr&&!$("#frAuth")){const a=el("span","authbar");a.id="frAuth";
    a.innerHTML='<button type="button" class="nb-pill" id="nbCount" aria-controls="notebook" aria-expanded="false">Research</button><button class="ab-sync" id="frSync" hidden title="Sign in to sync your notebook across devices">Sign in</button><span class="ab-note" id="frSyncNote">saved on this device</span>';ctr.appendChild(a);
    // on a phone the account cluster lives at the head of the Notebook (sign-in next to what it syncs),
    // on desktop in the masthead — the SAME node migrates so handlers/state survive
    const mq=matchMedia("(max-width:720px)");
    const place=()=>{const acc=$("#nbAccount"),sb=$("#frSync"),nt=$("#frSyncNote");if(!acc||!sb)return;
      if(mq.matches){if(sb.parentElement!==acc){acc.appendChild(sb);acc.appendChild(nt);}}
      else if(sb.parentElement!==a){a.appendChild(sb);a.appendChild(nt);}};
    place();mq.addEventListener?mq.addEventListener("change",place):mq.addListener(place);}
  // ---- Notebook drawer: browse everything you've saved in this work ----
  const HLC={amber:"#e8b04b",sage:"#8fae6f",slate:"#7d97bd"};
  let nbFocus=null,chatSequence=0,activeResearchTab='work';const notebook=$("#notebook"),nbInert=new Map(),sideMedia=matchMedia('(min-width:1100px)');
  let quoteImageURL='';
  function status(text){$("#nbActionStatus").textContent=text;}
  function showQuoteImage(image,context){if(context){passage={...context};paintPassage();}if(quoteImageURL)URL.revokeObjectURL(quoteImageURL);quoteImageURL=image.url;const preview=$('#nbImagePreview');preview.dataset.quote=passage?.text||'';preview.querySelector('img').src=image.url;preview.hidden=false;$('#nbImageDownload').href=image.url;$('#nbImageDownload').download=image.name;hidePop();getSelection()?.removeAllRanges();openNotebook('passage').then(()=>preview.scrollIntoView({block:'nearest'}));status('Quote image ready. Its quotation and citation remain in Saved research.');}
  function paintPassage(){
    const preview=$('#nbImagePreview');if(preview.dataset.quote&&preview.dataset.quote!==passage?.text){preview.hidden=true;if(quoteImageURL)URL.revokeObjectURL(quoteImageURL);quoteImageURL='';delete preview.dataset.quote;}
    $("#nbSelection").hidden=!passage;$("#nbSelectionHelp").hidden=!!passage;
    $("#nbSelectionText").textContent=passage?.text||'';$("#nbSelectionCite").textContent=passage?.cite||'';
  }
  function activeNotebookId(){return $('#nbProjectPick')?.value||lsGet('fr_pincol')||'default';}
  function populateNotebookContext(){if(!window.FRResearchNotebook||!$('#nbProjectPick'))return;try{const state=FRResearchNotebook.read(),pick=$('#nbProjectPick');pick.innerHTML=state.collections.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('');pick.value=state.activeId;let context=lj('fr_desk_context_v1');$('#nbProjectDesk').textContent=context.title?'Return to '+context.title:'Open writing desk';$('#nbProjectDesk').href='/the-faith-received/desk/'+(context.docId?'?doc='+encodeURIComponent(context.docId):'');}catch(e){status(e.message);}}
  $('#nbProjectPick').onchange=()=>{try{FRResearchNotebook.selectCollection($('#nbProjectPick').value);}catch(e){status(e.message);}};
  [$('#nbProjectDesk'),$('#nbDesk')].forEach(link=>{if(window.parent!==window)link.target='_top';link.onclick=e=>{if(window.parent===window)return;try{if(window.parent.FRDesk?.returnToWriting){e.preventDefault();window.parent.FRDesk.returnToWriting();}}catch(_){}};});
  window.addEventListener('fr-notebook-updated',populateNotebookContext);window.addEventListener('fr-notebook-selection',populateNotebookContext);populateNotebookContext();
  window.FRReaderBookmarks?.bind($('#nbSaveReadingPlace'),{getContext:()=>({slug:WORK_SLUG,title:WORK,author:AUTHOR,collectionId:activeNotebookId(),pageLabel:p=>locOf(p)}),feedback:$('#nbBookmarkStatus'),openSavedButton:$('#nbOpenSavedPlaces'),onOpenSaved:()=>openNotebook('saved')});
  // SAVE WORK (owner 2026-09-10 "save works to my notebook, for later reading"): the whole work as a reference (page null), one path through the notebook
  (()=>{const b=$('#nbSaveWork');if(!b||!window.FRResearchNotebook?.saveWork)return;const N=window.FRResearchNotebook;
    const paint=()=>{const on=N.hasReference(WORK_SLUG,null);b.setAttribute('aria-pressed',String(on));b.textContent=on?'Saved for later':'Save work';b.title=on?'In your notebook · click to remove':'Keep this work in your notebook for later reading';};paint();
    window.addEventListener('fr-notebook-updated',paint);
    b.onclick=async()=>{b.disabled=true;const st=$('#nbBookmarkStatus');try{if(N.hasReference(WORK_SLUG,null)){await N.unsave(WORK_SLUG,null);if(st)st.textContent='Removed from your notebook.';}else{const res=await N.saveWork({slug:WORK_SLUG,title:WORK,author:AUTHOR},{collectionId:activeNotebookId()});if(st)st.textContent=res.created===false?'Already in '+res.collectionName+'.':'Saved to '+res.collectionName+' for later reading.'+(res.warnings?.length?' Account sync could not be confirmed.':'');}}
      catch(err){if(st)st.textContent=err?.message||'This work could not be saved.';}finally{b.disabled=false;paint();}};})();
  function savedCollections(){const c=lj('fr_collections_v1');return Array.isArray(c)?c:[];}
  // Distinct research objects can share a source page. Page identity is only for references.
  function collectionItemKey(i){
    const site=i.site||'fr',page=String(i.page??'');
    if(i.quoteImage)return JSON.stringify(['quote-image',site,i.slug||'',page,i.row||'',i.text||'']);
    if(i.askTurn)return JSON.stringify(['ask-answer',String(i.askTurn)]);
    if(i.type==='note'||i.askAnswer)return JSON.stringify(['note',i.id||i.ts||i.text||'',i.askAnswer?'answer':'note']);
    return JSON.stringify(['reference',site,i.slug||'',page,i.u||'']);
  }
  function mergeCollections(remote,local){
    const byId=new Map();
    for(const c of [...remote,...local]){
      const previous=byId.get(c.id),items=new Map();
      for(const i of [...(previous?.items||[]),...(c.items||[])]){
        const key=collectionItemKey(i),old=items.get(key);
        items.set(key,old?{...old,...i}:i);
      }
      byId.set(c.id,{...previous,...c,items:[...items.values()]});
    }
    return [...byId.values()];
  }
  function saveQuoteImage(){
    if(!passage?.text){status('Select a passage first.');return;}
    const cols=savedCollections();if(!cols.length){const legacy=lj('fr_pins');cols.push({id:'default',name:'Reading list',items:Array.isArray(legacy)?legacy.map(i=>({...i})):[]});}
    const active=cols.find(c=>c.id===activeNotebookId())||cols[0];active.items=active.items||[];
    if(!active.items.some(i=>i.quoteImage&&i.slug===passage.slug&&i.row===passage.row&&i.text===passage.text))active.items.push({...passage,type:'note',quoteImage:true,label:'Quote image',work:WORK,ts:Date.now()});
    save('fr_collections_v1',cols,'_frSyncCollections');window.dispatchEvent(new Event('fr-notebook-updated'));
    const context={...passage};makeCard(context.text,context.cite,image=>showQuoteImage(image,context));status('Preparing quote image…');
  }
  function openSavedAtDesk(result){const docId=new URL($('#nbProjectDesk').href,location.origin).searchParams.get('doc'),url=FRResearchNotebook.deskURL(result,docId);if(window.parent!==window){try{if(window.parent.FRDesk?.receiveClip){window.parent.FRDesk.receiveClip(result);return;}window.top.location.assign(url);return;}catch(_){}}location.assign(url);}
  async function savePassageResearch(useInDesk=false){
    if(!passage?.text){status('Select a passage first.');return;}
    if(!window.FRResearchNotebook){status('Research saving could not load. Reload this page to try again.');return;}
    const p={...passage},target=$('#nbProjectPick').value;status('Saving passage…');
    try{const result=await FRResearchNotebook.save({...p,type:'note',label:p.cite||'Selected passage',work:WORK,research:{kind:'passage',sources:[{slug:p.slug,page:String(p.page),row:p.row,url:p.url,cite:p.cite,title:p.title||WORK,author:p.author||AUTHOR}],authors:AUTHOR?[AUTHOR]:[],topics:[],verses:[]}},{collectionId:target});status(result.warnings?.length?'Saved in this browser. Account sync could not be confirmed.':'Clipped to '+result.collectionName+'. Ready to use in your writing.');if(useInDesk)openSavedAtDesk(result);return result;}catch(e){status(e.message||'The passage could not be saved. Please try again.');}
  }
  async function askPassage(){
    const context=passage?{...passage}:null;hidePop();getSelection()?.removeAllRanges();closeNotebook(false);
    if(window.FRAsk)await window.FRAsk.open({passage:context,contextWork:WORK_SLUG});
    else if(window.__openAsk)window.__openAsk(context?'Help me understand this passage: '+context.text+'\n\n'+context.cite:'');
  }
  function act(action){
    const r=passageRow();popRow=r;
    if(!passage){status('Select a passage first.');return;}
    if(action==='save-research'){savePassageResearch();return;}
    if(action==='desk'){savePassageResearch(true);return;}
    if(action==='image'){saveQuoteImage();return;}
    if(action==='ask'){askPassage();return;}
    if(action==='copy'){cw(passage.text+'\n\n'+passage.cite+'\n'+passage.url);status('Passage and citation copied.');return;}
    if(action==='link'){cw(passage.url);status('Passage link copied.');return;}
    if(!r){status('Open the saved passage in the book before editing it.');return;}
    if(action==='highlight'){setHl(r,'amber');status('Passage highlighted and saved.');}
    if(action==='note'||action==='translate'){closeNotebook(false);action==='note'?editNote(r):editTr(r);}
    if(action==='parallels'){closeNotebook(false);window.__frParallels?.(passage.text);}
    if(action==='pin'){window.FRResearchNotebook?.selectCollection(activeNotebookId());window.__frPinToggle?.(passage.page);status('Reference updated in your active collection.');}
    if(action==='bib'){$('#spBib').click();status('BibTeX citation copied.');}
  }
  notebook.querySelectorAll('[data-reader-action]').forEach(b=>b.onclick=()=>act(b.dataset.readerAction));
  notebook.querySelectorAll('[data-reader-color]').forEach(b=>b.onclick=()=>{const r=passageRow();if(r){setHl(r,b.dataset.readerColor);status(b.dataset.readerColor?'Highlight saved.':'Highlight cleared.');}});
  $('#spClip').onclick=()=>{hidePop();savePassageResearch();openNotebook('passage');};
  $('#nbAskBook').onclick=()=>{closeNotebook(false);window.FRAsk?.open({contextWork:WORK_SLUG});};
  $('#nbNewChat').onclick=()=>{closeNotebook(false);window.FRAsk?.open({fresh:true,contextWork:WORK_SLUG});};
  function syncNotebookLayout(){
    const open=notebook.classList.contains('open');populateNotebookContext();
    document.documentElement.classList.toggle('fr-research-docked',open&&sideMedia.matches);
    notebook.setAttribute('role',sideMedia.matches?'complementary':'dialog');
    if(sideMedia.matches)notebook.removeAttribute('aria-modal');else notebook.setAttribute('aria-modal','true');
    for(const [e,value] of nbInert)e.inert=value;nbInert.clear();
    if(open&&!sideMedia.matches)for(const e of [app,document.querySelector('.frthumb'),$('#fra-launcher')].filter(Boolean)){nbInert.set(e,e.inert);e.inert=true;}
  }
  let workResearch=null;
  function ensureWorkResearch(){
    if(!window.FRWorkResearch){$('#nbWorkAnalysis').textContent='Work analysis tools could not be loaded. Reload this page to try again.';return;}
    if(!workResearch){
      workResearch=FRWorkResearch.mount($('#nbWorkAnalysis'),{slug:WORK_SLUG,blob:BLOB,title:[$('#h1')?.textContent||DATA.title,DATA.volume].filter(Boolean).join(', '),author:AUTHOR,page:cur,location:locOf,
        about:()=>{closeNotebook(false);$('#rdAbout').click();},
        read:page=>{if(!sideMedia.matches)closeNotebook();jump(String(page));},
        ask:q=>{closeNotebook(false);window.FRAsk?.open({fresh:true,q:q||'',contextWork:WORK_SLUG,works:WORK_SLUG?[WORK_SLUG]:[]});},
        save:async(record,url,context={})=>{
          if(!window.FRResearchNotebook)throw Error('Research saving is unavailable.');
          const cite=CITEWORK+(record.page?', '+locOf(record.page):''),source={slug:WORK_SLUG,page:String(record.page),url:new URL(url,location.origin).href,cite,title:DATA.title_en||DATA.title||WORK,author:AUTHOR};
          return FRResearchNotebook.save({id:'work-analysis:'+WORK_SLUG+':'+record.id,type:'note',researchRecord:true,slug:WORK_SLUG,page:record.page,text:'Extracted '+FRWorkResearch.recordNames[record.kind]+': '+record.text,cite,url:source.url,work:WORK,author:AUTHOR,label:'Work analysis',research:{kind:record.kind,sources:[source],authors:AUTHOR?[AUTHOR]:[],topics:context.statementTopics||[],sectionTopics:context.sectionTopics||[],verses:context.verses||[],citations:context.citations||[],analysis:{...record.raw,sectionMembership:record.sections||[record.unit],sectionTopics:record.sectionTopics||[]},provenance:'Published work analysis; not a verbatim quotation'}});
        }});
      window.FRWorkResearchSources?.mount($('#nbWorkSources'),{slug:WORK_SLUG,blob:BLOB,author:AUTHOR,confession:window.FRReaderNavigation?.isConfession(DATA),location:locOf,browseAnalysis:options=>workResearch.browse(options),read:page=>{if(!sideMedia.matches)closeNotebook();jump(String(page));}});
      const place=$('#reader-location');if(place)new MutationObserver(()=>workResearch.setPage(cur)).observe(place,{childList:true,characterData:true,subtree:true});
    }
    workResearch.setPage(cur);workResearch.load();
  }
  let readerSearchIndex=null,readerSearchTEI=null,readerSearchSequence=0,readerSearchQuery='',readerSearchHits=[],readerSearchTerms=[],readerSearchShown=50,readerSearchSelected='';
  function readerSearchCoverage(index){return index.kind==='canonical'?'Canonical '+index.lanes.join(' and ')+' text · '+index.pages+' pages indexed':'Loaded reading text only · '+index.pages+' pages indexed. Other pages have not been searched.';}
  async function ensureReaderSearchIndex(){
    if(window.__teiHydrating){$('#nbWorkSearchStatus').textContent='Loading the canonical text for this work…';await window.__teiHydrating;}
    const tei=typeof TEI_PAGES!=='undefined'&&TEI_ON?TEI_PAGES:null;
    if(tei&&readerSearchIndex&&readerSearchTEI===tei)return readerSearchIndex;
    const loaded=tei?[]:Array.from(reading.querySelectorAll('.folio')).map(folio=>({page:folio.dataset.page,nodes:folio.querySelectorAll('.row .en,.row .la')}));
    const index=await frBuildReaderSearchIndex({tei,pages:DATA?.pages||[],loaded,sourceLabel:window.__SRCNAME||'source'});
    if(tei){readerSearchIndex=index;readerSearchTEI=tei;}return index;
  }
  function renderReaderSearch(){
    const host=$('#nbWorkSearchResults');host.innerHTML=readerSearchHits.slice(0,readerSearchShown).map((hit,i)=>'<button type="button" class="nb-work-search-hit" data-reader-search-result="'+i+'"'+(readerSearchSelected===hit.page?' aria-current="location"':'')+'><span>'+esc(frReaderSearchResultLabel(hit.page,locOf(hit.page))+(hit.sourceRegion==='contents'?' · Contents':hit.sourceRegion==='frontmatter'?' · Front matter':'')+(hit.lane?' · '+(hit.lane==='en'?'English':window.__SRCNAME||'Source'):'')+(hit.kind==='note'?' · '+(hit.margin?'Margin note':'Footnote'):''))+'</span><span>'+frReaderSearchMarkup(frReaderSearchSnippet(hit.text,readerSearchTerms),readerSearchTerms)+'</span></button>').join('');
    $('#nbWorkSearchMore').hidden=readerSearchShown>=readerSearchHits.length;
  }
  async function runReaderSearch(){
    const query=$('#nbWorkSearchQuery').value.trim(),sequence=++readerSearchSequence;
    $('#nbWorkSearchLibrary').href='/the-faith-received/search/'+(query?'?q='+encodeURIComponent(query):'');
    if(!query){readerSearchQuery='';readerSearchHits=[];readerSearchTerms=[];renderReaderSearch();$('#nbWorkSearchStatus').textContent='Find pages containing all the words you enter.';findSet([],{open:false});return;}
    $('#nbWorkSearchStatus').textContent='Indexing this work’s text…';$('#nbWorkSearchStatus').setAttribute('aria-busy','true');
    try{
      const index=await ensureReaderSearchIndex();if(sequence!==readerSearchSequence)return;
      const result=frSearchReaderIndex(index,query);readerSearchQuery=query;readerSearchTerms=result.terms;readerSearchHits=result.hits;readerSearchShown=50;readerSearchSelected='';renderReaderSearch();
      $('#nbWorkSearchStatus').textContent=readerSearchHits.length+' matching '+(readerSearchHits.length===1?'page':'pages')+' for “'+query+'”. '+readerSearchCoverage(index);
    }catch(_){if(sequence===readerSearchSequence)$('#nbWorkSearchStatus').textContent='The text could not be indexed. Search again to retry, or search the library.';}
    finally{if(sequence===readerSearchSequence)$('#nbWorkSearchStatus').removeAttribute('aria-busy');}
  }
  $('#nbWorkSearchForm').onsubmit=e=>{e.preventDefault();runReaderSearch();};
  $('#nbWorkSearchQuery').oninput=()=>{readerSearchSequence++;$('#nbWorkSearchStatus').removeAttribute('aria-busy');const query=$('#nbWorkSearchQuery').value.trim();$('#nbWorkSearchLibrary').href='/the-faith-received/search/'+(query?'?q='+encodeURIComponent(query):'');if(!query)runReaderSearch();else if(query!==readerSearchQuery)$('#nbWorkSearchStatus').textContent=readerSearchQuery?'Results for “'+readerSearchQuery+'” are retained. Select Search text to run the new query.':'Select Search text to search this work.';};
  $('#nbWorkSearchMore').onclick=()=>{readerSearchShown+=50;renderReaderSearch();};
  $('#nbWorkSearchClear').onclick=()=>{$('#nbWorkSearchQuery').value='';runReaderSearch();$('#nbWorkSearchQuery').focus({preventScroll:true});};
  $('#nbWorkSearchResults').onclick=e=>{
    const button=e.target.closest('[data-reader-search-result]'),hit=button&&readerSearchHits[Number(button.dataset.readerSearchResult)];if(!hit)return;
    readerSearchSelected=hit.page;renderReaderSearch();$('#nbWorkSearchQuery').blur();if(!sideMedia.matches)closeNotebook(false);
    const sequence=readerSearchSequence;findReadSearchResult(hit,readerSearchTerms,{current:()=>sequence===readerSearchSequence,status:text=>{$('#nbWorkSearchStatus').textContent=text;}}).catch(()=>{if(sequence===readerSearchSequence)$('#nbWorkSearchStatus').textContent='The matching words could not be shown. Select the result to retry; your search is retained.';});
  };
  function researchTab(name){
    name=['work','search','passage','saved','chats'].includes(name)?name:activeResearchTab;activeResearchTab=name;
    for(const [key,id] of [['work','WorkPanel'],['search','WorkSearch'],['passage','Passage'],['saved','Saved'],['chats','Chats']]){const on=key===name;$('#nb'+id).hidden=!on;$('#nb'+id+'Tab').setAttribute('aria-selected',String(on));$('#nb'+id+'Tab').tabIndex=on?0:-1;}
    notebook.querySelector('.nb-project').hidden=name==='search';
    notebook.querySelector('.nb-settings').hidden=name==='work'||name==='search'||name==='chats';
    if(name==='chats')renderConversations();
    if(name==='work')ensureWorkResearch();
  }
  for(const [key,id] of [['work','WorkPanel'],['search','WorkSearch'],['passage','Passage'],['saved','Saved'],['chats','Chats']])$('#nb'+id+'Tab').onclick=()=>researchTab(key);
  $('.nb-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const keys=['work','search','passage','saved','chats'],tabs=[...$('.nb-tabs').querySelectorAll('button')],i=tabs.indexOf(document.activeElement),n=e.key==='Home'?0:e.key==='End'?keys.length-1:(i+(e.key==='ArrowRight'?1:keys.length-1))%keys.length;researchTab(keys[n]);tabs[n].focus();tabs[n].scrollIntoView({block:'nearest',inline:'nearest'});});
  async function openNotebook(view){
    nbFocus=document.activeElement;if(window.FRAsk?.isOpen?.())await window.FRAsk.close();
    captureSelection();renderNotebook();paintPassage();researchTab(view);
    notebook.inert=false;notebook.classList.add('open');notebook.setAttribute('aria-hidden','false');$('#nbScrim').classList.add('open');$('#nbCount')?.setAttribute('aria-expanded','true');syncNotebookLayout();
    if(!sideMedia.matches)$('#nbClose').focus();
  }
  function closeNotebook(restore=true){const wasOpen=notebook.classList.contains('open');notebook.classList.remove('open');notebook.setAttribute('aria-hidden','true');notebook.inert=true;$('#nbScrim').classList.remove('open');$('#nbCount')?.setAttribute('aria-expanded','false');syncNotebookLayout();if(wasOpen&&restore){const target=nbFocus?.isConnected&&nbFocus.getClientRects().length&&!nbFocus.closest('[inert]')?nbFocus:[...document.querySelectorAll('#nbCount,.frthumb [data-t="nb"]')].find(e=>e.getClientRects().length&&!e.closest('[inert]'));target?.focus({preventScroll:true});}}
  sideMedia.addEventListener('change',syncNotebookLayout);
  notebook.addEventListener('keydown',e=>{if(e.key==='Tab'&&!sideMedia.matches){const controls=[...notebook.querySelectorAll('button,a,input,select,textarea,summary')].filter(x=>x.getClientRects().length&&!x.disabled&&!x.closest('[hidden]'));const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}}});
  window.addEventListener('fr-ask-visibility',e=>{if(e.detail?.open)closeNotebook(false);});
  window.addEventListener('fr-notebook-updated',()=>{updateCount();if(notebook.classList.contains('open'))renderNotebook();});
  window.addEventListener('fr-conversations-updated',()=>{if(notebook.classList.contains('open')&&!$('#nbChats').hidden)renderConversations();});
  window.addEventListener('storage',e=>{if(['fr_hl','fr_notes','fr_tr','fr_collections_v1'].includes(e.key)&&notebook.classList.contains('open'))renderNotebook();});
  window.__frSearchWork=async query=>{await openNotebook('search');$('#nbWorkSearchQuery').value=String(query||'');await runReaderSearch();};
  window.__frOpenNotebook=openNotebook;   // thumb-bar hook (mobile shell)
  window.FRReaderResearch={open:openNotebook,close:closeNotebook,passage:()=>passage&&({...passage}),navigate(url){return window.__frNavigateReaderAnchor?.(url)===true;}};
  if(new URLSearchParams(location.search).get('research')==='work')queueMicrotask(()=>openNotebook('work'));
  const nbEl=key=>document.getElementById(String(key).slice(WSID.length+1));   // scoped storage key → its DOM row
  document.documentElement.classList.add('fr-research-tools');
  function gotoRow(id){if(!sideMedia.matches)closeNotebook();let t=nbEl(id);if(!t){const rowid=String(id).slice(WSID.length+1),pg=(rowid.match(/^b(.+)-\d+$/)||[])[1];if(pg)window.__ensurePage?.(pg);t=nbEl(id);}if(!t)return;
    if(t.closest('.frontmatter'))app.classList.add('show-fm');
    placeReaderAnchor(t);t.classList.add("anchor-flash");setTimeout(()=>t.classList.remove("anchor-flash"),2300);}
  function gotoSavedReference(item){
    if(item.readingPlace&&item.readerPosition){
      const position={...item.readerPosition};delete position.focusId;
      if(!position.id||window.FRReaderBookmarks?.isTransientAnchor(position.id)){status('This saved place has no stable reader anchor.');return;}
      clearTimeout(FIND._inputTimer);FIND.sequence++;FIND.open=false;_findBar();
      if(!sideMedia.matches)closeNotebook(false);
      try{const url=new URL(item.url,location.href),slug=url.searchParams.get('w')||url.searchParams.get('ws');if(url.origin===location.origin&&/^\/read(?:\.html)?$/.test(url.pathname)&&slug===WORK_SLUG&&decodeURIComponent(url.hash.slice(1))===position.id)history.replaceState(history.state,'',url);}catch(_){}
      window.__frRestoreReaderPosition?.(position);return;
    }
    if(item.row){gotoRow(WSID+'|'+item.row);return;}
    if(item.page==null)return;
    if(!sideMedia.matches)closeNotebook();
    jump(String(item.page));
  }
  function canonicalRowText(r){
    for(const lane of [r.querySelector('.en'),r.querySelector('.la'),r].filter(Boolean)){
      const clone=lane.cloneNode(true);if(lane.dataset.orig)clone.innerHTML=lane.dataset.orig;
      clone.querySelectorAll('button,.rowx,.la-rev,.rv-edit,.rm-original,textarea,input').forEach(x=>x.remove());
      const text=clone.textContent.trim();if(text)return text;
    }
    return '';
  }
  function exOf(id){const r=nbEl(id),saved=lj('fr_highlight_passages_v1')[id],note=lj('fr_notes')[id]||lj('fr_tr')[id];return r?canonicalRowText(r):saved?.text||((note?.exact||'')+(note?.sfx||''));}
  function nbItem(id,opts){const b=el("article","nb-item");
    const f=nbEl(id),fol=f&&f.closest(".folio"),saved=lj('fr_highlight_passages_v1')[id]||lj('fr_notes')[id]||lj('fr_tr')[id]||{},row=String(id).slice(WSID.length+1),pg=fol?.dataset.page||saved.page||(row.match(/^b(.+)-\d+$/)||[])[1]||'';
    const cite=saved.cite||(f?rowCite(f):CITEWORK+(pg?', '+locOf(pg):'')),text=exOf(id),ctx={text,cite,slug:WORK_SLUG,page:pg,row,url:location.origin+location.pathname+location.search+'#'+row};
    b.innerHTML='<button class="nb-open" type="button">'+(opts.dot?`<span class="nb-dot" style="background:${opts.dot}"></span>`:"")+`<span class="nb-ex">${esc(text.slice(0,240)||'Open saved passage')}</span>`+(opts.mine?`<span class="nb-mine">${esc(opts.mine)}</span>`:'')+`<span class="nb-cite">${esc(cite)}</span></button><div class="nb-item-actions"><button type="button" data-saved-action="desk">Use in Desk</button><button type="button" data-saved-action="ask">Discuss</button><button type="button" data-saved-action="image">Make image</button></div>`;
    b.querySelector('.nb-open').onclick=()=>gotoRow(id);
    b.querySelectorAll('[data-saved-action]').forEach(button=>button.onclick=()=>{
      passage={...ctx,note:opts.mine||''};if(button.dataset.savedAction==='desk'&&passage.text){savePassageResearch(true);return;}const r=passageRow(),text=r&&canonicalRowText(r);
      if(!text){paintPassage();researchTab('passage');status('Open this passage in the book, then try again.');return;}
      passage={...ctx,text,cite:rowCite(r)};paintPassage();act(button.dataset.savedAction);
    });
    return b;}
  function renderNotebook(){const body=$("#nbBody"),opened=new Map([...body.querySelectorAll(".nb-saved-group")].map(g=>[g.dataset.group,g.open]));body.innerHTML='<div class="nb-desk-link"><a href="/the-faith-received/desk/">Write with this research at Desk →</a> · <a href="/the-faith-received/pins/">Manage notebooks</a></div>';
    const hl=lj("fr_hl"),notes=lj("fr_notes"),tr=lj("fr_tr"),here=key=>key.indexOf(WSID+"|")===0;
    const ni=Object.keys(notes).filter(here),ti=Object.keys(tr).filter(here),hi=Object.keys(hl).filter(here);
    const saved=savedCollections().flatMap(c=>(c.items||[]).filter(i=>((i.site||'fr')==='fr'&&i.slug===WORK_SLUG)||i.askSources?.some(s=>(s.slug||s.w)===WORK_SLUG)).map(i=>({...i,collection:c.name})));
    $('#nbSavedCount').textContent=ni.length+ti.length+hi.length+saved.length||'';$('#nbTitle').textContent=(ni.length+ti.length+hi.length+saved.length)+' saved items from this book';
    if(!ni.length&&!ti.length&&!hi.length&&!saved.length){body.insertAdjacentHTML("beforeend",'<div class="nb-empty">Nothing saved from this book yet. Select text to highlight it, add a note, or make a quote image. Your work will collect here with its source.</div>');return;}
    const ord=(a,b)=>{const ea=nbEl(a),eb=nbEl(b);return ea&&eb?(ea.compareDocumentPosition(eb)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1):0;};
    let section=body;const sec=(t,n)=>{section=el("details","nb-saved-group");section.dataset.group=t;section.open=opened.has(t)?opened.get(t):n<=3;const h=el("summary");h.textContent=t+" · "+n;section.appendChild(h);body.appendChild(section);};
    if(ni.length){sec("Notes",ni.length);ni.sort(ord).forEach(id=>section.appendChild(nbItem(id,{mine:(notes[id]||{}).t})));}
    if(ti.length){sec("My translations",ti.length);ti.sort(ord).forEach(id=>section.appendChild(nbItem(id,{mine:(tr[id]||{}).t})));}
    if(hi.length){sec("Highlights",hi.length);hi.sort(ord).forEach(id=>section.appendChild(nbItem(id,{dot:HLC[hl[id]]||"#ccc"})));}
    if(saved.length){sec('References, answers, and images',saved.length);for(const item of saved){const it=el('article','nb-item');it.innerHTML='<div class="nb-cite">'+esc(item.quoteImage?'Quote image':item.askAnswer?'Ask answer':item.collection)+'</div><div class="nb-ex">'+esc((item.text||item.label||item.title||item.slug||'').slice(0,260))+'</div><div class="nb-cite">'+esc(item.cite||item.work||item.collection)+'</div><div class="nb-item-actions"></div>';const actions=it.querySelector('.nb-item-actions');const desk=el('button');desk.textContent='Use in Desk';desk.onclick=async()=>{try{const result=await FRResearchNotebook.save(item,{collectionId:$('#nbProjectPick').value});openSavedAtDesk(result);}catch(e){status(e.message);}};actions.appendChild(desk);if((item.site||'fr')==='fr'&&item.slug===WORK_SLUG&&(item.row||item.page!=null)){const go=el('button');go.textContent=item.readingPlace?'Go to saved place':'Read passage';go.onclick=()=>gotoSavedReference(item);actions.appendChild(go);}if(item.quoteImage){const image=el('button');image.textContent='Open image';image.onclick=()=>{passage={...item};paintPassage();makeCard(item.text,item.cite||CITEWORK,image=>showQuoteImage(image,item));};actions.appendChild(image);}if(item.chat){const chat=el('button');chat.textContent='Open conversation';chat.onclick=()=>{closeNotebook(false);window.FRAsk?.open({id:item.chat});};actions.appendChild(chat);}section.appendChild(it);}}
    filterNotebook();
  }
  function filterNotebook(){const value=$('#nbSearch').value.toLowerCase(),body=$('#nbBody');body.querySelectorAll('.nb-item').forEach(it=>it.hidden=!!value&&!it.textContent.toLowerCase().includes(value));body.querySelectorAll('.nb-saved-group').forEach(g=>{g.hidden=!!value&&![...g.querySelectorAll('.nb-item')].some(i=>!i.hidden);if(value){if(!g.hasAttribute('data-filter-open'))g.dataset.filterOpen=String(g.open);g.open=true;}else if(g.hasAttribute('data-filter-open')){g.open=g.dataset.filterOpen==='true';delete g.dataset.filterOpen;}});let empty=$('#nbNoMatches');if(!empty){empty=el('p','nb-guidance');empty.id='nbNoMatches';empty.setAttribute('role','status');body.appendChild(empty);}empty.textContent='No saved research matches this search.';empty.hidden=!value||[...body.querySelectorAll('.nb-item')].some(i=>!i.hidden);}
  async function renderConversations(){
    const token=++chatSequence,host=$('#nbChatList');host.textContent='Loading conversations…';
    try{const rows=window.FRChatStore?await FRChatStore.all():(lj('fr_chats').chats||[]);if(token!==chatSequence)return;host.innerHTML='';const visible=rows.filter(c=>!c.archived).sort((a,b)=>b.ts-a.ts),belongs=c=>c.contextWork===WORK_SLUG||c.w===WORK_SLUG||(c.scope?.works||[]).includes(WORK_SLUG);for(const [label,list] of [['This book',visible.filter(belongs)],['Other conversations',visible.filter(c=>!belongs(c))]]){if(!list.length)continue;const group=el('details','nb-conversation-group');group.open=label==='This book';const summary=el('summary');summary.textContent=label+' · '+list.length;group.appendChild(summary);for(const c of list){const button=el('button','nb-chat'),last=(c.turns||[]).at(-1),state=last?.serverJob?.status||last?.status||'draft';button.innerHTML='<span>'+esc(c.t||'New conversation')+'</span><small>'+esc(state.replace(/_/g,' '))+(c.unread?' · unread':'')+'</small>';button.onclick=()=>{closeNotebook(false);window.FRAsk?.open({id:c.id});};group.appendChild(button);}host.appendChild(group);}if(!visible.length)host.textContent='Your conversations will appear here. Start one to discuss this book.';}catch(_){host.textContent='Conversations could not be loaded. Open Ask to try again.';}
  }
  {const q=$("#nbSearch");if(q)q.oninput=()=>{const f=q.value.toLowerCase();
    filterNotebook();};}
  {const ex=$("#nbExport");if(ex)ex.onclick=()=>{
    const hl=lj("fr_hl"),notes=lj("fr_notes"),tr=lj("fr_tr"),here=k=>k.indexOf(WSID+"|")===0;
    let md=`# Notebook — ${DATA.title||WSID}\n_${new Date().toISOString().slice(0,10)} · The Faith Received_\n`;
    const dump=(label,m,fmt)=>{const ks=Object.keys(m).filter(here);if(!ks.length)return;
      md+=`\n## ${label}\n`;ks.forEach(k=>{const e=m[k]||{};md+=`\n- **${k.split("|")[1]}** ${fmt(e)}\n`;});};
    dump("Notes",notes,e=>(e.cite?`*${e.cite}*\n  `:"")+(e.t||""));
    dump("My translations",tr,e=>e.t||"");
    dump("Highlights",hl,e=>typeof e==="string"?e:JSON.stringify(e));
    try{ // pinned parallels involving THIS work, from the collections store
      const C=JSON.parse(lsGet("fr_collections_v1")||"[]");const rows=[];
      C.forEach(c=>(c.items||[]).forEach(i=>{if(i.slug===WORK_SLUG)rows.push("- **fol. "+i.page+"** (collection: "+c.name+") \u2014 https://thefaithreceived.vercel.app/read?w="+i.slug+"%23b"+i.page+"-0");}));
      if(rows.length)md+="\n## Pinned parallels (this work)\n\n"+rows.join("\n")+"\n";
    }catch(e){}
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([md],{type:"text/markdown"}));
    a.download=`notebook-${(WORK_SLUG||"work")}.md`;a.click();};}
  {const pb=$("#nbPages");if(pb)pb.onclick=()=>{
    const rng=prompt("Export which folios? (e.g. 100-120)", cur+"-"+Math.min(cur+19,(DATA.pages[DATA.pages.length-1]||{}).n||cur));
    if(!rng)return;const mm=rng.match(/^\s*(\d+)\s*[-–]\s*(\d+)\s*$/);if(!mm){alert("Use the form 100-120");return;}
    const a=+mm[1],b=+mm[2],sel=DATA.pages.filter(g=>g.n>=a&&g.n<=b);
    if(!sel.length){alert("No pages in that range");return;}
    let md=`# ${DATA.title||WSID}${DATA.volume?", "+DATA.volume:""} — fol. ${a}–${b}\n_${DATA.author||""} · The Faith Received_\n`;
    // footnote sigla ([^a], [^1]) recycle per page — namespace them per folio so the flat export keeps working links
    const ns=(s,n)=>(s||"").replace(/\[\^([^\]]+)\](:?)/g,(_,id,c)=>`[^${n}-${id}]${c}`);
    sel.forEach(g=>{md+=`\n\n## fol. ${g.n}\n\n${ns(g.en,g.n).trim()}\n\n> **Latin**\n>\n> ${ns(g.la,g.n).trim().replace(/\n/g,"\n> ")}\n`;});
    const dl=document.createElement("a");dl.href=URL.createObjectURL(new Blob([md],{type:"text/markdown"}));
    dl.download=`${WORK_SLUG||"work"}-fol${a}-${b}.md`;dl.click();};}
  {const wb=$("#nbWork");if(wb)wb.onclick=()=>{
    // RIDE data-accessibility criterion: the underlying edition data, downloadable per work
    const ns=(s,n)=>(s||"").replace(/\[\^([^\]]+)\](:?)/g,(_,id,c)=>`[^${n}-${id}]${c}`);
    let md=`# ${DATA.title||WSID}${DATA.volume?", "+DATA.volume:""}\n_${DATA.author||""} · The Faith Received · ${location.origin}/read/${WORK_SLUG}_\n`;
    DATA.pages.forEach(g=>{if(g.blank)return;
      md+=`\n\n## fol. ${g.n}\n\n${ns(g.en,g.n).trim()}\n\n> **Latin**\n>\n> ${ns(g.la,g.n).trim().replace(/\n/g,"\n> ")}\n`;});
    const dl=document.createElement("a");dl.href=URL.createObjectURL(new Blob([md],{type:"text/markdown"}));
    dl.download=`${WORK_SLUG||"work"}.md`;dl.click();};}
  // per-pane copy: gather a whole column (Latin or English) and copy it to the clipboard. Strips footnote
  // markers, page markers and headings; one blank line between folios. (la-empty works → hide the Latin one.)
  {const clean=s=>(s||"").replace(/\[\^[^\]]+\]:?/g,"").replace(/\[\[[^\]]*\]\]/g,"").replace(/^#{1,6}\s*/gm,"").trim();
   const col=side=>(DATA.pages||[]).filter(p=>!p.blank).map(p=>clean(side==="la"?p.la:p.en)).filter(Boolean).join("\n\n");
   const wire=(id,side,lbl)=>{const b=$("#"+id);if(!b)return;
     b.onclick=()=>{const t=col(side);if(t){cw(t);b.textContent="✓ copied";setTimeout(()=>b.textContent=lbl,1200);}};};
   wire("nbCopyEn","en","⧉ English");wire("nbCopyLa","la","⧉ Latin");
   if(DATA.en_only){const l=$("#nbCopyLa");if(l)l.style.display="none";}}
  $("#nbClose").onclick=closeNotebook;$("#nbScrim").onclick=closeNotebook;
  addEventListener("keydown",e=>{if(e.key==="Escape"){closeNotebook();
    const app=document.querySelector(".app");   // Contents sheet = .app without 'nosb' (Opus audit P0: no exit)
    if(app&&!app.classList.contains("nosb"))app.classList.add("nosb");}});
  {const nb=$("#nbCount");if(nb){nb.style.cursor="pointer";nb.title="Open research: work analysis, search, passages, saved items, and conversations";nb.onclick=openNotebook;}}
  // fingerprint anchors — full W3C TextQuoteSelector triple (the Hypothesis pattern):
  // exact = the row's first 60 EN chars; sfx = the next 32; pfx = the previous row's last 32.
  // A corpus edit can change any one of these and the entry still re-attaches via the others.
  function enTxt(r){const en=r.querySelector(".en");return ((en?en.textContent:r.textContent)||"").trim();}
  function fpOf(r){return enTxt(r).slice(0,60);}
  function prevTail(r){let p=r.previousElementSibling;while(p&&!(p.classList&&p.classList.contains("row")&&p.id))p=p.previousElementSibling;return p?enTxt(p).slice(-32):"";}
  function tqsOf(r){const t=enTxt(r);return {exact:t.slice(0,60),sfx:t.slice(60,92),pfx:prevTail(r)};}
  function tqsScore(r,e){const t=enTxt(r);let s=0;
    if(e.exact&&t.slice(0,60)===e.exact)s+=4;
    else if(e.exact&&t.slice(0,30)===e.exact.slice(0,30))s+=1;     // half-exact (opening lightly edited)
    if(e.sfx&&t.slice(60,92)===e.sfx)s+=2;
    if(e.pfx&&prevTail(r)===e.pfx)s+=1;
    return s;}
  function reconcileAnchors(){let moved=0;
    ["fr_notes","fr_tr","fr_hl"].forEach(store=>{const m=lj(store);let dirty=false;
      if(store==='fr_tr'&&!canTranslateSource())return;
      Object.keys(m).forEach(k=>{if(k.indexOf(WSID+"|")!==0)return;const e=m[k];
        if(!e||typeof e!=="object"||!e.exact)return;
        const id=k.slice(WSID.length+1),row=document.getElementById(id);
        if(row&&fpOf(row)===e.exact)return;                       // still anchored correctly
        const pg=(id.match(/^b(\d+)-/)||[])[1];if(!pg)return;
        let best=null,bs=1;                                        // need score >=2 to re-attach
        document.querySelectorAll(`.row[id^="b${pg}-"]`).forEach(r2=>{const s=tqsScore(r2,e);if(s>bs){bs=s;best=r2;}});
        if(best&&best.id!==id){m[WSID+"|"+best.id]=Object.assign({},e,tqsOf(best));delete m[k];dirty=true;moved++;}});
      if(dirty)save(store,m,{fr_notes:"_frSyncNotes",fr_tr:"_frSyncTr",fr_hl:"_frSyncHl"}[store]);});
    if(moved)console.info("[anchors] re-attached",moved,"entries to their text");}
  reconcileAnchors();
  // my-translation lane swap: where the reader wrote a translation, surface it AS the English cell
  window._frApplyMyTr=function(){if(!applyTranslationPolicy())return;const on=lsGet("fr_mytr")==="1",tr=lj("fr_tr");
    reading.querySelectorAll(".row[id],.en[id^=b],.la[id^=b]").forEach(r=>{const en=r.querySelector(".en");if(!en)return;
      const e=tr[K(r)];
      if(on&&e&&e.t){if(!en.dataset.orig)en.dataset.orig=en.innerHTML;en.innerHTML=inl(e.t);en.classList.add("mytr");}
      else if(en.dataset.orig){en.innerHTML=en.dataset.orig;delete en.dataset.orig;en.classList.remove("mytr");}});};
  {const t=$("#nbMyTr");if(t){t.checked=lsGet("fr_mytr")==="1";
    t.onchange=()=>{if(!canTranslateSource()){applyTranslationPolicy();return;}lsSet("fr_mytr",t.checked?"1":"0");window._frApplyMyTr();};}}
  // Hypothes.is opt-in: inject their embed once; opting out takes effect on next load
  {const t=$("#nbNoCite");if(t){t.checked=lsGet("fr_nocite")==="1";
    t.onchange=()=>{lsSet("fr_nocite",t.checked?"1":"0");};}}
  {const h=$("#nbHypo");if(h){let loaded=false;
    const loadHypo=()=>{if(loaded)return;loaded=true;
      window.hypothesisConfig=()=>({openSidebar:false,showHighlights:"whenSidebarOpen"});
      const s=document.createElement("script");s.src="https://hypothes.is/embed.js";s.async=true;document.head.appendChild(s);};
    h.checked=lsGet("fr_hypo")==="1";if(h.checked)loadHypo();
    h.onchange=()=>{lsSet("fr_hypo",h.checked?"1":"0");
      if(h.checked)loadHypo();else location.reload();};}}
  // initial render
  applyHl();reading.querySelectorAll(".row[id],.en[id^=b],.la[id^=b]").forEach(r=>{renderTr(r);renderNote(r);});updateCount();window._frApplyMyTr();
  // WINDOWED RENDERING (2026-08-20): folios hydrate lazily, so highlights / notes / my-
  // translations must be re-applied to each newly mounted folio, not just at first paint.
  window.__afterHydrate=(sec)=>{try{
    const scope=(sec&&sec.querySelectorAll)?sec:reading;
    applyHl();scope.querySelectorAll(".row[id],.en[id^=b],.la[id^=b]").forEach(r=>{renderTr(r);renderNote(r);});
    if(window._frApplyMyTr)window._frApplyMyTr();
  }catch(e){}};
  // Short works also stream and rebuild after initialization, outside the windowed
  // hydration hook. Decorate newly mounted anchors without changing their pairing.
  const annotationAnchors='.row[id],.en[id^=b],.la[id^=b]',decoratedAnchors=new WeakSet();
  function restoreMountedAnnotations(nodes){
    const anchors=new Set();for(const node of nodes){if(node.nodeType!==1)continue;if(node.matches(annotationAnchors))anchors.add(node);node.querySelectorAll(annotationAnchors).forEach(r=>anchors.add(r));}
    const highlights=lj('fr_hl'),snapshots=lj('fr_highlight_passages_v1');let changed=false;
    for(const r of anchors){if(decoratedAnchors.has(r)||!reading.contains(r))continue;decoratedAnchors.add(r);const color=highlights[K(r)];if(color){r.dataset.hl=color;captureHl(r,color,snapshots);changed=true;}renderTr(r);renderNote(r);}
    if(changed)lsSet('fr_highlight_passages_v1',JSON.stringify(snapshots));
  }
  const annotationObserver=new MutationObserver(records=>restoreMountedAnnotations(records.flatMap(record=>[...record.addedNodes])));
  restoreMountedAnnotations([reading]);annotationObserver.observe(reading,{childList:true,subtree:true});
  // The shell owns cold arrival and subsequent citation choices. Deferred tools must not
  // restart the original hash after a reader has scrolled or selected another passage.
  // ---- account sign-in + Firestore sync of the notebook (active only when Firebase is configured) ----
  (async function initSync(){
    const cfg=window.__FR_FB__,btn=$("#frSync"),note=$("#frSyncNote");
    if(!cfg||!cfg.apiKey){if(btn)btn.hidden=true;return;}               // not configured → localStorage-only
    if(btn)btn.hidden=false;
    let auth,db,fb;
    try{
      const [A,Au,F]=await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js")]);
      fb=Object.assign({},Au,F);const app=A.initializeApp(cfg);auth=Au.getAuth(app);db=F.getFirestore(app);
    }catch(e){if(note)note.textContent="sync unavailable";if(btn)btn.hidden=true;return;}
    const KEYS=["fr_del","fr_hl","fr_notes","fr_tr","fr_lastread"],ref=(uid,k)=>fb.doc(db,"users",uid,"meta",k),wt={};
    const queueColl=(uid,v)=>{clearTimeout(wt.coll);wt.coll=setTimeout(()=>fb.setDoc(ref(uid,"fr_collections_v1"),{list:v,ts:Date.now()}).catch(()=>{}),800);};
    const queueWrite=(uid,k,v)=>{clearTimeout(wt[k]);wt[k]=setTimeout(()=>fb.setDoc(ref(uid,k),{items:v,ts:Date.now()}).catch(()=>{}),800);};
    const wire=uid=>{window._frSyncPins=v=>queueWrite(uid,"fr_pins",v);window._frSyncDel=v=>queueWrite(uid,"fr_del",v);window._frSyncHl=v=>queueWrite(uid,"fr_hl",v);window._frSyncNotes=v=>queueWrite(uid,"fr_notes",v);window._frSyncTr=v=>queueWrite(uid,"fr_tr",v);window._frSyncLastread=v=>queueWrite(uid,"fr_lastread",v);window._frSyncCollections=v=>queueColl(uid,v);window._frSyncChats=v=>queueWrite(uid,"fr_chats",v);};
    const unwire=()=>{delete window._frSyncPins;delete window._frSyncHl;delete window._frSyncNotes;delete window._frSyncTr;delete window._frSyncLastread;delete window._frSyncCollections;delete window._frSyncChats;};
    async function mergeIn(uid){           // union local + remote (notes/tr keep the newer ts; highlights: local wins)
      // fr_del merges FIRST (max-ts union) and then vetoes: any id whose tombstone is newer
      // than the entry's ts is dropped, not resurrected (delete-vs-union bug, 2026-07-12).
      let TOMB={};
      for(const k of KEYS){let remote={};
        try{const s=await fb.getDoc(ref(uid,k));if(s.exists())remote=(s.data()||{}).items||{};}catch(e){}
        const local=lj(k),merged=Object.assign({},remote);
        for(const id in local){const a=local[id],b=remote[id];
          merged[id]=(b!=null&&typeof a==="object"&&typeof b==="object")?(((a.ts||0)>=(b.ts||0))?a:b)
                    :(k==="fr_del"?Math.max(+a||0,+b||0):a);}
        if(k==="fr_del"){TOMB=merged;}
        else if(k!=="fr_lastread"){
          for(const id in merged){const dts=TOMB[k+"|"+id];
            if(dts&&dts>=(((merged[id]||{}).ts)||0))delete merged[id];}}
        lsSet(k,JSON.stringify(merged));
        try{await fb.setDoc(ref(uid,k),{items:merged,ts:Date.now()});}catch(e){}}
      // pins (the reading list behind the Research Portfolio): array store, union by site|slug|page,
      // local-first order, cap 300 — a pin starred on any family site lands in the same account doc.
      try{
        let remote=[];const s=await fb.getDoc(ref(uid,"fr_pins"));
        if(s.exists())remote=(s.data()||{}).items||[];
        let local=[];try{local=JSON.parse(lsGet("fr_pins")||"[]");}catch(e){}
        const pk=x=>(x.site||"fr")+"|"+x.slug+"|"+x.page,seen=new Set(),merged=[];
        [...local,...remote].forEach(x=>{const k=pk(x);if(!seen.has(k)){seen.add(k);merged.push(x);}});
        lsSet("fr_pins",JSON.stringify(merged.slice(0,300)));
        if(merged.length)await fb.setDoc(ref(uid,"fr_pins"),{items:merged.slice(0,300),ts:Date.now()}).catch(()=>{});
      }catch(e){}
      // conversations (owner 2026-08-19 'are convos saved like chatgpt/claude'): fr_chats
      // {v:1,chats:[{id,ts,t,w?,turns}]} — merge by chat id, newer ts wins, newest-first, cap 20.
      // Saved from the search page or this rail; sync rides the SAME account store as the notebook.
      try{
        let remote=[];const s=await fb.getDoc(ref(uid,"fr_chats"));
        if(s.exists())remote=((s.data()||{}).items||{}).chats||[];
        let local=[];try{local=(JSON.parse(lsGet("fr_chats")||"{}").chats)||[];}catch(e){}
        const byId={};[...remote,...local].forEach(c=>{
          if(!c||!c.id)return;
          if(!byId[c.id]||((c.ts||0)>(byId[c.id].ts||0)))byId[c.id]=c;});
        const merged=Object.values(byId).sort((a2,b2)=>(b2.ts||0)-(a2.ts||0)).slice(0,20);
        if(merged.length){lsSet("fr_chats",JSON.stringify({v:1,chats:merged}));
          await fb.setDoc(ref(uid,"fr_chats"),{items:{v:1,chats:merged},ts:Date.now()}).catch(()=>{});}
      }catch(e){}
      // Collections retain distinct references, quote images, answers, and notes on the same page.
      try{
        let remote=[];const s=await fb.getDoc(ref(uid,"fr_collections_v1"));
        if(s.exists())remote=(s.data()||{}).list||[];
        let local=[];try{local=JSON.parse(lsGet("fr_collections_v1")||"[]");}catch(e){}
        const merged=mergeCollections(remote,local);
        if(merged.length){lsSet("fr_collections_v1",JSON.stringify(merged));
          await fb.setDoc(ref(uid,"fr_collections_v1"),{list:merged,ts:Date.now()}).catch(()=>{});}
      }catch(e){}
      applyHl();reading.querySelectorAll(".row[id],.en[id^=b],.la[id^=b]").forEach(r=>{renderTr(r);renderNote(r);});updateCount();
    }
    fb.onAuthStateChanged(auth,async u=>{
      if(u){window._frUser=u.displayName||u.email||"";if(note)note.textContent="synced · "+(u.email||"signed in");if(btn)btn.textContent="Sign out";
        try{await mergeIn(u.uid);}catch(e){}wire(u.uid);
        // cross-site reading hub (PRDL browse "jump back in" — sister pattern, auth.js:146)
        window._frSyncReading=()=>{try{fb.setDoc(fb.doc(db,"users",u.uid,"reading","fr"),
          {corpus:"fr",site:"The Faith Received",title:DATA&&DATA.title||"",detail:DATA?locOf(cur):"",
           url:location.origin+"/the-faith-received/read/"+(DATA&&WORK_SLUG)+"#b"+cur+"-0",ts:Date.now()}).catch(()=>{});}catch(e){}};
        window._frSyncReading();
        // OWNER on the deployed site: review marks write to the fr_events queue (Firestore rules
        // are the gate; this UI is cosmetic). pull_edits.py drains them into review_state.json.
        // BANNER STATE depends only on AUTH (never on DATA) → a cached/persisted session is recognised
        // INSTANTLY and never re-prompts "sign in" (the bug: the old guard also required DATA, but
        // onAuthStateChanged fires before loadWork resolves on a cached session → state stuck on "out").
        const isOwner=BLOB&&u.email==="stivenpeter@gmail.com"&&u.emailVerified;
        window.__frRvState=isOwner?"owner":"wrong";if(window.__frRvSet)window.__frRvSet(window.__frRvState,u.email);
        // OWNER CONTROLS need DATA + the built DOM. Wire them whenever BOTH auth and DATA are ready —
        // run now if DATA already loaded, else stash on window.__frApplyOwner for the data-load path to call.
        const applyOwner=()=>{
          if(!isOwner||!(DATA&&DATA.slug)||window.__frOwnerWired)return;window.__frOwnerWired=true;
          const ev=(type,payload)=>{const pg=(payload&&payload.page)||cur;return fb.addDoc(fb.collection(db,"fr_events"),
            {ts:Date.now(),slug:DATA.slug,page:pg,type,payload:payload||{},applied:null})
            .then(()=>{const n=$("#frSyncNote");if(n)n.textContent=type+" → fol. "+pg;}).catch(()=>{});};
          window._frEvent=ev;
          // BLOB-AUTHORITATIVE writes (owner): edit + redo POST to /api/edit /api/redo with the Firebase
          // ID token; the function read-modify-writes the page JSON ON BLOB and it goes LIVE (no Mac in the
          // loop — Blob is the source of truth). Marks (ok/needs/view) still queue to Firestore (review
          // tracking, not content). Returns {la,en} so the folio updates optimistically.
          const evBlob=async(kind,payload)=>{const n=$("#frSyncNote");const pg=(payload&&payload.page)||cur;
            if(n)n.textContent=(kind==="redo"?"⟳ re-transcribing fol. ":"saving fol. ")+pg+"…";
            try{const tok=await u.getIdToken();
              const r=await fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/"+kind,{method:"POST",headers:{Authorization:"Bearer "+tok,"Content-Type":"application/json"},
                body:JSON.stringify(Object.assign({slug:DATA.slug,page:cur},payload))});
              const j=await r.json().catch(()=>({}));
              if(!r.ok){if(n)n.textContent="⚠ "+(j.error||("error "+r.status))+" (fol. "+pg+")";return null;}
              if(n)n.textContent=kind+" saved → fol. "+(j.page||pg)+" · live on Blob";return j;
            }catch(e){if(n)n.textContent="⚠ "+kind+" failed — check connection";return null;}};
          window._frBlob=evBlob;
          // QUICK INLINE EDITS (owner): double-click any Latin/English paragraph cell to edit its text in
          // place. Enter/click-away POSTs {side,page,old,new} to /api/edit, which splices old→new into the
          // page markdown ON BLOB (markdown preserved outside the changed words) and it goes live. Esc
          // cancels. The whole-folio ✎ modal stays for structural rewrites. This IS the review mode, live.
          if(!window.__frInlineWired){window.__frInlineWired=true;
            const cellText=c=>{const k=c.cloneNode(true);k.querySelectorAll(".fnref,.fn-ret,.fnid,.fnlem,.fnsep").forEach(x=>x.remove());return (k.textContent||"").replace(/\s+/g," ").trim();};
            let _editing=null;
            reading.addEventListener("dblclick",e=>{
              if(!window._frEvent)return;
              const cell=e.target.closest(".la,.en");
              if(!cell||cell.closest(".rapp")||cell.closest(".toc")||cell.closest(".rhead"))return;  // skip apparatus/TOC/heading cells
              if(cell.isContentEditable)return;
              const folio=cell.closest(".folio");if(!folio)return;
              if(_editing&&_editing!==cell)_editing.blur();
              const pageN=+folio.dataset.page, side=cell.classList.contains("la")?"la":"en", old=cellText(cell);
              cell.contentEditable="true";cell.spellcheck=false;cell.classList.add("editing");_editing=cell;
              cell.focus();
              const done=keep=>{cell.removeEventListener("keydown",kd);cell.removeEventListener("blur",bl);
                cell.contentEditable="false";cell.classList.remove("editing");_editing=null;
                if(!keep){cell.textContent=old;return;}
                const nu=cellText(cell);
                // call the CURRENT user's evBlob via window._frBlob (set fresh each sign-in, deleted on sign-out)
                // — NOT the closure-captured evBlob — so this one-time listener never uses a stale user/token.
                if(nu&&nu!==old&&window._frBlob){cell.classList.add("edited");window._frBlob("edit",{side,page:pageN,old,new:nu});}};
              const kd=k=>{if(k.key==="Enter"&&!k.shiftKey){k.preventDefault();cell.blur();}
                else if(k.key==="Escape"){k.preventDefault();done(false);}};
              const bl=()=>done(true);
              cell.addEventListener("keydown",kd);cell.addEventListener("blur",bl);
            });
          }
          const ph=document.querySelector(".ph");
          if(ph&&!document.getElementById("ownerMarks")){
            // ===== CLASSIC CLOUD REVIEW: Firestore-backed per-page progress + propose→review→apply =====
            const RVREF=fb.doc(db,"fr_review",DATA.slug);
            const RV=window.__frReview={ref:RVREF,stat:{}};            // stat[n]={st,note,ts,model}; st∈ok|needs|redone|viewed|new
            const ST_COL={ok:"#2f7d52",needs:"#9a2420",redone:"#b8860b",viewed:"#7d97bd",new:""},ST_LAB={ok:"OK",needs:"needs",redone:"redone",viewed:"viewed",new:""};
            const rvMsg=t=>{const n=$("#frSyncNote");if(n)n.textContent=t;};
            RV.statusOf=n=>(RV.stat[n]&&RV.stat[n].st)||"new";
            // per-folio status badge — painted into the folio's preceding .fmark .fr slot
            const rvPaint=n=>{const sec=$("#reading").querySelector('.folio[data-page="'+n+'"]');if(!sec)return;
              const fm=sec.previousElementSibling,slot=fm&&fm.classList.contains("fmark")?fm.querySelector(".fr"):null;if(!slot)return;
              const st=RV.statusOf(n);slot.innerHTML=st==="new"?"":'<span class="rvchip '+st+'">'+ST_LAB[st]+'</span>';};
            const rvPaintAll=()=>$("#reading").querySelectorAll(".folio[data-page]").forEach(sec=>rvPaint(+sec.dataset.page));
            window.__frRvPaintAll=rvPaintAll;
            const counts=()=>{const c={ok:0,needs:0,redone:0,viewed:0,new:0,total:(DATA.pages||[]).length};
              (DATA.pages||[]).forEach(p=>{const k=RV.statusOf(p.n);c[k]=(c[k]||0)+1;});c.reviewed=c.ok+c.needs+c.redone;return c;};
            const needsList=()=>(DATA.pages||[]).map(p=>p.n).filter(n=>RV.statusOf(n)==="needs");
            const nextUnreviewed=()=>{const ps=(DATA.pages||[]).map(p=>p.n);return ps.find(n=>n>cur&&RV.statusOf(n)==="new")??ps.find(n=>RV.statusOf(n)==="new");};
            // /review banner integration ("⚑ N flagged · next →")
            window.__frNsCount=()=>needsList().length;
            window.__frNsNext=()=>{const l=needsList();if(!l.length)return;jump(l.find(n=>n>cur)||l[0]);};
            window.__frRvRefresh=()=>{if(window.__frRvSet&&window.__frRvState==="owner")window.__frRvSet("owner");};
            // ---- progress summary + panel ----
            const rvSum=()=>{const c=counts();
              const pb=document.getElementById("rvPanelBtn");if(pb)pb.textContent="▣ "+c.reviewed+"/"+c.total;
              const sub=document.querySelector(".rvpanel-sub");if(sub)sub.textContent=c.reviewed+" of "+c.total+" reviewed";
              const box=document.querySelector(".rvpanel-sum");if(box){box.innerHTML=
                '<span class="rvpill"><i style="background:'+ST_COL.ok+'"></i><b>'+c.ok+'</b> ok</span>'+
                '<span class="rvpill"><i style="background:'+ST_COL.needs+'"></i><b>'+c.needs+'</b> needs</span>'+
                '<span class="rvpill"><i style="background:'+ST_COL.redone+'"></i><b>'+c.redone+'</b> redone</span>'+
                '<span class="rvpill"><i style="background:'+ST_COL.viewed+'"></i><b>'+c.viewed+'</b> viewed</span>'+
                '<span class="rvpill"><b>'+c.new+'</b> new</span>'+
                '<button class="rvpill rvnext">→ next new</button>';
                const nb=box.querySelector(".rvnext");if(nb)nb.onclick=()=>{const nx=nextUnreviewed();if(nx!=null)jump(nx);};}
              if(window.__frRvRefresh)window.__frRvRefresh();};
            const rvGrid=filt=>{const g=document.querySelector(".rvpanel-grid");if(!g)return;g.innerHTML="";
              (DATA.pages||[]).forEach(p=>{const st=RV.statusOf(p.n);if(filt&&filt!=="all"&&st!==filt)return;
                const b=document.createElement("button");b.className="rvcell "+st;b.dataset.page=p.n;
                b.title=locOf(p.n)+(RV.stat[p.n]&&RV.stat[p.n].note?(" — "+RV.stat[p.n].note):"");
                b.textContent=p.n;b.onclick=()=>jump(p.n);g.appendChild(b);});};
            const rvPanelRow=n=>{const g=document.querySelector(".rvpanel-grid");if(g){const b=g.querySelector('.rvcell[data-page="'+n+'"]');if(b)b.className="rvcell "+RV.statusOf(n);}};
            const rvPanelToggle=()=>{const ex=document.getElementById("rvPanel");if(ex){ex.remove();return;}
              const p=document.createElement("div");p.id="rvPanel";p.className="rvpanel";
              p.innerHTML='<div class="rvpanel-h"><b>Review progress</b><span class="rvpanel-sub"></span><button class="rvpanel-x" title="Close">✕</button></div>'+
                '<div class="rvpanel-sum"></div>'+
                '<div class="rvpanel-filters">'+["all","new","needs","redone","ok","viewed"].map(f=>'<button class="rvf'+(f==="all"?" on":"")+'" data-f="'+f+'">'+f+'</button>').join("")+'</div>'+
                '<div class="rvpanel-grid"></div>';
              document.body.appendChild(p);
              p.querySelector(".rvpanel-x").onclick=()=>p.remove();
              p.querySelectorAll(".rvf").forEach(b=>b.onclick=()=>{p.querySelectorAll(".rvf").forEach(x=>x.classList.toggle("on",x===b));rvGrid(b.dataset.f);});
              rvSum();rvGrid("all");};
            // ---- persist a page's status to the owner-only Firestore doc, then repaint ----
            // explicit actions (ok/needs/redone) write immediately; passive "viewed" coalesces into one
            // trailing setDoc (defer=true) so scrolling a big work doesn't fire a write per page.
            let _pend=null,_pendT=0;
            const rvFlush=()=>{if(!_pend)return;const pages=_pend;_pend=null;clearTimeout(_pendT);try{fb.setDoc(RVREF,{pages,updated:Date.now()},{merge:true});}catch(e){}};
            RV.set=(n,st,note,defer)=>{RV.stat[n]=Object.assign({},RV.stat[n],{st,note:(note!=null?note:(RV.stat[n]&&RV.stat[n].note))||"",ts:Date.now()});
              if(defer){(_pend=_pend||{})[n]=RV.stat[n];clearTimeout(_pendT);_pendT=setTimeout(rvFlush,1200);}
              else{if(_pend){_pend[n]=RV.stat[n];rvFlush();}else{try{fb.setDoc(RVREF,{pages:{[n]:RV.stat[n]},updated:Date.now()},{merge:true});}catch(e){}}}
              rvPaint(n);rvPanelRow(n);rvSum();};
            addEventListener("beforeunload",rvFlush);   // don't lose buffered "viewed" marks on navigate-away
            // ---- redo = TRIGGER → propose (dry-run, no write) → REVIEW the result vs the scan → APPLY ----
            const rvRedo=async n=>{const model=(document.getElementById("redoModel")||{}).value||undefined;
              const br=document.getElementById("rvRedo");if(br)br.textContent="⟳ …";rvMsg("⟳ re-transcribing fol. "+n+" — proposing…");
              let j=null;try{const tok=await u.getIdToken();
                const r=await fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/redo",{method:"POST",headers:{Authorization:"Bearer "+tok,"Content-Type":"application/json"},body:JSON.stringify({slug:DATA.slug,page:n,model,propose:true})});
                j=await r.json().catch(()=>({}));if(!r.ok){rvMsg("⚠ "+(j.error||("error "+r.status)));if(br)br.textContent="⟳ redo";return;}
              }catch(e){rvMsg("⚠ redo failed — check connection");if(br)br.textContent="⟳ redo";return;}
              if(br)br.textContent="⟳ redo";rvMsg("proposal ready for fol. "+n+" — review vs the scan, then Apply");rvPropose(n,j.la||"",j.en||"",j.model||model);};
            const rvPropose=(n,la,en,model)=>{const pg=(DATA.pages||[]).find(p=>p.n===n);if(!pg)return;
              let ov=document.getElementById("rvProp");if(ov)ov.remove();
              ov=document.createElement("div");ov.id="rvProp";ov.className="rvprop-ov";
              const img=DATA.has_pages&&pg.img?'<div class="rvprop-img"><img src="'+esc(pg.img)+'" alt="facsimile"></div>':"";
              ov.innerHTML='<div class="rvprop-box"><div class="rvprop-h">Review proposal — '+esc(locOf(n))+' <span>· '+esc(model||"")+' · check against the scan — nothing is saved until you Apply</span><button class="rvprop-x" title="Discard">✕</button></div>'+
                '<div class="rvprop-body">'+img+'<div class="rvprop-cols">'+
                  '<div class="rvprop-col"><div class="rvprop-lab">Latin · source</div><textarea class="rvprop-ta la" data-k="pla" spellcheck="false"></textarea></div>'+
                  '<div class="rvprop-col"><div class="rvprop-lab">English</div><textarea class="rvprop-ta en" data-k="pen" spellcheck="false"></textarea></div>'+
                '</div></div>'+
                '<div class="rvprop-btns"><button class="pri">✓ Apply to Blob (live)</button><button class="rerun">⟳ Re-run</button><button class="cx">Discard</button><span class="rvprop-msg"></span></div></div>';
              document.body.appendChild(ov);
              ov.querySelector('[data-k=pla]').value=la;ov.querySelector('[data-k=pen]').value=en;
              const close=()=>ov.remove();
              ov.querySelector(".rvprop-x").onclick=close;ov.querySelector(".cx").onclick=close;
              ov.addEventListener("click",e=>{if(e.target===ov)close();});
              ov.querySelector(".rerun").onclick=()=>{close();rvRedo(n);};
              ov.querySelector(".pri").onclick=async()=>{const nla=ov.querySelector('[data-k=pla]').value,nen=ov.querySelector('[data-k=pen]').value;
                const mb=ov.querySelector(".rvprop-msg");mb.textContent="applying to Blob…";
                const jj=await evBlob("edit",{la:nla,en:nen,page:n});
                if(jj){pg.la=jj.la;pg.en=jj.en;if(window.__rebuildFolio)window.__rebuildFolio(n);ev("redo",{model,page:n});RV.set(n,"redone");close();rvMsg(locOf(n)+" redone + applied → live on Blob");}
                else mb.textContent="⚠ apply failed — check connection";};};
            window.__frRvRedo=rvRedo;
            // ---- the masthead control cluster ----
            const s=document.createElement("span");s.id="ownerMarks";
            s.style.cssText="display:inline-flex;gap:.3rem;margin-left:.5rem;align-items:center";
            s.innerHTML='<button class="pb" id="rvEdit" title="Edit this whole folio — or double-click any paragraph for a quick inline fix">✎ edit</button>'+
              '<button class="pb" id="rvOk" title="Mark this folio reviewed-OK">✓ ok</button>'+
              '<button class="pb" id="rvNeeds" title="Flag this folio as needing work (with a note)">⚑ needs</button>'+
              '<button class="pb" id="rvRedo" title="Re-transcribe from the facsimile → review the proposal → apply">⟳ redo</button>'+
              '<select class="pb redomodel" id="redoModel" title="Redo model — OpenRouter, flex tier"></select>'+
              '<button class="pb rvprog" id="rvPanelBtn" title="Review progress for this work — counts, page map, jump to next">▣ progress</button>';
            ph.appendChild(s);
            document.getElementById("rvEdit").onclick=()=>openEdit(cur);
            document.getElementById("rvOk").onclick=()=>{ev("ok");RV.set(cur,"ok");rvMsg(locOf(cur)+" marked OK");};
            document.getElementById("rvNeeds").onclick=()=>{const note=prompt("What needs fixing on "+locOf(cur)+"?",(RV.stat[cur]&&RV.stat[cur].note)||"");if(note!==null){ev("needs",{note});RV.set(cur,"needs",note);}};
            document.getElementById("rvRedo").onclick=()=>rvRedo(cur);
            document.getElementById("rvPanelBtn").onclick=rvPanelToggle;
            if(!DATA.has_pages){["rvRedo","redoModel"].forEach(id=>{const el2=document.getElementById(id);if(el2)el2.style.display="none";});}  // born-digital: no facsimile to redo from
            // ENTER REVIEW MODE from the reader: a prominent accent button (owner only) → the dedicated /review page
            if(location.pathname!=="/the-faith-received/review/"&&DATA&&DATA.slug&&!document.getElementById("rvLink")){
              const a=document.createElement("a");a.id="rvLink";a.className="pb rvbtn";a.href="/the-faith-received/review/?w="+encodeURIComponent(DATA.slug);
              a.textContent="✎ Review mode";a.title="Enter review mode for this work (edit · OK/Needs · redo)";a.style.textDecoration="none";
              s.insertBefore(a,s.firstChild);}                                       // first → reads as the primary entry
            // populate the redo-model picker from the server allowlist; remember the owner's choice (default flash-lite)
            {const sel=document.getElementById("redoModel");if(sel){const saved=lsGet("fr_redo_model");
              fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/redo").then(r=>r.json()).then(d=>{const ms=d.models||{};sel.innerHTML=Object.keys(ms).map(k=>'<option value="'+esc(k)+'">'+esc(ms[k])+'</option>').join("");if(saved&&ms[saved])sel.value=saved;else if(d.default)sel.value=d.default;}).catch(()=>{});
              sel.onchange=()=>lsSet("fr_redo_model",sel.value);}}
            // load saved progress, then paint badges (now + when the progressive build finishes)
            RV.load=async()=>{try{const sn=await fb.getDoc(RVREF);RV.stat=(sn.exists()&&(sn.data()||{}).pages)||{};}catch(e){RV.stat={};}rvPaintAll();rvSum();};
            {const prev=window._afterBuild;window._afterBuild=()=>{if(prev)prev();rvPaintAll();};if(window.__readerBuilt)rvPaintAll();}
            RV.load();
          }
          // whole-folio editor (owner) — edit the page's Latin/English markdown; POST /api/edit writes it
          // straight to Blob (the source of truth) and it goes live (~5 min CDN; instant for you here).
          window.openEdit=function(n){
            const pg=(DATA.pages||[]).find(p=>p.n===n);if(!pg)return;
            let ov=document.getElementById("frEdit");if(ov)ov.remove();
            ov=document.createElement("div");ov.id="frEdit";ov.className="edit-ov";
            ov.innerHTML='<div class=edit-box><div class=edit-h>Edit fol. '+n+' <span>— saved straight to Blob; live within ~5 min</span></div>'+
              '<label>Latin · source<textarea class=edLa spellcheck=false></textarea></label>'+
              '<label>English<textarea class=edEn spellcheck=false></textarea></label>'+
              '<div class=edit-btns><button class=pri>Save to Blob</button><button class=cx>Cancel</button><span class=edhint>raw page markdown · ### for headings</span></div></div>';
            document.body.appendChild(ov);
            ov.querySelector(".edLa").value=pg.la||"";ov.querySelector(".edEn").value=pg.en||"";
            const close=()=>ov.remove();
            ov.addEventListener("click",e=>{if(e.target===ov)close();});
            ov.querySelector(".cx").onclick=close;
            ov.querySelector(".pri").onclick=()=>{
              const la=ov.querySelector(".edLa").value,en=ov.querySelector(".edEn").value;close();
              evBlob("edit",{la,en,page:n}).then(j=>{if(j){pg.la=j.la;pg.en=j.en;if(window.__rebuildFolio)window.__rebuildFolio(n);}});};
          };
          let seen=new Set();
          const mv=()=>{if(!seen.has(cur)){seen.add(cur);ev("view");
            if(window.__frReview&&window.__frReview.statusOf(cur)==="new")window.__frReview.set(cur,"viewed",null,true);}};  // first view → "viewed" (deferred write; never downgrades ok/needs/redone)
          mv();const _sf=window._frSyncReading;window._frSyncReading=()=>{_sf();mv();};
          window.__frRvState="owner";if(window.__frRvSet)window.__frRvSet("owner");   // refresh banner: flagged count now wired
        };
        window.__frApplyOwner=applyOwner;applyOwner();}                              // run now (DATA ready) or stash for the loader
      else{window._frUser="";unwire();if(note)note.textContent="saved on this device";if(btn)btn.textContent="Sign in";
        window.__frRvState="out";if(window.__frRvSet)window.__frRvSet("out");
        // re-sign-in re-wires; stop double-click edits + reading-sync. NOTE: __frInlineWired is left set on
        // purpose — the dblclick listener is attached once and reads window._frBlob, so it self-disables when
        // _frBlob is deleted here and re-enables on the next sign-in WITHOUT attaching a duplicate listener.
        window.__frOwnerWired=false;delete window.__frApplyOwner;delete window._frEvent;delete window._frBlob;delete window._frSyncReading;
        const om=document.getElementById("ownerMarks");if(om)om.remove();const rl=document.getElementById("rvLink");if(rl)rl.remove();}
    });
    if(btn)btn.onclick=()=>{auth.currentUser?fb.signOut(auth):fb.signInWithPopup(auth,new fb.GoogleAuthProvider()).catch(()=>{if(note)note.textContent="sign-in canceled";});};
    // /review banner sign-in: always show the account chooser so the owner can pick / switch in one click
    window.__frSignIn=()=>{const p=new fb.GoogleAuthProvider();p.setCustomParameters({prompt:"select_account"});fb.signInWithPopup(auth,p).catch(()=>{if(note)note.textContent="sign-in canceled";});};
  })();
}

window.__initReview=__initReview;window.__initSearch=__initSearch;window.__initReaderTools=__initReaderTools;
window.__frToolsRes&&window.__frToolsRes();

/* ── CITED-AUTHOR DOORS (owner 2026-08-19 'in Vitringa go to the works Vitringa mentions'):
   works with a mined v1/cites/{slug}.json sidecar (deterministic surname mining against the
   corpus authority table, then LLM-judged, deepseek-v4-flash) get their author mentions
   linkified — first occurrence per folio, linking to that author's shelf. 404 = no-op. ── */
(function(){
  const wire=setInterval(()=>{
    if(!window.__readerBuilt||typeof DATA==="undefined"||!window.DATA&&!document.querySelector(".folio"))return;
    clearInterval(wire);
    const slug=(new URLSearchParams(location.search).get("w"))||"";
    if(!slug)return;
    const B=(window.BLOB||"https://mo-tfr-library.mo-podcast-feed.workers.dev");
    // the cites sidecar exists only for mined library works — canon families (eebo/pld/pg/po)
    // guaranteed a 404 on every reader load (2026-08-20 console cleanup)
    if(/^(eebo|pld|pg|po)-\d+$/.test(String(slug||"")))return;
    fetch(B+"/v1/cites/"+encodeURIComponent(slug)+".json").then(r=>r.ok?r.json():null).then(d=>{
      if(!d||!d.pages)return;
      if(!document.getElementById("citelnk-css")){
        const st=document.createElement("style");st.id="citelnk-css";
        st.textContent="a.citelnk{color:inherit;text-decoration:underline dotted var(--accent,#a8462b);text-underline-offset:3px}a.citelnk:hover{color:var(--accent,#a8462b)}";
        document.head.appendChild(st);}
      document.querySelectorAll(".folio[data-page]").forEach(fol=>{
        const rows=d.pages[String(fol.dataset.page)];
        if(!rows)return;
        rows.forEach(({m,a})=>{
          const cells=fol.querySelectorAll(".en,.la");
          for(const cell of cells){
            const tw=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);
            let node;let done=false;
            while(!done&&(node=tw.nextNode())){
              if(node.parentElement&&node.parentElement.closest("a"))continue;
              const i=node.textContent.indexOf(m);
              if(i<0)continue;
              const after=node.splitText(i);after.splitText(m.length);
              const link=document.createElement("a");
              link.className="citelnk";
              link.href="/?a="+encodeURIComponent(a);
              link.title="In this library: works of "+a;
              link.textContent=m;
              after.parentNode.replaceChild(link,after);
              done=true;
            }
            if(done)break;
          }
        });
      });
    }).catch(()=>{});
  },600);
  setTimeout(()=>clearInterval(wire),40000);
})();
