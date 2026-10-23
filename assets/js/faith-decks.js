/* Commentary decks: ported from The Faith Received (tools/prdl_reader_prototype/decks.html); the data from the library worker, links into the reader on this site. */
window.__FR_BLOB_BASE__=window.__FR_BLOB_BASE__||"https://mo-tfr-library.mo-podcast-feed.workers.dev";
window.__FR_READER_PATH__=window.__FR_READER_PATH__||"/the-faith-received/read/";
window.__FR_LEXICON_PATH__=window.__FR_LEXICON_PATH__||"/the-faith-received/lexicon/";
window.__FR_CONTROVERSIES_PATH__=window.__FR_CONTROVERSIES_PATH__||"/the-faith-received/controversies/";
window.__FR_MAPS_PATH__=window.__FR_MAPS_PATH__||"/the-faith-received/maps/";
window.__FR_ATLAS_PATH__=window.__FR_ATLAS_PATH__||"/the-faith-received/disputed-questions/";
window.__FR_DECKS_TEXT__=window.__FR_DECKS_TEXT__==null?"":window.__FR_DECKS_TEXT__;
const BLOB=(window.__FR_BLOB_BASE__||"").replace(/\/$/,"");
const VER=window.__FR_VER?(`?v=${window.__FR_VER}`):"";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ROMAN=n=>{const m=[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];let o='';for(const [v,s] of m)while(n>=v){o+=s;n-=v;}return o;};
const PARTS=[['Ia','First Part'],['I-II','First Part of the Second'],['II-II','Second Part of the Second'],['III','Third Part']];
// the Decretum's four runs of places: the distinctions of Part I, the causae of Part II, De penitentia (inside C. 33) and De consecratione
const DECRETUM=[['D','Distinctions','Distinctio'],['C','Causae','Causa'],['DP','De penitentia','De penitentia, Distinctio'],['DC','De consecratione','De consecratione, Distinctio']];
const FIRST={sentences:'1',summa:'Ia',decretals:'1',decretum:'D',systems:'I'};
const TEXTNAME={sentences:"Lombard's text",summa:"Aquinas's text",decretals:"The Decretals",decretum:"Gratian's text",systems:"The place (no common text)"};
const DECKNAME={sentences:"Lombard's Sentences",summa:"Aquinas's Summa",decretals:"the Decretals",decretum:"Gratian's Decretum",systems:"the systems of theology"};
// the traditions in a fixed order; a work's own (works-index) decides
const TRADS=['Greek Fathers','Latin Fathers','Medieval','Roman Catholic','Lutheran','Reformed','Continental Reformed','English Divines'];
// the group a work is listed under: a medieval author on a Fathers shelf (Hugh of St Victor in the Patrologia) is Medieval; on the Summa an author born before Aquinas (1225) is an earlier system treating the question, not a commentator
function groupOf(c){const y=+c.y||9999,tr=TRADS.includes(c.tr)?c.tr:S.deck==='metaphysics'?(TRADS.find(t=>String(c.tr||'').startsWith(t))||'Other'):'Other',early=y<9999&&(tr==='Medieval'||/Fathers$/.test(tr));if(S.deck==='summa'&&early&&y<1225)return 'Before Aquinas';if(early&&y>=600&&/Fathers$/.test(tr))return 'Medieval';return tr;}
const GROUPS=()=>(S.deck==='summa'?['Before Aquinas']:[]).concat(TRADS,['Other']);
const byGroup=list=>GROUPS().map(t=>[t,list.filter(c=>groupOf(c)===t)]).filter(([,g])=>g.length);
// a commentator's place is read here up to this many pages; the reader has the rest
const MAXP=50;
// MereO hosts the same page with its own reader path (window.__FR_READER_PATH__ = '/the-faith-received/read/') and data address.
// at= names the heading the link means: the reader opens on it, not on the top of its page.
const READER=(window.__FR_READER_PATH__||'/read');
const read=(slug,page,at)=>`${READER}?w=${encodeURIComponent(slug)}${at?`&at=${encodeURIComponent(String(at).slice(0,200))}`:''}${page!=null&&page!==''?`#b${encodeURIComponent(page)}-0`:''}`;
// A file the library has not got (404) is null. A file it could not be asked for (the network, a 5xx, a 429) is tried again twice,
// then recorded in FRDecksNet.failed, so a pane says it did not load and offers a retry, and the miss is not kept (memo below).
const NET=window.FRDecksNet={failed:new Map()};
const getJ=u=>{let n=0;const go=()=>fetch(u).then(r=>{if(r.ok)return r.json();if(r.status===404||r.status===410)return null;throw new Error(String(r.status));})
  .catch(()=>{if(++n<3)return new Promise(res=>setTimeout(res,350*n)).then(go);NET.failed.set(u,Date.now());return null;});return go();};
const J=u=>getJ(BLOB+u);
const noText=()=>(PL.failed?retryNote('This text did not load.'):`<p class="note">The library has no text for this ${noun()} yet.</p>`);
const retryNote=(msg,extra='')=>`<p class="note err" role="alert">${msg} <button type="button" class="retry" data-retry>Try again</button>${extra}</p>`;
const memo=(m,k,make)=>{if(!m.has(k)){const p=make();m.set(k,p);p.then(v=>{if(v==null&&m.get(k)===p)m.delete(k);});}return m.get(k);};
const fold=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
let S={deck:'sentences',part:'1',place:null,art:null,r:null,i:null,l:null,j:null},D=null,LANE='en';
try{LANE=localStorage.getItem('fr_deck_lane')||'en';}catch(_){}
if(!['en','la','both'].includes(LANE))LANE='en';
const canon=k=>((D.canon||{})[k])||{titles:[],places:[],landings:{}};
function noun(){return GD()?GRID[S.deck].noun:{sentences:'distinction',summa:'question',decretals:'title',decretum:S.part==='C'?'causa':'distinction',systems:'place'}[S.deck];}
const SYS=()=>S.deck==='systems';
const WHO=()=>GD()?GRID[S.deck].many:SYS()?'systems':'commentators';
// THE REFORMED, VITRINGA AND LUTHERAN DECKS (2026-10-22, owner: "voetius and vitringa and saumur and sedan i am referring to like its own
// reformed deck alongside aquinas, same with lutherans"). Each is a grid in the systems' shape (v1/decks/<deck>/grid.json: the works on
// each place, _parts, _places, _works, a machine preview "pv" on some rows) with a base text on the left, the place's read file
// (v1/decks/read/<deck>/<part>/<place>.json; a long place in chunks, <place>~k.json): the pages of Voetius's Syllabus problematum (the
// Reformed deck's spine since 2026-10-22, its places the Syllabus's titles), Vitringa's chapter with its aphorisms numbered and Martin
// Vitringa's notes behind their marks, Gerhard's locus or Calov's (?alt=calov). A place key is unique only inside its part: Vitringa's
// chapter XXIV runs over parts 6 to 9.
const GRID={
  reformed:{noun:'title',nouns:'titles',one:'disputation set',many:'disputation sets',head:'Disputation sets',find:'disputation set',name:'the Reformed disputations',text:'The Syllabus pages'},
  vitringa:{noun:'chapter',nouns:'chapters',one:'system',many:'systems',head:'Systems',find:'system',name:"Vitringa's Doctrina",text:"Vitringa's text"},
  lutheran:{noun:'locus',nouns:'loci',one:'work',many:'works',head:'Systems and disputations',find:'work',name:'the Lutheran loci',text:"Gerhard's text"},
  metaphysics:{noun:'disputation',nouns:'disputations',one:'work',many:'works',head:'Works beside',find:'work',name:"Suárez's Metaphysical Disputations",text:"Suárez's text",cell:['section','sections']}
};
// a deck's own lede, under the tabs while it is open
const DECKLEDE={metaphysics:"Suárez's Metaphysical Disputations, section by section. Each section shows the authors he cites and the authors who received him."};
const GD=()=>Object.prototype.hasOwnProperty.call(GRID,S.deck);
const G=()=>(D&&D.grids&&D.grids[S.deck])||null;
const NAMED=()=>SYS()||GD();
const nouns=()=>GD()?GRID[S.deck].nouns:`${noun()}s`;
Object.assign(DECKNAME,{reformed:GRID.reformed.name,vitringa:GRID.vitringa.name,lutheran:GRID.lutheran.name,metaphysics:GRID.metaphysics.name});
// THE PROBLEMS OF A PLACE (2026-10-22; owner: "our reformed deck should use voetius disputation (where he gives propositions and affirms
// denies distinguishes, etc) be imaginative and creative", then "apply similarly … for lutherans"). A deck whose places have a printed
// list of questions, each decided, reads it in the left pane (v1/decks/<deck>/props/<part>/<place>.json): Voetius's Syllabus problematum
// on the Reformed deck; Quenstedt's polemical questions on the Lutheran, where a locus has its file (until then Gerhard's text, as
// before). The base's own pages stay in the Read list (?l=~pages); an address can name a problem (#<deck>/<part>/<place>/p<n>).
const PROB={
  reformed:{base:'Voetius, Syllabus problematum theologicorum, Utrecht 1643',who:'Voetius',systems:'the Reformed systems',short:'Syllabus',one:'problem',many:'problems',tab:'Problems',more:'Also argued in the Selectae on this title'},
  lutheran:{base:"Quenstedt's questions, Systema theologicum, Wittenberg 1691",who:'Quenstedt',systems:'the Lutheran systems',short:'Systema',one:'question',many:'questions',tab:'Questions',more:'Also argued on this locus'},
  metaphysics:{base:'Suárez, Disputationes metaphysicae, section by section',who:'Suárez',short:'DM',one:'section',many:'sections',tab:'Sections',more:''}
};
const PRB=()=>(Object.prototype.hasOwnProperty.call(PROB,S.deck)?PROB[S.deck]:null);
// the problems' book as their file names it (spine_title), else as the deck does
const baseLabel=()=>(PL.props&&PL.props.spine_title)||(PRB()?PRB().base:'');
const probOn=()=>!!(PRB()&&PL.props&&S.l!=='~pages'&&!S.alt);

// ── the address ──────────────────────────────────────────────────────────────────────────────────────────────────────
function state(){
  const [path,query='']=location.hash.slice(1).split('?');
  let h=[];try{h=decodeURIComponent(path).split('/');}catch(_){}
  const q=new URLSearchParams(query),n=k=>q.has(k)&&/^\d+$/.test(q.get(k))?+q.get(k):null;
  if(h[0]==='summa')S={deck:'summa',part:PARTS.some(([k])=>k===h[1])?h[1]:'Ia',place:/^\d+$/.test(h[2]||'')?h[2]:null,art:/^\d+$/.test(h[3]||'')?h[3]:null};
  else if(h[0]==='decretals')S={deck:'decretals',part:['1','2','3','4','5'].includes(h[1])?h[1]:'1',place:/^\d+$/.test(h[2]||'')?h[2]:null,art:null};
  else if(h[0]==='decretum')S={deck:'decretum',part:DECRETUM.some(([k])=>k===h[1])?h[1]:'D',place:/^\d+$/.test(h[2]||'')?h[2]:null,art:null};
  else if(h[0]==='systems')S={deck:'systems',part:/^[IVX]+$/.test(h[1]||'')?h[1]:'I',place:/^[a-z][a-z0-9-]*$/.test(h[2]||'')?h[2]:null,art:null};
  else if(Object.prototype.hasOwnProperty.call(GRID,h[0]))S={deck:h[0],part:/^[\w.-]+$/.test(h[1]||'')?h[1]:'',place:/^[\w.-]+$/.test(h[2]||'')?h[2]:null,art:/^[aps]\d+$/.test(h[3]||'')?h[3]:null,sel:/^s\d+$/.test(h[3]||'')&&/^(?:o\d+|c\d+|i\d+|r|[hw][a-z0-9][a-z0-9-]*)$/.test(h[4]||'')?h[4]:null};
  else S={deck:'sentences',part:['1','2','3','4'].includes(h[1])?h[1]:'1',place:/^\d+$/.test(h[2]||'')?h[2]:null,art:null};
  Object.assign(S,{r:q.get('r')||null,i:n('i'),l:q.get('l')||null,j:n('j'),alt:/^[a-z]+$/.test(q.get('alt')||'')?q.get('alt'):null});
}
function hashOf(){
  const q=new URLSearchParams();if(S.r)q.set('r',S.r);if(S.i!=null)q.set('i',S.i);if(S.l)q.set('l',S.l);if(S.j!=null)q.set('j',S.j);if(S.alt)q.set('alt',S.alt);
  return [S.deck,S.part,S.place,S.art,S.art?S.sel:null].filter(x=>x!=null&&x!=='').join('/')+(q.toString()?`?${q}`:'');
}
function go(){const h=`#${hashOf()}`;if(location.hash!==h)location.hash=h;else render();}

// ── the places of a deck and its grid ────────────────────────────────────────────────────────────────────────────────
function places(){
  if(GD()){const g=G(),{cell} = GRID[S.deck];return g?g._places.map(([part,k,name,la])=>({k,part,name:S.deck==='vitringa'?`${k}. ${name}`:name,la,n:cell?Number(((g[part]||{})[k]||{}).n_sections)||0:new Set((((g[part]||{})[k]||{}).works||[]).map(r=>r[0])).size})):[];}
  // the systems: every place of the grid, in order across the ten parts (the stepper walks them all)
  if(S.deck==='systems')return D.sys?D.sys._places.map(([part,k,name,la])=>({k,part,name,la,n:new Set((((D.sys[part]||{})[k]||{}).works||[]).map(r=>r[0])).size})):[];
  if(S.deck==='decretals'){const L=canon('X');return L.titles.filter(t=>String(t[0])===S.part).map(t=>({k:String(t[1]),n:Object.keys(L.landings[`${t[0]}.${t[1]}`]||{}).length,name:t[2]}));}
  if(S.deck==='decretum'){const L=canon('D');return L.places.filter(x=>x[0]===S.part).map(x=>({k:String(x[1]),n:Object.keys(L.landings[`${x[0]}.${x[1]}`]||{}).length,name:x[2]}));}
  if(S.deck==='sentences'){const g=D.sent[S.part]||{},max={'1':48,'2':44,'3':40,'4':50}[S.part];
    return Array.from({length:max},(_,i)=>String(i+1)).map(k=>({k,n:new Set((g[k]||[]).map(r=>r[0])).size}));}
  const g=D.summa[S.part]||{},ks=Object.keys(g).filter(k=>/^\d+$/.test(k)).map(Number).sort((a,b)=>a-b);
  return ks.map(k=>({k:String(k),n:new Set(((g[k]||{}).works||[]).map(r=>r[0])).size,name:(g[k]||{}).t}));
}
function rowsFor(all){
  if(GD())return (((G()||{})[S.part]||{})[S.place]||{}).works||[];
  if(S.deck==='decretals'||S.deck==='decretum')return Object.entries(canon(S.deck==='decretals'?'X':'D').landings[`${S.part}.${S.place}`]||{}).map(([slug,p])=>[slug,p,'',0]);
  if(S.deck==='sentences')return (D.sent[S.part]||{})[S.place]||[];
  if(S.deck==='systems')return (((D.sys||{})[S.part]||{})[S.place]||{}).works||[];
  const ws=((D.summa[S.part]||{})[S.place]||{}).works||[];
  return S.art==null||all?ws:ws.filter(r=>String(r[3]||0)===String(S.art));
}
function placeName(k,part){
  if(GD()){const g=G(),p=g&&g._places.find(x=>x[0]===(part||S.part)&&x[1]===k);return p?(S.deck==='vitringa'?`Chapter ${k}. ${p[2]}`:p[2]):String(k);}
  if(S.deck==='systems'){const p=D.sys&&D.sys._places.find(x=>x[1]===k);return p?p[2]:String(k);}
  if(S.deck==='sentences')return `Distinction ${ROMAN(+k)}`;
  if(S.deck==='summa')return `Question ${k}`;
  if(S.deck==='decretals')return `Title ${ROMAN(+k)}`;
  return `${(DECRETUM.find(d=>d[0]===S.part)||[])[2]} ${ROMAN(+k)}`;
}
function heading(){
  if(GD()){const g=G(),p=(g&&g._places.find(x=>x[0]===S.part&&x[1]===S.place))||[];return [p[2]||S.place,[p[3],partName(S.part)].filter(Boolean).join(' · ')];}
  if(S.deck==='sentences')return [`Book ${ROMAN(+S.part)}, Distinction ${ROMAN(+S.place)}`,''];
  if(S.deck==='summa'){const q=(D.summa[S.part]||{})[S.place]||{};return [`${(PARTS.find(p=>p[0]===S.part)||[])[1]}, Question ${S.place}`,q.t||''];}
  if(S.deck==='decretals'){const t=canon('X').titles.find(x=>String(x[0])===S.part&&String(x[1])===S.place);return [`Book ${ROMAN(+S.part)}, Title ${ROMAN(+S.place)}`,t?t[2]:''];}
  if(S.deck==='systems'){const p=(D.sys&&D.sys._places.find(x=>x[1]===S.place))||[];return [p[2]||S.place,[p[3],`Part ${S.part}, ${partName(S.part)}`].filter(Boolean).join(' · ')];}
  return [placeName(S.place),''];
}
function partName(pk){
  if(GD())return (((G()&&G()._parts)||[]).find(p=>p[0]===pk)||[])[1]||pk;
  if(S.deck==='summa')return (PARTS.find(p=>p[0]===pk)||[])[1]||pk;
  if(S.deck==='sentences'||S.deck==='decretals')return `Book ${ROMAN(+pk)}`;
  if(S.deck==='decretum')return (DECRETUM.find(d=>d[0]===pk)||[])[1]||pk;
  if(S.deck==='systems')return (((D.sys&&D.sys._parts)||[]).find(p=>p[0]===pk)||[])[1]||pk;
  return pk;
}
// a part named inside a sentence: "the First Part", "Book II", "the Causae", "De penitentia", "God"
function partPhrase(pk){const n=partName(pk);return S.deck==='summa'||(S.deck==='decretum'&&/^(D|C)$/.test(pk))?`the ${n}`:n;}
function renderNav(){
  document.querySelectorAll('.tabs [role="tab"]').forEach(b=>{const on=b.dataset.deck===S.deck;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
  const dl=$('#dlede'),mb=$('#dlMore');if(dl){const t=DECKLEDE[S.deck]||'';dl.hidden=!t;dl.textContent=t;dl.classList.remove('is-open');}
  if(mb&&dl){mb.setAttribute('aria-expanded','false');mb.textContent='More';mb.hidden=true;requestAnimationFrame(()=>{mb.hidden=dl.hidden||dl.scrollHeight<=dl.clientHeight+2;});}
  const gp=GD()?((G()&&G()._parts)||[]).map(([k,l])=>[k,String(l).split(' · ')[0]]):[];
  const parts=GD()?(S.deck==='metaphysics'?gp.map(([k,l])=>[k,l.split(':')[0]]):gp.some(([,t])=>t.length>18)?gp.map(([k])=>[k,k]):gp):{sentences:[['1','Book I'],['2','Book II'],['3','Book III'],['4','Book IV']],summa:PARTS.map(([k])=>[k,k]),
    decretals:['1','2','3','4','5'].map(k=>[k,`Book ${ROMAN(+k)}`]),decretum:DECRETUM.map(([k,l])=>[k,l]),systems:((D.sys&&D.sys._parts)||[]).map(([k])=>[k,k])}[S.deck];
  $('#parts').innerHTML=parts.map(([k,l])=>`<button type="button" class="chip" data-part="${esc(k)}" aria-pressed="${k===S.part}" title="${esc(S.deck==='summa'?(PARTS.find(p=>p[0]===k)||[])[1]:NAMED()?partName(k):l)}"${SYS()||(GD()&&l!==partName(k))?` aria-label="Part ${esc(k)}, ${esc(partName(k))}"`:''}>${esc(l)}</button>`).join('');
  const ps=places(),here=p=>p.k===S.place&&(!p.part||p.part===S.part),i=ps.findIndex(here),[one,many]=GD()?(GRID[S.deck].cell||[GRID[S.deck].one,GRID[S.deck].many]):SYS()?['system','systems']:['commentary','commentaries'];
  const cell=p=>`<button type="button" data-place="${esc(p.k)}"${p.part?` data-ppart="${esc(p.part)}"`:''} aria-pressed="${here(p)}" class="${p.n?'':'empty'}"${p.name&&!NAMED()?` title="${esc(p.name)}"`:''} aria-label="${esc(placeName(p.k,p.part))}${p.name&&!NAMED()?`, ${esc(p.name)}`:''}, ${p.n} ${p.n===1?one:many}">${esc(NAMED()?p.name:p.k)}<small>${p.n||'·'}</small></button>`;
  $('#grid').classList.toggle('sys',NAMED());
  const gparts=SYS()?((D.sys&&D.sys._parts)||[]):GD()?((G()&&G()._parts)||[]):null;
  const gfind=`<div class="gfind"><input class="gq" type="search" autocomplete="off" spellcheck="false" placeholder="Find a ${noun()}…" aria-label="Find a ${noun()}"><span class="gct" data-all="${ps.length} ${ps.length===1?noun():nouns()}${gparts?'':` in ${esc(partPhrase(S.part))}`}">${ps.length} ${ps.length===1?noun():nouns()}${gparts?'':` in ${esc(partPhrase(S.part))}`}</span></div>`;
  $('#grid').innerHTML=gfind+(gparts?gparts.map(([pk,pn])=>`<p class="gpart" data-gp="${esc(pk)}">${GD()?'':`${esc(pk)}. `}${esc(pn)}</p>${ps.filter(p=>p.part===pk).map(cell).join('')}`).join(''):ps.map(cell).join(''));
  $('#pick').textContent=S.place?`${placeName(S.place)} ▾`:`Choose a ${noun()} ▾`;
  $('#prev').disabled=i<=0;$('#next').disabled=i<0||i>=ps.length-1;
  document.querySelectorAll('#lanes button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lane===LANE)));
}

// ── the place: its text and its commentators' divisions, fetched once a place ─────────────────────────────────────────
let PL={key:''};
async function loadPlace(){
  const key=[S.deck,S.part,S.place].join('/');
  if(PL.key===key)return PL.wait;
  const f=`${encodeURIComponent(S.deck)}/${encodeURIComponent(S.part)}/${encodeURIComponent(S.place)}.json`;
  PL={key,text:null,out:null,props:null,rec:null,lazyText:S.deck==='metaphysics'?f:null};
  // a place no commentator is aligned to has no outline file: it is not asked for; a deck with problems asks for the place's own;
  // the Suárez deck asks too for the disputation's reception, beside its props (none yet is normal)
  const pf=PRB()?`/v1/decks/${encodeURIComponent(S.deck)}/props/${encodeURIComponent(S.part)}/${encodeURIComponent(S.place)}.json${VER}`:null;
  const rf=S.deck==='metaphysics'?`/v1/decks/metaphysics/reception/${encodeURIComponent(S.part)}/${encodeURIComponent(S.place)}.json${VER}`:null;
  PL.wait=Promise.all([SYS()||PL.lazyText?null:J(`/v1/decks/read/${f}`),rowsFor().length||S.art?J(`/v1/decks/outline/${f}`):null,pf?J(pf):null,rf?J(rf):null]).then(([t,o,pr,rc])=>{
    if(PL.key!==key)return;
    PL.failed=NET.failed.has(`${BLOB}/v1/decks/read/${f}`)||NET.failed.has(`${BLOB}/v1/decks/outline/${f}`);
    PL.text=t;PL.out=o;PL.props=pr&&((Array.isArray(pr.problems)&&pr.problems.length)||(Array.isArray(pr.sections)&&pr.sections.length))?pr:null;
    PL.rec=rc&&((Array.isArray(rc.answers)&&rc.answers.length)||(rc.sections&&typeof rc.sections==='object'&&Object.keys(rc.sections).length))?rc:null;
  });
  return PL.wait;
}
const order=(a,b)=>{const ta=TRADS.includes(a.tr)?TRADS.indexOf(a.tr):99,tb=TRADS.includes(b.tr)?TRADS.indexOf(b.tr):99;return ta-tb||a.y-b.y||a.a.localeCompare(b.a)||a.t.localeCompare(b.t)||a.from-b.from;};
// the commentators of the place: the grid says who and where he begins; the outline gives his divisions and where his place ends.
// An article chosen narrows the list to those who treat it; a commentator already open stays open (he treats the whole question).
function commentators(all){
  const by=new Map();for(const r of rowsFor(all)){if(!by.has(r[0])||+r[1]<+by.get(r[0])[1])by.set(r[0],r);}
  const out=(PL.out&&PL.out.works)||{};
  return [...by.values()].map(r=>{const w=wk(r[0]),o=out[r[0]];
    const items=o&&o.items&&o.items.length?o.items:[[r[2]||`From p. ${r[1]}`,+r[1],1,r[2]||'',r[3]||null]];
    return {slug:r[0],a:w[0]||'',t:w[1]?shortWork(w[1]):r[0],vol:noDash(w[2]||''),ft:noDash(w[5]||w[1]||''),fv:noDash(w[6]||w[2]||''),dup:w[7]||'',tr:w[3]||'Other',y:w[4]||9999,from:o?+o.from:+r[1],to:o?+o.to:+r[1]+6,items};
  }).filter(c=>c.a||c.t!==c.slug).sort(order);
}
const KINDS=[['question',/^(?:on\s+|in\s+)?(?:question|quaestio|quaest\.|q\.\s*\d)|^\w+\s+question\b/i],['article',/^(?:article|articulus|art\.|a\.\s*\d)|^\w+\s+article\b/i],
  ['disputation',/^(?:disputation|disputatio|disp\.)|^\w+\s+disputation\b/i],['doubt',/^(?:doubt|dubium|dub\.)|^\w+\s+doubt\b/i],['chapter',/^(?:chapter|caput|cap\.)/i],['section',/^(?:§|section|sectio)/i]];
function summary(items){
  const n={};for(const x of items){const k=KINDS.find(([,rx])=>rx.test(x[0]));if(k)n[k[0]]=(n[k[0]]||0)+1;}
  const parts=KINDS.filter(([k])=>n[k]).slice(0,3).map(([k])=>`${n[k]} ${k}${n[k]===1?'':'s'}`);
  return parts.length?parts.join(' · '):`${items.length} heading${items.length===1?'':'s'}`;
}
const who=c=>`${c.a||'Unknown'}${c.y<9999&&!SYS()?` (b. ${c.y})`:''}`;
// the year beside a name is a commentator's birth; on the systems it is the edition's, and goes with the work
// THE WORKS BESIDE A PLACE (2026-10-22, owner on the Reformed right pane: "fix this listing … and also do a ui pass on this so it's
// intuitive to use"). A grid deck's _works rows carry [author, short title, short volume, tradition, year, full title, full volume,
// dup_of]; the Sentences' and the Summa's table carries the first five, so their titles are shortened here. A row shows the short title
// and volume (never an em dash), the full strings in its title; an author's year comes from the table, else from the library's author
// dates (tradition-graphics.js), else is not shown.
const wk=sl=>(GD()&&G()&&G()._works&&G()._works[sl])||D.texts.works[sl]||[];
const noDash=t=>String(t||'').replace(/\s*\u2014\s*/g,', ').trim();
const shortWork=t=>{const x=noDash(t);if(x.length<=72)return x;const m=/^(.{24,}?)[,:;]\s/.exec(x);return m?m[1]:`${x.slice(0,70).replace(/\s+\S*$/,'')}…`;};
let DATESREQ=false;
function bornOf(c){
  if(SYS())return '';
  if(c.y<9999)return `b. ${c.y}`;
  const T=TG&&TG.dates;
  if(!T||!c.a)return '';
  const r=T.get(c.a);
  if(r)return r.born?`b. ${r.born}`:(r.dates||'');
  // the dates come once: the panes are drawn again when they are in
  if(!DATESREQ){DATESREQ=true;T.ready.then(ok=>{if(ok){SHOWN.a='';SHOWN.b='';render();}});}
  return '';
}
const born=c=>{const b=bornOf(c);return b?`<small>${esc(b)}</small>`:'';};
const workLine=c=>{const t=String(c.t||''),v=String(c.vol||''),dup=v&&t.toLowerCase().includes(v.toLowerCase());return `${esc(t)}${v&&!dup?` · ${esc(v)}`:''}${SYS()&&c.y<9999&&!v.includes(String(c.y))?`, ${c.y}`:''}`;};
// the catalogue's full title and volume, for a row's title attribute when they say more than the short ones
const fullOf=c=>[c.ft&&c.ft!==c.t?c.ft:'',c.fv&&c.fv!==c.vol?c.fv:''].filter(Boolean).join(', ');
const fullAttr=c=>{const f=fullOf(c);return f?` title="${esc(f)}"`:'';};
const pp=c=>c.to>c.from?`pp. ${c.from}–${c.to}`:`p. ${c.from}`;

// ── where a work is not: every place of the deck in order, and the nearest places a work treats ───────────────────────
const DPC=new Map();
function deckPlaces(){
  if(DPC.has(S.deck))return DPC.get(S.deck);
  const set=rows=>new Set((rows||[]).map(r=>r[0])),num=o=>Object.keys(o||{}).filter(k=>/^\d+$/.test(k)).map(Number).sort((a,b)=>a-b);
  let L=[];
  if(S.deck==='summa')L=PARTS.flatMap(([pk])=>num(D.summa[pk]).map(k=>{const q=D.summa[pk][k]||{};return {part:pk,k:String(k),t:q.t||'',slugs:set(q.works)};}));
  else if(S.deck==='sentences')L=['1','2','3','4'].flatMap(b=>num(D.sent[b]).map(k=>({part:b,k:String(k),t:'',slugs:set(D.sent[b][k])})));
  else if(S.deck==='decretals'){const C=canon('X');L=C.titles.map(t=>({part:String(t[0]),k:String(t[1]),t:t[2]||'',slugs:new Set(Object.keys(C.landings[`${t[0]}.${t[1]}`]||{}))}));}
  else if(S.deck==='decretum'){const C=canon('D');L=DECRETUM.flatMap(([pk])=>C.places.filter(x=>x[0]===pk).map(x=>({part:pk,k:String(x[1]),t:'',slugs:new Set(Object.keys(C.landings[`${x[0]}.${x[1]}`]||{}))})));}
  else if(SYS()&&D.sys)L=D.sys._places.map(([pk,k,t])=>({part:pk,k,t,slugs:set(((D.sys[pk]||{})[k]||{}).works)}));
  else if(GD()&&G())L=G()._places.map(([pk,k,t])=>({part:pk,k,t,slugs:set(((G()[pk]||{})[k]||{}).works)}));
  if(L.length)DPC.set(S.deck,L);
  return L;
}
function nearest(slug){
  const L=deckPlaces(),i=L.findIndex(p=>p.part===S.part&&p.k===S.place);
  let before=null,after=null,count=0;
  L.forEach((p,j)=>{if(!p.slugs.has(slug))return;count++;if(i>=0&&j<i)before=p;else if(j>i&&!after)after=p;});
  return {before,after,count};
}
// a place named in a sentence or a link: its part only when it is not the part being read; the question's own title on the Summa
function placeLabel(p,full){
  const other=p.part!==S.part,pre=other&&!SYS()?`${partName(p.part)}, `:'';
  if(S.deck==='summa')return `${pre}Question ${p.k}${full&&p.t?`, ${p.t}`:''}`;
  if(S.deck==='sentences')return `${pre}Distinction ${ROMAN(+p.k)}`;
  if(S.deck==='decretals')return `${pre}Title ${ROMAN(+p.k)}${full&&p.t?`, ${p.t}`:''}`;
  if(S.deck==='decretum')return `${(DECRETUM.find(d=>d[0]===p.part)||[])[2]} ${ROMAN(+p.k)}`;
  if(GD())return other?`${p.t||p.k} (${partName(p.part)})`:p.t||p.k;
  return SYS()&&other?`${p.t} (Part ${p.part}, ${partName(p.part)})`:p.t||p.k;
}
// the address of a place with the work kept in its pane (the right pane unless it is the left that is asked for)
function hashFor(p,slug,side){
  const q=new URLSearchParams(),r=side==='a'?S.r:slug,l=side==='a'?slug:S.l;if(r)q.set('r',r);if(l)q.set('l',l);if(S.alt)q.set('alt',S.alt);
  return `${S.deck}/${p.part}/${p.k}${q.toString()?`?${q}`:''}`;
}
const PABBR={'Ia':'Ia','I-II':'Ia-IIae','II-II':'IIa-IIae','III':'IIIa'};
// a place in a list line: the short citation on the Summa (Ia q. 50, IIa-IIae q. 57), the usual label elsewhere
const briefPlace=t=>{let x=noDash(t).replace(/^(?:Title|Locus|Chapter|Disputation|Tractate|Part)\s+[\w.]+[.:]\s*/i,'');const m=/\(([^)]{3,40})\)\s*$/.exec(x);x=m?m[1]:x.split(/[,:;]\s/)[0];return x.length>44?`${x.slice(0,42).replace(/\s+\S*$/,'')}…`:x;};
const briefLabel=p=>(S.deck==='summa'?`${PABBR[p.part]||p.part} q. ${p.k}`:GD()?`${p.k} ${briefPlace(p.t)}`:placeLabel(p,false));
const placeLink=(p,slug,side,full,brief)=>`<a href="#${esc(hashFor(p,slug,side))}"${brief&&GD()?` title="${esc([noDash(p.t),partName(p.part)].filter(Boolean).join(', '))}"`:''}>${esc(brief?briefLabel(p):placeLabel(p,full))}</a>`;
// the pane of a work chosen where it has no division: it says so, and where the nearest are
function absentNote(slug,side){
  const w=D.texts.works[slug]||[],name=w[0]||(SYS()?'This system':GD()?'This work':'This commentator'),N=nearest(slug),pk=S.part,sys=SYS()||GD();
  const L=p=>placeLink(p,slug,side,true),inPart=p=>p&&p.part===pk,His=sys?'Its':'His',he=sys?'it':'he',work=sys?'treatment of':'commentary on';
  // a system's place named inside a sentence: "the covenants", not "The covenants"
  const here=sys?placeName(S.place).replace(/^The /,'the '):placeName(S.place);
  const s1=sys?`${esc(name)} has nothing filed under ${esc(here)}.`:`${esc(name)} has no commentary on ${esc(here)}.`;
  let s2='';
  if(!N.count)s2=`${sys?'It':'He'} is not aligned to any ${noun()} of ${esc(DECKNAME[S.deck])}.`;
  else if(inPart(N.before)&&inPart(N.after))s2=`The nearest ${noun()} ${he} treats before this is ${L(N.before)}. The nearest after it is ${L(N.after)}.`;
  else if(inPart(N.after))s2=`${His} ${work} ${esc(partPhrase(pk))} begins at ${L(N.after)}.${N.before?` The last ${noun()} ${he} treats before it is ${L(N.before)}.`:''}`;
  else if(inPart(N.before))s2=`${His} ${work} ${esc(partPhrase(pk))} ends at ${L(N.before)}.${N.after?` The next ${noun()} ${he} treats is ${L(N.after)}.`:''}`;
  else s2=`${sys?'It':'He'} treats ${N.count} other ${N.count===1?noun():nouns()} of ${esc(DECKNAME[S.deck])}. The nearest ${N.before&&N.after?'are':'is'} ${[N.before&&L(N.before),N.after&&L(N.after)].filter(Boolean).join(' and ')}.`;
  return `<div class="abs-note"><p>${s1}</p><p>${s2}</p></div>`;
}
// the line under an absent work in the list: where it begins, ends, or the nearest on either side
function nearHTML(slug){
  const N=nearest(slug),L=p=>placeLink(p,slug,'b',false,true);
  if(N.before&&N.after)return `Before: ${L(N.before)}. After: ${L(N.after)}.`;
  if(N.after)return `Begins at ${L(N.after)}`;
  if(N.before)return `Ends at ${L(N.before)}`;
  return '';
}
const DWC=new Map();
function deckWorks(){if(!DWC.has(S.deck)&&deckPlaces().length)DWC.set(S.deck,[...new Set(deckPlaces().flatMap(p=>[...p.slugs]))]);return DWC.get(S.deck)||[];}

// ── a work's pages: its page files (about a hundred pages a file), else its TEI; fetched once ─────────────────────────
const META=new Map(),FILES=new Map(),TEIS=new Map();
const wurl=(slug,f)=>`${BLOB}/v1/works/${encodeURIComponent(slug)}/${f}`;
function metaOf(slug){return memo(META,slug,()=>getJ(wurl(slug,'meta.json')+VER));}
async function blocksOf(slug,lane,n){
  const m=await metaOf(slug);if(!m)return null;
  const sh=Array.isArray(m.shards)?m.shards.find(x=>n>=+x.from&&n<=+x.to):null,file=sh?sh.file:(m.single||null);
  if(file){
    const key=`${slug}/${file}`;
    const d=await memo(FILES,key,()=>getJ(wurl(slug,file))),p=((d&&d.pages)||[]).find(x=>+String(x.n).replace(/^0+(?=\d)/,'')===n);
    const t=p&&p[lane==='en'?'en':'la'];
    if(t&&t.trim())return t.split(/\n+/).map(s=>({t:s.trim(),h:false})).filter(b=>b.t);
    if(!m.has_tei)return [];
  }
  if(m.has_tei&&window.FRPageWindow&&window.FRPageWindow.teiPages){
    const key=`${slug}|${lane}`;
    if(!TEIS.has(key))TEIS.set(key,(async()=>{for(const f of lane==='en'?['en']:['la','fr']){
      const x=await fetch(`${wurl(slug,`tei.${f}.xml`)}?v=${encodeURIComponent(m.tei_v||0)}`).then(r=>r.ok?r.text():'').catch(()=>'');
      const P=x&&window.FRPageWindow.teiPages(x);if(P&&P.size)return P;}return null;})());
    const P=await TEIS.get(key);return (P&&P.get(n))||[];
  }
  return [];
}

// ── drawing pages: a heading the outline names gets its anchor; a line that reads as a heading is set as one ───────────
const HEADLIKE=/^(?:distinct|quaest|question|art(?:ic|\.)|disput|dub(?:ium|\.)|doubt|cap(?:ut|\.|itul)|chapter|sect|§|pars\b|part\b|liber\b|book\b|prolog|pro(?:o|œ)em|tract|treatise|lectio|lesson|expositio|divisio|summa(?:rium|ry)|textus|resolutio|conclusio|notanda)/i;
const capsy=t=>{const L=t.replace(/[^A-Za-z]/g,'');return L.length>5&&L.replace(/[^A-Z]/g,'').length/L.length>.7;};
const headish=t=>t.length<150&&(HEADLIKE.test(t)||(t.length<100&&capsy(t)));
function matches(item,t){const b=fold(t);if(b.length<3)return false;
  return [item[3],item[0],...String(item[3]||'').split(/\s+\u2014\s+/)].some(x=>{const a=fold(x),k=Math.min(28,a.length,b.length);return k>=5&&a.slice(0,k)===b.slice(0,k);});}
// A HEADING AS THE READING GUIDE SHOWS IT (10-22, owner: no Latin in the reading guide): a head given as "English \u2014 Latin" shows its
// English, the Latin in its title (in the Latin lane the other way about); a head in Latin alone stays as printed (the Fathers in
// Migne have no meta.json, so no structure to name them in English) until the data gives it in English
// (the part after the dash is taken as Latin only when it reads as Latin: "Question I, Chapter I \u2014 Whether the doctrine of theology is a
// science" is English on both sides and is shown whole)
const LA_W=/^(?:de|et|est|ad|cum|quae|quod|qui|quo|quam|quibus|sit|sint|sunt|esse|ex|per|non|ut|sive|seu|vel|an|utrum|ejus|eius|atque|ac|nec|neque|ab|apud|inter|super|sub|contra|propter|pro|quomodo|quid|quis|cap|caput|capitulum|dist|distinctio|quaest|quaestio|articulus|liber|lib|pars|sectio|tractatus|disputatio|dei|christi|domini|deo|deum|fide|fidei|gratia|gratiae|ecclesia|ecclesiae)$/;
const EN_W=/^(?:the|of|and|on|whether|is|to|that|which|with|by|from|as|are|be|what|how|his|its|their|concerning|chapter|question|article|book|part|god|faith)$/;
const latinish=t=>{let la=0,en=0;for(const w of String(t).toLowerCase().match(/[a-zæœ]+/g)||[]){if(LA_W.test(w))la++;else if(EN_W.test(w))en++;}return la>en;};
const headSplit=h=>{const s=String(h||''),m=/\s+\u2014\s+/.exec(s);if(!m||!m.index)return {en:s,la:''};const en=s.slice(0,m.index).trim(),la=s.slice(m.index+m[0].length).trim();return latinish(la)&&!latinish(en)?{en,la}:{en:s,la:''};};
const headHTML=(h,lane)=>{const p=headSplit(h);if(!p.la)return esc(p.en);return lane==='la'?`<span title="${esc(p.en)}">${esc(p.la)}</span>`:`<span title="${esc(p.la)}">${esc(p.en)}</span>`;};
const headTitle=h=>{const p=headSplit(h);return p.la?` title="${esc(p.la)}"`:'';};
function linesHTML(blocks,lane,marks,after){
  return blocks.map((b,bi)=>{const id=marks.get(bi),{t} = b,h=b.h===1||b.h===true||id!=null||(b.h!==2&&headish(t));
    const tail=((after&&after.get(bi))||[]).map(x=>`<span class="anc" id="${x}" data-item="${x}"></span>`).join('');
    if(b.h===2)return `<p class="cap" lang="${lane}">${esc(t)}</p>${tail}`;
    return (h?`<h3 class="hd${capsy(t)?' sc':''}" lang="${lane}"${id!=null?` id="${id}" data-item="${id}"`:''}>${headHTML(t,lane)}</h3>`:`<p lang="${lane}">${esc(t)}</p>`)+tail;}).join('');
}
// one page: its number (a link into the reader at that page), then its lines in one language or both
function pageHTML(side,slug,n,cols,items,colLabel){
  // a division the page's lines name becomes that line's anchor; one they do not name is anchored after the last one placed,
  // so the contents keep the outline's order as the reader scrolls
  const lanes=LANE==='both'?['la','en']:[LANE],marks={la:new Map(),en:new Map()},after={la:new Map(),en:new Map()},lead=[];
  const lane=(cols.en&&cols.en.length&&LANE!=='la')?'en':((cols.la&&cols.la.length)?'la':'en');
  let last=-1;
  for(const it of items){
    const bi=(cols[lane]||[]).findIndex((b,k)=>k>last&&!marks[lane].has(k)&&matches(it.x,b.t)),id=`${side}-i${it.k}`;
    if(bi>=0&&lanes.includes(lane)){marks[lane].set(bi,id);last=bi;}
    else if(last<0||!lanes.includes(lane))lead.push(id);
    else{const a=after[lane].get(last)||[];a.push(id);after[lane].set(last,a);}
  }
  const NAME={en:'English',la:'Latin'};
  // one language chosen and this page has only the other: it is shown, with a line saying so, rather than a blank page
  const col=l=>{
    if(cols[l]&&cols[l].length)return `<div class="ln" lang="${l}">${linesHTML(cols[l],l,marks[l],after[l])}</div>`;
    const o=l==='en'?'la':'en';
    if(lanes.length===1&&cols[o]&&cols[o].length)return `<div class="ln" lang="${o}"><p class="note">No ${NAME[l]} for this ${colLabel}. Showing the ${NAME[o]}.</p>${linesHTML(cols[o],o,marks[o],after[o])}</div>`;
    return `<div class="ln" lang="${l}"><p class="note">No ${NAME[l]} for this ${colLabel}.</p></div>`;
  };
  return `<section class="pg" data-n="${n}">${lead.map(id=>`<span class="anc" id="${id}" data-item="${id}"></span>`).join('')}<a class="pgno" href="${read(slug,n)}" title="Open this ${colLabel} in the reader">${colLabel==='column'?'col.':'p.'} ${esc(n)}</a>${lanes.length>1?`<div class="duo">${col('la')}${col('en')}</div>`:col(lanes[0])}</section>`;
}

// ── the panes ────────────────────────────────────────────────────────────────────────────────────────────────────────
const PANE={a:$('#paneA'),b:$('#paneB')},RUN={a:0,b:0},SHOWN={a:'',b:''};
const isPhone=()=>matchMedia('(max-width:980px)').matches;
function scrollerOf(side){const s=PANE[side].querySelector('.scroll');return s&&!isPhone()?s:null;}
function scrollToEl(side,el,flash){
  if(!el)return;const s=scrollerOf(side);
  if(s)s.scrollTop+=el.getBoundingClientRect().top-s.getBoundingClientRect().top-12;
  else window.scrollTo({top:window.scrollY+el.getBoundingClientRect().top-(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky'))||12)*16-70});
  if(flash){const t=el.classList.contains('anc')?el.closest('.pg'):el;if(t){t.classList.remove('flash');void t.offsetWidth;t.classList.add('flash');}}
}
function sourceSelect(side,cs,current){
  const pr=side==='a'&&PRB()&&PL.props;
  const first=side==='a'?(pr?`<option value="">${esc(baseLabel())}</option><option value="~pages"${current==='~pages'?' selected':''}>${esc(TEXTNAME[S.deck])}</option>`:`<option value="${SYS()?'-':''}">${esc(TEXTNAME[S.deck])}</option>`):`<option value="">All ${WHO()} (${cs.length})</option>`;
  const groups=byGroup(cs);
  const w=current&&current!=='-'&&current!=='~pages'&&!cs.some(c=>c.slug===current)?D.texts.works[current]||[]:null;
  const cmp=side==='a'&&cs.length?`<option disabled>Compare with another ${GD()||SYS()?'system':'commentator'}</option>`:'';
  const away=w?`<optgroup label="Not on this ${noun()}"><option value="${esc(current)}" selected>${esc(w[0]||current)}${w[1]?` · ${esc(String(w[1]).slice(0,48))}`:''}</option></optgroup>`:'';
  return `<label class="srcl"><span>Read</span><select data-src="${side}" aria-label="What the ${side==='a'?'left':'right'} pane reads">${first}${away}${cmp}${groups.map(([t,g])=>`<optgroup label="${esc(t)}">${g.map(c=>`<option value="${esc(c.slug)}"${c.slug===current?' selected':''}>${esc(c.a||c.t)} · ${esc(c.t.slice(0,48))}${c.vol?`, ${esc(c.vol.slice(0,24))}`:''}</option>`).join('')}</optgroup>`).join('')}</select></label>`;
}
// THE TEXT ITSELF, in the left pane unless a commentator is put there
async function paneText(side){
  const host=PANE[side],[h2,sub]=heading(),t=PL.text,cs=commentators(true),token=++RUN[side];
  const key=['text',PL.key,LANE].join('|');
  const firstHead=t?((t.en||[]).concat(t.la||[]).find(b=>b[0]===1)||[])[1]:'';
  const open=t?read(t.slug,t.from,artHead()||firstHead):'';
  const head=`<header class="ph"><div class="ph-row">${sourceSelect(side,cs,'')}${open?`<a class="open" href="${open}">Open in the reader ↗</a>`:''}</div>
    <h2>${esc(h2)}</h2>${sub?`<p class="what">${esc(sub)}</p>`:''}${S.deck==='summa'?artsBar():''}</header>`;
  if(SHOWN[side]===key){host.querySelector('.ph').outerHTML=head;if(S.deck==='summa')jumpArt(side);return;}
  SHOWN[side]=key;host.dataset.moved='';
  if(SYS()){host.innerHTML=`${head}<div class="scroll"><p class="note">The systems have no common text. They are compared place by place. Choose a system for either pane.</p></div>`;return;}
  if(!t){host.innerHTML=`${head}<div class="scroll">${noText()}</div>`;return;}
  const byPage=new Map();for(const l of ['en','la'])for(const [hh,txt,pg] of (t[l]||[])){if(!byPage.has(pg))byPage.set(pg,{en:[],la:[]});byPage.get(pg)[l].push({t:txt,h:hh});}
  const unit=t.slug==='pld-7607'?'column':'page';
  host.innerHTML=`${head}<div class="scroll">${[...byPage].map(([n,cols])=>pageHTML(side,t.slug,n,cols,[],unit)).join('')}<p class="end">${t.to&&t.to>t.from?`${unit==='column'?'Columns':'Pages'} ${esc(t.from)}–${esc(t.to)}. `:''}<a href="${read(t.slug,t.to||t.from)}">Read on in the reader ↗</a></p></div>`;
  if(token===RUN[side]&&S.deck==='summa'){jumpArt(side);if(document.fonts)document.fonts.ready.then(()=>{if(token===RUN[side]&&!host.dataset.moved)jumpArt(side,true);});}
}
function artHead(){
  if(S.deck!=='summa'||!S.art||!PL.text)return '';
  const re=new RegExp(`^(?:A\\.|Art\\.?|Article|ARTICULUS|Articulus)\\s*${S.art}\\b`);
  return ((PL.text.en||[]).find(b=>b[0]===1&&re.test(b[1]))||[])[1]||'';
}
function artsBar(){
  const q=(D.summa[S.part]||{})[S.place]||{},aq=(D.texts.summa[S.part]||{})[S.place]||{};
  const counts={};for(const r of q.works||[]){const k=String(r[3]||0);(counts[k]=counts[k]||new Set()).add(r[0]);}
  const ks=[...new Set([...Object.keys(aq).filter(k=>k!=='0'),...Object.keys(counts).filter(k=>k!=='0')])].map(Number).sort((a,b)=>a-b);
  if(!ks.length)return '';
  return `<div class="arts" role="group" aria-label="Articles"><button type="button" class="chip" data-art="" aria-pressed="${S.art==null}">All articles</button>${ks.map(k=>`<button type="button" class="chip" data-art="${k}" aria-pressed="${String(k)===S.art}" title="${esc((aq[k]||[])[2]||'')}">Art. ${k}<small>${(counts[k]||new Set()).size}</small></button>`).join('')}</div>`;
}
function jumpArt(side,quiet){
  if(!S.art)return;
  const re=new RegExp(`^(?:A\\.|Art\\.?|Article|ARTICULUS|Articulus)\\s*${S.art}\\b`);
  const el=[...PANE[side].querySelectorAll('.scroll .hd,.scroll p')].find(x=>re.test(x.textContent.trim()));
  scrollToEl(side,el,!quiet);
}
// THE BASE TEXT OF THE REFORMED, VITRINGA AND LUTHERAN DECKS: the place's read file, its later chunks fetched as the reader nears
// the end of what is loaded or an aphorism's address asks for one (a chunk the pages in hand already cover is passed over). On the
// Lutheran deck the base can be Calov (?alt=calov): the read file names his pages, which are read from the work itself, forty at a time.
const isFam=sl=>/^(?:pg|pld|po|eebo)-\d+$/.test(String(sl||''));
const atw=sl=>/^(?:pg|pld)-/.test(String(sl||''))?'col.':'p.';
const surnameOf=a=>String(a||'').split(/[/;,]/)[0].trim().split(/\s+/).pop()||'';
const surname=sl=>surnameOf((D.texts.works[sl]||[])[0]);
function baseOf(){
  const t=PL.text;
  if(!t)return null;
  if(!PL.base){
    const pgs=[...(t.en||[]),...(t.la||[])].map(x=>+x[2]).filter(Number.isFinite);
    PL.base={t,en:(t.en||[]).slice(),la:(t.la||[]).slice(),to:pgs.length?Math.max(...pgs):(+t.from||1)-1,chunks:Array.isArray(t.chunks)?t.chunks:[],ci:0,busy:null};
  }
  return PL.base;
}
function nextChunk(B){if(!B)return null;let {ci} = B;while(ci<B.chunks.length&&+B.chunks[ci][1]<=B.to)ci++;B.ci=ci;return B.chunks[ci]||null;}
async function moreBase(){
  const B=baseOf(),c=nextChunk(B),{key} = PL;
  if(!c)return false;
  if(B.busy)return B.busy;
  B.busy=(async()=>{
    const d=await J(`/v1/decks/read/${[S.deck,S.part,S.place].map(encodeURIComponent).join('/')}${encodeURIComponent(String(c[2]||`~${B.ci+1}`))}.json`);
    B.ci++;
    if(PL.key!==key)return false;
    if(d)for(const l of ['en','la'])for(const x of d[l]||[])B[l].push(x);
    const pgs=d?[...(d.en||[]),...(d.la||[])].map(x=>+x[2]).filter(Number.isFinite):[];
    B.to=Math.max(B.to,+c[1]||0,...pgs);
    return !!d;
  })();
  const ok=await B.busy;
  B.busy=null;
  return ok;
}
// VITRINGA, as the data session's prototype sets him (proto/vitringa.html, reviewed 10-22): a numbered aphorism, its marks, its notes'
// cards; a running head that repeats the chapter is left out; *words* in the translation are italic
const ital=h=>h.replace(/\*([^*<>]{1,160})\*/g,'<i>$1</i>');
const shortTitle=t=>String(t||'').replace(/\s*\(.*?\)\s*/g,' ').split(/[,:;]/)[0].trim().slice(0,48);
// THE NOTE AS PRINTED (the data session's prototype, revised 10-22 after the owner found copied notes running the names together):
// nothing in the note is replaced or re-cased, so it reads and copies as the print. A work we hold: its PRINTED name, with the
// initials before it ("FRANC. JUNIUS", "HENRIC. ALTINGIUS"), becomes the link, and a quiet tag after it ("p. 463", or the short title
// when there is no page) says where it opens; the tag is not part of the text (user-select: none; the link's label carries it).
// Capitals of the print are set in small capitals by the font (all-small-caps), the letters themselves untouched.
const LINKS=[];
const CAPS=/\b[A-Z][A-Z'À-Þ]{2,}\.?(?:\s+[A-Z][A-Z'À-Þ]{1,}\.?)*/g;
function smallCaps(html){
  return html.split(/(<[^>]+>)/).map(seg=>seg.startsWith('<')?seg:seg.replace(CAPS,m=>/[A-Z]{4,}|[A-Z]{3,}\.?\s+[A-Z]{3,}/.test(m)?`<span class="sc">${m}</span>`:m)).join('');
}
const stems=t=>new Set((fold(t).match(/[a-z]{4,}/g)||[]).map(w=>w.slice(0,6)));
function noteHTML(text,links){
  links=links||[];
  const ids=links.map(l=>LINKS.push(l)-1);
  let html=ital(esc(text));
  const rest=[];
  // every mention of a held author in the note (initials and surname with its Latin ending, outside tags); each link then goes to the
  // mention whose next words best share its title ("ALTINGIUS in Theological Problems" with New Problematic Theology), one a mention
  const occ=[];
  links.forEach((l,i)=>{
    if(!l||!l[1])return;
    const [surface,,,,author]=l;
    const sur=[surface,surnameOf(author)].filter(Boolean).map(s=>String(s).replace(/[.]/g,' ').trim().split(/\s+/).pop()).filter(s=>s.length>3);
    for(const n of [...new Set(sur)]){
      const re=new RegExp(`((?:\\b[A-Z][A-Za-z]{0,9}\\.\\s+){0,3})(?<![A-Za-zÀ-ɏ])${n.slice(0,Math.max(5,n.length-3)).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[A-Za-zÀ-ɏ]*(?![^<]*>)`,'gi');
      let m;
      while((m=re.exec(html))){const cut=((m[1]||'').match(/^(?:[a-z][A-Za-z]{0,9}\.\s+)+/)||[''])[0].length;occ.push({i,at:m.index+cut,len:m[0].length-cut,after:html.slice(m.index+m[0].length,m.index+m[0].length+160)});}
    }
  });
  const used=new Map(),byLink=new Map();
  const pairs=occ.map(o=>{const t=stems(links[o.i][3]),a=stems(o.after);let sc=0;t.forEach(w=>{if(a.has(w))sc++;});return {...o,sc};}).sort((x,y)=>y.sc-x.sc||x.at-y.at);
  for(const o of pairs){if(byLink.has(o.i)||used.has(o.at))continue;byLink.set(o.i,o);used.set(o.at,o.i);}
  // one work cited several times (Problem 2, then Problem 13): its pages rise with the order of the mentions
  const bySlug=new Map();
  for(const o of byLink.values()){const sl=links[o.i][1];if(!bySlug.has(sl))bySlug.set(sl,[]);bySlug.get(sl).push(o);}
  for(const os of bySlug.values()){
    if(os.length<2)continue;
    const idx=os.map(o=>o.i).sort((x,y)=>(+links[x][2]||1e9)-(+links[y][2]||1e9));
    os.sort((x,y)=>x.at-y.at).forEach((o,k)=>{o.i=idx[k];});
  }
  // right to left, so the earlier offsets stay true
  for(const o of [...byLink.values()].sort((x,y)=>y.at-x.at)){
    const [surface,slug,page,title,author]=links[o.i],pg=page!=null&&page!=='';
    const label=`${author||surface}, ${title}${pg?`, page ${page}`:''}: open beside the text`;
    html=`${html.slice(0,o.at)}<a class="ref" href="${esc(read(slug,pg?page:null))}" data-li="${ids[o.i]}" aria-label="${esc(label)}">${html.slice(o.at,o.at+o.len)}</a><span class="tag" aria-hidden="true" data-t="${pg?`${atw(slug)} ${esc(page)}`:esc(shortTitle(title))}"></span>${html.slice(o.at+o.len)}`;
  }
  const placed=new Set([...byLink.values()].map(o=>o.i));
  links.forEach((l,i)=>{
    if(!l||!l[1]||placed.has(i))return;
    const [surface,slug,page,title,author]=l,pg=page!=null&&page!=='';
    rest.push(`<a class="ref" href="${esc(read(slug,pg?page:null))}" data-li="${ids[i]}" aria-label="${esc(`${author||surface}, ${title}`)}">${esc(author||surface)}</a><span class="tag" aria-hidden="true" data-t="${esc(shortTitle(title))}${pg?`, ${atw(slug)} ${esc(page)}`:''}"></span>`);
  });
  html=smallCaps(html);
  return `<p class="nt">${html}</p>${rest.length?`<p class="held"><span class="held-l">Also cited here, in the library:</span> ${rest.join(' · ')}</p>`:''}`;
}
function runningHead(text){
  const t=PL.text||{},f=x=>fold(x).replace(/^(?:of|on|concerning|de)\s+/,'').replace(/\s+/g,'');
  if(/^(?:chapter|caput|cap\.)\b/i.test(text)||/^doctrin(?:e|a)\b.*christian/i.test(text))return true;
  return [String(t.title||'').replace(/^chapter\s*\d+\.?\s*/i,''),t.title_la].some(x=>x&&f(x)===f(text));
}
function vitRows(blocks,lane,side){
  return blocks.map((b,bi)=>{
    const {x} = b;
    if(b.h===1)return runningHead(b.t)?'':`<div class="ap"><h3 class="sec">${ital(esc(b.t))}</h3></div>`;
    const notes=x&&Array.isArray(x.notes)?x.notes:[],aph=x&&/^\d+$/.test(String(x.aph||''))?String(x.aph):null;
    if(!aph&&!notes.length)return `<div class="ap plain-row"><p class="plain">${ital(esc(b.t))}</p></div>`;
    const id=`${side}-${lane}-${aph?`a${aph}`:`b${b.page}-${bi}`}`;
    const marks=notes.map((n,k)=>{const m=String(n[0]||'*');return `<button type="button" class="mk" aria-expanded="false" aria-controls="${id}-n${k}" aria-label="Note ${esc(m)}" title="Note ${esc(m)}">${esc(m)}</button>`;}).join('');
    const cards=notes.map((n,k)=>`<div class="card" id="${id}-n${k}" hidden><p class="lbl"><b>${esc(String(n[0]||'*'))}</b>Martin Vitringa’s note</p>${noteHTML(n[1],n[2])}</div>`).join('');
    if(!aph)return `<div class="ap plain-row" id="${id}"><p class="plain">${ital(esc(b.t))}${marks}</p>${cards}</div>`;
    const body=ital(esc(String(b.t).replace(/^\s*\d{1,3}\.\s*/,'')));
    return `<div class="ap" id="${id}" data-aph="${aph}"><a class="num" href="#${esc([S.deck,S.part,S.place,`a${aph}`].join('/'))}" aria-label="Aphorism ${aph}">§ ${aph}</a><p lang="${lane}">${body}${marks}</p>${x.margin?`<span class="refs">${esc(x.margin)}</span>`:''}${cards}</div>`;
  }).join('');
}
const richLane=l=>{const B=PL.base;if(!B)return false;const k=`rich_${l}`;if(B[k]==null)B[k]=(B[l]||[]).some(x=>x&&x.length>3&&x[3]);return B[k];};
function basePageHTML(side,slug,n,cols,lanes){
  const col=l=>{
    const bs=cols[l]||[];
    if(!bs.length)return `<div class="ln" lang="${l}"><p class="note">No ${l==='en'?'English':'Latin'} on this page.</p></div>`;
    return `<div class="ln" lang="${l}">${S.deck==='vitringa'&&richLane(l)?vitRows(bs,l,side):linesHTML(bs,l,new Map(),null)}</div>`;
  };
  return `<section class="pg" data-n="${n}"><a class="pgno" href="${read(slug,n)}" title="Open this page in the reader">${atw(slug)} ${esc(n)}</a>${lanes.length>1?`<div class="duo">${col('la')}${col('en')}</div>`:col(lanes[0])}</section>`;
}
function drawBase(side){
  const host=PANE[side],B=baseOf(),pagesEl=host.querySelector('.pages');
  if(!B||!pagesEl)return;
  const lanes=LANE==='both'?['la','en']:[LANE],byPage=new Map();
  for(const l of ['en','la'])for(const x of B[l]){const n=+x[2];if(!(n>(host._to||0)))continue;if(!byPage.has(n))byPage.set(n,{en:[],la:[]});byPage.get(n)[l].push({h:x[0],t:x[1],x:x[3]||null,page:n});}
  const ns=[...byPage.keys()].sort((a,b)=>a-b);
  pagesEl.insertAdjacentHTML('beforeend',ns.map(n=>basePageHTML(side,B.t.slug,n,byPage.get(n),lanes)).join(''));
  if(ns.length)host._to=ns[ns.length-1];
  footBase(side);
}
function footBase(side,busy){
  const host=PANE[side],B=baseOf(),bar=host.querySelector('.morebar'),end=host.querySelector('.scroll>.end');
  if(!B||!bar||!end)return;
  const c=nextChunk(B),left=B.chunks.length-B.ci;
  if(c){bar.hidden=false;end.hidden=true;bar.innerHTML=`<button type="button" data-more-pages="${side}"${busy?' disabled':''}>${busy?esc(busy):`Load pages ${esc(c[0])}–${esc(c[1])}`}</button><span>${left} more ${left===1?'part':'parts'} of this ${noun()}, to p. ${esc(B.chunks[B.chunks.length-1][1])}</span>`;return;}
  bar.hidden=true;bar.innerHTML='';end.hidden=false;
  const {t} = B;
  end.innerHTML=`${t.to&&t.to>t.from?`Pages ${esc(t.from)}–${esc(t.to)}. `:''}<a href="${read(t.slug,t.to||t.from)}">Read on in the reader ↗</a>`;
}
async function loadMoreBase(side){
  const token=RUN[side];
  footBase(side,'Loading…');
  const ok=await moreBase();
  if(token!==RUN[side])return;
  if(ok)drawBase(side);else footBase(side);
}
// an aphorism's address (#vitringa/<part>/<chapter>/a<N>): its part of the chapter is fetched in turn until it is in the pane
async function jumpAph(side,token){
  const m=/^a(\d+)$/.exec(S.art||'');
  if(!m)return;
  const host=PANE[side],find=()=>host.querySelector(`.ap[data-aph="${m[1]}"]`);
  let el=find();
  while(!el&&nextChunk(baseOf())){
    footBase(side,`Finding § ${m[1]}…`);
    if(!await moreBase()||token!==RUN[side])break;
    drawBase(side);el=find();
  }
  if(token!==RUN[side])return;
  if(!el){footBase(side);return;}
  scrollToEl(side,el,true);
  if(document.fonts)document.fonts.ready.then(()=>{if(token===RUN[side]&&!host.dataset.moved)scrollToEl(side,el,false);});
}
// Calov beside Gerhard: his pages from the work's own files, forty at a time
async function altPages(side,alt,token){
  const host=PANE[side],pagesEl=host.querySelector('.pages'),lanes=LANE==='both'?['la','en']:[LANE];
  const from=host._alt,last=Math.min(+alt.to,from+39);
  footAlt(side,alt,'Loading…');
  for(let n=from;n<=last;n++){
    const cols={};for(const l of lanes)cols[l]=await blocksOf(alt.slug,l,n);
    if(lanes.length===1&&cols[lanes[0]]&&!cols[lanes[0]].length){const o=lanes[0]==='en'?'la':'en';cols[o]=await blocksOf(alt.slug,o,n);}
    if(token!==RUN[side])return;
    if(lanes.every(l=>cols[l]==null)){
      if(n===+alt.from){pagesEl.innerHTML=retryNote('These pages did not load.',` <a href="${read(alt.slug,alt.from)}">Open them in the reader ↗</a>`);host._alt=+alt.to+1;break;}
      host._alt=+alt.to+1;break;
    }
    pagesEl.insertAdjacentHTML('beforeend',pageHTML(side,alt.slug,n,cols,[],'page'));
    host._alt=n+1;
  }
  host.querySelector('.scroll>.sk')?.remove();
  footAlt(side,alt);
}
function footAlt(side,alt,busy){
  const host=PANE[side],bar=host.querySelector('.morebar'),end=host.querySelector('.scroll>.end'),next=host._alt;
  if(!bar||!end)return;
  if(next<=+alt.to){bar.hidden=false;end.hidden=true;bar.innerHTML=`<button type="button" data-more-alt="${side}"${busy?' disabled':''}>${busy?esc(busy):`Load pages ${next}–${Math.min(+alt.to,next+39)}`}</button><span>${esc(surname(alt.slug)||'This work')} runs to p. ${esc(alt.to)} on this ${noun()}</span>`;return;}
  bar.hidden=true;end.hidden=false;
  end.innerHTML=`Pages ${esc(alt.from)}–${esc(alt.to)}. <a href="${read(alt.slug,alt.to)}">Read on in the reader ↗</a>`;
}
// the base text's name: on the Lutheran deck whose it is (Gerhard's, or Calov's with ?alt=calov)
function baseName(){const t0=PL.text,alt=S.alt&&t0&&t0.alt?t0.alt:null,who=alt?alt.slug:t0&&t0.slug;return S.deck==='lutheran'&&who&&surname(who)?`${surname(who)}'s text`:GRID[S.deck].text;}
async function paneBase(side){
  if(PL.lazyText){const k=PL.key,f=PL.lazyText;PL.lazyText=null;const t=await J(`/v1/decks/read/${f}`);if(PL.key!==k)return;PL.text=t;}
  const host=PANE[side],[h2g,subg]=heading(),cs=commentators(true),token=++RUN[side],t0=PL.text,alt=S.alt&&t0&&t0.alt?t0.alt:null;
  TEXTNAME[S.deck]=baseName();
  const ak=t0&&t0.alt?fold(surname(t0.alt.slug)).replace(/\s+/g,'')||'alt':'';
  const altBar=t0&&t0.alt?`<div class="seg altsw" role="group" aria-label="Whose text the left pane reads">${[['',t0.slug],[ak,t0.alt.slug]].map(([v,sl])=>`<button type="button" data-alt="${esc(v)}" aria-pressed="${String((S.alt||'')===v)}">${esc(surname(sl)||sl)}</button>`).join('')}</div>`:'';
  const title=t0&&t0.title?t0.title:h2g,sub=t0&&t0.title_la?[t0.title_la,partName(S.part)].join(' · '):subg;
  const what=alt?[(D.texts.works[alt.slug]||[])[0],alt.title,`pp. ${alt.from}–${alt.to}`].filter(Boolean).join(', '):sub;
  const start=alt?read(alt.slug,alt.from):t0?read(t0.slug,t0.from):'';
  const head=`<header class="ph"><div class="ph-row">${sourceSelect(side,cs,PL.props?'~pages':'')}${start?`<a class="open" href="${start}">Open in the reader ↗</a>`:''}</div>
    <h2>${esc(title)}</h2>${what?`<p class="what">${esc(what)}</p>`:''}${altBar}${!alt&&t0&&t0.note?`<p class="vnote">${esc(t0.note)}</p>`:''}</header>`;
  const key=['base',PL.key,LANE,S.alt||''].join('|');
  if(SHOWN[side]===key){host.querySelector('.ph').outerHTML=head;if(!alt)await jumpAph(side,token);return;}
  SHOWN[side]=key;host.dataset.moved='';host._to=0;
  if(!t0){host.innerHTML=`${head}<div class="scroll">${noText()}</div>`;return;}
  host.innerHTML=`${head}<div class="scroll bscroll"><div class="pages"></div>${alt?'<div class="sk" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>':''}<div class="morebar" hidden></div><p class="end" hidden></p></div>`;
  if(alt){host._alt=+alt.from;await altPages(side,alt,token);return;}
  drawBase(side);
  await jumpAph(side,token);
}
// THE PROBLEMS, one row each. A seal is type only, drawn from data-s so that a copy carries the words alone; the verdict is always in
// words under the question. The letters keep 4.5:1 on the sheet: A and N in the answer colours, D in ink inside a ring of the border
// tone, a question left open in ink on the highlight tone, curious and absurd in the muted tone, E, the inclinations, the parts and
// Quenstedt's corollaries (C) in ink.
const SEALS={A:['A','aff',['A']],N:['N','den',['N']],D:['D','dis',['D']],AcD:['A·D','aff',['A','D']],NcD:['N·D','den',['N','D']],QC:['Q','q',['Q']],QA:['Q','q',['Q']],QI:['Q','q',['Q']],
  DP:['open','open',['O']],NL:['open','open',['O']],DI:['open','open',['O']],E:['E','ink',['E']],IncA:['Incl. A','ink',['A']],IncN:['Incl. N','ink',['N']],C:['C','ink',['C']]};
// the filter strip, each verdict with its own seal; a file's marks table decides which it offers
const PCATS=[['A','Affirmed','A','aff'],['N','Denied','N','den'],['D','Distinguished','D','dis'],['Q','Curious and absurd','Q','q'],['O','Left open','open','open'],['E','Explained','E','ink'],['C','Corollaries','C','ink']];
const PART_W={'affirmed with a distinction':'A·D','denied with a distinction':'N·D',affirmed:'A',denied:'N',distinguished:'D',explained:'E'};
// a question answered in parts ("The first part affirmed, the second explained") is sealed A/E; one part alone, "A post."
function partSeal(v){
  const out=[];
  for(const s of String(v||'').split(/[,;]\s*|\s+and\s+(?=the\s)/i)){
    const w=/\b(affirmed with a distinction|denied with a distinction|affirmed|denied|distinguished|explained)\b/i.exec(s),o=/\b(first|second|third|former|latter)\b/i.exec(s);
    if(w)out.push([o?o[1].toLowerCase():'',PART_W[w[1].toLowerCase()]]);
  }
  const cats=[...new Set(out.flatMap(([,l])=>l.split('·')))];
  if(out.length>1)return [out.map(x=>x[1]).join('/'),cats];
  if(out.length)return [`${out[0][1]} ${/first|former/.test(out[0][0])?'pr.':/second|latter/.test(out[0][0])?'post.':''}`.trim(),cats];
  return ['parts',[]];
}
function sealOf(p){
  const mk=p.mark||(p.kind==='porisma'?'C':'');
  if(!mk)return null;
  if(mk==='part'){const [t,c]=partSeal(p.verdict);return [t,'ink',c];}
  return SEALS[mk]||[String(mk).slice(0,8),'ink',[]];
}
function offered(marks,ps){
  const o=new Set(),ks=Object.keys(marks||{}).length?Object.keys(marks):ps.map(p=>p.mark);
  for(const k of ks){if(k==='part')['A','N','D','E'].forEach(c=>o.add(c));else ((SEALS[k]||[])[2]||[]).forEach(c=>o.add(c));}
  return o;
}
// THE ADVERSARIES by party, in the controversies page's school colours, its table extended to the parties of these polemics: the Papists
// take the Thomists' blue and the Jesuits keep their own; the Socinians and Photinians the Scotists' purple; the Remonstrants and
// Arminians the Nominalists' amber; the other Protestant confession (the Lutherans on the Reformed deck, the Calvinists on the Lutheran)
// the Augustinians' plum; every other party the grey of the others. A name of no party stays plain text; a name that does not say its
// party has the party written beside it, so the colour is never the only carrier.
const PARTY={papist:['Papist','Papists',/pontific|papist|papal|romanist/i],jesuit:['Jesuit','Jesuits',/jesuit/i],socinian:['Socinian','Socinians',/socin/i],photinian:['Photinian','Photinians',/photin/i],
  remonstrant:['Remonstrant','Remonstrants',/remonstr/i],arminian:['Arminian','Arminians',/arminian|arminius/i],lutheran:['Lutheran','Lutherans',/luther/i],calvinist:['Calvinist','Calvinists',/calvin/i],
  anabaptist:['Anabaptist','Anabaptists',/anabapt/i],weigelian:['Weigelian','Weigelians',/weigel/i],syncretist:['Syncretist','Syncretists',/syncret/i],cartesian:['Cartesian','Cartesians',/cartes/i],
  jewish:['Jewish','Jews',/\bjew|rabbi/i],pagan:['Pagan','Pagans',/pagan|gentile|heathen/i]};
const SCHOOL={papist:'thomist',jesuit:'jesuit',socinian:'scotist',photinian:'scotist',remonstrant:'nominalist',arminian:'nominalist',lutheran:'augustinian',calvinist:'augustinian'};
const schoolC=party=>`var(--s-${SCHOOL[party]||'other'})`;
const PARTY_OF=[[/socin|ostorod/i,'socinian'],[/photin/i,'photinian'],[/remonstr/i,'remonstrant'],[/arminian|arminius|grotius|episcopius/i,'arminian'],
  [/jesuit|bellarmin|becan|su[aá]rez|v[aá][sz]quez|lessius|gretser|maldonat/i,'jesuit'],[/pontific|papist|papal|romanist|tridentin/i,'papist'],[/luther|ubiquit/i,'lutheran'],
  [/calvin|zwingli|sacramentar/i,'calvinist'],[/anabapt|mennon/i,'anabaptist'],[/weigel/i,'weigelian'],[/syncret|calixt/i,'syncretist'],[/cartes/i,'cartesian'],
  [/\bjews?\b|jewish|rabbi|talmud|cabal|sadduc|josephus/i,'jewish'],[/pagan|gentile|heathen|plato|aristot|stoic|epicur|pythagor/i,'pagan']];
const partyOf=n=>(PARTY_OF.find(([re])=>re.test(n))||[])[1]||'';
function advHTML(nm,party){
  const name=String(nm||'').trim(),P=Object.prototype.hasOwnProperty.call(PARTY,party)?PARTY[party]:null;
  if(!name)return '';
  if(!P)return esc(name);
  return `<span class="adv" style="--sc:${schoolC(party)}"><i class="dot" aria-hidden="true"></i>${esc(name)}${P[2].test(name)?'':`<span class="adv-p"> · ${P[0]}</span>`}</span>`;
}
const advPairs=l=>(Array.isArray(l)?l:[]).filter(x=>Array.isArray(x)&&x[0]).map(([n,pt])=>advHTML(n,pt)).join(', ');
// a printed list ("the Pontificians, Socinus, and the Remonstrants"): each name by its party, the words between kept as printed
const advText=s=>String(s||'').split(/(,\s*(?:and\s+)?|\s+and\s+(?=the\s|[A-Z])|\s*&\s*)/).map((x,i)=>(i%2?esc(x):advHTML(x,partyOf(x)))).join('');
// a problem's adversaries: as printed against it, else its antithesis; "against the same" (c. eosd.) names the adversaries last named
function advOf(p,ctx){
  const one=x=>{
    if(Array.isArray(x))return advPairs(x);
    const s=String(x||'').trim();
    if(!s)return '';
    if(/^the same$/i.test(s))return ctx.adv?`the same (${ctx.adv})`:'the same';
    ctx.adv=advText(s);return ctx.adv;
  };
  return one(p.against)||one(p.antithesis);
}
// a heading set in capitals ("OF THE PAPISTS") read in ordinary case
const tidyCaps=s=>(/[a-z]/.test(s)?s:String(s).toLowerCase().replace(/(^|\s)(\S)/g,(m,a,b)=>a+b.toUpperCase()).replace(/\b(Of|The|And|Against|In|On)\b/g,w=>w.toLowerCase()).replace(/^./,c=>c.toUpperCase()));
// THE MODULE (tradition-graphics.js): its page preview for an objection's page and a question's words, its share bar for the graph band
const TG=window.FRTraditionGraphics||null;
let TGPV=null;
const tgpv=()=>TGPV||(TGPV=TG&&TG.preview?TG.preview({read,text:CP_JS,col:'.pr,.cc-op,.cc-judgment,.dos-hd,.rec,.dos,.ans',host:'.qb,.ob,.stated,.op,.res,.pth-rows>li,.sec-at,.mv,.cc-rows>li,.cc-judgment .cc-r1,.cc-head .cc-r1,.dos-hd,.ob-pg,.rcp-r,.ans,.adv-es>li'}):null);
const pvBtn=(slug,page)=>{const pv=tgpv();return pv?pv.btn(slug,page):'';};
const fmtN=n=>Number(n||0).toLocaleString('en-US');
// A MOVE: the problem or thesis of a disputation that argues the question at length, its verdict, its distinction, its adversaries,
// its words, and its page (opened beside the list; a modified click goes to the reader). A move that differs from the problems' author
// on the doctrine says so.
const MVV={affirm:['A','aff','Affirmed'],deny:['N','den','Denied'],distinguish:['D','dis','Distinguished'],teach:['','','Taught']};
const branches=m=>(m&&Array.isArray(m.distinguo)?m.distinguo:[]).filter(x=>Array.isArray(x)&&x[0]);
function forkHTML(ds){
  const b=branches({distinguo:ds});
  if(!b.length)return '';
  return `<ul class="fork">${b.map(([sense,v])=>{const x=MVV[v]||['','',''];return `<li>${x[0]?`<span class="seal sm s-${x[1]}" data-s="${x[0]}" aria-hidden="true"></span>`:'<span aria-hidden="true"></span>'}<span>${x[2]?`<span class="fk-w">${x[2]}:</span> `:''}${esc(sense)}</span></li>`;}).join('')}</ul>`;
}
// the move's author and its disputation: a disputation already named after its author ("Calov, Systema locorum theologicorum, …")
// is not named twice
function moveWho(m){
  const w=D.texts.works[m.slug]||[],who=m.author||m.who||w[0]||'',s=surnameOf(who),d=String(m.disp||''),own=!!s&&d.startsWith(`${s}, `);
  return {who,s,wt:own?'':[w[1],w[2]].filter(Boolean).join(', '),disp:own?d.slice(s.length+2):d};
}
function moveLink(m,host){
  const {who,wt,disp}=moveWho(m),pg=m.page!=null&&m.page!=='';
  const k=host._mv.push([disp||wt||m.slug,m.slug,pg?m.page:null,[disp,wt].filter(Boolean).join(', '),who,m.quote||''])-1;
  return `<a class="mv-open" href="${read(m.slug,pg?m.page:null)}" data-mv="${k}">${esc(disp||wt||'The disputation')}${pg?`, ${atw(m.slug)} ${esc(m.page)}`:''}</a>`;
}
function moveHTML(m,host){
  const cfg=PRB()||{},v=MVV[m.verdict]||['','',String(m.verdict||'')],{who,wt}=moveWho(m),n=String(m.n??'').trim().replace(/\.$/,''),kind=String(m.kind||'').replace(/^./,c=>c.toUpperCase());
  const label=!n?kind:/^(?:\d+|[IVXLCDM]+)[a-z]?$/i.test(n)?`${kind} ${n}`.trim():n,adv=advPairs(m.against),pg=m.page!=null&&m.page!=='';
  const src=`${who?`${esc(who)}, `:''}${wt?`${esc(wt)}: `:''}${moveLink(m,host)}${pg?` ${pvBtn(m.slug,m.page)}`:''}`;
  return `<li class="mv"><p class="mv-h">${v[0]?`<span class="seal sm s-${v[1]}" data-s="${v[0]}" aria-hidden="true"></span>`:''}<span class="mv-k">${esc(label)}</span>${v[2]?` <span class="mv-v">· ${esc(v[2])}</span>`:''}${m.agree==='differs'&&cfg.who?` <span class="mv-dif"${m.why?` title="${esc(m.why)}"`:''}>differs from ${esc(cfg.who)}</span>`:''}</p>`
    +`${m.agree==='differs'&&m.why?`<p class="mv-why"><b>Where he differs.</b> ${esc(m.why)}</p>`:''}`
    +`${m.q?`<p class="mv-q">${esc(m.q)}</p>`:''}${m.answer?`<p class="mv-a">${esc(m.answer)}</p>`:''}${forkHTML(m.distinguo)}`
    +`${adv?`<p class="mv-adv">Against ${adv}</p>`:''}`
    +`${m.quote?qbHTML({quote:m.quote,w:m.slug,p:m.page,cap:`<span class="mv-src">${src}</span>`}):`<p class="mv-src">${src}</p>`}</li>`;
}
let RID=0;
// ── A PASSAGE SET IN (owner: "with block quotes"): the words at the length the data holds them, in the controversies page's quote
// (italic, set in on a hairline), the work and the page with Preview under them. Where the data gives the Latin too, both are set, the
// reading language first; where it gives only the English, the Latin of the same place is a toggle away. That Latin is found, not
// given: the reader's page files carry each page's English and Latin cut into the same paragraphs, so the passage's paragraph is found
// by its English words and its place in that paragraph is carried over in proportion; the sentences there are shown with one either
// side, and named as the Latin around that place, not as the passage (the proportion can drift by a sentence).
const SRCL={la:'Latin',grc:'Greek',fr:'French',de:'German',nl:'Dutch'};
const qclean=t=>String(t||'').replace(/^#+\s*/gm,'').replace(/\[\^[^\]]*\]/g,'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*\s][^*]*?)\*/g,'$1').replace(/\*/g,'').replace(/\s{2,}/g,' ').trim();
function qbHTML(q){
  const en=qclean(q.quote||q.en),la=qclean(q.la);
  if(!en&&!la)return '';
  const cut=t=>(q.clip&&!q.full&&t&&!/[.!?;:”’"')\]]$/.test(t)?'…':''),pg=!!q.w&&q.p!=null&&q.p!=='';
  const bq=(t,l)=>`<blockquote lang="${l}"><p>${esc(t)}${cut(t)}</p></blockquote>`;
  const first=LANE==='la'&&la?[la,'la']:[en||la,en?'en':'la'],second=en&&la?(first[1]==='la'?[en,'en']:[la,'la']):null;
  const cap=q.cap!=null?q.cap:`${q.label?`<span class="qb-t">${esc(q.label)}</span>`:''}${pg?`<span class="pgs"><a class="pg" href="${read(q.w,q.p)}" data-pw="${esc(q.w)}|${esc(q.p)}">${esc(q.pl||`p. ${q.p}`)}</a> ${pvBtn(q.w,q.p)}</span>`:''}`;
  const alt=!!(q.one&&second),tog=alt?`<button type="button" class="qb-la qb-alt" aria-expanded="false">${second[1]==='la'?'Latin':'English'}</button>`:pg&&en&&!la?`<button type="button" class="qb-la" data-qla="${esc(q.w)}|${esc(q.p)}" aria-expanded="false">Latin</button>`:'';
  const full=q.full&&pg&&en?` data-qfull="${esc(q.w)}|${esc(q.p)}" data-qtext="${esc(en)}"`:'';
  return `<figure class="qb${full?' is-cut':''}"${en?` data-tg-pv-hl="${esc(en.slice(0,400))}"`:''}${full}>${bq(...first)}${second&&!alt?bq(...second):''}${cap||tog?`<figcaption>${cap}${tog}</figcaption>`:''}${alt?`<div class="qb-src" hidden data-done="1">${bq(...second)}</div>`:tog?'<div class="qb-src" hidden></div>':''}${q.says?`<p class="qb-says">${esc(q.says)}</p>`:''}</figure>`;
}
const WMETA=new Map(),WSHARD=new Map();
const wmeta=slug=>memo(WMETA,slug,()=>J(`/v1/works/${encodeURIComponent(slug)}/meta.json`));
const pnum=v=>Number(String(v).replace(/^0+(?=\d)/,''));
async function wpage(slug,n){
  const m=await wmeta(slug);
  if(!m)return {m:null,p:null};
  let file=null;
  if(Array.isArray(m.shards)&&m.shards.length){const s=m.shards.find(x=>n>=Number(x.from)&&n<=Number(x.to));file=s?s.file:null;}
  else if(m.single)file=m.single;
  if(!file)return {m,p:null};
  const k=`${slug}/${file}`;
  const d=await memo(WSHARD,k,()=>J(`/v1/works/${encodeURIComponent(slug)}/${file}`));
  return {m,p:((d&&d.pages)||[]).find(x=>pnum(x.n)===n)||null};
}
// the English passage in a text: by its first words, else by words from its middle or its end, measured back to its start
function qnorm(t){const f=[],ix=[];let last=' ';for(let i=0;i<t.length;i++){const c=t[i].toLowerCase().normalize('NFD')[0]||' ',o=/[a-z0-9]/.test(c)?c:' ';if(o===' '&&last===' ')continue;f.push(o);ix.push(i);last=o;}return [f.join(''),ix];}
function qlocate(text,q){
  const [f,ix]=qnorm(text),w=fold(q).split(' ').filter(Boolean),all=w.join(' ');
  for(const k of [8,6,5])for(const st of [0,Math.floor(w.length/2),Math.max(0,w.length-k)]){
    const head=w.slice(st,st+k).join(' ');
    if(head.length<12)continue;
    const at=f.indexOf(head);
    if(at<0)continue;
    const pre=st?w.slice(0,st).join(' ').length+1:0,a=Math.max(0,at-pre),b=Math.min(f.length-1,a+all.length-1);
    return [ix[a],ix[b]+1];
  }
  return null;
}
function qwin(E,L,r){
  const k=L.length/Math.max(1,E.length),cuts=[],re=/[.?!][”’"')\]]*\s+/g;
  const s=Math.floor(r[0]*k),e=Math.ceil(r[1]*k);
  let m;
  while((m=re.exec(L)))cuts.push(m.index+m[0].length);
  const starts=[0,...cuts],ends=[...cuts,L.length];
  let si=0,ei=ends.length-1;
  starts.forEach((x,i)=>{if(x<=s)si=i;});
  for(let i=ends.length-1;i>=0;i--)if(ends[i]>=e)ei=i;
  const wide=ends[Math.min(ends.length-1,ei+1)]-starts[Math.max(0,si-1)]>(e-s)*4+400,a=starts[wide?si:Math.max(0,si-1)],b=ends[wide?ei:Math.min(ends.length-1,ei+1)];
  return `${a>0?'… ':''}${esc(qclean(L.slice(a,b)))}${b<L.length?' …':''}`;
}
function qalign(en,la,q){
  const ep=en.split(/\n{2,}/),lp=la.split(/\n{2,}/);
  if(ep.length===lp.length&&ep.length>1)for(let i=0;i<ep.length;i++){const r=qlocate(ep[i],q);if(r)return qwin(ep[i],lp[i],r);}
  const r=qlocate(en,q);
  return r?qwin(en,la,r):null;
}
async function qbFill(fig,b,box){
  box.dataset.done='1';
  const [w,p]=b.dataset.qla.split('|'),n=pnum(p),bq=fig.querySelector('blockquote[lang="en"]'),q=String(bq?bq.textContent:'').replace(/…$/,'');
  box.innerHTML='<p class="qb-sh">Finding the place in the Latin…</p>';
  const {m,p:pg}=await wpage(w,n),lang=(m&&SRCL[m.src_lang])||'Latin',say=t=>{box.innerHTML=`<p class="qb-sh">${t}</p>`;};
  if(m&&SRCL[m.src_lang])b.textContent=lang;
  if(!m){say(`The ${lang} of p. ${esc(p)} could not be loaded.`);return;}
  if(m.en_only){say('This work is in English only.');return;}
  const la=String((pg&&pg.la)||''),en=String((pg&&pg.en)||'');
  if(!la.trim()){say(`The ${lang} of p. ${esc(p)} is not in the library. Preview shows the page.`);return;}
  const hit=en.trim()?qalign(en,la,q):null;
  if(!hit){say(`This passage could not be placed in the ${lang} of p. ${esc(p)}. Preview shows the page in both languages.`);return;}
  box.setAttribute('lang',m.src_lang||'la');
  box.innerHTML=`<p class="qb-sh">The ${lang} around this place on p. ${esc(p)}</p><p class="qb-lt">${hit}</p>`;
}
// THE WORDS THE FILE CUTS (Suárez's resolution in the props, at 200 characters): the page files give them whole. The cut words are found
// in the page's English; their paragraph is set whole where it is short, in both languages where both lanes are cut into the same
// paragraphs; a long paragraph gives the whole sentences the words were taken from (the Latin then a toggle away). Only when the page
// cannot be read do the cut words stand, marked as cut.
function qbFullAll(root){root.querySelectorAll('.qb[data-qfull]:not([data-qdone])').forEach(f=>{qbFull(f);});}
async function qbFull(fig){
  fig.dataset.qdone='1';
  const [w,p]=fig.dataset.qfull.split('|'),q=fig.dataset.qtext||'',{p:pg}=await wpage(w,pnum(p));
  if(!fig.isConnected)return;
  const fail=()=>{const pe=fig.querySelector('blockquote p');if(pe&&!/[.!?;:”’"')\]…]$/.test(pe.textContent.trim()))pe.textContent=`${pe.textContent.trim()}…`;fig.classList.remove('is-cut');};
  const en=String((pg&&pg.en)||''),la=String((pg&&pg.la)||''),ep=en.split(/\n{2,}/),lp=la.split(/\n{2,}/);
  let i=-1,r=null;
  for(let k=0;k<ep.length&&i<0;k++){const x=qlocate(ep[k],q);if(x){i=k;r=x;}}
  if(i<0){fail();return;}
  const E=ep[i],L=ep.length===lp.length?lp[i]:'';
  let t=E,lt=L;
  if(E.length>900){
    const cuts=[];const re=/[.?!][”’"')\]]*\s+/g;let m;
    while((m=re.exec(E)))cuts.push(m.index+m[0].length);
    const a=[0,...cuts].filter(x=>x<=r[0]).pop()||0,b=[...cuts,E.length].find(x=>x>=r[0]+q.length)||E.length;
    t=E.slice(a,b);lt='';
  }
  const bq=(x,l)=>`<blockquote lang="${l}"><p>${esc(qclean(x))}</p></blockquote>`,first=LANE==='la'&&lt?[lt,'la']:[t,'en'],second=lt?(first[1]==='la'?[t,'en']:[lt,'la']):null;
  fig.querySelectorAll('blockquote').forEach(x=>x.remove());
  fig.insertAdjacentHTML('afterbegin',`${bq(...first)}${second?bq(...second):''}`);
  fig.dataset.tgPvHl=qclean(t).slice(0,400);
  if(lt){const tg=fig.querySelector('.qb-la'),bx=fig.querySelector('.qb-src');if(tg)tg.remove();if(bx)bx.remove();}
  fig.classList.remove('is-cut');
}
let QBN=0,QBIO=null;
function qbToggle(b,open){
  const fig=b.closest('.qb'),box=fig&&fig.querySelector('.qb-src');
  if(!box)return;
  if(!box.id)box.id=`qb-src-${++QBN}`;
  b.setAttribute('aria-controls',box.id);b.setAttribute('aria-expanded',String(open));box.hidden=!open;
  if(open&&!box.dataset.done)qbFill(fig,b,box);
}
// reading in Latin: each passage's Latin is drawn as it comes into view
function qbAuto(root){
  if(root)qbFullAll(root);
  if(LANE==='en'||!root||typeof IntersectionObserver!=='function')return;
  if(!QBIO)QBIO=new IntersectionObserver(es=>{for(const x of es){if(!x.isIntersecting)continue;QBIO.unobserve(x.target);if(x.target.getAttribute('aria-expanded')!=='true')qbToggle(x.target,true);}},{rootMargin:'240px 0px'});
  root.querySelectorAll('.qb-la:not(.qb-alt)[aria-expanded="false"]').forEach(b=>QBIO.observe(b));
}
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('.qb-la');
  if(b)qbToggle(b,b.getAttribute('aria-expanded')!=='true');
});
// AN OBJECTION ANSWERED: who makes it, by party; the objection; the answer; his words set in; the page, with the module's Preview
function objHTML(o,ctx){
  const cfg=PRB()||{},by=tidyCaps(String(o.by||'').trim()),pg=o.page!=null&&o.page!=='';
  return `<li class="ob">${by?`<p class="ob-by">${advHTML(by,o.party)}</p>`:''}`
    +`${o.obj?`<p class="ob-o"><span class="ob-k">The objection.</span> ${esc(o.obj)}</p>`:''}${o.resp?`<p class="ob-r"><span class="ob-k">${esc(cfg.who||'The')} answers.</span> ${esc(o.resp)}</p>`:''}`
    +`${o.quote?qbHTML({quote:o.quote,w:ctx.slug,p:o.page,pl:`${cfg.short}, ${atw(ctx.slug)} ${o.page}`})
      :pg?`<p class="ob-pg"><a href="${read(ctx.slug,o.page)}">${esc(cfg.short)}, ${atw(ctx.slug)} ${esc(o.page)}</a> ${pvBtn(ctx.slug,o.page)}</p>`:''}</li>`;
}
// THE WHO-AGREES STRIP: the systems beside the problems' author, five fixed columns in the file's order: filled where his move agrees on
// the doctrine, hollow in the deny colour where it differs, a dash where it is silent, blank where he has no move on the question
const AGT={agrees:(s,w)=>`${s} agrees with ${w}`,differs:(s,w)=>`${s} differs from ${w}`,silent:s=>`${s} is silent on it`};
function stripHTML(p,authors,who){
  const cells=authors.map((a,i)=>[surnameOf(a)||a,String((p.strip||[])[i]||'')]);
  const say=([s,v])=>(AGT[v]?AGT[v](s,who):`${s}: no disputation on it`);
  const why=s=>((p.moves||[]).find(m=>m.agree==='differs'&&m.why&&surnameOf(m.author||'')===s)||{}).why||'';
  return `<span class="agr" role="img" aria-label="${esc(cells.map(say).join('; '))}">${cells.map(c=>`<i class="ag-${AGT[c[1]]?c[1]:'none'}" title="${esc(c[1]==='differs'&&why(c[0])?`${say(c)}: ${why(c[0])}`:say(c))}"></i>`).join('')}</span>`;
}
// WHERE A PROBLEM IS ARGUED (2026-10-22, owner on #reformed/2/2.2: "should allow us to link or click into where it gets argued in Voetius
// and others in the reformed system"). A problem's argued list (props: argued [{slug, page, author, work, heading, kind, quote?}],
// n_more) folds out under it as the paths do on the controversies page: the author with his tradition's swatch, the work and the
// heading, the page with Preview, his words set in; the Selectae first, then the systems, the disputation sets, the commentaries. Where
// the problem is a disputed question its atlas and controversies ids give a line of links. Where some problems have neither an argued
// list nor joined moves, one quiet line under the title's head says where to look: the works beside the title.
const ATLASP=window.__FR_ATLAS_PATH__||'/atlas';
const AKIND=['selectae','system','disputation','commentary'];
// the places in the file's order (the Selectae first, then by the author's year): the kind in the deck's words, the author, the work and
// its own heading at that page (its English half), the page with Preview; the rest counted
const AKL={selectae:'Selectae',system:'System',disputation:'Disputation',commentary:'Commentary'};
const argHead=h=>tidyCaps(String(h||'').split(/\s+\u2014\s+/)[0].trim());
function arguedHTML(list,more){
  return `<ol class="pth-rows arg-rows">${list.map(e=>{const w=D.texts.works[e.slug]||[],pg=e.page!=null&&e.page!=='',who=e.author||w[0]||'',work=e.work||w[1]||'',hd=argHead(e.heading);
    return `<li${e.quote?` data-tg-pv-hl="${esc(String(e.quote).slice(0,400))}"`:''}><p class="arg-h">${AKL[e.kind]?`<span class="arg-k">${AKL[e.kind]}</span> `:''}<b>${esc(who)}</b>${work?` · <em>${esc(work)}</em>`:''}${hd?` · ${esc(hd)}`:''}</p>`
      +`${pg?`<p class="pth-pg"><a href="${read(e.slug,e.page)}">p. ${esc(e.page)}</a> ${pvBtn(e.slug,e.page)}</p>`:''}${e.quote?`<p class="pth-q">“${esc(e.quote)}”</p>`:''}</li>`;}).join('')}</ol>${Number(more)>0?`<p class="pth-more">+${fmtN(more)} more</p>`:''}`;
}
// a problem's other addresses: its question in the atlas, its debate in the controversies
const argLinks=p=>[p.atlas?`<a href="${ATLASP}#${encodeURIComponent(p.atlas)}">Atlas: ${esc(p.atlas)}</a>`:'',p.controversy?`<a href="${CONTRO}#debate/${encodeURIComponent(p.controversy)}${p.question?`/${encodeURIComponent(p.question)}`:''}">Argued as a controversy</a>`:''].filter(Boolean).join(' · ');
// a problem in the list, one line; open, as the controversies page draws a controversy: the question in both languages, the verdict with
// its adversaries and its page, the answer, the question stated with its words, the objections it answers with theirs, its distinction;
// then, folded, the disputations that argue it at length in their own words
function probRow(side,p,i,ctx){
  const cfg=PRB(),sl=sealOf(p),verdict=p.verdict||ctx.marks[p.mark]||'',mv=p.moves||p.voetius||[],fm=mv.filter(m=>branches(m).length>1),adv=advOf(p,ctx),n=String(p.n??i+1),obs=Array.isArray(p.objections)?p.objections:[];
  const la=p.la?`${esc(p.la)}${p.mark_la?` <span class="pr-mk">${esc(p.mark_la)}</span>`:''}`:'',en=esc(p.q||'');
  const [main,under]=LANE==='la'&&la?[[la,'la'],[en,'en']]:[[en,'en'],[la,'la']];
  const anti=adv&&Array.isArray(p.antithesis)&&p.antithesis.length&&String(p.against||'').trim()?advPairs(p.antithesis):'';
  const qpg=p.quote_page!=null&&p.quote_page!==''?p.quote_page:p.page,bid=`${side}-pb${esc(n)}`,links=argLinks(p);
  const part=(k,label,inner)=>`<section class="pr-sec" data-ps="${k}"><h4 class="pr-sh">${label}</h4>${inner}</section>`;
  const forks=fm.map(m=>`<p class="fk-h">As ${esc(moveWho(m).s||'the disputation')} distinguishes it in ${moveLink(m,ctx.host)}</p>${forkHTML(m.distinguo)}`).join('');
  const quoted=!!p.quote||obs.some(o=>o.quote)||mv.some(m=>m.quote);
  const kn=p.num?`${p.kind==='porisma'?'Corollary':'Question'} ${esc(p.num)}, `:'';
  const pg=p.page!=null&&p.page!==''?`<span class="pr-at"> · <a class="pr-pg" href="${read(ctx.slug,p.page)}" data-pp="${i}">${esc(cfg.short)}, ${kn}${atw(ctx.slug)} ${esc(p.page)}</a></span>`:'';
  const body=`${under[0]?`<p class="pr-u" lang="${under[1]}">${under[0]}</p>`:''}`
    +`<p class="pr-v"><span class="pr-vw">${esc(verdict)}</span>${adv?`<span class="pr-adv">, against ${adv}</span>`:''}${pg}</p>${p.answer?`<p class="pr-ans">${esc(p.answer)}</p>`:''}`
    +`${p.status||p.quote||anti?part('s','The question stated',`<div class="stated tg">${p.status?`<p class="mv-a">${esc(p.status)}</p>`:''}${anti?`<p class="mv-adv">The antithesis: ${anti}</p>`:''}${p.quote?qbHTML({quote:p.quote,w:ctx.slug,p:qpg,pl:`${cfg.short}, ${atw(ctx.slug)} ${qpg}`}):''}</div>`):''}`
    +`${obs.length?part('o',`Objections answered <span class="cc-ct">${obs.length}</span>`,`<div class="f1-set f1-list">${obs.map((o,k)=>fold1(`ob-${side}-${n}`,`<span class="f1-k">${esc(tidyCaps(String(o.by||'').trim())||'An objection')}</span><span class="f1-t">${esc(o.obj||'')}</span>${o.quote?'<span class="f1-n">1 passage</span>':''}`,`<ol class="objs tg">${objHTML(o,ctx)}</ol>`,{cls:'f1-line'})).join('')}</div>`):''}`
    +`${fm.length?part('f',`The distinction${fm.length>1?`s <span class="cc-ct">${fm.length}</span>`:''}`,`<div class="fork-w">${forks}</div>`):''}`
    +`${quoted||!(p.status||anti||obs.length||mv.length)?'':'<p class="qb-none">No passage picked</p>'}`
    +`${mv.length?`<details class="rcv-fold"><summary><h4 class="rcv-sh">Argued at length</h4> <span class="cc-ct">${mv.length} ${mv.length===1?'disputation':'disputations'}</span></summary><div class="f1-set f1-list">${mv.map(m=>{const v=MVV[m.verdict]||['','',''],{who,disp}=moveWho(m);return fold1(`mv-${side}-${n}`,`<span class="f1-k">${esc(surnameOf(who)||who||'')}</span><span class="f1-t">${esc([disp,m.q].filter(Boolean).join(': '))}</span>${v[2]?`<span class="f1-n">${esc(v[2])}</span>`:''}`,`<ol class="argued tg">${moveHTML(m,ctx.host)}</ol>`,{cls:'f1-line'});}).join('')}</div></details>`:''}`
    +`<p class="sec-links arg-links"><button type="button" class="res-of" data-osel="p${esc(n)}/" data-sheet="1">${ctx.authors.length?'Who agrees and where it is argued':'Where it is argued'}</button>${links?` · ${links}`:''}</p>`;
  return `<li class="pr ln1" id="${side}-p${esc(n)}" data-i="${i}"><div class="pr-m"><a class="pr-n" href="#${esc([S.deck,S.part,S.place,`p${n}`].join('/'))}" data-n="${esc(n)}" aria-label="${esc(cap1(cfg.one))} ${esc(n)}"></a>`
    +`${sl?`<span class="seal sm s-${sl[1]}" data-s="${esc(sl[0])}" aria-hidden="true"></span>`:''}</div>${ctx.authors.length?stripHTML(p,ctx.authors,cfg.who):''}`
    +`<div class="pr-b"><p class="row1"><button type="button" class="acc-t" aria-expanded="false" aria-controls="${bid}" lang="${main[1]}">${main[0]}</button><span class="row-meta"><span class="row-v">${esc(verdict)}</span></span></p>`
    +`<div class="acc-b" id="${bid}" hidden>${body}</div></div></li>`;
}
// THE GRAPH BAND under the title's head, in the module's share bar (tradition-graphics.css .tg-pf): the verdicts in the answer colours,
// the adversaries' parties in the school colours, the words and counts under each; on the Lutheran deck how often the systems beside
// Quenstedt agree with him. The answer colours only: the qualified verdicts are lighter mixes of their own colour, the parts and the
// explained shades of the ink.
const VORDER=['A','AcD','IncA','N','NcD','IncN','D','part','E','C','QC','QA','QI','DP','NL','DI'];
const VCOL={A:'var(--affirms)',AcD:'color-mix(in srgb,var(--affirms) 60%,var(--card-bg))',IncA:'color-mix(in srgb,var(--affirms) 32%,var(--card-bg))',
  N:'var(--denies)',NcD:'color-mix(in srgb,var(--denies) 60%,var(--card-bg))',IncN:'color-mix(in srgb,var(--denies) 32%,var(--card-bg))',D:'var(--border)',
  part:'color-mix(in srgb,var(--fg) 45%,var(--card-bg))',E:'color-mix(in srgb,var(--fg) 75%,var(--card-bg))',C:'color-mix(in srgb,var(--fg) 25%,var(--card-bg))',
  QC:'var(--muted)',QA:'var(--muted)',QI:'var(--muted)',DP:'var(--highlight)',NL:'var(--highlight)',DI:'var(--highlight)'};
function tgBar(parts,what){
  return `<div class="tg-pf"><span class="tg-pf-bar" role="img" aria-label="${esc(`${what}: ${parts.map(x=>`${x.l} ${x.n}`).join(', ')}`)}"><span class="tg-pf-fill" style="width:100%">${parts.map(x=>`<i style="flex-grow:${x.n};--c:${x.c}" title="${esc(`${x.l} ${fmtN(x.n)}`)}"></i>`).join('')}</span></span>`
    +`<p class="tg-pf-tr">${parts.map(x=>`<span><i class="tg-sw" style="--c:${x.c}" aria-hidden="true"></i>${esc(x.l)}<span class="tg-ct">${fmtN(x.n)}</span></span>`).join('')}</p></div>`;
}
function graphHTML(P,cfg){
  const g=P.graph;
  if(!TG||!g)return '';
  const v=g.verdicts||g.marks||{},marks=P.marks||{},rank=k=>(VORDER.includes(k)?VORDER.indexOf(k):99);
  const vs=Object.keys(v).filter(k=>Number(v[k])>0).sort((a,b)=>rank(a)-rank(b)).map(k=>({l:k==='C'?'Corollaries':marks[k]||k,n:Number(v[k]),c:VCOL[k]||'color-mix(in srgb,var(--fg) 30%,var(--card-bg))'}));
  const pa=Object.entries(g.parties||{}).filter(([,n])=>Number(n)>0).sort((a,b)=>(a[0]==='other')-(b[0]==='other')||b[1]-a[1])
    .map(([k,n])=>({l:k==='other'?'Others':(PARTY[k]||[k,k])[1],n:Number(n),c:schoolC(k)}));
  const ag=g.agree||null,agN=ag?Number(ag.agrees||0)+Number(ag.differs||0)+Number(ag.silent||0):0;
  const box=(h,body)=>`<div class="pg-c"><h3 class="pg-h">${h}</h3>${body}</div>`;
  return `<section class="pgraph tg" aria-label="This ${esc(noun())} in figures">${vs.length?box(`The verdicts on these ${esc(cfg.many)}`,tgBar(vs,`The verdicts on the ${cfg.many} of this ${noun()}`)):''}`
    +`${pa.length?box('Their adversaries, by party',tgBar(pa,'The adversaries named, by party')):''}`
    +`${agN?`<p class="pg-agree"><span class="pg-h">Beside ${esc(cfg.who)}</span> ${fmtN(ag.agrees)} agree, <span class="pg-dif">${fmtN(ag.differs)} differ</span>${Number(ag.silent)?`, ${fmtN(ag.silent)} silent`:''}</p>`:''}</section>`;
}
// the verdicts pressed in the filter strip, kept from place to place; a find box narrows the list by the problems' words
const PF=new Set();
async function paneProblems(side){
  const host=PANE[side],P=PL.props,cfg=PRB(),cs=commentators(true),key=['probs',PL.key,LANE].join('|');
  RUN[side]++;
  if(SHOWN[side]===key){if(host._art!==S.art){host._art=S.art;jumpProb(side);}return;}
  SHOWN[side]=key;host.dataset.moved='';host._art=S.art;host._P=P;host._mv=[];host._q='';host._secs=false;host._rid=++RID;
  TEXTNAME[S.deck]=baseName();
  const [h2g,subg]=heading(),ps=P.problems,pages=ps.map(p=>Number(p.page)).filter(x=>Number.isFinite(x)&&x>0),from=pages.length?Math.min(...pages):null,to=pages.length?Math.max(...pages):null;
  const authors=Array.isArray(P.strip_authors)?P.strip_authors.filter(Boolean):[];
  const ctx={host,slug:P.slug,marks:P.marks||{},adv:'',authors},count={};
  host._pi=ps.map(p=>{const sl=sealOf(p),cats=sl?sl[2]:[];cats.forEach(c=>{count[c]=(count[c]||0)+1;});
    return {cats,hay:fold([p.q,p.la,p.verdict,p.mark_la,p.answer,p.status,typeof p.against==='string'?p.against:advPairs(p.against).replace(/<[^>]+>/g,' '),...(p.objections||[]).flatMap(o=>[o.by,o.obj,o.resp,o.quote]),...(p.moves||p.voetius||[]).flatMap(m=>[m.author,m.q,m.answer,m.quote])].join(' '))};});
  // Quenstedt's questions run through the chapters of his locus: a chapter's questions under its heading
  const groups=[];
  ps.forEach((p,i)=>{const ch=String(p.chap||'');if(!groups.length||groups[groups.length-1].ch!==ch)groups.push({ch,rows:[]});groups[groups.length-1].rows.push(probRow(side,p,i,ctx));});
  const avail=offered(P.marks,ps),strip=PCATS.filter(([k])=>avail.has(k)).map(([k,label,st,sc])=>`<button type="button" class="ptog" data-pf="${k}" aria-pressed="false"><span class="seal sm s-${sc}" data-s="${st}" aria-hidden="true"></span>${label} <small>${count[k]||0}</small></button>`).join('');
  const find=`<div class="prow"><input class="pfind" type="search" autocomplete="off" spellcheck="false" placeholder="Find a ${cfg.one}…" aria-label="Find a ${cfg.one} in this ${noun()}"><p class="pcount" role="status"></p></div>`;
  const head=authors.length?`<div class="pstrip-h"><div class="pst-l">${find}<p class="ag-key"><span><i class="ag-agrees" aria-hidden="true"></i>agrees</span><span><i class="ag-differs" aria-hidden="true"></i>differs from ${esc(cfg.who)}</span><span><i class="ag-silent" aria-hidden="true"></i>silent</span></p></div>`
    +`<span class="ag-names" aria-hidden="true">${authors.map(a=>`<span title="${esc(a)}">${esc(surnameOf(a)||a)}</span>`).join('')}</span></div>`:find;
  const more=P.more||[],spine=baseLabel();
  host.innerHTML=`<header class="ph"><div class="ph-row">${sourceSelect(side,cs,'')}${P.slug&&from!=null?`<a class="open" href="${read(P.slug,from)}">Open in the reader ↗</a>`:''}</div>
    <h2>${esc(P.title||h2g)}</h2><p class="what">${esc([P.title_la,partName(S.part)].filter(Boolean).join(' · ')||subg)}</p>
    <p class="pbase">${esc(spine)}${from!=null?`, ${from===to?`p. ${from}`:`pp. ${from}–${to}`}`:''}</p></header>`
    +`<div class="scroll pscroll${authors.length?' has-strip':''}">${ps.some(p=>!(p.moves||p.voetius||[]).length&&!(Array.isArray(p.argued)&&p.argued.length))?`<p class="pr-where">Where these ${cfg.many} are argued: <button type="button" class="res-of" data-gob>see the ${esc(GRID[S.deck].head.toLowerCase())} beside this ${noun()}</button></p>`:''}${graphHTML(P,cfg)}<div class="pctl">${strip?`<div class="pfilter" role="group" aria-label="Show the ${cfg.many} by their verdict">${strip}</div>`:''}`
    +`${head}</div>`
    +`${groups.map(g=>`<section class="pgrp">${g.ch?`<h3 class="pchap">${esc(g.ch)}</h3>`:''}<ol class="probs acc">${g.rows.join('')}</ol></section>`).join('')}<p class="note pnone" hidden>None of the ${cfg.many} in this ${noun()} match.</p>`
    +`${more.length?`<details class="pmore"><summary><h3>${esc(cfg.more)} <small>${more.length}</small></h3></summary><ol class="argued tg">${more.map(m=>moveHTML(m,host)).join('')}</ol></details>`:''}`
    +`${P.slug&&to!=null?`<p class="end"><a href="${read(P.slug,to)}">Read on in the reader ↗</a></p>`:''}</div>`;
  // what the browser scrolls into view itself (a focused fold, a found word) clears the filter strip that stays at the pane's top
  const sc=host.querySelector('.pscroll'),ctl=host.querySelector('.pctl');
  if(host._ro)host._ro.disconnect();
  if(sc&&ctl&&typeof ResizeObserver==='function'){host._ro=new ResizeObserver(()=>{sc.style.scrollPaddingTop=getComputedStyle(ctl).position==='sticky'?`${ctl.offsetHeight+8}px`:'';});host._ro.observe(ctl);}
  applyProbs(side);
  accOpen(host,accKey());
  markSel();
  qbAuto(host);
  jumpProb(side);
}
function applyProbs(side){
  const host=PANE[side],info=host._pi||[],on=[...PF].filter(k=>host.querySelector(`.ptog[data-pf="${k}"]`)),q=fold(host._q||'');
  let shown=0;
  host.querySelectorAll('.probs>.pr').forEach(li=>{const x=info[Number(li.dataset.i)]||{cats:[],hay:''},ok=(!on.length||x.cats.some(c=>on.includes(c)))&&(!q||x.hay.includes(q));li.hidden=!ok;if(ok)shown++;});
  host.querySelectorAll('.pgrp').forEach(g=>{g.hidden=!g.querySelector('.probs>.pr:not([hidden])');});
  host.querySelectorAll('.ptog').forEach(b=>b.setAttribute('aria-pressed',String(PF.has(b.dataset.pf))));
  const cfg=PRB(),n=info.length,c=host.querySelector('.pcount'),none=host.querySelector('.pnone');
  if(c&&cfg)c.textContent=`${shown===n?n:`${shown} of ${n}`} ${n===1?cfg.one:cfg.many} in this ${noun()}`;
  if(none)none.hidden=shown>0;
}
// a row in view in its pane, below the filter strip that stays at the pane's top on a wide screen
function probInView(side,row,flash){
  const s=scrollerOf(side),ctl=PANE[side].querySelector('.pctl'),stick=s&&ctl&&getComputedStyle(ctl).position==='sticky'?ctl.offsetHeight:0;
  if(!s){scrollToEl(side,row,flash);return;}
  s.scrollTop+=row.getBoundingClientRect().top-s.getBoundingClientRect().top-stick-10;
  if(flash){row.classList.remove('flash');void row.offsetWidth;row.classList.add('flash');}
}
function jumpProb(side){
  const m=/^([psa])(\d+)$/.exec(S.art||'');
  if(!m)return;
  const host=PANE[side],row=document.getElementById(`${side}-${m[1]}${m[2]}`),token=RUN[side];
  if(!row||!host.contains(row))return;
  if(row.hidden){PF.clear();host._q='';const f=host.querySelector('.pfind');if(f)f.value='';applyView(side);}
  if(!isPhone()){const {top} = $('#desk').getBoundingClientRect(),st=parseFloat(getComputedStyle(host).top)||12;if(top>st+1)window.scrollBy(0,top-st);}
  probInView(side,row,true);
  if(document.fonts)document.fonts.ready.then(()=>{if(token===RUN[side]&&!host.dataset.moved)probInView(side,row,false);});
}
// THE LIST, ONE OPEN (2026-10-22; owner: "i dont like endles scrolling, again the scrolling for controversies was good, we want colalpsed
// for, reading authro should happen to the side while the main content in liek a suaez is the grpahs suarez exp osition and summary").
// The Suárez deck lists its sections and the problems decks their problems collapsed, the chosen one open in place at full depth; an
// author is read in full in the pane beside (on a phone, the sheet).
const accKey=()=>{const m=/^([ps])(\d+)$/.exec(S.art||'');return m?`${m[1]}${m[2]}`:null;};
function accOpen(host,key,toggle){
  const rows=[...host.querySelectorAll('.probs>.pr')];
  if(!rows.length)return null;
  const side=host===PANE.b?'b':'a';
  let row=key?document.getElementById(`${side}-${key}`):null;
  if(!row||!host.contains(row))row=rows.find(r=>!r.hidden)||rows[0];
  const btn=row.querySelector('.acc-t'),was=!!btn&&btn.getAttribute('aria-expanded')==='true';
  host.querySelectorAll('.acc-t[aria-expanded="true"]').forEach(b=>{if(b===btn)return;b.setAttribute('aria-expanded','false');const bd=document.getElementById(b.getAttribute('aria-controls'));if(bd)bd.hidden=true;const r=b.closest('.pr');if(r)r.classList.remove('is-open');});
  if(btn){const open=toggle?!was:true;btn.setAttribute('aria-expanded',String(open));const bd=document.getElementById(btn.getAttribute('aria-controls'));if(bd)bd.hidden=!open;}
  host.querySelectorAll('.probs>.pr.is-open').forEach(r=>r.classList.toggle('is-open',r===row&&btn&&btn.getAttribute('aria-expanded')==='true'));
  if(btn&&btn.getAttribute('aria-expanded')==='true')row.classList.add('is-open');
  if(TG)TG.layout(row);
  return row;
}
// THE METAPHYSICS DECK (2026-10-22; owner: "suarez disp should be more than a sub controversy its a great way to learn metaphysics and
// differences", "loved to have accompanying graphs"). Suárez's Disputationes metaphysicae read as a course in the schools' differences:
// v1/decks/metaphysics/props/<part>/<disputation>.json gives each section's question, the opinions Suárez sets out with their holders by
// school, his verdict on each, his resolution in his own words, the splits inside a school, the Reformed and Lutheran metaphysicians on the
// question, and its links to the controversies, the maps and the lexicon; graph per disputation for the band under its head.
const CONTRO=window.__FR_CONTROVERSIES_PATH__||'/controversies';
const MAPSP=window.__FR_MAPS_PATH__||'/maps';
const LEXP=window.__FR_LEXICON_PATH__||'/lexicon';
// the schools in the controversies page's colours; the Protestants (Lutheran and Reformed metaphysicians) the Augustinians' plum
const MSCH=[['thomist','Thomists'],['scotist','Scotists'],['nominalist','Nominalists'],['jesuit','Jesuits'],['others','Others'],['protestant','Protestants']];
const MSC={thomist:'thomist',scotist:'scotist',nominalist:'nominalist',jesuit:'jesuit',others:'other',protestant:'augustinian'};
const mschool=s=>({thomist:'thomist',thomists:'thomist',scotist:'scotist',scotists:'scotist',nominalist:'nominalist',nominalists:'nominalist',jesuit:'jesuit',jesuits:'jesuit',suarezian:'jesuit',
  lutheran:'protestant',reformed:'protestant',protestant:'protestant',protestants:'protestant'}[String(s||'').toLowerCase()]||'others');
const mcol=k=>`var(--s-${MSC[k]||'other'})`;
// Suárez's verdict on an opinion: accepts in the affirm colour, rejects in the deny colour, qualifies and refines in ink (the tally bar
// tells those two apart by the ink's depth)
const SV={accepts:['Suárez accepts','var(--affirms)'],refines:['Suárez refines','color-mix(in srgb,var(--fg) 40%,var(--card-bg))'],
  qualifies:['Suárez qualifies','color-mix(in srgb,var(--fg) 75%,var(--card-bg))'],rejects:['Suárez rejects','var(--denies)']};
const SVORDER=['accepts','refines','qualifies','rejects'];
// how the schools stand on a section's question, in the controversies page's words
const MKIND={contradiction:'They contradict',distinction:'A distinction, not a denial',emphasis:'A difference of emphasis',agreement:'They agree'};
const PATHW={thomist:'follows the Thomists',scotist:'follows the Scotists',suarezian:'follows Suárez',nominalist:'with the Nominalists',own:'his own way'};
const PATHO=['thomist','scotist','suarezian','nominalist','own','unplaced'];
// the module draws its era strip by shelf: here each school takes a shelf's place and, inside the band, that shelf's colour is the school's
const TGK={thomist:'gf',scotist:'pl',nominalist:'po',jesuit:'md',protestant:'lu',others:'x'};
const TGL={gf:'Thomists',pl:'Scotists',po:'Nominalists',md:'Jesuits',lu:'Protestants',x:'Others'};
const MOFF=new Set(),VOFF=new Set();
const yearOf=y=>(Number(y)<0?`${-Number(y)} BC`:String(y));
const lowerThe=l=>String(l||'').replace(/^The\b/,'the');
function holderChip(h,k,sn){
  const name=String(h.name||h.author||'').trim(),t=[h.author&&h.author!==h.name?h.author:'',h.year!=null&&h.year!==''?`born ${yearOf(h.year)}`:''].filter(Boolean).join(', '),st=`--sc:${mcol(k)}`;
  if(sn!=null)return `<a class="adv hol" href="#${esc([S.deck,S.part,S.place,`s${sn}`,`h${hslug(h)}`].join('/'))}" data-hsel="s${esc(sn)}/h${esc(hslug(h))}" style="${st}"${t?` title="${esc(t)}"`:''}><i class="dot" aria-hidden="true"></i>${esc(name)}</a>`;
  if(h.slug&&h.page!=null&&h.page!=='')return `<a class="adv hol" href="${read(h.slug,h.page)}" data-hol="${esc(h.slug)}|${esc(h.page)}" data-who="${esc(h.author||name)}" style="${st}"${t?` title="${esc(t)}"`:''}><i class="dot" aria-hidden="true"></i>${esc(name)}</a>`;
  return `<span class="adv" style="${st}"${t?` title="${esc(t)}"`:''}><i class="dot" aria-hidden="true"></i>${esc(name)}</span>`;
}
// an opinion's holders, once each, grouped under their schools' names so the colour is never the only carrier
function holdersHTML(hs,sn){
  const seen=new Set(),by=new Map();
  for(const h of hs||[]){const name=String(h.name||h.author||'').trim(),k=`${name}|${h.slug||''}`;if(!name||seen.has(k))continue;seen.add(k);const sc=mschool(h.school);if(!by.has(sc))by.set(sc,[]);by.get(sc).push(h);}
  return MSCH.filter(([k])=>by.has(k)).map(([k,l])=>`<span class="hg"><span class="hg-k">${l}</span> ${by.get(k).map(h=>holderChip(h,k,sn)).join(' ')}</span>`).join(' ');
}
// an opinion's schools: its own where the file names one, and its holders'; an opinion with neither stands with the others
function opSchools(o){const set=new Set();if(o.school)set.add(mschool(o.school));for(const h of o.holders||[])set.add(mschool(h.school));if(!set.size)set.add('others');return [...set];}
function opHTML(o,s,ctx,side,n){
  const sv=SV[o.suarez_on],pg=o.page!=null&&o.page!=='',hs=holdersHTML(o.holders,n),adopted=s.resolution_of!=null&&Number(s.resolution_of)===Number(o.i);
  return `<li class="op" id="${side}-s${esc(n)}-o${esc(o.i)}" data-sc="${opSchools(o).join(' ')}" data-sv="${esc(o.suarez_on||'')}">`
    +`<p class="op-h"><button type="button" class="op-l" data-osel="s${esc(n)}/o${esc(o.i)}">${esc(o.label||`Opinion ${Number(o.i)+1}`)}</button>${hs?` <span class="op-who">${hs}</span>`:''}</p>${o.position?`<p class="op-p">${esc(o.position)}</p>`:''}`
    +`${o.quote?qbHTML({quote:o.quote,w:ctx.slug,p:o.page,label:'As Suárez reports it',pl:`${ctx.short}, p. ${o.page}`}):''}`
    +`<p class="op-v">${sv?`<span class="sv sv-${esc(o.suarez_on)}">${sv[0]}</span>`:''}${adopted?' <span class="op-ad">his resolution adopts it</span>':''}`
    +`${pg&&!o.quote?` <span class="op-pg">${ccPg(ctx.slug,o.page,`${ctx.short}, p. ${o.page}`)}</span>`:''}</p></li>`;
}
// SUÁREZ RESOLVES: his resolution, his words set in, the page; where it takes up an opinion, that opinion named and a step to it
function resHTML(s,ctx,side,n){
  const r=s.suarez||{},ops=s.opinions||[],ad=s.resolution_of!=null?ops.find(o=>Number(o.i)===Number(s.resolution_of)):null,pg=r.page!=null&&r.page!=='';
  if(!r.resolution&&!r.quote)return '';
  return `<div class="res"><p class="res-h"><button type="button" class="res-b" data-osel="s${esc(n)}/r">Suárez resolves</button>${ad?`, adopting <button type="button" class="res-of" data-op="${side}-s${esc(n)}-o${esc(ad.i)}">${esc(lowerThe(ad.label||`opinion ${Number(ad.i)+1}`))}</button>`:''}</p>`
    +`${r.resolution?`<p class="res-t">${esc(r.resolution)}</p>`:''}`
    +`${r.quote?qbHTML({quote:r.quote,w:ctx.slug,p:r.page,pl:`${ctx.short}, p. ${r.page}`,clip:true,full:true})
      :pg?`<p class="ob-pg"><a href="${read(ctx.slug,r.page)}">${esc(ctx.short)}, p. ${esc(r.page)}</a> ${pvBtn(ctx.slug,r.page)}</p>`:''}</div>`;
}
// ── THE RECEPTION OF A SECTION AND THE WORKS THAT ANSWER A DISPUTATION (2026-10-22; owner: "someone did write a whole work against
// suarez make sure that guy is in there too"). v1/decks/metaphysics/reception/<part>/<d>.json, beside the props, gives the works that
// answer the disputation at length (answers) and each section's authors with their stance on Suárez, their claim, their words and the
// page (sections["<n>"].reception, reception_more, reception_set); v1/decks/metaphysics/adversaries.json lists the whole works written
// against Suárez with their places. Drawn only from the files: a disputation they do not reach shows nothing of them.
const STANCE={against:['Against Suárez','rejects'],for:['For Suárez','accepts'],qualifies:['Qualifies Suárez','qualifies']};
function recOf(s){
  const R=PL.rec&&PL.rec.sections;
  if(!R||!s)return null;
  const r=R[String(s.n)]||Object.values(R).find(x=>x&&x.id!=null&&String(x.id)===String(s.id));
  return r&&Array.isArray(r.reception)&&r.reception.length?r:null;
}
// the set finder's address as the file gives it: an address, or an object carrying one
function setHref(x){
  const u=typeof x==='string'?(/^(\/|https?:|\?|#)/.test(x)?x:''):x&&typeof x==='object'?String(x.href||x.url||''):'';
  return u.replace(/^\/controversies(?=[#?]|$)/,CONTRO);
}
function rcpRowHTML(r,s){
  const st=STANCE[r.stance],w=D.texts.works[r.slug]||[],work=r.work||w[1]||'',yr=r.year||w[4]||'',pg=r.page!=null&&r.page!==''&&!!r.slug,loc=String(r.locator||'').trim();
  return `<li class="rcp-r" data-st="${esc(r.stance||'')}" data-sc="${esc(mschool(r.school))}"><p class="rcp-h">${s?`<span class="rcp-s">Section ${esc(s.n)}</span> `:''}${st?`<span class="sv sv-${st[1]}">${st[0]}</span> `:''}<b>${esc(r.author||w[0]||'')}</b>${work?`, <em>${esc(work)}</em>`:''}${yr?`, ${esc(yearOf(yr))}`:''}</p>`
    +`${r.head?`<p class="rcp-hd">${esc(r.head)}</p>`:''}${r.claim?`<p class="rcp-c">${esc(r.claim)}</p>`:''}`
    +`${r.quote_en||r.quote_la?qbHTML({quote:r.quote_en,la:r.quote_la,w:r.slug,p:r.page,label:loc})
      :pg||loc?`<p class="ob-pg">${loc?`<span class="qb-t">${esc(loc)}</span> `:''}${pg?ccPg(r.slug,r.page):''}</p>`:''}</li>`;
}
// AMONG THE THOMISTS (and so on): a school divided, each side's holders and view, and the opinion each side holds
function intraHTML(intra,s,side,n){
  const lab=i=>{const o=(s.opinions||[]).find(x=>Number(x.i)===Number(i));return o?lowerThe(o.label||`opinion ${Number(i)+1}`):'';};
  return intra.map((x,xi)=>{const k=mschool(x.school);return `<div class="intra"><h5 class="in-h">${side==='a'?`<button type="button" class="in-b" data-osel="s${esc(n)}/i${xi}">Among the ${esc(x.school)}</button>`:`Among the ${esc(x.school)}`}</h5>${x.point?`<p class="in-p">${esc(x.point)}</p>`:''}`
    +`<ul class="in-sides">${(x.sides||[]).map(sd=>`<li><p class="in-who">${(sd.holders||[]).map(h=>`<span class="adv" style="--sc:${mcol(k)}"><i class="dot" aria-hidden="true"></i>${esc(h)}</span>`).join(' ')}</p>`
      +`<p class="in-v">${esc(sd.view||'')}${sd.opinion!=null&&lab(sd.opinion)?` <button type="button" class="res-of" data-op="${side}-s${esc(n)}-o${esc(sd.opinion)}">${esc(lab(sd.opinion))}</button>`:''}</p></li>`).join('')}</ul></div>`;}).join('');
}
// ── THE FOLDED GROUP (2026-10-22; owner: "make this collapsable"). A list that can run past a screen is a group with its count and a
// glimpse of what it holds, its rows one line each; in a set of groups (data-one), opening one closes the others, unless Find is
// narrowing the list, when every group with a match stays open.
const fold1=(one,sum,body,o={})=>`<details class="f1${o.cls?` ${o.cls}`:''}" data-one="${esc(one)}"${o.open?' open':''}><summary>${sum}</summary><div class="f1-b">${body}</div></details>`;
const peek=(names,n=3)=>{const xs=[...new Set(names.filter(Boolean))];return xs.length?`<span class="f1-t">${esc(xs.slice(0,n).join(', '))}${xs.length>n?', …':''}</span>`:'';};
document.addEventListener('toggle',e=>{
  const d=e.target;
  if(!d||!d.matches||!d.matches('details[data-one]')||!d.open)return;
  const box=d.parentElement;
  if(!box||box.closest('[data-finding]'))return;
  box.querySelectorAll(`:scope>details[data-one="${CSS.escape(d.dataset.one)}"][open]`).forEach(x=>{if(x!==d)x.open=false;});
},true);
// ── THE MAIN AND ITS EXPANSION (2026-10-22; owner: "think fo the conteovereiss as like a main ) with the right being expansion",
// "there can be more of a left side but its suppouse to be about suarez and and then reception after per disputation expandable with in
// their own words", and "i love suarez explaining, listing out opinions, his own resolution and our quotes"). The main pane lists the
// sections one line each and opens one as the controversies page draws a controversy: each opinion with its position as Suárez states
// it, its arguments with their pages, the words as Suárez reports them and in the holder's own; Suárez's resolution with his reasons,
// his arguments and his words; then, folded, who received him, by school, in their own words. The pane beside expands what is chosen.
const KSHORT={contradiction:'Contradict',distinction:'Distinction',emphasis:'Emphasis',agreement:'Agree'};
const dotsHTML=ks=>{const set=MSCH.filter(([k])=>ks.includes(k));return set.length?`<span class="row-dots" role="img" aria-label="${esc(set.map(([,l])=>l).join(', '))}">${set.map(([k])=>`<i style="--c:${mcol(k)}"></i>`).join('')}</span>`:'';};
const cnt=(n,one,many)=>(n?`${n} ${n===1?one:many}`:'');
function secRow(side,s,i,ctx){
  const n=String(s.n??i+1),ops=Array.isArray(s.opinions)?s.opinions:[],bid=`${side}-sb${esc(n)}`,ks=[...new Set(ops.flatMap(o=>opSchools(o)))],pg=s.page!=null&&s.page!=='';
  const links=[pg?`<a class="pg" href="${read(ctx.slug,s.page)}" data-pw="${esc(ctx.slug)}|${esc(s.page)}">${esc(ctx.short)}, ${s.end&&s.end!==s.page?`pp. ${esc(s.page)}–${esc(s.end)}`:`p. ${esc(s.page)}`}</a> ${pvBtn(ctx.slug,s.page)}`:'',s.question?`<a href="${CONTRO}#debate/thomists-scotists/${encodeURIComponent(s.question)}">The same question in the controversies</a>`:'',s.map?`<a href="${MAPSP}#${encodeURIComponent(s.map)}">On the map</a>`:''].filter(Boolean);
  return `<li class="pr sec ln1" id="${side}-s${esc(n)}" data-i="${i}"><div class="pr-m"><a class="pr-n" href="#${esc([S.deck,S.part,S.place,`s${n}`].join('/'))}" data-n="${esc(n)}" aria-label="Section ${esc(n)}"></a></div>`
    +`<div class="pr-b"><p class="row1"><button type="button" class="acc-t" aria-expanded="false" aria-controls="${bid}">${esc(s.q||s.place||'')}</button>`
    +`<span class="row-meta">${KSHORT[s.kind]?`<span>${KSHORT[s.kind]}</span>`:''}${ops.length?`<span>${cnt(ops.length,'opinion','opinions')}</span>`:''}<span class="row-v" data-v>${s.controversy?'':rowVerdict(s,null)}</span>${dotsHTML(ks)}</span></p>`
    +`<div class="acc-b tg" id="${bid}" hidden><p class="sec-at">${links.join(' · ')}${links.length?' · ':''}<button type="button" class="res-of" data-osel="s${esc(n)}/" data-sheet="1">Before and after Suárez</button></p>`
    +`${s.controversy?`<div class="cc-main" data-ctl="${esc(s.controversy)}" data-n="${esc(n)}"><p class="rec-note">Loading Suárez’s discussion…</p></div>`:viewsBoard(s,n,ctx)}`
    +`${rcvFoldHTML(s)}</div></div></li>`;
}
// the section's verdict, in a word or two: whom Suárez sides with, or his own way
function rowVerdict(s,c){
  if(c){const ops=ccOps(c),r=c.resolution||{},h=String(r.holder||'').trim(),side=!h||/^his own\b/i.test(h)?'':h,o=side?ops.find(x=>fold(x.holder)===fold(side)):null;
    if(!ops.length)return 'he concludes';
    return side?`${o?ccDot(o.school):''}with ${esc(side.split(/\s*\/\s*/)[0])}`:'his own way';}
  const ops=s.opinions||[],ad=s.resolution_of!=null?ops.find(o=>Number(o.i)===Number(s.resolution_of)):null;
  return ad?`adopts ${esc(lowerThe(ad.label||''))}`:(s.suarez&&s.suarez.resolution?'his own way':'');
}
// a section the controversies have not reached: the views as Suárez sets them out, with their holders, his verdict and his words, and
// his resolution with his words
function viewsBoard(s,n,ctx){
  const ops=s.opinions||[],c2=ctx||{slug:(PL.props||{}).slug,short:PRB().short};
  return `${ops.length?`<ol class="ops">${ops.map(o=>opHTML(o,s,c2,'a',n)).join('')}</ol>`:''}<div>${resHTML(s,c2,'a',n)}</div>`;
}
// WHO RECEIVED HIM, folded under the section: the readers by school, each with his passages on the section in his own words, his
// chapters with their pages and his path; drawn the first time it is opened (the whole works come with adversaries.json)
function rcvFoldHTML(s){
  const R=recOf(s),pr=(s.schools||[]).find(x=>x&&x.school==='protestant'),np=pr&&Array.isArray(pr.paths)?pr.paths.length:0;
  const na=(PL.rec&&Array.isArray(PL.rec.answers)?PL.rec.answers:[]).filter(a=>(a.sections||[]).map(String).includes(String(s.n))).length,nr=R?R.reception.length:0,more=R?Number(R.reception_more)||0:0;
  if(!nr&&!np&&!na)return '';
  return `<details class="rcv-fold" data-n="${esc(s.n)}"><summary><h4 class="rcv-sh">Who received him</h4> <span class="cc-ct">${[cnt(nr+more,'answer','answers'),cnt(na,'work at length','works at length'),cnt(np,'Reformed or Lutheran','Reformed and Lutherans')].filter(Boolean).join(' · ')}</span></summary><div class="rcv-in"><p class="rec-note">Gathering his readers…</p></div></details>`;
}
async function rcvFoldFill(det){
  const box=det.querySelector('.rcv-in');
  if(!box||box.dataset.done)return;
  box.dataset.done='1';
  const s=((PANE.a._P||{}).sections||[]).find(x=>String(x.n)===String(det.dataset.n));
  if(!s)return;
  const A=await advFile(),list=receiversOf(s,A);
  if(!box.isConnected)return;
  const by=new Map();for(const x of list){const g=rgroup(x);if(!by.has(g))by.set(g,[]);by.get(g).push(x);}
  const yr=x=>x.year||(TG&&TG.dates?TG.dates.year(x.author):0)||0,sorted=g=>by.get(g).sort((a,b)=>(yr(a)||9999)-(yr(b)||9999));
  const R=recOf(s),more=R?Number(R.reception_more)||0:0,href=R?setHref(R.reception_set):'';
  const claim=x=>{const r=x.rows.find(y=>y.claim)||x.rows[0];return r?r.claim||r.head||'':x.answers[0]?x.answers[0].heading||'':x.paths[0]?x.paths[0].position||'':(x.works[0]&&x.works[0].title)||'';};
  const npass=x=>x.rows.filter(r=>r.quote_en||r.quote_la).length+x.answers.reduce((n,a)=>n+(a.quotes||[]).length,0)+x.paths.filter(e=>e.quote).length;
  box.innerHTML=`<div class="f1-set">${RGROUPS.filter(([g])=>by.has(g)).map(([g,l],gi)=>fold1(`rcvl-${s.n}`,`<i class="dot" style="--sc:${RCOL[g]||mcol(g)}" aria-hidden="true"></i><span class="f1-k">${l}</span> <span class="cc-ct">${by.get(g).length}</span>${peek(sorted(g).map(x=>x.author))}`,
    `<ol class="f1-rows">${sorted(g).map(x=>{const y=yr(x),np=npass(x);return `<li><button type="button" class="f1-row" data-osel="s${esc(s.n)}/w${esc(x.key)}" data-sheet="1"><span class="f1-k">${esc(x.author)}</span><span class="f1-n">${[y?yearOf(y):'',np?`${np} ${np===1?'passage':'passages'}`:''].filter(Boolean).join(' · ')}</span>${x.whole?'<small class="rcv-tag">whole work</small>':''}<span class="f1-t">${esc(claim(x))}</span></button></li>`;}).join('')}</ol>`,{open:gi===0})).join('')}</div>`
    +`${more?`<p class="rcp-more">${href?`<a href="${esc(href)}">+${fmtN(more)} more</a>`:`+${fmtN(more)} more`}</p>`:''}`;
}
// one reader in the fold: his name (his reading beside), his year, a whole work marked; his first passage on the section in full (its
// claim, his words, the page); his chapters on the disputation one line each; the rest of his passages read beside
function rcvInlineHTML(s,x){
  const y=x.year||(TG&&TG.dates?TG.dates.year(x.author):0)||0,go=`s${esc(s.n)}/w${esc(x.key)}`;
  const first=x.rows.find(r=>r.quote_en||r.quote_la)||x.rows[0],fa=!first&&x.answers.find(a=>(a.quotes||[]).length),fp=!first&&!fa&&x.paths.find(e=>e.quote);
  const npass=x.rows.length+x.answers.reduce((n,a)=>n+(a.quotes||[]).length,0)+x.paths.filter(e=>e.quote).length,shown=first||fa||fp?1:0;
  let lead='';
  if(first){const st=STANCE[first.stance],loc=String(first.locator||'').trim(),pg=first.page!=null&&first.page!==''&&!!first.slug;
    lead=`<p class="rcp-h">${st?`<span class="sv sv-${st[1]}">${st[0]}</span> `:''}${first.work?`<em>${esc(first.work)}</em>`:''}</p>${first.claim?`<p class="rcp-c">${esc(first.claim)}</p>`:''}`
      +`${first.quote_en||first.quote_la?qbHTML({quote:first.quote_en,la:first.quote_la,w:first.slug,p:first.page,label:loc,one:true}):pg||loc?`<p class="ob-pg">${loc?`<span class="qb-t">${esc(loc)}</span> `:''}${pg?ccPg(first.slug,first.page):''}</p>`:''}`;}
  else if(fa){const q=fa.quotes[0];lead=`<p class="rcp-h"><em>${esc(fa.work||'')}</em></p>${fa.heading?`<p class="rcp-hd">${esc(fa.heading)}</p>`:''}${qbHTML({quote:q.en,la:q.la,w:fa.slug,p:q.page,one:true})}`;}
  else if(fp)lead=`<p class="rcp-h">${esc(PATHW[fp.path]?cap1(PATHW[fp.path]):'His path')}</p>${fp.position?`<p class="rcp-c">${esc(fp.position)}</p>`:''}${qbHTML({quote:fp.quote,w:fp.slug,p:fp.page,one:true})}`;
  const chs=x.works.flatMap(w=>(w.entries||[]).filter(e=>e&&String(e.d)===String(S.place)).map(e=>`<li><span>${esc(e.heading||'')}</span>${ccPg(w.slug,e.page,e.end!=null&&e.end!==''&&String(e.end)!==String(e.page)?`pp. ${e.page}–${e.end}`:`p. ${e.page}`)}</li>`));
  const rest=npass-shown;
  return `<article class="rcv-one"><p class="rcv-nm"><button type="button" class="cc-sel" data-osel="${go}">${esc(x.author)}</button>${y?` <small>${esc(yearOf(y))}</small>`:''}${x.whole?' <small class="rcv-tag">whole work</small>':''}</p>`
    +`${lead}${chs.length?`<ol class="cc-rows rcv-chs">${chs.join('')}</ol>`:''}${rest>0?`<p class="rcp-more"><button type="button" class="res-of" data-osel="${go}" data-sheet="1">${rest} more ${rest===1?'passage':'passages'} beside</button></p>`:''}</article>`;
}
// THE BAND under the disputation's head: the opinions' holders by school (a share bar), Suárez's verdicts on the opinions (a tally in the
// verdict colours), and the holders through time (the module's era strip: a holder once, at his birth year, in his school's colour, the
// legend switching a school off, the readout naming a column)
function mGraphHTML(P){
  const g=P.graph||{};
  if(!TG)return '';
  const sb=g.schools_by_opinion||{},parts=MSCH.filter(([k])=>Number(sb[k])>0).map(([k,l])=>({l,n:Number(sb[k]),c:mcol(k)}));
  const so=g.suarez_on||{},vs=SVORDER.filter(k=>Number(so[k])>0).map(k=>({l:SV[k][0],n:Number(so[k]),c:SV[k][1]}));
  const seen=new Set(),cnt=new Map(),items=[],early=[];
  for(const [name,y,sch] of g.timeline||[]){
    const nm=String(name||'').trim(),yy=Number(y);
    if(!nm)continue;
    cnt.set(nm,(cnt.get(nm)||0)+1);
    if(seen.has(nm))continue;
    seen.add(nm);
    if(yy>0&&yy<2100)items.push({y:yy,t:TGK[mschool(sch)],name:nm});else if(yy<0)early.push(nm);
  }
  const R=PL.rec&&PL.rec.sections?Object.values(PL.rec.sections):[];
  for(const x of R)for(const r of (x&&x.reception)||[]){const nm=String(r.author||'').trim(),yy=Number(r.year);if(!nm||seen.has(nm))continue;seen.add(nm);if(yy>0&&yy<2100)items.push({y:yy,t:TGK[mschool(r.school)],name:nm});}
  const marks=[{y:SUAREZ_Y,label:'Suárez',p:-1}].concat(items.slice().sort((a,b)=>(cnt.get(b.name)-cnt.get(a.name))||(a.y-b.y)).map((x,i)=>({y:x.y,label:x.name,p:i})));
  const strip=items.length?TG.eraStrip(TG.bin(items,25),{unit:'author',units:'authors',labels:TGL,title:'Authors Suárez cites and authors who received him, by birth year',legendLabel:'Schools shown',marks}):'';
  const box=(h,body)=>`<div class="pg-c"><h3 class="pg-h">${h}</h3>${body}</div>`;
  return `<section class="pgraph pg-schools tg" aria-label="This disputation in figures">${parts.length?box('The opinions’ holders, by school',tgBar(parts,'The holders of the opinions in this disputation, by school')):''}`
    +`${vs.length?box('Suárez’s verdicts on the opinions',tgBar(vs,'Suárez’s verdicts on the opinions of this disputation')):''}`
    +`${strip?`<div class="pg-wide"><h3 class="pg-h">Before and after Suárez</h3>${strip}${early.length?`<p class="pg-note">Earlier than the chart: ${esc(early.join(', '))}</p>`:''}</div>`:''}</section>`;
}
async function paneSections(side){
  const host=PANE[side],P=PL.props,cfg=PRB(),cs=commentators(true),key=['secs',PL.key,LANE,PL.rec?1:0].join('|');
  RUN[side]++;
  if(SHOWN[side]===key){if(host._art!==S.art){host._art=S.art;accOpen(host,accKey());jumpProb(side);}return;}
  SHOWN[side]=key;host.dataset.moved='';host._art=S.art;host._P=P;host._mv=[];host._q='';host._secs=true;host._rid=++RID;
  TEXTNAME[S.deck]=baseName();
  const [h2g,subg]=heading(),ss=P.sections,ctx={slug:P.slug,short:cfg.short};
  host._pi=ss.map(s=>({hay:fold([s.q,s.place,...(s.opinions||[]).flatMap(o=>[o.label,o.position,...(o.holders||[]).map(h=>`${h.name} ${h.author}`)]),(s.suarez||{}).resolution,...(s.terms||[]),...((recOf(s)||{}).reception||[]).flatMap(r=>[r.author,r.work,r.claim])].join(' '))}));
  const opsAll=ss.flatMap(s=>s.opinions||[]),nPaths=ss.reduce((a,s)=>a+(((s.schools||[]).find(x=>x&&x.school==='protestant')||{}).paths||[]).length,0);
  const bySch={};
  for(const o of opsAll)for(const k of opSchools(o))bySch[k]=(bySch[k]||0)+1;
  if(nPaths)bySch.protestant=nPaths;
  const schoolT=MSCH.filter(([k])=>bySch[k]).map(([k,l])=>`<button type="button" class="ptog mtog" data-ms="${k}" aria-pressed="true"><i class="tg-sw" style="--c:${mcol(k)}" aria-hidden="true"></i>${l} <small>${bySch[k]}</small></button>`).join('');
  const pages=ss.map(s=>Number(s.page)).filter(x=>Number.isFinite(x)&&x>0),from=Number(P.from)||(pages.length?Math.min(...pages):null),to=Number(P.to)||(pages.length?Math.max(...pages):null);
  host.innerHTML=`<header class="ph"><div class="ph-row">${sourceSelect(side,cs,'')}${P.slug&&from?`<a class="open" href="${read(P.slug,from)}">Open in the reader ↗</a>`:''}</div>
    <h2>${esc(P.title||h2g)}</h2><p class="what">${esc([P.title_la,partName(S.part)].filter(Boolean).join(' · ')||subg)}</p>
    <p class="pbase">${esc(baseLabel())}${from?`, ${from===to?`p. ${from}`:`pp. ${from}–${to}`}`:''}</p></header>`
    +`<div class="scroll pscroll">${P.summary?`<p class="psum" id="${side}-psum">${esc(P.summary)}</p><button type="button" class="psum-more" aria-expanded="false" aria-controls="${side}-psum" hidden>More</button>`:''}${mGraphHTML(P)}`
    +`<div class="pctl">${schoolT?`<div class="pfilter" role="group" aria-label="The schools shown"><span class="pf-k">Schools</span>${schoolT}</div>`:''}`
    +`<div class="prow"><input class="pfind" type="search" autocomplete="off" spellcheck="false" placeholder="Find a section…" aria-label="Find a section in this ${noun()}"><p class="pcount" role="status"></p></div></div>`
    +`<ol class="probs secs acc">${ss.map((s,i)=>secRow(side,s,i,ctx)).join('')}</ol><p class="note pnone" hidden>None of the sections in this ${noun()} match.</p>`
    +`${P.slug&&to?`<p class="end"><a href="${read(P.slug,to)}">Read on in the reader ↗</a></p>`:''}</div>`;
  const sc=host.querySelector('.pscroll'),ctl=host.querySelector('.pctl');
  if(host._ro)host._ro.disconnect();
  if(sc&&ctl&&typeof ResizeObserver==='function'){host._ro=new ResizeObserver(()=>{sc.style.scrollPaddingTop=getComputedStyle(ctl).position==='sticky'?`${ctl.offsetHeight+8}px`:'';});host._ro.observe(ctl);}
  if(TG){TG.mount(host);TG.layout(host);}
  clampMore(host);
  applySections(side);
  accOpen(host,accKey());
  markSel();
  jumpProb(side);
  fillCards(side);
}
// the summary in three lines, the rest a step away
function clampMore(host){
  requestAnimationFrame(()=>{const p=host.querySelector('.psum'),b=host.querySelector('.psum-more');if(p&&b)b.hidden=p.scrollHeight<=p.clientHeight+2;});
}
// the cards come with the pair file: each section's opinions and resolution drawn in its row, its verdict on its line, its words added
// to what Find reads; a section the controversies have not reached keeps the views of the props
async function fillCards(side){
  const host=PANE[side],rid=host._rid,pf=await pairFile();
  if(host._rid!==rid)return;
  const P=host._P;
  host.querySelectorAll('.cc-main[data-ctl]').forEach(box=>{
    const li=box.closest('.pr'),i=Number(li.dataset.i),s=P.sections[i],c=pf&&pf._by.get(box.dataset.ctl),v=li.querySelector('.row-v');
    if(!c){box.outerHTML=viewsBoard(s,box.dataset.n);if(v)v.innerHTML=rowVerdict(s,null);return;}
    box.innerHTML=ccMainHTML(c,box.dataset.n,s);
    if(v)v.innerHTML=rowVerdict(s,c);
    if(host._pi[i])host._pi[i].hay+=` ${fold(ccText(c))}`;
  });
  applySections(side);
  markSel();
  if(TG)TG.layout(host);
  qbAuto(host);
  qbFullAll(host);
}
function applySections(side){
  const host=PANE[side],info=host._pi||[],q=fold(host._q||'');
  let shown=0;
  host.querySelectorAll('.secs>.pr').forEach(li=>{const x=info[Number(li.dataset.i)]||{hay:''},ok=!q||x.hay.includes(q);li.hidden=!ok;if(ok)shown++;});
  host.querySelectorAll('.cc-main .cc-op[data-sc],.secs .op[data-sc]').forEach(o=>{o.toggleAttribute('data-dim',String(o.dataset.sc||'others').split(' ').every(k=>MOFF.has(k)));});
  host.querySelectorAll('[data-ms]').forEach(b=>b.setAttribute('aria-pressed',String(!MOFF.has(b.dataset.ms))));
  const n=info.length,c=host.querySelector('.pcount'),none=host.querySelector('.pnone');
  if(c)c.textContent=`${shown===n?n:`${shown} of ${n}`} ${n===1?'section':'sections'} in this ${noun()}`;
  if(none)none.hidden=shown>0;
}
const applyView=side=>(PANE[side]._secs?applySections(side):applyProbs(side));
// THE DOSSIER (2026-10-22; owner on the Suárez deck: "i dont like this deck because it doesnt allow me to click and expand on the side
// … i cant expand and see what each view holds in suarez discussion and us tracking down reception", "works beside the page is good to
// have at the same time it doesnt work as a good onramp", and of the controversies' Suárez pair: "this is great"). The right pane of the
// Suárez deck and of the two problems decks has two modes, switched quietly at its head: the dossier of what is chosen on the left
// ("This section", "This problem") and the works beside. On the Suárez deck the dossier is the controversy as the controversies page
// draws it (its card's code lifted below, its classes prefixed cc-), the chosen view marked in it, and its reception under it: who holds
// the view, its place on the map of the tradition, the atlas's answers, the Reformed and Lutheran metaphysicians on its path. A holder
// chosen on the left has his own dossier. On a phone the dossier rises in the sheet the page window uses.
const DOSDECK=()=>S.deck==='metaphysics'||S.deck==='reformed'||S.deck==='lutheran';
const RMODE={};
const rmode=()=>isPhone()?'works':RMODE[S.deck]||'dossier';
// the controversies' Suárez pair, the maps' and the atlas's question files: each fetched once
let PAIRP=null,PAIRD=null;
const pairFile=()=>PAIRP||(PAIRP=J('/v1/enrich/controversies/suarez-schools.json').then(d=>{if(!d||!Array.isArray(d.controversies)){PAIRP=null;return null;}d._by=new Map(d.controversies.map(c=>[c.id,c]));PAIRD=d;return d;}));
const QF=new Map();
const qfile=(kind,id)=>memo(QF,`${kind}/${id}`,()=>J(`/v1/${kind}/q/${encodeURIComponent(id)}.json`));
const hslug=h=>fold(h.author||h.name).replace(/\s+/g,'-');
const cap1=t=>String(t||'').replace(/^./,c=>c.toUpperCase());
// ── THE CONTROVERSY CARD, as controversies.html draws one (show, opinionsHTML, resolutionHTML, quoteHTML): the question, where the
// schools stand, where it is treated and its source; each opinion with its holder and school, the position as Suárez states it, the
// arguments with their pages, the holder's own words; then Suárez's resolution, his arguments and his own words. Every page with Preview.
const CC_SCHOOL=[[/thomist/i,'thomist'],[/scotist/i,'scotist'],[/nominalist/i,'nominalist'],[/jesuit/i,'jesuit']];
const ccKey=s=>(CC_SCHOOL.find(([re])=>re.test(s||''))||[])[1]||'others';
const ccDot=s=>(s?`<i class="dot" style="--sc:${mcol(ccKey(s))}" aria-hidden="true"></i>`:'');
const ccSch=s=>(s?`<span class="cc-sch">, ${esc(s)}</span>`:'');
const ccPg=(w,p,label)=>(p!=null&&p!==''&&w?`<span class="pgs"><a class="pg" href="${read(w,p)}" data-pw="${esc(w)}|${esc(p)}">${esc(label||`p. ${p}`)}</a> ${pvBtn(w,p)}</span>`:'');
const CC_WORDS=[[/thomist/i,'Thomist'],[/scotist/i,'Scotist'],[/nominalist/i,'Nominalist'],[/jesuit/i,'Jesuit'],[/augustinian/i,'Augustinian']];
const ccOps=c=>(c.opinions||[]).map(o=>{const au=o.author||'';let s=o.school||'';if(!s&&!au)for(const [re,x] of CC_WORDS)if(re.test(o.holder||'')){s=x;break;}
  return {holder:o.holder||au||'',author:au,school:s,reported:o.reported||'',args:o.arguments||[],position:o.position||'',picks:o.picks||[]};});
const ccMany=n=>/;|\band\b|\b(divines|academy|acts|salamanticenses)\b/i.test(n||'')||/^(the|schools|papists|opponents)\b/i.test(n||'');
const ccArgs=(w,args)=>(args.length?`<h5 class="cc-lbl">Arguments <span class="cc-ct">${args.length}</span></h5><ol class="cc-rows cc-args">${args.map(a=>`<li><span>${esc(a.arg)}</span>${ccPg(w,a.page)}</li>`).join('')}</ol>`:'');
// a passage the controversies picked: the holder's own words with the work and the page
const ccPick=q=>qbHTML({quote:q.quote,w:q.w,p:q.p,label:q.t,says:q.says});
function ccOpHTML(c,o,i,n){
  const p=ccMany(o.author||o.holder)?'their':'his',same=!!o.author&&fold(o.author)===fold(o.holder),{w} = c.source||{},name=esc(o.holder);
  return `<section class="cc-op" data-cco="${i}" data-sc="${ccKey(o.school)}">${/\bopinion\b/i.test(o.holder)?'':`<p class="cc-opn">Opinion ${i+1}</p>`}<h4 class="cc-oph">${ccDot(o.school)}${n!=null?`<button type="button" class="cc-sel" data-osel="s${esc(n)}/c${i}">${name}</button>`:name}${ccSch(o.school)}</h4>${o.author&&!same?`<p class="cc-who">${esc(o.author)}</p>`:''}`
    +`<h5 class="cc-lbl">Position, as Suárez states it</h5><p class="cc-pos">${o.reported?esc(o.reported):'<span class="cc-muted">Not stated.</span>'}</p>${ccArgs(w,o.args)}`
    +`${o.picks.length?`<h5 class="cc-lbl">In ${p} own words <span class="cc-ct">${o.picks.length}</span></h5>${o.position?`<p class="cc-gist">${esc(o.position)}</p>`:''}${o.picks.map(ccPick).join('')}`:''}</section>`;
}
function ccSideHTML(c,side){
  const s=c[side]||{},own=s.picks||[],name=side==='a'?'Suárez':(s.name||'The schools');
  return `<section class="cc-op" data-cco="${side}"><h4 class="cc-oph">${esc(name)}</h4><h5 class="cc-lbl">Position, as Suárez states it</h5><p class="cc-pos">${s.reported?esc(s.reported):'<span class="cc-muted">Not stated.</span>'}</p>${ccArgs((c.source||{}).w,s.arguments||[])}`
    +`${own.length?`<h5 class="cc-lbl">In ${side==='a'?'his':'their'} own words <span class="cc-ct">${own.length}</span></h5>${s.position?`<p class="cc-gist">${esc(s.position)}</p>`:''}${own.map(ccPick).join('')}`:''}</section>`;
}
// Suárez's judgment: whom he sides with or his own way, his reasons at their page, his arguments, his own words (where the
// controversies picked none, the props' words from his resolution, cut where the file cuts them)
function ccJudgHTML(c,n,s){
  const src=c.source||{},ops=ccOps(c),r=c.resolution||{},jd=c.judgment||{},h=String(r.holder||'').trim(),side=!h||/^his own\b/i.test(h)?'':h,o=side?ops.find(x=>fold(x.holder)===fold(side)):null;
  const a=c.a||{},picks=a.picks||[],why=r.why||jd.why||'',wpage=r.page||jd.page,sr=(s&&s.suarez)||{};
  const head=`Suárez ${ops.length?(side?`sides with ${o?ccDot(o.school):''}${esc(side)}`:'resolves it his own way'):'concludes'}`;
  const own=ops.length&&picks.length?`<h5 class="cc-lbl">In his own words <span class="cc-ct">${picks.length}</span></h5>${a.position?`<p class="cc-gist">${esc(a.position)}</p>`:''}${picks.map(ccPick).join('')}`
    :!picks.length&&sr.quote&&src.w?`<h5 class="cc-lbl">In his own words</h5>${qbHTML({quote:sr.quote,w:src.w,p:sr.page,label:(D.texts.works[src.w]||[])[1]||'',clip:true,full:true})}`:'';
  return `<section class="cc-judgment" data-cco="r"><h4 class="cc-jdh">${n!=null?`<button type="button" class="cc-sel" data-osel="s${esc(n)}/r">${head}</button>`:head}</h4><div class="cc-r1"><p>${why?esc(why):'<span class="cc-muted">Not stated.</span>'}</p>${ccPg(src.w,wpage)}</div>`
    +`${ops.length?ccArgs(src.w,a.arguments||[]).replace('Arguments','His arguments'):''}${own}</section>`;
}
const ccPicksN=c=>['a','b'].reduce((n,k)=>n+(((c[k]||{}).picks)||[]).length,0)+(c.opinions||[]).reduce((n,o)=>n+(o.picks||[]).length,0);
const ccText=c=>[c.question,c.place,...ccOps(c).flatMap(o=>[o.holder,o.author,o.school,o.reported,...o.args.map(a=>a.arg)]),(c.resolution||{}).why,(c.a||{}).reported,(c.b||{}).reported].join(' ');
// a section's controversy in the main pane, as the controversies page draws it: every opinion in full with the words as Suárez reports
// them where the props carry them, then Suárez's resolution in full
function ccMainHTML(c,n,s){
  const ops=ccOps(c),P=PL.props;
  const reported=k=>(s.opinions||[]).filter(v=>v.quote&&ccMatch(c,s,v)===k).map(v=>`<h5 class="cc-lbl">As Suárez reports it</h5>${qbHTML({quote:v.quote,w:P.slug,p:v.page,label:`${PRB().short}, ${lowerThe(v.label||'')}`})}`).join('');
  const body=ops.length?`<div class="cc-ops">${ops.map((o,k)=>ccOpHTML(c,o,k,n).replace(/<\/section>$/,`${reported(k)}</section>`)).join('')}</div>`:`<div class="cc-ops">${ccSideHTML(c,'a')}${ccSideHTML(c,'b')}</div>`;
  return body+ccJudgHTML(c,n,s)+(!ccPicksN(c)&&!(s&&s.suarez&&s.suarez.quote)&&!(s.opinions||[]).some(v=>v.quote)?'<p class="qb-none">No passage picked</p>':'');
}
// a view on the left and an opinion of the card: the names they share (the view's first holder counting most), how near the card's
// arguments stand to the view's page, and the words their statements share; the card's opinion for a view, the view for a card's opinion
const nmf=x=>fold(x).replace(/^(?:st|saint|s|b|blessed|the)\s+/,'');
function ccScore(p,o){
  const hs=o.holders||[],hay=` ${fold(p.holder)} `,au=fold(p.author||''),op=Number(o.page);
  let n=0;
  hs.forEach((h,k)=>{const a=fold(h.author||''),nm=nmf(h.name||h.author||'');if((a&&a===au)||(nm.length>2&&hay.includes(` ${nm} `)))n+=k===0?3:2;});
  const pg=(p.args||[]).map(a=>Number(a.page)).filter(Boolean);
  if(op&&pg.length){const d=Math.min(...pg.map(x=>Math.abs(x-op)));n+=d===0?3:d<=1?2:d<=3?1:0;}
  const ow=new Set(fold(o.position||'').split(' ').filter(x=>x.length>4)),pw=new Set(fold(p.reported||'').split(' ').filter(x=>x.length>4));
  if(ow.size&&pw.size){let k=0;for(const x of ow)if(pw.has(x))k++;n+=Math.min(3,Math.round(10*k/Math.max(1,ow.size+pw.size-k)));}
  return n;
}
function ccMatch(c,s,o){
  let best=-1,score=0;
  ccOps(c).forEach((p,i)=>{const n=ccScore(p,o);if(n>score){score=n;best=i;}});
  return score>=3?best:-1;
}
// ── RECEPTION: who holds the view (his school, his birth year, a small strip of them in time), the map's position for it, the atlas's
// answers to the question, the Reformed and Lutheran metaphysicians who take its path or another, the splits inside a school; links
const PATHFOR={thomist:['thomist'],scotist:['scotist'],nominalist:['nominalist'],jesuit:['suarezian']};
function holdersBy(hs){
  const seen=new Set(),by=new Map();
  for(const h of hs||[]){const name=String(h.name||h.author||'').trim(),k=`${name}|${h.slug||''}`;if(!name||seen.has(k))continue;seen.add(k);const sc=mschool(h.school);if(!by.has(sc))by.set(sc,[]);by.get(sc).push(h);}
  return by;
}
// the holders the props name in a section, once each; those a card's opinion names, by its author or a name in its heading (a name the
// props do not hold stands as a plain chip)
function secHolders(s){const seen=new Set(),out=[];for(const o of s.opinions||[])for(const h of o.holders||[]){const k=fold(h.author||h.name);if(!k||seen.has(k))continue;seen.add(k);out.push(h);}return out;}
function cardHolders(s,o){
  const toks=new Set(String(o.holder||'').split(/\s*(?:\/|;|,|\band\b)\s*/i).map(nmf).filter(x=>x.length>2)),au=fold(o.author||'');
  const hs=secHolders(s).filter(h=>(au&&fold(h.author||'')===au)||toks.has(nmf(h.name||''))||toks.has(nmf(h.author||'')));
  if(hs.length)return hs;
  const name=o.author||o.holder;
  return name&&!/\bopinion\b/i.test(name)?[{name:o.holder||name,author:o.author||'',school:ccKey(o.school)==='others'?'':ccKey(o.school),year:null,_plain:true}]:[];
}
// what a choice names: a view of the props, an opinion of the card, Suárez's resolution; its holders and the paths that follow it
function selInfo(s,sel,c){
  if(/^o\d+$/.test(sel||'')){const op=(s.opinions||[]).find(o=>`o${o.i}`===sel);if(op)return {kind:'o',label:cap1(op.label||`Opinion ${Number(op.i)+1}`),holders:op.holders||[],ways:[...new Set(opSchools(op).flatMap(k=>PATHFOR[k]||[]))]};}
  if(/^c\d+$/.test(sel||'')&&c){const o=ccOps(c)[Number(sel.slice(1))];if(o)return {kind:'c',label:`${o.holder}${o.school?`, ${o.school}`:''}`,holders:cardHolders(s,o),ways:PATHFOR[ccKey(o.school)]||[]};}
  if(sel==='r')return {kind:'r',label:'Suárez’s resolution',holders:null,ways:['suarezian']};
  return null;
}
// BEFORE AND AFTER SUÁREZ, under the reading: one strip of the authors he cites and those who received him; whom he cites by school;
// who received him by school or tradition, one chip each with his year and his pages here (a whole work marked as one), each read beside;
// the map, the atlas and the other addresses of the question
function recHTML(s,sel,c){
  const info=selInfo(s,sel,c),hs=info?info.holders:secHolders(s);
  const links=[s.question?`<a href="${CONTRO}#debate/thomists-scotists/${encodeURIComponent(s.question)}">the same question in the controversies</a>`:'',s.map?`<a href="${MAPSP}#${encodeURIComponent(s.map)}">on the map</a>`:'',s.question?`<a href="${ATLASP}#${encodeURIComponent(s.question)}">in the atlas</a>`:''].filter(Boolean);
  const terms=(s.terms||[]).filter(Boolean);
  return `<section class="rec" aria-labelledby="rec-h"><h3 class="rec-hh" id="rec-h">Before and after Suárez</h3>${info?`<p class="rec-for">${esc(info.label)}</p>`:''}`
    +`<div class="pv-box" data-pv><p class="rec-note">Drawing the authors in time…</p></div>`
    +`<h4 class="pv-h">Whom he cites</h4>`
    +`${info&&info.kind==='r'?'<p class="rec-note">The authors he weighs are under the opinions.</p>':hs&&hs.length?citedHTML(hs,s.n):'<p class="rec-note">Suárez names no holder we can place.</p>'}`
    +`${(s.intra||[]).length?`<p class="rec-sub">Divided inside a school</p><div class="intras">${intraHTML(s.intra,s,'b',String(s.n))}</div>`:''}`
    +`<h4 class="pv-h" id="rcv-h">Who received him</h4><div class="rcv-box" data-rcv><p class="rec-note">Gathering his readers…</p></div>`
    +`<h4 class="pv-h">Across the tradition</h4>`
    +`${s.map?`<div class="rec-map tg" data-map="${esc(s.map)}"><p class="rec-note">Loading the map…</p></div>`:''}`
    +`${s.question?`<div class="rec-atlas tg" data-atlas="${esc(s.question)}"><p class="rec-note">Loading the answers…</p></div>`:''}`
    +`${links.length||terms.length?`<p class="sec-links rec-links">${links.length?`Elsewhere: ${links.join(', ')}.`:''}${terms.length?` <span class="sec-lk">Terms</span> ${terms.map(t=>`<a href="${LEXP}#${encodeURIComponent(t)}">${esc(String(t).replace(/-/g,' '))}</a>`).join(', ')}`:''}</p>`:''}</section>`;
}
// THE READERS OF A SECTION, by school or tradition: the reception rows, the works that answer the disputation at length, the whole
// works and courses written against Suárez (adversaries.json), the Reformed and Lutheran metaphysicians on the question; one entry an
// author, his pages here counted once
const RGROUPS=[['thomist','Thomists'],['scotist','Scotists'],['nominalist','Nominalists'],['jesuit','Jesuits'],['reformed','Reformed'],['lutheran','Lutherans'],['others','Others']];
const RCOL={reformed:'var(--tg-rf)',lutheran:'var(--tg-lu)'};
function rgroup(x){
  const t=`${x.school||''} ${x.tradition||''}`.toLowerCase();
  if(/luther/.test(t))return 'lutheran';
  if(/reform|calvin|puritan|english/.test(t))return 'reformed';
  const k=mschool(x.school||'');
  if(k!=='others'&&k!=='protestant')return k;
  return /thomist|dominican/.test(t)?'thomist':/scotist|franciscan/.test(t)?'scotist':/jesuit/.test(t)?'jesuit':/nominalist/.test(t)?'nominalist':'others';
}
function receiversOf(s,A){
  const map=new Map(),R=recOf(s),pr=(s.schools||[]).find(x=>x&&x.school==='protestant'),paths=pr&&Array.isArray(pr.paths)?pr.paths:[];
  const get=(author,src)=>{const k=hslug({author});if(!k)return null;if(!map.has(k))map.set(k,{key:k,author,year:null,school:'',tradition:'',pages:new Set(),rows:[],answers:[],works:[],paths:[],whole:false});const x=map.get(k);
    if(!x.year&&Number(src.year))x.year=Number(src.year);if(!x.school&&src.school)x.school=src.school;if(!x.tradition&&src.tradition)x.tradition=src.tradition;return x;};
  for(const r of R?R.reception:[]){const x=get(r.author,r);if(!x)continue;x.rows.push(r);if(r.slug&&r.page!=null)x.pages.add(`${r.slug}|${r.page}`);}
  for(const a of (PL.rec&&Array.isArray(PL.rec.answers)?PL.rec.answers:[]))if((a.sections||[]).map(String).includes(String(s.n))){const x=get(a.author,a);if(!x)continue;x.answers.push(a);if(a.slug&&a.page!=null)x.pages.add(`${a.slug}|${a.page}`);}
  for(const w of advFor(A,S.place,s.n)){const x=get(w.author,w);if(!x)continue;x.works.push(w);if(w.kind==='whole work')x.whole=true;for(const e of w.entries||[])if(e&&String(e.d)===String(S.place)&&e.page!=null)x.pages.add(`${w.slug}|${e.page}`);}
  for(const e of paths){const x=get(e.author,e);if(!x)continue;x.paths.push(e);if(e.slug&&e.page!=null)x.pages.add(`${e.slug}|${e.page}`);}
  return [...map.values()];
}
function receiversHTML(s,list){
  if(!list.length)return '<p class="rec-note rec-none">No reader of Suárez is recorded on this section.</p>';
  const by=new Map();for(const x of list){const g=rgroup(x);if(!by.has(g))by.set(g,[]);by.get(g).push(x);}
  const yr=x=>x.year||(TG&&TG.dates?TG.dates.year(x.author):0)||0,sorted=g=>by.get(g).sort((a,b)=>(yr(a)||9999)-(yr(b)||9999));
  return `<div class="f1-set">${RGROUPS.filter(([g])=>by.has(g)).map(([g,l],gi)=>fold1(`rcv-${s.n}`,`<i class="dot" style="--sc:${RCOL[g]||mcol(g)}" aria-hidden="true"></i><span class="f1-k">${l}</span> <span class="cc-ct">${by.get(g).length}</span>${peek(sorted(g).map(x=>x.author))}`,
    `<ol class="f1-rows">${sorted(g).map(x=>{const y=yr(x),n=x.pages.size;return `<li><button type="button" class="f1-row" data-dsel="s${esc(s.n)}/w${esc(x.key)}"><span class="f1-k">${esc(x.author)}</span><span class="f1-n">${[y?yearOf(y):'',n?`${n} ${n===1?'page':'pages'}`:''].filter(Boolean).join(' · ')}</span>${x.whole?'<small class="rcv-tag">whole work</small>':''}</button></li>`;}).join('')}</ol>`,{open:gi===0})).join('')}</div>`;
}
// A READER OF SUÁREZ, read beside the section: his work and its places on this disputation, his words at length, his answers on this
// section with their passages, his path; then the section's before and after
function rcvDossier(s,key,pf){
  const c=pf&&s.controversy?pf._by.get(s.controversy)||null:null;
  return {kind:'section',s,sel:`w${key}`,c,rcv:key,title:`Section ${s.n}`,html:`<section class="read-op rcv-read" data-who="${esc(key)}"><p class="rec-note">Gathering his pages…</p></section>${recHTML(s,'',c)}`};
}
function rcvReadHTML(s,x){
  const w0=D.texts.works[(x.works[0]||x.answers[0]||x.rows[0]||x.paths[0]||{}).slug]||[],g=rgroup(x),gl=(RGROUPS.find(([k])=>k===g)||[])[1]||'';
  const work=x.works.map(w=>`<li><p class="rcv-w"><em>${esc(w.title||'')}</em>${w.year?`, ${esc(yearOf(w.year))}`:''}${w.kind?` <small class="rcv-tag">${esc(w.kind)}</small>`:''}</p>${w.scope?`<p class="rec-note">${esc(w.scope)}</p>`:''}`
    +`<ol class="cc-rows">${(w.entries||[]).filter(e=>e&&String(e.d)===String(S.place)).map(e=>`<li><span>${esc(e.heading||'')}${Array.isArray(e.sections)&&e.sections.length?` <small>sections ${e.sections.map(esc).join(', ')}</small>`:''}</span>${ccPg(w.slug,e.page,e.end!=null&&e.end!==''&&String(e.end)!==String(e.page)?`pp. ${e.page}–${e.end}`:`p. ${e.page}`)}</li>`).join('')}</ol>`
    +`${(w.quotes||[]).map(q=>qbHTML({quote:q.en,la:q.la,w:w.slug,p:q.page,label:q.head||''})).join('')}</li>`).join('');
  const ans=x.answers.map(a=>`<section class="rcv-ans"><h5 class="cc-lbl">${esc(a.heading||'')}</h5>${a.gist?`<p class="dos-p">${esc(a.gist)}</p>`:''}${(a.quotes||[]).map(q=>qbHTML({quote:q.en,la:q.la,w:a.slug,p:q.page})).join('')}${a.page!=null&&a.page!==''?`<p class="ob-pg">${ccPg(a.slug,a.page,a.end!=null&&a.end!==''&&String(a.end)!==String(a.page)?`pp. ${a.page}–${a.end}`:`p. ${a.page}`)}</p>`:''}</section>`).join('');
  const paths=x.paths.map(e=>`<section class="rcv-ans"><h5 class="cc-lbl">${esc(PATHW[e.path]?cap1(PATHW[e.path]):'His path')}</h5>${e.position?`<p class="dos-p">${esc(e.position)}</p>`:''}${e.quote?qbHTML({quote:e.quote,w:e.slug,p:e.page}):e.page!=null&&e.slug?`<p class="ob-pg">${ccPg(e.slug,e.page)}</p>`:''}</section>`).join('');
  return `<div class="dos-hd"><h3 class="dos-h">${esc(x.author)}</h3><p class="dos-sub">${[gl.replace(/s$/,''),x.year?yearOf(x.year):'',w0[1]&&!x.works.length?w0[1]:''].filter(Boolean).map(esc).join(', ')}${x.whole?' <small class="rcv-tag">whole work</small>':''}</p></div>`
    +`${work?`<h4>His work on this disputation</h4><ul class="rcv-works">${work}</ul>`:''}`
    +`${ans?`<h4>At length</h4>${ans}`:''}`
    +`${x.rows.length?`<h4>On this section <span class="cc-ct">${x.rows.length}</span></h4><ol class="rcp-rows">${x.rows.map(r=>rcpRowHTML(r)).join('')}</ol>`:''}`
    +`${paths?`<h4>His path on the question</h4>${paths}`:''}`;
}
// the holders he cites, by school, each with his year (a chip opens his dossier)
function citedHTML(hs,sn){
  const by=holdersBy(hs),n=[...by.values()].reduce((x,l)=>x+l.length,0),chips=(k,list)=>list.map(h=>`<span class="rec-h1">${holderChip(h,k,h._plain?null:sn)}${h.year!=null&&h.year!==''?` <small>${esc(yearOf(h.year))}</small>`:''}</span>`).join(' ');
  if(n<=8)return `<ul class="rec-who">${MSCH.filter(([k])=>by.has(k)).map(([k,l])=>`<li><span class="hg-k">${l}</span> ${chips(k,by.get(k))}</li>`).join('')}</ul>`;
  const groups=MSCH.filter(([k])=>by.has(k)),big=groups.reduce((x,[k])=>(by.get(k).length>(x?by.get(x).length:0)?k:x),'');
  return `<div class="f1-set">${groups.map(([k,l])=>fold1(`cited-${sn}`,`<i class="dot" style="--sc:${mcol(k)}" aria-hidden="true"></i><span class="f1-k">${l}</span> <span class="cc-ct">${by.get(k).length}</span>${peek(by.get(k).map(h=>h.name||h.author))}`,`<p class="rec-who-l">${chips(k,by.get(k))}</p>`,{open:k===big})).join('')}</div>`;
}
// BEFORE AND AFTER SUÁREZ (2026-10-22; owner: "all im assking for is people who recieve suarez opinion and deal with it alongside people
// whom suaurez cites"). One axis of years with Suárez's birth on it: above it a dot for each author he cites, below it one for each who
// received him, at his year, in his school's or his tradition's colour; the counts and the spans beside the figure, the names in the
// lists under it. A dot that would touch its neighbour steps away from the axis. Undated authors are counted, not drawn.
const SUAREZ_Y=1548;
const recvC=x=>(/luther/i.test(x.tradition||x.school||'')?'var(--tg-lu)':/reform|calvin|english/i.test(x.tradition||x.school||'')?'var(--tg-rf)':mcol(mschool(x.school)));
function pivotHTML(before,after){
  const yr=x=>{const y=Number(x.year)||(TG&&TG.dates?TG.dates.year(x.author||x.name):0);return y>0&&y<2100?y:0;};
  const uniq=list=>{const seen=new Set(),out=[];for(const x of list){const k=fold(x.author||x.name);if(!k||seen.has(k))continue;seen.add(k);out.push({...x,y:yr(x)});}return out;};
  const B=uniq(before),A=uniq(after),bd=B.filter(x=>x.y),ad=A.filter(x=>x.y);
  if(!bd.length&&!ad.length)return '';
  const ys=[...bd,...ad].map(x=>x.y).concat(SUAREZ_Y),lo=Math.floor(Math.min(...ys)/100)*100,hi=Math.max(1700,Math.ceil((Math.max(...ys)+1)/100)*100),X=y=>(y-lo)/(hi-lo)*100;
  const place=(list,dir)=>{const lanes=[];return list.slice().sort((a,b)=>a.y-b.y).map(x=>{const cx=X(x.y);let k=0;while(k<4&&lanes[k]!=null&&cx-lanes[k]<1.9)k++;lanes[Math.min(k,3)]=cx;return `<i class="pv-d" style="left:${cx.toFixed(2)}%;--k:${Math.min(k,3)};--c:${dir<0?mcol(mschool(x.school)):recvC(x)}" data-dir="${dir<0?'b':'a'}" title="${esc(`${x.author||x.name}, ${yearOf(x.y)}`)}"></i>`;}).join('');};
  const span=l=>(l.length?`${yearOf(Math.min(...l.map(x=>x.y)))}${l.length>1?`–${yearOf(Math.max(...l.map(x=>x.y)))}`:''}`:'');
  const ticks=[];for(let c=Math.ceil(lo/200)*200;c<hi;c+=200)if(Math.abs(c-SUAREZ_Y)>90)ticks.push(`<span style="left:${X(c).toFixed(2)}%">${c}</span>`);
  ticks.push(`<span class="pv-sy" style="left:${X(SUAREZ_Y).toFixed(2)}%"><b>Suárez</b> 1548</span>`);
  const und=B.length-bd.length+A.length-ad.length;
  const say=`${B.length} ${B.length===1?'author':'authors'} he cites${bd.length?` (born ${span(bd)})`:''}. ${A.length} received him${ad.length?` (born ${span(ad)})`:''}.`;
  return `<figure class="pv" role="img" aria-label="${esc(`Before and after Suárez (born 1548). ${say}`)}"><div class="pv-plot">`
    +`<span class="pv-n pv-nb">He cites <b>${B.length}</b></span><span class="pv-n pv-na">Received by <b>${A.length}</b></span>`
    +`<i class="pv-axis"></i><span class="pv-piv" style="left:${X(SUAREZ_Y).toFixed(2)}%"></span>${place(bd,-1)}${place(ad,1)}</div>`
    +`<div class="pv-ax" aria-hidden="true">${ticks.join('')}</div><figcaption class="pg-note">${bd.length?`He cites authors born ${span(bd)}.`:''}${ad.length?` Authors who received him were born ${span(ad)}.`:''}${und?` ${und} undated, not drawn.`:''}</figcaption></figure>`;
}
async function recFill(root,s,sel,c){
  const info=selInfo(s,sel,c),mapBox=root.querySelector('.rec-map'),atBox=root.querySelector('.rec-atlas'),rcvBox=root.querySelector('.rcv-box[data-rcv]'),pv=root.querySelector('.pv-box[data-pv]'),rd=root.querySelector('.rcv-read[data-who]');
  const before=(info?info.holders:secHolders(s))||[];
  advFile().then(A=>{
    const list=receiversOf(s,A);
    if(rcvBox&&rcvBox.isConnected)rcvBox.innerHTML=receiversHTML(s,list);
    if(pv&&pv.isConnected)pv.innerHTML=pivotHTML(before,list);
    if(rd&&rd.isConnected){const x=list.find(y=>y.key===rd.dataset.who);rd.innerHTML=x?rcvReadHTML(s,x):'<p class="rec-note">He is not among the readers of this section.</p>';if(TG)TG.layout(rd);qbAuto(rd);qbFullAll(rd);}
    detailFocus(root);
  });
  if(mapBox){
    const m=await qfile('maps',mapBox.dataset.map);
    if(!mapBox.isConnected)return;
    if(!m||!Array.isArray(m.positions)){mapBox.innerHTML='<p class="rec-note">The map could not be loaded.</p>';}
    else{
      const names=info&&info.holders?[...new Set(info.holders.flatMap(h=>[fold(h.author||''),nmf(h.name||'')]).filter(x=>x.length>2))]:[];
      let best=null,score=0;
      for(const p of m.positions){const hay=` ${(p.holders||[]).map(x=>fold(x.author)).join(' | ')} `;let n=0;for(const x of names)if(hay.includes(x))n++;if(n>score){score=n;best=p;}}
      const total=m.n||m.positions.reduce((n,p)=>n+(p.holders||[]).length,0);
      mapBox.innerHTML=`<p class="rec-sub">On the map: <a href="${MAPSP}#${encodeURIComponent(m.id||mapBox.dataset.map)}">${esc(m.q)}</a></p>${
        best&&TG?TG.positionBlock(best,{total,read,preview:(w,p)=>pvBtn(w,p),level:5,open:false})
          :`${info&&info.holders&&info.holders.length?'<p class="rec-note">The map does not place these holders; its positions:</p>':''}${TG?TG.positionRows(m.positions.map(p=>[p.label,(p.holders||[]).length])):''}`}`;
      if(TG)TG.layout(mapBox);
    }
  }
  if(atBox){
    const a=await qfile('atlas',atBox.dataset.atlas);
    if(!atBox.isConnected)return;
    const ans=a&&Array.isArray(a.answers)?a.answers:[];
    if(!ans.length){atBox.innerHTML='<p class="rec-note">No answers in the atlas yet.</p>';return;}
    const t=new Map();for(const x of ans){const k=String(x.answer||'unclear');t.set(k,(t.get(k)||0)+1);}
    atBox.innerHTML=`<p class="rec-sub">In the atlas: <a href="${ATLASP}#${encodeURIComponent(a.id||atBox.dataset.atlas)}">${esc(a.q)}</a>, ${fmtN(ans.length)} authors answer</p>${TG?TG.positionRows([...t].sort((x,y)=>y[1]-x[1]).map(([k,n])=>[cap1(k),n])):''}`;
  }
}
// the whole works against Suárez, fetched once: each with its places in the Disputations, a step to each disputation on the deck
let ADVP=null;
const advFile=()=>ADVP||(ADVP=J(`/v1/decks/metaphysics/adversaries.json${VER}`));
function placePart(d){const g=G();if(!g)return null;for(const p of Object.keys(g)){if(p.startsWith('_'))continue;if(g[p]&&g[p][String(d)])return p;}return null;}
function advFor(A,d,n){
  const rows=A&&Array.isArray(A.rows)?A.rows:[];
  return rows.filter(r=>(r.entries||[]).some(e=>e&&String(e.d)===String(d)&&(n==null||!Array.isArray(e.sections)||!e.sections.length||e.sections.map(String).includes(String(n)))));
}
// ── A HOLDER'S DOSSIER: the views he holds in this disputation and Suárez's verdict on each, his pages, his place on the maps
function holderDossierHTML(slug){
  const P=PL.props,hits=[];
  for(const s of P.sections||[])for(const o of s.opinions||[])for(const h of o.holders||[])if(hslug(h)===slug)hits.push({s,o,h});
  if(!hits.length)return {title:'Not found',html:'<p class="rec-note">No one by that name holds a view in this disputation.</p>'};
  const h0=hits[0].h,name=h0.author||h0.name,k=mschool(h0.school),pages=[...new Map(hits.filter(x=>x.h.slug&&x.h.page!=null&&x.h.page!=='').map(x=>[`${x.h.slug}|${x.h.page}`,x.h])).values()];
  const maps=[...new Map(hits.filter(x=>x.s.map).map(x=>[x.s.map,x.s])).values()];
  const back=hits.find(x=>`s${x.s.n}`===S.art),bs=back?back.s:hits[0].s,bsel=DOSBACK&&DOSBACK.art===`s${bs.n}`?DOSBACK.sel:'';
  const html=`<p class="dos-back"><button type="button" class="res-of" data-dsel="s${esc(bs.n)}/${esc(bsel)}">Back to section ${esc(bs.n)}</button>${bs.q?` <span class="rec-note">${esc(bs.q)}</span>`:''}</p><div class="dos-hd"><h3 class="dos-h">${esc(name)}</h3><p class="dos-sub">${esc(MSCH.find(([x])=>x===k)[1].replace(/s$/,''))}${h0.year!=null&&h0.year!==''?`, born ${esc(yearOf(h0.year))}`:''}${h0.name&&h0.name!==name?`; Suárez names him ${esc(h0.name)}`:''}</p></div>`
    +`<h4>The views he holds here <span class="cc-ct">${hits.length}</span></h4><ol class="cc-rows dos-views">${hits.map(({s,o})=>{const sv=SV[o.suarez_on];return `<li><span><button type="button" class="res-of" data-dsel="s${esc(s.n)}/o${esc(o.i)}">${esc(cap1(o.label||`Opinion ${Number(o.i)+1}`))}</button> on ${esc(s.q||s.place||'')}</span>${sv?`<span class="sv sv-${esc(o.suarez_on)}">${sv[0]}</span>`:''}</li>`;}).join('')}</ol>`
    +`${pages.length?`<h4>His pages <span class="cc-ct">${pages.length}</span></h4><ol class="cc-rows">${pages.map(p=>{const w=D.texts.works[p.slug]||[];return `<li><span>${esc(w[1]||p.slug)}</span>${ccPg(p.slug,p.page)}</li>`;}).join('')}</ol>`:''}`
    +`${maps.length?`<h4>On the maps of the tradition</h4>${maps.map(s=>`<div class="rec-place" data-map="${esc(s.map)}" data-who="${esc(fold(name))}"><p class="rec-note">Loading the map…</p></div>`).join('')}`:''}`;
  return {title:name,html};
}
async function holderFill(root){
  for(const box of root.querySelectorAll('.rec-place[data-map]')){
    const m=await qfile('maps',box.dataset.map);
    if(!box.isConnected)return;
    const {who} = box.dataset,pos=m&&(m.positions||[]).find(p=>(p.holders||[]).some(x=>fold(x.author).includes(who)||who.includes(fold(x.author))));
    box.innerHTML=m?`<p><a href="${MAPSP}#${encodeURIComponent(m.id||box.dataset.map)}">${esc(m.q)}</a>: ${pos?`placed with <b>${esc(pos.label)}</b>${pos.summary?`<span class="rec-note"> ${esc(pos.summary)}</span>`:''}`:'<span class="rec-note">not placed</span>'}</p>`:'';
  }
}
// ── A PROBLEM'S DOSSIER (the problems decks): the question in both languages, the verdict in words, its statement, who agrees, the
// objections it answers, its distinction, the disputations that argue it, where the systems argue it, its other addresses
// a problem's expansion beside the main: who agrees with it and why one differs, where the systems argue it, its other addresses
function probDossierHTML(p,i){
  const cfg=PRB(),P=PL.props,ag=Array.isArray(p.argued)?p.argued.filter(x=>x&&x.slug):[];
  const pg=p.page!=null&&p.page!==''?ccPg(P.slug,p.page,`${cfg.short}, ${p.num?`${p.kind==='porisma'?'Corollary':'Question'} ${p.num}, `:''}p. ${p.page}`):'';
  return {title:`${cap1(cfg.one)} ${p.n??i+1}`,html:`<div class="dos-hd"><p class="dos-sub">${esc(cap1(cfg.one))} ${esc(p.n??i+1)} ${pg}</p><h3 class="dos-h">${esc(p.q||'')}</h3></div>${probRecBody(p,ag)}`};
}
// a problem's head in the pane: its number and page, the question in both languages, the verdict in words and the statement
function probHeadHTML(p,i){
  const cfg=PRB(),P=PL.props,sl=sealOf(p),ctx={host:PANE.b,slug:P.slug,marks:P.marks||{},adv:'',authors:[]},adv=advOf(p,ctx);
  const pg=p.page!=null&&p.page!==''?ccPg(P.slug,p.page,`${cfg.short}, ${p.num?`${p.kind==='porisma'?'Corollary':'Question'} ${p.num}, `:''}p. ${p.page}`):'';
  return `<div class="dos-hd"><p class="dos-sub">${esc(cap1(cfg.one))} ${esc(p.n??i+1)} ${pg}</p><h3 class="dos-h">${esc(p.q||'')}</h3>${p.la?`<p class="dos-la" lang="la">${esc(p.la)}${p.mark_la?` <span class="pr-mk">${esc(p.mark_la)}</span>`:''}</p>`:''}`
    +`<p class="pr-v">${sl?`<span class="seal sm s-${sl[1]}" data-s="${esc(sl[0])}" aria-hidden="true"></span> `:''}<span class="pr-vw">${esc(p.verdict||ctx.marks[p.mark]||'')}</span>${adv?`<span class="pr-adv">, against ${adv}</span>`:''}</p>${p.answer?`<p class="dos-p">${esc(p.answer)}</p>`:''}</div>`;
}
// a problem's reception: who among the systems agrees with it and why one differs, where the systems argue it, its other addresses
function probRecBody(p,ag){
  const cfg=PRB(),P=PL.props,authors=Array.isArray(P.strip_authors)?P.strip_authors.filter(Boolean):[],agMore=Number(p.n_more||p.argued_more||0);
  const who=authors.length?`<h4>Who agrees</h4><ol class="cc-rows">${authors.map((a,k)=>{const v=String((p.strip||[])[k]||''),s=surnameOf(a)||a,m=(p.moves||[]).find(x=>x.agree==='differs'&&x.why&&surnameOf(x.author||'')===s);
    return `<li><span><b>${esc(s)}</b> ${v==='agrees'?`agrees with ${esc(cfg.who)}`:v==='differs'?`<span class="pg-dif">differs from ${esc(cfg.who)}</span>${m?`: ${esc(m.why)}`:''}`:v==='silent'?'is silent on it':'has no disputation on it'}</span></li>`;}).join('')}</ol>`:'';
  const links=argLinks(p),kinds=new Map(),auth=new Map();
  for(const e of ag){kinds.set(e.kind,(kinds.get(e.kind)||0)+1);const a=e.author||(D.texts.works[e.slug]||[])[0]||'';if(a)auth.set(a,(auth.get(a)||0)+1);}
  const KC={selectae:'var(--fg)',system:'color-mix(in srgb,var(--fg) 68%,var(--card-bg))',disputation:'color-mix(in srgb,var(--fg) 42%,var(--card-bg))',commentary:'color-mix(in srgb,var(--fg) 22%,var(--card-bg))'};
  const counts=ag.length?`${TG?`<div class="pgraph tg rec-kinds">${tgBar([...kinds].map(([k,n])=>({l:AKL[k]||k,n,c:KC[k]||'var(--muted)'})),'The places by kind')}</div>`:''}<p class="rec-sub">By author: ${[...auth].map(([a,n])=>`${esc(surnameOf(a)||a)} <span class="cc-ct">${n}</span>`).join(', ')}</p>`:'';
  return `<section class="rec" aria-labelledby="rec-h"><h3 class="rec-hh" id="rec-h">Reception</h3>${who}`
    +`${ag.length?`<h4>Argued in ${esc(cfg.systems||'the systems')} <span class="cc-ct">${fmtN(ag.length+agMore)}</span></h4>${counts}<div class="f1-set">${AKIND.concat('other').filter(k=>ag.some(e=>(AKIND.includes(e.kind)?e.kind:'other')===k)).map((k,ki)=>{const list=ag.filter(e=>(AKIND.includes(e.kind)?e.kind:'other')===k);return fold1(`ag-${p.n}`,`<span class="f1-k">${AKL[k]||'Other'}</span> <span class="cc-ct">${list.length}</span>${peek(list.map(e=>surnameOf(e.author||'')||e.author))}`,`<div class="pths tg">${arguedHTML(list,0)}</div>`,{open:ki===0});}).join('')}</div>${agMore?`<p class="pth-more">+${fmtN(agMore)} more</p>`:''}`:''}`
    +`${links?`<p class="sec-links arg-links">${links}</p>`:''}${!ag.length?`<p class="rec-note">Where else it is argued: <button type="button" class="res-of" data-rm="works">the ${esc(GRID[S.deck].head.toLowerCase())} beside this ${noun()}</button>.</p>`:''}</section>`;
}
// ── the dossier of what is chosen: its title, its column, and what to bring into view in it
function dossierOf(pf){
  const P=PL.props;
  if(!P)return null;
  if(S.deck==='metaphysics'){
    const ss=P.sections||[];
    // an answering work's old address reads its author beside the first section it answers
    if(/^a\d+$/.test(S.art||'')){const a=((PL.rec||{}).answers||[])[Number(S.art.slice(1))];if(a){const s=ss.find(x=>(a.sections||[]).map(String).includes(String(x.n)))||ss[0];if(s)return rcvDossier(s,hslug({author:a.author}),pf);}}
    const m=/^s(\d+)$/.exec(S.art||''),s=(m&&ss.find(x=>String(x.n)===m[1]))||ss[0];
    if(!s)return null;
    if(/^h[a-z0-9-]+$/.test(S.sel||'')){const d=holderDossierHTML(S.sel.slice(1));return {...d,kind:'holder',s};}
    if(/^w[a-z0-9-]+$/.test(S.sel||''))return rcvDossier(s,S.sel.slice(1),pf);
    const c=pf&&s.controversy?pf._by.get(s.controversy)||null:null,sel=S.sel||'';
    return {kind:'section',s,sel,c,title:`Section ${s.n}`,html:recHTML(s,sel,c)};
  }
  const ps=P.problems||[],m=/^p(\d+)$/.exec(S.art||''),i=m?ps.findIndex(x=>String(x.n)===m[1]):0,k=i<0?0:i,p=ps[k];
  if(!p)return null;
  return {...probDossierHTML(p,k),kind:'problem'};
}
// what arrives later: the readers, the strip, the map and the atlas; a split inside a school marked and brought into view
async function dossierFill(root,d,scroller){
  if(d.kind==='holder'){holderFill(root);return;}
  if(d.kind!=='section')return;
  recFill(root,d.s,d.sel,d.c);
  root.querySelectorAll('.is-sel').forEach(x=>x.classList.remove('is-sel'));
  if(/^i\d+$/.test(d.sel||'')){const ib=root.querySelectorAll('.rec .intra')[Number(d.sel.slice(1))];if(ib){ib.classList.add('is-sel');intoView(scroller,ib);}}
}
const intoView=(sc,el)=>{if(!sc||!el)return;sc.scrollTop+=el.getBoundingClientRect().top-sc.getBoundingClientRect().top-12;};
function rmodeHTML(){
  const n=foldCopies(commentators().map(c=>({...c,also:[]}))).length;
  return `<div class="seg rmode" role="group" aria-label="What this pane shows"><button type="button" data-rm="dossier" aria-pressed="${rmode()==='dossier'}">${S.deck==='metaphysics'?'This section':`This ${PRB().one}`}</button><button type="button" data-rm="works" aria-pressed="${rmode()==='works'}">Works beside <small>${n}</small></button></div>`;
}
// where the reading should open: at the readers, at an objection; kept until the pane or the sheet has drawn the reading
let DFOCUS=null;
function detailFocus(root){
  if(!DFOCUS||!root||!root.isConnected)return;
  const sc=root.classList.contains('dos')||root.classList.contains('bb')?root:root.querySelector('.dos')||root;
  const el=DFOCUS.to==='recv'?root.querySelector('#rcv-h'):DFOCUS.ob!=null?root.querySelectorAll('.objs>li')[DFOCUS.ob]:null;
  if(!el)return;
  DFOCUS=null;
  root.querySelectorAll('.is-sel').forEach(x=>x.classList.remove('is-sel'));
  if(el.tagName==='LI')el.classList.add('is-sel');
  intoView(sc,el);
}
async function paneDossier(side){
  const host=PANE[side],key=['dos',PL.key,S.art||'',S.sel||'',LANE].join('|');
  if(SHOWN[side]===key){detailFocus(host.querySelector('.dos'));return;}
  SHOWN[side]=key;RUN[side]++;
  const token=RUN[side],pf=S.deck==='metaphysics'?await pairFile():PAIRD;
  if(token!==RUN[side])return;
  const d=dossierOf(pf);
  if(!d){host.innerHTML=`<header class="ph"><div class="ph-row">${rmodeHTML()}</div></header><div class="scroll"><p class="note">Choose a ${S.deck==='metaphysics'?'section':PRB().one} on the left.</p></div>`;return;}
  host.innerHTML=`<header class="ph"><div class="ph-row">${rmodeHTML()}</div><p class="dos-ctx" aria-live="polite">${dosCtx(d)}</p></header><div class="scroll dos tg" tabindex="-1">${d.html}</div>`;
  host._mv=host._mv||[];
  if(TG){TG.mount(host);TG.layout(host);}
  qbAuto(host);
  qbFullAll(host);
  detailFocus(host.querySelector('.dos'));
  await dossierFill(host,d,host.querySelector('.scroll'));
}
const dosCtx=d=>(d.kind==='section'?`Section ${esc(d.s.n)}, ${esc(d.s.q||'')}`:d.kind==='holder'?`${esc(d.title)} in this disputation`:esc(d.title));
// on a phone the dossier rises in the sheet
async function dossierSheet(from){
  const pf=S.deck==='metaphysics'?await pairFile():PAIRD,d=dossierOf(pf);
  if(!d)return;
  const sh=sheetEl();
  sh.querySelector('.who').textContent=d.kind==='section'?`Section ${d.s.n}`:d.title;
  sh.querySelector('.what').textContent=d.kind==='section'?(d.s.q||''):d.kind==='holder'?'His views in this disputation':d.kind==='answer'?(d.sub||''):'Its reception';
  const op=sh.querySelector('.open');op.hidden=true;
  const bb=sh.querySelector('.bb');bb.classList.add('dos','tg');bb.dataset.kind=d.kind;bb.innerHTML=d.html;bb.scrollTop=0;
  if(TG){TG.mount(sh);TG.layout(sh);}
  sheetUp(from||null);
  qbAuto(bb);
  qbFullAll(bb);
  detailFocus(bb);
  dossierFill(bb,d,bb);
}
// a choice on the left: the address keeps it (the left pane stays where it is), the right pane or the sheet shows its dossier
let DOSBACK=null;
function selectDos(art,sel,from,opt){
  if(/^h/.test(sel||'')&&!/^h/.test(S.sel||'')&&S.art)DOSBACK={art:S.art,sel:S.sel||''};
  S.art=art;S.sel=/^s\d+$/.test(art)&&sel?sel:null;S.r=null;S.i=null;PANE.a._art=art;
  history.replaceState(null,'',`#${hashOf()}`);
  const row=/^[ps]\d+$/.test(art)?accOpen(PANE.a,art,false):null;
  if(row&&opt&&opt.reveal)probInView('a',row,false);
  DFOCUS=opt&&(opt.to||opt.ob!=null)?{to:opt.to||null,ob:opt.ob!=null?Number(opt.ob):null}:null;
  markSel();
  RMODE[S.deck]='dossier';
  SHOWN.b='';
  if(isPhone()){if(!opt||opt.sheet!==false)dossierSheet(from);}
  else paneDossier('b');
}
// the chosen section, opinion, problem or holder marked in the main pane
function markSel(){
  const A=PANE.a;
  A.querySelectorAll('[aria-current="true"]').forEach(x=>{if(x.closest('.secs,.probs'))x.removeAttribute('aria-current');});
  const m=/^([ps])(\d+)$/.exec(S.art||'');
  if(!m)return;
  const row=document.getElementById(`a-${m[1]}${m[2]}`);
  if(!row)return;
  const mark=x=>{if(x)x.setAttribute('aria-current','true');};
  mark(row.querySelector('.pr-n'));
  if(m[1]==='p')return;
  const sel=S.sel||'',s=((A._P||{}).sections||[]).find(x=>String(x.n)===m[2]),c=s&&s.controversy&&PAIRD?PAIRD._by.get(s.controversy):null;
  if(/^h/.test(sel)){
    row.querySelectorAll(`a[data-hsel="s${m[2]}/${sel}"]`).forEach(mark);
    if(c){const hits=(s.opinions||[]).flatMap(o=>o.holders||[]).filter(h=>`h${hslug(h)}`===sel),names=new Set(hits.flatMap(h=>[fold(h.author||''),nmf(h.name||'')]).filter(x=>x.length>2));
      ccOps(c).forEach((p,i)=>{const hay=` ${fold(p.holder)} ${fold(p.author||'')} `;if([...names].some(x=>hay.includes(` ${x} `)))mark(row.querySelector(`.cc-op[data-cco="${i}"]`));});}
    return;
  }
  if(/^c\d+$/.test(sel))mark(row.querySelector(`.cc-op[data-cco="${sel.slice(1)}"]`));
  else if(sel==='r')mark(row.querySelector('.cc-judgment')||row.querySelector('.res'));
  else if(/^o\d+$/.test(sel)){const o=(s.opinions||[]).find(x=>`o${x.i}`===sel),k=c&&o?ccMatch(c,s,o):-1;mark(k>=0?row.querySelector(`.cc-op[data-cco="${k}"]`):row.querySelector(`#a-s${m[2]}-${sel}`));}
  else if(/^w/.test(sel))mark([...row.querySelectorAll('.rcv-nm .cc-sel')].find(b=>b.dataset.osel===`s${m[2]}/${sel}`));
}
// a chip opens the page it cites beside the text: the page window's own open() once page-window.js has one; until then the page
// window drawn in the right pane on a wide screen, in a sheet from the foot of the screen on a phone. A work cited without a page
// opens on its title page.
let SHEET=null;
// the sheet from the foot of a phone's screen, made once: the page window's and the dossier's
function sheetEl(){
  if(!SHEET){
    SHEET=document.createElement('div');SHEET.className='bsheet';SHEET.setAttribute('role','dialog');SHEET.setAttribute('aria-modal','true');SHEET.setAttribute('aria-labelledby','bsWho');SHEET.inert=true;
    SHEET.innerHTML='<div class="bh"><button type="button" class="close" data-sheet-close>Close</button><p class="who" id="bsWho"></p><p class="what"></p><a class="open" target="_blank" rel="noopener">Open in the reader ↗</a></div><div class="bb"></div>';
    const sc=document.createElement('div');sc.className='bscrim';sc.dataset.sheetClose='';
    LAYER().append(SHEET,sc);SHEET._scrim=sc;
  }
  return SHEET;
}
function sheetUp(from){
  const sh=sheetEl();
  sh._from=from;sh.inert=false;sh.classList.add('up');sh._scrim.classList.add('on');
  requestAnimationFrame(()=>{const c=sh.querySelector('.close');if(c)c.focus();});
  return sh;
}
function besideBox(chip){
  if(!isPhone()){
    const host=PANE.b;SHOWN.b='';RUN.b++;
    host.innerHTML=`<header class="ph bh"><button type="button" class="back" data-beside-back>← ${S.deck==='vitringa'?'All works beside this chapter':S.r||(DOSDECK()&&rmode()==='dossier')?'Back':`All ${esc(WHO())}`}</button><p class="who"></p><p class="what"></p><a class="open" target="_blank" rel="noopener" hidden>Open in the reader ↗</a></header><div class="scroll bb"></div>`;
    return host;
  }
  const sh=sheetUp(chip),bb=sh.querySelector('.bb');bb.classList.remove('dos','tg');delete bb.dataset.kind;
  return sh;
}
function sheetDown(){
  if(!SHEET||!SHEET.classList.contains('up'))return false;
  SHEET.classList.remove('up');SHEET._scrim.classList.remove('on');SHEET.inert=true;
  const c=SHEET._from;if(c&&c.isConnected)c.focus();
  return true;
}
const PRESSED='.card .ref[aria-pressed="true"],a.mv-open[aria-pressed="true"],a.pr-pg[aria-pressed="true"],a.hol[aria-pressed="true"]';
async function besideOpen(l,chip,hl){
  if(!l)return;
  const [surface,slug,page,title,author]=l,PW=window.FRPageWindow,pg=page!=null&&page!=='';
  document.querySelectorAll(PRESSED).forEach(c=>c.removeAttribute('aria-pressed'));
  if(chip)chip.setAttribute('aria-pressed','true');
  if(PW&&typeof PW.open==='function'){PW.open({slug,page,title,author});return;}
  const box=besideBox(chip),bb=box.querySelector('.bb'),op=box.querySelector('.open'),href=read(slug,pg?page:null);
  box.querySelector('.who').textContent=author||surface;
  box.querySelector('.what').textContent=`${title||''}${pg?`, ${atw(slug)} ${page}`:''}`;
  op.href=href;op.hidden=false;
  bb.innerHTML='<p class="empty">Opening the page…</p>';
  if(!pg){
    const nt=chip&&chip.closest('.nt'),all=nt?nt.textContent:'',name=chip?chip.textContent:'',at=nt?all.indexOf(name):-1;
    const cited=(at>=0?name+all.slice(at+name.length).split(/;|\.\s(?=[A-Z]{3,})/)[0]:'').slice(0,220);
    bb.innerHTML=`<div class="nopage"><p class="np-h">${S.deck==='vitringa'?'Vitringa cites this work without a page we can place.':'This passage has no page we can place.'}</p>${cited?`<p class="np-c">“${esc(cited.trim())}”</p>`:''}<p><a class="np-a" href="${esc(href)}" target="_blank" rel="noopener">Open the work in the reader ↗</a></p></div>`;
    return;
  }
  const ok=PW&&!isFam(slug)?await PW.fill(bb,{slug,page,hl:hl||''}).catch(()=>false):false;
  if(!bb.isConnected)return;
  if(!ok)bb.innerHTML=`<p class="empty">This page cannot be shown here. <a href="${esc(href)}">Open it in the reader</a>.</p>`;
  // a problem's page or a disputation's opens on the page itself, at its words where they are found on it
  else if(hl!=null){const c=bb.querySelector('.pw-cited'),t=(c&&c.querySelector('mark'))||c,bar=bb.querySelector('.pw-bar');if(t)bb.scrollTop+=t.getBoundingClientRect().top-bb.getBoundingClientRect().top-(bar?bar.offsetHeight:0)-12;}
}
// the chip's gist, after 300 ms of a mouse over it, at once on keyboard focus: below the chip when there is room, else above
const TIP=document.createElement('div');
TIP.className='tip';TIP.id='deckTip';TIP.setAttribute('role','tooltip');
// the tooltip and the sheet sit inside the page's tool when a host scopes its colours to it (Mere Orthodoxy's .tfr-tool)
const LAYER=()=>document.querySelector('.tfr-tool')||document.body;
LAYER().appendChild(TIP);
let tipT=0,tipFor=null;
function tipShow(ch){
  const l=LINKS[+ch.dataset.li],g=l&&l[5];
  if(!g||!ch.isConnected)return;
  TIP.textContent=g;TIP.style.top='-999px';TIP.classList.add('on');tipFor=ch;ch.setAttribute('aria-describedby','deckTip');
  const r=ch.getClientRects()[0]||ch.getBoundingClientRect(),h=TIP.offsetHeight,below=r.bottom+8+h<=innerHeight;
  TIP.style.left=`${Math.max(8,Math.min(innerWidth-TIP.offsetWidth-8,r.left))}px`;
  TIP.style.top=`${below?r.bottom+6:r.top-h-6}px`;
}
function tipHide(){clearTimeout(tipT);TIP.classList.remove('on');if(tipFor){tipFor.removeAttribute('aria-describedby');tipFor=null;}}
document.addEventListener('pointerover',e=>{
  const ch=e.target.closest&&e.target.closest('.card .ref');
  if(!ch||e.pointerType!=='mouse'||ch===tipFor)return;
  clearTimeout(tipT);tipT=setTimeout(()=>tipShow(ch),300);
});
document.addEventListener('pointerout',e=>{const ch=e.target.closest&&e.target.closest('.card .ref');if(ch&&!ch.contains(e.relatedTarget))tipHide();});
document.addEventListener('focusin',e=>{const ch=e.target.closest&&e.target.closest('.card .ref');if(ch)tipShow(ch);});
document.addEventListener('focusout',e=>{if(e.target.closest&&e.target.closest('.card .ref'))tipHide();});
document.addEventListener('click',e=>{
  const alt=e.target.closest('[data-alt]');
  if(alt){S.alt=alt.dataset.alt||null;S.j=null;go();return;}
  // one note open under an aphorism, from its mark; click or tap only
  const mk=e.target.closest('.ap .mk');
  if(mk){
    const row=mk.closest('.ap'),card=document.getElementById(mk.getAttribute('aria-controls')),open=mk.getAttribute('aria-expanded')==='true';
    row.querySelectorAll('.mk').forEach(m=>m.setAttribute('aria-expanded','false'));row.querySelectorAll('.card').forEach(c=>{c.hidden=true;});
    if(!open&&card){mk.setAttribute('aria-expanded','true');card.hidden=false;}
    return;
  }
  const num=e.target.closest('.ap .num');
  if(num&&!(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0)){e.preventDefault();const n=num.closest('.ap').dataset.aph;if(n){S.art=`a${n}`;go();}return;}
  const ch=e.target.closest('.card a.ref');
  if(ch&&!(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0)){e.preventDefault();tipHide();besideOpen(LINKS[+ch.dataset.li],ch);return;}
  if(e.target.closest('[data-sheet-close]')){sheetDown();return;}
  if(e.target.closest('[data-beside-back]')){document.querySelectorAll(PRESSED).forEach(c=>c.removeAttribute('aria-pressed'));SHOWN.b='';if(S.deck==='vitringa'&&S.r){S.r=null;S.i=null;go();}else render();return;}
  const more=e.target.closest('[data-more-pages]');
  if(more&&!more.disabled){loadMoreBase(more.dataset.morePages);return;}
  const ma=e.target.closest('[data-more-alt]');
  if(ma&&!ma.disabled&&PL.text&&PL.text.alt){altPages(ma.dataset.moreAlt,PL.text.alt,RUN[ma.dataset.moreAlt]);}
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||!$('#grid').hidden)return;
  if(sheetDown()){e.preventDefault();return;}
  const a=document.activeElement,row=a&&a.closest&&a.closest('.ap'),open=(row&&row.querySelector('.mk[aria-expanded="true"]'))||[...document.querySelectorAll('.ap .mk[aria-expanded="true"]')].pop();
  if(open){open.click();open.focus();tipHide();e.preventDefault();}
});
// inside a dossier: a holder's view, a split's opinion, a holder's chip lead to their own dossiers
document.addEventListener('click',e=>{
  const box=e.target.closest&&e.target.closest('#paneB .dos,.bsheet .bb.dos');
  if(!box)return;
  const plain=!(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0);
  const ds=e.target.closest('[data-dsel],[data-osel]');
  if(ds){const [a,b]=(ds.dataset.dsel||ds.dataset.osel).split('/');selectDos(a,b||null,ds);return;}
  const hs=e.target.closest('a[data-hsel]');
  if(hs&&plain){e.preventDefault();const [a,b]=hs.dataset.hsel.split('/');selectDos(a,b,hs);return;}
  const ro=e.target.closest('.res-of[data-op]');
  if(ro){const m=/-s(\d+)-o(\d+)$/.exec(ro.dataset.op);if(m){selectDos(`s${m[1]}`,`o${m[2]}`,ro);}}
});
// the problems: a verdict pressed or let go, a fold opened or closed, a page opened beside the list
document.addEventListener('click',e=>{
  const host=e.target.closest&&e.target.closest('.pane');
  if(!host||!host._pi||!host.querySelector('.probs'))return;
  const side=host===PANE.b?'b':'a',plain=!(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0);
  // a view, its holder, Suárez's resolution or a school's split chosen on the Suárez deck; a problem chosen on the problems decks
  const at=e.target.closest('.acc-t');
  if(at&&side==='a'){const row=at.closest('.pr'),m=/^a-([ps]\d+)$/.exec(row.id||'');if(!m)return;
    if(at.getAttribute('aria-expanded')==='true'){accOpen(host,m[1],true);return;}
    selectDos(m[1],null,at,{sheet:false,reveal:true});return;}
  const os=e.target.closest('[data-osel]');
  if(os&&side==='a'){const [a,b]=os.dataset.osel.split('/');selectDos(a,b||null,os,{sheet:true,to:os.dataset.to||null,ob:os.dataset.ob!=null?os.dataset.ob:null});return;}
  const as=e.target.closest('[data-asel]');
  if(as&&side==='a'){selectDos(as.dataset.asel,null,as,{sheet:true});return;}
  const pw=e.target.closest('a.pg[data-pw]');
  if(pw&&plain&&side==='a'){e.preventDefault();const [sl,pg]=pw.dataset.pw.split('|'),w=D.texts.works[sl]||[],hl=((pw.closest('[data-tg-pv-hl]')||{}).dataset||{}).tgPvHl||'';besideOpen([pw.textContent.trim(),sl,pg,w[1]||'',w[0]||''],pw,hl);return;}
  const hs=e.target.closest('a[data-hsel]');
  if(hs&&plain&&side==='a'){e.preventDefault();const [a,b]=hs.dataset.hsel.split('/');selectDos(a,b,hs);return;}
  const ms=e.target.closest('[data-ms],[data-msv]');
  if(ms){const set=ms.dataset.ms?MOFF:VOFF,k=ms.dataset.ms||ms.dataset.msv;if(set.has(k))set.delete(k);else set.add(k);applySections(side);return;}
  const tg=e.target.closest('.ptog');
  if(tg){const k=tg.dataset.pf;if(PF.has(k))PF.delete(k);else PF.add(k);applyProbs(side);return;}
  // an opinion named by the resolution or by a side of a school: brought into view and marked
  if(e.target.closest('[data-gob]')){if(DOSDECK()&&rmode()==='dossier'){RMODE[S.deck]='works';SHOWN.b='';paneDir('b');}show('b');const B=PANE.b,f=B.querySelector('.find')||B.querySelector('.ph h2');if(isPhone())B.scrollIntoView({block:'start'});if(f){if(!f.matches('input')&&!f.hasAttribute('tabindex'))f.setAttribute('tabindex','-1');f.focus({preventScroll:isPhone()});}return;}
  const ro=e.target.closest('.res-of');
  if(ro){const el=document.getElementById(ro.dataset.op);if(el)probInView(side,el,true);return;}
  // a wide screen chooses by the body of a card, a view, a problem; a phone by their own buttons, so that reading by touch opens nothing
  if(side==='a'&&!isPhone()&&!e.target.closest('a,button,select,input,summary,label,.tg-pvw,.qb-src')&&!(window.getSelection&&String(window.getSelection()).trim())){
    const rowN=x=>(/^a-s(\d+)$/.exec((x.closest('.pr')||{}).id||'')||[])[1],jd=e.target.closest('.cc-main .cc-judgment'),cco=e.target.closest('.cc-main .cc-op[data-cco]'),op=e.target.closest('.secs .op'),res=e.target.closest('.secs .res');
    if(!e.target.closest('.qb,.rcv-fold')){
      if(cco&&/^\d+$/.test(cco.dataset.cco)&&rowN(cco)){selectDos(`s${rowN(cco)}`,`c${cco.dataset.cco}`,cco.querySelector('.cc-sel'));return;}
      if(jd&&rowN(jd)){selectDos(`s${rowN(jd)}`,'r',jd.querySelector('.cc-sel'));return;}
    }
    if(op){const m=/^a-s(\d+)-o(\d+)$/.exec(op.id||'');if(m){selectDos(`s${m[1]}`,`o${m[2]}`,op.querySelector('.op-l'));return;}}
    if(res){const m=/^a-s(\d+)$/.exec((res.closest('.pr')||{}).id||'');if(m){selectDos(`s${m[1]}`,'r',res.querySelector('.res-b'));return;}}
    // a collapsed row opens by any of its line; the open one's board is for choosing
    const head=e.target.closest('.probs>.pr');
    if(head&&!e.target.closest('.acc-b')){const m=/^a-([ps]\d+)$/.exec(head.id||''),bt=head.querySelector('.acc-t');if(m&&bt&&bt.getAttribute('aria-expanded')!=='true'){selectDos(m[1],null,bt,{sheet:false,reveal:true});return;}}
  }
  const hol=e.target.closest('a.hol');
  if(hol&&plain){e.preventDefault();const [sl,pg]=String(hol.dataset.hol).split('|'),w=D.texts.works[sl]||[];besideOpen([hol.textContent.trim(),sl,pg,w[1]||'',hol.dataset.who||w[0]||''],hol,'');return;}
  const pp=e.target.closest('a.pr-pg');
  if(pp&&plain){e.preventDefault();const P=host._P,p=P&&P.problems[Number(pp.dataset.pp)],w=(P&&D.texts.works[P.slug])||[];if(p)besideOpen([PRB().short,P.slug,p.page,w[1]||PRB().base,w[0]||''],pp,p.q);return;}
  const mo=e.target.closest('a.mv-open');
  if(mo&&plain){e.preventDefault();const l=(host._mv||[])[Number(mo.dataset.mv)];if(l)besideOpen(l.slice(0,5),mo,l[5]);}
});
document.addEventListener('input',e=>{
  const f=e.target.closest&&e.target.closest('.pfind'),host=f&&f.closest('.pane');
  if(!host)return;
  host._q=f.value;applyView(host===PANE.b?'b':'a');
});
// while the cited page is up on a phone the arrows stay with it; another place closes it
document.addEventListener('keydown',e=>{if(SHEET&&SHEET.classList.contains('up')&&(e.key==='ArrowLeft'||e.key==='ArrowRight'))e.stopImmediatePropagation();},true);
window.addEventListener('hashchange',()=>{sheetDown();tipHide();});
// reading near the end of what is loaded fetches the next part (the pane's own scroll on a wide screen, the window on a phone)
let baseRaf=0;
document.addEventListener('scroll',()=>{
  if(TIP.classList.contains('on'))tipHide();
  if(baseRaf)return;
  baseRaf=requestAnimationFrame(()=>{
    baseRaf=0;
    if(!GD())return;
    const b=PANE.a.querySelector('.bscroll>.morebar:not([hidden]) button:not(:disabled)');
    if(!b)return;
    const sc=scrollerOf('a'),limit=sc?sc.getBoundingClientRect().bottom:innerHeight;
    if(b.getBoundingClientRect().top-limit<600)b.click();
  });
},true);
// the Scripture page's reader of the Fathers in Migne and the EEBO books (commentary-pane.js, its pane off), fetched the first time one
// is opened; Mere Orthodoxy's port leaves it out (window.__FR_DECKS_TEXT__ = '') and those works open in the reader
const CP_JS=window.__FR_DECKS_TEXT__!=null?window.__FR_DECKS_TEXT__:'/commentary-pane.js?v=__RESEARCH_V__';
let CPT=null;
const commentaryText=()=>CPT||(CPT=!CP_JS?Promise.resolve(null):window.FRCommentaryText?Promise.resolve(window.FRCommentaryText):new Promise(res=>{
  window.FR_COMMENTARY_PANE=false;const sc=document.createElement('script');sc.src=CP_JS;
  sc.onload=()=>res(window.FRCommentaryText||null);sc.onerror=()=>res(null);document.head.appendChild(sc);}));
// on a phone the panes take turns: a work opened from the list is shown from its top, not wherever the list had been scrolled to
function keepInView(side){
  if(!isPhone())return;
  const {top} = PANE[side].getBoundingClientRect(),st=(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky'))||.75)*16+52;
  if(top<0||top>innerHeight*.6)window.scrollTo({top:Math.max(0,window.scrollY+top-st)});
}
// A COMMENTATOR'S PLACE, page after page, with his divisions of it as the pane's contents
async function paneWork(side,slug,focus){
  const host=PANE[side],cs=commentators(true),c=cs.find(x=>x.slug===slug),token=++RUN[side];
  const key=['work',PL.key,slug,LANE].join('|');
  if(!c){SHOWN[side]='';const w=D.texts.works[slug]||[];
    host.innerHTML=`<header class="ph"><div class="ph-row">${sourceSelect(side,cs,slug)}</div>${side==='b'?`<button type="button" class="back" data-back>← All ${WHO()}</button>`:''}
      <h2>${esc(w[0]||slug)}${born({y:w[4]||9999})}</h2>${w[1]?`<p class="what">${workLine({t:w[1],vol:w[2]||'',y:w[4]||9999})}</p>`:''}</header><div class="scroll">${absentNote(slug,side)}</div>`;return;}
  const {items} = c;
  if(focus==null&&S.deck==='summa'&&S.art){const k=items.findIndex(x=>String(x[4]||'')===String(S.art));if(k>=0)focus=k;}
  const toc=items.length>1?`<select data-toc="${side}" aria-label="${esc(c.a)}'s divisions of this ${noun()}">${items.map((x,k)=>`<option value="${k}"${k===focus?' selected':''}${headTitle(x[0])}>${' '.repeat(Math.max(0,Math.min(3,x[2])-1))}${esc(headSplit(x[0]).en.slice(0,110))} · ${atw(slug)} ${esc(x[1])}</option>`).join('')}</select>`:'';
  const cur=items[focus!=null?focus:0]||items[0];
  const head=`<header class="ph"><div class="ph-row">${sourceSelect(side,cs,slug)}<a class="open" data-open="${side}" href="${read(slug,cur[1],cur[3])}">Open in the reader ↗</a></div>
    ${side==='b'?`<button type="button" class="back" data-back>← All ${WHO()}</button>`:''}
    <h2>${esc(c.a||c.t)}${born(c)}</h2><p class="what">${workLine(c)} · ${esc(pp(c))}</p>${toc}</header>`;
  if(SHOWN[side]===key){host.querySelector('.ph').outerHTML=head;if(focus!=null)scrollToEl(side,document.getElementById(`${side}-i${focus}`),true);return;}
  SHOWN[side]=key;
  host.innerHTML=`${head}<div class="scroll"><div class="pages"></div><div class="sk" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div><p class="end" hidden></p></div>`;
  // a division beyond the first fifty pages of a long place (the Salmanticenses' grace runs to a hundred and forty) is read from
  // its own page; the place's opening stays a click away
  const fp=focus!=null?+items[focus][1]:c.from,start=fp>c.from+MAXP-6?Math.max(c.from,fp-1):c.from;
  const pagesEl=host.querySelector('.pages'),last=Math.min(c.to,start+MAXP-1),lanes=LANE==='both'?['la','en']:[LANE];
  if(start>c.from)pagesEl.insertAdjacentHTML('beforebegin',`<p class="end" style="border:0;margin:.6rem 0 0;padding:0">${esc(c.a)} begins this ${noun()} at p. ${esc(c.from)}. <a href="${read(slug,c.from,items[0][3])}">Read it from there in the reader ↗</a></p>`);
  let drawn=0,landed=focus==null;host.dataset.moved='';
  // a Father in Migne or an EEBO book has no work folder (its meta.json is not there, so blocksOf finds no pages): it is read as the
  // Scripture page reads it (FRCommentaryText, commentary-pane.js, two columns a step in Migne); where that reader is not on the site,
  // the pane says so and links the reader at the page
  const fam=isFam(slug),T=fam?await commentaryText():null;
  if(token!==RUN[side])return;
  const famNote=()=>{pagesEl.innerHTML=`<p class="note"><a href="${read(slug,start,cur[3])}">Open ${atw(slug)} ${esc(start)} in the reader ↗</a></p>`;host.querySelector('.sk')?.remove();};
  if(fam&&!T){famNote();keepInView(side);return;}
  const unit=/^(?:pld|pg)-/.test(slug)?'column':'page',step=fam&&T.stride?T.stride(slug):1;
  let first=false;
  for(let n=start;n<=last;n+=step){
    const cols={};let at=n;
    if(fam){
      let g=null;try{g=await T.page(slug,n);}catch(_){g=null;}
      if(token!==RUN[side])return;
      if(!g||!g.p){if(n===start){famNote();keepInView(side);return;}break;}
      at=+g.p.n||n;n=at;
      for(const l of ['en','la'])cols[l]=String((l==='en'?g.p.en:g.p.la)||'').split(/\n+/).map(x=>x.trim()).filter(Boolean).map(x=>({t:x,h:false}));
    }else{
      for(const l of lanes)cols[l]=await blocksOf(slug,l,n);
      // the other language is asked for only when the chosen one is empty, so a page with one language shows it
      if(lanes.length===1&&cols[lanes[0]]&&!cols[lanes[0]].length){const o=lanes[0]==='en'?'la':'en';cols[o]=await blocksOf(slug,o,n);}
      if(token!==RUN[side])return;
      if(lanes.every(l=>cols[l]==null)){if(n===start){pagesEl.innerHTML=retryNote('These pages did not load.',` <a href="${read(slug,c.from,items[0][3])}">Open them in the reader ↗</a>`);host.querySelector('.sk').remove();return;}break;}
    }
    const on=items.map((x,k)=>({x,k})).filter(o=>+o.x[1]>=at&&+o.x[1]<at+step);
    pagesEl.insertAdjacentHTML('beforeend',pageHTML(side,slug,at,cols,on,unit));drawn=at+step-1;
    if(!first){first=true;keepInView(side);}
    if(!landed&&+items[focus][1]<=drawn){landed=true;if(!host.dataset.moved){const go2=()=>{if(!host.dataset.moved&&token===RUN[side])scrollToEl(side,document.getElementById(`${side}-i${focus}`),false);};
      scrollToEl(side,document.getElementById(`${side}-i${focus}`),true);if(document.fonts)document.fonts.ready.then(go2);setTimeout(go2,400);}}
  }
  if(token!==RUN[side])return;
  host.querySelector('.sk')?.remove();
  const end=host.querySelector('.end');end.hidden=false;
  end.innerHTML=drawn<c.to?`${esc(c.a)} goes on to ${atw(slug)} ${esc(c.to)} on this ${noun()}. <a href="${read(slug,drawn+1)}">Read on in the reader from ${atw(slug)} ${esc(drawn+1)} ↗</a>`:`End of ${esc(c.a)} on this ${noun()}. <a href="${read(slug,c.to)}">Read on in the reader ↗</a>`;
  spy(side);
}
// the contents follow the reading: the division last passed is the one shown, and "Open in the reader" opens it
function spy(side){
  const host=PANE[side],sel=host.querySelector('select[data-toc]'),open=host.querySelector('a[data-open]');
  const slug=(host.querySelector('select[data-src]')||{}).value;if(!sel||!slug)return;
  const s=scrollerOf(side),top=s?s.getBoundingClientRect().top:((parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky'))||1)*16+60);
  let cur=null;for(const a of host.querySelectorAll('[data-item]')){if(a.getBoundingClientRect().top-top<=48)cur=a;else break;}
  if(!cur)return;
  const k=+cur.dataset.item.split('-i')[1];if(String(k)===sel.value)return;
  sel.value=String(k);
  const c=commentators(true).find(x=>x.slug===slug),it=c&&c.items[k];if(it&&open)open.href=read(slug,it[1],it[3]);
}
// THE COMMENTATORS OF THE PLACE: by tradition, then by date; each with his own divisions of it
// a work's machine preview on a grid deck (a row's 5th element, a string or {pv}), and the grid's note on what they are
function pvOf(){
  const m=new Map(),ow=(PL.out&&PL.out.works)||{};
  for(const [slug,o] of Object.entries(ow))if(o&&typeof o.pv==='string'&&o.pv.trim())m.set(slug,o.pv.trim());
  for(const r of rowsFor(true)){const v=r[4],t=typeof v==='string'?v:(v&&typeof v==='object'&&typeof v.pv==='string'?v.pv:'');if(t&&!m.has(r[0]))m.set(r[0],t);}
  return m;
}
function pvNote(){const t=String((G()&&G().pv_note)||'previews are machine drafts').trim();return `${t.charAt(0).toUpperCase()}${t.slice(1)}${/[.!?]$/.test(t)?'':'.'}`;}
// a second copy or issue folded under the copy the deck counts: the grid's dup_of, else (a table without it) the same author with the
// same full title and volume, the copy the deck's places cite most standing for both
function foldCopies(list){
  const bySlug=new Map(list.map(c=>[c.slug,c])),cites=sl=>deckPlaces().filter(p=>p.slugs.has(sl)).length,out=[];
  const main=new Map();
  for(const c of list){
    if(c.dup&&bySlug.has(c.dup)&&c.dup!==c.slug){main.set(c.slug,c.dup);continue;}
    if(c.dup)continue;
    const twin=out.find(x=>x.a&&x.a===c.a&&(x.ft||x.t)===(c.ft||c.t)&&x.fv===c.fv&&!x.dup);
    if(twin){const keep=cites(c.slug)>cites(twin.slug)?c:twin,drop=keep===c?twin:c;if(keep===c)out.splice(out.indexOf(twin),1,c);main.set(drop.slug,keep.slug);continue;}
    out.push(c);
  }
  for(const c of list)if(!main.has(c.slug)&&!out.includes(c))out.push(c);
  for(const [d,m] of main){const keep=bySlug.get(m),dc=bySlug.get(d);if(keep&&dc)(keep.also=keep.also||[]).push(dc);}
  return out.map(c=>{c.also=c.also||[];return c;});
}
// how another copy is named: the year (and place) its catalogue entry gives in brackets
const copyOf=c=>{const m=/\(([^)]*\d{4}[^)]*)\)/.exec(`${c.fv||''} ${c.ft||''}`);return m&&m[1].length<=60?m[1]:'';};
// a place with nothing aligned to it names the nearest one that has something
function nearestFilled(){
  const ps=places().filter(p=>!p.part||p.part===S.part),i=ps.findIndex(p=>p.k===S.place);
  for(let d=1;d<ps.length;d++){const p=[ps[i-d],ps[i+d]].find(x=>x&&x.n);if(p)return ` Nearest with ${GD()?GRID[S.deck].many:SYS()?'systems':'commentators'}: <a href="#${esc([S.deck,p.part||S.part,p.k].join('/'))}">${esc(NAMED()?p.name:placeName(p.k,p.part))}</a>.`;}
  return '';
}
function paneDir(side){
  const host=PANE[side],key=['dir',PL.key,S.art||''].join('|');
  if(SHOWN[side]===key)return;
  SHOWN[side]=key;RUN[side]++;
  const PV=GD()?pvOf():null,all=commentators(),cs=foldCopies(all.map(c=>({...c,also:[]})));
  const here=new Set(commentators(true).map(c=>c.slug));
  const away=foldCopies(deckWorks().filter(sl=>!here.has(sl)).map(sl=>{const w=wk(sl);return {slug:sl,a:w[0]||'',t:w[1]?shortWork(w[1]):sl,vol:noDash(w[2]||''),ft:noDash(w[5]||w[1]||''),fv:noDash(w[6]||w[2]||''),dup:w[7]||'',tr:w[3]||'Other',y:w[4]||9999,from:0};}).filter(c=>c.a||c.t!==c.slug).sort(order));
  const [one,many]=GD()?['work','works']:SYS()?['system','systems']:['commentator','commentators'];
  const verb=S.deck==='reformed'?'argue':GD()||SYS()?'treat':'comment on';
  let seq=0;
  const acts=c=>{
    const k=S.deck==='summa'&&S.art?c.items.findIndex(x=>String(x[4]||'')===String(S.art)):0,f=c.items[k>=0?k:0],id=`${side}-toc${++seq}`;
    return `<div class="c-acts"><a class="ext" href="${read(c.slug,f[1],f[3])}">Open in the reader ↗</a>${c.items.length>1?`<button type="button" class="c-toc" aria-expanded="false" aria-controls="${id}">Contents</button>`:''}</div>`
      +`${c.items.length>1?`<div class="toc" id="${id}" hidden><ol>${c.items.map((x,j)=>`<li class="d${Math.max(1,Math.min(3,x[2]))}"><button type="button" data-read="${esc(c.slug)}" data-i="${j}"${headTitle(x[0])}>${esc(headSplit(x[0]).en)}</button><a href="${read(c.slug,x[1],x[3])}" title="Open in the reader">p. ${esc(x[1])}</a></li>`).join('')}</ol></div>`:''}`;
  };
  const also=c=>(c.also.length?`<p class="also">${c.also.map(d=>`Also in another copy${copyOf(d)?` (${esc(copyOf(d))})`:''}: <button type="button" class="also-r" data-read="${esc(d.slug)}">read that copy</button>`).join(' · ')}</p>`:'');
  const pvLine=c=>(PV&&PV.has(c.slug)?`<p class="pv">${esc(PV.get(c.slug))}</p>`:'');
  const readBtn=(c,inner)=>{const k=S.deck==='summa'&&S.art?c.items.findIndex(x=>String(x[4]||'')===String(S.art)):0;return `<button type="button" class="c-read" data-read="${esc(c.slug)}"${k>0?` data-i="${k}"`:''}>${inner}</button>`;};
  const sum=c=>`<span class="sum">${esc(summary(c.items))} · ${esc(pp(c))}</span>`;
  // one row per author: a lone work on his own row, several works or volumes nested under him, each with its own counts and actions
  const hereRow=g=>{
    if(g.items.length===1){const c=g.items[0];return `<li class="c" data-slug="${esc(c.slug)}">${readBtn(c,`<span class="who">${esc(c.a||'Unknown')}${born(c)}</span><span class="work"${fullAttr(c)}>${workLine(c)}</span>${sum(c)}`)}${acts(c)}${pvLine(c)}${also(c)}</li>`;}
    const same=g.items.every(c=>c.t===g.items[0].t);
    return `<li class="c c-many"><div class="c-who"><span class="who">${esc(g.a||'Unknown')}${born(g)}</span>${same?`<span class="work">${esc(g.items[0].t)}</span>`:''}<span class="near">${g.items.length} ${same?'volumes':'works'} on this ${noun()}</span></div>`
      +`<ul class="vols">${g.items.map(c=>`<li data-slug="${esc(c.slug)}">${readBtn(c,`<span class="work"${fullAttr(c)}>${same?esc(c.vol||c.t):workLine(c)}</span>${sum(c)}`)}${acts(c)}${pvLine(c)}${also(c)}</li>`).join('')}</ul></li>`;
  };
  const awayRow=g=>{
    if(g.items.length===1){const c=g.items[0];return `<li class="c" data-slug="${esc(c.slug)}"><div class="c-who"><span class="who">${esc(c.a||'Unknown')}${born(c)}</span><span class="work"${fullAttr(c)}>${workLine(c)}</span><span class="near">${nearHTML(c.slug)}</span></div>${also(c)}</li>`;}
    const same=g.items.every(c=>c.t===g.items[0].t);
    return `<li class="c c-many"><div class="c-who"><span class="who">${esc(g.a||'Unknown')}${born(g)}</span>${same?`<span class="work">${esc(g.items[0].t)}</span>`:''}<span class="near">${g.items.length} ${same?'volumes':'works'}</span></div>`
      +`<ul class="vols">${g.items.map(c=>`<li data-slug="${esc(c.slug)}"><span class="work"${fullAttr(c)}>${same?esc(c.vol||c.t):workLine(c)}</span><span class="near">${nearHTML(c.slug)}</span>${also(c)}</li>`).join('')}</ul></li>`;
  };
  let gi=0;
  const group=(t,g,row)=>`<details class="grp f1" data-one="wb"${gi++===0?' open':''}><summary><h3 class="trad">${esc(t)} <span>${g.length}</span></h3>${peek(byAuthor(g).map(x=>x.a||x[0]&&x[0].a||''))}</summary><ul class="dir">${byAuthor(g).map(row).join('')}</ul></details>`;
  const absent=away.length?`<details class="absent"><summary>${away.length} more ${away.length===1?one:many}, not on this ${noun()}</summary>${byGroup(away).map(([t,g])=>group(t,g,awayRow)).join('')}</details>`:'';
  const n=cs.length;
  host.innerHTML=`<header class="ph">${DOSDECK()&&PL.props&&!isPhone()?`<div class="ph-row">${rmodeHTML()}</div>`:''}<div class="ph-row">${sourceSelect(side,all,'')}</div>
    <h2>${GD()?GRID[S.deck].head:SYS()?'Systems':'Commentators'}</h2><p class="count">${n?`${n} ${n===1?one:many} ${verb} this ${noun()}${S.deck==='summa'&&S.art?` (article ${esc(S.art)})`:''}. Choose one to read beside ${SYS()?'the other pane':'the text'}.`:`No ${many} on this ${noun()} yet.${nearestFilled()}`}</p>
    ${n+away.length>8?`<input class="find" type="search" autocomplete="off" spellcheck="false" placeholder="Find a ${GD()?GRID[S.deck].find:SYS()?'system':'commentator'}…" aria-label="Find a ${GD()?GRID[S.deck].find:SYS()?'system':'commentator'}">`:''}</header>
    <div class="scroll">${PV&&PV.size?`<p class="pvnote">${esc(pvNote())}</p>`:''}${byGroup(cs).map(([t,g])=>group(t,g,hereRow)).join('')}${absent}</div>`;
}
// one row per author, his works in the order they came
const byAuthor=list=>{const m=new Map();list.forEach(c=>{const k=c.a||c.t;if(!m.has(k))m.set(k,{a:c.a,y:c.y,tr:c.tr,items:[]});const g=m.get(k);g.items.push(c);if(c.y<g.y)g.y=c.y;});return [...m.values()];};
// the systems' grid is fetched the first time that deck is opened
let SYSP=null;
function loadSystems(){return SYSP||(SYSP=J(`/v1/decks/systems/grid.json${VER}`).then(g=>{if(g&&g._places){D.sys=g;D.texts.works={...(g._works||{}),...D.texts.works};}else SYSP=null;return g;}));}
// the Reformed, Vitringa and Lutheran grids likewise, each the first time its deck is opened
const GRIDP={};
function loadGrid(deck){return GRIDP[deck]||(GRIDP[deck]=J(`/v1/decks/${encodeURIComponent(deck)}/grid.json${VER}`).then(g=>{if(g&&Array.isArray(g._places)&&Array.isArray(g._parts)){D.grids=D.grids||{};D.grids[deck]=g;D.texts.works={...(g._works||{}),...D.texts.works};}else delete GRIDP[deck];return g;}));}
// the left pane: the text of the place; on the systems, which have no common text, the place's first system unless one was chosen
function leftSlug(){
  if(!SYS())return S.l==='~pages'?null:S.l;
  if(S.l==='-')return null;
  if(S.l)return S.l;
  // the canon family (Migne, the EEBO texts) is read in the reader from its own TEI, not here: the default is the first system this page can read
  const cs=new Set(commentators(true).map(c=>c.slug)),ok=sl=>cs.has(sl)&&sl!==S.r,rows=rowsFor(true).map(r=>r[0]);
  return rows.find(sl=>ok(sl)&&!/^(pg|pld|po|eebo)-\d+$/.test(sl))||rows.find(ok)||null;
}
// A render that was overtaken by a newer address stops where it is: it would otherwise draw the new place from the old render's
// half-loaded state, and the pane would keep that blank (the place's own render finds the pane already drawn).
let RSEQ=0;
let DOSLAST='';
async function render(){
  if(!D)return;
  const seq=++RSEQ;
  if(SYS()){
    if(!D.sys){renderNav();PANE.a.innerHTML='<p class="note" style="padding:1rem 1.2rem">Loading the systems…</p>';PANE.b.innerHTML='';SHOWN.a=SHOWN.b='';
      await loadSystems();if(!SYS()||seq!==RSEQ)return;
      if(!D.sys){PANE.a.innerHTML=`<div class="scroll">${retryNote('The systems did not load.')}</div>`;return;}}
    if(await redirectSystem()||seq!==RSEQ)return;
    // a place belongs to one part: the address's part follows the place it names
    const pl=S.place&&D.sys._places.find(x=>x[1]===S.place);
    if(pl)S.part=pl[0];else{S.place=null;if(!D.sys._parts.some(p=>p[0]===S.part))S.part='I';}
  }
  if(GD()){
    if(!G()){renderNav();PANE.a.innerHTML=`<p class="note" style="padding:1rem 1.2rem">Loading ${esc(DECKNAME[S.deck])}…</p>`;PANE.b.innerHTML='';SHOWN.a=SHOWN.b='';
      const {deck} = S;await loadGrid(deck);if(S.deck!==deck||seq!==RSEQ)return;
      if(!G()){const n=DECKNAME[S.deck];PANE.a.innerHTML=`<div class="scroll">${retryNote(`${esc(n.charAt(0).toUpperCase()+n.slice(1))} did not load.`)}</div>`;return;}}
    // a place key is unique only inside its part: the address's part stands when the place is in it, else the place's own part
    const g=G();
    if(!g._parts.some(p=>p[0]===S.part)){const pl=S.place&&g._places.find(x=>x[1]===S.place);S.part=pl?pl[0]:((g._parts[0]||[])[0]||'');}
    if(S.place&&!(g[S.part]||{})[S.place]){const pl=g._places.find(x=>x[1]===S.place);if(pl)S.part=pl[0];else S.place=null;}
  }
  // a part with no place chosen opens on its first place with a commentator, so there is always a text to read
  if(!S.place){const ps=places().filter(p=>!p.part||p.part===S.part),f=ps.find(p=>p.n)||ps[0];if(f){S.place=f.k;history.replaceState(null,'',`#${hashOf()}`);}}
  renderNav();
  if(!S.place)return;
  await loadPlace();
  if(seq!==RSEQ)return;
  const left=leftSlug(),pv=!left&&probOn();
  $('#desk').dataset.view=pv?'problems':S.deck;
  $('#showA').textContent=left?((D.texts.works[left]||[])[0]||'Left'):pv?PRB().tab:'Text';
  $('#showB').textContent=S.r?((D.texts.works[S.r]||[])[0]||'Commentator'):`${GD()?GRID[S.deck].head:SYS()?'Systems':'Commentators'} (${commentators().length})`;
  await Promise.all([left?paneWork('a',left,S.j):pv?(PL.props.sections?paneSections('a'):paneProblems('a')):GD()?paneBase('a'):paneText('a'),S.r?paneWork('b',S.r,S.i):DOSDECK()&&PL.props&&rmode()==='dossier'?paneDossier('b'):Promise.resolve(paneDir('b'))]);
  markSel();
  if(seq===RSEQ&&window.FRDecks)window.FRDecks.rendered=hashOf();
  // an address that names a view, a holder or a problem raises its dossier on a phone, once
  if(isPhone()&&DOSDECK()&&PL.props&&(S.sel||/^[pa]\d+$/.test(S.art||''))){const k=`${PL.key}|${S.art}|${S.sel}`;if(DOSLAST!==k){DOSLAST=k;dossierSheet();}}
}
// THE SYSTEMS OFF THE TAB ROW (2026-10-22, owner: "this feels redundant and really hard to nav: Systems of theology"). Its addresses
// stay: one that names a system (?r= or ?l=) goes to the deck of the system's confession (the Reformed problems, the Lutheran questions,
// the Summa for the Roman systems), at the place there whose works list the system and whose title is nearest the systems place's, the
// system open in the right pane; any other opens the old view, without a tab.
const WORDS=t=>new Set(fold(t).split(' ').filter(w=>w.length>3&&!/^(?:the|and|with|from|their|which|whether|concerning|about|being)$/.test(w)));
async function redirectSystem(){
  const slug=S.r||(S.l&&S.l!=='-'?S.l:null),w=slug&&D.texts.works[slug];
  if(!w)return false;
  const tr=String(w[3]||''),deck=/luther/i.test(tr)?'lutheran':/reform|english/i.test(tr)?'reformed':/roman|catholic|medieval|scholastic/i.test(tr)?'summa':null;
  if(!deck)return false;
  const sp=(D.sys._places.find(x=>x[1]===S.place)||[]),want=WORDS(`${sp[2]||S.place||''} ${sp[3]||''}`);
  const cands=[];
  if(deck==='summa'){for(const [pk] of PARTS)for(const [k,q] of Object.entries(D.summa[pk]||{}))if(/^\d+$/.test(k)&&(q.works||[]).some(r=>r[0]===slug))cands.push({part:pk,k,t:q.t||''});}
  else{const g=await loadGrid(deck);if(!g)return false;for(const [pk,k,t,la] of g._places)if((((g[pk]||{})[k]||{}).works||[]).some(r=>r[0]===slug))cands.push({part:pk,k,t:`${t} ${la||''}`});}
  if(!cands.length)return false;
  const score=c=>{const ws=WORDS(c.t);let n=0;for(const x of want)if(ws.has(x))n++;return n;};
  const best=cands.slice().sort((a,b)=>score(b)-score(a))[0];
  location.replace(`#${deck}/${best.part}/${best.k}?r=${encodeURIComponent(slug)}`);
  return true;
}
// the next place; on the systems the stepper walks on into the next part
function step(d){const ps=places(),i=ps.findIndex(p=>p.k===S.place&&(!p.part||p.part===S.part));const n=ps[i+d];if(n){if(n.part)S.part=n.part;S.place=n.k;S.art=null;S.i=null;S.j=null;$('#grid').hidden=true;go();}}
function show(w){$('#desk').dataset.show=w;document.querySelectorAll('.switch [data-show]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.show===w)));}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-deck]');if(t&&(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0))return;if(t){e.preventDefault();S={deck:t.dataset.deck,part:FIRST[t.dataset.deck]||'1',place:null,art:null,r:null,i:null,l:null,j:null};go();return;}
  // another book is mostly another volume: the panes go back to the text and the list
  const p=e.target.closest('[data-part]');if(p){S.part=p.dataset.part;S.place=null;S.art=null;S.r=null;S.i=null;S.l=null;S.j=null;go();return;}
  const g=e.target.closest('[data-place]');if(g){if(g.dataset.ppart)S.part=g.dataset.ppart;S.place=g.dataset.place;S.art=null;S.i=null;S.j=null;$('#grid').hidden=true;$('#pick').setAttribute('aria-expanded','false');go();return;}
  const a=e.target.closest('[data-art]');if(a){S.art=a.dataset.art===''?null:a.dataset.art;S.i=null;S.j=null;go();return;}
  const l=e.target.closest('#lanes [data-lane]');if(l){LANE=l.dataset.lane;try{localStorage.setItem('fr_deck_lane',LANE);}catch(_){}render();return;}
  const r=e.target.closest('[data-read]');if(r){S.r=r.dataset.read;S.i=r.dataset.i!=null?+r.dataset.i:null;show('b');go();return;}
  if(e.target.closest('[data-back]')){S.r=null;S.i=null;go();return;}
  const rm=e.target.closest('[data-rm]');
  if(rm){RMODE[S.deck]=rm.dataset.rm;SHOWN.b='';if(rm.dataset.rm==='dossier'){S.r=null;S.i=null;}render();return;}
  const sm=e.target.closest('.psum-more');if(sm){const p=document.getElementById(sm.getAttribute('aria-controls')),open=sm.getAttribute('aria-expanded')!=='true';if(p)p.classList.toggle('is-open',open);sm.setAttribute('aria-expanded',String(open));sm.textContent=open?'Less':'More';return;}
  const dm=e.target.closest('#dlMore');if(dm){const dl=$('#dlede'),open=dm.getAttribute('aria-expanded')!=='true';dl.classList.toggle('is-open',open);dm.setAttribute('aria-expanded',String(open));dm.textContent=open?'Less':'More';return;}
  const tc=e.target.closest('.c-toc');if(tc){const box=document.getElementById(tc.getAttribute('aria-controls')),open=tc.getAttribute('aria-expanded')!=='true';tc.setAttribute('aria-expanded',String(open));if(box)box.hidden=!open;return;}
  const w=e.target.closest('.switch [data-show]');if(w){show(w.dataset.show);return;}
  if(e.target.closest('#pick')){const g2=$('#grid');g2.hidden=!g2.hidden;$('#pick').setAttribute('aria-expanded',String(!g2.hidden));if(!g2.hidden){const q=g2.querySelector('.gq');if(q&&!isPhone())q.focus();}return;}
  if(e.target.closest('#prev')){step(-1);return;}
  if(e.target.closest('#next')){step(1);}
});
document.addEventListener('change',e=>{
  const s=e.target.closest('select[data-src]');
  if(s){if(s.dataset.src==='a'){S.l=s.value||null;S.j=null;if(!S.l&&PL.props)S.alt=null;}else{S.r=s.value||null;S.i=null;}go();return;}
  const t=e.target.closest('select[data-toc]');
  if(t){const side=t.dataset.toc,k=+t.value;if(side==='a')S.j=k;else S.i=k;history.replaceState(null,'',`#${hashOf()}`);
    const el=document.getElementById(`${side}-i${k}`);if(el)scrollToEl(side,el,true);
    const c=commentators(true).find(x=>x.slug===(side==='a'?leftSlug():S.r)),it=c&&c.items[k],o=PANE[side].querySelector('a[data-open]');if(it&&o)o.href=read(c.slug,it[1],it[3]);}
});
document.addEventListener('input',e=>{
  // the place list narrowed as one types: a place by its name or number, a part's heading kept while any of its places shows
  const gq=e.target.closest&&e.target.closest('.gq');
  if(gq){const q=fold(gq.value),g=$('#grid');let n=0;g.querySelectorAll('button[data-place]').forEach(b=>{const ok=!q||fold(`${b.dataset.place} ${b.textContent} ${b.getAttribute('aria-label')||''}`).includes(q);b.hidden=!ok;if(ok)n++;});
    g.querySelectorAll('.gpart').forEach(h=>{let el=h.nextElementSibling,any=false;while(el&&!el.classList.contains('gpart')){if(!el.hidden)any=true;el=el.nextElementSibling;}h.hidden=!any;});
    const c=g.querySelector('.gct');if(c)c.textContent=q?`${n} of ${g.querySelectorAll('button[data-place]').length}`:c.dataset.all||c.textContent;return;}
  const f=e.target.closest('.find');if(!f)return;const q=fold(f.value);
  PANE.b.querySelectorAll('.c').forEach(li=>{const t=li.querySelector('.c-read,.c-who');li.hidden=!!q&&!fold(t?t.textContent:'').includes(q);});
  PANE.b.querySelectorAll('.grp').forEach(g=>{const any=[...g.querySelectorAll('.c')].some(li=>!li.hidden);g.hidden=!any;if(q&&any)g.open=true;});
  const sc=PANE.b.querySelector('.scroll');if(sc){if(q)sc.dataset.finding='1';else delete sc.dataset.finding;}
  const ab=PANE.b.querySelector('details.absent');if(ab&&q)ab.open=[...ab.querySelectorAll('.c')].some(li=>!li.hidden);
});
// the reader scrolls a pane himself: the contents follow, and a late page no longer pulls him to the chosen division
let spyRaf=0;
document.addEventListener('scroll',()=>{
  if(spyRaf)return;spyRaf=requestAnimationFrame(()=>{spyRaf=0;spy('a');spy('b');});},true);
// reading down in a pane first lifts the page until the desk is docked under the bar, so the panes fill the window; then the pane
// itself scrolls. Reading up past a pane's top brings the page back (the browser's own scroll chaining).
document.addEventListener('wheel',e=>{
  const pane=e.target.closest&&e.target.closest('.pane');if(!pane||isPhone()||e.deltaY<=0||e.ctrlKey)return;
  const {top} = $('#desk').getBoundingClientRect(),st=parseFloat(getComputedStyle(pane).top)||12;
  if(top>st+1){e.preventDefault();window.scrollBy(0,Math.min(e.deltaY,top-st));}
},{passive:false});
['wheel','touchmove','keydown'].forEach(ev=>document.addEventListener(ev,e=>{const pane=e.target.closest&&e.target.closest('.pane');if(pane)pane.dataset.moved='1';},{passive:true,capture:true}));
document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||(e.target.closest&&e.target.closest('input,textarea,select,[contenteditable]')))return;
  if(e.key==='ArrowLeft'&&!e.metaKey&&!e.ctrlKey&&!e.altKey){step(-1);}
  else if(e.key==='ArrowRight'&&!e.metaKey&&!e.ctrlKey&&!e.altKey){step(1);}
  else if(e.key==='Escape'&&!$('#grid').hidden){$('#grid').hidden=true;$('#pick').setAttribute('aria-expanded','false');}
});
// the tab row: the arrows, Home and End move along it, Space or Enter opens the deck
document.addEventListener('keydown',e=>{
  const t=e.target.closest&&e.target.closest('.tabs [role="tab"]');
  if(!t)return;
  if(e.key===' '){e.preventDefault();t.click();return;}
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  const list=[...t.closest('.tabs').querySelectorAll('[role="tab"]')],i=list.indexOf(t),n=list.length;
  list[e.key==='Home'?0:e.key==='End'?n-1:(i+(e.key==='ArrowRight'?1:-1)+n)%n].focus();
  e.preventDefault();
},true);
document.addEventListener('toggle',e=>{const d=e.target;if(d&&d.classList&&d.classList.contains('rcv-fold')&&d.open&&d.querySelector('.rcv-in'))rcvFoldFill(d);},true);
document.addEventListener('keydown',e=>{
  if(e.altKey||e.ctrlKey||e.metaKey||!e.target||!e.target.closest)return;
  const t=e.target,head=t.closest('#paneA .probs .acc-t'),item=null;
  if((head||item)&&(e.key==='ArrowDown'||e.key==='ArrowUp')){
    const list=head?[...PANE.a.querySelectorAll('.probs>.pr:not([hidden]) .acc-t')]:[...t.closest('.acc-b').querySelectorAll('.op-row,.jd-row')];
    const nx=list[list.indexOf(head||item)+(e.key==='ArrowDown'?1:-1)];
    e.preventDefault();
    if(!nx)return;
    nx.focus();
    if(head){const m=/^a-([ps]\d+)$/.exec(nx.closest('.pr').id||'');if(m)selectDos(m[1],null,nx,{sheet:false,reveal:true});}
    return;
  }
  if((head||item)&&e.key==='ArrowRight'){
    e.preventDefault();
    if(item){item.click();if(!isPhone()){const d=PANE.b.querySelector('.dos');if(d)d.focus({preventScroll:true});}return;}
    if(head.getAttribute('aria-expanded')!=='true'){head.click();return;}
    if(isPhone()){const m=/^a-([ps]\d+)$/.exec(head.closest('.pr').id||'');if(m)selectDos(m[1],null,head,{sheet:true});}
    else{const d=PANE.b.querySelector('.dos');if(d)d.focus({preventScroll:true});}
    return;
  }
  if(item&&e.key==='ArrowLeft'){e.preventDefault();const h=item.closest('.pr').querySelector('.acc-t');if(h)h.focus();return;}
  if(e.key==='ArrowLeft'&&t.closest('#paneB .dos')&&!t.closest('input,textarea,select,[contenteditable]')){
    const back=PANE.a.querySelector('.acc-t[aria-expanded="true"]');
    if(back){e.preventDefault();back.focus();}
  }
},true);
window.addEventListener('hashchange',()=>{state();render();});
function boot(){
  PANE.a.innerHTML='<div class="scroll"><p class="note">Loading the decks…</p></div>';
  return Promise.all([J(`/v1/sentences.json${VER}`),J(`/v1/summa.json${VER}`),J(`/v1/decks/texts.json${VER}`),J(`/v1/decks/canon.json${VER}`)])
    .then(([sent,summa,texts,canonD])=>{if(!sent||!summa||!texts)throw new Error('decks');if(canonD)texts.works={...canonD.works,...texts.works};
      D={sent,summa,texts,canon:canonD};state();if(S.r&&isPhone())show('b');render();})
    .catch(()=>{PANE.a.innerHTML=`<div class="scroll">${retryNote('The decks did not load.')}</div>`;});
}
// Try again: forget what failed, ask again for what is on the page
function retryAll(){
  NET.failed.clear();[META,FILES,TEIS,WMETA,WSHARD,QF].forEach(m=>m.clear());
  PAIRP=null;Object.keys(GRIDP).forEach(k=>{if(!(D&&D.grids&&D.grids[k]))delete GRIDP[k];});
  PL={key:''};SHOWN.a=SHOWN.b='';
  if(!D)boot();else render();
}
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('[data-retry]')){e.preventDefault();retryAll();}});
window.FRDecks={retry:retryAll,net:NET};
boot();
