/* One direct route to each research surface, without intercepting link navigation. */
(function(){
 function bind(){
  if(window.parent!==window||document.querySelector('.fr-explore'))return;
  const header=document.querySelector('.top,.ph,.topbar,header');if(!header)return;
  // QUICK LINKS (owner 2026-09-10 "add authors, scripture, topics to the header"): the three research doors sit
  // in the header itself on pages whose header lacks them (library, reader, desk, notebook, search); the
  // research pages already carry their own nav.
  const has=path=>[...header.querySelectorAll('a[href]')].some(a=>{try{return new URL(a.href).pathname.replace(/\.html$/,'')===path;}catch(_){return false;}});
  // a header that carries its own mode nav (anchor links with data-m — the
  // constellations page) already gives the reader its doors: adding the
  // quick trio there doubles Topics/Scripture in the same bar.
  if(!header.querySelector('a[data-m]')&&!(has('/the-faith-received/authors/')&&has('/the-faith-received/bible/')&&has('/the-faith-received/topics/'))){const quick=document.createElement('nav');quick.className='fr-quick';quick.setAttribute('aria-label','Research');
    quick.innerHTML=[['/the-faith-received/authors/','Authors'],['/the-faith-received/bible/','Scripture'],['/the-faith-received/topics/','Topics']].map(([h,t])=>`<a href="${h}"${location.pathname.replace(/\.html$/,'')===h?' aria-current="page"':''}>${t}</a>`).join('');header.appendChild(quick);}
  const menu=document.createElement('details');menu.className='fr-explore';
  menu.innerHTML='<summary aria-label="Explore the library">Explore</summary><nav aria-label="Library sections"><a href="/the-faith-received/library/">Library</a><a href="/the-faith-received/authors/">Authors<small>Find an author’s works</small></a><a href="/the-faith-received/bible/">Scripture<small>Find biblical commentary</small></a><a href="/the-faith-received/topics/">Topics<small>Explore theological subjects</small></a><a href="/the-faith-received/compare/">Compare authors</a><a href="/the-faith-received/web/">Constellations</a><a href="/the-faith-received/pins/">Notebooks</a><a href="/the-faith-received/desk/">Writing desk</a></nav>';
  header.appendChild(menu);
  menu.querySelectorAll('a').forEach(link=>{if(new URL(link.href).pathname===location.pathname)link.setAttribute('aria-current','page');link.addEventListener('click',()=>{menu.open=false;});});
  document.addEventListener('pointerdown',event=>{if(menu.open&&!menu.contains(event.target))menu.open=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){event.preventDefault();menu.open=false;menu.querySelector('summary').focus();}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
