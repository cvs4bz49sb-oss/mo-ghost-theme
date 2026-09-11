/* Inspectable connections from published indexes. A profile match is never a citation. */
(function(root){
  'use strict';
  const BLOB='https://mo-tfr-library.mo-podcast-feed.workers.dev';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fold=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const count=n=>Number(n||0).toLocaleString();
  const readerURL=(slug,page)=>'/the-faith-received/read/?w='+encodeURIComponent(slug)+(page!=null&&page!==''?'#b'+encodeURIComponent(String(page))+'-0':'');
  // ?hl=<surface form>: the reader marks the flagged name on the landed page; selection keys keep the bare URL
  const withHl=(url,hl)=>{if(!url||!hl)return url;const i=url.indexOf('#');return (i<0?url:url.slice(0,i))+(url.includes('?')?'&':'?')+'hl='+encodeURIComponent(String(hl).slice(0,120))+(i<0?'':url.slice(i));};
  function safeURL(value){if(typeof value!=='string'||!value.trim())return null;try{const u=new URL(value,'https://thefaithreceived.vercel.app');return u.origin==='https://thefaithreceived.vercel.app'&&/^(?:\/|\/(?:read|bible|web|fathers|topics|search)(?:\.html)?)$/.test(u.pathname)?u.pathname+u.search+u.hash:null;}catch(_){return null;}}
  function source(row,works={},author=''){
    let slug=String(row.w||row.cw||''),page=row.p==null?null:String(row.p);
    if(!slug&&row.h){try{const u=new URL(row.h,'https://thefaithreceived.vercel.app');slug=u.searchParams.get('w')||'';const m=u.hash.match(/^#b(.+)-\d+$/);if(m)page=decodeURIComponent(m[1]);}catch(_){}}
    const title=String(works[slug]||row.wt||row.ct||row.t||slug);
    return {slug,page,url:slug?readerURL(slug,page):safeURL(row.h),cite:[author,title,page!=null?'p. '+page:''].filter(Boolean).join(' · '),author,title};
  }
  function chapterReference(raw,books){
    const parsed=root.FRResearchData?.parseReference(raw,books);if(parsed&&!parsed.verse)return {...parsed,label:((books||[]).find(b=>b.slug===parsed.book)?.book||parsed.book)+' '+parsed.ch};
    const m=String(raw||'').match(/^(.+?)\s+(\d+)$/);if(!m)return null;
    const key=v=>fold(v).replace(/^iii\b/,'3').replace(/^ii\b/,'2').replace(/^i\b/,'1').replace(/kgs\b/,'kings').replace(/[^a-z0-9]/g,'');
    const alias={ps:'psalms',cant:'songofsolomon',song:'songofsolomon',jas:'james',apoc:'revelationofjohn',rev:'revelationofjohn',canticles:'songofsolomon'};
    const name=key(m[1]),needle=alias[name]||name;
    const hits=(books||[]).filter(b=>[key(b.book),key(b.slug)].some(n=>n===needle||n.startsWith(needle)));
    if(hits.length!==1||!(hits[0].chapters||[]).some(c=>+c.c===+m[2]))return null;
    return {book:hits[0].slug,ch:+m[2],label:hits[0].book+' '+m[2]};
  }
  function sharedChapters(a,b,books){
    const profile=rows=>new Map((rows||[]).flatMap(r=>{const ref=chapterReference(r.t,books);return ref?[[ref.book+'/'+ref.ch,{...ref,n:+String(r.s||'').replace(/,/g,'').match(/\d+/)?.[0]||0}]]:[];}));
    const aa=profile(a),bb=profile(b);
    return [...aa].filter(([k])=>bb.has(k)).map(([k,v])=>({...v,left:v.n,right:bb.get(k).n})).sort((a,b)=>Math.min(b.left,b.right)-Math.min(a.left,a.right)||a.label.localeCompare(b.label));
  }
  function sharedPages(a,b){
    const key=r=>{const s=source(r);return s.slug&&s.page!=null?s.slug+'|'+s.page:null;};
    const right=new Map((b||[]).map(r=>[key(r),r]).filter(([k])=>k));
    const seen=new Set();return (a||[]).filter(r=>{const k=key(r);if(!k||seen.has(k)||!right.has(k))return false;seen.add(k);return true;}).map(r=>({left:r,right:right.get(key(r)),source:source(r)}));
  }
  function verseOverlap(chapter,left,right,kind){
    const match=(r,n)=>kind==='works'?r.w===n.w:fold(r.a)===fold(n.a||n.t);
    return (chapter?.verses||[]).map(v=>({...v,left:(v.rows||[]).filter(r=>match(r,left)),right:(v.rows||[]).filter(r=>match(r,right))})).filter(v=>v.left.length&&v.right.length);
  }
  function citationDirection(data,from,to){
    const outgoing=(data?.out?.rows||[]).find(r=>r.fk===to.s),incoming=(data?.in?.rows||[]).find(r=>r.fk===to.s);
    return outgoing?{row:outgoing,citing:from,target:to}:incoming?{row:incoming,citing:to,target:from}:null;
  }
  function directedPath(nodes,edges,start,end,direction='either'){
    const adjacency=nodes.map(()=>[]);for(const [a,b,w] of edges||[]){if(!adjacency[a]||!adjacency[b])continue;if(direction!=='in')adjacency[a].push([b,w]);if(direction!=='out')adjacency[b].push([a,w]);}
    adjacency.forEach(r=>r.sort((a,b)=>b[1]-a[1]));const queue=[start],previous=new Map([[start,start]]);let head=0;
    while(head<queue.length){const v=queue[head++];if(v===end)break;for(const [n]of adjacency[v]||[])if(!previous.has(n)){previous.set(n,v);queue.push(n);}}
    if(!previous.has(end))return null;const path=[end];while(path.at(-1)!==start)path.push(previous.get(path.at(-1)));return path.reverse();
  }
  function filterCitations(rows,{work='',kind='',context='',query=''}={},contexts={}){
    const q=fold(query);return (rows||[]).filter(r=>(!work||r.w===work)&&(!kind||r.h===kind)&&(!context||(contexts[r.w]?.k||'other')===context)&&(!q||fold([r.sf,r.loc,r.tw,r.title,r.w].join(' ')).includes(q)));
  }
  function pageContext(data,page){
    const key=String(page),sections=[],positions=[],authorities=[],units=[],seenPositions=new Set();
    const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
    for(const unit of data?.units||[]){
      const onPage=(unit.pages||[]).some(p=>String(p)===key);
      if(onPage){sections.push(...(Array.isArray(unit.loci)?unit.loci:[]));units.push({title:String(unit.title||''),loci:Array.isArray(unit.loci)?unit.loci:[]});}
      for(const position of (unit.positions||[]).filter(p=>String(p.page)===key)){const identity=position.prop_id?String(position.prop_id)+'|'+stable(position):null;if(identity&&seenPositions.has(identity))continue;if(identity)seenPositions.add(identity);positions.push(position);}
      authorities.push(...(unit.authorities||[]).filter(p=>String(p.page)===key));
    }
    return {sections:[...new Set(sections.filter(t=>typeof t==='string'))],units,positions,authorities};
  }
  function resolutionLabel(row){
    if(row?.resolved?.cls==='A'&&row.resolved.work_slug)return 'Held work identified';
    if(row?.resolved?.author||row?.resolved?.author_slug||row?.resolved?.cls==='B')return 'Author identified; held work unresolved';
    return 'Reference not resolved to a held work';
  }
  async function resolvedTargets(row){
    const candidates=[...(Array.isArray(row?.resolved_multi)?row.resolved_multi:[]),...(row?.resolved?.work_slug?[{...row.resolved}]:[])],targets=new Map();
    for(const candidate of candidates){
      const identifier=candidate.work_slug;if(!identifier)continue;
      const result=root.FRResearchData?.resolveWork?await root.FRResearchData.resolveWork(identifier):null;
      if(result?.status!=='held')continue;
      let url=result.url||readerURL(result.slug);
      const anchor=String(candidate.anchor||'').replace(/^#/,'');
      if(/^b[^\s<>"#]+-\d+$/.test(anchor))url=url.split('#')[0]+'#'+anchor;
      if(!safeURL(url))continue;
      targets.set(url,{...result,url,anchor,numbering:candidate.numbering||'',letter:candidate.letter||'',method:candidate.method||''});
    }
    return [...targets.values()];
  }
  const pending=new Map();
  async function json(path){
    if(root.FRResearchData)return root.FRResearchData.json(path);
    if(!pending.has(path))pending.set(path,(async()=>{const response=await fetch(BLOB+path,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('The published index could not load.');if(path.endsWith('.gz')){const _b=new Uint8Array(await response.arrayBuffer());if(_b[0]===31&&_b[1]===139)return JSON.parse(await new Response(new Blob([_b]).stream().pipeThrough(new DecompressionStream('gzip'))).text());return JSON.parse(new TextDecoder().decode(_b));}return response.json();})().catch(e=>{pending.delete(path);throw e;}));
    return pending.get(path);
  }
  function preview(url){const safe=safeURL(url);return safe&&/^\/(?:read|bible)(?:\.html)?[?#]/.test(safe)?`<details class="ce-preview" data-ce-preview="${esc(safe)}"><summary>Read passage here</summary><div></div></details>`:'';}
  function bindPreviews(host){host.querySelectorAll('[data-ce-preview]').forEach(d=>d.addEventListener('toggle',()=>{if(!d.open||d.querySelector('iframe'))return;const frame=document.createElement('iframe');frame.src=safeURL(d.dataset.cePreview);frame.title='Source passage';frame.loading='lazy';d.querySelector('div').appendChild(frame);}));}
  function pageContextHTML(s){return s.page!=null?`<details class="ce-page-context" data-ce-page="${esc(JSON.stringify(s))}"><summary>Topics and sources on this page</summary><div></div></details>`:'';}
  function bindPageContexts(host){host.querySelectorAll('[data-ce-page]').forEach(details=>{
    let loaded=false,loading=false;
    async function load(){if(!details.open||loaded||loading)return;loading=true;const body=details.querySelector('div'),s=JSON.parse(details.dataset.cePage);body.innerHTML='<p class="ce-note" role="status">Loading the published page analysis…</p>';
      try{
        let data;if(root.FRResearchData)data=await root.FRResearchData.loadUnits(s.slug);else try{data=await json('/v1/mine/units/'+encodeURIComponent(s.slug)+'.json');}catch(e){if(e.status!==404)throw e;}
        if(!details.isConnected)return;
        if(!data){body.innerHTML='<p class="ce-note">Analysis has not been published for this work. The canonical source remains available above.</p>';loaded=true;return;}
        const context=pageContext(data,s.page),topics=[...new Set(context.positions.flatMap(p=>Array.isArray(p.loci)?p.loci:[]).filter(t=>typeof t==='string'))];
        body.innerHTML=`<p class="ce-note">This is mined context from the citing page. It does not establish that this particular citation supports every topic, or that a reported position belongs to the author.</p>${context.units.some(u=>u.title||u.loci.length)?`<details><summary>Containing section context</summary>${context.units.map(u=>`<p class="ce-note">${u.title?esc(u.title)+': ':''}${u.loci.map(esc).join(' · ')||'No section topics supplied'}</p>`).join('')}</details>`:''}${topics.length?`<label>Filter this page’s positions<select class="ce-page-topic"><option value="">All position topics</option>${topics.map(t=>`<option>${esc(t)}</option>`).join('')}</select></label>`:''}<div class="ce-page-positions"></div>${context.authorities.length?`<details><summary>${context.authorities.length} authority records on this page</summary>${context.authorities.map(a=>`<div class="ce-record"><p>${esc(a.surface||'Authority mention')}${a.locator?' · '+esc(a.locator):''}</p><p class="ce-note">${esc(resolutionLabel(a))}${a.intent?' · Local annotation: '+esc(a.intent):''}</p>${a.resolved?.work_slug||a.resolved_multi?.length?`<div data-ce-authority-targets="${context.authorities.indexOf(a)}"><p class="ce-note">Checking the recorded work targets…</p></div>`:''}</div>`).join('')}</details>`:''}${!context.positions.length&&!context.authorities.length&&!context.sections.length?'<p class="ce-note">No positions or authority records are attached to this page in the available analysis.</p>':''}`;
        function render(){const topic=body.querySelector('.ce-page-topic')?.value||'',positions=context.positions.filter(p=>!topic||(p.loci||[]).includes(topic));body.querySelector('.ce-page-positions').innerHTML=positions.map((p,i)=>`<details class="ce-position"><summary>Position ${i+1}${p.stance?' · '+esc(p.stance):''}</summary><p>${esc(p.claim||'Statement text not supplied')}</p>${(p.loci||[]).length?`<p class="ce-note">${p.loci.map(esc).join(' · ')}</p>`:''}${p.against?`<p class="ce-note">Recorded as directed against: ${esc(p.against)}</p>`:''}<button data-ce-save-position="${context.positions.indexOf(p)}">Save position with source</button></details>`).join('')||(topic?'<p class="ce-note">No page positions match this topic.</p>':'');body.querySelectorAll('[data-ce-save-position]').forEach(button=>button.onclick=()=>{const p=context.positions[+button.dataset.ceSavePosition],item=researchNote('page-position',p.claim||'Mined position',[s],{topics:p.loci||[],url:s.url,research:{annotation:p.stance||'',attribution:'Mined statement; speaker not independently verified'}});item.text='Mined statement, not a verbatim quotation:\n'+(p.claim||'')+'\n\n'+s.cite+'\n'+s.url;save(button,item);});}
        if(body.querySelector('select'))body.querySelector('select').onchange=render;render();loaded=true;
        body.querySelectorAll('[data-ce-authority-targets]').forEach(async target=>{try{const targets=await resolvedTargets(context.authorities[+target.dataset.ceAuthorityTargets]);if(!target.isConnected)return;target.innerHTML=targets.length?targets.map(t=>`<p class="ce-note">${t.anchor?'Resolver-recorded passage target; check the cited location':'Held work recorded by the resolver; specific passage not located'}${t.numbering?' · Numbering: '+esc(t.numbering):''}${t.letter?' · Letter '+esc(t.letter):''}</p><a class="ce-read" href="${esc(t.url)}">${esc(t.work?.title||t.slug)}</a>`).join(''):'<p class="ce-note">The recorded identifiers could not be matched to a held edition. No target link has been inferred.</p>';}catch(_){if(target.isConnected)target.innerHTML='<p class="ce-note">Target lookup could not load. Reopen this page analysis to retry.</p>';}});
      }catch(_){if(!details.isConnected)return;body.innerHTML='<p class="ce-note">The work analysis could not load.</p><button class="ce-context-retry">Retry page analysis</button>';body.querySelector('button').onclick=load;}finally{loading=false;}
    }
    details.addEventListener('toggle',load);
  });}
  async function save(button,item){
    const original=button.textContent;button.disabled=true;
    try{if(!root.FRResearchNotebook?.save)throw Error();await root.FRResearchNotebook.save(item);button.textContent='Saved to research';}
    catch(_){button.textContent='Save failed. Retry';button.disabled=false;return false;}
    button.dataset.savedLabel=original;return true;
  }
  function researchNote(kind,label,sources,extra={}){
    const unique=[...new Map(sources.filter(s=>s?.url).map(s=>[s.url,s])).values()];
    return {type:'note',label,text:label+'\n\n'+unique.map(s=>s.cite+'\n'+s.url).join('\n\n'),cite:label,url:extra.url||'/the-faith-received/web/',research:{kind,sources:unique,verses:extra.verses||[],topics:extra.topics||[],authors:[...new Set(unique.map(s=>s.author).filter(Boolean).concat(extra.authors||[]))],...extra.research}};
  }
  function mountCitation(host,options){
    const {data,citing,target,commentaries={map:{}},initialWork='',initialTarget='',initialSources=[],onSelection,hideSave=false}=options;
    const entry=data?.to?.[target.s],works=data?.works||{},contexts=commentaries.map||{},rows=(entry?.rows||[]).map((r,i)=>({...r,id:i,title:works[r.w]||r.w}));
    const available=new Set(rows.map(r=>source(r,works,citing.a).url)),selected=new Map(initialSources.filter(s=>available.has(s.url)).map(s=>[s.url,s])),groups=new Map();for(const row of rows)groups.set(row.w,(groups.get(row.w)||0)+1);
    const kinds=[...new Set(rows.map(r=>r.h).filter(Boolean))].sort(),targets=new Map();let limit=24;
    if(!entry){host.innerHTML='<p class="ce-note">The complete passage export is unavailable for this connection. The graph may still contain a recorded edge.</p>';return {sources:()=>[]};}
    host.classList.add('connection-evidence');
    host.innerHTML=`<p class="ce-explanation"><strong>${esc(citing.a)} cites ${esc(target.a)}.</strong> These are indexed references in the citing works. A recorded “quotes” label does not verify reuse of the same wording, and a citation does not establish agreement.</p><div class="ce-filters"><label>Source work<select data-ce-work><option value="">All ${groups.size} works</option>${[...groups].sort((a,b)=>String(works[a[0]]||a[0]).localeCompare(String(works[b[0]]||b[0]))).map(([w,n])=>`<option value="${esc(w)}">${esc(works[w]||w)} (${count(n)})</option>`).join('')}</select></label><label>Recorded relation<select data-ce-kind><option value="">All relations</option>${kinds.map(k=>`<option>${esc(k)}</option>`).join('')}</select></label><label>Work context<select data-ce-context><option value="">All contexts</option><option value="sent">Sentences commentary</option><option value="sum">Summa commentary</option><option value="bib">Scripture commentary</option><option value="comp">Compilation</option><option value="other">Other or unclassified</option></select></label><label class="ce-wide">Cited work<select data-ce-target disabled><option value="">Checking held-work targets…</option></select></label><label class="ce-wide">Find a reference<input data-ce-query type="search" placeholder="Search mention, work, or locator"></label></div><p class="ce-note">Commentary labels describe the work containing the reference. They do not prove which intermediary transmitted a quotation.</p><p class="ce-count" role="status"></p><div class="ce-records"></div><button class="ce-more" type="button">Show more references</button><div class="ce-selection"><span class="ce-selected" role="status">No passages selected</span>${hideSave?'':'<button class="ce-save" disabled>Save selected references</button>'}</div>`;
    const find=s=>host.querySelector(s);if(groups.has(initialWork))find('[data-ce-work]').value=initialWork;
    else if(initialWork)host.insertAdjacentHTML('afterbegin','<p class="ce-note">No references from the requested work occur in this step. All available source works are shown.</p>');
    function updateSelection(){const sources=[...selected.values()];find('.ce-selected').textContent=sources.length?count(sources.length)+' selected source passages':'No passages selected';if(find('.ce-save')){find('.ce-save').disabled=!sources.length;find('.ce-save').textContent='Save selected references';}onSelection?.(sources);}
    function resolutionHTML(identifier){const result=targets.get(identifier);return result?.status==='held'?`<p>Held work recorded by the resolver. The citation attribution and exact passage are not independently verified.</p><a class="ce-read" href="${esc(result.url||readerURL(result.slug))}">Open ${esc(result.work?.title||result.slug)}</a>`:`<p>${identifier?'Author identified · cited work identifier '+esc(identifier)+'; held edition not verified':'Author identified · cited work unresolved'}</p>`;}
    async function locateTargets(){
      const control=find('[data-ce-target]');
      if(!root.FRResearchData?.resolveWork){control.innerHTML='<option value="">Held-work lookup unavailable</option>';return;}
      try{
        const identifiers=[...new Set(rows.map(r=>r.tw).filter(Boolean))];
        await Promise.all(identifiers.map(async id=>targets.set(id,await root.FRResearchData.resolveWork(id))));if(!host.isConnected)return;
        const held=[...new Map([...targets.values()].filter(t=>t?.status==='held').map(t=>[t.slug,t])).values()].sort((a,b)=>String(a.work?.title||a.slug).localeCompare(String(b.work?.title||b.slug)));
        control.innerHTML='<option value="">All cited work records</option>'+held.map(t=>`<option value="${esc(t.slug)}">${esc(t.work?.title||t.slug)}</option>`).join('');control.disabled=!held.length;
        if(initialTarget){const resolved=await root.FRResearchData.resolveWork(initialTarget);if(!host.isConnected)return;if(resolved?.status==='held'&&held.some(t=>t.slug===resolved.slug)){control.value=resolved.slug;paint();}else control.parentElement.insertAdjacentHTML('afterend','<p class="ce-note">No recorded target in this step resolves to the requested held work. All references are available; a specific quotation or passage has not been located.</p>');}
        host.querySelectorAll('[data-ce-target-id]').forEach(node=>node.innerHTML=resolutionHTML(node.dataset.ceTargetId));
      }catch(_){if(host.isConnected){control.innerHTML='<option value="">Target lookup could not load</option>';const retry=document.createElement('button');retry.textContent='Retry target lookup';retry.type='button';retry.onclick=()=>{retry.remove();locateTargets();};control.parentElement.appendChild(retry);}}
    }
    function paint(){
      const targetWork=find('[data-ce-target]').value,hits=filterCitations(rows,{work:find('[data-ce-work]').value,kind:find('[data-ce-kind]').value,context:find('[data-ce-context]').value,query:find('[data-ce-query]').value},contexts).filter(r=>!targetWork||targets.get(r.tw)?.slug===targetWork);
      find('.ce-count').textContent=count(hits.length)+' available references'+(+entry.n>rows.length?' · '+count(entry.n)+' counted in the index':'');
      find('.ce-more').hidden=true;
      const recordHTML=r=>{const s=source(r,works,citing.a),context=contexts[r.w],key=s.url;return `<article class="ce-record"><label class="ce-pick"><input type="checkbox" data-ce-pick="${r.id}"${selected.has(key)?' checked':''}><span>Select this source passage</span></label><h4><a href="${esc(readerURL(r.w))}">${esc(s.title)}</a></h4>${context?`<p class="ce-context">${esc(context.l)}</p>`:''}<p><span class="ce-label">Recorded mention</span>${esc(r.sf||'Mention text not supplied')}</p>${r.loc?`<p><span class="ce-label">Citation locator</span>${esc(r.loc)}</p>`:''}<div class="ce-note ce-resolution" data-ce-target-id="${esc(r.tw||'')}">${resolutionHTML(r.tw)}</div><div class="ce-source-actions"><span>${r.h?'Recorded as '+esc(r.h)+' · ':''}${s.page!=null?'p. '+esc(s.page):'Page not supplied'}</span><a href="${esc(withHl(s.url,r.sf))}">Open source</a>${saveBtn(r.w,s.page,s.title,(r.sf||'')+(r.loc?' — '+r.loc:''))}</div>${preview(withHl(s.url,r.sf))}${pageContextHTML(s)}</article>`;};
      const box=find('.ce-records');box.classList.add('ce-pane');box.scrollTop=0;
      if(!hits.length){box.innerHTML='<p class="ce-note">No references match these filters. Clear the phrase or choose another work.</p>';return;}
      // bounded pane (2026-09-09): chunks arrive as the pane's own scroll nears its end; nothing is truncated
      if(box.__io)box.__io.disconnect();box.innerHTML='';let n=0;const CH=12;const sent=document.createElement('div');sent.className='ce-sentinel';sent.setAttribute('aria-hidden','true');box.appendChild(sent);
      const wire=frag=>{frag.querySelectorAll('[data-ce-pick]').forEach(input=>input.onchange=()=>{const r=rows[+input.dataset.cePick],s=source(r,works,citing.a);if(input.checked)selected.set(s.url,s);else selected.delete(s.url);box.querySelectorAll('[data-ce-pick]').forEach(el=>{el.checked=selected.has(source(rows[+el.dataset.cePick],works,citing.a).url);});updateSelection();});bindPreviews(frag);bindPageContexts(frag);
        frag.querySelectorAll('[data-ce-fold]').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)openFolds.add(d.dataset.ceFold);else openFolds.delete(d.dataset.ceFold);}));};
      // BY WORK, COLLAPSED (2026-09-10): records grouped under their citing work, the largest work open; folds arrive
      // in chunks as the pane's own scroll nears its end; nothing is truncated
      const N=root.FRResearchNotebook,savedKeys=N?.savedKeys?N.savedKeys():new Set(),rk=(w,p)=>'fr|'+w+'|'+(p==null||p===''?'':String(p));
      const saveBtn=(w,p,title,label)=>{if(!N?.savePassage||!w||p==null||p==='')return '';const on=savedKeys.has(rk(w,p));return `<button type="button" class="pinb${on?' on':''}" data-save-passage="${esc(w)}" data-page="${esc(String(p))}" data-title="${esc(String(title||'').slice(0,90))}" data-author="${esc(String(citing.a||'').slice(0,60))}" data-label="${esc(String(label||'').slice(0,240))}" aria-pressed="${on}">${on?'Saved':'Save passage'}</button>`;};
      const saveWorkBtn=(w,title)=>{if(!N?.saveWork||!w)return '';const on=savedKeys.has(rk(w,null));return `<button type="button" class="pinb pinb-work${on?' on':''}" data-save-work="${esc(w)}" data-title="${esc(String(title||'').slice(0,120))}" data-author="${esc(String(citing.a||'').slice(0,60))}" aria-pressed="${on}" onclick="event.stopPropagation()">${on?'Saved':'Save work'}</button>`;};
      const byW=new Map();hits.forEach(r=>{const w=String(r.w||'');if(!byW.has(w))byW.set(w,[]);byW.get(w).push(r);});
      const groups=[...byW.entries()].sort((x,y)=>y[1].length-x[1].length||x[0].localeCompare(y[0]));
      const openFolds=host.__ceOpen||(host.__ceOpen=new Set());if(!openFolds.size&&groups.length)openFolds.add(groups[0][0]);
      const foldHTML=([w,rs])=>{const s=source(rs[0],works,citing.a);return `<details class="ce-work" data-ce-fold="${esc(w)}"${openFolds.has(w)?' open':''}><summary><span><strong>${esc(s.title)}</strong></span><small class="ce-n">${rs.length}</small>${w?` <a class="ce-open-work" href="${esc(readerURL(w))}" onclick="event.stopPropagation()">open the work</a>${saveWorkBtn(w,s.title)}`:''}</summary><div class="ce-fold-body">${rs.slice().sort((a,b)=>(Number(a.p)||0)-(Number(b.p)||0)).map(recordHTML).join('')}</div></details>`;};
      const more=()=>{if(n>=groups.length)return;const end=Math.min(groups.length,n+CH);const t=document.createElement('template');t.innerHTML=groups.slice(n,end).map(foldHTML).join('');wire(t.content);box.insertBefore(t.content,sent);n=end;if(n>=groups.length){box.__io?.disconnect();sent.remove();}};
      more();if(n<groups.length){box.__io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))more();},{root:box,rootMargin:'320px 0px'});box.__io.observe(sent);}
    }
    host.querySelectorAll('select').forEach(el=>el.onchange=()=>paint());find('[data-ce-query]').oninput=()=>paint();
    if(!host.__ceSaveBound){host.__ceSaveBound=true;host.addEventListener('click',async e=>{const b=e.target.closest('[data-save-passage],[data-save-work]');if(!b)return;e.preventDefault();e.stopPropagation();
      const N=root.FRResearchNotebook;if(!N?.saveWork)return;const isWork=b.hasAttribute('data-save-work'),slug=isWork?b.dataset.saveWork:b.dataset.savePassage,page=isWork?null:b.dataset.page,on=b.getAttribute('aria-pressed')==='true';b.disabled=true;
      try{if(on)await N.unsave(slug,page);else if(isWork)await N.saveWork({slug,title:b.dataset.title,author:b.dataset.author});else await N.savePassage({slug,page,title:b.dataset.title,author:b.dataset.author,label:b.dataset.label});}
      catch(err){b.title=(err&&err.message)||'This could not be saved.';b.disabled=false;return;}
      const now=!on;host.querySelectorAll(isWork?`[data-save-work="${CSS.escape(slug)}"]`:`[data-save-passage="${CSS.escape(slug)}"][data-page="${CSS.escape(String(page))}"]`).forEach(x=>{x.classList.toggle('on',now);x.setAttribute('aria-pressed',String(now));x.textContent=now?'Saved':(x.hasAttribute('data-save-work')?'Save work':'Save passage');x.disabled=false;});b.disabled=false;});}
    if(find('.ce-save'))find('.ce-save').onclick=()=>save(find('.ce-save'),researchNote('citation-connection',citing.a+' cites '+target.a,[...selected.values()],{url:'/the-faith-received/web/#e='+encodeURIComponent(citing.s)+','+encodeURIComponent(target.s),authors:[citing.a,target.a],research:{direction:'citation',citing:citing.s,target:target.s}}));
    paint();updateSelection();locateTargets();return {sources:()=>[...selected.values()]};
  }
  const comparisonRuns=new WeakMap();
  async function mountComparison(host,options){
    const run=(comparisonRuns.get(host)||0)+1;comparisonRuns.set(host,run);const current=()=>host.isConnected&&comparisonRuns.get(host)===run;
    const {kind,left,right,leftRows,rightRows,weight,relation=null,leftLink='',rightLink='',fallback=false,relatedTopics=[],url='/the-faith-received/web/'}=options;
    const name=n=>String(n.displayName||n.t||n.a||n.name||n.label||''),isTopic=kind==='doctrines'||kind==='topics';let alive=true,selected=new Map(),verseSources=new Map();
    const title=name(left)+' · '+name(right);
    host.classList.add('connection-evidence');
    host.innerHTML=`<h5 tabindex="-1">Why are these connected?</h5><p class="ce-explanation"><strong>${esc(title)}</strong></p><p>${!relation?'These entries are linked in the published patrology index. The export does not state how each link was calculated. Read the supplied index anchors and sources below.':isTopic?'The published map compares the subjects recorded alongside each topic. Similar neighbouring subjects connect these profiles; the edge itself is not a count of pages containing both topics.':'The published map compares the distribution of Scripture citations. These entries cite some of the same chapters; the connection is a profile similarity, not evidence that one read the other.'}</p><p class="ce-note">Published weight ${Number(weight).toLocaleString(undefined,{maximumFractionDigits:3})}. This is an index measure, not a probability.${fallback?' The larger source export could not load; this view uses the embedded sample.':''}</p><div class="ce-overlap" role="status">Finding the available evidence…</div><div class="ce-selection"><span class="ce-selected" role="status">Choose passages to save</span><button class="ce-save" disabled>Save selected connection</button></div>`;
    const find=s=>host.querySelector(s),overlap=find('.ce-overlap');
    function update(){find('.ce-selected').textContent=selected.size?count(selected.size)+' selected source passages':'Choose passages to save';find('.ce-save').disabled=!selected.size;find('.ce-save').textContent='Save selected connection';}
    function cards(rows,author='',verseRef=null){return rows.map(r=>{const s=source(r,{},r.a||author);if(verseRef){const refs=verseSources.get(s.url)||[];if(!refs.some(v=>v.book===verseRef.book&&v.ch===verseRef.ch&&v.verse===verseRef.verse))refs.push(verseRef);verseSources.set(s.url,refs);}return `<article class="ce-record"><h6>${esc(r.wt||r.ct||r.t||s.title)}</h6>${r.g?`<p class="ce-note">Mined page summary</p><p>${esc(r.g)}</p>`:''}${r.q?`<p>${esc(r.q)}</p>`:''}${r.s?`<p class="ce-note">${esc(r.s)}</p>`:''}${s.url?`<label class="ce-pick"><input type="checkbox" data-ce-source="${esc(JSON.stringify(s))}"${selected.has(s.url)?' checked':''}>Select this source passage</label><a class="ce-read" href="${esc(s.url)}">Read source${s.page!=null?' · p. '+esc(s.page):''}</a>${preview(s.url)}`:''}</article>`;}).join('');}
    function bind(){host.querySelectorAll('[data-ce-source]').forEach(input=>input.onchange=()=>{const s=JSON.parse(input.dataset.ceSource);if(input.checked)selected.set(s.url,s);else selected.delete(s.url);host.querySelectorAll('[data-ce-source]').forEach(el=>el.checked=selected.has(JSON.parse(el.dataset.ceSource).url));update();});bindPreviews(host);}
    find('.ce-save').onclick=()=>save(find('.ce-save'),researchNote(isTopic?'topic-profile':'scripture-profile',title,[...selected.values()],{url,topics:isTopic?[name(left),name(right)]:[],verses:[...new Map([...selected.keys()].flatMap(url=>verseSources.get(url)||[]).map(v=>[v.book+'/'+v.ch+'/'+v.verse,v])).values()],authors:kind==='authors'?[name(left),name(right)]:[],research:{basis:isTopic?'topic co-occurrence profiles':'Scripture citation profiles',weight}}));
    if(!relation){
      let books=[];try{books=(await json('/v1/bible/all/books.json')).books||[];}catch(_){}if(!current())return;
      const enrich=rows=>(rows||[]).map(row=>{const ref=root.FRResearchData?.parseReference(String(row.t||'').replace(/-/g,' '),books);return ref?{...row,h:root.FRResearchData.verseURL(ref.book,ref.ch,ref.verse,{view:'desk'})}:row;});
      const leftEvidence=enrich(leftRows),rightEvidence=enrich(rightRows),refsA=new Set((left.pt||[]).map(fold)),sharedRefs=(right.pt||[]).filter(r=>refsA.has(fold(r)));
      overlap.innerHTML=`${sharedRefs.length?`<h6>${sharedRefs.length} shared Scripture index anchors</h6>${cards(enrich(sharedRefs.map(r=>({t:String(r).replace(/-/g,' ')}))))}`:''}<p class="ce-note">The supplied index evidence does not establish a direct citation, doctrinal agreement, or reuse of the same quotation.</p><div class="ce-comparison"><section><h6>${esc(name(left))}</h6>${safeURL(leftLink)?`<a class="ce-read" href="${esc(safeURL(leftLink))}">Open source entry</a>`:''}${cards(leftEvidence.slice(0,12))||'<p class="ce-note">No passage anchors are supplied for this entry in this export.</p>'}</section><section><h6>${esc(name(right))}</h6>${safeURL(rightLink)?`<a class="ce-read" href="${esc(safeURL(rightLink))}">Open source entry</a>`:''}${cards(rightEvidence.slice(0,12))||'<p class="ce-note">No passage anchors are supplied for this entry in this export.</p>'}</section></div><p class="ce-note">Up to twelve supplied entries per side are shown. Open either entry for its full available source list.</p>`;bind();return ()=>{alive=false;};
    }
    if(isTopic){
      const common=sharedPages(leftRows,rightRows);
      overlap.innerHTML=`<h6>${count(common.length)} shared pages in the supplied samples</h6><p class="ce-note">The source lists are sampled. An empty intersection does not mean these topics never occur together.</p>${common.length?cards(common.map(r=>r.left)):''}${relatedTopics.length?`<details><summary>Subjects connected to both profiles</summary><p class="ce-note">These are shared neighbours in the map, not newly inferred positions.</p><p>${relatedTopics.map(esc).join(' · ')}</p></details>`:''}<details${common.length?'':' open'}><summary>Read each topic’s available evidence</summary><div class="ce-comparison"><section><h6>${esc(name(left))}</h6>${cards(leftRows.slice(0,8))}</section><section><h6>${esc(name(right))}</h6>${cards(rightRows.slice(0,8))}</section></div><p class="ce-note">Up to eight sample pages per topic are shown here. Return to either topic’s entry for the full available source list.</p></details>`;bind();return ()=>{alive=false;};
    }
    let books;try{books=(await json('/v1/bible/all/books.json')).books||[];}catch(_){overlap.innerHTML='<p class="ce-note">Scripture navigation could not load. Close this explanation and select the connection again to retry.</p>';return ()=>{alive=false;};}
    if(!current())return;
    const shared=sharedChapters(leftRows,rightRows,books);
    overlap.innerHTML=`<h6>${count(shared.length)} shared chapters in the supplied profiles</h6><p class="ce-note">These exported profiles contain selected chapters. Open a chapter to check which indexed verses and source pages are present for both entries.</p>${shared.map((r,i)=>`<details class="ce-chapter" data-ce-chapter="${i}"><summary><span>${esc(r.label)}</span><small>${count(r.left)} / ${count(r.right)} citations</small></summary><p class="ce-note">Counts correspond to ${esc(name(left))} / ${esc(name(right))}.</p><div class="ce-chapter-evidence"></div></details>`).join('')||'<p class="ce-note">No common chapter appears in these exported profiles. The map was calculated from a larger citation index.</p>'}`;
    overlap.querySelectorAll('[data-ce-chapter]').forEach(details=>{
      let loaded=false,pending=false;
      const load=async()=>{if(!details.open||loaded||pending)return;pending=true;const r=shared[+details.dataset.ceChapter],box=details.querySelector('.ce-chapter-evidence');box.innerHTML='<p class="ce-note" role="status">Finding verse references and source passages…</p>';
        try{const chapter=await json('/v1/bible/all/'+encodeURIComponent(r.book)+'/'+r.ch+'.json.gz');if(!alive||!current())return;const hits=verseOverlap(chapter,left,right,kind);loaded=true;
          const bible='/the-faith-received/bible/#b/'+encodeURIComponent(r.book)+'/'+r.ch;
          box.innerHTML=`<p class="ce-note">${hits.length} shared verses in the available chapter index. These source rows may be a selection of the recorded citations.</p>${hits.map(v=>`<details class="ce-verse"><summary>Verse ${esc(v.v)} · ${v.left.length} / ${v.right.length} source rows</summary>${v.t?`<p class="ce-bible-text">${esc(v.t)}</p>`:''}<div class="ce-comparison"><section><h6>${esc(name(left))}</h6>${cards(v.left,left.a,{book:r.book,ch:r.ch,verse:v.v})}</section><section><h6>${esc(name(right))}</h6>${cards(v.right,right.a,{book:r.book,ch:r.ch,verse:v.v})}</section></div><a class="ce-read" href="${esc(bible+'?v='+v.v+'&view=desk')}">Explore this verse</a></details>`).join('')}<a class="ce-read" href="${esc(bible)}">Explore chapter evidence</a>`;
          bind();
        }catch(_){box.innerHTML='<p class="ce-note">This chapter could not load. Your connection remains open.</p><button class="ce-retry">Retry chapter</button>';box.querySelector('button').onclick=load;}finally{pending=false;}
      };details.addEventListener('toggle',load);
    });return ()=>{alive=false;};
  }
  const api={esc,fold,source,readerURL,safeURL,chapterReference,sharedChapters,sharedPages,verseOverlap,citationDirection,directedPath,filterCitations,pageContext,resolutionLabel,resolvedTargets,json,preview,bindPreviews,researchNote,save,mountCitation,mountComparison};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.FRConnectionEvidence=api;
})(typeof window==='undefined'?globalThis:window);
