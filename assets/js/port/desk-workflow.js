/* Shared reading-to-writing presentation. Existing storage remains canonical. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.FRDeskWorkflow=api;})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';
  const str=v=>v==null?'':String(v),arr=v=>Array.isArray(v)?v:[];
  const esc=v=>str(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function safeURL(value){try{const u=new URL(value,root.location?.origin||'https://thefaithreceived.vercel.app');return value&&/^https?:$/.test(u.protocol)?u.href:'';}catch(_){return '';}}
  function sourceURL(s){return safeURL(s.url||s.u||s.href)||(s.slug?'/the-faith-received/read/?w='+encodeURIComponent(s.slug)+(s.row?'#'+encodeURIComponent(s.row):s.page!=null?'#b'+encodeURIComponent(String(s.page))+'-0':''):'');}
  function citation(s){return s.cite||[s.author,s.title||s.slug,s.page!=null?'location '+s.page:''].filter(Boolean).join(', ')||sourceURL(s);}
  function readingHistory(raw){return Object.entries(raw||{}).filter(([key,r])=>r&&key!=='undefined'&&(r.slug||r.title)&&r.page!=null).map(([key,r])=>({...r,slug:r.slug||key,page:String(r.page),url:sourceURL({slug:r.slug||key,page:r.page}),author:arr(r.author).length?r.author.join(', '):str(r.author)})).sort((a,b)=>(b.ts||0)-(a.ts||0));}
  function nodeItem(node){return {id:node.savedId||undefined,type:'note',text:node.text||'',note:node.note||'',label:node.label||'',url:node.url||'',cite:node.cite||'',research:{...node.research,kind:node.kind,sources:arr(node.sources),topics:arr(node.topics),sectionTopics:arr(node.sectionTopics),authors:arr(node.authors),verses:arr(node.verses)},...(node.answer?{askAnswer:node.answer,askQuestion:node.text,askSources:arr(node.sources)}:{})};}
  function itemHTML(item){
    const kind=item.kind||item.research?.kind||(item.quoteImage?'quote-image':'note'),text=str(item.text||item.note||item.label),sources=arr(item.sources||item.research?.sources||item.askSources).slice(),quote=['passage','highlight','verse','quote-image'].includes(kind);
    const location=sourceURL(item);if(location&&!sources.length)sources.push({...item,url:location});
    let html='<'+(quote?'blockquote':'p')+'>'+esc(text).replace(/\n/g,'<br>')+'</'+(quote?'blockquote':'p')+'>';
    if(!quote)html='<p><strong>'+esc(kind==='conversation'||kind==='question'?'Research question':kind==='positions'||kind==='position'?'Recorded analysis':'Research note')+'</strong></p>'+html;
    if(item.note&&item.note!==text)html+='<p><strong>Your note</strong></p><p>'+esc(item.note).replace(/\n/g,'<br>')+'</p>';
    const answer=item.answer||item.askAnswer;if(answer)html+='<p><strong>Saved Ask answer</strong></p><p>'+esc(answer).replace(/\n/g,'<br>')+'</p>';
    if(sources.length)html+='<p><cite>'+sources.map(s=>{const url=sourceURL(s);return url?'<a href="'+esc(url)+'">'+esc(citation(s))+'</a>':esc(citation(s));}).join('<br>')+'</cite></p>';
    return html;
  }
  function legacyRow(key,item,kind){const at=key.lastIndexOf('|'),slug=item.slug||(at>=0?key.slice(0,at):''),row=item.row||(at>=0?key.slice(at+1):''),page=item.page??(row.match(/^b(.+)-\d+$/)||[])[1];return {...item,slug,row,page,kind,text:item.text||item.t||'',url:sourceURL({...item,slug,row,page})};}
  return {readingHistory,nodeItem,itemHTML,sourceURL,citation,legacyRow};
});
