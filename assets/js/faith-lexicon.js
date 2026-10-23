/* Lexicon: ported from The Faith Received (tools/prdl_reader_prototype/lexicon.html); the data from the library worker, links into the reader on this site. */
window.__FR_BLOB_BASE__=window.__FR_BLOB_BASE__||"https://mo-tfr-library.mo-podcast-feed.workers.dev";
window.__FR_READER_PATH__=window.__FR_READER_PATH__||"/the-faith-received/read/";
window.__FR_LEXICON_PATH__=window.__FR_LEXICON_PATH__||"/the-faith-received/lexicon/";
const BLOB=(window.__FR_BLOB_BASE__||"").replace(/\/$/,"");
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fold=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim();
// A file the library has not got (404) is null. One it could not be asked for (the network, a 5xx, a 429) is tried again twice first.
const J=u=>{let n=0;const go=()=>fetch(BLOB+u).then(r=>{if(r.ok)return r.json();if(r.status===404||r.status===410)return null;throw new Error(String(r.status));})
  .catch(()=>{if(++n<3)return new Promise(res=>setTimeout(res,350*n)).then(go);return null;});return go();};
const RETRY='<button type="button" class="retry" data-retry>Try again</button>';
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('[data-retry]'))location.reload();});
// MereO hosts the same page with its own reader path (window.__FR_READER_PATH__ = '/the-faith-received/read/') and data address
const READER=(window.__FR_READER_PATH__||'/read');
const read=(w,p)=>`${READER}?w=${encodeURIComponent(w)}#b${encodeURIComponent(p)}-0`;
let INDEX=null,LETTER=null,CUR=null;
const nf=n=>Number(n||0).toLocaleString();
// HOW THE LIBRARY DEFINES IT (10-20, item 6): every work that defines the term, oldest author first, from v1/lexicon/history, bundles of
// about 38 terms named by FNV-1a over the term's id (The Faith Received runs/minimax_1019/lexicon/history.py). Each line is the machine's
// one-line English summary of how that page defines the term, not a quotation; the page link is the source.
const fnv=s=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h;};
const JZ=async u=>{try{const r=await fetch(BLOB+u);if(!r.ok)return null;const b=new Uint8Array(await r.arrayBuffer());
  const t=b[0]===0x1f&&b[1]===0x8b?await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(b);return JSON.parse(t);}catch(_){return null;}};
const histOf=async id=>{const d=await JZ(`/v1/lexicon/history/${fnv(id)%2048}.json.gz`);return d&&d.terms?d.terms[id]||null:null;};
const cent=y=>{if(y==null)return 'Undated';const c=Math.floor((y-1)/100)+1,s=c%100>=11&&c%100<=13?'th':({1:'st',2:'nd',3:'rd'}[c%10]||'th');return `${c+s} century`;};
const who=a=>a?`<span class="ha">${esc(a[0]||'Unknown author')}</span>${a[1]?` (${esc(a[1])})`:''}`:'';
/* the works in a pane that fills as its own scroll nears the end, forty at a time, each century under its own sticky head */
const HSTEP=40;
function histRows(h,from,to,last){let out='';
  for(const r of h.rows.slice(from,to)){const a=h.authors[r[2]]||[],c=cent(a[2]);
    if(c!==last){out+=`<li class="hc">${esc(c)}</li>`;last=c;}
    out+=`<li class="hr"><div class="hw">${who(a)}, <a href="${read(r[0],r[3])}">${esc(r[1]||r[0])}, p. ${esc(r[3])}</a>${r[5]>1?` · on ${r[5]} pages`:''}</div><p>${esc(r[4])}</p></li>`;}
  return [out,last];}
async function showHistory(id,head){const box=$('#hist');if(!box)return;const h=await histOf(id);if(CUR!==id)return;
  if(!h||!h.rows.length){box.innerHTML='';return;}
  const dated=h.rows.map(r=>h.authors[r[2]]).filter(a=>a&&a[2]!=null),first=dated[0],last=dated[dated.length-1];
  const span=first&&last&&first!==last?` from ${esc(first[0])} to ${esc(last[0])}`:'';
  const [html,first40]=histRows(h,0,HSTEP,null);let lastC=first40,drawn=Math.min(HSTEP,h.rows.length);
  box.innerHTML=`<h3 id="hist-h">How the library defines it <small>${nf(h.works)} ${h.works===1?'work':'works'}</small></h3><p class="hnote">${nf(h.works)} ${h.works===1?'work':'works'}${span}. Oldest first.</p>${window.TFRMethod?window.TFRMethod.html("<p>Each line is a one-line English summary made by machine. Open the page to read the author's own words.</p>"):''}<div class="hpane" role="region" aria-label="Every work that defines ${esc(head)}, the oldest first"><ol>${html}</ol></div>`;
  const pane=box.querySelector('.hpane'),ol=pane.querySelector('ol');
  // the list is part of the page, not a box of its own: more rows are drawn as the page scrolls toward its end
  const more=()=>{
    if(!pane.isConnected||drawn>=h.rows.length){removeEventListener('scroll',more);return;}
    if(pane.getBoundingClientRect().bottom>innerHeight+600)return;
    const [rows,lc]=histRows(h,drawn,drawn+HSTEP,lastC);lastC=lc;drawn=Math.min(drawn+HSTEP,h.rows.length);ol.insertAdjacentHTML('beforeend',rows);};
  addEventListener('scroll',more,{passive:true});more();}
const SIBS=new Map();
/* the list scrolls itself to the term open, never the page */
function keepInView(el){const l=el&&el.closest('.list');if(!l)return;const lr=l.getBoundingClientRect(),er=el.getBoundingClientRect();
  if(er.top<lr.top)l.scrollTop-=lr.top-er.top;else if(er.bottom>lr.bottom)l.scrollTop+=er.bottom-lr.bottom;}
function runHead(h){const el=$('#runhead');if(!h){el.hidden=true;el.innerHTML='';return;}
  el.hidden=false;el.innerHTML=`<span class="rh-1">${h.mark?`<b>${esc(h.mark)}</b>`:''}${h.range?`<span class="rh-range">${esc(h.range)}</span>`:''}</span><span class="rh-2"><span>${esc(h.count)}</span>${h.col?`<span>${esc(h.col)}</span>`:''}</span>`;}
function listHTML(rows){
  // one row a headword: the lexicon filed some headwords several times (wages: merces, merces with ὀψώνια, opsōnion); the list shows each
  // once, with the works of its fullest entry, and the entry opened names the others under "Also filed as"
  const by=new Map();rows.forEach(t=>{const k=String(t[1]).toLowerCase();if(!by.has(k))by.set(k,[]);by.get(k).push(t);});
  by.forEach((v,k)=>{v.sort((a,b)=>(b[2]||0)-(a[2]||0));SIBS.set(k,v);});
  return [...by.values()].map(v=>{const t=v[0];return `<li><button type="button" data-id="${esc(t[0])}" aria-current="${v.some(x=>x[0]===CUR)}">${esc(t[1])}${v.length>1?`<span class="lx-form"> · ${v.length} entries</span>`:''}<small>${t[2]?nf(t[2]):''}</small></button></li>`;}).join('');}
const heads=rows=>{const ws=[...new Set(rows.map(t=>String(t[1])))];return ws.length>1?`${ws[0]} to ${ws[ws.length-1]}`:ws[0]||'';};
async function showLetter(l){LETTER=l;document.querySelectorAll('#letters button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.l===l)));
  $('#list').setAttribute('aria-busy','true');
  const rows=await J(`/v1/lexicon/letters/${encodeURIComponent(l)}.json`);$('#list').removeAttribute('aria-busy');
  if(LETTER!==l)return;
  $('#list').innerHTML=rows?listHTML(rows):'<li class="empty">Nothing under this letter.</li>';
  const n=rows?$('#list').children.length:0;
  runHead({mark:l.toUpperCase(),range:rows?heads(rows):'',count:n?`${nf(n)} ${n===1?'term':'terms'}`:'No term under this letter',col:n?'works':''});
  keepInView($('#list [aria-current="true"]'));}
let REDIR=null,TSEQ=0;
/* a term's forms under their language: the first dozen, the rest one press away */
function formsHTML(t){const part=(name,lang,xs)=>{if(!xs||!xs.length)return '';const first=xs.slice(0,12),rest=xs.slice(12);
  return `<div><dt>${name}</dt><dd lang="${lang}">${first.map(esc).join(', ')}${rest.length?`<span class="frest" hidden>, ${rest.map(esc).join(', ')}</span> <button type="button" class="fmore" aria-expanded="false" data-n="${rest.length}">and ${rest.length} more</button>`:''}</dd></div>`;};
  const html=part('Latin','la',t.latin)+part('Greek','grc',t.greek);return html?`<dl class="forms">${html}</dl>`:'';}
/* a sense: its number, its gloss, its first three sources and the rest one press away */
const SRC=3,SSTEP=12;
function senseHTML(s,i){const src=s.src||[],n=src.length-SRC,one=([w,p,a,ti],j)=>`<li${j>=SRC?' hidden':''}>${esc(a||'')}${a?', ':''}<a href="${read(w,p)}">${esc(ti||w)}, p. ${esc(p)}</a></li>`;
  return `<li class="sense"><span class="sn">${i+1}</span><div><p class="gloss">${esc(s.gloss)}</p>${src.length?`<ol class="src">${src.map(one).join('')}${n>0?`<li><button type="button" class="srcmore" aria-expanded="false" data-n="${n}">Show ${n} more ${n===1?'source':'sources'}</button></li>`:''}</ol>`:''}</div></li>`;}
async function showTerm(id,write){
  /* a term asked for after this one wins: an earlier answer arriving late is dropped */
  const seq=++TSEQ;
  let t=await J(`/v1/lexicon/terms/${encodeURIComponent(id)}.json`);
  // an id merged into another entry (the duplicate headwords, 10-22): v1/lexicon/redirects.json names the entry that holds it now
  if(!t){if(REDIR===null)REDIR=(await J('/v1/lexicon/redirects.json'))||{};const to=REDIR[id];if(to&&to!==id){id=to;t=await J(`/v1/lexicon/terms/${encodeURIComponent(id)}.json`);}}
  if(seq!==TSEQ)return;
  if(!t){$('#entry').innerHTML=`<p class="muted">This term did not load. ${RETRY}</p>`;return;}
  CUR=id;document.querySelectorAll('#list button').forEach(b=>b.setAttribute('aria-current',String(b.dataset.id===id)));
  keepInView($('#list [aria-current="true"]'));
  // opened by its address before any letter list loaded: the headword's letter file tells whether it is filed more than once
  const hk=String(t.headword||'').toLowerCase(),hl=fold(hk).slice(0,1);
  if(hl&&!SIBS.has(hk)){const lr=await J(`/v1/lexicon/letters/${encodeURIComponent(hl)}.json`);if(lr){const by=new Map();lr.forEach(x=>{const k=String(x[1]).toLowerCase();if(!by.has(k))by.set(k,[]);by.get(k).push(x);});by.forEach((v,k)=>{v.sort((a,b)=>(b[2]||0)-(a[2]||0));if(!SIBS.has(k))SIBS.set(k,v);});}}
  if(seq!==TSEQ)return;
  const sib=(SIBS.get(hk)||[]).filter(x=>x[0]!==id);
  const also=sib.length?`<p class="also">Also filed as ${sib.map(x=>`<button type="button" class="lnk" data-id="${esc(x[0])}">${esc([x[3],x[4]].filter(Boolean).join(' · ')||x[1])}<small> ${esc(nf(x[2]))} ${x[2]===1?'work':'works'}</small></button>`).join(', ')}</p>`:'';
  const senses=t.senses||[];let shown=Math.min(SSTEP,senses.length);
  const moreLabel=()=>`Show ${Math.min(20,senses.length-shown)} more ${Math.min(20,senses.length-shown)===1?'sense':'senses'}`;
  const moreBtn=()=>senses.length>shown?`<button type="button" class="more" id="smore">${moreLabel()}</button>`:'';
  $('#entry').innerHTML=`<h2>${esc(t.headword)}</h2>${formsHTML(t)}${also}${
    senses.length?`<section aria-labelledby="sen-h"><h3 id="sen-h">Senses <small>${nf(senses.length)}</small></h3><ol class="senses">${senses.slice(0,shown).map(senseHTML).join('')}</ol>${moreBtn()}</section>`:''
    }<section class="hist" id="hist" aria-labelledby="hist-h"></section>`;
  $('#entry').onclick=e=>{
    /* more senses: the button stays where it is (and keeps the focus) until the last are shown, then the first of them takes it */
    const sm=e.target.closest('#smore');if(sm){const from=shown;shown=Math.min(senses.length,shown+20);
      $('#entry .senses').insertAdjacentHTML('beforeend',senses.slice(from,shown).map((s,j)=>senseHTML(s,from+j)).join(''));
      if(senses.length>shown){sm.textContent=moreLabel();return;}
      const next=$('#entry .senses').children[from];sm.remove();if(next){next.tabIndex=-1;next.focus({preventScroll:true});}return;}
    /* a sense's other sources, and a language's other forms, open and close in place */
    const sr=e.target.closest('.srcmore');if(sr){const open=sr.getAttribute('aria-expanded')!=='true',n=Number(sr.dataset.n);
      sr.closest('ol').querySelectorAll('li').forEach((li,j)=>{if(j>=SRC&&!li.contains(sr))li.hidden=!open;});
      sr.setAttribute('aria-expanded',String(open));sr.textContent=open?'Show fewer sources':`Show ${n} more ${n===1?'source':'sources'}`;return;}
    const fm=e.target.closest('.fmore');if(fm){const open=fm.getAttribute('aria-expanded')!=='true';fm.previousElementSibling.hidden=!open;
      fm.setAttribute('aria-expanded',String(open));fm.textContent=open?'show fewer':`and ${fm.dataset.n} more`;}
  };
  showHistory(id,t.headword);
  if(write)history.replaceState(null,'',`#${encodeURIComponent(id)}`);
}
/* THE FIND BOX: as you type, the terms whose forms begin with the letters (from the form's shard); Enter opens the term itself, or
   the first that begins so */
const SHARDS=new Map();
const shardOf=f=>{const k=f.slice(0,2).replace(/ς/g,'σ').replace(/[^\p{L}\p{N}]/gu,'_');if(!SHARDS.has(k))SHARDS.set(k,J(`/v1/lexicon/forms/${encodeURIComponent(k)}.json`).then(d=>d||{}));return SHARDS.get(k);};
async function find(q,open){
  const f=fold(q);if(!f)return;
  const shard=await shardOf(f);if(fold($('#q').value)!==f)return;
  const id=shard[f];if(id&&open){await showTerm(id,true);return;}
  // no exact form: the terms whose forms begin with what was typed, from the same shard
  const near=Object.entries(shard).filter(([k])=>k.startsWith(f)).slice(0,40);
  LETTER=null;document.querySelectorAll('#letters button').forEach(b=>b.setAttribute('aria-pressed','false'));
  $('#list').innerHTML=near.length?near.map(([k,i])=>`<li><button type="button" data-id="${esc(i)}" aria-current="${i===CUR}">${esc(k)}</button></li>`).join(''):'<li class="empty">No form begins with these letters.</li>';
  runHead({mark:'',range:`“${q.trim()}”`,count:near.length?`${near.length}${near.length===40?' or more':''} ${near.length===1?'form':'forms'} found`:'Nothing found',col:''});
  if(open&&near.length)await showTerm(near[0][1],true);
}
/* on a phone the entry sits under the list: a term tapped brings it into view */
function toEntry(e){if(!e.detail||!matchMedia('(max-width:760px)').matches)return;
  $('#entry').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});}
document.addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b){const inList=!!b.closest('#list');showTerm(b.dataset.id,true).then(()=>{if(inList)toEntry(e);});return;}const l=e.target.closest('[data-l]');if(l)showLetter(l.dataset.l);});
/* Up and Down walk the terms, each opening as it is reached */
$('#list').addEventListener('keydown',e=>{const d={ArrowDown:1,ArrowUp:-1}[e.key];if(!d)return;
  const bs=[...$('#list').querySelectorAll('button')],i=bs.indexOf(document.activeElement);if(i<0)return;e.preventDefault();
  const b=bs[Math.max(0,Math.min(bs.length-1,i+d))];if(b!==bs[i]){b.focus();b.click();}});
let findT=0;
$('#q').addEventListener('input',()=>{clearTimeout(findT);const v=$('#q').value;if(fold(v).length<2)return;findT=setTimeout(()=>find(v,false),260);});
$('#find').addEventListener('submit',e=>{e.preventDefault();clearTimeout(findT);find($('#q').value,true);});
J('/v1/lexicon/index.json').then(async d=>{
  if(!d){$('#entry').innerHTML=`<p class="muted">The lexicon did not load. ${RETRY}</p>`;return;}
  // one row per alphabet: Greek capitals Α and Β are not the Latin A and B beside them
  const SCRIPTS=[['Latin and English',/^[a-zæœ]$/],['Greek',/^[Ͱ-Ͽἀ-῿]$/],['Hebrew',/^[֐-׿]$/]];
  const btn=([l,n])=>`<button type="button" data-l="${esc(l)}" aria-pressed="false" title="${nf(n)} terms">${esc(l.toUpperCase())}</button>`;
  const all=Object.entries(d.letters).filter(([l])=>l!=='_');
  INDEX=d;$('#letters').innerHTML=SCRIPTS.map(([name,rx])=>[name,all.filter(([l])=>rx.test(l))]).filter(([,ls])=>ls.length)
    .map(([name,ls])=>`<div class="lgroup" role="group" aria-label="${esc(name)}"><span class="lname">${esc(name)}</span><div class="lbtns">${ls.map(btn).join('')}</div></div>`).join('');
  const top=d.top.slice(0,120);$('#list').innerHTML=listHTML(top);
  runHead({mark:'',range:'The most defined terms',count:`${nf($('#list').children.length)} terms`,col:'works'});
  const want=decodeURIComponent(location.hash.slice(1));
  if(want)await showTerm(want,false);else if(d.top.length)await showTerm(d.top[0][0],false);
});
// an address typed or followed from another page opens its term without a reload
addEventListener('hashchange',()=>{let id='';try{id=decodeURIComponent(location.hash.slice(1));}catch(_){id='';}if(id&&id!==CUR&&INDEX)showTerm(id,false);});
