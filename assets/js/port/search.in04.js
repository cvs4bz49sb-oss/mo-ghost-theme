
/* reveal — gentle staggered fade-up on static furniture (family design elevation).
   Dynamic surfaces (results, ask turns) are never revealed. */
(function(){
  'use strict';
  if(!('IntersectionObserver' in window))return;
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var SEL=['.search-box','.smodes-wrap'].join(',');
  var els;
  try{els=Array.prototype.slice.call(document.querySelectorAll(SEL));}catch(e){return;}
  els=els.filter(function(el){return el.offsetWidth||el.offsetHeight;});
  if(!els.length)return;
  var io=new IntersectionObserver(function(entries){
    var seen=0;
    entries.forEach(function(en){
      if(!en.isIntersecting)return;
      en.target.style.setProperty('--rv-d',Math.min(seen*75,450)+'ms');seen++;
      en.target.classList.add('rv-in');
      io.unobserve(en.target);
    });
  },{rootMargin:'0px 0px -7% 0px',threshold:.04});
  els.forEach(function(el){el.classList.add('rv');io.observe(el);});
})();
/* SAVE TO NOTEBOOK (2026-09-10 "save works … specific passages, on all surfaces"): every result that opens the reader
   gets a star — a work (no page) or a passage (a page) — through FRResearchNotebook only. */
(function(){const N=()=>window.FRResearchNotebook;const strip=v=>String(v||'').replace(/<[^>]+>/g,'');
  const deco=root=>{(root.querySelectorAll?root.querySelectorAll('a.sr:not([data-starred])'):[]).forEach(a=>{a.dataset.starred='1';
    const m=(a.getAttribute('href')||'').match(/\/read(?:\/|\?w=)([a-z0-9-]+)(?:#b([^-]+)-\d+)?/i);if(!m)return;const slug=m[1];let page=null;try{page=m[2]?decodeURIComponent(m[2]):null;}catch(_){}
    const st=document.createElement('button');st.type='button';st.className='pinstar';st.textContent='\u2605';st.setAttribute('aria-label',page?'Save this passage to your notebook':'Save this work for later reading');st.title=st.getAttribute('aria-label');
    const on=()=>!!(N()&&N().hasReference&&N().hasReference(slug,page));const paint=()=>{st.classList.toggle('on',on());};paint();
    st.onclick=async e=>{e.preventDefault();e.stopPropagation();const n=N();if(!n||!n.saveWork){st.title='The notebook could not load.';return;}st.disabled=true;
      try{const title=typeof docTitle==='function'?strip(docTitle(slug)):slug,author=typeof docCite==='function'?strip(docCite(slug)):'';
        if(on())await n.unsave(slug,page);else if(page)await n.savePassage({slug,page,title,author,label:(a.querySelector('.sr-ex')||{}).textContent||''});else await n.saveWork({slug,title,author});}
      catch(err){st.title=(err&&err.message)||'Could not save';}finally{st.disabled=false;paint();}};
    a.style.position='relative';a.appendChild(st);});};
  window.addEventListener('fr-notebook-updated',()=>document.querySelectorAll('a.sr[data-starred] .pinstar').forEach(st=>{const a=st.closest('a');const m=(a.getAttribute('href')||'').match(/\/read(?:\/|\?w=)([a-z0-9-]+)(?:#b([^-]+)-\d+)?/i);if(!m)return;let page=null;try{page=m[2]?decodeURIComponent(m[2]):null;}catch(_){}st.classList.toggle('on',!!(N()&&N().hasReference&&N().hasReference(m[1],page)));}));
  deco(document);new MutationObserver(ms=>ms.forEach(x=>x.addedNodes.forEach(n=>{if(n.nodeType===1)deco(n);}))).observe(document.body,{childList:true,subtree:true});})();
