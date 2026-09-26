(function () {
  'use strict';
  if (window.FRAsk) return;
  // A source opened beside a conversation uses its parent's workspace and stream owner.
  try { if (window.parent !== window && window.parent.FRAsk) { if(window.frameElement?.id==='fra-source-frame')document.documentElement.classList.add('fr-ask-source');window.FRAsk = { open: (opts={}) => window.parent.FRAsk.open({...opts,contextWork:new URLSearchParams(location.search).get('w')||window.__FR_SLUG__||''}), markdown:window.parent.FRAsk.markdown, readURL:window.parent.FRAsk.readURL }; return; } } catch (_) {}
  // INTEGRATION (owner 2026-09-13 'make integration of ask easy'): one file runs on every host. A host sets
  // window.FRAskConfig BEFORE this script loads; every key is optional and defaults to the Vercel site.
  //   apiBase          origin+prefix that serves ask + investigations   ('' → same origin '/api'; MereO → 'https://…workers.dev/v1')
  //   dataBase         origin that serves works-index / schools / embcat  (Blob base on Vercel; the library worker on MereO)
  //   readPath         reader page path                                  ('/read'; MereO '/the-faith-received/read/')
  //   askPath          the standalone Ask page path                      ('/ask'; MereO '/the-faith-received/ask/')
  //   libraryPath      the brand link                                    ('/')
  //   assetBase        where ask-worker.js / ask-jobs.js live            ('/'; MereO '/assets/js/port/')
  //   launcher         false → no floating Ask button (the host mounts its own door via FRAsk.open)
  //   nav              [[href,label],…] for the standalone page's site sections; false → none
  const CFG=Object.assign({apiBase:'/api',dataBase:'https://0ss8v4l06kodnhp0.public.blob.vercel-storage.com',readPath:'/read',askPath:'/ask',libraryPath:'/',assetBase:'/',launcher:true,nav:[['/','Library'],['/authors','Authors'],['/bible','Scripture'],['/topics','Topics'],['/search','Search'],['/pins','Notebooks'],['/desk','Desk']]},window.FRAskConfig||{});
  const S = FRChatStore, BASE = CFG.dataBase.replace(/\/$/,'');
  const ASK_PATH_RE=new RegExp('^'+CFG.askPath.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\/$/,'')+'(?:\\.html|/)?$');
  const modes = {
    ask: ['Ask', 'A concise answer from the texts. Choose Deep for a longer investigation.'],
    deep: ['Deep research', 'Gathers across the relevant texts, then quotes and explains them in depth. Saves progress after you close the browser. Up to 10 minutes per run; continue saved research if needed.'],
  };
  // Keep older conversations and entry points compatible without rewriting saved turns.
  const researchMode = mode => ['deep','agent','scan'].includes(mode) ? 'deep' : 'ask';
  const shelves = ['Latin Fathers','Greek Fathers','Eastern Fathers','Medieval','Roman Catholic','Continental Reformed','English Divines','Lutheran','Humanism and Law'];
  const scopeGroups=[{id:'westminster',name:'Westminster Divines',school:'Westminster Assembly'},{id:'puritan',name:'Puritans',party:'Puritan'},{id:'anglican',name:'Anglicans',party:'Anglican'}];
  const apiShelf = s => s === 'Continental Reformed' ? 'Reformed' : s;
  const shelfName = s => s === 'Reformed' ? 'Continental Reformed' : s;
  // Older turns used work-over-shelf precedence. Preserve their meaning on retry.
  // Printed shelf names only (MOFaithLabel, lib/faith-catalogue.js): "English Divines" shows as "English writers". Scope values stay the source names.
  function shownShelf(sh){return window.MOFaithLabel?window.MOFaithLabel.shelf(sh):sh;}
  function scopeShelves(s){return [...new Set((Array.isArray(s.shelves)?s.shelves:(s.works||[]).length?[]:s.tradition?[s.tradition]:[]).map(shelfName))];}
  function editableScope(s={}){return {...s,shelves:scopeShelves(s),authors:[...(s.authors||[])],groups:[...(s.groups||[])],works:[...(s.works||[])],tradition:''};}
  function scopeNeedsCatalog(s){const chosen=scopeShelves(s);return !!(s.groups||[]).length||!!(s.authors||[]).length||chosen.length>1||chosen.length===1&&!!(s.works||[]).length;}
  function compileScope(s,records,schools){
    for(const key of ['shelves','authors','works','groups'])if(s[key]!=null&&(!Array.isArray(s[key])||s[key].some(v=>typeof v!=='string'||!v.trim())))throw new Error('Some search selections are invalid. Open Search within and choose them again.');
    const chosen=scopeShelves(s),authors=new Set(s.authors||[]),works=new Set(s.works||[]),groups=[...new Set(s.groups||[])];
    if(groups.some(id=>!scopeGroups.some(g=>g.id===id)))throw new Error('A selected group is unavailable. Open Search within and choose it again.');
    if(chosen.some(sh=>!shelves.includes(sh)))throw new Error('A selected shelf is unavailable. Open Search within and choose it again.');
    if(chosen.length===1&&!authors.size&&!works.size&&!groups.length)return {tradition:apiShelf(chosen[0]),works:[]};
    if(chosen.length||authors.size||groups.length){
      if(!records?.length)throw new Error('The catalogue could not load to apply your selections. Your question is saved. Try again.');
      const foundShelves=new Set(),foundAuthors=new Set(),foundGroups=new Set();
      const parties=new Map(scopeGroups.filter(g=>groups.includes(g.id)&&g.party).map(g=>[g.party,g.id]));
      for(const w of records){if(!w.slug||w.slug.startsWith('@'))continue;const sh=shelfName(w.tradition),byAuthor=authors.has(w.author),group=parties.get(w.party);if(chosen.includes(sh)||byAuthor||group)works.add(w.slug);if(chosen.includes(sh))foundShelves.add(sh);if(byAuthor)foundAuthors.add(w.author);if(group)foundGroups.add(group);}
      for(const g of scopeGroups.filter(g=>groups.includes(g.id)&&g.school)){
        const slugs=schools?.[g.school]?.slugs;
        if(!Array.isArray(slugs)||!slugs.length||slugs.some(id=>typeof id!=='string'||!id.trim()))throw new Error('The Westminster group could not load. Your question is saved. Try again.');
        for(const slug of slugs)works.add(slug);foundGroups.add(g.id);
      }
      if(chosen.some(sh=>!foundShelves.has(sh))||[...authors].some(a=>!foundAuthors.has(a))||groups.some(g=>!foundGroups.has(g)))throw new Error('A search selection could not be found in the catalogue. Review Search within before sending.');
    }
    if([...works].some(w=>w.startsWith('@')&&!/^@(pld|pg|po|aq|eebo):.+$/.test(w)))throw new Error('A selected work is unavailable. Remove it from Search within and select it again.');
    // EEBO now belongs to the main work catalogue; both APIs accept its canonical slug.
    return {works:[...new Set([...works].map(w=>w.replace(/^@eebo:/,'eebo-')))]};
  }
  function scopeParts(s){const counts=[scopeShelves(s).length,(s.authors||[]).length,(s.works||[]).length,(s.groups||[]).length];return counts.map((n,i)=>n?n+' '+[['shelf','shelves'],['author','authors'],['work','works'],['group','groups']][i][n===1?0:1]:'').filter(Boolean);}
  function scopeButton(s){const parts=scopeParts(s);return parts.length>1?parts.reduce((n,p)=>n+Number(p.split(' ')[0]),0)+' selections':parts[0]||'Whole library';}
  const icons = {
    chat: '<path d="M20 11.5a8 8 0 0 1-8 8H5l-4 3v-11a8 8 0 0 1 8-8h3a8 8 0 0 1 8 8Z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>', send: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
    book: '<path d="M12 5v15M12 5C8 2 3 4 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-1 0-6-2-10 1Z"/>',
    chevron: '<path d="m7 10 5 5 5-5"/>', bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>', search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
    back: '<path d="m14 5-7 7 7 7"/>',
  };
  const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+icons[name]+'</svg>';
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  /* MereO delta: carry the quoted passage as ?hl= so the reader marks the
     line the answer quoted instead of only landing on its page (Ian,
     2026-09-14). The reader's hl handler does the work and already knows
     how to re-mark after its rebuilds. Truncation is safe because the
     match is by prefix: a short quote is still found whole. Re-apply when
     re-vendoring. The reader PATH is no longer patched here: it comes
     from CFG.readPath, which faith-ask-config.js sets. */
  const readURL = (slug,page,quote) => CFG.readPath+'?w='+encodeURIComponent(slug)+(quote?'&hl='+encodeURIComponent(String(quote).slice(0,300)):'')+(page == null || page === '' ? '' : '#b'+encodeURIComponent(String(page).split(/[–—,]|(?<=\d)-(?=\d)/)[0].trim())+'-0');
  function safeURL(value) { if(typeof value!=='string'||!value.trim())return ''; try { const u = new URL(value, location.origin); return ['http:','https:'].includes(u.protocol) ? u.href : ''; } catch (_) { return ''; } }
  let catalog = [], catalogBySlug = new Map(), catalogRevision = 0, catalogPromise, conversations = [], current = null, panel, port, worker, initPromise, renderTimer, draftTimer;
  const backgroundInert = new Map();
  let visible = false, historyFilter = '', showArchived = false, sourceURL = '', sourceTitle = '', focusBefore, workerKind = 'shared', legacyWarning = '', storageError = '';
  let sourceFocus = null, sourceRestore = 0, sourceReturning = false, sourceSequence=0, sourceChatPosition=null, sourceFocusRef=null, sourceReady=false, sourceStatusTimer=null;
  const sourcePositions = new Map(), sourceDocuments = new WeakSet();
  const replies = new Map(), pendingNotices = new Set();
  const sending = new Set();
  const updates = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fr-ask-updates') : null;
  const $ = sel => panel && panel.querySelector(sel);
  const selected = () => conversations.find(c => c.id === current);
  const running = c => c && (c.turns || []).find(t => t.status === 'running');
  const contextWork = () => new URLSearchParams(location.search).get('w') || window.__FR_SLUG__ || '';
  const dockMedia=matchMedia('(min-width:1100px)');let expandedReaderAsk=false;
  const readerPage=()=>!!document.getElementById('reading');
  /* MereO delta (Ian, 2026-09-21): a conversation belongs to the book on
     screen when it was started there or is scoped to it. Ask in the reader
     is about THIS book, so every path that reuses an existing conversation
     has to ask this question first — including the stored active one. */
  const belongsHere=c=>!readerPage()||c.contextWork===contextWork()||(c.scope?.works||[]).includes(contextWork());
  /* The catalogue does not carry the curated works (ANF and the Fathers
     set are absent from works-index.json), so titleOf falls back to the
     raw slug and the rail names the book "anf-justin-sole-government".
     The reader has already put the real title in #wt: use it. */
  const readerTitle=()=>readerPage()?(document.getElementById('wt')?.textContent||'').trim():'';
  const passagePrompt=(q,p)=>p&&p.text?q+'\n\nSelected passage from '+(p.cite||'the current book')+':\n'+p.text+'\nSource: '+(p.url||''):q;
  function syncPresentation(){
    if(!panel)return;const docked=visible&&readerPage()&&dockMedia.matches&&!expandedReaderAsk;
    document.documentElement.classList.toggle('fra-docked',docked);panel.classList.toggle('fra-docked',docked);
    panel.setAttribute('role',docked?'complementary':'dialog');if(docked)panel.removeAttribute('aria-modal');else panel.setAttribute('aria-modal','true');
    for(const [el,inert] of backgroundInert)el.inert=inert;backgroundInert.clear();
    if(visible&&!docked)for(const el of document.body.children){if(!['fra-workspace','fra-notices','fra-announcer'].includes(el.id)&&el.tagName!=='SCRIPT'){backgroundInert.set(el,el.inert);el.inert=true;}}
    $('#fra-reader-bar').hidden=!readerPage();$('#fra-expand').hidden=!readerPage()||!dockMedia.matches;$('#fra-expand').textContent=docked?'Expand Ask':'Beside the book';
    window.dispatchEvent(new CustomEvent('fr-ask-visibility',{detail:{open:visible,docked}}));
  }
  dockMedia.addEventListener('change',syncPresentation);
  const pagePath = () => location.hostname === '127.0.0.1' || location.hostname === 'localhost' ? '.html' : '';
  function localURL(url) { const u = new URL(url, location.origin); if (pagePath() && /^\/(read|search|desk|pins|bible|fathers|topics|web|dtc)$/.test(u.pathname)) u.pathname += '.html'; return u.href; }
  async function loadCatalog() {
    return catalogPromise || (catalogPromise = Promise.all([
      (window.__FR_LIBRARY_CATALOGUE__||fetch(BASE+'/v1/works-index.json').then(r=>{if(!r.ok)throw new Error();return r.json();})).catch(()=>fetch(BASE+'/v1/works-index.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error();return r.json();})),
      /* MereO delta (Ian, 2026-09-18): the owner's integration layer builds
         this as dataBase + '/data/embcat.json'. That is right for his Vercel
         Blob, where the file sits at the root, and wrong for a worker: ours
         serves it at /v1/data/embcat.json and answers the bare path with a
         404. The fetch swallows failures into {works:[]}, so the symptom is
         not an error, it is a catalogue that quietly loses every Patrologia,
         Patrologia Orientalis, Aquinas and EEBO work, leaving Search within
         able to offer only the TFR shelf. Verified 2026-09-18: /v1/data/…
         returns 1.25MB, the bare path returns 404. The blob branch is left
         exactly as he wrote it so his own site is unaffected. */
      fetch((BASE.includes('blob.vercel-storage.com')?'':BASE+'/v1')+'/data/embcat.json').then(r=>r.ok?r.json():{works:[]}).catch(()=>({works:[]}))
    ]).then(([main,embedded])=>{catalog=(main.works||[]).concat((embedded.works||[]).filter(w=>w.c!=='tfr').map(w=>({slug:'@'+w.c+':'+w.s,title:w.t,author:w.a,corpus:w.c})));catalogBySlug=new Map();for(const w of catalog)if(!catalogBySlug.has(w.slug))catalogBySlug.set(w.slug,w);catalogRevision++;return catalog;}).catch(()=>{catalogPromise=null;return [];}));
  }
  let schoolPromise;
  async function loadScopeSchools(){
    return schoolPromise||(schoolPromise=(window.__SCHOOLS?Promise.resolve(window.__SCHOOLS):fetch(BASE+'/v1/schools.json').then(r=>{if(!r.ok)throw Error();return r.json();})).catch(()=>{schoolPromise=null;return null;}));
  }
  function titleOf(s) { const w = catalogBySlug.get(s.slug); return s.t || s.title || s.work || s.cit || s.cite || (w && w.title) || s.slug || 'Source passage'; }
  function matchingWorks(query, limit = 14) {
    const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const words=fold(query).trim().split(/\s+/).filter(Boolean), matches=[];
    if(!words.length)return matches;
    for(const work of catalog){
      const text=fold((work.title||'')+' '+(work.author||'')+' '+(work.volume||''));
      if(words.every(word=>text.includes(word))){matches.push(work);if(matches.length>=limit)break;}
    }
    return matches;
  }
  function matchingAuthors(query){
    const fold=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),words=fold(query).trim().split(/\s+/).filter(Boolean),found=new Map();
    if(!words.length)return [];
    for(const w of catalog)if(!w.slug.startsWith('@')&&w.author&&words.every(q=>fold(w.author).includes(q)))found.set(w.author,(found.get(w.author)||0)+1);
    return [...found].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,3);
  }
  function scopeWorkTitle(slug){const work=catalogBySlug.get(slug);return titleOf({slug})+(work&&work.volume?' · '+work.volume:'');}
  /* MereO delta (Ian, 2026-09-15): open the work AT THE QUOTE.
     The worker's source objects carry slug, page and snippet — no `quote`
     and no `link` — so sourceHref fell through to readURL(slug, page,
     undefined), the &hl= was never added, and a citation landed on the
     right page with nothing marked on it. reader-core's markPhrase() has
     been waiting for that parameter all along.
     The quotation is already on screen: the answer prints it immediately
     before the citation. So it is taken from there, which also means the
     highlight is exactly the words the reader just read rather than a
     snippet the retriever happened to store.
     markPhrase needs whitespace and 24 characters before it will act, so
     anything shorter is not worth sending. Re-apply when re-vendoring.
     The call sites below pass it as sourceHref({...s,quote:said}) so the
     owner's sourceHref/sourceAttributes chain still owns the URL. */
  const QUOTE_CHARS = '"\u201C\u201D\u2018\u2019\u00AB\u00BB';
  function quoteBefore(text, idx) {
    if (typeof text !== 'string' || !(idx > 0)) return '';
    const before = text.slice(Math.max(0, idx - 1400), idx);
    // The citation has to sit right after the closing quote — a stray
    // trailing word or two, no more — or it is citing something else.
    const re = new RegExp('[' + QUOTE_CHARS + ']([^' + QUOTE_CHARS + ']{24,400})[' + QUOTE_CHARS + '][^' + QUOTE_CHARS + ']{0,24}$');
    const m = re.exec(before);
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
  }

  function sourceHref(s){return safeURL(s.link)||(typeof s.slug==='string'&&s.slug.trim()?readURL(s.slug,s.page,s.quote):'');}
  function sourceVisitURL(href,id=current){const u=new URL(href,location.origin);if(id&&u.origin===location.origin&&/^\/read(?:[/.]|$)/.test(u.pathname))u.searchParams.set('ask_chat',id);return localURL(u.href);}
  function sourceAttributes(href){return ' href="'+esc(sourceVisitURL(href))+'" target="_blank" rel="noopener noreferrer"';}
  function sourceCard(s){
    const href=sourceHref(s),tag=href?'a':'div';
    const cite=s.cit||s.cite||(s.page!=null?'p. '+s.page:href?'Read passage':'Source location unavailable');
    return '<div class="fra-source-row"><'+tag+(href?sourceAttributes(href)+' aria-label="Open source in a new tab: '+esc((s.author?s.author+' · ':'')+titleOf(s)+' · '+cite)+'"':'')+' class="fra-source"><span>'+(s.author?'<span class="fra-source-author">'+esc(s.author)+'</span>':'')+'<strong class="fra-source-name">'+esc(titleOf(s))+'</strong>'+(s.quote?'<q class="fra-source-quote">'+esc(s.quote)+'</q>':'')+'</span><small>'+esc(cite)+(href?' ↗':'')+'</small></'+tag+'>'+(href?'<button class="fra-source-preview" data-preview-source="'+esc(href)+'" data-preview-title="'+esc(titleOf(s))+'">Read here</button>':'')+'</div>';
  }
  // Ask interface patterns adapted to the existing engine. No simulated activity.
  function researchState(turn){
    if(!turn)return {kind:'idle',label:'Ready for a question'};
    if(turn.status==='running')return {kind:'running',label:humanStage(turn.stage||'Researching')};
    if(turn.status==='paused'||['paused','needs_input','limit_reached'].includes(turn.serverJob?.status))return {kind:'paused',label:'Research paused'};
    if(['error','interrupted','stopped'].includes(turn.status))return {kind:'attention',label:turn.status==='stopped'?'Research stopped':'Needs attention'};
    if(deliveryIncomplete(turn))return {kind:'attention',label:'Check answer delivery'};
    if(turn.status!=='complete')return {kind:'idle',label:'Waiting for research'};
    return {kind:'complete',label:researchMode(turn.mode)==='deep'?'Research complete':'Answer ready'};
  }
  function sourceGroups(sources){
    const groups=new Map();
    for(const [i,s] of sources.entries()){
      // Separate edition slugs stay separate, even when their displayed titles match.
      let key=s.slug;
      if(!key&&sourceHref(s)){const u=new URL(sourceHref(s),location.origin);u.hash='';for(const field of ['p','page','section','heading','hl','ask_chat'])u.searchParams.delete(field);u.searchParams.sort();key=u.href;}
      key=key||'unlocated-'+i;
      if(!groups.has(key))groups.set(key,{key,source:s,passages:[]});
      groups.get(key).passages.push(s);
    }
    return [...groups.values()];
  }
  // THE CHECK LINE (2026-09-24; the frontier report's move 5: say, on every answer, how often the cited page supports the
// sentence). The server's support check reads each cited sentence against its page; every quotation left in the answer passed
// the word-for-word check.
function checkHTML(t){
  const c=t&&t.status!=='running'&&t.check;if(!c||(!c.claims&&!c.quotes))return '';
  const n=(k,one,many)=>esc(k)+' '+(k===1?one:many);
  const parts=[];if(c.claims)parts.push(esc(c.supported)+' of '+n(c.claims,'cited statement','cited statements')+' supported'+(c.partial?' · '+esc(c.partial)+' in part':''));
  if(c.quotes)parts.push(n(c.quotes,'quotation','quotations')+' verified word for word');
  return '<p class="fra-coverage fra-check">Checked against the pages · '+parts.join(' · ')+
    (c.removed?' · '+n(c.removed,'unsupported citation','unsupported citations')+' removed':'')+
    (c.flags&&c.flags.length?' · '+n(c.flags.length,'statement','statements')+' marked in the answer':'')+'</p>';
}
  // THE WORKS FOUND SO FAR (2026-09-26; owner "fix 1-4"): while the research runs, the works it has met — so the first
  // seconds show the evidence gathering, not a status line alone. Each opens its work beside the conversation.
  function foundHTML(f){
    const n=(k,one,many)=>esc(k)+' '+(k===1?one:many);
    const chips=f.items.slice(0,8).map(x=>{const who=x.a?String(x.a).split(/[,(]/)[0].trim():'',label=(who?who+' · ':'')+x.w;
      return '<button type="button" class="fra-found-chip" data-preview-source="'+esc(readURL(x.s))+'" data-preview-title="'+esc(x.w)+'" title="'+esc((x.a?x.a+' · ':'')+x.w)+'">'+esc(label.length>60?label.slice(0,58).trim()+'…':label)+'</button>';}).join('');
    return '<div class="fra-found"><p class="fra-found-count">Found so far · '+n(f.works||f.items.length,'work','works')+(f.passages?' · '+n(f.passages,'passage','passages'):'')+'</p><div class="fra-found-chips">'+chips+((f.works||0)>8?'<span class="fra-found-more">and '+esc(f.works-8)+' more</span>':'')+'</div></div>';
  }
  // WHICH STATEMENTS THE CHECK COULD NOT FULLY CONFIRM (2026-09-26; owner "fix 1-4"): the server names each cited sentence the
  // page supports only in part, or that its judge could not confirm; the citation that closes that sentence is marked in place.
  function markFlags(answer,flags){
    answer.querySelectorAll('.fra-flag').forEach(x=>x.remove());
    answer.querySelectorAll('a.fra-cite.fra-cite-flagged').forEach(a=>{a.classList.remove('fra-cite-flagged');delete a.dataset.flag;});
    const fold=v=>String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    for(const f of flags||[]){
      const want=fold(f.s).split(' ').slice(0,7).join(' ');if(!want)continue;
      const chips=Array.from(answer.querySelectorAll('a.fra-cite[data-w="'+CSS.escape(f.w)+'"]')).filter(a=>citationKey(a.dataset.p)===citationKey(f.p));
      const hit=chips.find(a=>fold((a.closest('p,li,td')||a.parentNode).textContent).includes(want))||(chips.length===1?chips[0]:null);
      if(!hit||hit.classList.contains('fra-cite-flagged'))continue;
      hit.classList.add('fra-cite-flagged');hit.dataset.flag=f.v;
      const mark=document.createElement('span');mark.className='fra-flag';mark.dataset.v=f.v;mark.tabIndex=0;
      mark.textContent=f.v==='partial'?'in part':'unconfirmed';
      mark.title=f.v==='partial'?'The cited page supports only part of this statement.':'The check could not confirm this statement against the cited page.';
      mark.setAttribute('aria-label',mark.title);hit.after(mark);
    }
  }
  // CITATION PREVIEW (2026-09-26; owner "fix 1-4": "hovering over p. 314 could show the quoted passage and its Latin"). Hover or
  // keyboard focus on a page chip shows, from the library's own page files, the paragraph of that page the answer quotes —
  // the quotation marked — and beside it the Latin of the same paragraph. Touch keeps the plain link: tap still opens the page.
  const citePop={el:null,timer:0,hide:0,for:null,seq:0},pageFiles=new Map();
  function pageFile(url){if(!pageFiles.has(url))pageFiles.set(url,fetch(url).then(r=>r.ok?r.json():null).catch(()=>null));return pageFiles.get(url);}
  async function pageTexts(slug,page){
    const n=parseInt(String(page).replace(/^0+(?=\d)/,''),10);if(!slug||!Number.isFinite(n))return null;
    const base=BASE+'/v1/works/'+encodeURIComponent(slug)+'/',meta=await pageFile(base+'meta.json');
    const shard=meta&&(meta.shards||[]).find(x=>n>=+x.from&&n<=+x.to);if(!shard)return null;
    const data=await pageFile(base+shard.file),pg=data&&(data.pages||[]).find(x=>+x.n===n);
    return pg?{la:String(pg.la||''),en:String(pg.en||'')}:null;
  }
  function foldIndex(text){const out=[],map=[];for(let i=0;i<text.length;i++){const c=text[i].normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();for(const ch of c){if(/[a-z0-9]/.test(ch)){out.push(ch);map.push(i);}else if(out.length&&out[out.length-1]!==' '){out.push(' ');map.push(i);}}}return {s:out.join(''),map};}
  function citeQuote(a){
    const block=a.closest('p,li,td')||a.parentNode,prev=block&&block.previousElementSibling;
    if(prev&&prev.tagName==='BLOCKQUOTE'&&block.textContent.length<300)return prev.textContent.trim();
    const r=document.createRange();r.setStart(block,0);r.setEndBefore(a);const before=r.toString().trim();
    const parts=before.split(/(?<=[.!?;:])\s+(?=\S)/);return (parts[parts.length-1]||before).trim();
  }
  function quotedParagraph(texts,quote){
    const en=texts.en.split('\n').map(x=>x.trim()).filter(Boolean),la=texts.la.split('\n').map(x=>x.trim()).filter(Boolean);
    const q=foldIndex(quote.replace(/^[“"']|[”"']$/g,'')).s.trim(),head=q.split(' ').slice(0,8).join(' '),tail=q.split(' ').slice(-6).join(' ');
    let at=-1,from=-1,to=-1;
    for(let i=0;i<en.length&&at<0;i++){const f=foldIndex(en[i]),k=head.length>=12?f.s.indexOf(head):-1;if(k>=0){at=i;from=f.map[k];const e=tail.length>=10?f.s.indexOf(tail,k):-1;to=e>=0?f.map[Math.min(f.map.length-1,e+tail.length-1)]+1:Math.min(en[i].length,from+quote.length);}}
    if(at<0){let best=0;const want=new Set(q.split(' ').filter(w=>w.length>3));for(let i=0;i<en.length;i++){const have=new Set(foldIndex(en[i]).s.split(' '));let hits=0;want.forEach(w=>{if(have.has(w))hits++;});if(hits>best){best=hits;at=i;}}if(!want.size||best<Math.max(3,want.size*0.4))at=-1;}
    if(at<0)return null;
    let latin='';
    if(la.length){const i=la.length===en.length?at:Math.min(la.length-1,Math.round(at*(la.length/Math.max(1,en.length))));latin=la[i];if(latin.length>700){const mid=Math.round((from>=0?from/Math.max(1,en[at].length):0.5)*latin.length);latin=(mid>350?'… ':'')+latin.slice(Math.max(0,mid-350),mid+350).trim()+(mid+350<latin.length?' …':'');}}
    return {en:en[at],from,to,latin};
  }
  function citeSource(a){
    const turn=a.closest('[data-turn]'),c=selected(),t=c&&turn&&c.turns.find(x=>x.id===turn.dataset.turn);
    return t&&(t.src||[]).find(s=>s.slug===a.dataset.w&&citationKey(s.page)===citationKey(a.dataset.p))||null;
  }
  function hideCite(){clearTimeout(citePop.timer);clearTimeout(citePop.hide);if(citePop.el)citePop.el.hidden=true;if(citePop.for)citePop.for.removeAttribute('aria-describedby');citePop.for=null;}
  function placeCite(a){
    const pop=citePop.el,r=a.getBoundingClientRect(),w=Math.min(460,innerWidth-24);pop.style.width=w+'px';
    const h=pop.offsetHeight,below=innerHeight-r.bottom>h+16||r.top<h+16;
    pop.style.left=Math.max(12,Math.min(innerWidth-w-12,r.left-24))+'px';pop.style.top=(below?r.bottom+8:r.top-h-8)+'px';
  }
  async function showCite(a){
    clearTimeout(citePop.hide);if(citePop.for===a&&citePop.el&&!citePop.el.hidden)return;
    if(!citePop.el){citePop.el=document.createElement('div');citePop.el.className='fra-citepop';citePop.el.id='fra-citepop';citePop.el.setAttribute('role','dialog');citePop.el.setAttribute('aria-label','Cited page');panel.appendChild(citePop.el);}
    const s=citeSource(a),href=a.getAttribute('href')||'',title=s?titleOf(s):(a.getAttribute('title')||'').replace(/^Open source in a new tab:\s*/,''),author=s&&s.author||'';
    const seq=++citePop.seq;citePop.for=a;a.setAttribute('aria-describedby','fra-citepop');
    const head='<p class="fra-citepop-head">'+(author?'<strong>'+esc(author)+'</strong> · ':'')+'<em>'+esc(title)+'</em> · '+esc(a.textContent.trim())+'</p>';
    const actions='<div class="fra-citepop-actions"><button type="button" data-preview-source="'+esc(href)+'" data-preview-title="'+esc(title)+'">Read here</button><a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">Open page ↗</a></div>';
    citePop.el.innerHTML=head+'<div class="fra-citepop-body"><p class="fra-citepop-wait">Reading the page…</p></div>'+actions;citePop.el.hidden=false;placeCite(a);
    // never left on "Reading the page…": a page that has not arrived in eight seconds, or a failure, falls back to the source's own excerpt
    let texts=null;try{texts=await Promise.race([pageTexts(a.dataset.w,a.dataset.p),new Promise(r=>setTimeout(()=>r(null),8000))]);}catch(_){texts=null;}
    if(seq!==citePop.seq||citePop.for!==a)return;
    let hit=null;try{hit=texts&&quotedParagraph(texts,citeQuote(a));}catch(_){hit=null;}
    let body;
    if(hit){const en=hit.from>=0?esc(hit.en.slice(0,hit.from))+'<mark>'+esc(hit.en.slice(hit.from,hit.to))+'</mark>'+esc(hit.en.slice(hit.to)):esc(hit.en);
      body='<p class="fra-citepop-en">'+en+'</p>'+(hit.latin?'<p class="fra-citepop-la" lang="la"><span>Latin</span>'+esc(hit.latin)+'</p>':'');}
    else{const excerpt=texts?(texts.en||texts.la).slice(0,420):(s&&s.quote||'');body=excerpt?'<p class="fra-citepop-en">'+esc(excerpt)+(excerpt.length>=420?'…':'')+'</p><p class="fra-citepop-note">The quoted words were not found on this page; its opening is shown.</p>':'<p class="fra-citepop-note">The page text is not available here. Open the page to read it.</p>';}
    citePop.el.querySelector('.fra-citepop-body').innerHTML=body;placeCite(a);
  }
  function bindCitePreview(){
    const hover=matchMedia('(hover: hover) and (pointer: fine)');
    panel.addEventListener('pointerover',e=>{if(!hover.matches)return;if(e.target.closest('.fra-citepop')){clearTimeout(citePop.hide);return;}const a=e.target.closest('a.fra-cite[data-w]');if(!a)return;clearTimeout(citePop.hide);clearTimeout(citePop.timer);citePop.timer=setTimeout(()=>showCite(a),220);});
    panel.addEventListener('pointerout',e=>{if(!e.target.closest('a.fra-cite[data-w],.fra-citepop'))return;const to=e.relatedTarget;if(to&&to.closest&&(to.closest('.fra-citepop')||(citePop.for&&to.closest('a.fra-cite')===citePop.for)))return;clearTimeout(citePop.timer);citePop.hide=setTimeout(hideCite,260);});
    panel.addEventListener('focusin',e=>{const a=e.target.closest('a.fra-cite[data-w]');if(a)showCite(a);else if(!e.target.closest('.fra-citepop'))hideCite();});
    panel.addEventListener('keydown',e=>{if(e.key==='Escape'&&citePop.el&&!citePop.el.hidden){const a=citePop.for;hideCite();a&&a.focus();e.stopPropagation();}},true);
    panel.addEventListener('scroll',()=>{if(citePop.el&&!citePop.el.hidden)hideCite();},true);
    panel.addEventListener('click',e=>{if(e.target.closest('.fra-citepop [data-preview-source]'))setTimeout(hideCite,0);});
  }
  function sourceCollectionHTML(sources,cited=[]){
    // THE WORKS THE ANSWER CITES COME FIRST (2026-09-26; owner "fix 1-4"): the three receipts used to be the first three works
    // the research gathered — Perkins, Pareus, Gerhard over an answer built on Rainolds and Chamier. `cited` is the answer's own
    // citation order (its chips' works); the receipts are the first cited works, and the full list opens with them.
    const all=sourceGroups(sources),rank=new Map(cited.map((w,i)=>[w,i])),isCited=g=>rank.has(g.source&&g.source.slug);
    const citedGroups=all.filter(isCited).sort((a,b)=>rank.get(a.source.slug)-rank.get(b.source.slug));
    const groups=[...citedGroups,...all.filter(g=>!isCited(g))];
    // a volume shows beside its title, so two volumes of one work do not read as the same receipt twice (Rainolds, Censura I and II)
    const label=s=>{const v=catalogBySlug.get(s.slug)?.volume;return titleOf(s)+(v&&!titleOf(s).includes(v)?' · '+v:'');};
    const receipts=(citedGroups.length?citedGroups:groups).slice(0,3).map(g=>{const s=g.source,href=sourceHref(s);return href?'<button class="fra-receipt" data-preview-source="'+esc(href)+'" data-preview-title="'+esc(titleOf(s))+'">'+icon('book')+'<span><strong>'+esc(label(s))+'</strong><small>'+esc(s.author||catalogBySlug.get(s.slug)?.author||s.cit||s.cite||'Read source')+'</small></span>'+icon('chevron')+'</button>':'';}).join('');
    return '<div class="fra-receipts" aria-label="Source previews">'+receipts+'</div><details class="fra-sources"><summary><span>All sources</span><small>'+sources.length+' passage'+(sources.length===1?'':'s')+' · '+groups.length+' work'+(groups.length===1?'':'s')+(citedGroups.length?' · '+citedGroups.length+' cited':'')+'</small></summary><div class="fra-source-groups">'+groups.map((g,i)=>'<details class="fra-source-work"'+(i===0?' open':'')+'><summary><span>'+esc(label(g.source))+'</span><small>'+g.passages.length+' passage'+(g.passages.length===1?'':'s')+(isCited(g)?' · cited':'')+'</small></summary>'+g.passages.map(sourceCard).join('')+'</details>').join('')+'</div></details>';
  }
  function commandMatches(query,items){
    const fold=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const words=fold(query).trim().split(/\s+/).filter(Boolean);
    return items.filter(item=>words.every(w=>fold(item.label+' '+item.detail).includes(w))).slice(0,12);
  }
  let commandItems=[],commandIndex=0,commandFocus=null;
  function renderCommands(){
    const actions=[
      {id:'new',label:'New conversation',detail:'Start a new question'},
      {id:'scope',label:'Search within',detail:'Choose shelves, authors or works'},
      {id:'mode',label:'Research mode',detail:'Ask or Deep research'},
      {id:'history',label:'Browse conversations',detail:'Search saved questions'},
      {id:'library',label:'Open library',detail:'Return to the works'}
    ];
    const chats=conversations.filter(c=>!c.archived&&(c.turns.length||String(c.draft||'').trim())).map(c=>({id:'chat:'+c.id,label:c.t,detail:folderOf(c)||'Conversation'}));
    const query=$('#fra-command-input').value;
    commandItems=commandMatches(query,query.trim()?[...chats,...actions]:[...actions,...chats]);commandIndex=0;
    $('#fra-command-results').innerHTML=commandItems.length?commandItems.map((item,i)=>'<button type="button" role="option" id="fra-command-option-'+i+'" data-command="'+esc(item.id)+'" tabindex="-1" aria-selected="'+(i===0)+'">'+icon(item.id.startsWith('chat:')?'chat':item.id==='new'?'plus':item.id==='library'?'book':'search')+'<span><strong>'+esc(item.label)+'</strong><small>'+esc(item.detail)+'</small></span><span class="fra-command-enter" aria-hidden="true">↵</span></button>').join(''):'<p class="fra-command-empty">No matching conversations or actions.</p>';
    $('#fra-command-input').setAttribute('aria-expanded','true');
    if(commandItems.length)$('#fra-command-input').setAttribute('aria-activedescendant','fra-command-option-0');else $('#fra-command-input').removeAttribute('aria-activedescendant');
    $('#fra-command-count').textContent=commandItems.length+' result'+(commandItems.length===1?'':'s');
  }
  function openCommands(){
    const dialog=$('#fra-command-dialog');if(dialog.open)return;
    commandFocus=document.activeElement;$('#fra-command-input').value='';renderCommands();dialog.showModal();$('#fra-command-input').focus();
  }
  function closeCommands(restore=true){if(!restore)commandFocus=null;const d=$('#fra-command-dialog');if(d?.open)d.close();}
  async function runCommand(id){
    closeCommands(false);
    if(id.startsWith('chat:')){await switchChat(id.slice(5));$('#fra-input').focus();return;}
    if(id==='history'){showConversations();return;}
    const targets={new:'fra-new',scope:'fra-scope-toggle',mode:'fra-mode-toggle',library:'fra-home'};
    if(targets[id])$('#'+targets[id]).click();
  }
  function bindCommands(){
    const dialog=$('#fra-command-dialog'),input=$('#fra-command-input');
    input.addEventListener('input',renderCommands);
    dialog.addEventListener('close',()=>{input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');if(commandFocus?.isConnected)commandFocus.focus({preventScroll:true});});
    dialog.addEventListener('click',e=>{const b=e.target.closest('[data-command]');if(b){runCommand(b.dataset.command).catch(error=>toast(error.message));return;}if(e.target===dialog||e.target.closest('[data-command-close]'))closeCommands();});
    dialog.addEventListener('keydown',e=>{
      e.stopPropagation();
      if(e.key==='Escape'){e.preventDefault();closeCommands();return;}
      if(e.target!==input)return;
      if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)&&commandItems.length){e.preventDefault();commandIndex=e.key==='Home'?0:e.key==='End'?commandItems.length-1:(commandIndex+(e.key==='ArrowDown'?1:-1)+commandItems.length)%commandItems.length;dialog.querySelectorAll('[role=option]').forEach((b,i)=>b.setAttribute('aria-selected',String(i===commandIndex)));const selected=$('#fra-command-option-'+commandIndex);input.setAttribute('aria-activedescendant',selected.id);selected.scrollIntoView({block:'nearest'});}
      if(e.key==='Enter'&&commandItems.length){e.preventDefault();runCommand(commandItems[commandIndex].id).catch(error=>toast(error.message));}
    });
    document.addEventListener('keydown',e=>{if(visible&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();e.stopImmediatePropagation();if(dialog.open)closeCommands();else openCommands();}},true);
  }

  function citationKey(value){return String(value??'').replace(/^[[(]|[\])]$/g,'').trim().replace(/\b(PL|PG|PO)\s*(\d+)\s*[:·]\s*0*(\d+)([a-z]*)/gi,(_,ns,v,c,suffix)=>ns.toUpperCase()+' '+BigInt(v)+':'+BigInt(c)+suffix.toUpperCase()).replace(/^\d+$/,n=>String(BigInt(n)));}
  function inline(text, sources) {
    const held = [];
    const hold = html => '\u0001'+(held.push(html)-1)+'\u0002';
    let out = String(text).replace(/\\([\\`*_[\]<>])/g, (_, literal) => hold(esc(literal))).replace(/\[((?:[a-zA-Z0-9_-]+\/p[^,;\]\s]+\s*[,;]\s*)+[a-zA-Z0-9_-]+\/p[^,;\]\s]+)\]/g,(_,group)=>group.split(/\s*[,;]\s*/).map(cite=>'['+cite+']').join(', ')).replace(/\[([^\]\n]+)\]\(([^\s)]+)\)/g, (_, label, href) => {
      const safe = safeURL(href); return safe ? hold('<a'+sourceAttributes(safe)+'>'+esc(label)+'</a>') : label;
    });
    out = out.replace(/\[([a-zA-Z0-9_-]+)\/p([^\]\s]+)\]|\[W\s*([a-zA-Z0-9_-]+):([^\]\s]+)\]/g, (_, a, p, b, q, at, whole) => {
      const slug = a || b, page = p || q, s = sources.find(s => s.slug === slug && [s.page,...(s.anchors||[])].some(n=>citationKey(n)===citationKey(page)));
      /* MereO delta (Ian, 2026-09-22): real citations were rendering as
         "Unverified reference". The tool paths list only the pages the model
         opened in full as sources, but the model may also cite a page it saw
         in a search result, so a correct [slug/pN] to a work the library
         holds found no match and lost its link. A work in the catalogue is a
         real address: link it, and say in the title that the page was not
         among the passages sent with the answer. Only a work the catalogue
         does not know stays "Unverified reference". */
      if(!s){const w=catalogBySlug.get(slug);if(!w)return hold('<span class="fra-unverified-cite" title="This reference was not supplied with the answer">Unverified reference</span>');const href=readURL(slug,page,quoteBefore(whole,at));return hold('<a class="fra-cite fra-cite-unsent"'+sourceAttributes(href)+' data-w="'+esc(slug)+'" data-p="'+esc(String(page))+'" title="Open in a new tab: '+esc((w.author?w.author+' · ':'')+(w.title||slug))+'. This page was not among the passages sent with the answer, so check it against the claim.">'+esc('p. '+page)+'</a>');}
      // MereO delta (see quoteBefore above): the words just quoted become ?hl=.
      const said = s.quote || quoteBefore(whole, at);
      return hold('<a class="fra-cite"'+sourceAttributes(sourceHref({...s,quote:said}))+' data-w="'+esc(s.slug)+'" data-p="'+esc(String(s.page))+'" title="Open source in a new tab: '+esc((s.author?s.author+' · ':'')+titleOf(s))+'">'+esc(s.cit || s.cite || ('p. '+page))+'</a>');
    });
    // MereO delta (see quoteBefore above): ?hl= here too, so a bare [PL 32:659]
    // chip opens the column at the sentence the answer just quoted.
    out=out.replace(/\[([^\]\n]+)\]|\(((?:PL|PG|PO)\s*\d+\s*:\s*\d+[a-z]?)\)/g,(all,bracket,paren,at,whole)=>{const label=bracket||paren,src=sources.find(s=>citationKey(s.cit||s.cite)===citationKey(label));const said=src&&(src.quote||quoteBefore(whole,at));const href=src&&sourceHref({...src,quote:said});return href?hold('<a class="fra-cite"'+sourceAttributes(href)+(src.slug?' data-w="'+esc(src.slug)+'" data-p="'+esc(String(src.page??''))+'"':'')+' title="Open source in a new tab: '+esc((src.author?src.author+' · ':'')+titleOf(src))+'">'+esc(label)+'</a>'):all;});
    /* MereO delta (unmarked in the old copy, kept deliberately): ***both***
       renders as bold italic, and a stray run of asterisks the model leaves
       behind is dropped rather than printed. Upstream handles ** and * only,
       so without these two an answer shows literal asterisks to the reader. */
    return esc(out).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*\*([^*]+)\*\*\*/g,'<strong><em>$1</em></strong>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>').replace(/\*{2,}/g,'').replace(/\u0001(\d+)\u0002/g, (_, n) => held[+n]);
  }
  function markdown(text, sources = []) {
    /* MereO delta (Ian, 2026-09-22: "fix the duplicate tag too"): a line of
       nothing but page tags that the line above already ends with is the same
       citation twice, and painted a second chip under the quotation. The
       worker now drops it (polishAnswer, mo-workers ca41261); this also
       cleans answers already saved in the browser. A tag directly under a
       quotation, or a different tag, stays. */
    const lines = String(text || '').split('\n');
    for (let i = lines.length - 1; i > 0; i--) {
      const tags = /^\s*((?:\[[^\]\s]+\/p[^\]\s]+\][\s,;]*)+)$/.exec(lines[i]); if (!tags) continue;
      let j = i - 1; while (j >= 0 && !lines[j].trim()) j--;
      if (j < 0 || /^\s{0,3}>/.test(lines[j])) continue;
      if ((tags[1].match(/\[[^\]\s]+\]/g) || []).every(tag => lines[j].includes(tag))) lines.splice(j + 1, i - j);
    }
    const out = []; let list = '', code = false, codeLines = [], codeLang = '', paragraph = [];
    /* MereO delta: keep the fence's language, and turn a mermaid fence
       into a diagram node for assets/js/lib/faith-diagrams.js to render
       (Ian, 2026-09-14). Everything else is still a code block, and an
       UNCLOSED fence stays a code block on purpose: an answer is
       re-rendered on every streamed delta, so a diagram half-written is
       not yet a diagram. Re-apply when re-vendoring. */
    /* A fence is a diagram if it SAYS mermaid or if it READS as mermaid.
       The prompt asks for ```mermaid and the model writes a bare ``` with
       a perfectly good `flowchart TD` inside it often enough that trusting
       the tag alone shipped a diagram as a code block (Ian, 2026-09-14).
       The grammar is the more reliable signal of the two, so either will
       do. MODiagrams owns the list of kinds, and its ALLOWED matches only
       a diagram keyword at the very start of the block; anything it does
       not recognise stays a code block, and anything that turns out not to
       parse falls back to showing this same source. */
    const looksLikeDiagram = body => !!(window.MODiagrams && window.MODiagrams.ALLOWED.test(body));
    const block = (lang, body) => body.trim() && (lang === 'mermaid' || (!lang && looksLikeDiagram(body)))
      ? '<div class="fra-diagram" data-diagram="'+esc(body)+'"></div>'
      : '<pre><code>'+esc(body)+'</code></pre>';
    const flush = () => { if (paragraph.length) { out.push('<p>'+inline(paragraph.join('\n'),sources).replace(/\n/g,'<br>')+'</p>'); paragraph=[]; } };
    const closeList = () => { if (list) { out.push('</'+list+'>'); list=''; } };
    for (let i=0;i<lines.length;i++) {
      const l=lines[i];
      if (/^```/.test(l)) { flush(); closeList(); if(code){out.push(block(codeLang,codeLines.join('\n')));codeLines=[];codeLang='';}else{codeLang=l.slice(3).trim().toLowerCase();}code=!code;continue; }
      if(code){codeLines.push(l);continue;}
      if (l.includes('|') && i+1<lines.length && /^\s*\|?\s*:?-{3}/.test(lines[i+1])) {
        flush();closeList();const cells=x=>x.replace(/^\s*\||\|\s*$/g,'').split('|');
        out.push('<div class="fra-table" tabindex="0" role="region" aria-label="Answer table"><table><thead><tr>'+cells(l).map(c=>'<th>'+inline(c.trim(),sources)+'</th>').join('')+'</tr></thead><tbody>');i++;
        while(i+1<lines.length&&lines[i+1].includes('|'))out.push('<tr>'+cells(lines[++i]).map(c=>'<td>'+inline(c.trim(),sources)+'</td>').join('')+'</tr>');out.push('</tbody></table></div>');continue;
      }
      /* MereO delta (Ian, 2026-09-15): allow up to three spaces before the
         marker. CommonMark does, and the model indents its quotations
         under the list item they belong to, so the strict /^>/ left every
         one of them as a literal "> " in the middle of a paragraph.
         EXTENDED 2026-09-22 (upstream has the same change, tfr-backend
         tools/ask_workspace/ask-workspace.js): the model also indents a
         quotation four spaces or more ('    > "whose body and blood …"' in the
         Real Presence answer) or opens it inside a list item ("2. > …"),
         and both still showed a literal ">". Any indent now, and a list-held
         quotation is a quotation. Do not narrow this back to / {0,3}>/. */
      const q=/^\s*(?:(?:[-*]|\d+[.)])\s+)?>\s?/.exec(l);
      if(q){
        flush();closeList();const quoted=[l.slice(q[0].length)];
        while(i+1<lines.length&&/^\s*>\s?/.test(lines[i+1]))quoted.push(lines[++i].replace(/^\s*>\s?/,''));
        out.push('<blockquote>'+quoted.join('\n').split(/\n\s*\n/).map(p=>'<p>'+inline(p,sources).replace(/\n/g,'<br>')+'</p>').join('')+'</blockquote>');
        continue;
      }
      const h=/^(#{1,6})\s+(.+)$/.exec(l), li=/^\s*([-*]|\d+[.)])\s+(.+)$/.exec(l);
      if(h){flush();closeList();out.push('<h3>'+inline(h[2],sources)+'</h3>');}
      else if(li){flush();const kind=/\d/.test(li[1])?'ol':'ul';if(list!==kind){closeList();list=kind;const ordinal=kind==='ol'?Number(li[1].replace(/[.)]$/,'')):1;out.push('<'+kind+(ordinal!==1?' start="'+ordinal+'"':'')+'>');}out.push('<li>'+inline(li[2],sources)+'</li>');}
      else if(!l.trim()||/^\s*[-*_]{3,}\s*$/.test(l)){flush();closeList();}
      else{closeList();paragraph.push(l);}
    }
    flush();closeList();if(codeLines.length)out.push('<pre><code>'+esc(codeLines.join('\n'))+'</code></pre>');return out.join('');
  }
  function announce(text) { const node=document.getElementById('fra-announcer');if(node)node.textContent=text; }
  function toast(text, id) {
    const host=document.getElementById('fra-notices');if(!host)return;
    const n=document.createElement('div');n.className='fra-toast';
    const b=document.createElement('button');b.textContent=text;b.onclick=()=>{if(id)open({id});n.remove();};
    const close=document.createElement('button');close.className='fra-icon';close.innerHTML=icon('close');close.setAttribute('aria-label','Dismiss notification');close.onclick=()=>n.remove();
    n.append(b,close);host.append(n);announce(text);setTimeout(()=>n.remove(),15000);
  }
  function rpc(type, payload = {}) {
    const rid=S.id();return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{replies.delete(rid);reject(new Error('The research connection did not respond. Reload and retry.'));},12000);
      replies.set(rid,{resolve,reject,timer});port.postMessage({type,rid,...payload});
    });
  }
  async function migrate() {
    const existing=await S.all(), ids=new Set(existing.map(c=>c.id));
    // DELETED conversations are tombstoned in meta; every legacy import below treats them as present so they never resurrect (owner 2026-09-13).
    for(const id of await deletedIds())ids.add(id);
    for(const c of existing)if(c.turns.some(t=>/^\s*\(synthesis failed\)\s*$/i.test(t.a||'')&&t.status==='complete'))await S.update(c.id,c=>{for(const t of c.turns)if(/^\s*\(synthesis failed\)\s*$/i.test(t.a||'')){t.status='error';t.error='This saved scan did not produce a report. Retry with Deep research.';}c.unread=true;});
    let old=[];try{old=(JSON.parse(localStorage.getItem('fr_chats')||'{}').chats)||[];}catch(_){}if(!Array.isArray(old))old=[];old=old.filter(c=>c&&Array.isArray(c.turns));
    for(const c of old)if(c&&c.id&&!ids.has(c.id)){
      await S.put({id:c.id,t:c.t||'Conversation',ts:c.ts||Date.now(),mode:'ask',scope:{works:[]},contextWork:c.w||'',turns:(c.turns||[]).map(t=>({...t,id:t.id||S.id(),status:t.status||'complete',src:t.src||[],mode:t.mode||'ask'}))});ids.add(c.id);
    }
    for(const legacy of old)if(legacy&&ids.has(legacy.id)){
      await S.update(legacy.id,c=>{if(!c.contextWork&&legacy.w)c.contextWork=legacy.w;for(const t of legacy.turns||[]){if(t.q&&t.a&&!/^\s*\(synthesis failed\)\s*$/i.test(t.a)&&!c.turns.some(x=>x.q===t.q&&x.a===t.a))c.turns.push({...t,id:t.id||S.id(),status:t.status||'complete',src:t.src||[],mode:t.mode||'ask'});}});
    }
    // Each independent old landing answer becomes an honest single-turn conversation.
    let hist=[];try{hist=JSON.parse(localStorage.getItem('fr_ask_history')||'[]');}catch(_){}if(!Array.isArray(hist))hist=[];hist=hist.filter(h=>h&&typeof h.q==='string');
    for(const h of hist){const id='legacy-ask-'+h.ts;if(!ids.has(id)&&h.q){await S.put({id,t:h.q.slice(0,90),ts:h.ts||0,mode:h.sc&&h.sc.agent?'agent':h.sc&&h.sc.deep?'deep':'ask',scope:{works:[]},turns:[{id:id+'-turn',q:h.q,a:h.a||'',src:h.s||[],ts:h.ts,status:'complete'}]});ids.add(id);}}
    let research=[];try{research=JSON.parse(localStorage.getItem('fr_research')||'[]');}catch(_){}if(!Array.isArray(research))research=[];research=research.filter(r=>r&&typeof r.brief==='string');
    for(const r of research){const id='legacy-'+r.id;if(!ids.has(id)){await S.put({id,t:r.title||r.brief,ts:r.ts||0,mode:'deep',scope:{works:r.works||[]},turns:[{id:id+'-turn',q:r.brief,a:r.md||'',src:(r.evidence||[]).map(e=>({slug:e.slug,page:e.page,t:e.work})),evidence:r.evidence,stats:r.stats,status:'complete',mode:'scan'},...(r.thread||[]).map(t=>({id:S.id(),q:t.q,a:t.a,src:[],status:'complete',mode:'scan'}))]});ids.add(id);}}
  }
  async function mirror() {
    // Compatibility snapshot only. IndexedDB is authoritative and is never truncated here.
    const list=conversations.filter(c=>!c.archived&&c.turns.length).slice(0,40).map(c=>({id:c.id,t:c.t,ts:c.ts,folder:folderOf(c)||undefined,w:c.contextWork||(c.scope.works||[])[0]||'',turns:c.turns.filter(t=>t.status==='complete').map(t=>({q:t.q,a:t.a,src:t.src,graph:t.graph,ts:t.ts,mode:t.mode,passage:t.passage}))}));
    try{localStorage.setItem('fr_chats',JSON.stringify({v:2,chats:list}));if(window._frSyncChats)window._frSyncChats({v:2,chats:list});legacyWarning='';window.dispatchEvent(new Event('fr-conversations-updated'));}
    catch(_){legacyWarning='Full conversations are saved here. Desk export is full; download a conversation to keep a separate copy.';}
  }
  // One arrival path for every finished answer: chat answers (the worker's 'finished' broadcast, os:true keeps the opt-in
  // OS notice) and deep-research jobs (the job watcher's leave-running transition, os:false — inside the app only:
  // toast, unread mark, live-region announcement).
  /* MereO delta (Ian, 2026-09-21): "make sure that there is a usage meter
     on every instance of chat that shows usage for that user."

     There was none on any live instance. A meter exists in the theme, but
     it belongs to faith-ask.js and _ask-panel.hbs, the single-shot panel
     this workspace replaced on 2026-09-14, and no template renders that
     partial any more. This file is the Ask that actually runs, on the
     reader, the Bible, Connections, the desk, search, the author rooms
     and the research page, and it never asked the worker how much of
     anything the reader had used.

     IT PRINTS WHAT THE SERVER SAYS AND NOTHING ELSE. No cap is written
     here. The quota lives in the worker, and a number hardcoded in a
     client is a number that goes stale the first time the worker changes
     its mind, while still looking authoritative on screen.

     IT HIDES RATHER THAN GUESSES. No `mine`, no numeric `used`, no cap
     above zero, or a failed request: the meter stays hidden. A meter
     reading "0 of 0" is worse than no meter, and GET /ask/usage is
     member-gated, so a signed-out reader legitimately has nothing to
     show. Same rule faith-ask.js used.

     Shape, from that renderer and confirmed against the library
     worker's own /v1/ask/usage: {mine:{used,cap,unavailable}|null,
     global:{pctUsed,resetsAt,unavailable}}. */
  async function loadUsage(){
    const el=document.getElementById('fra-usage');
    if(!el)return;
    const url=CFG.apiBase+'/ask/usage';
    let data=null;
    try{
      /* The same bearer the spending route gets. MOAuth.fetch attaches it
         and refuses a host that is not on the page's allowlist; tokenFor
         is the fallback the send path uses for the SharedWorker case. */
      let res;
      if(window.MOAuth&&window.MOAuth.fetch)res=await window.MOAuth.fetch(url);
      else{
        const tok=window.MOAuth&&window.MOAuth.tokenFor?await window.MOAuth.tokenFor(url):null;
        res=await fetch(url,tok?{headers:{Authorization:'Bearer '+tok}}:undefined);
      }
      if(res&&res.ok)data=await res.json();
    }catch(_){ /* a meter is not worth an error; it stays hidden */ }
    const mine=data&&data.mine;
    // A number is the whole requirement. A cap is not: an uncapped
    // account still has a count worth showing, and hiding the meter
    // from the people who administer the feature is how it went
    // unnoticed that there was no meter at all.
    if(!mine||mine.unavailable||typeof mine.used!=='number'){
      el.hidden=true;
      return;
    }
    el.hidden=false;
    const used=Math.max(0,mine.used);
    const cap=mine.cap>0?mine.cap:null;
    const text=document.getElementById('fra-usage-text');
    const fill=document.getElementById('fra-usage-fill');
    const bar=el.querySelector('.fra-usage-bar');
    if(cap===null){
      /* MereO delta (Ian, 2026-09-21): "Put the meter on my account too,
         just not the cap." Uncapped accounts report used with cap null.
         The bar is hidden rather than drawn empty or full: a bar with no
         denominator is a picture of a limit that does not exist. */
      /* Ian: "I thought it'd be more like a bar that fills up."
       *
       * On a capped account it is one, below. On an uncapped one his own
       * usage has no denominator, so there is nothing to fill: a bar
       * would be a drawing of a limit that does not exist.
       *
       * But a real ceiling does apply to him, and it is the one that
       * actually bites: GLOBAL_DAILY_BUDGET_USD, the library's shared
       * spend for the day. budget.js says so in as many words, that it
       * "is now the binding constraint rather than this per-member cap",
       * and that when it is hit every reader is blocked until UTC
       * midnight with the reason invisible to them. So on an account
       * with no cap of its own the bar shows THAT, labelled as the
       * library's, with his own count beside it as plain text.
       *
       * Two quantities in one row, so each is named: the count is his
       * and monthly, the bar is everyone's and daily. */
      const g=data&&data.global;
      const pct=g&&!g.unavailable&&typeof g.pctUsed==='number'?Math.max(0,Math.min(100,g.pctUsed)):null;
      if(text)text.innerHTML='<b>'+used+'</b> this month'+(pct===null?'':' \u00b7 library <b>'+pct+'%</b>');
      if(bar)bar.hidden=pct===null;
      if(fill&&pct!==null)fill.style.width=pct+'%';
      el.classList.toggle('fra-usage--spent',pct!==null&&pct>=90);
      el.title=pct===null
        ?'Questions you have asked this month. No limit on this account.'
        :'You have asked '+used+' questions this month, with no limit on this account. The bar is the library\u2019s shared daily budget, which resets at midnight UTC and blocks everyone when it is spent.';
      return;
    }
    if(bar)bar.hidden=false;
    const pct=Math.min(100,Math.round((used/cap)*100));
    if(text)text.innerHTML='<b>'+used+'</b> of '+cap+' used';
    if(fill)fill.style.width=pct+'%';
    // At the cap the row says so plainly; the worker is what actually
    // refuses, this only stops the reader being surprised by it.
    el.classList.toggle('fra-usage--spent',used>=cap);
    el.title=used>=cap?'You have used this month\u2019s questions.':'';
  }

  async function answerFinished(data,{os=false}={}){
        await refresh();await mirror();
        loadUsage();   // MereO delta: a question was just spent.
        const c=conversations.find(c=>c.id===data.id);if(!c)return;const status=c.turns.find(t=>t.id===data.turnId)?.status||data.status;
        if(visible&&current===c.id&&document.visibilityState==='visible'){await S.update(c.id,c=>{c.unread=false;});announce(status==='complete'?'Answer complete':'Research needs attention');}
        else{toast((status==='complete'?'Answer ready: ':'Research needs attention: ')+c.t,c.id);
          if(os&&localStorage.getItem('fr_ask_notify')==='1'&&'Notification'in window&&Notification.permission==='granted'&&document.visibilityState==='hidden'){
            // A local claim prevents every open tab producing the same OS notification.
            const key='fr_notice_'+data.turnId;if(!localStorage.getItem(key)){localStorage.setItem(key,'1');const n=new Notification('The Faith Received',{body:status==='complete'?'Your research is ready.':'Your research needs attention.',tag:data.turnId});n.onclick=()=>{window.focus();open({id:c.id});n.close();};}
          }
        }
      
  }
  function createWorker() {
    /* MereO delta (unmarked in the old copy, kept deliberately): our
       ask-worker.js is ahead of the owner's, so it keeps OUR cache token,
       v7h, not his v4 (7h on 2026-09-26: the worker keeps the works found
       and the check's marked statements). The token is also the SharedWorker NAME: a browser
       that already owns fr-ask-v7g would keep serving the old script under
       a reused name, and every tab of a member mid-question would be
       answered by a worker without our member-bearer handling. Bump both
       together whenever ask-worker.js changes. The PATH comes from
       CFG.assetBase; only the version is ours. */
    try { worker=new SharedWorker(CFG.assetBase+'ask-worker.js?v=7h',{name:'fr-ask-v7h'});port=worker.port;port.start(); }
    catch(_){workerKind='tab';worker=new Worker(CFG.assetBase+'ask-worker.js?v=7h');port=worker;}
    port.onmessage=async({data})=>{
      if(data.type==='reply'){const r=replies.get(data.rid);if(r){clearTimeout(r.timer);replies.delete(data.rid);data.error?r.reject(new Error(data.error)):r.resolve();}}
      else if(data.type==='updated')scheduleRefresh();
      else if(data.type==='storage-error'){storageError='The latest answer could not be saved. Browser storage may be full.';toast(storageError);}
      else if(data.type==='finished')await answerFinished(data,{os:true});
    };
    worker.onerror=()=>{storageError='The background connection stopped. Reload to reconnect; saved conversations will remain.';refresh();};
  }
  function scheduleRefresh(){if(renderTimer)return;renderTimer=setTimeout(()=>{renderTimer=null;refresh().catch(()=>{});},80);}
  async function init(){
    if(initPromise)return initPromise;
    initPromise=(async()=>{await migrate();createWorker();await rpc('hello');await refresh();})();
    try{await initPromise;}catch(e){initPromise=null;storageError='Conversations could not be saved in this browser. Enable site storage, then reload. '+e.message;throw e;}
  }
  async function refresh(){
    conversations=(await S.all()).sort((a,b)=>(b.ts||0)-(a.ts||0));
    for(const c of conversations)if(c.turns.some(deliveryIncomplete)){
      await S.update(c.id,record=>{for(const t of record.turns)if(deliveryIncomplete(t)){t.status='error';t.error='The response ended before completion was confirmed. The received text and source passages are saved. Retry to finish.';}record.unread=true;});
      const updated=await S.get(c.id);Object.assign(c,updated);
    }
    const count=conversations.filter(c=>running(c)).length, unread=conversations.filter(c=>c.unread).length;
    const updateLabel=count?count+' research running':unread?unread+' conversation updates':'';
    const launcher=document.getElementById('fra-launcher');if(launcher){
      const html=icon('chat')+'<span>Ask</span>'+((count||unread)?'<i class="fra-status-dot" aria-hidden="true"></i>':'');
      if(launcher.innerHTML!==html)launcher.innerHTML=html;
      launcher.classList.toggle('fra-running',!!count);launcher.setAttribute('aria-label','Open Ask'+(updateLabel?', '+updateLabel:''));launcher.title=updateLabel||'Open conversations';
    }
    const thumb=document.querySelector('.frthumb [data-t="ask"]');if(thumb){
      const label=thumb.querySelector('.lb');if(label)label.textContent='Ask';
      const mark=thumb.querySelector('.ic');if(mark&&!mark.querySelector('svg'))mark.innerHTML=icon('chat');
      thumb.classList.toggle('fra-has-update',!!(count||unread));thumb.classList.toggle('fra-running',!!count);
      thumb.setAttribute('aria-label','Ask'+(updateLabel?', '+updateLabel:''));thumb.title=updateLabel||'Open conversations';
    }
    if(visible){renderHistory();renderThread();renderHeader();if($('#fra-scope')&&!$('#fra-scope').hidden&&$('#fra-scope').dataset.chat!==current)togglePopover('fra-scope',false);}
  }
  async function newConversation(opts={}){
    if(panel)togglePopover('fra-scope',false);forgetSource();
    historyFilter='';showArchived=false;if(panel){$('#fra-history-search').value='';$('#fra-show-archived').setAttribute('aria-pressed','false');}
    const c={id:S.id(),t:'New conversation',ts:Date.now(),mode:researchMode(opts.mode),scope:{works:opts.works||(readerPage()&&contextWork()?[contextWork()]:[]),tradition:opts.tradition||'',notebook:false},turns:[],draft:opts.q||'',archived:false,folder:String(opts.folder||'').trim().slice(0,60),contextWork:opts.contextWork||contextWork()};
    await S.put(c);current=c.id;if(S.setMeta)await S.setMeta('active-conversation',current);await refresh();syncComposer();return c;
  }
  function renderHistory(){
    if(!panel)return;
    const list=conversations.filter(c=>(c.turns.length||String(c.draft||'').trim())&&!!c.archived===showArchived&&(folderOf(c)+' '+c.t+' '+c.turns.map(t=>t.q+' '+t.a).join(' ')).toLowerCase().includes(historyFilter.toLowerCase()));
    const row=c=>{
      const t=c.turns[c.turns.length-1],status=running(c)?'Researching':t&&['error','interrupted','stopped'].includes(t.status)?'Needs attention':c.unread?'Ready':new Date(c.ts).toLocaleDateString(undefined,{month:'short',day:'numeric'});
      return '<button class="fra-history-row'+(current===c.id?' active':'')+'" data-chat="'+esc(c.id)+'"'+(current===c.id?' aria-current="true"':'')+'><span>'+esc(c.t)+'</span><small>'+esc(status)+'</small></button>';
    };
    // FOLDERS (owner 2026-09-13): conversations group under named folders; loose ones come first.
    const loose=list.filter(c=>!folderOf(c)),folders=[...new Set(list.map(folderOf).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const historyHTML=list.length?loose.map(row).join('')+folders.map(name=>'<details class="fra-folder" data-folder="'+esc(name)+'"'+(foldersClosed.has(name)&&!historyFilter?'':' open')+'><summary><span>'+esc(name)+'</span><small>'+list.filter(c=>folderOf(c)===name).length+'</small><button type="button" class="fra-folder-rename" data-folder-rename="'+esc(name)+'" aria-label="Rename folder '+esc(name)+'">'+icon('edit')+'</button></summary>'+list.filter(c=>folderOf(c)===name).map(row).join('')+'</details>').join('')+(showArchived?'<button type="button" id="fra-delete-archived" class="fra-danger fra-delete-archived">Delete all archived</button>':''):'<p class="fra-empty-history">'+(historyFilter?'No matching conversations.':showArchived?'No archived conversations.':'Your conversations will appear here.')+'</p>';
    const host=$('#fra-history-list');if(host.dataset.html!==historyHTML){const focused=document.activeElement&&document.activeElement.dataset.chat;host.innerHTML=historyHTML;host.dataset.html=historyHTML;if(focused){const b=host.querySelector('[data-chat="'+CSS.escape(focused)+'"]');if(b)b.focus();}}
  }
  function scopeText(c){const s=c.scope||{},parts=scopeParts(s);if(parts.length===1){if((s.groups||[]).length===1)return scopeGroups.find(g=>g.id===s.groups[0])?.name||'Selected group';if(scopeShelves(s).length===1)return shownShelf(scopeShelves(s)[0]);if((s.authors||[]).length===1)return 'Works by '+s.authors[0];if((s.works||[]).length===1){const slug=s.works[0],named=titleOf({slug});return named===slug&&slug===contextWork()&&readerTitle()||named;}}return parts.join(' · ')||'Whole library';}
  function turnModeLabel(t){
    const automatic=t.approach?t.approach.automatic===true:(t.steps||[]).some(s=>s.label==='Using Deep research for this question');
    return (modes[researchMode(automatic?'deep':t.mode)])[0]+(automatic?' · Selected for this question':'');
  }
  function shownAnswer(t){return t.status==='error'?String(t.a||'').split('The library hit an error answering this')[0].trim():t.a||'';}
  function offersDeep(t){return t.mode==='ask'&&t.status==='complete'&&!t.outOfScope&&!/^Ask is for this library's texts/.test(t.a||'');}
  function deliveryIncomplete(t){return t.status==='complete'&&(t.expectsReceipt||(t.steps||[]).some(s=>s.label==='Preparing the response'))&&!t.receivedComplete&&!(t.steps||[]).some(s=>s.label==='Answer received');}
  function shownError(t){return /load failed|failed to fetch|networkerror|network request failed|fetch failed/i.test(t.error||'')?'The connection was interrupted. Your question and any received passages are saved. Try again.':t.error||'';}
  function renderHeader(){const c=selected();if(!c)return;
    const passage=$('#fra-passage');passage.hidden=!c.draftPassage;$('#fra-passage-cite').textContent=c.draftPassage?.cite||'';$('#fra-passage-text').textContent=c.draftPassage?.text||'';
    if(ASK_PATH_RE.test(location.pathname)){const u=new URL(location.href);if(u.searchParams.get('chat')!==c.id){u.searchParams.set('chat',c.id);u.searchParams.delete('q');u.searchParams.delete('ask');history.replaceState(history.state,'',u);}}
    const latest=running(c)||c.turns[c.turns.length-1],state=researchState(latest),stateButton=$('#fra-state');stateButton.hidden=!latest;stateButton.dataset.state=state.kind;stateButton.querySelector('span').textContent=state.label;stateButton.setAttribute('aria-label',state.label+'. View research activity');
    $('#fra-title').textContent=c.t;$('#fra-context').textContent=(folderOf(c)?folderOf(c)+' · ':'')+scopeText(c);$('#fra-mode-name').textContent=modes[researchMode(c.mode)][0];
    $('#fra-scope-name').textContent=scopeButton(c.scope||{});$('#fra-context').title=scopeText(c);
    $('#fra-archive').textContent=c.archived?'Restore conversation':'Archive conversation';
    $('#fra-save-state').textContent=storageError||legacyWarning||(running(c)?.serverJob?.status==='submitting'?'Starting Deep research · Wait for confirmation':running(c)?.serverJob?'Saved on the server · You can close this browser':running(c)?'Saved · '+(workerKind==='shared'?'Research continues while the site is open':'Keep this tab open while research runs'):c.turns.some(t=>t.serverJob&&t.serverJob.status!=='submitting')?'Research saved on the server':researchMode(c.mode)==='deep'?'Saves progress · Works in the background · Up to 10 minutes':'Saved in this browser');
    const busy=!!running(c), send=$('#fra-send');send.disabled=!!storageError||running(c)?.serverJob?.status==='submitting'||!busy&&!$('#fra-input').value.trim();send.innerHTML=icon(busy?'stop':'send');send.setAttribute('aria-label',busy?'Stop research':'Send message');
    $('#fra-notify').setAttribute('aria-pressed',String(localStorage.getItem('fr_ask_notify')==='1'));
    $('#fra-archive').disabled=busy;
    panel.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===researchMode(c.mode))));
  }
  const suggestionGroups = [
    {label:'Explore a doctrine', questions:[
      'How did the early church understand the Eucharist?',
      'How does Augustine explain the relationship between grace and free will?',
      'How does Aquinas explain the theological virtue of hope?',
      'How does Calvin describe union with Christ?'
    ]},
    {label:'Trace an idea', questions:[
      'Give me a starting overview of how Christ’s descent was understood across the tradition.',
      'How did interpretations of the image of God develop? Give me a few starting passages.',
      'How did Christian authors understand natural law? Start with a few contrasting examples.',
      'How did authors interpret Romans 13? Give me a few starting points in the library.'
    ]},
    {label:'Find a reading path', questions:[
      'Which works should I read to study Romans 8?',
      'Suggest a short reading path through the library on prayer.',
      'Where should I begin reading about the Council of Nicaea?',
      'Suggest a reading path on faith and reason, beginning with introductory passages.'
    ]},
    /* MereO delta: a fourth group, so the welcome shows four cards in a
       square rather than three and a gap (Ian, 2026-09-14). It is
       "understand a passage", which is the one thing the subtitle above
       promises and had no card for: the other three explore an idea,
       follow a question, and say where to begin. Questions name a
       specific text on purpose, because that is what distinguishes this
       from a search box. Re-apply when re-vendoring. */
    {label:'Understand a passage', questions:[
      'What is Anselm arguing in the opening of the Proslogion?',
      'What does the Chalcedonian Definition mean by "in two natures"?',
      'What does Athanasius mean by the Word becoming flesh in On the Incarnation?',
      'What is Calvin doing in the first chapter of the Institutes?'
    ]}
  ];
  const previousSuggestions = new Map();
  function renderSuggestions(conversation){
    const host=$('.fra-suggestions');
    const inBook=readerPage()&&!(conversation.scope.groups||[]).length&&!scopeShelves(conversation.scope).length&&!(conversation.scope.authors||[]).length&&(conversation.scope.works||[]).length===1&&(conversation.scope.works||[])[0]===contextWork(),signature=conversation.id+'|'+inBook;
    if(!host||host.dataset.conversation===signature)return;
    $('#fra-welcome h1').textContent=inBook?'Ask about this book':'Ask the Library';
    $('#fra-welcome>p').textContent=inBook?'Select a passage to include it in your question, or ask about the work as a whole.':'Explore an idea, understand a passage, or follow a question through the texts.';
    const groups=inBook?[
      {label:'Follow the argument',questions:['Summarize the main argument of this work, with passages I can read.','How does the argument develop across this work?']},
      {label:'Understand its terms',questions:['Which theological terms are central to this work, and how are they defined?','Explain the key distinctions this work makes, with cited passages.']},
      {label:'Study its sources',questions:['How does this work use Scripture to support its argument?','Which earlier authors does this work discuss, and why?']}
    ]:suggestionGroups.slice();
    for(let i=groups.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[groups[i],groups[j]]=[groups[j],groups[i]];}
    host.innerHTML=groups.map(group=>{
      const choices=group.questions.filter(q=>q!==previousSuggestions.get(group.label));
      const prompt=choices[Math.floor(Math.random()*choices.length)];
      previousSuggestions.set(group.label,prompt);
      return '<button type="button" data-prompt="'+esc(prompt)+'"><span>'+esc(group.label)+'</span><small>'+esc(prompt)+'</small></button>';
    }).join('');
    host.dataset.conversation=signature;
  }
  function reconcileAnswer(parent,next){
    let node=parent.firstChild;
    for(const fresh of Array.from(next.childNodes)){
      if(!node){parent.appendChild(fresh);continue;}
      const following=node.nextSibling;
      if(!node.isEqualNode(fresh)){
        if(node.nodeType===3&&fresh.nodeType===3){if(fresh.data.startsWith(node.data))node.appendData(fresh.data.slice(node.data.length));else node.data=fresh.data;}
        else if(node.nodeType===1&&fresh.nodeType===1&&node.nodeName===fresh.nodeName){
          for(const attr of Array.from(node.attributes))if(!fresh.hasAttribute(attr.name))node.removeAttribute(attr.name);
          for(const attr of Array.from(fresh.attributes))if(node.getAttribute(attr.name)!==attr.value)node.setAttribute(attr.name,attr.value);
          reconcileAnswer(node,fresh);
        }else parent.replaceChild(fresh,node);
      }
      node=following;
    }
    while(node){const following=node.nextSibling;node.remove();node=following;}
  }
  /* MereO delta: draw any diagram the answer contains once the answer is
     in the DOM. The renderer is lazy and caches by source, so calling it
     on every delta costs a querySelector on a settled answer. */
  function updateAnswer(answer,html){const fragment=document.createElement('template');fragment.innerHTML=html;reconcileAnswer(answer,fragment.content);if(window.MODiagrams)window.MODiagrams.render(answer);}
  // A long answer gets a sticky outline above it: the question, Top, one jump per section. Targets are
  // resolved by index at click time — reconcileAnswer re-diffs the answer on every update, so ids would not survive.
  function renderOutline(node,t,answer){
    const feed=$('#fra-feed'),heads=Array.from(answer.querySelectorAll('h3'));let bar=node.querySelector('.fra-outline');
    const long=heads.length>=2||(feed.clientHeight>0&&answer.offsetHeight>feed.clientHeight*1.5);
    if(!long){if(bar)bar.remove();return;}
    const html='<strong title="'+esc(t.q)+'">'+esc(t.q)+'</strong><button type="button" data-jump="top" data-jump-turn="'+esc(t.id)+'">Top ↑</button>'+heads.map((h,i)=>'<button type="button" data-jump="'+i+'" data-jump-turn="'+esc(t.id)+'" title="'+esc(h.textContent)+'">'+esc(h.textContent.trim().slice(0,72))+'</button>').join('');
    if(!bar){bar=document.createElement('nav');bar.className='fra-outline';bar.setAttribute('aria-label','In this answer');node.insertBefore(bar,answer);}
    if(bar.dataset.html!==html){bar.innerHTML=html;bar.dataset.html=html;}
  }
  function renderThread(){
    const c=selected();if(!c)return;const feed=$('#fra-feed'), thread=$('#fra-thread');
    const feedVisible=feed.clientHeight>0,near=feedVisible&&feed.scrollHeight-feed.scrollTop-feed.clientHeight<110;
    $('#fra-welcome').hidden=c.turns.length>0;
    if(!c.turns.length)renderSuggestions(c);
    const signature=c.id+'|'+c.turns.map(t=>t.id).join('|');
    if(thread.dataset.signature!==signature){
      thread.dataset.signature=signature;
      thread.innerHTML=c.turns.map(t=>'<article class="fra-turn" data-turn="'+esc(t.id)+'"><h2 class="fra-question">'+esc(t.q)+'</h2>'+(t.passage?'<details class="fra-quoted"><summary>Selected passage · '+esc(t.passage.cite||'This book')+'</summary><blockquote>'+esc(t.passage.text)+'</blockquote>'+(safeURL(t.passage.url)?'<a href="'+esc(safeURL(t.passage.url))+'">Read passage</a>':'')+'</details>':'')+'<div class="fra-turn-meta">'+esc((modes[researchMode(t.mode)])[0])+'</div><div class="fra-progress" role="status"></div><div class="fra-answer-label" hidden>'+icon('book')+'<span>Answer</span></div><div class="fra-answer"></div><div class="fra-turn-extra"></div><div class="fra-actions"></div></article>').join('');
    }
    for(const t of c.turns){
      const node=thread.querySelector('[data-turn="'+CSS.escape(t.id)+'"]'),answer=node.querySelector('.fra-answer');
      node.querySelector('.fra-turn-meta').textContent=turnModeLabel(t);
      node.dataset.state=t.status;node.querySelector('.fra-answer-label').hidden=!shownAnswer(t);
      const answerText=shownAnswer(t),sourceKey=JSON.stringify((t.src||[]).map(s=>[s.slug,s.page,s.link,s.cit,s.cite,titleOf(s)]));
      if(answer.dataset.text!==answerText||answer.dataset.catalog!==String(catalogRevision)||answer.dataset.sources!==sourceKey){answer.dataset.sources=sourceKey;answer.dataset.catalog=String(catalogRevision);updateAnswer(answer,markdown(answerText,t.src||[]));answer.dataset.text=answerText;answer.dataset.rev=String((+answer.dataset.rev||0)+1);renderOutline(node,t,answer);}
      const flags=(t.check&&t.check.flags)||[],flagKey=JSON.stringify(flags)+'|'+(answer.dataset.rev||'');
      if(answer.dataset.flags!==flagKey){answer.dataset.flags=flagKey;markFlags(answer,flags);}
      const cited=[...new Set(Array.from(answer.querySelectorAll('a.fra-cite[data-w]'),a=>a.dataset.w))];
      const progress=node.querySelector('.fra-progress');
      const stage=humanStage(t.stage||'Starting research');
      // While the turn runs, the steps already passed stay visible under the current one (the server used to go quiet for
      // ten seconds between 'Reading source passages' and 'Preparing the response'; now each verification batch reports).
      const done=t.status==='running'?(t.steps||[]).map(s=>humanStage(s.label)).filter((l,i,a)=>l&&l!==stage&&a.indexOf(l)===i).slice(-6):[];
      const found=t.status==='running'&&t.found&&t.found.items&&t.found.items.length?t.found:null;
      const stageKey=t.status+'|'+stage+'|'+done.join('|')+'|'+(found?found.works+'/'+found.passages+'/'+found.items.map(f=>f.s).join(','):'');
      if(progress.dataset.stage!==stageKey){progress.dataset.stage=stageKey;progress.dataset.kind=/writ|compos|synthesi/i.test(stage)?'writing':/read|batch|page/i.test(stage)?'reading':/check|gap|verif/i.test(stage)?'checking':'searching';progress.innerHTML=t.status==='running'?'<span class="fra-motion" aria-hidden="true"><i></i><i></i><i></i></span><span>'+esc(stage)+'</span><span class="fra-elapsed" data-start="'+t.ts+'">'+elapsed(t.ts)+'</span>'+(done.length?'<ol class="fra-steps-done" aria-label="Completed steps">'+done.map(l=>'<li>'+esc(l)+'</li>').join('')+'</ol>':'')+(found?foundHTML(found):''):t.status==='paused'?'<span>'+esc(stage)+'</span>':'';}
      const extra=node.querySelector('.fra-turn-extra');
      /* MereO delta: t.unverified joins the key, or the notice below would
         paint once and never update. */
      const extrasKey=JSON.stringify([t.status,t.error,t.steps,t.src,t.stats,t.gaps,t.graph,t.unverified,t.check,cited,catalogRevision]);
      if(extra.dataset.key!==extrasKey){extra.dataset.key=extrasKey;const openDetails=Array.from(extra.querySelectorAll('details[open]')).map(d=>d.classList.contains('fra-sources')?'sources':d.querySelector('summary').textContent.replace(/ ·.*$/,''));
        /* MereO delta: quotations the worker could not find in the passages
           this answer cites. It sits directly under the answer, above the
           sources, because it qualifies what was just read. Not role=alert:
           it is a caution about wording, not a failure of the research. */
        extra.innerHTML=(t.graph&&t.graph.loci&&t.graph.loci.length?'<p class="fra-research-context">Research context · <span>'+t.graph.loci.map(esc).join(' · ')+'</span></p>':'')+(t.error?'<div class="fra-error" role="alert">'+esc(shownError(t))+'</div>':'')+
          ((t.unverified||[]).length?'<div class="fra-unverified"><p>'+((t.unverified.length===1)?'This quotation could not be found':'These quotations could not be found')+' in the passages this answer cites. Read the sources before relying on '+((t.unverified.length===1)?'it':'them')+'.</p><ul>'+t.unverified.map(x=>'<li>“'+esc(x)+'”</li>').join('')+'</ul></div>':'')+
          (t.steps&&t.steps.length?'<details class="fra-activity"><summary>Research activity · '+t.steps.length+' steps</summary><ol>'+t.steps.map(s=>'<li>'+esc(humanStage(s.label))+'</li>').join('')+'</ol></details>':'')+
          (t.gaps?'<details class="fra-activity"><summary>Gaps in the evidence</summary><ul class="fra-gaps">'+String(t.gaps).split('\n').filter(g=>g.trim()).map(g=>'<li>'+esc(g)+'</li>').join('')+'</ul></details>':'')+
          checkHTML(t)+(t.stats?'<p class="fra-coverage">'+esc(t.stats.unique||0)+' passages found'+(t.stats.capped?' · Scan capped; this is not complete coverage.':' · '+esc(t.stats.pages)+' pages loaded.')+'</p>':'')+
          ((t.src||[]).length?sourceCollectionHTML(t.src,cited):'');
        extra.querySelectorAll('details').forEach(d=>{if(openDetails.includes(d.classList.contains('fra-sources')?'sources':d.querySelector('summary').textContent.replace(/ ·.*$/,'')))d.open=true;});
      }
      const actions=node.querySelector('.fra-actions');
      const actionKey=t.status+'|'+!!answerText+'|'+offersDeep(t)+'|'+(t.src||[]).length+'|'+(t.serverJob?.status||'');
      if(actions.dataset.status!==actionKey){actions.dataset.status=actionKey;actions.innerHTML=t.status==='running'?'':((t.src||[]).length?'<button data-sources="'+esc(t.id)+'">Read sources</button>':'')+(answerText?'<button data-share="'+esc(t.id)+'">Share</button><button data-copy="'+esc(t.id)+'">Copy answer</button><button data-note="'+esc(t.id)+'">Save to notebook</button><button data-desk="'+esc(t.id)+'">Insert in Desk</button>':'')+(offersDeep(t)?'<button data-deepen="'+esc(t.id)+'" title="Research this question in the background using the same scope. Saves progress; up to 10 minutes per run.">Research in Deep</button>':'')+(['error','interrupted','stopped'].includes(t.status)&&!t.serverJob?'<button data-retry="'+esc(t.id)+'">Retry question</button>':'');}
      if(t.serverJob){let controls=actions.querySelector('.fra-job-controls');if(!controls){controls=document.createElement('span');controls.className='fra-job-controls';actions.append(controls);}const state=t.serverJob.status,controlState=state+'|'+!!t.serverJob.canResume;if(controls.dataset.state!==controlState){controls.dataset.state=controlState;controls.innerHTML=(['queued','running'].includes(state)?'<button data-job-control="pause" data-job-turn="'+esc(t.id)+'">Pause research</button>':(['paused','limit_reached','needs_input'].includes(state)||state==='complete'&&t.serverJob.canResume)?'<button data-job-control="resume" data-job-turn="'+esc(t.id)+'">'+(state==='complete'?'Research further for 10 minutes':state==='limit_reached'?'Continue for 10 more minutes':'Continue research')+'</button>':'')+(t.status==='error'?'<button data-job-control="retry" data-job-turn="'+esc(t.id)+'">Reconnect Deep research</button>':'');}}
    }
    if(near&&c.turns.length&&(!window.getSelection||window.getSelection()?.isCollapsed!==false))feed.scrollTop=feed.scrollHeight;
    $('#fra-jump').hidden=near||!c.turns.length;
  }
  function elapsed(ts){const seconds=Math.max(0,Math.floor((Date.now()-ts)/1000));return seconds<60?seconds+'s':Math.floor(seconds/60)+'m '+seconds%60+'s';}
  function humanStage(s){return String(s).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').trim().replace(/^search_meaning\b/,'Searching by meaning').replace(/^search_exact\b/,'Searching exact words').replace(/^read_pages\b/,'Reading source pages').replace(/^grep_work\b/,'Finding passages in a work').replace(/^rank_works\b/,'Finding relevant works').replace(/^list_author_works\b/,"Finding the author’s works").replace(/^commentaries_on\b/,'Finding commentaries').replace(/^reception_of\b/,'Tracing reception').replace(/\s*\{.*$/,'').replace(/—/g,':');}
  function syncComposer(){const c=selected();if(!c)return;$('#fra-input').value=c.draft||'';fitInput();renderHeader();}
  function fitInput(){const ta=$('#fra-input'),height=window.visualViewport?.height||window.innerHeight;ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,170,Math.max(60,height*.26))+'px';renderHeader();}
  function fitViewport(){if(!panel||!visible)return;const view=window.visualViewport;panel.style.height=(view?.height||window.innerHeight)+'px';panel.style.top=(view?.offsetTop||0)+'px';panel.style.setProperty('--fra-view-height',(view?.height||window.innerHeight)+'px');fitInput();}
  async function flushDraft(){clearTimeout(draftTimer);if(!visible||!selected())return;const id=current,value=$('#fra-input').value;await S.update(id,c=>{c.draft=value;});}
  async function switchChat(id){await flushDraft();togglePopover('fra-scope',false);forgetSource();current=id;if(S.setMeta)await S.setMeta('active-conversation',id);await S.update(id,c=>{c.unread=false;});await refresh();syncComposer();panel.classList.remove('fra-history-open');$('#fra-history-toggle').setAttribute('aria-expanded','false');$('#fra-feed').scrollTop=selected()?.turns.length?$('#fra-feed').scrollHeight:0;}
  let jobsPromise;
  /* MereO delta (unmarked in the old copy, kept deliberately): prefer the
     {{asset}} URL the template published on #frPortAssets. This import is
     one of two port files fetched without a script tag, and building the
     URL as ...?v=__FR_VER gives every file ONE shared constant while Ghost
     hashes each asset separately. So the ask-jobs.js URL never changed when
     ask-jobs.js did, and with max-age=31536000 the CDN kept handing back the
     old object: a deep-research fix verified present on the server was still
     absent in the browser. The data attribute carries the real per-file
     hash. CFG.assetBase is the fallback for any page that does not publish
     one. See the frPortAssets note in custom-faith-port-read.hbs. */
  async function researchJobs(){if(!jobsPromise)jobsPromise=import((document.getElementById('frPortAssets')||{dataset:{}}).dataset.askJobs||(CFG.assetBase+'ask-jobs.js?v='+encodeURIComponent(window.__FR_VER||'deep-1'))).then(async()=>{await FRResearchJobs.init(S,scheduleRefresh,data=>answerFinished(data,{os:false}));return FRResearchJobs;});return jobsPromise;}
  async function send(question, modeOverride, scopeOverride, passageOverride){
    await flushDraft();let c=await S.get(current);if(!c)return;
    if(running(c)){const t=running(c);if(t.serverJob)await (await researchJobs()).control(c.id,t.id,'cancel');else await rpc('stop',{id:c.id});return;}
    const q=String(question==null?$('#fra-input').value:question).trim();if(!q)return;
    const preserveDraft=question!=null&&c.draft&&(passageOverride!==undefined||String(c.draft).trim()!==q)?String(c.draft):'';
    if(storageError){toast(storageError);return;}
    if(sending.has(c.id))return;sending.add(c.id);
    try{
    const mode=researchMode(modeOverride||c.mode),scope=structuredClone(scopeOverride||c.scope||{}),works=scope.works||[];
    const [records,schools]=await Promise.all([scopeNeedsCatalog(scope)?loadCatalog():catalog,(scope.groups||[]).includes('westminster')?loadScopeSchools():null]);
    const compiled=compileScope(scope,records,schools),resolved=compiled.works;
    if(c.archived){await S.update(c.id,c=>{c.archived=false;});}
    const passage=passageOverride===undefined?(c.draftPassage||null):passageOverride,prompt=passagePrompt(q,passage);
    const prior=c.turns.filter(t=>t.status==='complete').flatMap(t=>[{role:'user',content:passagePrompt(t.q,t.passage)},{role:'assistant',content:t.a}]);
    const body={messages:[...prior.slice(-16),{role:'user',content:prompt}],progress:true,deep:mode==='deep'};
    if(scopeNeedsCatalog(scope))body.corpus_access=true;
    if(resolved.length){body.scope={tfr:resolved.filter(w=>!w.startsWith('@'))};for(const key of resolved.filter(w=>w.startsWith('@'))){const [,corpus,slug]=/^@([^:]+):(.*)$/.exec(key);(body.scope[corpus]||(body.scope[corpus]=[])).push(slug);}}
    else if(compiled.tradition)body.filters={tradition:compiled.tradition};
    if(!resolved.length&&c.contextWork)body.hint_w=c.contextWork;
    if(scope.notebook){let notes={};try{notes=JSON.parse(localStorage.getItem('fr_notes')||'{}');}catch(_){}body.filters=body.filters||{};let cols=[];try{cols=JSON.parse(localStorage.getItem('fr_collections_v1')||'[]');}catch(_){}const active=cols.find(x=>x.id===localStorage.getItem('fr_pincol'))||cols[0];body.filters.nb={name:active?active.name:'My notebook',memo:active&&active.memo||'',notes:[...Object.entries(JSON.parse(localStorage.getItem('fr_highlight_passages_v1')||'{}')).filter(([key])=>JSON.parse(localStorage.getItem('fr_hl')||'{}')[key]).map(([,x])=>x.cite+': '+x.text).slice(-6),...(active?active.items||[]:[]).filter(x=>x.type==='note').map(x=>x.text),...Object.values(notes).map(x=>x.t||'')].slice(-12),items:(active?active.items||[]:[]).filter(x=>x.type!=='note').slice(-40).map(x=>({t:x.title||x.slug,a:x.author||'',l:x.label||''}))};}
    body.corpus_context=c.turns.filter(t=>t.corpusState).slice(-3).map(t=>t.corpusState);
    let request={url:CFG.apiBase+'/ask',format:'ask',body};
    if(mode==='deep'){
      // The same scope and selected passage travel to the durable research job.
      // Notebook notes are user context, never substitutes for source evidence.
      const messages=prior.slice(-6);
      if(body.filters?.nb||body.hint_w)messages.push({role:'user',content:'Reading context, not verified source evidence: '+JSON.stringify({work:body.hint_w,notebook:body.filters?.nb})});
      request={url:CFG.apiBase+'/investigations',format:'job',body:{...body,question:prompt,messages}};
    }
    /* MereO delta (ASK-SPEC §7): mint the member bearer here, on the
       page, because the SharedWorker that owns the stream has its own
       global scope and cannot reach window.MOAuth. Attached after BOTH
       branches above so Ask and Deep research carry it alike. Our Ask
       worker requires a verified Ghost member on every spending route;
       without this every question 401s. MOAuth.tokenFor re-checks the
       trusted-host allowlist against request.url, so a bearer is never
       minted for a host the page has not allowlisted, and it returns
       null for an anonymous visitor rather than throwing — the 401 path
       below already explains that in words.
       The URL is now CFG.apiBase, not a literal, so the allowlist check
       follows whatever faith-ask-config.js points Ask at.
       Re-apply when re-vendoring ask-workspace.js from upstream. */
    try{
      const tok=window.MOAuth&&window.MOAuth.tokenFor?await window.MOAuth.tokenFor(request.url):null;
      if(tok)request.headers={Authorization:'Bearer '+tok};
    }catch(_){/* anonymous, or the identity endpoint is down: let the 401 speak */}
    const turn={id:S.id(),q,a:'',src:[],mode,scope:structuredClone(scope),works:works.slice(),ts:Date.now(),status:'running',stage:'Preparing the answer',steps:[],...(passage?{passage:structuredClone(passage)}:{})};
    try{
      await S.update(c.id,c=>{if(!c.turns.length&&c.t==='New conversation')c.t=q.slice(0,90);c.ts=Date.now();});
      if(mode==='deep')await (await researchJobs()).start(c.id,turn,{...request.body,minutes:10});else await rpc('start',{id:c.id,turn,request});await S.update(c.id,record=>{if(!record.draft||record.draft===c.draft){record.draft=preserveDraft;if(!preserveDraft&&record.draftPassage?.text===passage?.text&&record.draftPassage?.row===passage?.row)delete record.draftPassage;}});if(current===c.id){const latest=await S.get(c.id);$('#fra-input').value=latest?.draft||'';fitInput();}await refresh();if(current===c.id)$('#fra-feed').scrollTop=$('#fra-feed').scrollHeight;
    }catch(e){toast(e.message);}
    }catch(e){toast(e.message);}finally{sending.delete(c.id);}
  }
  function build(){
    const standalone=ASK_PATH_RE.test(location.pathname);
    panel=document.createElement('section');panel.id='fra-workspace';panel.className='fra'+(standalone?' fra-standalone':'');panel.hidden=true;panel.setAttribute('role',standalone?'main':'dialog');panel.setAttribute('aria-label','Ask the Library');if(!standalone)panel.setAttribute('aria-modal','true');
    panel.innerHTML='<div class="fra-history-scrim" data-history-close></div><aside class="fra-sidebar" tabindex="-1"><div class="fra-brand"><a href="'+esc(CFG.libraryPath)+'">The Faith Received</a><button class="fra-icon fra-mobile-only" data-history-close aria-label="Close conversations">'+icon('close')+'</button></div>'+(standalone&&Array.isArray(CFG.nav)&&CFG.nav.length?'<nav class="fra-site-nav" aria-label="Library sections">'+CFG.nav.map(([h,t])=>'<a href="'+esc(h)+'">'+esc(t)+'</a>').join('')+'</nav>':'')+''+
      '<button class="fra-new" id="fra-new">'+icon('plus')+'New conversation</button><label class="fra-history-search">'+icon('search')+'<input id="fra-history-search" type="search" placeholder="Search conversations" aria-label="Search conversations"></label><div class="fra-history-label"><span>Conversations</span><button id="fra-show-archived" aria-pressed="false">Archived</button></div><nav id="fra-history-list" aria-label="Conversations"></nav><div class="fra-sidebar-foot"><a href="/the-faith-received/pins/">Collections</a><a href="/the-faith-received/desk/">Open Desk</a><div data-cgpt-link></div><button id="fra-notify" aria-pressed="false">'+icon('bell')+'Completion notifications</button><p>Conversations are saved in this browser. Deep research also saves progress on the server.</p></div></aside>'+
      '<main class="fra-main"><header class="fra-header"><button class="fra-icon" id="fra-history-toggle" aria-label="Show conversations" aria-expanded="false">'+icon('menu')+'</button><div class="fra-heading"><strong id="fra-title">New conversation</strong><span id="fra-context">Whole library</span></div><button type="button" id="fra-state" class="fra-state" hidden><i aria-hidden="true"></i><span></span></button><button class="fra-icon" id="fra-command-toggle" aria-label="Search conversations and actions" title="Search conversations and actions (⌘K / Ctrl+K)">'+icon('search')+'</button><button class="fra-icon" id="fra-theme" aria-label="Change reading theme">'+icon('sun')+'</button><button class="fra-icon" id="fra-more-toggle" aria-label="Conversation options" aria-expanded="false">•••</button><a class="fra-home" id="fra-home" href="'+esc(CFG.libraryPath)+'" aria-label="Back to library"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg>Library</a><button class="fra-icon" id="fra-close" aria-label="Return to reading">'+icon('close')+'</button><div class="fra-menu" id="fra-more" hidden><button id="fra-rename">Rename conversation</button><button id="fra-export">Download conversation</button><button id="fra-folder">Move to folder…</button><div id="fra-folder-pick" class="fra-folder-pick" hidden><label>Folder<input id="fra-folder-name" list="fra-folder-list" maxlength="60" placeholder="New or existing folder" autocomplete="off"></label><datalist id="fra-folder-list"></datalist><div class="fra-confirm-row"><button id="fra-folder-save">Move</button><button id="fra-folder-clear">No folder</button></div></div><button id="fra-archive">Archive conversation</button><button id="fra-delete" class="fra-danger">Delete conversation</button><div id="fra-confirm" class="fra-confirm" hidden><span id="fra-confirm-text">Delete this conversation? This cannot be undone.</span><div class="fra-confirm-row"><button id="fra-confirm-yes" class="fra-danger">Delete</button><button id="fra-confirm-no">Keep</button></div></div></div></header>'+
      '<nav class="fra-reader-bar" id="fra-reader-bar" hidden aria-label="Reader research"><button id="fra-reader-notes">Saved research</button><button id="fra-expand">Expand Ask</button></nav><div class="fra-mobile-tabs" hidden><button id="fra-chat-tab" class="active">Conversation</button><button id="fra-read-tab">Read source</button></div><div class="fra-body"><section class="fra-chat"><div id="fra-feed" class="fra-feed"><div id="fra-welcome" class="fra-welcome"><div class="fra-welcome-mark">'+icon('book')+'</div><h1>Ask the Library</h1><p>Explore an idea, understand a passage, or follow a question through the texts.</p><div class="fra-suggestions"></div></div><div id="fra-thread"></div></div>'+
      '<footer class="fra-compose-area"><button id="fra-jump" class="fra-jump" hidden>Latest answer ↓</button><aside class="fra-passage" id="fra-passage" hidden aria-label="Selected passage"><div><span id="fra-passage-cite"></span><button id="fra-passage-clear" aria-label="Remove selected passage">'+icon('close')+'</button></div><blockquote id="fra-passage-text"></blockquote></aside><div class="fra-composer"><label class="fra-compose-label" for="fra-input">Your question</label><textarea id="fra-input" rows="1" disabled placeholder="Ask anything" aria-label="Message the library"></textarea><div class="fra-compose-tools"><button id="fra-mode-toggle" aria-expanded="false"><span id="fra-mode-name">Ask</span>'+icon('chevron')+'</button><button id="fra-scope-toggle" aria-expanded="false"><span id="fra-scope-name">Scope</span>'+icon('chevron')+'</button><span class="fra-grow"></span><button id="fra-send" class="fra-send" aria-label="Send message" disabled>'+icon('send')+'</button></div><div class="fra-mode-menu fra-popover" id="fra-modes" hidden>'+Object.entries(modes).map(([key,value])=>'<button data-mode="'+key+'"><strong>'+value[0]+'</strong><span>'+value[1]+'</span></button>').join('')+'</div><section class="fra-popover fra-scope" id="fra-scope" aria-label="Research scope" hidden></section></div><div class="fra-compose-foot"><span id="fra-save-state">Saved in this browser</span><span class="fra-usage" id="fra-usage" hidden><span id="fra-usage-text"></span><span class="fra-usage-bar" aria-hidden="true"><i id="fra-usage-fill"></i></span></span><span class="fra-key-hint">Enter to send · Shift+Enter for a new line</span></div></footer></section>'+
      '<div class="fra-split" id="fra-split" role="separator" aria-orientation="vertical" aria-label="Resize the source pane" aria-valuemin="28" aria-valuemax="76" tabindex="0" title="Drag to resize the source pane · double-click to reset"></div><section class="fra-reader" hidden><header><button class="fra-icon" id="fra-source-back" aria-label="Back to conversation">'+icon('back')+'</button><div class="fra-source-heading"><span id="fra-source-title">Source passage</span><small id="fra-source-location"></small></div><a id="fra-source-open" target="_blank" rel="noopener">Open reader</a><button class="fra-icon" id="fra-source-close" aria-label="Close source">'+icon('close')+'</button></header><div class="fra-source-viewport"><div id="fra-source-status" class="fra-source-status" role="status" hidden>Loading passage…</div><iframe id="fra-source-frame" title="Read the cited source" referrerpolicy="same-origin"></iframe></div></section></div></main>';
    panel.insertAdjacentHTML('beforeend','<dialog id="fra-command-dialog" class="fra-command" aria-labelledby="fra-command-title"><header><h2 id="fra-command-title">Find a conversation or action</h2><button type="button" class="fra-icon" data-command-close aria-label="Close command search">'+icon('close')+'</button></header><label class="fra-command-search">'+icon('search')+'<input id="fra-command-input" type="search" placeholder="Search conversations and actions" role="combobox" aria-label="Search conversations and actions" aria-autocomplete="list" aria-controls="fra-command-results" aria-expanded="false" autocomplete="off"></label><div id="fra-command-results" role="listbox" aria-label="Conversations and actions"></div><footer><span id="fra-command-count" role="status"></span><span>↑ ↓ Navigate · Enter Open · Esc Close</span></footer></dialog>');
    document.body.appendChild(panel);
    bindCommands();
    panel.addEventListener('click',handleClick);bindCitePreview();
    panel.addEventListener('toggle',e=>{const d=e.target;if(!(d instanceof HTMLDetailsElement)||!d.classList.contains('fra-folder')||historyFilter)return;const name=d.dataset.folder;if(d.open)foldersClosed.delete(name);else foldersClosed.add(name);if(S.setMeta)S.setMeta('folders-closed',[...foldersClosed]).catch(()=>{});},true);
    /* MereO delta, NOW EXPRESSED AS CONFIG: this handler used to navigate to
       a literal '/', which is the Library on the owner's domain and the Mere
       Orthodoxy homepage on ours, so the brand link sent readers out of the
       library entirely. We patched it to follow the anchor's own href. The
       owner's file now reads CFG.libraryPath in BOTH the markup and this
       handler, so faith-ask-config.js setting libraryPath fixes it at the
       source and there is nothing to patch. Do not re-add the href-reading
       patch on the next re-vendoring; set the config key instead. */
    $('#fra-home').onclick=async e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();try{await flushDraft();location.assign(CFG.libraryPath);}catch(_){toast('Your draft could not be saved. Please try again before leaving.');}};
    // Keep the latest-answer control above the composer as drafts or the keyboard resize it.
    new ResizeObserver(()=>{
      panel.style.setProperty('--fra-compose-offset',($('.fra-compose-area').offsetHeight+12)+'px');
    }).observe($('.fra-compose-area'));
    $('#fra-source-frame').addEventListener('load',bindSourceDocument);
    initSplit();
    window.addEventListener('popstate',()=>{
      if(!visible)return;
      if(sourceReturning){
        sourceReturning=false;
        // Back may finish after a newer citation was opened. Preserve that newer
        // view and attach its history entry to the now-traversed conversation.
        if(panel.classList.contains('fra-show-reader')&&sourceURL)history.pushState({...history.state,frAskSource:{chat:current,url:sourceURL,title:sourceTitle}},'');
        else showConversation();
        return;
      }
      const saved=history.state&&history.state.frAskSource;
      if(saved&&saved.chat===current)openSource(saved.url,saved.title,false,true);
      else showConversation();
    });
    $('#fra-input').addEventListener('input',()=>{fitInput();clearTimeout(draftTimer);draftTimer=setTimeout(()=>flushDraft().catch(()=>toast('Your draft could not be saved.')),300);});
    $('#fra-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&!matchMedia('(pointer:coarse)').matches){e.preventDefault();if(!running(selected()))send();}});
    $('#fra-history-search').oninput=e=>{historyFilter=e.target.value;renderHistory();};
    $('#fra-feed').onscroll=()=>{$('#fra-jump').hidden=$('#fra-feed').scrollHeight-$('#fra-feed').scrollTop-$('#fra-feed').clientHeight<110;};
    panel.addEventListener('keydown',e=>{
      if(e.key==='Escape'){if(!$('#fra-scope').hidden)togglePopover('fra-scope',false);else if(!$('#fra-modes').hidden)togglePopover('fra-modes',false);else if(!$('#fra-more').hidden)togglePopover('fra-more',false);else if(panel.classList.contains('fra-history-open'))panel.classList.remove('fra-history-open');else if(panel.classList.contains('fra-show-reader'))returnToConversation();else close();e.preventDefault();}
      if(e.key==='Tab'&&!panel.classList.contains('fra-docked')){const all=Array.from(panel.querySelectorAll('button,a,input,textarea,select,summary,iframe')).filter(e=>!e.disabled&&!e.closest('[hidden]')&&e.getClientRects().length);if(!all.length)return;const first=all[0],last=all[all.length-1];if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}}
    });
    if(window.visualViewport){visualViewport.addEventListener('resize',fitViewport);visualViewport.addEventListener('scroll',fitViewport);}window.addEventListener('resize',fitViewport);
  }
  async function deletedIds(){try{return Array.isArray((await S.meta?.('deleted-conversations'))?.value)?(await S.meta('deleted-conversations')).value:[];}catch(_){return [];}}
  async function rememberDeleted(id){const ids=await deletedIds();if(!ids.includes(id))ids.push(id);if(S.setMeta)await S.setMeta('deleted-conversations',ids.slice(-400));}
  let foldersClosed=new Set();
  async function loadFolderState(){try{const v=(await S.meta?.('folders-closed'))?.value;foldersClosed=new Set(Array.isArray(v)?v:[]);}catch(_){}}
  function folderOf(c){return String(c&&c.folder||'').trim();}
  function folderNames(){return [...new Set(conversations.map(folderOf).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
  async function deleteConversation(id){
    const c=conversations.find(x=>x.id===id);if(!c)return;
    // a running job is cancelled first so nothing keeps spending for a conversation nobody can see
    if(running(c)){const t=running(c);try{if(t.serverJob)await (await researchJobs()).control(c.id,t.id,'cancel');else await rpc('stop',{id:c.id});}catch(_){}}
    if(S.remove)await S.remove(id);await rememberDeleted(id);conversations=conversations.filter(x=>x.id!==id);
    if(current===id){current=null;const next=conversations.find(x=>!x.archived&&x.turns.length);if(next)current=next.id;else await newConversation();if(S.setMeta&&current)await S.setMeta('active-conversation',current);}
    await refresh();await mirror();announce('Conversation deleted');
  }
  function togglePopover(id, value){for(const name of ['fra-scope','fra-modes','fra-more']){const el=$('#'+name);el.hidden=name===id?(value===undefined?!el.hidden:!value):true;}if(id!=='fra-more'||$('#fra-more').hidden){const pick=$('#fra-folder-pick'),box=$('#fra-confirm');if(pick)pick.hidden=true;if(box)box.hidden=true;}for(const [button,menu]of [['fra-scope-toggle','fra-scope'],['fra-mode-toggle','fra-modes'],['fra-more-toggle','fra-more']])$('#'+button).setAttribute('aria-expanded',String(!$('#'+menu).hidden));}
  function renderScopeSelection(){
    const s=selected()?.scope||{},chosen=scopeShelves(s),authors=s.authors||[],works=s.works||[],groups=s.groups||[];
    $('#fra-all-scope').setAttribute('aria-pressed',String(!chosen.length&&!authors.length&&!works.length&&!groups.length));
    $('#fra-shelf-count').textContent=chosen.length?chosen.length+' selected':'Choose one or more';
    $('#fra-group-count').textContent=groups.length?groups.length+' selected':'Choose one or more';
    $('#fra-group-overlap').hidden=!(groups.length&&chosen.includes('English Divines'));
    $('#fra-selected-works').innerHTML=scopeGroups.filter(g=>groups.includes(g.id)).map(g=>'<button data-remove-group="'+g.id+'" aria-label="Remove group '+esc(g.name)+'"><span>'+esc(g.name)+'</span>'+icon('close')+'</button>').join('')+authors.map(a=>'<button data-remove-author="'+esc(a)+'" aria-label="Remove author '+esc(a)+'"><span>Works by '+esc(a)+'</span>'+icon('close')+'</button>').join('')+works.map(sl=>'<button data-remove-work="'+esc(sl)+'" aria-label="Remove work '+esc(scopeWorkTitle(sl))+'"><span>'+esc(scopeWorkTitle(sl))+'</span>'+icon('close')+'</button>').join('');
    $('#fra-scope').querySelectorAll('[data-scope-shelf]').forEach(el=>{el.checked=chosen.includes(el.value);});
    $('#fra-scope').querySelectorAll('[data-scope-group]').forEach(el=>{el.checked=groups.includes(el.value);});
    $('#fra-scope').querySelectorAll('[data-add-work],[data-add-author]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.addWork?works.includes(el.dataset.addWork):authors.includes(el.dataset.addAuthor))));
    $('#fra-scope-status').textContent=scopeParts(s).length?'Next question: '+scopeText({scope:s}):'Next question: whole library';
  }
  async function scopeSearch(query){
    const results=$('#fra-work-results');if(!query.trim()){results.innerHTML='';return;}
    results.textContent='Loading titles…';await loadCatalog();if(!$('#fra-work-search')||$('#fra-work-search').value!==query)return;
    const matches=matchingWorks(query),authors=matchingAuthors(query);
    results.innerHTML=authors.map(([name,count])=>'<button data-add-author="'+esc(name)+'"><span>All works by '+esc(name)+'</span><small>'+count.toLocaleString()+' works in the library</small></button>').join('')+matches.map(w=>'<button data-add-work="'+esc(w.slug)+'"><span>'+esc(w.title)+'</span><small>'+esc([w.author||({pld:'Patrologia Latina',pg:'Patrologia Graeca',po:'Patrologia Orientalis',aq:'Aquinas'}[w.corpus]||''),w.volume].filter(Boolean).join(' · '))+'</small></button>').join('')||'<p>'+(!catalog.length?'The catalogue could not load. Try searching again.':'No matching works or authors.')+'</p>';
    renderScopeSelection();
  }
  async function openScope(){
    const c=selected();if(!c)return;togglePopover('fra-scope',true);$('#fra-scope').dataset.chat=c.id;
    const s=c.scope||{};
    $('#fra-scope').innerHTML='<header><strong>Search within</strong><button class="fra-icon" data-scope-close aria-label="Close scope">'+icon('close')+'</button></header>'+
      '<button id="fra-all-scope" class="fra-all-scope" aria-pressed="false">Search the whole library</button><details class="fra-shelves"><summary>Shelves <span id="fra-shelf-count">Choose one or more</span></summary><div class="fra-shelf-options">'+shelves.map(sh=>'<label><input type="checkbox" data-scope-shelf value="'+esc(sh)+'"><span>'+esc(shownShelf(sh))+'</span></label>').join('')+'</div></details>'+
      '<details class="fra-shelves fra-groups"><summary>English groups <span id="fra-group-count">Choose one or more</span></summary><div class="fra-shelf-options">'+scopeGroups.map(g=>'<label><input type="checkbox" data-scope-group value="'+g.id+'"><span>'+esc(g.name)+'</span></label>').join('')+'</div><p class="fra-scope-help">Westminster uses the library’s Assembly register; Puritans and Anglicans use its catalogue classifications.</p></details>'+
      '<p id="fra-group-overlap" class="fra-scope-help" hidden>'+esc(shownShelf('English Divines'))+' includes these groups. Uncheck that shelf to search only the selected groups.</p><div id="fra-selected-works" aria-label="Selected groups, authors and works"></div><label class="fra-field">Add works or authors<input id="fra-work-search" type="search" placeholder="Search titles or author names" autocomplete="off"></label><div id="fra-work-results"></div>'+
      ((c.contextWork||contextWork())?'<button class="fra-add-current" data-add-work="'+esc(c.contextWork||contextWork())+'">Use the work I am reading</button>':'')+
      '<label class="fra-notebook"><input id="fra-notebook" type="checkbox"'+(s.notebook?' checked':'')+'>Include my notebook in Ask and Deep research</label><p class="fra-scope-help">Search any selected shelf, group, author or work. Changes apply to the next question.</p><p class="fra-sr" id="fra-scope-status" role="status"></p>';
    renderScopeSelection();
    $('#fra-scope').querySelectorAll('[data-scope-shelf]').forEach(el=>{el.onchange=async e=>{const id=current,sh=e.target.value,checked=e.target.checked;await S.update(id,c=>{c.scope=editableScope(c.scope);c.scope.shelves=checked?[...new Set([...c.scope.shelves,sh])]:c.scope.shelves.filter(v=>v!==sh);});await refresh();if(current===id)renderScopeSelection();};});
    $('#fra-scope').querySelectorAll('[data-scope-group]').forEach(el=>{el.onchange=async e=>{const id=current,group=e.target.value,checked=e.target.checked;await S.update(id,c=>{c.scope=editableScope(c.scope);c.scope.groups=checked?[...new Set([...c.scope.groups,group])]:c.scope.groups.filter(v=>v!==group);});await refresh();if(current===id)renderScopeSelection();};});
    $('#fra-notebook').onchange=async e=>{const checked=e.target.checked;await S.update(current,c=>{c.scope.notebook=checked;});await refresh();};
    let timer;$('#fra-work-search').oninput=e=>{clearTimeout(timer);if(e.isComposing)return;const query=e.target.value;timer=setTimeout(()=>scopeSearch(query),150);};
    $('#fra-work-search').oncompositionend=e=>{clearTimeout(timer);scopeSearch(e.target.value);};
  }
  /* MereO delta: hl joins the params that do not identify a document. It
     is the quote the answer cited, and the reader DELETES it from its own
     URL when the × clears the highlight, so without this that clearing
     reads here as "the reader navigated somewhere else" and the pane
     rewrites its title and pushes history for a passage nobody left. */
  function sourceDocumentKey(href){const u=new URL(href,location.origin);u.hash='';u.searchParams.delete('p');u.searchParams.delete('section');u.searchParams.delete('heading');u.searchParams.delete('hl');u.searchParams.sort();return u.href;}
  function setSourceLoading(loading,message='Opening passage…'){
    const host=$('.fra-reader');host.classList.toggle('fra-source-pending',loading);host.setAttribute('aria-busy',String(loading));$('#fra-source-status').hidden=!loading;$('#fra-source-status').textContent=message;
    if(!loading){clearTimeout(sourceStatusTimer);sourceStatusTimer=null;sourceReady=true;}
  }
  function updateSourceHeader(href=sourceURL){
    $('#fra-source-title').textContent=sourceTitle;$('#fra-source-title').title=sourceTitle;$('#fra-source-open').href=sourceVisitURL(href);
    let page='';try{const u=new URL(href,location.origin),id=decodeURIComponent(u.hash.slice(1));page=(id.match(/^b(.+)-\d+$/)||[])[1]||u.searchParams.get('p')||'';}catch(_){}
    $('#fra-source-location').textContent=page?'Passage '+page:'';
  }
  function sourceExternalLocation(position){
    if(!sourceURL)return '';const u=new URL(sourceURL,location.origin);
    if(position?.page!=null){u.searchParams.set('p',String(position.page));u.hash=position.id||'b'+position.page+'-0';}if(position?.sourcePath)u.searchParams.set('section',position.sourcePath);else u.searchParams.delete('section');if(position?.sourceKey)u.searchParams.set('heading',position.sourceKey);else u.searchParams.delete('heading');
    return u.href;
  }
  function bindSourceDocument(){
    try{
      const frame=$('#fra-source-frame'),win=frame.contentWindow,doc=frame.contentDocument,scroll=(doc.querySelector('#scroll,.artscroll')||doc.scrollingElement);
      if(!scroll)return;doc.documentElement.dataset.theme=panel.dataset.theme;
      if(!panel.classList.contains('fra-show-reader')){win.__frCancelReaderNavigation?.();return;}
      if(!sourceReady&&sourceDocumentKey(doc.location.href)!==sourceDocumentKey(localURL(sourceURL)))return;
      if(!sourceDocuments.has(doc)){
        sourceDocuments.add(doc);scroll.addEventListener('scroll',rememberSourcePosition,{passive:true});
        doc.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.defaultPrevented){e.preventDefault();returnToConversation();}});
        win.addEventListener('fr-reader-navigation',event=>{
          if(frame.contentDocument!==doc||!panel.classList.contains('fra-show-reader'))return;
          if(event.detail?.state==='landed'){setSourceLoading(false);updateSourceHeader(event.detail.url);rememberSourcePosition();}
        });
      }
      if(sourceReady&&sourceDocumentKey(doc.location.href)!==sourceDocumentKey(localURL(sourceURL))){sourceURL=doc.location.href;sourceTitle=doc.querySelector('h1')?.textContent||sourceTitle;updateSourceHeader();}
      const resume=frame.dataset.resume==='true',position=resume&&sourcePositions.get(localURL(sourceURL));
      if(position&&win.__frRestoreReaderPosition){win.__frRestoreReaderPosition(position);setSourceLoading(false);updateSourceHeader(sourceExternalLocation(position));}
      else if(win.__frNavigateReaderAnchor?.(localURL(sourceURL))){/* Reader owns hydration and landing. */}
      else{
        const request=sourceSequence;let attempts=0;
        const ready=()=>{if(request!==sourceSequence||!panel.classList.contains('fra-show-reader')||frame.contentDocument!==doc)return;if(doc.querySelector('#reading .row')||!doc.querySelector('#reading'))setSourceLoading(false);else if(++attempts<100)setTimeout(ready,100);};ready();
      }
    }catch(_){}
  }
  function rememberSourcePosition(){
    if(!panel||!sourceReady||$('.fra-reader').hidden)return;
    try{
      const frame=$('#fra-source-frame'),doc=frame.contentDocument,win=frame.contentWindow;
      if(sourceDocumentKey(doc.location.href)!==sourceDocumentKey(localURL(sourceURL)))return;
      const snapshot=win.__frCaptureReaderPosition?.();
      if(snapshot){sourcePositions.set(localURL(sourceURL),structuredClone(snapshot));$('#fra-source-open').href=localURL(sourceExternalLocation(snapshot));$('#fra-source-location').textContent=snapshot.page!=null?'Passage '+snapshot.page:'';return;}
    }catch(_){}
  }
  function restoreConversationPosition(){
    const saved=sourceChatPosition;if(!saved||saved.chat!==current)return;const feed=$('#fra-feed');
    let target=sourceFocus?.isConnected?sourceFocus:null;
    if(!target&&sourceFocusRef){const host=sourceFocusRef.turn?$('#fra-thread').querySelector('[data-turn="'+CSS.escape(sourceFocusRef.turn)+'"]'):panel;target=sourceFocusRef.id?document.getElementById(sourceFocusRef.id):[...host?.querySelectorAll('a')||[]].find(a=>a.href===sourceFocusRef.href);}
    if(target?.getClientRects().length&&saved.offset!=null)feed.scrollTop+=target.getBoundingClientRect().top-feed.getBoundingClientRect().top-saved.offset;else feed.scrollTop=saved.scroll;
    target?.focus({preventScroll:true});
  }
  function showConversation(){
    if(!panel)return;const wasSource=panel.classList.contains('fra-show-reader');rememberSourcePosition();sourceSequence++;sourceRestore++;clearTimeout(sourceStatusTimer);sourceStatusTimer=null;
    try{$('#fra-source-frame').contentWindow.__frCancelReaderNavigation?.();}catch(_){}
    $('.fra-reader').hidden=true;$('.fra-mobile-tabs').hidden=!sourceURL;panel.classList.remove('fra-show-reader');
    panel.classList.toggle('fra-with-reader',!!sourceURL&&(matchMedia('(max-width:800px)').matches||panel.classList.contains('fra-docked')));
    $('#fra-chat-tab').classList.add('active');$('#fra-read-tab').classList.remove('active');
    if(wasSource){const request=sourceSequence;requestAnimationFrame(()=>{if(request===sourceSequence)restoreConversationPosition();});}
  }
  function returnToConversation(){
    const stepBack=!sourceReturning&&history.state&&history.state.frAskSource&&history.state.frAskSource.chat===current;
    showConversation();if(stepBack){sourceReturning=true;history.back();}
  }
  function forgetSource(){
    showConversation();sourceURL='';sourceTitle='';sourceFocus=null;sourceFocusRef=null;sourceChatPosition=null;sourcePositions.clear();sourceReady=false;sourceRestore++;sourceReturning=false;if(panel){$('.fra-mobile-tabs').hidden=true;panel.classList.remove('fra-with-reader');}
    if(history.state&&history.state.frAskSource){const state={...history.state};delete state.frAskSource;history.replaceState(state,'');}
  }
  // SOURCE PANE WIDTH (owner 2026-09-11 "allow to shift how much space it takes up on screen"):
  // a drag handle between the conversation and the source pane sets --fra-source-w (28–76% of
  // the body), remembered per browser (fra_source_w); double-click resets to the 53% default;
  // the handle is a keyboard separator (←/→ 3%, Home/End). Desktop overlay + standalone only —
  // phones stack the pane behind the Read source tab and the docked rail has no source pane.
  const SPLIT_MIN=28,SPLIT_MAX=76,SPLIT_KEY='fra_source_w';
  function setSplit(pct,save){
    pct=Math.round(Math.max(SPLIT_MIN,Math.min(SPLIT_MAX,pct)));
    panel.style.setProperty('--fra-source-w',pct+'%');
    const h=$('#fra-split');if(h){h.setAttribute('aria-valuenow',String(pct));h.setAttribute('aria-valuetext',pct+'% of the window for the source');}
    if(save){try{localStorage.setItem(SPLIT_KEY,String(pct));}catch(_){}}
  }
  function resetSplit(){panel.style.removeProperty('--fra-source-w');const h=$('#fra-split');if(h){h.setAttribute('aria-valuenow','53');h.setAttribute('aria-valuetext','53% of the window for the source');}try{localStorage.removeItem(SPLIT_KEY);}catch(_){}}
  function initSplit(){
    const h=$('#fra-split');if(!h)return;
    let saved=NaN;try{saved=parseInt(localStorage.getItem(SPLIT_KEY)||'',10);}catch(_){}
    if(Number.isFinite(saved))setSplit(saved,false);else h.setAttribute('aria-valuenow','53');
    let drag=null;
    const pctFromX=x=>{const body=$('.fra-body').getBoundingClientRect();return (body.right-x)/Math.max(1,body.width)*100;};
    h.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();drag={id:e.pointerId};h.setPointerCapture(e.pointerId);panel.classList.add('fra-resizing');setSplit(pctFromX(e.clientX),false);});
    h.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;setSplit(pctFromX(e.clientX),false);});
    const end=e=>{if(!drag||(e&&e.pointerId!==drag.id))return;drag=null;panel.classList.remove('fra-resizing');try{h.releasePointerCapture(e.pointerId);}catch(_){}const now=parseInt(h.getAttribute('aria-valuenow')||'53',10);setSplit(now,true);};
    h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end);
    h.addEventListener('dblclick',e=>{e.preventDefault();resetSplit();});
    h.addEventListener('keydown',e=>{const now=parseInt(h.getAttribute('aria-valuenow')||'53',10);
      if(e.key==='ArrowLeft'){e.preventDefault();setSplit(now+3,true);}         // handle moves left = source grows
      else if(e.key==='ArrowRight'){e.preventDefault();setSplit(now-3,true);}
      else if(e.key==='Home'){e.preventDefault();setSplit(SPLIT_MAX,true);}
      else if(e.key==='End'){e.preventDefault();setSplit(SPLIT_MIN,true);}
      else if(e.key==='Enter'||e.key===' '){e.preventDefault();resetSplit();}});
  }
  async function openSource(href,title,recordHistory=true,resume=false,trigger=null){
    const u=new URL(href,location.origin);if(u.origin!==location.origin){window.open(u.href,'_blank','noopener');return;}
    if(panel.classList.contains('fra-docked')&&window.FRReaderResearch?.navigate(u.href)){showConversation();return;}
    const wasSource=panel.classList.contains('fra-show-reader');if(wasSource)rememberSourcePosition();
    const request=++sourceSequence,chat=current;
    if(!wasSource&&!resume){
      sourceFocus=trigger||document.activeElement;sourceFocusRef={id:sourceFocus?.id,href:sourceFocus?.href,turn:sourceFocus?.closest?.('[data-turn]')?.dataset.turn};
      const feed=$('#fra-feed');sourceChatPosition={chat,scroll:feed.scrollTop,offset:feed.contains(sourceFocus)?sourceFocus.getBoundingClientRect().top-feed.getBoundingClientRect().top:null};
    }
    sourceURL=u.href;sourceTitle=title||'Source passage';sourceReady=false;$('#fra-input').blur();
    $('.fra-reader').hidden=false;$('.fra-mobile-tabs').hidden=false;panel.classList.add('fra-with-reader','fra-show-reader');updateSourceHeader();setSourceLoading(true);
    clearTimeout(sourceStatusTimer);sourceStatusTimer=setTimeout(()=>{if(request===sourceSequence&&!sourceReady)setSourceLoading(true,'This passage is taking longer to load. You can open the full reader above.');},15000);
    if(recordHistory){const state={...(history.state||{}),frAskSource:{chat,url:sourceURL,title:sourceTitle}};if(history.state&&history.state.frAskSource)history.replaceState(state,'');else history.pushState(state,'');}
    $('#fra-read-tab').classList.add('active');$('#fra-chat-tab').classList.remove('active');
    const slug=u.searchParams.get('w')||(/^\/read\/([^/]+)/.exec(u.pathname)||[])[1];
    if(slug&&chat)try{await S.update(chat,c=>{c.contextWork=slug.replace(/\.html$/,'');});}catch(_){}
    if(request!==sourceSequence||chat!==current||!visible||!panel.classList.contains('fra-show-reader'))return;
    const frame=$('#fra-source-frame'),target=localURL(sourceURL);frame.dataset.resume=String(resume);frame.dataset.source=target;
    let loaded='';try{loaded=frame.contentWindow.location.href;}catch(_){}
    if(loaded&&sourceDocumentKey(loaded)===sourceDocumentKey(target)){
      const position=resume&&sourcePositions.get(target);
      if(position&&frame.contentWindow.__frRestoreReaderPosition){frame.contentWindow.__frRestoreReaderPosition(position);setSourceLoading(false);updateSourceHeader(sourceExternalLocation(position));}
      else if(frame.contentWindow.__frNavigateReaderAnchor?.(target)){/* Same work, one navigation owner. */}
      else if(loaded===target){setSourceLoading(false);}
      else{frame.contentWindow.location.replace(target);frame.contentWindow.location.reload();}
    }else frame.contentWindow.location.replace(target);
  }
  async function handleClick(e){
    const control=e.target.closest('[data-job-control]');if(control){e.preventDefault();try{await(await researchJobs()).control(current,control.dataset.jobTurn,control.dataset.jobControl);await refresh();}catch(error){toast(error.message);}return;}

    if(e.target.hasAttribute('data-history-close')){panel.classList.remove('fra-history-open');$('#fra-history-toggle').setAttribute('aria-expanded','false');return;}
    const b=e.target.closest('button'),link=e.target.closest('a');
    if(link&&(link.target==='_blank'||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button>0))return;
    if(link){const u=new URL(link.href,location.origin);if(u.origin===location.origin){e.preventDefault();if(/^\/read/.test(u.pathname)||link.classList.contains('fra-cite')||link.classList.contains('fra-source')){openSource(link.href,link.getAttribute('title')||link.querySelector('.fra-source-name')?.textContent||link.textContent.trim(),true,false,link);}else if(conversations.some(running)){openSource(link.href,link.textContent.trim());}else{await close();location.href=localURL(link.href);}}return;}
    if(!b)return;
    if(b.id==='fra-command-toggle'){openCommands();return;}
    if(b.id==='fra-state'){const c=selected(),t=running(c)||c.turns[c.turns.length-1],node=t&&panel.querySelector('[data-turn="'+CSS.escape(t.id)+'"]');const activity=node?.querySelector('.fra-activity'),target=t?.status==='running'?node?.querySelector('.fra-progress'):activity||node;if(activity&&t?.status!=='running')activity.open=true;target?.scrollIntoView({block:'center',behavior:'auto'});return;}
    if(b.hasAttribute('data-show-conversations')){showConversations();return;}
    if(b.dataset.previewSource){await flushDraft();await openSource(b.dataset.previewSource,b.dataset.previewTitle,true,false,b);return;}
    if(b.dataset.chat){await switchChat(b.dataset.chat);return;}
    if(b.dataset.prompt){if(b.dataset.research){await S.update(current,c=>{c.mode=b.dataset.research;});await refresh();}$('#fra-input').value=b.dataset.prompt;fitInput();await flushDraft();$('#fra-input').focus();return;}
    if(b.dataset.mode){await S.update(current,c=>{c.mode=b.dataset.mode;});togglePopover('fra-modes',false);await refresh();if(b.dataset.mode==='scan')openScope();return;}
    if(b.dataset.addWork||b.dataset.removeWork||b.dataset.addAuthor||b.dataset.removeAuthor||b.dataset.removeGroup||b.id==='fra-all-scope'){
      if($('#fra-scope').dataset.chat!==current)return;
      const id=current,removing=b.dataset.removeWork||b.dataset.removeAuthor||b.dataset.removeGroup;
      await S.update(id,c=>{c.scope=editableScope(c.scope);const s=c.scope;
        if(b.id==='fra-all-scope'){s.shelves=[];s.authors=[];s.works=[];s.groups=[];}
        for(const [field,add,remove] of [['works',b.dataset.addWork,b.dataset.removeWork],['authors',b.dataset.addAuthor,b.dataset.removeAuthor],['groups',null,b.dataset.removeGroup]]){
          if(add)s[field]=s[field].includes(add)?s[field].filter(v=>v!==add):[...s[field],add];
          if(remove)s[field]=s[field].filter(v=>v!==remove);
        }
      });await refresh();if(current===id){renderScopeSelection();if(removing)$('#fra-work-search').focus({preventScroll:true});}return;
    }
    if(b.hasAttribute('data-history-close')){panel.classList.remove('fra-history-open');$('#fra-history-toggle').setAttribute('aria-expanded','false');return;}
    if(b.hasAttribute('data-scope-close')){togglePopover('fra-scope',false);$('#fra-scope-toggle').focus();return;}
    const c=selected();
    if(b.dataset.jump!=null&&b.dataset.jumpTurn){const node=panel.querySelector('[data-turn="'+CSS.escape(b.dataset.jumpTurn)+'"]'),feed=$('#fra-feed');if(!node)return;
      const bar=node.querySelector('.fra-outline'),target=b.dataset.jump==='top'?node:node.querySelectorAll('.fra-answer h3')[+b.dataset.jump];if(!target)return;
      const top=target.getBoundingClientRect().top-feed.getBoundingClientRect().top+feed.scrollTop-(b.dataset.jump==='top'?12:(bar?.offsetHeight||0)+10);
      feed.scrollTo({top:Math.max(0,top),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});return;}
    if(b.dataset.sources){const node=panel.querySelector('[data-turn="'+CSS.escape(b.dataset.sources)+'"]'),sources=node?.querySelector('.fra-sources');if(sources){sources.open=true;sources.querySelector('summary').scrollIntoView({block:'center'});sources.querySelector('summary').focus();}return;}
    if(b.dataset.share){const t=c.turns.find(t=>t.id===b.dataset.share);if(!t)return;b.disabled=true;const was=b.textContent;b.textContent='Sharing…';
      try{const r=await fetch('/api/share',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({q:t.q,a:shownAnswer(t),src:t.src||[],mode:t.mode||'ask'})});const d=await r.json();if(!r.ok||!d.url)throw Error(d.error||'share failed');
        let shared=false;if(navigator.share){try{await navigator.share({title:t.q,text:t.q,url:d.url});shared=true;}catch(_){}}
        if(!shared){try{await navigator.clipboard.writeText(d.url);toast('Share link copied: '+d.url);}catch(_){prompt('Share this answer',d.url);}}}
      catch(e){toast('Sharing failed. '+(e.message||''));}
      finally{b.disabled=false;b.textContent=was;}return;}
    if(b.dataset.copy){const t=c.turns.find(t=>t.id===b.dataset.copy);try{await navigator.clipboard.writeText(shownAnswer(t));toast('Answer copied.');}catch(_){toast('Copy is unavailable. Use Download conversation.');}return;}
    if(b.dataset.desk){const t=c.turns.find(t=>t.id===b.dataset.desk);if(window.FRDesk){await close();window.FRDesk.insertAnswer({...t,a:shownAnswer(t)});}else{try{sessionStorage.setItem('fr_desk_insert_v1',JSON.stringify({q:t.q,a:shownAnswer(t),src:t.src||[]}));await openSource('/desk','Desk');}catch(_){toast('The answer could not be sent to Desk. Copy or download it instead.');}}return;}
    if(b.dataset.note){const t=c.turns.find(t=>t.id===b.dataset.note);try{const notebook=window.FRResearchNotebook;if(!notebook)throw Error('Notebook unavailable');const result=await notebook.save({type:'note',id:'ask-'+t.id,chat:c.id,url:'/ask?chat='+encodeURIComponent(c.id),slug:c.contextWork||contextWork(),askTurn:t.id,text:'Q: '+t.q+'\n\n'+shownAnswer(t),askQuestion:t.q,askAnswer:shownAnswer(t),askSources:t.src||[],ts:Date.now()});b.textContent='Saved to notebook';b.disabled=true;toast('Saved in '+result.collectionName+'.');}catch(_){toast('The answer could not be saved. Download the conversation or try again.');}return;}
    if(b.dataset.folderRename){const old=b.dataset.folderRename,name=prompt('Folder name',old);if(name!=null&&name.trim()&&name.trim()!==old){const next=name.trim().slice(0,60);for(const x of conversations.filter(x=>folderOf(x)===old))await S.update(x.id,c=>{c.folder=next;});if(foldersClosed.delete(old))foldersClosed.add(next);await refresh();await mirror();}return;}
    if(b.dataset.deepen){if(running(c)){toast('Stop or finish the current answer first.');return;}const t=c.turns.find(t=>t.id===b.dataset.deepen);await send(t.q,'deep',t.scope,t.passage||null);return;}
    if(b.dataset.retry){if(running(c)){toast('Stop or finish the current answer before retrying.');return;}const t=c.turns.find(t=>t.id===b.dataset.retry);await send(t.q,t.mode,t.scope,t.passage||null);return;}
    switch(b.id){
      case 'fra-close':await close();break;
      case 'fra-reader-notes':await close();window.__frOpenNotebook?.('saved');break;
      case 'fra-expand':expandedReaderAsk=!expandedReaderAsk;syncPresentation();fitInput();break;
      case 'fra-passage-clear':await S.update(current,c=>{delete c.draftPassage;});await refresh();break;
      case 'fra-new':await flushDraft();await newConversation();panel.classList.remove('fra-history-open');$('#fra-history-toggle').setAttribute('aria-expanded','false');$('#fra-input').focus();break;
      /* MereO delta (Ian, 2026-09-21): "we already have a hamburger menu
         for that and it doesn't even work. It should work though."
         It did nothing on a wide screen, and the class was not the
         problem: BOTH rules that act on fra-history-open live inside
         max-width queries (800px, and 1150px beside the reader), so
         above those widths the class flipped and the sidebar's own
         display:flex stood. The button toggled a state nothing drew.
         Asking the SIDEBAR whether it is on screen, rather than asking
         a media query, means this keeps working wherever those
         breakpoints move to: on screen, put it away; off screen, bring
         it back. fra-history-collapsed is the wide-screen half and is
         cleared whenever it opens, so the two never fight. */
      case 'fra-history-toggle':{
        const side=panel.querySelector('.fra-sidebar');
        const shown=side&&getComputedStyle(side).display!=='none';
        panel.classList.toggle('fra-history-collapsed',shown);
        panel.classList.toggle('fra-history-open',!shown);
        b.setAttribute('aria-expanded',String(!shown));
        if(!shown)focusConversations();
        break;
      }
      case 'fra-show-archived':showArchived=!showArchived;b.setAttribute('aria-pressed',String(showArchived));renderHistory();break;
      case 'fra-mode-toggle':togglePopover('fra-modes');break;
      case 'fra-scope-toggle':if($('#fra-scope').hidden)openScope();else togglePopover('fra-scope',false);break;
      case 'fra-send':await send();break;
      case 'fra-jump':$('#fra-feed').scrollTop=$('#fra-feed').scrollHeight;break;
      case 'fra-more-toggle':togglePopover('fra-more');break;
      case 'fra-rename':{const name=prompt('Conversation title',c.t);if(name&&name.trim())await S.update(c.id,c=>{c.t=name.trim().slice(0,120);});togglePopover('fra-more',false);await refresh();break;}
      case 'fra-archive':await S.update(c.id,c=>{c.archived=!c.archived;});togglePopover('fra-more',false);await refresh();await mirror();break;
      case 'fra-folder':{const pick=$('#fra-folder-pick');pick.hidden=!pick.hidden;$('#fra-confirm').hidden=true;if(!pick.hidden){$('#fra-folder-list').innerHTML=folderNames().map(n=>'<option value="'+esc(n)+'">').join('');$('#fra-folder-name').value=folderOf(c);$('#fra-folder-name').focus();}break;}
      case 'fra-folder-save':{const name=$('#fra-folder-name').value.trim().slice(0,60);await S.update(c.id,c=>{c.folder=name;});if(name)foldersClosed.delete(name);togglePopover('fra-more',false);$('#fra-folder-pick').hidden=true;await refresh();await mirror();announce(name?'Moved to '+name:'Removed from its folder');break;}
      case 'fra-folder-clear':await S.update(c.id,c=>{c.folder='';});togglePopover('fra-more',false);$('#fra-folder-pick').hidden=true;await refresh();await mirror();break;
      case 'fra-delete':{const box=$('#fra-confirm');box.hidden=!box.hidden;$('#fra-folder-pick').hidden=true;$('#fra-confirm-text').textContent=running(c)?'Stop the running research and delete this conversation? This cannot be undone.':'Delete this conversation? This cannot be undone.';if(!box.hidden)$('#fra-confirm-no').focus();break;}
      case 'fra-confirm-no':$('#fra-confirm').hidden=true;break;
      case 'fra-confirm-yes':togglePopover('fra-more',false);$('#fra-confirm').hidden=true;await deleteConversation(c.id);break;
      case 'fra-delete-archived':{if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='Confirm: delete '+conversations.filter(x=>x.archived).length+' archived';return;}for(const x of conversations.filter(x=>x.archived))await deleteConversation(x.id);showArchived=false;$('#fra-show-archived').setAttribute('aria-pressed','false');await refresh();break;}
      case 'fra-export':{const md='# '+c.t+'\n\n'+c.turns.map(t=>'## '+t.q+'\n\n'+(t.passage?'> '+String(t.passage.text||'').replace(/\n/g,'\n> ')+'\n\n'+(t.passage.cite||'Selected passage')+(safeURL(t.passage.url)?' · [Read passage]('+safeURL(t.passage.url)+')':'')+'\n\n':'')+shownAnswer(t).replace(/\]\(\/api\/corpus\?/g,'](https://thefaithreceived.vercel.app/api/corpus?')+'\n\n'+(t.src||[]).map(s=>'- ['+titleOf(s)+(s.page!=null?' · '+s.page:'')+']('+(safeURL(s.link)||'https://thefaithreceived.vercel.app'+readURL(s.slug,s.page))+')').join('\n')+(t.status!=='complete'?'\n\nStatus: '+t.status:'' )).join('\n\n');const url=URL.createObjectURL(new Blob([md],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=c.t.replace(/[^a-z0-9 -]/gi,'').slice(0,70)+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);togglePopover('fra-more',false);break;}
      case 'fra-theme':{const dark=panel.dataset.theme==='dark';panel.dataset.theme=dark?'light':'dark';document.documentElement.dataset.theme=panel.dataset.theme;localStorage.setItem('fr_theme',panel.dataset.theme);try{$('#fra-source-frame').contentDocument.documentElement.dataset.theme=panel.dataset.theme;}catch(_){}break;}
      case 'fra-notify':{if(localStorage.getItem('fr_ask_notify')==='1'){localStorage.setItem('fr_ask_notify','0');toast('Browser notifications turned off. In-site notices remain on.');}else if(!('Notification'in window)){toast('This browser supports in-site notices only.');}else{const permission=await Notification.requestPermission();if(permission==='granted'){localStorage.setItem('fr_ask_notify','1');toast('Completion notifications enabled while the site is open.');}else toast('Browser notifications are blocked. In-site notices still work.');}renderHeader();break;}
      case 'fra-chat-tab':returnToConversation();break;
      case 'fra-read-tab':if(sourceURL)await openSource(sourceURL,sourceTitle,true,true);break;
      case 'fra-source-back':returnToConversation();break;
      case 'fra-source-close':returnToConversation();break;
    }
  }
  function focusConversations(){
    // Opening the history drawer is navigation. Touch users choose when to type.
    const target=matchMedia('(max-width:800px), (any-pointer:coarse)').matches?$('.fra-sidebar'):$('#fra-history-search');
    target.focus({preventScroll:true});
  }
  function showConversations(){panel.classList.add('fra-history-open');$('#fra-history-toggle').setAttribute('aria-expanded','true');focusConversations();}
  async function open(opts={}){
    // MereO: use the same Ghost member state as the server-rendered beta gate.
    // Embedded Ask doors remain available, but lead signed-out readers to sign in.
    // MereO 2026-09-24 (Ian: every door to a tool meets the subscribe pop-up):
    // this is the one function every Ask door goes through (the buttons, the
    // Cmd/Ctrl+Shift+A shortcut, a ?ask= address), so a reader who cannot use
    // Ask gets feature-gate.js's modal here instead of being sent to /ask/.
    // The redirect below stays as the fallback for a page without the bundle.
    if (window.MOFeatureGate && window.MOFeatureGate.open('ask')) return;
    if (!document.body.hasAttribute('data-member-status')) {
      const destination = new URL(CFG.askPath, location.origin);
      if (opts.q) destination.searchParams.set('q', opts.q);
      const tradition = opts.tradition || opts.shelves?.[0] || new URLSearchParams(location.search).get('trad');
      if (tradition) destination.searchParams.set('trad', tradition);
      location.assign(destination.href);
      return;
    }

    if(!opts.id&&!opts.fresh){const sourceChat=new URLSearchParams(location.search).get('ask_chat');if(sourceChat)opts={...opts,id:sourceChat};}
    if(opts.mode)opts={...opts,mode:researchMode(opts.mode)};
    if(!panel)build();if(!visible)focusBefore=document.activeElement;window.FRReaderResearch?.close(false);visible=true;document.documentElement.classList.add('fra-open');/* The workspace is a fixed overlay, but the PAGE BEHIND IT still scrolled: html.fra-open{overflow:hidden} was written in the stylesheet and close() removed the class, but nothing ever added it, so on a phone you could drag the overlay and reveal the library underneath — the view changing scope under your thumb (owner, 2026-09-12; confirmed in the browser at 390px: documentScrolls was true). */panel.hidden=false;document.documentElement.classList.add('fra-open');syncPresentation();
    const theme=localStorage.getItem('fr_theme');panel.dataset.theme=theme==='dark'||!theme&&matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';
    fitViewport();
    // MereO delta: the reader's count, every time the workspace opens.
    loadUsage();
    try{
      await init();
      /* belongsHere: without it the last conversation was restored whatever
         book you opened, so the rail sat in Augustine's Genesis naming
         Justin Martyr (Ian, 2026-09-21; seen at /read/?w=pld-2741). */
      if(!opts.id&&!opts.fresh&&!current&&S.meta){const last=(await S.meta('active-conversation'))?.value;if(conversations.some(c=>c.id===last&&!c.archived&&belongsHere(c)))opts={...opts,id:last};}
      if(opts.id&&conversations.some(c=>c.id===opts.id))await switchChat(opts.id);
      else if(opts.fresh||!current||readerPage()&&selected()?.contextWork!==contextWork()){
        const recent=conversations.find(c=>!c.archived&&belongsHere(c));
        if(!opts.fresh&&!opts.q&&!opts.works&&recent)current=recent.id;else await newConversation(opts);
      }
      if(!selected())await newConversation(opts);
      if(opts.q){$('#fra-input').value=opts.q;await S.update(current,c=>{c.draft=opts.q;});}
      if(opts.passage?.text)await S.update(current,c=>{c.draftPassage={text:String(opts.passage.text),cite:String(opts.passage.cite||''),url:safeURL(opts.passage.url),slug:String(opts.passage.slug||''),page:String(opts.passage.page||''),row:String(opts.passage.row||'')};});
      if(opts.works||opts.tradition||opts.shelves||opts.authors||opts.groups)await S.update(current,c=>{c.scope={...c.scope,works:opts.works||[],shelves:opts.shelves||(opts.works?[]:opts.tradition?[shelfName(opts.tradition)]:[]),authors:opts.authors||[],groups:opts.groups||[],tradition:''};});
      if(opts.contextWork||!opts.id&&contextWork())await S.update(current,c=>{c.contextWork=opts.contextWork||contextWork();});
      if(S.setMeta)await S.setMeta('active-conversation',current);
      await S.update(current,c=>{c.unread=false;});await refresh();syncComposer();
      if(opts.mode||researchMode(selected().mode)!==selected().mode){await S.update(current,c=>{c.mode=researchMode(opts.mode||c.mode);});await refresh();}
      loadCatalog().then(()=>{if(visible){renderHistory();renderThread();renderHeader();}});
      $('#fra-input').disabled=false;
      if(opts.autoSend&&opts.q)await send(opts.q);
      else if(!matchMedia('(pointer:coarse)').matches)$('#fra-input').focus();
      /* MereO delta: on a touch screen nothing used to take focus, deliberately, so
         the keyboard would not spring up. But the Escape handler is bound to the
         panel, and syncPresentation() marks every other body child inert the moment
         the workspace is modal — including the thumb bar that opened it. Focus sat
         on a now-inert button, Escape never reached the panel, and on a phone the
         ✕ inside the workspace was the only way out of it. Focus goes to that ✕
         instead: inside the panel, no keyboard, and the trap has something to hold.
         Same pattern read-tools.js uses for the Research panel. */
      else if(!panel.classList.contains('fra-docked'))$('#fra-close')?.focus({preventScroll:true});
      if(opts.view==='history')showConversations();
      if(window.cgptLink)window.cgptLink.mount();
    }catch(e){$('#fra-save-state').textContent=storageError||e.message;announce(storageError||e.message);}
  }
  async function close(){if(!panel||!visible)return;closeCommands();await flushDraft();forgetSource();visible=false;panel.hidden=true;expandedReaderAsk=false;document.documentElement.classList.remove('fra-open');syncPresentation();const focusTarget=focusBefore?.isConnected&&focusBefore.getClientRects().length&&!focusBefore.closest('[inert]')?focusBefore:[...document.querySelectorAll('#fra-launcher,.frthumb [data-t="ask"]')].find(e=>e.getClientRects().length&&!e.closest('[inert]'));focusTarget?.focus({preventScroll:true});await mirror();}
  window.FRAsk={open,close,isOpen:()=>visible,markdown,readURL,sourceHref,sourceCard,sourceVisitURL,sourceGroups,sourceCollectionHTML,foundHTML,quotedParagraph,researchState,commandMatches,turnModeLabel,offersDeep,shownAnswer,shownError,deliveryIncomplete};
  function mountLauncher(launcher){
    const modes=document.querySelector('.desk-workspace-bar .desk-modes');
    if(modes){launcher.classList.add('fra-in-toolbar');modes.after(launcher);}
    else document.body.appendChild(launcher);
  }
  function bootstrap(){
    /* MereO delta (Ian, 2026-09-21: "buttons that open but don't close"). The
       launcher was open-only. That is invisible wherever the workspace is modal,
       because syncPresentation() marks every other body child inert and the button
       cannot be reached at all; but on the reader at 1100px and up Ask DOCKS beside
       the book, nothing is inert, and the button that opened it sat there taking
       presses and doing nothing. Standalone /ask/ is excluded: there the workspace
       is the page, and faith-ask-open.js turns a close into leaving the page. */
    const launcher=document.createElement('button');launcher.id='fra-launcher';launcher.className='fra-launcher';launcher.innerHTML=icon('chat')+'<span>Ask</span>';launcher.onclick=()=>{if(visible&&!ASK_PATH_RE.test(location.pathname))return close();return open();};if(CFG.launcher!==false)mountLauncher(launcher);
    const notices=document.createElement('div');notices.id='fra-notices';document.body.appendChild(notices);
    const announcer=document.createElement('div');announcer.id='fra-announcer';announcer.className='fra-sr';announcer.setAttribute('role','status');announcer.setAttribute('aria-live','polite');document.body.appendChild(announcer);
    init().then(()=>researchJobs()).catch(()=>{launcher.title='Open Ask to check conversation storage';});
    if(updates)updates.onmessage=()=>scheduleRefresh();
    document.addEventListener('click',e=>{
      if(e.target.closest('#fra-workspace,#fra-launcher,#fra-notices'))return;
      if(e.target.closest('a')&&(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button>0))return;
      const target=e.target.closest('#heroAsk,#rsAsk,#tabAsk,[data-m="ask"],.frthumb [data-t="ask"],#heroSearchAsk');
      const link=e.target.closest('a[href]');let url;try{if(link)url=new URL(link.href);}catch(_){}
      if(!target&&link&&url&&url.origin===location.origin&&link.target!=='_blank'&&!link.hasAttribute('download')&&conversations.some(c=>running(c)&&!running(c).serverJob)&&/^\/(?:read(?:\/.*|\.html)?|search(?:\.html)?|desk(?:\.html)?|pins(?:\.html)?|bible(?:\.html)?|fathers(?:\.html)?|topics(?:\.html)?|web(?:\.html)?|dtc(?:\.html)?|)$/.test(url.pathname)&&!(url.pathname===location.pathname&&url.search===location.search&&url.hash)){
        e.preventDefault();e.stopImmediatePropagation();open().then(()=>openSource(url.href,link.textContent.trim()));return;
      }
      if(target||url&&url.origin===location.origin&&(ASK_PATH_RE.test(url.pathname)||url.searchParams.get('m')==='ask'||url.searchParams.has('ask'))){
        e.preventDefault();e.stopImmediatePropagation();
        const q=target&&target.id==='heroAsk'?(document.getElementById('heroQ')||{}).value||'':url&&(url.searchParams.get('ask')||url.searchParams.get('q'))||'';
        open({q,autoSend:!!q,id:url&&url.searchParams.get('chat')||undefined,view:url&&url.searchParams.get('view')||undefined,tradition:url&&url.searchParams.get('trad')||undefined});
      }
    },true);
    document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key.toLowerCase()==='a'){e.preventDefault();open();}});
    window.addEventListener('pagehide',()=>{if(visible)flushDraft().catch(()=>{});});
    window.addEventListener('storage',e=>{if(e.key==='fr_theme'&&['light','dark','sepia'].includes(e.newValue)){document.documentElement.dataset.theme=e.newValue;if(panel)panel.dataset.theme=e.newValue==='sepia'?'light':e.newValue;}if(e.key==='fr_chats')migrate().then(refresh).catch(()=>{});});
    const params=new URLSearchParams(location.search);
    if(window.__FR_ASK_PENDING__){const pending=window.__FR_ASK_PENDING__;delete window.__FR_ASK_PENDING__;open(pending);}
    else if(ASK_PATH_RE.test(location.pathname)||params.get('m')==='ask'||params.has('ask'))open({id:params.get('chat')||undefined,view:params.get('view')||undefined,q:params.get('ask')||params.get('q')||'',tradition:params.get('trad')||undefined});
    setInterval(()=>{if(visible)panel.querySelectorAll('.fra-elapsed').forEach(e=>e.textContent=elapsed(+e.dataset.start));},1000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});else bootstrap();
})();
