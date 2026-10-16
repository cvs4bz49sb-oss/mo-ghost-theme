/* Search uses the library's shelf vocabulary and published source identifiers. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FRSearch=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const shelves=[['Latin Fathers','pl'],['Greek Fathers','gf'],['Eastern Fathers','po'],['Medieval','md'],['Roman Catholic','rc'],['Continental Reformed','rf'],['English Divines','ed'],['Lutheran','lu'],['Humanism and Law','hl']].map(([label,code])=>({label,code,value:label==='Continental Reformed'?'Reformed':label}));
const str=v=>v==null?'':String(v),fold=v=>str(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/æ/g,'ae').replace(/œ/g,'oe').replace(/ſ/g,'s');
const shelf=value=>shelves.find(s=>s.value===value||s.label===value||s.code===value);
const label=value=>shelf(value)?.label||str(value);
/* What a reader is SHOWN for a shelf (MOFaithLabel in lib/faith-catalogue.js): "English Divines" prints as "English writers". `label` stays the matching/server value. */
const display=value=>{const text=label(value),L=globalThis.MOFaithLabel;return L?L.shelf(text):text;};
const confession=w=>/confessions/i.test(w?.collection||'')||/^(rc|lc|cf)-\d/.test(w?.slug||'');
function matches(w,f={}){if(!w)return !(f.author||f.work||f.workQuery||f.trad||f.collection||f.group);if(f.work&&str(w.slug)!==str(f.work))return false;if(f.trad&&(shelf(w.tradition||w.tr||w.sh)?.value||w.tradition)!==shelf(f.trad)?.value)return false;if(f.collection==='confessions'&&!confession(w))return false;if(f.group==='westminster'&&(!Array.isArray(f.groupSlugs)||!f.groupSlugs.includes(w.slug)))return false;if(f.group==='puritan'&&w.party!=='Puritan')return false;if(f.group==='anglican'&&w.party!=='Anglican')return false;if(f.author&&!fold([w.author,w.author_la,w.a,w.al].join(' ')).includes(fold(f.author)))return false;if(f.workQuery&&!fold([w.title_en,w.title,w.t].join(' ')).includes(fold(f.workQuery)))return false;return true;}
function readerLink(raw,origin='https://thefaithreceived.vercel.app'){
 try{const u=new URL(raw,origin);if(![new URL(origin).origin,typeof location==='undefined'?new URL(origin).origin:location.origin].includes(u.origin))return null;u.pathname=u.pathname.replace(/^\/the-faith-received\//,'/');if(!/^\/read(?:\.html|\/[^/]+)?\/?$/.test(u.pathname))return null;const slug=(window.frIS||function(x){return x;})(u.searchParams.get('w'))||decodeURIComponent(u.pathname.replace(/^\/read\//,''));if(!slug||slug.startsWith('/'))return null;const m=/^b(.+)-\d+$/.exec(decodeURIComponent(u.hash.slice(1)));return {slug,page:m?m[1]:null};}catch(_){return null;}
}
const readerURL=(slug,page)=>'/the-faith-received/read/?w='+encodeURIComponent(str(slug))+(page!=null&&page!==''?'#b'+encodeURIComponent(str(page))+'-0':'');
function pagefindFilters(f,rows){const filters={};if(f.trad)filters.tradition=shelf(f.trad)?.value||f.trad;if(f.collection)filters.corpus=f.collection;for(const [field,query] of [['author',f.author],['work',f.workQuery]]){if(!query)continue;const values=[...new Set(rows.filter(w=>fold(field==='author'?w.author:[w.title,w.title_en].join(' ')).includes(fold(query))).map(w=>str(field==='author'?w.author:w.title)).filter(Boolean))];if(values.length)filters[field]={any:values};}if(f.group){const titles=rows.filter(w=>matches(w,{group:f.group,groupSlugs:f.groupSlugs,work:f.work,workQuery:f.workQuery})).map(w=>w.title).filter(Boolean);filters.work={any:[...new Set(titles)]};}else if(f.work){const w=rows.find(w=>w.slug===f.work);if(w)filters.work=w.title;}return filters;}
function scriptureReference(raw,books,parseBase){const m=str(raw).trim().replace(/([A-Za-z.])(\d)/g,'$1 $2').match(/^(.+?)\s+(\d{1,3}|[ivxlcdm]+)(?:\s*[:.]\s*(\d{1,3}(?:\s*[-–,]\s*\d{1,3})*))?\s*[.;]?$/i);if(!m)return null;const ref=parseBase(m[1]+' '+m[2],books);if(!ref)return null;const verses=[];if(m[3])for(const part of m[3].split(',')){const ends=part.split(/[-–]/).map(v=>Number(v.trim())),a=ends[0],b=ends[1]??a;if(a<1||b<a||b>200||b-a>100)return null;for(let v=a;v<=b;v++)if(!verses.includes(v))verses.push(v);}return {...ref,verses,selection:m[3]?.replace(/\s+/g,'')||''};}
function scriptureRecords(data,ref){if(!data||data.slug!==ref.book||Number(data.c)!==Number(ref.ch)||!Array.isArray(data.verses))throw Error('The Scripture index does not match this passage.');const wanted=ref.verses.length?ref.verses:data.verses.map(v=>Number(v.v));if(wanted.some(v=>!data.verses.some(r=>Number(r.v)===v)))throw Error('This chapter does not contain the requested verse or range.');const rows=[],coverage=[];for(const verse of data.verses){if(!wanted.includes(Number(verse.v)))continue;if(!Array.isArray(verse.rows))throw Error('The Scripture records could not be read.');coverage.push({verse:Number(verse.v),available:verse.rows.length,indexed:Number(verse.n)||0});for(const row of verse.rows)if(row?.w&&row.p!=null)rows.push({...row,verse:Number(verse.v)});}if(!ref.verses.length)for(const row of data.ch_rows||[])if(row?.w&&row.p!=null)rows.push({...row,verse:null});return {rows,coverage,partial:coverage.some(v=>v.indexed>v.available)};}
function scriptureGroups(rows,fac,works,aliases={}){const grouped=new Map();for(const original of rows){let slug=original.w,seen=new Set();while(!works[slug]&&typeof aliases[slug]==='string'&&!seen.has(slug)&&seen.size<8){seen.add(slug);slug=aliases[slug];}const r={...original,w:slug},known=works[r.w],w=known?{...known,slug:r.w}:{slug:r.w,title:r.t,author:r.a,tradition:shelf(r.sh)?.value};if(!matches(w,fac))continue;let g=grouped.get(r.w);if(!g){g={slug:r.w,available:!!known,volume:str(w.volume),title:w.title_en||w.title||r.t||r.w,author:w.author||r.a||'',shelf:label(w.tradition||r.sh),locations:new Map()};grouped.set(r.w,g);}const p=str(r.p);let loc=g.locations.get(p);if(!loc){loc={page:p,verses:[],kinds:[]};g.locations.set(p,loc);}if(r.verse&&!loc.verses.includes(r.verse))loc.verses.push(r.verse);if(r.how&&!loc.kinds.includes(r.how))loc.kinds.push(r.how);}return [...grouped.values()].map(g=>({...g,locations:[...g.locations.values()]})).sort((a,b)=>a.author.localeCompare(b.author)||a.title.localeCompare(b.title));}
function meaningCandidates(data,works){
 if(Array.isArray(data?.results)&&!data.error){const result=[];for(const p of data.results){let slugs=[];if(p.slug)slugs=[p.slug];else if(p.doc!=null){const key=str(p.doc),prefix={pl:'pld-',pg:'pg-',po:'po-'}[data.corpus];if(prefix)slugs=[key.startsWith(prefix)?key:prefix+key];else if(data.corpus==='aq')slugs=Object.keys(works).filter(s=>s===key||s.startsWith('aq-'+key+'-'));}for(const slug of slugs)if(works[slug])result.push({slug,page:p.slug&&p.page!=null?str(p.page):null,citation:str(p.cit),excerpt:str(p.tx),score:Number(p.score)||0});}return result;}
 if(!Array.isArray(data?.bands)||data.error)throw Error('Search by idea is temporarily unavailable.');const out=[],seen=new Set();for(const original of data.bands.flatMap(b=>b.hits||[])){
 const rawCorpus=String(original.corpus||'').toUpperCase(),corpus=({PLD:'PL',AUGUSTINE:'AQ'})[rawCorpus]||rawCorpus;
 const hit={...original,corpus};
 // Cloudflare returns stable document/page identifiers; Vercel also returns legacy companion URLs.
 // Prefer stable work IDs. A vector anchor is not necessarily a printed reader page;
 // retain the citation and open the work unless an explicit page is supplied.
 if(hit.doc!=null||hit.slug){const raw=str(hit.slug||hit.doc),prefix={PL:'pld-',PG:'pg-',PO:'po-',EEBO:'eebo-'}[corpus]||'',slug=works[raw]?raw:prefix&&!raw.startsWith(prefix)?prefix+raw:raw;
  if(works[slug]){const page=hit.page??null,key=slug+'|'+(page==null?str(hit.cit):str(page));if(!seen.has(key)){seen.add(key);out.push({slug,page:page==null?null:str(page),citation:str(hit.cit),excerpt:str(hit.tx),score:Number(hit.score)||0});}continue;}}
 let candidates=[],page=null;let u;try{u=new URL(hit.link,'https://thefaithreceived.vercel.app');}catch(_){continue;}
 if(hit.corpus==='TFR'){let slug=(window.frIS||function(x){return x;})(u.searchParams.get('w'));if(slug&&!works[slug]&&/^\d+$/.test(slug)&&works['eebo-'+slug])slug='eebo-'+slug;if(slug)candidates=[slug];page=hit.page==null?readerLink(u.href)?.page:str(hit.page);}
 else if(hit.corpus==='PG'){const volume=/vol(\d+)\.html/.exec(u.pathname)?.[1],col=/^#c(\d+)/.exec(u.hash)?.[1];if(volume&&col)candidates=Object.values(works).filter(w=>w.tradition==='Greek Fathers'&&Number(str(w.volume).replace(/^PG\s*/i,''))===Number(volume)&&Array.isArray(w.cols)&&Number(w.cols[0])<=Number(col)&&Number(w.cols[1])>=Number(col)).map(w=>w.slug);}
 else {const key=decodeURIComponent(u.pathname.replace(/^\/the-faith-received/, '').split('/read/')[1]||'').replace(/\.html$/,'');if(hit.corpus==='PL')candidates=['pld-'+key];if(hit.corpus==='PO')candidates=[key.startsWith('po-')?key:'po-'+key];if(hit.corpus==='AQ')candidates=Object.keys(works).filter(s=>s===key||s.startsWith('aq-'+key+'-'));}
 for(const slug of candidates){if(!works[slug])continue;const key=slug+'|'+(page==null?str(hit.cit):page);if(seen.has(key))continue;seen.add(key);out.push({slug,page,citation:str(hit.cit).replace(/^(PG|PL|PO)\s+\1\s+/,'$1 '),excerpt:str(hit.tx),score:Number(hit.score)||0});}
 }return out.sort((a,b)=>b.score-a.score);}
function fuseMeaning(lists){const map=new Map();for(const list of lists)list.forEach((row,i)=>{const key=row.slug+'|'+(row.page??(row.citation||'')),old=map.get(key);if(old){old.score+=1/(60+i);if(!old.excerpt&&row.excerpt)old.excerpt=row.excerpt;}else map.set(key,{...row,score:1/(60+i)});});return [...map.values()].sort((a,b)=>b.score-a.score);}
function meaningGroups(rows){const groups=new Map();for(const row of rows){let group=groups.get(row.slug);if(!group){group={slug:row.slug,score:row.score,locations:[]};groups.set(row.slug,group);}group.locations.push(row);group.score=Math.max(group.score,row.score);}return [...groups.values()].sort((a,b)=>b.score-a.score);}
function pageWindow(total,page,size=10){const count=Math.max(1,Math.ceil(total/size)),current=Math.max(0,Math.min(Number(page)||0,count-1));return {page:current,pages:count,start:current*size,end:Math.min(total,(current+1)*size)};}
// KIND RANK (owner 2026-09-17: "Athanasius" listed Migne's title pages, Elenchus tables and one-page Monita as works, and On the Incarnation
// sat pages deep): an author's real works first, largest first (a 51-page treatise before a 5-page note), then short pieces, then
// Migne's editorial prefaces, then front matter. works-index rows carry kind = work | fragment | preface | apparatus (tools/works_index_kinds.py).
const KIND_RANK={work:0,fragment:1,preface:2,apparatus:3};
function workKind(w){return (w&&w.kind&&KIND_RANK[w.kind]!==undefined)?w.kind:'work';}
function kindRank(w){return KIND_RANK[workKind(w)];}
function sizeRank(w){return workKind(w)==='work'?-(Number(w&&w.n_pages)||0):0;}
function orderWorks(items,mode,works,priorities={},compareWorks=null){if(mode==='relevance')return items.slice();if(mode==='title'){const meta=item=>works[typeof item==='string'?item:item.slug]||item;return items.slice().sort((a,b)=>{const x=meta(a),y=meta(b);return (priorities[typeof a==='string'?a:a.slug]||0)-(priorities[typeof b==='string'?b:b.slug]||0)||kindRank(x)-kindRank(y)||sizeRank(x)-sizeRank(y)||str(x.author).localeCompare(str(y.author))||str(x.title_en||x.title).localeCompare(str(y.title_en||y.title));});}/* title search has no engine score: the author's works first, real works before Migne's matter, largest first */const meta=item=>works[typeof item==='string'?item:item.slug]||item;const sh=w=>shelves.findIndex(s=>s.value===shelf(w.tradition||w.shelf)?.value);
// BEST MATCH FIRST, SHELVES KEPT (2026-10-15, the owner: "ordering intuitively, correct ranking"). A shelf, and an author within
// it, stands where its best match ranks, the canonical shelf order breaking ties: "institutes" had Lactantius' seven books under
// Latin Fathers above Calvin's Institutes, seventh under Continental Reformed. With no priorities (every search but Find a work)
// this is the order it was. The books of one set keep their own order (Divine Institutes I, II, III, not largest first).
const key=i=>typeof i==='string'?i:i.slug,pr=i=>priorities[key(i)]||0,shIx=w=>{const v=sh(w);return v<0?99:v;};
const shBest=new Map(),auBest=new Map(),famPages=new Map();
// One author's parts of a set stand together, ranked by their largest volume (the Summa's eight parts, then its Supplement), each
// set in its own order (by the part in the title, else by the volume: Jeremiah Vol. 1-5); a work that is no set's part is a family
// of one, so this is "largest first" as before.
const famOf=w=>str(w.author)+'|'+((setPart(w.title_en||w.title)||{}).fam||str(w.title_en||w.title).toLowerCase());
for(const it of items){const x=meta(it),f=famOf(x);famPages.set(f,Math.max(famPages.get(f)||0,Number(x.n_pages)||0));}
const volOrder=(x,y)=>{const a=setPart(x.volume),b=setPart(y.volume);return a&&b?(a.r[0]||0)-(b.r[0]||0):0;};
const famOrder=(x,y)=>{const fx=famOf(x),fy=famOf(y);if(fx!==fy)return (famPages.get(fy)||0)-(famPages.get(fx)||0)||fx.localeCompare(fy);return setOrder(x,y)||volOrder(x,y);};
if(mode==='shelf')for(const it of items){const x=meta(it),k=shIx(x),p=pr(it),ak=k+'|'+str(x.author);if(!shBest.has(k)||p<shBest.get(k))shBest.set(k,p);if(!auBest.has(ak)||p<auBest.get(ak))auBest.set(ak,p);}
return items.slice().sort((a,b)=>{const x=meta(a),y=meta(b);
if(mode==='shelf'){const d=(shBest.get(shIx(x))||0)-(shBest.get(shIx(y))||0)||shIx(x)-shIx(y)||(auBest.get(shIx(x)+'|'+str(x.author))||0)-(auBest.get(shIx(y)+'|'+str(y.author))||0)||str(x.author).localeCompare(str(y.author));if(d)return d;}
else{const d=pr(a)-pr(b)||str(x.author).localeCompare(str(y.author));if(d)return d;}
return (mode==='shelf'?pr(a)-pr(b):0)||kindRank(x)-kindRank(y)||famOrder(x,y)||sizeRank(x)-sizeRank(y)||(compareWorks?compareWorks(x,y):0)||str(x.title_en||x.title).localeCompare(str(y.title_en||y.title))||str(x.volume).localeCompare(str(y.volume),undefined,{numeric:true});});}
// Two parts of one set: "Divine Institutes, Book IV" and "…, Book II"; "Summa Theologiae I-II, 1-70" and "… I, 50-119"; "Summa
// Contra Gentiles III" and "… I". Their numbers decide (roman parts first, I before I-II before II-II before III, then the
// question or book numbers); works of different titles, 0.
const SET_PART=/[,:;]?\s*\b(?:book|vol(?:ume)?|tomus|tome|part|pars|liber)\.?\s+(\d+|[ivxlcdm]+)\b.*$/i;
const ROMAN_TAIL=/\s+([IVXLC]+(?:-[IVXLC]+)*)(?:,\s*(\d+)(?:\s*[-\u2013]\s*(\d+))?)?$/;
const roman=r=>{const v={i:1,v:5,x:10,l:50,c:100,d:500,m:1000};let total=0;const s=str(r).toLowerCase();for(let i=0;i<s.length;i++){const c=v[s[i]],nx=v[s[i+1]]||0;total+=c<nx?-c:c;}return total;};
function setPart(t){const m=str(t).match(SET_PART);if(m)return {fam:str(t).replace(SET_PART,'').trim().toLowerCase(),r:[/^\d+$/.test(m[1])?Number(m[1]):roman(m[1])],n:[]};const k=str(t).match(ROMAN_TAIL);if(k)return {fam:str(t).replace(ROMAN_TAIL,'').trim().toLowerCase(),r:k[1].split('-').map(roman),n:[k[2],k[3]].filter(Boolean).map(Number)};return null;}
function setOrder(x,y){const a=setPart(x.title_en||x.title),b=setPart(y.title_en||y.title);if(!a||!b||a.fam!==b.fam)return 0;for(let i=0;i<Math.max(a.r.length,b.r.length);i++){if(a.r[i]===undefined)return -1;if(b.r[i]===undefined)return 1;if(a.r[i]!==b.r[i])return a.r[i]-b.r[i];}for(let i=0;i<Math.max(a.n.length,b.n.length);i++){const d=(a.n[i]||0)-(b.n[i]||0);if(d)return d;}return 0;}
// TITLE SEARCH RANK (2026-10-07, owner: "i type in regensburg in mereO and the acta of dont come up"). An author's EPITHET is not
// the author. "Othloh of Saint Emmeram in Regensburg" made nineteen of his works count as the author's own for "regensburg", and
// the Acts of the Regensburg Colloquy, the one work with Regensburg in its title, fell to page three. A word counts as the
// author's only when it is in the name before " of / in / von / de …"; a word only in the epithet ranks after title matches.
// 0 the author's own works · 1 dubia filed under that name ("Uncertain author (Augustine?)") · 2 the word is in the title ·
// 3 the word is only in an author's epithet.
function authorNamePart(a){return str(a).replace(/\([^)]*\)/g,' ').split(/\s+(?:of|in|von|van|de|da|di|du|des|der|from|at|to)\s+/i)[0];}
const DUBIA=/^(uncertain|various|anonymous|auctor|auctores)/i;
function titleRank(e,toks,foldFn=fold){
  const has=s=>{const h=foldFn(s);return toks.length>0&&toks.every(t=>h.indexOf(t)>=0);};
  const dubia=DUBIA.test(str(e&&e.a));
  if(has(authorNamePart(e.a)+' '+authorNamePart(e.al)))return dubia?1:0;
  if(dubia&&has(authorNamePart((str(e.a).match(/\(([^)]*)\)/)||[])[1]||'')))return 1;
  if(has(str(e.t)+' '+str(e.o)+' '+str(e.la)))return 2;
  return 3;
}
return {shelves,shelf,label,display,titleRank,authorNamePart,confession,matches,readerLink,readerURL,pagefindFilters,scriptureReference,scriptureRecords,scriptureGroups,meaningCandidates,fuseMeaning,meaningGroups,pageWindow,orderWorks,workKind,kindRank};
});
