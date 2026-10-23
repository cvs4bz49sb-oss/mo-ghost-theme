/* Index of the set: ported from The Faith Received (tools/prdl_reader_prototype/setindex.html); the data from the library worker, links into the reader on this site. */
window.__FR_BLOB_BASE__=window.__FR_BLOB_BASE__||"https://mo-tfr-library.mo-podcast-feed.workers.dev";
window.__FR_READER_PATH__=window.__FR_READER_PATH__||"/the-faith-received/read/";
window.__FR_LEXICON_PATH__=window.__FR_LEXICON_PATH__||"/the-faith-received/lexicon/";
const BLOB=(window.__FR_BLOB_BASE__||"").replace(/\/$/,"");
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fold=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9Ͱ-Ͽἀ-῿ ]+/g,' ').replace(/\s+/g,' ').trim().replace(/^(the|a|an) /,'');
// A file the library has not got (404) is null. One it could not be asked for (the network, a 5xx, a 429) is tried again twice first.
const J=u=>{let n=0;const go=()=>fetch(BLOB+u).then(r=>{if(r.ok)return r.json();if(r.status===404||r.status===410)return null;throw new Error(String(r.status));})
  .catch(()=>{if(++n<3)return new Promise(res=>setTimeout(res,350*n)).then(go);return null;});return go();};
const RETRY='<button type="button" class="retry" data-retry>Try again</button>';
document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('[data-retry]'))location.reload();});
// MereO hosts the same page with its own reader path (window.__FR_READER_PATH__ = '/the-faith-received/read/') and data address
const READER=(window.__FR_READER_PATH__||'/read');
const read=(w,p)=>`${READER}?w=${encodeURIComponent(w)}#b${encodeURIComponent(p)}-0`;
/* THE PAGE PREVIEW (2026-10-22, owner: "make it easy to preview things in the controversies, indices, etc"). A page reference keeps
   its link to the reader and gains a Preview that opens the page itself under its row: the page window (page-window.js) shows the
   cited page with the passage marked, the page before and after, and English, the source text or both. A Father in Migne or an
   EEBO book, which the page window cannot read, is read by the Scripture page's reader of them (FRCommentaryText, commentary-pane.js,
   loaded on the first such preview with its pane left off), in the same markup. Failing both, the button turns into the reader link;
   never the reader in a frame. One preview a column (cfg.col): opening another there closes it; Escape closes it. The same block on
   the controversies, the maps, the atlas, the shared questions and the set indexes, and in Mere Orthodoxy's ports of them (where
   cfg.text is empty, so a Father in Migne opens the reader). */
const PVW=(cfg=>{
  const FAMILY=/^(?:pld|pg|po|eebo)-\d+$/,NONE=new Set(),OPEN=[];
  let seq=0,text=null;
  const at=(w,p)=>`${/^(?:pld|pg)-/.test(w)?'col.':'p.'} ${p}`;
  const can=w=>!FAMILY.test(w)||!!cfg.text;
  const reader=()=>text||(text=window.FRCommentaryText?Promise.resolve(window.FRCommentaryText):new Promise(res=>{
    window.FR_COMMENTARY_PANE=false;const s=document.createElement('script');s.src=cfg.text;
    s.onload=()=>res(window.FRCommentaryText||null);s.onerror=()=>res(null);document.head.appendChild(s);}));
  async function fill(el,w,p,hl){
    try{
      if(FAMILY.test(w)){const T=cfg.text?await reader():null;return T?await T.fill(el,{slug:w,page:p}):false;}
      return window.FRPageWindow?await window.FRPageWindow.fill(el,{slug:w,page:p,hl}):false;
    }catch(_){return false;}
  }
  const link=(w,p)=>`<a class="pvb" href="${esc(cfg.read(w,p))}" target="_blank" rel="noopener">Open in the reader</a>`;
  /* the button after a page link: w the work, p the page, hl the passage's own words to mark, ps every page the row cites there */
  function btn(w,p,hl,ps){
    if(!w||p==null||p==='')return '';
    if(!can(w)||NONE.has(`${w}|${p}`))return link(w,p);
    return `<button type="button" class="pvb" data-pv="${esc(w)}|${esc(p)}"${hl?` data-pv-hl="${esc(String(hl).slice(0,400))}"`:''}${ps&&ps.length>1?` data-pv-pages="${esc(ps.join(','))}"`:''} aria-expanded="false" aria-label="Preview ${esc(at(w,p))}">Preview</button>`;
  }
  /* an index's page number: the number itself opens its page here; with a modifier key it opens the reader, as a link does */
  function loc(w,p){
    const href=esc(cfg.read(w,p));
    return can(w)&&!NONE.has(`${w}|${p}`)?`<a class="pvl" href="${href}" data-pv="${esc(w)}|${esc(p)}" aria-expanded="false">${esc(p)}</a>`:`<a href="${href}">${esc(p)}</a>`;
  }
  function close(box,focus){
    if(!box)return false;
    const i=OPEN.indexOf(box);if(i>=0)OPEN.splice(i,1);
    const t=box._t,was=box.isConnected;box.remove();
    if(t&&t.isConnected){
      t.removeAttribute('aria-controls');
      if(t.dataset.pv)t.setAttribute('aria-expanded','false');else t.removeAttribute('aria-expanded');
      if(focus)t.focus();
    }
    return was;
  }
  async function show(box,w,p){
    const t=box._t,hl=((t.closest('[data-pv-hl]')||{}).dataset||{}).pvHl||'',body=document.createElement('div');
    body.className='pvw-body';body.innerHTML='<p class="pw-wait" role="status">Loading the page…</p>';
    box.querySelector('.pvw-body').replaceWith(body);
    box.querySelector('.pvw-at').textContent=at(w,p);box.querySelector('.pvw-open').href=cfg.read(w,p);
    box.querySelectorAll('[data-pv-page]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pvPage===String(p))));
    const ok=await fill(body,w,p,hl);
    if(!body.isConnected)return;
    if(ok){box.scrollIntoView({block:'nearest'});return;}
    NONE.add(`${w}|${p}`);
    if(t.tagName==='BUTTON'&&!box.querySelector('[data-pv-page]')){
      const a=document.createElement('a'),had=box.contains(document.activeElement)||document.activeElement===t;
      a.className='pvb';a.href=cfg.read(w,p);a.target='_blank';a.rel='noopener';a.textContent='Open in the reader';
      close(box,false);t.replaceWith(a);if(had)a.focus();return;
    }
    if(t.tagName==='A')t.removeAttribute('data-pv');
    body.innerHTML=`<p class="pw-wait">This page cannot be shown here. <a href="${esc(cfg.read(w,p))}" target="_blank" rel="noopener">Open ${esc(at(w,p))} in the reader ↗</a></p>`;
  }
  function open(t){
    const [w,p]=t.dataset.pv.split('|'),host=t.closest(cfg.host)||t.closest('div,section,article,li,figure')||t.parentElement,col=t.closest(cfg.col);
    const was=OPEN.some(b=>b.isConnected&&b._t===t);
    for(const b of OPEN.slice())if(!b.isConnected||b.closest(cfg.col)===col)close(b,false);
    if(was)return;
    const ps=(t.dataset.pvPages||'').split(',').filter(Boolean),box=document.createElement('div');
    box.className='pvw';box.id=`pvw-${++seq}`;box._t=t;box.setAttribute('aria-live','off');
    box.innerHTML=`<div class="pvw-head"><span class="pvw-at"></span>${ps.length>1?`<span class="pvw-pp" role="group" aria-label="The pages cited">${ps.map(x=>`<button type="button" data-pv-page="${esc(x)}" aria-pressed="false">${esc(x)}</button>`).join('')}</span>`:''}<a class="pvw-open" target="_blank" rel="noopener">Open in the reader ↗</a><button type="button" class="pvw-x" data-pv-close>Close preview</button></div><div class="pvw-body"></div>`;
    host.appendChild(box);t.setAttribute('aria-expanded','true');t.setAttribute('aria-controls',box.id);OPEN.push(box);
    show(box,w,p);
  }
  document.addEventListener('click',e=>{
    const x=e.target.closest('[data-pv-close]');if(x){close(x.closest('.pvw'),true);return;}
    const n=e.target.closest('[data-pv-page]');if(n){const box=n.closest('.pvw');if(box&&box._t&&box._t.dataset.pv)show(box,box._t.dataset.pv.split('|')[0],n.dataset.pvPage);return;}
    const t=e.target.closest('[data-pv]');
    if(!t||(t.tagName==='A'&&(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0)))return;
    e.preventDefault();open(t);
  });
  return {btn,loc,can,escape(){const a=document.activeElement,box=(a&&a.closest&&a.closest('.pvw'))||OPEN.filter(b=>b.isConnected).pop();return close(box,true);}};
})({read,col:'#entry',host:'.rows li',text:''});
const SECS=[['subjects','Subjects'],['persons','Persons'],['scripture','Scripture'],['terms','Terms'],['questions','Questions']];
const NOUN={subjects:['subject','subjects'],persons:['person','persons'],terms:['term','terms'],questions:['question','questions']};
const BOOK=b=>b.replace(/-/g,' ').replace(/\b([a-z])/g,c=>c.toUpperCase()).replace(/^(\d) /,'$1 ').replace('Revelation Of John','Revelation').replace('Song Of Songs','Song of Songs');
/* the book menu in three groups: the New Testament and the deuterocanonical books by name, every other book of the Old Testament */
const NT=new Set('matthew mark luke john acts romans i-corinthians ii-corinthians galatians ephesians philippians colossians i-thessalonians ii-thessalonians i-timothy ii-timothy titus philemon hebrews james i-peter ii-peter i-john ii-john iii-john jude revelation-of-john revelation'.split(' '));
const DC=new Set('tobit judith wisdom sirach ecclesiasticus baruch i-maccabees ii-maccabees iii-maccabees iv-maccabees i-esdras ii-esdras prayer-of-manasseh additions-to-esther additions-to-daniel'.split(' '));
const SET=new URLSearchParams(location.search).get('set');
const base=`/v1/enrich/sets/${encodeURIComponent(SET)}/`;
let M=null,SEC='subjects',LETTER=null,ROWS=[],CUR=null,SHOWN=300,BOOKSEL=null,LIST=[],DRAWN=0,CHBOOK=null;
// Migne's "volumes" are its works, one treatise each (meta.unit 'work'); a set of printed volumes counts volumes
const unit=n=>{const u=(M&&M.unit)||'volume';return n===1?u:`${u}s`;};
const cache=new Map();const load=f=>{if(!cache.has(f))cache.set(f,J(base+f));return cache.get(f);};
function pagesHTML(slug,ps){return ps.map(p=>PVW.loc(slug,p)).join(', ');}
/* the line under an entry's name says what a page number does, where one opens its page here */
const opensHere=slugs=>slugs.some(s=>PVW.can(s))?' A page number opens that page here.':'';
/* AN INDEX LINE'S LOCATOR (2026-10-22): the volume of Migne ("PL 87", "PO Tome 1") or of a numbered set ("Vol. 3") before the work's
   own title; a short label that is itself the volume ("Schriften 1", "Tischreden 5"); a shelf's label (its author and title) has none */
const locOf=label=>{const s=String(label||''),m=s.match(/^((?:PL|PG|PO)(?: Tome)? \S+|Vol\. [^·]{1,14}?) · (.+)$/);
  return m?[m[1],m[2]]:s.length<=18&&!s.includes(' · ')?[s,'']:['',s];};
function lineHTML(slug,label,inner){const [loc,title]=locOf(label);
  return `<li${loc?title?'':' class="lo"':' class="nl"'}>${loc?`<span class="loc">${esc(loc)}</span>`:''}<div class="vt">${title?`<p class="vol">${esc(title)}</p>`:''}<p class="subs">${inner}</p></div></li>`;}
/* the locator column as wide as the longest locator the entry shows */
function locWidth(labels){const n=Math.max(0,...labels.map(l=>locOf(l)[0].length));
  $('#entry').style.setProperty('--loc',n?`${Math.min(9,Math.max(3.5,n*.56+.4)).toFixed(2)}rem`:'0px');
  $('#entry').style.setProperty('--locgap',n?'1.1rem':'0px');}
async function listFor(letter){
  if(M.lists[SEC]==='one')return (await load(`L/${SEC}.json`))||[];
  return (await load(`L/${SEC}-${letter}.json`))||[];
}
/* THE LIST PANE (2026-10-22): it fills as its own scroll nears the end, 300 headings at a time, so a letter of Migne's subjects with
   thousands of headings is all reachable without thousands of buttons at once (the list used to stop at 1,500). Its running head
   names the letter, the first and last heading in view and how many there are, as a printed index heads its pages. */
const STEP=300;
/* the list scrolls itself to the heading open, never the page */
function keepInView(el){const l=el&&el.closest('.list');if(!l)return;const lr=l.getBoundingClientRect(),er=el.getBoundingClientRect();
  if(er.top<lr.top)l.scrollTop-=lr.top-er.top;else if(er.bottom>lr.bottom)l.scrollTop+=er.bottom-lr.bottom;}
const rowHTML=r=>`<li><button type="button" data-k="${esc(r[0])}" data-f="${esc(r[2])}" aria-current="${r[0]===CUR}">${esc(r[0])}<small>${r[1].toLocaleString()}</small></button></li>`;
function runHead(h){const el=$('#runhead');if(!h){el.hidden=true;el.innerHTML='';return;}
  el.hidden=false;el.innerHTML=`<span class="rh-1"><b>${esc(h.mark)}</b>${h.range?`<span class="rh-range">${esc(h.range)}</span>`:''}</span><span class="rh-2"><span>${esc(h.count)}</span>${h.col?`<span>${esc(h.col)}</span>`:''}</span>`;}
const span=rows=>rows.length>1?`${rows[0][0]} to ${rows[rows.length-1][0]}`:rows.length?rows[0][0]:'';
const counted=n=>`${n.toLocaleString()} ${NOUN[SEC][n===1?0:1]}`;
function renderList(rows,cur,head){
  LIST=rows;const at=cur?rows.findIndex(r=>r[0]===cur):-1;DRAWN=Math.min(rows.length,Math.max(STEP,at+60));
  $('#list').classList.remove('chs');
  $('#list').innerHTML=rows.length?rows.slice(0,DRAWN).map(rowHTML).join(''):'<li class="empty">No heading here.</li>';
  runHead(head);
  keepInView($('#list [aria-current="true"]'));
}
function moreRows(upTo){if(SEC==='scripture'||DRAWN>=LIST.length)return;const to=Math.min(LIST.length,Math.max(DRAWN+STEP,upTo||0));
  $('#list').insertAdjacentHTML('beforeend',LIST.slice(DRAWN,to).map(rowHTML).join(''));DRAWN=to;}
$('#list').addEventListener('scroll',()=>{const l=$('#list');if(l.scrollTop+l.clientHeight>l.scrollHeight-480)moreRows();},{passive:true});
/* a section or letter left before its file arrived does not draw over the one chosen since */
async function showLetter(l){
  const sec=SEC;LETTER=l;document.querySelectorAll('#letters button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.l===l)));
  $('#list').setAttribute('aria-busy','true');
  const rows=await listFor(l);if(SEC!==sec||LETTER!==l)return;ROWS=M.lists[SEC]==='one'?rows.filter(r=>{const f=fold(r[0])[0]||'_';return l==='_'?!/[a-z]/.test(f):f===l;}):rows;
  $('#list').removeAttribute('aria-busy');
  renderList(ROWS,CUR,{mark:l==='_'?'#':l.toUpperCase(),range:span(ROWS),count:ROWS.length?counted(ROWS.length):'No heading under this letter',col:ROWS.length?unit(2):''});
}
function volRows(ents){
  const by=new Map();for(const e of ents){if(!by.has(e[0]))by.set(e[0],[]);by.get(e[0]).push(e);}
  return [...by.entries()].sort((a,b)=>a[0]-b[0]);
}
async function showEntry(k,f,write){
  CUR=k;SHOWN=300;
  const at=LIST.findIndex(r=>r[0]===k);if(at>=DRAWN)moreRows(at+60);
  document.querySelectorAll('#list button').forEach(b=>b.setAttribute('aria-current',String(b.dataset.k===k)));
  keepInView($('#list [aria-current="true"]'));
  const sec=SEC,E=await load(`E/${f}.json`);if(SEC!==sec||CUR!==k)return;const ents=(E&&E[k])||[];
  const groups=volRows(ents);
  const draw=()=>{
    const shown=groups.slice(0,SHOWN);
    locWidth(shown.map(([vi])=>(M.vols[vi]||[])[1]));
    const row=([vi,es])=>{const [slug,label]=M.vols[vi]||[];if(!slug)return '';
      let inner='';
      if(SEC==='subjects')inner=es.map(e=>`${e[1]?`${esc(e[1])}: `:''}${pagesHTML(slug,e[2])}`).join('; ');
      else if(SEC==='persons')inner=es.map(e=>`${e[2]?`${esc(e[2])}: `:''}${pagesHTML(slug,e[1])}`).join('; ');
      else inner=es.map(e=>pagesHTML(slug,e[1])).join('; ');
      return lineHTML(slug,label,inner);};
    $('#entry').dataset.pvHl=k;
    $('#entry').innerHTML=`<h2>${esc(k)}</h2><p class="count">In ${groups.length.toLocaleString()} ${unit(groups.length)} of the set.${opensHere(groups.map(([vi])=>(M.vols[vi]||[])[0]||''))}</p><ul class="rows">${shown.map(row).join('')}</ul>${
      groups.length>SHOWN?`<button type="button" class="more" id="more">Show ${Math.min(300,groups.length-SHOWN)} more ${unit(2)}</button>`:''}`;
  };
  draw();
  $('#entry').onclick=e=>{if(e.target.id==='more'){SHOWN+=300;draw();}};
  if(write)history.replaceState(null,'',`?set=${encodeURIComponent(SET)}#${SEC}/${encodeURIComponent(k)}`);
}
/* Scripture: the books in one menu (Old Testament, New, deuterocanon), the book's chapters as a grid of numerals, a chapter's verses */
function bookMenu(books){
  const part=(name,bs)=>bs.length?`<optgroup label="${name}">${bs.map(b=>`<option value="${esc(b)}">${esc(BOOK(b))}</option>`).join('')}</optgroup>`:'';
  const nt=books.filter(b=>NT.has(b)),dc=books.filter(b=>DC.has(b)),ot=books.filter(b=>!NT.has(b)&&!DC.has(b));
  return `<label class="pick"><span>Book</span><select id="book">${part('Old Testament',ot)}${part('New Testament',nt)}${part('Deuterocanon',dc)}</select></label>`;
}
async function showScripture(book,ch,write){
  const S=await load('L/scripture.json')||{};if(SEC!=='scripture')return;const books=Object.keys(S);
  if(!books.length){$('#letters').innerHTML='';runHead(null);$('#list').innerHTML='<li class="empty">No verse of Scripture is cited in this set.</li>';$('#entry').innerHTML='';return;}
  BOOKSEL=book&&S[book]?book:books[0];
  if(!$('#book')){$('#letters').classList.add('is-book');$('#letters').innerHTML=bookMenu(books);}
  $('#book').value=BOOKSEL;
  const chs=Object.keys(S[BOOKSEL]||{}).map(Number).sort((a,b)=>a-b);
  const c=ch&&S[BOOKSEL][ch]?String(ch):String(chs[0]);
  /* the grid is drawn once a book, so a chapter chosen by the arrow keys keeps the focus */
  if(CHBOOK!==BOOKSEL||!$('#list').classList.contains('chs')){
    $('#list').classList.add('chs');CHBOOK=BOOKSEL;
    $('#list').innerHTML=chs.map(n=>`<li><button type="button" data-c="${n}" aria-current="false" aria-label="${esc(BOOK(BOOKSEL))} ${n}">${n}</button></li>`).join('');
    runHead({mark:BOOK(BOOKSEL),range:'',count:`${chs.length} ${chs.length===1?'chapter':'chapters'} cited`,col:''});
  }
  document.querySelectorAll('#list [data-c]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.c===c)));
  const want=BOOKSEL,E=await load(`E/${S[BOOKSEL][c]}.json`);if(SEC!=='scripture'||BOOKSEL!==want)return;const vs=(E&&E[`${BOOKSEL}.${c}`])||[];
  delete $('#entry').dataset.pvHl;
  locWidth(vs.flatMap(([,es])=>es.map(e=>(M.vols[e[0]]||[])[1])));
  $('#entry').innerHTML=`<h2>${esc(BOOK(BOOKSEL))} ${esc(c)}</h2><p class="count">${vs.length} ${vs.length===1?'verse':'verses'} cited in the set.${opensHere(vs.flatMap(([,es])=>es.map(e=>(M.vols[e[0]]||[])[0]||'')))}</p>${
    vs.map(([v,es])=>`<h3 class="verse">${v?`Verse ${esc(v)}`:'The chapter'}</h3><ul class="rows">${volRows(es).slice(0,200).map(([vi,xs])=>{const [slug,label]=M.vols[vi]||[];return slug?lineHTML(slug,label,xs.map(x=>pagesHTML(slug,x[1])).join('; ')):'';}).join('')}</ul>`).join('')}`;
  if(write)history.replaceState(null,'',`?set=${encodeURIComponent(SET)}#scripture/${BOOKSEL}/${c}`);
}
async function showSec(sec,want,write){
  SEC=sec;CUR=null;
  document.querySelectorAll('#tabs [role="tab"]').forEach(b=>{const on=b.dataset.s===sec;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
  $('#cols').setAttribute('aria-labelledby',`tab-${sec}`);
  $('#entry').innerHTML='';$('#find').hidden=sec==='scripture';$('#q').value='';
  if(sec==='scripture'){const [b,c]=(want||'').split('/');await showScripture(b,c,write);return;}
  $('#q').placeholder={subjects:'Find a subject: grace, the papacy',persons:'Find a person: Augustine, Jerome',terms:'Find a term: grace, gratia, χάρις',questions:'Find a question: whether, how'}[sec];
  const letters='abcdefghijklmnopqrstuvwxyz_'.split('');
  $('#letters').classList.remove('is-book');
  $('#letters').innerHTML=letters.map(l=>`<button type="button" data-l="${l}" aria-pressed="false"${l==='_'?' aria-label="Headings that begin with a numeral or a sign"':''}>${l==='_'?'#':l.toUpperCase()}</button>`).join('');
  const l=want?(fold(want)[0]||'_'):'a';await showLetter(/[a-z]/.test(l)?l:'_');if(SEC!==sec)return;
  const hit=want&&ROWS.find(r=>r[0]===want);
  if(hit)await showEntry(hit[0],hit[2],false);else if(ROWS.length)await showEntry(ROWS[0][0],ROWS[0][2],write);
}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-s]');if(t){showSec(t.dataset.s,null,true);return;}
  const l=e.target.closest('[data-l]');if(l){showLetter(l.dataset.l);return;}
  const k=e.target.closest('[data-k]');if(k){showEntry(k.dataset.k,k.dataset.f,true).then(()=>toEntry(e));return;}
  const c=e.target.closest('[data-c]');if(c){showScripture(BOOKSEL,c.dataset.c,true).then(()=>toEntry(e));}
});
document.addEventListener('change',e=>{if(e.target.id==='book')showScripture(e.target.value,null,true);});
/* on a phone the entry sits under the list: a heading tapped (not one reached by the arrow keys) brings its entry into view */
function toEntry(e){if(!e.detail||!matchMedia('(max-width:760px)').matches)return;
  $('#entry').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});}
/* the sections answer the arrow keys as tabs do; Up and Down walk the headings (and Left and Right a book's chapters), each opening as it is reached */
$('#tabs').addEventListener('keydown',e=>{const bs=[...$('#tabs').querySelectorAll('[role="tab"]')],i=bs.indexOf(document.activeElement);if(i<0)return;
  const j={ArrowRight:i+1,ArrowLeft:i-1,Home:0,End:bs.length-1}[e.key];if(j===undefined)return;e.preventDefault();const b=bs[(j+bs.length)%bs.length];b.focus();b.click();});
$('#list').addEventListener('keydown',e=>{const grid=$('#list').classList.contains('chs');
  const d={ArrowDown:1,ArrowUp:-1,...(grid?{ArrowRight:1,ArrowLeft:-1}:{})}[e.key];if(!d)return;
  let bs=[...$('#list').querySelectorAll('button')];const i=bs.indexOf(document.activeElement);if(i<0)return;e.preventDefault();
  if(d>0&&i===bs.length-1){moreRows();bs=[...$('#list').querySelectorAll('button')];}
  const b=bs[Math.max(0,Math.min(bs.length-1,i+d))];if(b!==bs[i]){b.focus();b.click();}});
/* THE FIND BOX finds as you type (a short pause, then the letter's list narrowed to the headings that begin with the words, else those
   that hold them) and on Enter */
async function findNow(){const raw=$('#q').value,f=fold(raw);
  if(!f){if(LETTER)await showLetter(LETTER);return;}
  const l=/[a-z]/.test(f[0])?f[0]:'_';await showLetter(l);
  const rows=ROWS.filter(r=>fold(r[0]).startsWith(f)),near=rows.length?rows:ROWS.filter(r=>fold(r[0]).includes(f));
  renderList(near,CUR,{mark:l==='_'?'#':l.toUpperCase(),range:`“${raw.trim()}”`,count:near.length?`${counted(near.length)} found`:'Nothing found',col:near.length?unit(2):''});
  if(near.length)await showEntry(near[0][0],near[0][2],true);else $('#entry').innerHTML='<p class="muted">No heading begins with or holds these letters. Try fewer letters or browse by letter.</p>';}
let findT=0;
$('#q').addEventListener('input',()=>{clearTimeout(findT);findT=setTimeout(findNow,260);});
$('#find').addEventListener('submit',e=>{e.preventDefault();clearTimeout(findT);findNow();});
addEventListener('keydown',e=>{if(e.key==='Escape'&&PVW.escape())e.preventDefault();});
/* THE DIRECTORY'S FIND AND FILTERS (2026-10-22, owner: "search and filter to find a set to search"). The sets in the index's own order
   with its counts, narrowed as you type (title, author or id), by kind (the Patrologiae; the shelves; the editions and sets), and by
   tradition where the data gives one: a Patrologia's and a shelf's own; else the shelf of the room the library gives the set's author
   (v1/bible/<shelf>/rooms, read once the directory shows; a name in two rooms takes the first of ROOM_ORDER, the later shelves before
   the Fathers', whose rooms also hold their editors). A set whose author has no room (the councils, Migne's courses, the Critici
   Sacri) has none. The nine names are the library's closed list. The choice is kept for the tab, so Back returns to the same list.
   THE READING LIST (2026-10-22 design pass): each set's title, then its author with the year the library gives him (his room's "c."
   year, as the author pages print it) and its tradition, and at the right its index entries over its volumes; the kinds a row of
   buttons, the traditions one menu, both counting what the other filters leave. */
const DKINDS=[['all','All sets'],['pat','Patrologiae'],['shelf','Shelves'],['set','Editions and sets']];
const DTRADS=[['gf','Greek Fathers'],['pl','Latin Fathers'],['po','Eastern Fathers'],['md','Medieval'],['lu','Lutheran'],['rf','Continental Reformed'],['rc','Roman Catholic'],['ed','English Divines'],['hl','Humanism and Law']];
const SHELF_OF={'latin-fathers':'pl','greek-fathers':'gf','eastern-fathers':'po','english-divines':'ed','medieval':'md','roman-catholic':'rc','lutheran':'lu','reformed':'rf','continental-reformed':'rf','humanism-and-law':'hl'};
const ROOM_ORDER=['md','rc','lu','rf','ed','hl','gf','pl'];
const nameKey=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
let DIR=[],DK='all',DT='';
function dirKeep(){try{sessionStorage.setItem('fr_setdir',JSON.stringify({q:$('#dfind').value,k:DK,t:DT}));}catch(_){}}
function dirKept(){try{return JSON.parse(sessionStorage.getItem('fr_setdir')||'null');}catch(_){return null;}}
function dirRender(){
  const ws=fold($('#dfind').value).split(' ').filter(Boolean),names=new Map(DTRADS);
  const pass=(r,skip)=>(skip==='k'||DK==='all'||r.kind===DK)&&(skip==='t'||!DT||r.trad===DT)&&ws.every(w=>r.hay.includes(w));
  const rows=DIR.filter(r=>pass(r));
  $('#dkinds').innerHTML=DKINDS.map(([k,l])=>`<button type="button" data-dk="${k}" aria-pressed="${DK===k}">${esc(l)}<small>${DIR.filter(r=>(k==='all'||r.kind===k)&&pass(r,'k')).length.toLocaleString()}</small></button>`).join('');
  const ts=DTRADS.map(([t,l])=>[t,l,DIR.filter(r=>r.trad===t&&pass(r,'t')).length]).filter(([t,,n])=>n||t===DT);
  $('#dtrad').innerHTML=`<option value="">Every tradition (${DIR.filter(r=>pass(r,'t')).length.toLocaleString()})</option>${ts.map(([t,l,n])=>`<option value="${t}">${esc(l)} (${n.toLocaleString()})</option>`).join('')}`;
  $('#dtrad').value=DT;$('#dtrad-wrap').hidden=!ts.length;
  $('#dstat').textContent=rows.length===DIR.length?`${DIR.length.toLocaleString()} sets`:`${rows.length.toLocaleString()} of ${DIR.length.toLocaleString()} sets`;
  $('#dir').innerHTML=rows.map(r=>{const who=[r.a,r.y!=null?`c. ${r.y}`:'',names.get(r.trad)].filter(Boolean);
    return `<li><span class="t"><a href="?set=${encodeURIComponent(r.id)}">${esc(r.t)}</a></span>${who.length?`<span class="who">${who.map(esc).join(' · ')}</span>`:''}<span class="n">${r.e.toLocaleString()}<span class="sr"> index entries,</span><small>${r.n.toLocaleString()} ${esc(r.n===1?r.u:`${r.u}s`)}</small></span></li>`;}).join('')
    ||'<li class="none"><span>No set matches these words and filters.</span><button type="button" class="more" data-dclear>Show every set</button></li>';
  dirKeep();
}
/* each set's tradition and its author's year from his room, once the rooms arrive (the Patrologiae and the shelves have their traditions already) */
function dirTraditions(){
  Promise.all(ROOM_ORDER.map(sh=>J(`/v1/bible/${sh}/rooms/index.json`))).then(xs=>{
    const room=new Map();xs.forEach((x,i)=>{for(const r of (x&&x.authors)||[]){const k=nameKey(r.a);if(k&&!room.has(k))room.set(k,[ROOM_ORDER[i],r.y]);}});
    for(const r of DIR)if(r.kind==='set')for(const part of String(r.a||'').split(/;|\s+and\s+/)){const hit=room.get(nameKey(part));if(hit){if(!r.trad)r.trad=hit[0];if(r.y==null&&hit[1]!=null)r.y=hit[1];break;}}
    dirRender();
  });
}
// no set named: the directory of every set that has one index, the Weimar Edition and Migne first
if(!SET){
  $('#title').textContent='Set indexes';document.title='Set indexes | The Faith Received | Mere Orthodoxy';
  for(const id of ['tabs','find','letters','cols'])$(`#${id}`).hidden=true;
  J('/v1/enrich/sets/index.json').then(d=>{
    if(!d){$('#by').innerHTML=`The list of sets did not load. ${RETRY}`;return;}
    $('#by').textContent=`${d.sets.length} editions and sets have an index. Each entry names its volume and pages.`;
    DIR=d.sets.map(([id,t,a,n,u,e])=>{const kind=/^(pl|pg|po)$/.test(id)?'pat':/^shelf-/.test(id)?'shelf':'set';
      return {id,t,a,n,u,e,kind,y:null,trad:kind==='pat'?{pl:'pl',pg:'gf',po:'po'}[id]:kind==='shelf'?SHELF_OF[id.slice(6)]||'':'',hay:fold(`${t} ${a} ${id.replace(/-/g,' ')}`)};});
    const kept=dirKept();
    if(kept){$('#dfind').value=kept.q||'';if(DKINDS.some(([k])=>k===kept.k))DK=kept.k;if(DTRADS.some(([t])=>t===kept.t))DT=kept.t;}
    dirRender();$('#dirtools').hidden=false;$('#dhead').hidden=false;$('#dir').hidden=false;
    dirTraditions();
  });
  $('#dfind').addEventListener('input',dirRender);
  $('#dtrad').addEventListener('change',e=>{DT=e.target.value;dirRender();});
  /* a kind redraws the row (its counts follow the other filters), so the focus goes back to the kind pressed */
  $('#dkinds').addEventListener('click',e=>{
    const b=e.target.closest('[data-dk]');if(!b)return;
    DK=b.dataset.dk;dirRender();
    const again=$('#dkinds').querySelector(`[data-dk="${CSS.escape(DK)}"]`);if(again)again.focus();
  });
  $('#dir').addEventListener('click',e=>{if(e.target.closest('[data-dclear]')){$('#dfind').value='';DK='all';DT='';dirRender();$('#dfind').focus();}});
}else J(`${base}meta.json`).then(async m=>{
  if(!m){$('#by').textContent='This set has no index yet.';return;}
  M=m;document.title=`${m.t} Index | The Faith Received | Mere Orthodoxy`;$('#title').textContent=m.t;
  $('#by').textContent=`${m.a?`${m.a} · `:''}${m.vols.length.toLocaleString()} ${unit(m.vols.length)} indexed together. Each entry names its ${unit(1)} and pages.`;
  $('#tabs').innerHTML=SECS.map(([k,l])=>`<button type="button" role="tab" id="tab-${k}" data-s="${k}" aria-selected="false" aria-controls="cols" tabindex="-1">${l}<small>${(m.n[k]||0).toLocaleString()}</small></button>`).join('');
  await route();
  addEventListener('hashchange',route);
});
async function route(){const [sec,...rest]=(()=>{try{return decodeURIComponent(location.hash.slice(1));}catch(_){return location.hash.slice(1);}})().split('/');
  await showSec(SECS.some(([k])=>k===sec)?sec:'subjects',rest.join('/')||null,false);}
