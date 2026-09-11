
const BLOB=(window.__FR_BLOB_BASE__||"").replace(/\/$/,"");
const VER=window.__FR_VER?("?v="+window.__FR_VER):"";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// ── store: fr_collections_v1 = [{id,name,items:[{slug,page}]}] ; migrates legacy fr_pins ──
function loadCols(){
  let C;try{C=JSON.parse(localStorage.getItem("fr_collections_v1")||"[]");if(!Array.isArray(C)||C.some(c=>!c||!c.id||!Array.isArray(c.items)))throw Error('Unexpected collection format');}catch(e){$("#collectionStatus").textContent="Saved collections could not be read. They have not been overwritten.";throw e;}
  if(!C.length){
    let legacy;try{legacy=JSON.parse(localStorage.getItem("fr_pins")||"[]");if(!Array.isArray(legacy))throw Error('Unexpected legacy format');}catch(e){$("#collectionStatus").textContent="Legacy saved passages could not be read. They have not been overwritten.";throw e;}
    C=[{id:"default",name:"Reading list",items:legacy.map(x=>({...x,site:x.site||"fr"}))}];
    saveCols(C);
  }
  return C;}
function saveCols(C){
  try{COLS=window.FRResearchNotebook.commitCollections(C);}catch(e){$("#collectionStatus").textContent=e.message;throw e;}
  if(typeof window._frSyncCollections==='function')Promise.resolve().then(()=>window._frSyncCollections(COLS)).catch(()=>{$("#collectionStatus").textContent="Saved in this browser; account sync did not complete.";});
  window.dispatchEvent(new Event('fr-notebook-updated'));
}
let WIDX=null,TEN={},COLS=[],ACTIVE=null,SHARED=null;
let SHARED_FROM_FILE=false,NOTE_EDITOR=null;
function notebookTools(){if(!window.FRResearchNotebook?.sharePlan){$("#collectionStatus").textContent='Collection tools could not load. Reload before changing saved data.';throw Error('Collection tools unavailable');}return window.FRResearchNotebook;}
function downloadCollection(collection){const data=notebookTools().sharePlan(collection,location.origin),url=URL.createObjectURL(new Blob([data.contents],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=data.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function validShared(payload){try{notebookTools().decodeShared(payload);return true;}catch(_){return false;}}
$("#importCollection").onclick=()=>$("#collectionFile").click();
$("#collectionFile").onchange=async event=>{const file=event.target.files[0];if(!file)return;try{const payload=JSON.parse(await file.text());const collection=notebookTools().decodeShared(payload);SHARED=notebookTools().sharePayload(collection);SHARED_FROM_FILE=true;personalView(false);render();$("#collectionStatus").textContent='Collection file opened for review. Use Save a copy to add it to your collections.';}catch(_){$("#collectionStatus").textContent='This collection file could not be read. No saved data was changed.';}finally{event.target.value='';}};
let PERSONAL_RESEARCH=null,PERSONAL_OPEN=false;
function personalView(open){
  PERSONAL_OPEN=!!open;$("#app").hidden=PERSONAL_OPEN;$("#personalResearchPage").hidden=!PERSONAL_OPEN;
  $("#pinsBrowse").setAttribute('aria-pressed',String(!PERSONAL_OPEN));$("#pinsPersonal").setAttribute('aria-pressed',String(PERSONAL_OPEN));
  const url=new URL(location.href);PERSONAL_OPEN?url.searchParams.set('view','research'):url.searchParams.delete('view');history.replaceState(null,'',url);
  if(PERSONAL_OPEN){if(!PERSONAL_RESEARCH){if(!window.FRPersonalResearch){$("#personalResearchHost").textContent='Personal research could not load. Reload this page to try again.';return;}PERSONAL_RESEARCH=window.FRPersonalResearch.mount($("#personalResearchHost"));}else PERSONAL_RESEARCH.refresh();}
  else if(COLS.length)render();
}
$("#pinsBrowse").onclick=()=>personalView(false);$("#pinsPersonal").onclick=()=>personalView(true);
document.addEventListener('DOMContentLoaded',()=>{if(new URLSearchParams(location.search).get('view')==='research')personalView(true);});
function reloadPersonalCollections(){try{const next=JSON.parse(localStorage.getItem('fr_collections_v1')||'[]');if(Array.isArray(next)&&next.length){COLS=next;ACTIVE=localStorage.getItem('fr_pincol')||COLS[0].id;if(!PERSONAL_OPEN)render();}}catch(_){$("#collectionStatus").textContent='The updated collection could not be read. Your saved data has not been changed.';}}
window.addEventListener('storage',event=>{if(event.key==='fr_collections_v1')reloadPersonalCollections();});
window.addEventListener('fr-research-saved',reloadPersonalCollections);
const b64e=o=>btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const b64d=s=>{try{return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g,"+").replace(/_/g,"/")))));}catch(e){return null;}};
// ── excerpt hydration (meta→shard→page, cached) ──
const _exc={};
async function excerpt(slug,page){
  const k=slug+"|"+page;if(k in _exc)return _exc[k];
  try{
    const meta=await fetch(BLOB+"/v1/works/"+slug+"/meta.json"+VER).then(r=>r.json());
    const f=meta.single?"work.json":((meta.shards||[]).find(s=>s.from<=page&&page<=s.to)||{}).file;
    if(!f)return _exc[k]=null;
    const d=await fetch(BLOB+"/v1/works/"+slug+"/"+f+VER).then(r=>r.json());
    const pg=(d.pages||[]).find(x=>x.n===page);
    const tx=(pg&&(pg.en||pg.la)||"").replace(/\[\^[^\]]*\]:?/g,"").replace(/[#*]+/g,"").replace(/\s+/g," ").trim();
    return _exc[k]=tx?tx.slice(0,220):null;
  }catch(e){return _exc[k]=null;}}
function hydrate(){[...document.querySelectorAll(".card[data-x]")].slice(0,24).forEach(a=>{
  const [s,p]=a.dataset.x.split("|");
  excerpt(s,+p).then(tx=>{if(tx&&!a.querySelector(".x"))a.insertAdjacentHTML("beforeend",'<span class=x>'+esc(tx)+'…</span>');});});}
// unified cross-corpus scheme: items may carry site fr|pld|po (absent = fr).
const SITES={fr:{name:"The Faith Received",url:(s,p)=>"/the-faith-received/read/?w="+encodeURIComponent(s)+"#b"+p+"-0"},
  pld:{name:"Patrologia Latina",url:(s,p)=>"https://pld-patrologia-latina.vercel.app/read/"+s+".html#b"+p},
  po:{name:"Patrologia Orientalis",url:(s,p)=>"https://patrologia-orientalis.vercel.app/read/"+s+".html#b"+p},
  pg:{name:"Patrologia Graeca",url:(s,p)=>"https://patrologia-graeca.vercel.app/read/"+s+".html#c"+p},
  aq:{name:"Aquinas Studies",url:(s,p)=>"https://aquinas-studies.vercel.app/read/"+s+".html#b"+p}};
const ikey=it=>notebookTools().itemKey(it);
function mvBtns(k,index){const act=COLS.find(c=>c.id===ACTIVE);if(act&&act.sort==="author")return '';return '<button class=mv data-mv="'+esc(k)+'" data-item-index="'+index+'" data-d="-1" title="Move up">&#8593;</button><button class=mv data-mv="'+esc(k)+'" data-item-index="'+index+'" data-d="1" title="Move down">&#8595;</button>';}
function card(it,removable){
  const itemIndex=removable?(COLS.find(c=>c.id===ACTIVE)?.items||[]).indexOf(it):-1;
  if(it.type==="note"){
    return '<div class="card notecard" data-k="'+esc(ikey(it))+'"><span class=ntx>'+esc(it.text||"").replace(/\n/g,"<br>")+'</span>'
      +(it.research?'<details class="collection-research"><summary>Saved research details</summary>'+(window.FRPersonalResearch?.provenanceHTML?FRPersonalResearch.provenanceHTML(it.research):'')+'<details><summary>Complete saved metadata</summary><pre>'+esc(JSON.stringify(it.research,null,2))+'</pre></details></details>':'')
      +(removable?'<button class=nb data-note="'+esc(ikey(it))+'" data-item-index="'+itemIndex+'" title="Edit this note">✎</button><button class=rm data-rm="'+esc(ikey(it))+'" data-item-index="'+itemIndex+'" title="Remove">✕</button>'+mvBtns(ikey(it),itemIndex):'')+'</div>';}
  const site=it.site||"fr",S=SITES[site]||SITES.fr;
  const m=site==="fr"?((WIDX||{})[it.slug]||{}):{};
  const isWork=it.page==null;
  const en=site==="fr"?(TEN[it.slug]||""):"";
  const title=en||m.title||it.title||(site==="fr"?it.slug:S.name+" — "+it.slug);
  const latSub=(en&&m.title&&en!==m.title)?'<span class=lat>'+esc(m.title)+'</span>':"";
  const proposed=it.u||(isWork?(site==="fr"?"/the-faith-received/read/?w="+encodeURIComponent(it.slug):S.url(it.slug,1)):S.url(it.slug,it.page));
  let href='#';try{const u=new URL(proposed,location.origin);if(['https:','http:'].includes(u.protocol))href=u.href;}catch(_){}
  return '<a class="card" data-k="'+esc(ikey(it))+'" '+(site==="fr"&&!isWork?'data-x="'+esc(it.slug)+'|'+it.page+'" ':'')+'href="'+esc(href)+'"'+(site!=="fr"?' target=_blank':'')+'>'
    +'<span class=t>'+esc(title)+((m.tradition||it.tradition)?'<span class=rtrad>'+esc(m.tradition||it.tradition)+'</span>':'')+(site!=="fr"?'<span class=rtrad>'+esc(S.name)+'</span>':'')+(isWork?'<span class=rtrad>whole work</span>':'')+'</span>'
+latSub
        +'<span class=m>'+esc(m.author||it.author||"")+((m.author||it.author)?" · ":"")+(isWork?((m.n_pages||"?")+" pages"):(site!=="fr"&&/^(PL|PG|PO|AQ|Aquinas)/.test(it.title||"")?"the cited passage":"pg. "+it.page))+'</span>'
    +(it.label?'<span class=lbl>'+esc(String(it.label).replace(/^[§\s]+/,"").trim())+'&#8230;</span>':'')
    +(it.note?'<span class=nt>'+esc(it.note)+'</span>':'')
    +(removable?'<button class=nb data-note="'+esc(ikey(it))+'" data-item-index="'+itemIndex+'" title="Add or edit your note on this pin">✎</button><button class=rm data-rm="'+esc(ikey(it))+'" data-item-index="'+itemIndex+'" title="Remove">✕</button>'+mvBtns(ikey(it),itemIndex):'')+'</a>';}
function itemName(k,act){
  const resolved=notebookTools().resolveEndpoint(act,k),it=resolved&&(act.items||[]).find(i=>ikey(i)===resolved);if(!it)return 'Unresolved saved item';
  if(it.type==='note')return String(it.label||it.cite||it.text||'Note').slice(0,60);
  const m=(WIDX||{})[it.slug]||{};
  const en=(it.site||"fr")==="fr"?(TEN[it.slug]||""):"";
  return ((m.author?m.author+", ":"")+(en||m.title||it.slug)).slice(0,44)+(it.page!=null?" · "+it.page:"");}
function consHTML(act){
  const all=notebookTools().resolveEdges(act),E=all.filter(e=>e.resolved);if(!all.length)return "";
  const keys=[...new Set(E.flatMap(e=>[e.a,e.b]))];
  const W=640,H=Math.max(220,keys.length*34),cx=W/2,cy=H/2,R=Math.min(cx-150,cy-24);
  const pos={};keys.forEach((k,i)=>{const a=(2*Math.PI*i)/keys.length-Math.PI/2;
    pos[k]=[cx+R*Math.cos(a),cy+R*Math.sin(a)];});
  let svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Constellation of linked passages">';
  E.forEach(e=>{const[ax,ay]=pos[e.a],[bx,by]=pos[e.b];
    svg+='<line class=cl x1="'+ax+'" y1="'+ay+'" x2="'+bx+'" y2="'+by+'" stroke-width="1.4"/>'
       +'<text class=ce x="'+((ax+bx)/2)+'" y="'+((ay+by)/2-4)+'" font-size="10" text-anchor="middle" font-family="sans-serif">'+esc(e.rel)+'</text>';});
  keys.forEach(k=>{const[x,y]=pos[k];
    svg+='<circle class=cn cx="'+x+'" cy="'+y+'" r="5"/>'
       +'<text x="'+x+'" y="'+(y-10)+'" font-size="10.5" text-anchor="middle" font-family="Georgia,serif">'+esc(itemName(k,act))+'</text>';});
  svg+='</svg>';
  const rows=all.map(e=>'<div class=edge-row><span>'+esc(e.resolved?itemName(e.a,act):'Unresolved saved endpoint')+'</span><span class=rel>'+esc(e.rel)+'</span><span>'+esc(e.resolved?itemName(e.b,act):'Original relation retained')+'</span><button class=ex data-ei="'+e.index+'" title="Remove link">✕</button></div>').join("");
  return '<div class=cons><h2>Recorded relationships</h2>'+(E.length?svg:'')+(all.some(e=>!e.resolved)?'<p class="note">Some older endpoints are missing or ambiguous. Their original relations are retained; no connection has been guessed. Use Link two pins to record a new, explicit relation.</p>':'')+rows+'</div>';}
function authorOf(i){const site=i.site||"fr";
  if(site==="fr")return ((WIDX||{})[i.slug]||{}).author||"Unattributed";
  return i.author||(SITES[site]||{}).name||"Other corpora";}
function mdLine(i){const site=i.site||"fr";
  if(i.type==="note")return '## '+(i.label||i.cite||'Research note')+'\n\n'+(i.text||'')+(i.research?'\n\n'+(window.FRPersonalResearch?.provenanceMarkdown?FRPersonalResearch.provenanceMarkdown(i.research):'')+'\n\nComplete saved research metadata:\n\n```json\n'+JSON.stringify(i.research,null,2)+'\n```':'');
  let nm,url;
  if(site!=="fr"){const S=SITES[site]||{name:site,url:()=>"#"};const cit=/^(PL|PG|PO|AQ|Aquinas)/.test(i.title||"");
    nm=(i.title||S.name+" — "+i.slug)+(!cit&&i.page!=null?", col. "+i.page:"");url=i.u||S.url(i.slug,i.page||1);}
  else{const m=(WIDX||{})[i.slug]||{};const en=TEN[i.slug]||"";
    nm=(en||m.title||i.slug)+(i.page==null?"":", pg. "+i.page);
    url="https://thefaithreceived.vercel.app/read?w="+i.slug+(i.page==null?"":"%23b"+i.page+"-0");}
  return "- ["+nm.replace(/[\[\]]/g,"")+"]("+url+")"+(i.label?" — “"+String(i.label).replace(/^[§\s]+/,"").slice(0,110)+"…”":"")+(i.note?"\n  - "+i.note.replace(/\n+/g," "):"");}
function citations(items,name,memo,byAuthor){
  let out="# "+(name||"Research notebook")+"\n";
  if(memo)out+="\n> "+memo.replace(/\n+/g,"\n> ")+"\n";
  const notes=items.filter(i=>i.type==="note"),rest=items.filter(i=>i.type!=="note");
  if(notes.length)out+="\n## Notes\n\n"+notes.map(mdLine).join("\n\n")+"\n";
  if(byAuthor){
    const G={};rest.forEach(i=>{(G[authorOf(i)]=G[authorOf(i)]||[]).push(i);});
    Object.keys(G).sort().forEach(aut=>{out+="\n## "+aut+"\n\n"+G[aut].map(mdLine).join("\n")+"\n";});}
  else if(rest.length)out+="\n## Passages\n\n"+rest.map(mdLine).join("\n")+"\n";
  return out+"\n— assembled in The Faith Received · "+location.origin+"/pins\n";}
function listHTML(act){
  if(act.sort!=="author"){ // by kind (2026-09-10): works kept for later reading, then passages, then notes and research
    const works=act.items.filter(i=>i.type!=="note"&&i.page==null),pass=act.items.filter(i=>i.type!=="note"&&i.page!=null),notes=act.items.filter(i=>i.type==="note");
    const kinds=[["Works to read",works],["Passages",pass],["Notes and research",notes]].filter(([,l])=>l.length);
    if(kinds.length<2)return act.items.map(i=>card(i,true)).join("");
    return kinds.map(([t,l])=>'<h2 class=grp>'+t+'<span class=n>'+l.length+'</span></h2>'+l.map(i=>card(i,true)).join("")).join("");}
  const notes=act.items.filter(i=>i.type==="note"),rest=act.items.filter(i=>i.type!=="note");
  let h=notes.map(i=>card(i,true)).join("");
  const G={};rest.forEach(i=>{(G[authorOf(i)]=G[authorOf(i)]||[]).push(i);});
  Object.keys(G).sort().forEach(aut=>{h+='<h2 class=grp>'+esc(aut)+'<span class=n>'+G[aut].length+'</span></h2>'+G[aut].map(i=>card(i,true)).join("");});
  return h;}
function openNoteEditor(anchor,collection,edit){
  if(NOTE_EDITOR?.isConnected){NOTE_EDITOR.querySelector('textarea').focus();return;}
  const editor=document.createElement('form');editor.className='pins-note-editor';editor.dataset.before=edit.before;NOTE_EDITOR=editor;
  const title=edit.kind==='memo'?'Working notes':edit.kind==='new'?'New note':'Edit note';
  editor.innerHTML='<label>'+esc(title)+'<textarea aria-label="'+esc(title)+'" rows="6"></textarea></label><div class="pins-note-actions"><button type="submit" class="btn">Save note</button><button type="button" class="btn" data-cancel>Cancel editing</button><span role="status">Not saved yet</span></div>';
  anchor.after(editor);const input=editor.querySelector('textarea'),status=editor.querySelector('[role=status]'),submit=editor.querySelector('[type=submit]');input.value=edit.before;input.focus();
  const finish=()=>{NOTE_EDITOR=null;editor.remove();COLS=notebookTools().read().collections;render();};
  editor.querySelector('[data-cancel]').onclick=finish;
  editor.onsubmit=async event=>{event.preventDefault();if(submit.disabled)return;submit.disabled=true;status.textContent='Saving…';
    try{if(edit.kind==='new'){if(!input.value.trim()){status.textContent='Write a note before saving.';submit.disabled=false;return;}await notebookTools().save({type:'note',text:input.value},{collectionId:collection.id});}
      else await notebookTools().editNote(collection.id,{...edit,text:input.value});
      finish();$("#collectionStatus").textContent='Note saved in this notebook.';
    }catch(error){status.textContent=error.message||'Your note could not be saved. Your draft is still here.';submit.disabled=false;}};
  input.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key==='Enter'&&!event.isComposing){event.preventDefault();editor.requestSubmit();}});
}
window.addEventListener('beforeunload',event=>{if(NOTE_EDITOR?.isConnected&&NOTE_EDITOR.querySelector('textarea')?.value!==NOTE_EDITOR.dataset.before){event.preventDefault();event.returnValue='';}});
function render(){
  if(NOTE_EDITOR?.isConnected)return;
  const app=$("#app");
  if(SHARED){
    let shared;try{shared=notebookTools().decodeShared(SHARED);}catch(_){app.innerHTML='<p class="muted">This shared collection could not be read. No local records were changed.</p>';return;}
    const today=new Date().toISOString().slice(0,10),nEdges=(shared.edges||[]).length;
    app.innerHTML='<div class="shared-banner noprint">Shared collection: <b>'+esc(shared.name||'Untitled')+'</b> ('+shared.items.length+' saved records). '
      +'<button class="btn pri" id="saveCopy">Save a copy to my collections</button><button class="btn" id="citeColl">Copy collection citation</button><button class="btn" id="sharedDownload">Download full collection</button><button class="btn" id="printColl">Print collection</button></div>'
      +'<div class="ed-head"><h1>'+esc(shared.name||'Shared collection')+'</h1><div class="ed-meta">'+shared.items.length+' saved records'+(nEdges?' · '+nEdges+' recorded relations':'')+'</div></div>'
      +(shared.memo?'<div class="memo shared-memo">'+esc(shared.memo).replace(/\n/g,'<br>')+'</div>':'')
      +shared.items.map(item=>card(item,false)).join('')+consHTML(shared)
      +'<p class="note">Full notes, source inventories, and research metadata are retained. Download the collection file to keep the complete record.</p>';
    $('#citeColl').onclick=async function(){try{const url=SHARED_FROM_FILE?'':location.href;await navigator.clipboard.writeText('“'+(shared.name||'Shared collection')+'.” A research collection assembled in The Faith Received, '+today+'. '+shared.items.length+' saved records.'+(url?' '+url:' Imported collection file.'));this.textContent='Citation copied';}catch(_){$('#collectionStatus').textContent='The citation could not be copied. Download the full collection instead.';}};
    $('#printColl').onclick=()=>window.print();$('#sharedDownload').onclick=()=>downloadCollection(shared);
    $('#saveCopy').onclick=()=>{
      const copy={...shared,id:'c'+Date.now()+'-'+Math.random().toString(36).slice(2),name:(shared.name||'Shared')+' (copy)',...(shared.id?{sourceCollectionId:shared.id}:{})};
      COLS.push(copy);saveCols(COLS);location.hash='';SHARED=null;SHARED_FROM_FILE=false;ACTIVE=copy.id;localStorage.setItem('fr_pincol',ACTIVE);render();
    };
    hydrate();return;
  }
  const act=COLS.find(c=>c.id===ACTIVE)||COLS[0];ACTIVE=act.id;
  app.innerHTML='<h1>Research Portfolio</h1>'
    +'<div class=cols>'+COLS.map(c=>'<button class="col-tab'+(c.id===act.id?" on":"")+'" data-col="'+esc(c.id)+'">'+esc(c.name)+'<span class=n>'+c.items.length+'</span></button>').join("")
    +'<button class=col-tab id=newCol title="New research project">＋</button></div>'
    +'<button type="button" id="memoBox" class="memo" aria-label="Edit working notes">'
    +(act.memo?esc(act.memo).replace(/\n/g,"<br>"):'<span class=mmut>Write working notes for this notebook.</span>')+'</button>'
    +'<div class=bar>'
    +'<button class=btn id=addNote>Add note</button>'
    +'<button class=btn id=addWork>Add work</button>'
    +'<button class=btn id=shareBtn>Share collection</button>'
    +'<button class=btn id=downloadCol>Download full collection</button>'
    +'<button class=btn id=moreBtn title="More">⋯</button>'
    +'<span id=moreRow style="display:none">'
    +'<button class=btn id=copyBtn title="Copy the whole notebook as Markdown — memo, notes, linked passages">⧉ Markdown</button>'
    +'<button class=btn id=grpBtn></button>'
    +'<button class=btn id=linkBtn>⛓ Link two pins</button>'
    +'<button class=btn id=renameBtn>✎ Rename</button>'
    +(COLS.length>1?'<button class=btn id=delBtn>Delete project</button>':"")
    +'</span>'
    +'</div>'
    +'<div id="shareStatus" class="note" role="status"></div>'
    +(act.items.length?listHTML(act):'<div class=empty>Save a work or passage while reading, or add a note here. Your saved material stays together in this notebook.</div>')
    +consHTML(act)
    +'<p class=note>Pins live in this browser. “Share” encodes the collection into a link anyone can open; the active collection is where ★ pins land while you read. ⛓ Link two pins to record how passages relate — your constellation travels with the share link.</p>';
  document.querySelectorAll(".col-tab[data-col]").forEach(b=>b.onclick=()=>{ACTIVE=b.dataset.col;localStorage.setItem("fr_pincol",ACTIVE);saveCols(COLS);render();});
  $("#newCol").onclick=()=>{const n=prompt("Name the new collection:","New project");if(!n)return;
    const c={id:"c"+Date.now(),name:n.trim().slice(0,60),items:[]};COLS.push(c);ACTIVE=c.id;localStorage.setItem("fr_pincol",ACTIVE);saveCols(COLS);render();};
  $("#moreBtn").onclick=()=>{const r=$("#moreRow");r.style.display=r.style.display==="none"?"inline":"none";};
  const gb=$("#grpBtn");gb.textContent=act.sort==="author"?"⇅ My order":"⇅ By author";
  gb.title="Organize the notebook: your hand order, or grouped by author";
  gb.onclick=()=>{act.sort=act.sort==="author"?undefined:"author";saveCols(COLS);render();};
  $("#renameBtn").onclick=()=>{const n=prompt("Rename collection:",act.name);if(!n)return;act.name=n.trim().slice(0,60);saveCols(COLS);render();};
  const del=$("#delBtn");if(del)del.onclick=()=>{if(!confirm('Delete “'+act.name+'” and its '+act.items.length+' pins?'))return;
    COLS=COLS.filter(c=>c.id!==act.id);ACTIVE=COLS[0].id;localStorage.setItem("fr_pincol",ACTIVE);saveCols(COLS);render();};
  $("#shareBtn").onclick=()=>{
    try{const share=notebookTools().sharePlan(act,location.origin),status=$("#shareStatus");status.replaceChildren();
      if(share.kind==='file'){status.textContent='This complete collection is too large for a reliable share link. No notes or source records have been shortened. ';const download=document.createElement('button');download.type='button';download.className='btn';download.textContent='Download full collection';download.onclick=()=>downloadCollection(act);status.appendChild(download);return;}
      navigator.clipboard.writeText(share.url).then(()=>{status.textContent='Complete collection link copied, including full notes and research metadata.';}).catch(()=>{status.textContent='The link could not be copied. Download the full collection instead.';});
    }catch(e){$("#collectionStatus").textContent=e.message;}};
  $("#downloadCol").onclick=()=>downloadCollection(act);
  $("#copyBtn").onclick=()=>{navigator.clipboard.writeText(citations(act.items,act.name,act.memo,act.sort==="author")).then(()=>{
    $("#copyBtn").textContent="✓ copied";setTimeout(()=>{$("#copyBtn").textContent="⧉ Markdown";},1400);});};
  document.querySelectorAll(".rm").forEach(b=>b.onclick=ev=>{ev.preventDefault();ev.stopPropagation();
    const k=b.dataset.rm;
    notebookTools().removeCollectionItem(act,k,b.dataset.itemIndex);
    saveCols(COLS);render();});
  document.querySelectorAll(".nb").forEach(b=>b.onclick=ev=>{ev.preventDefault();ev.stopPropagation();
    const it=act.items[notebookTools().findItemIndex(act,b.dataset.note,b.dataset.itemIndex)];if(!it)return;
    openNoteEditor(b.closest('.card'),act,{kind:'item',key:b.dataset.note,index:b.dataset.itemIndex,before:it.type==='note'?(it.text||''):(it.note||'')});});
  document.querySelectorAll(".mv").forEach(b=>b.onclick=ev=>{ev.preventDefault();ev.stopPropagation();
    const k=b.dataset.mv,d=+b.dataset.d,ix=notebookTools().findItemIndex(act,k,b.dataset.itemIndex),j=ix+d;
    if(ix<0||j<0||j>=act.items.length)return;
    [act.items[ix],act.items[j]]=[act.items[j],act.items[ix]];saveCols(COLS);render();});
  $("#addNote").onclick=()=>openNoteEditor($("#memoBox"),act,{kind:'new',before:''});
  const mb=$("#memoBox");if(mb)mb.onclick=()=>openNoteEditor(mb,act,{kind:'memo',before:act.memo||''});
  $("#addWork").onclick=async()=>{
    const qy=prompt("Add a whole work — type part of its title or author:","");if(!qy)return;
    const needle=qy.toLowerCase();
    const hits=Object.values(WIDX||{}).filter(w=>((w.title||"")+" "+(w.author||"")).toLowerCase().includes(needle)).slice(0,9);
    if(!hits.length){alert("No matching work.");return;}
    const pick=hits.length===1?hits[0]:(()=>{
      const menu=hits.map((w,i)=>(i+1)+". "+(w.author?w.author+" — ":"")+w.title).join("\n");
      const n=prompt("Which one?\n"+menu,"1");const ix=(+n||1)-1;return hits[Math.max(0,Math.min(ix,hits.length-1))];})();
    if(!pick)return;
    try{await notebookTools().saveWork(pick,{collectionId:act.id});COLS=notebookTools().read().collections;render();}catch(error){$('#collectionStatus').textContent=error.message;}};
  let linkA=null;
  $("#linkBtn").onclick=()=>{
    const cards=[...document.querySelectorAll(".card[data-k]")];
    if(!cards.length)return;
    cards.forEach(c=>c.classList.add("linkable"));
    $("#linkBtn").textContent="… click the FIRST pin";
    const pick=ev=>{const c=ev.target.closest(".card[data-k]");if(!c)return;ev.preventDefault();ev.stopPropagation();
      if(!linkA){linkA=c.dataset.k;c.classList.add("linkA");$("#linkBtn").textContent="… now the SECOND pin";return;}
      const b=c.dataset.k;if(b===linkA){cleanup();return;}
      const rel=prompt("How does the first relate to the second?\nsupports · contests · cites · expands · parallels","parallels");
      if(rel){act.edges=act.edges||[];act.edges.push({a:linkA,b,rel:rel});saveCols(COLS);}
      cleanup();render();};
    const cleanup=()=>{document.removeEventListener("click",pick,true);cards.forEach(c=>{c.classList.remove("linkable","linkA");});linkA=null;$("#linkBtn").textContent="⛓ Link two pins";};
    document.addEventListener("click",pick,true);};
  document.querySelectorAll(".cons .ex").forEach(b=>b.onclick=()=>{
    act.edges.splice(+b.dataset.ei,1);saveCols(COLS);render();});
  hydrate();}
(async function(){
  // Notes are local. The catalogue enriches work cards after the notebook opens.
  try{COLS=loadCols();ACTIVE=localStorage.getItem("fr_pincol")||COLS[0].id;}catch(_){$("#app").innerHTML='<p class="muted">Saved collections could not be read. No stored data was changed.</p>';return;}
  if(!location.hash.startsWith('#c=')&&!new URLSearchParams(location.search).has('shared'))render();
  try{const [d,te]=await Promise.all([
      fetch(BLOB+"/v1/works-index.json"+VER).then(r=>r.json()),
      fetch(BLOB+"/v1/titles_en.json"+VER).then(r=>r.ok?r.json():{}).catch(()=>({}))]);
    WIDX={};(d.works||[]).forEach(w=>WIDX[w.slug]=w);TEN=te||{};}catch(e){WIDX={};TEN={};}
  try{COLS=loadCols();ACTIVE=localStorage.getItem("fr_pincol")||COLS[0].id;}catch(_){$('#collectionStatus').textContent='The updated collections could not be read. Your current draft is unchanged.';return;}
  const m=location.hash.match(/#c=([A-Za-z0-9_-]+)/);
  if(m){const sh=b64d(m[1]);if(validShared(sh))SHARED=sh;}
  // ?shared=<id> — a Firestore share from ANY of the three sites (common 'shared' collection,
  // one Firebase project). PLD/PO notebook shares render best-effort with cross-site deep-links.
  const sq=new URLSearchParams(location.search).get("shared");
  if(sq&&window.__FR_FB__&&window.__FR_FB__.apiKey){
    try{
      const [A,F]=await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js")]);
      const app=A.initializeApp(window.__FR_FB__),db=F.getFirestore(app);
      const snap=await F.getDoc(F.doc(db,"shared",sq));
      if(snap.exists()){
        const d=snap.data()||{};
        const items=[];
        if(Array.isArray(d.items))d.items.forEach(x=>items.push(x.length===3?x:["fr",x[0],x[1]]));
        else if(d.notes&&typeof d.notes==="object"){
          const corpus=d.corpus||"pld";
          Object.values(d.notes).forEach(n=>{
            const w=n.srcWork||n.work||n.w,b=n.block||n.b||n.anchor;
            if(w!=null&&b!=null)items.push([n.site||corpus,String(w),+b]);});}
        if(items.length)SHARED={n:(d.name||"Shared")+(d.ownerName?" — "+d.ownerName:""),i:items};
      }
    }catch(e){}
  }
  render();
  addEventListener("hashchange",()=>{const m2=location.hash.match(/#c=([A-Za-z0-9_-]+)/),shared=m2?b64d(m2[1]):null;SHARED=shared&&validShared(shared)?shared:null;SHARED_FROM_FILE=false;render();});
})();
