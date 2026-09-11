/* Contents view state belongs to the reader UI; source order and targets stay intact. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.FRReaderContents=api;})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  const controllers=new WeakMap(),states=new Map();
  const text=value=>value==null?'':String(value);
  const fold=value=>text(value).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
  function hash(value){let a=2166136261,b=2246822507;for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);a=Math.imul(a^c,16777619)>>>0;b=Math.imul(b^c,2246822519)>>>0;}return a.toString(16)+':'+b.toString(16);}
  function model(items,parents=[]){
    const keys=[],digests=[],duplicate=new Map(),hasChildren=items.map(()=>false);
    const ancestry=items.map((_,i)=>Number.isInteger(parents[i])&&parents[i]>=0&&parents[i]<i?parents[i]:-1);
    const search=items.map(item=>fold([item.title,item.navFullTitle,item.navSourceText].filter(Boolean).join(' ')));
    for(let i=0;i<items.length;i++){
      const item=items[i],parent=ancestry[i];if(parent>=0)hasChildren[parent]=true;
      const base=JSON.stringify([parent>=0?digests[parent]:'',text(item.page),text(item.navSourcePath),text(item.navSourceKey),text(item.navSourceText),text(item.navFullTitle||item.title)]);
      const count=duplicate.get(base)||0;duplicate.set(base,count+1);keys.push(base+'|'+count);digests.push(hash(keys[i]));
    }
    return {items,parents:ancestry,hasChildren,keys,search};
  }
  function filtered(tree,query,expanded=new Set(),filterCollapsed=new Set()){
    const tokens=[...new Set(fold(query).split(' ').filter(Boolean))],searching=tokens.length>0,n=tree.items.length;
    const matches=tree.search.map(value=>!searching||tokens.every(token=>value.includes(token))),eligible=matches.slice(),visible=new Array(n),collapsed=new Array(n),children=new Array(n).fill(false);
    if(searching)for(let i=n-1;i>=0;i--)if(eligible[i]&&tree.parents[i]>=0)eligible[tree.parents[i]]=true;
    for(let i=0;i<n;i++)if(eligible[i]&&tree.parents[i]>=0)children[tree.parents[i]]=true;
    for(let i=0;i<n;i++){
      const parent=tree.parents[i];collapsed[i]=tree.hasChildren[i]&&(searching?filterCollapsed.has(tree.keys[i]):!expanded.has(tree.keys[i]));
      visible[i]=eligible[i]&&(parent<0||visible[parent]&&!collapsed[parent]);
    }
    return {visible,collapsed,children,matches,searching,count:matches.reduce((n,yes)=>n+(yes?1:0),0)};
  }
  function currentIndex(items,pages,page,choice={}){
    choice=choice||{};let candidates=[];
    if(choice.sourcePath!=null&&text(choice.sourcePath).trim()){
      for(let i=0;i<items.length;i++)if(text(items[i].navSourcePath)===text(choice.sourcePath))candidates.push(i);
      if(choice.sourceKey!=null){const exact=candidates.filter(i=>text(items[i].navSourceKey)===text(choice.sourceKey));if(exact.length)candidates=exact;else candidates=[];}
      if(choice.sourceText&&candidates.length>1){const exact=candidates.filter(i=>fold(items[i].navSourceText)===fold(choice.sourceText));if(exact.length)candidates=exact;}
      if(choice.title&&candidates.length>1){const exact=candidates.filter(i=>fold(items[i].title)===fold(choice.title)||fold(items[i].navFullTitle)===fold(choice.title));if(exact.length)candidates=exact;}
      if(candidates.length)return candidates[0];
    }
    const wanted=text(choice.page??page);
    if(choice.title){const named=items.findIndex(item=>text(item.page)===wanted&&(fold(item.title)===fold(choice.title)||fold(item.navFullTitle)===fold(choice.title)));if(named>=0)return named;}
    const order=new Map();for(const entry of pages||[]){const key=text(entry&&typeof entry==='object'?entry.n??entry.page:entry);if(!order.has(key))order.set(key,order.size);}
    const at=order.get(wanted);let best=-1,bestOrder=-1;
    for(let i=0;i<items.length;i++){
      const key=text(items[i].page),rank=order.get(key);
      if(at==null){if(key===wanted)best=i;continue;}
      if(rank!=null&&rank<=at&&rank>=bestOrder){best=i;bestOrder=rank;}
    }
    return best;
  }
  function getState(key){
    if(states.has(key))return states.get(key);let stored={};
    try{const data=JSON.parse(root.sessionStorage?.getItem('fr_contents_v1:'+encodeURIComponent(key))||'{}');if(data.v===1)stored=data;}catch(_){}
    const state={expanded:new Set(Array.isArray(stored.expanded)?stored.expanded.filter(k=>typeof k==='string'):[]),query:typeof stored.query==='string'?stored.query:'',scroll:0,focus:null,pending:false};states.set(key,state);return state;
  }
  function persist(key,state){try{root.sessionStorage?.setItem('fr_contents_v1:'+encodeURIComponent(key),JSON.stringify({v:1,query:state.query,expanded:[...state.expanded]}));}catch(_){} }
  function capture(nav){return controllers.get(nav)?.capture()||null;}
  function highlight(nav,index){return controllers.get(nav)?.highlight(index)??-1;}
  function bind(options){
    const {nav,items,rows,parents,key,onCurrent}=options;if(!nav||!Array.isArray(items)||!Array.isArray(rows)||rows.length!==items.length)throw Error('Contents rows must match their source inventory.');
    const previous=controllers.get(nav);if(previous){if(!previous.hasCaptured())previous.capture();previous.destroy();}
    const doc=nav.ownerDocument||root.document,state=getState(text(key)),tree=model(items,parents),keyIndex=new Map(tree.keys.map((key,i)=>[key,i]));
    state.expanded=new Set([...state.expanded].filter(key=>keyIndex.has(key)));
    const carets=rows.map(row=>row.querySelector('button.cv')),links=rows.map(row=>row.querySelector('.nav-open')||row.querySelector('.nn-t')||row);
    const targets=new Map();carets.forEach((node,i)=>{if(node)targets.set(node,{kind:'caret',key:tree.keys[i]});});links.forEach((node,i)=>targets.set(node,{kind:'link',key:tree.keys[i]}));
    const filterCollapsed=new Set(),listeners=[];let view,destroyed=false,active=-1,painted=-1,composing=false,queued=false,queryVersion=0,queryFrame=null;
    const frame=callback=>(root.requestAnimationFrame||((fn)=>fn()))(callback);
    const create=(tag,className,label)=>{const node=doc.createElement(tag);if(className)node.className=className;if(label)node.textContent=label;return node;};
    const tools=create('div','rc-contents-tools'),queryRow=create('div','rc-contents-query'),label=create('label','rc-contents-label'),labelText=create('span','rc-contents-sr','Find a section in the contents'),input=create('input'),clear=create('button','rc-contents-clear','Clear');
    input.type='search';input.placeholder='Search contents';input.autocomplete='off';input.spellcheck=false;input.value=state.query;input.setAttribute('aria-label','Find a section in the contents');clear.type='button';label.appendChild(labelText);label.appendChild(input);queryRow.appendChild(label);queryRow.appendChild(clear);tools.appendChild(queryRow);
    const actions=create('div','rc-contents-actions'),expand=create('button','','Expand all'),collapse=create('button','','Collapse all'),current=create('button','','Show current'),count=create('p','rc-contents-count'),empty=create('p','rc-contents-empty','No headings match this search.');current.setAttribute('aria-label','Show current section');
    for(const button of [expand,collapse,current]){button.type='button';actions.appendChild(button);}count.setAttribute('role','status');count.setAttribute('aria-live','polite');tools.appendChild(actions);tools.appendChild(count);tools.appendChild(empty);
    const hasBranches=tree.hasChildren.some(Boolean);expand.hidden=collapse.hidden=!hasBranches;
    const showTools=items.length>8||hasBranches||!!state.query;
    if(showTools)nav.insertBefore(tools,rows[0]||null);
    const tabs=nav.querySelector('.nav-vt'),measureTabs=()=>tools.style.setProperty('--rc-tabs-height',Math.ceil(tabs?.getBoundingClientRect().height||0)+'px');measureTabs();
    const resize=tabs&&root.ResizeObserver?new root.ResizeObserver(measureTabs):null;if(resize)resize.observe(tabs);
    function listen(node,type,handler){node.addEventListener(type,handler);listeners.push(()=>node.removeEventListener(type,handler));}
    function readCurrent(){try{const index=onCurrent?.();return Number.isInteger(index)&&index>=0&&index<rows.length?index:-1;}catch(_){return -1;}}
    function markCurrent(index){
      active=Number.isInteger(index)&&index>=0&&index<rows.length?index:-1;current.disabled=active<0;
      let visible=active;while(visible>=0&&!view?.visible[visible])visible=tree.parents[visible];
      if(painted!==visible){if(painted>=0){rows[painted].classList.remove('on','rc-current-ancestor');links[painted].removeAttribute('aria-current');}painted=visible;}
      if(painted>=0){rows[painted].classList.add('on');rows[painted].classList.toggle('rc-current-ancestor',painted!==active);links[painted].setAttribute('aria-current','location');}
      return painted;
    }
    function refresh(){
      if(destroyed)return;view=filtered(tree,state.query,state.expanded,filterCollapsed);
      for(let i=0;i<rows.length;i++){
        const hidden=!view.visible[i];if(rows[i].hidden!==hidden)rows[i].hidden=hidden;
        if(rows[i].classList.contains('nd-hidden')!==hidden)rows[i].classList.toggle('nd-hidden',hidden);
        rows[i].classList.toggle('collapsed',view.collapsed[i]);rows[i].classList.toggle('rc-query-match',view.searching&&view.matches[i]);
        const caret=carets[i];if(caret){caret.hidden=view.searching&&!view.children[i];caret.setAttribute('aria-expanded',String(!view.collapsed[i]&&!caret.hidden));caret.setAttribute('aria-label',(view.collapsed[i]?'Expand ':'Collapse ')+(caret.dataset.label||text(items[i].title)));}
      }
      clear.hidden=!state.query;empty.hidden=!view.searching||view.count>0;count.textContent=view.searching?view.count+' matching '+(view.count===1?'heading':'headings'):items.length+' contents '+(items.length===1?'entry':'entries');
      markCurrent(active<0?readCurrent():active);
    }
    function setQuery(value){queryVersion++;queued=false;if(queryFrame!=null)root.cancelAnimationFrame?.(queryFrame);queryFrame=null;state.query=text(value);input.value=state.query;filterCollapsed.clear();persist(text(key),state);refresh();}
    function expandAll(open){if(view.searching){filterCollapsed.clear();if(!open)tree.keys.forEach((key,i)=>{if(tree.hasChildren[i])filterCollapsed.add(key);});}else{state.expanded.clear();if(open)tree.keys.forEach((key,i)=>{if(tree.hasChildren[i])state.expanded.add(key);});persist(text(key),state);}refresh();}
    function showCurrent(){const index=readCurrent();if(index<0)return;state.query='';input.value='';filterCollapsed.clear();for(let p=tree.parents[index];p>=0;p=tree.parents[p])state.expanded.add(tree.keys[p]);active=index;persist(text(key),state);refresh();rows[index].scrollIntoView({block:'nearest'});links[index].focus({preventScroll:true});}
    carets.forEach((caret,i)=>{if(!caret)return;const handler=event=>{event.preventDefault();event.stopPropagation();const selected=view.searching?filterCollapsed:state.expanded,key=tree.keys[i];selected.has(key)?selected.delete(key):selected.add(key);if(!view.searching)persist(text(options.key),state);refresh();};caret.onclick=handler;listeners.push(()=>{if(caret.onclick===handler)caret.onclick=null;});});
    listen(input,'compositionstart',()=>{composing=true;});listen(input,'compositionend',()=>{composing=false;setQuery(input.value);});
    listen(input,'input',event=>{if(composing||event.isComposing)return;state.query=input.value;if(queued)return;queued=true;const version=++queryVersion;queryFrame=frame(()=>{if(destroyed||version!==queryVersion)return;queryFrame=null;setQuery(input.value);});});
    listen(input,'keydown',event=>{if(event.isComposing||composing||event.keyCode===229||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;if(event.key==='Escape'&&input.value){event.preventDefault();event.stopPropagation();setQuery('');}else if(event.key==='ArrowDown'||event.key==='Enter'){
      if(event.key==='Enter'&&!input.value.trim())return;
      // Key activation can beat the queued filter frame. Resolve the latest input
      // first, and invalidate the old frame so it cannot restore a stale view.
      if(queued||state.query!==input.value)setQuery(input.value);
      const index=view.matches.findIndex((match,i)=>match&&view.visible[i]);if(index>=0){event.preventDefault();event.stopPropagation();if(event.key==='Enter')links[index].click();else{rows[index].scrollIntoView({block:'nearest'});links[index].focus({preventScroll:true});}}
    }});
    listen(clear,'click',()=>{setQuery('');input.focus({preventScroll:true});});listen(expand,'click',()=>expandAll(true));listen(collapse,'click',()=>expandAll(false));listen(current,'click',showCurrent);
    const controller={tree,input,tools,setQuery,expandAll,showCurrent,highlight:markCurrent,hasCaptured:()=>state.pending,
      capture(){state.query=input.value;state.scroll=nav.scrollTop;const focused=doc.activeElement;state.focus=focused===input?{kind:'query',start:input.selectionStart,end:input.selectionEnd,direction:input.selectionDirection}:targets.get(focused)||null;state.pending=true;persist(text(key),state);return {query:state.query,scroll:state.scroll,focus:state.focus,expanded:[...state.expanded]};},
      destroy(){destroyed=true;resize?.disconnect();listeners.forEach(stop=>stop());tools.remove();if(controllers.get(nav)===controller)controllers.delete(nav);}};
    controllers.set(nav,controller);refresh();
    if(state.pending){const saved={scroll:state.scroll,focus:state.focus},focused=doc.activeElement;state.pending=false;frame(()=>{if(destroyed)return;nav.scrollTop=saved.scroll;if(doc.activeElement!==focused)return;let target=saved.focus?.kind==='query'?input:saved.focus?((saved.focus.kind==='caret'?carets:links)[keyIndex.get(saved.focus.key)]):null;if(target?.getClientRects().length){target.focus({preventScroll:true});if(target===input&&Number.isInteger(saved.focus.start))try{input.setSelectionRange(saved.focus.start,saved.focus.end,saved.focus.direction);}catch(_){}}});}
    return controller;
  }
  return {bind,capture,highlight,currentIndex,model,filtered,itemsFor:nav=>controllers.get(nav)?.tree.items||null};
});
