/* Navigation helpers shared by Scripture and the Web. Published metadata is read only. */
(function(root){
  'use strict';
  const base='https://mo-tfr-library.mo-podcast-feed.workers.dev';
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const readerURL=(work,page)=>'/the-faith-received/read/?w='+encodeURIComponent(work)+(page!=null&&page!==''?'#b'+encodeURIComponent(String(page))+'-0':'');
  const bibleURL=(book,ch,verse,view)=>'/the-faith-received/bible/#b/'+encodeURIComponent(book)+(ch?'/'+ch:'')+((verse||view)?'?'+new URLSearchParams({...verse?{v:verse}:{},...view?{view}: {}}):'');
  const roman=s=>{let n=0,last=0;for(const c of String(s).toUpperCase().split('').reverse()){const v={I:1,V:5,X:10,L:50,C:100}[c];if(!v)return 0;n+=v<last?-v:v;last=v;}return n;};
  const aliases={genesis:['genesis','geneseos'],exodus:['exodus','exodum'],leviticus:['leviticus','leviticum'],numbers:['numbers','numeri','numeros'],deuteronomy:['deuteronomy','deuteronomium'],psalms:['psalms','psalmorum','psalter'],romans:['romans','romanos'],matthew:['matthew','matthaeum','matthaei'],mark:['mark','marcum','marci'],luke:['luke','lucam','lucae'],john:['john','joannem','ioannem'],acts:['acts','acta apostolorum'],hebrews:['hebrews','hebraeos'],james:['james','jacobi'], 'revelation-of-john':['revelation','apocalypse','apocalypsis'], 'song-of-solomon':['song of solomon','song of songs','canticles','canticum'],sirach:['sirach','ecclesiasticus'],wisdom:['wisdom','sapientia']};
  function bookMatch(title,slug){
    const normalize=s=>String(s).toLowerCase().replace(/\b(first|second|third|1|2|3)\s+(?=[a-z])/g,(_,n)=>({first:'i',second:'ii',third:'iii',1:'i',2:'ii',3:'iii'}[n])+' ').replace(/[.,:;()]/g,' ');
    const text=normalize(title);
    const names=aliases[slug]||[slug.replace(/-/g,' ')];
    // Numbered letters must not be confused with the Gospel or one another.
    if(slug==='john'&&/\b(?:[123]|i{1,3}|first|second|third)\s+(?:john|epistle)/i.test(text))return false;
    return names.some(name=>new RegExp('(?:^|\\s)'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|\\s)','i').test(text));
  }
  function locate(meta,slug,ch){
    const rows=meta.structure||[];
    if(slug==='psalms'&&ch){const ps=rows.find(r=>{const m=String(r.title||'').match(/^\s*psalm\s+([0-9]+|[IVXLC]+)\b/i);return m&&(+m[1]||roman(m[1]))===+ch&&r.page!=null;});if(ps)return {page:ps.page,kind:'chapter',heading:ps.title};}
    const starts=rows.map((r,i)=>({r,i})).filter(({r})=>bookMatch(r.title,slug)&&!/^\s*(?:chapter|caput|cap\.)\b/i.test(r.title||''));
    for(const {r,i} of starts){
      const depth=Number(r.depth)||1;
      let end=rows.findIndex((x,k)=>k>i&&(Number(x.depth)||1)<=depth);if(end<0)end=rows.length;
      if(ch){for(const x of rows.slice(i,end)){const m=String(x.title||'').match(/^\s*(?:chapter|caput|cap\.?|psalm)\s+([0-9]+|[IVXLC]+)(?:\b|\.)/i);if(m&&(+m[1]||roman(m[1]))===+ch&&x.page!=null)return {page:x.page,kind:'chapter',heading:x.title};}}
      if(r.page!=null)return {page:r.page,kind:'book',heading:r.title};
    }
    return null;
  }
  const requests=new Map();
  function json(url){if(!requests.has(url))requests.set(url,fetch(url).then(r=>{if(!r.ok)throw Error('The catalogue could not be loaded.');return r.json();}).catch(e=>{requests.delete(url);throw e;}));return requests.get(url);}
  const seriesTitle=title=>String(title||'').replace(/\s*[.,·]?\s*vol(?:ume)?\.?\s*[ivxlc0-9]+.*$/i,'').trim().toLowerCase();
  const family=slug=>String(slug).replace(/-vol-\d+.*$/,'').replace(/-(?:veteris|novi)-testamenti-/,'-testamenti-');
  const catalogue=()=>json(base+'/v1/works-index.json').then(d=>d.works||[]);
  async function volumes(entry,book,ch,citations=[]){
    let works=[];try{works=(await json(base+'/v1/works-index.json')).works||[];}catch(_){}
    const seed=works.find(w=>w.slug===entry.w);
    let group=seed?works.filter(w=>family(w.slug)===family(seed.slug)||(w.author===seed.author&&seriesTitle(w.title)===seriesTitle(seed.title))):[];
    if(!group.length)group=[{slug:entry.w,title:entry.t,author:entry.a}];
    const result=[];let cursor=0;
    await Promise.all(Array.from({length:Math.min(4,group.length)},async()=>{while(cursor<group.length){const w=group[cursor++];let meta;try{meta=await json(base+'/v1/works/'+encodeURIComponent(w.slug)+'/meta.json');}catch(_){}let hit=meta?locate(meta,book,ch):null;const cited=citations.find(r=>r.w===w.slug&&r.p!=null);if(!hit&&cited)hit={page:cited.p,kind:'citation',heading:'Indexed citation of '+book.replace(/-/g,' ')+' '+ch};result.push({...w,title:meta?.title||w.title,volume:meta?.volume||w.volume,hit,available:!!meta,citationPages:new Set(citations.filter(r=>r.w===w.slug).map(r=>String(r.p))).size});}}));
    return result.sort((a,b)=>(a.hit?.kind==='chapter'?0:a.hit?1:2)-(b.hit?.kind==='chapter'?0:b.hit?1:2)||(a.hit?.kind==='citation'&&b.hit?.kind==='citation'?b.citationPages-a.citationPages:0)||String(a.volume||a.title).localeCompare(String(b.volume||b.title),undefined,{numeric:true}));
  }
  async function renderVolumes(container,entry,book,ch,citations=[]){
    container.innerHTML='<p class="scripture-status" role="status">Finding book sections in the available volumes…</p>';
    const rows=await volumes(entry,book,ch,citations);if(!container.isConnected)return;
    const matched=rows.filter(w=>w.hit),rest=rows.filter(w=>!w.hit);
    const row=w=>'<div class="annotation-volume"><div><strong>'+escape(w.title)+'</strong>'+(w.volume?'<span>'+escape(w.volume)+'</span>':'')+'<small>'+escape(w.hit?w.hit.heading:w.available?'No matching book section in the available contents.':'The table of contents is unavailable. Browse the volume to find a passage.')+'</small></div><a href="'+readerURL(w.slug,w.hit?.page)+'" target="_blank" rel="noopener">'+(w.hit?.kind==='chapter'?'Read chapter':w.hit?.kind==='citation'?'Read cited passage':w.hit?'Read book section':'Browse volume')+'</a></div>';
    container.innerHTML=(matched.length?matched.map(row).join(''):'<p class="scripture-status">A matching section could not be located. You can browse the volumes below.</p>')+(rest.length?'<details class="annotation-other"'+(!matched.length?' open':'')+'><summary>Browse '+rest.length+' '+(matched.length?'other ':'')+'volume'+(rest.length===1?'':'s')+'</summary>'+rest.map(row).join('')+'</details>':'');
  }
  const api={escape,readerURL,bibleURL,roman,bookMatch,locate,family,catalogue,volumes,renderVolumes};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.FRScripture=api;
})(typeof window==='undefined'?globalThis:window);
