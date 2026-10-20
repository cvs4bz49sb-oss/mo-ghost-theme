
function esc(s){var x=document.createElement('div');x.textContent=(s==null?'':s);return x.innerHTML;}
function scopeSummary(){
  var bits=[];
  var cc=document.querySelector('#corpusChips .cc.on');
  if(cc&&cc.getAttribute('data-c'))bits.push(cc.textContent.trim());
  if(FAC.author)bits.push(FAC.author);
  if(FAC.work)bits.push('1 work');
  if(FAC.trad)bits.push(FRSearch.display(FAC.trad));if(FAC.collection)bits.push('Confessions');
  if(typeof SCOPE!=='undefined'&&SCOPE&&SCOPE.author)bits.push(SCOPE.author);
  var el=document.getElementById('stSum');
  if(el)el.textContent=[FAC.author,FAC.work||FAC.workQuery,FAC.collection,FAC.group].filter(Boolean).length?' · active':'';var scope=document.getElementById('activeSearchScope'),parts=[({westminster:'Westminster Divines',puritan:'Puritans',anglican:'Anglicans'})[FAC.group],FAC.author?'Author: '+FAC.author:'',FAC.work||FAC.workQuery?'Work filter applied':'',FAC.collection?'Confessions':''].filter(Boolean);if(scope){scope.hidden=!parts.length;scope.textContent=parts.join(' · ');}
}
document.addEventListener('click',function(e){
  var mo=e.target.closest('#smMore');
  if(mo){document.querySelector('.smodes').classList.add('sm-open');mo.setAttribute('aria-expanded','true');return;}
  var sg=e.target.closest('.ask-sugg button');
  if(sg){var q2=sg.getAttribute('data-q');if(q2){if(sg.getAttribute('data-deep'))window.__askDeepOnce=true;qEl.value=q2;renderAsk(q2);}return;}
  var t=e.target.closest('#scopeToggle');
  if(t){var w=document.getElementById('scopeWrap');var open=!w.classList.contains('open');
    w.classList.toggle('open',open);w.hidden=!open;t.setAttribute('aria-expanded',open?'true':'false');return;}

});
/* The reading-theme button this bound to lived in the page's own nav bar, which
   f437129 removed in favour of the shared rail. Unguarded, it took the whole
   file down with it: a TypeError here is thrown at the top level, so every
   line below stopped running and the mode tabs, the Search button and the
   result list were never wired at all. The saved theme is still applied on
   load by search.in02.js; only the toggle is gone, and it went on purpose. */
function focusQuery(){if(!matchMedia('(max-width:640px)').matches)qEl.focus();}
function mdHeadings(s){return (s||'').replace(/⟦h⟧([\s\S]{1,300}?)⟦\/?h⟧/g,'<b>$1</b>');}
var FRB='https://mo-tfr-library.mo-podcast-feed.workers.dev';
var VER='?d='+new Date().toISOString().slice(0,10);   // daily buster on mutable JSON
/* the reader's page for a key: a Migne key 'vol:col' + section letter (the word index and the Fathers' index: '20:0649B') is
   the reader's column 649 — it does not resolve the long form, and the work opened at its start */
function readerPage(page){var s=page==null?'':String(page),m=/^\d+:0*(\d+)[A-Da-d]?$/.exec(s);return m?m[1]:(/^\d+$/.test(s)?s.replace(/^0+(?=\d)/,''):s);}
function rdHref(slug,page){return FRSearch.readerURL(slug,page==null||page===''?page:readerPage(page));}
var qEl=document.getElementById('q'),res=document.getElementById('results'),ct=document.getElementById('count'),hint=document.getElementById('hint');
var MODE='title',NAV=null,WLIST=null,WORKS_BY_SLUG=null,WORK_ALIASES={},IDX=null,seq=0,CATALOG_ERROR=false,RESULT_PAGE=0,RESTORE_PAGE=null,ORDER='shelf',
/* Find a work: 50 works to a page (2026-10-10, owner: "work search only returns max 10 items"; it was 10, so "augustine" ran to
   37 pages). setPager takes the page size its caller drew with (By idea draws 15; the pager counted 10 and said "1–10 of"). */
WORKS_PAGE=50,REDRAW=null,SCOPE_SCHOOLS=null;
var HINTS={
  title:'Searches titles, authors and chapter headings, to find a book. To find where a word or an idea appears inside the books, use Search the texts.',
  full:'Every work that uses the word, on every page, its Latin endings counted together, by tradition, most uses first; open a work for its passages. Put a phrase in quotes to find the words together: “foedus operum”.',
  meaning:'Describe what you want to find. For example, “how faith unites us to Christ” finds passages even when they use different words.',
  scripture:'Search a chapter, verse, or range, such as Romans 8:1–4.',
  tradition:'One question, the whole tradition: the strongest parallels era by era \u2014 Greek and Latin Fathers, Aquinas, the early-modern library \u2014 in chronological order.',
  ask:'Ask a question; an answer is composed from the corpus with [work/pN] citations you can click. Press Enter to ask.'};
var PH={title:'Title, author, or chapter heading',full:'A word, or a phrase in quotes',
  meaning:'Describe the idea you want to find',
  scripture:'Enter a Bible reference, such as Romans 8',
  tradition:'A doctrine — e.g. the descent of Christ into hell · the worship of images…',
  ask:'Ask a question — e.g. How do the Reformed treat middle knowledge?'};
function setMode(m){
  if(m==='tradition'){
    var topic=qEl.value.trim();var opts={fresh:true,shelves:FAC.trad?[FRSearch.label(FAC.trad)]:[],mode:'deep',q:topic?'Trace “'+topic+'” through the theological tradition. Compare the authors, show where they agree or differ, and cite the passages.':'Trace the history of a theological idea, comparing the authors and citing the passages.'};
    setMode('title');if(window.FRAsk)window.FRAsk.open(opts);else window.__FR_ASK_PENDING__=opts;return;
  }
  if(m==='ask'){if(FAC.group==='westminster'&&!FAC.groupSlugs){ensureSearchGroups().then(function(){setMode('ask');}).catch(function(){searchUnavailable('Westminster group',qEl.value);});return;}var selectedWorks=(FAC.author||FAC.workQuery||FAC.work||FAC.collection||FAC.group)?(WLIST||[]).filter(function(w){return FRSearch.matches(w,FAC);}).map(function(w){return w.slug;}):[];var askOptions={fresh:true,q:qEl.value.trim(),works:selectedWorks,shelves:!selectedWorks.length&&FAC.trad?[FRSearch.label(FAC.trad)]:[]};if(window.FRAsk)window.FRAsk.open(askOptions);else window.__FR_ASK_PENDING__=askOptions;return;}MODE=m;
  var method=document.getElementById('passageMethod');if(method){method.hidden=m!=='full'&&m!=='meaning';method.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.passage===m));});}

  var tip=document.getElementById('smodesHint');if(tip)tip.style.display=(m==='title')?'':'none';   // teaches the modes BEFORE one is chosen; inside a mode the per-mode hint speaks
  var chips=document.getElementById('corpusChips');
  if(chips)chips.hidden=(m!=='full'&&m!=='meaning');
  var st2=document.getElementById('scopeToggle');
  if(st2){st2.hidden=false;scopeSummary();}document.querySelectorAll('.smodes button').forEach(function(b){var on=b.getAttribute('data-m')===(m==='meaning'?'full':m);b.classList.toggle('active',on);b.setAttribute('aria-pressed',on?'true':'false');});
  hint.innerHTML=(m==='ask')?'':HINTS[m];
  qEl.placeholder=PH[m];qEl.setAttribute('aria-label',m==='scripture'?'Bible reference':'Search the library');
  var fb=document.getElementById('facets');if(fb)fb.style.display='';
  var sb=document.getElementById('scopeBar');if(sb)sb.style.display=(m==='ask')?'':'none';   // '' lets the CSS govern: hidden until the ⌖ sheet adopts it
  {var dh=document.getElementById('sdoorsHost');
   if(!dh&&res&&res.parentNode){dh=document.createElement('div');dh.id='sdoorsHost';res.parentNode.insertBefore(dh,res);}
   if(dh)dh.innerHTML='';}
  if(m==='ask'){askReset();
    /* CLAUDE-IDIOM (owner 2026-09-05 "should instantly resonate … remind them of claude.com /
       chatgpt.com"): greeting first, then THE composer beneath it — the one query input moves
       under the welcome word in ask mode and home again for every other mode. */
    document.body.classList.add('mode-ask');   // #q hides; the composer owns the ask
  }else{
    document.body.classList.remove('mode-ask');
  }
  run();}
document.querySelectorAll('.smodes button[data-m]').forEach(function(b){b.addEventListener('click',function(){setMode(b.getAttribute('data-m'));if(b.getAttribute('data-m')!=='ask')focusQuery();});});
document.querySelectorAll('[data-passage]').forEach(function(b){b.onclick=function(){setMode(b.dataset.passage);focusQuery();};});
document.getElementById('runSearch').onclick=function(){run();};

/* ---- works map: Blob works-index — every mode's cite/title join ---- */
var _navq=null;
function navMap(cb){if(NAV)return cb(NAV);
  if(_navq){_navq.push(cb);return;}
  _navq=[cb];
  Promise.all([FRResearchData.corpus(),FRResearchData.json('/v1/workgroups.json').catch(()=>({})),fetch('https://mo-tfr-library.mo-podcast-feed.workers.dev/v1/data/workgroups.json',{signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.json():{}).catch(()=>({}))]).then(function([corpus,published,local]){FRResearch.setWorkCatalogue({bySlug:corpus.works,groups:{works:{...(published.works||{}),...(local.works||{})},groups:{...(published.groups||{}),...(local.groups||{})}}});
    WORK_ALIASES=corpus.aliases||{};var rows=Array.from(corpus.works.values()).map(function(w){return Object.assign({},w,{author:Array.isArray(w.author)?w.author.join(', '):String(w.author||'')});});NAV={};WLIST=rows;WORKS_BY_SLUG={};
    rows.forEach(function(w){WORKS_BY_SLUG[w.slug]=w;if(w.slug)NAV[w.slug]={t:w.title_en||w.title||w.slug,a:w.author||'',al:w.author_la||'',v:w.volume||'',tr:w.tradition||'',n:w.n_pages||0};if(w.party)(PARTYSLUGS[w.party]=PARTYSLUGS[w.party]||[]).push(w.slug);});
    IDX=rows.filter(function(w){return w.slug;}).map(function(w){return {d:w.slug,k:'work',t:w.title_en||w.title||w.slug,o:w.title||'',la:w.title_la||'',a:w.author||'',al:w.author_la||''};});
    buildFacetLists();var q2=_navq;_navq=null;q2.forEach(function(f){f(NAV);});
  }).catch(function(){CATALOG_ERROR=true;NAV={};WLIST=[];IDX=[];WORKS_BY_SLUG={};var q2=_navq||[];_navq=null;q2.forEach(function(f){f(NAV);});});}
function docCite(d){var e=NAV&&NAV[d];if(!e)return 'The Faith Received';var parts=[];if(ORDER==='relevance'&&e.a)parts.push(esc(e.a));if(e.v)parts.push(esc(e.v));return parts.join(' · ');}
function docTitle(d){var e=NAV&&NAV[d];return e?esc(e.t||d):esc(d||'');}

/* ---- Facets: author / work / tradition — narrow any result set ---- */
var FAC={author:'',work:'',workQuery:'',trad:'',corpus:'',collection:'',group:'',groupSlugs:null};
var WORKMAP=null;
function facetOk(d){return FRSearch.matches(WORKS_BY_SLUG&&WORKS_BY_SLUG[d],FAC);}
function buildFacetLists(){
  var auth={},trad={};WORKMAP={};var wopts=[];
  (WLIST||[]).forEach(function(w){if(!w.slug)return;
    if(w.author)auth[w.author]=1;
    if(w.tradition)trad[w.tradition]=1;
    var label=(w.title||w.slug)+(w.author?' — '+w.author:'')+(w.volume?' ('+w.volume+')':'');
    WORKMAP[label]=w.slug;wopts.push(label);});
  var authList=Object.keys(auth).sort();wopts.sort();
  ['facAuthors','scopeAuthors'].forEach(function(id){var dl=document.getElementById(id);
    if(dl)dl.innerHTML=authList.filter(function(a){return !FAC.author||foldQ(a).includes(foldQ(FAC.author));}).slice(0,40).map(function(a){return '<option value="'+esc(a)+'">';}).join('');});
  ['facWorks','scopeWorks'].forEach(function(id){var dl=document.getElementById(id);
    if(dl)dl.innerHTML=wopts.filter(function(w){return !FAC.workQuery||foldQ(w).includes(foldQ(FAC.workQuery));}).slice(0,40).map(function(w){return '<option value="'+esc(w)+'">';}).join('');});
  var vs=document.getElementById('fTrad');
  if(vs&&vs.options.length<=1){
    var opts=['<option value="">All shelves</option>'];
    FRSearch.shelves.forEach(function(v){opts.push('<option value="'+esc(v.value)+'">'+esc(FRSearch.display(v.label))+'</option>');});
    vs.innerHTML=opts.join('');vs.value=FAC.trad;}
}
function facetInit(){
  navMap(function(){});
  var fa=document.getElementById('fAuthor'),fw=document.getElementById('fWork'),
      fv=document.getElementById('fTrad'),fc=document.getElementById('fClear');
  function upd(event){
    FAC.author=(fa&&fa.value||'').trim();
    FAC.trad=(fv&&fv.value||'').trim();
    var wv=(fw&&fw.value||'').trim();
    FAC.work=(wv&&WORKMAP&&WORKMAP[wv])||'';FAC.workQuery=FAC.work?'':wv;FAC.collection=document.getElementById('fCollection').value;FAC.group=document.getElementById('fGroup').value;buildFacetLists();scopeSummary();
    if(fc)fc.hidden=!(FAC.author||FAC.trad||FAC.work||FAC.workQuery||FAC.collection||FAC.group||FAC.set);
    if(event&&event.type==='input'&&MODE!=='title'){seq++;REDRAW=null;setPager(0,0,function(){});res.innerHTML='';ct.textContent='Select Search to apply these filters.';}else run();}
  if(fa)fa.addEventListener('input',upd);
  if(fw)fw.addEventListener('input',upd);
  if(fv)fv.addEventListener('change',upd);document.getElementById('fCollection').onchange=upd;document.getElementById('fGroup').onchange=upd;
  if(fc)fc.onclick=function(){if(fa)fa.value='';if(fw)fw.value='';if(fv)fv.value='';document.getElementById('fCollection').value='';document.getElementById('fGroup').value='';FAC.groupSlugs=null;FAC.set=null;upd();};}
document.getElementById('fTrad').innerHTML='<option value="">All shelves</option>'+FRSearch.shelves.map(function(s){return '<option value="'+esc(s.value)+'">'+esc(FRSearch.display(s.label))+'</option>';}).join('');
facetInit();

/* ---- Title mode: works-index first, then the lazy 154k section-heading tier ---- */
var _hFull=false,_hLoading=false;
function loadHeadingsTier(){
  if(_hFull||_hLoading)return;_hLoading=true;
  fetch(FRB+'/v1/headings.json'+VER).then(function(r){return r.json();}).then(function(j){
    var rows=(j&&j.h)||[];
    var add=rows.map(function(r2){var e=NAV&&NAV[r2[0]]||{};
      return {d:r2[0],k:'div',t:r2[2],a:e.a||'',page:r2[1]};});
    IDX=(IDX||[]).concat(add);_hFull=true;_hLoading=false;
    if(MODE==='title'){hint.textContent='Searches the titles, authors and chapter headings of '+(WLIST||[]).length.toLocaleString()+' works ('+rows.length.toLocaleString()+' headings), to find a book. To find where a word or an idea appears inside the books, use Search the texts.';RESTORE_PAGE=RESULT_PAGE;run();}
  }).catch(function(){_hLoading=false;});}
function foldQ(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/æ/g,'ae').replace(/œ/g,'oe').replace(/ſ/g,'s').replace(/v/g,'u').replace(/j/g,'i');}   // ligatures as the word index folds them (10-15)
/* HOW WELL A TITLE ANSWERS THE QUERY (2026-10-15): 0 the main title is the query, 1 it begins with it, 2 the query is a word of the
   main title, 3 it is elsewhere (a subtitle, the Latin, an epithet), 4 only a section heading matched. Ranks within the title tier
   of FRSearch.titleRank; an author with more matches only breaks ties ("institutes": Calvin's Institutes before seven books of
   Lactantius' Divine Institutes, which before were first by count alone). */
function titleMatch(g,fq){if(!g.work)return 4;var w=WORKS_BY_SLUG[g.work.d]||{};var ts=[g.work.t,w.title_en,w.title].filter(Boolean).map(function(t){return foldQ(String(t).split(/[,:;(]/)[0]).replace(/[^\p{L}\p{N} ]+/gu,' ').replace(/\s+/g,' ').trim();});var best=3;ts.forEach(function(t){var main=t.replace(/^(?:the|a|an) /,'');var s=main===fq?0:(main.indexOf(fq+' ')===0?1:((' '+main+' ').indexOf(' '+fq+' ')>=0?2:3));if(s<best)best=s;});return best;}
/* STANDING, FOR TIES (2026-10-15): among titles that answer the query equally well, the author the library cites more comes
   first (v1/reception/index.json: author slug -> [times cited, ...]; Calvin 25,130, Budde 496). 0-9000, lower first; an author
   not in the index, or before the file arrives, 9000. Loaded once; a title search on screen is redrawn when it lands. */
var STANDING=null;
function standing(a){if(!STANDING)return 9000;var k=String(a||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');var r=STANDING[k];var n=r&&r[0]?Number(r[0]):0;return 9000-Math.min(9000,Math.round(Math.log10(n+1)*1500));}
fetch(FRB+'/v1/reception/index.json',{credentials:'omit'}).then(function(r){return r.ok?r.json():null;}).then(function(d){if(!d)return;STANDING=d;if(MODE==='title'&&qEl.value.trim())run();}).catch(function(){});
function renderTitle(q){
  if(CATALOG_ERROR){searchUnavailable('Work catalogue',q);return;}
  if(!IDX){var waiting=seq,requestedPage=RESULT_PAGE;res.innerHTML='';ct.innerHTML='<span class="sbusy">loading…</span>';navMap(function(){if(waiting===seq){RESTORE_PAGE=requestedPage;run();}});return;}
  if(q.trim().length>=2)loadHeadingsTier();
  if(wixOk())FRWordIndex.teaser(document.getElementById('wordIndex'),wixScoped({query:q,post:wixPost,open:function(){setMode('full');}}));
  var toks=foldQ(q).split(/\s+/).filter(function(t2){return t2.length>=2;});
  var m=IDX.filter(function(e){
    var hay=foldQ(e.t+' '+(e.o||'')+' '+(e.la||'')+' '+e.a+' '+(e.al||''));
    return (toks.length||e.k==='work')&&toks.every(function(t2){return hay.indexOf(t2)>=0;})&&facetOk(e.d);
  });
  // author-name queries surface the author's OWN works first ("Augustine" = the 143
  // Augustine works, then works merely mentioning him in the title)
  // 0 = the author's own works · 1 = dubia ("Uncertain author (Augustine?)") · 2 = title · 3 = only an author's epithet
  // ("regensburg" in "Othloh of Saint Emmeram in Regensburg": search-tools.js titleRank, 2026-10-07)
  m.forEach(function(e){e._au=FRSearch.titleRank(e,toks,foldQ);});
  m.sort(function(x,y){return x._au-y._au;});
  var _epithet=m.some(function(e){return e._au===3;})&&m.some(function(e){return e._au<3;});
  if(!m.length&&window._AUTO_MODE&&q.length>=3){window._AUTO_MODE=false;setMode('full');return;}
  // question-shaped input in Find mode ("what/why/how…?") → Ask is what they meant
  // Work searches never send a paid question automatically; Ask opens a draft.
  // folded duplicates (the same work carved twice, tools/works_index_kinds.py dup_of) never list beside their primary
  m=m.filter(function(e){var w=WORKS_BY_SLUG[e.d];return !(w&&w.dup_of);});
  var byDoc={},order=[];
  m.forEach(function(e){
    if(!(e.d in byDoc)){byDoc[e.d]={work:null,divs:[]};order.push(e.d);}
    if(e.k==='work')byDoc[e.d].work=e; else byDoc[e.d].divs.push(e);
  });
  if(!order.length){ct.innerHTML='';res.innerHTML=zeroHtml(q,'title');return;}
  var _ed=order.filter(function(d){var w=WORKS_BY_SLUG[d];var k=w&&FRSearch.workKind?FRSearch.workKind(w):'work';return k==='preface'||k==='apparatus';}).length;
  ct.textContent=(order.length-_ed)+' work'+(order.length-_ed===1?'':'s')+(_ed?' · '+_ed+' editorial item'+(_ed===1?'':'s'):'')+(m.length>order.length?(' · '+m.length+' incl. sections'):'');
  var rankOrder=order.slice(),priorities={},authorCounts={};if(q.trim()){order.forEach(function(d){var e=byDoc[d].work||byDoc[d].divs[0];authorCounts[e.a]=(authorCounts[e.a]||0)+1;});var fq=foldQ(q).replace(/\s+/g,' ').trim();order.forEach(function(d){var e=byDoc[d].work||byDoc[d].divs[0];priorities[d]=e._au*1000000+titleMatch(byDoc[d],fq)*10000+standing(e.a)-Math.min(authorCounts[e.a],99);});}function paintTitle(page){var _own=m.filter(function(e){return e._au===0;}).length,_authorQuery=m.length>0&&_own>=0.6*m.length;order=FRSearch.orderWorks(rankOrder,(ORDER==='relevance'||(ORDER==='shelf'&&(_authorQuery||_epithet)))?'title':ORDER,WORKS_BY_SLUG,priorities,FRResearch.workOrder);   /* an author's name (owner 2026-09-17, "Athanasius"): the author's works by kind and size, not shelf-split with Migne's notes interleaved */var win=FRSearch.pageWindow(order.length,page,WORKS_PAGE);setPager(order.length,win.page,paintTitle,'works',WORKS_PAGE);res.innerHTML=order.slice(win.start,win.end).map(function(d){
    var g=byDoc[d], e=g.work||g.divs[0];
    var href=rdHref(e.d,e.k==='div'?e.page:null);
    var nd=g.divs.length;
    var sec=nd>0?'<span class="sr-sec"> · '+nd+' section'+(nd>1?'s':'')+' match</span>':'';
    var kind=(!g.work&&e.k==='div')?'§ ':'';
    var _w=WORKS_BY_SLUG[d],_k=_w&&FRSearch.workKind?FRSearch.workKind(_w):'work';var _badge=_k==='preface'?'<span class="nt-meta"> — Migne’s editorial note</span>':(_k==='apparatus'?'<span class="nt-meta"> — front matter</span>':'');
    var first=(!g.work&&e.k==='div')?e.t:(g.work?g.work.t:e.t);
    var out='<a class="sr" href="'+href+'"><div class="sr-cite">'+docCite(d)+sec+'</div>'+
      '<div>'+kind+esc(first)+(!g.work?'<span class="nt-meta"> — '+docTitle(d)+'</span>':'')+_badge+'</div></a>';
    if(nd)out+='<details class="matching-sections"><summary>Browse '+nd+' matching '+(nd===1?'section':'sections')+'</summary><div class="matched-section-list" data-doc="'+esc(d)+'"></div></details>';
    return '<section class="search-work-block" data-work="'+esc(d)+'">'+out+'</section>';
  }).join('');
  res.querySelectorAll('.matched-section-list').forEach(function(host){var rows=byDoc[host.dataset.doc].divs;locationPager(host,rows.length,function(start,end,target){rows.slice(start,end).forEach(function(dv){var a=document.createElement('a');a.className='sr';a.href=rdHref(dv.d,dv.page);a.innerHTML='<div>'+esc(dv.t)+'</div><div class="sr-cite">Location '+esc(dv.page)+'</div>';target.appendChild(a);});},10);});organizePage();}REDRAW=paintTitle;paintTitle(RESULT_PAGE);
}

/* ---- Full text (Pagefind — Blob multi-bucket, same loader as the landing) ---- */
var _pf=null,_pfMissing=[];
function pfInit(){if(_pf)return _pf;
  _pfMissing=[];_pf=fetch(FRB+'/v1/search/pagefind/manifest.json?v=4').then(function(r){if(!r.ok)throw Error('Index manifest unavailable');return r.json();})
    .then(function(man){
      var dirs=(man&&man.list&&man.list.length)
        ? man.list.map(function(e){return e.path.replace(/\/pagefind$/,'');}).filter(function(d){return d!=='b0';})
        : (function(){var a=[];for(var i=1;i<((man&&man.buckets)||9);i++)a.push('b'+i);return a;})();
      return import(FRB+'/v1/search/pagefind/b0/pagefind.js?v=4').then(function(p){
        return Promise.all(dirs.map(function(d){return p.mergeIndex(FRB+'/v1/search/pagefind/'+d+'/').catch(function(){_pfMissing.push(d);return null;});}))
          .then(function(){return p;});});})
    .catch(function(){_pf=null;return null;});
  return _pf;}
/* the concordance behind the exact-word panel (word-index-search.js; the Ask worker's /v1/words, mo-workers words-route.js) */
function wixPost(b){var r64=btoa(String.fromCharCode.apply(null,new TextEncoder().encode(JSON.stringify(b)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');return fetch('https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/words?r='+r64,{signal:AbortSignal.timeout(45000)}).then(function(r){return r.json().then(function(j){if(!r.ok||j.error)throw Error(j.error||r.status);return j;});});}
/* whether the R2 pointer holds a table (10-02 PM: the panel offers 'within N words' only where `positions` is published) */
/* THE AUTHOR FILTER AS THE WORD INDEX'S SCOPE (owner 2026-10-04: "the search page's own author filter could use the same scope"). With
   an author filter the exact-word panel used to stand down and the full-text index answered alone: about 2,700 works, none of the
   Fathers or EEBO. Now the panel answers over every work of the catalogue authors the filter matches (the full-text filter's own
   match), at most 40 of them (mo-workers #41: authors: [names]); past 40, or before the catalogue has loaded, the old way. */
function wixAuthors(){if(!FAC.author)return null;if(!WLIST)return false;var f=foldQ(FAC.author);var names=Array.from(new Set(WLIST.filter(function(w){return w.author&&foldQ(w.author).indexOf(f)>=0;}).map(function(w){return w.author;})));return names.length&&names.length<=40?names:false;}
/* ONE WORK IN SEVERAL VOLUMES (2026-10-16, owner: "full vol works (across a whole work)"): ?set=<id> keeps the exact panel to the volumes
   of a set (v1/volume-sets.json: Mansi's 57 tomes, Lapide's Commentaria, Poole's Synopsis), as the reader's "Search all N volumes" asks */
var SETS=null,SETS_P=null;
function loadSets(){return SETS_P||(SETS_P=fetch(FRB+'/v1/volume-sets.json').then(function(r){return r.json();}).then(function(d){SETS=d.sets||{};return SETS;}).catch(function(){SETS={};return SETS;}));}
function setScope(){var s=FAC.set&&SETS&&SETS[FAC.set];if(!s)return null;var slugs=[];(s.tracks||[]).forEach(function(t){(t.vols||[]).forEach(function(v){if(v.s&&slugs.indexOf(v.s)<0)slugs.push(v.s);});});
  return slugs.length?{slugs:slugs.slice(0,500),label:(s.t||FAC.set)+(s.a?', '+s.a:'')+' ('+slugs.length+' volumes)'}:null;}
function wixOk(){return !!window.FRWordIndex&&!FAC.work&&!FAC.workQuery&&!FAC.collection&&!FAC.group&&wixAuthors()!==false&&(!FAC.set||!!setScope());}
function wixScoped(o){var ws=setScope();if(ws)return Object.assign({},o,{post:function(b){return wixPost(Object.assign({},b,{works:ws.slugs}));},scope:{label:ws.label,by:'in '+ws.label}});var au=wixAuthors();if(!au)return o;var one=au.length===1;return Object.assign({},o,{post:function(b){return wixPost(Object.assign({},b,{authors:au}));},scope:{label:one?au[0]+'’s works':'the works of '+au.length+' authors matching “'+FAC.author+'”',by:one?'by '+au[0]:'by '+au.length+' authors matching “'+FAC.author+'”'}});}
function wixHas(n){return fetch(FRB+'/v1/sql/manifest.json?v='+Math.floor(Date.now()/600000)).then(function(r){return r.json();}).then(function(m){return !!(m&&m.tables&&m.tables[n]);},function(){return false;});}
function renderFull(q){if(FAC.set&&!SETS){ct.textContent='Loading the work’s volumes…';loadSets().then(function(){renderFull(q);});return;}var my=++seq;ct.textContent='Loading the text index…';res.innerHTML='';var wix=wixOk()?FRWordIndex.mount(document.getElementById('wordIndex'),wixScoped({query:q,post:wixPost,has:wixHas,readHref:function(slug,page,w){var pg=page==null||page===''?page:readerPage(page);var u=rdHref(slug,pg),i=u.indexOf('#'),hl=w?(u.indexOf('?')>=0?'&':'?')+'hl='+encodeURIComponent(w):'';return i<0?u+hl:u.slice(0,i)+hl+u.slice(i);},title:function(slug,row){return NAV&&NAV[slug]?docTitle(slug):esc(row.title||slug);},meta:function(row){return [row.author,row.volume,row.tradition].filter(Boolean).map(esc).join(' · ');}})):null;
 /* one to three plain words: the exact panel IS the answer (every work, exact forms, by tradition, passages per work) — the full-text
    index below stems words ('generate' finds 'generation') and pages ten sections at a time, so it answers phrases and filtered searches only */
 if(wix){ct.textContent='';setPager(0,0,function(){});return;}
 navMap(function(){if(my!==seq)return;pfInit().then(function(p){if(my!==seq)return;if(!p)throw Error('The text index could not load.');
  return p.search(q,{filters:FRSearch.pagefindFilters(FAC,WLIST||[])}).then(function(r){if(my!==seq)return;var total=r.results.length,cache=new Map();
   function href(raw,slug){var ref=FRSearch.readerLink(raw,location.origin);return ref?rdHref(ref.slug,ref.page):WORKS_BY_SLUG[slug]?rdHref(slug):null;}
   function snippet(s){return mdHeadings(s||'').replace(/<(?!\/?(?:mark|b|strong)\b)[^>]*>/gi,'').replace(/<(mark|b|strong)\b[^>]*>/gi,'<$1>');}
   function renderItems(items){var grouped=new Map();items.forEach(function(item){var meta=item.meta||{},slug=meta.slug||'',g=grouped.get(slug);if(!g){g={slug:slug,parts:[]};grouped.set(slug,g);}var parts=item.sub_results?.length?item.sub_results:[item];parts.forEach(function(part){var url=href(part.url||item.url,slug);if(url&&!g.parts.some(p=>p.url===url&&p.excerpt===part.excerpt))g.parts.push({url:url,excerpt:part.excerpt||item.excerpt});});});
    var ordered=FRSearch.orderWorks(Array.from(grouped.values()),ORDER,WORKS_BY_SLUG,{},FRResearch.workOrder);for(const [i,g] of ordered.entries()){var fold=document.createElement('details');fold.className='scripture-work exact-work';fold.dataset.work=g.slug;fold.open=i===0;fold.innerHTML='<summary>'+docTitle(g.slug)+'<span>'+docCite(g.slug)+' · '+g.parts.length+' indexed '+(g.parts.length===1?'excerpt':'excerpts')+' on this page</span></summary><div class="exact-locations"></div>';locationPager(fold.querySelector('.exact-locations'),g.parts.length,function(start,end,host){g.parts.slice(start,end).forEach(function(part){var ref=FRSearch.readerLink(part.url,location.origin),a=document.createElement('a');a.className='sr';a.href=part.url;a.innerHTML='<div class="sr-cite">'+esc(ref?.page!=null?'Location '+ref.page:'Open work')+'</div><div class="sr-ex">'+snippet(part.excerpt)+'</div>';host.appendChild(a);});},3);res.appendChild(fold);}
   }
   async function draw(page){var win=FRSearch.pageWindow(total,page);setPager(total,win.page,draw,'indexed sections');ct.textContent='Loading result page…';try{var items=cache.get(win.page);if(!items){items=await Promise.all(r.results.slice(win.start,win.end).map(function(x){return x.data();}));cache.set(win.page,items);}if(my!==seq||win.page!==RESULT_PAGE)return;items=items.filter(function(it){return facetOk(it.meta&&it.meta.slug);});ct.textContent=total.toLocaleString()+(/["“”]/.test(q)?' passages with the phrase':' passages')+' · the full-text index also matches related forms of a word (generate, generation) · groups arrange this page'+(_pfMissing.length?' · incomplete index':'');res.innerHTML=(_pfMissing.length?'<p class="search-warning">Some text-index files could not load. These results are incomplete.</p>':'');renderItems(items);if(!items.length)res.insertAdjacentHTML('beforeend',zeroHtml(q,'full'));organizePage();}catch(e){if(my===seq)searchUnavailable('Full-text search',q);}}
   REDRAW=draw;return draw(RESULT_PAGE);
  });
 }).catch(function(){if(my===seq)searchUnavailable('Full-text search',q);});});}

/* ---- Blob excerpt hydration (meaning + tradition home hits): meta.json → shard → page text ---- */
var _exc={};
function excerpt(slug,page){var k=slug+'|'+page;
  if(k in _exc)return Promise.resolve(_exc[k]);
  return fetch(FRB+'/v1/works/'+slug+'/meta.json').then(function(r){return r.json();}).then(function(meta){
    var f=meta.single?'work.json':(((meta.shards||[]).filter(function(s){return s.from<=page&&page<=s.to;})[0])||{}).file;
    if(!f)return (_exc[k]=null);
    return fetch(FRB+'/v1/works/'+slug+'/'+f).then(function(r){return r.json();}).then(function(d){
      var pg=(d.pages||[]).filter(function(x){return String(x.n)===String(page);})[0];
      var tx=(pg&&(pg.en||pg.la)||'').replace(/\[\^[^\]]*\]:?/g,'').replace(/[#*]+/g,'').replace(/\s+/g,' ').trim();
      return (_exc[k]=tx?tx.slice(0,220):null);});
  }).catch(function(){return (_exc[k]=null);});}

function searchUnavailable(label,query){setPager(0,0,function(){});ct.textContent=label+' is temporarily unavailable. Your search is still here.';res.innerHTML='<div class="search-recovery"><p>Retry this search, or choose another search mode.</p><button type="button" id="retrySearch">Retry search</button></div>';document.getElementById('retrySearch').onclick=function(){if(CATALOG_ERROR){CATALOG_ERROR=false;NAV=null;IDX=null;}if(MODE==='full')_pf=null;run();};}
/* ---- Meaning (hybrid semantic+lexical via /api/vsearch&sparse=1) ---- */
/* THE IDEA FIRST (owner 2026-10-06: "haec sancta" brought Joseph Mede on holiness and the Sanctus; "ahec sancta" nothing; "compare with
   how we used concept cards with searching by word"). When the query names one of the library's concepts, exactly or within a slip of
   the pen, the concept's card stands above the passages as it does in Exact words, and the passages are found by what the concept
   means (its label and gloss), not by the bare words: for Haec sancta the nearest pages become the Constance and conciliar literature
   (von der Hardt, Richer, Arnauld, the Acts of Pisa) instead of pages on holiness. Any other query is searched as typed. A one-shot
   flag lets the reader search the words as typed after all. */
var IDEA_AS_TYPED=false;
/* a stream of JSON lines: each complete line to onLine as it arrives (a browser without body streams gets them all at the end) */
function ndjson(url,onLine){return fetch(url,{signal:AbortSignal.timeout(30000)}).then(function(r){if(!r.ok)throw Error('Search unavailable');
 var buf='',dec=new TextDecoder(),take=function(chunk,last){buf+=chunk;var lines=buf.split('\n');buf=last?'':lines.pop();lines.forEach(function(l){if(l.trim())onLine(JSON.parse(l));});};
 if(!r.body||!r.body.getReader)return r.text().then(function(t){take(t,true);});
 var rd=r.body.getReader();return (function pump(){return rd.read().then(function(x){if(x.done){take(dec.decode(),true);return;}take(dec.decode(x.value,{stream:true}),false);return pump();});})();});}
function ideaFirst(q){var host=document.getElementById('wordIndex');
 if(IDEA_AS_TYPED||!host||!window.FRWordIndex||!FRWordIndex.idea){IDEA_AS_TYPED=false;return Promise.resolve(null);}
 return FRWordIndex.idea(host,{query:q,asTyped:function(){IDEA_AS_TYPED=true;run();},
  readHref:function(slug,page,w){var u=rdHref(slug,page==null||page===''?page:readerPage(page)),i=u.indexOf('#'),hl=w?(u.indexOf('?')>=0?'&':'?')+'hl='+encodeURIComponent(w):'';return i<0?u+hl:u.slice(0,i)+hl+u.slice(i);},
  title:function(slug,row){return NAV&&NAV[slug]?docTitle(slug):esc(row.title||slug);},
  meta:function(row){return [row.author,row.volume,row.tradition].filter(Boolean).map(esc).join(' · ');}}).catch(function(){return null;});}
function renderMeaning(q){var my=++seq,pools=[],expanded=false,expanding=false,groups=[],eq=q,idea=null,state='',typed=IDEA_AS_TYPED;ct.textContent='Finding related passages…';res.innerHTML='';
 ideaFirst(q).then(function(c){if(my!==seq)return;idea=c;if(c)eq=c.gloss?c.label+': '+c.gloss:c.label;
 navMap(function(){if(my!==seq)return;var params=new URLSearchParams({q:eq,k:FAC.collection?'80':'25'}),endpoint='https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/xsearch?';if(FAC.collection){endpoint='https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/vsearch?';params.set('collection',FAC.collection);if(FAC.work)params.set('w',FAC.work);}else if(FAC.trad==='English Divines')params.set('c','tfr');else if(FAC.trad==='Medieval')params.set('c','aq,tfr');else if(FAC.trad)params.set('trad',FAC.trad);
  if(FAC.collection)banded();else read();
  function banded(){fetch(endpoint+params,{signal:AbortSignal.timeout(25000)}).then(function(r){if(!r.ok)throw Error('Search unavailable');return r.json();}).then(function(data){if(my!==seq)return;state='';pools=[ideaTop(FRSearch.meaningCandidates(data,WORKS_BY_SLUG))];refresh();}).catch(function(){if(my===seq)searchUnavailable('Search by idea',q);});}
  /* SEARCH BY IDEA, READ (2026-10-07, the worker's /v1/isearch = the corpus site's /api/isearch; measured P@10 0.75 → 0.98 on 29
     queries): a small model says what the reader is after, the description and the idea are searched by meaning and the words
     exactly, and the model reads the first 30 passages and puts first those that treat it, each with a few words on why. Two lines
     arrive: the fused list (shown at once), then the list the model has read (it replaces the first). What was searched shows above
     the idea card; a library idea the model says names something else is left out. Any failure before the first line falls back to
     the banded search. */
  function read(){var p=new URLSearchParams({q:q});if(idea&&idea.id)p.set('cid',idea.id);if(typed)p.set('as','typed');if(FAC.trad==='English Divines')p.set('c','tfr');else if(FAC.trad==='Medieval')p.set('c','aq,tfr');else if(FAC.trad)p.set('trad',FAC.trad);
   var got=false;state='finding';
   ndjson('https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/isearch?'+p,function(o){if(my!==seq)return;if(o.phase==='error')throw Error(o.error||'Search unavailable');
    if(o.phase==='fused'){var u=o.understood||{},host=document.getElementById('wordIndex');if(u.description)eq=q+'. '+u.description;if(u.concept&&u.concept.fits===false)idea=null;
     if(host&&window.FRWordIndex&&FRWordIndex.asked)FRWordIndex.asked(host,u,{asTyped:typed?null:function(){IDEA_AS_TYPED=true;run();}});state=o.status==='fused'?'reading':'fused';}
    else state=o.status==='ranked'?'read':'fused';
    got=true;pools[0]=readRows(o.hits);refresh();}).catch(function(){if(my!==seq)return;if(got){if(state==='reading'){state='fused';refresh();}return;}banded();});}
  function readRows(hits){return (hits||[]).filter(function(h){return h.slug&&WORKS_BY_SLUG[h.slug];}).map(function(h){return {slug:h.slug,page:h.page==null?null:String(h.page),citation:h.cit||'',excerpt:h.excerpt||'',why:h.why||'',score:0};});}
  /* the best of the first ranked set: its period bands hold a fixed number each (eight Eastern Fathers even when they only brush the
     question), so what trails the best match by more than 0.08 of similarity goes; a Latin Fathers citation 'PL 20:0657' opens the
     reader at column 657 (the ranked set carries no page) */
  function ideaAll(){try{return localStorage.getItem('wix-allpv')==='1';}catch(e){return false;}}
  function ideaTop(rows){var top=rows.length?rows[0].score:0;return rows.filter(function(r){return r.score>=top-0.08;});}
  function withPage(r){if(r.page==null){var m=/^PL\s+\d+\s*:\s*0*(\d+)/.exec(r.citation||'');if(m)return Object.assign({},r,{page:m[1]});}return r;}
  function refresh(){var rows=FRSearch.fuseMeaning(pools).filter(function(r){return facetOk(r.slug);}).map(withPage);groups=FRSearch.meaningGroups(rows);REDRAW=paint;ct.textContent=rows.length+' passages'+(idea?' on '+idea.label:'')+' in '+groups.length+' '+(groups.length===1?'work':'works')+(state==='reading'?', reading them to put first those that treat it…':state==='read'?', read and put in order: those that treat it first':', closest first')+(FAC.trad?' · '+FRSearch.display(FAC.trad):'');paint(RESULT_PAGE);}
  function passage(host,p){var a=document.createElement('a');a.className='sr';a.href=rdHref(p.slug,p.page);a.innerHTML='<div class="sr-cite">'+esc(p.citation||(p.page!=null?'Page '+readerPage(p.page):'The work'))+'</div>'+(p.why?'<div class="sr-why">'+esc(p.why)+'</div>':'')+'<div class="sr-ex">'+esc(p.excerpt||'')+'</div><small>'+(p.page==null?'Open the work':'Read the passage')+'</small>';host.appendChild(a);
   if(!p.excerpt&&p.page!=null){var span=a.querySelector('.sr-ex');excerpt(p.slug,p.page).then(function(text){
     // the page files cover the library's works; EEBO, TEI-only works and the Fathers are read the word panel's way (word-index-preview.js)
     if(text||!window.FRWordPreview)return text;return FRWordPreview.pages(p.slug,[p.page]).then(function(m){var t=(m.get(p.page)||'').trim();return t.length>320?t.slice(0,320).replace(/\s+\S*$/,''):t;}).catch(function(){return '';});
    }).then(function(text){if(my===seq&&span.isConnected&&text)span.textContent=text+'…';}).then(function(){bilingual(a,p);});}
   else bilingual(a,p);}
  /* the original beside the English (10-03, owner: "this just shows the latin not the english … everything should be seen on preview"):
     a page held in two lanes shows the opening of each, side by side (word-index-preview.js lanes) */
  function bilingual(a,p){if(p.page==null||!window.FRWordPreview||!FRWordPreview.lanes)return;
   FRWordPreview.lanes(p.slug,[String(p.page)]).then(function(m){var l=m.get(String(p.page))||{};if(my!==seq||!a.isConnected||!l.o||!l.e)return;
    var cut=function(t){t=t.trim();return t.length>360?t.slice(0,360).replace(/\s+\S*$/,'')+' …':t;},ex=a.querySelector('.sr-ex');
    ex.outerHTML='<div class="sr-pair"><div class="sr-ex">'+esc(cut(l.o))+'</div><div class="sr-ex sr-en"><b>English</b>'+esc(cut(l.e))+'</div></div>';}).catch(function(){});}
  /* one list, closest first: each work once, its closest passage shown and the rest folded under it (no shelf and author nesting) */
  function paint(page){var win=FRSearch.pageWindow(groups.length,page,15);setPager(groups.length,win.page,paint,'works',15);res.innerHTML='';
   var sw=document.createElement('label');sw.className='idea-allpv';sw.innerHTML='<input type="checkbox"'+(ideaAll()?' checked':'')+'> Show every passage under each work';
   sw.querySelector('input').onchange=function(e){try{localStorage.setItem('wix-allpv',e.target.checked?'1':'0');}catch(x){}res.querySelectorAll('details.idea-more').forEach(function(d){d.open=e.target.checked;});};res.appendChild(sw);
   groups.slice(win.start,win.end).forEach(function(g){var w=WORKS_BY_SLUG[g.slug]||{},e=NAV&&NAV[g.slug]||{},card=document.createElement('article');card.className='idea-work';card.dataset.work=g.slug;
    var meta=[w.author||e.a,e.v,FRSearch.display(w.tradition||e.tr)].filter(Boolean).map(esc).join(' · ');
    card.innerHTML='<div class="idea-h"><a href="'+esc(rdHref(g.slug,g.locations[0].page))+'">'+docTitle(g.slug)+'</a></div>'+(meta?'<div class="idea-m">'+meta+'</div>':'')+'<div class="idea-first"></div>'+(g.locations.length>1?'<details class="idea-more"'+(ideaAll()?' open':'')+'><summary>'+(g.locations.length-1)+' more '+(g.locations.length===2?'passage':'passages')+' in this work</summary><div class="idea-rest"></div></details>':'');
    passage(card.querySelector('.idea-first'),g.locations[0]);g.locations.slice(1).forEach(function(p){passage(card.querySelector('.idea-rest'),p);});res.appendChild(card);});
   if(!groups.length)res.insertAdjacentHTML('beforeend','<p>No passages came close enough. Try describing it another way, or search the exact words.</p>');
   var foot=document.createElement('div');foot.className='idea-foot';var button=document.createElement('button');button.type='button';button.id='meaningBroaden';button.className='wix-go';button.disabled=expanded||expanding;button.textContent=expanding?'Finding more passages…':expanded?'The wider set is loaded':'Search more passages';button.onclick=broaden;foot.appendChild(button);res.appendChild(foot);
  }
  async function broaden(){if(expanding||expanded)return;expanding=true;var button=document.getElementById('meaningBroaden');button.disabled=true;button.textContent='Finding more passages…';var selected=FRSearch.shelf(FAC.trad),names=selected?.code==='pl'?['pl']:selected?.code==='gf'?['pg']:selected?.code==='po'?['po']:selected?.code==='md'?['library','aq']:selected?['library']:['library','pl','pg','po','aq'];if(FAC.collection)names=['library'];
   var settled=await Promise.allSettled(names.map(async function(corpus){var params=new URLSearchParams({q:eq,k:'200',corpus:corpus});if(FAC.collection)params.set('collection',FAC.collection);if(FAC.work&&corpus==='library')params.set('w',FAC.work);var response=await fetch('https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/vsearch?'+params,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('Search unavailable');var data=await response.json();return FRSearch.meaningCandidates(Object.assign({},data,{corpus:corpus}),WORKS_BY_SLUG);}));if(my!==seq)return;expanding=false;var good=settled.filter(function(r){return r.status==='fulfilled';});if(!good.length){button.disabled=false;button.textContent='Retry broader search';ct.textContent='The broader search could not load. Your current results are retained.';return;}pools=pools.concat(good.map(function(r){return r.value;}));expanded=true;RESULT_PAGE=0;saveSearchURL();refresh();if(good.length!==settled.length)ct.textContent+=' · some sources could not load';
  }
 });});}

/* ---- Tradition (cross-corpus timeline via /api/xsearch) — Round-5 scope contract ---- */
var CORPUS_BADGE={PG:'Greek Fathers',PL:'Latin Fathers',PO:'Eastern Fathers',AQ:'Aquinas',TFR:'Early modern'};
var TRS={c:{pg:1,pl:1,po:1,aq:1,tfr:1},t:{catholic:1,reformed:1,lutheran:1}};
try{var _s=JSON.parse(localStorage.getItem('fr_tr_scope'));if(_s&&_s.c)TRS=_s;}catch(e){}
function trsSave(){try{localStorage.setItem('fr_tr_scope',JSON.stringify(TRS));}catch(e){}}
function trsParams(){
  var cs=Object.keys(TRS.c).filter(function(k){return TRS.c[k];});
  var p2='';
  if(cs.length&&cs.length<5)p2+='&c='+cs.join(',');
  if(TRS.c.tfr){var tt=Object.keys(TRS.t).filter(function(k){return TRS.t[k];});
    if(tt.length&&tt.length<3)p2+='&trad='+tt.map(function(x){return x.charAt(0).toUpperCase()+x.slice(1);}).join(',');}
  return p2;}
function ensureTrScope(){
  if(document.getElementById('trScope'))return;
  var d=document.createElement('div');d.id='trScope';d.className='trad-scope';
  d.innerHTML='<span class="trad-scope-lab">Corpora:</span>'
    +'<button type="button" class="trad-chip tb-pg" data-c="pg" title="Greek Fathers">PG</button>'
    +'<button type="button" class="trad-chip tb-pl" data-c="pl" title="Latin Fathers">PL</button>'
    +'<button type="button" class="trad-chip tb-po" data-c="po" title="Eastern Fathers">PO</button>'
    +'<button type="button" class="trad-chip tb-aq" data-c="aq" title="Aquinas Opera Omnia">AQ</button>'
    +'<button type="button" class="trad-chip tb-tfr" data-c="tfr" title="Early-modern reception — this library">TFR</button>'
    +'<span class="trs-sub"><span class="trad-scope-lab">·</span>'
    +'<button type="button" class="trad-chip trs-t" data-t="catholic">Catholic</button>'
    +'<button type="button" class="trad-chip trs-t" data-t="reformed">Reformed</button>'
    +'<button type="button" class="trad-chip trs-t" data-t="lutheran">Lutheran</button></span>'
    +'<span class="trad-scope-hint">one or all</span>';
  res.parentNode.insertBefore(d,res);
  function paint(){
    d.querySelectorAll('[data-c]').forEach(function(b){b.classList.toggle('on',!!TRS.c[b.dataset.c]);});
    d.querySelectorAll('[data-t]').forEach(function(b){b.classList.toggle('on',!!TRS.t[b.dataset.t]);});
    d.querySelector('.trs-sub').style.display=TRS.c.tfr?'':'none';
  }
  d.addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b)return;
    if(b.dataset.c){var on=Object.keys(TRS.c).filter(function(k){return TRS.c[k];});
      if(TRS.c[b.dataset.c]&&on.length===1)return;
      TRS.c[b.dataset.c]=TRS.c[b.dataset.c]?0:1;}
    else if(b.dataset.t){var tn=Object.keys(TRS.t).filter(function(k){return TRS.t[k];});
      if(TRS.t[b.dataset.t]&&tn.length===1)return;
      TRS.t[b.dataset.t]=TRS.t[b.dataset.t]?0:1;}
    trsSave();paint();
    var v=qEl.value?qEl.value.trim():'';
    if(v&&v.length>=3)renderTradition(v);
  });
  paint();
}
function renderTradition(q){var my=++seq;
  ct.innerHTML='<span class="sbusy">tracing across the tradition…</span>';
  res.innerHTML='';ensureTrScope();res.parentNode.insertBefore(document.getElementById('trScope'),res);
  navMap(function(){});
  fetch('https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/xsearch?q='+encodeURIComponent(q)+'&k=14'+trsParams()).then(function(r){return r.json();}).then(function(j){
    if(my!==seq)return;
    if(!j||j.error||!j.bands||!j.bands.length){if(!j||j.error)return searchUnavailable('Tradition search',q);ct.textContent='No witnesses found.';return;}
    ct.textContent=j.n+' witnesses across '+j.bands.length+' periods · chronological';
    Array.prototype.slice.call(res.querySelectorAll('.trad-band,.trad-intro')).forEach(function(n){n.remove();});
    res.insertAdjacentHTML('beforeend','<div class="trad-intro">One question, the whole tradition: the strongest parallels in each period, '+
      'Fathers and Reformers interleaved in time. Every entry opens at its exact place.</div>'+
      j.bands.map(function(b){
        return '<div class="trad-band"><div class="trad-era">'+esc(b.band)+'</div>'+
          b.hits.map(function(h){
            var home=(h.corpus==='TFR');
            var open='<a class="sr trad-hit trad-'+h.corpus.toLowerCase()+'"'+(h.link?' href="'+esc(h.link)+'"'+(home?'':' target="_blank" rel="noopener"'):'')+'>';
            var slm=home&&h.link?(h.link.match(/w=([a-z0-9-]+)/)||[]):null;
            return open+'<div class="sr-cite"><span class="trad-badge tb-'+h.corpus.toLowerCase()+'">'+(CORPUS_BADGE[h.corpus]||h.corpus)+'</span> '+
              esc(h.cit||'')+(h.corpus==='PL'?' <span class="trad-badge" style="color:var(--muted);border-color:var(--border)" title="A companion site that currently asks for sign-in">companion · sign-in</span>':'')+' <span class="sr-n">· '+Math.round((h.score||0)*100)+'%</span></div>'+
              (h.tx?('<div class="sr-ex">'+esc(h.tx)+'…</div>')
                :(home&&slm&&slm[1]?('<div class="sr-ex" data-ex="'+esc(slm[1])+'|'+(h.page||'')+'"></div>')
                :(h.page?('<div class="sr-ex">p. '+h.page+'</div>'):'')))+'</a>';
          }).join('')+'</div>';
      }).join(''));
    Array.prototype.slice.call(res.querySelectorAll('[data-ex]'),0,20).forEach(function(sp){
      var kv=sp.getAttribute('data-ex').split('|');if(!kv[0]||!kv[1])return;
      excerpt(kv[0],+kv[1]).then(function(tx){if(tx&&my===seq)sp.textContent=tx+'…';});});
  }).catch(function(){if(my!==seq)return;searchUnavailable('Tradition search',q);});}

/* Scripture searches use the published verse-citation files, not inferred title matches. */
var SCRIPTURE_BOOKS=null,SCRIPTURE_LAST=null;
function scriptureChapter(path){if(SCRIPTURE_LAST&&SCRIPTURE_LAST.path===path)return SCRIPTURE_LAST.promise;var promise=FRResearchData.json(path).catch(function(error){if(SCRIPTURE_LAST?.path===path)SCRIPTURE_LAST=null;throw error;});SCRIPTURE_LAST={path:path,promise:promise};return promise;}
function scriptureBooks(){if(!SCRIPTURE_BOOKS)SCRIPTURE_BOOKS=FRResearchData.books().catch(function(e){SCRIPTURE_BOOKS=null;throw e;});return SCRIPTURE_BOOKS;}
function capB(s){return String(s).replace(/\b[a-z]/g,function(c){return c.toUpperCase();});}
function scriptureAtlas(ref){return FRResearchData.verseURL(ref.book,ref.ch,ref.verses.length===1?ref.verses[0]:null);}
function renderScripture(q){var my=++seq;ct.textContent='Loading Scripture references…';res.innerHTML='';
 scriptureBooks().then(async function(books){if(my!==seq)return;var ref=FRSearch.scriptureReference(q,books,FRResearchData.parseReference);
  if(!ref){var bookRef=FRResearchData.parseReference(q+' 1',books);if(bookRef){renderBibleChapters(books.find(function(b){return b.slug===bookRef.book;}));return;}ct.textContent='Enter a book and chapter, with an optional verse or range, such as Romans 8:1–4.';return;}
  var sh=FRSearch.shelf(FAC.trad),data;try{data=await scriptureChapter('/v1/bible/'+(sh?sh.code:'all')+'/'+encodeURIComponent(ref.book)+'/'+ref.ch+'.json.gz');}catch(e){if(my!==seq)return;if(e.status===404){ct.textContent='No published Scripture records are available for this passage in the selected shelf.';res.innerHTML='<a class="sr" href="'+scriptureAtlas(ref)+'">Open this passage in Scripture</a>';return;}throw e;}
  if(my!==seq)return;var records=FRSearch.scriptureRecords(data,ref);navMap(function(){if(my!==seq)return;var groups=FRSearch.scriptureGroups(records.rows,FAC,WORKS_BY_SLUG,WORK_ALIASES),name=(books.find(function(b){return b.slug===ref.book;})||{}).book||ref.book,label=name+' '+ref.ch+(ref.selection?':'+ref.selection:'');
   var locations=groups.reduce(function(n,g){return n+g.locations.length;},0);ct.textContent=locations.toLocaleString()+' source locations · '+groups.length.toLocaleString()+' works · '+label+(records.partial?' · published selection':'');
   // the works that cite the passage most first, and their shelf and author with them (10-15: Romans 5:12 opened on Augustine's
   // Expositions of the Psalms, four places, above his Incomplete Work against Julian, fifty-two)
   var cited={};groups.forEach(function(g){cited[g.slug]=-g.locations.length;});
   function paint(page){var ordered=FRSearch.orderWorks(groups,ORDER,WORKS_BY_SLUG,cited,FRResearch.workOrder),win=FRSearch.pageWindow(groups.length,page);setPager(groups.length,win.page,paint,'works');res.innerHTML='<div class="scripture-context"><a href="'+scriptureAtlas(ref)+'">Read '+esc(ref.verses.length===1?label:name+' '+ref.ch)+' in Scripture</a>'+(window.TFRMethod?window.TFRMethod.html('<p>These are indexed citations, including quotations and references. They do not establish agreement or a continuous commentary.</p>'):'')+'</div>';
    ordered.slice(win.start,win.end).forEach(function(g,i){var fold=document.createElement('details');fold.className='scripture-work';fold.dataset.work=g.slug;fold.dataset.author=g.author;fold.dataset.shelf=g.shelf;fold.open=i===0;fold.innerHTML='<summary>'+esc(ORDER==='relevance'&&g.author?g.author+' · ':'')+esc(g.title)+'<span>'+(g.volume?esc(g.volume)+' · ':'')+g.locations.length+' source location'+(g.locations.length===1?'':'s')+(g.available?'':' · Work not currently available')+'</span></summary><div class="scripture-locations"></div>';var list=fold.querySelector('.scripture-locations');locationPager(list,g.locations.length,function(start,end,target){g.locations.slice(start,end).forEach(function(loc){var a=document.createElement(g.available?'a':'div');a.className='sr';if(g.available)a.href=rdHref(g.slug,loc.page);a.innerHTML='<div class="sr-cite">'+esc(loc.verses.length?'Verse'+(loc.verses.length>1?'s ':' ')+loc.verses.join(', '):'Chapter reference')+' · '+esc(loc.page)+'</div><div>'+esc(g.title)+'</div>';target.appendChild(a);});},10);res.appendChild(fold);});if(!groups.length)res.insertAdjacentHTML('beforeend','<p>No available records match these filters. Try another shelf or clear the filters.</p>');
   organizePage();}REDRAW=paint;paint(RESULT_PAGE);
  });
 }).catch(function(error){if(my!==seq)return;if(/requested verse|does not match/.test(error.message)){ct.textContent=error.message;res.innerHTML='';}else searchUnavailable('Scripture search',q);});}
function renderBibleChapters(book){if(!book)return;ct.textContent='Choose a chapter of '+book.book+'.';res.innerHTML='<div class="sb-grid">'+book.chapters.map(function(c){var label=book.book+' '+c.c;return '<button type="button" class="sb-chip" data-ref="'+esc(label)+'">'+esc(label)+'</button>';}).join('')+'</div>';wireBibleButtons();}
function wireBibleButtons(){res.querySelectorAll('[data-ref]').forEach(function(b){b.onclick=function(){qEl.value=b.dataset.ref;run();};});}
function scriptureBrowse(){var my=++seq;ct.textContent='Loading Bible books…';res.innerHTML='';scriptureBooks().then(function(books){if(my!==seq||qEl.value.trim())return;ct.textContent='Choose a book, or enter a passage above.';res.innerHTML='<div class="sb-grid">'+books.map(function(b){return '<button type="button" class="sb-chip" data-book="'+esc(b.slug)+'">'+esc(b.book)+'</button>';}).join('')+'</div>';res.querySelectorAll('[data-book]').forEach(function(b){b.onclick=function(){var book=books.find(function(x){return x.slug===b.dataset.book;});qEl.value=book.book;saveSearchURL();renderBibleChapters(book);};});}).catch(function(){if(my===seq)searchUnavailable('Scripture catalogue','');});}
function doorRow(m){return m==='scripture'?'<div class="sdoors"><a class="sdoor" href="/the-faith-received/bible/"><span class="sd-n">Open Scripture</span><span class="sd-d">Read the text, citations, and commentary.</span></a></div>':'';}

/* ---- Ask (RAG via /api/ask, streamed) — TFR stream contract: {"t":"k"/"p"} control
       frames on their own lines + FIRST non-frame line = {"sources":[…],"graph":…} preamble,
       then the answer text. Citations in the answer are [slug/pN] → reader links. ---- */
function linkifyCites(txt){
  /* structured answer rendering (owner 2026-08-19 'formatted, like qaf'): the model emits
     light markdown — honor headings, bold, italics, lists, and paragraphs instead of a
     <br> wall; then link the [slug/pN] citations. */
  var h=esc(txt);
  h=h.replace(/^#{2,4}\s+(.+)$/gm,'<h4 class="ask-h">$1</h4>');
  h=h.replace(/^\s*[-•]\s+(.+)$/gm,'<li>$1</li>');
  h=h.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g,'<ul class="ask-ul">$1</ul>');
  h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  h=h.replace(/(^|[\s(>])\*([^*\n]+)\*(?=[\s).,;:!?<]|$)/g,'$1<em>$2</em>');
  h=mdHeadings(h);
  h=h.replace(/\[([a-z0-9-]{4,})\/p(\d+)\]/g,function(full,s,p){
    var lab=(NAV&&NAV[s]&&NAV[s].a)?NAV[s].a.split(' ').pop()+', p.'+p:s.split('-').slice(0,2).join('-')+'/p'+p;
    return '<a class="cite-lnk" href="'+rdHref(s,p)+'">['+esc(lab)+']</a>';});
  h=h.replace(/\n{2,}/g,'</p><p>').replace(/\n/g,'<br>');
  h='<p>'+h+'</p>';
  h=h.replace(/<p>\s*(<h4)/g,'$1').replace(/(<\/h4>)\s*<\/p>/g,'$1')
     .replace(/<p>\s*(<ul)/g,'$1').replace(/(<\/ul>)\s*<\/p>/g,'$1')
     .replace(/<p>\s*<\/p>/g,'').replace(/(<br>\s*)+<\/p>/g,'</p>');
  return h;}
function renderSources(el,sources){if(!sources||!sources.length){el.innerHTML='';return;}
  el.innerHTML='<details class="ask-src-block"'+(sources.length<=6?' open':'')+'><summary class="ask-src-h">Passages cited · '+sources.length+'</summary>'+sources.map(function(s){
    return '<a class="sr" href="'+rdHref(s.slug,s.page)+'"><div class="sr-cite">'+docCite(s.slug)+(s.page!=null?' · p. '+s.page:'')+'</div><div>'+docTitle(s.slug)+'</div></a>';}).join('')+'</details>';}

var SCOPE={authors:[],works:[]};
function renderScopeChips(){
  var el=document.getElementById('scopeChips');if(!el)return;
  var chips=[];
  SCOPE.authors.forEach(function(a,i){chips.push('<span class="scope-chip">within <b>'+esc(a)+'</b><button type="button" data-k="a" data-i="'+i+'" title="Clear">×</button></span>');});
  SCOPE.works.forEach(function(w,i){chips.push('<span class="scope-chip">within <b>'+esc(w.label||w.id)+'</b><button type="button" data-k="w" data-i="'+i+'" title="Clear">×</button></span>');});
  el.innerHTML=chips.join('');
  el.querySelectorAll('button[data-k]').forEach(function(b){b.onclick=function(){
    var k=b.getAttribute('data-k'),i=+b.getAttribute('data-i');
    if(k==='a')SCOPE.authors.splice(i,1);else SCOPE.works.splice(i,1);
    renderScopeChips();};});
}
function scopeSlugs(){   // ask.mjs contract: {scope:{tfr:[slugs]}} — authors expand to their works
  var slugs=SCOPE.works.map(function(w){return w.id;});
  SCOPE.authors.forEach(function(a){(WLIST||[]).forEach(function(w){
    if((w.author||'')===a&&w.slug&&slugs.indexOf(w.slug)<0)slugs.push(w.slug);});});
  return slugs.slice(0,60);}
(function(){
  var ain=document.getElementById('scopeAuthorIn'),win=document.getElementById('scopeWorkIn');
  if(ain)ain.addEventListener('change',function(){
    var v=ain.value.trim();if(!v)return;
    if(SCOPE.authors.indexOf(v)<0)SCOPE.authors.push(v);
    ain.value='';renderScopeChips();});
  if(win)win.addEventListener('change',function(){
    var v=win.value.trim();if(!v||!WORKMAP)return;var id=WORKMAP[v];if(!id)return;
    if(!SCOPE.works.some(function(w){return w.id===id;}))SCOPE.works.push({id:id,label:v});
    win.value='';renderScopeChips();});
})();

var askConv=[];
/* ── DURABLE CONVERSATIONS (owner 2026-08-19 'connect chats to work'): every completed
   answer persists to localStorage fr_chats; threads survive reload, list under the welcome,
   restore with full citations, and tag the works they cite. Reader-rail asks share the store. */
var CHAT={id:null};
function chatAll(){try{var d=JSON.parse(localStorage.getItem('fr_chats'))||{};return Array.isArray(d.chats)?d.chats:[];}catch(e){return [];}}
function chatPut(list){try{localStorage.setItem('fr_chats',JSON.stringify({v:1,chats:list.slice(0,20)}));
  if(window._frSyncChats)try{window._frSyncChats(JSON.parse(localStorage.getItem('fr_chats')));}catch(e){}}catch(e){}}
function chatSave(q,answer,src,gr){
  var list=chatAll();var c=CHAT.id?list.filter(function(x){return x.id===CHAT.id;})[0]:null;
  if(!c){c={id:'c'+Date.now(),ts:Date.now(),t:q.slice(0,90),turns:[]};CHAT.id=c.id;list.unshift(c);}
  c.turns.push({q:q,a:String(answer).slice(0,16000),src:(src||[]).slice(0,14).map(function(s2){return {slug:s2.slug,page:s2.page};}),
    graph:gr&&gr.loci?{loci:(gr.loci||[]).slice(0,5)}:null,ts:Date.now()});
  c.ts=Date.now();
  list=[c].concat(list.filter(function(x){return x.id!==c.id;}));
  chatPut(list);}
function chatRestore(id){
  var c=chatAll().filter(function(x){return x.id===id;})[0];if(!c)return;
  askReset();CHAT.id=c.id;askConv=[];
  var aw=res.querySelector('.ask-empty')||res.querySelector('.ask-welcome');if(aw)aw.remove();
  var sg0=res.querySelector('.ask-sugg:not(.ask-refine)');if(sg0)sg0.remove();
  var cr=res.querySelector('.chat-recent');if(cr)cr.remove();
  var thread=res.querySelector('#askThread');
  var lastQ='',lastTd=null;
  c.turns.forEach(function(t2){
    askConv.push({role:'user',content:t2.q});askConv.push({role:'assistant',content:t2.a});
    var turn=document.createElement('div');turn.className='ask-turn';
    turn.innerHTML='<div class="ask-q">'+esc(t2.q)+'</div><div class="ask-ans">'+linkifyCites(t2.a)+'</div><div class="ask-src"></div><div class="ask-fallib"></div>';
    thread.appendChild(turn);
    var srcFull=(t2.src||[]).map(function(s2){return {slug:s2.slug,page:s2.page};});
    renderSources(turn.querySelector('.ask-src'),srcFull);renderFallib(turn);
    lastQ=t2.q;lastTd={src:srcFull,graph:t2.graph};});
  if(askConv.length>16)askConv=askConv.slice(-16);
  if(lastQ)askHint(lastQ,lastTd||{});
  var last=thread.lastElementChild;if(last)last.scrollIntoView({block:'start'});}
/* ── CORPUS SCOPE CHIPS (owner: 'cross corpora AI search for each section — PO, PG, PL,
   Lutheran, Reformed, Roman Catholic'): one tap scopes the ask to a shelf; the server
   already understands filters.tradition (Latin/Greek/Eastern Fathers route their own
   vector namespaces). Sticky for the conversation until changed. */
var ASKTRAD='';var ASKPARTY='';var PARTYSLUGS={};
var ASK_CORPORA=[['','Whole library'],['Latin Fathers','Latin Fathers'],['Greek Fathers','Greek Fathers'],['Eastern Fathers','Eastern Fathers'],['Medieval','Medieval'],['Roman Catholic','Roman Catholic'],['Reformed','Reformed'],['English Divines','English Divines'],['Lutheran','Lutheran'],['Humanism and Law','Humanism and Law']];   /* all NINE shelves, named as the landing names them (owner 2026-09-05 "wheres english divines … match with landing") */
var ASKNB=false;
function nbPayload(){   // the reader's own gathered evidence, offered to the model (server filters.nb contract)
  try{
    var notes=JSON.parse(localStorage.getItem('fr_notes'))||{};
    var ks=Object.keys(notes).sort(function(x,y){return (notes[y].ts||0)-(notes[x].ts||0);}).slice(0,40);
    if(!ks.length)return null;
    var items=[],texts=[];
    ks.forEach(function(k){var e=notes[k]||{};
      if(k.indexOf('ask|')===0){texts.push(String(e.t||'').slice(0,400));return;}
      items.push({t:(e.work||'')+(e.page?' p.'+e.page:''),l:String(e.t||'').slice(0,140)});});
    return {name:'My notebook',items:items.slice(0,40),notes:texts.slice(0,12)};
  }catch(e){return null;}}
function corporaRow(){
  var main=ASK_CORPORA.filter(function(c2){return c2[0]!=='English Divines';});
  return '<details class="wsc-grp" open><summary>Shelves</summary><div class="ask-corpora" id="askCorp">'
    +main.map(function(c2){
      return '<button type="button" data-tr="'+esc(c2[0])+'"'+(ASKTRAD===c2[0]?' class="on"':'')+'>'+esc(FRSearch.display(c2[1]))+'</button>';}).join('')
    +'</div><div class="asw-sub"><span class="asw-sublb">'+esc(FRSearch.display('English Divines'))+'</span><div class="ask-corpora">'
    +'<button type="button" data-tr="English Divines"'+(ASKTRAD==='English Divines'?' class="on"':'')+'>All English writers</button>'
    +['Puritan','Anglican'].map(function(p2){return '<button type="button" data-py="'+p2+'"'+(ASKPARTY===p2?' class="on"':'')+'>'+p2+'s</button>';}).join('')
    +'</div></div>'
    +'<div class="ask-corpora" style="margin-top:.4rem"><button type="button" id="askNb"'+(ASKNB?' class="on"':'')+' title="Give the answer your saved notes and highlights">📓 With my notebook</button></div></details>';}
function wireCorpora(){var el=res.querySelector('.wsc-grp')||res.querySelector('#askCorp');if(!el)return;
  el.querySelectorAll('button[data-tr]').forEach(function(b2){b2.onclick=function(){
    var v=b2.getAttribute('data-tr')||'';
    ASKTRAD=(ASKTRAD===v&&v)?'':v;ASKPARTY='';
    el.querySelectorAll('button[data-tr]').forEach(function(x){x.classList.toggle('on',x===b2&&!!ASKTRAD);});
    el.querySelectorAll('button[data-py]').forEach(function(x){x.classList.remove('on');});};});
  el.querySelectorAll('button[data-py]').forEach(function(b2){b2.onclick=function(){
    var v=b2.getAttribute('data-py')||'';
    ASKPARTY=(ASKPARTY===v)?'':v;ASKTRAD='';
    el.querySelectorAll('button[data-py]').forEach(function(x){x.classList.toggle('on',x===b2&&!!ASKPARTY);});
    el.querySelectorAll('button[data-tr]').forEach(function(x){x.classList.remove('on');});};});
  var nb=el.querySelector('#askNb');
  if(nb)nb.onclick=function(){ASKNB=!ASKNB;nb.classList.toggle('on',ASKNB);};}
/* ── CONVERSATION MAP (owner: 'conversations visualized as graphs'): the thread as a map —
   questions on the spine, the graph's loci left, the cited works right; every node is a
   door (works open the reader, authors filter the library). Pure SVG, theme-aware. */
function chatMap(){
  var c=chatAll().filter(function(x){return x.id===CHAT.id;})[0];
  if(!c||!c.turns.length)return null;
  var W=800,rowH=150,pad=26,H=c.turns.length*rowH+pad*2;
  var out=['<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,sans-serif">'];
  var qx=W/2,esc2=function(t2){return String(t2).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');};
  var wrap=function(t2,n2){t2=String(t2);return t2.length>n2?t2.slice(0,n2-1)+'…':t2;};
  c.turns.forEach(function(t2,i){
    var qy=pad+i*rowH+30;
    if(i>0)out.push('<line x1="'+qx+'" y1="'+(qy-rowH+16)+'" x2="'+qx+'" y2="'+(qy-16)+'" stroke="var(--line)" stroke-width="2"/>');
    out.push('<g><rect x="'+(qx-150)+'" y="'+(qy-16)+'" width="300" height="34" rx="17" fill="var(--accent)" opacity="0.92"/>'
      +'<text x="'+qx+'" y="'+(qy+5)+'" text-anchor="middle" font-size="12.5" fill="#fff">'+esc2(wrap(t2.q,44))+'</text></g>');
    (t2.graph&&t2.graph.loci||[]).slice(0,3).forEach(function(l2,j){
      var ly=qy-14+j*30,lx=140;
      out.push('<path d="M'+(qx-150)+' '+qy+' Q '+(lx+130)+' '+qy+' '+(lx+95)+' '+ly+'" stroke="var(--line)" fill="none"/>');
      out.push('<g><rect x="'+(lx-95)+'" y="'+(ly-12)+'" width="190" height="24" rx="12" fill="none" stroke="var(--accent2,var(--accent))"/>'
        +'<text x="'+lx+'" y="'+(ly+4)+'" text-anchor="middle" font-size="11" fill="var(--fg)">'+esc2(wrap(String(l2),30))+'</text></g>');});
    var byW={};(t2.src||[]).forEach(function(s2){byW[s2.slug]=byW[s2.slug]||{n:0,p:s2.page};byW[s2.slug].n++;});
    var _au=function(sl){var e2=NAV&&NAV[sl];return (e2&&e2.a)||'~';};
    Object.keys(byW).sort(function(x,y){var ax=_au(x),ay=_au(y);
      return ax===ay?(byW[y].n-byW[x].n):(ax<ay?-1:1);}).slice(0,4).forEach(function(sl,j){
      var wy=qy-24+j*30,wx=662;
      var e=NAV&&NAV[sl];var lab=(e&&e.a?e.a.split(' ').pop()+' · ':'')+wrap((e&&e.t)||sl,20);
      out.push('<path d="M'+(qx+150)+' '+qy+' Q '+(wx-130)+' '+qy+' '+(wx-95)+' '+wy+'" stroke="var(--line)" fill="none"/>');
      out.push('<a href="'+esc2(rdHref(sl,byW[sl].p))+'" class="amn"><g><rect x="'+(wx-95)+'" y="'+(wy-12)+'" width="190" height="24" rx="6" fill="var(--highlight,rgba(0,0,0,.05))"/>'
        +'<text x="'+wx+'" y="'+(wy+4)+'" text-anchor="middle" font-size="11" fill="var(--fg)">'+esc2(wrap(lab,32))+'</text></g></a>');});
  });
  out.push('</svg>');
  return out.join('');}
function toggleMap(){
  var ex=res.querySelector('.ask-map');if(ex){ex.remove();return;}
  var svg=chatMap();if(!svg)return;
  var d=document.createElement('div');d.className='ask-map';
  d.innerHTML='<button type="button" class="ask-map-x" title="Close the map">✕</button>'+svg;
  d.querySelector('.ask-map-x').onclick=function(){d.remove();};
  var thread=res.querySelector('#askThread');thread.parentNode.insertBefore(d,thread);
  d.scrollIntoView({block:'nearest'});}
function askReset(){askConv=[];CHAT.id=null;ct.textContent='';
  var recent=chatAll().slice(0,4);
  /* CHAT EMPTY STATE (owner 2026-09-05 "looks nothing like a chat interface"): greeting,
     the composer (moved in by setMode), three QUIET suggestions — and nothing else. The
     corpora row, notebook toggle, and author/work scope all live behind one ⌖ Scope
     control; by default the AI scopes from the question. */
  res.innerHTML='<div class="ask-empty">'
    +'<div class="ask-welcome"><div class="aw-word">Ask the Library</div></div>'
    +'<div class="ask-sugg">'
    +'<button data-q="What did the early church believe about the real presence in the Eucharist?">Real presence in the fathers</button>'
    +'<button data-q="How do Reformed and Lutheran theologians differ on the imputation of Christ\'s righteousness?">Imputation: Reformed vs Lutheran</button>'
    +'<button data-q="What is the covenant of works and where is it first taught?">The covenant of works</button>'
    +'</div>'
    +(recent.length?'<div class="chat-recent"><div class="chat-recent-h">Recent conversations</div>'
      +recent.map(function(c2){var when=new Date(c2.ts);var m2=(c2.turns||[]).length;
        return '<button type="button" class="chat-row" data-cid="'+esc(c2.id)+'"><span class="cr-t">'+esc(c2.t||'Conversation')+'</span><span class="cr-m">'+m2+(m2===1?' turn':' turns')+'</span></button>';}).join('')+'</div>':'')
    +'</div>'
    +'<div class="ask-thread" id="askThread"></div><div class="ask-more" id="askMore"></div>'
    /* the composer sits LAST and sticky at the foot — a conversation, the same shell as the
       landing overlay (owner 2026-09-05 "on the bottom … same design everywhere") */
    +'<div class="askbox">'
    +'<div class="ask-scopewrap" id="askScopeWrap" hidden>'
    +'<div class="asw-note">Optional — narrow where to search. By default the whole library is searched.</div>'
    +corporaRow()+'</div>'
    +'<textarea id="askTa" rows="1" placeholder="Ask anything" aria-label="Ask a question"></textarea>'
    +'<button type="button" id="askGo" class="askgo" aria-label="Ask" disabled>↑</button>'
    +'<div class="askbox-tools">'
    +'<button type="button" id="askScopeT" class="ask-scope-t" aria-expanded="false">⌖ Scope</button>'
    +'<label class="askbox-t" title="Slower, more thorough: a second retrieval pass fills gaps"><input type="checkbox" id="askDeep">Deep</label>'
    +'</div></div>';
  wireCorpora();
  {var st3=res.querySelector('#askScopeT'),sw3=res.querySelector('#askScopeWrap');
   if(st3&&sw3)st3.onclick=function(){sw3.hidden=!sw3.hidden;st3.setAttribute('aria-expanded',String(!sw3.hidden));
     var sb3=document.getElementById('scopeBar');if(sb3&&!sw3.contains(sb3))sw3.appendChild(sb3);};}
  /* the composer's own send (owner 2026-09-05 "where's the ask button — literally copy
     claude.ai"): textarea autosizes, ↑ enables at 3 chars, Enter sends (Shift+Enter breaks) */
  {var ta3=res.querySelector('#askTa'),go3=res.querySelector('#askGo');
   if(ta3&&go3){
     var fit3=function(){ta3.style.height='auto';ta3.style.height=Math.min(ta3.scrollHeight,180)+'px';go3.disabled=ta3.value.trim().length<3;};
     ta3.addEventListener('input',fit3);
     var send3=function(){var v=ta3.value.trim();if(v.length>2){ta3.value='';fit3();askTurn(v);}};
     go3.onclick=send3;
     ta3.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send3();}});
     setTimeout(function(){try{ta3.focus();}catch(e){}},60);
   }}
  res.querySelectorAll('.chat-row').forEach(function(r2){r2.onclick=function(){chatRestore(r2.getAttribute('data-cid'));};});

  try{if(window.cgptLink)cgptLink.mount();}catch(e){}
  var cb=document.getElementById('askDeep');
  try{if(cb)cb.checked=localStorage.getItem('fr_ask_deep')==='1';}catch(e){}
  if(cb)cb.onchange=function(){try{localStorage.setItem('fr_ask_deep',cb.checked?'1':'0');}catch(e){}};}
function askHint(lastQ,turnData){var m=res.querySelector('#askMore');if(!m)return;
  /* GUIDED REFINEMENT (owner 2026-08-19): the next-step options come from what the answer
     itself surfaced — its most-cited authors, the loci the graph routed, the traditions in
     play — not from a settings panel. One tap composes the follow-up. */
  var chips=[];
  var td=turnData||{};
  var ac={};(td.src||[]).forEach(function(s2){var e=NAV&&NAV[s2.slug];var a2=e&&e.a;if(a2)ac[a2]=(ac[a2]||0)+1;});
  Object.keys(ac).sort(function(x,y){return ac[y]-ac[x];}).slice(0,2).forEach(function(a2){
    var last=a2.split(' ').pop();
    chips.push({t:'More from '+esc(last),q:'What does '+a2+' in particular argue here, and in which works?'});});
  var trads={};(td.src||[]).forEach(function(s2){var e=NAV&&NAV[s2.slug];if(e&&e.tr)trads[e.tr]=1;});
  var allTr=['Reformed','Lutheran','Roman Catholic','Greek Fathers','Latin Fathers','Medieval'];
  var absent=allTr.filter(function(t2){return !trads[t2];});
  if(Object.keys(trads).length&&absent.length)
    chips.push({t:'How do the '+esc(FRSearch.display(absent[0]))+' answer?',q:'How would the '+absent[0]+' tradition answer the same question?'});
  ((td.graph&&td.graph.loci)||[]).slice(0,1).forEach(function(l2){
    chips.push({t:'Deeper on '+esc(String(l2)),q:'Go deeper on '+String(l2)+' — the key distinctions and the classic passages.'});});
  chips.push({t:'⟲ Research deeper',deep:true,q:lastQ});
  m.innerHTML='<div class="ask-sugg ask-refine">'+chips.map(function(c,i){
      return '<button data-q="'+esc(c.q)+'"'+(c.deep?' data-deep="1"':'')+'>'+c.t+'</button>';}).join('')
    +'</div><div class="ask-tools"><button class="ask-new" id="askNew" type="button">New conversation</button><button class="ask-new" id="askMap" type="button" title="See this conversation as a map — its questions, loci, and cited works">⊚ Map</button><a class="ask-new" href="/the-faith-received/desk/" style="text-decoration:none" title="Write a paper at the Desk — insert your saved answers and notes with citations">✎ Desk</a><span class="ask-cgpt" data-cgpt-link style="margin-left:auto"></span></div>';
  var b=res.querySelector('#askNew');if(b)b.onclick=function(){askReset();qEl.value='';focusQuery();};
  var mb=res.querySelector('#askMap');if(mb)mb.onclick=toggleMap;}
function renderFallib(turn){var el=turn.querySelector('.ask-fallib');if(!el)return;
  var date='';try{date=new Date().toISOString().slice(0,10);}catch(e){}
  el.innerHTML='AI synthesis over exact witnesses — verify against the linked passages'+(date?' · '+esc(date):'');}
function askTurn(q){if(window.__FR_ASK_WORKSPACE__&&!window.FRAsk){window.__FR_ASK_PENDING__={q:q,autoSend:true};return;}if(window.FRAsk){window.FRAsk.open({q:q,autoSend:true});return;}var my=++seq;ct.textContent='';
  if(!res.querySelector('#askThread'))askReset();
  var thread=res.querySelector('#askThread'),mEl=res.querySelector('#askMore');if(mEl)mEl.innerHTML='';
  var dcb=document.getElementById('askDeep'),deepOn=!!(dcb&&dcb.checked)||!!window.__askDeepOnce;window.__askDeepOnce=false;
  var aw=res.querySelector('.ask-empty')||res.querySelector('.ask-welcome');if(aw)aw.remove();
  var sg0=res.querySelector('.ask-sugg:not(.ask-refine)');if(sg0)sg0.remove();
  var turn=document.createElement('div');turn.className='ask-turn';
  turn.innerHTML='<div class="ask-q">'+esc(q)+(deepOn?' <span class="ag-badge">deep</span>':'')+'</div><div class="ask-focus"></div><div class="ask-ans"><span class="sbusy">'+(deepOn?'deep research — reading, finding the gaps, searching again…':'reading the corpus…')+'</span></div><div class="ask-src"></div><div class="ask-fallib"></div>';
  thread.appendChild(turn);askConv.push({role:'user',content:q});
  var focEl=turn.querySelector('.ask-focus'),ansEl=turn.querySelector('.ask-ans'),srcEl=turn.querySelector('.ask-src');
  turn.scrollIntoView({behavior:'smooth',block:'nearest'});
  navMap(function(){if(my!==seq)return;
    var body={messages:askConv.slice(-16),progress:true};
    if(deepOn)body.deep=true;
    if(ASKTRAD)body.filters={tradition:ASKTRAD};
    if(ASKNB){var _nb=nbPayload();if(_nb){body.filters=body.filters||{};body.filters.nb=_nb;}}
    var sl=scopeSlugs();if(sl.length)body.scope={tfr:sl};
    if(ASKPARTY&&PARTYSLUGS[ASKPARTY])body.filters=Object.assign(body.filters||{},{allowSlugs:PARTYSLUGS[ASKPARTY].slice(0,600)});
    /* stream frame stripper (landing contract): whole-line {"t":"k"|"p"…} frames are control,
       swallowed anywhere in the stream; line-buffered so a frame split across chunks still dies. */
    var FRAME=/^\{"t":"[kp]"[^\n]*\}$/,FPFX='{"t":"';
    var couldBeFrame=function(s2){return (s2.length<FPFX.length)?FPFX.indexOf(s2)===0:s2.indexOf(FPFX)===0;};
    var fbuf='',atLine=true;
    var prog=function(m2){if(!srcShown)ansEl.innerHTML='<span class="sbusy">'+esc(m2)+'</span>';};
    var strip=function(chunk,last){
      fbuf+=chunk;var out='';
      for(;;){
        var nl=fbuf.indexOf('\n');if(nl<0)break;
        var line=fbuf.slice(0,nl);fbuf=fbuf.slice(nl+1);
        if(atLine&&FRAME.test(line)){
          var pj=null;try{pj=JSON.parse(line);}catch(e){}
          if(pj&&pj.t==='p'&&pj.m)prog(pj.m);
          continue;}
        out+=line+'\n';atLine=true;
      }
      if(fbuf){
        if(last){if(!(atLine&&FRAME.test(fbuf)))out+=fbuf;fbuf='';}
        else if(!(atLine&&couldBeFrame(fbuf))){out+=fbuf;fbuf='';atLine=false;}
      }
      return out;};
    var head2='',answer='',srcShown=false,src=[],gr=null;
    var feed=function(clean){
      if(!clean)return;
      if(!srcShown){
        head2+=clean;
        var nl=head2.indexOf('\n');if(nl<0)return;
        var pj=null;try{pj=JSON.parse(head2.slice(0,nl));}catch(e){}
        src=(pj&&pj.sources)||[];gr=(pj&&pj.graph)||null;
        if(gr&&gr.authorScope&&focEl)focEl.innerHTML='<span class="focus-h">Scoped to</span><span class="focus-chip">'+esc(String(gr.authorScope))+'</span>';
        answer=head2.slice(nl+1);head2='';srcShown=true;
        ansEl.innerHTML=linkifyCites(answer);
      }else{answer+=clean;ansEl.innerHTML=linkifyCites(answer);}
    };
    fetch('https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){
      if(my!==seq)return;
      if(!r.ok||!r.body){ansEl.textContent='Ask is unavailable right now.';return;}
      var rd=r.body.getReader(),dc=new TextDecoder();
      (function pump(){return rd.read().then(function(o){if(my!==seq)return;
        if(o.done){feed(strip(dc.decode(),true));
          ansEl.innerHTML=linkifyCites(answer);renderSources(srcEl,src);renderFallib(turn);
          /* save the whole cited answer into the SAME notebook the reader syncs (fr_notes —
             key ask|ts so reader rows never collide; shows up beside highlights) */
          (function(){var sv=document.createElement('button');sv.className='ask-save';sv.textContent='☆ Save to notebook';
            sv.onclick=function(){try{
              var m={};try{m=JSON.parse(localStorage.getItem('fr_notes'))||{};}catch(e){}
              var k='ask|'+Date.now();
              m[k]={t:'Q: '+q+'\n\n'+answer,cite:'Ask the library',work:'Ask',page:'',ts:Date.now()};
              localStorage.setItem('fr_notes',JSON.stringify(m));
              if(window._frSyncNotes)try{window._frSyncNotes(m);}catch(e){}
              sv.textContent='★ Saved';sv.classList.add('saved');sv.disabled=true;
            }catch(e){sv.textContent='Could not save';}};
            srcEl.parentNode.insertBefore(sv,srcEl.nextSibling);})();
          askConv.push({role:'assistant',content:answer});if(askConv.length>16)askConv=askConv.slice(-16);
          chatSave(q,answer,src,gr);
          askHint(q,{src:src,graph:gr});return;}
        feed(strip(dc.decode(o.value,{stream:true}),false));return pump();});})();
    }).catch(function(){if(my!==seq)return;ansEl.textContent='Ask is unavailable right now.';});
  });}
function renderAsk(q){askTurn(q);}

function startHtml(){
  /* the empty state was DEAD SPACE (owner 2026-09-06 "upgrade /search") — it becomes the
     map: one door per way of searching, each with a worked example that runs on click */
  function door(m,name,desc,ex){
    return '<button type="button" class="sdoor sd-mode" data-dm="'+m+'" data-dq="'+esc(ex)+'">'
      +'<span class="sd-n">'+name+' \u2192</span><span class="sd-d">'+desc+'</span>'
      +'<span class="sd-ex">e.g. \u201c'+esc(ex)+'\u201d</span></button>';}
  return '<div class="sstart"><div class="sstart-h">Start with what you need</div><div class="sdoors">'
    +door('title','Find a work','Look up an author, title, or section','Turretin')
    +door('full','Find a passage','Search the texts for a phrase or an idea','foedus operum')
    +door('scripture','Find Scripture references','Find where a Bible passage is cited','Romans 8')
    +door('ask','Ask the library','Explore a question with cited answers','How did the early church understand the Eucharist?')
    +'</div></div>';}
document.addEventListener('click',function(e){
  var d=e.target.closest('.sd-mode');if(!d)return;
  var m=d.getAttribute('data-dm'),q2=d.getAttribute('data-dq')||'';
  if(m==='ask'){if(window.FRAsk)window.FRAsk.open({q:q2});else{qEl.value=q2;setMode('ask');}return;}
  qEl.value=q2;setMode(m);focusQuery();});
function run(){seq++;REDRAW=null;{var wix=document.getElementById('wordIndex');if(wix)wix.innerHTML='';}RESULT_PAGE=RESTORE_PAGE===null?0:RESTORE_PAGE;RESTORE_PAGE=null;setPager(0,0,function(){});document.getElementById('meaningBroaden')?.remove();var groupUI=document.getElementById('groupControls');if(groupUI)groupUI.hidden=true;saveSearchURL();var q=qEl.value.trim();if(FAC.group==='westminster'&&!FAC.groupSlugs){var turn=seq;ct.textContent='Loading the Westminster scope…';res.innerHTML='';ensureSearchGroups().then(function(){if(turn===seq){RESTORE_PAGE=RESULT_PAGE;run();}}).catch(function(){if(turn===seq)searchUnavailable('Westminster group',q);});return;}
  if(q.length<2){if(MODE==='scripture'){scriptureBrowse();return;}if(MODE==='ask'){if(!res.querySelector('#askThread'))askReset();return;}
    if(MODE==='title'&&!FAC.author&&!FAC.work&&!FAC.workQuery&&!FAC.collection&&!FAC.group&&!FAC.trad){res.innerHTML=startHtml();ct.textContent='';return;}
    if(MODE==='title'){renderTitle(q);return;}res.innerHTML='';ct.textContent='';return;}
  if(MODE==='full')renderFull(q);
  else if(MODE==='tradition')renderTradition(q);
  else if(MODE==='meaning')renderMeaning(q);
  else if(MODE==='ask'){ /* Ask runs on Enter only */ }
  else if(MODE==='scripture')renderScripture(q);
  else renderTitle(q);}
var _t;qEl.addEventListener('input',function(){if(MODE==='ask')return;seq++;clearTimeout(_t);if(MODE!=='title'&&qEl.value.trim()){REDRAW=null;setPager(0,0,function(){});res.innerHTML='';ct.textContent='Select Search to run this query.';}if(MODE==='title'||!qEl.value.trim())_t=setTimeout(run,180);});
qEl.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();var q=qEl.value.trim();if(MODE==='ask'){if(q.length>=3){askTurn(q);qEl.value='';}}else run();}});

/* ---- search elevation helpers (donor tail, TFR keys) ---- */
function zeroHtml(q,mode){
  var alt=mode==='full'?'By idea (under Search the texts) or Ask for a cited answer':'Search the texts to find the words inside the books, or Ask for a cited answer';
  return '<div class="sr-zero"><p>No '+(mode==='full'?'passages':'works')+' match “'+esc(q)+'”.</p>'
    +'<p class="sr-zero-tip">Try '+alt+' instead, or broaden the phrase.</p></div>';
}
(function(){
  var db=document.getElementById('densityBtn');if(!db)return;
  var on=false;try{on=localStorage.getItem('fr_search_density')==='compact';}catch(e){}
  function paint(){res.classList.toggle('sr-compact',on);db.setAttribute('aria-pressed',on?'true':'false');db.textContent=on?'Detailed':'Compact';}
  paint();
  db.addEventListener('click',function(){on=!on;try{localStorage.setItem('fr_search_density',on?'compact':'full');}catch(e){}paint();});
})();
(function(){
  var wrap=document.querySelector('.smodes-wrap');if(!wrap)return;
  var sm=wrap.querySelector('.smodes');
  function paintScroll(){if(!sm)return;wrap.classList.toggle('smodes-more',
    (sm.scrollWidth-sm.clientWidth)>4 && (sm.scrollWidth-sm.clientWidth-sm.scrollLeft)>4);}
  if(sm){sm.addEventListener('scroll',paintScroll);window.addEventListener('resize',paintScroll);setTimeout(paintScroll,80);}
  var hint2=document.getElementById('smodesHint'),hx=document.getElementById('smodesHintX');
  if(hint2){
    try{if(localStorage.getItem('fr_smodes_hint_seen'))hint2.style.display='none';}catch(e){}
    if(hx)hx.addEventListener('click',function(){hint2.style.display='none';try{localStorage.setItem('fr_smodes_hint_seen','1');}catch(e){}});
  }
})();

function ensureSearchGroups(){if(FAC.group!=='westminster')return Promise.resolve();if(!SCOPE_SCHOOLS)SCOPE_SCHOOLS=FRResearchData.json('/v1/schools.json').then(function(data){var slugs=data['Westminster Assembly']?.slugs;if(!Array.isArray(slugs)||!slugs.length)throw Error('Westminster membership is unavailable.');return slugs.map(function(s){return s.replace(/^@eebo:/,'eebo-');});}).catch(function(e){SCOPE_SCHOOLS=null;throw e;});return SCOPE_SCHOOLS.then(function(slugs){FAC.groupSlugs=slugs;});}
function organizePage(){if(ORDER==='relevance'){groupControls();return;}var nodes=Array.from(res.children).filter(function(n){return n.dataset.work;}),shelves=new Map(),authors=new Map();nodes.forEach(function(node){var w=WORKS_BY_SLUG[node.dataset.work]||{},author=w.author||node.dataset.author||'No named author',sh=FRSearch.label(w.tradition||node.dataset.shelf)||'Indexed sources',parent=res;if(ORDER==='shelf'&&!FAC.trad){if(!shelves.has(sh)){var d=document.createElement('details');d.className='result-shelf';d.open=true;var summary=document.createElement('summary');summary.textContent=FRSearch.display(sh);d.appendChild(summary);res.appendChild(d);shelves.set(sh,d);}parent=shelves.get(sh);}var key=(ORDER==='shelf'?sh:'')+'|'+author;if(!authors.has(key)){var group=document.createElement('details');group.className='result-author';group.open=authors.size===0;var head=document.createElement('summary');head.textContent=author;group.appendChild(head);parent.appendChild(group);authors.set(key,{node:group,head:head,works:new Set()});}var a=authors.get(key);a.works.add(node.dataset.work);a.head.textContent=author+' · '+a.works.size+' '+(a.works.size===1?'work':'works')+' on this page';a.node.appendChild(node);});groupControls();}
function groupControls(){var host=document.getElementById('groupControls');if(!host){host=document.createElement('div');host.id='groupControls';host.className='group-controls';res.before(host);}host.hidden=!res.querySelector('details');if(!host.childNodes.length){['Expand all','Collapse all'].forEach(function(label,i){var b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-controls','results');b.onclick=function(){res.querySelectorAll('details').forEach(function(d){d.open=i===0;});};host.appendChild(b);});}}
function setPager(total,page,draw,noun,size){
 var host=document.getElementById('resultsPager');if(!host){host=document.createElement('nav');host.id='resultsPager';host.className='results-pager';host.setAttribute('aria-label','Search result pages');res.before(host);}host.hidden=total===0;if(!total)return;
 var win=FRSearch.pageWindow(total,page,size);RESULT_PAGE=win.page;var prev=host.querySelector('[data-direction=previous]'),next=host.querySelector('[data-direction=next]'),label=host.querySelector('span');
 if(!prev){prev=document.createElement('button');next=document.createElement('button');label=document.createElement('span');prev.type=next.type='button';prev.dataset.direction='previous';next.dataset.direction='next';prev.textContent='Previous';next.textContent='Next';host.append(prev,label,next);}
 prev.disabled=win.page===0;next.disabled=win.page+1===win.pages;label.textContent='Page '+(win.page+1)+' of '+win.pages+' · '+(win.start+1)+'–'+win.end+' of '+total+' '+(noun||'results');
 function change(n,direction){RESULT_PAGE=n;saveSearchURL();res.scrollTop=0;draw(n);var target=host.querySelector('[data-direction='+direction+']:not(:disabled)')||host.querySelector('button:not(:disabled)');target?.focus({preventScroll:true});}
 prev.onclick=function(){change(win.page-1,'previous');};next.onclick=function(){change(win.page+1,'next');};saveSearchURL();
}
function locationPager(host,total,draw,size){var current=0;function render(){host.replaceChildren();var win=FRSearch.pageWindow(total,current,size);draw(win.start,win.end,host);if(win.pages>1){var nav=document.createElement('div');nav.className='location-pager';var p=document.createElement('button'),n=document.createElement('button'),label=document.createElement('span');p.type=n.type='button';p.textContent='Previous locations';n.textContent='Next locations';p.disabled=current===0;n.disabled=current+1===win.pages;label.textContent=(win.start+1)+'–'+win.end+' of '+total;p.onclick=function(){current--;render();};n.onclick=function(){current++;render();};nav.append(p,label,n);host.appendChild(nav);}}render();}

function saveSearchURL(){var u=new URL(location.href);var values={page:RESULT_PAGE?String(RESULT_PAGE+1):'',group:FAC.group,order:ORDER==='shelf'?'':ORDER,m:MODE,q:qEl.value.trim(),tradition:FAC.trad,author:FAC.author,work:document.getElementById('fWork').value.trim(),collection:FAC.collection,set:FAC.set||''};Object.keys(values).forEach(function(k){if(values[k])u.searchParams.set(k,values[k]);else u.searchParams.delete(k);});history.replaceState(history.state,'',u);}

document.getElementById('groupOrder').onchange=function(){ORDER=this.value;RESULT_PAGE=0;saveSearchURL();if(REDRAW)REDRAW(0);};
/* deep links: ?q=<query>&m=<mode> + ?author=/?tradition= facet prefills (boot-race-safe:
   setMode runs the search itself; nav/index loads re-run via their own cbs). */
(function(){var VALID={full:1,meaning:1,ask:1,scripture:1,title:1,tradition:1};
  try{var u=new URL(location.href),m=u.searchParams.get('m'),q=u.searchParams.get('q');
    var group=u.searchParams.get('group');if(['westminster','puritan','anglican'].includes(group)){FAC.group=group;document.getElementById('fGroup').value=group;}var order=u.searchParams.get('order');if(['shelf','author','relevance'].includes(order)){ORDER=order;document.getElementById('groupOrder').value=order;}RESTORE_PAGE=Math.max(0,(Number(u.searchParams.get('page'))||1)-1);var fa=u.searchParams.get('author'),fv=u.searchParams.get('tradition')||u.searchParams.get('trad');if(fv)fv=FRSearch.shelf(fv)?.value||'';var collection=u.searchParams.get('collection'),work=u.searchParams.get('work');if(collection==='confessions'){FAC.collection=collection;document.getElementById('fCollection').value=collection;}if(work){document.getElementById('fWork').value=work;FAC.workQuery=work;}
    if(fa){var el=document.getElementById('fAuthor');if(el){el.value=fa;FAC.author=fa;}}
    var st=u.searchParams.get('set');if(st&&/^[a-z0-9][a-z0-9-]{0,160}$/.test(st)){FAC.set=st;loadSets().then(scopeSummary);}
    if(fv){var vs=document.getElementById('fTrad');if(vs){vs.value=fv;FAC.trad=fv;}}
    if(q){qEl.value=q;}document.getElementById('fClear').hidden=!(FAC.author||FAC.workQuery||FAC.trad||FAC.collection||FAC.group);scopeSummary();
    var chatId=u.searchParams.get('chat'),trad=u.searchParams.get('trad');
    if(trad)ASKTRAD=trad;   // any shelf name works — the server post-filters by tradition; unlisted shelves just show no active chip
    window._AUTO_MODE=!VALID[m]&&!!q;
    setMode(chatId?'ask':(VALID[m]?m:'title'));
    if(chatId){chatRestore(chatId);}
    else{
      if((fa||fv)&&!q){qEl.value=fa||'';run();}
      if(q&&MODE==='ask'){renderAsk(q);}}
  }catch(e){setMode('title');}})();
