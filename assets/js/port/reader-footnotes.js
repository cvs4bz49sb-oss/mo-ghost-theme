/* One read-in-place footnote interaction for TEI anchors and legacy note marks. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else{root.FRFootnotes=api;api.install();}})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  function noteID(value){let id=String(value||'');try{id=decodeURIComponent(id);}catch(_){}return id.replace(/^#n-/,'').replace(/^#/,'').replace(/^(fn\d*)-(?:la|en)-/,'$1-');}
  function noteLabel(value){const label=String(value||'').trim();return /^(?:fn)?\d+$/i.test(label)?label.replace(/^fn/i,'').replace(/^0+(?=\d)/,''):label;}
  function position(rect,width,height,viewport){const edge=12,x=Math.max(edge,Math.min(rect.left+rect.width/2-width/2,viewport.width-width-edge)),below=rect.bottom+10,above=rect.top-height-10,y=below+height<=viewport.height-edge?below:above>=edge?above:Math.max(edge,viewport.height-height-edge);return {x,y};}
  const preferenceVersion='2026-09-09-hidden',preferenceKey='fr_notes_default_version';
  function createNotePreference(storage){
    let current;
    return {
      expanded(){if(current!==undefined)return current;current=false;try{const store=typeof storage==='function'?storage():storage;if(store.getItem(preferenceKey)!==preferenceVersion){store.setItem('fr_appx','0');store.setItem(preferenceKey,preferenceVersion);}current=store.getItem('fr_appx')==='1';}catch(_){}return current;},
      choose(all){current=!!all;try{const store=typeof storage==='function'?storage():storage;store.setItem('fr_appx',current?'1':'0');store.setItem(preferenceKey,preferenceVersion);}catch(_){}return current;}
    };
  }
  const preference=createNotePreference(()=>root.localStorage);
  // Flow can collect several existing folio banks into one section. Each toggle
  // owns only its following apparatus siblings, up to the next bank/body block.
  function bankItems(toggle){const items=[];for(let node=toggle?.nextElementSibling;node;node=node.nextElementSibling){if(node.classList.contains('apptog')||!node.classList.contains('rapp')&&!node.classList.contains('appdiv'))break;items.push(node);}return items;}
  function bankToggle(row){for(let node=row?.previousElementSibling;node;node=node.previousElementSibling){if(node.classList.contains('apptog'))return node;if(!node.classList.contains('rapp')&&!node.classList.contains('appdiv'))break;}return null;}
  function syncBank(toggle){const open=toggle.classList.contains('open'),items=bankItems(toggle);toggle.setAttribute('aria-expanded',String(open));for(const item of items)item.dataset.rfBankOpen=String(open);return items;}
  let refreshDisplay=()=>{};
  function install(){
    const doc=root.document,reading=doc?.getElementById('reading');if(!reading)return;
    const panel=doc.createElement('section');panel.id='readerFootnotePreview';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','readerFootnoteTitle');
    panel.innerHTML='<header><h2 id="readerFootnoteTitle">Footnote</h2><button type="button" class="rf-close" aria-label="Close footnote">Close</button></header><div class="rf-content"></div><footer><button type="button" class="rf-in-page">Show in page</button></footer>';
    doc.body.appendChild(panel);let active=null,pinned=false,bank=null,suppressFocus=false,timer,hideTimer,frame;
    preference.expanded();
    function paintNoteMode(){const toggles=Array.from(reading.querySelectorAll('.apptog'));let state='ondemand';if(toggles.length){const open=toggles.filter(t=>t.classList.contains('open')).length;state=open===toggles.length?'all':open?'mixed':'ondemand';}else state=preference.expanded()?'all':'ondemand';doc.getElementById('readerNotesDemand')?.setAttribute('aria-pressed',String(state==='ondemand'));doc.getElementById('readerNotesAll')?.setAttribute('aria-pressed',String(state==='all'));const status=doc.getElementById('readerNoteState');if(status)status.textContent=state==='mixed'?'Some shown':'';}
    function labelNotes(){
      reading.querySelectorAll('.rapp[data-fnid]:not([data-rf-label])').forEach(row=>{
        row.dataset.rfLabel='1';row.querySelectorAll('.fnlem').forEach(label=>{if(label.textContent.trim()===row.dataset.fnid)label.textContent=noteLabel(row.dataset.fnid);});
      });
    }
    const syncBanks=()=>reading.querySelectorAll('.apptog').forEach(syncBank);
    let modeFrame=0;refreshDisplay=()=>{if(!modeFrame)modeFrame=requestAnimationFrame(()=>{modeFrame=0;syncBanks();paintNoteMode();labelNotes();});};
    function setNoteMode(all){
      const page=doc.getElementById('pgJump')?.value,anchor=Array.from(reading.querySelectorAll('.folio')).find(f=>f.dataset.page===page),before=anchor?.getBoundingClientRect().top;
      preference.choose(all);
      reading.querySelectorAll('.apptog').forEach(toggle=>{const label=toggle.dataset.noteLabel||toggle.textContent.replace(/^(?:show |hide |hide the )/i,'');toggle.dataset.noteLabel=label;toggle.classList.toggle('open',all);toggle.setAttribute('aria-expanded',String(all));toggle.textContent=(all?'Hide ':'Show ')+label;});syncBanks();paintNoteMode();
      if(anchor)requestAnimationFrame(()=>{const delta=anchor.getBoundingClientRect().top-before,scroll=doc.getElementById('scroll');if(scroll)scroll.scrollTop+=delta;});
    }
    const demand=doc.getElementById('readerNotesDemand'),all=doc.getElementById('readerNotesAll');if(demand)demand.onclick=()=>setNoteMode(false);if(all)all.onclick=()=>setNoteMode(true);syncBanks();paintNoteMode();labelNotes();
    const refAt=node=>node?.closest?.('sup.fnref,a.fn');
    function resolve(ref){const a=ref.matches('a')?ref:ref.querySelector('a'),id=ref.dataset.fn||noteID(a?.getAttribute('href')),scope=ref.closest('.folio');if(!id)return null;
      const row=Array.from(scope?.querySelectorAll('.rapp')||[]).find(r=>r.dataset.fnid===id);
      const original=doc.getElementById('app')?.classList.contains('only-la'),first=row?.querySelector(original?'.la':'.en'),other=row?.querySelector(original?'.en':'.la');
      const lane=first?.textContent.trim()?first:other?.textContent.trim()?other:null;
      if(lane)return {id,row,lane,other:other&&other!==lane&&other.textContent.trim()?other:null};
      const raw=root.__TEINOTES?.[id];return typeof raw==='string'&&raw.trim()?{id,text:raw}:null;
    }
    function copy(source){const clone=source.cloneNode(true);clone.querySelectorAll('button,.fn-ret').forEach(e=>e.remove());clone.querySelectorAll('.fnlem').forEach(label=>{if(/^fn\d+$/i.test(source.closest('.rapp')?.dataset.fnid||'')&&noteLabel(label.textContent)===noteLabel(source.closest('.rapp')?.dataset.fnid)){if(label.nextElementSibling?.classList.contains('fnsep'))label.nextElementSibling.remove();label.remove();}});clone.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));const frag=doc.createDocumentFragment();while(clone.firstChild)frag.appendChild(clone.firstChild);return frag;}
    function place(){frame=0;if(!active||panel.hidden)return;if(root.innerWidth<=700){panel.style.left='0px';panel.style.top='auto';panel.style.bottom='0px';return;}panel.style.bottom='auto';const r=active.getBoundingClientRect();if(r.bottom<0||r.top>root.innerHeight){close(false);return;}const p=position(r,panel.offsetWidth,panel.offsetHeight,{width:root.innerWidth,height:root.innerHeight});panel.style.left=p.x+'px';panel.style.top=p.y+'px';}
    function close(restore){clearTimeout(timer);clearTimeout(hideTimer);const previous=active;panel.hidden=true;active=null;pinned=false;bank=null;if(previous){previous.removeAttribute('aria-describedby');previous.querySelector('a')?.removeAttribute('aria-describedby');if(restore&&previous.isConnected){suppressFocus=true;(previous.querySelector('a')||previous).focus?.({preventScroll:true});queueMicrotask(()=>{suppressFocus=false;});}}}
    function show(ref,pin=false){const data=resolve(ref);if(!data)return false;doc.dispatchEvent(new CustomEvent('fr-apparatus-open',{detail:{kind:'footnote'}}));clearTimeout(timer);clearTimeout(hideTimer);if(active&&active!==ref)active.removeAttribute('aria-describedby');active=ref;pinned=pin;bank=data.row;
      panel.querySelector('h2').textContent='Footnote'+(ref.textContent.trim()?' '+noteLabel(ref.textContent):'');
      const content=panel.querySelector('.rf-content');content.replaceChildren();
      if(data.lane){const text=doc.createElement('div');text.lang=data.lane.lang||'';text.appendChild(copy(data.lane));content.appendChild(text);if(data.other){const details=doc.createElement('details'),summary=doc.createElement('summary');summary.textContent=data.other.classList.contains('la')?'Read original note':'Read English note';details.appendChild(summary);const other=doc.createElement('div');other.lang=data.other.lang||'';other.appendChild(copy(data.other));details.appendChild(other);content.appendChild(details);}}
      else{const p=doc.createElement('p');p.textContent=data.text;content.appendChild(p);}
      panel.querySelector('footer').hidden=!bank;panel.hidden=false;ref.setAttribute('aria-describedby',panel.id);ref.querySelector('a')?.setAttribute('aria-describedby',panel.id);place();return true;
    }
    function scheduleHide(){clearTimeout(timer);clearTimeout(hideTimer);if(!pinned)hideTimer=setTimeout(()=>close(false),160);}
    reading.addEventListener('pointerover',e=>{if(e.pointerType==='touch'||pinned)return;const ref=refAt(e.target);if(!ref||ref.contains(e.relatedTarget))return;clearTimeout(timer);timer=setTimeout(()=>show(ref,false),100);});
    reading.addEventListener('pointerout',e=>{const ref=refAt(e.target);if(!ref||ref.contains(e.relatedTarget)||panel.contains(e.relatedTarget))return;scheduleHide();});
    reading.addEventListener('focusin',e=>{const ref=refAt(e.target);if(ref&&!pinned&&!suppressFocus)show(ref,false);});
    reading.addEventListener('focusout',e=>{if(panel.contains(e.relatedTarget)||active?.contains(e.relatedTarget))return;scheduleHide();});
    panel.addEventListener('pointerenter',()=>clearTimeout(hideTimer));panel.addEventListener('pointerleave',e=>{if(!active?.contains(e.relatedTarget))scheduleHide();});
    panel.addEventListener('focusin',()=>clearTimeout(hideTimer));panel.addEventListener('focusout',e=>{if(!panel.contains(e.relatedTarget)&&!active?.contains(e.relatedTarget))scheduleHide();});
    doc.addEventListener('click',e=>{const ref=refAt(e.target);if(ref&&reading.contains(ref)){if(active===ref&&pinned){e.preventDefault();e.stopImmediatePropagation();close(false);}else if(show(ref,true)){e.preventDefault();e.stopImmediatePropagation();if(e.detail===0)panel.querySelector('.rf-close').focus();}return;}if(!panel.hidden&&!panel.contains(e.target))close(false);},true);
    doc.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();e.stopImmediatePropagation();close(true);}},true);
    doc.addEventListener('scroll',e=>{if(panel.hidden||panel.contains(e.target))return;if(!pinned)close(false);else if(!frame)frame=requestAnimationFrame(place);},true);
    root.addEventListener('resize',()=>{if(!panel.hidden)place();});
    doc.addEventListener('fr-apparatus-open',e=>{if(e.detail?.kind&&e.detail.kind!=='footnote')close(false);});
    panel.querySelector('.rf-close').onclick=()=>close(true);
    panel.querySelector('.rf-in-page').onclick=()=>{const target=bank;if(!target)return;const toggle=bankToggle(target);close(false);if(toggle){if(!toggle.classList.contains('open'))toggle.click();syncBank(toggle);}target.classList.remove('cl');target.scrollIntoView({block:'center'});};
  }
  return {noteID,noteLabel,position,bankItems,bankToggle,syncBank,createNotePreference,defaultExpanded:()=>preference.expanded(),install,refreshDisplay:()=>refreshDisplay()};
});
