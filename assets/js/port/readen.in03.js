
const BLOB = window.EEBO_BLOB || "https://mo-tfr-library.mo-podcast-feed.workers.dev/eebo/";
const $ = s => document.querySelector(s);
const esc = s => { const d=document.createElement('div'); d.textContent=s==null?'':s; return d.innerHTML; };

async function loadWork(id){
  const r = await fetch(BLOB + encodeURIComponent(id) + ".json.gz");
  if(!r.ok) throw new Error("HTTP "+r.status);
  const buf = await r.arrayBuffer();
  let txt;
  try{ const ds=new DecompressionStream("gzip");
       txt = await new Response(new Blob([buf]).stream().pipeThrough(ds)).text(); }
  catch(e){ txt = new TextDecoder().decode(buf); }   // already-decompressed fallback
  return JSON.parse(txt);
}

// reading column: DFS the TOC, each node = heading (its label) + its own HTML
function renderBody(toc){
  const out=[];
  (function walk(nodes, base){
    nodes.forEach(function(n, i){
      const path = base===''? String(i) : base+'.'+i;   /* mirrors eebo_modernize.py's DFS paths */
      const lvl=Math.min(n.depth+1,5);
      out.push('<section id="d'+esc(n.id.replace(/ /g,'-'))+'" class="dv dv'+n.depth+'">');
      if(n.label) out.push('<h'+lvl+' class="dv-h">'+esc(n.label)+'</h'+lvl+'>');
      if(n.html)  out.push('<div class="dv-t" data-mpath="'+esc(path)+'">'+n.html+'</div>');
      if(n.kids&&n.kids.length) walk(n.kids, path);
      out.push('</section>');
    });
  })(toc, '');
  return out.join('');
}

/* ── Modern English layer (2026-08-12, owner: "modernize the english in like Baxter").
   eebo_modern/{id}.json.gz ({m:{path:modernText}}) exists for campaign-covered works.
   If it loads, a toggle appears in the reader head; ON swaps each .dv-t's content for
   the modern rendering (original kept on the element for instant flip-back). */
let MODERN=null, MODERN_ON=false;
async function tryModern(id){
  try{
    const r = await fetch(BLOB.replace('/eebo/','/eebo_modern/') + encodeURIComponent(id) + '.json.gz');
    if(!r.ok) return;
    const buf = await r.arrayBuffer();
    let txt;
    try{ const ds=new DecompressionStream('gzip');
         txt = await new Response(new Blob([buf]).stream().pipeThrough(ds)).text(); }
    catch(e){ txt = new TextDecoder().decode(buf); }
    MODERN = (JSON.parse(txt).m)||null;
    if(!MODERN || !Object.keys(MODERN).length){ MODERN=null; return; }
    MODERN_ON=true;   // owner 2026-08-17: modern English IS the reading text — apply on load
    document.querySelectorAll('.dv-t[data-mpath]').forEach(function(el){
      const q=el.getAttribute('data-mpath');
      if(MODERN[q]!=null){ if(el._orig==null) el._orig=el.innerHTML;
        const pbs=[...el.querySelectorAll('.pb')];   // keep the page spine (Reader Map #2)
        el.textContent=MODERN[q];
        pbs.forEach(pb=>el.insertBefore(pb,el.firstChild)); }
    });
    const head = document.querySelector('#work header');
    if(!head) return;
    const b=document.createElement('button');
    b.id='modernBtn'; b.type='button'; b.textContent='Original spelling';
    b.title='This work reads in a faithful machine modernization by default. Toggle to the original EEBO-TCP spelling any time.';
    b.style.cssText='display:inline-block;margin:.45rem 0 0;font:600 .78rem system-ui;padding:.3rem .75rem;border-radius:999px;border:1px solid var(--accent,#3F6B4E);background:none;color:var(--accent,#3F6B4E);cursor:pointer';
    b.addEventListener('click',function(){
      MODERN_ON=!MODERN_ON;
      b.textContent=MODERN_ON?'Original spelling':'Modern English';
      document.querySelectorAll('.dv-t[data-mpath]').forEach(function(el){
        const p=el.getAttribute('data-mpath');
        if(MODERN_ON){
          if(MODERN[p]!=null){
            if(el._orig==null) el._orig=el.innerHTML;
            el.textContent=MODERN[p];
          }
        } else if(el._orig!=null){ el.innerHTML=el._orig; }
      });
    });
    head.appendChild(b);
  }catch(e){}
}
// sidebar contents: collapsible nested tree, links to the section anchors
function renderToc(toc){
  const out=[];
  (function walk(nodes){
    out.push('<ul>');
    for(const n of nodes){
      const a='#d'+n.id.replace(/ /g,'-'), lab=esc(n.label||'·');
      if(n.kids&&n.kids.length){
        out.push('<li class="has"><details open><summary><a href="'+a+'">'+lab+'</a></summary>');
        walk(n.kids); out.push('</details></li>');
      } else out.push('<li><a href="'+a+'">'+lab+'</a></li>');
    }
    out.push('</ul>');
  })(toc);
  return out.join('');
}

// caps runs → small caps; long address blocks → display lines (shared with the main reader)
function capsPass(){
  const CAPS=/((?:[A-Z0-9ÆŒ&(),.:;'’\-\[\]]{2,}(?![a-z])\s+){2,}[A-Z0-9ÆŒ&(),.:;'’\-\[\]]{2,}(?![a-z]))/g;
  document.querySelectorAll('#work .dv-t p:not([data-caps])').forEach(el=>{
    el.setAttribute('data-caps','1');
    if(!/[A-Z]{3,}\s+[A-Z]{3,}/.test(el.textContent))return;
    [...el.childNodes].forEach(nd=>{
      if(nd.nodeType!==3)return;
      const t=nd.textContent;if(!/[A-Z]{3,}\s+[A-Z]{3,}/.test(t))return;
      const frag=document.createDocumentFragment();let last=0;
      t.replace(CAPS,(m,run,off)=>{
        const letters=(run.match(/[A-Z]/g)||[]).length,lower=(run.match(/[a-z]/g)||[]).length;
        if(letters<8||lower>letters/4)return m;
        frag.appendChild(document.createTextNode(t.slice(last,off)));
        let blk=run,tail='';
        if(run.length>=40&&!/[.!?:]\s*$/.test(run)){
          const mm=run.match(/^([\s\S]*[.!?:])\s+([\s\S]*)$/);
          if(mm){blk=mm[1];tail=mm[2];}else{blk='';tail=run;}
        }
        if(blk){const sp=document.createElement('span');sp.className='capsrun'+(blk.length>=40?' blk':'');sp.textContent=blk;frag.appendChild(sp);}
        if(tail){const sp=document.createElement('span');sp.className='capsrun';sp.textContent=(blk?' ':'')+tail;frag.appendChild(sp);}
        last=off+run.length;return m;});
      if(last){frag.appendChild(document.createTextNode(t.slice(last)));nd.replaceWith(frag);}
    });});
}
function pageMarkers(){   // turn the inline <span class="pb" data-n> into "p. N" margin tags
  document.querySelectorAll('#work .pb').forEach(s=>{ const n=s.getAttribute('data-n'); if(n) s.setAttribute('data-pg','p. '+n); });
}
// cite-copy (2026-08-13, in-place enhancement): click a page marker → copy the family
// citation ("Author · Title (p. N)") + a deep link to this work
document.addEventListener('click', (e)=>{
  const s=e.target.closest && e.target.closest('#work .pb'); if(!s) return;
  const n=s.getAttribute('data-n'); if(!n) return;
  const m=(window._curMeta||{});
  const au=(m.author||'Anonymous').split(',')[0], ti=(m.title||'').slice(0,60).replace(/[,;:.\s]+$/,'');
  const cite=au+' \u00b7 '+ti+' (p. '+n+')';
  try{navigator.clipboard.writeText(cite+' \u2014 '+location.origin+location.pathname+location.search);}catch(err){}
  s.style.outline='2px solid var(--accent,#3F6B4E)'; setTimeout(()=>{s.style.outline='';},800);
}, true);
// marginal notes: collapse each to a ° marker (hover=preview via title, click=expand inline)
function wireNotes(){
  const notes=document.querySelectorAll('#work .dv-t .note'); if(!notes.length){ const nb=$('#notesBtn'); if(nb)nb.style.display='none'; return; }
  notes.forEach(n=>{ n.title=n.textContent.replace(/\s+/g,' ').trim();
    n.addEventListener('click',e=>{ if($('#work').classList.contains('notes-shown'))return; e.stopPropagation(); n.classList.toggle('open'); }); });
}

function render(w){
  const m=w.meta;
  document.title = (m.title||'Untitled') + ' · The Faith Received';
  const bits=[m.author, m.year, m.place].filter(Boolean).map(esc).join(' · ');
  const head='<header class="work-head"><h1>'+esc(m.title||'(untitled)')+'</h1>'
    + (bits?'<p class="byline">'+bits+'</p>':'')
    + (m.extent?'<p class="extent">'+esc(m.extent)+(m.idno?' · EEBO '+esc(m.idno):'')+'</p>':'')
    + '<p class="prov">Transcription: EEBO-TCP · spelling lightly modernized for reading · an English Divines shelf edition</p></header>';
  $('#work').innerHTML = head + renderBody(w.toc);
  $('#toc').innerHTML = renderToc(w.toc);
  window._curMeta=m;
  pageMarkers();capsPass();

  tryModern(m && m.id);
  wireNotes();
  wireToc();
  wireTocSearch();
}

// filter the Contents tree: show a node when it (or any descendant) matches; expand to reveal hits
function wireTocSearch(){
  const box=$('#tocSearch'), root=$('#toc'); if(!box) return;
  function visit(li,q){
    const a=li.querySelector(':scope > a, :scope > details > summary > a');
    const self=!!a && a.textContent.toLowerCase().indexOf(q)>=0;
    let anyKid=false;
    li.querySelectorAll(':scope > details > ul > li').forEach(k=>{ if(visit(k,q)) anyKid=true; });
    const show = !q || self || anyKid;
    li.style.display = show ? '' : 'none';
    const det=li.querySelector(':scope > details'); if(det && q && anyKid) det.open=true;
    if(a) a.classList.toggle('match', !!q && self);
    return show;
  }
  let tm=null;
  box.oninput=()=>{ clearTimeout(tm); tm=setTimeout(()=>{
    const q=box.value.trim().toLowerCase();
    root.querySelectorAll(':scope > ul > li').forEach(li=>visit(li,q));
  },110); };
}

// scroll-spy: mark the contents entry whose section is at the top of the viewport
function wireToc(){
  const links=[...document.querySelectorAll('#toc a')];
  const map=new Map(links.map(a=>[a.getAttribute('href'),a]));
  const secs=[...document.querySelectorAll('#work .dv')];
  let tick=false;
  function spy(){ tick=false;
    let cur=null; for(const s of secs){ if(s.getBoundingClientRect().top<=120) cur=s; else break; }
    links.forEach(a=>a.classList.remove('here'));
    if(cur){ const a=map.get('#'+cur.id); if(a){ a.classList.add('here');
      const li=a.closest('li'); if(li) li.scrollIntoView({block:'nearest'}); } }
  }
  addEventListener('scroll',()=>{ if(!tick){ requestAnimationFrame(spy); tick=true; } },{passive:true});
  document.querySelectorAll('#toc a').forEach(a=>a.addEventListener('click',e=>{
    const t=document.getElementById(a.getAttribute('href').slice(1));
    if(t){ e.preventDefault(); t.scrollIntoView({behavior:'smooth',block:'start'});
      if(innerWidth<=900 && window._closeSb) window._closeSb(); } }));
  spy();
}

// ── controls ──
(function(){
  const de=document.documentElement, T=['light','sepia','dark'], I={light:'◐',sepia:'☀',dark:'☾'};
  const tb=$('#themeBtn'); function cur(){return de.getAttribute('data-theme')||'light';}
  function setT(t){ if(t==='light')de.removeAttribute('data-theme'); else de.setAttribute('data-theme',t);
    try{localStorage.setItem('fr-eebo-theme',t);}catch(e){} tb.textContent=I[t]||'◐'; }
  tb.textContent=I[cur()]||'◐';
  tb.onclick=()=>setT(T[(T.indexOf(cur())+1)%3]);
  const fs=$('#fsRange'); let v=parseInt(getComputedStyle(de).getPropertyValue('--read-fs'))||20;
  fs.value=v; fs.oninput=()=>{ de.style.setProperty('--read-fs',fs.value+'px'); try{localStorage.setItem('eebo-fs',fs.value);}catch(e){} };
  // margin-notes toggle: reveal/hide all notes
  const nb=$('#notesBtn');
  if(nb) nb.onclick=()=>{ const on=$('#work').classList.toggle('notes-shown'); nb.classList.toggle('on',on); nb.title=on?'Hide the work’s margin notes':'Show the work’s own margin notes (° marks a note)'; };
  // your-notes panel (annotations) — defined in eebo-annotate.js
  const nbB=$('#nbBtn');
  if(nbB) nbB.onclick=()=>{ if(window._eeboToggleNotes) window._eeboToggleNotes(); };
  const cB=$('#citeBtn');
  if(cB) cB.onclick=()=>{ if(window.EEBO_ANNO&&EEBO_ANNO.cite) EEBO_ANNO.cite(); };
  // mobile Contents drawer
  const sb=$('#sidebar'), sc=$('#scrim'), mb=$('#menuBtn');
  function openSb(o){ if(sb)sb.classList.toggle('open',o); if(sc)sc.classList.toggle('on',o); if(mb)mb.setAttribute('aria-expanded',o?'true':'false'); }
  if(mb) mb.onclick=()=>openSb(!sb.classList.contains('open'));
  if(sc) sc.onclick=()=>openSb(false);
  addEventListener('keydown',e=>{ if(e.key==='Escape') openSb(false); });
  window._closeSb=()=>openSb(false);
})();

// ── boot ──
(async function(){
  const id=new URLSearchParams(location.search).get('id');
  if(!id){ $('#work').innerHTML='<p class="err">No work specified. <a href="/the-faith-received/library/">Back to the library ›</a></p>'; return; }
  try{ const w=await loadWork(id); render(w); window._eeboWork={id:id,meta:w.meta}; if(window.EEBO_ANNO) EEBO_ANNO.mount(window._eeboWork); }
  catch(e){ $('#work').innerHTML='<p class="err">Could not load this work ('+esc(e.message)+'). <a href="/the-faith-received/library/">Back to the library ›</a></p>';
            $('#toc').innerHTML=''; }
})();
