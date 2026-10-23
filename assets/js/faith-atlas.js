/* Disputed questions: ported from The Faith Received (tools/prdl_reader_prototype/atlas.html); the data from the library worker, links into the reader on this site. */
window.__FR_BLOB_BASE__=window.__FR_BLOB_BASE__||"https://mo-tfr-library.mo-podcast-feed.workers.dev";
window.__FR_READER_PATH__=window.__FR_READER_PATH__||"/the-faith-received/read/";
window.__FR_LEXICON_PATH__=window.__FR_LEXICON_PATH__||"/the-faith-received/lexicon/";
const BLOB=(window.__FR_BLOB_BASE__||"").replace(/\/$/,"");
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
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
/* the Scripture page's reader of Migne and EEBO pages, for both previews (empty in Mere Orthodoxy's port) */
const CPANE='';
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
})({read,col:'#q',host:'.hr',text:CPANE});
const MAPS='/the-faith-received/maps/',TAIL=' | Disputed questions | The Faith Received | Mere Orthodoxy';
const ANS=[['affirms','Affirm'],['denies','Deny'],['distinguishes','Distinguish'],['reports only','Report others only'],['unclear','Unclear']];
const SHOWN=6;
let CUR=null,FILTER=null,DATA=null,FOLD=0,QS=[],MODEL=null,PARTS={};
const fmtN=n=>Number(n||0).toLocaleString('en-US');
/* THE ATLAS IN THE MAPS' LANGUAGE (2026-10-22): the data. The index's tally gives each question's split of answers (the question's head
   and its row in the list); the question's file gives every answer with the author's year (y, his birth year; 9999 marks none) and
   tradition, for the era strip (a lane an answer) and the traditions by answer; a question with a map of the tradition (v1/maps, 320 of
   the 330) gives its positions, each with its share of the authors placed, its thesis and what it turns on. */
const MAPPED=new Set(),TALLY=new Map(),MAPQ=new Map();
/* an answer's colour: affirm the library's green, deny its red, distinguish the border's tone, a report of others only muted, an unclear
   reading the highlight; an open question's options in shades of the ink, the first the darkest */
const ANS_C={affirms:'var(--affirms)',denies:'var(--denies)',distinguishes:'var(--border)','reports only':'repeating-linear-gradient(135deg,var(--muted) 0 1.5px,transparent 1.5px 3.5px)',unclear:'var(--highlight)'};
const SHADES=[88,62,42,28,18],PALE=new Set(['distinguishes','reports only','unclear']),NA=new Set(['reports only','unclear']);
/* a tally ({answer: count}, an open question's options first in their order) as the split's parts: label, count, colour */
function splitOf(t){
  const opts=Object.keys(t||{}).filter(k=>!ANS_C[k]),ks=opts.length?[...opts,'reports only','unclear']:ANS.map(([k])=>k);
  return ks.map((k,i)=>({k,l:(ANS.find(a=>a[0]===k)||[k,k])[1],n:Number((t||{})[k])||0,c:ANS_C[k]||`color-mix(in srgb,var(--fg) ${SHADES[i]||18}%,transparent)`,pale:PALE.has(k)})).filter(x=>x.n);
}
/* a divided bar; the readings that are not answers (he reports others only, the reading is unclear) stand a little apart at its end */
const segsHTML=ps=>ps.map((x,i)=>`<i${NA.has(x.k)&&(i===0||!NA.has(ps[i-1].k))?' class="na"':''} style="flex-grow:${x.n};--c:${x.c}"></i>`).join('');
const barHTML=(ps,cls)=>`<span class="${cls}" aria-hidden="true">${segsHTML(ps)}</span>`;
/* THE MODULE (tradition-graphics.js): the maps' drawings from plain data, the shelves' names and colours (--tg-*). A page without it (a
   port that does not load it yet) keeps the question's split, its traditions by answer (in the maps' colour table) and its answers. */
const TG=window.FRTraditionGraphics||null;
const TGPV=TG?TG.preview({read,text:CPANE,col:'.tg-pos',host:'.tg-hr'}):null;
const COL={'Greek Fathers':'#2E6E8E','Latin Fathers':'#7A4E9B','Eastern Fathers':'#5E8C61','Byzantine':'#1F8A7A','Medieval':'#B07B2A','Lutheran':'#C1593C','Reformed':'#2F7D4F','Continental Reformed':'#2F7D4F','Roman Catholic':'#A63D5A','English Divines':'#3B5BA5','Humanism and Law':'#8C7B5C'};
const tkey=t=>TG?TG.key(t):(t||'');
const tname=t=>TG?TG.label(t):(t||'Not recorded');
const tcol=t=>TG?TG.colour(t):(COL[t]||'#7A7A76');
/* the traditions by answer: each tradition named, its answers as a divided bar in the split's colours, its length its share of the
   largest tradition (no tradition's colour here: the lanes and the positions carry those, and a red or a green would read two ways) */
function tradsHTML(m){
  const max=Math.max(1,...m.traditions.map(r=>r.n));
  return `<h3 class="sec-h">By tradition<span class="ct"><span class="sr">, </span>${m.traditions.length}</span></h3><ol class="trs">${m.traditions.map(r=>{const ps=splitOf(Object.fromEntries(r.cells));
    return `<li><span class="tr-n">${esc(r.name)}<span class="ct">${r.n}</span></span><span class="tr-b" style="width:${(r.n/max*100).toFixed(1)}%" role="img" aria-label="${esc(ps.map(x=>`${x.l} ${x.n}`).join(', '))}">${segsHTML(ps)}</span></li>`;}).join('')}</ol>`;
}
/* ANSWER LANES (2026-10-22), a page-local extension of the module's era strip, to move into tradition-graphics.js: a lane an answer, each
   author a dot at his year in his tradition's color (the lanes are named, not colored, so the figure speaks in the traditions' colors
   only), a quarter-century's dots stacked in its column in the traditions' order (a column
   taller than twelve dots drawn closer), the library's eras banded behind and named under the centuries, one legend whose entries switch
   a tradition off in every lane (hollow and grey, as on the maps; the lanes are drawn again without it), the undated counted and not
   drawn, and for a screen reader a table of the answers by century. */
const AL={off:new Set()},AL_STEP=7,AL_CAP=12,AL_BIN=25;
function lanesHTML(m,parts){
  if(!TG||!m||!m.lanes.length)return '';
  const all=m.lanes.flatMap(l=>l.dots),dated=all.filter(x=>x.y);if(!dated.length)return '';
  const ORD=TG.TRADITIONS.map(t=>t[0]).concat('x'),oi=k=>ORD.indexOf(k),shown=x=>!AL.off.has(tkey(x.tradition));
  const ys=dated.map(x=>x.y),from=Math.max(0,Math.floor(Math.min(...ys)/100)*100),to=Math.min(2100,Math.max(from+200,Math.ceil((Math.max(...ys)+1)/100)*100)),span=to-from;
  const X=y=>((y-from)/span*100).toFixed(3),U=y=>((y-from)/span*1000).toFixed(1);
  let bg='';TG.ERAS.forEach(([a,z],i)=>{const l=Math.max(a,from),h=Math.min(z,to);if(h>l&&i%2===1)bg+=`<rect class="tg-band" x="${U(l)}" y="0" width="${((h-l)/span*1000).toFixed(1)}" height="100"/>`;});
  for(let c=Math.ceil(from/100)*100;c<=to;c+=100)bg+=`<line class="tg-grid" x1="${U(c)}" x2="${U(c)}" y1="0" y2="100"/>`;
  const svg=`<svg class="al-bg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">${bg}<line class="tg-base" x1="0" x2="1000" y1="100" y2="100"/></svg>`;
  const lanes=m.lanes.map(l=>{
    const p=parts[l.k]||{l:l.l,c:'var(--muted)',pale:false},on=l.dots.filter(shown),und=on.filter(x=>!x.y).length,bins=new Map();
    for(const x of on){if(!x.y)continue;const b=Math.floor(x.y/AL_BIN);if(!bins.has(b))bins.set(b,[]);bins.get(b).push(x);}
    const most=Math.max(0,...[...bins.values()].map(v=>v.length)),step=most>AL_CAP?AL_CAP*AL_STEP/most:AL_STEP,h=Math.max(16,Math.min(most,AL_CAP)*AL_STEP+6);
    let dots='';
    for(const [b,xs] of bins){xs.sort((a,z)=>oi(tkey(a.tradition))-oi(tkey(z.tradition))||a.y-z.y);xs.forEach((x,j)=>{dots+=`<i class="al-d" style="left:${X(b*AL_BIN+AL_BIN/2)}%;bottom:${(3+j*step).toFixed(1)}px;--c:${tcol(x.tradition)}" title="${esc(`${x.author}, ${x.dates||x.y}, ${tname(x.tradition)}`)}"></i>`;});}
    return `<div class="al-l"><p class="al-h">${esc(p.l)}<span class="ct">${l.dots.length}</span>${und?`<span class="al-u">${und} undated, not drawn</span>`:''}</p><div class="al-p" style="height:${h}px">${svg}${dots}</div></div>`;
  }).join('');
  let ax='';for(let c=Math.ceil(from/100)*100;c<to;c+=100){const n=c/100+1;ax+=`<span class="tg-c${n%2?'':' e2'}${n%4?'':' e4'}" style="left:${X(c+50)}%">${TG.ord(n)}</span>`;}
  const eras=TG.ERAS.map(([a,z,label])=>{const l=Math.max(a,from),h=Math.min(z,to);return h>l?`<span style="left:${X(l)}%;width:${((h-l)/span*100).toFixed(3)}%" title="${esc(label)}">${esc(label)}</span>`:'';}).join('');
  const tc=new Map();for(const x of all){const k=tkey(x.tradition);tc.set(k,(tc.get(k)||0)+1);}
  const keys=ORD.filter(k=>tc.has(k)),undAll=all.filter(x=>!x.y&&shown(x)).length;
  const rows=[];for(let c=Math.floor(from/100);c<Math.ceil(to/100);c+=1){const cells=m.lanes.map(l=>l.dots.filter(x=>x.y&&Math.floor(x.y/100)===c&&shown(x)).length);if(cells.some(Boolean))rows.push(`<tr><th scope="row">${TG.ord(c+1)} century</th>${cells.map(v=>`<td>${v}</td>`).join('')}</tr>`);}
  const summary=`${fmtN(dated.filter(shown).length)} authors placed at their years, an answer a lane, from the ${TG.ord(from/100+1)} century to the ${TG.ord(to/100)}: ${m.lanes.map(l=>`${(parts[l.k]||l).l} ${l.dots.length}`).join(', ')}${undAll?`; ${fmtN(undAll)} undated`:''}`;
  return `<section class="al-sec" id="al-sec" aria-labelledby="al-h"><h3 class="sec-h" id="al-h">Through the centuries</h3><figure class="tg tg-era al" id="al-fig">
    <div class="al-ls" role="img" aria-label="${esc(summary)}">${lanes}</div>
    <div class="tg-ax" aria-hidden="true">${ax}</div><div class="tg-eras" aria-hidden="true">${eras}</div>
    <figcaption class="tg-lgrow"><span class="tg-lg" role="group" aria-label="Traditions shown in the lanes">${keys.map(k=>`<button type="button" data-al-k="${k}" aria-pressed="${!AL.off.has(k)}"><i class="tg-sw" style="--c:var(--tg-${k})" aria-hidden="true"></i>${esc(TG.label(k))}<span class="tg-ct">${fmtN(tc.get(k))}</span></button>`).join('')}</span></figcaption>
    <div class="tg-srw"><table class="tg-sr"><caption>Answers by century</caption><thead><tr><th scope="col">Century</th>${m.lanes.map(l=>`<th scope="col">${esc((parts[l.k]||l).l)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>
  </figure></section>`;
}
/* the lanes drawn again for the traditions switched on, the legend's focus kept */
function redrawLanes(k){
  const sec=$('#al-sec');if(!sec||!MODEL)return;
  sec.outerHTML=lanesHTML(MODEL,PARTS);
  if(TG)TG.layout($('#q'));
  const b=document.querySelector(`#al-fig [data-al-k="${k}"]`);if(b)b.focus();
}
/* ITS POSITIONS, as its map draws them: each position's head (its name and share of the authors placed, the share as a bar in the
   traditions' colours, its thesis, what it turns on, its earliest holder), its authors folded; the answers stay below as the evidence */
function positionsHTML(m,d){
  if(!TG||!m||!m.map||!m.positions.length)return '';
  const n=m.positions.length;
  return `<p class="pos-in"><a href="${MAPS}#${esc(d.id)}">The map of the tradition</a> files these answers under ${n} ${n===1?'position':'positions'}, its reading of them together.</p>${m.map.positions.map(p=>TG.positionBlock(p,{total:m.total,read,preview:TGPV?TGPV.btn:null,level:3,open:false})).join('')}`;
}
/* the question's split: the bar, then each answer named with its count */
const splitHTML=ps=>ps.length?`${barHTML(ps,'split')}<p class="split-n">${ps.map(x=>`<span><i class="sw${x.pale?' pale':''}" style="--c:${x.c}" aria-hidden="true"></i>${esc(x.l)}<span class="ct">${x.n}</span></span>`).join('')}</p>`:'';
const mapOf=id=>{if(!MAPPED.has(id))return Promise.resolve(null);if(!MAPQ.has(id))MAPQ.set(id,J(`/v1/maps/q/${encodeURIComponent(id)}.json`));return MAPQ.get(id);};
/* an answer's year: its own, else the author dates' for its author (v1/enrich/author_dates.json, owner 2026-10-22 "date authors please";
   the module loads the key and the question waits for it); an author the library cannot date stays in the lane's undated count */
const yearOf=a=>{const y=Number(a.y);return y>0&&y<9999?y:(TG&&TG.dates&&TG.dates.year(a.author))||null;};
const datesOf=a=>a.dates||(TG&&TG.dates?TG.dates.label(a.author):'');
/* one question's figures: the split of its answers, the era strip's lanes (one an answer, each author at his year in his tradition),
   the traditions by answer, and its map's positions */
function modelOf(d,m){
  const A=answersOf(d),keys=A.map(([k])=>k);
  const split=A.map(([k,l])=>({k,l,n:d.answers.filter(a=>a.answer===k).length})).filter(x=>x.n);
  const lanes=A.map(([k,l])=>({k,l,dots:d.answers.filter(a=>a.answer===k).map(a=>({author:a.author,y:yearOf(a),dates:datesOf(a),tradition:a.tradition||''}))})).filter(x=>x.dots.length);
  const byT=new Map();for(const a of d.answers){const t=tkey(a.tradition);if(!byT.has(t))byT.set(t,{t,name:tname(a.tradition),c:tcol(a.tradition),r:new Map()});const g=byT.get(t);g.r.set(a.answer,(g.r.get(a.answer)||0)+1);}
  const traditions=[...byT.values()].map(g=>({t:g.t,name:g.name,c:g.c,n:[...g.r.values()].reduce((s,x)=>s+x,0),cells:keys.map(k=>[k,g.r.get(k)||0])})).sort((a,b)=>b.n-a.n||a.name.localeCompare(b.name));
  const total=m?(m.n||m.positions.reduce((s,p)=>s+p.holders.length,0)+(m.unplaced||[]).length):0;
  const positions=m?m.positions.map(p=>({id:p.id,label:p.label,n:p.holders.length,share:total?p.holders.length/total:0,thesis:p.summary||'',turns:p.distinction||'',holders:p.holders})):[];
  return {split,lanes,traditions,positions,total,map:m};
}
// an open question ("For whom Christ died") carries the positions the schools took, in place of affirm and deny
const answersOf=d=>d.options?[...d.options.map(o=>[o,o]),['reports only','Report others only'],['unclear','Unclear']]:ANS;
// the pages an answer stands on, a line a work: "p. 446", or "pp. 361, 373, 375"; each opens the reader in a new tab, as on the maps,
// and the line's Preview opens its first page here (the others are in the preview's head)
function pagesHTML(list){
  const by=new Map();for(const [w,p,t] of list){if(!by.has(w))by.set(w,{t:t||w,ps:[]});const g=by.get(w);if(!g.ps.includes(p))g.ps.push(p);}
  return [...by.entries()].map(([w,{t,ps}])=>ps.length===1
    ?`<span class="pp"><a class="pg" href="${read(w,ps[0])}" target="_blank" rel="noopener" title="${esc(t)}" aria-label="${esc(t)}, page ${esc(ps[0])}, opens the reader">p. ${esc(ps[0])}</a>${PVW.btn(w,ps[0])}</span>`
    :`<span class="pp" title="${esc(t)}">pp. ${ps.map(p=>`<a class="pg" href="${read(w,p)}" target="_blank" rel="noopener" aria-label="${esc(t)}, page ${esc(p)}, opens the reader">${esc(p)}</a>`).join(', ')}${PVW.btn(w,ps[0],'',ps)}</span>`).join('');
}
// one row: who (name; dates and tradition) | his answer, and the work it stands in | the pages, at the right
function rowHTML(a,k,fold){
  const list=a.cited&&a.cited.length?a.cited:(a.pages||[]).slice(0,3),works=[...new Set(list.map(x=>x[2]||x[0]))];
  const sub=[datesOf(a),a.tradition].filter(Boolean).join(' · ');
  return `<li class="hr"${fold&&k>=SHOWN?' hidden':''}><span class="h-who">${esc(a.author)}${sub?`<small>${esc(sub)}</small>`:''}</span><span class="h-line">${esc(a.line)}${works.length?`<small class="h-src">${works.map(esc).join('; ')}</small>`:''}</span><span class="h-pg">${pagesHTML(list)}</span></li>`;
}
/* THE QUESTION (2026-10-22, the atlas in the maps' language): its head and its split; when its answers were given, a lane an answer;
   its traditions by answer; its positions as its map draws them; then each author's answer with his pages, the evidence, as before */
function renderQ(){
  const d=DATA;if(!d)return;const A=answersOf(d);
  const counts=Object.fromEntries(A.map(([k])=>[k,d.answers.filter(a=>a.answer===k).length]));
  const ps=splitOf(counts);PARTS=Object.fromEntries(ps.map(x=>[x.k,x]));
  $('#q').innerHTML=`<h2>${esc(d.q)}</h2><p class="meta">${esc(d.locus)} · ${d.answers.length} authors · ${d.n_pages.toLocaleString()} pages · <a href="${MAPS}#${esc(d.id)}">the map of the tradition</a></p>${window.TFRMethod?window.TFRMethod.html("<p>Each answer is read by machine from the claims recorded on the author's pages. Open the pages to check it.</p>"):'<p class="note">Each answer is read by machine from the claims recorded on the author\'s pages. Open the pages to check it.</p>'}${
    splitHTML(ps)}${lanesHTML(MODEL,PARTS)}${MODEL&&MODEL.traditions.length>1?tradsHTML(MODEL):''}${positionsHTML(MODEL,d)
    }<section class="ev" aria-labelledby="ev-h"><h3 class="sec-h" id="ev-h">Each author's answer</h3><div id="ev"></div></section>${
    stepsHTML(d.id)}`;
  renderEv();mountGraphics();
}
/* the evidence: the answers, one choice at a time; all answers: each list shows six and folds the rest; one answer chosen: all of it */
function renderEv(){
  const d=DATA,box=$('#ev');if(!d||!box)return;const A=answersOf(d);FOLD=0;
  const counts=Object.fromEntries(A.map(([k])=>[k,d.answers.filter(a=>a.answer===k).length])),col=Object.fromEntries(splitOf(counts).map(x=>[x.k,x]));
  const shown=FILTER?d.answers.filter(a=>a.answer===FILTER):d.answers.filter(a=>a.answer!=='unclear'&&a.answer!=='reports only');
  const groups=A.map(([k,l])=>[k,l,shown.filter(a=>a.answer===k)]).filter(([,,v])=>v.length);
  const fold=!FILTER;
  box.innerHTML=`<div class="tally" role="group" aria-label="Filter by answer"><button type="button" data-f="" aria-pressed="${!FILTER}">Answers <span class="ct">${d.answers.filter(a=>a.answer!=='unclear'&&a.answer!=='reports only').length}</span></button>${A.map(([k,l])=>counts[k]?`${k==='reports only'?'<span class="tsep" aria-hidden="true"></span>':''}<button type="button" data-f="${esc(k)}" aria-pressed="${FILTER===k}">${esc(l)} <span class="ct">${counts[k]}</span></button>`:'').join('')}</div>${
    groups.length?groups.map(([k,l,v])=>{const id=`fold${++FOLD}`,c=col[k];
      return `<h4 class="ans">${c?`<i class="sw${c.pale?' pale':''}" style="--c:${c.c}" aria-hidden="true"></i>`:''}${esc(l)}<span class="ct"><span class="sr">, </span>${v.length}</span></h4><ol class="hl" id="${id}">${v.map((a,i)=>rowHTML(a,i,fold)).join('')}</ol>${fold&&v.length>SHOWN?`<button type="button" class="more" aria-expanded="false" aria-controls="${id}" data-n="${v.length}">Show all ${v.length}</button>`:''}`;}).join('')
      :'<p class="muted">No author in the library states an answer on the pages filed under this question yet.</p>'}`;
}
/* the module's drawings laid out to their width (era names that do not fit their span kept out of sight, a legend drawn closer) */
function mountGraphics(){if(TG)TG.layout($('#q'));}
/* the questions before and after this one, in the atlas's order */
function stepsHTML(id){
  const i=QS.findIndex(x=>x.id===id),prev=i>0?QS[i-1]:null,next=i>=0?QS[i+1]:null;
  if(!prev&&!next)return '';
  return `<nav class="next" aria-label="Previous and next question">${prev?`<button type="button" data-q="${esc(prev.id)}"><small>Previous question</small><span>${esc(prev.q)}</span></button>`:'<span></span>'}${next?`<button type="button" data-q="${esc(next.id)}"><small>Next question</small><span>${esc(next.q)}</span></button>`:'<span></span>'}</nav>`;
}
// the question shown keeps its locus open and in sight in the phone's bounded list
function keepInView(el){
  if(!el)return;const d=el.closest('details');if(d)d.open=true;
  const box=$('#loci');if(box.scrollHeight<=box.clientHeight+4)return;
  const r=el.getBoundingClientRect(),br=box.getBoundingClientRect();if(r.top<br.top||r.bottom>br.bottom)box.scrollTop+=r.top-br.top-box.clientHeight/3;
}
async function showQ(id,write){
  CUR=id;FILTER=null;AL.off.clear();document.querySelectorAll('#loci [data-q]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.q===id)));
  keepInView(document.querySelector(`#loci [data-q="${CSS.escape(id)}"]`));
  /* a question chosen while another was loading wins: the older answer is dropped; its map comes with it where it has one */
  const [got,map]=await Promise.all([J(`/v1/atlas/q/${encodeURIComponent(id)}.json`),mapOf(id),TG&&TG.dates?TG.dates.ready:null]);if(CUR!==id)return;DATA=got;
  if(!DATA){$('#q').innerHTML=`<p class="muted">This question did not load. ${RETRY}</p>`;return;}
  MODEL=modelOf(DATA,map&&Array.isArray(map.positions)?map:null);
  renderQ();if(write)history.replaceState(null,'',`#${id}`);
  document.title=`${DATA.q}${TAIL}`;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-q]');if(b){showQ(b.dataset.q,true);if(b.closest('.next'))$('#q').scrollIntoView({block:'start'});return;}
  const f=e.target.closest('[data-f]');if(f){FILTER=f.dataset.f||null;renderEv();return;}
  const ak=e.target.closest('[data-al-k]');if(ak){const k=ak.dataset.alK,all=[...document.querySelectorAll('#al-fig [data-al-k]')].map(x=>x.dataset.alK);if(AL.off.has(k))AL.off.delete(k);else AL.off.add(k);if(AL.off.size===all.length)AL.off.clear();redrawLanes(k);return;}
  const more=e.target.closest('button.more');if(more){const open=more.getAttribute('aria-expanded')!=='true',ol=document.getElementById(more.getAttribute('aria-controls'));
    [...ol.children].forEach((li,k)=>{if(k>=SHOWN)li.hidden=!open;});more.setAttribute('aria-expanded',String(open));more.textContent=open?'Show fewer':`Show all ${more.dataset.n}`;
    if(!open&&more.getBoundingClientRect().top<0)ol.scrollIntoView({block:'start'});}
});
addEventListener('keydown',e=>{
  if(e.key==='Escape'&&PVW.escape()){e.preventDefault();return;}
  if(e.target.matches('input,textarea,select')||e.target.closest('.pvw,.tg-pvw')||e.altKey||e.ctrlKey||e.metaKey||(e.key!=='ArrowRight'&&e.key!=='ArrowLeft'))return;
  const i=QS.findIndex(x=>x.id===CUR),x=i<0?null:QS[i+(e.key==='ArrowRight'?1:-1)];if(x)showQ(x.id,true);
});
if(TG)TG.mount($('#q'));
Promise.all([J('/v1/atlas/index.json'),J('/v1/maps/index.json')]).then(([d,mi])=>{
  if(!d){$('#loci').innerHTML=`<p class="muted">The questions did not load. ${RETRY}</p>`;return;}
  for(const x of (mi&&mi.questions)||[])MAPPED.add(x.id);
  for(const x of d.questions)TALLY.set(x.id,x.tally||{});
  QS=d.questions;const by=new Map();for(const x of d.questions){if(!by.has(x.locus))by.set(x.locus,[]);by.get(x.locus).push(x);}
  const want=location.hash.slice(1)||d.questions[0].id,wl=(d.questions.find(x=>x.id===want)||{}).locus;
  $('#loci').innerHTML=[...by.entries()].map(([l,qs])=>`<details${l===wl?' open':''}><summary>${esc(l)}<small>${qs.length}</small></summary><ul>${qs.map(x=>`<li><button type="button" data-q="${esc(x.id)}" aria-current="false">${esc(x.q)}${barHTML(splitOf(x.tally),'mt')}</button></li>`).join('')}</ul></details>`).join('');
  showQ(want,false);
});
// an address typed or followed from another page opens its question without a reload
addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(id&&id!==CUR&&QS.some(x=>x.id===id))showQ(id,false);});
