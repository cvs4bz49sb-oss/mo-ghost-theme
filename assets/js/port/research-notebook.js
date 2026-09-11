/* Shared personal-research storage. No corpus or API writes. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.FRResearchNotebook=api;})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  const str=value=>value==null?'':String(value),array=value=>Array.isArray(value)?value:[];
  const clone=value=>JSON.parse(JSON.stringify(value));
  let queue=Promise.resolve();
  function error(message,cause){const result=new Error(message);if(cause)result.cause=cause;return result;}
  function parse(store,key,fallback){let raw;try{raw=store.getItem(key);}catch(cause){throw error('Browser storage is unavailable. Your saved research has not been changed.',cause);}if(raw==null||raw==='')return clone(fallback);try{return JSON.parse(raw);}catch(cause){throw error('Saved '+key+' data could not be read. It has not been overwritten.',cause);}}
  function storage(){if(!root.localStorage)throw error('Browser storage is unavailable.');return root.localStorage;}
  function read(store=storage()){
    let collections=parse(store,'fr_collections_v1',[]);
    if(!Array.isArray(collections)||collections.some(c=>!c||!c.id||!Array.isArray(c.items)))throw error('Saved collections have an unexpected format. They have not been overwritten.');
    const migrated=!collections.length;
    if(migrated){const legacy=parse(store,'fr_pins',[]);if(!Array.isArray(legacy))throw error('Legacy saved passages have an unexpected format. They have not been overwritten.');collections=[{id:'default',name:'Reading list',items:legacy.map(item=>({...item,site:item.site||'fr'}))}];}
    let selected;try{selected=store.getItem('fr_pincol');}catch(cause){throw error('The active collection could not be read.',cause);}
    const active=collections.find(c=>c.id===selected)||collections[0];
    return {collections,activeId:active.id,migrated};
  }
  function kind(item){return str(item.research?.kind||(item.quoteImage?'quote-image':item.askTurn?'answer':item.type==='note'?'note':'passage'));}
  const itemType=item=>item.type||(item.research||item.text!=null||item.askTurn||item.quoteImage?'note':'reference');
  function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
  function fingerprint(item){return stable({type:itemType(item),kind:kind(item),site:item.site||'fr',slug:str(item.slug),page:item.page==null?'':str(item.page),row:str(item.row),text:str(item.text),note:str(item.note),cite:str(item.cite),url:str(item.url||item.u),label:str(item.label),askTurn:str(item.askTurn),research:item.research||{}});}
  function sameItem(existing,incoming){
    if(isReference(existing)&&isReference(incoming))return !!str(incoming.slug)&&refKey(existing)===refKey(incoming);
    if(itemType(existing)!==itemType(incoming)||kind(existing)!==kind(incoming))return false;
    if(incoming.id)return str(existing.id)===str(incoming.id);
    if(incoming.askTurn)return str(existing.askTurn)===str(incoming.askTurn);
    return fingerprint(existing)===fingerprint(incoming);
  }
  // REFERENCES (2026-09-10 "save works … specific passages, on all surfaces"): a saved work is a reference with
  // page==null; a saved passage is a reference with a page. Both dedupe by site|slug|page alone, so the same passage
  // saved from the desk and from a reception row (different labels) is one item, and a typeless {slug,page:null}
  // from the older /pins page is the same work as {type:'work',…}.
  const isReference=item=>itemType(item)!=='note';
  const refKey=item=>(item.site||'fr')+'|'+str(item.slug)+'|'+(item.page==null?'':str(item.page));
  const legacyItemKey=item=>item.type==='note'?'nt|'+(item.ts||0):(item.site||'fr')+'|'+item.slug+'|'+(item.page==null?'':item.page);
  const itemKey=item=>item.type==='note'&&item.id?'note|'+encodeURIComponent(kind(item))+'|'+encodeURIComponent(str(item.id)):legacyItemKey(item);
  function resolveEndpoint(collection,key){
    const items=array(collection.items),matches=str(key).startsWith('nt|')?items.filter(item=>legacyItemKey(item)===key):str(key).startsWith('id|')?items.filter(item=>str(item.id)===str(key).slice(3)):items.filter(item=>itemKey(item)===key);
    return matches.length===1?itemKey(matches[0]):null;
  }
  function resolveEdges(collection){return array(collection.edges).map((edge,index)=>{const a=edge.unresolved?null:resolveEndpoint(collection,edge.a),b=edge.unresolved?null:resolveEndpoint(collection,edge.b);return {...edge,index,a,b,resolved:!!a&&!!b,original:edge};});}
  function protectUnresolvedEdges(collection){collection.edges=resolveEdges(collection).map(edge=>edge.resolved?edge.original:{...edge.original,unresolved:true,unresolvedReason:edge.original.unresolvedReason||'An original endpoint is missing or ambiguous. Reconnect this relation explicitly.'});return collection;}
  function findItemIndex(collection,key,index){const n=Number(index);if(index!==undefined&&Number.isInteger(n)&&collection.items[n]&&itemKey(collection.items[n])===key)return n;const matches=collection.items.map((item,i)=>itemKey(item)===key?i:-1).filter(i=>i>=0);if(matches.length!==1)throw error('This saved item could not be identified uniquely. Reload the collection before editing it.');return matches[0];}
  function removeCollectionItem(collection,key,index){const at=findItemIndex(collection,key,index),edges=resolveEdges(collection);protectUnresolvedEdges(collection);collection.items.splice(at,1);collection.edges=collection.edges.filter((edge,i)=>!edges[i].resolved||edges[i].a!==key&&edges[i].b!==key);return collection;}
  function editCollectionItem(collection,key,text,index){const item=collection.items[findItemIndex(collection,key,index)];protectUnresolvedEdges(collection);if(item.type==='note')item.text=str(text);else item.note=str(text);return item;}
  function sharePayload(collection){if(!collection||!Array.isArray(collection.items))throw error('A complete collection is required.');return {v:4,format:'faith-received-collection',collection:clone(collection)};}
  function decodeShared(payload){
    if(payload?.v===4){const collection=payload.collection;if(!collection||!Array.isArray(collection.items)||collection.items.some(item=>!item||typeof item!=='object'||Array.isArray(item))||collection.edges!==undefined&&!Array.isArray(collection.edges))throw error('This collection file has an unsupported format.');return clone(collection);}
    if(!payload||!Array.isArray(payload.i))throw error('This collection link has an unsupported format.');
    const items=payload.i.map((row,index)=>{if(!Array.isArray(row))throw error('This legacy collection has an unsupported item.');return row[0]==='nt'?{type:'note',id:'shared-note-'+index,text:row[3]||'',ts:index}:row.length>=3?{site:row[0]||'fr',slug:row[1],page:row[2],label:row[3]||'',note:row[4]||''}:{slug:row[0],page:row[1]};});
    const edges=array(payload.e).map(row=>{if(!Array.isArray(row)||!Number.isInteger(row[0])||!Number.isInteger(row[1])||!items[row[0]]||!items[row[1]])return {a:'unresolved',b:'unresolved',rel:str(row?.[2]),unresolved:true};return {a:itemKey(items[row[0]]),b:itemKey(items[row[1]]),rel:str(row[2])};});
    return {name:str(payload.n)||'Shared collection',memo:str(payload.m),items,edges};
  }
  function sharePlan(collection,origin='https://thefaithreceived.vercel.app',maxLength=8000){
    const payload=sharePayload(collection),contents=JSON.stringify(payload,null,2),compact=JSON.stringify(payload),filename=(str(collection.name)||'research-collection').replace(/[^a-z0-9 -]/gi,'').slice(0,80)||'research-collection';
    if(compact.length>maxLength)return {kind:'file',contents,filename:filename+'.json',payload};
    const encoded=root.btoa(unescape(encodeURIComponent(compact))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const url=origin.replace(/\/$/,'')+'/the-faith-received/pins/#c='+encoded;
    return url.length<=maxLength?{kind:'link',url,contents,filename:filename+'.json',payload}:{kind:'file',contents,filename:filename+'.json',payload};
  }
  function id(prefix='research'){return prefix+'-'+(root.crypto?.randomUUID?root.crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));}
  function normalize(item){
    if(!item||typeof item!=='object'||Array.isArray(item))throw error('A research item is required.');
    let value;try{value=clone(item);}catch(cause){throw error('This research item could not be saved.',cause);}
    if(!value.type)value.type=itemType(value)==='note'?'note':(value.page==null||value.page===''?'work':'passage');value.text=str(value.text);if(isReference(value)){value.site=value.site||'fr';if(!str(value.slug).trim())throw error('A saved work or passage needs its work.');if(value.page===undefined)value.page=null;}
    if(value.page!=null)value.page=str(value.page);
    if(value.research){value.research={...value.research,kind:kind(value),sources:array(value.research.sources).map(source=>({...source,...source.page!=null?{page:str(source.page)}:{}})),verses:array(value.research.verses),topics:array(value.research.topics),authors:array(value.research.authors)};}
    return value;
  }
  function serializeCommit(store,key,value){let encoded;try{encoded=JSON.stringify(value);store.setItem(key,encoded);}catch(cause){throw error('This research could not be saved. Browser storage may be full; your previous saved data is unchanged.',cause);}}
  // fr_pins is a derived mirror of the ACTIVE collection's references (the reader's Ask sources and older pages read
  // it). It is rebuilt after every commit here and never written anywhere else.
  function mirrorLegacy(store=storage(),collections,activeId){
    let state;try{state=collections?{collections,activeId}:read(store);}catch(_){return false;}
    const active=state.collections.find(c=>c.id===(activeId||state.activeId))||state.collections[0];if(!active)return false;
    const refs=array(active.items).filter(i=>isReference(i)&&!i.quoteImage&&!i.askAnswer&&!i.askTurn&&(i.slug||i.u)).slice(0,300);
    // untouched when the references did not change (a note never rewrites the mirror)
    let current=null;try{current=JSON.parse(store.getItem('fr_pins')||'null');}catch(_){}
    const keys=list=>Array.isArray(list)?list.map(i=>refKey(i)).join('\n'):null;
    if(keys(Array.isArray(current)?current:[])===keys(refs))return true;   // nothing to mirror: no write at all
    try{store.setItem('fr_pins',JSON.stringify(refs));}catch(_){return false;}
    if(typeof root._frSyncPins==='function')try{root._frSyncPins(refs);}catch(_){}
    return true;
  }
  function commitSave(item,store=storage(),collectionId){
    const incoming=normalize(item),state=read(store),collection=state.collections.find(c=>c.id===(collectionId||state.activeId));
    if(!collection)throw error('This notebook no longer exists. Choose another notebook before saving.');
    const existing=collection.items.find(saved=>sameItem(saved,incoming));
    if(existing)return {item:clone(existing),collectionId:collection.id,collectionName:collection.name,created:false,warnings:[],collections:state.collections};
    const saved={...incoming,id:incoming.id||id(),ts:incoming.ts??Date.now()};
    collection.items.push(saved);serializeCommit(store,'fr_collections_v1',state.collections);mirrorLegacy(store,state.collections,state.activeId);
    // fr_pins is a legacy reference-only mirror. Notes must not replace it; all
    // legacy references were copied above when a first collection was necessary.
    return {item:clone(saved),collectionId:collection.id,collectionName:collection.name,created:true,warnings:[],collections:state.collections};
  }
  function locked(name,action){const run=()=>root.navigator?.locks?.request?root.navigator.locks.request(name,action):action();const next=queue.then(run,run);queue=next.catch(()=>{});return next;}
  function dispatch(name,detail){if(root.dispatchEvent&&root.CustomEvent)root.dispatchEvent(new root.CustomEvent(name,{detail}));}
  async function save(item,options={}){
    const result=await locked('fr-research-notebook',()=>commitSave(item,storage(),options.collectionId));
    const {collections,...publicResult}=result;
    if(result.created&&typeof root._frSyncCollections==='function')try{await root._frSyncCollections(clone(collections));}catch(_){publicResult.warnings.push('Saved in this browser, but account sync did not complete.');}
    dispatch('fr-notebook-updated',{});dispatch('fr-research-saved',publicResult);
    return publicResult;
  }
  function commitDeskDraft(payload,store=storage()){
    if(!payload||typeof payload.html!=='string')throw error('An outline is required to create a Desk draft.');
    const envelope=parse(store,'fr_docs',{v:1,docs:[]});
    if(!envelope||Array.isArray(envelope)||!Array.isArray(envelope.docs))throw error('Saved Desk documents could not be read. They have not been overwritten.');
    const draft={id:id('d'),ts:Date.now(),title:str(payload.title).trim()||'Research outline',html:payload.html,origin:'personal-research',...(payload.research?{research:clone(payload.research)}:{})};
    serializeCommit(store,'fr_docs',{...envelope,v:envelope.v||1,docs:[draft,...envelope.docs]});
    return {id:draft.id,title:draft.title,url:'/the-faith-received/desk/?doc='+encodeURIComponent(draft.id)};
  }
  function saveWork(work,options={}){const w=work||{};return save({site:w.site||'fr',type:'work',slug:str(w.slug),page:null,title:str(w.title||w.slug),author:str(w.author),volume:str(w.volume),tradition:str(w.tradition),label:'',url:w.url||'/the-faith-received/read/?w='+encodeURIComponent(str(w.slug))},options);}
  function savePassage(passage,options={}){const p=passage||{};if(p.page==null||p.page==='')throw error('A saved passage needs its page.');
    return save({site:p.site||'fr',type:'passage',slug:str(p.slug),page:str(p.page),title:str(p.title||p.slug),author:str(p.author),label:str(p.label||p.text).replace(/\s+/g,' ').trim().slice(0,240),url:p.url||'/the-faith-received/read/?w='+encodeURIComponent(str(p.slug))+'#b'+encodeURIComponent(str(p.page))+'-0',...(p.row?{row:str(p.row)}:{})},options);}
  /* every reference key across every collection — one read, for saved-state marks on long lists */
  function savedKeys(store=storage()){const out=new Set();try{read(store).collections.forEach(c=>array(c.items).forEach(i=>{if(isReference(i)&&i.slug)out.add(refKey(i));}));}catch(_){}return out;}
  const referenceKey=(slug,page,site='fr')=>refKey({site,slug,page:page==null||page===''?null:page});
  function hasReference(slug,page,site='fr',store=storage()){return savedKeys(store).has(referenceKey(slug,page,site));}
  function commitUnsave(slug,page,site,store){const state=read(store),key=referenceKey(slug,page,site);let removed=0;
    state.collections.forEach(c=>{const before=c.items.length;protectUnresolvedEdges(c);c.items=c.items.filter(i=>!(isReference(i)&&refKey(i)===key));removed+=before-c.items.length;});
    if(removed){serializeCommit(store,'fr_collections_v1',state.collections);mirrorLegacy(store,state.collections,state.activeId);}
    return {removed,collections:state.collections};}
  async function unsave(slug,page,site='fr'){const result=await locked('fr-research-notebook',()=>commitUnsave(slug,page,site,storage()));
    if(result.removed&&typeof root._frSyncCollections==='function')try{await root._frSyncCollections(clone(result.collections));}catch(_){}
    dispatch('fr-notebook-updated',{});return {removed:result.removed};}
  async function createDeskDraft(payload){const result=await locked('fr-research-desk-drafts',()=>commitDeskDraft(payload));dispatch('fr-desk-document-created',result);return result;}
  function selectCollection(collectionId,store=storage()){
    const state=read(store),collection=state.collections.find(c=>c.id===collectionId);
    if(!collection)throw error('This notebook no longer exists. Choose another notebook.');
    try{store.setItem('fr_pincol',collection.id);}catch(cause){throw error('The notebook selection could not be saved.',cause);}
    dispatch('fr-notebook-selection',{collectionId:collection.id});return clone(collection);
  }
  async function createCollection(name){
    const title=str(name).trim();if(!title)throw error('Give the notebook a name.');
    const result=await locked('fr-research-notebook',()=>{const store=storage(),state=read(store),collection={id:id('notebook'),name:title,items:[]};state.collections.push(collection);serializeCommit(store,'fr_collections_v1',state.collections);return {collection,collections:state.collections};});
    const warnings=[];if(typeof root._frSyncCollections==='function')try{await root._frSyncCollections(clone(result.collections));}catch(_){warnings.push('Saved in this browser, but account sync did not complete.');}
    dispatch('fr-notebook-updated',{});return {...clone(result.collection),warnings};
  }
  function deskURL(result,docId){return '/the-faith-received/desk/?view=research&notebook='+encodeURIComponent(result.collectionId)+'&item='+encodeURIComponent(result.item.id)+(docId?'&doc='+encodeURIComponent(docId):'');}
  function commitCollections(collections,store=storage()){
    if(!Array.isArray(collections)||!collections.length||collections.some(c=>!c?.id||!Array.isArray(c.items)))throw error('A valid notebook collection is required.');
    const next=clone(collections);next.forEach(protectUnresolvedEdges);const activeId=store.getItem('fr_pincol');serializeCommit(store,'fr_collections_v1',next);mirrorLegacy(store,next,activeId);return next;
  }
  function commitNoteEdit(collectionId,edit,store=storage()){
    const state=read(store),collection=state.collections.find(c=>c.id===collectionId);if(!collection)throw error('This notebook no longer exists. Your draft has been kept.');
    if(edit.kind==='memo'){
      if(edit.before!==undefined&&str(collection.memo)!==edit.before)throw error('These working notes changed in another view. Your draft is kept; copy it before reloading.');
      collection.memo=str(edit.text);
    }else{
      const at=findItemIndex(collection,edit.key,edit.index),item=collection.items[at],field=item.type==='note'?'text':'note';
      if(edit.before!==undefined&&str(item[field])!==edit.before)throw error('This note changed in another view. Your draft is kept; copy it before reloading.');
      editCollectionItem(collection,edit.key,edit.text,at);
    }
    commitCollections(state.collections,store);return {collections:state.collections,text:str(edit.text)};
  }
  async function editNote(collectionId,edit){
    const result=await locked('fr-research-notebook',()=>commitNoteEdit(collectionId,edit));
    dispatch('fr-notebook-updated',{});
    if(typeof root._frSyncCollections==='function')Promise.resolve().then(()=>root._frSyncCollections(clone(result.collections))).catch(()=>dispatch('fr-notebook-sync-failed',{}));
    return result;
  }
  return {save,read,kind,fingerprint,sameItem,normalize,createDeskDraft,commitSave,commitDeskDraft,selectCollection,createCollection,deskURL,itemKey,legacyItemKey,resolveEndpoint,resolveEdges,protectUnresolvedEdges,findItemIndex,removeCollectionItem,editCollectionItem,sharePayload,decodeShared,sharePlan,commitCollections,commitNoteEdit,editNote,
    saveWork,savePassage,savedKeys,hasReference,referenceKey,unsave,mirrorLegacy,isReference};
});
