/* Explicit reading places use the existing notebook store and reader anchors. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.FRReaderBookmarks=api;})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  const text=value=>value==null?'':String(value),present=value=>value!==null&&value!==undefined&&value!=='';
  const transient=id=>/^(?:(?:fr|reader)[-_])*(?:find|search)(?:[-_]|$)|^__fr/i.test(text(id));
  const generatedHeading=id=>/^h\d+(?:-|$)/i.test(text(id));
  const sourceLocation=position=>typeof position?.sourcePath==='string'&&position.sourcePath.trim()?{sourcePath:position.sourcePath,...typeof position.sourceText==='string'?{sourceText:position.sourceText}:{},...typeof position.sourceKey==='string'&&position.sourceKey?{sourceKey:position.sourceKey}:{}}:{};
  const bodySelector='.row[id],.en[id^="b"],.la[id^="b"],.pganchor[data-page]';
  const excluded='.rapp,.appdiv,.mnote,.rowx,.footnotes,.appbank,.rv-edit,.furn';
  function canonicalNode(node,reading){
    if(!node)return null;
    const body=node.matches?.(bodySelector)?node:node.closest?.(bodySelector);
    return body&&reading.contains(body)&&!body.closest(excluded)?body:null;
  }
  function pageOf(node){
    if(present(node?.dataset?.page))return text(node.dataset.page);
    const match=/^b(.+)-\d+$/.exec(text(node?.id));
    return match?match[1]:text(node?.closest('.folio')?.dataset.page);
  }
  function capture(context={},environment=root){
    const doc=environment.document,reading=doc?.getElementById('reading'),scroll=doc?.getElementById('scroll');
    if(!reading||!scroll)throw Error('Wait for the text to appear before saving a reading place.');
    const bounds=scroll.getBoundingClientRect(),line=bounds.top+16;
    const visible=node=>node?.getClientRects().length&&node.getBoundingClientRect().bottom>line&&node.getBoundingClientRect().top<(bounds.bottom??bounds.top+scroll.clientHeight);
    let snapshot={};try{snapshot=environment.__frCaptureReaderPosition?.()||{};}catch(_){}
    const exact=canonicalNode(snapshot.id&&doc.getElementById(snapshot.id),reading);
    let node=visible(exact)?exact:Array.from(reading.querySelectorAll(bodySelector)).map(n=>canonicalNode(n,reading)).find(visible);
    if(!node)throw Error('Wait for a visible passage before saving a reading place.');
    // A Flow row can contain several page boundaries. Prefer its last preceding
    // visible-lane milestone instead of assigning later prose to the host folio.
    if(!node.matches('.pganchor[data-page]')){
      const boundaries=Array.from(node.querySelectorAll('.pganchor[data-page]')).filter(n=>n.getClientRects().length&&n.getBoundingClientRect().top<=line);
      if(boundaries.length)node=boundaries.reduce((a,b)=>a.getBoundingClientRect().top>b.getBoundingClientRect().top?a:b);
    }
    const page=pageOf(node)||text(snapshot.page),row=node.matches('.pganchor[data-page]')||!node.id||transient(node.id)||generatedHeading(node.id)?'b'+page+'-0':text(node.id);
    if(!page||transient(row))throw Error('This reading place could not be identified. Try again after the page finishes loading.');
    return {page,row,position:{page,id:row,title:typeof snapshot.title==='string'?snapshot.title:'',offset:node.getBoundingClientRect().top-bounds.top,choice:false,anchor:true,...sourceLocation(snapshot)}};
  }
  function makeRecord(context,place,environment=root){
    const slug=text(context.slug).trim(),title=text(context.title).trim();
    if(!slug||!title||!place||!present(place.page)||!place.row||transient(place.row))throw Error('The work and reading place must be identified before saving.');
    const page=text(place.page),row=generatedHeading(place.row)?'b'+page+'-0':text(place.row),origin=context.origin||environment.location?.origin||'https://thefaithreceived.vercel.app',sourcePosition=sourceLocation(place.position);
    const path=environment.location?.pathname==='/read.html'?'/read.html':'/the-faith-received/read/';
    const url=new URL(path,origin);url.searchParams.set('w',slug);url.searchParams.set('p',page);if(sourcePosition.sourcePath)url.searchParams.set('section',sourcePosition.sourcePath);if(sourcePosition.sourceKey)url.searchParams.set('heading',sourcePosition.sourceKey);url.hash=row;
    let label;try{label=context.pageLabel?.(page);}catch(_){}label=text(label)||'Location '+page;
    const citation=[title,context.volume,label].filter(Boolean).map(text).join(', '),author=text(context.author);
    const source={site:'fr',slug,page,row,url:url.href,title,author,cite:citation,...sourcePosition};
    return {id:'reading-place:'+encodeURIComponent(slug)+':'+encodeURIComponent(row)+(sourcePosition.sourcePath?':section:'+encodeURIComponent(sourcePosition.sourcePath):'')+(sourcePosition.sourceKey?':heading:'+encodeURIComponent(sourcePosition.sourceKey):''),type:'note',readingPlace:true,site:'fr',slug,page,row,
      title,work:title,author,cite:citation,url:url.href,label:'Reading place · '+label,text:'',
      readerPosition:{page,id:row,title:text(place.position?.title),offset:Number.isFinite(place.position?.offset)?place.position.offset:null,choice:false,anchor:true,...sourcePosition},
      research:{kind:'reference',sources:[source],authors:author?[author]:[],topics:[],verses:[],provenance:'A reading place explicitly saved from the visible reader.'}};
  }
  async function save(context={},environment=root){
    const notebook=environment.FRResearchNotebook;if(!notebook?.save)throw Error('Notebook saving could not load. Reload the reader and try again.');
    const record=makeRecord(context,capture(context,environment),environment);
    return notebook.save(record,{collectionId:context.collectionId});
  }
  function bind(button,options={}){
    if(!button)return ()=>{};let busy=false,saved=null;
    const feedback=value=>{if(options.feedback)options.feedback.textContent=value;};
    const onSave=async event=>{event.preventDefault();if(busy)return;busy=true;button.disabled=true;feedback('Saving reading place…');
      try{saved=await save(options.getContext?.()||{});feedback(saved.created===false?'This reading place is already saved in '+saved.collectionName+'.':'Reading place saved in '+saved.collectionName+'.');if(saved.warnings?.length)feedback('Saved in this browser. Account sync could not be confirmed.');if(options.openSavedButton)options.openSavedButton.hidden=false;}
      catch(error){feedback(error.message||'This reading place could not be saved. Please try again.');}
      finally{busy=false;button.disabled=false;}};
    const onOpen=event=>{event.preventDefault();if(saved)options.onOpenSaved?.(saved);};
    button.addEventListener('click',onSave);options.openSavedButton?.addEventListener('click',onOpen);
    return ()=>{button.removeEventListener('click',onSave);options.openSavedButton?.removeEventListener('click',onOpen);};
  }
  return {capture,makeRecord,save,bind,isTransientAnchor:transient};
});
