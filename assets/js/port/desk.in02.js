
(function(){
"use strict";
var $=function(s){return document.querySelector(s);};
function esc(s){var d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML;}
function lj(k){try{return JSON.parse(localStorage.getItem(k))||{};}catch(e){return {};}}

/* Document store: fr_docs {v:1,docs:[{id,ts,title,html}]}; no implicit eviction. */
function docsAll(){try{var d=JSON.parse(localStorage.getItem('fr_docs'))||{};return Array.isArray(d.docs)?d.docs:[];}catch(e){return [];}}
function docsPut(list){try{var raw=localStorage.getItem('fr_docs'),previous=raw?JSON.parse(raw):{v:1,docs:[]};if(!previous||!Array.isArray(previous.docs))throw Error('Invalid document store');localStorage.setItem('fr_docs',JSON.stringify(Object.assign({},previous,{v:previous.v||1,docs:list})));$('#deskSaveState').textContent='Saved in this browser';return true;}catch(e){$('#deskSaveState').textContent='This document could not be saved. Existing saved documents were not overwritten. Download a copy before closing Desk.';return false;}}
var CUR=null,savedRange=null,docDirty=false,writeScroll=0,researchScroll=0,railLimit=24;
function workflow(){return window.FRDeskWorkflow;}
function notebook(){return window.FRResearchNotebook;}
function paperNotebook(){return CUR&&CUR.notebookId||notebook().read().activeId;}
function contextStatus(text){$('#deskContextStatus').textContent=text;}
function saveCur(){if(!CUR||!docDirty)return true;
  var list=docsAll();
  CUR.title=$('#dTitle').value.trim()||'Untitled paper';
  CUR.html=$('#ed').innerHTML;
  CUR.ts=Date.now();
  if(!docsPut([CUR].concat(list.filter(function(d){return d.id!==CUR.id;}))))return false;
  docDirty=false;renderDocs();return true;}
var _sv;function autosave(){docDirty=true;clearTimeout(_sv);_sv=setTimeout(saveCur,600);wcUpdate();}
function openDoc(id){
  clearTimeout(_sv);if(CUR&&!saveCur())return false;savedRange=null;var d=docsAll().filter(function(x){return x.id===id;})[0];
  if(!d)return false;
  CUR=d;docDirty=false;contextStatus('');$('#dTitle').value=d.title==='Untitled paper'?'':d.title;$('#ed').innerHTML=d.html||'';
  renderDocs();wcUpdate();syncWorkspace();if(personalResearch)personalResearch.setCollection(paperNotebook());
  closePanels();return true;}
function newDoc(){
  clearTimeout(_sv);if(CUR&&!saveCur())return;savedRange=null;var next={id:'d'+Date.now()+'-'+Math.random().toString(36).slice(2),ts:Date.now(),title:'Untitled paper',html:''};
  if(!docsPut([next].concat(docsAll())))return;CUR=next;docDirty=false;
  $('#dTitle').value='';$('#ed').innerHTML='';renderDocs();wcUpdate();syncWorkspace();
  closePanels();$('#dTitle').focus();}
function renderDocs(){
  var list=docsAll();
  $('#docList').innerHTML=list.map(function(d){
    return '<button class="doc-row'+(CUR&&d.id===CUR.id?' on':'')+'" data-id="'+esc(d.id)+'">'
      +'<span class="doc-del" data-del="'+esc(d.id)+'" title="Delete this document">✕</span>'
      +'<span class="t">'+esc(d.title||'Untitled paper')+'</span>'
      +'<span class="m">'+new Date(d.ts).toLocaleDateString()+'</span></button>';}).join('')
    ||'<div class="rl-empty">Papers you write collect here, saved on this device.</div>';
  Array.prototype.forEach.call(document.querySelectorAll('.doc-row'),function(r){
    r.onclick=function(e){
      var del=e.target.getAttribute&&e.target.getAttribute('data-del');
      if(del){if(confirm('Delete this document?')){docsPut(docsAll().filter(function(d){return d.id!==del;}));if(CUR&&CUR.id===del){CUR=null;$('#ed').innerHTML='';$('#dTitle').value='';}renderDocs();}return;}
      openDoc(r.getAttribute('data-id'));};});}
function wcUpdate(){var t=$('#ed').textContent.trim();$('#wc').textContent=t?t.split(/\s+/).length.toLocaleString()+' words':'';}

/* ── toolbar ── */
Array.prototype.forEach.call(document.querySelectorAll('#toolbar button'),function(b){
  b.onmousedown=function(e){e.preventDefault();};
  b.onclick=function(){document.execCommand(b.getAttribute('data-c'),false,b.getAttribute('data-v')||null);$('#ed').focus();autosave();};});
$('#ed').addEventListener('input',autosave);
$('#dTitle').addEventListener('input',autosave);
// Flush the current paper before following a site-home link.
document.addEventListener('click',function(e){var link=e.target.closest&&e.target.closest('a[data-fr-home]');if(!link||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;clearTimeout(_sv);if(!saveCur()){e.preventDefault();closePanels();}});

/* ── research rail: ask · notes · answers · conversations, each inserted WITH citation ── */
var TAB='notes';
var AK={q:'',a:'',src:[],busy:false};
function akMd(t){
  var h=esc(t)
    .replace(/\[([a-z0-9-]{4,})\/p(\d+)\]/g,function(_,s2,p2){
      return '<a href="/the-faith-received/read/?w='+s2+'#b'+p2+'-0" target="_blank">['+s2.split('-').slice(0,2).join('-')+' p.'+p2+']</a>';})
    .replace(/^#{2,4}\s*(.+)$/gm,'<h3>$1</h3>')
    .replace(/\*\*([^*\n]+)\*\*/g,'<b>$1</b>').replace(/\*([^*\n]+)\*/g,'<i>$1</i>');
  return '<p>'+h.replace(/\n{2,}/g,'</p><p>').replace(/\n/g,'<br>')+'</p>';}
function akChatSave(q,a){
  try{var st=JSON.parse(localStorage.getItem('fr_chats')||'{}');var cs=Array.isArray(st.chats)?st.chats:[];
    var c=null;for(var i=0;i<cs.length;i++)if(cs[i].id==='desk'){c=cs[i];break;}
    if(!c){c={id:'desk',ts:Date.now(),t:'Desk asks',w:'',turns:[]};cs.unshift(c);}
    c.turns.push({q:q,a:String(a).slice(0,16000),src:AK.src||[],ts:Date.now()});c.turns=c.turns.slice(-20);c.ts=Date.now();
    cs=[c].concat(cs.filter(function(x){return x.id!=='desk';}));
    localStorage.setItem('fr_chats',JSON.stringify({v:1,chats:cs.slice(0,20)}));}catch(e){}}
function akRun(){
  if(AK.busy)return;
  var ta=$('#akTa');var q=ta.value.trim();if(!q)return;
  AK.busy=true;AK.q=q;AK.a='';ta.value='';
  var out=$('#akOut');out.innerHTML='<div class="ak-prog">Searching the library\u2026</div>';
  $('#akGo').disabled=true;
  fetch('https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/ask',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({messages:[{role:'user',content:q}],deep:$('#akDeep').checked})})
  .then(function(r){
    if(!r.ok||!r.body)throw new Error('Ask unavailable ('+r.status+')');
    var rd=r.body.getReader(),dc=new TextDecoder(),buf='',pre=false;
    function paint(){out.innerHTML='<div class="ak-a">'+akMd(AK.a)+'</div>'
      +(AK.busy?'':'<button class="ak-ins" id="akIns">Insert answer with citations</button>');
      var bi=$('#akIns');if(bi)bi.onclick=function(){
        var a=akMd(AK.a);
        insHtml('<blockquote>'+a+'<cite>\u2014 Ask the Library, on \u201c'+esc(q.slice(0,90))+'\u201d</cite></blockquote>');};}
    function feed(tx){
      if(pre){AK.a+=tx;return;}
      buf+=tx;
      for(;;){var nl=buf.indexOf('\n');if(nl<0)return;
        var ln=buf.slice(0,nl);buf=buf.slice(nl+1);var o=null;
        if(/^\s*\{/.test(ln)){try{o=JSON.parse(ln);}catch(e){}}
        if(o&&o.t==='p'){out.innerHTML='<div class="ak-prog">'+esc(o.m||'')+'</div>';continue;}
        if(o&&('sources' in o)){AK.src=(o.sources||[]).slice(0,14).map(function(x){return {slug:x.slug,page:x.page};});pre=true;AK.a=buf;buf='';return;}
        AK.a+=ln+'\n';pre=true;AK.a+=buf;buf='';return;}}
    return (function pump(){return rd.read().then(function(r2){
      if(r2.done){AK.busy=false;$('#akGo').disabled=false;paint();akChatSave(q,AK.a);return;}
      feed(dc.decode(r2.value,{stream:true}));if(pre)paint();return pump();});})();})
  .catch(function(e){AK.busy=false;$('#akGo').disabled=false;
    out.innerHTML='<div class="ak-prog">'+esc(String(e.message||e))+' \u2014 please try again.</div>';});}
function insHtml(h){
  if(!CUR)newDoc();if(!CUR)throw Error('A paper could not be created. Your research remains saved.');$('#ed').focus();var sel=window.getSelection();if(savedRange&&$('#ed').contains(savedRange.startContainer)){sel.removeAllRanges();sel.addRange(savedRange);}else{var range=document.createRange();range.selectNodeContents($('#ed'));range.collapse(false);sel.removeAllRanges();sel.addRange(range);}
  try{document.execCommand('insertHTML',false,'<p><br></p>'+h+'<p><br></p>');}
  catch(e){$('#ed').innerHTML+=h;}
  autosave();var saved=saveCur();
  if(matchMedia('(max-width:1160px)').matches)closePanels();return saved;}
function bq(text,cite,href){
  return '<blockquote>'+esc(text)+'<cite>— '+esc(cite)
    +(href?' · <a href="'+esc(href)+'">read in context</a>':'')+'</cite></blockquote>';}
function sourceLink(item){
  if(item.slug&&(item.site||'fr')==='fr')return '/the-faith-received/read/?w='+encodeURIComponent(item.slug)+(item.row?'#'+encodeURIComponent(item.row):item.page!=null?'#b'+encodeURIComponent(String(item.page))+'-0':'');
  try{var u=new URL(item.url||item.u||item.href||'',location.origin);return item.url||item.u||item.href?(/^https?:$/.test(u.protocol)?u.href:null):null;}catch(e){return null;}
}
function answerHtml(t){return (window.FRAsk?window.FRAsk.markdown(t.a||'',t.src||[]):akMd(t.a||''))+'<p><cite>Ask the Library · '+esc(t.q||'')+'</cite></p>';}
var railSeq=0;
async function renderRail(){
  if(!notebook()||!workflow())return;
  var token=++railSeq,body=$('#railBody'),rows=[],state;
  try{state=notebook().read();}catch(e){body.textContent=e.message;return;}
  var cols=state.collections,pick=$('#deskCollection'),chosen=pick.value||paperNotebook();
  pick.innerHTML='<option value="all">All notebooks</option><option value="reader">Unfiled reader notes</option>'+cols.map(function(c){return '<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>';}).join('');
  if(Array.prototype.some.call(pick.options,function(o){return o.value===chosen;}))pick.value=chosen;
  pick.hidden=TAB!=='notes';$('.desk-collection-label').hidden=TAB!=='notes';$('#deskNoteForm').hidden=TAB!=='notes';
  if(TAB==='notes'){
    var notes=lj('fr_notes');Object.keys(notes).forEach(function(k){var n=notes[k];if(!n||!n.t||k.indexOf('ask|')===0)return;if(chosen==='all'||chosen==='reader'&&!n.notebookId||n.notebookId===chosen)rows.push(workflow().legacyRow(k,n,'note'));});
    cols.filter(function(c){return chosen==='all'||chosen===c.id;}).forEach(function(c){(c.items||[]).forEach(function(item){rows.push(Object.assign({},item,{text:item.text||item.note||item.label||item.title||item.slug||'Saved reference',kind:notebook().kind(item),notebook:c.name}));});});
  }else if(TAB==='highlights'){
    var highlights=lj('fr_hl'),passages=lj('fr_highlight_passages_v1');Object.keys(highlights).forEach(function(k){var h=passages[k];if(h&&h.text)rows.push(Object.assign(workflow().legacyRow(k,h,'highlight'),{color:highlights[k],fileable:true}));});
  }else if(TAB==='history'){
    rows=workflow().readingHistory(lj('fr_lastread')).map(function(r){return Object.assign({},r,{kind:'history',text:r.title,cite:[r.author,'location '+r.page].filter(Boolean).join(' · '),fileable:true});});
  }else{
    var cs=[];try{cs=window.FRChatStore?await window.FRChatStore.all():(lj('fr_chats').chats||[]);}catch(e){cs=lj('fr_chats').chats||[];}if(token!==railSeq)return;
    cs.filter(function(c){return !c.archived;}).forEach(function(c){var turns=c.turns||[];turns.forEach(function(t){var complete=!!t.a&&(!t.status||t.status==='complete');rows.push({text:complete?t.a:t.q,cite:t.q||c.t,html:complete?answerHtml(t):null,chat:c.id,kind:complete?'answer':'conversation',ts:t.ts||c.ts,state:t.serverJob&&t.serverJob.status||t.status||'draft',sources:t.src||[]});});if(c.draft||!turns.length)rows.push({text:c.draft||c.t||'New conversation',cite:c.t||'Ask draft',chat:c.id,kind:'conversation',ts:c.ts,state:'draft'});});
  }
  rows.sort(function(a,b){return (b.ts||0)-(a.ts||0);});var query=$('#railSearch').value.trim().toLowerCase();if(query)rows=rows.filter(function(r){return [r.text,r.cite,r.title,r.author,r.notebook].join(' ').toLowerCase().includes(query);});
  var visible=rows.slice(0,railLimit);$('#railMore').hidden=rows.length<=railLimit;$('#railMore').textContent='Show more items ('+visible.length+' of '+rows.length+')';
  body.innerHTML=visible.map(function(r,i){var href=workflow().sourceURL(r),canInsert=r.kind!=='history'&&r.kind!=='conversation';return '<article class="rl-item"'+(r.color?' data-highlight="'+esc(r.color)+'"':'')+'><div class="cite">'+esc(r.cite||r.notebook||r.title||'Saved research')+'</div>'+(r.state?'<div class="cite">'+esc(r.state.replace(/_/g,' '))+'</div>':'')+'<div class="tx">'+esc(r.text)+'</div>'+(r.kind!=='history'?'<details class="rl-full"><summary>Read full item</summary><div>'+esc(r.text)+'</div></details>':'')+'<div class="rl-actions">'+(canInsert?'<button class="rl-ins" data-insert="'+i+'">'+(['highlight','passage','verse'].includes(r.kind)?'Insert quotation':r.kind==='answer'?'Insert answer':'Insert note')+'</button>':'')+(href?'<button class="rl-open" data-preview="'+i+'">'+(r.kind==='history'?'Resume reading':'Read source')+'</button><a href="'+esc(href)+'" target="_blank" rel="noopener">Open book</a>':'')+(r.fileable?'<button class="rl-open" data-file="'+i+'">Save in notebook</button>':'')+(r.chat?'<button class="rl-open" data-chat="'+esc(r.chat)+'">Open conversation</button>':'')+'</div></article>';}).join('')||'<p class="rl-empty">'+(query?'No items match this search.':TAB==='history'?'Works you read appear here at your last saved location.':TAB==='highlights'?'Highlight text in a book. It will appear here with its citation, ready to use.':TAB==='chats'?'Questions, drafts, and answers from Ask appear here.':'Clip a passage from a book or add a working note to this notebook.')+'</p>';
  body.querySelectorAll('[data-insert]').forEach(function(b){b.onclick=function(){var r=visible[+b.dataset.insert];try{if(!insHtml(r.html||workflow().itemHTML(r)))throw Error('The insertion is visible but could not be saved. Keep this paper open.');contextStatus('Inserted into '+CUR.title+'.');}catch(e){contextStatus(e.message);}};});
  body.querySelectorAll('[data-preview]').forEach(function(b){b.onclick=function(){var r=visible[+b.dataset.preview];$('#deskSourcePreview iframe').src=workflow().sourceURL(r);$('#deskSourcePreview').hidden=false;document.body.classList.add('desk-source-open');$('#deskSourcePreview').scrollIntoView({block:'start'});};});
  body.querySelectorAll('[data-file]').forEach(function(b){b.onclick=async function(){try{var r=visible[+b.dataset.file],item=Object.assign({},r,{id:undefined,type:'note',label:r.title||r.cite,research:{kind:r.kind==='history'?'reference':'highlight',sources:[{slug:r.slug,page:r.page,row:r.row,url:workflow().sourceURL(r),title:r.title||r.work,author:r.author,cite:r.cite}]}});if(r.kind==='history')item.text='';var saved=await notebook().save(item,{collectionId:paperNotebook()});contextStatus('Saved in '+saved.collectionName+'.');b.textContent='Saved in notebook';}catch(e){contextStatus(e.message);}};});
  body.querySelectorAll('[data-chat]').forEach(function(b){b.onclick=function(){closePanels();window.FRAsk&&window.FRAsk.open({id:b.dataset.chat});};});
}
document.querySelectorAll('.rl-tabs button').forEach(function(b){b.onclick=function(){TAB=b.dataset.t;railLimit=24;document.querySelectorAll('.rl-tabs button').forEach(function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',String(x===b));});renderRail();};});
$('#deskCollection').onchange=function(){railLimit=24;renderRail();};
$('#railSearch').oninput=function(){railLimit=24;renderRail();};$('#railMore').onclick=function(){railLimit+=24;renderRail();};
$('#deskSourceClose').onclick=function(){$('#deskSourcePreview').hidden=true;$('#deskSourcePreview iframe').removeAttribute('src');document.body.classList.remove('desk-source-open');};
$('#deskSaveNote').onclick=async function(){var text=$('#deskNoteText').value.trim();if(!text)return;try{var result=await notebook().save({type:'note',text:text,research:{kind:'note',sources:[]}},{collectionId:paperNotebook()});$('#deskNoteText').value='';$('#deskNoteForm').open=false;contextStatus('Note saved in '+result.collectionName+'.');renderRail();}catch(e){contextStatus(e.message);}};
$('#closeResearch').onclick=function(){closePanels();$('#railTog').focus();};
$('#closeDocuments').onclick=function(){closePanels();$('#docsTog').focus();};
$('#deskTheme').onclick=function(){var root=document.documentElement,active=root.dataset.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');var theme=active==='dark'?'light':'dark';root.dataset.theme=theme;localStorage.setItem('fr_theme',theme);};
document.addEventListener('selectionchange',function(){var sel=window.getSelection();if(sel.rangeCount&&$('#ed').contains(sel.anchorNode))savedRange=sel.getRangeAt(0).cloneRange();});
window.addEventListener('fr-conversations-updated',renderRail);window.addEventListener('fr-notebook-updated',renderRail);
window.addEventListener('storage',function(e){if(e.key==='fr_docs'&&CUR&&!docDirty){var fresh=docsAll().find(function(d){return d.id===CUR.id;});if(fresh&&fresh.ts>CUR.ts){CUR=fresh;savedRange=null;$('#ed').innerHTML=fresh.html||'';$('#dTitle').value=fresh.title==='Untitled paper'?'':fresh.title;wcUpdate();renderDocs();}}if(['fr_collections_v1','fr_notes','fr_hl','fr_highlight_passages_v1','fr_chats','fr_lastread'].indexOf(e.key)>=0)renderRail();});
var personalResearch=null;
function showPersonal(open){
  if(!saveCur())return false;var wasOpen=!$('#deskPersonal').hidden;if(open&&!wasOpen)writeScroll=$('#edwrap').scrollTop;if(!open&&wasOpen)researchScroll=$('#deskPersonal').scrollTop;closePanels();
  $('#deskMain').hidden=!!open;$('#deskPersonal').hidden=!open;document.body.classList.toggle('desk-personal-open',!!open);
  if(open&&!personalResearch){if(!window.FRPersonalResearch){$('#deskPersonalHost').textContent='Personal research could not load. Reload Desk to try again.';return false;}personalResearch=window.FRPersonalResearch.mount($('#deskPersonalHost'),{onDeskDraft:createResearchDraft,onInsert:insertResearchNode,onInsertSequence:insertResearchSequence,collectionId:paperNotebook()});}
  else if(open)personalResearch.refresh();syncWorkspace();var route=new URL(location.href);route.searchParams.set('doc',CUR?CUR.id:'');if(open)route.searchParams.set('view','research');else{route.searchParams.delete('view');route.searchParams.delete('item');}history.replaceState(null,'',route.pathname+route.search+route.hash);requestAnimationFrame(function(){if(open)$('#deskPersonal').scrollTop=researchScroll;else $('#edwrap').scrollTop=writeScroll;});return true;
}
function syncWorkspace(){
  if(!CUR||!notebook())return;var route=new URL(location.href);route.searchParams.set('doc',CUR.id);history.replaceState(null,'',route.pathname+route.search+route.hash);var state=notebook().read(),id=CUR.notebookId||state.activeId;if(!state.collections.some(function(c){return c.id===id;}))id=state.activeId;
  if(CUR.notebookId!==id){CUR.notebookId=id;docDirty=true;saveCur();}try{notebook().selectCollection(id);}catch(e){contextStatus(e.message);}
  $('#paperNotebook').innerHTML=state.collections.map(function(c){return '<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>';}).join('');$('#paperNotebook').value=id;
  $('#deskCollection').value=id;$('#deskPaper').innerHTML=docsAll().map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.title||'Untitled paper')+'</option>';}).join('');$('#deskPaper').value=CUR.id;
  var research=!$('#deskPersonal').hidden;$('#deskWriteMode').setAttribute('aria-pressed',String(!research));$('#deskResearchMode').setAttribute('aria-pressed',String(research));$('#deskPaperContext').hidden=!research;
  try{localStorage.setItem('fr_desk_context_v1',JSON.stringify({docId:CUR.id,title:CUR.title,notebookId:id,ts:Date.now()}));}catch(_){}renderRail();
}
async function insertResearchNode(node){if(!CUR)newDoc();if(!CUR)throw Error('Choose a paper before inserting research.');if(!saveCur())throw Error('The current paper could not be saved.');var payload=workflow().nodeItem(node);CUR.research=Object.assign({},CUR.research,{insertedItems:(CUR.research&&CUR.research.insertedItems||[]).concat([payload])});showPersonal(false);if(!insHtml(workflow().itemHTML(node)))throw Error('The insertion could not be saved. Keep this paper open.');contextStatus('Inserted into '+CUR.title+'.');}
async function insertResearchSequence(outline){if(!CUR)newDoc();if(!CUR)throw Error('Choose a paper before inserting research.');if(!saveCur())throw Error('The current paper could not be saved.');CUR.research=Object.assign({},CUR.research,{insertedSequences:(CUR.research&&CUR.research.insertedSequences||[]).concat([outline.research])});showPersonal(false);if(!insHtml(outline.html))throw Error('The sequence could not be saved. Keep this paper open.');contextStatus('Sequence inserted into '+CUR.title+'.');}
$('#deskWriteMode').onclick=function(){showPersonal(false);};$('#deskResearchMode').onclick=function(){showPersonal(true);};
$('#deskPaper').onchange=function(){if(openDoc(this.value)&&personalResearch)personalResearch.setCollection(paperNotebook());};
$('#paperNotebook').onchange=function(){var old=CUR.notebookId;CUR.notebookId=this.value;docDirty=true;if(!saveCur()){CUR.notebookId=old;this.value=old;return;}syncWorkspace();if(personalResearch)personalResearch.setCollection(CUR.notebookId);contextStatus('This paper uses '+this.selectedOptions[0].textContent+'.');};
$('#newNotebookForm').onsubmit=async function(e){e.preventDefault();try{var created=await notebook().createCollection($('#newNotebookName').value);CUR.notebookId=created.id;docDirty=true;if(!saveCur())throw Error('Notebook created, but the paper could not be saved.');$('#newNotebookName').value='';$('.desk-new-notebook').open=false;syncWorkspace();if(personalResearch)personalResearch.setCollection(created.id);contextStatus('Notebook created: '+created.name+'.');}catch(error){contextStatus(error.message);}};
async function createResearchDraft(payload){
  clearTimeout(_sv);if(!saveCur())throw Error('The current paper could not be saved. It remains open; download it before creating another draft.');
  if(!window.FRResearchNotebook)throw Error('The research notebook could not load. Reload Desk to try again.');
  var created=await window.FRResearchNotebook.createDeskDraft(payload);
  if(!openDoc(created.id))throw Error('The new draft was saved, but the current paper could not be left safely. It remains available in Your documents.');
  showPersonal(false);$('#ed').focus();return created;
}
window.FRDesk={insertAnswer:function(t){insHtml(answerHtml(t));},createDraft:createResearchDraft,returnToWriting:function(){showPersonal(false);$('#deskSourceClose').click();closePanels();$('#ed').focus();},receiveClip:function(result){showPersonal(true);personalResearch.focusItem(result.collectionId,result.item.id);contextStatus('Clipping ready to insert into '+(CUR&&CUR.title||'your paper')+'.');}};
$('#deskPersonalOpen').onclick=function(){showPersonal(true);};$('#deskPersonalBack').onclick=function(){showPersonal(false);};
document.addEventListener('DOMContentLoaded',function(){renderRail();try{var queued=JSON.parse(sessionStorage.getItem('fr_desk_insert_v1')||'null');if(queued){window.FRDesk.insertAnswer(queued);sessionStorage.removeItem('fr_desk_insert_v1');}}catch(e){$('#deskSaveState').textContent='The answer could not be inserted. Return to Ask and try again.';}});
window.addEventListener('pagehide',function(){clearTimeout(_sv);saveCur();});

/* ── export ── */
function toMd(node){
  var out='';
  Array.prototype.forEach.call(node.childNodes,function(n){
    if(n.nodeType===3){out+=n.textContent;return;}
    if(n.nodeType!==1)return;
    var tag=n.tagName.toLowerCase(),inner=toMd(n);
    if(tag==='h2')out+='\n## '+inner.trim()+'\n\n';
    else if(tag==='h3')out+='\n### '+inner.trim()+'\n\n';
    else if(tag==='b'||tag==='strong')out+='**'+inner+'**';
    else if(tag==='i'||tag==='em')out+='*'+inner+'*';
    else if(tag==='blockquote')out+='\n'+inner.trim().split('\n').map(function(l){return '> '+l;}).join('\n')+'\n\n';
    else if(tag==='cite')out+='\n— '+inner.trim();
    else if(tag==='a')out+='['+inner+']('+n.getAttribute('href')+')';
    else if(tag==='li')out+='- '+inner.trim()+'\n';
    else if(tag==='ul'||tag==='ol')out+='\n'+inner+'\n';
    else if(tag==='p'||tag==='div')out+=inner.trim()+'\n\n';
    else if(tag==='br')out+='\n';
    else out+=inner;});
  return out;}
$('#exMd').onclick=function(){saveCur();
  var md='# '+($('#dTitle').value.trim()||'Untitled paper')+'\n\n'+toMd($('#ed')).replace(/\n{3,}/g,'\n\n').trim()+'\n';
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([md],{type:'text/markdown'}));
  a.download=($('#dTitle').value.trim()||'paper').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')+'.md';
  a.click();};
$('#exPr').onclick=function(){saveCur();window.print();};

/* ── shell ── */
$('#newDoc').onclick=newDoc;
function syncPanels(){var mobile=matchMedia('(max-width:940px)').matches,compact=matchMedia('(max-width:1160px)').matches,docs=$('#docs').classList.contains('open'),rail=$('#rail').classList.contains('open'),docsOverlay=compact&&docs,railOverlay=mobile&&rail,overlay=docsOverlay||railOverlay;
 $('#deskScrim').hidden=!overlay;$('#edwrap').inert=overlay;$('body > header').inert=overlay;$('.desk-workspace-bar').inert=overlay;$('#docs').inert=compact&&!docs||railOverlay;$('#rail').inert=mobile&&!rail||docsOverlay;
 $('#docsTog').setAttribute('aria-expanded',String(docs));$('#railTog').setAttribute('aria-expanded',String(rail));}
function closePanels(){$('#docs').classList.remove('open');$('#rail').classList.remove('open');syncPanels();}
$('#docsTog').onclick=function(){$('#docs').classList.toggle('open');$('#rail').classList.remove('open');syncPanels();if($('#docs').classList.contains('open'))$('#closeDocuments').focus();};
$('#railTog').onclick=function(){$('#rail').classList.toggle('open');$('#docs').classList.remove('open');syncPanels();if($('#rail').classList.contains('open'))$('#closeResearch').focus();};
$('#deskScrim').onclick=closePanels;
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!document.documentElement.classList.contains('fra-open')){closePanels();}});
window.addEventListener('resize',syncPanels);syncPanels();
var boot=docsAll();
var requestedDoc=new URLSearchParams(location.search).get('doc');
if(requestedDoc&&boot.some(function(d){return d.id===requestedDoc;}))openDoc(requestedDoc);
else if(requestedDoc){
 var nb=document.createElement('div');
 nb.style.cssText='margin:10px 0;padding:10px 14px;border:1px solid var(--border,#ddd);border-left:3px solid var(--accent,#b45f3d);border-radius:6px;font-size:.9rem;background:var(--card,#fff)';
 nb.textContent='The linked Desk document was not found in this browser. Desk documents are saved in the browser (and site copy) where they were created — open this link there, or export the document and import it here.';
 var host=document.querySelector('main')||document.body;host.insertBefore(nb,host.firstChild);
 if(boot.length){var last0=lj('fr_desk_context_v1').docId;openDoc(boot.some(function(d){return d.id===last0;})?last0:boot[0].id);}else newDoc();
} else if(boot.length){var last=lj('fr_desk_context_v1').docId;openDoc(boot.some(function(d){return d.id===last;})?last:boot[0].id);}else newDoc();
try{var savedTheme=localStorage.getItem('fr_theme');if(savedTheme==='light'||savedTheme==='dark')document.documentElement.dataset.theme=savedTheme;}catch(_){}
document.addEventListener('DOMContentLoaded',function(){var params=new URLSearchParams(location.search),target=params.get('notebook');syncWorkspace();if(params.get('view')==='research'){showPersonal(true);if(params.get('item'))personalResearch.focusItem(target||paperNotebook(),params.get('item'));}});
renderRail();
})();
