
function esc(s){var x=document.createElement('div');x.textContent=(s==null?'':s);return x.innerHTML;}
function scopeSummary(){
  var bits=[];
  var cc=document.querySelector('#corpusChips .cc.on');
  if(cc&&cc.getAttribute('data-c'))bits.push(cc.textContent.trim());
  if(FAC.author)bits.push(FAC.author);
  if(FAC.work)bits.push('1 work');
  if(FAC.trad)bits.push(FAC.trad);
  if(typeof SCOPE!=='undefined'&&SCOPE&&SCOPE.author)bits.push(SCOPE.author);
  var el=document.getElementById('stSum');
  if(el)el.textContent=bits.length?('· '+bits.join(' · ')):'· everything';
}
document.addEventListener('click',function(e){
  var mo=e.target.closest('#smMore');
  if(mo){document.querySelector('.smodes').classList.add('sm-open');mo.setAttribute('aria-expanded','true');return;}
  var sg=e.target.closest('.ask-sugg button');
  if(sg){var q2=sg.getAttribute('data-q');if(q2){if(sg.getAttribute('data-deep'))window.__askDeepOnce=true;qEl.value=q2;renderAsk(q2);}return;}
  var t=e.target.closest('#scopeToggle');
  if(t){var w=document.getElementById('scopeWrap');var open=!w.classList.contains('open');
    w.classList.toggle('open',open);t.setAttribute('aria-expanded',open?'true':'false');return;}
  var b=e.target.closest('#corpusChips .cc');if(!b)return;
  FAC.corpus=b.getAttribute('data-c')||'';
  document.querySelectorAll('#corpusChips .cc').forEach(function(x){x.classList.toggle('on',x===b);});
  scopeSummary();
  var qv=document.getElementById('q');if(qv&&qv.value.trim().length>=2)run();
});
function mdHeadings(s){return (s||'').replace(/⟦h⟧([\s\S]{1,300}?)⟦\/?h⟧/g,'<b>$1</b>');}
var FRB='https://mo-tfr-library.mo-podcast-feed.workers.dev';
var VER='?d='+new Date().toISOString().slice(0,10);   // daily buster on mutable JSON
function rdHref(slug,page){return '/the-faith-received/read/?w='+encodeURIComponent(slug)+(page!=null&&page!==''?('#b'+page+'-0'):'');}
var qEl=document.getElementById('q'),res=document.getElementById('results'),ct=document.getElementById('count'),hint=document.getElementById('hint');
var MODE='title',NAV=null,WLIST=null,IDX=null,seq=0;
var HINTS={
  title:'Works, authors, and section headings across the whole library (Latin &amp; English).',
  full:'Find words or phrases in the Latin and English texts. For example, “foedus operum”.',
  meaning:'Describe what you want to find. For example, “how faith unites us to Christ” finds passages even when they use different words.',
  scripture:'Enter a Bible reference, such as Romans 8, to find commentary in the library.',
  tradition:'One question, the whole tradition: the strongest parallels era by era \u2014 Greek and Latin Fathers, Aquinas, the early-modern library \u2014 in chronological order.',
  ask:'Ask a question; an answer is composed from the corpus with [work/pN] citations you can click. Press Enter to ask.'};
var PH={title:'Find a work, author, or section',full:'Enter words or a phrase',
  meaning:'Describe the idea you want to find',
  scripture:'Enter a Bible reference, such as Romans 8',
  tradition:'A doctrine — e.g. the descent of Christ into hell · the worship of images…',
  ask:'Ask a question — e.g. How do the Reformed treat middle knowledge?'};
function setMode(m){
  if(m==='tradition'){
    var topic=qEl.value.trim();var opts={mode:'deep',q:topic?'Trace “'+topic+'” through the theological tradition. Compare the authors, show where they agree or differ, and cite the passages.':'Trace the history of a theological idea, comparing the authors and citing the passages.'};
    setMode('title');if(window.FRAsk)window.FRAsk.open(opts);else window.__FR_ASK_PENDING__=opts;return;
  }
  MODE=m;   // ask flows through renderAsk/askTurn (autoSend handoff to the workspace)
  var method=document.getElementById('passageMethod');if(method){method.hidden=m!=='full'&&m!=='meaning';method.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.passage===m));});}

  var tip=document.getElementById('smodesHint');if(tip)tip.style.display=(m==='title')?'':'none';   // teaches the modes BEFORE one is chosen; inside a mode the per-mode hint speaks
  var chips=document.getElementById('corpusChips');
  if(chips)chips.hidden=(m!=='full'&&m!=='meaning');
  var st2=document.getElementById('scopeToggle');
  if(st2){st2.hidden=false;scopeSummary();}document.querySelectorAll('.smodes button').forEach(function(b){var on=b.getAttribute('data-m')===(m==='meaning'?'full':m);b.classList.toggle('active',on);b.setAttribute('aria-pressed',on?'true':'false');});
  hint.innerHTML=(m==='ask')?'':HINTS[m];
  qEl.placeholder=PH[m];
  var fb=document.getElementById('facets');if(fb)fb.style.display=(m==='ask'||m==='tradition'||m==='full')?'none':'';
  var sb=document.getElementById('scopeBar');if(sb)sb.style.display=(m==='ask')?'':'none';   // '' lets the CSS govern: hidden until the ⌖ sheet adopts it
  {var dh=document.getElementById('sdoorsHost');
   if(!dh&&res&&res.parentNode){dh=document.createElement('div');dh.id='sdoorsHost';res.parentNode.insertBefore(dh,res);}
   if(dh)dh.innerHTML=(m==='scripture'||m==='tradition')?doorRow(m):'';}
  if(m==='ask'){askReset();
    /* CLAUDE-IDIOM (owner 2026-09-05 "should instantly resonate … remind them of claude.com /
       chatgpt.com"): greeting first, then THE composer beneath it — the one query input moves
       under the welcome word in ask mode and home again for every other mode. */
    document.body.classList.add('mode-ask');   // #q hides; the composer owns the ask
  }else{
    document.body.classList.remove('mode-ask');
  }
  run();}
document.querySelectorAll('.smodes button[data-m]').forEach(function(b){b.addEventListener('click',function(){setMode(b.getAttribute('data-m'));if(b.getAttribute('data-m')!=='ask')qEl.focus();});});
document.querySelectorAll('[data-passage]').forEach(function(b){b.onclick=function(){setMode(b.dataset.passage);qEl.focus();};});
document.getElementById('runSearch').onclick=function(){run();};

/* ---- works map: Blob works-index — every mode's cite/title join ---- */
var _navq=null;
function navMap(cb){if(NAV)return cb(NAV);
  if(_navq){_navq.push(cb);return;}
  _navq=[cb];
  fetch(FRB+'/v1/works-index.json'+VER).then(function(r){return r.json();}).then(function(j){
    var rows=(j&&j.works)||[];NAV={};WLIST=rows;
    rows.forEach(function(w){if(w.slug)NAV[w.slug]={t:w.title||w.slug,a:w.author||'',al:w.author_la||'',v:w.volume||'',tr:w.tradition||'',n:w.n_pages||0};if(w.party)(PARTYSLUGS[w.party]=PARTYSLUGS[w.party]||[]).push(w.slug);});
    IDX=rows.filter(function(w){return w.slug;}).map(function(w){return {d:w.slug,k:'work',t:w.title||w.slug,a:w.author||'',al:w.author_la||''};});
    buildFacetLists();
    var q2=_navq;_navq=null;q2.forEach(function(f){f(NAV);});
  }).catch(function(){NAV={};WLIST=[];IDX=[];var q2=_navq||[];_navq=null;q2.forEach(function(f){f(NAV);});});}
function docCite(d){var e=NAV&&NAV[d];if(!e)return 'The Faith Received';
  return esc(e.a||'')+(e.v?' · '+esc(e.v):'')+(e.tr?' · '+esc(e.tr):'');}
function docTitle(d){var e=NAV&&NAV[d];return e?esc(e.t||d):esc(d||'');}

/* ---- Facets: author / work / tradition — narrow any result set ---- */
var FAC={author:'',work:'',trad:'',corpus:''};
var WORKMAP=null;
function facetOk(d){var e=NAV&&NAV[d];
  if(FAC.work && String(d)!==String(FAC.work))return false;
  if(!e)return true;
  if(FAC.author){var _fa=FAC.author.toLowerCase();
    if((e.a||'').toLowerCase().indexOf(_fa)<0&&(e.al||'').toLowerCase().indexOf(_fa)<0)return false;}
  if(FAC.trad && (e.tr||'')!==FAC.trad)return false;
  return true;}
function buildFacetLists(){
  var auth={},trad={};WORKMAP={};var wopts=[];
  (WLIST||[]).forEach(function(w){if(!w.slug)return;
    if(w.author)auth[w.author]=1;
    if(w.tradition)trad[w.tradition]=1;
    var label=(w.title||w.slug)+(w.author?' — '+w.author:'')+(w.volume?' ('+w.volume+')':'');
    WORKMAP[label]=w.slug;wopts.push(label);});
  var authList=Object.keys(auth).sort();wopts.sort();
  ['facAuthors','scopeAuthors'].forEach(function(id){var dl=document.getElementById(id);
    if(dl)dl.innerHTML=authList.map(function(a){return '<option value="'+esc(a)+'">';}).join('');});
  ['facWorks','scopeWorks'].forEach(function(id){var dl=document.getElementById(id);
    if(dl)dl.innerHTML=wopts.slice(0,4000).map(function(w){return '<option value="'+esc(w)+'">';}).join('');});
  var vs=document.getElementById('fTrad');
  if(vs&&vs.options.length<=1){
    var opts=['<option value="">All traditions</option>'];
    Object.keys(trad).sort().forEach(function(v){opts.push('<option value="'+esc(v)+'">'+esc(v)+'</option>');});
    vs.innerHTML=opts.join('');}
}
function facetInit(){
  navMap(function(){});
  var fa=document.getElementById('fAuthor'),fw=document.getElementById('fWork'),
      fv=document.getElementById('fTrad'),fc=document.getElementById('fClear');
  function upd(){
    FAC.author=(fa&&fa.value||'').trim();
    FAC.trad=(fv&&fv.value||'').trim();
    var wv=(fw&&fw.value||'').trim();
    FAC.work=(wv&&WORKMAP&&WORKMAP[wv])||'';
    if(fc)fc.hidden=!(FAC.author||FAC.trad||FAC.work);
    run();}
  if(fa)fa.addEventListener('input',upd);
  if(fw)fw.addEventListener('input',upd);
  if(fv)fv.addEventListener('change',upd);
  if(fc)fc.onclick=function(){if(fa)fa.value='';if(fw)fw.value='';if(fv)fv.value='';upd();};}
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
    if(MODE==='title'){hint.textContent='Searches '+(WLIST||[]).length.toLocaleString()+' works and '+rows.length.toLocaleString()+' section headings.';run();}
  }).catch(function(){_hLoading=false;});}
function foldQ(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/v/g,'u').replace(/j/g,'i');}
function renderTitle(q){
  if(!IDX){res.innerHTML='';ct.innerHTML='<span class="sbusy">loading…</span>';navMap(function(){run();});return;}
  loadHeadingsTier();
  var toks=foldQ(q).split(/\s+/).filter(function(t2){return t2.length>=2;});
  var m=IDX.filter(function(e){
    var hay=foldQ(e.t+' '+e.a+' '+(e.al||''));
    return toks.every(function(t2){return hay.indexOf(t2)>=0;})&&facetOk(e.d);
  });
  // author-name queries surface the author's OWN works first ("Augustine" = the 143
  // Augustine works, then works merely mentioning him in the title)
  m.forEach(function(e){var ah=foldQ(e.a+' '+(e.al||''));
    var hit=toks.length&&toks.every(function(t2){return ah.indexOf(t2)>=0;});
    // 0 = the author's own works · 1 = dubia ("Uncertain author (Augustine?)") · 2 = title-only
    e._au=hit?(/^(uncertain|various|anonymous|auctor|auctores)/i.test(e.a)?1:0):2;});
  m.sort(function(x,y){return x._au-y._au;});
  if(!m.length&&window._AUTO_MODE&&q.length>=3){window._AUTO_MODE=false;setMode('full');return;}
  // question-shaped input in Find mode ("what/why/how…?") → Ask is what they meant
  if(MODE==='title'&&/^(what|why|how|did|does|is|are|who|when|where|can|should)\b/i.test(q)&&/\?\s*$/.test(q)){setMode('ask');renderAsk(q);return;}
  var byDoc={},order=[];
  m.forEach(function(e){
    if(!(e.d in byDoc)){byDoc[e.d]={work:null,divs:[]};order.push(e.d);}
    if(e.k==='work')byDoc[e.d].work=e; else byDoc[e.d].divs.push(e);
  });
  if(!order.length){ct.innerHTML='';res.innerHTML=zeroHtml(q,'title');return;}
  ct.textContent=order.length+' work'+(order.length===1?'':'s')+(m.length>order.length?(' · '+m.length+' incl. sections'):'');
  res.innerHTML=order.slice(0,300).map(function(d){
    var g=byDoc[d], e=g.work||g.divs[0];
    var href=rdHref(e.d,e.k==='div'?e.page:null);
    var nd=g.divs.length;
    var sec=nd>0?'<span class="sr-sec"> · '+nd+' section'+(nd>1?'s':'')+' match</span>':'';
    var kind=(!g.work&&e.k==='div')?'§ ':'';
    var first=(!g.work&&e.k==='div')?e.t:(g.work?g.work.t:e.t);
    var out='<a class="sr" href="'+href+'"><div class="sr-cite">'+docCite(d)+sec+'</div>'+
      '<div>'+kind+esc(first)+(!g.work?'<span class="nt-meta"> — '+docTitle(d)+'</span>':'')+'</div></a>';
    if(g.work&&nd)out+=g.divs.slice(0,3).map(function(dv){
      return '<a class="sr" style="padding-left:1.4rem" href="'+rdHref(dv.d,dv.page)+'"><div>§ '+esc(dv.t)+(dv.page?' <span class="nt-meta">· p. '+dv.page+'</span>':'')+'</div></a>';}).join('');
    return out;
  }).join('');
  if(order.length>300){var capNote=document.createElement('div');capNote.className='shint';
    capNote.style.cssText='margin:.6rem 0 0';
    capNote.textContent='300 of '+order.length.toLocaleString()+' works — showing the first 300.';
    res.appendChild(capNote);}
}

/* ---- Full text (Pagefind — Blob multi-bucket, same loader as the landing) ---- */
var _pf=null;
function pfInit(){if(_pf)return _pf;
  _pf=fetch(FRB+'/v1/search/pagefind/manifest.json?v=4').then(function(r){return r.json();}).catch(function(){return {buckets:9};})
    .then(function(man){
      var dirs=(man&&man.list&&man.list.length)
        ? man.list.map(function(e){return e.path.replace(/\/pagefind$/,'');}).filter(function(d){return d!=='b0';})
        : (function(){var a=[];for(var i=1;i<((man&&man.buckets)||9);i++)a.push('b'+i);return a;})();
      return import(FRB+'/v1/search/pagefind/b0/pagefind.js?v=4').then(function(p){
        return Promise.all(dirs.map(function(d){return p.mergeIndex(FRB+'/v1/search/pagefind/'+d+'/').catch(function(){return null;});}))
          .then(function(){return p;});});})
    .catch(function(){return null;});
  return _pf;}
function renderFull(q){var my=++seq;ct.innerHTML='<span class="sbusy">searching… <span style="font-weight:400">(first search loads the index)</span></span>';
  navMap(function(){if(my!==seq)return;
    pfInit().then(function(p){if(my!==seq)return;
      if(!p){ct.textContent='Full-text index unavailable.';res.innerHTML='';return;}
      var filt={};
      if(FAC.author)filt.author=FAC.author;
      if(FAC.corpus)filt.corpus=FAC.corpus;
      var opts=Object.keys(filt).length?{filters:filt}:undefined;
      p.search(q,opts).then(function(r){if(my!==seq)return;
        /* CHUNKED (owner eval 2026-09-06 "evaluate full text": the list hard-stopped at 60
           of 2,294 with no way on) — 60 per batch, a Show-more foot walks the rest. Each
           row cite carries its page number, parsed from the deep-link anchor. */
        var rfTotal=r.results.length,shown=0,byWork={},order=[];
         /* GROUPED BY WORK (owner 2026-09-10 'passages fundamentally broken'):
            a work whose TITLE matches floods the page-level list (the title
            rides on every indexed page) and the excerpts echo the title.
            One card per work; excerpts strip the title and prefer real text. */
         function pageOf(u){var m2=/#b(\d+)-/.exec(u||'');return m2?m2[1]:'';}
         function cleanEx(ex,title){var t2=String(ex||'');
           if(title){try{var e2=title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');t2=t2.replace(new RegExp(e2,'gi'),' ');}catch(_){}}
           return t2.replace(/\s+/g,' ').trim();}
         function addItem(it){var meta=it.meta||{},sl=meta.slug||'';
           if(!byWork[sl]){var cite=docCite(sl);
             var cpx=/^pg-/.test(sl)?'Greek Fathers':/^pld-/.test(sl)?'Latin Fathers':/^po-/.test(sl)?'Oriental':/^eebo-/.test(sl)?'EEBO':/^(rc|lc)-/.test(sl)?'Confessions':'';
             if(cpx&&cite.indexOf(cpx)<0)cite=cite?cite+' · '+cpx:cpx;
             byWork[sl]={cite:cite,title:meta.title||sl,url:it.url,pages:[],n:0};order.push(sl);}
           var w=byWork[sl];w.n++;
           if(w.pages.length>=8)return;
           var cands=(it.sub_results||[]).map(function(s){return {url:s.url,ex:cleanEx(s.excerpt,meta.title)};});
           cands.push({url:it.url,ex:cleanEx(it.excerpt,meta.title)});
           var best=null;for(var ci=0;ci<cands.length;ci++){if(cands[ci].ex.length>40){best=cands[ci];break;}}
           if(!best)best=cands[0]||{url:it.url,ex:''};
           var pg=pageOf(best.url||it.url);
           if(w.pages.some(function(x){return x.page===pg;}))return;
           // keep the indexed page text for the Preview drawer — works for
           // every storage shape (TEI-only works have no shards to hydrate);
           // the index prepends the work title to every page, so peel it
           var fu=String(it.content||'').replace(/\s+/g,' ').trim();
           var ttl=String(meta.title||'').replace(/\s+/g,' ').trim();
           if(ttl.length>8){var g=0;while(g++<4&&fu.toLowerCase().indexOf(ttl.toLowerCase())===0){fu=fu.slice(ttl.length).replace(/^[\s.,;:·—–-]+/,'');}}
           w.pages.push({url:best.url||it.url,page:pg,ex:best.ex,full:fu.slice(0,1800)});}
         function pageRow(pp){return '<a class="sr sr-page" href="'+pp.url+'">'+(pp.page?'<span class="sr-pg">p. '+pp.page+'</span>':'')+'<span class="sr-ex">'+mdHeadings(pp.ex||'')+'</span></a>';}
         function workHtml(sl,idx){var w=byWork[sl];
           var head='<summary class="sr-whead"><span class="sr-cite">'+w.cite+'</span><span class="sr-wtitle">'+esc(w.title)+'</span><span class="sr-wn">'+w.n.toLocaleString()+' page'+(w.n===1?'':'s')+'</span></summary>';
           var rows=w.pages.map(function(pp){
             return '<div class="sr-page" data-sl="'+esc(sl)+'" data-pg="'+esc(pp.page||'')+'">'
               +(pp.page?'<span class="sr-pg">p. '+pp.page+'</span>':'')
               +'<span class="sr-ex">'+mdHeadings(pp.ex||'')+'</span>'
               +'<span class="sr-act"><button type="button" class="sr-peek">Preview</button><a href="'+pp.url+'">Open \u2192</a></span>'
               +'<div class="sr-drawer" hidden></div></div>';}).join('');
           var note=w.n>w.pages.length?'<div class="sr-note">'+(w.n-w.pages.length).toLocaleString()+' more matching pages \u2014 open the work and search inside.</div>':'';
           return '<details class="sr-work"'+(idx<2?' open':'')+'>'+head+rows+note+'</details>';}
         function render(){
           if(!order.length){ct.innerHTML='';res.innerHTML=zeroHtml(q,'full');return;}
           ct.textContent=rfTotal.toLocaleString()+' matching page'+(rfTotal===1?'':'s')+' across '+order.length.toLocaleString()+' work'+(order.length===1?'':'s')+(shown<r.results.length?' so far':'');
           res.innerHTML=order.map(function(sl,ix){return workHtml(sl,ix);}).join('')
             +(shown<r.results.length?'<button type="button" class="sr-more" id="pfMore">Show more works — '+(r.results.length-shown).toLocaleString()+' further pages unscanned</button>':'');
           var mb=document.getElementById('pfMore');
           if(mb)mb.onclick=function(){mb.disabled=true;mb.textContent='Loading…';batch();};
           res.querySelectorAll('.sr-peek').forEach(function(b){b.onclick=function(){
             var row=b.closest('.sr-page'),dr=row.querySelector('.sr-drawer');
             if(!dr.hidden){dr.hidden=true;b.textContent='Preview';return;}
             dr.hidden=false;b.textContent='Hide';
             if(dr.dataset.done)return;dr.dataset.done='1';
             dr.innerHTML='<p class="sr-loading">Loading the page\u2026</p>';
             var sl=row.dataset.sl,pg=row.dataset.pg,wk=byWork[sl];
             var pp=wk&&wk.pages.filter(function(x){return String(x.page||'')===pg;})[0];
             var show=function(tx){tx=String(tx||'');
               if(!tx){dr.innerHTML='<p class="sr-loading">This page has no readable text here \u2014 open the work to see it in place.</p>';return;}
               dr.innerHTML='<div class="sr-ptext">'+esc(tx.slice(0,1600))+(tx.length>=1600?'\u2026':'')+'</div>';};
             if(pp&&pp.full){show(pp.full);return;}
             excerpt(sl,+pg,1600).then(show)
               .catch(function(){dr.innerHTML='<p class="sr-loading">The page could not load.</p>';});
           };});}
         function batch(){
           Promise.all(r.results.slice(shown,shown+60).map(function(x){return x.data();})).then(function(items){if(my!==seq)return;
             shown=Math.min(shown+60,r.results.length);
             items.forEach(function(it){var sl=(it.meta&&it.meta.slug)||'';
               if(FAC.work&&sl!==FAC.work)return;
               if(FAC.trad){var e=NAV[sl];if(e&&e.tr!==FAC.trad)return;}
               addItem(it);});
             if(order.length<10&&shown<r.results.length&&shown<420){render();batch();return;}
             render();
           });
         }
         batch();
      });
    });
  });}

/* ---- Blob excerpt hydration (meaning + tradition home hits): meta.json → shard → page text ---- */
var _exc={};
function excerpt(slug,page,max){max=max||220;page=+page;var k=slug+'|'+page+'|'+max;
  if(k in _exc)return Promise.resolve(_exc[k]);
  return fetch(FRB+'/v1/works/'+slug+'/meta.json').then(function(r){return r.json();}).then(function(meta){
    var f=meta.single?'work.json':(((meta.shards||[]).filter(function(s){return s.from<=page&&page<=s.to;})[0])||{}).file;
    if(!f)return (_exc[k]=null);
    return fetch(FRB+'/v1/works/'+slug+'/'+f).then(function(r){return r.json();}).then(function(d){
      var pg=(d.pages||[]).filter(function(x){return x.n===page;})[0];
      var tx=(pg&&(pg.en||pg.la)||'').replace(/\[\^[^\]]*\]:?/g,'').replace(/[#*]+/g,'').replace(/\s+/g,' ').trim();
      return (_exc[k]=tx?tx.slice(0,max):null);});
  }).catch(function(){return (_exc[k]=null);});}

function searchUnavailable(label,query){
  ct.textContent=label+' is temporarily unavailable. Your search is still here.';
  res.innerHTML='<div class="search-recovery"><p>Continue with exact wording, or ask a question of the library.</p><button type="button" data-recover="full">Search full text</button><button type="button" data-recover="ask">Ask the library</button></div>';
  res.querySelector('[data-recover="full"]').onclick=function(){qEl.value=query;setMode('full');};
  res.querySelector('[data-recover="ask"]').onclick=function(){if(window.FRAsk)window.FRAsk.open({q:query});else setMode('ask');};
}
/* ---- Meaning (hybrid semantic+lexical via /api/vsearch&sparse=1) ----
   Grouped per work like the Passages mode (owner 09-10: "by idea search
   too ... organized better so we dont have endless scrolling ... allow
   preview source"): one collapsed card per work, best passages inside,
   Preview drawer hydrates the page text in place. */
function renderMeaning(q){var my=++seq;ct.innerHTML='<span class="sbusy">searching by meaning…</span>';
  navMap(function(){if(my!==seq)return;
    fetch('https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/vsearch?q='+encodeURIComponent(q)+'&k=40'+((FAC.corpus==='pld'||FAC.corpus==='pg'||FAC.corpus==='po')?'&corpus='+(FAC.corpus==='pld'?'pl':FAC.corpus):'&sparse=1')).then(function(r){return r.ok?r.json():r.json().catch(function(){return {error:'unavailable'};});}).then(function(j){
      if(my!==seq)return;var rs=((j&&j.results)||[]).filter(function(p){return p.slug&&facetOk(p.slug);});
      if(!rs.length){if(j&&j.error)return searchUnavailable('Search by idea',q);ct.textContent='No passages found.';res.innerHTML='';return;}
      var byW={},ord=[];
      rs.forEach(function(p){var sl=p.slug;
        if(!byW[sl]){byW[sl]={pp:[]};ord.push(sl);}
        if(byW[sl].pp.length<6&&!byW[sl].pp.some(function(x){return x.page===p.page;}))byW[sl].pp.push(p);
        byW[sl].n=(byW[sl].n||0)+1;});
      ord.sort(function(a,b){return byW[b].n-byW[a].n;});
      ct.textContent=rs.length+' passages by meaning across '+ord.length+' work'+(ord.length===1?'':'s');
      res.innerHTML=ord.map(function(sl,ix){var w=byW[sl];
        var head='<summary class="sr-whead"><span class="sr-cite">'+docCite(sl)+'</span><span class="sr-wtitle">'+docTitle(sl)+'</span><span class="sr-wn">'+w.n+' passage'+(w.n===1?'':'s')+'</span></summary>';
        var rows=w.pp.map(function(pp){
          return '<div class="sr-page" data-sl="'+esc(sl)+'" data-pg="'+esc(pp.page==null?'':pp.page)+'">'
            +(pp.page!=null?'<span class="sr-pg">p. '+pp.page+'</span>':'')
            +'<span class="sr-ex" data-ex="'+esc(sl)+'|'+pp.page+'">'+esc(String(pp.snippet||'').slice(0,220))+'</span>'
            +'<span class="sr-act"><button type="button" class="sr-peek">Preview</button><a href="'+rdHref(sl,pp.page)+'">Open →</a></span>'
            +'<div class="sr-drawer" hidden></div></div>';}).join('');
        return '<details class="sr-work"'+(ix<3?' open':'')+'>'+head+rows+'</details>';}).join('');
      Array.prototype.slice.call(res.querySelectorAll('[data-ex]'),0,24).forEach(function(sp){
        var kv=sp.getAttribute('data-ex').split('|');
        excerpt(kv[0],+kv[1]).then(function(tx){if(tx&&my===seq)sp.textContent=tx+'…';});});
      var snipOf={};rs.forEach(function(p){snipOf[p.slug+'|'+p.page]=String(p.snippet||'');});
      res.querySelectorAll('.sr-peek').forEach(function(b){b.onclick=function(){
        var row=b.closest('.sr-page'),dr=row.querySelector('.sr-drawer');
        if(!dr.hidden){dr.hidden=true;b.textContent='Preview';return;}
        dr.hidden=false;b.textContent='Hide';
        if(dr.dataset.done)return;dr.dataset.done='1';
        dr.innerHTML='<p class="sr-loading">Loading the page…</p>';
        var fb=snipOf[row.dataset.sl+'|'+row.dataset.pg]||'';
        excerpt(row.dataset.sl,+row.dataset.pg,1600).then(function(tx){
          tx=String(tx||'')||fb;
          if(!tx){dr.innerHTML='<p class="sr-loading">This page has no readable text here — open the work to see it in place.</p>';return;}
          dr.innerHTML='<div class="sr-ptext">'+esc(tx.slice(0,1600))+(tx.length>=1600?'…':'')+'</div>';
        }).catch(function(){dr.innerHTML=fb?'<div class="sr-ptext">'+esc(fb)+'</div>':'<p class="sr-loading">The page could not load.</p>';});
      };});
    }).catch(function(){if(my!==seq)return;searchUnavailable('Search by idea',q);});
  });}
/* ---- Tradition (cross-corpus timeline via /api/xsearch) — Round-5 scope contract ---- */
var CORPUS_BADGE={PG:'Greek Fathers',PL:'Latin Fathers',PO:'Oriental',AQ:'Aquinas',TFR:'Early modern'};
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
    +'<button type="button" class="trad-chip tb-po" data-c="po" title="Oriental">PO</button>'
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
              esc(h.cit||'')+(h.trad?' <span class="tr-trad">'+esc(h.trad)+'</span>':'')+(h.corpus==='PL'?' <span class="trad-badge" style="color:var(--muted);border-color:var(--border)" title="A companion site that currently asks for sign-in">companion · sign-in</span>':'')+' <span class="sr-n">· '+Math.round((h.score||0)*100)+'%</span></div>'+
              (h.tx?('<div class="sr-ex">'+esc(h.tx)+'…</div>')
                :(home&&slm&&slm[1]?('<div class="sr-ex" data-ex="'+esc(slm[1])+'|'+(h.page||'')+'"></div>')
                :(h.page?('<div class="sr-ex">p. '+h.page+'</div>'):'')))+'</a>';
          }).join('')+'</div>';
      }).join(''));
    Array.prototype.slice.call(res.querySelectorAll('[data-ex]'),0,20).forEach(function(sp){
      var kv=sp.getAttribute('data-ex').split('|');if(!kv[0]||!kv[1])return;
      excerpt(kv[0],+kv[1]).then(function(tx){if(tx&&my===seq)sp.textContent=tx+'…';});});
  }).catch(function(){if(my!==seq)return;searchUnavailable('Tradition search',q);});}

/* ---- Scripture (chapter landings from v1/scripture.json — the preach-a-text door) ---- */
var SCR=null;
function sbInit(cb){if(SCR)return cb(SCR);
  fetch(FRB+'/v1/scripture.json'+VER).then(function(r){return r.json();}).then(function(j){SCR=j||{};cb(SCR);}).catch(function(){SCR={};cb(SCR);});}
var BOOK_ABBR={gen:'genesis',exod:'exodus',ex:'exodus',lev:'leviticus',num:'numbers',deut:'deuteronomy',dt:'deuteronomy',
  josh:'joshua',judg:'judges',ruth:'ruth','1sam':'1 samuel','2sam':'2 samuel','1kgs':'1 kings','2kgs':'2 kings',
  '1kings':'1 kings','2kings':'2 kings','1chr':'1 chronicles','2chr':'2 chronicles',ezra:'ezra',neh:'nehemiah',
  esth:'esther',job:'job',ps:'psalms',psa:'psalms',psalm:'psalms',prov:'proverbs',eccl:'ecclesiastes',
  song:'song of songs',cant:'song of songs',isa:'isaiah',jer:'jeremiah',lam:'lamentations',ezek:'ezekiel',
  dan:'daniel',hos:'hosea',joel:'joel',amos:'amos',obad:'obadiah',jonah:'jonah',mic:'micah',nah:'nahum',
  hab:'habakkuk',zeph:'zephaniah',hag:'haggai',zech:'zechariah',mal:'malachi',matt:'matthew',mt:'matthew',
  mk:'mark',mark:'mark',lk:'luke',luke:'luke',jn:'john',john:'john',acts:'acts',rom:'romans',
  '1cor':'1 corinthians','2cor':'2 corinthians',gal:'galatians',eph:'ephesians',phil:'philippians',
  col:'colossians','1thess':'1 thessalonians','2thess':'2 thessalonians','1tim':'1 timothy','2tim':'2 timothy',
  titus:'titus',phlm:'philemon',heb:'hebrews',jas:'james',james:'james','1pet':'1 peter','2pet':'2 peter',
  '1john':'1 john','2john':'2 john','3john':'3 john',jude:'jude',rev:'revelation',apoc:'revelation'};
function resolveBook(s){if(!SCR)return null;
  var raw=s.replace(/\./g,'').trim().toLowerCase().replace(/^([123])\s+/,'$1');
  var key=raw.replace(/\s+/g,' ');
  if(SCR[key])return key;
  if(BOOK_ABBR[raw.replace(/\s+/g,'')])return BOOK_ABBR[raw.replace(/\s+/g,'')];
  var ks=Object.keys(SCR);
  for(var i=0;i<ks.length;i++)if(ks[i].indexOf(key)===0)return ks[i];
  for(var i2=0;i2<ks.length;i2++)if(ks[i2].replace(/^\d+ /,'').indexOf(key.replace(/^\d+ ?/,''))===0&&(/^\d/.test(key)===/^\d/.test(ks[i2])))return ks[i2];
  return null;}
function parseRef(q){q=q.trim();var m=q.match(/^(.+?)\s+(\d+)\s*(?:[:.,]\s*(\d+))?\s*$/);
  if(!m)return null;return {book:m[1],ch:m[2],v:m[3]?parseInt(m[3]):0};}
function capB(s){return String(s).replace(/\b[a-z]/g,function(c){return c.toUpperCase();});}
function renderScripture(q){var my=++seq;var ref=parseRef(q);
  if(!ref){ct.textContent='Type a reference — e.g. Rom 8 · Matt 5 · Ps 110.';res.innerHTML='';return;}
  sbInit(function(S){if(my!==seq)return;var b=resolveBook(ref.book);
    if(!b){ct.textContent='No biblical book matched “'+esc(ref.book)+'”.';res.innerHTML='';return;}
    var rows=S[b]&&S[b][String(ref.ch)];
    if(!rows||!rows.length){ct.textContent=capB(b)+' '+esc(ref.ch)+' has no commentary landings in the library.';res.innerHTML='';return;}
    navMap(function(){if(my!==seq)return;
      var hits=rows.filter(function(e){return facetOk(e[0]);});
      var label=capB(b)+' '+ref.ch;
      ct.textContent=hits.length.toLocaleString()+' commentator landing'+(hits.length===1?'':'s')+' on '+label+(ref.v?' (chapter level — verse '+ref.v+' will be on these pages)':'');
      res.innerHTML=hits.slice(0,300).map(function(e){
        return '<a class="sr" href="'+rdHref(e[0],e[1])+'"><div class="sr-cite">'+docCite(e[0])+' <span class="sr-n">· p. '+e[1]+'</span></div><div>'+docTitle(e[0])+'</div><div class="sr-ex">'+esc(e[2]||'')+'</div></a>';}).join('')
        +(hits.length>300?'<div class="shint">…and '+(hits.length-300).toLocaleString()+' more</div>':'');
    });
  });}
/* RESEARCH DOORS (owner 2026-09-05 "these tabs don't cohere with our constellations — link
   deeply"): Scripture and Tradition are windows onto the dedicated surfaces; say so and
   link straight in, in the site's own quiet register. */
function doorRow(m){
  var doors=m==='scripture'
    ?[['/the-faith-received/bible/','Scripture atlas','every citation, book by book, opening on the verse'],
      ['/the-faith-received/fathers/?sh=gf','Author rooms','each author’s topics, positions, and reception']]
    :[['/the-faith-received/web/','The Web of Theology','fifteen centuries of citation as a navigable sky'],
      ['/the-faith-received/fathers/?sh=gf','Author rooms','each author’s topics, positions, and reception'],
      ['/the-faith-received/topics/','Topics','doctrines era by era, with their carrying passages']];
  return '<div class="sdoors">'+doors.map(function(d){
    return '<a class="sdoor" href="'+d[0]+'"><span class="sd-n">'+d[1]+' →</span><span class="sd-d">'+d[2]+'</span></a>';}).join('')+'</div>';
}
function scriptureBrowse(){
  ct.innerHTML='<span class="sbusy">loading the scripture index…</span>';res.innerHTML='';
  sbInit(function(S){
    if(qEl.value.trim().length>=2)return;
    var flat=[];
    Object.keys(S).forEach(function(b){Object.keys(S[b]).forEach(function(c){flat.push({b:b,c:c,n:S[b][c].length});});});
    flat.sort(function(a,b2){return b2.n-a.n;});
    flat=flat.slice(0,40);
    if(!flat.length){ct.textContent='';res.innerHTML='';return;}
    ct.textContent='Most-commented chapters — tap one, or type any reference above.';
    res.innerHTML='<div class="sb-grid">'+flat.map(function(e){
      var ref=capB(e.b)+' '+e.c;
      return '<button type="button" class="sb-chip" data-ref="'+esc(ref)+'">'+esc(ref)+' <span class="sr-n">'+e.n+'</span></button>';
    }).join('')+'</div>';
    Array.prototype.forEach.call(res.querySelectorAll('.sb-chip'),function(btn){
      btn.addEventListener('click',function(){qEl.value=btn.getAttribute('data-ref');run();qEl.focus();});
    });
  });
}

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
      return '<button type="button" data-tr="'+esc(c2[0])+'"'+(ASKTRAD===c2[0]?' class="on"':'')+'>'+esc(c2[1])+'</button>';}).join('')
    +'</div><div class="asw-sub"><span class="asw-sublb">English Divines</span><div class="ask-corpora">'
    +'<button type="button" data-tr="English Divines"'+(ASKTRAD==='English Divines'?' class="on"':'')+'>All divines</button>'
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
    chips.push({t:'How do the '+esc(absent[0])+' answer?',q:'How would the '+absent[0]+' tradition answer the same question?'});
  ((td.graph&&td.graph.loci)||[]).slice(0,1).forEach(function(l2){
    chips.push({t:'Deeper on '+esc(String(l2)),q:'Go deeper on '+String(l2)+' — the key distinctions and the classic passages.'});});
  chips.push({t:'⟲ Research deeper',deep:true,q:lastQ});
  m.innerHTML='<div class="ask-sugg ask-refine">'+chips.map(function(c,i){
      return '<button data-q="'+esc(c.q)+'"'+(c.deep?' data-deep="1"':'')+'>'+c.t+'</button>';}).join('')
    +'</div><div class="ask-tools"><button class="ask-new" id="askNew" type="button">New conversation</button><button class="ask-new" id="askMap" type="button" title="See this conversation as a map — its questions, loci, and cited works">⊚ Map</button><a class="ask-new" href="/the-faith-received/desk/" style="text-decoration:none" title="Write a paper at the Desk — insert your saved answers and notes with citations">✎ Desk</a><span class="ask-cgpt" data-cgpt-link style="margin-left:auto"></span></div>';
  var b=res.querySelector('#askNew');if(b)b.onclick=function(){askReset();qEl.value='';qEl.focus();};
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
    +door('scripture','Read commentary','Find authors discussing a Bible passage','Romans 8')
    +door('ask','Ask the library','Explore a question with cited answers','How did the early church understand the Eucharist?')
    +'</div></div>';}
document.addEventListener('click',function(e){
  var d=e.target.closest('.sd-mode');if(!d)return;
  var m=d.getAttribute('data-dm'),q2=d.getAttribute('data-dq')||'';
  if(m==='ask'){if(window.FRAsk)window.FRAsk.open({q:q2});else{qEl.value=q2;setMode('ask');}return;}
  qEl.value=q2;setMode(m);qEl.focus();});
function run(){var q=qEl.value.trim();
  if(q.length<2){if(MODE==='scripture'){scriptureBrowse();return;}if(MODE==='ask'){if(!res.querySelector('#askThread'))askReset();return;}
    if(MODE==='title'&&!FAC.author&&!FAC.work&&!FAC.trad){res.innerHTML=startHtml();ct.textContent='';return;}
    res.innerHTML='';ct.textContent='';return;}
  if(MODE==='full')renderFull(q);
  else if(MODE==='tradition')renderTradition(q);
  else if(MODE==='meaning')renderMeaning(q);
  else if(MODE==='ask'){ /* Ask runs on Enter only */ }
  else if(MODE==='scripture')renderScripture(q);
  else renderTitle(q);}
var _t;qEl.addEventListener('input',function(){if(MODE==='ask')return;clearTimeout(_t);if(MODE==='title'||!qEl.value.trim())_t=setTimeout(run,180);});
qEl.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();var q=qEl.value.trim();if(MODE==='ask'){if(q.length>=3){askTurn(q);qEl.value='';}}else run();}});

/* ---- search elevation helpers (donor tail, TFR keys) ---- */
function zeroHtml(q,mode){
  var alt=mode==='full'?'By idea (under Passages) or Ask for a cited answer':'Passages to search the texts, or Ask for a cited answer';
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

/* deep links: ?q=<query>&m=<mode> + ?author=/?tradition= facet prefills (boot-race-safe:
   setMode runs the search itself; nav/index loads re-run via their own cbs). */
(function(){var VALID={full:1,meaning:1,ask:1,scripture:1,title:1,tradition:1};
  try{var u=new URL(location.href),m=u.searchParams.get('m'),q=u.searchParams.get('q');
    var fa=u.searchParams.get('author'),fv=u.searchParams.get('tradition');
    if(fa){var el=document.getElementById('fAuthor');if(el){el.value=fa;FAC.author=fa;}}
    if(fv){var vs=document.getElementById('fTrad');if(vs){vs.value=fv;FAC.trad=fv;}}
    if(q){qEl.value=q;}
    var chatId=u.searchParams.get('chat'),trad=u.searchParams.get('trad');
    if(trad)ASKTRAD=trad;   // any shelf name works — the server post-filters by tradition; unlisted shelves just show no active chip
    window._AUTO_MODE=!VALID[m]&&!!q;
    setMode(chatId?'ask':(VALID[m]?m:'title'));
    if(chatId){chatRestore(chatId);}
    else{
      if((fa||fv)&&!q){qEl.value=fa||'';run();}
      if(q&&MODE==='ask'){renderAsk(q);}}
  }catch(e){setMode('title');}})();
