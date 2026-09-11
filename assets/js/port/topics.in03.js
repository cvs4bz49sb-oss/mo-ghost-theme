
"use strict";
const BLOB="https://mo-tfr-library.mo-podcast-feed.workers.dev";
// witness registry (owner 2026-09-02): facsimile copy -> born-digital primary — global, once
window.__WIT=window.__WIT||fetch(BLOB+"/v1/witnesses.json").then(r=>r.ok?r.json():{}).catch(()=>({}));
window.__WIT.then(m=>{window.__WITM=m||{};});
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cache={};
async function J(u){if(cache[u])return cache[u];const r=await fetch(u);if(!r.ok)throw new Error(u);return cache[u]=await r.json();}
async function gzJ(u){if(cache[u])return cache[u];const r=await fetch(u);if(!r.ok)throw new Error(u);
  const _b=new Uint8Array(await r.arrayBuffer());const t=(_b[0]===31&&_b[1]===139)?await new Response(new Blob([_b]).stream().pipeThrough(new DecompressionStream("gzip"))).text():new TextDecoder().decode(_b);
  return cache[u]=JSON.parse(t);}
// Migne's editorial/anonymous aggregates are held and searchable but never RANK among
// the authors (owner 2026-08-31 "dont like having PL editorials show up in authors")
const _edt=n2=>/^(anonymous|unknown|various|editors?\b|pseudo-|uncertain)/i.test(String(n2||"").trim())?1:0;
// FLATTENED SCHEMA QUOTES (owner 2026-09-01, Methodus p635): the miner joins page text
// with single spaces, so Baxter's bracket-diagrams arrive as walls ("…obedience. 2. In the
// second moment…"). When a quote carries a real enumeration chain (3+ ordinal steps),
// break each step onto its own hanging line. Prose with a stray "2." never triggers.
const escQ=t=>{
  const raw=String(t||"");
  const marks=[...raw.matchAll(/(?<=[a-z\u00e6\u0153);:.,])[ ](?=(?:\d{1,2}|[IVXivx]{1,4})[.)] [A-Z\u00c6\u0152])/g)];
  if(marks.length<3)return esc(raw);
  return esc(raw).replace(/(?<=[a-z\u00e6\u0153);:.,])[ ](?=(?:\d{1,2}|[IVXivx]{1,4})[.)] [A-Z\u00c6\u0152])/g,'<br><span class="qstep"></span>');
};
const readerHref=FRScripture.readerURL;   // ONE reader — /read hydrates eebo canon natively
  const ESV_ORDER=["genesis","exodus","leviticus","numbers","deuteronomy","joshua","judges","ruth",
  "1 samuel","2 samuel","1 kings","2 kings","1 chronicles","2 chronicles","ezra","nehemiah","esther",
  "job","psalms","proverbs","ecclesiastes","song of solomon","isaiah","jeremiah","lamentations",
  "ezekiel","daniel","hosea","joel","amos","obadiah","jonah","micah","nahum","habakkuk","zephaniah",
  "haggai","zechariah","malachi","matthew","mark","luke","john","acts","romans","1 corinthians",
  "2 corinthians","galatians","ephesians","philippians","colossians","1 thessalonians",
  "2 thessalonians","1 timothy","2 timothy","titus","philemon","hebrews","james","1 peter","2 peter",
  "1 john","2 john","3 john","jude","revelation"];
const _esvId=n2=>{let k=String(n2).toLowerCase().replace(/^(i{1,3})\s/,m2=>({i:"1 ",ii:"2 ",iii:"3 "})[m2.trim()]||m2)
    .replace(/revelation of john/,"revelation").replace(/^psalm$/,"psalms").replace(/song of songs|canticles/,"song of solomon").trim();
  const i=ESV_ORDER.indexOf(k);return i<0?null:i+1;};
const esvCache={};
async function esvChapter(bookName,ch){
  const id=_esvId(bookName);if(!id)return null;
  const ck=id+"/"+ch;
  if(!(ck in esvCache))esvCache[ck]=fetch(`https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/chapter/ESV/${id}/${ch}/`)
    .then(r=>r.ok?r.json():null)
    .then(a2=>{if(!Array.isArray(a2)||!a2.length)return null;
      const vs={};a2.forEach(x2=>{vs[String(x2.verse)]=String(x2.text||"").replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();});
      return vs;}).catch(()=>null);
  return esvCache[ck];
}

const aslug=a=>String(a).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60);
const HOVERABLE=matchMedia("(hover:hover)").matches;
const ERAL={E:"Early patristic",L:"Later patristic",C:"Carolingian",H:"High medieval",R:"Reformation",P:"1600 and later"};   // P = the mine's last bucket (born 1600 or later), not one century
// WORK KINDS (owner 2026-08-25 'divisions and ordering intuitive and yet comprehensive…
// will eventually cover every text TFR serves'): one map, v1/kinds.json.gz {slug:[kindIdx,canonOrd]}
const KINDS=["commentary","sermons","treatises","polemical","letters","catechetical","devotional","history","law","poetry","collected","reference"];
const KNAME={commentary:"Commentaries",sermons:"Sermons & Homilies",treatises:"Treatises",polemical:"Polemical",letters:"Letters",catechetical:"Catechisms & Confessions",devotional:"Devotional & Practical",history:"History & Lives",law:"Councils & Canon Law",poetry:"Poetry & Hymns",collected:"Collected Editions",reference:"Editorial Apparatus"};
const KORD=["commentary","sermons","treatises","devotional","polemical","catechetical","letters","history","law","poetry","collected"];
let KMAP=null;
async function kinds(){if(KMAP)return KMAP;   // daily buster: the map is re-baked, browsers cache blob URLs for a year
  try{KMAP=await gzJ(BLOB+"/v1/kinds.json.gz?d="+bust());}catch(e){KMAP={};}return KMAP;}
const BUST_REV="3";   // bump on same-day shard re-bakes — the daily buster alone caches stale
const bust=()=>new Date().toISOString().slice(0,10)+"."+BUST_REV;
const kindOf=w=>{const r=(KMAP||{})[w];return r?KINDS[r[0]]:null;};
const kordOf=w=>{const r=(KMAP||{})[w];return (r&&r[1])||0;};
// DEVOTION (owner 2026-08-25 'make our scripture for commentaries make sense'): which
// works are DEVOTED to each book/chapter — inferred from 1,954 titles, anchored to pages.
let DEVO=null;
async function devotion(){if(DEVO)return DEVO;
  try{DEVO=await gzJ(BLOB+"/v1/devotion.json.gz?d="+bust());}
  catch(e){DEVO={books:{}};}return DEVO;}
// ONE BIBLE (owner 2026-08-25 'why can't we have one bible that can filter'): every row is
// facet-tagged sh/pt/wm at build; the reader filters, never re-fetches.
let FACS=new Set((localStorage.getItem("fr_bfac2")||"").split(",").filter(Boolean));
// ?sh=<code> seeds the shelf facet so a shelf page can hand a visitor straight into its own
// authors / topics / scripture (owner 2026-08-28: link the shelves here instead of the
// per-shelf card grids). Comma-separated; unknown codes ignored.
{const _q=new URLSearchParams(location.search).get("sh");
 if(_q){const OK=new Set(["pl","gf","po","ed","md","rc","lu","rf","hl","pu","an","wm"]);
   const ks=_q.split(",").map(x=>x.trim()).filter(x=>OK.has(x));
   if(ks.length){FACS=new Set(ks);try{localStorage.setItem("fr_bfac2",ks.join(","));}catch(e){}}}}
const FACL=[["all","All"],["pl","Latin Fathers"],["gf","Greek Fathers"],["po","Eastern Fathers"],["ed","English Divines"],["md","Medieval"],["rc","Roman Catholic"],["lu","Lutheran"],["rf","Continental Reformed"],["hl","Humanism and Law"],["pu","Puritan"],["an","Anglican"],["wm","Westminster"]];
const SHK=new Set(["pl","gf","po","ed","md","rc","lu","rf","hl"]);   // shelf facets match r.sh directly (2026-08-28 parity); party facets are orthogonal
const facOK=r=>{if(!FACS.size)return true;
  for(const k of FACS){
    if(SHK.has(k)&&(r.sh||"pl")===k)return true;
    if(k==="pu"&&r.pt==="pu")return true;
    if(k==="an"&&r.pt==="an")return true;
    if(k==="wm"&&r.wm)return true;}
  return false;};
const facOne=k=>FACS.size===1&&FACS.has(k);
const facAll=()=>!FACS.size;
const facBar=()=>`<div class="chstrip" style="margin:.5rem 0 .2rem">${FACL.map(([k,l])=>`<button class="chp${(k==="all"?!FACS.size:FACS.has(k))?" on":""}" data-fac="${k}" aria-pressed="${k==="all"?!FACS.size:FACS.has(k)}">${l}</button>`).join("")}</div>`;
document.addEventListener("click",e=>{const b=e.target.closest("[data-fac]");if(!b)return;
  const k=b.dataset.fac;
  if(k==="all")FACS.clear();
  else if(FACS.has(k))FACS.delete(k);
  else FACS.add(k);
  try{localStorage.setItem("fr_bfac2",[...FACS].join(","));}catch(_){}route();});
// importance = corpus citation weight (both shelves) — most important voices first
let WTS=null;
J(BLOB+"/v1/bible/all/weights.json").then(d2=>{WTS=d2;}).catch(()=>{});
const wOf=a2=>(WTS&&WTS[a2])||0;
// era authority = the rooms index (dated bios); the bible rows' own e field is unreliable
let AERAS=null;
J(BLOB+"/v1/bible/pl/rooms/index.json").then(d2=>{AERAS={};(d2.authors||[]).forEach(r=>{AERAS[r.a]={e:r.e,y:r.y};});}).catch(()=>{});
const eraOf=r=>((r.e==="R"||r.e==="P")?r.e:((AERAS&&AERAS[r.a]&&AERAS[r.a].e)||r.e||"L"));
// baked rows carry a truncated upstream author string until the next full bake
const AFIX={"Westminster Divines (Ley, Gouge":"Westminster Divines"};
const aName=a2=>AFIX[a2]||a2;
// divines paginate in pages, the Patrologia in columns
const pgl=w2=>(/^(pld|pg)-/.test(String(w2||""))?"col.":"p.");   // only Migne works are column-numbered
// word-safe trim for the builder's hard [:80] title cuts ('…thirty-fifth, thirt')
const tell=t2=>{t2=String(t2||"");if(t2.length<72)return t2;const c2=t2.slice(0,70),i2=c2.lastIndexOf(" ");return (i2>40?c2.slice(0,i2):c2)+"\u2026";};
const HOWL={quotation:"Quoted",explicit:"Cited",allusion:"Echoed","":"Cited"};
const page=$("#page");
const PAGE=location.pathname.includes("compare")?"compare":location.pathname.includes("topics")?"topics":(location.pathname.includes("bible")?"bible":"fathers");

document.body.classList.toggle('research-enhanced',PAGE!=='bible');
$('#research-ask').onclick=()=>window.FRAsk?.open();
/* read a passage in place: canon XML sliced at the column */
const XMLCACHE={};
async function passageOf(slug,col){
  if(!col)return null;
  // EEBO branch (owner 2026-08-25 'the english read here don't show up'): the divines'
  // works hydrate from eebo/<id>.json.gz — page-split its html once, cache like the TEIs
  const mE=String(slug).match(/^eebo-(\d+)$/);
  if(mE){
    let paras=XMLCACHE[slug];
    if(!paras){
      const r=await fetch(`${BLOB}/eebo/${mE[1]}.json.gz`);
      if(!r.ok)return null;
      const d=JSON.parse(await (async()=>{const _b=new Uint8Array(await r.arrayBuffer());return (_b[0]===31&&_b[1]===139)?new Response(new Blob([_b]).stream().pipeThrough(new DecompressionStream("gzip"))).text():new TextDecoder().decode(_b);})());
      paras={};let cur=1;
      (function walk(nodes){(nodes||[]).forEach(nd=>{
        const parts=String(nd.html||"").split(/<span class="pb" data-n="(\d+)"[^>]*><\/span>/);
        for(let i=0;i<parts.length;i++){
          if(i%2===1){cur=+parts[i]||cur;continue;}
          parts[i].split(/<\/p>/).forEach(ch2=>{
            const txt=ch2.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
            if(txt.length>40&&(paras[cur]=paras[cur]||[]).length<12)paras[cur].push(txt);
          });
        }
        walk(nd.kids);
      });})(d.toc);
      XMLCACHE[slug]=paras;
    }
    return paras[col]||paras[col-1]||null;
  }
  // NAMED-slug branch (2026-08-25, reception evidence rows): v1/works/<slug> serves either
  // sharded pages/NNNN.json ({pages:[{n,en}]}) or a flat tei.en.xml — cover both.
  if(!/^(pld|pg|eebo)-\d+$/.test(String(slug))&&/^[a-z0-9-]+$/.test(String(slug))){
    let np=XMLCACHE[slug];
    if(!np){
      np=XMLCACHE[slug]={};
      const meta=await J(`${BLOB}/v1/works/${slug}/meta.json`).catch(()=>null);
      if(meta&&meta.shards&&meta.shards.length)np._sh=meta.shards;
      else{
        const xml=await fetch(`${BLOB}/v1/works/${slug}/tei.en.xml`).then(r=>{if(!r.ok)throw 0;return r.text();}).catch(()=>null);
        if(!xml)return null;
        let cur=0;const re2=/<(?:pb|milestone)[^>]*\sn="(?:\d+:)?0*(\d+)[A-Da-d]?"[^>]*\/?>|<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g;
        let mm2;
        while((mm2=re2.exec(xml))){
          if(mm2[1]!==undefined){cur=+mm2[1];continue;}
          const txt=(mm2[2]||"").replace(/<note[\s\S]*?<\/note>/g,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
          if(txt.length>1&&(np[cur]=np[cur]||[]).length<12)np[cur].push(txt);
        }
      }
    }
    if(np._sh){
      const sh=np._sh.find(s2=>col>=s2.from&&col<=s2.to);
      if(!sh)return null;
      if(!np["f:"+sh.file]){
        np["f:"+sh.file]=1;
        const d2=await J(`${BLOB}/v1/works/${slug}/${sh.file}`).catch(()=>null);
        (d2&&d2.pages||[]).forEach(pg=>{
          const t=String(pg.en||pg.la||"").split(/\n\n+/).map(x=>x.replace(/\[\^\d+\]/g,"").replace(/\s+/g," ").trim()).filter(x=>x.length>1).slice(0,12);
          if(t.length)np[pg.n]=t;});
      }
    }
    return np[col]||np[col-1]||null;
  }
  const m=String(slug).match(/^pld-(\d+)$/);
  if(!m)return null;
  let paras=XMLCACHE[slug];
  if(!paras){
    const xml=await fetch(`${BLOB}/tei/pld/${m[1]}.xml`).then(r=>{if(!r.ok)throw 0;return r.text();});
    paras={};let cur=0;
    const re=/<(?:pb|milestone)[^>]*\sn="(?:\d+:)?0*(\d+)[A-Da-d]?"[^>]*\/?>|<p([^>]*)>([\s\S]*?)<\/p>/g;
    let mm;
    while((mm=re.exec(xml))){
      if(mm[1]!==undefined){cur=+mm[1];continue;}
      if(!/xml:lang="en"/.test(mm[2]||""))continue;
      const txt=(mm[3]||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
      if(txt)(paras[cur]=paras[cur]||[]).push(txt);
    }
    XMLCACHE[slug]=paras;
  }
  return paras[col]||paras[col-1]||null;
}
async function togglePassage(btn){
  const host=btn.closest(".x")||btn.closest(".ev")||btn.closest(".vpanel")||btn.parentElement.parentElement;
  let box=host.querySelector(".passage");
  if(box){box.remove();btn.textContent="Open";return;}
  btn.textContent="…";
  let paras=null;
  try{paras=await passageOf(btn.dataset.w,+btn.dataset.p);}catch(_){}
  box=document.createElement("div");box.className="passage";
  // CITATION HIGHLIGHT (owner 2026-08-26 'this should be highlighted Mic. 3. 8.'): when the
  // opener knows the verse, mark the printed reference so the eye lands on it.
  let mark=t=>esc(t);
  const hl=btn.dataset.hl;
  if(hl){const [st,ch,vv]=hl.split("|");
    try{const rx=new RegExp("\\b(?:[1-3]\\s*)?"+st+"[a-z]*\\.?\\s*"+ch+"\\s*[.:,\\s]\\s*"+(vv&&vv!=="0"?vv:"\\d+")+"\\b","gi");
      mark=t=>esc(t).replace(rx,m2=>`<mark class="hlref">${m2}</mark>`);}catch(_){}}
  box.innerHTML=paras&&paras.length
    ?`<div class="pref">${pgl(btn.dataset.w)==="p."?"p.":"PL col."} ${btn.dataset.p}</div>`+paras.map(p=>`<p>${mark(p)}</p>`).join("")
    :`<div class="pref"><a href="/the-faith-received/read/?w=${btn.dataset.w}#b${btn.dataset.p}-0" target="_blank" rel="noopener">reader →</a></div>`;
  host.appendChild(box);
  const fm=box.querySelector("mark.hlref");
  if(fm)fm.scrollIntoView({block:"nearest"});
  btn.textContent="close";
}
window.togglePassage=togglePassage;
const ell=s=>{s=String(s||"");if(s.length<170)return s;const c=s.slice(0,168);const i=c.lastIndexOf(" ");return (i>120?c.slice(0,i):c)+"\u2026";};
/* ?hl=<surface form>: the reader marks the flagged name on the landed page (owner 2026-09-10 "can't see the thing that was flagged in the work") */
const readerHrefHl=(w,p,hl)=>{const u=readerHref(w,p);if(!hl)return u;const i=u.indexOf('#');return (i<0?u:u.slice(0,i))+(u.includes('?')?'&':'?')+'hl='+encodeURIComponent(String(hl).slice(0,120))+(i<0?'':u.slice(i));};
const previewBtn=(w,p,hl)=>w&&p!=null&&p!==""?`<button class="peekbtn" data-pk="${esc(w)}|${esc(p)}|${esc(hl||'')}" aria-label="Preview source passage" aria-expanded="false">Preview source</button>`:"";
const readBtn=(w,p,hl)=>(w&&p!=null&&p!=="")?`<a class="readbtn" target="_blank" rel="noopener" href="${readerHrefHl(w,p,hl)}">Open ↗</a><button class="peekbtn" data-pk="${esc(w)}|${p}|${esc(hl||'')}" aria-label="Preview source passage" aria-expanded="false" title="Read the passage here">Preview</button>`:"";   // owner 2026-09-02 "open inline, peeking, opening in a tab" (supersedes 08-31 never-inline)
// PEEK: the passage slides open right under its row — the reader itself, embedded
document.addEventListener("click",async e=>{
  const ov=e.target.closest(".openvol");
  if(ov){e.preventDefault();
    const w=ov.dataset.w,bk=String(ov.dataset.bk||"").toLowerCase();
    let pg=null;
    try{const m=await J(BLOB+`/v1/works/${w}/meta.json`);
      const hit=(m.structure||[]).find(x=>String(x.title||"").toLowerCase().includes(bk));
      if(hit)pg=hit.page;}catch(_){}
    window.open(readerHref(w,pg),"_blank","noopener");return;}
  const b=e.target.closest(".peekbtn");if(!b)return;
  e.preventDefault();
  let wrap=b.parentElement.querySelector(":scope > .peekwrap")||b.closest(".rx-excerpt,.vpr,.ev,.m")?.querySelector(".peekwrap");
  if(wrap){const on=wrap.classList.toggle("on");b.classList.toggle("on",on);b.setAttribute("aria-expanded",String(on));return;}
  const [w,p,hl]=String(b.dataset.pk).split("|");
  wrap=document.createElement("div");wrap.className="peekwrap";
  wrap.innerHTML=`<div><iframe loading="lazy" src="${readerHrefHl(w,p,hl)}" title="Passage"></iframe></div>`;
  (b.closest(".rx-excerpt,.vpr,.ev")||b.parentElement).appendChild(wrap);
  requestAnimationFrame(()=>{wrap.classList.add("on");b.classList.add("on");b.setAttribute("aria-expanded","true");});
});
const mkHl=(book,c,v)=>{const st=String(book||"").replace(/^[0-9IVX]+\s+/,"").slice(0,3);return st?`${st}|${c}|${v||0}`:"";};
/* ── SAVE TO NOTEBOOK (owner 2026-09-10 "save works … specific passages, on all surfaces cleanly"): ONE path,
   FRResearchNotebook — a work is a reference with page null, a passage a reference with a page; fr_pins is a
   mirror the module rebuilds (never written here). Saved state is one read per render (SAVED), refreshed on
   fr-notebook-updated; a click flips every button for the same reference on the page. ── */
let SAVED=new Set();const refreshSaved=()=>{try{SAVED=window.FRResearchNotebook?.savedKeys?FRResearchNotebook.savedKeys():new Set();}catch(_){SAVED=new Set();}};refreshSaved();
addEventListener('fr-notebook-updated',refreshSaved);addEventListener('storage',e=>{if(e.key==='fr_collections_v1')refreshSaved();});
const refKey=(w,p)=>'fr|'+w+'|'+(p==null||p===''?'':String(p));
const pinBtn=(w,p,title,author,label)=>{if(!w)return "";const page=FRResearch.page(p);if(page==null)return "";const on=SAVED.has(refKey(w,page));
  return `<button type="button" class="pinb${on?" on":""}" data-save-passage="${esc(w)}" data-page="${esc(String(page))}" data-title="${esc(String(title||"").slice(0,90))}" data-author="${esc(String(author||"").slice(0,60))}" data-label="${esc(String(label||"").slice(0,240))}" aria-pressed="${on}" title="${on?'Saved in your notebook · click to remove':'Save this passage to your notebook'}">${on?"Saved":"Save passage"}</button>`;};
const workSaveBtn=(w,title,author)=>{if(!w)return "";const on=SAVED.has(refKey(w,null));
  return `<button type="button" class="pinb pinb-work${on?" on":""}" data-save-work="${esc(w)}" data-title="${esc(String(title||"").slice(0,120))}" data-author="${esc(String(author||"").slice(0,60))}" aria-pressed="${on}" title="${on?'Saved for later reading · click to remove':'Save this work for later reading'}">${on?"Saved":"Save work"}</button>`;};
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-save-passage],[data-save-work]");if(!b)return;e.preventDefault();e.stopPropagation();
  const N=window.FRResearchNotebook;if(!N?.saveWork){b.title='The notebook could not load. Reload and try again.';return;}
  const isWork=b.hasAttribute('data-save-work'),slug=isWork?b.dataset.saveWork:b.dataset.savePassage,page=isWork?null:b.dataset.page,on=b.getAttribute('aria-pressed')==='true';
  b.disabled=true;
  try{if(on)await N.unsave(slug,page);else if(isWork)await N.saveWork({slug,title:b.dataset.title,author:b.dataset.author});else await N.savePassage({slug,page,title:b.dataset.title,author:b.dataset.author,label:b.dataset.label});}
  catch(err){b.title=(err&&err.message)||'This could not be saved.';b.disabled=false;return;}
  refreshSaved();const now=!on;
  document.querySelectorAll(isWork?`[data-save-work="${CSS.escape(slug)}"]`:`[data-save-passage="${CSS.escape(slug)}"][data-page="${CSS.escape(String(page))}"]`).forEach(x=>{const wk=x.hasAttribute('data-save-work');x.classList.toggle('on',now);x.setAttribute('aria-pressed',String(now));x.textContent=now?'Saved':(wk?'Save work':'Save passage');x.title=now?(wk?'Saved for later reading · click to remove':'Saved in your notebook · click to remove'):(wk?'Save this work for later reading':'Save this passage to your notebook');x.disabled=false;});
  b.disabled=false;});
const bar=(n,max,label)=>`<span class="bar"><i style="width:${Math.max(2,100*Math.sqrt((n||0)/max))}%"></i><span>${Math.round(n||0).toLocaleString()}${label||""}</span></span>`;

/* ── AUTHORS index ── */
let AV={q:"",era:"",sort:"imp"};
let RESEARCH_RUN=0,ROSTER_PROMISE=null,researchEvents=new AbortController();
const RX=FRResearch,fmtR=n=>Number(n||0).toLocaleString();
function researchStart(cls){page.className='research '+cls;page.innerHTML='<p class="loading" role="status">Loading research…</p>';return RESEARCH_RUN;}
// Keep primary search and results visible on a phone; optional context stays available.
const researchPhone=matchMedia('(max-width:640px)');
function researchLayout(){
 const disclosure=(cls,label)=>{const d=document.createElement('details');d.className=cls;d.open=!researchPhone.matches;const sum=document.createElement('summary');sum.textContent=label;d.appendChild(sum);return d;};
 page.querySelectorAll('.rx-filters').forEach(row=>{if(row.querySelector('.rx-secondary'))return;const labels=[...row.children].filter(e=>e.matches('label:not(.rx-search):not(.rx-primary-filter)'));if(!labels.length)return;const d=disclosure('rx-secondary','Filter and sort');const box=document.createElement('div');labels.forEach(l=>box.appendChild(l));d.appendChild(box);row.appendChild(d);});
 if(page.classList.contains('research-directory')){const intro=page.querySelector('.research-intro');if(intro&&!intro.querySelector('.rx-intro-detail')){const d=disclosure('rx-intro-detail','About this index');const p=intro.querySelector('p'),link=intro.querySelector(':scope > a'),note=page.querySelector('#author-order-note');for(const e of [p,link,note])if(e)d.appendChild(e);intro.appendChild(d);}}
 if(page.classList.contains('research-room')&&!page.querySelector('.rx-profile')){const bar=page.querySelector('.ridbar');if(bar){const d=disclosure('rx-profile','About this author');for(const e of [bar.querySelector('.deck'),bar.querySelector('.stats'),page.querySelector('.rx-author-bio')])if(e)d.appendChild(e);bar.after(d);}}
}
researchPhone.addEventListener('change',()=>page.querySelectorAll('.rx-secondary,.rx-intro-detail,.rx-profile').forEach(d=>d.open=!researchPhone.matches));
function researchError(message){page.innerHTML=`<h1>${esc(message)}</h1><p>Your place is saved in the address bar.</p><button class="rx-button" id="retry-research">Retry loading</button> <a href="/${PAGE}">Browse ${PAGE==='topics'?'topics':'authors'}</a>`;$('#retry-research').onclick=route;}
function getRoster(){if(!ROSTER_PROMISE)ROSTER_PROMISE=Promise.all(Object.keys(RX.shelves).map(async sh=>{try{const d=await J(BLOB+'/v1/bible/'+sh+'/rooms/index.json');return {sh,rows:(d.authors||[]).map(r=>({...r,sh})),ok:true};}catch(_){return {sh,rows:[],ok:false};}})).then(parts=>({rows:parts.flatMap(p=>p.rows),missing:parts.filter(p=>!p.ok).map(p=>p.sh)}));return ROSTER_PROMISE;}
async function authorsIndex(){
 /* AUTHORS BY TRADITION (owner 2026-09-09 "replace /fathers to be authors, group authors by
    tradition for expansion"): one fold per shelf in the closed nine-shelf order, each summary
    carrying its counts and its leading names; rows are built only when a fold opens; a search
    opens every fold that has a match and hides the rest; ?sh= opens one fold. */
 const run=researchStart('research-directory');
 const [index,cu]=await Promise.all([getRoster(),J(BLOB+'/v1/curation.json?d='+bust()).catch(()=>({}))]);if(run!==RESEARCH_RUN)return;
 const rank={};Object.values(cu.sh||{}).forEach(xs=>xs.forEach((s,i)=>rank[s]=Math.min(rank[s]??9999,i)));
 const params=new URLSearchParams(location.search);const shelfOpen=RX.shelves[params.get('sh')||'']?params.get('sh'):'';AV.q=params.get('q')||'';
 const ORDER=['pl','gf','po','md','rc','lu','rf','ed','hl'];
 const roster=RX.roster(index.rows);                       // one row per author; variants = the same author on other shelves
 const byShelf={};ORDER.forEach(sh=>byShelf[sh]=[]);roster.forEach(r=>{(byShelf[r.sh]||(byShelf[r.sh]=[])).push(r);});
 const sorter=()=>AV.sort==='a'?(a,b)=>a.a.localeCompare(b.a):AV.sort==='w'?(a,b)=>(b.w||0)-(a.w||0):AV.sort==='n'?(a,b)=>(b.n||0)-(a.n||0):(a,b)=>_edt(a.a)-_edt(b.a)||(rank[a.s]??9999)-(rank[b.s]??9999)||(b.w||0)-(a.w||0);
 const matches=r=>(!AV.era||r.e===AV.era)&&RX.authorScore(r,AV.q)>0;
 const rowHTML=r=>`<article class="rx-author-row"><a class="rx-author-main" href="${RX.authorURL(r)}"><span><strong>${esc(aName(r.a))}</strong><small>${r.y?'c. '+r.y+' · ':''}${esc(RX.eras[r.e])}</small></span><span class="rx-counts"><span>${fmtR(r.w)} works</span><span>${fmtR(r.nt)} topics</span>${AV.sort==='n'?`<span>${fmtR(r.n)} Scripture citations</span>`:''}</span></a><div class="rx-author-actions"><a class="rx-text-link" href="${RX.authorURL(r)}">Browse works</a><a class="rx-text-link" href="${RX.authorURL(r)}/positions">Browse positions</a></div>${r.variants.length>1?`<div class="rx-editions">Also on ${r.variants.slice(1).map(v=>`<a href="${RX.authorURL(v)}">${esc(RX.shelves[v.sh])} (${fmtR(v.w)} works)</a>`).join(' · ')}</div>`:''}</article>`;
 page.innerHTML=`<div class="research-intro"><div><h1>Authors</h1><p>Every writer in the library, shelf by shelf. Open a tradition to see its authors; open an author to read their works, follow their use of Scripture, and explore the passages behind their ideas.</p></div><a class="rx-text-link" href="/the-faith-received/web/">Explore citation connections</a></div>
 <form class="rx-filters" role="search" onsubmit="return false"><label class="rx-search">Find an author<input id="q" type="search" placeholder="Search by name, across all traditions" value="${esc(AV.q)}"></label><label>Period<select id="author-era"><option value="">All periods</option>${Object.entries(RX.eras).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>Order authors<select id="sort"><option value="imp">Library selection</option><option value="a">Name A–Z</option><option value="w">Most works</option><option value="n">Most Scripture citations</option></select></label></form>
 <div class="rx-results-line"><p id="dircount" role="status"></p><span><button class="rx-text-link" id="author-expand">Expand all</button> <button class="rx-text-link" id="author-reset">Reset filters</button></span></div>
 ${index.missing.length?`<p class="rx-note">${index.missing.map(k=>RX.shelves[k]).join(', ')} could not load. <button id="roster-retry" class="rx-text-link">Retry shelves</button></p>`:''}
 <div id="dir" class="rx-fold-list rx-author-folds">${ORDER.map(sh=>`<details class="rx-fold rx-author-fold" data-sh="${sh}"${sh===shelfOpen?' open':''}><summary><span><strong>${esc(RX.shelves[sh])}</strong><small class="rx-fold-count"></small></span><span class="rx-fold-preview"></span></summary><div class="rx-fold-body"><div class="rx-directory"></div><button class="rx-button rx-more" hidden>Show all</button></div></details>`).join('')}</div>
 <p class="rx-note" id="author-order-note"></p>`;
 researchLayout();$('#author-era').value=AV.era;$('#sort').value=AV.sort;
 const LIM=60,shown={};
 const paint=()=>{const cmp=sorter();let total=0;
  document.querySelectorAll('.rx-author-fold').forEach(d=>{const sh=d.dataset.sh;const list=byShelf[sh].filter(matches).sort((a,b)=>(AV.q?RX.authorScore(b,AV.q)-RX.authorScore(a,AV.q):0)||cmp(a,b));total+=list.length;
   const works=list.reduce((n,r)=>n+(r.w||0),0);
   d.hidden=!!(AV.q||AV.era)&&!list.length;
   d.querySelector('.rx-fold-count').textContent=list.length?`${fmtR(list.length)} authors · ${fmtR(works)} works`:'no authors';
   d.querySelector('.rx-fold-preview').textContent=list.slice(0,4).map(r=>aName(r.a)).join(' · ')+(list.length>4?' · …':'');
   if(AV.q)d.open=!!list.length;
   const body=d.querySelector('.rx-directory'),more=d.querySelector('.rx-more');
   if(d.open){more.hidden=true;const key=JSON.stringify([AV.q,AV.era,AV.sort,list.map(r=>r.s)]);if(body.dataset.authorRenderKey!==key){body.dataset.authorRenderKey=key;if(list.length)paneList(body,list,rowHTML);else{body.classList.remove('rx-pane');body.innerHTML='<div class="rx-empty"><p>No matching authors on this shelf.</p></div>';}}}
   else{body.innerHTML='';delete body.dataset.authorRenderKey;more.hidden=true;}
  });
  $('#dircount').textContent=fmtR(total)+' authors across '+fmtR(ORDER.filter(sh=>byShelf[sh].filter(matches).length).length)+' traditions';
  $('#author-order-note').textContent=(AV.sort==='imp'?'Within a tradition, library selection follows the existing editorial order. ':'')+'Counts are the works each author has in the research rooms; an author held on several shelves is listed once, with the other shelves beneath.';
 };
 document.querySelectorAll('.rx-author-fold').forEach(d=>d.addEventListener('toggle',()=>paint()));
 const writeAuthorQuery=()=>{const url=new URL(location.href);AV.q.trim()?url.searchParams.set('q',AV.q.trim()):url.searchParams.delete('q');history.replaceState(history.state,'',url);};
 $('#q').oninput=e=>{AV.q=e.target.value;writeAuthorQuery();paint();};
 $('#q').onkeydown=e=>{if(e.key!=='Enter'||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;const candidates=roster.filter(matches).sort((a,b)=>RX.authorScore(b,AV.q)-RX.authorScore(a,AV.q));if(candidates.length===1||candidates.length>1&&RX.authorScore(candidates[0],AV.q)>RX.authorScore(candidates[1],AV.q)){e.preventDefault();location.assign(RX.authorURL(candidates[0]));}};$('#author-era').onchange=e=>{AV.era=e.target.value;paint();};$('#sort').onchange=e=>{AV.sort=e.target.value;paint();};
 $('#author-expand').onclick=()=>{const all=[...document.querySelectorAll('.rx-author-fold')];const open=all.some(d=>!d.open);all.forEach(d=>{d.open=open;});$('#author-expand').textContent=open?'Collapse all':'Expand all';paint();};
 $('#author-reset').onclick=()=>{AV.q='';AV.era='';writeAuthorQuery();$('#q').value='';$('#author-era').value='';document.querySelectorAll('.rx-author-fold').forEach(d=>{d.open=false;});paint();};
 if($('#roster-retry'))$('#roster-retry').onclick=()=>{ROSTER_PROMISE=null;authorsIndex();};
 paint();
 if(shelfOpen){const d=document.querySelector(`.rx-author-fold[data-sh="${shelfOpen}"]`);if(d)setTimeout(()=>d.scrollIntoView({block:'start',behavior:'smooth'}),60);}
}

/* ── WORKS index — ONE directory, both shelves (owner 2026-08-25 'full upgrade of the
   English divines'): shelf chips select PL / ED; kind grouping shared; the second axis
   is the shelf's own spine (PL volumes, ED authors). ── */
const WSH=[["pl","Latin Fathers"],["gf","Greek Fathers"],["po","Eastern Fathers"],["ed","English Divines"],
           ["md","Medieval"],["rc","Roman Catholic"],["lu","Lutheran"],["rf","Continental Reformed"],["hl","Humanism and Law"]];
let WV={q:new URLSearchParams(location.search).get('q')||'',g:'author',sh:(()=>{const sh=new URLSearchParams(location.search).get('sh')||localStorage.getItem('fr_wsh');return RX.shelves[sh]?sh:'pl';})()};
let CATALOGUE_PROMISE=null,WORKS_INDEX_RUN=0;
function getWorkCatalogue(){if(!CATALOGUE_PROMISE)CATALOGUE_PROMISE=Promise.all([J(BLOB+'/v1/works-index.json'),J(BLOB+'/v1/titles_en.json').catch(()=>({}))]).then(([index,titles])=>({bySlug:new Map(index.works.map(w=>[w.slug,w])),titles,ok:true})).catch(()=>{CATALOGUE_PROMISE=null;return {bySlug:new Map(),titles:{},ok:false};});return CATALOGUE_PROMISE;}
function catalogueWork(row,catalogue){const meta=catalogue.bySlug.get(row.w)||{};return {...row,volume:meta.volume||row.vs||'',cols:meta.cols,t:catalogue.titles[row.w]||row.t||meta.title||row.w,originalTitle:row.t||meta.title||'',date:meta.year||'',a:row.a||meta.author||'Author not recorded'};}
function workRowHTML(w){const reference=RX.edition(w),details=[reference,w.date,(!/^P[LG]\b/.test(reference)&&w.np)?fmtR(w.np)+' indexed pages':''].filter(Boolean);return `<article class="rx-work-row"><div><h3><a href="${readerHref(w.w)}">${esc(w.t)}</a></h3><p class="rx-work-reference">${details.map(esc).join(' · ')||'Edition details not recorded'}</p>${w.ambiguous?`<small>Catalogue entry: ${esc(w.w)}</small>`:''}</div><div class="rx-work-actions"><a class="rx-text-link" href="${readerHref(w.w)}" aria-label="Read ${esc(w.t)}${reference?', '+esc(reference):''}">Read work</a><a class="rx-text-link" href="/the-faith-received/fathers/#w/${encodeURIComponent(w.w)}" aria-label="Explore ${esc(w.t)}${reference?', '+esc(reference):''}">Explore work</a>${workSaveBtn(w.w,w.t,w.a||w.author||'')}</div></article>`;}
// Build only the branches the reader opens. The catalogue and its identifiers stay intact.
function mountWorkGroups(host,rows,mode,options={}){
 const definitions=new Map();let serial=0;
 const grouped=(list,key)=>{const map=new Map();for(const w of list){const k=key(w);if(!map.has(k))map.set(k,[]);map.get(k).push(w);}return [...map];};
 const fold=(label,list,next,preview='')=>{const id=String(serial++);definitions.set(id,{list,next});return `<details class="rx-fold rx-work-fold" data-work-group="${id}"><summary><span><strong>${esc(label)}</strong>${preview?`<small>${esc(preview)}</small>`:''}</span><span class="rx-fold-count">${fmtR(list.length)} ${list.length===1?'work':'works'}</span></summary><div class="rx-fold-body"></div></details>`;};
 const volumes=list=>grouped(list,RX.volumeLabel).sort((a,b)=>RX.workOrder(a[1][0],b[1][0]));
 const authorBranches=list=>grouped(list,w=>w.a).sort((a,b)=>a[0].localeCompare(b[0]));
 const mountBranches=(body,groups,next)=>{let shown=0;const append=()=>{const previous=shown;shown+=12;body.insertAdjacentHTML('beforeend',groups.slice(previous,shown).map(([label,ws])=>fold(label,ws,next)).join(''));if(shown<groups.length){const button=document.createElement('button');button.className='rx-button rx-more';button.textContent=next==='author'?'Show more authors':'Show more volumes';body.appendChild(button);button.onclick=()=>{button.remove();append();body.querySelectorAll(':scope > details>summary')[previous+12]?.focus();};}};append();};
 const sortRows=list=>list.slice().sort(RX.workOrder);
 const duplicates=new Map();rows.forEach(w=>{const key=[w.a,w.t,RX.edition(w)].join('|');duplicates.set(key,(duplicates.get(key)||0)+1);});rows.forEach(w=>w.ambiguous=duplicates.get([w.a,w.t,RX.edition(w)].join('|'))>1);
 let groups=mode==='volume'?volumes(rows):mode==='kind'?grouped(rows,w=>KNAME[kindOf(w.w)||'treatises']||'Other works').sort((a,b)=>{const names=KORD.map(k=>KNAME[k]);return (names.indexOf(a[0])<0?999:names.indexOf(a[0]))-(names.indexOf(b[0])<0?999:names.indexOf(b[0]));}):grouped(rows,w=>w.a).sort((a,b)=>{const q=RX.fold(options.query),rank=x=>q&&(RX.fold(x)===q||RX.fold(x).startsWith(q))?0:1;return rank(a[0])-rank(b[0])||a[0].localeCompare(b[0]);});
 let limit=16;
 const draw=()=>{host.innerHTML=groups.slice(0,limit).map(([label,list])=>fold(label,list,mode,mode==='volume'?[...new Set(list.map(w=>w.a))].slice(0,2).join(' · '):'')).join('')+(groups.length>limit?'<button class="rx-button rx-more" data-more-groups>Show more groups</button>':'');if(!rows.length)host.innerHTML='<div class="rx-empty"><h2>No matching works</h2><p>Try another title, author, volume, or shelf.</p></div>';};
 host.ontoggle=e=>{const d=e.target;if(!d.matches('[data-work-group]')||!d.open||d.dataset.ready)return;d.dataset.ready='true';const {list,next}=definitions.get(d.dataset.workGroup),body=d.querySelector(':scope > .rx-fold-body'),vs=volumes(list);
  if(next==='author'&&vs.length>1){mountBranches(body,vs,'rows');return;}
  if(next==='kind'){mountBranches(body,authorBranches(list),'author');return;}
  if(next==='volume'&&list.length>12){mountBranches(body,authorBranches(list),'author');return;}
  const sorted=sortRows(list);let shown=12;const more=()=>{body.innerHTML=sorted.slice(0,shown).map(workRowHTML).join('')+(shown<sorted.length?'<button class="rx-button rx-more" data-more-works>Show more works</button>':'');body.querySelector('[data-more-works]')?.addEventListener('click',()=>{shown+=12;more();});};more();
 };
 // Native toggle does not bubble; capture includes nested volumes and authors.
 if(host._workToggle)host.removeEventListener('toggle',host._workToggle,true);host._workToggle=host.ontoggle;host.ontoggle=null;host.addEventListener('toggle',host._workToggle,true);
 host.onclick=e=>{const button=e.target.closest('[data-more-groups]');if(button){const previous=limit;limit+=16;button.remove();host.insertAdjacentHTML('beforeend',groups.slice(previous,limit).map(([label,list])=>fold(label,list,mode,mode==='volume'?[...new Set(list.map(w=>w.a))].slice(0,2).join(' · '):'')).join('')+(groups.length>limit?'<button class="rx-button rx-more" data-more-groups>Show more groups</button>':''));host.querySelectorAll(':scope > details>summary')[previous]?.focus();}};draw();return groups.length;
}
async function worksIndex(){
 const run=researchStart('research-directory research-works'),request=++WORKS_INDEX_RUN,sh=WV.sh;
 const [directory,catalogue]=await Promise.all([gzJ(BLOB+'/v1/works-dir/'+sh+'.json.gz?d='+bust()),getWorkCatalogue(),kinds()]);if(run!==RESEARCH_RUN||request!==WORKS_INDEX_RUN)return;
 const rows=(directory.works||[]).map(w=>catalogueWork(w,catalogue));
 page.innerHTML=`<div class="research-intro"><div><h1>Works</h1><p>Browse works with research records, grouped by author or volume. Edition references follow the library catalogue.</p></div><a class="rx-text-link" href="/the-faith-received/library/">Search the full library</a></div><form class="rx-filters" role="search" onsubmit="return false"><label class="rx-search">Find a work<input id="q" type="search" placeholder="Title, author, or PL / PG / PO volume" value="${esc(WV.q)}"></label><label class="rx-primary-filter">Shelf<select id="wsh">${WSH.map(([k,label])=>`<option value="${k}">${label}</option>`).join('')}</select></label><label>Group works<select id="work-group"><option value="author">By author</option><option value="volume">By volume or edition</option><option value="kind">By kind of work</option></select></label></form><div class="rx-results-line"><p id="dircount" role="status"></p><button class="rx-text-link" id="works-collapse">Collapse all</button></div><p class="rx-note">Open a group to browse its works. PL and PG references use columns; PO follows its recorded tomes.${catalogue.ok?'':' Edition metadata could not load. <button class="rx-text-link" id="catalogue-retry">Retry edition details</button>'}</p><div id="dir" class="rx-fold-list"></div>`;
 researchLayout();$('#wsh').value=sh;$('#work-group').value=WV.g;
 const render=()=>{const ref=RX.seriesRef(WV.q),q=RX.fold(ref?ref.rest:WV.q),tokens=q.split(/\s+/).filter(Boolean);const found=rows.filter(w=>{const actual=RX.seriesRef(w.volume);return (!ref||actual&&actual.series===ref.series&&(ref.volume==null||actual.volume===ref.volume))&&tokens.every(t=>RX.fold([w.t,w.originalTitle,w.a,w.volume].join(' ')).includes(t));});
 const count=mountWorkGroups($('#dir'),found,WV.g,{query:q});$('#dircount').textContent=fmtR(found.length)+' works · '+fmtR(count)+' '+({author:'authors',volume:'volumes',kind:'kinds of work'}[WV.g]);};
 $('#q').oninput=e=>{WV.q=e.target.value;render();};$('#work-group').onchange=e=>{WV.g=e.target.value;render();};$('#works-collapse').onclick=()=>$('#dir').querySelectorAll('details[open]').forEach(d=>d.open=false);$('#wsh').onchange=e=>{WV.sh=e.target.value;localStorage.setItem('fr_wsh',WV.sh);const url=new URL(location.href);url.searchParams.set('sh',WV.sh);history.replaceState(null,'',url);worksIndex().catch(()=>researchError('Works could not load'));};$('#catalogue-retry')?.addEventListener('click',()=>worksIndex());render();
}

/* ── TOPICS index ── */
function topicReviewList(rows,rowHTML){const raw=rows.filter(r=>RX.isRawTopic(r.t));return raw.length?`<details class="rx-historical"><summary>Inspect ${raw.length} extraction labels</summary><p class="rx-note">These labels contain extraction notes and need editorial review. Their source passages remain available here.</p>${raw.map(rowHTML).join('')}</details>`:'';}
let TV={q:"",sort:"n"};
const TOPIC_MAPS=new Map();
function topicShelfMap(sh){if(!RX.shelfMaps[sh])return Promise.resolve({nodes:[]});if(!TOPIC_MAPS.has(sh))TOPIC_MAPS.set(sh,J(BLOB+'/v1/mine/constellations/'+RX.shelfMaps[sh]+'/doctrines.json').catch(error=>{TOPIC_MAPS.delete(sh);throw error;}));return TOPIC_MAPS.get(sh);}
function setTopicShelf(sh){const url=new URL(location.href);if(sh)url.searchParams.set('sh',sh);else url.searchParams.delete('sh');history.replaceState(null,'',url);}

async function topicsIndex(){
  const run=researchStart('research-directory');
  const d=await J(BLOB+"/v1/mine/topic2-all/index.json").catch(()=>null)||await J(BLOB+"/v1/mine/topic2/index.json");
  let shelf=new URLSearchParams(location.search).get('sh')||'';if(!RX.shelves[shelf])shelf='';
  const map=shelf?await topicShelfMap(shelf).catch(()=>null):null;
  if(run!==RESEARCH_RUN)return;if(shelf&&!map){researchError('This shelf’s topics could not load');return;}
  const scoped=shelf?RX.scopedTopics(d.topics,map.nodes||[]):d.topics,rows=scoped.filter(t=>!RX.isRawTopic(t.t));
  const max=Math.max(...rows.map(r=>r.n||1));
  // the classic loci-communes order (owner 2026-08-25 'organize the topics')
  const TCAT=[
    ["God & the Trinity",["God","The Trinity","Trinity","The Holy Spirit","Holy Spirit","The Divine Attributes & their Distinction","Divine Simplicity","The Existence of God","The Eternity of God","Eternity of God","Divine Omnipresence & Immensity","Omnipotence & Absolute Power","God's Knowledge & Middle Knowledge","The Will of God","God's Will","Subsistent Relations & the Divine Persons","The Divine Processions & Eternal Generation","The Filioque & the Procession of the Spirit","Providence","Predestination","Election","Election/Predestination"]],
    ["Scripture & Method",["Scripture","The Word of God","Revelation","Tradition","Prolegomena / Theological Method"]],
    ["Creation & Man",["Creation","Angels","Satan","Man / Anthropology","The Soul","Free Will","Conscience","Sin","Original Sin","Idolatry","Pride","Temptation"]],
    ["Christ & Redemption",["Christ / Christology","The Gospel","Gospel","Redemption","Reconciliation","Sacrifice","Merit","Salvation","Salvation/Eternal Life","Union with Christ"]],
    ["Grace & the Christian Life",["Grace","Faith","Justification","Adoption","Regeneration","Conversion","Conversion/Repentance","Repentance","Penance","Forgiveness","Sanctification","Good Works","Good works","Good Works / Sanctification","Perseverance","Perseverance of the Saints","Assurance","Assurance of Salvation","Effectual Calling","Vocation","Calling","Covenant","Christian Liberty","Apostasy","Despair","Hope","Charity","Patience","Humility","Obedience","Fear of God","Salvation of Infants"]],
    ["Church & Sacraments",["The Church","Ministry","Ordination","Excommunication","Sacraments","The Lord's Sacraments","Baptism","The Lord's Supper"]],
    ["Worship & Morals",["Religion / True Worship","Prayer","Sabbath","The Law","Law","Virtues / Moral Theology","Oaths","Oaths and Vows","Vows","Marriage","Marriage & Divorce","Marriage and Divorce","Divorce","The Civil Magistrate","Persecution"]],
    ["Last Things",["Last Things","Resurrection","Eternal Life","Antichrist"]]];
  const CAT_OF={};TCAT.forEach(([c2,names])=>names.forEach(n2=>CAT_OF[n2]=c2));
  const rowHTML2=(r,i)=>`
      <div class="tr2-row"><a class="tr2" style="--i:${Math.min(i,50)}" href="${RX.topicURL(r.s,shelf)}">
        <span class="nm">${esc(r.t)}</span>
        <span class="sc">${r.na!=null?fmtR(r.na)+" indexed authors · ":""}${r.n!=null?fmtR(r.n)+" pages":"Indexed topic"}${r.m?" · Migne":""}</span>
      </a><a class="tr2-cmp" href="/the-faith-received/compare/#t=${encodeURIComponent(r.s)}" aria-label="Compare authors on ${esc(r.t)}">Compare</a></div>`;
  const render=()=>{
    let list=rows.filter(r=>!TV.q||r.t.toLowerCase().includes(TV.q));
    if(TV.q||TV.sort!=="group"){
      list=TV.sort==="a"?[...list].sort((x,y)=>x.t.localeCompare(y.t)):[...list].sort((x,y)=>(y.n||0)-(x.n||0));
      $("#dir").innerHTML=list.map(rowHTML2).join("")||'<p class="loading">No match.</p>';
    }else{
      const byC={};list.forEach(r=>{(byC[CAT_OF[r.t]||"More"]=byC[CAT_OF[r.t]||"More"]||[]).push(r);});
      const order=[...TCAT.map(x=>x[0]),"More"];
      $("#dir").innerHTML=order.filter(c2=>byC[c2]).map(c2=>
        `<details class="rx-fold rx-topic-group"><summary><span><strong>${esc(c2)}</strong><small>${byC[c2].slice(0,3).map(r=>esc(r.t)).join(' · ')}</small></span><span class="rx-fold-count">${byC[c2].length} topics</span></summary><div class="rx-fold-body">${byC[c2].sort((x,y)=>(y.n||0)-(x.n||0)).map(rowHTML2).join('')}</div></details>`).join("");
    }
    $("#dircount").textContent=list.length;$("#dir").insertAdjacentHTML("beforeend",topicReviewList(scoped.filter(t=>!TV.q||t.t.toLowerCase().includes(TV.q)),rowHTML2));
  };
  if(TV.sort==='n')TV.sort='group';
  page.innerHTML=`<div class="research-intro"><div><h1>Topics</h1><p>Explore a theological question through its sources. Find passages, compare authors, and follow the argument into the text.</p></div><div class="rx-intro-links"><a class="rx-button" href="/the-faith-received/compare/">Compare authors</a><a class="rx-text-link" href="/the-faith-received/web/#topics">Explore topic connections</a></div></div>
  <div class="rx-filters"><label class="rx-search">Find a topic<input type="search" id="q" placeholder="Grace, Trinity, justification" value="${esc(TV.q)}"></label><label class="rx-primary-filter">Shelf<select id="topics-shelf"><option value="">All shelves</option>${Object.entries(RX.shelves).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>Order topics<select id="sort"><option value="group">Theological subjects</option><option value="pages">Most indexed pages</option><option value="a">Name A–Z</option></select></label></div><div class="rx-results-line"><p role="status"><span id="dircount"></span> topics${shelf?' in '+esc(RX.shelves[shelf]):' across all shelves'}</p><button class="rx-text-link" id="topics-collapse">Collapse all</button></div><p class="rx-note">Open a subject to browse its topics. ${shelf?'Counts describe indexed pages on this shelf. <a href="/the-faith-received/web/#shelves='+RX.shelfMaps[shelf]+'/doctrines">Explore this shelf’s full topic map</a>.':'Counts describe the full index; each topic links to its available evidence.'}</p><div class="dir rx-fold-list" id="dir"></div>`;
  researchLayout();$('#topics-shelf').value=shelf;$('#topics-shelf').onchange=e=>{setTopicShelf(e.target.value);topicsIndex().catch(()=>researchError('Topics could not load'));};$('#sort').value=TV.sort;$('#topics-collapse').onclick=()=>$('#dir').querySelectorAll('details[open]').forEach(d=>d.open=false);render();$('#q').oninput=e=>{TV.q=e.target.value.toLowerCase().trim();render();};$('#sort').onchange=e=>{TV.sort=e.target.value;render();};
  $('#q').onkeydown=event=>{if(event.key!=='Enter'||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;const query=RX.fold($('#q').value);if(!query)return;const matches=rows.filter(row=>RX.fold(row.t).includes(query)),exact=matches.filter(row=>RX.fold(row.t)===query);const selected=exact.length===1?exact[0]:matches.length===1?matches[0]:null;if(selected){event.preventDefault();location.assign(RX.topicURL(selected.s,shelf));}};
  // INDEX RERUM — Migne's OWN index to the Latin Fathers (PL 218–221), organized
  // (owner 2026-08-31 "leverage migne for the PL — this is valuable work"): 106 heads,
  // ~30k volume:column refs, ~13k doctrinal CLAIM lines in the Maurists' own words —
  // each claim cited and opening the exact column in the reader.
  const irWrap=document.createElement("details");irWrap.className="rx-historical";irWrap.innerHTML="<summary>Browse the Latin Fathers’ historical index</summary>";const irHost=document.createElement("div");irWrap.appendChild(irHost);if(!shelf||shelf==='pl')page.appendChild(irWrap);   // appended NOW so PL sits above the Greek Ordo
  let _CMAP=null;
  const _cmap=async()=>{if(_CMAP)return _CMAP;
    try{_CMAP=(await gzJ(BLOB+"/v1/pld_colmap.json.gz")).vols||{};}catch(e){_CMAP={};}return _CMAP;};
  const _r2i=r=>{const V={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};let n=0;r=r.toUpperCase();
    for(let i=0;i<r.length;i++){const v=V[r[i]]||0;n+=(V[r[i+1]]||0)>v?-v:v;}return n;};
  const _colHref=(cm,vol,col)=>{const rng=cm[String(vol)];if(!rng)return null;
    for(const [c0,c1,sl] of rng){if(col>=c0&&col<=c1)return "/the-faith-received/read/?w="+sl+"#b"+col+"-0";}
    return null;};
  // "Haymo, CXVIII, 107 , 253 . 273 ." → author + roman volume + a run of column numbers
  // work titles + authors for the index panes (owner 2026-09-10 "have the
  // work with the author so its useful"): the per-corpus directory is the
  // slug -> {title, author} table
  let _WD=null;
  const _wd=async()=>{if(_WD)return _WD;
    try{const d3=await gzJ(BLOB+"/v1/works-dir/pl.json.gz");_WD={};(d3.works||[]).forEach(x2=>{_WD[x2.w]={t:x2.t,a:x2.a};});}
    catch(e){_WD={};}return _WD;};
  // instant column preview: slice the canonical TEI at the column milestone
  // (owner: "make preview available"); one TEI per work, cached, ~1MB
  const _teiCache=new Map();
  async function _pldColText(slug,col){
    const id=String(slug).replace(/^pld-/,"");
    let xml=_teiCache.get(id);
    if(!xml){const r2=await fetch(BLOB+"/v1/tei/pld/"+id+".xml");if(!r2.ok)throw 0;xml=await r2.text();
      _teiCache.set(id,xml);if(_teiCache.size>4)_teiCache.delete(_teiCache.keys().next().value);}
    // columns appear as n="32:1221" or zero-padded n="51:0736A"; a skipped
    // column falls back to the nearest preceding marker (phantom-anchor law)
    let best=null,bestCol=-1;const it=xml.matchAll(/<milestone unit="column" n="\d+:0*(\d+)[A-D]?"[^>]*\/>/g);
    for(const mm of it){const c3=+mm[1];
      if(c3<=col&&c3>bestCol){bestCol=c3;best=mm;}
      if(c3>col&&best)break;}
    if(!best)return null;
    let seg=xml.slice(best.index+best[0].length,best.index+best[0].length+6000);
    const stop=seg.search(new RegExp('<milestone unit="column" n="\\d+:0*(?!'+bestCol+'[A-D]?")\\d'));
    if(stop>0)seg=seg.slice(0,stop);
    seg=seg.replace(/<note[\s\S]*?<\/note>/g," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
    return seg.slice(0,700)||null;
  }
  // one drawer per pane host: a column chip previews IN PLACE; the reader
  // link rides inside the drawer (the owner's preview-first pattern)
  function wireColPreviews(host){
    host.addEventListener("click",async e2=>{
      const b3=e2.target.closest("[data-pvw]");if(!b3)return;
      e2.preventDefault();
      const row=b3.closest(".irw")||b3.parentElement;
      let dr=row.querySelector(".irw-drawer");
      if(!dr){dr=document.createElement("div");dr.className="irw-drawer";row.appendChild(dr);}
      if(dr.dataset.for===b3.dataset.c&&!dr.hidden){dr.hidden=true;return;}
      dr.hidden=false;dr.dataset.for=b3.dataset.c;
      dr.innerHTML='<p class="loading" style="margin:.3rem 0">\u2026</p>';
      try{const tx=await _pldColText(b3.dataset.pvw,+b3.dataset.c);
        dr.innerHTML='<div style="font-size:.86rem;line-height:1.55;border-left:2px solid var(--accent,#b45f3d);padding:.35rem .7rem;margin:.3rem 0;background:var(--highlight,#f5f2ea);border-radius:0 6px 6px 0">'
          +(tx?esc(tx)+"\u2026":"The column text could not be sliced here.")
          +(b3.dataset.h?' <a class="readbtn" style="margin-left:.4rem" href="'+esc(b3.dataset.h)+'">Open at col. '+esc(b3.dataset.c)+' \u2192</a>':"")+'</div>';
      }catch(_){dr.innerHTML='<p class="loading" style="margin:.3rem 0">The column could not load.'+(b3.dataset.h?' <a class="readbtn" href="'+esc(b3.dataset.h)+'">Open in the reader</a>':"")+'</p>';}
    });
  }
  const _linkCols=(txt,cm)=>esc(txt).replace(
    /\b([IVXLCDM]{2,8})[,.]?((?:\s*\d{1,4}\s*[,.])+|\s+\d{1,4}\b)/g,
    (m0,rom,cols)=>{const vol=_r2i(rom);
      if(!vol||vol>221)return m0;
      const linked=cols.replace(/\d{1,4}/g,c=>{const h=_colHref(cm,vol,+c);
        return h?'<a class="readbtn" style="padding:.05rem .15rem" href="'+h+'">'+c+"</a>":c;});
      return rom+(cols.startsWith(",")||cols.startsWith(".")?"":"")+linked;});
  J(BLOB+"/v1/mine/pld_topics.json").then(pi=>{if(run!==RESEARCH_RUN)return;
    const tops=((pi&&pi.topics)||[]).slice().sort((x,y)=>(y.n||0)-(x.n||0));
    if(!tops.length)return;
    const tot=tops.reduce((a2,t2)=>a2+(t2.n||0),0);
    const slugOf=t2=>String(t2||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
    irHost.innerHTML=`<h2 class="sect">Index Rerum · Migne\u2019s own index to the Latin Fathers (PL 218\u2013221) <span class="tn" style="font-family:var(--body);font-size:.74rem;color:var(--faint)">${tops.length} heads \u00b7 ${tot.toLocaleString()} entries</span></h2>
      <div class="chstrip">${tops.map(t2=>`<button class="chp" data-s="${esc(slugOf(t2.t))}" title="${t2.n.toLocaleString()} entries">${esc(t2.t)}<span style="color:var(--faint);margin-left:.3rem;font-size:.7rem">${t2.n.toLocaleString()}</span></button>`).join("")}</div>
      <div id="irBody"></div>`;
    wireColPreviews(irHost);
    irHost.addEventListener("click",async e=>{
      const b2=e.target.closest("[data-s]");if(!b2)return;
      irHost.querySelectorAll(".chp").forEach(x=>x.classList.toggle("on",x===b2));
      const bd=irHost.querySelector("#irBody");
      bd.innerHTML='<p class="loading">\u2026</p>';
      const [d2,_CM,WD]=await Promise.all([
        J(BLOB+"/v1/mine/pld_topic/"+b2.dataset.s+".json").catch(()=>null),_cmap(),_wd()]);
      if(!d2){bd.innerHTML='<p class="loading">Unavailable.</p>';return;}
      const claims=(d2.claims||[]).filter(c2=>c2.q);
      const aus=(d2.authors||[]).slice().sort((x,y)=>(y.n||0)-(x.n||0));
      const secs=(d2.sections||[]).filter(Boolean);
      const rn=n2=>{const R=["","I","II","III","IV","V","VI","VII","VIII","IX","X"];let v2=+n2,o="";
        const T={100:"C",90:"XC",50:"L",40:"XL",10:"X",9:"IX",5:"V",4:"IV",1:"I"};
        for(const k of [100,90,50,40,10,9,5,4,1]){while(v2>=k){o+=T[k];v2-=k;}}return o;};
      bd.innerHTML=`
        ${secs.length?`<div class="volhead" style="margin:.5rem 0 .2rem">Migne\u2019s subsections \u00b7 ${secs.length}</div>
          <div style="margin-bottom:.5rem">${secs.map(x2=>`<div style="font-size:.9rem;padding:.12rem 0;color:var(--fg)">${esc(x2)}</div>`).join("")}</div>`:""}
        ${aus.length?`<div class="volhead" style="margin:.5rem 0 .2rem">The Fathers under this head \u00b7 ${aus.length}</div>
          <div style="margin-bottom:.6rem">${aus.map(a2=>{
            const refs=(a2.refs||[]);
            const byW=new Map();
            refs.forEach(r2=>{const h2=r2.h||_colHref(_CM,r2.v,r2.c);
              const mm=h2&&h2.match(/w=(pld-\d+)/);const sl2=mm?mm[1]:null;
              const k2=sl2||("vol"+r2.v);
              if(!byW.has(k2))byW.set(k2,{sl:sl2,v:r2.v,rows:[]});
              byW.get(k2).rows.push({c:r2.c,h:h2});});
            const wrows=[...byW.values()].map(g2=>{
              const wd2=(g2.sl&&WD[g2.sl])||{};
              const label=wd2.t?wd2.t:(g2.sl?g2.sl:"");
              const cols=g2.rows.map(r2=>g2.sl
                ?`<button type="button" class="readbtn" data-pvw="${esc(g2.sl)}" data-c="${r2.c}" data-h="${esc(r2.h||"")}" style="font-size:.8rem;padding:.1rem .3rem">${r2.c}</button>`
                :(r2.h?`<a class="readbtn" href="${esc(r2.h)}" style="font-size:.8rem;padding:.1rem .3rem">${r2.c}</a>`
                      :`<span style="font-size:.8rem;color:var(--faint);padding:.1rem .3rem">${r2.c}</span>`)).join(" ");
              return `<div class="irw" style="display:flex;flex-wrap:wrap;align-items:baseline;gap:.35rem;padding:.16rem 0">
                <span style="font-size:.86rem;font-weight:600">${esc(label)||("PL "+(rn(g2.v)||g2.v))}</span>
                <span style="color:var(--faint);font-size:.74rem">PL ${rn(g2.v)||g2.v}</span>
                <span style="display:flex;flex-wrap:wrap;gap:.15rem .25rem">${cols}</span></div>`;}).join("");
            return `<details style="padding:.14rem 0;border-bottom:1px solid var(--border)">
              <summary style="cursor:pointer;list-style:none;display:flex;align-items:baseline;gap:.5rem">
                <span class="wk" style="font-size:.9rem;font-weight:600">${esc(a2.a)}</span>
                <span style="color:var(--faint);font-size:.74rem">${a2.n} ${a2.n>1?"entries":"entry"} \u00b7 ${byW.size} work${byW.size>1?"s":""} \u00b7 PL ${[...new Set(refs.map(r2=>rn(r2.v)||r2.v))].slice(0,6).join(", ")}</span>
                <span style="margin-left:auto;color:var(--faint);font-size:.72rem">\u25be works \u00b7 tap a column to preview</span></summary>
              <div style="padding:.3rem 0 .35rem .1rem">${wrows}</div>
            </details>`;}).join("")}</div>`:""}
        ${claims.length?`<div class="volhead" style="margin:.4rem 0 .2rem">Migne\u2019s own judgments \u00b7 ${claims.length}</div>
          <div class="dir">${claims.map((c2,i2)=>`
            <div class="dr" style="--i:${Math.min(i2,40)};cursor:default">
              <span class="dot" style="background:var(--gold)"></span>
              <span class="nm" style="font-size:.93rem">\u201c${_linkCols(c2.q,_CM)}\u201d${c2.a?` <span style="color:var(--faint);font-size:.8rem">\u2014 under ${esc(c2.a)}</span>`:""}</span>
              <span class="meta">${c2.h?`<a class="readbtn" href="${esc(c2.h)}">Open</a>`:""}</span>
            </div>`).join("")}</div>`:""}`;
      bd.scrollIntoView({behavior:"smooth",block:"nearest"});
    });
  }).catch(()=>{});
  // MIGNE'S VOLUME INDICES (owner 2026-09-10 "use all the indices of migne"):
  // every PL volume's OWN back-index (v1/mine/pld_subjects, 1,244 works),
  // titled and authored via the corpus directory, entries previewable
  const viWrap=document.createElement("details");viWrap.className="rx-historical";
  viWrap.innerHTML="<summary>Browse each Latin volume\u2019s own back-index</summary>";
  const viHost=document.createElement("div");viWrap.appendChild(viHost);
  if(!shelf||shelf==='pl')page.appendChild(viWrap);
  let _viLoaded=false;
  viWrap.addEventListener("toggle",async()=>{
    if(!viWrap.open||_viLoaded)return;_viLoaded=true;
    viHost.innerHTML='<p class="loading">\u2026</p>';
    const [si2,WD]=await Promise.all([J(BLOB+"/v1/mine/pld_subjects/index.json").catch(()=>null),_wd()]);
    if(!si2||!(si2.works||[]).length){viHost.innerHTML='<p class="loading">Unavailable.</p>';return;}
    const vworks=(si2.works||[]).map(x2=>({w:x2.w,n:x2.n||0,t:(WD[x2.w]||{}).t||x2.w,a:(WD[x2.w]||{}).a||""}))
      .sort((x2,y2)=>y2.n-x2.n);
    const tot2=vworks.reduce((a3,x2)=>a3+x2.n,0);
    viHost.innerHTML=`<h2 class="sect">Indices per volume \u00b7 printed at the back of each work <span class="tn" style="font-family:var(--body);font-size:.74rem;color:var(--faint)">${vworks.length.toLocaleString()} works \u00b7 ${tot2.toLocaleString()} entries</span></h2>
      <label class="rx-search" style="display:block;margin:.3rem 0 .5rem">Find a work or author<input type="search" id="viQ" placeholder="Augustine, City of God\u2026"></label>
      <div id="viList"></div><div id="viBody"></div>`;
    const list=viHost.querySelector("#viList"),body3=viHost.querySelector("#viBody");
    const paint=q3=>{const f3=String(q3||"").toLowerCase();
      const hits=(f3?vworks.filter(x2=>(x2.t+" "+x2.a).toLowerCase().includes(f3)):vworks).slice(0,40);
      list.innerHTML=hits.map(x2=>`<button type="button" class="chp" data-w="${esc(x2.w)}" style="display:flex;gap:.5rem;align-items:baseline;width:100%;text-align:left">
        <span style="font-weight:600;font-size:.88rem">${esc(x2.t)}</span>
        <span style="color:var(--faint);font-size:.76rem">${esc(x2.a)}</span>
        <span style="margin-left:auto;color:var(--faint);font-size:.74rem">${x2.n.toLocaleString()} entries</span></button>`).join("")
        +(hits.length===40?'<p class="loading" style="font-size:.78rem">Keep typing to narrow the list.</p>':"");};
    paint("");
    viHost.querySelector("#viQ").oninput=e3=>paint(e3.target.value);
    list.addEventListener("click",async e3=>{
      const b4=e3.target.closest("[data-w]");if(!b4)return;
      list.querySelectorAll(".chp").forEach(x2=>x2.classList.toggle("on",x2===b4));
      body3.innerHTML='<p class="loading">\u2026</p>';
      const d4=await J(BLOB+"/v1/mine/pld_subjects/"+b4.dataset.w+".json").catch(()=>null);
      if(!d4){body3.innerHTML='<p class="loading">Unavailable.</p>';return;}
      const wd3=_WD[b4.dataset.w]||{};
      const ents=(d4.entries||[]);
      const paintE=(q4)=>{const f4=String(q4||"").toLowerCase();
        const hits=(f4?ents.filter(x2=>String(x2.t).toLowerCase().includes(f4)):ents).slice(0,300);
        body3.querySelector("#viEnts").innerHTML=hits.map(x2=>`<div class="irw" style="display:flex;flex-wrap:wrap;align-items:baseline;gap:.4rem;padding:.14rem 0;border-bottom:1px dotted var(--border)">
          <span style="font-size:.88rem">${esc(x2.t)}</span>
          <span style="display:flex;gap:.2rem">${(x2.refs||[]).map(r3=>`<button type="button" class="readbtn" data-pvw="${esc(b4.dataset.w)}" data-c="${r3.c}" data-h="${esc(r3.h||"")}" style="font-size:.78rem;padding:.08rem .3rem">${r3.c}</button>`).join(" ")}</span></div>`).join("");};
      body3.innerHTML=`<div class="volhead" style="margin:.5rem 0 .2rem">${esc(wd3.t||b4.dataset.w)} \u2014 ${esc(wd3.a||"")} \u00b7 ${ents.length.toLocaleString()} entries \u00b7 tap a column to preview</div>
        <label class="rx-search" style="display:block;margin:.2rem 0 .4rem">Search this index<input type="search" id="viEQ" placeholder="grace, baptism\u2026"></label>
        <div id="viEnts"></div>`;
      paintE("");
      body3.querySelector("#viEQ").oninput=e4=>paintE(e4.target.value);
      body3.scrollIntoView({behavior:"smooth",block:"nearest"});
    });
    wireColPreviews(body3);
  });
  // ORDO RERUM — Migne's own subject index to the Greek Fathers, entry by entry
  // (harvested from the family site 2026-08-28; refs open the exact column)
  J(BLOB+"/v1/mine/pg_subject/index.json").then(si=>{if(run!==RESEARCH_RUN)return;
    if(!si||!si.letters||!si.letters.length)return;
    const host=document.createElement("div");
    host.innerHTML=`<h2 class="sect">Ordo Rerum · Migne\u2019s subject index to the Greek Fathers <span class="tn" style="font-family:var(--body);font-size:.74rem;color:var(--faint)">${si.letters.reduce((a2,l)=>a2+(l.n||0),0).toLocaleString()} entries</span></h2>
      <div class="chstrip">${si.letters.map(l=>`<button class="chp" data-l="${esc(l.s)}">${esc(l.l)}</button>`).join("")}</div>
      <div id="orBody"></div>`;
    const wrap=document.createElement("details");wrap.className="rx-historical";wrap.innerHTML="<summary>Browse the Greek Fathers’ historical index</summary>";wrap.appendChild(host);if(!shelf||shelf==='gf')page.appendChild(wrap);
    host.addEventListener("click",async e=>{
      const b2=e.target.closest("[data-l]");if(!b2)return;
      host.querySelectorAll(".chp").forEach(x=>x.classList.toggle("on",x===b2));
      const bd=host.querySelector("#orBody");
      bd.innerHTML='<p class="loading">\u2026</p>';
      const d2=await J(BLOB+"/v1/mine/pg_subject/"+b2.dataset.l+".json").catch(()=>null);
      if(!d2){bd.innerHTML='<p class="loading">Unavailable.</p>';return;}
      bd.innerHTML=d2.entries.map(en=>`<div class="x"><b>${esc(en.s)}</b>${en.se.map(se2=>` <span style="color:var(--muted)">${esc(se2.t&&se2.t!==en.s?se2.t:"")}</span> ${se2.refs.map(r2=>`<a href="/the-faith-received/read/?w=${esc(r2.w)}#b${r2.c}-0" style="white-space:nowrap">${esc(r2.pg)}</a>`).join(" \u00b7 ")}`).join("<br>")}</div>`).join("");
    });
  }).catch(()=>{});
}

/* Author Positions: local statement labels never establish an author's own view. */
function positionRows(rows){
 const seen=new Set();return (rows||[]).filter(r=>{if(!r.w||!r.q)return false;const key=JSON.stringify([r.w,RX.page(r.p),r.q]);if(seen.has(key))return false;seen.add(key);return true;});
}
function positionMatches(row,{work='',phrase='',annotation=''}={}){
 return (!work||row.w===work)&&(!annotation||row.s===annotation)&&(!phrase||RX.fold((row.q||'')+' '+(row.g||'')+' '+(row.wt||'')).includes(RX.fold(phrase)));
}
function positionAuthor(authors,name,slug,shelf){
 const exact=(authors||[]).filter(a=>a.a===name&&a.s===slug&&(a.sh===shelf||(a.shelves||[]).includes(shelf)));
 return exact.length===1&&exact[0].id?exact[0]:null;
}
function positionPage(state,result,contract,author){
 if(result.snapshot_id!==contract.snapshot||result.filters?.author_id!==author.id||!Array.isArray(result.items))throw new Error('Evidence selection changed');
 if(result.has_more&&(!result.next_cursor||result.next_cursor===state.cursor))throw new Error('Evidence page did not advance');
 const selection=state.started?state.selection:(state.rows||[]),indexedRows=[...(state.indexedRows||[])],seen=new Set(indexedRows.map(r=>r.id||JSON.stringify([r.w,RX.page(r.p),r.q])));
 for(const r of result.items){const key=r.id||JSON.stringify([r.w,RX.page(r.p),r.q]);if(!seen.has(key)){seen.add(key);indexedRows.push(r);}}
 const rows=positionRows([...indexedRows.map(r=>({...r,indexed:true})),...selection.map(r=>({...r,indexed:false}))]);
 return {...state,selection,indexedRows,rows,started:true,cursor:result.next_cursor||null,done:!result.has_more};
}

/* ── room / dossier ── */
/* loci-communes headings and stances (shared by positions and the comparison desk) */
const STANCES=[["asserts","Asserts"],["denies","Denies"],["reports","Reports"],["",""]];
/* stance colours follow the reception howbar (approves green, refutes red) so semantic colour stays one small vocabulary */
const STANCE_C={asserts:'#3F6B4E',denies:'#A8462B',reports:'#8a7f72',other:'var(--border)'};
const stanceTally=rows=>{const t={asserts:0,denies:0,reports:0,other:0,n:0};(rows||[]).forEach(r=>{if(!r||!r.q)return;t[STANCE_C[r.s]&&r.s!=='other'?r.s:'other']++;t.n++;});return t;};
const stanceBar=(t,label)=>{if(!t||!t.n)return '<span class="cd-sbar cd-sbar-empty" aria-hidden="true"></span>';
  return `<span class="cd-sbar" title="${esc(label?label+': ':'')}asserts ${t.asserts} · denies ${t.denies} · reports ${t.reports}${t.other?' · qualifies or other '+t.other:''}">${['asserts','denies','reports','other'].filter(k=>t[k]).map(k=>`<i style="flex:${t[k]} 1 1px;background:${STANCE_C[k]}"></i>`).join('')}</span>`;};
  const LOCI_HEADS=[["Prolegomena & Scripture",["Prolegomena / Theological Method","Scripture","Religion / True Worship"]],
  ["God & the Trinity",["God","The Existence of God","The Divine Attributes & their Distinction","Divine Simplicity","The Eternity of God","Divine Omnipresence & Immensity","Omnipotence & Absolute Power","God's Knowledge & Middle Knowledge","The Will of God","The Trinity","Subsistent Relations & the Divine Persons","The Divine Processions & Eternal Generation","The Filioque & the Procession of the Spirit"]],
  ["Creation, Providence & Man",["Creation","Angels","Providence","Man / Anthropology","Free Will"]],
  ["Sin",["Sin"]],
  ["Christ & the Holy Spirit",["Christ / Christology","The Holy Spirit"]],
  ["Grace & Salvation",["Grace","Predestination","Covenant","The Law","The Gospel","Faith","Justification","Sanctification","Virtues / Moral Theology","Christian Liberty","Prayer"]],
  ["The Church & the Sacraments",["The Church","Sacraments","Baptism","The Lord's Supper","The Civil Magistrate"]],
  ["Last Things",["Last Things","Resurrection","Eternal Life"]]];
const LOCUS_HEAD={};LOCI_HEADS.forEach(([h,ls],i)=>ls.forEach((l,j)=>{LOCUS_HEAD[RX.fold(l)]=[i,j];}));
/* TOPIC CANON (owner 2026-09-10, Thomas and Bonaventure: "fix"): rooms carry a long tail of extraction labels —
   variants of a locus ("Divine Omnipotence & Absolute Power", "Election/Predestination", "The Fall / Original Sin")
   and small labels outside the loci. A variant folds into its locus by rule (strip "The/Divine/God's", match the
   label or one of its "/" parts against the loci), then by a short alias table built from the labels actually seen
   across 84 rooms (624 distinct). Anything else keeps its own label and sits under "Other labels". Deterministic,
   no model; a merged row names what it includes. */
const TOPIC_STRIP=v=>RX.fold(v).replace(/^(?:the|divine|god's|gods|holy)\s+/,'').replace(/\s+/g,' ').trim();
const CANON_LOCI=(()=>{const m=new Map();LOCI_HEADS.forEach(([h,ls])=>ls.forEach(l=>{m.set(RX.fold(l),l);m.set(TOPIC_STRIP(l),l);l.split('/').map(TOPIC_STRIP).filter(p=>p.length>3).forEach(p=>{if(!m.has(p))m.set(p,l);});}));return m;})();
const TOPIC_ALIAS=(()=>{const m=new Map();const add=(to,...from)=>from.forEach(f=>m.set(RX.fold(f),to));
  add('Predestination','Election','Reprobation','The Elect','The Book of Life / The Elect','Election & Reprobation');
  add('Sin','Original Sin','The Fall','The Fall / Original Sin','Concupiscence','Actual Sin');
  add('Virtues / Moral Theology','Charity','Love','Charity / Love','Love / Charity','Charity / Love of Neighbor','Hope','Humility','Patience','Obedience','Theological Virtues','Theology / Theological Virtues','Virtue','Virtues','Vices','Pride','Virtues / Moral Moral Theology');
  add('Christ / Christology','Incarnation','The Incarnation','Christ','The Word','The Word / Logos','The Body of Christ','The Cross');
  add('Angels','The Devil','Satan','Demons','The Devil / Angels');
  add('Man / Anthropology','The Soul','The Soul / Man','The Soul / Intellect','The Soul / Intellect and Will','The Body','The Will','Reason','Reason / Intellect','Intellect','The Intellect','Human Reason','Memory','The Image of God');
  add('The Divine Attributes & their Distinction','Divine Justice','Justice of God','Divine Justice & Mercy','Divine Goodness',"God's Goodness",'Divine Mercy',"God's Mercy",'Divine Wisdom',"God's Wisdom",'Divine Love','The Divine Attributes & its Distinction');
  add('The Eternity of God','Eternity');add('The Will of God',"God's Will",'Divine Will','Will of God');
  add('Providence','Theodicy / Problem of Evil','The Problem of Evil','Theodicy','Divine Providence');
  add("The Lord's Supper",'The Eucharist','Eucharist','The Mass','Sacrifice of the Mass','Transubstantiation');
  add('Sacraments','Holy Orders','Sacrament of Holy Orders','Confirmation','Extreme Unction','Anointing of the Sick');
  add('The Church','Ordination','Ministry','The Office of the Ministry','Ministry / Orders','Ministry / Holy Orders','Excommunication','Schism','Heresy','Preaching','Clergy','Episcopate','Priesthood');
  add('Repentance','Penance','Penance / Satisfaction','Penance / Sacraments','Penance / Sacrament of Penance','Sacrament of Penance','Confession','Confession (as Sacrament)','Contrition','Satisfaction','Absolution','Repentance/Penance','Repentance/Conversion','Repentance/Contrition');
  add('Good Works','Merit','Merits','Merit / Rewards','Merit and Reward','Merit / Demerit','Works','Good Works / Merit','Good works necessity');
  add('Salvation','Salvation history','Salvation-related topics','Salvation / Redemption');
  add('Oaths','Oath','Oaths and Vows','Oaths and Perjury','Vows');
  add('Eternal Life','Beatitude','Beatitude / Eternal Life','Beatitude / Happiness','The Beatific Vision','Heaven','Glory / Eternal Life');
  add('Last Things','Hell','Purgatory','Judgment','Universal and final judgment','Death');
  add('Prayer',"The Lord's Prayer","Lord's Prayer");add('Religion / True Worship','Idolatry','Sabbath');
  add('Perseverance','Perseverance of the Saints');add('Assurance','Assurance of Salvation');add('Calling','Effectual Calling');
  add('Marriage','Marriage and Divorce','Marriage & Celibacy','Marriage and Family','Matrimony','Divorce','Marriage/Sacraments');
  add('The Law','Natural Law','The Decalogue');
  add('Prolegomena / Theological Method','Theology','Theology / Prolegomena','Theology / Theological Method','Theological Method');
  return m;})();
function topicCanon(label){const f=RX.fold(label);const done=l=>({label:l,key:RX.fold(l)});
  if(CANON_LOCI.has(f))return done(CANON_LOCI.get(f));if(TOPIC_ALIAS.has(f))return done(TOPIC_ALIAS.get(f));
  const st=TOPIC_STRIP(label);if(CANON_LOCI.has(st))return done(CANON_LOCI.get(st));if(TOPIC_ALIAS.has(st))return done(TOPIC_ALIAS.get(st));
  const parts=f.split(/\s*\/\s*/).filter(Boolean);
  if(parts.length>1){const loci=new Set(),regs=new Set();parts.forEach(p=>{const q=TOPIC_STRIP(p);const l=CANON_LOCI.get(p)||CANON_LOCI.get(q)||TOPIC_ALIAS.get(p)||TOPIC_ALIAS.get(q);if(l){(LOCUS_HEAD[RX.fold(l)]?loci:regs).add(l);return;}const r=__TREG.get(p)||__TREG.get(q);if(r)regs.add(r.t);});
    if(loci.size===1)return done([...loci][0]);if(!loci.size&&regs.size===1)return done([...regs][0]);}
  if(__TREG.has(f))return done(__TREG.get(f).t);
  return done(label);}
/* ROOM TOPIC CANON: a room's topic entries merged by canon (pos deduped, counts summed, byw merged); `parts`
   keep every original label and file name so the full topic files behind a merged entry still load. */
function canonRoomTopics(list){const out=new Map(),order=[];
  (list||[]).forEach(t=>{if(!t||!t.t)return;const c=topicCanon(t.t),key=c.key,canonical=RX.fold(t.t)===key;
    if(!out.has(key)){out.set(key,{...t,t:c.label,key,parts:[],via:[],pos:[],pages:[],byw:new Map(),n:0,np:0,npos:0,nm:0,full:false,npos_via:0,migne:null});order.push(key);}
    const m=out.get(key);m.parts.push({t:t.t,full:!!t.full,tslug:tslugOf(t.t),canonical});if(!canonical){m.via.push(t.t);m.npos_via+=t.npos||0;}
    m.pos=m.pos.concat(t.pos||[]);m.pages=m.pages.concat(t.pages||[]);m.n+=t.n||0;m.np+=t.np||0;m.npos+=t.npos||0;m.nm+=t.nm||0;m.full=m.full||!!t.full;
    (t.byw||[]).forEach(x=>{const cur=m.byw.get(x[0]);if(cur)cur[2]=(cur[2]||0)+(x[2]||0);else m.byw.set(x[0],[x[0],x[1],x[2]||0]);});
    if(t.migne&&(canonical||!m.migne))m.migne=t.migne;});
  return order.map(k=>{const m=out.get(k);m.pos=positionRows(m.pos);const seen=new Set();m.pages=m.pages.filter(r=>{const pk=r.w+'|'+RX.page(r.p);if(seen.has(pk))return false;seen.add(pk);return true;});m.byw=[...m.byw.values()].sort((a,b)=>b[2]-a[2]).slice(0,30);if(!m.migne)delete m.migne;return m;});}
/* every full topic file behind a (merged) room topic, as one {pos,pages,migne}; null when none exists */
async function roomTopicFull(sh,slug,t){const parts=(t.parts||[{t:t.t,full:!!t.full,tslug:tslugOf(t.t)}]).filter(p=>p.full);if(!parts.length)return null;
  const files=(await Promise.all(parts.map(p=>cdFile(sh,slug,p.tslug)))).filter(Boolean);if(!files.length)return null;
  return {...files[0],pos:positionRows(files.flatMap(f=>f.pos||[])),pages:files.flatMap(f=>f.pages||[]),migne:files.flatMap(f=>f.migne||[])};}
/* INSIDE A WORK (owner 2026-09-10 "even here … it's not collapsible … by work"): a long work fold folds again by
   the work's own sections (meta.json `structure`, page starts), first section open; page-range chunks of 25 until
   the outline arrives or when there is none. The outline fetch is lazy and cached; when it lands, surfaces that
   listen for fr-sections-ready redraw. */
const META={};const metaOf=slug=>{if(!slug)return null;if(!(slug in META)){META[slug]=null;J(BLOB+`/v1/works/${encodeURIComponent(slug)}/meta.json`).then(m=>{META[slug]=m||false;if(document.querySelector(`[data-secbody="${CSS.escape(slug)}"]`))dispatchEvent(new CustomEvent('fr-sections-ready',{detail:{slug}}));}).catch(()=>{META[slug]=false;});}return META[slug]||null;};
function sectionFoldsHTML(rows,render,w,o={}){
  if(rows.length<=(o.min||12))return rows.map(render).join('');
  const meta=metaOf(w);const pageOf=r=>RX.page(r.p);const sorted=rows.slice().sort((a,b)=>(pageOf(a)??0)-(pageOf(b)??0));
  let groups=null;
  if(meta&&Array.isArray(meta.structure)){const st=meta.structure.filter(e=>e&&Number.isFinite(+e.page)&&e.title).map(e=>({t:String(e.title).replace(/\s+/g,' ').trim().slice(0,90),p:+e.page,d:+e.depth||1})).sort((a,b)=>a.p-b.p||a.d-b.d);
    if(st.length>1){const secOf=p=>{let hit=null;for(const e of st){if(e.p<=p)hit=e;else break;}return hit;};const g=new Map();sorted.forEach(r=>{const p=pageOf(r);const e=p==null?null:secOf(p);const k=e?e.p+'|'+e.t:'~';if(!g.has(k))g.set(k,{label:e?e.t:'Before the first section',rows:[]});g.get(k).rows.push(r);});if(g.size>1)groups=[...g.values()];}}
  if(!groups){const CH=25;groups=[];for(let i=0;i<sorted.length;i+=CH){const part=sorted.slice(i,i+CH),a=pageOf(part[0]),b=pageOf(part[part.length-1]);groups.push({label:(a!=null?pgl(w)+' '+a+(b!=null&&b!==a?'–'+b:''):'Statements '+(i+1)+'–'+(i+part.length)),rows:part});}}
  return `<div data-secbody="${esc(w)}">${groups.map((g,i)=>`<details class="cd-sec"${i===0?' open':''}><summary><span>${esc(g.label)}</span><small class="cd-n">${fmtR(g.rows.length)}</small></summary>${g.rows.map(render).join('')}</details>`).join('')}</div>`;}
/* BY WORK, COLLAPSED (owner 2026-09-10 "make everything collapsed and organized by work"): statements of any
   surface grouped under their work in folds, the largest work open; the one renderer behind statementPane */
function workFoldsHTML(rows,o={}){const g=new Map();rows.forEach(r=>{const w=r.w||'';if(!g.has(w))g.set(w,[]);g.get(w).push(r);});
  const groups=[...g.entries()].sort((x,y)=>y[1].length-x[1].length||String(x[0]).localeCompare(String(y[0])));
  const render=o.render||(r=>statementHTML(r,o));
  return groups.map(([w,rs],i)=>{const first=rs[0],title=o.title?o.title(first):(first.wt||first.t||w||'Source work'),sub=o.sub?o.sub(first):'';
    return `<details class="cd-work"${i===0||o.openAll?' open':''}><summary><span><strong>${esc(title)}</strong>${sub?` <small>${esc(sub)}</small>`:''}</span><small class="cd-n">${fmtR(rs.length)}</small>${w?` <a class="rx-text-link cd-read" href="${readerHref(w)}" onclick="event.stopPropagation()">open the work</a>${workSaveBtn(w,title,o.author||first.a||'')}`:''}</summary><div class="cd-fold-body">${sectionFoldsHTML(rs,render,w)}</div></details>`;}).join('');}
async function room(slug,arg){
  const run=researchStart('research-room');
  const hint=new URLSearchParams(location.search).get('sh')||'';
  const roster=await getRoster();if(run!==RESEARCH_RUN)return;
  const candidates=roster.rows.filter(r=>r.s===slug).sort((a,b)=>(b.sh===hint)-(a.sh===hint)||(b.w||0)-(a.w||0));
  let d=null,RSH=candidates[0]?.sh||hint||'pl';
  for(const r of candidates.length?candidates:[{sh:RSH}]){d=await J(BLOB+`/v1/bible/${r.sh}/rooms/${slug}.json`).catch(()=>null);if(d){RSH=r.sh;break;}}
  if(run!==RESEARCH_RUN)return;if(!d){researchError('This author could not load');return;}
  let roomViewRun=0;
  const topics=canonRoomTopics(d.topics).sort((a,b)=>(b.np||0)-(a.np||0));   // variants folded into their locus (topicCanon)
  // arg: undefined|"w" → works · "t" → topic index · "s[/book[/ch]]" → scripture · else topic detail
  let VIEW="w",selT=null,selBook=null,selCh=0;
  if(arg==="positions"||arg?.startsWith("positions/"))VIEW="p";
  else if(arg==="connections")VIEW="c";
  else if(arg==="t")VIEW="t";
  else if(arg==="reception")VIEW="rc";
  else if(arg==="x")VIEW="x";
  else if(arg==="s")VIEW="s";
  else if(arg&&arg.startsWith("s/")){VIEW="s";const p2=arg.slice(2).split("/");selBook=p2[0]||null;selCh=+p2[1]||0;}
  else if(arg&&arg!=="w"&&(topics.find(t=>t.t===arg)||topics.find(t=>t.key===topicCanon(arg).key))){VIEW="q";selT=(topics.find(t=>t.t===arg)||topics.find(t=>t.key===topicCanon(arg).key)).t;}
  page.innerHTML=`
  <div class="crumbs"><a href="/the-faith-received/authors/">Authors</a> · <a href="/the-faith-received/authors/?sh=${encodeURIComponent(RSH)}">${esc(RX.shelves[RSH])}</a></div>
  <div class="ridbar">
    <h1>${esc(aName(d.a))}</h1>
    ${d.dates?`<div class="deck">${esc(d.dates)}${d.affiliation?" · "+esc(d.affiliation):""}</div>`:""}
    <div class="stats"><b>${d.n_works}</b> works · <b>${d.n_pages.toLocaleString()}</b> pages ·
      <b>${d.n_cit.toLocaleString()}</b> Scripture citations
      · ${esc(RX.shelves[RSH])} · <a href="/the-faith-received/web/#a=${encodeURIComponent(slug)}">Explore citation map</a> · <a href="${cdURL({a:[slug],sel:'',g:'work',s:'',q:''})}">Compare with other authors</a></div>
  </div>
  ${candidates.length>1?`<p class="rx-note">Available shelves: ${candidates.map(r=>`<a href="${RX.authorURL(r)}"${r.sh===RSH?' aria-current="page"':''}>${esc(RX.shelves[r.sh])}</a>`).join(" · ")}</p>`:""}
  ${d.bio?`<details class="rx-author-bio"><summary>Read about ${esc(d.a)}</summary><p>${esc(d.bio)}</p></details>`:""}
  <div class="rgrid">
    <aside class="rail"><details id="room-topic-drawer"><summary>Browse this author’s topics</summary><div><h2 class="railhead">Topics</h2><label class="rx-search">Find a topic<input class="tsearch" id="tsearch" type="search" placeholder="Search topics"></label><p class="rx-note">Indexed pages per topic</p><div class="topiclist" id="topiclist"></div></div></details></aside>
    <section class="pane">
      <div class="pseg" role="tablist">
        <button id="segw" role="tab">Works · ${d.n_works}</button>
        <button id="segp" role="tab">Positions</button>
        <button id="segs" role="tab">Scripture</button>
        <button id="segt" role="tab">Topics · ${topics.filter(t=>!RX.isRawTopic(t.t)).length}</button>
        <button id="segr" role="tab">Reception</button>
        <button id="segc" role="tab">Connections</button>
        <button id="segx" role="tab">Search</button>
      </div>
      <div class="pbody" id="pbody" role="tabpanel"></div>
    </section>
  </div>`;
  researchLayout();const pbody=$("#pbody");
  const segs={p:$("#segp"),c:$("#segc"),w:$("#segw"),s:$("#segs"),t:$("#segt"),r:$("#segr"),x:$("#segx")};
  const segOn=k=>{++roomViewRun;for(const s2 in segs){segs[s2].classList.toggle("on",s2===k);segs[s2].setAttribute('aria-selected',String(s2===k));segs[s2].setAttribute('aria-controls','pbody');}pbody.setAttribute('aria-labelledby',segs[k].id);};
  const drawer=$('#room-topic-drawer'),wide=matchMedia('(min-width:641px)');drawer.open=false;wide.addEventListener('change',e=>{if(drawer.isConnected)drawer.open=false;},{signal:researchEvents.signal});
  // reception badge: tiny index, daily-busted; no data → the seg hides itself
  J(BLOB+"/v1/reception/index.json?d="+bust()).catch(()=>({}))
    .then(ix=>{const t=ix&&ix[slug];if(!t)segs.r.style.display="none";
      else segs.r.textContent="Reception · "+(t[0]+t[1]).toLocaleString();});
  const setHash=h=>{const params=new URLSearchParams({sh:RSH});const scope=new URLSearchParams(location.search).get('work');if(h?.startsWith('positions')&&scope)params.set('work',scope);if(h?.startsWith('positions')&&positionCompare?.s)params.set('cmp',positionCompare.s);const url=location.pathname+'?'+params+'#'+slug+(h?'/'+h:'');if(location.pathname+location.search+location.hash!==url)history.pushState(null,'',url);};
  const starSel=t=>{tlist?.querySelectorAll('button').forEach(b=>{b.classList.toggle('on',b.dataset.t===t);b.setAttribute('aria-pressed',String(b.dataset.t===t));});};
  // rail topic list — every topic, filterable
  const tlist=$("#topiclist");
  const drawTlist=q2=>{const ql=(q2||"").toLowerCase();
    const hits=topics.filter(t=>!ql||t.t.toLowerCase().includes(ql)),row=t=>`<button data-t="${esc(t.t)}"${t.t===selT?' class="on"':""}>${esc(t.t)}<span class="n">${fmtR(t.np??t.n)}</span></button>`;
    tlist.innerHTML=hits.filter(t=>!RX.isRawTopic(t.t)).map(row).join('')+topicReviewList(hits,row);};
  drawTlist();
  $("#tsearch").addEventListener("input",e=>drawTlist(e.target.value));
  tlist.addEventListener("click",e=>{const bt=e.target.closest("button[data-t]");if(!bt)return;
    const t=topics.find(x=>x.t===bt.dataset.t);if(t){renderTopic(t);if(matchMedia("(max-width:640px)").matches)$("#room-topic-drawer").open=false;}});
  // ---- Works (the landing view): grouped by KIND, commentaries in canon order ----
  async function renderWorks(){
    VIEW='w';segOn('w');starSel(null);const token=roomViewRun;const [catalogue]=await Promise.all([getWorkCatalogue(),kinds()]);if(token!==roomViewRun||run!==RESEARCH_RUN)return;
    let limit=40;const works=(d.works||[]).map(w=>catalogueWork({...w,a:d.a},catalogue)),groups=[...new Set(works.map(w=>kindOf(w.w)||'treatises'))];
    pbody.innerHTML=`<div class="view"><h2>Works</h2><p class="pane-meta">${fmtR(works.length)} works in this shelf. Open a work to begin reading.</p><div class="rx-filters"><label class="rx-search">Find a work<input id="room-work-q" type="search" placeholder="Search titles"></label><label>Kind of work<select id="room-work-kind"><option value="">All kinds</option>${groups.map(k=>`<option value="${esc(k)}">${esc(KNAME[k]||k)}</option>`).join('')}</select></label><label>Order works<select id="room-work-order"><option value="library">Library order</option><option value="name">Title A–Z</option></select></label></div><p id="room-work-count" class="rx-note" role="status"></p><div id="room-works" class="rx-work-list"></div><button id="room-works-more" class="rx-button rx-more">Show more works</button></div>`;
    researchLayout();const draw=()=>{const q=RX.fold($('#room-work-q').value),kind=$('#room-work-kind').value;const rows=works.filter(w=>(!q||RX.fold(w.t+' '+w.volume).includes(q))&&(!kind||(kindOf(w.w)||'treatises')===kind));
    const vn=v=>+(String(v||'').match(/\d+/)||[9999])[0];rows.sort((a,b)=>a.t===b.t&&(a.volume||b.volume)?RX.workOrder(a,b):$('#room-work-order').value==='name'?a.t.localeCompare(b.t):(KORD.indexOf(kindOf(a.w)||'treatises')<0?999:KORD.indexOf(kindOf(a.w)||'treatises'))-(KORD.indexOf(kindOf(b.w)||'treatises')<0?999:KORD.indexOf(kindOf(b.w)||'treatises'))||(kordOf(a.w)||9999)-(kordOf(b.w)||9999)||(b.nc||0)-(a.nc||0));
    $('#room-work-count').textContent=fmtR(rows.length)+' matching works'+(rows.length>limit?' · showing '+limit:'');$('#room-works-more').hidden=limit>=rows.length;
    $('#room-works').innerHTML=rows.slice(0,limit).map(workRowHTML).join('')||'<p class="rx-note">No matching works. Try another title or kind.</p>';};$('#room-work-q').oninput=()=>{limit=40;draw();};$('#room-work-kind').onchange=()=>{limit=40;draw();};$('#room-work-order').onchange=()=>{limit=40;draw();};$('#room-works-more').onclick=()=>{limit+=40;draw();};draw();setHash('');
  }
  // ---- Positions: topic groups retain coverage even before all indexed rows load. ----
  const positionState=new Map(),positionOpen=new Set(),positionLimits=new Map();
  let positionIndex=null,positionTopicLimit=20,positionTopic='',positionPhrase='',positionAnnotation='',positionWork=new URLSearchParams(location.search).get('work')||'';
  const roomWorks=new Map((d.works||[]).map(w=>[w.w,w]));
  const workResearchHref=w=>'/the-faith-received/read/?w='+encodeURIComponent(w)+'&research=work';
  const positionRoute=t=>'positions'+(t?'/'+encodeURIComponent(t):'');
  const setPositionWork=()=>{const u=new URL(location.href);if(positionWork)u.searchParams.set('work',positionWork);else u.searchParams.delete('work');history.replaceState(null,'',u.pathname+u.search+u.hash);};
  const positionAvailable=t=>positionState.get(t.t)?.rows||positionRows(t.pos);
  async function loadPositionTopic(t){
    const state=positionState.get(t.t)||{rows:positionRows(t.pos)};if(state.loading||state.ready)return;
    state.loading=true;state.error=false;positionState.set(t.t,state);refreshPositions();
    try{
      if(!positionIndex)positionIndex=await J(BLOB+'/v1/mine/topic2-all/index.json').catch(()=>null);
      const indexMissing=!positionIndex;
      const item=(positionIndex?.topics||[]).find(x=>RX.fold(x.t)===RX.fold(t.t));
      const tslug=t.t.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50);
      const [full,global]=await Promise.all([roomTopicFull(RSH,slug,t),item?J(BLOB+`/v1/mine/topic2-all/${item.s}.json`).catch(()=>null):null]);
      if(run!==RESEARCH_RUN)return;
      if(full){const seen=new Set(),merged=positionRows(full.pos);merged.forEach(r=>seen.add(JSON.stringify([r.w,RX.page(r.p),r.q])));positionRows(t.pos).forEach(r=>{const k=JSON.stringify([r.w,RX.page(r.p),r.q]);if(!seen.has(k)){seen.add(k);merged.push(r);}});state.rows=merged;}state.fullMissing=!!t.full&&!full;
      state.global=item;state.author=positionAuthor(global?.authors,d.a,slug,RSH);state.contract=state.author&&global?.evidence||null;
      state.ready=!indexMissing&&(!!global||!item);state.error=indexMissing||!!item&&!global;
    }catch(_){state.error=true;}finally{state.loading=false;if(run===RESEARCH_RUN)refreshPositions();}
  }
  async function loadIndexedPositions(t){
    let state=positionState.get(t.t);if(!state?.contract||state.loading||state.done||state.halted)return;
    state.loading=true;state.error=false;refreshPositions();
    try{
      const params=new URLSearchParams({snapshot:state.contract.snapshot,topic:state.contract.topic,author:state.author.id,limit:'50'});if(state.cursor)params.set('cursor',state.cursor);
      const response=await fetch('https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/evidence?'+params,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw new Error('Evidence unavailable');
      const result=await response.json();if(run!==RESEARCH_RUN)return;
      state=positionPage(state,result,state.contract,state.author);positionState.set(t.t,state);
    }catch(_){if(run!==RESEARCH_RUN)return;state.error=true;state.failures=(state.failures||0)+1;if(state.failures>=2)state.halted=true;}finally{state.loading=false;if(run===RESEARCH_RUN)refreshPositions();}
  }
  let drawPositions=null;
  function refreshPositions(){if(VIEW==='p'&&run===RESEARCH_RUN&&drawPositions)drawPositions();}
  // ---- Positions (owner 2026-09-09 "I don't want to click every time to load, group them,
  //      make them scrollable, organize nicely, make it easier to compare authors"):
  //   * every topic is on the page under LOCI-COMMUNES headings (the classic order of the loci),
  //     with a jump bar; nothing is paginated away
  //   * a topic's selected statements are there at once; opening it fetches the full topic file
  //     and the first page of the complete index by itself; a sentinel at the foot of the topic
  //     pulls the next page as you scroll — no buttons
  //   * statements sit under their stance (asserts / denies / reports / other)
  //   * "Compare with…" puts a second author's statements beside each topic (their room + topic file)
  let positionCompare=null,TSLUG=new Map();   // {s,a,sh,room,state:Map(topic→rows)} — the second author beside each topic
  const positionFolds=new Map();   // topic key|column → open fold keys
  let positionGroup='work';  // 'work' | 'stance' — how statements are grouped inside a topic (owner 2026-09-10: by work, collapsed, everywhere)
  async function loadCompareTopic(t){
    if(!positionCompare||positionCompare.state.has(t.t))return;
    const other=positionCompare,ot=(other.topics||[]).find(x=>x.key===t.key);other.state.set(t.t,{rows:positionRows(ot?.pos||[]),loading:true});refreshPositions();
    const full=ot?await roomTopicFull(other.sh,other.s,ot):null;
    if(run!==RESEARCH_RUN||positionCompare!==other)return;
    other.state.set(t.t,{rows:positionRows(full?.pos||ot?.pos||[]),total:ot?.npos||0,loading:false});refreshPositions();
  }
  async function setCompare(row){
    if(!row){positionCompare=null;drawPositions();if(VIEW==='p')setHash(positionRoute(positionTopic));return;}
    const room=await J(BLOB+`/v1/bible/${row.sh}/rooms/${row.s}.json`).catch(()=>null);if(run!==RESEARCH_RUN)return;
    if(!room){positionCompare=null;drawPositions();return;}
    positionCompare={s:row.s,a:room.a,sh:row.sh,room,topics:canonRoomTopics(room.topics),works:new Map((room.works||[]).map(w=>[w.w,w])),state:new Map()};drawPositions();if(VIEW==='p')setHash(positionRoute(positionTopic));
    positionOpen.forEach(tn=>{const t=topics.find(x=>x.t===tn);if(t)loadCompareTopic(t);});
  }
  function renderPositions(topicName){
    VIEW='p';segOn('p');starSel(null);positionTopic=typeof topicName==='string'?topicName:'';
    if(positionTopic)positionOpen.add(positionTopic);
    const listed=topics.filter(t=>(t.npos||0)>0||(t.pos||[]).length);
    const workOptions=[...roomWorks.values()].sort((a,b)=>a.t.localeCompare(b.t)||RX.workOrder(a,b));
    pbody.innerHTML=`<div class="view rx-positions"><h2>Positions</h2><p class="pane-meta">Mined statements with their source passages, in the order of the loci. Open a topic and read; the index fills in as you scroll.</p>
      <details class="rx-position-coverage"><summary>About these statements and their coverage</summary><p>These are extracted statements, sometimes summarized or translated. A statement can report another speaker, an objection, or a rejected view. Read its source before attributing it to ${esc(d.a)}. Each topic opens with the room's selected statements and then draws the complete index page by page.</p></details>
      <div class="rx-filters"><label class="rx-search">Find a topic<input id="positions-topic" type="search" placeholder="Grace, baptism, free will" value="${esc(positionTopic)}"></label><label class="rx-primary-filter">Work<select id="positions-work"><option value="">All works in this room</option>${workOptions.map(w=>`<option value="${esc(w.w)}">${esc(w.t)}${w.v?' · '+esc(w.v):''}</option>`).join('')}</select></label><label class="rx-search">Phrase in statements<input id="positions-phrase" type="search" placeholder="Search the loaded statements" value="${esc(positionPhrase)}"></label><label>Stance<select id="positions-annotation"><option value="">All stances</option>${STANCES.filter(x=>x[0]).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>Group statements<select id="positions-group"><option value="work">By work</option><option value="stance">By stance</option></select></label>
      <label class="rx-search rx-compare-pick">Compare with<input id="positions-compare" type="search" placeholder="Another author’s name" value="${esc(positionCompare?.a||'')}" list="positions-compare-list" autocomplete="off"><datalist id="positions-compare-list"></datalist></label></div>
      <div id="positions-work-link"></div><div class="rx-results-line"><p id="positions-count" role="status"></p><div class="rx-result-actions"><button class="rx-text-link" id="positions-expand">Open all</button><button class="rx-text-link" id="positions-collapse">Collapse all</button><button class="rx-text-link" id="positions-reset">Reset filters</button></div></div>
      <nav class="rx-loci-jump" id="positions-jump" aria-label="Loci"></nav>
      <div id="positions-list" class="rx-fold-list rx-loci-list"></div></div>`;
    $('#positions-work').value=positionWork;$('#positions-annotation').value=positionAnnotation;$('#positions-group').value=positionGroup;researchLayout();
    const statement=r=>statementHTML(r,{title:r=>roomWorks.get(r.w)?.t||r.wt||r.w,author:d.a});
    const otherStatement=r=>statementHTML(r,{author:positionCompare?.a||''});
    const byStance=rows=>{const g={};rows.forEach(r=>{const k=STANCES.some(x=>x[0]===r.s)?(r.s||''):'';(g[k]=g[k]||[]).push(r);});return STANCES.filter(([k])=>g[k]&&g[k].length).map(([k,label])=>({k,label:label||'Other statements',rows:g[k]}));};
    const byWork=(rows,works=roomWorks)=>{const g=new Map();rows.forEach(r=>{if(!g.has(r.w))g.set(r.w,[]);g.get(r.w).push(r);});
      return [...g.entries()].sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0])).map(([w,rs])=>{const wk=works.get(w);return {k:w,w,label:(wk?.t||rs[0].wt||w),sub:wk?.vs||(wk?.v?(/^\d+$/.test(String(wk.v))?'vol. ':'')+wk.v:''),rows:rs.slice().sort((a,b)=>(RX.page(a.p)??0)-(RX.page(b.p)??0))};});};
    const grouped=(rows,works)=>positionGroup==='work'?byWork(rows,works):byStance(rows);
    // collapsed folds per group (work or stance); the first open. Fold state lives on the topic so a redraw keeps it.
    const foldsHTML=(groups,render,tkey)=>{const openSet=positionFolds.get(tkey)||(positionFolds.set(tkey,new Set()),positionFolds.get(tkey));if(!openSet.size&&groups.length)openSet.add(groups[0].k);
      return groups.map(g=>`<details class="cd-work" data-position-fold="${esc(tkey)}|${esc(g.k)}"${openSet.has(g.k)?' open':''}><summary><span><strong>${esc(g.label)}</strong>${g.sub?` <small>${esc(g.sub)}</small>`:''}</span><small class="cd-n">${fmtR(g.rows.length)}</small>${g.w?` <a class="rx-text-link cd-read" href="${readerHref(g.w)}" onclick="event.stopPropagation()">open the work</a>${workSaveBtn(g.w,g.label,tkey.endsWith('|theirs')?(positionCompare?.a||''):d.a)}`:''}</summary><div class="cd-fold-body">${g.w?sectionFoldsHTML(g.rows,render,g.w):g.rows.map(render).join('')}</div></details>`).join('');};
    const headOf=t=>{const hk=LOCUS_HEAD[RX.fold(t.t)];return hk?hk[0]:(RX.isRawTopic(t.t)?LOCI_HEADS.length+1:LOCI_HEADS.length);};
    drawPositions=()=>{
      if(VIEW!=='p')return;const focus=document.activeElement,focusTopic=focus?.closest('[data-position-topic]')?.dataset.positionTopic;
      const scrolls=new Map();$('#positions-list').querySelectorAll('[data-position-topic]').forEach(d=>d.querySelectorAll('.rx-cmp-col,.rx-position-body').forEach((box,k)=>{if(box.scrollTop)scrolls.set(d.dataset.positionTopic+':'+k,box.scrollTop);}));
      const filter={work:positionWork,phrase:positionPhrase,annotation:positionAnnotation};
      const hits=listed.filter(t=>!positionTopic||RX.fold(t.t).includes(RX.fold(positionTopic))).map(t=>({t,rows:positionAvailable(t).filter(r=>positionMatches(r,filter))}));
      const order=(a,b)=>headOf(a.t)-headOf(b.t)||((LOCUS_HEAD[RX.fold(a.t.t)]||[0,99])[1]-(LOCUS_HEAD[RX.fold(b.t.t)]||[0,99])[1])||(b.t.npos||0)-(a.t.npos||0);
      hits.sort(order);
      const groups=[];hits.forEach(h=>{const hi=headOf(h.t);const g=groups.find(x=>x.hi===hi)||(groups.push({hi,label:hi<LOCI_HEADS.length?LOCI_HEADS[hi][0]:hi===LOCI_HEADS.length?'Other topics':'Unreviewed extraction labels',items:[]}),groups[groups.length-1]);g.items.push(h);});
      const cmpLink=positionCompare?` <a class="rx-text-link" href="#${encodeURIComponent(slug)}/with/${encodeURIComponent(positionCompare.s)}">Full comparison with ${esc(positionCompare.a)}</a> · <a class="rx-text-link" href="${cdURL({a:[slug,positionCompare.s],sel:positionTopic?tslugOf(positionTopic):'',g:positionGroup,s:positionAnnotation,q:positionPhrase})}">Open in the comparison desk</a>`:'';
      $('#positions-work-link').dataset.cmp=cmpLink;
      $('#positions-count').textContent=fmtR(hits.length)+' topics · '+fmtR(hits.reduce((n,x)=>n+x.t.npos||0,0))+' indexed positions · '+fmtR(hits.reduce((n,x)=>n+x.rows.length,0))+' statements loaded'+(positionCompare?' · compared with '+positionCompare.a:'');
      $('#positions-work-link').innerHTML=(positionWork?`<a class="rx-text-link" href="${workResearchHref(positionWork)}">Explore this work in the reader</a>`:'')+cmpLink;
      $('#positions-jump').innerHTML=groups.map(g=>`<a href="#loci-${g.hi}" data-jump="${g.hi}">${esc(g.label)}<small>${fmtR(g.items.reduce((n,x)=>n+(x.t.npos||0),0))}</small></a>`).join('');
      $('#positions-list').innerHTML=groups.map(g=>`<section class="rx-loci-group" id="loci-${g.hi}"><h3 class="rx-loci-head">${esc(g.label)}<small>${fmtR(g.items.length)} topics · ${fmtR(g.items.reduce((n,x)=>n+(x.t.npos||0),0))} positions</small></h3>${g.items.map(({t,rows})=>{
        const i=topics.indexOf(t),state=positionState.get(t.t)||{},total=state.author?.np??t.npos,open=positionOpen.has(t.t);
        const cmp=positionCompare?positionCompare.state.get(t.t):null,cmpTopic=positionCompare?(positionCompare.topics||[]).find(x=>x.key===t.key):null;
        const coverage=state.started?fmtR(state.indexedRows.length)+' of '+fmtR(total)+' indexed loaded':(total!=null?fmtR(total)+' indexed positions':'');
        const mine=foldsHTML(grouped(rows),statement,t.key+'|mine')||`<p class="rx-note">${state.done?'No loaded statements match these filters.':'No selected statements match yet; the index is loading.'}</p>`;
        const theirRows=positionCompare?(cmp?.rows||[]).filter(r=>positionMatches(r,{phrase:positionPhrase,annotation:positionAnnotation})):[];
        const theirs=positionCompare?`<div class="rx-cmp-col"><h4 class="rx-cmp-head">${esc(positionCompare.a)} <small>${cmpTopic?fmtR(cmp?.total??cmpTopic.npos??0)+' positions':'no positions on this topic'}</small></h4>${cmp?.loading?'<p class="rx-note">Loading…</p>':foldsHTML(grouped(theirRows,positionCompare.works),otherStatement,t.key+'|theirs')||(cmpTopic?'<p class="rx-note">Opens when this topic is opened.</p>':'')}</div>`:'';
        return `<details class="rx-fold rx-position-topic" data-position-topic="${i}"${open?' open':''}><summary><span><strong>${esc(t.t)}${t.via?.length?' <i class="cd-via" aria-hidden="true">+</i>':''}</strong><small>${t.via?.length?'includes '+t.via.map(esc).join(', ')+' · ':''}${coverage}${rows.length?' · '+fmtR(rows.length)+' statements loaded':''}${state.loading?' · loading…':''}${state.error?' · index unavailable, showing the room selection':''}</small></span></summary>
          <div class="rx-position-body${positionCompare?' rx-position-compare':''}">${RX.isRawTopic(t.t)?'<p class="rx-note">Unreviewed extraction label.</p>':''}<div class="rx-cmp-col rx-cmp-mine">${positionCompare?`<h4 class="rx-cmp-head">${esc(d.a)} <small>${fmtR(rows.length)} loaded</small></h4>`:''}${mine}${state.contract&&!state.done&&!state.halted?`<div class="rx-position-sentinel" data-position-sentinel="${i}">${state.loading?'Loading more…':'Scroll for more'}</div>`:state.halted?`<p class="rx-note">The index stopped answering at ${fmtR((state.indexedRows||[]).length)} of ${fmtR(total)}. <button class="rx-text-link" data-position-retry="${i}">Try again</button></p>`:''}${`<p class="rx-note rx-position-foot">${state.contract&&state.done?'Complete index loaded. ':''}${TSLUG.get(RX.fold(t.t))?`<a class="rx-text-link" href="/the-faith-received/topics/#${encodeURIComponent(TSLUG.get(RX.fold(t.t)))}">All authors on this topic</a> · <a class="rx-text-link" href="/the-faith-received/web/#t=${encodeURIComponent(TSLUG.get(RX.fold(t.t)))}">This topic in the citation web</a>`:`<a class="rx-text-link" href="/the-faith-received/web/#a=${encodeURIComponent(slug)}">This author in the citation web</a>`}${positionCompare?` · <a class="rx-text-link" href="#${encodeURIComponent(slug)}/with/${encodeURIComponent(positionCompare.s)}/topic/${encodeURIComponent(tslugOf(t.t))}">Full comparison on this topic</a>`:''}</p>`}</div>${theirs}</div></details>`;}).join('')}</section>`).join('')||'<div class="rx-empty"><h3>No topics match</h3><p>Try another topic name or reset the filters.</p></div>';
      // scroll-driven index paging: a sentinel at the foot of every open topic pulls the next page
      $('#positions-list').querySelectorAll('[data-position-topic]').forEach(d=>d.querySelectorAll('.rx-cmp-col,.rx-position-body').forEach((box,k)=>{const y=scrolls.get(d.dataset.positionTopic+':'+k);if(y)box.scrollTop=y;}));
      (window.__posIOs||[]).forEach(io=>io.disconnect());window.__posIOs=[];
      $('#positions-list').querySelectorAll('[data-position-sentinel]').forEach(el=>{let pane=el.parentElement;while(pane&&pane!==document.body&&!/auto|scroll/.test(getComputedStyle(pane).overflowY))pane=pane.parentElement;if(!pane||pane===document.body)pane=null;const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;const t=topics[+e.target.dataset.positionSentinel];if(t)loadIndexedPositions(t);}),{root:pane,rootMargin:'240px 0px'});io.observe(el);window.__posIOs.push(io);});
      if(focusTopic!=null){const group=$('[data-position-topic="'+focusTopic+'"]');group?.querySelector('summary')?.focus({preventScroll:true});}
    };
    const openTopic=t=>{positionOpen.add(t.t);const st=positionState.get(t.t);if(!st?.ready&&!st?.loading)loadPositionTopic(t).then(()=>{if(run===RESEARCH_RUN)loadIndexedPositions(t);});else if(st?.ready)loadIndexedPositions(t);if(positionCompare)loadCompareTopic(t);};
    $('#positions-list').addEventListener('toggle',e=>{const det=e.target;if(!det.isConnected)return;
      if(det.matches('[data-position-fold]')){const [tk,gk]=det.dataset.positionFold.split('|').length>2?[det.dataset.positionFold.slice(0,det.dataset.positionFold.lastIndexOf('|')),det.dataset.positionFold.slice(det.dataset.positionFold.lastIndexOf('|')+1)]:det.dataset.positionFold.split('|');const set=positionFolds.get(tk);if(set){if(det.open)set.add(gk);else set.delete(gk);}return;}
      if(!det.matches('[data-position-topic]'))return;const t=topics[+det.dataset.positionTopic];if(det.open){if(!positionOpen.has(t.t)){openTopic(t);setHash(positionRoute(t.t));}}else positionOpen.delete(t.t);},true);
    $('#positions-list').addEventListener('click',e=>{const b=e.target.closest('[data-position-retry]');if(!b)return;const t=topics[+b.dataset.positionRetry],st=positionState.get(t.t);if(st){st.halted=false;st.failures=0;loadIndexedPositions(t);}});
    $('#positions-jump').addEventListener('click',e=>{const a=e.target.closest('a[data-jump]');if(!a)return;e.preventDefault();$('#loci-'+a.dataset.jump)?.scrollIntoView({block:'start',behavior:'smooth'});});
    $('#positions-topic').oninput=e=>{positionTopic=e.target.value;drawPositions();setHash('positions');};
    $('#positions-work').onchange=e=>{positionWork=e.target.value;setPositionWork();drawPositions();};
    $('#positions-phrase').oninput=e=>{positionPhrase=e.target.value;drawPositions();};
    $('#positions-annotation').onchange=e=>{positionAnnotation=e.target.value;drawPositions();};
    $('#positions-group').onchange=e=>{positionGroup=e.target.value;drawPositions();};
    $('#positions-expand').onclick=()=>{listed.filter(t=>!positionTopic||RX.fold(t.t).includes(RX.fold(positionTopic))).slice(0,60).forEach(openTopic);drawPositions();};
    $('#positions-collapse').onclick=()=>{positionOpen.clear();$('#positions-list').querySelectorAll('details[open]').forEach(el=>el.open=false);setHash('positions');};
    $('#positions-reset').onclick=()=>{positionTopic='';positionPhrase='';positionAnnotation='';positionWork='';positionCompare=null;setPositionWork();renderPositions();};
    // compare picker: the roster feeds a datalist; a full name (or the only match) selects
    getRoster().then(ix=>{if(run!==RESEARCH_RUN)return;const rows=RX.roster(ix.rows).filter(r=>r.s!==slug);const dl=$('#positions-compare-list');if(!dl)return;
      const fill=q=>{const f=RX.fold(q||'');dl.innerHTML=rows.filter(r=>!f||RX.fold(r.a).includes(f)).slice(0,30).map(r=>`<option value="${esc(r.a)}">${esc(RX.shelves[r.sh])} · ${fmtR(r.w)} works</option>`).join('');};
      fill('');const inp=$('#positions-compare');inp.oninput=e=>{fill(e.target.value);const f=RX.fold(e.target.value);const exact=rows.find(r=>RX.fold(r.a)===f);if(!e.target.value){setCompare(null);return;}if(exact)setCompare(exact);};
      inp.onchange=e=>{const f=RX.fold(e.target.value);const hit=rows.find(r=>RX.fold(r.a)===f)||rows.filter(r=>RX.fold(r.a).includes(f))[0];if(hit){inp.value=hit.a;setCompare(hit);}};});
    topicSlugs().then(m=>{if(run!==RESEARCH_RUN||VIEW!=='p')return;TSLUG=m;drawPositions();});
    addEventListener('fr-sections-ready',()=>{if(run===RESEARCH_RUN&&VIEW==='p')drawPositions();},{signal:researchEvents.signal});
    // ?cmp=<slug> preselects the compare column (pair page and topic page hand a partner over this way)
    const cmpParam=new URLSearchParams(location.search).get('cmp');
    if(cmpParam&&!positionCompare)getRoster().then(ix=>{if(run!==RESEARCH_RUN||VIEW!=='p')return;const hit=RX.roster(ix.rows).find(r=>r.s===cmpParam&&r.s!==slug);if(hit){const inp=$('#positions-compare');if(inp)inp.value=hit.a;setCompare(hit);}});
    drawPositions();setHash(positionRoute(positionTopic));if(positionTopic){const t=topics.find(t=>t.t===positionTopic)||topics.find(t=>t.key===topicCanon(positionTopic).key);if(t){positionTopic=t.t;positionOpen.add(t.t);openTopic(t);drawPositions();}}
  }
  // ---- Topics index ----
  function renderTopicsIndex(){
    VIEW='t';segOn('t');starSel(null);setHash('t');
    pbody.innerHTML=`<div class="view"><h2>Topics</h2><p class="pane-meta">${topics.filter(t=>!RX.isRawTopic(t.t)).length} topics in the index. Counts show indexed pages.</p><label class="rx-search">Find a topic<input id="room-topic-q" type="search" placeholder="Search this author’s topics"></label><div id="room-topic-list"></div></div>`;
    const draw=()=>{const q=RX.fold($('#room-topic-q').value),hits=topics.filter(t=>!q||RX.fold(t.t).includes(q)),row=t=>`<button class="rx-topic-button" data-t="${esc(t.t)}"><span>${esc(t.t)}</span><small>${fmtR(t.np??t.n)} ${t.np!=null?'pages':'index records'}</small></button>`;$('#room-topic-list').innerHTML=hits.filter(t=>!RX.isRawTopic(t.t)).map(row).join('')+topicReviewList(hits,row)||'<p class="rx-note">No matching topics.</p>';};$('#room-topic-q').oninput=draw;draw();
  }
  async function renderTopic(t){
    VIEW='q';segOn('t');starSel(t.t);selT=t.t;const token=++roomViewRun;
    pbody.innerHTML='<p class="loading" role="status">Loading passages…</p>';
    const tslug=t.t.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50);
    const [full,globalTopics]=await Promise.all([roomTopicFull(RSH,slug,t),J(BLOB+'/v1/mine/topic2-all/index.json').catch(()=>({topics:[]}))]);
    const globalTopic=(globalTopics.topics||[]).find(x=>RX.fold(x.t)===RX.fold(t.t));
    if(token!==roomViewRun||run!==RESEARCH_RUN)return;
    const src=full||t,titles=Object.fromEntries((d.works||[]).map(w=>[w.w,w.t])),seen=new Set(),records=[];
    for(const r of [...(src.pos||[]).map(r=>({...r,type:'Position'})),...(src.pages||[]).map(r=>({...r,type:'Page annotation'}))]){const key=JSON.stringify([r.w,RX.page(r.p),r.q||r.g]);if(seen.has(key))continue;seen.add(key);if(r.q||r.g)records.push(r);}
    const works=[...new Set(records.map(r=>r.w))],cross=[...new Set(records.flatMap(r=>r.x||[]))].filter(x=>x!==t.t&&!RX.isRawTopic(x)).sort(),stances=[...new Set(records.map(r=>r.s).filter(Boolean))].sort();let limit=24;
    pbody.innerHTML=`<div class="view"><div class="rx-section-head"><h2>${esc(t.t)}</h2>${globalTopic?`<a class="rx-text-link" href="/the-faith-received/topics/#${encodeURIComponent(globalTopic.s)}">Compare across authors</a>`:''}</div><p class="pane-meta">${fmtR(t.np)} indexed pages · ${fmtR(t.npos)} recorded positions · ${fmtR(records.length)} available entries</p><p class="rx-note">Mined excerpts and page annotations. Open the source to check its speaker, context, and translation.${t.full&&!full?' The larger export could not load; the room’s sample is shown.':''}</p>
    <div class="rx-filters"><label class="rx-search">Search this topic<input type="search" id="room-tq" placeholder="Find a phrase"></label><label>Work<select id="room-tw"><option value="">All available works</option>${works.map(w=>`<option value="${esc(w)}">${esc(titles[w]||w)}</option>`).join('')}</select></label><label>Also discusses<select id="room-tx"><option value="">All connected topics</option>${cross.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label>${stances.length?`<label>Annotation<select id="room-ts"><option value="">All annotations</option>${stances.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label>`:''}</div>${globalTopic?`<a class="rx-text-link" href="/the-faith-received/fathers/?sh=${RSH}#${slug}/positions/${encodeURIComponent(t.t)}">Browse this author’s indexed positions</a>`:''}<p class="rx-note">Connections mean topics tagged on the same passage. Annotation types describe local statements, not agreement or disagreement with the topic.</p><p id="room-topic-count" role="status"></p><div id="room-topic-evidence"></div><button class="rx-button rx-more" id="room-topic-more">Show more passages</button>
    ${(src.migne||[]).length?`<details class="rx-historical"><summary>Read Migne’s index · ${fmtR(src.migne.length)} entries</summary>${src.migne.map(r=>`<article class="rx-excerpt"><p>${esc(r.q||'Index reference')}</p>${RX.safeReaderURL(r.h)?`<a class="rx-text-link" href="${esc(RX.safeReaderURL(r.h))}">Read PL ${esc(r.v)}, column ${esc(r.c)}</a>`:''}</article>`).join('')}</details>`:''}</div>`;
    researchLayout();const draw=()=>{const q=RX.fold($('#room-tq').value),w=$('#room-tw').value,x=$('#room-tx').value,s=$('#room-ts')?.value;const rows=records.filter(r=>(!w||r.w===w)&&(!x||(r.x||[]).includes(x))&&(!s||r.s===s)&&(!q||RX.fold((r.q||'')+' '+(r.g||'')).includes(q)));
    addEventListener('fr-sections-ready',()=>{if(run===RESEARCH_RUN&&VIEW==='q')draw();},{signal:researchEvents.signal});
    $('#room-topic-count').textContent=fmtR(rows.length)+' matching entries';$('#room-topic-more').hidden=true;
    statementPane($('#room-topic-evidence'),rows,{title:r=>titles[r.w]||r.wt||r.w,author:d.a,actions:true,extra:r=>`<p class="rx-annotation">${esc(r.type)}${r.s?' · '+esc(r.s):''}${(r.x||[]).length?' · Also discusses '+r.x.map(esc).join(', '):''}</p>`,empty:'No matching passages. Clear a filter or try another phrase.'});};
    for(const id of ['room-tq','room-tw','room-tx','room-ts']){const el=$('#'+id);if(el)el.addEventListener(id==='room-tq'?'input':'change',()=>draw());}draw();pbody.scrollTop=0;setHash(encodeURIComponent(t.t));
  }
  function renderConnections(){
    VIEW='c';segOn('c');starSel(null);++roomViewRun;setHash('connections');
    // MASTER–DETAIL (owner 2026-09-10 "this is collapsed by work too"): every connection in a bounded
    // list pane; the chosen one's shared pages on the right, grouped by work in folds. No "show more".
    const pairs=RX.connections(topics);let sel=null;
    pbody.innerHTML=`<div class="view rx-connections"><h2>Connected topics</h2><p class="pane-meta">Where subjects meet in ${esc(d.a)}’s available passages.</p><p class="rx-note">Each connection counts distinct pages tagged with both topics in this room’s sample. This reveals places to read together; it does not establish agreement, influence, or a complete account of the author’s theology.</p><label class="rx-search">Find a connection<input id="connection-q" type="search" placeholder="Grace, sin, free will"></label><p id="connection-count" role="status"></p>
      <div class="rx-md rx-conn-md"><div class="rx-md-list rx-pane" id="room-connections" role="tablist" aria-label="Connections"></div><div class="rx-md-detail" id="connection-detail"><p class="rx-note">Choose a connection to read its shared pages, grouped by work.</p></div></div></div>`;
    const showPair=p=>{sel=p;$('#room-connections').querySelectorAll('[data-pair]').forEach(b=>{const on=+b.dataset.pair===pairs.indexOf(p);b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on));});
      const byW=new Map();p.pages.forEach(r=>{if(!byW.has(r.w))byW.set(r.w,[]);byW.get(r.w).push(r);});
      const works=[...byW.entries()].sort((x,y)=>y[1].length-x[1].length);const title=r=>r.wt||d.works.find(w=>w.w===r.w)?.t||r.w;
      $('#connection-detail').innerHTML=`<h3 class="rx-conn-title">${esc(p.a)} <span class="rx-join">with</span> ${esc(p.b)}<small>${fmtR(p.pages.length)} shared ${p.pages.length===1?'page':'pages'} across ${fmtR(works.length)} ${works.length===1?'work':'works'}</small></h3><div class="rx-pane rx-conn-pane">${works.map(([w,rs],i)=>`<details class="cd-work"${i===0?' open':''}><summary><span><strong>${esc(title(rs[0]))}</strong></span><small class="cd-n">${fmtR(rs.length)}</small> <a class="rx-text-link cd-read" href="${readerHref(w)}" onclick="event.stopPropagation()">open the work</a>${workSaveBtn(w,title(rs[0]),d.a)}</summary><div class="cd-fold-body">${sectionFoldsHTML(rs,r=>`<article class="rx-excerpt"><p>${esc(r.q||r.g||'Topics recorded together on this page.')}</p><div class="rx-source"><span>${esc(title(r))} · ${pgl(r.w)} ${esc(r.p??'')}</span><div><a class="rx-text-link" href="${readerHref(r.w,r.p)}">Read shared passage</a>${previewBtn(r.w,r.p)}${pinBtn(r.w,r.p,title(r),d.a,r.q||r.g)}</div></div></article>`,w)}</div></details>`).join('')}</div>`;};
    const draw=()=>{const q=RX.fold($('#connection-q').value),hits=pairs.filter(p=>!q||RX.fold(p.a+' '+p.b).includes(q));$('#connection-count').textContent=fmtR(hits.length)+' connections in the available sample';
      const box=$('#room-connections');paneList(box,hits,p=>`<button role="tab" class="rx-md-item${sel===p?' on':''}" aria-selected="${sel===p}" data-pair="${pairs.indexOf(p)}"><span>${esc(p.a)} <span class="rx-join">with</span> ${esc(p.b)}</span><small>${fmtR(p.pages.length)}</small></button>`,80);
      box.onclick=e=>{const b=e.target.closest('[data-pair]');if(b)showPair(pairs[+b.dataset.pair]);};
      if(!hits.length)box.innerHTML='<p class="rx-note">No recorded connection matches. Try one topic name.</p>';};
    $('#connection-q').oninput=draw;draw();if(pairs.length)showPair(pairs[0]);
    addEventListener('fr-sections-ready',()=>{if(run===RESEARCH_RUN&&VIEW==='c'&&sel)showPair(sel);},{signal:researchEvents.signal});
  }

  // ---- Scripture: the text itself, his comments under each verse ----
  let prof=null,asvBooks=null,AB=null;const shardCache={},asvCache={};
  const bundle=async()=>{if(!AB)AB=await gzJ(BLOB+`/v1/bible/all/a2/${slug}.json.gz`);return AB;};
  const bnorm2=s2=>String(s2).toLowerCase().replace(/[^a-z0-9]/g,"");
  const ROM2D={i:"1",ii:"2",iii:"3",iv:"4"};
  const ASV_ALIAS={revelationofjohn:"revelation",songofsolomon:"songofsongs",sirach:"ecclesiasticus"};
  async function asvChapter(bookName,ch){
    if(!asvBooks){const bj=await J(BLOB+"/v1/bible/asv/books.json").catch(()=>null);
      asvBooks={};if(bj)Object.keys(bj).forEach(k=>asvBooks[bnorm2(k)]=bj[k].path);}
    let key=bnorm2(String(bookName).replace(/^(I{1,3}|IV)\s/i,m2=>ROM2D[m2.trim().toLowerCase()]+" "));
    key=ASV_ALIAS[key]||key;
    const path=asvBooks[key];if(!path)return null;
    const ck=path+"/"+ch;
    if(!(ck in asvCache))asvCache[ck]=await J(BLOB+`/v1/bible/asv/${path}/${ch}.json`).catch(()=>null);
    return asvCache[ck];
  }
  async function renderScripture(bslug,ch){
    VIEW="s";segOn("s");starSel(null);selBook=bslug||null;const token=roomViewRun;
    if(!prof){pbody.innerHTML='<p class="loading">…</p>';
      try{prof=(await bundle()).profile;}catch(_){
        pbody.innerHTML='<p class="loading">No Scripture profile for this author.</p>';return;}}
    if(token!==roomViewRun||run!==RESEARCH_RUN)return;
    if(!bslug){
      const bmax=Math.max(...prof.books.map(b=>b.n),1);
      pbody.innerHTML=`<div class="view">
        <div class="pane-topic">Scripture</div>
        <div class="pane-meta">${prof.books.length} books · ${d.n_cit.toLocaleString()} citations</div>
        <div class="bkgrid">${prof.books.map((b,i)=>`
          <button class="bkrow" data-b="${esc(b.slug)}">
            <b>${esc(b.book)}</b>
            <i style="width:${Math.max(3,100*Math.sqrt(b.n/bmax)*.5).toFixed(0)}%;animation-delay:${i*20}ms"></i>
            <span class="n">${b.n.toLocaleString()}</span></button>`).join("")}</div></div>`;
      pbody.scrollTop=0;setHash("s");return;
    }
    let shard=shardCache[bslug];
    if(!shard){pbody.innerHTML='<p class="loading">…</p>';
      try{const B2=await bundle();
        shard=shardCache[bslug]={a:d.a,book:((B2.profile.books||[]).find(b=>b.slug===bslug)||{}).book||bslug,
          rows:B2.books[bslug]||[]};
        if(!shard.rows.length)throw 0;
    }catch(_){if(token===roomViewRun&&run===RESEARCH_RUN)pbody.innerHTML='<p class="loading">This book could not load. Choose another book or try again.</p><button class="rx-button" data-back>Browse books</button>';return;}}
    if(token!==roomViewRun||run!==RESEARCH_RUN)return;
    const byc={};for(const r of shard.rows)(byc[r.c||0]=byc[r.c||0]||[]).push(r);
    const chs=Object.keys(byc).map(Number).sort((x,y)=>x-y);
    if(!ch||!byc[ch])ch=chs[0];
    let asv=await asvChapter(shard.book,ch);
    {const _e=await esvChapter(shard.book,ch);
     if(_e){asv=asv&&asv.verses?{...asv,verses:{...asv.verses,..._e}}:{book:shard.book,chapter:ch,verses:_e};}}
    if(token!==roomViewRun||run!==RESEARCH_RUN)return;
    const byv={};for(const r of byc[ch])(byv[r.v||0]=byv[r.v||0]||[]).push(r);
    const scriptureCitations=rows=>workFoldsHTML(rows,{title:r=>tell(r.t||r.w),author:d.a});
    let body2="";
    if(asv&&asv.verses){
      // comments COLLAPSED by default (owner 2026-08-25): the chapter reads as scripture;
      // a quiet count beside a cited verse opens his comments in place
      const vns=Object.keys(asv.verses).map(Number).sort((x,y)=>x-y);
      body2=vns.map(v2=>{
        const rows=byv[v2]||[];
        return `<div class="vs2${rows.length?" cited":""}"${rows.length?` data-verse="${v2}"`:""}><span class="vn">${v2}</span><span class="vtx">${esc(asv.verses[String(v2)])}</span>${rows.length?`<button class="vex" data-vx="${v2}" aria-expanded="false" aria-label="Show ${rows.length} comments on verse ${v2}">${rows.length}</button>`:""}</div>`+
          (rows.length?`<div class="vcits" data-vfor="${v2}" hidden>${scriptureCitations(rows)}</div>`:"");
      }).join("");
      const un=(byv[0]||[]);
      if(un.length)body2+=`<div class="vg"><h3>On the chapter <span class="tn" style="font-family:var(--body);font-size:.72rem;color:var(--faint)">${un.length}</span></h3><div class="vcits" style="margin-left:0">${scriptureCitations(un)}</div></div>`;
    }else body2='<p class="rx-note">The chapter text could not load. Its recorded source passages are available below.</p>'+scriptureCitations(byc[ch]);
    pbody.innerHTML=`<div class="view">
      <button class="bkback" data-back>‹ All books</button>
      <div class="pane-topic">${esc(shard.book)} ${ch}</div>
      <p class="rx-note"><a class="rx-text-link" href="${FRResearchData.verseURL(bslug,ch)}">Open this chapter in Scripture</a></p><div class="pane-meta">${(byc[ch]||[]).length} citations in this chapter · ${shard.rows.length.toLocaleString()} in ${esc(shard.book)}</div>
      <div class="chstrip">${(()=>{const cm=Math.max(...chs.map(c2=>byc[c2].length),1);
        return chs.map(c2=>`<button class="chp heat${c2===ch?" on":""}" data-ch="${c2}"><span>${c2}<span style="color:var(--faint)"> · ${byc[c2].length}</span></span><em style="width:${Math.max(4,34*Math.sqrt(byc[c2].length/cm)).toFixed(0)}px"></em></button>`).join("");})()}</div>
      <div class="rx-pane room-scripture-pane" tabindex="0" aria-label="Scripture and commentary">${body2}</div></div>`;
    pbody.scrollTop=0;
    setHash("s/"+bslug+"/"+ch);
  }
  // ---- Search: his corpus, words and questions ----
  function renderSearch(){
    VIEW="x";segOn("x");starSel(null);
    pbody.innerHTML=`<div class="view">
      <div class="pane-topic">Search ${esc(d.a.split(" ")[0])}</div>
      <div class="srow"><input id="sq" type="search" placeholder="A word, a phrase, a question…" autocomplete="off">
        <button id="sgo">Find</button><button id="sask">Ask</button></div>
      <div id="sres"></div></div>`;
    const sq=$("#sq"),sres=$("#sres");sq.focus();
    const local=()=>{
      const q=sq.value.trim();if(q.length<2){sres.innerHTML="";return;}
      const ql=q.toLowerCase();const out=[];
      const tHits=topics.filter(t=>!RX.isRawTopic(t.t)&&t.t.toLowerCase().includes(ql));
      if(tHits.length)out.push(`<h2 class="sect">Topics</h2><div class="chstrip">${tHits.slice(0,12).map(t=>`<button class="chp" data-t="${esc(t.t)}">${esc(t.t)}<span style="color:var(--faint)"> · ${t.n.toLocaleString()}</span></button>`).join("")}</div>`);
      const posH=[],pagH=[];
      for(const t of topics){
        for(const p2 of (t.pos||[]))if(p2.q&&p2.q.toLowerCase().includes(ql)&&posH.length<30)posH.push({t,p:p2});
        for(const p2 of (t.pages||[]))if(String(p2.q||p2.g||"").toLowerCase().includes(ql)&&pagH.length<30)pagH.push({t,p:p2});
      }
      const titleOf=row=>(d.works||[]).find(w=>w.w===row.w)?.t||row.wt||row.w;
      if(posH.length)out.push('<h2 class="sect">Recorded statements</h2>'+workFoldsHTML(posH.map(({t,p})=>({...p,topicLabel:t.t})),{title:titleOf,author:d.a,annotation:true,extra:r=>'<p class="rx-note">'+esc(r.topicLabel)+'</p>'}));
      if(pagH.length)out.push('<h2 class="sect">Indexed passages</h2>'+workFoldsHTML(pagH.map(({t,p})=>({...p,topicLabel:t.t,pageSummary:!p.q})),{title:titleOf,author:d.a,extra:r=>'<p class="rx-note">'+esc(r.topicLabel)+'</p>'}));
      const wH=d.works.filter(x=>RX.fold(x.t).includes(RX.fold(q))).slice(0,10);
      if(wH.length)out.push('<h2 class="sect">Works</h2>'+wH.map(x=>workRowHTML({...x,a:d.a})).join(''));
      sres.classList.add('rx-pane');sres.innerHTML='<p class="rx-note">Searches the evidence loaded for this author. Showing up to 30 statements, 30 indexed passages, and 10 works. Open Positions for the complete topic index.</p>'+(out.join('')||'<p class="rx-note">No matches in the loaded evidence. Try another phrase, browse Positions, or ask about this author’s works.</p>');
    };
    let lT=null;
    sq.addEventListener("input",()=>{clearTimeout(lT);lT=setTimeout(local,250);});
    sq.addEventListener("keydown",e=>{if(e.key==="Enter")local();});
    $("#sgo").addEventListener("click",local);
    $("#sask").addEventListener("click",async()=>{
      const q=sq.value.trim();if(q.length<3)return;
      if(!window.FRAsk?.open){sres.textContent='Ask could not load. Reload this page and try again.';return;}
      await FRAsk.open({fresh:true,q,authors:[d.a],works:(d.works||[]).map(work=>work.w).filter(Boolean)});
    });
    pbody.scrollTop=0;setHash("x");
  }
  // ---- wiring ----
  segs.p.addEventListener("click",()=>renderPositions());
  segs.c.addEventListener("click",renderConnections);
  segs.w.addEventListener("click",renderWorks);
  segs.s.addEventListener("click",()=>renderScripture());
  segs.t.addEventListener("click",renderTopicsIndex);
  segs.r.addEventListener("click",renderReception);
  segs.x.addEventListener("click",renderSearch);
  // ---- Reception (owner 2026-08-25 'see reception between fathers to divines and vice
  // versa'): resolved class-A citations, both directions, grouped by tradition; each
  // counter-party opens to the works they lean on and page-level evidence. ----
  let RECD=null;
  async function renderReception(){
    VIEW="rc";segOn("r");starSel(null);const token=roomViewRun;
    pbody.innerHTML='<p class="loading">…</p>';
    if(!RECD){try{RECD=await gzJ(BLOB+"/v1/reception/"+slug+".json.gz?d="+bust());}
      catch(e){RECD={a:d.a,in:{n:0,na:0,rows:[]},out:{n:0,na:0,rows:[]}};}}
    if(token!==roomViewRun||run!==RESEARCH_RUN)return;
    let side=RECD.in.n>=RECD.out.n?"in":"out", rq="";
    const TRO=["English Divines","Latin Fathers","Greek Fathers","Eastern Fathers","Medieval","Reformed","Lutheran","Roman Catholic","Humanism and Law",""];
    const HOWC={approves:"#3F6B4E",quotes:"var(--gold,#C9A96E)",cites:"#b3a898",reports:"#8a7f72",refutes:"#A8462B"};
    const howbar=h=>{const ks=["approves","quotes","cites","reports","refutes"].filter(k=>h[k]);
      if(!ks.length)return"";
      return `<span class="rhow" title="${ks.map(k=>k+" "+h[k]).join(" · ")}">${ks.map(k=>`<i style="flex:${h[k]} 1 2px;background:${HOWC[k]}"></i>`).join("")}</span>`;};
    const draw=()=>{
      const S=RECD[side]||{n:0,na:0,rows:[]};
      const rows=S.rows.filter(r=>!rq||r.a.toLowerCase().includes(rq));
      const grp={};rows.forEach(r=>{(grp[r.tr||""]=grp[r.tr||""]||[]).push(r);});
      const arow=(r,i)=>`<details class="rrow" style="--i:${Math.min(i,40)}">
        <summary><span class="nm">${r.s?`<a href="#${r.s}">${esc(r.a)}</a>`:esc(r.a)}</span>
          ${r.e&&ERAL[r.e]&&!(["English Divines","Reformed","Lutheran","Roman Catholic"].includes(r.tr)&&"ELCH".includes(r.e))?`<span class="rera">${ERAL[r.e]}</span>`:""}
          ${howbar(r.how||{})}<span class="rn">${r.n.toLocaleString()} ${r.n===1?'citation':'citations'}</span></summary>
        <div class="rdet">
          ${r.tw&&r.tw.length?`<div style="margin:.3rem 0 .45rem">${side==="in"?"Leans on":"Draws most on"}:
            ${r.tw.map(x2=>x2.length===3?`<a class="pill" href="${readerHref(x2[0])}" style="font-size:.72rem;padding:.05rem .5rem">${esc(x2[1])} <i>${x2[2]}</i></a>`:`<span class="pill" style="font-size:.72rem;padding:.05rem .5rem">${esc(x2[0])} <i>${x2[1]}</i></span>`).join(" ")}</div>`:""}
          ${(r.sm||[]).map(s2=>`<div class="ev"><div class="q" style="font-size:.9rem">${esc(s2.sf)}${s2.loc?` — <i>${esc(s2.loc)}</i>`:""}${s2.twt?` <span style="color:var(--faint)">→ ${esc(s2.twt)}</span>`:""}</div>
            <div class="m"><span class="wk">${esc(s2.ct)}</span><span>${pgl(s2.cw)} ${s2.p??"?"}</span>${readBtn(s2.cw,s2.p,s2.sf)}${pinBtn(s2.cw,s2.p,s2.ct,r.a,(s2.sf||'')+(s2.loc?' — '+s2.loc:''))}</div></div>`).join("")}
          ${r.n>(r.sm||[]).length?`<button class="chip" style="margin-top:.35rem" data-full="${esc(r.fk||"")}">All ${r.n.toLocaleString()} citations</button>`:""}${r.fk?` <a class="chip" style="margin-top:.35rem" href="#${encodeURIComponent(slug)}/with/${encodeURIComponent(r.fk)}">Compare the two authors</a>`:""}
        </div></details>`;
      pbody.innerHTML=`<div class="view"><div class="pane-topic">Reception</div>
        <div class="pane-meta">cited <b>${RECD.in.n.toLocaleString()}</b> times by <b>${RECD.in.na}</b> authors · draws on <b>${RECD.out.na}</b> authors across <b>${RECD.out.n.toLocaleString()}</b> citations</div>
        <div style="display:flex;gap:.45rem;flex-wrap:wrap;margin:.6rem 0 .2rem">
          <button class="chip${side==="in"?" on":""}" id="rin">His reception · ${RECD.in.n.toLocaleString()}</button>
          <button class="chip${side==="out"?" on":""}" id="rout">His sources · ${RECD.out.n.toLocaleString()}</button>
          <input type="search" id="rq" placeholder="Find an author…" value="${esc(rq)}" style="font:inherit;font-size:.82rem;border:1px solid var(--border);border-radius:14px;background:none;padding:.2rem .7rem;color:inherit">
        </div>
        <div class="rx-pane rx-reception-pane">${TRO.filter(t2=>grp[t2]).map(t2=>`<div class="volhead">${esc(t2||"Other")} · ${grp[t2].reduce((a2,b2)=>a2+b2.n,0).toLocaleString()} <span style="font-size:.72rem;color:var(--faint)">${grp[t2].length} authors</span></div>
          ${grp[t2].map(arow).join("")}`).join("")||'<p class="loading">No resolved citations on this side yet.</p>'}</div>
        </div>`;
      $("#rin").addEventListener("click",()=>{side="in";draw();});
      $("#rout").addEventListener("click",()=>{side="out";draw();});
      // FULL drill (owner 2026-08-26 'where Augustine is cited in Lombard's Sentences'): the CITING
      // author's uncapped shard, on the shared citation module (filters, select, save · 2026-09-09 consolidation)
      pbody.querySelectorAll("[data-full]").forEach(bt=>bt.addEventListener("click",async()=>{
        const fk=bt.dataset.full;if(!fk)return;
        const S2=RECD[side];const r=S2.rows.find(x=>x.fk===fk);if(!r)return;
        bt.textContent="…";
        const citing=side==="in"?fk:(RECD.fk||slug), toKey=side==="in"?(RECD.fk||slug):fk;
        let F=null;try{F=await gzJ(BLOB+"/v1/reception/full/"+citing+".json.gz?d="+bust());}catch(e){}
        const g=F&&F.to&&F.to[toKey];
        if(!g||!window.FRConnectionEvidence?.mountCitation){bt.textContent="not available";return;}
        const cm=await comms().catch(()=>({map:{}}));if(run!==RESEARCH_RUN||!bt.isConnected)return;
        bt.insertAdjacentHTML("afterend",'<div class="fulldrill"></div>');const host=bt.nextElementSibling;bt.remove();
        const cn={s:citing,a:side==="in"?r.a:d.a},tn={s:toKey,a:side==="in"?d.a:r.a};
        FRConnectionEvidence.mountCitation(host,{data:F,citing:cn,target:tn,commentaries:cm});
      }));
      const qb=$("#rq");let qt=null;
      qb.addEventListener("input",()=>{clearTimeout(qt);qt=setTimeout(()=>{rq=qb.value.trim().toLowerCase();const sc=pbody.scrollTop;draw();$("#rq").focus();const b2=$("#rq");b2.setSelectionRange(b2.value.length,b2.value.length);pbody.scrollTop=sc;},250);});
    };
    draw();
    pbody.scrollTop=0;setHash("reception");
  }
  pbody.addEventListener("click",e=>{
    const bk=e.target.closest(".bkrow");if(bk){renderScripture(bk.dataset.b);return;}
    const vx=e.target.closest("[data-vx]");
    if(vx&&!e.target.closest(".readbtn,.pinb,a")){const n2=vx.dataset.vx;
      const bl=pbody.querySelector(`.vcits[data-vfor="${n2}"]`);
      if(bl){bl.hidden=!bl.hidden;
        const hd=pbody.querySelector(`.vex[data-vx="${n2}"]`);
        if(hd)hd.setAttribute("aria-expanded",String(!bl.hidden));}
      return;}
    const tb=e.target.closest("[data-t]");if(tb){const t=topics.find(x=>x.t===tb.dataset.t);if(t){renderTopic(t);return;}}
    const cp=e.target.closest(".chp,.wstrip a,.stbar a");
    if(cp&&VIEW==="s"&&cp.dataset.ch){renderScripture(selBook,+cp.dataset.ch);return;}
    const back=e.target.closest("[data-back]");if(back){renderScripture();return;}
  });
  if(VIEW==="p")renderPositions(arg?.startsWith("positions/")?arg.slice(10):undefined);
  else if(VIEW==="c")renderConnections();
  else if(VIEW==="t")renderTopicsIndex();
  else if(VIEW==="x")renderSearch();
  else if(VIEW==="rc")renderReception();
  else if(VIEW==="s")renderScripture(selBook,selCh);
  else if(VIEW==="q"){const t=topics.find(x=>x.t===selT);if(t)renderTopic(t);else renderWorks();}
  else renderWorks();
}
async function dossier(slug,topicName){return room(slug,topicName);}
/* ── work page ── */
const BNAME={"Gen":"Genesis","Ex":"Exodus","Lev":"Leviticus","Num":"Numbers","Deut":"Deuteronomy","Josh":"Joshua","Judg":"Judges","Ruth":"Ruth","1 Sam":"I Samuel","2 Sam":"II Samuel","1 Kgs":"I Kings","2 Kgs":"II Kings","1 Chr":"I Chronicles","2 Chr":"II Chronicles","Ezra":"Ezra","Neh":"Nehemiah","Esth":"Esther","Job":"Job","Ps":"Psalms","Prov":"Proverbs","Eccl":"Ecclesiastes","Song":"Song of Solomon","Isa":"Isaiah","Jer":"Jeremiah","Lam":"Lamentations","Ezek":"Ezekiel","Dan":"Daniel","Hos":"Hosea","Joel":"Joel","Amos":"Amos","Obad":"Obadiah","Jonah":"Jonah","Mic":"Micah","Nah":"Nahum","Hab":"Habakkuk","Zeph":"Zephaniah","Hag":"Haggai","Zech":"Zechariah","Mal":"Malachi","Matt":"Matthew","Mark":"Mark","Luke":"Luke","John":"John","Acts":"Acts","Rom":"Romans","1 Cor":"I Corinthians","2 Cor":"II Corinthians","Gal":"Galatians","Eph":"Ephesians","Phil":"Philippians","Col":"Colossians","1 Thess":"I Thessalonians","2 Thess":"II Thessalonians","1 Tim":"I Timothy","2 Tim":"II Timothy","Titus":"Titus","Phlm":"Philemon","Heb":"Hebrews","Jas":"James","1 Pet":"I Peter","2 Pet":"II Peter","1 John":"I John","2 John":"II John","3 John":"III John","Jude":"Jude","Rev":"Revelation","Wis":"Wisdom","Sir":"Sirach","Tob":"Tobit","Jdt":"Judith","Bar":"Baruch","1 Macc":"I Maccabees","2 Macc":"II Maccabees"};
async function workPage(dnum){
  const run=researchStart('research-work');
  const slug=/^\d+$/.test(String(dnum))?`pld-${dnum}`:String(dnum);   // only bare numbers are PL; named ED slugs pass through
  const [ins,catalogue]=await Promise.all([J(BLOB+`/v1/mine/work/${slug}.json`).catch(()=>null),getWorkCatalogue()]);if(run!==RESEARCH_RUN)return;
  const record=catalogue.bySlug.get(slug);let node=record?{t:record.title,a:record.author,v:record.volume}:null;
  if(!ins&&!node){const d2=await J(BLOB+"/v1/plresearch/constellations/works.json").catch(()=>null);
    node=d2&&d2.nodes.find(x=>String(x.d)===slug.replace(/^pld-/,""));
    if(!node){
      try{const ed=await gzJ(BLOB+"/v1/works-dir/ed.json.gz?d="+bust());
        const w3=ed.works.find(x=>x.w===slug);
        if(w3)node={t:w3.t,a:w3.a,v:null};}catch(_){}
      if(!node){page.innerHTML='<p class="loading">Not found.</p>';return;}}}
  let subj=null;try{subj=await J(BLOB+`/v1/mine/pld_subjects/${slug}.json`);}catch(_){}
  if(run!==RESEARCH_RUN)return;
  const T=catalogue.titles[slug]||(ins?ins.t:node.t), A=ins?ins.a:node.a, rawVolume=ins?ins.v:node.v;
  const V=record?RX.edition(record):rawVolume?(RX.seriesRef(rawVolume)?RX.edition({volume:String(rawVolume)}):slug.startsWith('pld-')&&/^\d+$/.test(String(rawVolume))?'PL '+rawVolume:String(rawVolume)):'';
  const HOWA={quotation:"quotes",explicit:"cites",allusion:"alludes"};
  const books=(ins&&ins.books||[]).map((b2,i)=>{
    const bmax2=Math.max(...ins.books.map(x=>x.n),1);
    const rows=(b2.rows||[]).map(r=>`<div class="vc" data-c="${r.c??""}">${r.how?`<span class="howtag">${esc(HOWA[r.how]||r.how)}</span>`:""}<span class="vref">${esc(BNAME[b2.b]||b2.b)} ${r.c??""}${r.v?":"+r.v:""}</span> · ${pgl(slug)} ${r.p??"?"} ${readBtn(slug,r.p)}</div>`).join("");
    const cm2=Math.max(...(b2.chs||[]).map(x=>x[1]),1);
    const chs=(b2.chs||[]).map(([c2,n2])=>`<button class="chp heat" data-c="${c2}" title="chapter ${c2} · ${n2} citations"><span>${c2}<span style="color:var(--faint)"> · ${n2}</span></span><em style="width:${Math.max(4,34*Math.sqrt(n2/cm2)).toFixed(0)}px"></em></button>`).join("");
    return `<details class="wdet"${i===0?" open":""}><summary><b>${esc(BNAME[b2.b]||b2.b)}</b><i style="width:${Math.max(3,100*Math.sqrt(b2.n/bmax2)*.4).toFixed(0)}%"></i><span class="n">${b2.n.toLocaleString()}</span></summary>
      ${chs?`<div style="margin:.3rem 0 .2rem">${chs}</div>`:""}
      <div class="vcits" style="margin-left:0">${rows}</div></details>`;}).join("");
  const topics=(ins&&ins.topics||[]).map((t2,i)=>{
    const pos=(t2.pos||[]).map(p2=>`<div class="ev" style="padding:.4rem 0"><div class="q" style="font-size:.93rem">${p2.s?`<span class="stance">${esc(p2.s)}</span>`:""}${escQ(p2.q)}</div>
      <div class="m"><span>${pgl(slug)} ${p2.p??"?"}</span>${readBtn(slug,p2.p)}${pinBtn(slug,p2.p,T,A,p2.q)}</div></div>`).join("");
    const pps=(t2.pp||[]).slice(0,16).map(c2=>`<span class="pill" style="font-size:.72rem;padding:.05rem .5rem">${c2}${readBtn(slug,c2)}</span>`).join("");
    return `<details class="wdet"${i===0?" open":""}><summary><b>${esc(t2.t)}</b><span class="n">${t2.n.toLocaleString()} pages</span></summary>
      ${pos||""}${pps?`<div style="margin:.3rem 0 .5rem">${pps}</div>`:""}</details>`;}).join("");
  const entries=(subj&&subj.entries||[]).map(en=>`<div class="ev"><div class="q" style="font-size:.92rem">${esc(en.t)}</div>
    <div class="m">${en.refs.slice(0,10).map(r=>`<span>${r.c}</span>`).join(" ")}
    ${en.refs[0]?readBtn(slug,en.refs[0].c):""}</div></div>`).join("");
  page.innerHTML=`
  <div class="crumbs"><a href="#${aslug(A)}">${esc(A)}</a></div>
  <div class="headline">${esc(T)}</div>
  <div class="deck"><a href="#${aslug(A)}">${esc(A)}</a>${V?` · ${esc(V)}`:""}${(await kinds(),kindOf(slug))?` · <span class="pill" style="font-size:.74rem;padding:.05rem .55rem">${KNAME[kindOf(slug)]}</span>`:""}</div>
  <div id="wcover"></div>
  <div class="stats">${ins?`<b>${ins.np.toLocaleString()}</b> pages · <b>${ins.ncit.toLocaleString()}</b> Scripture citations · `:""}
    <a class="railbtn" style="text-decoration:none;display:inline-block" href="${readerHref(slug)}">Open in the reader →</a></div>
  ${ins&&ins.lemma?(()=>{const bn2=BNAME[ins.lemma.b]||ins.lemma.b;const bs2=bn2.toLowerCase().replace(/^([i]{1,3}) /,(m2,r2)=>r2+"-").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
    return `<div class="pane-meta" style="margin:.3rem 0 .1rem">A commentary on <a href="/the-faith-received/bible/#b/${bs2}${ins.lemma.c?"/"+ins.lemma.c:""}">${esc(bn2)}${ins.lemma.c?" "+ins.lemma.c:""}</a> — its chapter holds this work among the commentators.</div>`;})():""}
  ${ins&&ins.quot&&ins.quot[0]?`<div class="sig" style="font-style:italic">&ldquo;${esc(ell(ins.quot[0][1]))}&rdquo; <span style="font-style:normal;font-size:.78rem;color:var(--faint)">${pgl(slug)} ${ins.quot[0][0]}</span></div>`:""}
  ${books?`<h2 class="sect">Its Scripture</h2>${books}`:""}
  ${topics?`<h2 class="sect">Its topics</h2>${topics}`:""}
  <div id="wauth"></div>
  ${entries?`<h2 class="sect">Subject index <span class="tn" style="font-family:var(--body);font-size:.75rem;color:var(--faint)">Migne's</span></h2>${entries}`:""}
  ${(!books&&!topics&&!entries)?'<p class="hint">Not yet mined.</p>':""}`;
  // the work's own FACE (2026-09-01): the title-page scan, floated beside the header —
  // one small meta fetch; families without a stored meta (PL) skip silently
  (async()=>{try{
    const m2=await J(BLOB+`/v1/works/${slug}/meta.json`);
    if(m2&&m2.img_base){
      $("#wcover").innerHTML=`<a href="${readerHref(slug,m2.title_page||1)}" title="Open at the title page">
        <img src="${m2.img_base}${m2.title_page||1}.webp" alt="${esc(T)} — title page" loading="lazy"
          style="float:right;width:132px;max-width:28vw;margin:-4.2rem 0 .8rem 1.1rem;border:1px solid var(--border2);border-radius:4px;box-shadow:0 8px 22px -12px rgba(0,0,0,.5)"></a>`;
    }}catch(_){}})();
  // ITS AUTHORITIES (owner 2026-08-26 'each work's web of scripture, authors, topics'):
  // whom THIS work cites, page by page — sliced from the author's full reception shard.
  (async()=>{try{
    const F=await gzJ(BLOB+"/v1/reception/full/"+aslug(A)+".json.gz?d="+bust());
    const mine=[];
    Object.entries(F.to||{}).forEach(([tk,g])=>{
      const rows=(g.rows||[]).filter(r2=>r2.w===slug);
      if(rows.length)mine.push({tk,a:g.a,rows});});
    mine.sort((a2,b2)=>b2.rows.length-a2.rows.length);
    if(!mine.length)return;
    const tot=mine.reduce((a2,b2)=>a2+b2.rows.length,0);
    $("#wauth").innerHTML=`<h2 class="sect">Its authorities <span class="tn" style="font-family:var(--body);font-size:.74rem;color:var(--faint)">${tot.toLocaleString()} resolved citations of ${mine.length} authors</span></h2>`+
      mine.slice(0,40).map((g,i)=>`<details class="wdet"${i===0?" open":""}><summary><b>${esc(g.a)}</b><i style="width:${Math.max(3,40*Math.sqrt(g.rows.length/mine[0].rows.length)).toFixed(0)}%"></i><span class="n">${g.rows.length}</span></summary>
        <div>${g.rows.slice(0,80).map(r2=>`<div class="m" style="margin:.25rem 0 0;flex-wrap:wrap"><span style="font-size:.85rem">${r2.loc?`<i>${esc(r2.loc)}</i>`:esc(r2.sf)}</span><span>${pgl(slug)} ${r2.p??"?"}</span>${readBtn(slug,r2.p)}<span style="color:var(--faint);font-size:.74rem">→ ${esc(tell(String((F.works||{})[r2.tw]||r2.tw)))}</span></div>`).join("")}
        ${g.rows.length>80?`<div style="color:var(--faint);font-size:.78rem;margin-top:.3rem">+ ${(g.rows.length-80).toLocaleString()} more in <a href="/the-faith-received/fathers/#${aslug(A)}/reception">${esc(A)}’s Reception</a></div>`:""}</div></details>`).join("");
  }catch(_){}})();
  page.addEventListener("click",e=>{
    const cp=e.target.closest(".wdet .chp[data-c]");if(!cp)return;
    const det=cp.closest(".wdet"),on=!cp.classList.contains("on");
    det.querySelectorAll(".chp[data-c]").forEach(x=>x.classList.remove("on"));
    if(on)cp.classList.add("on");
    det.querySelectorAll(".vc[data-c]").forEach(r=>{r.hidden=on&&r.dataset.c!==cp.dataset.c;});
  });
}
/* ── topic page: the corpus room — century band, era-nested authors, mine + Migne ── */
async function topicPage(slug){
 const run=researchStart('research-topic');
 let d=await J(BLOB+`/v1/mine/topic2-all/${slug}.json`).catch(()=>null)||await J(BLOB+`/v1/mine/topic2/${slug}.json`).catch(()=>null);
 let mg=null;if(!d){mg=await J(BLOB+`/v1/mine/pld_topic/${slug}.json`).catch(()=>null);if(mg)d={t:mg.t,s:slug,migne:slug,authors:[],pos:[]};}
 if(run!==RESEARCH_RUN)return;if(!d){researchError('This topic could not load');return;}
 const [ti,rooms,migne]=await Promise.all([J(BLOB+'/v1/mine/topic2-all/index.json').catch(()=>({topics:[]})),getRoster(),mg?Promise.resolve(mg):d.migne?J(BLOB+`/v1/mine/pld_topic/${d.migne}.json`).catch(()=>null):null]);if(run!==RESEARCH_RUN)return;mg=migne;
 const meta=(ti.topics||[]).find(x=>x.s===slug),all=RX.voices(d),selected=new Set();let limit=12,view='browse';
 // #slug?compare=a,b[,c] — a shareable comparison (pair page, positions, web hand authors over this way)
 const cmpWanted=(new URLSearchParams(location.hash.slice(1).split('?')[1]||'').get('compare')||'').split(',').map(x=>decodeURIComponent(x).trim()).filter(Boolean);
 const cmpKey=a=>a.s||(a.rooms&&a.rooms.length===1?a.rooms[0].s:'')||RX.fold(a.a);
 const writeCompare=()=>{const path=location.hash.slice(1).split('?')[0];const keys=[...selected].map(i=>cmpKey(all[i])).filter(Boolean);const h='#'+path+(keys.length?'?compare='+keys.map(encodeURIComponent).join(','):'');if(location.hash!==h)history.replaceState(null,'',location.pathname+location.search+h);};
 const evidenceState=new Map(),openedShelves=new Set(),openedAuthors=new Set(),shelfLimits=new Map(),passageLimits=new Map();
 // Room links use exact names only; never infer authorship from a shared name token.
 for(const a of all){a.rooms=rooms.rows.filter(r=>r.a===a.a);a.rows=a.rows.filter(r=>r.q||r.g);a.pageRows=[];}
 if(cmpWanted.length){all.forEach((a,i)=>{if(selected.size<3&&cmpWanted.some(k=>k===a.s||(a.rooms||[]).some(r=>r.s===k)||RX.fold(k)===RX.fold(a.a)))selected.add(i);});if(selected.size)view='compare';}
 let shelf=new URLSearchParams(location.search).get('sh')||'';if(!RX.shelves[shelf])shelf='';
 if(shelf)openedShelves.add(shelf);
 const pageState=new Map();
 const loadPageRefs=async a=>{
   if(pageState.get(a)?.loading||pageState.get(a)?.done)return;
   const state={loading:true,error:false,done:false};pageState.set(a,state);
   const room=a.s&&a.sh?a:a.rooms.length===1?a.rooms[0]:null;
   try{
     const [map,rd]=await Promise.all([a.sh?topicShelfMap(a.sh).catch(()=>null):null,room?J(BLOB+`/v1/bible/${room.sh}/rooms/${room.s}.json`).catch(()=>null):null]);
     if(run!==RESEARCH_RUN)return;
     const t=(rd?.topics||[]).find(t=>RX.fold(t.t)===RX.fold(d.t)),tslug=String(t?.t||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50);
     const full=t?.full?await J(BLOB+`/v1/bible/${room.sh}/rooms/t/${room.s}/${tslug}.json`).catch(()=>null):null;
     if(run!==RESEARCH_RUN)return;
     const titles=Object.fromEntries((rd?.works||[]).map(w=>[w.w,w.t]));
     a.pageRows=RX.mergePageRefs((full?.pages||t?.pages||[]).map(r=>({...r,wt:titles[r.w]||r.wt||r.t||r.w,a:a.a})),RX.mapAuthorPages(map?.nodes||[],d.t,a.a));
     state.error=(!map&&!!a.sh)||(!rd&&!!room)||(!!t?.full&&!full);state.done=!state.error;
   }catch(_){state.error=true;}finally{state.loading=false;}
 };
 if(shelf)await Promise.all(all.filter(a=>a.sh===shelf&&!a.np&&a.n>0).slice(0,12).map(loadPageRefs));
 if(run!==RESEARCH_RUN)return;
 const authorLink=a=>{const r=a.s?a:a.rooms.length===1?a.rooms[0]:null;return r?RX.authorURL(r,d.t):null;};
 // one evidence page (50 rows/cursor from /api/evidence), or every page to the end when `all`
 async function loadEvidence(i,all_=false){
   const a=all[i];if(!d.evidence||!a.id||!(a.np>0))return;const state=evidenceState.get(a.id)||{};if(state.loading||state.done)return;
   state.loading=true;state.error=false;evidenceState.set(a.id,state);render();
   try{do{
     const params=new URLSearchParams({snapshot:d.evidence.snapshot,topic:d.evidence.topic,author:a.id,limit:'50'});
     if(state.cursor)params.set('cursor',state.cursor);
     const response=await fetch('https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/evidence?'+params,{signal:AbortSignal.timeout(25000)});
     if(!response.ok)throw new Error('Evidence unavailable');const result=await response.json();
     if(run!==RESEARCH_RUN)return;
     if(result.snapshot_id!==d.evidence.snapshot||result.filters?.author_id!==a.id||!Array.isArray(result.items))throw new Error('Evidence selection changed');
     const previous=state.started?a.rows:[],seen=new Set(previous.map(r=>r.id));
     a.rows=previous.concat(result.items.filter(r=>!seen.has(r.id)));state.started=true;state.cursor=result.next_cursor;state.done=!result.has_more;
     if(all_&&!state.done)render();
   }while(all_&&!state.done);}
   catch(error){if(run!==RESEARCH_RUN)return;state.error=true;}
   state.loading=false;render();
 }
 // the compare tab loads every selected author's complete positions and linked pages by itself (owner 2026-09-09: no click to load)
 const loadCompared=()=>{[...selected].forEach(i=>{const a=all[i];loadPageRefs(a).then(()=>{if(run===RESEARCH_RUN)render();});loadEvidence(i,true);});};
 const excerpt=r=>statementHTML(r,{actions:true,annotation:true});
 page.innerHTML=`<div class="crumbs"><a id="topic-back" href="${RX.topicURL('',shelf)}">Browse ${shelf?esc(RX.shelves[shelf])+' topics':'topics'}</a></div><div class="rx-topic-heading"><h1>${esc(d.t)}</h1><a class="rx-text-link" href="/the-faith-received/web/#t=${encodeURIComponent(d.s||slug)}">View citation map</a></div>
 <details class="rx-coverage"><summary>About this evidence</summary><div>${RX.isRawTopic(d.t)?'<p class="rx-note">This is an unreviewed extraction label. Its passages remain available, but the label is not an established topic.</p>':''}<p>${d.n_pages!=null?`<strong>${fmtR(d.n_pages)}</strong> indexed pages · <strong>${fmtR(d.n_pos)}</strong> recorded positions${meta?.na?' · '+fmtR(meta.na)+' indexed authors':''}. `:''}<strong>${fmtR((d.pos||[]).length)}</strong> excerpts in the initial selection.${d.evidence?' Load each author’s complete indexed positions below.':''}</p><p>${d.evidence?'The initial view is a selection. Each author’s passages can be loaded in full from this dated snapshot.':'The export is a selection, not the whole index.'} Filters and comparisons apply to the excerpts currently loaded. A mined statement may summarize or translate a passage, including a reported view; read the source to establish its speaker and context. “Denies” and “qualifies” describe a local statement, not opposition to this topic. Linked pages below include summaries from author rooms and shelf indexes. A page summary describes the page; it is not a quotation or an extracted position.</p></div></details>
 <div class="rx-view-tabs" role="tablist" aria-label="Topic view"><button role="tab" id="topic-browse" aria-selected="true" aria-controls="topic-results">Browse passages</button><button role="tab" id="topic-compare" aria-selected="false" aria-controls="topic-results">Compare authors <span id="compare-number">0</span></button></div><div id="compare-tray" hidden><span id="compare-tray-count"></span><button id="compare-tray-open" class="rx-button">Compare authors</button></div>
 <div class="rx-filters"><label class="rx-search">Search available evidence<input id="tq" type="search" placeholder="Author, work, or phrase"></label><label class="rx-primary-filter">Shelf<select id="topic-shelf"><option value="">All shelves</option>${Object.entries(RX.shelves).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}<option value="unknown">Shelf not recorded</option></select></label><label>Order authors<select id="topic-order"><option value="pages">Available passages first</option><option value="name">Name A–Z</option><option value="date">Earlier authors first</option></select></label></div>
 <div class="rx-results-line"><p id="topic-count" role="status"></p><div class="rx-result-actions"><button class="rx-text-link" id="topic-collapse">Collapse all</button><button class="rx-text-link" id="topic-reset">Reset filters</button></div></div><p class="rx-note" id="compare-help">Select up to three authors to compare their available passages.</p><div id="topic-results" role="tabpanel"></div><button id="topic-more" class="rx-button rx-more">Show more authors</button>
 ${mg?`<details class="rx-historical"><summary>Read Migne’s index${mg.claims?.length?' · '+fmtR(mg.claims.length)+' entries':''}</summary><p class="rx-note">Historical index entries keep their own attribution. Similar author names are not merged.</p><div>${(mg.claims||[]).map(c=>`<article class="rx-excerpt"><p>${esc(c.q||'')}</p><div class="rx-source"><span>${esc(c.a||'Migne’s index')}</span>${RX.safeReaderURL(c.h)?`<a class="rx-text-link" href="${esc(RX.safeReaderURL(c.h))}">Read index passage</a>`:''}</div></article>`).join('')||'<p>No index statements are included in this export.</p>'}</div></details>`:''}`;
 researchLayout();$('#topic-shelf').value=shelf;$('#tq').value=new URLSearchParams(location.search).get('author')||'';
 const render=()=>{const q=RX.fold($('#tq').value),order=$('#topic-order').value;let hits=all.map((a,i)=>({...a,i,visible:[...a.rows,...a.pageRows.map(r=>({...r,pageSummary:true}))].filter(r=>!q||RX.fold(a.a+' '+(r.q||r.g||'')+' '+(r.wt||r.w||'')).includes(q))})).filter(a=>(!shelf||(shelf==='unknown'?!a.sh:a.sh===shelf))&&(!q||a.visible.length||RX.fold(a.a).includes(q)));
 hits.sort(order==='name'?(a,b)=>a.a.localeCompare(b.a):order==='date'?(a,b)=>(a.y||9999)-(b.y||9999)||(b.n||0)-(a.n||0):(a,b)=>Number(b.visible.length>0)-Number(a.visible.length>0)||(b.n||0)-(a.n||0)||a.a.localeCompare(b.a));
 $('.research-topic .rx-filters').hidden=view==='compare';$('#topic-reset').hidden=view==='compare';$('#topic-count').textContent=view==='compare'?selected.size+' selected authors · '+fmtR([...selected].reduce((n,i)=>n+all[i].rows.length+all[i].pageRows.length,0))+' available entries':fmtR(hits.length)+' matching authors · '+fmtR(hits.reduce((n,a)=>n+a.visible.filter(r=>!r.pageSummary).length,0))+' excerpts · '+fmtR(hits.reduce((n,a)=>n+a.visible.filter(r=>r.pageSummary).length,0))+' linked pages';$('#compare-number').textContent=selected.size;$('#compare-tray').hidden=!selected.size||view==='compare';$('#compare-tray-count').textContent=selected.size+' selected';$('#topic-compare').setAttribute('aria-selected',String(view==='compare'));$('#topic-browse').setAttribute('aria-selected',String(view==='browse'));$('#topic-results').className=view==='compare'?'rx-comparison':'rx-fold-list';$('#topic-more').hidden=true;$('#topic-collapse').hidden=view==='compare';
 const picks=view==='compare'?[...selected].map(i=>({...all[i],i,visible:[...all[i].rows,...all[i].pageRows.map(r=>({...r,pageSummary:true}))]})):hits;
 $('#compare-help').textContent=view==='compare'?'Comparing selected authors’ available excerpts. They may address different questions within this topic. Return to Browse passages to choose other authors.':shelf?'Open an author to read the available evidence. Select up to three to compare.':'Open a shelf to read its authors. Select up to three to compare.';
 const choice=a=>`<label class="rx-compare-choice"><input type="checkbox" aria-label="Compare ${esc(a.a)}" data-compare="${a.i}"${selected.has(a.i)?' checked':''}${selected.size>=3&&!selected.has(a.i)?' disabled':''}><span>${view==='compare'?'Keep in comparison':'Compare'}</span></label>`;
 const body=a=>{const link=authorLink(a);return `<div class="rx-voice-body">${a.visible.length?`<div class="rx-pane rx-voice-pane" data-voice-pane="${a.i}"></div>`:'<p class="rx-note">'+(pageState.get(all[a.i])?.loading?'Loading linked pages…':a.np?'Load this author’s indexed passages below.':'No extracted position is included. Linked source pages may be available below.')+'</p>'}${!a.np&&a.n>0&&!pageState.get(all[a.i])?.done?`<button class="rx-button" data-load-pages="${a.i}"${pageState.get(all[a.i])?.loading?' disabled':''}>${pageState.get(all[a.i])?.loading?'Loading pages…':pageState.get(all[a.i])?.error?'Retry linked pages':'Load linked pages'}</button>`:''}${d.evidence&&a.id&&a.np>0?`<div class="rx-evidence-loader"><p class="rx-note" role="status">${evidenceState.get(a.id)?.error?'Passages could not load. Your current selection is preserved.':evidenceState.get(a.id)?.started?fmtR(a.rows.length)+' of '+fmtR(a.np)+' positions loaded':fmtR(a.np)+' positions available for this author'}</p>${!evidenceState.get(a.id)?.done?`<button class="rx-button" data-load-evidence="${a.i}"${evidenceState.get(a.id)?.loading?' disabled':''}>${evidenceState.get(a.id)?.loading?'Loading passages…':evidenceState.get(a.id)?.error?'Retry passages':evidenceState.get(a.id)?.started?'Load more passages':'Load indexed passages'}</button>`:''}</div>`:''}${link?`<a class="rx-room-link" href="${link}">Explore ${esc(a.a)} on ${esc(d.t)}</a>`:a.rooms.length?`<div class="rx-room-link">Browse this author’s shelves: ${a.rooms.map(r=>`<a href="${RX.authorURL(r,d.t)}">${esc(RX.shelves[r.sh])}</a>`).join(' · ')}</div>`:''}</div>`;};
 const voice=a=>view==='compare'?`<section class="rx-voice"><header><div><h2>${esc(a.a)}</h2><p class="rx-note">${a.y?'c. '+a.y+' · ':''}${esc(RX.shelves[a.sh]||'Shelf not recorded')}</p></div>${choice(a)}</header>${body(a)}</section>`:`<div class="rx-voice-item"><details class="rx-fold rx-author-fold" data-topic-author="${a.i}"${openedAuthors.has(a.i)?' open':''}><summary><span><strong>${esc(a.a)}</strong><small>${a.y?'c. '+a.y+' · ':''}${a.n!=null?fmtR(a.n)+' indexed pages · ':''}${fmtR(a.visible.filter(r=>!r.pageSummary).length)} excerpts${a.visible.some(r=>r.pageSummary)?' · '+fmtR(a.visible.filter(r=>r.pageSummary).length)+' linked pages':''}</small></span></summary>${body(a)}</details>${choice(a)}</div>`;
 if(view==='compare'){const sl=[...selected].map(i=>{const a=all[i];return a.s?a:(a.rooms||[]).length===1?a.rooms[0]:null;}),tsl=tslugOf(d.t);
   const deskLink=sl.filter(Boolean).length?`<a class="rx-button cd-open" href="${cdURL({a:sl.filter(Boolean).map(x=>x.s),sel:slug,g:'work',s:'',q:''})}">Open in the comparison desk</a> `:'';
   const tools=sl.length===2&&sl[0]&&sl[1]?`<p class="rx-compare-links">${deskLink}<a class="rx-text-link" href="/the-faith-received/fathers/?sh=${encodeURIComponent(sl[0].sh)}#${encodeURIComponent(sl[0].s)}/with/${encodeURIComponent(sl[1].s)}/topic/${encodeURIComponent(tsl)}">Full comparison: every citation between them, all shared topics, Scripture</a> · <a class="rx-text-link" href="/the-faith-received/fathers/?sh=${encodeURIComponent(sl[0].sh)}&cmp=${encodeURIComponent(sl[1].s)}#${encodeURIComponent(sl[0].s)}/positions/${encodeURIComponent(d.t)}">${esc(sl[0].a)}’s positions with ${esc(sl[1].a)} beside them</a> · <a class="rx-text-link" href="/the-faith-received/web/#e=${encodeURIComponent(sl[0].s)},${encodeURIComponent(sl[1].s)}">${esc(sl[0].a)} citing ${esc(sl[1].a)} in the citation web</a></p>`:sl.length===1&&sl[0]?`<p class="rx-compare-links">${deskLink}<a class="rx-text-link" href="/the-faith-received/fathers/?sh=${encodeURIComponent(sl[0].sh)}#${encodeURIComponent(sl[0].s)}/with">Compare ${esc(sl[0].a)} with any author</a> · <a class="rx-text-link" href="${RX.authorURL(sl[0],d.t)}">${esc(sl[0].a)}’s positions on ${esc(d.t)}</a></p>`:'';
   $('#topic-results').innerHTML=tools+(picks.map(voice).join('')||'<div class="rx-empty"><h2>Choose authors to compare</h2><p>Return to Browse passages and select two or three authors.</p><button id="compare-back" class="rx-button">Browse passages</button></div>');}
 else{const groups=new Map();for(const a of picks){const key=a.sh||'unknown';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(a);}
 $('#topic-results').innerHTML=[...Object.keys(RX.shelves),'unknown'].filter(sh=>groups.has(sh)).map(sh=>{const group=groups.get(sh);return `<details class="rx-fold rx-topic-shelf" data-topic-shelf="${sh}"${openedShelves.has(sh)?' open':''}><summary><span><strong>${esc(RX.shelves[sh]||'Shelf not recorded')}</strong><small>${group.slice(0,2).map(a=>esc(a.a)).join(' · ')}</small></span><span class="rx-fold-count">${fmtR(group.length)} ${group.length===1?'author':'authors'}</span></summary><div class="rx-fold-body rx-pane rx-topic-authors" data-shelf-pane="${sh}"></div></details>`;}).join('')||'<div class="rx-empty"><h2>No matching passages</h2><p>Try another phrase or reset the filters. This search covers the evidence currently loaded.</p></div>';
 }
 $('#topic-results').querySelectorAll('[data-shelf-pane]').forEach(box=>{const sh=box.dataset.shelfPane,group=picks.filter(a=>(a.sh||'unknown')===sh);if(openedShelves.has(sh))paneList(box,group,voice,40);else box.dataset.pending='1';});
 $('#topic-results').querySelectorAll('[data-voice-pane]').forEach(box=>{const a=picks.find(x=>x.i===+box.dataset.voicePane);if(a)statementPane(box,a.visible,{actions:true,annotation:true});});
 if($('#compare-back'))$('#compare-back').onclick=()=>{view='browse';render();};
 };
 // delegated: rows arrive in chunks inside panes, so handlers live on the results container
 $('#topic-results').addEventListener('change',e=>{const el=e.target.closest('[data-compare]');if(!el)return;const i=+el.dataset.compare;if(el.checked&&selected.size<3)selected.add(i);else selected.delete(i);writeCompare();render();if(view==='compare')loadCompared();$('[data-compare="'+i+'"]')?.focus({preventScroll:true});});
 $('#topic-results').addEventListener('click',async e=>{const lp=e.target.closest('[data-load-pages]');if(lp){const a=all[+lp.dataset.loadPages];const pending=loadPageRefs(a);render();await pending;if(run===RESEARCH_RUN)render();return;}
   const le=e.target.closest('[data-load-evidence]');if(le){const i=+le.dataset.loadEvidence;loadEvidence(i,true).then(()=>$('[data-load-evidence="'+i+'"]')?.focus({preventScroll:true}));}});
 $('#topic-results').addEventListener('toggle',e=>{const el=e.target;if(!el.isConnected)return;if(el.matches('[data-topic-shelf]')){if(el.open)openedShelves.add(el.dataset.topicShelf);else openedShelves.delete(el.dataset.topicShelf);const box=el.querySelector('[data-shelf-pane]');if(el.open&&box&&box.dataset.pending){delete box.dataset.pending;const sh=box.dataset.shelfPane;render();}}if(el.matches('[data-topic-author]')){const i=+el.dataset.topicAuthor;if(el.open){openedAuthors.add(i);const a=all[i];if(!a.np&&a.n>0&&!pageState.get(a)){loadPageRefs(a).then(()=>{if(run===RESEARCH_RUN)render();});}}else openedAuthors.delete(i);}},true);
 $('#topic-collapse').onclick=()=>{openedShelves.clear();openedAuthors.clear();$('#topic-results').querySelectorAll('details[open]').forEach(el=>el.open=false);};
 addEventListener('fr-sections-ready',()=>{if(run===RESEARCH_RUN)render();},{signal:researchEvents.signal});
 $('#tq').oninput=()=>{shelfLimits.clear();render();};$('#topic-shelf').onchange=e=>{shelf=e.target.value;setTopicShelf(shelf);$('#topic-back').href=RX.topicURL('',shelf);$('#topic-back').textContent=shelf?'Browse '+RX.shelves[shelf]+' topics':'Browse topics';if(shelf)openedShelves.add(shelf);limit=12;render();};$('#topic-order').onchange=()=>{limit=12;render();};$('#topic-more').onclick=()=>{limit+=12;render();};$('#topic-reset').onclick=()=>{$('#tq').value='';shelf='';setTopicShelf('');$('#topic-back').href='/the-faith-received/topics/';$('#topic-back').textContent='Browse topics';$('#topic-shelf').value='';limit=12;render();};$('#topic-browse').onclick=()=>{view='browse';render();};$('#topic-compare').onclick=()=>{view='compare';render();loadCompared();};$('#compare-tray-open').onclick=()=>{view='compare';render();loadCompared();$('#topic-compare').focus();};render();
 if(view==='compare')loadCompared();
}

/* ── scripture ── */
function rowHTML(r){
  return `<div class="x" style="border-bottom:0;padding:.24rem 0">
    ${r.g?`<div class="q" style="font-size:.86rem;color:var(--muted)">${esc(ell(r.g))}</div>`:""}
    <div class="m"><span class="dot ${esc(eraOf(r))}" style="width:7px;height:7px;border-radius:50%"></span>
    <a style="font-weight:600" href="/the-faith-received/fathers/#${aslug(r.a)}">${esc(aName(r.a))}</a> <span class="wk">${esc(tell(r.t))}</span>
    ${r.vv?`<span>vv. ${r.vv[0]}–${r.vv[1]}</span>`:""}
    ${readBtn(r.w,r.p)}<a href="${esc(r.h)}" target="_blank" rel="noopener">${r.p?(pgl(r.w)+" "+r.p):"reader"} →</a>${pinBtn(r.w,r.p,r.t,r.a,r.g||"")}</div></div>`;
}
function panelHTML(rows,total,hl,opts={}){
  // the verse's commentators as a HISTORY (owner 2026-08-25): era → author → works. EVERYTHING COLLAPSIBLE AND
  // SCROLLABLE (owner 2026-09-10 "i want to scroll everything all collapsible … want to see it all"): eras fold,
  // authors fold, an author's rows fold by work; the panel is a bounded pane; the rows beyond the shard's cap
  // load on demand from the chapter's companion shard ("Load all").
  const HOWA2={quotation:"quotes",explicit:"cites",allusion:"alludes"};
  rows=rows.filter(facOK);
  const byE={};for(const r of rows){const e2=eraOf(r);(byE[e2]=byE[e2]||[]).push(r);}
  if(!rows.length)return `<p class="scripture-status">No passages match the current source filters${total>0?' among the '+total.toLocaleString()+' loaded':''}.${total>rows.length&&opts.key!=null&&!opts.full?` <button type="button" class="rx-text-link" data-load-all="${esc(String(opts.key))}">Load all ${total.toLocaleString()} and look again</button>`:''}</p>`;
  const rowH=r=>`<div class="vpr">${r.how?`<span class="howtag">${HOWA2[r.how]||r.how}</span>`:""}<span class="wk">${esc(tell(r.t))}</span>
          ${r.vv?`<span class="hint">vv. ${r.vv[0]}–${r.vv[1]}</span>`:""}
          <span class="hint">${pgl(r.w)} ${r.p??"—"}</span>${readBtn(r.w,r.p,hl)}${pinBtn(r.w,r.p,r.t,r.a,r.g||"")}
          ${r.g?`<div class="vpg">${esc(ell(r.g))}</div>`:""}</div>`;
  let out="";
  for(const e of ["E","L","C","H","R","P"]){
    const rs=byE[e];if(!rs||!rs.length)continue;
    const byA={};rs.forEach(r=>{(byA[r.a]=byA[r.a]||[]).push(r);});
    const authors=Object.entries(byA).sort((x,y)=>(wOf(y[0])-wOf(x[0]))||(y[1].length-x[1].length)).map(([a2,ars])=>{
      const sorted=ars.slice().sort((x,y)=>String(x.t).localeCompare(String(y.t))||((x.p||0)-(y.p||0)));
      const byW=new Map();sorted.forEach(r=>{if(!byW.has(r.w))byW.set(r.w,[]);byW.get(r.w).push(r);});
      const body=byW.size>1&&sorted.length>4
        ?[...byW.entries()].sort((x,y)=>y[1].length-x[1].length).map(([w,ws],i)=>`<details class="cd-work vpw"${i===0?' open':''}><summary><span><strong>${esc(tell(ws[0].t))}</strong></span><small class="cd-n">${ws.length}</small>${w?` <a class="rx-text-link cd-read" href="${readerHref(w)}" onclick="event.stopPropagation()">open the work</a>${workSaveBtn(w,ws[0].t,a2)}`:''}</summary>${ws.map(rowH).join('')}</details>`).join('')
        :sorted.map(rowH).join('');
      const head=`<a class="vpa" href="/the-faith-received/fathers/#${aslug(a2)}">${esc(aName(a2))}</a>${ars.length>1?`<span class="n">${ars.length}</span>`:""}`;
      return `<details class="vpd"${ars.length<=3?" open":""}><summary>${head}</summary>${body}</details>`;}).join("");
    out+=`<details class="vpe-fold" open><summary class="vpe"><span class="dot ${e}"></span>${ERAL[e]||e}<span class="n">${rs.length}</span><small>${Object.keys(byA).length} ${Object.keys(byA).length===1?'author':'authors'}</small></summary>${authors}</details>`;
  }
  const foot=total>rows.length?`<p class="scripture-status">Showing ${rows.length.toLocaleString()} of ${total.toLocaleString()} indexed citations in this ${opts.key==='ch'?'chapter':'verse'}${opts.full?' (the rest are hidden by the source filters)':''}. ${opts.key!=null&&!opts.full?`<button type="button" class="rx-text-link" data-load-all="${esc(String(opts.key))}">Load all ${total.toLocaleString()}</button>`:''}</p>`:'';
  return `<div class="vpanel-pane rx-pane">${out}</div>${foot}`;
}
let glossEl=null,glossT=null;
function hideGloss(delay=200){clearTimeout(glossT);glossT=setTimeout(()=>{if(glossEl){glossEl.remove();glossEl=null;}},delay);}
/* passage jump (owner 2026-08-25 'easy for a pastor'): "Rom 8:28" → the chapter, verse open */
let JUMPV=null;
const JABBR={gen:"Genesis",ex:"Exodus",exod:"Exodus",lev:"Leviticus",num:"Numbers",deut:"Deuteronomy",dt:"Deuteronomy",josh:"Joshua",judg:"Judges",sam:"Samuel",kgs:"Kings",chr:"Chronicles",chron:"Chronicles",neh:"Nehemiah",esth:"Esther",ps:"Psalms",psa:"Psalms",psalm:"Psalms",prov:"Proverbs",eccl:"Ecclesiastes",song:"Song of Solomon",cant:"Song of Solomon",isa:"Isaiah",jer:"Jeremiah",lam:"Lamentations",ezek:"Ezekiel",dan:"Daniel",hos:"Hosea",obad:"Obadiah",jon:"Jonah",mic:"Micah",nah:"Nahum",hab:"Habakkuk",zeph:"Zephaniah",hag:"Haggai",zech:"Zechariah",zach:"Zechariah",mal:"Malachi",mt:"Matthew",matt:"Matthew",mk:"Mark",lk:"Luke",jn:"John",rom:"Romans",cor:"Corinthians",gal:"Galatians",eph:"Ephesians",phil:"Philippians",col:"Colossians",thess:"Thessalonians",tim:"Timothy",tit:"Titus",phlm:"Philemon",heb:"Hebrews",jas:"James",pet:"Peter",rev:"Revelation of John",apoc:"Revelation of John",wis:"Wisdom",sap:"Wisdom",sir:"Sirach",eccli:"Sirach",ecclus:"Sirach",tob:"Tobit",jdt:"Judith",bar:"Baruch",macc:"Maccabees",mach:"Maccabees"};
function jumpParse(q,books){
  const m=String(q).trim().match(/^([123]|I{1,3}(?=\s))?\s*\.?\s*([A-Za-z .']+?)\s*(\d{1,3})?(?:\s*[:.,]\s*(\d{1,3}))?$/);
  if(!m||!m[2])return null;
  const fold=s2=>String(s2).toLowerCase().replace(/[^a-z0-9]/g,"");
  const pfx=m[1]?({1:"i",2:"ii",3:"iii",i:"i",ii:"ii",iii:"iii"}[String(m[1]).toLowerCase()]):"";
  const raw=m[2].replace(/[.']/g," ").trim().toLowerCase();
  const ab=JABBR[raw.replace(/\s+/g,"")];
  const want=fold((pfx?pfx+" ":"")+(ab||raw));
  let B=books.find(b=>fold(b.book)===want)||books.find(b=>fold(b.book).startsWith(want));
  if(!B&&ab&&!pfx)B=books.find(b=>fold(b.book)===fold(ab));
  if(!B)return null;
  if(B.chapters?.length===1&&m[3]&&!m[4]&&+m[3]>1)return {slug:B.slug,ch:1,v:+m[3]};
  return {slug:B.slug,ch:m[3]?+m[3]:0,v:m[4]?+m[4]:null};
}
let BIBLE_STATE={view:'read',verse:null},BIBLE_RUN=0;
function bibleNav(books,B,ch){
  const i=books.indexOf(B),chapters=B?.chapters||[];
  const prev=ch?(chapters.find(x=>x.c===ch-1)?[B.slug,ch-1]:i>0?[books[i-1].slug,books[i-1].chapters.at(-1).c]:null):null;
  const next=ch?(chapters.find(x=>x.c===ch+1)?[B.slug,ch+1]:i<books.length-1?[books[i+1].slug,books[i+1].chapters[0].c]:null):null;
  return `<form class="bible-jump" id="bible-jump"><label for="jgo">Go to a passage</label><div><input id="jgo" type="search" autocomplete="off" placeholder="Romans 8:28" aria-describedby="jump-feedback"><button type="submit">Open passage</button></div><p id="jump-feedback" role="status"></p></form>`+(B?`<nav class="bible-nav" aria-label="Bible navigation"><label>Book<select id="bible-book">${books.map(b=>`<option value="${esc(b.slug)}"${b.slug===B.slug?' selected':''}>${esc(b.book)}</option>`).join('')}</select></label><label>Chapter<select id="bible-chapter"><option value="0">Overview</option>${chapters.map(x=>`<option value="${x.c}"${x.c===ch?' selected':''}>${x.c}</option>`).join('')}</select></label>${prev?`<a href="${FRScripture.bibleURL(...prev)}" aria-label="Previous chapter">Previous</a>`:''}${next?`<a href="${FRScripture.bibleURL(...next)}" aria-label="Next chapter">Next</a>`:''}</nav>`:'');
}
function bindBibleNav(books,B,ch){
  const form=$('#bible-jump');form.onsubmit=e=>{e.preventDefault();const r=jumpParse($('#jgo').value,books),b=r&&books.find(x=>x.slug===r.slug);
    if(!r||r.ch&&!b.chapters.some(x=>x.c===r.ch)||r.v&&(!r.ch||r.v<1)){$('#jump-feedback').textContent='Enter a book and chapter, such as Romans 8:28.';$('#jgo').setAttribute('aria-invalid','true');return;}
    const dest=FRScripture.bibleURL(r.slug,r.ch,r.v);if(location.hash.slice(1)===dest.split('#')[1])route();else location.hash=dest.split('#')[1];};
  if(B){$('#bible-book').onchange=e=>location.hash='b/'+e.target.value+'/1';$('#bible-chapter').onchange=e=>location.hash='b/'+B.slug+(+e.target.value?'/'+e.target.value:'');}
}
function scriptureFacets(){return `<details class="bible-filters"><summary>Filter sources${FACS.size?' · '+FACS.size+' selected':''}</summary>${facBar()}</details>`;}
async function bibleHome(){
  const run=++BIBLE_RUN;page.className='scripture-page';page.innerHTML='<p class="loading" role="status">Loading the Bible…</p>';
  const d=await J(BLOB+'/v1/bible/all/books.json');if(run!==BIBLE_RUN)return;
  const NT=new Set(['Matthew','Mark','Luke','John','Acts','Romans','I Corinthians','II Corinthians','Galatians','Ephesians','Philippians','Colossians','I Thessalonians','II Thessalonians','I Timothy','II Timothy','Titus','Philemon','Hebrews','James','I Peter','II Peter','I John','II John','III John','Jude','Revelation of John']);
  const groups={ot:[],nt:[],dc:[]};d.books.forEach(b=>groups[b.txt?'dc':NT.has(b.book)?'nt':'ot'].push(b));
  const grid=(id,title,rows)=>`<section id="${id}" class="bible-books"><h2>${title}</h2><div class="bookgrid">${rows.map(b=>`<a class="bk" href="#b/${esc(b.slug)}"><span class="t">${esc(b.book)}</span><span class="n">${b.chapters.length} ${b.chapters.length===1?'chapter':'chapters'}</span></a>`).join('')}</div></section>`;
  page.innerHTML=`<h1 class="index">Scripture</h1><p class="bible-intro">Read a chapter, explore its citations, and open the commentaries alongside the text.</p>${bibleNav(d.books)}<nav class="bible-sections" aria-label="Testaments"><a href="#old-testament">Old Testament</a><a href="#new-testament">New Testament</a><a href="#deuterocanon">Deuterocanon</a></nav>${grid('old-testament','Old Testament',groups.ot)}${grid('new-testament','New Testament',groups.nt)}${grid('deuterocanon','Deuterocanon',groups.dc)}<p class="hint">${esc(d.text)}</p>`;
  bindBibleNav(d.books);
  page.querySelectorAll('.bible-sections a').forEach(a=>a.onclick=e=>{e.preventDefault();document.getElementById(a.hash.slice(1)).scrollIntoView({block:'start'});});
}
async function bookPage(bslug,c,afilt){
  if(afilt)return bookPageAuthor(bslug,c,afilt);
  return bookPageMain(bslug,c);
}
async function bookPageAuthor(bslug,c,aslg){
  page.className="scripture-page";page.innerHTML='<p class="loading">Loading passages…</p>';
  const [bk,B2]=await Promise.all([J(BLOB+"/v1/bible/all/books.json"),
    gzJ(BLOB+`/v1/bible/all/a2/${aslg}.json.gz`).catch(()=>null)]);
  const prof=B2&&B2.profile;
  const B=bk.books.find(b=>b.slug===bslug);
  const ab=B&&B2&&B2.books[bslug]?{a:prof.a,book:B.book,rows:B2.books[bslug]}:null;
  if(!B||!ab){page.innerHTML='<p class="loading">Not found.</p>';return;}
  const rows=ab.rows.filter(r=>r.c===c);
  const byv={};for(const r of rows)if(r.v)for(let vx=r.v;vx<=(r.vv?r.vv[1]:r.v);vx++)(byv[vx]=byv[vx]||[]).push(r);
  const chrows=rows.filter(r=>!r.v);
  const d=await gzJ(BLOB+`/v1/bible/all/${bslug}/${c}.json.gz`);
  const chn={};for(const x of (prof?prof.chapters:[]))if(x.book===ab.book)chn[x.c]=x.n;
  const _esv2=await esvChapter(ab.book,c);
  const _vt2=v=>(_esv2&&_esv2[String(v.v)])||v.t;
  const verses=d.verses.map(v=>{
    const mine=byv[v.v]||[];
    const badge=mine.length?`<span class="badge" data-v="${v.v}">${mine.length}</span>`:"";
    return `<div class="vv"><span class="no">${v.v}</span><span class="txt" ${mine.length?`data-v="${v.v}"`:""} ${mine.length?"":'style="color:var(--faint)"'}>${esc(_vt2(v))}${badge}</span><div id="pv${v.v}"></div></div>`;
  }).join("");
  page.innerHTML=`
  <div class="crumbs"><a href="/the-faith-received/fathers/#${aslg}">${esc(ab.a)}</a> · <a href="#b/${bslug}/${c}">${esc(ab.book)} ${c}</a></div>
  <div class="headline">${esc(ab.a)} on ${esc(ab.book)} <span style="font-family:var(--body);font-size:.85em">${c}</span></div>
  ${bibleNav(bk.books,B,c)}<div class="stats"><b>${rows.length}</b> citations in this chapter ·
    <a href="#b/${bslug}/${c}">all authors</a></div>
  ${chrows.length?`<span class="badge" data-ch="1" style="font-size:.8rem;color:var(--accent-soft);cursor:pointer">§ On the whole chapter · ${chrows.length}</span><div id="pvch"></div>`:""}
  <div style="margin-top:.7rem">${verses}</div>`;
  bindBibleNav(bk.books,B,c);
  page.onclick=e=>{
    if(e.target.closest(".readbtn"))return;
    const tc=e.target.closest("[data-ch]");
    if(tc){const pv=$("#pvch");pv.innerHTML=pv.innerHTML?"":`<div class="vpanel">${panelHTML(chrows,chrows.length,mkHl(ab.book,c,0))}</div>`;return;}
    const t2=e.target.closest("[data-v]");if(!t2||e.target.closest("a"))return;
    const vn=+t2.dataset.v,mine=byv[vn];if(!mine)return;
    const pv=$("#pv"+vn);
    pv.innerHTML=pv.innerHTML?"":`<div class="vpanel">${panelHTML(mine,mine.length,mkHl(ab.book,c,vn))}</div>`;
  };
}
async function bookPageMain(bslug,c){
  const run=++BIBLE_RUN;page.className='scripture-page';page.innerHTML='<p class="loading" role="status">Loading Scripture and its sources…</p>';
  const [bk,,catalog]=await Promise.all([J(BLOB+'/v1/bible/all/books.json'),devotion(),FRScripture.catalogue().catch(()=>[])]);if(run!==BIBLE_RUN)return;
  const B=bk.books.find(b=>b.slug===bslug);
  if(!B||c&&!B.chapters.some(x=>x.c===c)){page.innerHTML='<h1>Passage not found</h1><p>Choose an available book and chapter.</p><a href="/the-faith-received/bible/">Browse Scripture</a>';return;}
  const sourceShelf=e=>e.sh==='x'?({'Reformed':'rf','Continental Reformed':'rf','Roman Catholic':'rc','Lutheran':'lu','Medieval':'md','English Divines':'ed','Humanism & Law':'hl','Humanism and Law':'hl'}[e.tr]||e.sh):e.sh;
  const catalogMap=new Map(catalog.map(w=>[w.slug,w]));
  const entries=((DEVO&&DEVO.books&&DEVO.books[bslug])||[]).map(e=>{const w=catalogMap.get(e.w);return w?{...e,t:w.title||e.t,a:w.author||e.a}:e;}).filter(e=>facOK({...e,sh:sourceShelf(e)}));
  const dedicated=entries.filter(e=>!e.wb&&(!c||!e.c1||e.c1<=c&&c<=(e.c2||e.c1)));
  const annot=entries.filter(e=>e.wb),seen=new Set();
  const annotations=annot.filter(e=>{const k=FRScripture.family(e.w);if(seen.has(k))return false;seen.add(k);return true;});
  const dedicatedHTML=dedicated.map(e=>{const anchor=(c&&e.an&&e.an[c])||e.sp;return `<article class="scripture-work"><div><a class="work-title" href="${readerHref(e.w,anchor)}" target="_blank" rel="noopener">${esc(e.t)}</a><span>${esc(aName(e.a))}</span><small>${e.c1?'Chapters '+e.c1+(e.c2!==e.c1?'–'+e.c2:''):(KNAME[e.k]||'Commentary')}</small></div><div class="work-actions">${anchor?readBtn(e.w,anchor):`<a class="readbtn" href="${readerHref(e.w)}" target="_blank" rel="noopener">Browse work</a>`}</div></article>`;}).join('');
  const annotHTML=annotations.map((e,i)=>`<details class="annotation-set" data-annotation="${i}"><summary><span><strong>${esc(e.t)}</strong><small>${esc(aName(e.a))}</small></span><span class="annotation-action">Find passage</span></summary><div class="annotation-destinations"></div></details>`).join('');
  let d=null,esv=null;if(c){[d,esv]=await Promise.all([gzJ(BLOB+`/v1/bible/all/${bslug}/${c}.json.gz`),esvChapter(B.book,c)]);if(run!==BIBLE_RUN)return;}
  const view=c?(BIBLE_STATE.view||'read'):(BIBLE_STATE.view==='annotations'?'annotations':'commentaries');
  const tabs=[...(c?[['read','Read chapter'],['desk','Reading desk']]:[]),['commentaries','Commentaries'],['annotations','Annotations']];
  const verses=d?(d.verses||[]).map(v=>{const n=facAll()?(v.n||0):(v.rows||[]).filter(facOK).length;return `<article class="vv" id="v${v.v}"><a class="no" href="${FRScripture.bibleURL(bslug,c,v.v)}" aria-label="Link to ${esc(B.book)} ${c}:${v.v}">${v.v}</a><div class="txt">${esc(esv?.[String(v.v)]||v.t)}${n?`<button class="verse-citations" data-v="${v.v}" aria-expanded="false" aria-controls="pv${v.v}">${n.toLocaleString()} citations</button>`:'<span class="verse-empty">'+(!facAll()&&v.n?'No citations match these filters':'No indexed citations')+'</span>'}<button type="button" class="verse-desk-link" data-open-desk="${v.v}">Open verse desk</button></div><div class="verse-panel" id="pv${v.v}"></div></article>`;}).join(''):'';
  page.innerHTML=`<div class="crumbs"><a href="/the-faith-received/bible/">Scripture</a>${c?` · <a href="#b/${bslug}">${esc(B.book)}</a>`:''}</div><h1 class="headline">${esc(B.book)}${c?' '+c:''}</h1>${bibleNav(bk.books,B,c)}${scriptureFacets()}${!c?`<section class="bible-chapter-grid" aria-label="Choose a chapter"><h2>Choose a chapter</h2><div>${B.chapters.map(x=>`<a href="#b/${bslug}/${x.c}" aria-label="${esc(B.book)} ${x.c}">${x.c}</a>`).join('')}</div></section>`:''}<nav class="scripture-tabs" aria-label="Chapter views">${tabs.map(([k,label])=>`<button data-bible-view="${k}" aria-pressed="${view===k}">${label}${k==='read'||k==='desk'?'':` <span>${k==='annotations'?annotations.length:dedicated.length}</span>`}</button>`).join('')}</nav>
  ${c?`<section class="bible-pane" data-pane="read"${view==='read'?'':' hidden'}><div class="bible-reading-tools"><span>${esv?'English Standard Version':B.txt?'Douay-Rheims':'American Standard Version'}</span><a href="/the-faith-received/web/#v=${bslug}/${c}">Explore connections</a><button id="ask-chapter">Ask about chapter</button></div><p id="verse-feedback" role="status"></p>${d.ch_rows?.length?`<button class="chapter-citations" data-ch="1" aria-expanded="false">Whole-chapter citations · ${(facAll()?d.ch_n:d.ch_rows.filter(facOK).length)||0}</button><div id="pvch"></div>`:''}<div class="bible-verses">${verses}</div><nav class="bible-end-nav" aria-label="Continue reading">${c>1?`<a href="#b/${bslug}/${c-1}">Previous chapter</a>`:""}<a href="#b/${bslug}">Choose chapter</a>${B.chapters.some(x=>x.c===c+1)?`<a href="#b/${bslug}/${c+1}">Next chapter</a>`:""}</nav></section>`:''}
  ${c?`<section class="bible-pane" data-pane="desk"${view==='desk'?'':' hidden'}><div id="verse-research-desk"></div></section>`:''}
  <section class="bible-pane" data-pane="commentaries"${view==='commentaries'?'':' hidden'}><h2>Commentaries on ${esc(B.book)}${c?' '+c:''}</h2><p class="scripture-status">Open a work or preview its passage here.</p>${dedicatedHTML||'<p class="scripture-status">No dedicated works match the current source filters.</p>'}</section>
  <section class="bible-pane" data-pane="annotations"${view==='annotations'?'':' hidden'}><h2>Whole-Bible annotations</h2><p class="scripture-status">Choose a work to find ${esc(B.book)}${c?' '+c:''} in its available volumes. Book and chapter links follow the volume’s table of contents. Where contents are unavailable, indexed citations can lead to a passage.</p>${annotHTML||'<p class="scripture-status">No annotation sets match the current source filters.</p>'}</section>`;
  bindBibleNav(bk.books,B,c);
  let verseDesk=null;
  const loadVerseDesk=()=>{if(!c||verseDesk)return;verseDesk=FRVerseResearch.mount($('#verse-research-desk'),{book:B,chapter:c,verses:d.verses||[],books:bk.books,catalogue:catalog,verse:BIBLE_STATE.verse,eligible:facOK,changePassage:()=>{const control=$('#jgo')||$('#bible-book');control?.focus({preventScroll:true});control?.scrollIntoView({block:'center'});},inheritedFilters:[...FACS].map(k=>FACL.find(x=>x[0]===k)?.[1]||k),changeSourceFilters:()=>{const filters=page.querySelector('.bible-filters');if(filters){filters.open=true;filters.querySelector('summary')?.focus({preventScroll:true});filters.scrollIntoView({block:'center'});}},getRoster,readURL:readerHref,locationLabel:(w,p)=>pgl(w)+' '+p,text:v=>esv?.[String(v)]||d.verses.find(x=>+x.v===+v)?.t,translationLabel:v=>esv?.[String(v)]?'English Standard Version':B.txt?'Douay-Rheims':'American Standard Version',loadUnits:w=>window.FRResearchData?window.FRResearchData.loadUnits(w):J(BLOB+'/v1/mine/units/'+encodeURIComponent(w)+'.json'),onVerse:v=>{BIBLE_STATE.verse=v;history.replaceState(null,'',FRScripture.bibleURL(bslug,c,v,'desk'));},showRelated:k=>setView(k),ask:(q,rows)=>window.FRAsk?.open(FRVerseResearch.comparisonRequest(q,rows)),signal:researchEvents.signal});};
  const scrollToVerseDesk=()=>requestAnimationFrame(()=>{if(run!==BIBLE_RUN||BIBLE_STATE.view!=='desk')return;const host=$('#verse-research-desk'),header=document.querySelector('header.site');if(host)window.scrollTo({top:Math.max(0,host.getBoundingClientRect().top+window.scrollY-(header?.getBoundingClientRect().height||0)-16),behavior:'auto'});});
  const setView=k=>{BIBLE_STATE.view=k;page.querySelectorAll('[data-pane]').forEach(el=>el.hidden=el.dataset.pane!==k);page.querySelectorAll('[data-bible-view]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.bibleView===k)));history.replaceState(null,'',FRScripture.bibleURL(bslug,c,BIBLE_STATE.verse,k==='read'?null:k));if(k==='desk'){loadVerseDesk();scrollToVerseDesk();}};
  page.querySelectorAll('[data-bible-view]').forEach(b=>b.onclick=()=>setView(b.dataset.bibleView));
  page.querySelectorAll('[data-annotation]').forEach(el=>el.addEventListener('toggle',()=>{if(el.open&&!el.dataset.loaded){el.dataset.loaded='1';FRScripture.renderVolumes(el.querySelector('.annotation-destinations'),annotations[+el.dataset.annotation],bslug,c,[...(d?.verses||[]).flatMap(v=>v.rows||[]),...(d?.ch_rows||[])]).catch(()=>{el.dataset.loaded='';el.querySelector('.annotation-destinations').innerHTML='<p>Volumes could not load. Close and reopen this work to retry.</p>';});}}));
  if(!c)return;
  $('#ask-chapter').onclick=()=>window.FRAsk?.open({q:'Explain '+B.book+' '+c+' using the commentaries and cite the relevant passages.'});
  const byVerse=new Map((d.verses||[]).map(v=>[+v.v,v]));
  // the rows beyond the shard's caps (60 per chapter, 1,000 per verse) live in one companion shard per chapter
  let MORE=null;const loadMore=()=>MORE||(MORE=gzJ(BLOB+`/v1/bible/all/${bslug}/${c}.more.json.gz`).catch(()=>{MORE=null;return null;}));
  const merged=new Set();const mergeMore=async key=>{const m=await loadMore();if(!m)return false;if(merged.has(key))return true;merged.add(key);
    if(key==='ch'){d.ch_rows=(d.ch_rows||[]).concat(m.ch_rows||[]);d.ch_full=true;}else{const v=byVerse.get(+key);if(v){v.rows=(v.rows||[]).concat((m.verses||{})[String(key)]||[]);v.full=true;}}return true;};
  const openVerse=(vn,force)=>{const v=byVerse.get(vn);if(!v)return;const btn=page.querySelector(`[data-v="${vn}"]`),dest=$('#pv'+vn);if(!btn)return;const open=force||btn.getAttribute('aria-expanded')!=='true';btn.setAttribute('aria-expanded',String(open));const rows=(v.rows||[]).filter(facOK);dest.innerHTML=open?`<div class="vpanel">${panelHTML(rows,v.full?(v.rows||[]).length:(facAll()?v.n:rows.length),mkHl(B.book,c,vn),{key:vn,full:!!v.full})}</div>`:'';if(open){BIBLE_STATE.verse=vn;history.replaceState(null,'',FRScripture.bibleURL(bslug,c,vn));}};
  const openChapter=open=>{const dest=$('#pvch'),whole=page.querySelector('[data-ch]');if(whole)whole.setAttribute('aria-expanded',String(open));const rows=d.ch_rows.filter(facOK);dest.innerHTML=open?`<div class="vpanel">${panelHTML(rows,d.ch_full?(d.ch_rows||[]).length:(facAll()?d.ch_n:rows.length),mkHl(B.book,c,0),{key:'ch',full:!!d.ch_full})}</div>`:'';};
  page.onclick=async e=>{const more=e.target.closest('[data-load-all]');if(more){more.disabled=true;more.textContent='Loading…';const key=more.dataset.loadAll;const ok=await mergeMore(key);if(run!==BIBLE_RUN)return;if(!ok){more.disabled=false;more.textContent='The complete list is not available yet. Try again';return;}if(key==='ch')openChapter(true);else openVerse(+key,true);return;}
    const desk=e.target.closest('[data-open-desk]');if(desk){BIBLE_STATE.verse=+desk.dataset.openDesk;setView('desk');verseDesk?.setVerse(BIBLE_STATE.verse);return;}const button=e.target.closest('[data-v]');if(button){openVerse(+button.dataset.v);return;}const whole=e.target.closest('[data-ch]');if(whole){openChapter(whole.getAttribute('aria-expanded')!=='true');}};
  if(view==='desk'){loadVerseDesk();scrollToVerseDesk();}
  const requested=BIBLE_STATE.verse||JUMPV;JUMPV=null;
  if(requested){const v=byVerse.get(+requested);if(v){if(view==='read'){openVerse(+requested,true);requestAnimationFrame(()=>$('#v'+requested)?.scrollIntoView({block:'start'}));}}else{$('#verse-feedback').textContent='Verse '+requested+' is not in this chapter. Choose one of the verses below.';}}
}

/* ── routing ── */
/* ══ COMPARISON DESK (owner 2026-09-10: "a workflow and tool to compare multiple authors at one time,
   save views … all positions by topic, structured by work so it's collapsible") ══
   One component, `compareDesk(host,state,opts)`, used by /compare and embedded in the pair page.
   state = {a:[slug…] (≤4), sel:<topic slug>, g:'work'|'stance', s:<stance>, q:<phrase>}.
   Each author×topic cell: the room's selection, then the full topic file, then the complete index
   streamed through one site-wide evidence queue as the cell's own pane scrolls. ── */
const EVQ={inflight:0,max:2,last:0,queue:[],timer:null};
function evidenceFetch(params){return new Promise((res,rej)=>{EVQ.queue.push({params,res,rej});evPump();});}
function evPump(){if(EVQ.timer||EVQ.inflight>=EVQ.max||!EVQ.queue.length)return;const wait=Math.max(0,160-(Date.now()-EVQ.last));if(wait){EVQ.timer=setTimeout(()=>{EVQ.timer=null;evPump();},wait);return;}
  const job=EVQ.queue.shift();EVQ.inflight++;EVQ.last=Date.now();
  fetch('https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/evidence?'+job.params,{signal:AbortSignal.timeout(25000)}).then(r=>{if(!r.ok)throw new Error('Evidence unavailable');return r.json();}).then(job.res,job.rej).finally(()=>{EVQ.inflight--;evPump();});}
const CD={rooms:new Map(),files:new Map(),exports:new Map()};
const cdRoom=r=>{const k=r.sh+'/'+r.s;if(!CD.rooms.has(k))CD.rooms.set(k,J(BLOB+`/v1/bible/${r.sh}/rooms/${r.s}.json`).catch(()=>null));return CD.rooms.get(k);};
const cdFile=(sh,slug,tslug)=>{const k=sh+'/'+slug+'/'+tslug;if(!CD.files.has(k))CD.files.set(k,J(BLOB+`/v1/bible/${sh}/rooms/t/${slug}/${tslug}.json`).catch(()=>null));return CD.files.get(k);};
const cdExport=reg=>{if(!CD.exports.has(reg))CD.exports.set(reg,J(BLOB+`/v1/mine/topic2-all/${reg}.json`).catch(()=>null));return CD.exports.get(reg);};
const cdParse=h=>{const P=new URLSearchParams(String(h||'').replace(/^#/,''));return {a:(P.get('a')||'').split(',').map(x=>decodeURIComponent(x).trim()).filter(Boolean).slice(0,4),sel:P.get('sel')||P.get('t')||'',g:['stance','canon'].includes(P.get('g'))?P.get('g'):'work',s:P.get('s')||'',q:P.get('q')||'',v:['meet','disagree'].includes(P.get('v'))?'meet':'columns',m:['opposite','assert'].includes(P.get('m'))?P.get('m'):(P.get('v')==='disagree'?'opposite':'any'),o:['n','denies'].includes(P.get('o'))?P.get('o'):'shared'};};
const cdHash=st=>'#a='+st.a.map(encodeURIComponent).join(',')+(st.sel?'&sel='+encodeURIComponent(st.sel):'')+(st.g!=='work'?'&g='+st.g:'')+(st.s?'&s='+encodeURIComponent(st.s):'')+(st.q?'&q='+encodeURIComponent(st.q):'')+(st.v&&st.v!=='columns'?'&v='+st.v:'')+(st.m&&st.m!=='any'?'&m='+st.m:'')+(st.o&&st.o!=='shared'?'&o='+st.o:'');
const cdURL=st=>'/the-faith-received/compare/'+cdHash(st);

async function compareDesk(host,state,opts={}){
  if(!['work','canon'].includes(state.g))state.g='work';
  const run=RESEARCH_RUN,serial=(host.__compareSerial||0)+1;host.__compareSerial=serial;const active=()=>run===RESEARCH_RUN&&host.isConnected&&host.__compareSerial===serial;const roster=await getRoster();if(!active())return;
  const bySlug=new Map();roster.rows.forEach(r=>{const cur=bySlug.get(r.s);if(!cur||(r.w||0)>(cur.w||0))bySlug.set(r.s,r);});
  const TS=await topicSlugs();if(!active())return;
  const authors=[];
  for(const sl of state.a){const r=bySlug.get(sl);if(!r)continue;const room=await cdRoom(r);if(!active())return;if(!room)continue;
    authors.push({s:sl,a:room.a,sh:r.sh,r,room,works:new Map((room.works||[]).map(w=>[w.w,w])),topics:new Map(canonRoomTopics(room.topics).filter(t=>!RX.isRawTopic(t.t)).map(t=>[t.key,t]))});}
  // VISION TIER (owner 2026-09-10 "yes build it"): columns run in date order, so a topic reads as a
  // reception history; the topic list carries a stance bar per author; a disagreement finder pairs
  // opposite stances; any view exports to the Desk with every passage cited. No new evidence traffic.
  authors.sort((x,y)=>((x.r.y||9999)-(y.r.y||9999))||x.a.localeCompare(y.a));
  const whenOf=au=>(au.r.y?'c. '+au.r.y+' · ':'')+(RX.shelves[au.sh]||'');
  const paintSave=()=>{const b=host.querySelector('#cd-save-view');if(!b)return;const on=!!cdViews.find(cdURL({...state,a:authors.map(x=>x.s)}));b.setAttribute('aria-pressed',String(on));b.textContent=on?'Saved view':'Save view';b.classList.toggle('on',on);};
  const emit=()=>{const st={...state,a:authors.map(x=>x.s)};if(opts.onState)opts.onState(st);const open=host.querySelector('.cd-open');if(open)open.href=cdURL(st);paintSave();};
  // topic rows: the union of the authors' topics, each author's count beside it, in the loci order
  const addTally=(a,b)=>{if(!a)return b;if(!b)return a;const t={};['asserts','denies','reports','other','n'].forEach(k=>{t[k]=(a[k]||0)+(b[k]||0);});return t;};
  const topicMap=new Map();authors.forEach((au,i)=>au.topics.forEach(t=>{const key=t.key;
    if(!topicMap.has(key))topicMap.set(key,{key,label:t.t,tslug:tslugOf(t.t),reg:TS.get(key)||'',locus:!!LOCUS_HEAD[key],counts:authors.map(()=>0),tally:authors.map(()=>null),parts:authors.map(()=>[]),via:new Set()});
    const row=topicMap.get(key);row.counts[i]+=t.npos||0;row.parts[i].push(t);(t.via||[]).forEach(v=>row.via.add(v));row.tally[i]=addTally(row.tally[i],stanceTally(t.pos));}));
  const headOf=key=>{const hk=LOCUS_HEAD[key];return hk?hk[0]:LOCI_HEADS.length;};
  const topics=[...topicMap.values()].map(t=>({...t,total:t.counts.reduce((n,x)=>n+x,0),shared:t.counts.filter(Boolean).length,den:t.tally.reduce((n,x)=>n+(x?x.denies:0),0),denShare:(()=>{const n=t.tally.reduce((a,x)=>a+(x?x.n:0),0);return n?t.tally.reduce((a,x)=>a+(x?x.denies:0),0)/n:0;})()})).filter(t=>t.total>0);
  const lociOrder=(x,y)=>headOf(x.key)-headOf(y.key)||((LOCUS_HEAD[x.key]||[0,99])[1]-(LOCUS_HEAD[y.key]||[0,99])[1]);
  const orderTopics=()=>{if(state.o==='n')topics.sort((x,y)=>(y.total-x.total)||(y.shared-x.shared)||lociOrder(x,y));
    else if(state.o==='denies')topics.sort((x,y)=>(y.den-x.den)||(y.denShare-x.denShare)||(y.total-x.total)||lociOrder(x,y));
    else topics.sort((x,y)=>(y.shared-x.shared)||(y.total-x.total)||lociOrder(x,y));};
  orderTopics();
  const findTopic=sel=>{if(!sel)return null;const f=RX.fold(sel),ck=topicCanon(sel).key;return topics.find(t=>t.tslug===sel||t.reg===sel||t.key===f)||topics.find(t=>t.key===ck)||topics.find(t=>t.parts.some(ps=>ps.some(p=>(p.parts||[]).some(x=>x.tslug===sel||RX.fold(x.t)===f))))||null;};
  let cur=findTopic(state.sel)||topics[0]||null;if(cur)state.sel=cur.tslug;
  const stanceOpts=STANCES.filter(x=>x[0]).map(([k,v])=>`<option value="${k}"${state.s===k?' selected':''}>${v}</option>`).join('');
  host.classList.add('cd');
  host.innerHTML=`<div class="cd-authors" role="group" aria-label="Authors compared">${authors.map((au,i)=>`<span class="cd-chip"><a href="${RX.authorURL(au.r)}">${esc(au.a)}</a><small>${esc(whenOf(au))}</small>${authors.length>1?`<button type="button" class="cd-x" data-cd-remove="${i}" aria-label="Remove ${esc(au.a)}">×</button>`:''}</span>`).join('')}${authors.length<4?`<label class="rx-search cd-add">Add an author<input type="search" id="cd-add" placeholder="${authors.length?'Another name':'An author’s name'}" list="cd-add-list" autocomplete="off"><datalist id="cd-add-list"></datalist></label>`:'<span class="rx-note">Four authors is the desk’s width. Remove one to add another.</span>'}</div>
  ${authors.length?`<div class="rx-filters cd-tools"><label>Group statements<select id="cd-group"><option value="work"${state.g==='work'?' selected':''}>By work · most statements first</option><option value="canon"${state.g==='canon'?' selected':''}>By work · library order</option></select></label><label>Stance<select id="cd-stance"><option value="">All stances</option>${stanceOpts}</select></label><label class="rx-search">Phrase in statements<input type="search" id="cd-q" placeholder="Search every column" value="${esc(state.q)}"></label><label>View<select id="cd-view"><option value="columns"${state.v!=='meet'?' selected':''}>Columns, oldest author first</option><option value="meet"${state.v==='meet'?' selected':''}>Where they meet</option></select></label><button type="button" class="rx-button cd-export" id="cd-export" title="Every statement on screen, cited, as a Desk draft">Export to Desk</button><button type="button" class="rx-button cd-savebtn" id="cd-save-view" aria-pressed="false" title="Keep this view: these authors, this topic, this mode and filters">Save view</button>${opts.embedded?`<a class="rx-text-link cd-open" href="${cdURL(state)}">Open in the comparison desk</a>`:''}</div>
  <details class="cd-topic-picker"><summary>Choose topic<span id="cd-selected-topic"></span></summary><div class="cd-topics"><div class="cd-topics-head"><label class="rx-note">${fmtR(topics.filter(t=>t.locus).length)} loci · <select id="cd-order" aria-label="Order topics"><option value="shared"${state.o==='shared'?' selected':''}>in loci order</option><option value="n"${state.o==='n'?' selected':''}>most statements</option><option value="denies"${state.o==='denies'?' selected':''}>most denial</option></select></label><p class="rx-note cd-legend"><span>${['asserts','denies','reports','other'].map(k=>`<i style="background:${STANCE_C[k]}"></i>${k==='other'?'qualifies / other':k}`).join(' ')}</span><span>Bars from each room’s selection, one per author in column order · pick a tile</span></p></div><div class="cd-groups" id="cd-mosaic" role="tablist" aria-label="Topics" style="--cols:${authors.length}"></div><div id="cd-tail"></div></div></details>
  <div class="cd-detail"><div class="cd-topic-head"><h3 id="cd-topic-title"></h3><p class="rx-note" id="cd-topic-links"></p></div><p class="cd-mobile-hint">Swipe between authors. Each column keeps its own reading place.</p><div class="cd-columns" id="cd-columns" style="--cols:${authors.length}"></div><div class="cd-dis-view" id="cd-dis" hidden><div class="rx-filters cd-meet-tools"><label>Pairs<select id="cd-match"><option value="any"${state.m!=='opposite'&&state.m!=='assert'?' selected':''}>Any stance</option><option value="opposite"${state.m==='opposite'?' selected':''}>Opposite stances</option><option value="assert"${state.m==='assert'?' selected':''}>Both assert</option></select></label></div><div id="cd-meet-body"></div></div></div>`:`<p class="rx-note">Add an author to begin. Two to four authors compare side by side, topic by topic.</p>`}`;
  // add / remove authors
  const rows=RX.roster(roster.rows).filter(r=>!authors.some(a=>a.s===r.s));
  const dl=host.querySelector('#cd-add-list'),inp=host.querySelector('#cd-add');
  if(dl&&inp){const fill=q=>{const f=RX.fold(q||'');dl.innerHTML=rows.filter(r=>!f||RX.authorScore(r,f)>0).sort((a,b)=>RX.authorScore(b,f)-RX.authorScore(a,f)).slice(0,30).map(r=>`<option value="${esc(r.a)}">${esc(RX.shelves[r.sh])} · ${fmtR(r.w)} works</option>`).join('');};fill('');
    const go=r=>{state.a=[...authors.map(x=>x.s),r.s];emit();compareDesk(host,state,opts);};
    let adding=false;const choose=r=>{if(adding)return;adding=true;go(r);};
    inp.oninput=e=>fill(e.target.value);
    inp.onchange=e=>{const hit=rows.filter(r=>RX.fold(r.a)===RX.fold(e.target.value));if(hit.length===1)choose(hit[0]);};
    inp.onkeydown=e=>{if(e.key!=='Enter'||e.isComposing)return;e.preventDefault();const hits=rows.filter(r=>RX.authorScore(r,inp.value)>0).sort((a,b)=>RX.authorScore(b,inp.value)-RX.authorScore(a,inp.value));if(hits.length===1||hits.length>1&&RX.authorScore(hits[0],inp.value)>RX.authorScore(hits[1],inp.value))choose(hits[0]);};}
  host.querySelectorAll('[data-cd-remove]').forEach(b=>b.onclick=()=>{authors.splice(+b.dataset.cdRemove,1);state.a=authors.map(x=>x.s);emit();compareDesk(host,state,opts);});
  if(!authors.length)return;
  // ── cells ──
  const cells=new Map();   // author slug → cell for the current topic
  const cellKey=(au,t)=>au.s+'|'+t.tslug;const CELLS=host.__cells||(host.__cells=new Map());
  const matches=r=>positionMatches(r,{phrase:state.q,annotation:state.s});
  const cellHTML=(au,cell)=>{const groups=cellGroups(au,cell);
    if(!cell.foldsInitialized&&groups.length){cell.open.add(groups[0].k);cell.foldsInitialized=true;}
    const title=r=>au.works.get(r.w)?.t||r.wt||r.w;
    return groups.map(g=>`<details class="cd-work"${cell.open.has(g.k)?' open':''} data-cd-fold="${esc(g.k)}"><summary><span><strong>${esc(g.label)}</strong>${g.sub?` <small>${esc(g.sub)}</small>`:''}</span><small class="cd-n">${fmtR(g.rows.length)}</small>${g.w?` <a class="rx-text-link cd-read" href="${readerHref(g.w)}" onclick="event.stopPropagation()">open the work</a>${workSaveBtn(g.w,g.label,au.a)}`:''}</summary><div class="cd-fold-body">${g.w?sectionFoldsHTML(g.rows,r=>statementHTML(r,{title,author:au.a}),g.w):g.rows.map(r=>statementHTML(r,{title,author:au.a})).join('')}</div></details>`).join('')||`<p class="rx-note">${cell.rows.length?'No loaded statements match these filters.':cell.loading?'Loading…':'No statements recorded on this topic.'}</p>`;};
  const drawCell=(au,cell)=>{if(!active()||cell.topic!==cur?.tslug)return;const col=host.querySelector(`[data-cd-col="${au.s}"]`);if(!col)return;const pane=col.querySelector('.cd-pane'),y=pane.scrollTop;
    pane.innerHTML=cellHTML(au,cell)+(cell.contract&&!cell.done&&!cell.halted?`<div class="rx-pane-sentinel cd-sentinel" data-cd-sentinel="${au.s}" aria-hidden="true"></div>`:'');pane.scrollTop=y;
    const loaded=cell.rows.length,total=Math.max(cell.total||0,loaded);
    col.querySelector('.cd-progress').innerHTML=`${fmtR(loaded)} of ${fmtR(total)} statements${cell.loading?' · loading…':cell.done?' · complete':cell.halted?` · the index stopped answering <button type="button" class="rx-text-link" data-cd-retry="${au.s}">Try again</button>`:cell.contract?' · more as you scroll':cell.noIndex?' · room selection only':''}`;
    const bar=col.querySelector('.cd-bar i');if(bar)bar.style.width=(total?Math.min(100,loaded/total*100):0)+'%';
    if(state.v==='meet')drawMeet();
    pane.querySelectorAll('[data-cd-fold]').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)cell.open.add(d.dataset.cdFold);else cell.open.delete(d.dataset.cdFold);}));
    cell.io?.disconnect();const sent=pane.querySelector('[data-cd-sentinel]');if(sent){const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){io.disconnect();pageCell(au,cell);}},{root:pane,rootMargin:'240px 0px'});io.observe(sent);cell.io=io;}};
  async function pageCell(au,cell){if(!active()||cell.topic!==cur?.tslug||!cell.contract||cell.loading||cell.done||cell.halted)return;cell.loading=true;drawCell(au,cell);
    try{const params=new URLSearchParams({snapshot:cell.contract.snapshot,topic:cell.contract.topic,author:cell.author.id,limit:'50'});if(cell.cursor)params.set('cursor',cell.cursor);
      const result=await evidenceFetch(params);if(!active()){cell.loading=false;return;}
      if(result.snapshot_id!==cell.contract.snapshot||result.filters?.author_id!==cell.author.id||!Array.isArray(result.items))throw new Error('Evidence selection changed');
      if(result.has_more&&(!result.next_cursor||result.next_cursor===cell.cursor))throw new Error('Evidence page did not advance');
      for(const r of result.items){const key=r.id||JSON.stringify([r.w,RX.page(r.p),r.q]);if(!cell.seen.has(key)){cell.seen.add(key);cell.rows.push(r);}}
      cell.total=result.total||cell.total;cell.cursor=result.next_cursor||null;cell.done=!result.has_more;cell.failures=0;}
    catch(_){if(!active()){cell.loading=false;return;}cell.failures=(cell.failures||0)+1;if(cell.failures>=2)cell.halted=true;}
    cell.loading=false;drawCell(au,cell);}
  async function openCell(au,t){const k=cellKey(au,t);let cell=CELLS.get(k);
    if(!cell){const parts=t.parts[authors.indexOf(au)]||[];const byw={};parts.forEach(p=>(p.byw||[]).forEach(x=>{byw[x[0]]=(byw[x[0]]||0)+(x[2]||0);}));
      cell={topic:t.tslug,rows:positionRows(parts.flatMap(p=>p.pos||[])),seen:new Set(),open:new Set(),total:parts.reduce((n,p)=>n+(p.npos||0),0),byw,contract:null,author:null,cursor:null,done:false,halted:false,loading:true,failures:0};cell.rows.forEach(r=>cell.seen.add(r.id||JSON.stringify([r.w,RX.page(r.p),r.q])));CELLS.set(k,cell);
      drawCell(au,cell);
      const [fulls,ex]=await Promise.all([Promise.all(parts.map(p=>roomTopicFull(au.sh,au.s,p))),t.reg?cdExport(t.reg):null]);if(!active()){cell.loading=false;return;}
      const fr=positionRows(fulls.flatMap(f=>f?.pos||[]));if(fr.length){const merged=[...fr];const seen=new Set(fr.map(r=>r.id||JSON.stringify([r.w,RX.page(r.p),r.q])));cell.rows.forEach(r=>{const key=r.id||JSON.stringify([r.w,RX.page(r.p),r.q]);if(!seen.has(key)){seen.add(key);merged.push(r);}});cell.rows=merged;cell.seen=seen;}
      const author=ex?positionAuthor(ex.authors,au.a,au.s,au.sh):null;
      if(ex?.evidence&&author){cell.contract=ex.evidence;cell.author=author;cell.total=(author.np||0)+parts.reduce((n,p)=>n+(p.npos_via||0),0);}else cell.noIndex=true;
      cell.loading=false;}
    if(!active()||t.tslug!==cur?.tslug)return;cells.set(au.s,cell);drawCell(au,cell);}
  const showTopic=t=>{for(const cell of cells.values())cell.io?.disconnect();cur=t;state.sel=t.tslug;emit();const picker=host.querySelector('.cd-topic-picker');if(picker)picker.open=false;const selected=host.querySelector('#cd-selected-topic');if(selected)selected.textContent=t.label;
    host.querySelectorAll('[data-cd-topic]').forEach(b=>{const on=b.dataset.cdTopic===t.tslug;b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on));if(on){const g=b.closest('.cd-group,.cd-tail');if(g&&!g.open)g.open=true;}});
    host.querySelector('#cd-topic-title').innerHTML=`${esc(t.label)} <small>${authors.map((au,i)=>esc(au.a)+' '+fmtR(t.counts[i])).join(' · ')}</small>`;
    host.querySelector('#cd-topic-links').innerHTML=(t.via.size?`<span class="cd-includes">Includes ${[...t.via].map(esc).join(', ')}.</span> `:'')+(t.reg?`<a class="rx-text-link" href="/the-faith-received/topics/#${encodeURIComponent(t.reg)}?compare=${authors.map(a=>encodeURIComponent(a.s)).join(',')}">All authors on ${esc(t.label)}</a> · <a class="rx-text-link" href="/the-faith-received/web/#t=${encodeURIComponent(t.reg)}">In the citation web</a>`:'')+(authors.length===2?` · <a class="rx-text-link" href="/the-faith-received/fathers/?sh=${encodeURIComponent(authors[0].sh)}#${encodeURIComponent(authors[0].s)}/with/${encodeURIComponent(authors[1].s)}">Citations between ${esc(authors[0].a)} and ${esc(authors[1].a)}</a>`:'');
    host.querySelector('#cd-columns').innerHTML=authors.map(au=>`<section class="cd-col" data-cd-col="${esc(au.s)}"><header class="cd-col-head"><h4><a href="${RX.authorURL(au.r,t.label)}">${esc(au.a)}</a></h4><p class="rx-note cd-when">${esc(whenOf(au))}</p><p class="rx-note cd-progress"></p><div class="cd-bar"><i></i></div></header><div class="cd-pane rx-pane"></div></section>`).join('');
    setView();authors.forEach(au=>openCell(au,t));};
  // TOPIC MOSAIC (owner 2026-09-10 "scrolling on the collapsed for compare is bad, make this fun"): the closed
  // loci vocabulary is 43 labels, so it fits on one screen as tiles under their eight heads — every tile a
  // stance bar per author — instead of a list in a nested scroll box. Other labels sit folded beneath.
  const drawTopics=()=>{const box=host.querySelector('#cd-mosaic');if(!box)return;
    const tile=(t,cls='')=>`<button role="tab" class="cd-tile${cls}${cur&&t.key===cur.key?' on':''}${t.shared<authors.length?' cd-partial':''}" aria-selected="${cur&&t.key===cur.key}" data-cd-topic="${esc(t.tslug)}" title="${esc(t.label+(t.via.size?' · includes '+[...t.via].join(', '):''))}"><span class="cd-tile-label">${esc(t.label)}${t.via.size?' <i class="cd-via" aria-hidden="true">+</i>':''}</span><span class="cd-cells">${authors.map((au,i)=>`<span class="cd-cell">${stanceBar(t.tally[i],au.a)}<small>${fmtR(t.counts[i])}</small></span>`).join('')}</span></button>`;
    const loci=topics.filter(t=>t.locus),tail=topics.filter(t=>!t.locus);let body='';
    const groupOpen=host.__groupOpen||(host.__groupOpen=new Map());
    if(state.o==='shared'){LOCI_HEADS.forEach(([h],hi)=>{const rows=loci.filter(t=>(LOCUS_HEAD[t.key]||[])[0]===hi).sort(lociOrder);if(!rows.length)return;
        const has=cur&&rows.some(t=>t.key===cur.key);const open=groupOpen.has(hi)?groupOpen.get(hi):!!has;
        const tally=authors.map((au,i)=>rows.reduce((a,t)=>addTally(a,t.tally[i]),null));const total=authors.map((au,i)=>rows.reduce((n,t)=>n+t.counts[i],0));
        body+=`<details class="cd-group" data-cd-group="${hi}"${open?' open':''}><summary><span class="cd-head">${esc(h)}</span><span class="cd-cells">${authors.map((au,i)=>`<span class="cd-cell">${stanceBar(tally[i],au.a)}<small>${fmtR(total[i])}</small></span>`).join('')}</span><small class="cd-n">${fmtR(rows.length)} ${rows.length===1?'locus':'loci'}</small></summary><div class="cd-mosaic">${rows.map(t=>tile(t)).join('')}</div></details>`;});}
    else body=`<div class="cd-mosaic">${loci.map(t=>tile(t)).join('')}</div>`;
    box.innerHTML=body||'<p class="rx-note">No loci topics recorded for these authors.</p>';
    box.querySelectorAll('[data-cd-group]').forEach(d=>d.addEventListener('toggle',()=>groupOpen.set(+d.dataset.cdGroup,d.open)));
    const tb=host.querySelector('#cd-tail');if(tb)tb.innerHTML=tail.length?`<details class="cd-tail"${cur&&!cur.locus?' open':''}><summary><span><strong>Other labels</strong><small>${fmtR(tail.length)} · extraction labels outside the loci, most with a handful of statements</small></span></summary><div class="cd-mosaic cd-mosaic-tail" role="tablist" aria-label="Other labels" style="--cols:${authors.length}">${tail.map(t=>tile(t,' cd-tile-sm')).join('')}</div></details>`:'';
    host.querySelectorAll('[data-cd-topic]').forEach(b=>b.onclick=()=>{const t=findTopic(b.dataset.cdTopic);if(t)showTopic(t);});};
  drawTopics();
  /* ── view modes: the columns stay in the DOM while hidden (their panes keep their loaded rows and
     stop paging, since a hidden pane never intersects); the finder reads the same cells ── */
  const setView=()=>{const cols=host.querySelector('#cd-columns'),dis=host.querySelector('#cd-dis');if(!cols||!dis)return;cols.hidden=state.v==='meet';dis.hidden=state.v!=='meet';if(state.v==='meet')drawMeet();};
  /* WHERE THEY MEET (owner 2026-09-10 "maybe we don't need genuine contradictions"): two statements from
     different authors are paired when they share rare vocabulary, whatever their stance; stance is a
     filter on the pairs (any · opposite · both assert), never a verdict. Loaded rows only, no new traffic. */
  const STOP=new Set('the and that this with from which their there these those they them then than when what where were will would should could have has had been being into unto upon also very more most such some same only over under about after before because through between against without within while whom whose shall must might may not nor but for are was his her him our your its one two all any each other both either neither every much many even ever never still thus hence therefore wherefore whether though although since till until unless itself himself themselves ourselves yourselves who how why does did done doing make made makes says said saying thing things another among according rather indeed wherein whereby therein thereof herein hereby come comes came give given gives take taken takes whole part parts great first last less least often always sometimes something nothing anything everything someone anyone everyone none away back again once twice here there like unlike almost quite else certain certainly perhaps whatever whenever wherever however others otherwise seems seem seemed appears appear appeared called call calls named name names hold holds held keep keeps kept say tell told'.split(' '));
  const TERMS=new WeakMap();const termsOf=r=>{let s=TERMS.get(r);if(!s){s=new Set();RX.fold((r.q||'')+' '+(r.g||'')).split(/[^a-z0-9]+/).forEach(w=>{if(w.length>=4&&!STOP.has(w))s.add(w);});TERMS.set(r,s);}return s;};
  const cdRec=slug=>{if(!CD.recs)CD.recs=new Map();if(!CD.recs.has(slug))CD.recs.set(slug,gzJ(BLOB+`/v1/reception/${slug}.json.gz?d=`+bust()).catch(()=>null));return CD.recs.get(slug);};
  const citesN=(recA,recB,a,b)=>{const kb=recB?.fk||b.s,ka=recA?.fk||a.s;const out=(recA?.out?.rows||[]).find(r=>r.fk===kb);if(out)return out.n||0;const inn=(recB?.in?.rows||[]).find(r=>r.fk===ka);return inn?inn.n||0:0;};
  const MATCH={any:'pairs',opposite:'pairs of opposite stance',assert:'pairs where both assert'};
  const matchOK=(a,b)=>state.m==='opposite'?((a.s==='denies'&&b.s==='asserts')||(a.s==='asserts'&&b.s==='denies')):state.m==='assert'?(a.s==='asserts'&&b.s==='asserts'):true;
  let meetTimer=null;const drawMeet=()=>{if(meetTimer)return;meetTimer=setTimeout(()=>{meetTimer=null;paintMeet();},60);};
  function paintMeet(){const box=host.querySelector('#cd-meet-body');if(!box||host.querySelector('#cd-dis')?.hidden||!cur)return;
    const pool=authors.map(au=>{const cell=cells.get(au.s);return {au,cell,rows:(cell?.rows||[]).filter(matches)};});
    const all=pool.flatMap((p,pi)=>p.rows.map(r=>({r,pi})));const N=all.length;
    const post=new Map();all.forEach((x,k)=>termsOf(x.r).forEach(w=>{let l=post.get(w);if(!l)post.set(w,l=[]);l.push(k);}));
    const idf=w=>{const d=(post.get(w)||[]).length;return d>N*0.25?0:Math.log((N+1)/(d+0.5));};   // the topic's own vocabulary weighs nothing
    const WT=new Map();const weight=k=>{let v=WT.get(k);if(v===undefined){v=0;termsOf(all[k].r).forEach(w=>{v+=idf(w)**2;});v=Math.sqrt(v)||1;WT.set(k,v);}return v;};
    const cap=Math.max(40,N*0.05);const acc=new Map();   // inverted index over the rarer terms: pair keys accumulate their shared terms
    post.forEach((l,w)=>{if(l.length<2||l.length>cap||!idf(w))return;for(let x=0;x<l.length;x++)for(let y=x+1;y<l.length;y++){const i=l[x],j=l[y];if(all[i].pi===all[j].pi)continue;const key=i*N+j;let e=acc.get(key);if(!e)acc.set(key,e=[]);e.push(w);}});
    const pairs=[];acc.forEach((shared,key)=>{if(shared.length<2)return;const i=Math.floor(key/N),j=key%N,A=all[i],B=all[j];if(!matchOK(A.r,B.r))return;
      const score=shared.reduce((s,w)=>s+idf(w)**2,0)/(weight(i)*weight(j));if(score<0.12)return;
      pairs.push({score,shared:shared.sort((x,y)=>idf(y)-idf(x)).slice(0,8),left:{au:pool[A.pi].au,r:A.r},right:{au:pool[B.pi].au,r:B.r},i:A.pi,j:B.pi});});
    pairs.sort((x,y)=>y.score-x.score);const top=pairs.slice(0,40);
    const loaded=pool.map(p=>`${esc(p.au.a)} ${fmtR(p.rows.length)}${p.cell?.total>p.rows.length?' of '+fmtR(p.cell.total):''}`).join(' · ');
    const stillLoading=pool.some(p=>p.cell?.loading);
    const recs=host.__recs||(host.__recs={});authors.filter(au=>!(au.s in recs)&&!recs['~'+au.s]).forEach(au=>{recs['~'+au.s]=true;cdRec(au.s).then(r=>{recs[au.s]=r||null;if(active())drawMeet();});});
    const pairHead=(A,B)=>{const ready=(A.s in recs)&&(B.s in recs);const ab=ready?citesN(recs[A.s],recs[B.s],A,B):null,ba=ready?citesN(recs[B.s],recs[A.s],B,A):null;
      const link=opts.embedded?`<button type="button" class="rx-text-link" data-cd-jump="pair-ab">the citations above</button>`:`<a class="rx-text-link" href="/the-faith-received/fathers/?sh=${encodeURIComponent(A.sh)}#${encodeURIComponent(A.s)}/with/${encodeURIComponent(B.s)}">every citation between them</a>`;
      return `<small>${ab===null?'counting citations…':`${esc(A.a)} cites ${esc(B.a)} ${fmtR(ab)} · ${esc(B.a)} cites ${esc(A.a)} ${fmtR(ba)}`} · ${link} · <a class="rx-text-link" href="/the-faith-received/web/#e=${encodeURIComponent(A.s)},${encodeURIComponent(B.s)}">in the citation web</a></small>`;};
    const groups=new Map();top.forEach(p=>{const k=p.i+'|'+p.j;if(!groups.has(k))groups.set(k,{A:pool[p.i].au,B:pool[p.j].au,items:[]});groups.get(k).items.push(p);});
    const title=au=>r=>au.works.get(r.w)?.t||r.wt||r.w;const side=x=>`<div class="cd-dis-side"><p class="cd-dis-label"><strong>${esc(x.au.a)}</strong> ${esc(x.r.s||'statement')}</p>${statementHTML(x.r,{title:title(x.au),author:x.au.a})}</div>`;
    box.innerHTML=`<p class="rx-note cd-dis-intro"><strong>${fmtR(top.length)} ${top.length===1?MATCH[state.m||'any'].replace(/^pairs/,'pair'):MATCH[state.m||'any']}${pairs.length>top.length?' of '+fmtR(pairs.length):''}</strong> among ${fmtR(N)} loaded statements${stillLoading?' · loading…':''}. Loaded: ${loaded}. Two statements meet when they share rare vocabulary; whether they agree, differ, or one reports the other is for the reader. Read both passages before citing either.${pool.some(p=>p.cell&&!p.cell.done&&!p.cell.noIndex)?' Scroll the columns view to load more of the index and widen the search.':''}</p>
      ${top.length?`<div class="rx-pane cd-dis-pane">${[...groups.values()].map(g=>`<section class="cd-dis-group"><h4>${esc(g.A.a)} and ${esc(g.B.a)}${pairHead(g.A,g.B)}</h4>${g.items.map(p=>`<article class="cd-dis"><div class="cd-dis-cols">${side(p.left)}${side(p.right)}</div><p class="rx-note cd-dis-terms">Shared terms: ${p.shared.map(esc).join(', ')}</p></article>`).join('')}</section>`).join('')}</div>`:`<p class="rx-note">${N?'No two loaded statements from different authors share enough rare vocabulary'+(state.m!=='any'?' with these stances':'')+' to pair.':'No statements loaded yet.'}</p>`}`;
    box.querySelectorAll('[data-cd-jump]').forEach(b=>b.onclick=()=>{const el=document.getElementById(b.dataset.cdJump)||document.getElementById('pair-ba');if(el)el.scrollIntoView({behavior:'smooth',block:'start'});});
    host.__meet={groups:[...groups.values()],N,total:pairs.length};}
  /* ── export: the view on screen as a Desk draft, every statement a cited blockquote ── */
  const cellGroups=(au,cell)=>{const rowsF=cell.rows.filter(matches);const W=cell.byw||{};const groups=[];
    if(state.g==='stance'){const g={};rowsF.forEach(r=>{const k=STANCES.some(x=>x[0]===r.s)?(r.s||''):'';(g[k]=g[k]||[]).push(r);});STANCES.forEach(([k,label])=>{if(g[k]&&g[k].length)groups.push({k:'s:'+k,label:label||'Other statements',rows:g[k]});});}
    else{const g=new Map();rowsF.forEach(r=>{if(!g.has(r.w))g.set(r.w,[]);g.get(r.w).push(r);});groups.push(...[...g.entries()].sort((x,y)=>{if(state.g!=='canon'){const d=((W[y[0]]||0)-(W[x[0]]||0))||(y[1].length-x[1].length);if(d)return d;}const wa=au.works.get(x[0]),wb=au.works.get(y[0]);return wa&&wb?RX.workOrder(wa,wb):(wa?-1:wb?1:y[1].length-x[1].length);}).map(([w,rs])=>{const wk=au.works.get(w);return {k:'w:'+w,w,label:(wk?.t||rs[0].wt||w),sub:wk?.vs||(wk?.v?(/^\d+$/.test(String(wk.v))?'vol. ':'')+wk.v:''),rows:rs.slice().sort((a,b)=>(RX.page(a.p)??0)-(RX.page(b.p)??0))};}));}
    return groups;};
  async function exportDesk(){const btn=host.querySelector('#cd-export');if(!cur||!btn)return;const say=t=>{btn.textContent=t;};
    if(!window.FRResearchNotebook?.createDeskDraft){say('Desk drafts unavailable here');setTimeout(()=>say('Export to Desk'),2500);return;}
    say('Preparing…');
    const abs=h=>h?(/^https?:/.test(h)?h:location.origin+h):'';const names=authors.map(au=>au.a);const viewURL=location.origin+cdURL({...state,a:authors.map(x=>x.s),sel:cur.tslug});
    const quote=(r,au)=>{const t=au.works.get(r.w)?.t||r.wt||r.w||'Source work',pg=RX.page(r.p),href=abs(RX.safeReaderURL(r.h)||(r.w?readerHref(r.w,r.p):''));
      return `<blockquote>${href?`<a class="rx-qlink" target="_blank" rel="noopener" href="${esc(href)}" title="Open the passage in a new tab"><p>${esc(r.q||r.g||'')}</p></a>`:`<p>${esc(r.q||r.g||'')}</p>`}${r.q&&r.g?`<p><small>Page annotation: ${esc(r.g)}</small></p>`:''}<p><cite>${esc(au.a)}, <em>${esc(t)}</em>${pg!==null?', '+pgl(r.w)+' '+esc(String(pg)):''}${r.s?' · '+esc(r.s):''}${href?` · <a href="${esc(href)}" target="_blank" rel="noopener">Read the passage</a>`:''}</cite></p></blockquote>`;};
    const filters=[state.s?'stance '+state.s:'',state.q?'phrase “'+state.q+'”':''].filter(Boolean).join(', ');
    let body='',n=0;
    if(state.v==='meet'){const dis=host.__meet||{groups:[],N:0,total:0};
      body+=`<h2>Where they meet · ${esc(MATCH[state.m||'any'])}</h2><p>Statements from different authors that share rare vocabulary, found among ${fmtR(dis.N)} loaded statements. The pairing is lexical; whether the two passages agree or differ is for the reader to judge.</p>`;
      dis.groups.forEach(g=>{body+=`<h3>${esc(g.A.a)} and ${esc(g.B.a)}</h3>`;g.items.forEach(p=>{n+=2;body+=`<p><strong>${esc(p.left.au.a)} ${esc(p.left.r.s||'')}</strong></p>${quote(p.left.r,p.left.au)}<p><strong>${esc(p.right.au.a)} ${esc(p.right.r.s||'')}</strong></p>${quote(p.right.r,p.right.au)}<p><small>Shared terms: ${p.shared.map(esc).join(', ')}</small></p>`;});});
      if(!dis.groups.length)body+='<p>No pairs were on screen.</p>';}
    else{for(const au of authors){const cell=cells.get(au.s);if(!cell)continue;const groups=cellGroups(au,cell);const shown=groups.reduce((s,g)=>s+g.rows.length,0);n+=shown;
        body+=`<h2>${esc(au.a)} <small>${esc(whenOf(au))}</small></h2><p>${fmtR(shown)} ${shown===1?'statement':'statements'}${cell.total>cell.rows.length?` of ${fmtR(cell.total)} in the index (${fmtR(cell.rows.length)} loaded at export)`:cell.rows.length!==shown?` shown of ${fmtR(cell.rows.length)} loaded`:''}${filters?' · '+esc(filters):''}${cell.noIndex?' · room selection only':''}</p>`;
        groups.forEach(g=>{body+=`<h3>${esc(g.label)}${g.sub?' <small>'+esc(g.sub)+'</small>':''} <small>${fmtR(g.rows.length)}</small></h3>`+g.rows.map(r=>quote(r,au)).join('');});}}
    const title=`${names.join(', ')} on ${cur.label}`;
    const html=`<h1>${esc(title)}</h1><p>A comparison from The Faith Received, exported ${new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})} · ${fmtR(n)} cited statements · <a href="${esc(viewURL)}">open the live view</a></p><p><em>These are extracted statements, sometimes summarized or translated, not quotations. A statement can report another speaker, an objection, or a rejected view. Read each source before attributing it to its author.</em></p>${body}`;
    try{const result=await FRResearchNotebook.createDeskDraft({title,html,research:{kind:'comparison-view',sources:[],topics:[cur.label],authors:names,url:viewURL}});say('Opening the Desk…');location.assign(result.url);}
    catch(e){say((e&&e.message)||'The draft could not be saved');setTimeout(()=>say('Export to Desk'),4000);}}
  host.querySelector('#cd-export').onclick=exportDesk;
  host.querySelector('#cd-save-view').onclick=async()=>{const b=host.querySelector('#cd-save-view');b.disabled=true;const st={...state,a:authors.map(x=>x.s)};const r=await cdSaveView(st,{names:authors.map(x=>x.a),topic:cur?cur.label:''});b.disabled=false;paintSave();b.textContent='Saved '+r.where;setTimeout(paintSave,3000);if(opts.onSaved)opts.onSaved(r.entry);};
  addEventListener('fr-compare-views',paintSave,{signal:researchEvents.signal});paintSave();
  host.addEventListener('click',e=>{const b=e.target.closest('[data-cd-retry]');if(!b)return;const au=authors.find(x=>x.s===b.dataset.cdRetry),cell=au&&cells.get(au.s);if(cell){cell.halted=false;cell.failures=0;pageCell(au,cell);}});
  const redraw=()=>{authors.forEach(au=>{const cell=cells.get(au.s);if(cell)drawCell(au,cell);});if(state.v==='meet')drawMeet();};
  host.querySelector('#cd-group').onchange=e=>{state.g=e.target.value;emit();redraw();};
  host.querySelector('#cd-stance').onchange=e=>{state.s=e.target.value;emit();redraw();};
  host.querySelector('#cd-q').oninput=e=>{state.q=e.target.value;emit();redraw();};
  host.querySelector('#cd-view').onchange=e=>{state.v=e.target.value;emit();setView();};
  addEventListener('fr-sections-ready',()=>{if(active())redraw();},{signal:researchEvents.signal});
  host.querySelector('#cd-match').onchange=e=>{state.m=e.target.value;emit();drawMeet();};
  host.querySelector('#cd-order').onchange=e=>{state.o=e.target.value;emit();orderTopics();drawTopics();};
  if(cur)showTopic(cur);
}

/* the desk page: /compare#a=…&sel=… — saved views live in this browser and in the research notebook */
const CD_VIEWS='fr_compare_views_v1';
const cdViews={read(){try{const v=JSON.parse(localStorage.getItem(CD_VIEWS)||'[]');return Array.isArray(v)?v:[];}catch(_){return [];}},write(v){try{localStorage.setItem(CD_VIEWS,JSON.stringify(v));}catch(_){}dispatchEvent(new Event('fr-compare-views'));},
  find(url){return this.read().find(x=>x.url===url)||null;}};
/* SAVE A VIEW (owner 2026-09-10 "need to save views…"): one click, no dialog. The address is the view; the name is
   suggested from the authors, topic, and mode and can be renamed in the saved list. Kept in this browser and in the
   research notebook (kind comparison-view, stable id per address, so re-saving never duplicates). */
async function cdSaveView(st,{names=[],topic='',name=''}={}){
  const url=cdURL(st),mode=st.v==='meet'?' · where they meet'+(st.m&&st.m!=='any'?' ('+(st.m==='opposite'?'opposite stances':'both assert')+')':''):'',filters=[st.s?'stance '+st.s:'',st.q?'“'+st.q+'”':''].filter(Boolean).join(', ');
  const suggested=(names.join(' · ')||'Comparison')+(topic?' on '+topic:'')+mode+(filters?' · '+filters:'');
  const list=cdViews.read(),existing=list.find(x=>x.url===url);const entry={id:existing?.id||'v'+Date.now().toString(36),name:name||existing?.name||suggested,url,authors:names,topic,created:existing?.created||new Date().toISOString()};
  cdViews.write([entry,...list.filter(x=>x.url!==url)]);
  let where='here';try{if(window.FRResearchNotebook?.save){const r=await FRResearchNotebook.save({id:'compare-view:'+cdHash(st),type:'note',label:entry.name,text:entry.name+'\n'+location.origin+url,cite:entry.name,url,research:{kind:'comparison-view',sources:[],topics:topic?[topic]:[],authors:names}});where=r.created===false?'here and already in your notebook':'here and in your notebook'+(r.warnings?.length?' (account sync could not be confirmed)':'');}}catch(_){}
  return {entry,where};}
async function comparePage(){
  const run=researchStart('research-compare');
  const state=cdParse(location.hash);
  const write=st=>{const h=cdHash(st);if(location.hash!==h)history.replaceState(null,'',location.pathname+location.search+h);};
  page.innerHTML=`<div class="crumbs"><a href="/the-faith-received/topics/">Topics</a> · <a href="/the-faith-received/authors/">Authors</a></div>
  <div class="research-intro cd-intro"><div><h1>Compare</h1><p>Compare authors on a topic, read the passages grouped by work, and bring your findings into the writing desk.</p></div></div>
  <div class="cd-viewbar"><button type="button" class="rx-button" id="cd-save">Save this view</button><details class="rx-fold cd-saved"><summary><span><strong>Saved views</strong><small id="cd-saved-count"></small></span></summary><div id="cd-saved-list" class="rx-fold-body"></div></details></div>
  <div id="cd-host"></div>`;
  const host=$('#cd-host');
  const drawSaved=()=>{const v=cdViews.read(),here=cdURL(cdParse(location.hash));$('#cd-saved-count').textContent=v.length?fmtR(v.length)+' in this browser':'none yet';
    $('#cd-saved-list').innerHTML=v.length?v.map(x=>`<div class="cd-saved-row${x.url===here?' on':''}" data-cd-row="${esc(x.id)}"><a href="${esc(x.url)}">${esc(x.name)}</a><small>${esc((x.authors||[]).join(' · '))}${x.topic?' · '+esc(x.topic):''}${x.url===here?' · this view':''}</small><span class="cd-saved-actions"><button type="button" class="rx-text-link" data-cd-rename="${esc(x.id)}">Rename</button><button type="button" class="rx-text-link" data-cd-del="${esc(x.id)}">Remove</button></span></div>`).join(''):'<p class="rx-note">Save a view and it appears here. Saved views also go to your research notebook, which syncs with your account.</p>';
    $('#cd-saved-list').querySelectorAll('[data-cd-del]').forEach(b=>b.onclick=()=>{cdViews.write(cdViews.read().filter(x=>x.id!==b.dataset.cdDel));drawSaved();});
    $('#cd-saved-list').querySelectorAll('[data-cd-rename]').forEach(b=>b.onclick=()=>{const row=b.closest('[data-cd-row]'),x=cdViews.read().find(y=>y.id===b.dataset.cdRename);if(!row||!x)return;row.innerHTML=`<form class="cd-rename"><input type="text" value="${esc(x.name)}" aria-label="Name for this view" maxlength="120"><button type="submit" class="rx-button">Save name</button><button type="button" class="rx-text-link" data-cd-cancel>Cancel</button></form>`;const inp=row.querySelector('input');inp.focus();inp.select();
      row.querySelector('form').onsubmit=e=>{e.preventDefault();const name=inp.value.trim()||x.name;cdViews.write(cdViews.read().map(y=>y.id===x.id?{...y,name}:y));drawSaved();};row.querySelector('[data-cd-cancel]').onclick=drawSaved;});};
  drawSaved();addEventListener('fr-compare-views',drawSaved,{signal:researchEvents.signal});addEventListener('hashchange',drawSaved,{signal:researchEvents.signal});
  $('#cd-save').onclick=async()=>{const st=cdParse(location.hash);if(!st.a.length){$('#cd-save').textContent='Add authors first';setTimeout(()=>{$('#cd-save').textContent='Save this view';},2000);return;}
    const names=[...host.querySelectorAll('.cd-chip a')].map(a=>a.textContent),topic=host.querySelector('#cd-topic-title')?.childNodes[0]?.textContent?.trim()||st.sel;
    $('#cd-save').disabled=true;const r=await cdSaveView(st,{names,topic});$('#cd-save').disabled=false;$('#cd-save').textContent='Saved '+r.where;$('.cd-saved')?.setAttribute('open','');drawSaved();
    setTimeout(()=>{$('#cd-save').textContent='Save this view';},3000);};
  if(!state.a.length&&state.sel){ // /compare#t=<registry slug>: suggest the topic's top contributors
    const ex=await cdExport(state.sel).catch(()=>null);if(run!==RESEARCH_RUN)return;
    const top=(ex?.authors||[]).filter(a=>a.s&&a.sh&&a.np>0).sort((a,b)=>(b.np||0)-(a.np||0)).slice(0,12);
    host.innerHTML=`<h3 class="rx-loci-head">Start with authors on ${esc(ex?.t||state.sel)}<small>most indexed positions first</small></h3><p class="rx-pair-neighbours">${top.map(a=>`<a class="chip" href="${cdURL({a:[a.s],sel:state.sel,g:'work',s:'',q:''})}">${esc(a.a)} <small>${fmtR(a.np)}</small></a>`).join(' ')||'<span class="rx-note">No indexed contributors with rooms.</span>'}</p><div id="cd-host2"></div>`;
    await compareDesk($('#cd-host2'),{...state,a:[]},{onState:write});
    $('#cd-host2 #cd-add')?.focus();return;}
  await compareDesk(host,state,{onState:write});
  document.title='Compare · The Faith Received';
}

/* ── PAIR VIEW (owner 2026-09-09 "make it easier to compare authors … show all citations when
   picking … more connected and integrated"): #A/with/B — every citation between two authors in
   both directions from the FULL reception shards (grouped by citing work, with page evidence),
   their shared topics side by side, and the Scripture books they both lean on. ── */
/* BOUNDED PANES (owner 2026-09-09 "minimize the endless scrolling everywhere … allow reading of all
   passages"): a long list lives in a box with its own scrollbar; every item renders inside it, the
   next chunk arriving as the box's own scroll nears its end. No load button, no truncation, and the
   page keeps its skeleton. `items` is an array, `render` maps one item to HTML. Returns the box. */
function paneList(box,items,render,chunk=80){
  box.classList.add('rx-pane');box.innerHTML='';let n=0;
  const sent=document.createElement('div');sent.className='rx-pane-sentinel';sent.setAttribute('aria-hidden','true');box.appendChild(sent);
  let io=null;const more=()=>{if(n>=items.length)return;const end=Math.min(items.length,n+chunk);sent.insertAdjacentHTML('beforebegin',items.slice(n,end).map(render).join(''));n=end;if(n>=items.length){io?.disconnect();sent.remove();}};
  more();if(n<items.length){io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))more();},{root:box,rootMargin:'320px 0px'});io.observe(sent);}
  return box;}
/* ONE STATEMENT RENDERER (owner 2026-09-10 "merge"): every surface that shows a mined statement —
   positions, the compare column, the pair page's shared topics, the topic page's voices, the room's
   topic view — draws it here. Options: title(r) resolves the work title; actions adds preview + pin;
   annotation shows the recorded stance; extra(r) appends a trailing line. */
function statementHTML(r,o={}){
  const title=o.title?o.title(r):(r.wt||r.w||'Source work'),pg=RX.page(r.p),href=RX.safeReaderURL(r.h)||(r.w?readerHref(r.w,r.p):null);
  const text=r.q||r.g||(r.pageSummary?'Indexed source page. Open the text to read its context.':'');
  return `<article class="rx-excerpt">${r.pageSummary?'<span class="rx-evidence-kind">Page summary</span>':''}<p>${esc(text)}</p>${r.q&&r.g?`<details class="rx-context"><summary>Read page annotation</summary><p>${esc(r.g)}</p></details>`:''}<div class="rx-source"><span>${esc(title)}${pg!==null?' · '+pgl(r.w)+' '+esc(String(pg)):''}</span><div>${href?`<a class="rx-text-link" target="_blank" rel="noopener" href="${esc(href)}">Read the passage</a>`:''}${r.w?(o.actions?previewBtn(r.w,r.p):'')+pinBtn(r.w,r.p,title,r.a||o.author||'',r.q||r.g):''}</div></div>${o.extra?o.extra(r):(o.annotation&&r.s?`<span class="rx-annotation">Annotation: ${esc(r.s)}</span>`:'')}</article>`;}
function statementPane(box,rows,o={}){if(!rows.length){box.classList.remove('rx-pane');box.innerHTML=`<p class="rx-note">${esc(o.empty||'No statements.')}</p>`;return box;}
  if(o.byWork===false)return paneList(box,rows,r=>statementHTML(r,o),o.chunk||60);
  box.classList.add('rx-pane');box.innerHTML=workFoldsHTML(rows,o);return box;}
/* commentary contexts for the shared citation module (same map the citation web builds) */
let __COMMS=null;async function comms(){if(__COMMS)return __COMMS;const d=await J(BLOB+'/v1/commentaries.json').catch(()=>null);const m={};if(d){(d.sentences||[]).forEach(c=>m[c.w]={l:'Commentary on Peter Lombard’s Sentences'+(c.bk?' · Book '+c.bk:''),k:'sent'});(d.summa||[]).forEach(c=>m[c.w]={l:'Commentary on Thomas Aquinas’s Summa'+(c.p?' · '+c.p:''),k:'sum'});(d.bible||[]).forEach(c=>m[c.w]={l:'Scripture commentary: '+String(c.bk||'').replace(/-/g,' ').replace(/\b\w/g,x=>x.toUpperCase()),k:'bib'});(d.compilations||[]).forEach(c=>m[c.w]={l:'Compilation · a reference may belong to a collected source',k:'comp'});}__COMMS={map:m,raw:d||{}};return __COMMS;}
/* registry slugs for topic labels: /topics#<slug> and /web#t=<slug> both want the topic2-all slug, never the label */
let __TSLUGS=null;const __TREG=new Map();const topicSlugs=()=>__TSLUGS||(__TSLUGS=J(BLOB+'/v1/mine/topic2-all/index.json').then(ix=>{const m=new Map();(ix.topics||[]).forEach(x=>{m.set(RX.fold(x.t),x.s);__TREG.set(RX.fold(x.t),{t:x.t,n:x.n||0});});return m;}).catch(()=>new Map()));
const tslugOf=label=>String(label||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50);
async function pairPage(slugA,slugB,topicSeg){
  const pl=(n,w)=>n===1?w:w+'s';
  const run=researchStart('research-pair');
  const roster=await getRoster();if(run!==RESEARCH_RUN)return;
  const pick=sl=>{const cs=roster.rows.filter(r=>r.s===sl).sort((a,b)=>(b.w||0)-(a.w||0));return cs[0]||null;};
  const ra=pick(slugA),rb=slugB?pick(slugB):null;if(!ra||(slugB&&!rb)){researchError('One of these authors could not load');return;}
  // the partner picker: the roster feeds a datalist; a full name (or the only match) navigates to #A/with/<slug>
  const pickerHTML=`<label class="rx-search rx-compare-pick rx-pair-pick">Compare ${esc(ra.a)} with<input id="pair-pick" type="search" placeholder="${rb?esc('Another author instead of '+rb.a):'Choose a second author'}" list="pair-pick-list" autocomplete="off"><datalist id="pair-pick-list"></datalist></label>`;
  const bindPicker=()=>{const rows=RX.roster(roster.rows).filter(r=>r.s!==slugA),dl=$('#pair-pick-list'),inp=$('#pair-pick');if(!dl||!inp)return;
    const fill=q=>{const f=RX.fold(q||'');dl.innerHTML=rows.filter(r=>!f||RX.fold(r.a).includes(f)).slice(0,30).map(r=>`<option value="${esc(r.a)}">${esc(RX.shelves[r.sh])} · ${fmtR(r.w)} works</option>`).join('');};
    const go=r=>{location.hash='#'+encodeURIComponent(slugA)+'/with/'+encodeURIComponent(r.s);};
    fill('');inp.oninput=e=>{fill(e.target.value);const f=RX.fold(e.target.value);const exact=rows.find(r=>RX.fold(r.a)===f);if(exact)go(exact);};
    inp.onchange=e=>{const f=RX.fold(e.target.value);if(!f)return;const hit=rows.find(r=>RX.fold(r.a)===f)||rows.filter(r=>RX.fold(r.a).includes(f))[0];if(hit)go(hit);};};
  if(!rb){const A0=await J(BLOB+`/v1/bible/${ra.sh}/rooms/${slugA}.json`).catch(()=>null);if(run!==RESEARCH_RUN)return;
    const nb=(A0?.neighbours||[]).slice(0,12).map(n=>{const r=roster.rows.find(x=>x.a===n.a)||null;return r?`<a class="chip" href="#${encodeURIComponent(slugA)}/with/${encodeURIComponent(r.s)}">${esc(n.a)} <small>${fmtR(n.n)}</small></a>`:'';}).join(' ');
    page.innerHTML=`<div class="crumbs"><a href="/the-faith-received/fathers/#">Authors</a> · <a href="${RX.authorURL(ra)}">${esc(ra.a)}</a></div><div class="ridbar"><h1>Compare ${esc(ra.a)}</h1><div class="stats">Choose a second author. The comparison shows every citation between the two, their shared topics side by side, and the Scripture both cite.</div></div><div class="view rx-pair"><div class="rx-filters">${pickerHTML}</div>${nb?`<h3 class="rx-loci-head">Most connected authors<small>by citations either way</small></h3><p class="rx-pair-neighbours">${nb}</p>`:''}</div>`;
    researchLayout();bindPicker();document.title=`Compare ${ra.a} · The Faith Received`;return;}
  const [A,B,recA,recB]=await Promise.all([
    J(BLOB+`/v1/bible/${ra.sh}/rooms/${slugA}.json`).catch(()=>null),J(BLOB+`/v1/bible/${rb.sh}/rooms/${slugB}.json`).catch(()=>null),
    gzJ(BLOB+`/v1/reception/${slugA}.json.gz?d=`+bust()).catch(()=>null),gzJ(BLOB+`/v1/reception/${slugB}.json.gz?d=`+bust()).catch(()=>null)]);
  const keyA=recA?.fk||slugA,keyB=recB?.fk||slugB;   // reception keys: the full shards' `to` maps are keyed by these
  const [fullA,fullB]=await Promise.all([gzJ(BLOB+`/v1/reception/full/${keyA}.json.gz`).catch(()=>null),gzJ(BLOB+`/v1/reception/full/${keyB}.json.gz`).catch(()=>null)]);
  if(run!==RESEARCH_RUN)return;if(!A||!B){researchError('One of these authors could not load');return;}
  A.s=keyA;B.s=keyB;const TS=await topicSlugs();if(run!==RESEARCH_RUN)return;
  const worksA=new Map((A.works||[]).map(w=>[w.w,w])),worksB=new Map((B.works||[]).map(w=>[w.w,w]));
  const titleOf=(w,shard)=>(shard?.works||{})[w]||worksA.get(w)?.t||worksB.get(w)?.t||w;
  const AtoB=(fullA?.to||{})[keyB]||{n:0,rows:[]},BtoA=(fullB?.to||{})[keyA]||{n:0,rows:[]};
  const HOWL2={cites:'cites',quotes:'quotes',reports:'reports',approves:'approves',refutes:'refutes'};
  // MASTER–DETAIL PANES (owner 2026-09-09 "minimize the endless scrolling"): a list pane on the left
  // (works, or topics), the chosen item's rows in a pane on the right. Every row is reachable; the
  // page itself stays four sections tall.
  const block=(from,to,shard,pack,id)=>{
    const rows=pack.rows||[];if(!rows.length)return `<p class="rx-note" id="${id}">${esc(from.a)} on ${esc(to.a)}: no resolved citations in the mine.</p>`;
    const byW=new Map();rows.forEach(r=>{byW.set(r.w,(byW.get(r.w)||0)+1);});
    const targets=new Map();rows.forEach(r=>{if(r.tw)targets.set(r.tw,(targets.get(r.tw)||0)+1);});
    const how={};rows.forEach(r=>{how[r.h||'cites']=(how[r.h||'cites']||0)+1;});
    const works=[...byW.entries()].sort((a,b)=>b[1]-a[1]);
    return `<section class="rx-pair-block" id="${id}"><h3>${esc(from.a)} on ${esc(to.a)}<small>${fmtR(rows.length)} ${pl(rows.length,'citation')} across ${fmtR(works.length)} ${pl(works.length,'work')} · <a href="/the-faith-received/web/#e=${encodeURIComponent(from.s||'')},${encodeURIComponent(to.s||'')}">open in the citation web</a></small></h3>
      <p class="rx-note">${Object.entries(how).sort((a,b)=>b[1]-a[1]).map(([k,n])=>esc(HOWL2[k]||k)+' '+fmtR(n)).join(' · ')}${targets.size?' · leans on: '+[...targets.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([w,n])=>`<a href="${readerHref(w)}">${esc(titleOf(w,shard))}</a> ${fmtR(n)}`).join(', '):''}</p>
      <div class="rx-md"><div class="rx-md-list rx-pane" role="tablist" aria-label="Citing works"><button role="tab" class="rx-md-item rx-md-all on" aria-selected="true" data-md="${id}" data-w=""><span>All works</span><small>${fmtR(rows.length)}</small></button>${works.map(([w,n])=>`<button role="tab" class="rx-md-item" aria-selected="false" data-md="${id}" data-w="${esc(w)}"><span>${esc(titleOf(w,shard))}</span><small>${fmtR(n)}</small></button>`).join('')}</div>
      <div class="rx-md-detail"><div class="rx-pair-evidence" data-pair-evidence="${id}"></div></div></div></section>`;};
  // the shared citation module (filters, select, save) renders the rows; the work list drives its "Source work" filter
  const mounted={};
  const mountPair=async id=>{const dd=dirs.find(x=>x.id===id),host=page.querySelector(`[data-pair-evidence="${id}"]`);if(!dd||!host||mounted[id])return;mounted[id]=true;
    const cm=await comms().catch(()=>({map:{}}));if(run!==RESEARCH_RUN||!host.isConnected)return;
    if(!window.FRConnectionEvidence?.mountCitation){host.innerHTML='<p class="rx-note">The citation module could not load.</p>';return;}
    FRConnectionEvidence.mountCitation(host,{data:dd.shard,citing:{s:dd.from.s,a:dd.from.a},target:{s:dd.to.s,a:dd.to.a},commentaries:cm});};
  const showWork=(id,w)=>{const host=page.querySelector(`[data-pair-evidence="${id}"]`),sel=host?.querySelector('[data-ce-work]');if(sel){sel.value=w;sel.dispatchEvent(new Event('change'));}
    page.querySelectorAll(`[data-md="${id}"]`).forEach(b=>{const on=b.dataset.w===w;b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on));});};
  // shared topics: the comparison desk in two-author mode (owner 2026-09-10)
  const wantT=topicSeg?decodeURIComponent(topicSeg):'';
  const sharedN=(A.topics||[]).filter(t=>!RX.isRawTopic(t.t)&&(B.topics||[]).some(x=>RX.fold(x.t)===RX.fold(t.t))).length;
  const dirs=[{from:A,to:B,shard:fullA,pack:AtoB,id:'pair-ab',n:(AtoB.rows||[]).length},{from:B,to:A,shard:fullB,pack:BtoA,id:'pair-ba',n:(BtoA.rows||[]).length}].sort((x,y)=>y.n-x.n);
  const bA=new Map(A.books||[]),bB=new Map(B.books||[]);const sharedBooks=[...bA.keys()].filter(k=>bB.has(k)).map(k=>[k,bA.get(k),bB.get(k)]).sort((x,y)=>(y[1]+y[2])-(x[1]+x[2])).slice(0,24);
  page.innerHTML=`<div class="crumbs"><a href="/the-faith-received/fathers/#">Authors</a> · <a href="${RX.authorURL(ra)}">${esc(A.a)}</a> · <a href="${RX.authorURL(rb)}">${esc(B.a)}</a></div>
  <div class="ridbar"><h1>${esc(A.a)} <span class="rx-pair-and">and</span> ${esc(B.a)}</h1>
    <div class="stats"><b>${fmtR(AtoB.n||AtoB.rows.length)}</b> ${pl(AtoB.n||AtoB.rows.length,'citation')} of ${esc(B.a)} in ${esc(A.a)} · <b>${fmtR(BtoA.n||BtoA.rows.length)}</b> ${pl(BtoA.n||BtoA.rows.length,'citation')} of ${esc(A.a)} in ${esc(B.a)} · <b>${fmtR(sharedN)}</b> shared ${pl(sharedN,'topic')} · <a href="/the-faith-received/web/#a=${encodeURIComponent(slugA)}">${esc(A.a)} in the citation web</a> · <a href="/the-faith-received/web/#a=${encodeURIComponent(slugB)}">${esc(B.a)} in the citation web</a></div></div>
  <div class="view rx-pair"><div class="rx-filters rx-pair-tools">${pickerHTML}<a class="rx-text-link" href="/the-faith-received/fathers/?sh=${encodeURIComponent(ra.sh)}&cmp=${encodeURIComponent(slugB)}#${encodeURIComponent(slugA)}/positions">Every topic of ${esc(A.a)} with ${esc(B.a)} beside it</a></div><nav class="rx-loci-jump">${dirs.filter(d=>d.n).map(d=>`<a href="#${d.id}">${esc(d.from.a)} on ${esc(d.to.a)}</a>`).join('')}<a href="#pair-topics">Shared topics</a><a href="#pair-scripture">Scripture in common</a></nav>
    ${dirs.map(d=>block(d.from,d.to,d.shard,d.pack,d.id)).join('')}
    <section class="rx-pair-block" id="pair-topics"><h3>Positions, topic by topic<small>${fmtR(sharedN)} shared topics · every statement, grouped by work</small></h3><div id="pair-desk"></div></section>
    <section class="rx-pair-block" id="pair-scripture"><h3>Scripture in common<small>books both authors cite most</small></h3>${sharedBooks.length?`<table class="rx-pair-table"><thead><tr><th>Book</th><th>${esc(A.a)}</th><th>${esc(B.a)}</th></tr></thead><tbody>${sharedBooks.map(([b,na,nb])=>`<tr><td><a href="${FRScripture.bibleURL?FRScripture.bibleURL(b):'/the-faith-received/bible/'}">${esc(b)}</a></td><td>${fmtR(na)}</td><td>${fmtR(nb)}</td></tr>`).join('')}</tbody></table>`:'<p class="rx-note">No shared books recorded.</p>'}</section>
  </div>`;
  researchLayout();bindPicker();
  page.querySelectorAll('[data-md]').forEach(b=>b.onclick=()=>showWork(b.dataset.md,b.dataset.w));
  dirs.forEach(dd=>{if(dd.n)mountPair(dd.id);});
  compareDesk($('#pair-desk'),{a:[slugA,slugB],sel:wantT,g:'work',s:'',q:''},{embedded:true,onState:st=>{const h='#'+encodeURIComponent(slugA)+'/with/'+encodeURIComponent(slugB)+(st.sel?'/topic/'+encodeURIComponent(st.sel):'');if(location.hash!==h)history.replaceState(null,'',location.pathname+location.search+h);}});
  if(wantT)requestAnimationFrame(()=>document.getElementById('pair-topics')?.scrollIntoView({block:'start'}));
  page.querySelector('.rx-loci-jump').addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;e.preventDefault();document.getElementById(a.getAttribute('href').slice(1))?.scrollIntoView({block:'start',behavior:'smooth'});});
  document.title=`${A.a} and ${B.a} · The Faith Received`;
}
function route(){
  const [hashPath,hashQuery=""]=location.hash.slice(1).split("?");
  const h=decodeURIComponent(hashPath);
  const hashParams=new URLSearchParams(hashQuery);
  BIBLE_STATE={view:["read","desk","commentaries","annotations"].includes(hashParams.get("view"))?hashParams.get("view"):"read",verse:Number(hashParams.get("v"))||null};
  ++BIBLE_RUN;++RESEARCH_RUN;researchEvents.abort();researchEvents=new AbortController();hideGloss(0);
  page.onclick=null;page.onmouseover=null;page.onmouseout=null;
  const navmark=k=>document.querySelectorAll("#topnav a[data-p]").forEach(a=>a.classList.toggle("on",a.dataset.p===k));
  const names={bible:"Scripture",topics:"Topics",fathers:"Authors",compare:"Compare"};
  document.title=names[PAGE]+" · The Faith Received";
  $("#pgname").textContent=names[PAGE];
  if(h==="t"||h.startsWith("t/")){location.replace("/the-faith-received/topics/"+(h==="t"?"":"#"+h.slice(2)));return;}
  if(h==="f"){location.replace("/the-faith-received/fathers/");return;}
  if(h.startsWith("a/")){location.replace("/the-faith-received/fathers/#"+h.slice(2));return;}
  if(PAGE==="compare"){navmark("compare");const token=RESEARCH_RUN;comparePage().catch(e=>{console.error(e);if(token===RESEARCH_RUN)researchError("The comparison desk could not load");});return;}
  if(PAGE==="topics"){navmark("topics");const token=RESEARCH_RUN;(h?topicPage(h):topicsIndex()).catch(()=>{if(token===RESEARCH_RUN)researchError("Topics could not load");});return;}
  if(PAGE==="bible"){
    navmark("bible");
    const task=h.startsWith("b/")?(()=>{const seg=h.slice(2).split("/");return bookPage(seg[0],+seg[1]||0,seg[2]||null);})():bibleHome();
    const token=BIBLE_RUN;task.catch(()=>{if(token!==BIBLE_RUN)return;page.innerHTML='<h1>Scripture could not load</h1><p>Your passage is still in the address bar.</p><button id="retry-bible">Retry loading</button> <a href="/the-faith-received/bible/">Browse Scripture</a>';$("#retry-bible").onclick=route;});
    return;
  }
  if(h==="works"){navmark("works");const token=RESEARCH_RUN;worksIndex().catch(()=>{if(token===RESEARCH_RUN)researchError("Works could not load");});return;}   // reborn 08-25: kind-grouped, canon-ordered
  if(h.startsWith("w/")){navmark("works");workPage(h.slice(2));return;}
  navmark("fathers");
  if(!h){const token=RESEARCH_RUN;authorsIndex().catch(()=>{if(token===RESEARCH_RUN)researchError("Authors could not load");});return;}
  const seg=h.split("/");
  const token=RESEARCH_RUN;
  if(seg[1]==="with"){pairPage(seg[0],seg[2]||"",seg[3]==="topic"?seg.slice(4).join("/"):"").catch(()=>{if(token===RESEARCH_RUN)researchError("This comparison could not load");});return;}
  room(seg[0],seg.slice(1).join("/")).catch(()=>{if(token===RESEARCH_RUN)researchError("This author could not load");});
}
document.addEventListener('keydown',e=>{const tab=e.target.closest('[role="tab"]');if(tab&&['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){const tabs=[...tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]')].filter(t=>t.style.display!=='none');const i=tabs.indexOf(tab),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;e.preventDefault();tabs[next].click();tabs[next].focus();}const verse=e.target.closest('.vs2[role="button"]');if(verse&&e.target===verse&&['Enter',' '].includes(e.key)){e.preventDefault();verse.click();}});
addEventListener("hashchange",route);
addEventListener("popstate",route);
route();
