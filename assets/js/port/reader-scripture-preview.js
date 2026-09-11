/* Scripture previews share the reader's canonical citation parser. Text stays in place. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else{root.FRReaderScripturePreview=api;api.install();}})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const bookKey=value=>String(value||'').toLowerCase().replace(/^(iv|iii|ii|i)[.\s-]+/,(_,n)=>({i:'1',ii:'2',iii:'3',iv:'4'}[n])).replace(/[^a-z0-9]/g,'').replace(/^revelationofjohn$/,'revelation').replace(/^psalm$/,'psalms').replace(/^songofsongs$/,'songofsolomon');
  function position(rect,width,height,viewport){const edge=12,x=Math.max(edge,Math.min(rect.left,width?viewport.width-width-edge:edge)),below=rect.bottom+10,above=rect.top-height-10;return {x,y:below+height<=viewport.height-edge?below:above>=edge?above:Math.max(edge,viewport.height-height-edge)};}
  function selectedVerses(chapter,requested){const wanted=requested?.length?[...new Set(requested)]:[1,2,3],verses=[],missing=[];for(const n of wanted){const text=chapter?.verses?.[String(n)];if(typeof text==='string'&&text.trim())verses.push({n,text});else missing.push(n);}return {verses,missing:requested?.length?missing:[],excerpt:!requested?.length};}
  function chapterURL(slug,chapter,verses){const first=verses?.[0];return '/the-faith-received/bible/#b/'+encodeURIComponent(slug)+'/'+encodeURIComponent(chapter)+(first?'?v='+encodeURIComponent(first):'');}
  function commentaryURL(ref){return '/the-faith-received/search/?m=scripture&q='+encodeURIComponent(ref.book+' '+ref.chapter);}
  function install(){
    const doc=root.document,reading=doc?.getElementById('reading');if(!reading||doc.getElementById('readerScripturePreview'))return;
    const panel=doc.createElement('section');panel.id='readerScripturePreview';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','readerScriptureTitle');
    panel.innerHTML='<header><div><h2 id="readerScriptureTitle">Scripture</h2><p class="rsp-edition">English Standard Version</p></div><button type="button" class="rsp-close" aria-label="Close Scripture">Close</button></header><div class="rsp-content" aria-live="polite"></div><footer><a class="rsp-bible" target="_blank" rel="noopener" hidden>Open Bible chapter</a><a class="rsp-commentaries" target="_blank" rel="noopener">Find chapter commentaries</a></footer>';
    doc.body.appendChild(panel);
    const content=panel.querySelector('.rsp-content'),bible=panel.querySelector('.rsp-bible'),commentaries=panel.querySelector('.rsp-commentaries');
    const base=String(root.__FR_BLOB_BASE__||'https://mo-tfr-library.mo-podcast-feed.workers.dev').replace(/\/$/,'');
    let booksPromise,active=null,pinned=false,serial=0,hoverTimer,leaveTimer,suppressFocus=false;
    const chapters=new Map();
    const edition=panel.querySelector('.rsp-edition');
    const ESV_PROXY='https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/chapter/ESV/';
    const ESV_ORDER=['genesis','exodus','leviticus','numbers','deuteronomy','joshua','judges','ruth','1samuel','2samuel','1kings','2kings','1chronicles','2chronicles','ezra','nehemiah','esther','job','psalms','proverbs','ecclesiastes','songofsolomon','isaiah','jeremiah','lamentations','ezekiel','daniel','hosea','joel','amos','obadiah','jonah','micah','nahum','habakkuk','zephaniah','haggai','zechariah','malachi','matthew','mark','luke','john','acts','romans','1corinthians','2corinthians','galatians','ephesians','philippians','colossians','1thessalonians','2thessalonians','1timothy','2timothy','titus','philemon','hebrews','james','1peter','2peter','1john','2john','3john','jude','revelation'];
    async function esvChapter(book,chapterN){
      const id=ESV_ORDER.indexOf(bookKey(book))+1;if(!id)return null;
      const cacheKey='esv:'+id+'/'+chapterN;
      if(chapters.has(cacheKey))return chapters.get(cacheKey);
      try{
        const rows=await json(ESV_PROXY+id+'/'+chapterN+'/');
        if(!Array.isArray(rows)||!rows.length)return null;
        const verses={};rows.forEach(r=>{verses[String(r.verse)]=String(r.text||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();});
        const chapter={verses};chapters.set(cacheKey,chapter);
        if(chapters.size>64)chapters.delete(chapters.keys().next().value);
        return chapter;
      }catch(_){return null;}
    }
    async function json(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const response=await root.fetch(url,{signal:controller.signal});if(!response.ok)throw Error('Scripture could not load.');return await response.json();}finally{clearTimeout(timer);}}
    function books(){if(!booksPromise)booksPromise=Promise.all([json(base+'/v1/bible/asv/books.json'),json(base+'/v1/bible/all/books.json')]).then(([asv,all])=>({asv,all:Array.isArray(all?.books)?all.books:[]})).catch(error=>{booksPromise=null;throw error;});return booksPromise;}
    function queryOf(anchor){try{return anchor.dataset.scriptureRef||new URL(anchor.href,root.location.href).searchParams.get('q')||'';}catch(_){return '';}}
    function parse(anchor){return root.FRReaderScripture?.parseQuery(queryOf(anchor))||null;}
    function place(){if(panel.hidden||!active)return;if(root.innerWidth<=700){panel.style.left='0px';panel.style.top='auto';panel.style.bottom='0px';return;}panel.style.bottom='auto';const rect=active.getBoundingClientRect(),p=position(rect,panel.offsetWidth,panel.offsetHeight,{width:root.innerWidth,height:root.innerHeight});panel.style.left=p.x+'px';panel.style.top=p.y+'px';}
    function close(restore=false){serial++;clearTimeout(hoverTimer);clearTimeout(leaveTimer);panel.hidden=true;const previous=active;active=null;pinned=false;if(previous){previous.setAttribute('aria-expanded','false');if(restore&&previous.isConnected){suppressFocus=true;previous.focus({preventScroll:true});queueMicrotask(()=>{suppressFocus=false;});}}}
    async function show(anchor,pin=false){
      const ref=parse(anchor);if(!ref)return false;
      clearTimeout(hoverTimer);clearTimeout(leaveTimer);doc.dispatchEvent(new CustomEvent('fr-apparatus-open',{detail:{kind:'scripture'}}));
      if(active&&active!==anchor)active.setAttribute('aria-expanded','false');active=anchor;pinned=pin;const request=++serial;
      anchor.setAttribute('aria-haspopup','dialog');anchor.setAttribute('aria-expanded','true');
      panel.querySelector('h2').textContent=ref.query||queryOf(anchor);bible.hidden=true;commentaries.href=commentaryURL(ref);
      content.innerHTML='<p class="rsp-status" role="status">Loading passage…</p>';panel.hidden=false;place();
      try{
        const catalogue=await books();if(request!==serial)return false;
        const key=bookKey(ref.book),asvEdition=Object.entries(catalogue.asv).find(([name])=>bookKey(name)===key)?.[1],work=catalogue.all.find(b=>bookKey(b.book)===key||bookKey(b.slug)===key);
        if(work?.slug){bible.href=chapterURL(work.slug,ref.chapter,ref.verses);bible.hidden=false;}
        let chapter=await esvChapter(ref.book,ref.chapter),usedESV=!!chapter;
        if(request!==serial)return false;
        if(!chapter){
          if(!asvEdition?.path){content.innerHTML='<p>This book is not available in the preview. Open the Bible chapter for the available texts.</p>';place();return true;}
          const cacheKey=asvEdition.path+'/'+ref.chapter;chapter=chapters.get(cacheKey);
          if(!chapter){chapter=await json(base+'/v1/bible/asv/'+encodeURIComponent(asvEdition.path)+'/'+ref.chapter+'.json');if(chapter?.verses){chapters.set(cacheKey,chapter);if(chapters.size>64)chapters.delete(chapters.keys().next().value);}}
        }
        if(request!==serial)return false;
        edition.textContent=usedESV?'English Standard Version':'American Standard Version';
        const result=selectedVerses(chapter,ref.verses);
        content.innerHTML=(result.excerpt?'<p class="rsp-status">Opening verses</p>':'')+(anchor.dataset.xrefFollowing==='true'?'<p class="rsp-status">The citation continues beyond this verse. Open the chapter to read on.</p>':'')+result.verses.map(v=>'<p class="rsp-verse"><sup>'+v.n+'</sup> '+esc(v.text)+'</p>').join('')+(result.missing.length?'<p class="rsp-status">'+(result.missing.length===1?'Verse ':'Verses ')+esc(result.missing.join(', '))+' '+(result.missing.length===1?'is':'are')+' not present in this ASV chapter. The citation is kept as printed.</p>':'')+(!result.verses.length&&!result.missing.length?'<p>No verse text is available for this chapter.</p>':'');
        place();return true;
      }catch(_){if(request!==serial)return false;content.innerHTML='<p>Scripture could not load. Your place in the book is unchanged.</p><button type="button" class="rsp-retry">Retry passage</button>';content.querySelector('.rsp-retry').onclick=()=>show(anchor,pinned);place();return true;}
    }
    panel.querySelector('.rsp-close').onclick=()=>close(true);
    doc.addEventListener('click',event=>{const anchor=event.target.closest?.('a.xref');if(anchor&&reading.contains(anchor)&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&event.button===0){if(!parse(anchor))return;event.preventDefault();event.stopImmediatePropagation();if(active===anchor&&pinned)close(false);else{show(anchor,true);if(event.detail===0)panel.querySelector('.rsp-close').focus({preventScroll:true});}return;}if(!panel.hidden&&!panel.contains(event.target))close(false);},true);
    reading.addEventListener('pointerover',event=>{if(event.pointerType==='touch'||pinned)return;const anchor=event.target.closest?.('a.xref');if(!anchor||anchor.contains(event.relatedTarget))return;const ref=parse(anchor);if(ref)esvChapter(ref.book,ref.chapter);clearTimeout(leaveTimer);clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>show(anchor,false),120);});
    const leave=()=>{clearTimeout(hoverTimer);clearTimeout(leaveTimer);if(!pinned)leaveTimer=setTimeout(()=>close(false),180);};
    reading.addEventListener('pointerout',event=>{const anchor=event.target.closest?.('a.xref');if(anchor&&!anchor.contains(event.relatedTarget)&&!panel.contains(event.relatedTarget))leave();});
    reading.addEventListener('focusin',event=>{const anchor=event.target.closest?.('a.xref');if(anchor&&!suppressFocus&&!pinned)show(anchor,false);});
    reading.addEventListener('focusout',event=>{if(!panel.contains(event.relatedTarget)&&!active?.contains(event.relatedTarget))leave();});
    panel.addEventListener('pointerenter',()=>clearTimeout(leaveTimer));panel.addEventListener('pointerleave',event=>{if(!active?.contains(event.relatedTarget))leave();});
    panel.addEventListener('focusin',()=>clearTimeout(leaveTimer));panel.addEventListener('focusout',event=>{if(!panel.contains(event.relatedTarget)&&!active?.contains(event.relatedTarget))leave();});
    doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){event.preventDefault();event.stopImmediatePropagation();close(true);}},true);
    doc.addEventListener('scroll',event=>{if(!panel.hidden&&!panel.contains(event.target))close(false);},true);
    root.addEventListener('resize',place);
    (root.requestIdleCallback||setTimeout)(()=>{books().catch(()=>{});});
    doc.addEventListener('fr-apparatus-open',event=>{if(event.detail?.kind!=='scripture')close(false);});
  }
  return {bookKey,position,selectedVerses,chapterURL,commentaryURL,install};
});
