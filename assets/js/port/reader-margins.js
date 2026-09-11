/* Marginalia are apparatus, not parallel-text rows. Keep every original note in
   place and expose it through a compact control after the canonical DOM renders. */
(function(){
  'use strict';
  const root=document.getElementById('reading');if(!root)return;
  const sheet=document.createElement('section');sheet.id='readerMarginPopover';
  sheet.setAttribute('popover','auto');sheet.setAttribute('role','dialog');sheet.setAttribute('aria-labelledby','readerMarginTitle');
  sheet.innerHTML='<header class="rm-panel-head"><div><h2 id="readerMarginTitle">Margin notes</h2><p class="rm-context"></p></div><button type="button" class="rm-close" aria-label="Close margin notes">Close</button></header><div class="rm-panel-body"></div>';
  document.body.appendChild(sheet);
  const native=typeof sheet.showPopover==='function';let active=null,queued=false;
  const eligible=note=>!!note.textContent.trim()&&!note.matches('.headnote,.edinl')&&!note.closest('.edblock');
  const notesIn=host=>host.matches('.mnote')?[host]:Array.from(host.children).filter(e=>e.matches('.mnote')&&eligible(e));
  function sourcePage(node){
    const row=node.closest('.row[id]');
    let page=(row?.id.match(/^b(.+)-\d+$/)||[])[1]||node.closest('.folio')?.dataset.page;
    const lane=node.closest('.en,.la,.stk-en,.stk-la');
    if(lane)for(const anchor of lane.querySelectorAll('.pganchor[data-page]')){
      // A continuous section can contain several original page boundaries.
      if(anchor.compareDocumentPosition(node)&4)page=anchor.dataset.page;
    }
    return page;
  }
  function close(restore=true){if(native){if(sheet.matches(':popover-open'))sheet.hidePopover();}else sheet.classList.remove('rm-open');if(active){active.setAttribute('aria-expanded','false');if(restore&&active.isConnected)active.focus({preventScroll:true});}}
  function open(button,host){
    const notes=notesIn(host);if(!notes.length)return;document.dispatchEvent(new CustomEvent('fr-apparatus-open',{detail:{kind:'margin'}}));
    if(active&&active!==button)active.setAttribute('aria-expanded','false');active=button;
    const first=notes[0],page=sourcePage(first),language=first.closest('.en,.stk-en')?'English':window.__SRCNAME||'Original text';
    sheet.querySelector('.rm-context').textContent=[page!=null?'Page '+page:'',language,notes.length+' '+(notes.length===1?'note':'notes')].filter(Boolean).join(' · ');
    const body=sheet.querySelector('.rm-panel-body');body.replaceChildren();
    for(const note of notes){const article=document.createElement('article');article.className='rm-note';article.lang=note.closest('[lang]')?.lang||'';
      for(const child of note.childNodes)article.appendChild(child.cloneNode(true));
      article.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
      article.querySelectorAll('a[href]').forEach(a=>{try{if(!['http:','https:'].includes(new URL(a.getAttribute('href'),location.href).protocol))a.removeAttribute('href');}catch(_){a.removeAttribute('href');}});
      body.appendChild(article);
    }
    button.setAttribute('aria-expanded','true');
    if(native){if(!sheet.matches(':popover-open'))sheet.showPopover({source:button});}else sheet.classList.add('rm-open');
    sheet.querySelector('.rm-close').focus({preventScroll:true});
  }
  function marker(host,notes,inline){
    let button=inline?host.previousElementSibling:host.querySelector(':scope > .rm-marker');
    if(!button?.matches('.rm-marker')){button=document.createElement('button');button.type='button';button.className='rm-marker'+(inline?' rm-inline':'');button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',sheet.id);button.setAttribute('aria-expanded','false');button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();open(button,host);});if(inline)host.before(button);else host.prepend(button);}
    const label=notes.length===1?'Margin note':'Margin notes';const count=notes.length>1?' '+notes.length:'';
    let full=button.querySelector('.rm-marker-label');
    if(!full){full=document.createElement('span');full.className='rm-marker-label';const compact=document.createElement('span');compact.className='rm-marker-compact';compact.setAttribute('aria-hidden','true');compact.textContent='note';button.replaceChildren(full,compact);}
    if(full.textContent!==label+count)full.textContent=label+count;
    const page=sourcePage(host);
    button.setAttribute('aria-label','Read '+label.toLowerCase()+(page!=null?' on page '+page:'')+(notes.length>1?', '+notes.length+' notes':''));
    button.title=button.getAttribute('aria-label');
    notes.forEach(note=>note.classList.add('rm-original'));
  }
  function enhance(){queued=false;
    root.querySelectorAll('.mnp:not(.edblock)').forEach(host=>{const notes=notesIn(host);if(!notes.length||host.querySelector('.headnote,.edinl'))return;marker(host,notes,false);host.classList.add('rm-group');});
    root.querySelectorAll('.mnote').forEach(note=>{if(!eligible(note)||note.parentElement.classList.contains('rm-group'))return;marker(note,[note],true);});
  }
  sheet.querySelector('.rm-close').onclick=()=>close(true);
  document.addEventListener('fr-apparatus-open',e=>{if(e.detail?.kind&&e.detail.kind!=='margin')close(false);});
  sheet.addEventListener('toggle',e=>{if(e.newState==='closed'&&active)active.setAttribute('aria-expanded','false');});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(!native&&sheet.classList.contains('rm-open')||native&&sheet.matches(':popover-open'))){e.preventDefault();e.stopImmediatePropagation();close();}},true);
  if(!native)document.addEventListener('pointerdown',e=>{if(sheet.classList.contains('rm-open')&&!sheet.contains(e.target)&&!e.target.closest('.rm-marker')){sheet.classList.remove('rm-open');active?.setAttribute('aria-expanded','false');}});
  document.documentElement.classList.add('fr-margin-notes');enhance();
  new MutationObserver(records=>{if(queued||!records.some(r=>Array.from(r.addedNodes).some(n=>n.nodeType===1&&(n.matches('.mnote,.mnp')||n.querySelector('.mnote')))))return;queued=true;requestAnimationFrame(enhance);}).observe(root,{childList:true,subtree:true});
})();
