
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
let SHARED_FROM_FILE=false,NOTE_EDITOR=null,NAME_EDITOR=null;
const pinsRoute=new URLSearchParams(location.search);
let COLLECTION_QUERY=pinsRoute.get('q')||'',COLLECTION_KIND=pinsRoute.get('kind')||'',COLLECTION_PAGE=Math.max(0,(Number(pinsRoute.get('page'))||1)-1),LINK_CLEANUP=null;
const experience=()=>window.FRPinsExperience;
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
function reloadPersonalCollections(){try{const next=JSON.parse(localStorage.getItem('fr_collections_v1')||'[]');if(Array.isArray(next)&&next.length){COLS=next;ACTIVE=new URLSearchParams(location.search).get('notebook')||localStorage.getItem('fr_pincol')||COLS[0].id;if(!PERSONAL_OPEN)render();}}catch(_){$("#collectionStatus").textContent='The updated collection could not be read. Your saved data has not been changed.';}}
window.addEventListener('storage',event=>{if(event.key==='fr_collections_v1')reloadPersonalCollections();});
window.addEventListener('fr-research-saved',reloadPersonalCollections);
function pinsTheme(){const root=document.documentElement,current=root.dataset.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');$('#pinsTheme').setAttribute('aria-label','Switch to '+(current==='dark'?'light':'dark')+' theme');}
$('#pinsTheme').onclick=()=>{const root=document.documentElement,current=root.dataset.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');root.dataset.theme=current==='dark'?'light':'dark';localStorage.setItem('fr_theme',root.dataset.theme);pinsTheme();};pinsTheme();
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
// Every site opens in our reader (Stiven 2026-10-01: nothing on MereO touches Vercel): a source doc id maps onto our slug.
const aqSlug=x=>'aq-'+String(x||'').split('.html')[0].toLowerCase().replace(/_/g,'-');
const SITES={fr:{name:"The Faith Received",url:(s,p)=>"/the-faith-received/read/?w="+encodeURIComponent(s)+"#b"+p+"-0"},
  pld:{name:"Patrologia Latina",url:(s,p)=>SITES.fr.url("pld-"+s,p)},
  po:{name:"Patrologia Orientalis",url:(s,p)=>SITES.fr.url("po-"+s,p)},
  pg:{name:"Patrologia Graeca",url:(s,p)=>SITES.fr.url("pg-"+s,p)},
  aq:{name:"Aquinas Studies",url:(s,p)=>SITES.fr.url(aqSlug(s),p)}};
const ikey=it=>notebookTools().itemKey(it);
function mvBtns(k,index){const act=COLS.find(c=>c.id===ACTIVE);if(!act||act.sort||COLLECTION_QUERY||COLLECTION_KIND)return '';return '<button type="button" class="mv" data-mv="'+esc(k)+'" data-item-index="'+index+'" data-d="-1"'+(index===0?' disabled':'')+'>Move up</button><button type="button" class="mv" data-mv="'+esc(k)+'" data-item-index="'+index+'" data-d="1"'+(index===act.items.length-1?' disabled':'')+'>Move down</button>';}
function card(it,removable){
  const act=COLS.find(c=>c.id===ACTIVE),itemIndex=removable?(act?.items||[]).indexOf(it):-1,d=experience().describe(it,WIDX||{},TEN);
  const key=ikey(it),full=d.body.length>360,body=d.body?(full?'<p class="saved-preview">'+esc(d.body.slice(0,360))+'…</p><details class="saved-full"><summary>Read full saved text</summary><div>'+esc(d.body).replace(/\n/g,'<br>')+'</div></details><div class="saved-print">'+esc(d.body).replace(/\n/g,'<br>')+'</div>':'<div class="saved-text">'+esc(d.body).replace(/\n/g,'<br>')+'</div>'):'';
  const sourceList=d.sources.map(source=>{const url=experience().sourceURL(source),label=source.cite||[source.author,source.title||source.slug,source.page!=null?'Location '+source.page:''].filter(Boolean).join(', ');return '<li>'+(url?'<a href="'+esc(url)+'">'+esc(label||'Read source')+'</a>':esc(label||'Saved source'))+'</li>';}).join('');
  const analysis=it.research&&window.FRPersonalResearch?.provenanceHTML?FRPersonalResearch.provenanceHTML(it.research):'';
  return '<article class="card saved-item" data-k="'+esc(key)+'" data-item-index="'+itemIndex+'">'
    +'<div class="saved-kind">'+esc(d.kindLabel)+'</div><h2 class="t">'+esc(d.title)+'</h2>'
    +'<p class="m">'+esc([d.author&&(!d.location||!d.location.includes(d.author))?d.author:'',d.location].filter(Boolean).join(' · '))+'</p>'+body
    +(d.note?'<div class="saved-annotation"><strong>Your note</strong><p>'+esc(d.note).replace(/\n/g,'<br>')+'</p></div>':'')
    +(sourceList?'<details class="saved-sources"><summary>Sources ('+d.sources.length+')</summary><ul>'+sourceList+'</ul></details>':'')
    +(analysis?'<details class="saved-analysis"><summary>Analysis context</summary>'+analysis+'</details>':'')
    +'<div class="saved-actions">'+(d.href?'<a class="saved-open" href="'+esc(d.href)+'">'+esc(d.action)+'</a>':'')
    +(removable?'<a href="'+esc(experience().deskURL(act.id,it.id||key))+'">Use in Desk</a><button type="button" class="nb" data-note="'+esc(key)+'" data-item-index="'+itemIndex+'">'+(d.kind==='note'?'Edit note':'Annotate')+'</button>'
      +'<details class="saved-menu"><summary>More</summary><div>'+mvBtns(key,itemIndex)+'<button type="button" class="rm" data-rm="'+esc(key)+'" data-item-index="'+itemIndex+'">Remove item</button></div></details>':'')+'</div></article>';
}
function itemName(k,act){
  const resolved=notebookTools().resolveEndpoint(act,k),it=resolved&&(act.items||[]).find(i=>ikey(i)===resolved);if(!it)return 'Unresolved saved item';
  if(it.type==='note')return String(it.label||it.cite||it.text||'Note').slice(0,60);
  const m=(WIDX||{})[it.slug]||{};
  const en=(it.site||"fr")==="fr"?(TEN[it.slug]||""):"";
  return ((m.author?m.author+", ":"")+(en||m.title||it.slug)).slice(0,44)+(it.page!=null?" · "+it.page:"");}
function consHTML(act,removable=true){
  const all=notebookTools().resolveEdges(act);if(!all.length)return '<p class="note">No relationships recorded. Use Collection actions to link two saved items.</p>';
  const rows=all.map(e=>'<div class="edge-row"><span>'+esc(e.resolved?itemName(e.a,act):'Unresolved saved item')+'</span><span class="rel">'+esc(e.rel)+'</span><span>'+esc(e.resolved?itemName(e.b,act):'Original relation retained')+'</span>'+(removable?'<button class="ex" data-ei="'+e.index+'" aria-label="Remove this relationship">Remove</button>':'')+'</div>').join('');
  return '<div class="cons">'+rows+(all.some(e=>!e.resolved)?''+(window.TFRMethod?window.TFRMethod.html('<p class="note">Some older endpoints are missing or ambiguous. Their original relations are retained.</p>'):'<p class="note">Some older endpoints are missing or ambiguous. Their original relations are retained.</p>'):'')+'</div>';
}
function authorOf(i){const site=i.site||"fr";
  if(site==="fr")return ((WIDX||{})[i.slug]||{}).author||i.author||"Unattributed";
  return i.author||(SITES[site]||{}).name||"Other corpora";}
function mdLine(item){return experience().markdown(item,WIDX||{},TEN)+(item.research&&window.FRPersonalResearch?.provenanceMarkdown?'\n\n'+FRPersonalResearch.provenanceMarkdown(item.research):'');}
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
  const filtered=act.items.filter(item=>(!COLLECTION_KIND||experience().kind(item)===COLLECTION_KIND)&&experience().matches(item,COLLECTION_QUERY,WIDX||{},TEN));
  if(act.sort==='author')filtered.sort((a,b)=>authorOf(a).localeCompare(authorOf(b)));
  if(act.sort==='type')filtered.sort((a,b)=>experience().kindLabel(experience().kind(a)).localeCompare(experience().kindLabel(experience().kind(b))));
  const pages=Math.ceil(filtered.length/24);COLLECTION_PAGE=Math.max(0,Math.min(COLLECTION_PAGE,Math.max(0,pages-1)));
  const shown=filtered.slice(COLLECTION_PAGE*24,COLLECTION_PAGE*24+24);
  return {html:shown.map(i=>card(i,true)).join('')||'<div class="empty">'+(act.items.length?'No saved items match these filters.':'Save a work, bookmark a reading place, or clip a passage from the reader. You can also write a note here.')+'</div>',total:filtered.length,pages};
}
function renderList(){
  if(LINK_CLEANUP)LINK_CLEANUP();
  const act=COLS.find(c=>c.id===ACTIVE);if(!act||!$('#collectionList'))return;
  const result=listHTML(act),address=new URL(location.href);for(const [key,value] of [['q',COLLECTION_QUERY],['kind',COLLECTION_KIND],['page',COLLECTION_PAGE?String(COLLECTION_PAGE+1):'']]){if(value)address.searchParams.set(key,value);else address.searchParams.delete(key);}history.replaceState(history.state,'',address);$('#collectionList').innerHTML=result.html;$('#collectionList').scrollTop=0;
  $('#pinsResultCount').textContent=result.total+' saved '+(result.total===1?'item':'items');
  $('#pinsPrevious').disabled=COLLECTION_PAGE===0;$('#pinsNext').disabled=(COLLECTION_PAGE+1)>=result.pages;
  $('#pinsPage').textContent=result.pages?'Page '+(COLLECTION_PAGE+1)+' of '+result.pages:'';$('#pinsPages').hidden=result.pages<2;bindSavedActions(act);
}
function bindSavedActions(act){
  $("#collectionList").querySelectorAll(".rm").forEach(b=>b.onclick=ev=>{ev.preventDefault();ev.stopPropagation();
    const k=b.dataset.rm;
    notebookTools().removeCollectionItem(act,k,b.dataset.itemIndex);
    saveCols(COLS);render();});
  $("#collectionList").querySelectorAll(".nb").forEach(b=>b.onclick=ev=>{ev.preventDefault();ev.stopPropagation();
    const it=act.items[notebookTools().findItemIndex(act,b.dataset.note,b.dataset.itemIndex)];if(!it)return;
    openNoteEditor(b.closest('.card'),act,{kind:'item',key:b.dataset.note,index:b.dataset.itemIndex,field:experience().kind(it)==='note'?'text':'note',before:experience().kind(it)==='note'?(it.text||''):(it.note||'')});});
  $("#collectionList").querySelectorAll(".mv").forEach(b=>b.onclick=ev=>{ev.preventDefault();ev.stopPropagation();
    const k=b.dataset.mv,d=+b.dataset.d,ix=notebookTools().findItemIndex(act,k,b.dataset.itemIndex),j=ix+d;
    if(ix<0||j<0||j>=act.items.length)return;
    [act.items[ix],act.items[j]]=[act.items[j],act.items[ix]];saveCols(COLS);render();});
}
function openRelationshipEditor(collection){
  if(NOTE_EDITOR?.isConnected){NOTE_EDITOR.querySelector('textarea').focus();return;}
  const existing=$('#pinsRelationship');if(existing){existing.querySelector('select').focus();return;}
  if(collection.items.length<2){$('#collectionStatus').textContent='Save at least two items before linking them.';return;}
  const form=document.createElement('form');form.id='pinsRelationship';form.className='pins-work-search';
  const options=collection.items.map((item,i)=>{const d=experience().describe(item,WIDX||{},TEN);return '<option value="'+esc(ikey(item))+'">'+esc((i+1)+'. '+d.title+(d.location?' · '+d.location:'')+' ('+d.kindLabel+')')+'</option>';}).join('');
  form.innerHTML='<h2>Link saved items</h2><label>First item<select name="first" aria-label="First item">'+options+'</select></label><label>Relationship<input name="relation" value="parallels" maxlength="100" required></label><label>Second item<select name="second" aria-label="Second item">'+options+'</select></label><p role="status">Record your relationship between the selected items.</p><div class="pins-note-actions"><button type="submit" class="btn">Save relationship</button><button type="button" class="btn" data-link-cancel>Cancel linking</button></div>';
  $('.bar').after(form);form.elements.second.selectedIndex=1;form.querySelector('[data-link-cancel]').onclick=()=>{form.remove();$('#linkBtn').focus();};
  form.onsubmit=event=>{event.preventDefault();const a=form.elements.first.value,b=form.elements.second.value,rel=form.elements.relation.value.trim();if(a===b||!rel){form.querySelector('[role=status]').textContent='Choose two different items and describe their relationship.';return;}
    collection.edges=collection.edges||[];if(!collection.edges.some(e=>e.a===a&&e.b===b&&e.rel===rel))collection.edges.push({a,b,rel});try{saveCols(COLS);form.remove();render();$('#collectionStatus').textContent='Relationship saved.';}catch(error){form.querySelector('[role=status]').textContent=error.message;}};
  form.querySelector('select').focus();
}
function openCollectionEditor(collection){
  if(NOTE_EDITOR?.isConnected){NOTE_EDITOR.querySelector('textarea').focus();return;}
  if(NAME_EDITOR?.isConnected){NAME_EDITOR.querySelector('input').focus();return;}
  const form=document.createElement('form');form.className='pins-work-search';form.id='pinsCollectionEditor';form.dataset.before=collection?.name||'';NAME_EDITOR=form;
  const label=collection?'Rename collection':'New collection';form.innerHTML='<h2>'+label+'</h2><label for="pinsCollectionName">Collection name</label><input id="pinsCollectionName" type="text" required maxlength="60" autocomplete="off"><div class="pins-note-actions"><button type="submit" class="btn">'+(collection?'Save name':'Create collection')+'</button><button type="button" class="btn" data-name-cancel>Cancel</button><span role="status"></span></div>';
  $('.cols').after(form);const input=form.querySelector('input'),status=form.querySelector('[role=status]'),button=form.querySelector('[type=submit]');input.value=form.dataset.before;
  const finish=()=>{NAME_EDITOR=null;form.remove();COLS=notebookTools().read().collections;render();$('#newCol')?.focus();};form.querySelector('[data-name-cancel]').onclick=finish;
  form.onsubmit=async event=>{event.preventDefault();const name=input.value.trim();if(!name){status.textContent='Enter a collection name.';return;}button.disabled=true;
    try{if(collection){const fresh=notebookTools().read().collections,target=fresh.find(c=>c.id===collection.id);if(!target||target.name!==form.dataset.before)throw Error('This collection changed in another view. Your proposed name is kept.');target.name=name;saveCols(fresh);}else{const result=await notebookTools().createCollection(name);COLS=notebookTools().read().collections;ACTIVE=result.id;COLLECTION_QUERY='';COLLECTION_KIND='';COLLECTION_PAGE=0;}finish();$('#collectionStatus').textContent=collection?'Collection renamed.':'Collection created. New saves will go here.';}
    catch(error){status.textContent=error.message;button.disabled=false;}};input.focus();input.select();
}
function openWorkSearch(collection){
  if(NOTE_EDITOR?.isConnected){NOTE_EDITOR.querySelector('textarea').focus();return;}
  const existing=$('#pinsWorkSearch');if(existing){existing.querySelector('input').focus();return;}
  const form=document.createElement('form');form.id='pinsWorkSearch';form.className='pins-work-search';
  form.innerHTML='<label for="pinsWorkQuery">Find a work to save</label><div class="pins-work-query"><input id="pinsWorkQuery" type="search" placeholder="Author or title" autocomplete="off"><button type="button" class="btn" data-work-close>Close search</button></div><p data-work-status role="status"></p><div class="pins-work-results"></div>';
  $('#memoBox').after(form);const input=form.querySelector('input'),status=form.querySelector('[role=status]'),results=form.querySelector('.pins-work-results');let limit=12;
  form.onsubmit=event=>event.preventDefault();form.querySelector('[data-work-close]').onclick=()=>{form.remove();render();$('#addWork').focus();};
  const search=()=>{const words=input.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);results.replaceChildren();
    if(!words.length){status.textContent='Search by author, title, or a few words from each.';return;}
    if(!WIDX){status.textContent='The work catalogue is still loading. Try again shortly.';return;}
    const hits=Object.values(WIDX).filter(w=>words.every(word=>[w.author,w.title,TEN[w.slug]].join(' ').toLocaleLowerCase().includes(word)));
    status.textContent=hits.length?Math.min(limit,hits.length)+' of '+hits.length+' matching works':'No works match this search.';
    for(const work of hits.slice(0,limit)){const row=document.createElement('div');row.className='pins-work-result';const label=document.createElement('div');label.textContent=[work.author,TEN[work.slug]||work.title].filter(Boolean).join(' · ');const save=document.createElement('button');save.type='button';save.className='btn';const already=(COLS.find(c=>c.id===collection.id)?.items||[]).some(i=>i.slug===work.slug&&i.page==null&&i.type!=='note');save.textContent=already?'Saved':'Save work';save.disabled=already;
      save.onclick=async()=>{save.disabled=true;try{const r=await notebookTools().saveWork(work,{collectionId:collection.id});status.textContent=(r.created?'Saved in ':'Already in ')+r.collectionName+'.';save.textContent='Saved';COLS=notebookTools().read().collections;renderList();}catch(error){status.textContent=error.message;save.disabled=false;}};row.append(label,save);results.appendChild(row);}
    if(hits.length>limit){const more=document.createElement('button');more.type='button';more.className='btn';more.textContent='Show more matches';more.onclick=()=>{limit+=12;search();};results.appendChild(more);}};
  input.oninput=()=>{limit=12;search();};input.addEventListener('keydown',event=>{if(event.key==='Escape'){form.remove();render();$('#addWork').focus();}});form.addEventListener('refresh',search);const refresh=()=>{if(form.isConnected)search();else document.removeEventListener('pins-refresh-work-search',refresh);};document.addEventListener('pins-refresh-work-search',refresh);search();input.focus();
}
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
window.addEventListener('beforeunload',event=>{if(NOTE_EDITOR?.isConnected&&NOTE_EDITOR.querySelector('textarea')?.value!==NOTE_EDITOR.dataset.before||NAME_EDITOR?.isConnected&&NAME_EDITOR.querySelector('input')?.value!==NAME_EDITOR.dataset.before){event.preventDefault();event.returnValue='';}});
function render(){
  if(NOTE_EDITOR?.isConnected||NAME_EDITOR?.isConnected)return;
  if($("#pinsRelationship"))return;
  if($("#pinsWorkSearch")){document.dispatchEvent(new Event("pins-refresh-work-search"));return;}
  if(LINK_CLEANUP)LINK_CLEANUP();
  const app=$("#app");
  if(SHARED){
    let shared;try{shared=notebookTools().decodeShared(SHARED);}catch(_){app.innerHTML='<p class="muted">This shared collection could not be read. No local records were changed.</p>';return;}
    const today=new Date().toISOString().slice(0,10),nEdges=(shared.edges||[]).length;
    app.innerHTML='<div class="shared-banner noprint">Shared collection: <b>'+esc(shared.name||'Untitled')+'</b> ('+shared.items.length+' saved records). '
      +'<button class="btn pri" id="saveCopy">Save a copy to my collections</button><button class="btn" id="citeColl">Copy collection citation</button><button class="btn" id="sharedDownload">Download full collection</button><button class="btn" id="printColl">Print collection</button><button class="btn" id="closeShared">Close shared collection</button></div>'
      +'<div class="ed-head"><h1>'+esc(shared.name||'Shared collection')+'</h1><div class="ed-meta">'+shared.items.length+' saved records'+(nEdges?' · '+nEdges+' recorded relations':'')+'</div></div>'
      +(shared.memo?'<div class="memo shared-memo">'+esc(shared.memo).replace(/\n/g,'<br>')+'</div>':'')
      +'<section class="pins-list" aria-label="Shared saved items">'+shared.items.map(item=>card(item,false)).join('')+'</section>'+consHTML(shared,false)
      +'<p class="note">Full notes, source inventories, and research metadata are retained. Download the collection file to keep the complete record.</p>';
    $('#citeColl').onclick=async function(){try{const url=SHARED_FROM_FILE?'':location.href;await navigator.clipboard.writeText('“'+(shared.name||'Shared collection')+'.” A research collection assembled in The Faith Received, '+today+'. '+shared.items.length+' saved records.'+(url?' '+url:' Imported collection file.'));this.textContent='Citation copied';}catch(_){$('#collectionStatus').textContent='The citation could not be copied. Download the full collection instead.';}};
    $('#closeShared').onclick=()=>{SHARED=null;SHARED_FROM_FILE=false;const url=new URL(location.href);url.hash='';url.searchParams.delete('shared');history.replaceState(null,'',url);render();$('#collectionStatus').textContent='Shared collection closed. Your collections are unchanged.';};
    $('#printColl').onclick=()=>window.print();$('#sharedDownload').onclick=()=>downloadCollection(shared);
    $('#saveCopy').onclick=()=>{
      const copy={...shared,id:'c'+Date.now()+'-'+Math.random().toString(36).slice(2),name:(shared.name||'Shared')+' (copy)',...(shared.id?{sourceCollectionId:shared.id}:{})};
      try{const next=[...COLS,copy];saveCols(next);COLS=next;location.hash='';SHARED=null;SHARED_FROM_FILE=false;ACTIVE=copy.id;notebookTools().selectCollection(ACTIVE);render();$('#collectionStatus').textContent='Saved a copy to '+copy.name+'.';}catch(error){$('#collectionStatus').textContent='The collection could not be saved. '+(error.message||'Try downloading a copy.');}
    };
    hydrate();return;
  }
  const act=COLS.find(c=>c.id===ACTIVE)||COLS[0];ACTIVE=act.id;notebookTools().selectCollection(ACTIVE);const address=new URL(location.href);address.searchParams.set('notebook',ACTIVE);history.replaceState(history.state,'',address);
  app.innerHTML='<h1>Notebook</h1><p class="pins-intro">Keep sources together, return to your reading, and bring selected material into Desk.</p>'
    +'<div class=cols>'+COLS.map(c=>'<button class="col-tab'+(c.id===act.id?" on":"")+'" data-col="'+esc(c.id)+'">'+esc(c.name)+'<span class=n>'+c.items.length+'</span></button>').join("")
    +'<button class=col-tab id=newCol>New collection</button></div>'
    +'<button type="button" id="memoBox" class="memo" aria-label="Edit working notes">'
    +(act.memo?esc(act.memo).replace(/\n/g,"<br>"):'<span class=mmut>Write working notes for this notebook.</span>')+'</button>'
    +'<div class=bar>'
    +'<button class=btn id=addNote>Add note</button>'
    +'<button class=btn id=addWork>Add work</button>'
    +'<button class=btn id=shareBtn>Share collection</button>'
    +'<button class=btn id=downloadCol>Download full collection</button>'
    +'<button class=btn id=moreBtn aria-expanded="false" aria-controls="moreRow">Collection actions</button>'
    +'<span id=moreRow style="display:none">'
    +'<button class=btn id=copyBtn title="Copy the whole notebook as Markdown — memo, notes, linked passages">Copy Markdown</button>'
    +'<button class=btn id=grpBtn></button>'
    +'<button class=btn id=linkBtn>Link two items</button>'
    +'<button class=btn id=renameBtn>Rename collection</button>'
    +(COLS.length>1?'<button class=btn id=delBtn>Delete collection</button>':"")
    +'</span>'
    +'</div>'
    +'<div id="shareStatus" class="note" role="status"></div>'
    +'<div class="pins-filters"><label>Find saved items<input id="pinsQuery" type="search" placeholder="Title, author, passage, or note" value="'+esc(COLLECTION_QUERY)+'"></label><label>Type<select id="pinsKind"><option value="">All types</option>'+[...new Set(act.items.map(i=>experience().kind(i)))].map(k=>'<option value="'+esc(k)+'"'+(k===COLLECTION_KIND?' selected':'')+'>'+esc(experience().kindLabel(k))+'</option>').join('')+'</select></label><label>Order<select id="pinsOrder"><option value="">Saved order</option><option value="author"'+(act.sort==='author'?' selected':'')+'>Author</option><option value="type"'+(act.sort==='type'?' selected':'')+'>Type</option></select></label></div><p id="pinsResultCount" role="status"></p><section id="collectionList" class="pins-list" aria-label="Saved items" tabindex="0"></section><nav id="pinsPages" aria-label="Saved item pages"><button class="btn" id="pinsPrevious">Previous items</button><span id="pinsPage"></span><button class="btn" id="pinsNext">Next items</button></nav>'
    +'<details class="pins-relations"><summary>Recorded relationships ('+(act.edges||[]).length+')</summary>'+consHTML(act)+'</details>'
    +'<p class="note">New reader and Ask saves go into the selected collection. <button type="button" class="pins-text-button" id="openAllResearch">All saved research</button> also includes unfiled highlights, reader notes, and Ask conversations. Download a collection to keep a portable copy.</p>';
  document.querySelectorAll(".col-tab[data-col]").forEach(b=>b.onclick=()=>{ACTIVE=b.dataset.col;COLLECTION_QUERY="";COLLECTION_KIND="";COLLECTION_PAGE=0;notebookTools().selectCollection(ACTIVE);const url=new URL(location.href);url.searchParams.set("notebook",ACTIVE);history.replaceState(null,"",url);render();});
  $('#newCol').onclick=()=>openCollectionEditor();
  $("#moreBtn").onclick=()=>{const r=$("#moreRow");r.style.display=r.style.display==="none"?"inline-flex":"none";$("#moreBtn").setAttribute("aria-expanded",String(r.style.display!=="none"));};
  const gb=$("#grpBtn");gb.textContent=act.sort==="author"?"⇅ My order":"⇅ By author";
  gb.title="Organize the notebook: your hand order, or grouped by author";
  gb.onclick=()=>{act.sort=act.sort==="author"?undefined:"author";saveCols(COLS);render();};
  $('#renameBtn').onclick=()=>openCollectionEditor(act);
  const del=$("#delBtn");if(del)del.onclick=()=>{if(!confirm('Delete “'+act.name+'” and its '+act.items.length+' pins?'))return;
    COLS=COLS.filter(c=>c.id!==act.id);ACTIVE=COLS[0].id;localStorage.setItem("fr_pincol",ACTIVE);saveCols(COLS);render();};
  $("#shareBtn").onclick=()=>{
    try{const share=notebookTools().sharePlan(act,location.origin),status=$("#shareStatus");status.replaceChildren();
      if(share.kind==='file'){status.textContent='This complete collection is too large for a reliable share link. No notes or source records have been shortened. ';const download=document.createElement('button');download.type='button';download.className='btn';download.textContent='Download full collection';download.onclick=()=>downloadCollection(act);status.appendChild(download);return;}
      navigator.clipboard.writeText(share.url).then(()=>{status.textContent='Complete collection link copied, including full notes and research metadata.';}).catch(()=>{status.textContent='The link could not be copied. Download the full collection instead.';});
    }catch(e){$("#collectionStatus").textContent=e.message;}};
  $("#downloadCol").onclick=()=>downloadCollection(act);
  $("#copyBtn").onclick=()=>{navigator.clipboard.writeText(citations(act.items,act.name,act.memo,act.sort==="author")).then(()=>{
    $("#copyBtn").textContent="✓ copied";setTimeout(()=>{$("#copyBtn").textContent="Copy Markdown";},1400);});};
  $("#addNote").onclick=()=>openNoteEditor($("#memoBox"),act,{kind:'new',before:''});
  const mb=$("#memoBox");if(mb)mb.onclick=()=>openNoteEditor(mb,act,{kind:'memo',before:act.memo||''});
  $('#addWork').onclick=()=>openWorkSearch(act);
  $('#pinsQuery').oninput=()=>{COLLECTION_QUERY=$('#pinsQuery').value;COLLECTION_PAGE=0;renderList();};
  $('#pinsKind').onchange=()=>{COLLECTION_KIND=$('#pinsKind').value;COLLECTION_PAGE=0;renderList();};
  $('#pinsOrder').onchange=()=>{act.sort=$('#pinsOrder').value||undefined;COLLECTION_PAGE=0;saveCols(COLS);renderList();};
  $('#pinsPrevious').onclick=()=>{COLLECTION_PAGE--;renderList();};$('#pinsNext').onclick=()=>{COLLECTION_PAGE++;renderList();};
  $('#openAllResearch').onclick=()=>personalView(true);
  $('#pinsDesk').href=experience().deskURL(act.id);
  $('#linkBtn').onclick=()=>openRelationshipEditor(act);
  document.querySelectorAll(".cons .ex").forEach(b=>b.onclick=()=>{
    act.edges.splice(+b.dataset.ei,1);saveCols(COLS);render();});
  renderList();}
(async function(){
  // Notes are local. The catalogue enriches work cards after the notebook opens.
  try{COLS=loadCols();ACTIVE=new URLSearchParams(location.search).get("notebook")||localStorage.getItem("fr_pincol")||COLS[0].id;}catch(_){$("#app").innerHTML='<p class="muted">Saved collections could not be read. No stored data was changed.</p>';return;}
  if(!location.hash.startsWith('#c=')&&!new URLSearchParams(location.search).has('shared'))render();
  try{const [d,te]=await Promise.all([
      fetch(BLOB+"/v1/works-index.json"+VER).then(r=>r.json()),
      fetch(BLOB+"/v1/titles_en.json"+VER).then(r=>r.ok?r.json():{}).catch(()=>({}))]);
    WIDX={};(d.works||[]).forEach(w=>WIDX[w.slug]=w);TEN=te||{};}catch(e){WIDX={};TEN={};}
  try{COLS=loadCols();ACTIVE=new URLSearchParams(location.search).get("notebook")||localStorage.getItem("fr_pincol")||COLS[0].id;}catch(_){$('#collectionStatus').textContent='The updated collections could not be read. Your current draft is unchanged.';return;}
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
