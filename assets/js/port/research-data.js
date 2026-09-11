/* Shared read-only access to published research, with bounded cache and exact source keys. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.FRResearchData=api;})(typeof window==='undefined'?globalThis:window,function(root){
'use strict';
const fallback='https://mo-tfr-library.mo-podcast-feed.workers.dev';
const aliases={'Gen':'Genesis','Ex':'Exodus','Lev':'Leviticus','Num':'Numbers','Deut':'Deuteronomy','Josh':'Joshua','Judg':'Judges','Ruth':'Ruth','1 Sam':'1 Samuel','2 Sam':'2 Samuel','1 Kgs':'1 Kings','2 Kgs':'2 Kings','1 Chr':'1 Chronicles','2 Chr':'2 Chronicles','Ezra':'Ezra','Neh':'Nehemiah','Esth':'Esther','Job':'Job','Ps':'Psalms','Prov':'Proverbs','Eccl':'Ecclesiastes','Song':'Song of Solomon','Isa':'Isaiah','Jer':'Jeremiah','Lam':'Lamentations','Ezek':'Ezekiel','Dan':'Daniel','Hos':'Hosea','Joel':'Joel','Amos':'Amos','Obad':'Obadiah','Jonah':'Jonah','Mic':'Micah','Nah':'Nahum','Hab':'Habakkuk','Zeph':'Zephaniah','Hag':'Haggai','Zech':'Zechariah','Mal':'Malachi','Matt':'Matthew','Mark':'Mark','Luke':'Luke','John':'John','Acts':'Acts','Rom':'Romans','1 Cor':'1 Corinthians','2 Cor':'2 Corinthians','Gal':'Galatians','Eph':'Ephesians','Phil':'Philippians','Col':'Colossians','1 Thess':'1 Thessalonians','2 Thess':'2 Thessalonians','1 Tim':'1 Timothy','2 Tim':'2 Timothy','Titus':'Titus','Phlm':'Philemon','Heb':'Hebrews','Jas':'James','1 Pet':'1 Peter','2 Pet':'2 Peter','1 John':'1 John','2 John':'2 John','3 John':'3 John','Jude':'Jude','Rev':'Revelation','Wis':'Wisdom','Sir':'Sirach','Tob':'Tobit','Jdt':'Judith','Bar':'Baruch','1 Macc':'1 Maccabees','2 Macc':'2 Maccabees'};
const str=v=>v==null?'':String(v), list=v=>Array.isArray(v)?v:[];
const base=()=>str(root.__FR_BLOB_BASE__||fallback).replace(/\/+$/,'');
const cache=new Map(),queue=[];let active=0;
const MAX_BYTES=24*1024*1024;
function trimCache(){let bytes=[...cache.values()].reduce((n,e)=>n+(e.size||0),0);for(const [key,e] of cache){if(bytes<=MAX_BYTES&&cache.size<=12)break;if(!e.done)continue;cache.delete(key);bytes-=e.size||0;}}
function schedule(work){return new Promise((resolve,reject)=>{queue.push({work,resolve,reject});drain();});}
function drain(){while(active<4&&queue.length){const job=queue.shift();active++;Promise.resolve().then(job.work).then(job.resolve,job.reject).finally(()=>{active--;drain();});}}
function urlFor(path){const p=str(path),b=base(),relative=p.startsWith(b+'/')?p.slice(b.length):p;if(!relative.startsWith('/v1/')||decodeURIComponent(relative.split('?')[0]).split('/').includes('..'))throw Error('Unsupported research resource');return b+relative;}
async function json(path){
 const url=urlFor(path);if(cache.has(url)){const entry=cache.get(url);cache.delete(url);cache.set(url,entry);return entry.promise;}
 const entry={done:false,size:0,promise:null};
 entry.promise=schedule(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{
   const response=await root.fetch(url,{signal:controller.signal});if(!response.ok){const error=new Error(response.status===404?'This research file is not published.':'Research could not load.');error.status=response.status;throw error;}
   const bytes=new Uint8Array(await response.arrayBuffer());let text;
   if(bytes[0]===31&&bytes[1]===139){if(!root.DecompressionStream)throw Error('This browser cannot open the compressed research file.');text=await new root.Response(new root.Blob([bytes]).stream().pipeThrough(new root.DecompressionStream('gzip'))).text();}
   else text=new TextDecoder().decode(bytes);
   const data=JSON.parse(text);entry.size=text.length*2;entry.done=true;trimCache();return data;
  }finally{clearTimeout(timer);}
 }).catch(error=>{cache.delete(url);throw error;});cache.set(url,entry);return entry.promise;
}
async function optional(path){try{return await json(path);}catch(e){if(e.status===404)return null;throw e;}}
const loadUnits=slug=>optional('/v1/mine/units/'+encodeURIComponent(str(slug))+'.json').then(d=>{if(d&&(!Array.isArray(d.units)||d.slug&&d.slug!==str(slug)))throw Error('The work analysis does not match this edition.');return d;});
const overview=slug=>optional('/v1/mine/work/'+encodeURIComponent(str(slug))+'.json');
const books=()=>json('/v1/bible/all/books.json').then(d=>{if(!Array.isArray(d?.books))throw Error('The Scripture catalogue could not load.');return d.books;});
const chapter=(book,ch)=>json('/v1/bible/all/'+encodeURIComponent(str(book))+'/'+encodeURIComponent(str(ch))+'.json.gz');
const readerURL=(slug,page)=>'/the-faith-received/read/?w='+encodeURIComponent(str(slug))+(page!==undefined&&page!==null&&page!==''?'#b'+encodeURIComponent(str(page))+'-0':'');
function verseURL(book,ch,verse,options={}){const q=new URLSearchParams();if(verse!=null&&verse!==''&&Number(verse)>0)q.set('v',str(verse));if(options.view)q.set('view',str(options.view));return '/the-faith-received/bible/#b/'+encodeURIComponent(str(book))+(ch?'/'+encodeURIComponent(str(ch)):'')+(q.size?'?'+q:'');}
function bookKey(value){return str(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/^(first|second|third|fourth|iii|ii|iv|i)\s+/,(_,s)=>({first:'1',second:'2',third:'3',fourth:'4',i:'1',ii:'2',iii:'3',iv:'4'}[s])+' ').replace(/[^a-z0-9]/g,'').replace(/^revelationofjohn$/,'revelation').replace(/^songofsongs$/,'songofsolomon').replace(/^ecclesiasticus$/,'sirach').replace(/^psalm$/,'psalms');}
function roman(s){if(!/^[ivxlcdm]+$/i.test(s))return NaN;const values={i:1,v:5,x:10,l:50,c:100,d:500,m:1000};let n=0,last=0;for(const c of s.toLowerCase().split('').reverse()){const v=values[c];n+=v<last?-v:v;last=Math.max(last,v);}return n;}
function parseReference(raw,catalogue){
 const text=str(raw).trim().replace(/^(?:cf\.?|see)\s+/i,'').replace(/\s*\([^)]*\)\s*$/,'').replace(/[.;]$/,'').trim();
 const m=text.match(/^(.+?)\s+(\d{1,3}|[ivxlcdm]+)(?:\s*[:.]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?$/i);if(!m)return null;
 const key=bookKey(m[1]),alias=Object.entries(aliases).find(([a])=>bookKey(a)===key)?.[1];
 const extra={ps:'Psalms',pss:'Psalms',mt:'Matthew',mk:'Mark',lk:'Luke',jn:'John',joh:'John',apoc:'Revelation',cant:'Song of Solomon',canticles:'Song of Solomon','1jn':'1 John','2jn':'2 John','3jn':'3 John'};
 const name=bookKey(alias||extra[key]||m[1]),matches=list(catalogue).filter(b=>bookKey(b.book)===name||bookKey(b.slug)===name);
 if(matches.length!==1||!matches[0].slug)return null;
 const ch=/^\d+$/.test(m[2])?Number(m[2]):roman(m[2]),verse=m[3]?Number(m[3]):null,endVerse=m[4]?Number(m[4]):null;
 if(!Number.isInteger(ch)||ch<1||verse!==null&&verse<1||endVerse!==null&&(endVerse<verse||endVerse-verse>100))return null;
 const chapters=list(matches[0].chapters);if(chapters.length&&!chapters.some(c=>Number(c.c)===ch))return null;
 return {book:matches[0].slug,ch,verse,...endVerse!==null?{endVerse}:{},raw:str(raw)};
}

let corpusPromise=null;
async function corpus(){
 if(!corpusPromise)corpusPromise=(async()=>{
  const warnings=[];const opt=async(path,fallback)=>{try{return await json(path);}catch(e){warnings.push({path,status:e.status||0});return fallback;}};
  const [catalogue,confessions,slugAliases,duplicates,titles]=await Promise.all([json('/v1/works-index.json'),opt('/v1/confessions-index.json',{confessions:[]}),opt('/v1/slug-aliases.json',{}),opt('/v1/dupfold.json',{}),opt('/v1/titles_en.json',{})]);
  if(!Array.isArray(catalogue?.works))throw Error('The work catalogue is unavailable.');
  const works=new Map();for(const w of [...catalogue.works,...list(confessions.confessions)])if(w?.slug&&!works.has(str(w.slug)))works.set(str(w.slug),{...w,title_en:typeof titles[w.slug]==='string'?titles[w.slug]:''});
  return {works,aliases:slugAliases,duplicates,warnings};
 })().catch(e=>{corpusPromise=null;throw e;});return corpusPromise;
}
function resolveIdentifier(identifier,index){
 const input=str(identifier),visited=new Set();let slug=input,alias=false;
 while(!index.works.has(slug)&&typeof index.aliases?.[slug]==='string'&&!visited.has(slug)&&visited.size<8){visited.add(slug);slug=index.aliases[slug];alias=true;}
 const work=index.works.get(slug);if(!work)return {status:'unresolved',input,warnings:index.warnings||[]};
 const duplicate=index.duplicates?.[slug]?.c;
 return {status:'held',input,slug,work,url:readerURL(slug),alias,...duplicate&&index.works.has(duplicate)&&duplicate!==slug?{duplicateOf:duplicate}:{},warnings:index.warnings||[]};
}
const resolveWork=async identifier=>resolveIdentifier(identifier,await corpus());
const shelfKeys=['pl','gf','po','md','rc','rf','ed','lu','hl'];let rosterPromise=null;
async function authorRooms(author){
 if(!rosterPromise)rosterPromise=Promise.all(shelfKeys.map(async sh=>{try{const d=await json('/v1/bible/'+sh+'/rooms/index.json');return {rows:list(d.authors).map(r=>({...r,sh})),failed:false};}catch(_){return {rows:[],failed:true,sh};}}));
 const parts=await rosterPromise;if(parts.some(p=>p.failed))rosterPromise=null;const key=str(author).trim().toLocaleLowerCase();let names=[key];
 try{const aliases=await json('/v1/author_aliases.json');const mapped=Object.entries(aliases).find(([a])=>a.trim().toLocaleLowerCase()===key)?.[1];if(typeof mapped==='string')names.push(mapped.trim().toLocaleLowerCase());}catch(_){}
 const matches=parts.flatMap(p=>p.rows).filter(r=>names.includes(str(r.a).trim().toLocaleLowerCase())||str(r.s)===str(author));
 return {matches,missing:parts.filter(p=>p.failed).map(p=>p.sh)};
}
const topics=()=>json('/v1/mine/topic2-all/index.json').then(d=>list(d.topics));
async function resolveTopic(label){const text=str(label).trim().toLocaleLowerCase();const matches=(await topics()).filter(t=>str(t.t).trim().toLocaleLowerCase()===text||str(t.s)===str(label));return matches.length===1?matches[0]:null;}

return {json,loadUnits,overview,books,chapter,readerURL,verseURL,parseReference,bookKey,corpus,resolveWork,resolveIdentifier,authorRooms,topics,resolveTopic};
});
