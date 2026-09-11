/* Published work analysis. Page references remain strings; extracted text is never a quotation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FRWorkResearch=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const kinds={summaries:'Page summaries',positions:'Positions',authorities:'Cited authorities',scripture:'Scripture references',questions:'Questions',definitions:'Terms and definitions'};
const recordNames={summaries:'page summary',positions:'position',authorities:'authority reference',scripture:'Scripture reference',questions:'question',definitions:'definition'};
const str=v=>v==null?'':String(v),list=v=>Array.isArray(v)?v:[],fold=v=>str(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),esc=v=>str(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
function normalize(data){
 const records=[],pages=new Set(),positions=new Map(),ids=new Set();
 for(const [ui,u] of list(data?.units).entries()){
  const unit=str(u.title),up=list(u.pages).map(str);up.forEach(p=>pages.add(p));
  const add=(kind,x,i)=>{const page=str(x.page);if(page!=='')pages.add(page);const text=kind==='summaries'?str(x.text):kind==='positions'?str(x.claim):kind==='definitions'?[x.term,x.definition].filter(Boolean).join(': '):str(x.surface||x.ref);if(!text.trim())return;const key=kind==='positions'&&x.prop_id?str(x.prop_id)+'|'+stable(x):null,prior=key&&positions.get(key);if(prior){prior.sectionTopics=[...new Set([...prior.sectionTopics,...list(u.loci).map(str)])];prior.topics=[...new Set([...prior.topics,...list(u.loci).map(str)])];prior.sections.push(unit);return;}let id=str(x.prop_id)||`${ui}:${kind}:${i}`;if(ids.has(id))id+=':variant:'+ui+':'+i;ids.add(id);const record={id,kind,page,text,unit,sections:[unit],sectionTopics:list(u.loci).map(str),topics:[...new Set([...list(u.loci),...list(x.loci)].map(str))],raw:x};records.push(record);if(key)positions.set(key,record);};
  list(u.gists).forEach((g,i)=>add('summaries',{text:g,page:up[i]},i));
  for(const kind of Object.keys(kinds).filter(k=>k!=='summaries'))list(u[kind]).forEach((x,i)=>add(kind,x,i));
 }
 return {records,pages:[...pages],units:list(data?.units).length,topics:[...new Set(records.flatMap(r=>r.topics))].sort((a,b)=>a.localeCompare(b))};
}
function filter(records,{page=null,query='',topic=''}={}){const q=fold(query);return records.filter(r=>(page===null||r.page===str(page))&&(!topic||r.topics.includes(topic))&&(!q||fold([r.text,r.unit,...r.topics,r.raw.against,r.raw.subtle,r.raw.locator,r.raw.family].join(' ')).includes(q)));}
function recordContext(record,books,parser){return {statementTopics:list(record.raw?.loci).map(str),sectionTopics:list(record.sectionTopics).map(str),verses:record.kind==='scripture'&&parser?[parser(record.raw?.ref||record.text,books)].filter(Boolean):[]};}
function sourceURL(slug,page){return '/the-faith-received/read/?w='+encodeURIComponent(slug)+(page!==''?'#b'+encodeURIComponent(str(page))+'-0':'');}
function discussion(r,cite,url){return `Help me evaluate this extracted ${recordNames[r.kind]} record against the source. It is analysis, not a verbatim quotation, and may report another speaker's view.\n\n${r.text}\n\nSource: ${cite}\n${url}\n\nRead the source and distinguish the author's position from positions being reported or opposed.`;}
function mount(host,opts){
 const slug=opts.slug,url=opts.blob+'/v1/mine/units/'+encodeURIComponent(slug)+'.json';
 let model=null,pending=null,page=str(opts.page),scope='page',query='',topic='',limits={},opened=new Set(),dead=false,missing=false,browseSequence=0;
 const location=p=>opts.location?.(p)||'Page '+p;
 host.innerHTML=`<div class="wr-identity"><p class="nb-context-label">This work</p><h2>${esc(opts.title)}</h2><p>${esc(opts.author)}</p><div class="wr-actions"><button type="button" data-about>View edition details</button><button type="button" data-ask-book>Discuss work</button></div></div><p class="wr-intro">Explore the published analysis beside the source. Save records to your notebook or bring them into a conversation.</p><div class="wr-controls"><label>Show<select data-scope><option value="page">Current location</option><option value="work">Whole work</option></select></label><label>Topic context<select data-topic><option value="">All topics</option></select></label><label class="wr-search">Search analysis<input type="search" data-query placeholder="Find a claim, name, or term"></label></div><p class="wr-status" data-status role="status">Loading work analysis…</p><div data-results></div><details class="wr-coverage"><summary>About this analysis</summary><p>These are extracted summaries and annotations, not a critical edition or a statement of the author's settled beliefs. Labels such as “asserts” describe the local passage and can belong to a speaker being reported. Open the source to check context.</p><p data-coverage></p><a href="${esc(url)}" target="_blank" rel="noopener">Open published data (JSON)</a></details>`;
 const results=host.querySelector('[data-results]'),status=host.querySelector('[data-status]');
 host.querySelector('[data-about]').onclick=opts.about;host.querySelector('[data-ask-book]').onclick=()=>opts.ask();
 const controls=()=>{limits={};render();};
 host.querySelector('[data-scope]').onchange=e=>{scope=e.target.value;controls();};host.querySelector('[data-topic]').onchange=e=>{topic=e.target.value;controls();};host.querySelector('[data-query]').oninput=e=>{query=e.target.value;controls();};
 function recordHTML(r){const x=r.raw,meta=[x.stance?'Local label: '+x.stance:'',x.how||x.intent,x.move,x.family].filter(Boolean).join(' · ');return `<article class="wr-record" data-record="${esc(r.id)}"><p class="wr-record-loc">${esc(r.page?location(r.page):'Location not supplied')}${r.unit?' · '+esc(r.unit):''}</p><p class="wr-text">${esc(r.text)}</p>${meta?'<p class="wr-meta">'+esc(meta)+'</p>':''}${x.against?'<p class="wr-meta">Directed against: '+esc(x.against)+'</p>':''}${x.locator?'<p class="wr-meta">Cited location: '+esc(x.locator)+'</p>':''}${x.subtle?'<p class="wr-meta">'+esc(x.subtle)+'</p>':''}${x.verify?.span?'<details class="wr-verification"><summary>Recorded evidence span</summary><p>'+esc(x.verify.span)+'</p><small>Recorded by the extraction process; check against the current source.</small></details>':''}<div class="wr-record-context"></div><div class="wr-actions">${r.page?'<a data-read data-page="'+esc(r.page)+'" href="'+esc(sourceURL(slug,r.page))+'">Read source</a>':''}<button type="button" data-save="${esc(r.id)}">Save record</button><button type="button" data-discuss="${esc(r.id)}">Discuss record</button>${x.resolved?.work_slug||list(x.resolved_multi).length?'<button type="button" data-targets="'+esc(r.id)+'">View cited works</button>':''}</div><div class="wr-resolved-targets" hidden></div></article>`;}
 function render(){
  if(!model)return;
  const rows=filter(model.records,{page:scope==='page'?page:null,query,topic});
  status.textContent=`${rows.length.toLocaleString()} records${scope==='page'?' at '+location(page):' in this work'}${query||topic?' matching these filters':''}`;
  results.innerHTML=rows.length?Object.entries(kinds).map(([kind,label])=>{const group=rows.filter(r=>r.kind===kind);if(!group.length)return '';const n=limits[kind]||20;return `<details class="wr-group" data-kind="${kind}"${opened.has(kind)?' open':''}><summary><span>${label}</span><span>${group.length.toLocaleString()}</span></summary><div class="wr-records">${group.slice(0,n).map(recordHTML).join('')}${group.length>n?'<button type="button" class="wr-more" data-more="'+kind+'">Show 20 more <span>('+n+' of '+group.length.toLocaleString()+')</span></button>':''}</div></details>`;}).join(''):`<div class="wr-empty"><p>${query||topic?'No records match these filters.':scope==='page'?'No published analysis is attached to this page.':'No analysis records are published for this work.'}</p>${scope==='page'?'<button type="button" data-whole>Browse whole work</button>':''}${query||topic?'<button type="button" data-clear>Clear filters</button>':''}</div>`;
  results.querySelectorAll('.wr-group').forEach(d=>d.ontoggle=()=>{if(d.isConnected)d.open?opened.add(d.dataset.kind):opened.delete(d.dataset.kind);});
  results.querySelectorAll('[data-more]').forEach(b=>b.onclick=()=>{const key=b.dataset.more;limits[key]=(limits[key]||20)+20;opened.add(key);const top=host.scrollTop;render();host.scrollTop=top;results.querySelector('[data-more="'+key+'"]')?.focus({preventScroll:true});});
  results.querySelectorAll('[data-read]').forEach(a=>a.onclick=e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();opts.read(a.dataset.page);});
  const byId=new Map(rows.map(r=>[r.id,r]));
  results.querySelectorAll('[data-save]').forEach(b=>b.onclick=async()=>{const r=byId.get(b.dataset.save);b.disabled=true;b.textContent='Saving…';try{const context=await contextFor(r);const result=await opts.save(r,sourceURL(slug,r.page),context);b.textContent='Saved';status.textContent=result?.warnings?.length?'Record saved in this browser. Account sync could not be confirmed.':'Record saved to your active collection and Personal research.';}catch(_){b.textContent='Save record';status.textContent='Could not save this record. Please try again.';}finally{b.disabled=false;}});
  results.querySelectorAll('[data-discuss]').forEach(b=>b.onclick=()=>{const r=byId.get(b.dataset.discuss);opts.ask(discussion(r,[opts.author,opts.title].filter(Boolean).join(', ')+(r.page?', '+location(r.page):''),new URL(sourceURL(slug,r.page),window.location.origin).href));});
  decorateRecords(byId);
  results.querySelectorAll('[data-targets]').forEach(b=>b.onclick=()=>showTargets(byId.get(b.dataset.targets),b));
  const all=results.querySelector('[data-whole]');if(all)all.onclick=()=>{scope='work';host.querySelector('[data-scope]').value=scope;controls();};
  const clear=results.querySelector('[data-clear]');if(clear)clear.onclick=()=>{query='';topic='';host.querySelector('[data-query]').value='';host.querySelector('[data-topic]').value='';controls();};
 }
 let catalogues=null;
 const dictionaries=()=>catalogues||(catalogues=Promise.allSettled([window.FRResearchData?.books(),window.FRResearchData?.topics()]).then(([b,t])=>({books:b.status==='fulfilled'?b.value||[]:[],topics:t.status==='fulfilled'?t.value||[]:[]})));
 async function targetsFor(r){
  const rows=[...list(r.raw?.resolved_multi),...(r.raw?.resolved?.work_slug?[r.raw.resolved]:[])],seen=new Set(),targets=[];
  for(const row of rows){if(!row.work_slug)continue;const hit=await window.FRResearchData?.resolveWork(row.work_slug);if(hit?.status!=='held')continue;const anchor=typeof row.anchor==='string'&&/^b[^?#]+-\d+$/.test(row.anchor)?row.anchor:'';const key=hit.slug+'|'+anchor;if(seen.has(key))continue;seen.add(key);targets.push({slug:hit.slug,...anchor?{page:(anchor.match(/^b(.+)-\d+$/)||[])[1],anchor}:{},url:hit.url+(anchor?'#'+encodeURIComponent(anchor):''),title:hit.work.title_en||hit.work.title||hit.slug,author:hit.work.author||'',method:row.method||r.raw.resolved?.method||'',numbering:row.numbering||'',letter:row.letter,scope:'resolver-recorded'});}
  return targets;
 }
 async function contextFor(r){const d=await dictionaries(),context=recordContext(r,d.books,window.FRResearchData?.parseReference);context.citations=r.kind==='authorities'?await targetsFor(r):[];return context;}
 async function showTargets(r,button){const box=button.closest('.wr-record').querySelector('.wr-resolved-targets');if(!box.hidden){box.hidden=true;button.setAttribute('aria-expanded','false');return;}box.hidden=false;button.setAttribute('aria-expanded','true');box.textContent='Checking recorded targets…';try{const targets=await targetsFor(r);if(!box.isConnected)return;box.innerHTML='<p class="wr-meta">These targets were recorded by the resolver. Their interpretation and source location have not been independently checked here.</p>'+targets.map(t=>'<p><a href="'+esc(t.url)+'">'+esc(t.title)+'</a><small class="wr-meta">'+esc(t.letter?'Letter '+t.letter+' · '+t.numbering:t.anchor?'Recorded source location':'Target page not recorded')+'</small></p>').join('');if(!targets.length)box.textContent='No recorded identifier could be matched to the current library. Read the source to investigate this reference.';}catch(_){box.textContent='Recorded targets could not be checked. Close and reopen to retry.';}}
 async function decorateRecords(byId){
  const d=await dictionaries();if(dead)return;
  for(const article of results.querySelectorAll('[data-record]')){const r=byId.get(article.dataset.record);if(!r)continue;const ctx=recordContext(r,d.books,window.FRResearchData?.parseReference),host=article.querySelector('.wr-record-context');if(!host||host.dataset.ready)continue;host.dataset.ready='1';
   if(ctx.statementTopics.length||ctx.sectionTopics.length){const links=values=>values.map(value=>{const item=d.topics.find(t=>t.t===value);return item?'<a href="/the-faith-received/topics/#'+encodeURIComponent(item.s)+'">'+esc(value)+'</a>':esc(value);}).join(' · ');host.innerHTML='<details class="wr-topic-context"><summary>Explore doctrines</summary>'+(ctx.statementTopics.length?'<p><b>Statement topics</b><br>'+links(ctx.statementTopics)+'</p>':'')+(ctx.sectionTopics.length?'<p><b>Section context</b><br>'+links(ctx.sectionTopics)+'</p><small>These topics belong to the containing section; they do not establish this statement’s conclusion.</small>':'')+'</details>';}
   for(const ref of ctx.verses){const a=document.createElement('a');a.href=window.FRResearchData.verseURL(ref.book,ref.ch,ref.verse,{view:'desk'});a.textContent='Open verse desk';article.querySelector('.wr-actions').appendChild(a);}
  }
 }
 async function load(){if(model||pending||missing)return pending;pending=(async()=>{status.textContent='Loading work analysis…';try{const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(r.status===404){missing=true;status.textContent='Work analysis is not yet published for this edition.';host.querySelector('.wr-coverage a').hidden=true;return;}if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(!Array.isArray(data.units)||data.slug&&data.slug!==slug)throw Error('Invalid work analysis');if(dead)return;model=normalize(data);host.querySelector('[data-topic]').innerHTML='<option value="">All topics</option>'+model.topics.map(t=>'<option>'+esc(t)+'</option>').join('');host.querySelector('[data-coverage]').textContent=`This published file covers ${model.pages.length.toLocaleString()} page locations in ${model.units.toLocaleString()} sections. Counts refer to this file, not every page or claim in the work. Downloading the data preserves every published field.`;render();}catch(_){if(!dead){status.textContent='Work analysis could not be loaded. ';const retry=document.createElement('button');retry.type='button';retry.textContent='Retry loading';retry.onclick=load;status.appendChild(retry);}}finally{pending=null;}})();return pending;}
 function reveal(target){
  // Only the research panel scrolls; the source keeps its reading position.
  const panel=host.closest('.nb-panel')||host;
  panel.scrollTop+=target.getBoundingClientRect().top-panel.getBoundingClientRect().top-panel.clientTop;
  target.focus({preventScroll:true});
 }
 async function browse({kind}={}){
  if(dead||!Object.prototype.hasOwnProperty.call(kinds,kind))return false;
  const sequence=++browseSequence;
  scope='work';query='';topic='';limits={};opened.add(kind);
  host.querySelector('[data-scope]').value=scope;
  host.querySelector('[data-topic]').value='';host.querySelector('[data-query]').value='';
  status.tabIndex=-1;const loading=load();reveal(status);await loading;
  if(dead||sequence!==browseSequence)return false;
  render();const group=results.querySelector('[data-kind="'+kind+'"]');
  if(group){group.open=true;reveal(group.querySelector('summary'));return true;}
  if(model)status.textContent+=' No published '+recordNames[kind]+' records in this file.';
  reveal(status);return false;
 }
 return {load,browse,setPage(next){next=str(next);if(next!==page){page=next;if(scope==='page'){limits={};render();}}},destroy(){dead=true;browseSequence++;}};
}
return {kinds,recordNames,normalize,filter,recordContext,sourceURL,discussion,mount};
});
