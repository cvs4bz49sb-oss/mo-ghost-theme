
const $=s=>document.querySelector(s),el=(t,c)=>{const e=document.createElement(t);if(c)e.className=c;return e;};
const esc=s=>(s==null?"":String(s)).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
let WORKS=[],OWNER=false,MODE="trad",TRAD_ORDER=[],REVIEW_COV=null,BLURBS={},AUTHORS={},TITLES={};
let VIEW="library",CONFS=null,CONF_FACET="all",CONF_TRAD="all",CONF_Q="";   // Confessions tab (Reformed + Lutheran)
// blurb popover opens to the RIGHT of the card; flip LEFT when it would overflow the viewport (seamless side tooltip)
document.addEventListener("mouseover",e=>{const t=e.target.closest&&e.target.closest(".haspop");if(!t)return;const rc=t.getBoundingClientRect(),pw=Math.min(340,innerWidth*0.4);t.classList.toggle("pop-flip",rc.right+14+pw>innerWidth);});
// QA coverage (review.json): a per-work reviewed badge — the imported QA-coverage results
function qaBadge(w){if(!REVIEW_COV)return"";const r=REVIEW_COV[w.slug||w.workspace];if(!r||!r.pp)return"";
  const pct=Math.round((r.v/r.pp)*100);if(!pct)return"";
  const full=pct>=99;
  return ` · <span class="qa${full?' qa-full':''}" title="${r.v} of ${r.pp} pages reviewed${r.n?'; '+r.n+' flagged':''}">${full?'✓ reviewed':pct+'% reviewed'}</span>`;}
function renderContinue(){try{
  const lr=JSON.parse(localStorage.getItem("fr_lastread")||"{}");
  const items=Object.entries(lr).filter(([,e])=>e&&e.page!==null&&e.page!==undefined&&e.page!==""&&(e.slug||e.title)).sort((a,b)=>(b[1].ts||0)-(a[1].ts||0)).slice(0,6);
  if(!items.length)return;
  const box=$("#continue");
  box.innerHTML='<div class=ct>Continue reading</div><div class=cshelf>'+items.map(([ws,e])=>
    `<a class=ccard title="${esc(e.title||ws).replace(/"/g,"&quot;")}" href="/the-faith-received/read/?w=${encodeURIComponent(e.slug||ws)}#b${encodeURIComponent(e.page)}-0">`+
    `<span class=ct1>${esc(e.title||ws.split("/").slice(-1)[0])}</span>`+
    `<span class=ct2>${esc(e.author||"")} · fol. ${esc(e.page)}</span></a>`).join("")+'</div>';
}catch(e){}}
renderContinue();
function matchF(w,f){return !f||[w.title,TITLES[w.slug],w.author,w.author_en,w.author_gr,w.author_full,w.party,w.volume,w.tradition,w.workspace].some(x=>String(x==null?"":x).toLowerCase().includes(f));}   // String(): numeric volumes (old TFR rows) crashed every filtered render ("library could not load", 2026-08-17)   // aliases: PL English authors ("Jerome"→Hieronymus), EEBO full names+dates, party ("puritan"), tome ("PL 137")
  // HONEST PAGE COUNT (owner 2026-08-18, Aquinas '6-7 pp' class): section-counted works
  // under-report wildly — when the text mass says the work is much bigger than its
  // section count, estimate printed pages from characters (~1,800/printed page).
  const _ppEst=w=>{
    if(w.has_pages||w.pdf_pages){const n=w.n_pages||w.md_pages||0;return n>1?n.toLocaleString()+" pp":"";}   // facsimile: the scan IS the ground truth
    const base=(w.md_pages||w.n_pages||0);
    const ch=Math.max(w.la_chars||0,w.en_chars||0);
    if(ch&&ch/1800>base*1.6)return base>1?base.toLocaleString()+" sections":"";   // section-counted BD: the honest unit is SECTIONS, never a page estimate (owner 2026-08-31 ×2)
    return base>1?base.toLocaleString()+" pp":"";};
function workRow(w){
  // English Divines read in the adapted EEBO reader (sidebar Contents + one wide
  // reading column), hydrating from the eebo work store on this same Blob
  const _rd=s=>"/the-faith-received/read/?w="+encodeURIComponent(s);   // eebo- now hydrates in the main reader (2026-08-18)
  const r=el("div","row");r.dataset.ws=w.workspace;
  const review=w.needs?`<b>${w.needs}</b> to review · `:"";
  const vol=w.volume?`<span class=vol>${esc(w.volume)}</span>`:"";
  const ed=OWNER?`<button class=ed title="Edit title">✎</button>`:"";
  // cover thumbnail: the actual title-page facsimile (Blob WebP). Scanned works only; born-digital
  // get a typographic placeholder (no scan exists). Title-page number from the index.
  const slug=w.slug||w.workspace;
  const _bl=BLURBS[slug];const popHTML=(_bl&&_bl.blurb)?`<div class=pop>${esc(_bl.blurb)}</div>`:""; if(_bl&&_bl.blurb)r.classList.add("haspop");
  const _cbase=w.img_base||(BLOB?`${BLOB}/v1/works/${encodeURIComponent(slug)}/p/`:"");   // re-slugged facsimile (Confessio) → img_base points at the WebPs' real (old-slug) path
  const thumb=(_cbase&&(w.has_pages||w.pdf_pages))?`<img class=cover loading=lazy alt="${esc(w.title||slug)} — title page" src="${_cbase}${w.title_page||1}.webp">`:"";
  if(!thumb)r.classList.add("nocov");   // born-digital: no facsimile exists → text-forward card, no generic cover image
  // collected-works volumes (Scotus Opera Omnia, Suárez Opera …): the title says nothing — surface
  // WHAT THE TOME COVERS in the scroll itself, from the blurb's leading clause (the Penner contents).
  // WHAT THE TOME COVERS, visible on the card (not just the hover pop): Opera-Omnia-style
  // titles as before, plus any contents-style blurb ("Contains: …" / "Table talk: …" —
  // the Luther bands; owner 2026-08-16: 'want to know the main texts per vol in landing').
  // Truncate at an item boundary ('; ') so the list never cuts mid-title.
  const covers=(()=>{const b=_bl&&_bl.blurb?String(_bl.blurb):"";if(!b)return "";
    const isOpera=/^opera(\s+omnia)?$/i.test((w.title||"").trim());
    const isContents=/^(Contains|Table talk):/i.test(b);
    if(!isOpera&&!isContents)return "";
    let t=b.split(" — ")[0];
    if(t.length>168){const cut=t.slice(0,168).lastIndexOf("; ");t=(cut>40?t.slice(0,cut):t.slice(0,160))+" …";}
    return t;})();
  // CATALOGUE ENTRY (owner 2026-08-17 'redesign the work pills… academic standard'):
  // the card reads like a library record — Title, original title beneath, then ONE quiet
  // imprint line (year · volume · pages · source) — and the whole card opens the work.
  // Author/tradition never repeat here: the section header already says whose shelf this is.
  const _yr=(String(w.volume||"").match(/^1[3-9]\d\d/)||[])[0]||"";
  const _volNY=_yr?"":String(w.volume||"");
  // WITNESS (owner 2026-09-09 'indicate what works are digital vs facsimile'): a facsimile
  // work carries TWO witnesses — the page scans and the text read against them; a digital
  // work is the transcription alone. Said once per card, as a chip, and filterable in the bar.
  const _isFac=!!(w.has_pages||w.pdf_pages);
  const _src=String(slug).startsWith("eebo-")?"EEBO-TCP"
    :String(slug).startsWith("pld-")?"Patrologia Latina":"";
  const _wit=_isFac?'<span class="wit fac" title="Facsimile edition: the page scans are a second witness beside the text">Facsimile</span>'
    :'<span class="wit dig" title="Digital edition: transcribed text without page scans">Digital</span>';
  const _pp=(typeof _ppEst==="function")?_ppEst(w):((w.md_pages||w.n_pages)>1?((w.md_pages||w.n_pages).toLocaleString()+" pp"):"");
  const imprint=[_yr,_volNY,_pp].filter(Boolean).map(esc).concat([_wit+(_src?esc(_src):"")]).join('<span class=impdot>·</span>');
  r.innerHTML=(thumb?`${thumb}`:"")+
    `<div class=cbody><div class=wt><span class=tt title="${esc(TITLES[slug]||w.title||"")}">${esc(TITLES[slug]||w.title||w.workspace.split('/').slice(-1)[0])}</span>${ed}</div>`+
    ((TITLES[slug]&&TITLES[slug]!==w.title)?`<div class=wlat>${esc(w.title)}</div>`:"")+
    (covers?`<div class=wcov>${esc(covers)}</div>`:"")+
    `<div class=imprint>${OWNER?review:""}${imprint}${qaBadge(w)}</div></div>`+
    `<div class=rgo>${OWNER?`<a class="btn" href="${BLOB?"/the-faith-received/read/?w="+encodeURIComponent(slug):"/the-faith-received/review/?ws="+encodeURIComponent(w.workspace||slug)}">Review</a>`:""}<span class=cvr>&#8250;</span></div>`+popHTML;
  r.classList.add("cardlink");
  r.addEventListener("click",e=>{
    if(e.target.closest("button,.btn,.ed,a"))return;
    location.href=_rd(slug);});
  r.setAttribute("role","link");r.tabIndex=0;
  r.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.target.closest("button,input"))location.href=_rd(slug);});
  const im=r.querySelector("img.cover");if(im)im.onerror=()=>{im.replaceWith(Object.assign(document.createElement("span"),{className:"cover ph",textContent:(w.title||"·").slice(0,1)}));};
  if(OWNER)r.querySelector(".ed").onclick=()=>editWork(r,w);
  return r;
}
function editWork(r,w){
  const box=el("div","row-edit");
  const trads=[...new Set([...(TRAD_ORDER||[]),w.tradition])];
  box.innerHTML=`<label class=full>Title<input class=eT value="${esc(w.title)}"></label>`+
    `<label>Author<input class=eA value="${esc(w.author||'')}"></label>`+
    `<label>Tradition / Denomination<select class=eTr>${trads.map(t=>`<option ${t===w.tradition?'selected':''}>${esc(t)}</option>`).join("")}</select></label>`+
    `<div class=ebtns><button class=pri>Save</button><button class=cx>Cancel</button><span class=ehint>↵ save · esc cancel</span></div>`;
  r.replaceWith(box);const T=box.querySelector(".eT");T.focus();T.select();
  const cancel=()=>render();   // full re-render restores the row in its place
  box.querySelector(".cx").onclick=cancel;
  box.querySelector(".pri").onclick=async()=>{
    const title=T.value.trim()||w.title, author=box.querySelector(".eA").value.trim()||w.author, tradition=box.querySelector(".eTr").value;
    try{await fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/work-title",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ws:w.workspace,title,author,tradition})});}catch(e){}
    w.title=title;w.author=author;w.tradition=tradition;render();   // re-render → work moves to its new author/tradition group
  };
  box.querySelectorAll("input").forEach(i=>i.addEventListener("keydown",e=>{if(e.key==="Enter")box.querySelector(".pri").click();else if(e.key==="Escape")cancel();}));
}
// ── PL RESEARCH DOORS (owner 2026-08-17): the family's mined layers, hydrated live ──
window.__plr=window.__plr||{cache:{},fam:'pl',st:{book:null,ch:null,sec:null,subj:null,view:'sky'}};   // constellations lead (owner 2026-08-20)
function _plrFetch(path){const c=window.__plr.cache;
  if(c[path])return c[path];
  return c[path]=fetch(BLOB+"/v1/"+((window.__plr&&window.__plr.fam)||"pl")+"research/"+path).then(r=>r.ok?r.json():null)
    .then(v=>{if(v==null)delete c[path];return v;})   // never cache a miss — retry next click
    .catch(()=>{delete c[path];return null;});}
const _plrCol=cit=>{const m=String(cit||"").match(/:(\d+)/);return m?+m[1]:null;};
const _plrLink=h=>{const col=_plrCol(h.cit);
  return "/the-faith-received/read/?w=pld-"+h.d+(col?("#b"+col+"-0"):"");};
// ATTRIBUTION-AWARE GROUPING (owner 2026-08-17 'make this cleaner'): compound author
// strings ('Unknown author (Augustine of Hippo?); Unknown author (John XXII?)') each
// spawned a one-work section. Group by the FIRST named author; every anonymous variant
// merges into one 'Uncertain attribution' shelf, with the conjecture kept on the row.
const _ANON=/^(unknown|auctor|various|anonym|editors|editores|uncertain)/i;
function byAuthorClean(ws){const m={};ws.forEach(w=>{
  let k=_foldAu((window.__dispAu||(x=>x))(String(w.author_en||w.author||"Unknown").split(";")[0].trim()));
  if(_ANON.test(k))k="Uncertain attribution";
  (m[k]=m[k]||[]).push(w);});return m;}
const _attOf=w=>{const a=String(w.author_en||w.author||"");
  if(!_ANON.test(a))return "";
  const g=[...a.matchAll(/\(([^)]+?)\??\)/g)].map(x=>x[1]);
  return g.length?g.join(" or ")+"?":"";};
let _pldByIdM=null;
const _pldById=d=>{if(!_pldByIdM){_pldByIdM={};WORKS.forEach(w=>{const m=String(w.slug||"").match(/^pld-(\d+)$/);if(m)_pldByIdM[m[1]]=w;});}
  return _pldByIdM[d];};
function _plrHitRow(h){
  const tx=String(h.tx||"").replace(/^\u2026?\s*/,"").slice(0,260);
  let chip=h.cit||"";
  if(!chip){const w=_pldById(h.d);chip=w?("PL "+String(w.volume||"").replace(/^PL\s*/,"")):("pld-"+h.d);}
  return `<a class=sprow href="${_plrLink(h)}"><span class=spc>${esc(chip)}</span>`+
    `<span class=spt>${esc(tx)}\u2026</span></a>`;}
// ── CONSTELLATION MAPS (absorbed from the PLD research lenses 2026-08-20) ──────────────
// Three graphs computed from every Vulgate citation in the Patrologia: AUTHORS who read
// Scripture alike (434 nodes / 1,858 edges), WORKS placed by what they cite (1,757 /
// 7,321), and DOCTRINES related through Migne's own locus apparatus (138 / 425). Each
// node carries a precomputed x/y, so the map draws instantly and identically every visit.
// ── WHAT THE CORPUS CITES (the mined layer's first public fruit, 2026-08-20) ─────────
// Aggregates only — never the per-page units, which stay unpublished. Four readings of
// 343 mined works / 204,918 pages: the canon within the canon, the authorities the corpus
// actually leans on, whom each author leans on, and whom it argues against (with the
// claims themselves, each opening at the page where it is made).
function renderMineInsights(host){
  host.innerHTML='<p class=shelfhint>Reading the corpus\u2019s own citations…</p>';
  fetch(BLOB+"/v1/mine/insights.json"+VER).then(r=>r.ok?r.json():null).then(d=>{
    if(!d){host.innerHTML='<p class=shelfhint>The citation layer is still being mined.</p>';return;}
    const st=window.__mineTab=window.__mineTab||"scripture";
    const bar=`<div class="plorg minetabs">`+
      [["scripture","Scripture"],["authorities","Authorities"],["leans","Who leans on whom"],["against","Contested"]]
        .map(([k,l])=>`<button class="pob${window.__mineTab===k?" on":""}" data-m="${k}">${l}</button>`).join("")+
      `<span class=plgn>${(d.works||0).toLocaleString()} works · ${(d.pages||0).toLocaleString()} pages mined</span></div>`;
    const bars=(rows,label,val,href)=>{
      const mx=Math.max(1,...rows.map(val));
      return `<div class=mrank>`+rows.map(r=>{
        const w=Math.max(2,Math.round(100*val(r)/mx));
        const h=href?href(r):null;
        return `<${h?`a href="${h}"`:"div"} class=mrow>`+
          `<span class=mlab>${esc(label(r))}</span>`+
          `<span class=mbar><i style="width:${w}%"></i></span>`+
          `<span class=mnum>${val(r).toLocaleString()}</span>`+
          `</${h?"a":"div"}>`;}).join("")+`</div>`;
    };
    const paint=()=>{
      let body="";
      const k=window.__mineTab;
      if(k==="scripture"){
        body='<p class=shelfhint>The canon within the canon — every scripture reference the mined works make, counted.</p>'+
          bars(d.scripture.slice(0,40),r=>r.r,r=>r.n,r=>"/the-faith-received/search/?q="+encodeURIComponent(r.r));
      }else if(k==="authorities"){
        body='<p class=shelfhint>The names the corpus actually leans on — every cited authority, counted across the mined pages.</p>'+
          bars(d.authorities.slice(0,40),r=>r.a,r=>r.n,r=>"/#q="+encodeURIComponent(r.a));
      }else if(k==="leans"){
        body='<p class=shelfhint>Whom each author cites most — a fingerprint of his reading.</p><div class=mleans>'+
          d.leans.slice(0,28).map(x=>`<div class=mlean><div class=mlname>${esc(x.a)}<span class=mlt>${x.tot.toLocaleString()} citations</span></div>`+
            `<div class=mltop>`+x.top.map(t=>`<span class=mchip>${esc(t.n)}<i>${t.c.toLocaleString()}</i></span>`).join("")+`</div></div>`).join("")+'</div>';
      }else{
        body='<p class=shelfhint>Whom the corpus argues against — every explicit denial or qualification, with the claim itself.</p>'+
          '<div class=magainst>'+d.against.slice(0,16).map(x=>
            `<details class=agroup><summary class=amark><span class=an>against ${esc(x.a)}</span><span class=vgc>${x.n.toLocaleString()}</span></summary>`+
            (x.ex||[]).map(e=>`<a class=sprow href="/the-faith-received/read/?w=${encodeURIComponent(e.w)}#b${e.p}-0">`+
              `<span class=spc>${esc(e.a||"")}</span><span class=spt>${esc(e.c)}</span></a>`).join("")+
            `</details>`).join("")+'</div>';
      }
      host.innerHTML=bar+body;
      host.querySelector(".minetabs").onclick=e=>{const b=e.target.closest(".pob");if(!b)return;
        window.__mineTab=b.dataset.m;paint();};
    };
    paint();
  }).catch(()=>{host.innerHTML='<p class=shelfhint>The citation layer could not load.</p>';});
}

// ── SHELF INSIGHTS ─────────────────────────────────────────────────────────────────────
// The mined reading of a shelf, shaped for study rather than for storage. Six lenses over
// the same pages; each row is a door into the text, never a dead end.
function renderShelfInsights(sw, slug){
  let focus=window.__insFocus||""; window.__insFocus="";
  const host=el("div","scomp shelfins");
  host.innerHTML='<span class=sk>What this shelf studies — from the mine</span>'+
    '<p class=shelfhint>Loading the mined reading…</p>';
  sw.appendChild(host);
  fetch(BLOB+"/v1/mine/shelf/"+slug+".json"+VER).then(r=>r.ok?r.json():null).then(d=>{
    if(!d||!d.loci){host.remove();return;}
    const TABS=[["loci","Questions"],["scripture","Scripture"],["authorities","Authorities"],
                ["debates","Controversies"],["quotables","Passages"],["works","Works"]];
    let tab="loci";
    const paint=(force)=>{
      if(force)tab=force;
      if(window.__insFocus){focus=window.__insFocus;window.__insFocus="";}
      const bar='<div class=insbar>'+TABS.map(([k,l])=>
        '<button type=button class="pob'+(tab===k?" on":"")+'" data-t="'+k+'">'+l+'</button>').join("")+
        '<span class=insmeta>'+(+d.minedPages).toLocaleString()+' pages mined across '+
        (+d.minedWorks).toLocaleString()+' works</span></div>';
      let body="";
      if(tab==="loci"){
        body='<p class=shelfhint>The questions these works actually treat, counted by the pages that treat them.</p>'+
          '<div class=inslist>'+(d.loci||[]).map((x,i)=>
            '<details class=insrow'+(focus&&focus===x.t?" open":"")+' data-q="'+esc(x.t)+'">'+
              '<summary><b>'+esc(x.t)+'</b>'+
              '<span class=insn>'+(+x.n).toLocaleString()+' pages · '+x.works+' works</span></summary>'+
              '<button type=button class="insmap" data-q="'+esc(x.t)+'">See where it sits on the map →</button>'+
              (x.ex||[]).map(e=>'<a class=insex href="'+esc(e.h)+'">'+
                '<span class=insw>'+esc(e.w)+'</span><span class=insg>'+esc(e.g)+'</span></a>').join("")+
            '</details>').join("")+'</div>';
      }else if(tab==="scripture"){
        body='<p class=shelfhint>The chapters this shelf turns on, as its own pages cite them.</p>'+
          '<div class=inschips>'+(d.scripture||[]).map(x=>
            '<a class=inschip href="/the-faith-received/search/?q='+encodeURIComponent(x.t)+'">'+esc(x.t)+
            '<i>'+(+x.n).toLocaleString()+'</i></a>').join("")+'</div>';
      }else if(tab==="authorities"){
        body='<p class=shelfhint>Whom these works cite — the shelf’s own canon of authorities.</p>'+
          '<div class=inschips>'+(d.authorities||[]).map(x=>
            '<a class=inschip href="/the-faith-received/search/?m=ask&q='+encodeURIComponent("How does this shelf use "+x.t+"?")+
            '">'+esc(x.t)+'<i>'+(+x.n).toLocaleString()+'</i></a>').join("")+'</div>';
      }else if(tab==="debates"){
        body='<p class=shelfhint>Positions these works state <em>against</em> a named opponent — the shelf’s live controversies.</p>'+
          '<div class=inslist>'+(d.debates||[]).map(x=>
            '<a class=insdeb href="'+esc(x.h)+'"><span class=insc>'+esc(x.c)+'</span>'+
            '<span class=insv>against '+esc(x.v)+'</span>'+
            '<span class=insw>'+esc(x.w)+'</span></a>').join("")+'</div>';
      }else if(tab==="quotables"){
        body='<p class=shelfhint>The sentence the mine judged most worth quoting on its page.</p>'+
          '<div class=inslist>'+(d.quotables||[]).map(x=>
            '<a class=insq href="'+esc(x.h)+'"><span class=insqt>“'+esc(x.q)+'”</span>'+
            '<span class=insw>'+esc(x.w)+'</span></a>').join("")+'</div>';
      }else{
        body='<p class=shelfhint>The works of this shelf the mine has read most deeply.</p>'+
          '<div class=inslist>'+(d.works||[]).map(x=>
            '<a class=insex href="'+esc(x.h)+'"><span class=insw>'+esc(x.t)+'</span>'+
            '<span class=insg>'+esc(x.a||"")+' · '+(+x.n).toLocaleString()+' mined pages</span></a>').join("")+'</div>';
      }
      host.innerHTML='<span class=sk>What this shelf studies — from the mine</span>'+bar+body;
      host.querySelector(".insbar").onclick=e=>{const b=e.target.closest("button[data-t]");
        if(!b)return;tab=b.dataset.t;paint();};
      host.onclick=e=>{const m=e.target.closest(".insmap");if(!m)return;e.preventDefault();
        window.__skyFocus=m.dataset.q;                 // the map opens on that very star
        const card=document.querySelector("#mineskyhost");
        const door=[...document.querySelectorAll('a[data-mk="doctrines"]')][0];
        if(door&&card){if(!card.querySelector(".skymap"))door.click();
          else renderConstellationMap(card,"doctrines",slug);
          setTimeout(()=>card.scrollIntoView({behavior:"smooth",block:"center"}),400);}};
      if(focus){const row=host.querySelector('.insrow[data-q="'+focus.replace(/"/g,'')+'"]');
        if(row){row.open=true;setTimeout(()=>row.scrollIntoView({behavior:"smooth",block:"center"}),120);}
        focus="";}
    };
    paint();
    host.__paint=paint;                    // the sky calls this to open a question here
  }).catch(()=>{host.remove();});
}
// ── ONE MAP ENGINE FOR EVERY SKY ──────────────────────────────────────────────────────
// The PLD constellation is the contract (owner 2026-08-20: "THIS IS NOT THE BEHAVIOUR OF
// THE PLD CONSTELLATION … I want to see the results in the constellation, and when I open
// I want to see all the results … and did you fix the PL constellation citing latin").
// So: a legible PARCHMENT map, coloured by a category with its own legend, searchable and
// zoomable — and opening a star opens the EVIDENCE: its neighbours, and every result
// behind it. Names are English throughout; the Latin heading stays as the sub-line.
const SKYPAL=["#a8442f","#a4791f","#3d7a62","#5a5a9c","#2f6b93","#8a5a2b","#7a6a55","#9c3f6b"];
let __enP=null;
function skyEN(){if(!__enP)__enP=fetch(BLOB+"/v1/authors_en.json"+VER).then(r=>r.ok?r.json():{}).catch(()=>({}));
  return __enP;}
async function drawSky(host,d,K,ctx){
  const EN=await skyEN();if(!host.isConnected)return;
  return FRShelfMap.render(host,d,K,{...(ctx||{}),en:s=>EN[String(s||'').trim()]||String(s||''),ver:VER,blob:BLOB,focus:window.__skyFocus||''});
}

function renderConstellationMap(host, kind, shelfSlug){
  // MINED SHELF SKIES (owner 2026-08-20: "the mining should mean each shelf has its own
  // constellations that link together; PL is a unique beast for now"). PL draws from Migne's
  // printed indices; every other shelf draws from the mine — authors placed by which
  // Scripture they cite, works by their citation profile, doctrines by co-occurrence.
  const ASK=(q,tr)=>"/the-faith-received/search/?m=ask&q="+encodeURIComponent(q)+(tr?"&trad="+encodeURIComponent(tr):"");
  if(shelfSlug){
    const _tr=(typeof SEL_TRAD!=="undefined"&&SEL_TRAD)?SEL_TRAD:"";   // the map also renders outside the shelf page
    const shelfName=(window.__MINESKY&&window.__MINESKY[_tr]&&window.__MINESKY[_tr].shelf)||_tr||"";
    const M={authors:{label:"Authors who read Scripture alike",
        hint:"Each star is an author of this shelf, placed by the verses he cites; a line joins two whose scriptural imagination runs together — computed from the mined pages.",
        find:"Find an author…",unit:"scripture citations",
        rowLabel:"This author's mined works",nbLabel:"Nearest authors — closest scripture fingerprints",
        name:n=>n.a,size:n=>n.n,
        href:n=>"/#a="+encodeURIComponent(n.a||""),goLabel:"Author's shelf",
        ask:(n,nm)=>ASK("What is distinctive about "+nm+"'s use of Scripture?",shelfName),
        note:"Fingerprints are computed from mined pages only. Proximity means a shared way of citing Scripture, not proof of contact."},
      works:{label:"Works placed by what they cite",
        hint:"Every dot is one mined work, positioned by its own citation profile — neighbours read Scripture the same way.",
        find:"Find a work…",unit:"scripture citations",
        rowLabel:"Most-cited chapters",nbLabel:"Nearest works — closest scripture fingerprints",
        name:n=>n.t||n.a,size:n=>n.n,
        href:n=>n.w?("/the-faith-received/read/?w="+encodeURIComponent(n.w)):"",goLabel:"Open the work",
        ask:(n,nm)=>ASK("What does "+nm+" argue, and from which texts?",shelfName)},
      doctrines:{label:"Doctrines that travel together",study:true,
        foot:"Size is how often this shelf treats the locus; two stars sit close when the same pages treat them together. Distances are a projection — only neighbourhoods are meaningful.",
        hint:"Each star is a locus this shelf actually treats; lines join the questions that appear on the same page. Open one to read every mined page behind it.",
        find:"Find a doctrine…",unit:"mined pages",
        rowLabel:"Every mined page on this locus",nbLabel:"Questions treated alongside it",
        name:n=>n.a,size:n=>n.n,href:n=>"",
        ask:(n,nm)=>ASK("How does this shelf treat "+nm+"?",shelfName)}}[kind]||null;
    if(!M){host.innerHTML="";return;}
    host.innerHTML='<p class=shelfhint>Drawing the map…</p>';
    const base=BLOB+"/v1/mine/constellations/"+shelfSlug+"/";
    fetch(base+kind+".json"+VER).then(r=>{if(!r.ok)throw Error('Map unavailable');return r.json();}).then(d=>{
      if(!d||!d.nodes)throw Error('Map unavailable');
      if(!d.nodes.length){host.innerHTML='<p class=shelfhint>This export contains no entries. Choose another map or shelf.</p>';return;}
      drawSky(host,d,M,{rowsUrl:base+kind+".rows.json",shelf:shelfSlug,kind});
    }).catch(()=>{host.innerHTML='<p class=shelfhint>This constellation could not load. Your selection is kept.</p><button class="pob" data-map-retry>Retry constellation</button>';host.querySelector('[data-map-retry]').onclick=()=>renderConstellationMap(host,kind,shelfSlug);});
    return;
  }
  // ── PATROLOGIA: Migne's own indices ──────────────────────────────────────────────────
  const _fam=((window.__plr&&window.__plr.fam)||"pl")==="pg"?"pg":"pld";
  const ERA=[{k:"E",l:"Early patristic"},{k:"L",l:"Later patristic"},
             {k:"C",l:"Carolingian–11th c."},{k:"H",l:"12th–13th c."}];
  let _worksP=null;
  const plWorks=()=>{if(!_worksP)_worksP=fetch(BLOB+"/v1/"+((window.__plr&&window.__plr.fam)||"pl")+
      "research/constellations/works.json"+VER).then(r=>r.ok?r.json():null).catch(()=>null);
    return _worksP;};
  const K={authors:{f:"authors",label:"Authors who read Scripture alike",
        hint:"Each star is a Father, placed by which verses he cites; a line joins two who cite alike. The brightest have the most citations.",
        find:"Find an author — e.g. Bede, Jerome, Peter Damian…",unit:"citations",
        rowLabel:"The author's works",nbLabel:"Neighbouring authors — closest scripture fingerprints",
        name:n=>n.a,size:n=>n.n,cats:ERA,worksMap:true,
        href:n=>"/#a="+encodeURIComponent(n.a||""),goLabel:"Author's shelf",
        ask:(n,nm)=>ASK("How does "+nm+" read Scripture?","Latin Fathers"),
        note:"Fingerprints are computed from genuine works only. Proximity means a shared way of citing Scripture, never proof of contact.",

        rows:async (n,i,en)=>{const w=await plWorks();if(!w||!w.nodes)return [];
          return w.nodes.filter(x=>x.a===n.a).sort((a,b)=>(b.n||0)-(a.n||0))
            .map(x=>({t:x.t||"",s:(x.v?("PL "+x.v):"")+(x.n?(x.v?" · ":"")+(+x.n).toLocaleString()+" citations":""),
                      h:x.d?("/the-faith-received/read/?w="+_fam+"-"+x.d):""}));}},
      works:{f:"works",label:"Works placed by what they cite",byAuthor:true,
        hint:"Every dot is one work, positioned by its own citation profile — neighbours share a scriptural imagination.",
        find:"Find a work…",unit:"citations",
        rowLabel:"",nbLabel:"Neighbouring works — closest scripture fingerprints",
        name:n=>n.t||n.a,size:n=>n.n,cats:ERA,
        href:n=>n.d?("/the-faith-received/read/?w="+_fam+"-"+n.d):"",goLabel:"Open the work",
        ask:(n,nm)=>ASK("What does "+nm+" argue?","Latin Fathers")},
      topics:{f:"topics",label:"Doctrines and how they relate",
        hint:"Each star is a locus from Migne's own apparatus; lines join the questions the Fathers treat together. Open one for the verses it turns on.",
        find:"Find a doctrine…",unit:"witnesses",
        rowLabel:"The verses this locus turns on",nbLabel:"Questions treated alongside it",
        name:n=>n.t||n.label||n.name,size:n=>n.n||1,href:n=>"",
        ask:(n,nm)=>ASK("How do the Fathers treat "+nm+"?","Latin Fathers"),
        rows:async n=>((n.pt||[]).map(v=>({t:String(v).replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase()),
          s:"",h:"/the-faith-received/search/?q="+encodeURIComponent(String(v).replace(/-/g," "))})))}}[kind]||null;
  if(!K){host.innerHTML="";return;}
  host.innerHTML='<p class=shelfhint>Drawing the map…</p>';
  fetch(BLOB+"/v1/"+((window.__plr&&window.__plr.fam)||"pl")+"research/constellations/"+K.f+".json"+VER)
    .then(r=>r.ok?r.json():null).then(d=>{
      if(!d||!d.nodes){host.innerHTML='<p class=shelfhint>This map is still being computed.</p>';return;}
      drawSky(host,d,K,{kind});
    }).catch(()=>{host.innerHTML='<p class=shelfhint>This map could not load.</p>';});
}

function renderPlScripture(sw,opts){
  // reusable outside the Latin Fathers shelf (the ✦ Scripture tab): `repaint` replaces the
  // shelf's own render() so a layer/view switch never tries to rebuild the library page.
  const _repaint=(opts&&opts.repaint)||(typeof render==="function"?render:function(){});
  const st=window.__plr.st;st.layer=st.layer||"scripture";st.view=st.view||"sky";   // citations | allusions
  const host=el("div");host.id="plresearch";sw.appendChild(host);
  const lt=el("div","plorg");
  lt.innerHTML=(st.layer==="topics"?"":
               `<button class="pob${st.layer==="scripture"?" on":""}" data-l="scripture">Citations</button>`+
               `<button class="pob${st.layer==="allusions"?" on":""}" data-l="allusions">Allusions</button>`)+
               `<button class="pob plrview${st.view==="sky"?" on":""}" data-v="${st.view==="sky"?"wall":"sky"}">${st.view==="sky"?"Browse books":"Browse chapters"}</button>`;
  lt.title="Citations = the Vulgate quoted or named outright; Allusions = the verse echoed without a citation.";
  lt.onclick=e=>{const b=e.target.closest(".pob");if(!b)return;
    if(b.dataset.v){st.view=b.dataset.v;st.ch=null;_repaint();return;}
    // switching Citations⇄Allusions kept the old book selected even when the new layer has
    // no entry for it — the panel then rendered blank (owner 2026-08-20). Clear the drill.
    st.layer=b.dataset.l;st.ch=null;st.book=null;_repaint();};
  sw.insertBefore(lt,host);
  host.innerHTML=`<p class=shelfhint>Loading the index\u2026</p>`;
  if(st.layer==="topics"){
    // TOPICS = A NAVIGABLE INDEX, not decoration (owner 2026-08-20: "I should be able to
    // click on topics and navigate, this is how PLD did it"). PG's sections are alphabet
    // bands and PL's are named divisions — either way the reader wants: pick a section →
    // scan its subjects → read the Fathers on one. Dot-tiles said nothing; a real index does.
    _plrFetch("subjects.json").then(secs=>{
      if(!secs||!secs.length){host.innerHTML='<p class=shelfhint>The subject index is still arriving.</p>';return;}
      const total=secs.reduce((a,s)=>a+(s.subjects||[]).length,0);
      const places=secs.reduce((a,s)=>a+(s.subjects||[]).reduce((x,y)=>x+(y.n||0),0),0);
      st.sec=(st.sec==null?0:st.sec);
      host.innerHTML=
        '<div class=tpx>'+
          '<p class=shelfhint>'+total.toLocaleString()+' subjects across '+secs.length+
          ' sections \u2014 '+places.toLocaleString()+' places in the Fathers. Pick a section, then a subject.</p>'+
          '<div class=tpx-secs id=tpxSecs></div>'+
          '<div class=tpx-main><div class=tpx-subj id=tpxSubj></div><div class=tpx-body id=tpxBody></div></div>'+
        '</div>';
      const elS=host.querySelector("#tpxSecs"), elJ=host.querySelector("#tpxSubj"), elB=host.querySelector("#tpxBody");
      const paintSecs=()=>{
        elS.innerHTML=secs.map((s,i2)=>{
          const n=(s.subjects||[]).length;
          const pl=(s.subjects||[]).reduce((a,x)=>a+(x.n||0),0);
          return `<button class="tsec${st.sec===i2?" on":""}" data-i="${i2}">`+
            `<span class=tsn>${esc(s.section||("Section "+(i2+1)))}</span>`+
            `<span class=tsc>${n} subject${n===1?"":"s"} \u00b7 ${pl.toLocaleString()}</span></button>`;}).join("");
      };
      const paintSubj=()=>{
        const s=secs[st.sec]||{}; const subs=(s.subjects||[]).slice().sort((a,b)=>(b.n||0)-(a.n||0));
        elJ.innerHTML=`<div class=tpx-h><h3>${esc(s.section||"")}</h3>`+
          `<input class=tpxq id=tpxQ type=search placeholder="Filter ${subs.length} subjects\u2026"></div>`+
          `<div class=tpx-list id=tpxList></div>`;
        const list=elJ.querySelector("#tpxList");
        const draw=(q)=>{
          const f=String(q||"").toLowerCase();
          const rows=subs.filter(x=>!f||String(x.name||"").toLowerCase().includes(f));
          list.innerHTML=rows.map((x,k)=>`<button class="tsub${st.subj===x.name?" on":""}" data-k="${subs.indexOf(x)}">`+
            `<span class=tsub-n>${esc(x.name)}</span><span class=tsub-c>${(x.n||0).toLocaleString()}</span></button>`).join("")||
            '<p class=shelfhint>No subject matches.</p>';
          list.querySelectorAll(".tsub").forEach(b=>b.onclick=()=>{
            const sub=subs[+b.dataset.k]||{}; st.subj=sub.name;
            list.querySelectorAll(".tsub").forEach(x=>x.classList.toggle("on",x===b));
            elB.innerHTML=`<div class=sw-head><h3 class=t>${esc(sub.name||"")}</h3><span class=c>${(sub.n||0).toLocaleString()} places</span></div>`+
              (sub.gloss?`<p class=shelfhint>${esc(sub.gloss)}</p>`:"")+
              ((sub.hits||[]).slice(0,80).map(_plrHitRow).join("")||'<p class=shelfhint>No places recorded.</p>');
            elB.scrollIntoView({behavior:"smooth",block:"nearest"});});
        };
        draw("");
        const qi=elJ.querySelector("#tpxQ");
        qi.oninput=()=>draw(qi.value);
        const first=list.querySelector(".tsub"); if(first)first.click();
      };
      elS.onclick=e=>{const b=e.target.closest(".tsec");if(!b)return;
        st.sec=+b.dataset.i;st.subj=null;paintSecs();paintSubj();};
      paintSecs();paintSubj();
    });
    return;
  }
  _plrFetch(st.layer+"/books.json").then(books=>{
    if(!books){host.innerHTML=`<p class=shelfhint>The Scripture index is still arriving \u2014 try again in a minute.</p>`;return;}
    const paint=()=>{
      let h;
      if(st.view==="sky"){
        h=`<div class="sat-scripture"><p>Browse recorded Scripture references by book and chapter. Counts describe ${st.layer==='allusions'?'allusions':'citations'} in this index.</p>${books.filter(b=>(b.n||0)>0).map(b=>`<details class="sat-book"${st.book===b.slug?' open':''}><summary><span>${esc(b.book)}</span><small>${(b.n||0).toLocaleString()} ${st.layer==='allusions'?'allusions':'citations'}</small></summary><div class="sat-chapters">${(b.chapters||[]).map(c=>`<a href="/the-faith-received/bible/#b/${encodeURIComponent(b.slug)}/${encodeURIComponent(c.c)}" aria-label="Read ${esc(b.book)} ${esc(c.c)} and its sources"><b>${esc(c.c)}</b><span>${(c.n||0).toLocaleString()} refs</span></a>`).join('')}</div></details>`).join('')}</div>`;
      }else{
        h=`<div class=bookwall>`+books.map(b=>`<button class="vcell${st.book===b.slug?' on':''}" data-b="${esc(b.slug)}"><span class=vn>${esc(b.book)}</span><span class=vc>${b.n.toLocaleString()} references</span></button>`).join('')+`</div>`;
      }
      const bk=books.find(x=>x.slug===st.book);
      if(bk){
        h+=`<div class=chstrip>`+bk.chapters.map(c=>
          `<button class="chb${st.ch===c.c?" on":""}" data-c="${esc(c.c)}">${esc(c.c)}<span>${c.n>999?(Math.round(c.n/100)/10)+"k":c.n}</span></button>`).join("")+`</div>`;
        h+=`<div id=chhits></div>`;
      }else{
        h+=`<p class=shelfhint>Every Vulgate citation across the Patrologia \u2014 choose a book, then a chapter, and read each Father at the verse itself.</p>`;
        h+=`<div id=plrank></div>`;
      }
      host.innerHTML=h;
      host.querySelectorAll(".vcell").forEach(b2=>b2.onclick=()=>{st.book=b2.dataset.b;st.ch=null;paint();});
      host.querySelectorAll(".cnst").forEach(b2=>b2.onclick=(ev)=>{
        const s2=ev.target.closest(".star");
        st.book=b2.dataset.b;st.ch=s2?s2.dataset.c:null;paint();if(st.ch)loadCh();});
      host.querySelectorAll(".chb").forEach(b2=>b2.onclick=()=>{st.ch=b2.dataset.c;paint();loadCh();});
      if(bk&&st.ch)loadCh();
    };
    // CHAPTER RESULTS, REORGANISED 2026-08-20 (owner: "organize results to be useful and not
    // overwhelming slop … collapsible by vol or author (author most useful)"). The default
    // groups every citation by the FATHER who makes it — collapsed, counted, ranked — so a
    // chapter opens as a short list of names instead of a wall of Latin.
    const loadCh=()=>{
      const box=host.querySelector("#chhits");if(!box)return;
      box.innerHTML=`<p class=shelfhint>Loading\u2026</p>`;
      _plrFetch(st.layer+"/"+st.book+"/"+st.ch+".json").then(rows=>{
        if(!rows||!rows.length){box.innerHTML=`<p class=shelfhint>No citations indexed for this chapter.</p>`;return;}
        st.grp=st.grp||"author";
        const authorOf=r=>{const w=_pldById(r.d);return (w&&w.author)||"Unattributed";};
        const volOf=r=>{const w=_pldById(r.d);return (w&&w.volume)||String(r.cit||"").split(":")[0]||"PL ?";};
        const paintHits=()=>{
          const bar=`<div class="plorg plgrp"><span class=gk>Group by</span>`+
            [["author","Author"],["vol","Volume"],["verse","Verse"]].map(([k,l])=>
              `<button class="pob${st.grp===k?" on":""}" data-g="${k}">${l}</button>`).join("")+
            `<span class=plgn>${rows.length.toLocaleString()} citation${rows.length>1?"s":""}</span></div>`;
          let bodyHtml="";
          if(st.grp==="verse"){
            const byV={};rows.forEach(r=>{(byV[r.v||0]=byV[r.v||0]||[]).push(r);});
            bodyHtml=Object.keys(byV).sort((a,b)=>{if(+a===0)return 1;if(+b===0)return -1;return a-b;})
              .map(v=>{const g=byV[v];
                return `<details class=vgroup${g.length<=6?" open":""}><summary class=vmark>${+v===0?"verse unplaced":("verse "+v)}`+
                  `<span class=vgc>${g.length.toLocaleString()}</span></summary>`+
                  g.slice(0,60).map(_plrHitRow).join("")+
                  (g.length>60?`<div class=vmore>\u2026 and ${(g.length-60).toLocaleString()} more</div>`:"")+`</details>`;}).join("");
          }else{
            const key=st.grp==="vol"?volOf:authorOf;
            const by={};rows.forEach(r=>{const k=key(r);(by[k]=by[k]||[]).push(r);});
            const keys=Object.keys(by).sort((a,b)=>by[b].length-by[a].length||a.localeCompare(b));
            bodyHtml=keys.map(k=>{
              const g=by[k].slice().sort((x,y)=>(+x.v||0)-(+y.v||0));
              const vs=[...new Set(g.map(r=>+r.v||0).filter(Boolean))];
              const sub=vs.length?("vv. "+vs.slice(0,6).join(", ")+(vs.length>6?"\u2026":"")):"";
              return `<details class=agroup><summary class=amark><span class=an>${esc(k)}</span>`+
                `<span class=asub>${esc(sub)}</span><span class=vgc>${g.length.toLocaleString()}</span></summary>`+
                g.slice(0,60).map(_plrHitRow).join("")+
                (g.length>60?`<div class=vmore>\u2026 and ${(g.length-60).toLocaleString()} more</div>`:"")+`</details>`;}).join("");
          }
          box.innerHTML=bar+`<div class=spine>`+bodyHtml+`</div>`;
          const gb=box.querySelector(".plgrp");
          if(gb)gb.onclick=e=>{const b=e.target.closest(".pob");if(!b)return;st.grp=b.dataset.g;paintHits();};
        };
        paintHits();
      });
    };
    paint();
    // MOST-CITED (owner 2026-08-19 'scripture visualizations rankings'): the corpus's
    // canon-within-the-canon — top verses + book bars from the precomputed rankings.
    const paintRank=()=>{
      const box=host.querySelector("#plrank");if(!box)return;
      _plrFetch("rankings.json").then(R=>{
        if(!R||!R[st.layer])return;
        const L=R[st.layer];
        const maxB=(L.books[0]||{}).n||1;
        let h=`<div class=plrk><div class=plrk-h>Most cited \u2014 the Fathers' canon within the canon</div>`;
        h+=`<div class=plrk-verses>`+(L.verses||[]).slice(0,12).map(v=>{
          const m=String(v.k).match(/^(.*)\s(\d+):(\d+)$/);
          const bslug=m?String(m[1]).toLowerCase().replace(/\s+/g,"-"):"";
          return `<button class=plrk-v data-b="${esc(bslug)}" data-c="${m?m[2]:""}" title="Open the verse ledger">`+
            `<span class=k>${esc(v.k)}</span><span class=n>${(+v.n).toLocaleString()}</span></button>`;}).join("")+`</div>`;
        h+=`<div class=plrk-books>`+(L.books||[]).slice(0,10).map(b2=>
          `<button class=plrk-b data-b="${esc(b2.s)}"><span class=bn>${esc(b2.b)}</span>`+
          `<span class=bar><i style="width:${Math.max(3,Math.round(100*b2.n/maxB))}%"></i></span>`+
          `<span class=bc>${(+b2.n).toLocaleString()}</span></button>`).join("")+`</div></div>`;
        box.innerHTML=h;
        box.querySelectorAll(".plrk-v").forEach(x=>x.onclick=()=>{st.book=x.dataset.b;st.ch=x.dataset.c;render();});
        box.querySelectorAll(".plrk-b").forEach(x=>x.onclick=()=>{st.book=x.dataset.b;st.ch=null;_repaint();});
      });};
    paintRank();
  });
}
// Migne editorial/index classification, client-side (same patterns as the
// corpus tools' migne_genre): pg-/pld- only — on the library shelves an
// 'Index' in a title is a published book (review §4)
const _MG_NAV=[/^(title\s*page|table\s*of\s*contents?|contents?)\b/i,/^index\b/i,/^(analytical|general|alphabetical)\s+index\b/i,/^order\s+of\s+(things|contents?|subjects?|the\s+old\s+editions?|editions?)\b/i,/^(elenchus|tabula|ordo)\b/i];
const _MG_APP=[/^admonition/i,/^(historical\s+)?notice\b/i,/^editorial\s+notice/i,/^prolegomena\b/i,/^monitum\b/i,/^(preface|praefatio)\s*$/i,/^(preface|praefatio)\s+(of|by)\s+the\s+(editor|editors|maurist)/i,/^appendix\s*$/i,/^(bibliograph|biographical\s+notice)/i,/^(synopsis\s+of\s+the\s+editions?|conspectus)\b/i];
function _migneKind(w){
  if(!/^(pg|pld)-\d+$/.test(String(w.slug||"")))return null;
  const ti=String((typeof TITLES!=="undefined"&&TITLES[w.slug])||w.title||"").trim();
  for(const r of _MG_NAV)if(r.test(ti))return "index";
  for(const r of _MG_APP)if(r.test(ti))return "apparatus";
  return null;}
window.__migneKind=_migneKind;
function authorSection(author,items){
  // COLLAPSED BY DEFAULT (owner 2026-08-17 'landing as a whole collapsed, aesthetic'):
  // with the Latin Fathers' ~700 authors and 220 tomes, open sections made the page a
  // scroll of thousands; each section now opens on demand and remembers itself for the
  // session. Volume groups ("PL 137") get a permalink hash (#g=PL-137) so any tome is a
  // shareable link that opens expanded.
  const sec=el("div","authsec collapsed");
  window.__openSecs=window.__openSecs||{};
  const gkey=author.replace(/[^A-Za-z0-9]+/g,"-");
  sec.id="g-"+gkey;
  if(window.__openSecs[gkey]||location.hash==="#g="+gkey)sec.classList.remove("collapsed");
  const ab=AUTHORS[author];
  const dt=(ab&&ab.dates)?` <span class=authdt>(${esc(ab.dates)})</span>`:"";
  const meta=ab?[ab.tradition,ab.affiliation].filter(Boolean).join(" · "):"";
  // WHO: bio is a HOVER popover on the author name (compact — appears on hover, no always-on block)
  const bioPop=(ab&&(ab.bio||ab.significance))?`<span class=pop>${meta?`<b class=pop-meta>${esc(meta)}</b>`:""}${esc(ab.bio||ab.significance)}</span>`:"";
  const h=el("h3","auth");h.tabIndex=0;h.setAttribute("aria-expanded",sec.classList.contains("collapsed")?"false":"true");  // h3 = SR heading list; focusable + keyboard-toggleable
  // a grouped work (WGROUPS: many volumes/editions of one work) counts ONCE in the header
  const _nw=(()=>{const wg=(typeof WGROUPS!=="undefined")&&WGROUPS&&WGROUPS.works?WGROUPS.works:null;
    const seen=new Set();let n=0;
    for(const w of items){if(window.__DUPS&&window.__DUPS[w.slug])continue;
      const g=wg&&wg[w.slug]&&wg[w.slug].g;
      if(g){if(!seen.has(g)){seen.add(g);n++;}}else n++;}
    return n||items.length;})();
  // editorial material counts apart from the works (review §4); anthology
  // bands (many authors in one catalogue string) carry their own label
  const _ned=items.filter(w=>w.apparatus||_migneKind(w)).length;
  const _nww=Math.max(_nw-_ned,0)||_nw;
  const _anth=(/;|,.*,.*,/.test(author)&&author.length>60)||/,\s*etc\.?\s*$/i.test(author)||/\betc\.?\s*$/i.test(author)&&author.includes(",");
  h.innerHTML=`<span class=cv>▾</span><span class="aname${bioPop?" haspop":""}${_anth?" anth":""}" ${_anth?`title="${esc(author)}"`:""}>${esc(_anth?author.split(/[;,]/)[0]+" and others":author)}${bioPop}</span>${_anth?'<span class="wbadge app" title="A PG anthology band: several authors printed together in one volume span">anthology</span>':""}${dt}<span class=c>${_nww} ${_nww>1?"works":"work"}${_ned?` <i class=ced title="Editorial and catalogue material printed with the works: indexes, notices, prefaces">· ${_ned} editorial</i>`:""}</span>`;
  const body=el("div","authbody");
  // LAZY BODY (owner 2026-08-17 'not an infinite scroll'): rows render on first expand —
  // a collapsed shelf of hundreds of sections costs only its headers.
  let _built=false;
  // DENSE LEDGER (owner 2026-08-17 'like richard baxter who has like 100 works'): past a
  // dozen works the fat cards drown the eye — the section becomes a spine-style ledger,
  // one hairline row per work (year or Migne columns leading), sortable by year or A–Z,
  // with an inline filter once an author passes 30 works. Small sections keep the cards.
  const _rd2=s=>"/the-faith-received/read/?w="+encodeURIComponent(s);   // eebo- in the main reader (2026-08-18)
  const _yearOf=w=>{const m=String(w.volume||"").match(/^1[3-9]\d\d/);return m?+m[0]:null;};
  const _cite=w=>{
    const displayVolume=WGROUPS?.works?.[w.slug]?.display_volume;if(displayVolume)return displayVolume;
    if(String(w.slug||"").startsWith("pld-")){const v=String(w.volume||"").replace(/^PL\s*/,"");
      return w.cols?`${v}:${w.cols[0]}${w.cols[1]!==w.cols[0]?"–"+w.cols[1]:""}`:(v?"PL "+v:"");}
    const y=_yearOf(w);return y?String(y):String(w.volume||"");};
  const _ledgerRow=w=>{
    const _pv=(typeof _ppEst==="function")?_ppEst(w):"";
    const pp=_pv?`<span class=wlp>${_pv}</span>`:"";
    const att=(typeof _attOf==="function")?_attOf(w):"";
    // volume contents on hover (owner 2026-08-18 'hovering doesn't tell me the works'):
    // the Contains: blurbs (Luther WA bands etc.) surface on ledger rows too
    const _b=(BLURBS[w.slug]&&BLURBS[w.slug].blurb)||"";
    // WITNESS BADGES + COVER (owner 2026-08-20): a reader must see at a glance whether a
    // work has the original SCAN behind it (facsimile) or is born-digital text, and where a
    // second witness exists. img_base ⇒ scans on Blob; the cover is page 1 of that scan.
    const _cov=w.img_base?`<img class=wlcov loading=lazy decoding=async src="${esc(w.img_base)}${w.title_page||1}.webp" alt="">`:`<span class="wlcov wlcov-bd" aria-hidden=true>▤</span>`;
    const _wit=(w.has_pages||w.pdf_pages||w.img_base)?`<span class="wbadge fac" title="Facsimile: the original printing is available page-by-page">Facsimile</span>`
                         :`<span class="wbadge bd" title="Born-digital text (no facsimile)">Born-digital text</span>`;
    const _mk=(typeof _migneKind==="function")?_migneKind(w):null;
    const _app=w.apparatus?`<span class="wbadge app" title="Migne’s editorial apparatus — a preface, notice, or dedication printed with the Fathers, not a work of this author">apparatus</span>`
      :_mk?`<span class="wbadge app" title="${_mk==="index"?"A catalogue leaf of the printed edition — an index, table, or title page":"Editorial material printed with the works — a notice, preface, or appendix"}">${_mk==="index"?"index leaf":"editorial"}</span>`:"";
    const _cw=(typeof WREL!=="undefined"&&WREL&&WREL.__cw&&WREL.__cw[w.slug])||null;
    const _sec=_cw?(_cw.kind==="dig"
        ?`<span class="wbadge sec" title="A facsimile of this work is held as well — the page scans are the second witness of this text (${_cw.other.length} volume${_cw.other.length===1?"":"s"})">Facsimile witness held</span>`
        :`<span class="wbadge sec" title="A born-digital text of this work is held as well — this facsimile is its second witness">Digital text held</span>`)
      :(typeof WREL!=="undefined"&&WREL&&WREL.__second&&WREL.__second[w.slug])
      ?`<span class="wbadge sec" title="A second witness of this work is held — another edition or copy">2nd witness</span>`:"";
    const _LGN={de:"German",fr:"French",el:"Greek",it:"Italian",es:"Spanish",nl:"Dutch",cy:"Welsh",en:"English",mul:"mixed"};
    const _lg=(typeof LANGS!=="undefined"&&LANGS&&LANGS[w.slug]&&_LGN[LANGS[w.slug]])
      ?`<span class="wbadge lang" title="${LANGS[w.slug]==="mul"?"The source text mixes several languages":"The source text of this work is "+_LGN[LANGS[w.slug]]+", not Latin"}">${_LGN[LANGS[w.slug]]}</span>`:"";
    return `<a class="wlrow${_b?" haswlpop":""}" data-slug="${esc(w.slug||"")}" href="${_rd2(w.slug)}">${_cov}<span class=wly>${esc(_cite(w))}</span>`+
      `<span class=wlt>${esc(TITLES[w.slug]||w.title||w.slug)}${att?` <span class=watt>(${esc(att)})</span>`:""}</span>${_app}${_wit}${_lg}${_sec}${pp}</a>`;};
  const _ledger=()=>{
    const state=sec._ls=sec._ls||{sort:(items.filter(_yearOf).length>items.length/2&&!items[0].po)?"year":"az",q:""};
    const wrap=el("div","wlwrap");
    if(items.length>30){
      const tools=el("div","wltools");
      const ylab=items.filter(w=>String(w.slug||"").startsWith("pld-")).length>items.length/2?"PL order":"Year";
      tools.innerHTML=`<input class=wlfilter type=search placeholder="Filter ${esc(author.split(",")[0])}’s ${items.length} works…" value="${esc(state.q)}">`+
        `<span class=wlsort><button data-s=year class="${state.sort==="year"?"on":""}">${ylab}</button><button data-s=az class="${state.sort==="az"?"on":""}">A–Z</button></span>`;
      tools.querySelector(".wlfilter").oninput=e=>{state.q=e.target.value.trim().toLowerCase();paint();};
      tools.querySelector(".wlsort").onclick=e=>{const b=e.target.closest("button");if(!b)return;state.sort=b.dataset.s;
        tools.querySelectorAll(".wlsort button").forEach(x=>x.classList.toggle("on",x===b));paint();};
      wrap.appendChild(tools);
    }
    const list=el("div","worklist");wrap.appendChild(list);
    // shared contents popover for ledger rows (desktop hover; tap-and-hold falls through to nav)
    if(!window.__wlpop){const p=document.createElement("div");p.id="wlpop";document.body.appendChild(p);window.__wlpop=p;}
    let _wlT=null;
    list.addEventListener("mouseover",e=>{
      const a=e.target.closest("a.haswlpop");if(!a)return;
      clearTimeout(_wlT);
      _wlT=setTimeout(()=>{
        const b=(BLURBS[a.dataset.slug]&&BLURBS[a.dataset.slug].blurb)||"";if(!b)return;
        const p=window.__wlpop;p.textContent=b;p.classList.add("on");
        const r2=a.getBoundingClientRect();
        p.style.left=Math.min(r2.left,window.innerWidth-440)+"px";
        p.style.top=(r2.bottom+6+p.offsetHeight>window.innerHeight?r2.top-p.offsetHeight-6:r2.bottom+6)+"px";
      },220);});
    list.addEventListener("mouseout",e=>{
      if(e.target.closest("a.haswlpop")&&!e.relatedTarget?.closest("a.haswlpop")){
        clearTimeout(_wlT);window.__wlpop&&window.__wlpop.classList.remove("on");}});
    // volume number of a work from its volume field, title or slug — Roman ("Tomus XII", "Vol. IV") or Arabic ("Vol. 12",
    // "-vol-12"); Roman parsed properly, not from a table that stopped at XX
    const _volAny=w=>{const s=String(w.volume||"")+" "+(TITLES[w.slug]||w.title||"")+" "+String(w.slug||"");
      const m=s.match(/\b(?:vol|volume|tom|tome|tomus|tomi|band|bd|part|pars|liber|lib|centuria|cent)\.?\s*([ivxlcdm]+|\d{1,3})\b/i)
            ||String(w.slug||"").match(/-(?:vol|tom|tomus|cent|t)-?(\d{1,3})[ab]?$/i);
      if(!m)return null;const v=m[1];if(/^\d+$/.test(v))return +v;
      const R={i:1,v:5,x:10,l:50,c:100,d:500,m:1000};let n=0,p=0;
      for(const ch of v.toLowerCase().split("").reverse()){const q=R[ch]||0;n+=q<p?-q:q;p=Math.max(p,q);}
      return n>0?n:null;};
    const paint=()=>{
      let ws=items.slice();
      if(state.q)ws=ws.filter(w=>[w.title,TITLES[w.slug]].some(x=>(x||"").toLowerCase().includes(state.q)));
      if(state.sort==="year")ws.sort((a,b)=>{
        if(a.po!=null&&b.po!=null&&a.po!==b.po)return a.po-b.po;
        const va=_volN(a.volume),vb=_volN(b.volume);
        if(String(a.slug||"").startsWith("pld-")&&String(b.slug||"").startsWith("pld-")){
          if(va!=null&&vb!=null&&va!==vb)return va-vb;
          return ((a.cols||[9e9])[0])-((b.cols||[9e9])[0]);}
        // multi-volume sets: order by the volume number in title/volume/slug, so
        // "Works Vol. 5..8" never scatter among their unnumbered siblings (2026-08-20)
        const _vn=_volAny;
        const _stem=w=>String(TITLES[w.slug]||w.title||"").replace(/\s*[,·]?\s*\b(?:vol|volume|tom|tome|tomus|tomi|band|bd|part|pars)\.?\s*(?:[ivxlcdm]+|\d{1,3})\b.*$/i,"").trim().toLowerCase();
        if(!!a.apparatus!==!!b.apparatus)return a.apparatus?1:-1;   // the editorial layer sits after the works
        const sa=_stem(a), sb=_stem(b);
        if(sa&&sa===sb){const na=_vn(a),nb=_vn(b);
          if(na!=null&&nb!=null&&na!==nb)return na-nb;
          if(na!=null&&nb==null)return 1;      // unnumbered first, then the numbered run
          if(na==null&&nb!=null)return -1;}
        const ya=_yearOf(a)||9999, yb=_yearOf(b)||9999;
        if(ya!==yb)return ya-yb;
        {const na=_vn(a),nb=_vn(b);if(na!=null&&nb!=null&&na!==nb)return na-nb;}
        return String(TITLES[a.slug]||a.title||"").localeCompare(String(TITLES[b.slug]||b.title||""),undefined,{numeric:true});});
      else ws.sort((a,b)=>{
        // a numbered SERIES whose volumes carry their own subtitles ("Philosophical Institutions: Cosmology" = Vol. III,
        // "…: Logic" = Vol. I) orders by volume, not by subtitle — same stem before the colon/dash + both numbered
        const _st=w=>String(TITLES[w.slug]||w.title||"").split(/\s*[:—–]\s*/)[0].replace(/\s*[,·]?\s*\b(?:vol|volume|tom|tome|tomus|tomi|band|bd|part|pars)\.?\s*(?:[ivxlcdm]+|\d{1,3})\b.*$/i,"").trim().toLowerCase();
        {const sa=_st(a),sb=_st(b);if(sa&&sa===sb){const na=_volAny(a),nb=_volAny(b);if(na!=null&&nb!=null&&na!==nb)return na-nb;}}
        const tc=String(TITLES[a.slug]||a.title||"").localeCompare(String(TITLES[b.slug]||b.title||""),undefined,{numeric:true});
        if(tc!==0)return tc;
        // same display title (a multi-volume set, "Ecclesiastical Annals" ×12): order by the volume NUMBER — a title tie used to
        // fall through to input order, which is slug order, so Tomus X, XI, XII sat between I and II (owner 2026-09-05)
        const na=_volAny(a),nb=_volAny(b);if(na!=null&&nb!=null&&na!==nb)return na-nb;
        return String(a.volume||"").localeCompare(String(b.volume||""),undefined,{numeric:true});});
      // WORK-GROUP BANDS (owner 2026-09-07): rows that are volumes/editions of one work
      // render as a single band — work title, volume count, and per-edition sub-headers —
      // in the position the sort gave the group's first member. Every volume row stays a
      // visible, clickable witness (edition-groups ruling: never hide witnesses).
      const wg=(typeof WGROUPS!=="undefined")&&WGROUPS&&WGROUPS.works?WGROUPS:null;
      if(wg){
        const out=[],done=new Set();
        for(const w of ws){
          const gi=wg.works[w.slug];
          if(!gi){out.push(_ledgerRow(w));continue;}
          if(done.has(gi.g))continue;
          done.add(gi.g);
          const members=ws.filter(x=>wg.works[x.slug]&&wg.works[x.slug].g===gi.g);
          if(members.length<2){out.push(_ledgerRow(w));continue;}
          const g=(wg.groups&&wg.groups[gi.g])||{};
          const eds={};members.forEach(m=>{const e=wg.works[m.slug].ed||"";(eds[e]=eds[e]||[]).push(m);});
          const edKeys=Object.keys(eds).sort((a,b)=>Math.min(...eds[a].map(m=>wg.works[m.slug].n||99))-Math.min(...eds[b].map(m=>wg.works[m.slug].n||99)));
          let inner="";
          for(const ek of edKeys){
            eds[ek].sort((a,b)=>(wg.works[a.slug].n||0)-(wg.works[b.slug].n||0));
            const lab=(g.editions&&g.editions[ek])||"Edition";
            const formats=[...new Set(eds[ek].map(m=>(m.has_pages||m.pdf_pages||m.img_base)?"Facsimile":"Born-digital text"))].join(" + ");
            inner+=`<div class=wged>${esc(lab)} · ${esc(formats)}${g.unit==="edition"?"":`<span class=wgedc>${eds[ek].length} vol${eds[ek].length>1?"s":""}</span>`}</div>`+eds[ek].map(_ledgerRow).join("");
          }
          const la=(g.title&&g.title!==g.title_en)?` <span class=wgla>${esc(g.title)}</span>`:"";
          out.push(`<div class=wgroup><div class=wghead><span class=wgt>${esc(g.title_en||g.title||"")}${la}</span><span class=wgc>${g.unit==="edition"?edKeys.length+" editions":members.length+" volumes"+(edKeys.length>1?" · "+edKeys.length+" editions":"")}</span></div>${inner}</div>`);
        }
        list.innerHTML=out.join("")||`<p class=shelfhint>No titles match.</p>`;
      } else
      list.innerHTML=ws.map(_ledgerRow).join("")||`<p class=shelfhint>No titles match.</p>`;
    };
    paint();
    sec._repaint=paint;   // WGROUPS may arrive after first build — re-cluster on demand
    body.appendChild(wrap);
  };
  const buildBody=()=>{if(_built)return;_built=true;
    // ONE presentation (owner 2026-08-17 'too visually jarring'): every author section
    // reads as the same quiet ledger — a 2-work author and a 148-work author differ in
    // length, never in furniture.
    _ledger();};
  // volume-aware sort: Intl numeric mode can't parse Roman numerals, so 'Tomus IX' sorted
  // between IV and V for Scotus's 26 tomes and Baronius's 12. Parse Roman OR Arabic ordinals
  // to an integer key first; fall back to locale compare for non-volume titles.
  const _rom={i:1,v:5,x:10,l:50,c:100,d:500,m:1000};
  const _volN=s=>{const m=String(s||"").match(/\b([IVXLCDM]+|\d+)\b\.?\s*$/i);if(!m)return null;
    const t=m[1];if(/^\d+$/.test(t))return +t;
    let n=0,p=0;for(const ch of t.toLowerCase().split("").reverse()){const v=_rom[ch]||0;n+=v<p?-v:v;p=Math.max(p,v);}
    return n>0?n:null;};
  const _sortedItems=()=>items.slice().sort((a,b)=>{
    if(a.po!=null&&b.po!=null&&a.po!==b.po)return a.po-b.po;   // Migne print order when present
    const ta=String(a.title||""),tb=String(b.title||"");
    const tc=ta.localeCompare(tb,undefined,{numeric:true});
    if(tc!==0)return tc;                       // group volumes of the SAME title together first
    const va=_volN(a.volume),vb=_volN(b.volume);
    if(va!=null&&vb!=null&&va!==vb)return va-vb;
    return (a.volume||"").localeCompare(b.volume||"",undefined,{numeric:true});
  });
  if(!sec.classList.contains("collapsed"))buildBody();
  const toggle=()=>{const c=sec.classList.toggle("collapsed");h.setAttribute("aria-expanded",c?"false":"true");
    if(!c)buildBody();
    window.__openSecs[gkey]=!c;};   // session memory + lazy first build
  // the NAME is an action (→ library filtered to this author, same as the .au chips);
  // the chevron/count/rest of the row keeps the collapse toggle.
  h.onclick=e=>{if(e.target.closest(".ed"))return;
    if(e.target.closest(".aname")){setAuthorF(author);return;}
    toggle();};
  h.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggle();}};
  {const an=h.querySelector(".aname");if(an)an.title="Show only "+author;}
  sec.appendChild(h);sec.appendChild(body);return sec;
}
// DISPLAY ALIAS FOLD (owner 2026-09-10 review §3): catalogue spellings of the
// SAME person fold for display; pseudo-attributions stay distinct. Bare
// 'Cyril' verified = the Alexandrian span (PG 68-75; Jerusalem is named).
const DISPLAY_ALIAS={"Athanasius":"Athanasius of Alexandria","Origenes":"Origen",
  "Cyril":"Cyril of Alexandria","Nilus":"Nilus of Sinai",
  "Photius of Constantinople.":"Photius of Constantinople",
  "Severian of Gabala (OCR)":"Severian of Gabala"};
const dispAu=a=>{a=String(a||"").replace(/,\s*pt\.\s*\d+$/,"").trim();return DISPLAY_ALIAS[a]||a;};
window.__dispAu=dispAu;
function byAuthor(arr){const m={};arr.forEach(w=>{const k=_foldAu(dispAu(w.author));(m[k]=m[k]||[]).push(w);});return m;}
let SEL_TRAD=null,SEL_TOPIC=null,TOPICS=null;
function tradDesc(items){   // the tradition's best-represented authors, as an italic sample line
  const junk=/^(unknown|auctor|various|editors|anonym|editores|auctores|maurines)/i;
  const c={};items.forEach(w=>{const a=w.author_en||w.author;if(a&&!junk.test(a))c[a]=(c[a]||0)+1;});
  const top=Object.keys(c).sort((a,b)=>c[b]-c[a]).slice(0,3);   // 3 names fit the card's 2-line clamp without mid-name cuts
  return top.length?top.join(" · ")+(Object.keys(c).length>3?" · …":""):"";
}
// The author filter is REAL STATE, not text in a search box: it survives Browse/tab clicks and
// re-renders, is shown as a removable chip (hero bar + above the results), and only the chip's ✕
// clears it. Text search composes on top of it.
window.AUTHORF=window.AUTHORF||null;
function paintAF(){
  const host=$("#afChip");if(!host)return;
  host.innerHTML=window.AUTHORF?('<button class=afx title="Clear the author filter">'+esc(window.AUTHORF)+' <span>✕</span></button>'):"";
  const b=host.querySelector(".afx");if(b)b.onclick=()=>setAuthorF(null);
}
function setAuthorF(a){
  window.AUTHORF=a||null;
  try{const u=new URL(location.href);
    if(a)u.searchParams.set("au",a);else u.searchParams.delete("au");
    history.pushState({shelf:SEL_TRAD,au:a||null},"",u);}catch(e){}
  paintAF();render();
  if(a){const lib=$("#lib");if(lib)lib.scrollIntoView({block:"start",behavior:"smooth"});}
}
window.__openShelf=t=>{if(!t)return;SEL_TRAD=t;
  try{if(typeof loadNoteShard==="function")loadNoteShard(t);}catch(e){}
  render();
  setTimeout(()=>{const e=$("#shelfworks");if(e)e.scrollIntoView({block:"start"});},80);};
function __shelfFromURL(){
  const u=new URL(location.href);
  const sh=u.searchParams.get("shelf"),au=u.searchParams.get("au");
  if(u.searchParams.get("q")||["passages","ask"].includes(u.searchParams.get("find")))return false;
  window.AUTHORF=au||null;
  if(sh&&sh!==SEL_TRAD){window.__openShelf(sh);return true;}
  if(!sh&&SEL_TRAD){SEL_TRAD=null;render();return true;}
  if(au!==undefined){paintAF();render();}
  return !!sh;}
addEventListener("popstate",()=>{try{__shelfFromURL();}catch(e){}});
function render(){
  paintAF();
  if(window.FRHome&&window.FRHome.render())return;
  if(VIEW==="confessions")return renderConfessions();
  const lib=$("#lib");
  if(!window.__FR_CATALOGUE_READY__){
    lib.innerHTML=window.__FR_CATALOGUE_FAILED__?'<p class="muted" role="status">The catalogue could not load. <button class="btn" id="zRetry">Try again</button></p>':'<p class="muted" role="status">Loading the catalogue…</p>';
    const retry=$("#zRetry");if(retry)retry.onclick=()=>location.reload();return;
  }
  lib.innerHTML="";
  const f=($("#q").value||"").trim().toLowerCase();
  const af=window.AUTHORF;
  let ws=WORKS.filter(w=>matchF(w,f));
  if(window.WITF)ws=ws.filter(w=>(window.WITF==="fac")===!!(w.has_pages||w.pdf_pages));   // witness filter (facsimile = scans + text; digital = text alone)
  // author chip matches EITHER name form (chips carry English "Augustine of Hippo" while
  // canon rows carry Latin "Augustinus Hipponensis" — exact-match on one field blanked the
  // shelf, iPad report 2026-08-19); joint attributions ("A; B") match on any part.
  if(af){const norm=x=>String(x||"").toLowerCase().replace(/\s*\(.*?\)/g,"").trim();
    const afn=norm(af);
    const AL={"augustine of hippo":"augustinus hipponensis","jerome":"hieronymus stridonensis",
      "gregory the great":"gregorius i","ambrose of milan":"ambrosius mediolanensis",
      "john chrysostom":"joannes chrysostomus"};
    const alt=AL[afn]||Object.keys(AL).find(k=>AL[k]===afn)||null;
    ws=ws.filter(w=>[w.author,w.author_en,w.author_full].some(x=>{
      if(!x)return false;
      return String(x).split(";").some(part=>{
        // filter through the alias ledger too: a filter on 'Willem Hessels van Est'
        // must keep the volumes registered under 'Willem van Est' (owner 2026-08-29)
        const pn=norm(_foldAu(part.trim()));
        const pn0=norm(part);
        const hit=q2=>q2===afn||(alt&&q2===alt)||q2.includes(afn)||(afn.length>8&&afn.includes(q2)&&q2.length>6);
        return hit(pn)||hit(pn0);});
    }));}
  if(af){const r=el("div","afrow");
    r.innerHTML='Showing works by <b>'+esc(af)+'</b> — <button class=afx>'+esc(af)+' <span>✕</span></button>';
    r.querySelector(".afx").onclick=()=>setAuthorF(null);lib.appendChild(r);}
  if(!ws.length){const z=el("div","muted");z.innerHTML='No works match. <button class="btn" id="zClear">Clear the filter</button> <button class="btn" id="zCorpus">Search inside the works instead</button>';lib.appendChild(z);const zc=z.querySelector("#zClear");if(zc)zc.onclick=()=>{/* CLEAR EVERY FILTER, NOT JUST TWO (owner 2026-08-22: "clearing the filter doesnt work"). This reset the query box and the author and stopped there, so an empty result caused by the TRADITION or CONFESSION pick left the button doing nothing visible — the shelf stayed filtered and the same "No works match" stayed on screen. Whatever narrowed the view is what the reader is asking to undo. */const q2=document.getElementById("q");if(q2)q2.value="";setAuthorF(null);try{SEL_TRAD=null;}catch(e){}try{SEL_TOPIC=null;}catch(e){}try{if(typeof SEL_CONF!=="undefined")SEL_CONF=null;}catch(e){}try{if(typeof SEL_CTRAD!=="undefined")SEL_CTRAD=null;}catch(e){}try{render();}catch(e){}};const zk=z.querySelector("#zCorpus");if(zk)zk.onclick=()=>{const q2=document.getElementById("q"),o=document.getElementById("csOpen");if(o)o.click();const cq=document.getElementById("csq");if(cq&&q2&&q2.value){cq.value=q2.value;cq.dispatchEvent(new Event("input",{bubbles:true}));}};return;}
  // author mode, an author chip, OR an active search filter → flat author-grouped results (skip shelves)
  if(MODE==="auth"||f||af){
    const m=byAuthor(ws);const ks=Object.keys(m).sort((a,b)=>a.localeCompare(b));
    ks.forEach(a=>{const sec=authorSection(a,m[a]);lib.appendChild(sec);
      // a filtered result must ARRIVE OPEN (owner 2026-08-17 'I click and his works
      // don't appear' — the collapsed ledger read as an empty page on a phone)
      if((f||af)&&ks.length<=4){const h=sec.querySelector(".auth");
        if(sec.classList.contains("collapsed")&&h)h.click();}});
    return;
  }
  // tradition mode, no filter → welcoming shelf grid, with the chosen shelf's works beneath
  const tg={};ws.forEach(w=>{(tg[w.tradition]=tg[w.tradition]||[]).push(w);});
  let order=[...TRAD_ORDER.filter(t=>tg[t]),...Object.keys(tg).filter(t=>!TRAD_ORDER.includes(t))];
  // English Divines shelves beside Continental Reformed (owner 2026-08-20: its own shelf,
  // Reformed named properly) — the divines are the Reformed tradition in England
  if(tg["English Divines"]&&order.includes("Reformed")){
    order=order.filter(t=>t!=="English Divines");
    order.splice(order.indexOf("Reformed")+1,0,"English Divines");
  }
  const TRAD_LABEL=t=>t==="Reformed"?"Continental Reformed":t;window.__tradLabel=TRAD_LABEL;
  const head=el("div","browse-head");head.id="browse";
  head.innerHTML='<h2>Browse the shelves</h2><span class=hint>'+WORKS.length.toLocaleString()+' works · '+order.length+' shelves</span>';
  lib.appendChild(head);
  const grid=el("div","shelfgrid trads");
  // SHELF IDENTITIES (owner 2026-08-17 'style the shelves a little differently'):
  // each tradition wears its own scholarly hue — the eye finds a shelf before reading it.
  const SHELF_HUE={"Latin Fathers":"var(--shelf-latin)","Greek Fathers":"var(--shelf-greek)","Eastern Fathers":"var(--shelf-eastern)",
    "English Divines":"var(--shelf-english)","Medieval":"var(--shelf-medieval)","Roman Catholic":"var(--shelf-catholic)",
    "Reformed":"var(--shelf-reformed)","Lutheran":"var(--shelf-lutheran)","Humanism and Law":"var(--shelf-humanism)"};
  window.__shelfHue=SHELF_HUE;
  order.forEach(t=>{
    const b=el("button","shelf");b.setAttribute("aria-expanded",String(SEL_TRAD===t));b.dataset.shelf=t;
    if(SHELF_HUE[t])b.style.setProperty("--shelfc",SHELF_HUE[t]);
    b.innerHTML=`<span class=sx>▸</span><span class=sn>${esc(TRAD_LABEL(t))}</span>`+
      `<span class=sc><b>${tg[t].length.toLocaleString()}</b> ${tg[t].length>1?"works":"work"}</span>`+
      `<span class=sd>${esc(tradDesc(tg[t]))}</span>`;
    b.onclick=()=>{SEL_TRAD=(SEL_TRAD===t?null:t);
      // the shelf is an ADDRESS (review §1): Back returns to it, links carry it
      try{const u=new URL(location.href);
        if(SEL_TRAD)u.searchParams.set("shelf",SEL_TRAD);else u.searchParams.delete("shelf");
        u.searchParams.delete("au");history.pushState({shelf:SEL_TRAD},"",u);}catch(e){}
      render();
      try{if(SEL_TRAD&&typeof loadNoteShard==="function")loadNoteShard(SEL_TRAD);}catch(e){}   // this family's bios + introductions, once
      try{document.activeElement.blur();}catch(e){}   // release the hero omnibox so type-to-search reaches the shelf bar
      if(SEL_TRAD)setTimeout(()=>{const e=$("#shelfworks");if(e)e.scrollIntoView({behavior:"smooth",block:"start"});},70);};
    grid.appendChild(b);
  });
  lib.appendChild(grid);
  const sw=el("div");sw.id="shelfworks";if(SEL_TRAD)sw.dataset.shelf=SEL_TRAD;
  if(SEL_TRAD&&window.__shelfHue&&window.__shelfHue[SEL_TRAD])sw.style.setProperty("--shelfc",window.__shelfHue[SEL_TRAD]);
  if(SEL_TRAD&&tg[SEL_TRAD]){
    const h=el("div","sw-head");h.innerHTML=`<h3 class=t>${esc(TRAD_LABEL(SEL_TRAD))}</h3><span class=c>${tg[SEL_TRAD].length.toLocaleString()} works</span>`
      +`<a class=swask href="/the-faith-received/search/?m=ask&trad=${encodeURIComponent(SEL_TRAD)}" title="Ask a question answered from this shelf's works, with citations">✦ Ask this shelf</a>`;
    sw.appendChild(h);
    /* the Roman Catholic shelf opens with its reference work — the DTC's dedicated door */
    // RESEARCH DOORS, EVERY SHELF (owner 2026-08-29 "why does this exist ... an old
    // artifact, and none of the newer shelves have links to scripture, authors, etc").
    // The Patrologia-only overlay block is retired: all nine shelves open the SAME unified
    // research pages, filtered to the shelf - Scripture, authors, topics, and the Web.
    {const _SH={"Latin Fathers":"pl","Greek Fathers":"gf","Eastern Fathers":"po","English Divines":"ed",
      "Medieval":"md","Roman Catholic":"rc","Lutheran":"lu","Reformed":"rf","Humanism and Law":"hl"}[SEL_TRAD];
     if(_SH){
      const cb=el("div","scomp");cb.innerHTML='<span class=sk>Study this shelf</span>'
      +'<div class=scomp-row>'
      +`<a class=scomp-l href="/the-faith-received/bible/?sh=${_SH}"><span class=n>\u2727 Scripture</span><span class=d>Every citation of Scripture across the shelf \u2014 book by book, chapter by chapter, opening on the verse itself.</span></a>`
      +`<a class=scomp-l href="/the-faith-received/fathers/?sh=${_SH}"><span class=n>\u2727 Authors</span><span class=d>Each author\u2019s room: their topics, their positions in their own words, their reception.</span></a>`
      +`<a class=scomp-l href="/the-faith-received/topics/?sh=${_SH}"><span class=n>\u2727 Topics</span><span class=d>The doctrines this shelf treats, era by era, with the passages that carry them.</span></a>`
      +`<a class=scomp-l href="/the-faith-received/web/"><span class=n>\u2727 The Web</span><span class=d>Fifteen centuries of citation as one sky \u2014 who reads whom, traced passage by passage.</span></a>`
      +'</div>';
      sw.appendChild(cb);}}
    // MINED SHELF SKIES (owner 2026-08-20): every shelf gets its own constellations, drawn
    // from the mine rather than Migne's indices — and they link to each other.
    // A shelf's skies include its SCHOOLS and PARTIES (owner 2026-08-20: "add the
    // annotations to westminster shelf — authors can be cross puritan and westminster
    // divine too"). A work is mined once and counts into every body it belongs to, so the
    // Assembly has its own map without leaving the English Divines.
    const SUBSKY={"English Divines":["Puritans","Anglicans","Westminster Assembly"],
                  "Roman Catholic":["Jesuits","Dominicans","Franciscans","Augustinians"]}[SEL_TRAD]||[];
    const skyGroups=[];
    if(window.__MINESKY&&window.__MINESKY[SEL_TRAD])
      skyGroups.push({name:"This shelf",ms:window.__MINESKY[SEL_TRAD]});
    SUBSKY.forEach(s=>{if(window.__MINESKY&&window.__MINESKY[s])
      skyGroups.push({name:s,ms:window.__MINESKY[s]});});
    /* THE SHELF'S CONSTELLATION MAPS ARE REMOVED (owner 2026-08-22, pointing at the English
       Divines shelf: "get rid of this"). The block rendered "From the mine — this shelf's own
       maps" with a works map and a doctrines map above the shelf's real content. It is the
       same bulk the owner had already cut from the Ask panel, one screen further in: it sat
       between the reader and the thing they came for — the questions this shelf actually
       treats, which is directly below and is built from the same mined data without asking
       anyone to interpret a scatter plot. The map renderer stays for the PL research doors,
       where a constellation answers a question a list cannot. */
    // ── WHAT THIS SHELF STUDIES (owner 2026-08-21: "publish shelf by shelf insights for
    //    users to explore study etc"). The mine has read these works page by page; this is
    //    that reading turned outward — the loci they argue, the verses they turn on, whom
    //    they read, and their live controversies. Every row lands on a real page.
    /* WHAT THIS SHELF STUDIES IS REMOVED (owner 2026-08-24: "get rid of this", pointing at
       the Medieval shelf's panel). Same judgement as the constellation maps above it: the
       loci/scripture/authorities/controversies tabs put a screen of mined aggregate between
       the reader and the works they came for. The mine's reading still reaches readers where
       it answers a question they asked — the research doors and Ask — not as a panel every
       shelf visitor must scroll past. renderShelfInsights stays defined for those callers. */
    if(SEL_TRAD==="Roman Catholic"){const cb=el("div","scomp");cb.innerHTML='<span class=sk>Reference</span>'
      +'<div class=scomp-row>'
      +'<a class=scomp-l href="/the-faith-received/dtc/"><span class=n>Dictionnaire de Théologie Catholique</span><span class=d>The great French theological dictionary (Vacant–Mangenot–Amann, 1899–1950): ~1,800 articles in a dedicated lookup interface — search any headword.</span><span class=u>the dictionary door</span></a>'
      +'</div>';sw.appendChild(cb);}
    /* the Medieval shelf continues in two sister libraries — a quiet cross-reference at its head */
    /* Medieval companion-libraries block retired (owner 2026-08-20) */
    // LATIN FATHERS DUAL ORGANIZATION (owner 2026-08-17 'org by vol but keep author
    // organization — like the PL site does'): the shelf carries a By-author / By-PL-volume
    // toggle. Volume view groups by the Migne tome ('PL 137'), ascending, works in
    // column order inside — the series' own architecture; author view is the library's.
    // CANON VOLUME SHELVES (2026-08-17): Latin, Greek, and Eastern Fathers all browse
    // by their series' own volumes — one set of organs, per-shelf words and stores.
    const VOLSHELF={"Latin Fathers":{word:"PL"},"Greek Fathers":{word:"PG"},"Eastern Fathers":{word:"PO Tome"}}[SEL_TRAD];
    if(VOLSHELF){
      const VW=VOLSHELF.word;
      // THE MINED RESEARCH LAYERS (owner 2026-08-17 'adopt the scripture and other
      // research we got from mining PL'): the shelf carries the family's research doors —
      // the Scripture index (every Vulgate citation across the 8,967 works, by book and
      // chapter) and the Subject index (curated loci with glosses). Data hydrates from
      // v1/plresearch/* on the Blob; nothing is copied into the deploy.
      // The shelf's old Scripture/Topics doors (the PL research layer: Citations · Allusions · Browse chapters,
      // verse rows labelled "PL 108") are retired (owner 2026-09-10 "take these out … and the PL on landing"):
      // /bible and /topics are those surfaces now. The shelf keeps volume and author browsing.
      if(window.__plOrg==="scripture"||window.__plOrg==="topics")window.__plOrg="author";
      window.__plOrg=window.__plOrg||"author";   // Show names immediately; volume browsing remains available.
      const tg2=el("div","plorg");
      tg2.innerHTML=`<button class="pob${window.__plOrg==="volume"?" on":""}" data-o="volume">By ${VW} volume</button>`+
                    `<button class="pob${window.__plOrg==="author"?" on":""}" data-o="author">By author</button>`+
                    ((false /* doors removed (owner 2026-09-10) */)?`<a class="pob" href="/the-faith-received/bible/" title="Scripture, verse by verse, with every commentator">Scripture →</a><a class="pob" href="/the-faith-received/topics/" title="Topics across the whole library">Topics →</a>`:"");
      tg2.onclick=e=>{const b=e.target.closest(".pob");if(!b||!b.dataset.o)return;window.__plOrg=b.dataset.o;render();};
      sw.appendChild(tg2);
      if(String(window.__plOrg||"").startsWith("cmap-")&&(SEL_TRAD==="Latin Fathers"||SEL_TRAD==="Greek Fathers")){
        const bar=el("div","plorg");
        bar.innerHTML=[["authors","Who reads alike"],["works","Map of works"],["topics","Doctrines related"]]
          .map(([k,l])=>`<button class="pob${window.__plOrg==="cmap-"+k?" on":""}" data-c="${k}">${l}</button>`).join("");
        bar.onclick=e=>{const b=e.target.closest(".pob");if(!b)return;window.__plOrg="cmap-"+b.dataset.c;render();};
        sw.appendChild(bar);
        const h=el("div");sw.appendChild(h);
        renderConstellationMap(h, window.__plOrg.slice(5));
        lib.appendChild(sw);return;}
      // (the PL research layer branch is retired — see above)
      if(window.__plOrg==="volume"){
        // SEAMLESS VOLUME BROWSE (owner 2026-08-17 'scroll by vol seamless, like how pld
        // does it'): the PLD landing pattern — a persistent compact grid of all 220 Migne
        // tomes, the chosen tome's SPINE opening beneath it, and \u2039 \u203a walking
        // tome to tome without ever losing the grid.
        const st=window.__bigShelf=window.__bigShelf||{};const cur=st[SEL_TRAD+"-vol"]=st[SEL_TRAD+"-vol"]||{vol:null,q:""};
        const byVol={};tg[SEL_TRAD].forEach(w=>{(byVol[w.volume||"PL ?"]=byVol[w.volume||"PL ?"]||[]).push(w);});
        const allKeys=Object.keys(byVol).sort((a,b)=>(+(a.match(/\d+/)||[9999])[0])-(+(b.match(/\d+/)||[9999])[0]));
        let keys=allKeys;
        const openVol=v=>{cur.vol=v;render();
          setTimeout(()=>{const e=document.getElementById("volpanel");if(e)e.scrollIntoView({behavior:"smooth",block:"start"});},60);};
        const sf=el("input","shelfsearch");sf.type="search";sf.placeholder=`Search ${SEL_TRAD} \u2014 a volume (\u201c137\u201d), an author, a work\u2026`;
        sf.value=cur.q||"";
        sf.oninput=()=>{const v=sf.value.trim();cur.q=v;
          const mnum=v.match(/^(?:pl\s*)?(\d{1,3})$/i);
          if(mnum&&byVol[VW+" "+mnum[1]]){cur.q="";openVol(VW+" "+mnum[1]);return;}
          cur._foc=true;clearTimeout(sf._t);sf._t=setTimeout(render,180);};
        sw.appendChild(sf);
        if(cur._foc){requestAnimationFrame(()=>{sf.focus();try{sf.setSelectionRange(sf.value.length,sf.value.length);}catch(e){}});cur._foc=false;}
        if(cur.q&&!/^(?:pl\s*)?\d{1,3}$/i.test(cur.q)){
          // an author or title query should answer with WORKS, not a wall of bare tome
          // numbers (owner 2026-08-17 'I type in Augustine… none of it has augustine'):
          // render the matching authors' ledgers right here, expanded.
          const q=cur.q.toLowerCase();
          const pool=tg[SEL_TRAD].filter(w=>[w.title,TITLES[w.slug],w.author,w.author_en].some(x=>(x||"").toLowerCase().includes(q)));
          const qm=byAuthorClean(pool);
          const _anon=_ANON;
          const tier=a=>{const m=a.toLowerCase().includes(q)||qm[a].some(w=>String(w.author||"").toLowerCase().includes(q));
            if(!m)return 0;return _anon.test(a)?1:2;};   // named author > anonymous attribution > title match
          const keysQ=Object.keys(qm).sort((a,b)=>{
            const ta=tier(a),tb=tier(b);
            if(ta!==tb)return tb-ta;
            return qm[b].length-qm[a].length;
          }).slice(0,30);
          if(!keysQ.length){const hint=el("p","shelfhint");hint.textContent="Nothing on this shelf matches.";sw.appendChild(hint);}
          keysQ.forEach(a=>{const sec=authorSection(a,qm[a]);sw.appendChild(sec);
            const h2=sec.querySelector(".auth");
            if(sec.classList.contains("collapsed")&&h2)h2.click();});
          lib.appendChild(sw);return;
        }
        const _junk=/^(unknown|auctor|various|editors|anonym|maurines|editores)/i;
        const domAuths=ws2=>{const c={};ws2.forEach(w=>{let a=String(w.author_en||w.author||"").replace(/\s*\(.*$/,"").trim();
          if(!a||_junk.test(a))return;c[a]=(c[a]||0)+1;});
          return Object.keys(c).sort((x,y)=>c[y]-c[x]);};
        // the series wall: every tome a small numbered cell, hover names its authors
        const g=el("div","volgrid"+(cur.vol?" picked":""));
        keys.forEach(v=>{
          const n=v.replace(/^(PL|PG|PO Tome)\s*/,"")||v;
          const c=el("button","vcell"+(cur.vol===v?" on":""));c.type="button";
          c.title=v+" \u2014 "+(domAuths(byVol[v]).slice(0,3).join(" \u00b7 ")||byVol[v].length+" works");
          c.innerHTML=`<span class=vn>${n}</span><span class=vc>${byVol[v].length}</span>`;
          c.onclick=()=>openVol(v);
          g.appendChild(c);});
        sw.appendChild(g);
        if(cur.vol&&byVol[cur.vol]){
          const panel=el("div");panel.id="volpanel";
          const ws2=byVol[cur.vol].slice().sort((a,b)=>(a.po??1e9)-(b.po??1e9));
          const auths=domAuths(ws2);   // dominance order: the tome's authors before its editors
          const ki=allKeys.indexOf(cur.vol),prev=allKeys[ki-1],next=allKeys[ki+1];
          const vh=el("div","volhead");
          vh.innerHTML=`<button class=vnav data-v="${esc(prev||"")}" ${prev?"":"disabled"} title="${esc(prev||"")}">&#8249;</button>`+
            `<span class=vn>${esc(cur.vol)}</span>`+
            `<button class=vnav data-v="${esc(next||"")}" ${next?"":"disabled"} title="${esc(next||"")}">&#8250;</button>`+
            `<button class="vnav vall" type="button" title="Show the whole volume wall">All volumes</button>`+
            `<span class=va>${esc(auths.slice(0,4).join(" \u00b7 "))}${auths.length>4?" \u00b7 \u2026":""}</span>`+
            `<span class=vc>${ws2.length} works</span>`;
          vh.onclick=e=>{const b=e.target.closest(".vnav");if(!b)return;
            if(b.classList.contains("vall")){const gr=sw.querySelector(".volgrid");if(gr){gr.classList.toggle("picked");if(!gr.classList.contains("picked"))gr.scrollIntoView({block:"nearest"});}return;}
            if(b.dataset.v)openVol(b.dataset.v);};
          panel.appendChild(vh);
          const vn2=(cur.vol.match(/\d+/)||[""])[0];
          const spineRow=w=>{
            const c=w.cols,rng=c?`${vn2}:${c[0]===c[1]?c[0]:c[0]+"&#8211;"+c[1]}`:"";
            const au=String(w.author_en||w.author||"").replace(/\s*\(.*$/,"").trim();
            return `<a class=sprow href="${"/the-faith-received/read/?w="+encodeURIComponent(w.slug)}">`+
              `<span class=spc title="Migne columns">${rng}</span>`+
              `<span class=spt>${esc(TITLES[w.slug]||w.title||w.slug)}${au&&!_junk.test(au)?` <span class=spa>&#8212; ${esc(au)}</span>`:""}</span></a>`;};
          const texts=ws2.filter(w=>w.cd!=="MOD"),appar=ws2.filter(w=>w.cd==="MOD");
          const body=el("div","spine");
          body.innerHTML=texts.map(spineRow).join("")+
            (appar.length?`<details class=sappar><summary>Editorial apparatus <span class=sac>(${appar.length})</span></summary>${appar.map(spineRow).join("")}</details>`:"");
          panel.appendChild(body);
          // NESTED PG SPINE (owner 2026-08-18 'match how pg is organized on the old site —
          // beginning to end, with nesting'): the family voltoc (v1/pgvol/{n}.json `toc`)
          // is the volume's printed order — work heads at depth 0 with their sections
          // indented beneath, exactly as patrologia-graeca renders it. Replaces the flat
          // position-sorted rows when the toc exists; the flat list is the fallback above.
          if(VW==="PG"&&vn2){
            fetch(BLOB+"/v1/pgvol/"+vn2+".json").then(r=>r.ok?r.json():null).then(sp=>{
              if(!sp||!sp.toc||sp.toc.length<4)return;
              const ranges={};ws2.forEach(w=>{const m=String(w.slug).match(/^pg-(\d+)$/);if(m&&w.cols)ranges[+m[1]]=w.cols;});
              const have=new Set(ws2.map(w=>String(w.slug)));
              let seenW=null;
              const rows=sp.toc.map(e2=>{
                const lvl=Math.min(+e2.lvl||0,3);
                const id2=e2.id!=null?("pg-"+e2.id):null;
                let cc="";
                if(lvl===0&&e2.id!=null&&ranges[e2.id]&&seenW!==e2.id){const c=ranges[e2.id];
                  cc=`${vn2}:${c[0]===c[1]?c[0]:c[0]+"&#8211;"+c[1]}`;}
                else if(e2.c!=null)cc=String(e2.c);
                if(lvl===0)seenW=e2.id;
                const body2=`<span class=spc title="Migne columns">${cc}</span><span class=spt>${esc(e2.t||"")}</span>`;
                if(!id2||!have.has(id2))return `<span class="sprow spd${lvl} spoff">${body2}</span>`;
                return `<a class="sprow spd${lvl}" href="/the-faith-received/read/?w=${id2}${e2.c!=null?`#b${e2.c}-0`:""}">${body2}</a>`;
              }).join("");
              if(!rows)return;
              body.innerHTML=rows;
            }).catch(()=>{});
          }
          sw.appendChild(panel);
        }
        lib.appendChild(sw);return;
      }
    }
    // BIG-SHELF NAVIGATION (owner 2026-08-17, the EEBO catalogue pattern: search-first +
    // drill chips — never an infinite scroll). Party chips (divines) + author-initial chips;
    // All author names appear immediately; optional letters narrow the lazy sections.
    const bigShelf=(works,opts)=>{
      const st=window.__bigShelf=window.__bigShelf||{};
      const cur=st[SEL_TRAD]=st[SEL_TRAD]||{party:opts.parties?"*":null,ini:null};
      // SCHOOL LENSES (owner 2026-08-20): a tab key starting "sch:" filters by the school
      // registry (v1/schools.json — Westminster Assembly, Jesuits, Dominicans…) by slug set
      const schoolSet=key=>{const S=window.__SCHOOLS||{};const e=S[key.slice(4)];return e?new Set(e.slugs||[]):new Set();};
      const inTab=(w,key)=>key==="*"?true:key.startsWith("sch:")?schoolSet(key).has(w.slug):(w.party||"")===key;
      if(opts.parties){
        const bar=el("div","plorg");
        // "All" first (owner 2026-08-20: 'you can't search Puritan and Anglican at once —
        // let me search all in English Divines'); parties remain as browse lenses
        const tabs=[["*","All"],...opts.parties];
        bar.innerHTML=tabs.map(([key,label])=>{
          const n=works.filter(w=>inTab(w,key)).length;
          return n?`<button class="pob${cur.party===key?" on":""}" data-p="${key}">${label} <span class=pc>${n.toLocaleString()}</span></button>`:"";}).join("");
        bar.onclick=e=>{const b=e.target.closest(".pob");if(!b)return;cur.party=b.dataset.p;cur.ini=null;render();};
        sw.appendChild(bar);
      }
      const sfld=el("input","shelfsearch");sfld.type="search";sfld.placeholder=`Search ${SEL_TRAD} \u2014 author or title\u2026`;
      sfld.value=cur.q||"";
      sfld.oninput=()=>{cur.q=sfld.value.trim().toLowerCase();cur._foc=true;clearTimeout(sfld._t);sfld._t=setTimeout(render,180);};
      sw.appendChild(sfld);
      if(cur._foc){requestAnimationFrame(()=>{sfld.focus();try{sfld.setSelectionRange(sfld.value.length,sfld.value.length);}catch(e){}});cur._foc=false;}
      let pool=(opts.parties&&cur.party!=="*")?works.filter(w=>inTab(w,cur.party)):works;
      if(cur.q){
        const q=cur.q;
        // typed search ALWAYS spans the whole shelf — a query is a question to the
        // tradition, not to the currently-open party tab (owner 2026-08-20)
        pool=works.filter(w=>[w.title,TITLES[w.slug],w.author,w.author_en,w.author_full].some(x=>(x||"").toLowerCase().includes(q)));
        const qm=opts.clean?byAuthorClean(pool):byAuthor(pool);
        const keysQ=Object.keys(qm).sort((a,b)=>{
          const am=a.toLowerCase().includes(q),bm=b.toLowerCase().includes(q);
          if(am!==bm)return am?-1:1;
          return qm[b].length-qm[a].length;
        }).slice(0,30);
        if(!keysQ.length){const hint=el("p","shelfhint");hint.textContent="Nothing on this shelf matches.";sw.appendChild(hint);}
        keysQ.forEach(a=>{const sec=authorSection(a,qm[a]);sw.appendChild(sec);
          const h=sec.querySelector(".auth");
          if(sec.classList.contains("collapsed")&&h)h.click();   // expand + lazy-build in one gesture
        });
        lib.appendChild(sw);return;
      }
      const m=opts.clean?byAuthorClean(pool):byAuthor(pool);
      const inis={};Object.keys(m).forEach(a=>{const i=(a[0]||"#").toUpperCase();inis[i]=(inis[i]||0)+1;});
      const ini=el("div","inirow");
      ini.setAttribute("aria-label","Filter authors by initial");
      ini.innerHTML=`<button class="inib${!cur.ini?" on":""}" data-i="" aria-pressed="${!cur.ini}">All</button>`+
        Object.keys(inis).sort().map(i=>`<button class="inib${cur.ini===i?" on":""}" data-i="${i}" aria-pressed="${cur.ini===i}">${i}<span>${inis[i]}</span></button>`).join("");
      ini.onclick=e=>{const b=e.target.closest(".inib");if(!b)return;
        // in the All view a letter tap JUMPS (the list is one alphabet — no
        // reason to re-render); a second tap on the same letter filters to it
        if(!cur.ini&&b.dataset.i){const d=document.getElementById("alet-"+b.dataset.i);
          // jump to the letter's FIRST SECTION, not the divider: a stuck
          // position:sticky divider reads as already-in-view and
          // scrollIntoView does nothing
          const tgt=d&&d.nextElementSibling;
          if(tgt&&!b.classList.contains("jumped")){ini.querySelectorAll(".inib").forEach(x=>x.classList.remove("jumped"));b.classList.add("jumped");
            tgt.scrollIntoView({block:"start"});return;}}
        cur.ini=(cur.ini===b.dataset.i?null:b.dataset.i)||null;render();};
      sw.appendChild(ini);
      {let _lastIni=null;
      Object.keys(m).filter(a=>!cur.ini||(a[0]||"#").toUpperCase()===cur.ini).sort((a,b)=>a.localeCompare(b))
        .forEach(a=>{
          const i0=(a[0]||"#").toUpperCase();
          if(!cur.ini&&i0!==_lastIni){_lastIni=i0;
            const d=el("div","alet");d.textContent=i0;d.id="alet-"+i0;sw.appendChild(d);}
          sw.appendChild(authorSection(a,m[a]));});}
      lib.appendChild(sw);
    };
    // ENGLISH DIVINES (owner 2026-08-17): party first — Puritans, Anglicans, Other —
    // then the initial drill within the chosen party.
    if(SEL_TRAD==="English Divines"){
      bigShelf(tg[SEL_TRAD],{parties:[["Puritan","Puritans"],["Anglican","Anglicans"],["sch:Westminster Assembly","Westminster Assembly"]]});
      return;
    }
    // ROMAN CATHOLIC: religious-order lenses (owner 2026-08-20 'Dominicans, Franciscans,
    // Jesuits… for specific searching') — same bigShelf contract, All searches everything
    if(SEL_TRAD==="Roman Catholic"){
      bigShelf(tg[SEL_TRAD],{parties:[["sch:Jesuits","Jesuits"],["sch:Dominicans","Dominicans"],["sch:Franciscans","Franciscans"],["sch:Augustinians","Augustinians"]]});
      return;
    }
    if(SEL_TRAD==="Latin Fathers"||SEL_TRAD==="Greek Fathers"||SEL_TRAD==="Eastern Fathers"){bigShelf(tg[SEL_TRAD],{clean:true});return;}   // canon shelves: attribution-aware drill
    // EVERY shelf gets the inline search (owner 2026-08-17 'type naturally underneath
    // the shelf'): filter this tradition's authors and titles in place; matches open.
    {
      const stG=window.__bigShelf=window.__bigShelf||{};const curG=stG[SEL_TRAD]=stG[SEL_TRAD]||{q:""};
      const sfg=el("input","shelfsearch");sfg.type="search";sfg.placeholder=`Search ${SEL_TRAD} \u2014 author or title\u2026`;
      sfg.value=curG.q||"";
      sfg.oninput=()=>{curG.q=sfg.value.trim().toLowerCase();curG._foc=true;clearTimeout(sfg._t);sfg._t=setTimeout(render,180);};
      sw.appendChild(sfg);
      if(curG._foc){requestAnimationFrame(()=>{sfg.focus();try{sfg.setSelectionRange(sfg.value.length,sfg.value.length);}catch(e){}});curG._foc=false;}
      let pool=tg[SEL_TRAD];
      if(curG.q){
        const q=curG.q;
        pool=pool.filter(w=>[w.title,TITLES[w.slug],w.author,w.author_en,w.author_full].some(x=>(x||"").toLowerCase().includes(q)));
        const qm=byAuthor(pool);
        const keysQ=Object.keys(qm).sort((a,b)=>{
          const am=a.toLowerCase().includes(q),bm=b.toLowerCase().includes(q);
          if(am!==bm)return am?-1:1;
          return qm[b].length-qm[a].length;
        }).slice(0,30);
        if(!keysQ.length){const hint=el("p","shelfhint");hint.textContent="Nothing on this shelf matches.";sw.appendChild(hint);}
        keysQ.forEach(a=>{const sec=authorSection(a,qm[a]);sw.appendChild(sec);
          const h2=sec.querySelector(".auth");
          if(sec.classList.contains("collapsed")&&h2)h2.click();});
        lib.appendChild(sw);return;
      }
      const m=byAuthor(pool);Object.keys(m).sort((a,b)=>a.localeCompare(b)).forEach(a=>sw.appendChild(authorSection(a,m[a])));
    }
  }
  lib.appendChild(sw);
}
// TYPE-TO-SEARCH: with a shelf open, just start typing — the keystroke lands in the
// shelf's inline search without hunting for the field. Inputs/editors keep their keys.
if(!window.__typeSearch){window.__typeSearch=true;
  document.addEventListener("keydown",e=>{
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    if(e.key.length!==1)return;
    const a=document.activeElement;
    if(a&&(a.tagName==="INPUT"||a.tagName==="TEXTAREA"||a.isContentEditable)){
      // exception: the hero omnibox holding focus OFFSCREEN while a shelf is open —
      // the reader is looking at the shelf; their typing belongs to the shelf bar.
      const hero=a.classList&&a.classList.contains("hero-q");
      const off=hero&&a.getBoundingClientRect().bottom<0;
      if(!off)return;
    }
    const f=document.querySelector("#shelfworks .shelfsearch");
    if(f){f.focus();}
  });
}
// ── TOPICS: the question-first door. v1/topics.json (built from the knowledge graph) lists, per locus,
// every work treating it — with tradition, scholastic SCHOOL, treats-weight, and the work's own TOC
// sections matching the locus vocabulary. Browse question → benches → the exact disputatio; any group
// exports as a /pins collection (the shareable #c= dossier format).
const b64e=o=>btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const dossierURL=(name,rows)=>"/the-faith-received/pins/#c="+b64e({v:3,n:name,items:rows.map(w=>["fr",w.slug,(w.secs&&w.secs[0]&&w.secs[0].p)||null])});
const SCHOOL_ORDER=["Thomist","Scotist","Nominalist","Jesuit","Franciscan","Augustinian"];
const SCHIP={Thomist:"#7a4a21",Scotist:"#4a5d7a",Nominalist:"#6b5b7a",Jesuit:"#7a2121",Franciscan:"#5b6e46",Augustinian:"#46606e"};
function loadTopics(cb){if(TOPICS)return cb();
  fetch(BLOB+"/v1/topics_lite.json"+VER).then(r=>r.json()).then(d=>{TOPICS=d.topics||[];cb();})
    .catch(()=>{fetch(BLOB+"/v1/topics.json"+VER).then(r=>r.json()).then(d=>{TOPICS=d.topics||[];cb();}).catch(()=>{TOPICS=[];cb();});});}
function loadTopic(id,cb){const t=(TOPICS||[]).find(x=>x.id===id);
  if(t&&t.works)return cb(t);                                   // already hydrated (or legacy full file)
  fetch(BLOB+"/v1/topics/"+id+".json"+VER).then(r=>r.json()).then(full=>{
    const i=(TOPICS||[]).findIndex(x=>x.id===id);if(i>=0)TOPICS[i]=full;cb(full);}).catch(()=>cb(null));}
let HEADINGS=null,_hload=null;   // cross-corpus section-title index (154k rows), lazy on first sections-search
function loadHeadings(cb){if(HEADINGS)return cb();if(_hload){_hload.then(cb);return;}
  _hload=fetch(BLOB+"/v1/headings.json"+VER).then(r=>r.json()).then(d=>{HEADINGS=d.h||[];}).catch(()=>{HEADINGS=[];});_hload.then(cb);}
const yearOf=d=>{const m=String(d||"").match(/1[0-8]\d\d/);return m?+m[0]:9999;};   // first plausible year in an author's dates (1000-1899)
function ovHTML(t){ // status quaestionis (GraphRAG community summary) with [slug/pN] cites → reader links
  if(!t.ov)return "";
  const linked=esc(t.ov).replace(/\[([a-z0-9-]+)\/p(\d+)\]/g,(m,s,p)=>`<a href="/the-faith-received/read/?w=${s}#b${p}-0">[${s.split("-").slice(0,2).join("-")}/p${p}]</a>`);
  return `<div class=topicov><span class=ovk>Status quaestionis</span><p>${linked}</p></div>`;
}
function schipHTML(s){return s?`<span class=schip style="background:${SCHIP[s]||'#666'}">${esc(s)}</span>`:"";}
function renderTopics(){
  const lib=$("#lib");lib.innerHTML='<p class=muted>Loading the topics…</p>';
  loadTopics(()=>{
    lib.innerHTML="";
    const f=($("#q").value||"").trim().toLowerCase();
    if(!SEL_TOPIC){                                        // ── topic INDEX: 33 loci as shelves
      const head=el("div","browse-head");head.innerHTML='<h2>Browse by question</h2><span class=hint><a href="#library" style="color:var(--accent)">\u2190 the shelves</a> \u00b7 Every locus of the tradition — or type 3+ letters to search all '+(HEADINGS?HEADINGS.length.toLocaleString():"154,000")+' section headings across the corpus</span>';
      lib.appendChild(head);
      const grid=el("div","shelfgrid");
      TOPICS.filter(t=>!f||t.label.toLowerCase().includes(f)||t.id.includes(f)).forEach(t=>{
        const schools=new Set(t.schools||(t.works||[]).map(w=>w.school).filter(Boolean));
        const b=el("button","shelf");
        b.innerHTML=`<span class=sx>▸</span><span class=sn>${esc(t.label)}</span>`+
          `<span class=sc>${t.n} works</span>`+
          `<span class=sd>${schools.size?[...schools].slice(0,4).map(s=>esc(s)).join(" · "):""}</span>`;
        b.onclick=()=>{SEL_TOPIC=t.id;try{history.replaceState(null,"","#t="+t.id);}catch(e){}render();window.scrollTo({top:0});};
        grid.appendChild(b);
      });
      lib.appendChild(grid);
      {const mI1=location.hash.match(/#s=([1-4])-(\d+)/);if(mI1){window.__SBK=mI1[1];window.__SD=mI1[2];}
       const mI2=location.hash.match(/#sc=([a-z0-9_ ]+)-(\d+)/i);if(mI2){window.__SCB=mI2[1].replace(/_/g," ").toLowerCase();window.__SCC=mI2[2];}
       const mI3=location.hash.match(/#st=(Ia|I-II|II-II|III)-(\d+)/);if(mI3){window.__SMP=mI3[1];window.__SMQ=mI3[2];}}
      if(window.__SBK||window.__SD){
      // ── THE SENTENCES GRID: Lombard's four books as the shared lattice — every commentary
      // in the corpus (medieval masters + early-modern reception) lands on one distinctio.
      {const sg=el("div","sw-sec");
       sg.innerHTML='<div class=sw-head><h3 class=t>The Sentences, distinctio by distinctio</h3><span class=c id=sgc>30 commentaries · 1,353 landings — Lombard\u2019s grid from Albert and Bonaventure to Biel, Scotus, Capreolus, and Estius</span></div><div class=sbooks id=sbooks></div><div class=sbooks id=sdists></div><div id=slands></div>';
       lib.appendChild(sg);
       const BKL={"1":"I — God \u0026 Trinity","2":"II — Creation \u0026 Sin","3":"III — Christ \u0026 Virtues","4":"IV — Sacraments \u0026 Last Things"};
       const loadS=cb=>{if(window.__SENT)return cb();
         Promise.all([fetch(BLOB+"/v1/sentences.json"+VER).then(r=>r.json()),
                      fetch(BLOB+"/v1/work_years.json"+VER).then(r=>r.json()).catch(()=>({}))])
           .then(([s,y])=>{window.__SENT=s;window.__WYRS=y;cb();}).catch(()=>{});};
       const paint=()=>{const S=window.__SENT;if(!S)return;
         const bx=$("#sbooks");bx.innerHTML=Object.keys(BKL).map(b=>`<button class="lchip${window.__SBK===b?" on":""}" data-b=${b}>${BKL[b]}</button>`).join("");
         bx.querySelectorAll(".lchip").forEach(c=>c.onclick=()=>{window.__SBK=c.dataset.b;window.__SD=null;paint();});
         const dx=$("#sdists");const bk=window.__SBK;
         dx.innerHTML=bk?Object.keys(S[bk]).map(d=>`<button class="lchip dn${window.__SD===d?" on":""}" data-d=${d}>d.${d}<span class=ln>${S[bk][d].length}</span></button>`).join(""):"";
         if(bk)dx.querySelectorAll(".lchip").forEach(c=>c.onclick=()=>{window.__SD=c.dataset.d;try{history.replaceState(null,"","#s="+bk+"-"+c.dataset.d);}catch(e){}paint();});
         const lx=$("#slands");lx.innerHTML="";
         if(bk&&window.__SD&&S[bk][window.__SD]){
           const la=((S._lombard||{})[bk]||{})[window.__SD];
           if(la){const d0=el("div","topicwork confbox");
             d0.innerHTML=`<div class=tw1><a class=twt href="https://pld-patrologia-latina.vercel.app/read/7607.html#${la}" target=_blank rel=noopener>Peter Lombard \u2014 Sententiae (the text itself)</a><span class=twa>c. 1155 \u00b7 PL 192 \u00b7 opens on Patrologia Latina</span></div>`;
             lx.appendChild(d0);}
           const ta=((S._aquinas||{})[bk]||{})[window.__SD];
           if(ta){const d1=el("div","topicwork confbox");
             d1.innerHTML=`<div class=tw1><a class=twt href="https://aquinas-studies.vercel.app/read/${ta}" target=_blank rel=noopener>Thomas Aquinas \u2014 Scriptum super Sententias, this distinctio</a><span class=twa>c. 1254 \u00b7 Latin\u2225English on Aquinas Studies</span></div>`;
             lx.appendChild(d1);}
           {const ROM=["","I","II","III","IV"];const act=el("div","cellact");
            act.innerHTML=`<a class=lchip href="#ask=${encodeURIComponent(`Sentences Book ${ROM[bk]||bk}, dist. ${window.__SD} \u2014 how do the commentators treat this distinction?`)}">\u2726 Ask about this distinctio</a>`;
            lx.appendChild(act);}
           const Y=window.__WYRS||{};
           const rows2=[...S[bk][window.__SD]].sort((a,b)=>(Y[a[0]]||1600)-(Y[b[0]]||1600));
           rows2.forEach(([s,pg,lab])=>{const w=(WORKS||[]).find(x=>(x.slug||x.workspace)===s)||{};
             const y=Y[s];const d2=el("div","topicwork");
             d2.innerHTML=`<div class=tw1><a class=twt href="/the-faith-received/read/?w=${encodeURIComponent(s)}${pg?"#b"+pg+"-0":""}">${esc((TITLES&&TITLES[s])||w.title||s)}</a><span class=twa>${esc(w.author||"")}${y?" · "+(y<1500?"med. ":"")+y:""}</span></div><ul class=twsecs><li><a href="/the-faith-received/read/?w=${encodeURIComponent(s)}${pg?"#b"+pg+"-0":""}">p.${pg} — ${esc(lab)}</a></li></ul>`;
             lx.appendChild(d2);});
         }};
       const m3=location.hash.match(/#s=([1-4])-(\d+)/);
       if(m3){window.__SBK=m3[1];window.__SD=m3[2];}
       loadS(paint);}
      }
      if(window.__SCB||window.__SCC){
      // ── SCRIPTURE: preach-a-text door — book → chapter → every commentary that lands there.
      {const sc=el("div","sw-sec");
       sc.innerHTML='<div class=sw-head><h3 class=t>Scripture, chapter by chapter</h3><span class=c>251 works \u00b7 9,465 landings \u2014 bring a sermon text, leave with the tradition\u2019s commentators open to it</span></div><div class=sbooks id=scbooks></div><div class=sbooks id=scchs></div><div id=sclands></div>';
       lib.appendChild(sc);
       const loadSc=cb=>{if(window.__SCR)return cb();
         fetch(BLOB+"/v1/scripture.json"+VER).then(r=>r.json()).then(s=>{window.__SCR=s;cb();}).catch(()=>{});};
       const cap=s=>s.replace(/\b[a-z]/g,c=>c.toUpperCase());
       const paint2=()=>{const S=window.__SCR;if(!S)return;
         const bx=$("#scbooks");bx.innerHTML=Object.keys(S).map(b=>`<button class="lchip dn${window.__SCB===b?" on":""}" data-b="${b}">${cap(b)}</button>`).join("");
         bx.querySelectorAll(".lchip").forEach(c=>c.onclick=()=>{window.__SCB=c.dataset.b;window.__SCC=null;paint2();});
         const cx=$("#scchs");const bk=window.__SCB;
         cx.innerHTML=bk?Object.keys(S[bk]).map(c=>`<button class="lchip dn${window.__SCC===c?" on":""}" data-c=${c}>${c}<span class=ln>${S[bk][c].length}</span></button>`).join(""):"";
         if(bk)cx.querySelectorAll(".lchip").forEach(c=>c.onclick=()=>{window.__SCC=c.dataset.c;try{history.replaceState(null,"","#sc="+bk.replace(/ /g,"_")+"-"+c.dataset.c);}catch(e){}paint2();});
         const lx=$("#sclands");lx.innerHTML="";
         if(bk&&window.__SCC&&S[bk][window.__SCC]){
           const Y=window.__WYRS||{};
           [...S[bk][window.__SCC]].sort((a,b)=>(Y[a[0]]||1600)-(Y[b[0]]||1600)).forEach(([s,pg,lab])=>{
             const w=(WORKS||[]).find(x=>(x.slug||x.workspace)===s)||{};const y=Y[s];
             const d2=el("div","topicwork");
             d2.innerHTML=`<div class=tw1><a class=twt href="/the-faith-received/read/?w=${encodeURIComponent(s)}${pg?"#b"+pg+"-0":""}">${esc((TITLES&&TITLES[s])||w.title||s)}</a><span class=twa>${esc(w.author||"")}${y?" \u00b7 "+y:""}${w.tradition?" \u00b7 "+esc(w.tradition):""}</span></div><ul class=twsecs><li><a href="/the-faith-received/read/?w=${encodeURIComponent(s)}${pg?"#b"+pg+"-0":""}">p.${pg} \u2014 ${esc(lab)}</a></li></ul>`;
             lx.appendChild(d2);});
         }};
       const m4=location.hash.match(/#sc=([a-z0-9_ ]+)-(\d+)/i);
       if(m4){window.__SCB=m4[1].replace(/_/g," ").toLowerCase();window.__SCC=m4[2];}
       loadSc(paint2);}
      }
      if(window.__SMP||window.__SMQ){
      // ── THE SUMMA: Thomas's own 512 questions (on Aquinas Studies) + the commentary bench here.
      {const sm=el("div","sw-sec");
       sm.innerHTML='<div class=sw-head><h3 class=t>The Summa, question by question</h3><span class=c>Aquinas\u2019s text on Aquinas Studies \u00b7 989 commentary landings here \u2014 Cajetan, Sylvius, Billuart, Zumel on 504 of 512 questions</span></div><div class=sbooks id=smpars></div><div class=sbooks id=smqs></div><div id=smlands></div>';
       lib.appendChild(sm);
       const PL={"Ia":"Prima Pars","I-II":"Prima Secundae","II-II":"Secunda Secundae","III":"Tertia Pars"};
       const loadSm=cb=>{if(window.__SUM)return cb();
         fetch(BLOB+"/v1/summa.json"+VER).then(r=>r.json()).then(s=>{window.__SUM=s;cb();}).catch(()=>{});};
       const paint3=()=>{const S=window.__SUM;if(!S)return;
         const px=$("#smpars");px.innerHTML=Object.keys(PL).map(k=>`<button class="lchip${window.__SMP===k?" on":""}" data-p="${k}">${k} \u00b7 ${PL[k]}</button>`).join("");
         px.querySelectorAll(".lchip").forEach(c=>c.onclick=()=>{window.__SMP=c.dataset.p;window.__SMQ=null;paint3();});
         const qx=$("#smqs");const pk=window.__SMP;
         qx.innerHTML=pk?Object.keys(S[pk]).map(q=>{const n=S[pk][q].works.length;return `<button class="lchip dn${window.__SMQ===q?" on":""}" data-q=${q} title="${esc(S[pk][q].t)}">q.${q}${n?`<span class=ln>${n}</span>`:""}</button>`;}).join(""):"";
         if(pk)qx.querySelectorAll(".lchip").forEach(c=>c.onclick=()=>{window.__SMQ=c.dataset.q;try{history.replaceState(null,"","#st="+pk+"-"+c.dataset.q);}catch(e){}paint3();});
         const lx=$("#smlands");lx.innerHTML="";
         if(pk&&window.__SMQ&&S[pk][window.__SMQ]){
           const cell=S[pk][window.__SMQ];const qn=window.__SMQ;
           const d0=el("div","topicwork confbox");
           d0.innerHTML=`<div class=tw1><a class=twt href="https://aquinas-studies.vercel.app/read/${cell.aq}" target=_blank rel=noopener>Thomas Aquinas \u2014 ${pk} q.${qn}: ${esc(cell.t)}</a><span class=twa>Latin\u2225English on Aquinas Studies</span></div><div class=thx id=thx></div><div class=cellact>`+
             `<a class=lchip href="https://aquinas-studies.vercel.app/read/${cell.aq}" target=_blank rel=noopener>Read Thomas \u2192</a>`+
             `<a class=lchip href="#ask=${encodeURIComponent(`Summa Theologiae ${pk} q.${qn} (${cell.t}) \u2014 how do the commentators treat this question?`)}">\u2726 Ask about this question</a>`+
             ((cell.works||[]).length&&typeof b64e==="function"?`<a class=lchip href="/the-faith-received/pins/#c=${b64e({v:3,n:("ST "+pk+" q."+qn+" \u2014 the bench"),items:cell.works.map(w=>["fr",w[0],w[1]])})}" target=_blank>\u26c9 bench \u2192 collection</a>`:"")+`</div>`;
           lx.appendChild(d0);
           // Thomas's own words, inline: the aq vectors carry his text (cit GLOB ST.<pars>.Q<q>.*)
           fetch(`https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/vsearch?q=${encodeURIComponent(cell.t)}&corpus=aq&cit=${encodeURIComponent("ST."+(pk==="Ia"?"I":pk)+".Q"+qn+".")}&k=2`)
             .then(r=>r.json()).then(d=>{const el2=document.getElementById("thx");if(!el2)return;
               const xs=(d.results||[]).filter(x=>x.tx);
               if(xs.length)el2.innerHTML=xs.slice(0,2).map(x=>`<div class=thxq>\u201c${esc(x.tx.slice(0,300))}\u2026\u201d <span class=thxc>${esc(x.cit)}</span></div>`).join("");}).catch(()=>{});
           const Y=window.__WYRS||{};
           [...cell.works].sort((a,b)=>(Y[a[0]]||1600)-(Y[b[0]]||1600)).forEach(([s,pg,lab])=>{
             const w=(WORKS||[]).find(x=>(x.slug||x.workspace)===s)||{};const y=Y[s];
             const d2=el("div","topicwork");
             d2.innerHTML=`<div class=tw1><a class=twt href="/the-faith-received/read/?w=${encodeURIComponent(s)}${pg?"#b"+pg+"-0":""}">${esc((TITLES&&TITLES[s])||w.title||s)}</a><span class=twa>${esc(w.author||"")}${y?" \u00b7 "+y:""}</span></div><ul class=twsecs><li><a href="/the-faith-received/read/?w=${encodeURIComponent(s)}${pg?"#b"+pg+"-0":""}">p.${pg} \u2014 ${esc(lab)}</a></li></ul>`;
             lx.appendChild(d2);});
         }};
       const m7=location.hash.match(/#st=(Ia|I-II|II-II|III)-(\d+)/);
       if(m7){window.__SMP=m7[1];window.__SMQ=m7[2];}
       loadSm(paint3);}
      }
      // ── SECTIONS ACROSS THE CORPUS: free-text search of every work's TOC headings (the
      // "find the disputatio" instrument) — lazy-loads the 154k-row index on first use.
      if(f.length>=3){
        const sec=el("section","topicgroup");sec.id="hsecs";
        sec.innerHTML='<div class=sw-head><h3 class=t>Sections across the corpus</h3><span class=c id=hsecn>searching…</span></div>';
        lib.appendChild(sec);
        loadHeadings(()=>{
          if(($("#q").value||"").trim().toLowerCase()!==f)return;   // query changed while loading
          const terms=f.split(/\s+/).filter(x=>x.length>1);
          const out=[];
          for(const [slug,p,t] of HEADINGS){
            const tl=t.toLowerCase();
            if(terms.every(x=>tl.includes(x))){out.push([slug,p,t]);if(out.length>=250)break;}
          }
          const wmap={};WORKS.forEach(w=>{wmap[w.slug||w.workspace]=w;});
          const box=$("#hsecs");if(!box)return;
          $("#hsecn").textContent=out.length+(out.length>=250?"+":"")+" sections";
          const byW={};out.forEach(([s,p,t])=>{(byW[s]=byW[s]||[]).push([p,t]);});
          Object.keys(byW).slice(0,60).forEach(s=>{
            const w=wmap[s]||{};const d=el("div","topicwork");
            d.innerHTML=`<div class=tw1><a href="/the-faith-received/read/?w=${encodeURIComponent(s)}" class=twt>${esc((TITLES&&TITLES[s])||w.title||s)}</a><span class=twa>${esc(w.author||"")}</span></div>`+
              `<ul class=twsecs>`+byW[s].slice(0,8).map(([p,t])=>`<li><a href="/the-faith-received/read/?w=${encodeURIComponent(s)}${p?"#b"+p+"-0":""}">${p?"p."+p+" — ":""}${esc(t)}</a></li>`).join("")+`</ul>`;
            box.appendChild(d);
          });
        });
      }
      return;
    }
    const t=TOPICS.find(x=>x.id===SEL_TOPIC);
    if(!t){SEL_TOPIC=null;return renderTopics();}
    if(!t.works){lib.innerHTML='<p class=muted>Opening '+esc(t.label||SEL_TOPIC)+'\u2026</p>';
      loadTopic(SEL_TOPIC,full=>{if(full&&full.works)render();else{SEL_TOPIC=null;render();}});return;}
    const rows=t.works.filter(w=>{
      if(window.__ERAF){const y=yearOf(w.d);
        if(window.__ERAF==="med"&&!(y<1500))return false;
        if(window.__ERAF==="em"&&!(y>=1500&&y<9999))return false;}
      if(!f)return true;const hay=((w.title||"")+" "+(w.author||"")+" "+(w.school||"")+" "+(w.tradition||"")+" "+w.secs.map(s=>s.t).join(" ")).toLowerCase();return hay.includes(f);});
    const head=el("div","browse-head");
    head.innerHTML=`<h2>${esc(t.label)}</h2><span class=hint>${rows.length} of ${t.n} works · <a href="#topics" id=tback style="color:var(--accent)">← all topics</a> · <a href="#library" style="color:var(--accent)">the shelves</a> · <a class=dossier href="${dossierURL(t.label,rows)}" title="Open every listed work (at its first matching section) as a shareable collection on /pins">⛉ open as collection</a> · <a class=dossier href="#tr=${encodeURIComponent(t.label)}" title="One query across the WHOLE tradition — Greek, Latin, Oriental Fathers, Aquinas, and the early-modern reception, banded chronologically">⟶ trace across the tradition</a> · <a class=dossier href="https://patrologia-graeca.vercel.app/topics.html#t=${t.id}" title="This locus on the Greek Fathers' topic door — benches (Alexandrian · Antiochene · Cappadocian …) and column-exact sections; unknown loci fall back to their topic index">Greek Fathers →</a></span>`;
    lib.appendChild(head);
    head.querySelector("#tback").onclick=e=>{e.preventDefault();SEL_TOPIC=null;try{history.replaceState(null,"","#topics");}catch(e2){}render();};
    if(t.ov){const ov=el("div");ov.innerHTML=ovHTML(t);lib.appendChild(ov.firstChild);}   // status quaestionis
    // granularity ladder: parents offer their narrower questions, sub-loci link back up —
    // the reader can expand or tighten focus without leaving the door.
    {const SUB={"de-deo":["de-existentia-dei","de-simplicitate","de-attributis-distinctio","de-scientia-dei","de-voluntate-dei","de-potentia-dei","de-aeternitate","de-immensitate"],
                "de-trinitate":["de-processionibus","de-relationibus","de-filioque"],
                "de-spiritu-sancto":["de-filioque"]};
     const byId={};TOPICS.forEach(x=>byId[x.id]=x);
     const go=id=>{SEL_TOPIC=id;try{history.replaceState(null,"","#t="+id);}catch(e){}render();window.scrollTo({top:0});};
     const kids=(SUB[t.id]||[]).map(id=>byId[id]).filter(Boolean);
     const parents=Object.keys(SUB).filter(pid=>SUB[pid].includes(t.id)).map(id=>byId[id]).filter(Boolean);
     if(kids.length||parents.length){
       const lad=el("div","tladder");
       lad.innerHTML=(kids.length?`<span class=lk>Go deeper</span>`+kids.map(k=>`<button class=lchip data-t=${k.id}>${esc(k.label)}<span class=ln>${k.n}</span></button>`).join(""):"")
         +(parents.length?`<span class=lk>${kids.length?" · Part of":"Part of"}</span>`+parents.map(k=>`<button class="lchip up" data-t=${k.id}>↰ ${esc(k.label)}</button>`).join(""):"");
       lad.querySelectorAll(".lchip").forEach(c=>c.onclick=()=>go(c.dataset.t));
       lib.appendChild(lad);
     }}
    // era scope: the two epochs of the corpus, separable at will (PhD instrument: sources vs reception)
    {const ys=t.works.map(w=>yearOf(w.d)).filter(y=>y<9999);
     if(ys.some(y=>y<1500)&&ys.some(y=>y>=1500)){
       const er=el("div","tladder");
       er.innerHTML='<span class=lk>Period</span>'+[["","All"],["med","Medieval masters"],["em","Early-modern reception"]].map(([v,l])=>`<button class="lchip${(window.__ERAF||"")===v?" on":""}" data-e="${v}">${l}</button>`).join("");
       er.querySelectorAll(".lchip").forEach(c=>c.onclick=()=>{window.__ERAF=c.dataset.e||null;render();});
       lib.appendChild(er);
     }}
    // classical seats: this locus's own places on the Summa/Sentences grids
    {const paintSeats=()=>{const s=(window.__GS||{})[t.id];if(!s)return;
       const ROM=["","I","II","III","IV"];
       const row=el("div","tladder");
       row.innerHTML='<span class=lk>Classical seats</span>'+
         (s.st||[]).slice(0,4).map(([p2,q2,ti])=>`<a class=lchip href="#st=${p2}-${q2}" title="${esc(ti)}">ST ${p2} q.${q2}</a>`).join("")+
         (s.sent||[]).slice(0,4).map(([bk2,d2,ti])=>`<a class=lchip href="#s=${bk2}-${d2}" title="${esc(ti)}">Sent. ${ROM[bk2]||bk2} d.${d2}</a>`).join("");
       lib.appendChild(row);};
     if(window.__GS)paintSeats();
     else fetch(BLOB+"/v1/grid_seats.json"+VER).then(r=>r.json()).then(g=>{window.__GS=g;paintSeats();}).catch(()=>{});}
    // the confessions on this question — the documents a lay reader/seminarian already knows,
    // bridged into the locus (v1/conf_topics.json), earliest first.
    {const paintCf=()=>{const CF=window.__CONF||{};const arts=CF[t.id]||[];if(!arts.length)return;
       const box=el("div","topicwork confbox");
       const cap=s=>String(s||"").toLowerCase().replace(/(^|[\s\u2014(-])([a-z])/g,(m,a2,b2)=>a2+b2.toUpperCase());
       box.innerHTML=`<div class=tw1><span class=twt style="cursor:default">In the confessions</span><span class=twa>${arts.length}</span></div>`+
         `<ul class=twsecs>`+arts.slice(0,12).map(r=>{const [s,pg,lab,yr,tr,nm]=r;
            return `<li><a href="/the-faith-received/read/?w=${encodeURIComponent(s)}${pg?"#b"+pg+"-0":""}"><b>${yr||""}</b> \u00b7 ${esc(nm||s)} \u2014 ${esc(cap(lab))}</a> <span style="color:var(--muted);font-size:.85em">${esc(tr||"")}</span></li>`;}).join("")+`</ul>`;
       const anchor=lib.querySelector(".tladder")||lib.lastChild;
       anchor&&anchor.nextSibling?lib.insertBefore(box,anchor.nextSibling):lib.appendChild(box);};
     if(window.__CONF)paintCf();
     else fetch(BLOB+"/v1/conf_topics.json"+VER).then(r=>r.json()).then(c=>{window.__CONF=c;paintCf();}).catch(()=>{});}
    // group: schools first (the benches), then remaining by tradition; WITHIN each group,
    // chronological by author dates — the argument's unfolding is visible as a lineage.
    const groups=[];
    SCHOOL_ORDER.forEach(s=>{const g=rows.filter(w=>w.school===s);if(g.length)groups.push([s+" school",g,s]);});
    ["Reformed","Lutheran","Roman Catholic","Medieval"].concat([...new Set(rows.map(w=>w.tradition))].filter(x=>x&&!["Reformed","Lutheran","Roman Catholic","Medieval"].includes(x))).forEach(tr=>{
      const g=rows.filter(w=>!w.school&&w.tradition===tr);if(g.length)groups.push([tr,g,null]);});
    groups.forEach(g2=>{g2[1]=[...g2[1]].sort((a,b)=>yearOf(a.d)-yearOf(b.d)||(b.w-a.w));});
    groups.forEach(([name,g,sch])=>{
      const sec=el("section","topicgroup");
      const h=el("div","sw-head");
      h.innerHTML=`<h3 class=t>${schipHTML(sch)} ${esc(name)}</h3><span class=c>${g.length} works · <a class=dossier href="${dossierURL(t.label+" — "+name,g)}">⛉ collection</a></span>`;
      sec.appendChild(h);
      g.forEach(w=>{
        const d=el("div","topicwork");
        const tt=(TITLES&&TITLES[w.slug])||w.title||w.slug;
        d.innerHTML=`<div class=tw1><a href="/the-faith-received/read/?w=${encodeURIComponent(w.slug)}" class=twt>${esc(tt)}</a>`+
          `<span class=twa>${esc(w.author||"")}${w.d?` <span class=twd>(${esc(w.d)})</span>`:""}</span>${w.school?schipHTML(w.school):`<span class=twtr>${esc(w.tradition||"")}</span>`}<span class=tww title="how much of this work treats the topic">${"▮".repeat(Math.min(5,1+Math.floor(Math.log2(w.w||1))))}</span></div>`+
          (w.secs.length?`<ul class=twsecs>`+w.secs.map(s=>`<li><a href="/the-faith-received/read/?w=${encodeURIComponent(w.slug)}${s.p?"#b"+s.p+"-0":""}">${s.p?"p."+s.p+" — ":""}${esc(s.t)}</a></li>`).join("")+`</ul>`:"");
        sec.appendChild(d);
      });
      lib.appendChild(sec);
    });
  });
}
// Grouping toggle removed: shelves-by-tradition is the resting view; typing in the search box (title or
// author) switches to flat author-grouped results (render() handles the `||f` filter branch).
  try{window.WITF=localStorage.getItem("fr_wit")||"";}catch(e){window.WITF="";}
  document.querySelectorAll(".seg.witf button").forEach(b=>{b.setAttribute("aria-pressed",String((b.dataset.wit||"")===window.WITF));
    b.onclick=()=>{window.WITF=b.dataset.wit||"";try{localStorage.setItem("fr_wit",window.WITF);}catch(e){}
      document.querySelectorAll(".seg.witf button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));render();};});
$("#q").addEventListener("input",render);
// author names are actions: click anywhere an .au chip appears → the library filtered to that author
// (a persistent chip in the search — it survives Browse/tab clicks; its ✕ is the only reset)
document.addEventListener("click",e=>{const a=e.target.closest("a.au[data-a]");if(!a)return;e.preventDefault();
  setAuthorF(a.dataset.a);});
// deep link: /?a=<author> lands with the library already filtered (reader bylines link here)
(()=>{const A=new URLSearchParams(location.search).get("a");if(!A)return;
  setAuthorF(A);})();
// Blob CDN mode (deploy build injects __FR_BLOB_BASE__): library reads the static works-index; no /api/* exists
const BLOB=(window.__FR_BLOB_BASE__&&!/TBD/.test(String(window.__FR_BLOB_BASE__)))?String(window.__FR_BLOB_BASE__).replace(/\/+$/,""):null;
const normW=w=>BLOB?Object.assign({},w,{workspace:w.slug,md_pages:w.n_pages,pdf_pages:w.has_pages?1:0,needs:0}):w;
// duplicate holdings (facsimile + born-digital of ONE book) stay readable but are never
// counted twice — the same ledger every counting layer folds through (owner 2026-08-28)
window.__DUPS={};if(BLOB)fetch(BLOB+"/v1/dup_copies.json").then(r=>r.ok?r.json():{}).then(d=>{window.__DUPS=d||{};}).catch(()=>{});
// one person, one section (owner 2026-08-29 "combine these authors too"): the registry
// files Estius under two spellings; the alias ledger is the same one every builder folds
window.__ALIAS={};if(BLOB)fetch(BLOB+"/v1/author_aliases.json").then(r=>r.ok?r.json():{}).then(d=>{window.__ALIAS=d||{};}).catch(()=>{});
const _foldAu=n=>(window.__ALIAS&&window.__ALIAS[n])||n;
const VER=window.__FR_VER?("?v="+window.__FR_VER):"";   // bust the 1-yr browser cache on mutable JSON
// Catalogue requests below revalidate their cached response even when this HTML
// carries an older build version, so newly published works remain discoverable.
// work-relations: which works have a SECOND WITNESS (another edition/copy we hold)
var WREL=null;
// SOURCE-LANGUAGE BADGES (owner 2026-08-27): v1/langs.json = {slug: de|fr|el|it|en|mul} for the
// 122 works whose source lane is not Latin (stopword census + LLM verify). Latin is the default
// and gets no badge - the badge marks the exception a reader should know before opening.
var LANGS=null;
if(BLOB)fetch(BLOB+"/v1/langs.json"+VER).then(r=>r.ok?r.json():null).then(l=>{
  if(!l)return;LANGS=l;try{if(typeof render==="function"&&typeof SEL_TRAD!=="undefined"&&SEL_TRAD)render();}catch(e){}
}).catch(()=>{});
// WORK GROUPS (owner 2026-09-07 "multiple versions of the same work"): v1/workgroups.json
// clusters an author's volumes/editions of ONE work under a single band (Bellarmine's
// Disputationes = Venice 1721 vols + Vivès tomes). Display-only — search dedupe stays in
// editions.json; witnesses are never hidden (owner edition-groups ruling 2026-09-05).
var WGROUPS=null;
const pWorkGroups=Promise.all([
  BLOB?fetch(BLOB+"/v1/workgroups.json"+VER).then(r=>r.ok?r.json():{}).catch(()=>({})):Promise.resolve({}),
  fetch("https://mo-tfr-library.mo-podcast-feed.workers.dev/v1/data/workgroups.json"+VER).then(r=>r.ok?r.json():{}).catch(()=>({}))
]).then(([published,local])=>{
  WGROUPS={groups:{...(published.groups||{}),...(local.groups||{})},works:{...(published.works||{}),...(local.works||{})}};
  try{if(typeof render==="function"&&typeof SEL_TRAD!=="undefined"&&SEL_TRAD)render();}catch(e){}
  return WGROUPS;
});
if(BLOB)fetch(BLOB+"/v1/work-relations.json"+VER).then(r=>r.ok?r.json():null).then(w=>{
  if(!w)return; const sec={};
  (w.duplicates||[]).forEach(g=>{const keep=Array.isArray(g.keep)?g.keep:[g.keep];
    [...keep,...(g.others||[])].forEach(s=>{sec[s]=1;});});
  // complementary witnesses (owner 2026-09-09): the same work held as facsimile AND as
  // born-digital text — the scan is the second witness of the text. Kept per slug so each
  // side can name what the other side is.
  const cw={};
  (w.complementary_witnesses||[]).forEach(g=>{(g.fac||[]).forEach(s=>{cw[s]={kind:"fac",other:g.dig||[]};});(g.dig||[]).forEach(s=>{cw[s]={kind:"dig",other:g.fac||[]};});});
  w.__second=sec;w.__cw=cw;WREL=w;try{if(typeof render==="function"&&typeof SEL_TRAD!=="undefined"&&SEL_TRAD)render();}catch(e){}
}).catch(()=>{});
// Revalidate the catalogue with one conditional GET. The browser already owns
// ETag/Last-Modified handling; no serial HEAD probe or guessed JSON byte fields.
const pCatalogue=BLOB?fetch(BLOB+"/v1/works-index.json"+VER,{cache:"no-cache"}).then(r=>{if(!r.ok)throw Error("Catalogue unavailable");return r.json();}):fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/works").then(r=>{if(!r.ok)throw Error("Catalogue unavailable");return r.json();});
// Ask can reuse the complete inventory after it is opened. Display folding below
// returns a new object so no witness disappears from this shared catalogue.
window.__FR_LIBRARY_CATALOGUE__=pCatalogue;
const pDuplicateFold=BLOB?fetch(BLOB+"/v1/dupfold.json"+VER).then(r=>r.ok?r.json():{}).catch(()=>({})):Promise.resolve({});
const pWorks=Promise.all([pCatalogue,pDuplicateFold,pWorkGroups.catch(()=>null)]).then(([d,fold,groups])=>{
  if(groups&&groups.works&&Array.isArray(d.works))return Object.assign({},d,{works:d.works.filter(w=>!fold[w.slug]||groups.works[w.slug])});
  return d;
});
// school registry (Westminster Assembly, religious orders) — lens tabs light up when it lands
if(BLOB)fetch(BLOB+"/v1/mine/constellations/index.json"+VER).then(r=>r.ok?r.json():null).then(d=>{
  if(!d||!d.shelves)return; const m={}; d.shelves.forEach(s=>{m[s.shelf]=s;});
  window.__MINESKY=m; try{if(typeof render==="function"&&typeof SEL_TRAD!=="undefined"&&SEL_TRAD)render();}catch(e){}
}).catch(()=>{});
if(BLOB)fetch(BLOB+"/v1/schools.json"+VER).then(r=>r.ok?r.json():null).then(s=>{if(s){window.__SCHOOLS=s;try{if(typeof SEL_TRAD!=="undefined"&&SEL_TRAD)render();}catch(e){}}}).catch(()=>{});
const pMe=BLOB?Promise.resolve({owner:false}):fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/me").then(r=>r.json()).catch(()=>({owner:false}));
Promise.all([pWorks,pMe]).then(([d,me])=>{
  window.__FR_CATALOGUE_READY__=true;OWNER=!!(me&&me.owner);TRAD_ORDER=d.traditions||[];
  WORKS=(d.works||d).map(normW);
  // frontispiece stats, computed live from the index
  try{
    const nW=WORKS.length, auth=new Set(WORKS.map(w=>w.author).filter(Boolean)).size;
    const pg=WORKS.reduce((s,w)=>s+(+w.md_pages||0),0);
    const nT=new Set(WORKS.map(w=>w.tradition).filter(Boolean)).size;
    const set=(id,v)=>{const e=$("#"+id);if(e)e.textContent=v;};
    set("stWorks",nW.toLocaleString());set("stAuthors",auth.toLocaleString());
    set("stPages",(Math.round(pg/1000)*1000).toLocaleString());set("stTrad",nT.toLocaleString());
  }catch(e){}
  render();}).catch(()=>{window.__FR_CATALOGUE_FAILED__=true;render();});
// author bios + work blurbs (so browsing teaches WHO & WHAT): two small Blob artifacts, then re-render
// daily buster (kinds.json precedent): blurbs/titles are re-baked between
// deploys, and the build stamp alone caches them stale for a day
const _dver="?d="+new Date().toISOString().slice(0,10)+".2";
if(BLOB)Promise.all([
  fetch(BLOB+"/v1/blurbs.json"+_dver).then(r=>r.ok?r.json():{}).catch(()=>({})),
  fetch(BLOB+"/v1/authors.json"+VER).then(r=>r.ok?r.json():{}).catch(()=>({})),
  fetch(BLOB+"/v1/titles_en.json"+_dver).then(r=>r.ok?r.json():{}).catch(()=>({}))
]).then(([bl,au,te])=>{BLURBS=bl||{};AUTHORS=au||{};TITLES=te||{};render();loadNoteShard(SEL_TRAD);}).catch(()=>{});
// SHARDED NOTES (2026-08-23). The core files above hold the confessional shelves' bios and
// blurbs — what June wrote plus the new notes for those shelves, ~1 MB. The four big families
// (Latin/Greek/Eastern Fathers, English Divines: 2,600 bios, 17,800 introductions) live in
// per-family shards fetched the first time that shelf is opened, so a visitor to the Reformed
// shelf never downloads 12 MB of Migne letters they will not hover. Same keys, merged into the
// same globals, so every renderer below keeps working unchanged.
const NOTE_SHARDS={"Latin Fathers":"latin-fathers","Greek Fathers":"greek-fathers","Eastern Fathers":"eastern-fathers","English Divines":"english-divines"};
window.__noteShards=window.__noteShards||{};
function loadNoteShard(trad){
  const k=NOTE_SHARDS[trad];if(!k||!BLOB||window.__noteShards[k])return;
  window.__noteShards[k]=1;
  Promise.all([
    fetch(BLOB+"/v1/blurbs/"+k+".json"+VER).then(r=>r.ok?r.json():{}).catch(()=>({})),
    fetch(BLOB+"/v1/authors/"+k+".json"+VER).then(r=>r.ok?r.json():{}).catch(()=>({}))
  ]).then(([bl,au])=>{let n=0;for(const s in (bl||{})){if(!BLURBS[s]){BLURBS[s]=bl[s];n++;}}
    for(const a in (au||{})){if(!AUTHORS[a]){AUTHORS[a]=au[a];n++;}}
    if(n)try{render();}catch(e){}}).catch(()=>{});
}
// ── Confessions tab: the Dennison Reformed-Confessions collection (separate Blob index) ──
function matchConf(c,f){return !f||[c.title,c.region,c.type,String(c.year),c.preview].some(x=>(x||"").toLowerCase().includes(f));}
function loadConfs(cb){
  if(CONFS){cb&&cb();return;}
  if(!BLOB){CONFS={count:0,periods:[],confessions:[],source:""};cb&&cb();return;}
  fetch(BLOB+"/v1/confessions-index.json"+VER).then(r=>r.json())
    .then(d=>{CONFS=d;cb&&cb();}).catch(()=>{CONFS={count:0,periods:[],confessions:[],source:""};cb&&cb();});}
function renderConfessions(){
  const lib=$("#lib");
  if(!CONFS){lib.innerHTML='<p class=muted>Loading the confessions…</p>';loadConfs(()=>{if(VIEW==="confessions")renderConfessions();});return;}
  const wasFocused=document.activeElement&&document.activeElement.id==="confSearch";
  const caret=wasFocused?document.activeElement.selectionStart:null;
  const _sy=window.scrollY;   // preserve scroll across re-renders (blurbs/authors load, facet clicks)
  lib.innerHTML="";
  const f=(CONF_Q||"").trim().toLowerCase();
  let cs=CONFS.confessions.filter(c=>matchConf(c,f));
  if(CONF_FACET!=="all")cs=cs.filter(c=>c.type===CONF_FACET);
  if(CONF_TRAD!=="all")cs=cs.filter(c=>c.tradition===CONF_TRAD);
  const intro=el("div","confintro");
  intro.innerHTML='<h2>The Creeds of Christendom</h2>'+
    '<p class=lede>The creeds, confessions, catechisms, and conciliar &amp; magisterial definitions of the churches — '+
    ((CONFS.confessions||[]).length)+' documents in English translation, read section by section.</p>'+
    (CONFS.source?'<p class=src>'+esc(CONFS.source)+'</p>':'');
  lib.appendChild(intro);
  // two clearly-distinct search affordances, side by side:
  //  · "Browse the confessions" — filters THIS list (title/tradition/region/year)
  //  · "Search the corpus" — opens the full-text + ✦Ask overlay (search inside every work, ask a question)
  const srow=el("div","conf-searchrow");
  srow.innerHTML='<div class=conf-sf><label for=confSearch>Browse the confessions</label>'+
      '<input id=confSearch type=search class=confsearch placeholder="Filter by title, tradition, or year…" aria-label="Filter the confessions"></div>'+
      '<button type=button id=confCorpusBtn class=conf-corpusbtn aria-label="Search the corpus — full text and Ask">'+
      '<span class=cc-t>Search the whole corpus ›</span>'+
      '<span class=cc-s>search inside the text of every work, or ask a question and get cited answers</span></button>';
  lib.appendChild(srow);
  const sb=srow.querySelector("#confSearch");sb.value=CONF_Q;
  sb.addEventListener("input",()=>{CONF_Q=sb.value;renderConfessions();});
  srow.querySelector("#confCorpusBtn").onclick=()=>{const o=$("#csOpen");if(o)o.click();};
  // tradition facet (All / Reformed / Lutheran), then document-type facet
  const trads0=CONFS.traditions||[...new Set(CONFS.confessions.map(c=>c.tradition).filter(Boolean))];
  const tfac=el("div","conffacets");
  tfac.innerHTML=["all",...trads0].map(t=>`<button data-tr="${esc(t)}" aria-pressed="${t===CONF_TRAD}">${t==="all"?"All traditions":esc(t)}</button>`).join("");
  tfac.querySelectorAll("button").forEach(b=>b.onclick=()=>{CONF_TRAD=b.dataset.tr;renderConfessions();});
  lib.appendChild(tfac);
  const _realTypes=Array.from(new Set(CONFS.confessions.map(c=>c.type).filter(Boolean)));
  if(_realTypes.length){
    const types=["all",..._realTypes];
    const fac=el("div","conffacets");
    fac.innerHTML=types.map(t=>`<button data-t="${esc(t)}" aria-pressed="${t===CONF_FACET}">${t==="all"?"All types":esc(t)}</button>`).join("");
    fac.querySelectorAll("button").forEach(b=>b.onclick=()=>{CONF_FACET=b.dataset.t;renderConfessions();});
    lib.appendChild(fac);
  }
  if(f||CONF_FACET!=="all"||CONF_TRAD!=="all"){const n=el("div","confcount");n.textContent=cs.length+(cs.length===1?" match":" matches")+" of "+((CONFS.confessions||[]).length);lib.appendChild(n);}
  if(!cs.length){lib.appendChild(Object.assign(el("p","muted"),{textContent:"No confessions match — try a different word, tradition, or year."}));}
  else{
    const trads=(CONF_TRAD==="all")?trads0:[CONF_TRAD];
    trads.forEach(trad=>{
      const ti=cs.filter(c=>c.tradition===trad);
      if(!ti.length)return;
      const th=el("h2","conftrad");th.innerHTML=`${esc(trad)} <span class=c>${ti.length} ${ti.length>1?"documents":"document"}</span>`;
      lib.appendChild(th);
      (CONFS.periods||[]).forEach(p=>{
        const items=ti.filter(c=>c.period===p).sort((a,b)=>a.num-b.num);
        if(!items.length)return;
        const sec=el("section","confperiod");
        const h=el("h3","cph");h.innerHTML=`${esc(p)} <span class=c>${items.length} ${items.length>1?"documents":"document"}</span>`;
        sec.appendChild(h);
        items.forEach(c=>{
          const a=el("a","confrow");a.href="/the-faith-received/read/?w="+encodeURIComponent(c.slug);
          const title=esc((c.title||"").replace(/\s*\([^)]*\)\s*$/,""));
          const tags=`<span class=ctag>${esc(c.type)}</span>`+(c.region?`<span class=ctag>${esc(c.region)}</span>`:"");
          a.innerHTML=`<span class=cnum>${c.num}</span>`+
            `<span class=cmain><span class=ctitle>${title}</span>`+
            `<span class=cmeta><b>${c.year||"—"}</b> · ${tags}</span>`+
            `<span class=cprev>${esc(c.preview||"")}</span></span>`+
            `<span class=cgo>Read ›</span>`;
          sec.appendChild(a);
        });
        lib.appendChild(sec);
      });
    });
  }
  if(wasFocused){const s2=$("#confSearch");if(s2){s2.focus({preventScroll:true});if(caret!=null){try{s2.setSelectionRange(caret,caret);}catch(e){}}}}
  if(_sy)try{window.scrollTo({top:_sy,left:0,behavior:"instant"});}catch(e){window.scrollTo(0,_sy);}
}
function setView(v){
  VIEW=v;
  const lb=$("#navLib"),cb=$("#navConf"),tb=$("#navTopics");
  if(lb)lb.setAttribute("aria-pressed",String(v==="library"));
  if(cb)cb.setAttribute("aria-pressed",String(v==="confessions"));
  if(tb)tb.setAttribute("aria-pressed",String(v==="topics"));
  document.body.classList.toggle("v-conf",v==="confessions");
  const q=$("#q");if(q)q.placeholder=(v==="confessions")?"Search confessions by title, region, year…":(v==="topics"?"Filter this topic — author, work, section…":"Search by title or author…");
  try{history.replaceState(null,"",v==="confessions"?"#confessions":location.pathname+location.search);}catch(e){}
  render();
  // the views render into #lib, below the hero — a door/tab click must bring the result into view
  // or the click reads as dead. Skipped on first paint so a plain load stays at the top.
  if(window.__navved){const lib2=document.getElementById("lib");
    if(lib2){const y=lib2.getBoundingClientRect().top+scrollY-96;scrollTo({top:v==="library"?Math.min(y,scrollY):y,behavior:"smooth"});}}
  window.__navved=1;
}
{const sc2=$("#shelfCue");if(sc2)sc2.onclick=e=>{e.preventDefault();if(VIEW!=="library"){SEL_TOPIC=null;window.__navved=0;setView("library");}const lib3=$("#lib");if(lib3)lib3.scrollIntoView({behavior:"smooth",block:"start"});};}
{const bh=$("#brandHome");if(bh)bh.onclick=e=>{if(location.search){return;}e.preventDefault();SEL_TOPIC=null;try{history.replaceState(null,"",location.pathname);}catch(e2){}window.__navved=0;setView("library");scrollTo({top:0,behavior:"smooth"});};}
{const lb=$("#navLib"),cb=$("#navConf");
 if(lb)lb.onclick=()=>setView("library");
 if(cb)cb.onclick=()=>setView("confessions");
 if(!BLOB&&cb)cb.style.display="none";
 /* Topics/Summa view RETIRED 2026-07-18 — the knowledge-graph work behind it lives on in Ask
    (graph routing, locus overviews, classical seats). Old #t=/#topics/#s=/#sc=/#st= links fall
    back to the library. */
 if(/#conf/i.test(location.hash))setView("confessions");
 else if(/#(t=|topics|s=|sc=|st=)/i.test(location.hash)){try{history.replaceState(null,"",location.pathname+location.search);}catch(e){}setView("library");}
 addEventListener("hashchange",()=>{
   if(/#(t=|topics|s=|sc=|st=)/i.test(location.hash)){try{history.replaceState(null,"",location.pathname+location.search);}catch(e){}setView("library");}
   else if(/#confessions/i.test(location.hash)){setView("confessions");}
   else if(/#library/i.test(location.hash)){setView("library");}});}
// QA coverage is OWNER-ONLY (review state is internal). Fetched + shown only after the owner
// signs in; non-owners never receive review.json at all.
const OWNER_EMAIL="stivenpeter@gmail.com";
function fetchReview(){if(REVIEW_COV||!BLOB)return;
  fetch(BLOB+"/v1/review.json"+VER).then(r=>r.json()).then(d=>{REVIEW_COV=d.works||null;
    try{const t=d.totals;if(t&&t.pages){const pct=Math.round(t.viewed/t.pages*100);
      const hs=$("#heroStats");if(hs&&!$("#stQA")){const s=document.createElement("span");s.innerHTML=`<b id=stQA>${pct}%</b> QA-reviewed`;hs.appendChild(s);}}}catch(e){}
    render();}).catch(()=>{});}
// library owner detection via Firebase (same shared project); local server already sets OWNER via /api/me
(function(){const cfg=window.__FR_FB__;if(!BLOB||!cfg||!cfg.apiKey)return;
  const btn=$("#libSignIn");if(btn){btn.style.display="";const top=document.querySelector(".top .seg");if(top&&top.parentElement){btn.classList.add("in-top");top.parentElement.appendChild(btn);}}
  (async()=>{try{
    const [A,Au,Fs]=await Promise.all([import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"),import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js")]);
    const app=A.initializeApp(cfg),auth=Au.getAuth(app),db=Fs.getFirestore(app);
    if(btn)btn.onclick=()=>auth.currentUser?Au.signOut(auth):Au.signInWithPopup(auth,new Au.GoogleAuthProvider()).catch(()=>{});
    // account sync for the landing's research state: pins (★) + Ask conversations.
    // Doc contract (Family Standard R11): users/{uid}/meta/fr_pins {items:[...]}, fr_ask_history {items:[...]}
    const _wt={},_ref=(uid,k)=>Fs.doc(db,"users",uid,"meta",k);
    const _push=(uid,k)=>{clearTimeout(_wt[k]);_wt[k]=setTimeout(()=>{try{Fs.setDoc(_ref(uid,k),{items:JSON.parse(localStorage.getItem(k)||"[]"),ts:Date.now()});}catch(e){}},900);};
    const _merge=async(uid,k,idOf,cap)=>{try{
      let remote=[];const s=await Fs.getDoc(_ref(uid,k));if(s.exists())remote=(s.data()||{}).items||[];
      let local=[];try{local=JSON.parse(localStorage.getItem(k)||"[]");}catch(e){}
      const seen=new Set(),m=[];[...local,...remote].forEach(x=>{const id=idOf(x);if(!seen.has(id)){seen.add(id);m.push(x);}});
      localStorage.setItem(k,JSON.stringify(m.slice(0,cap)));
      if(m.length)await Fs.setDoc(_ref(uid,k),{items:m.slice(0,cap),ts:Date.now()});
    }catch(e){}};
    Au.onAuthStateChanged(auth,u=>{
      if(u){(async()=>{
         await _merge(u.uid,"fr_pins",x=>(x.site||"fr")+"|"+x.slug+"|"+x.page,300);
         await _merge(u.uid,"fr_ask_history",x=>x.q,40);
         window._frSyncPins=()=>_push(u.uid,"fr_pins");window._frSyncAsk=()=>_push(u.uid,"fr_ask_history");
        })();}
      else{delete window._frSyncPins;delete window._frSyncAsk;}
      const owner=!!(u&&u.email===OWNER_EMAIL&&u.emailVerified);
      OWNER=owner;if(btn)btn.textContent=u?(owner?"✦ "+(u.displayName||"owner"):"Sign out"):"Sign in";
      if(owner)fetchReview();else{REVIEW_COV=null;}
      render();});
  }catch(e){}})();})();
// ---- corpus search overlay: Texts (Pagefind ×N buckets) · Latin lemma (prefix shards) · Meaning (https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/vsearch) ----
(function(){
  const SB=BLOB;                                      // overlay only works with the Blob indexes
  const so=$("#cso"),q=$("#csq"),body=$("#csb");
  if(!so)return;
  if(!SB){$("#csOpen").style.display="none";return;}  // local QA server: works-filter only
  let TAB="text",pf=null,LEMS=null,WMAP=null,deb=null;
  {const c=document.getElementById("csPL");if(c){try{c.checked=localStorage.getItem("fr_srchpl")!=="0";}catch(e){}
    c.onchange=()=>{try{localStorage.setItem("fr_srchpl",c.checked?"1":"0");}catch(e){}if(TAB==="text")run();};}}
  // MOBILE: the sheet is full-screen and scrolls internally — freeze the page behind it, or an
  // iOS drag inside the thread scrolls the library underneath and the modal drifts away.
  const SMALL=()=>matchMedia("(max-width:700px)").matches;
  const open=()=>{so.classList.add("open");document.body.classList.add("cso-lock");populateFilters();initPF().catch(()=>{});
    // don't steal focus on a phone: the software keyboard would cover the sheet before it's read
    if(TAB==="ask"){if(!(askThread&&body.contains(askThread)))askIntro();const ai=$("#askInput");if(ai&&!SMALL())ai.focus();}else if(!SMALL())q.focus();};
  // ---- filters (Search + ✦ Ask): author · tradition · confession · confessional tradition ----
  // each is a multi-pick popover; together they imply an allowed-slug SET (see allowSlugs). In Search they
  // live-filter the results; in Ask they are captured when the Ask button is pressed (Ask never auto-runs).
  let _filtersPop=false, _pickers=[];
  const reRun=()=>{if(TAB!=="ask")run();};   // Search updates live on a filter change; Ask waits for its button
  const closeAllPops=(except)=>_pickers.forEach(pk=>{const P=$("#"+pk.pop);if(P&&P!==except&&!P.hidden)pk.api.closeP();});
  const PICK={};   // key -> Set of selected values
  function mkPicker(o){
    const sel=PICK[o.key]=new Set();
    const B=$("#"+o.btn),P=$("#"+o.pop),L=$("#"+o.list),Q=o.q?$("#"+o.q):null;
    const upd=()=>{if(!B||!B.firstChild)return;const n=sel.size;
      B.firstChild.textContent=n?(n+" "+o.label+(n>1?"s ":" ")):(o.zero+" ");
      B.classList.toggle("on",n>0);const c=o.count?$("#"+o.count):null;if(c)c.textContent=n?(n+" selected"):"";};
    const filt=qv=>{qv=(qv||"").toLowerCase();if(L)L.querySelectorAll(".csf-opt").forEach(x=>{x.style.display=x.textContent.toLowerCase().includes(qv)?"":"none";});};
    const fill=items=>{if(!L)return;L.innerHTML=items.map(it=>`<label class=csf-opt><input type=checkbox value="${esc(it.v)}"><span>${esc(it.t)}</span></label>`).join("");
      L.querySelectorAll("input").forEach(cb=>cb.addEventListener("change",()=>{cb.checked?sel.add(cb.value):sel.delete(cb.value);upd();if(TAB!=="ask")run();}));};
    const openP=()=>{if(!P||!B)return;const r=B.getBoundingClientRect();   // fixed-position at the button so overflow can't clip it
      P.style.left=Math.max(8,Math.min(r.left,innerWidth-312))+"px";P.style.top=(r.bottom+6)+"px";
      if(L)L.style.maxHeight=Math.max(110,innerHeight-r.bottom-205)+"px";
      P.hidden=false;B.setAttribute("aria-expanded","true");if(Q){Q.value="";Q.focus();filt("");}};
    const closeP=()=>{if(!P||!B)return;P.hidden=true;B.setAttribute("aria-expanded","false");};
    if(B)B.onclick=e=>{e.stopPropagation();const wasHidden=P.hidden;closeAllPops(P);if(wasHidden)openP();else closeP();};
    if(Q)Q.addEventListener("input",()=>filt(Q.value));
    if(o.clear){const c=$("#"+o.clear);if(c)c.onclick=()=>{sel.clear();if(L)L.querySelectorAll("input").forEach(x=>x.checked=false);upd();if(TAB!=="ask")run();};}
    if(o.done){const d=$("#"+o.done);if(d)d.onclick=()=>{closeP();reRun();};}
    if(P)P.addEventListener("click",e=>e.stopPropagation());
    return {fill,upd,sel,closeP};
  }
  function populateFilters(){
    if(_filtersPop)return;
    if(typeof WORKS==="undefined"||!WORKS.length)return;          // wait for the works index to load
    const defs=[
      {key:"auth", btn:"fAuthBtn", pop:"fAuthPop", list:"fAuthList", q:"fAuthQ", count:"fAuthCount", clear:"fAuthClear", done:"fAuthDone", label:"author", zero:"by any author"},
      {key:"trad", btn:"fTradBtn", pop:"fTradPop", list:"fTradList", count:"fTradCount", clear:"fTradClear", done:"fTradDone", label:"tradition", zero:"any tradition"},
      {key:"conf", btn:"fConfBtn", pop:"fConfPop", list:"fConfList", q:"fConfQ", count:"fConfCount", clear:"fConfClear", done:"fConfDone", label:"confession", zero:"any confession"},
      {key:"ctrad",btn:"fCtradBtn",pop:"fCtradPop",list:"fCtradList",count:"fCtradCount",clear:"fCtradClear",done:"fCtradDone",label:"confessional tradition", zero:"any confessional tradition"}
    ];
    _pickers=defs.map(d=>({key:d.key,pop:d.pop,api:mkPicker(d)}));
    const P=k=>(_pickers.find(x=>x.key===k)||{}).api;
    const auths=[...new Set(WORKS.map(w=>w.author).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    P("auth").fill(auths.map(a=>({v:a,t:a})));
    /* "Unsorted" IS NOT A TRADITION (owner 2026-08-22: "unsorted shouldnt be selectable").
       It is the server-side fallback label — `m.get("tradition") or "Unsorted"` — for a work
       whose metadata carries none, so it arrives here looking like a real choice and filters
       the library down to an empty shelf. Anything genuinely unlabelled is reached by author
       or by full text; the absence of a label is not a school. */
    /* DERIVE THE LIST, ORDER IT BY THE PUBLISHED ONE (owner 2026-08-22: "is the tradition picker
       filled out?"). It was not. The picker PREFERRED works-index.json's `traditions` array,
       which had gone stale: it advertised seven and omitted English Divines (4,629 works),
       Greek Fathers (3,832) and Eastern Fathers (400) — three of the four largest — while
       listing "Unsorted", which no work carries. A hand-maintained list of what exists drifts
       from what exists. The works themselves are the truth; the published array is only useful
       for ORDER, so use it for that and nothing else. */
    const _have=[...new Set(WORKS.map(w=>w.tradition).filter(Boolean))].filter(t=>t!=="Unsorted");
    const _ord=(typeof TRAD_ORDER!=="undefined"&&TRAD_ORDER.length)?TRAD_ORDER:[];
    const trads=[..._ord.filter(t=>_have.includes(t)),..._have.filter(t=>!_ord.includes(t)).sort()];
    P("trad").fill(trads.map(t=>({v:t,t:t})));
    loadConfs(()=>{const cs=(typeof CONFS!=="undefined"&&CONFS&&CONFS.confessions)||[];   // confessions index is lazy-loaded
      P("conf").fill(cs.map(c=>({v:c.slug,t:c.title})));
      const ct=[...new Set(cs.map(c=>c.tradition).filter(Boolean))].sort();
      P("ctrad").fill(ct.map(t=>({v:t,t:t})));});
    document.addEventListener("click",()=>closeAllPops(null));
    _filtersPop=true;
  }
  // the allowed-slug SET implied by the 4 filters (null = no restriction / whole corpus):
  //   works admitted by (author AND tradition); confessions by (specific pick OR confessional tradition);
  //   a collection is included only when it has an active filter; both active ⇒ union.
  const allowSlugs=()=>{
    const A=PICK.auth,T=PICK.trad,C=PICK.conf,CT=PICK.ctrad;
    if(!A&&!T&&!C&&!CT)return null;
    const wAct=(A&&A.size)||(T&&T.size), cAct=(C&&C.size)||(CT&&CT.size);
    if(!wAct&&!cAct)return null;
    const allow=new Set();
    if(wAct&&typeof WORKS!=="undefined")for(const w of WORKS){
      if((!A.size||A.has(w.author))&&(!T.size||T.has(w.tradition)))allow.add(w.slug);}
    if(cAct&&typeof CONFS!=="undefined"&&CONFS&&CONFS.confessions)for(const c of CONFS.confessions){
      if((C.size&&C.has(c.slug))||(CT.size&&CT.has(c.tradition)))allow.add(c.slug);}
    return [...allow];
  };
  const pfFilters=()=>({});                                       // native Pagefind filter unused — we post-filter results by allowSlugs
  const askFilters=()=>{const f={},al=allowSlugs();if(al)f.allowSlugs=al;
    if(window.__askFC&&window.__askFC.length)f.fathersCorpora=window.__askFC;
    if(window.__askTradSel)f.tradition=window.__askTradSel;
    // school + party confine the CLASSIC ask too (2026-09-06 — previously Agent-only)
    if(window.__askSchool&&window.__SCHOOLS&&window.__SCHOOLS[window.__askSchool])
      f.allowSlugs=[...new Set([...(f.allowSlugs||[]),...(window.__SCHOOLS[window.__askSchool].slugs||[])])].slice(0,600);
    if(window.__askParty&&typeof WORKS!=="undefined"&&WORKS.length)
      f.allowSlugs=[...new Set([...(f.allowSlugs||[]),...WORKS.filter(w=>(w.party||"")===window.__askParty).map(w=>w.slug)])].slice(0,600);
    if(window.__askNB){try{const C=JSON.parse(localStorage.getItem("fr_collections_v1")||"[]");
      const act=C.find(c=>c.id===localStorage.getItem("fr_pincol"))||C[0];
      if(act&&((act.items||[]).length||act.memo))f.nb={name:act.name,memo:(act.memo||"").slice(0,1200),
        notes:(act.items||[]).filter(i=>i.type==="note").slice(0,12).map(i=>String(i.text||"").slice(0,400)),
        items:(act.items||[]).filter(i=>i.type!=="note").slice(0,40).map(i=>({t:i.title||i.slug,a:i.author||"",l:String(i.label||"").slice(0,140)}))};
    }catch(e){}}
    return f;};
  const close=()=>{so.classList.remove("open");document.body.classList.remove("cso-lock");
    const np=so.querySelector(".nb-panel");if(np)np.remove();};
  $("#csOpen").onclick=open;$("#csClose").onclick=close;
  so.addEventListener("click",e=>{if(e.target===so)close();});
  addEventListener("keydown",e=>{if(e.key==="Escape")close();
    if(!window.__FR_LIBRARY_SEARCH__&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();open();}});
  $("#q").addEventListener("keydown",e=>{if(e.key==="Enter"&&$("#q").value.trim().length>1){q.value=$("#q").value;open();run();}});
  // omnibox escape rows deep-link the palette: #cs=<q> opens Search, #ask=<q> opens Ask — shareable too.
  {const ph=()=>{let m=location.hash.match(/#cs=([^&]+)/);
     if(m){q.value=decodeURIComponent(m[1]);setTab("text");open();run();history.replaceState(null,"",location.pathname);return;}
     m=location.hash.match(/#ask=([^&]+)/);
     if(m){const v=decodeURIComponent(m[1]);setTab("ask");open();try{runAsk(v);}catch(e){}history.replaceState(null,"",location.pathname);return;}
     m=location.hash.match(/#tr=([^&]+)/);
     if(m){q.value=decodeURIComponent(m[1]);setTab("trad");open();run();history.replaceState(null,"",location.pathname);return;}
     if(/^#ask$/.test(location.hash)){setTab("ask");open();history.replaceState(null,"",location.pathname);return;}
     if(/^#tr$/.test(location.hash)){setTab("trad");open();history.replaceState(null,"",location.pathname);}};
   addEventListener("hashchange",ph);
   // DEFERRED, not immediate: ph() calls setTab, which is declared with `const` a few lines
   // below. Calling it inline threw a TDZ ReferenceError, which aborted the rest of this IIFE
   // — so loading the page AT #ask / #cs= / #tr= (a shared or bookmarked palette link) left
   // the whole Search/Ask overlay dead. A microtask-later call sees a fully-initialised scope.
   setTimeout(ph,0);}
  const setTab=t=>{if(t==="ask"&&window.FRAsk){close();window.FRAsk.open();return;}clearTimeout(deb);TAB=t;[["tabText","text"],["tabAsk","ask"]].forEach(([id,k])=>{const b=$("#"+id);if(b)b.setAttribute("aria-pressed",String(k===t));});
    q.placeholder=(t==="lem")?"A Latin headword — e.g. fides, gratia, iustificatio…":(t==="trad")?"A doctrine across the whole tradition — e.g. the descent into hell…":"Search the corpus — every work and confession…";
    {const ts=$("#trScope");if(ts)ts.style.display=(t==="trad")?"flex":"none";}
    q.style.display=(t==="ask"||t==="sky")?"none":"";   // Scripture is a browse surface, not a query box   // Ask uses the chat composer at the bottom, not this search box
    {const ff=$("#csFilters");if(ff){ff.classList.toggle("lemoff",t==="lem");
      // ASK IS A CHAT (owner 2026-09-05 "an actual chat interface … the AI should scope
      // correctly"): the four-select filter wall never shows on the Ask tab — scope lives
      // in the composer's quiet ⌖ sheet, and the router scopes from the question itself.
      ff.classList.toggle("askoff",t==="ask");}}   // a CLASS, never an inline display — inline beats the mobile media query and rebuilt the wall of selects (regressed once already)
    if(t==="sky"){renderSkyTab();return;}
    if(t==="ask"){askIntro();const ai=$("#askInput");if(ai){if(q.value.trim())ai.value=q.value.trim();try{ai.focus();}catch(e){}}}else run();};   // switching to Ask never runs — it carries the typed query into the composer and waits for the button
  $("#tabText").onclick=()=>setTab("text");{const _l=$("#tabLem");if(_l)_l.onclick=()=>setTab("lem");}   // lemma tab retired 2026-08-20 (index 404)
  /* Constellations tab removed from the Search/Ask overlay (owner 2026-08-22: "no constellation in the ask panel none of it"). The map itself still lives on the shelf and PL research doors; it was the bulk inside the ask composer that did not belong. Retired the same way the lemma tab was: button gone, guarded handler left inert. */
  {const a=$("#tabAsk");if(a)a.onclick=()=>setTab("ask");}
  q.addEventListener("input",()=>{if(TAB==="ask")return;clearTimeout(deb);deb=setTimeout(run,260);});
  // deep link: /?tq=<query> opens the overlay in Tradition mode (reader cite-chips land here)
  {const tq=new URLSearchParams(location.search).get("tq");
   if(tq){setTimeout(()=>{open();setTab("trad");q.value=tq;runTrad(tq);},400);}}
  // idle warm-up: fetch+merge the index after the landing settles, so the first query never waits
  {const c=navigator.connection||{};const slow=c.saveData||/2g|3g/.test(c.effectiveType||"");
   if(!slow)(window.requestIdleCallback||function(f){setTimeout(f,4000);})(()=>{initPF().catch(()=>{});});}   // constrained connections warm the index on first palette open instead
  q.addEventListener("keydown",e=>{if(TAB==="ask"&&e.key==="Enter"){e.preventDefault();runAsk(q.value.trim());}});
  // ---- Ask the corpus (RAG over /api/ask, streamed) ----
  let ASK=[];   // conversation history
  // citation-verify: the set of exact slug|page tags the agent was actually given (built from the
  // streamed `sources` preamble). A cited [slug/pN] not in this set is flagged — the model named a
  // passage it wasn't supplied. null = unknown (e.g. replaying history without sources) → trust it.
  let _askCiteSet=null,_askUnver=0;
  let _citeLast="";   // the work under discussion — a bare [p266] belongs to it
  const _citeA=(sl,pg)=>{
    const ok=!_askCiteSet||_askCiteSet.has(sl+"|"+pg);
    if(!ok)_askUnver++;
    const cls=ok?"cite":"cite cite-x",ttl=ok?"":' title="This page was not among the passages retrieved for the answer — open it to verify."';
    return `<a href="/the-faith-received/read/?w=${sl}#b${pg}-0" target="_blank" class="${cls}"${ttl}>[${pg}]</a>`;
  };
  // A BARE [p266] IS STILL A CITATION (owner 2026-08-22: "the links for agent dont work").
  // Only [slug/pN] was linked, so once an answer settled on one work the model naturally
  // wrote [p265], [p266], [p267] — and every one of them rendered as dead text. Worse in
  // agent answers, which dwell inside a single work by design and so drop the slug most.
  // A bare page belongs to the work most recently named; brackets mixing both forms
  // ("[p264; ames-bellarminus-enervatus/p920]") resolve part by part. The grammar is strict
  // and any bracket that does not match it entirely is left untouched, so ordinary square
  // brackets in prose are never mangled.
  // (?!\() — NEVER touch a markdown link. The agent path rewrites its [Wslug:715] tokens into
  // [p. 715](/the-faith-received/read/?w=…) BEFORE this runs, and "p. 715" matches the bare-page grammar below, so
  // without this guard the label would be eaten and the URL left dangling as visible text.
  const slugCite=(s)=>String(s).replace(/\[([^\]\n]{1,120})\](?!\()/g,(m,inner)=>{
    const parts=inner.split(/\s*[;,]\s*/).filter(x=>x.length);
    if(!parts.length)return m;
    const out=[];
    for(const part of parts){
      let mm=part.match(/^([a-z0-9][a-z0-9-]{2,})\/p\.?\s*(\d+)$/i);
      if(mm){_citeLast=mm[1];out.push(_citeA(mm[1],mm[2]));continue;}
      // with or without the "p": the model writes [p266] and [262] in the same answer, and
      // both mean the same page of the same book. A bare number only links when a work is
      // already in context, so a stray "[3]" in prose with no citation before it stays text.
      mm=part.match(/^p?\.?\s*(\d+)(?:\s*[\u2013-]\s*\d+)?$/i);
      if(mm&&_citeLast){out.push(_citeA(_citeLast,mm[1]));continue;}
      return m;   // not a citation bracket after all — leave the prose alone
    }
    return out.join(" ");
  });
  const mdInline=(s)=>esc(s)
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g,'<em>$1</em>');
  // block-aware: GFM pipe tables → <table>, ### → headings, --- → rule, else paragraphs (single \n = <br>)
  const mdLite=(src)=>{
    const out=[];
    for(const raw of String(src).split(/\n{2,}/)){
      const lines=raw.split('\n').filter(l=>l.trim()!=='');
      if(!lines.length)continue;
      if(lines.length>=2 && lines[0].includes('|') && /^[\s|:\-]+$/.test(lines[1]) && lines[1].includes('-')){
        const cells=r=>r.replace(/^\s*\|/,'').replace(/\|\s*$/,'').split('|').map(c=>c.trim());
        const head=cells(lines[0]),rows=lines.slice(2).filter(l=>l.includes('|')).map(cells);
        out.push('<table class=ask-tbl><thead><tr>'+head.map(h=>'<th>'+mdInline(h)+'</th>').join('')+
          '</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+mdInline(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>');
        continue;
      }
      if(lines.length===1){const t=lines[0].trim();
        if(/^#{1,4}\s+/.test(t)){out.push('<h4 class=ask-h>'+mdInline(t.replace(/^#{1,4}\s+/,''))+'</h4>');continue;}
        if(/^-{3,}$/.test(t)){out.push('<hr class=ask-hr>');continue;}}
      let p=[];const flush=()=>{if(p.length){out.push('<p>'+p.join('<br>')+'</p>');p=[];}};
      // BLOCKQUOTES (owner 2026-08-20 'fix quote rendering'): markdown '> ' AND long inline
      // quotations — a 30-word passage in quote marks is a QUOTATION, and must be set as one,
      // not run into the prose. The citation link that follows it rides along in the cite line.
      const QRX=/([\u201c"])([^\u201d"]{110,})([\u201d"])(\s*\[[^\]]+\]\([^)]+\))?/;
      for(const l of lines){const t=l.trim();const hm=t.match(/^#{1,4}\s+(.+)$/);
        if(hm){flush();out.push('<h4 class=ask-h>'+mdInline(hm[1])+'</h4>');continue;}
        if(/^>\s?/.test(t)){flush();out.push('<blockquote class=askq>'+mdInline(t.replace(/^>\s?/,''))+'</blockquote>');continue;}
        const qm=t.match(QRX);
        if(qm&&!/^[-*\u2022]\s/.test(t)){
          const before=t.slice(0,qm.index).trim(), after=t.slice(qm.index+qm[0].length).trim();
          if(before)p.push(mdInline(before));
          flush();
          out.push('<blockquote class=askq>'+mdInline(qm[2].trim())+
            (qm[4]?'<cite>'+mdInline(qm[4].trim())+'</cite>':'')+'</blockquote>');
          if(after)p.push(mdInline(after));
          continue;
        }
        p.push(mdInline(t));}
      flush();
    }
    return slugCite(out.join(''));
  };
  // ---- saved Ask history (localStorage) ----
  const HKEY="fr_ask_history";
  function askHistory(){try{return JSON.parse(localStorage.getItem(HKEY)||"[]");}catch(e){return [];}}
  // THE NOTEBOOK (2026-07-27). Every answer lands here automatically — there is no "save" step and
  // no pre-ask clip checkbox to get wrong. `sc` records the scopes the answer was produced under
  // (tradition / Fathers corpora / hand-picked works) so a saved entry can be re-opened honestly.
  function saveAsk(qn,ans,src,sc){try{const h=askHistory().filter(x=>x.q!==qn||JSON.stringify(x.sc||null)!==JSON.stringify(sc||null));
    h.unshift({q:qn,a:ans,s:src||[],sc:sc||null,ts:Date.now()});localStorage.setItem(HKEY,JSON.stringify(h.slice(0,40)));if(window._frSyncAsk)window._frSyncAsk();}catch(e){}}
  function delAsk(i){try{const h=askHistory();h.splice(i,1);localStorage.setItem(HKEY,JSON.stringify(h));if(window._frSyncAsk)window._frSyncAsk();}catch(e){}}
  const scopeLabel=sc=>{if(!sc)return "";const b=[];
    if(sc.tradition)b.push(sc.tradition);
    if(sc.fathers&&sc.fathers.length)b.push(sc.fathers.map(c=>({pl:"Latin",pg:"Greek",po:"Oriental"})[c]||c).join("/")+" Fathers");
    if(sc.works)b.push(sc.works+" work"+(sc.works>1?"s":""));
    if(sc.deep)b.push("Deep");
    if(sc.agent)b.push("🜁 Agent");
    return b.join(" · ");};
  const agoLabel=ts=>{const d=Math.max(0,Date.now()-(+ts||0)),m=Math.round(d/6e4);
    if(m<1)return "just now";if(m<60)return m+" min ago";const h2=Math.round(m/60);
    if(h2<24)return h2+" hr ago";return Math.round(h2/24)+" d ago";};
  // The Notebook VIEW: a plain list of saved Q&As, each openable / re-askable / deletable. The
  // "ground answers in my research project" switch (the old ▤ my notebook retrieval toggle) lives
  // in here now, where it reads as a setting rather than as a confusing pre-ask clip.
  function openNotebook(){
    const panel=so.querySelector(".csp");if(!panel)return;
    const old=so.querySelector(".nb-panel");if(old)old.remove();
    const h=askHistory();
    const p=el("div","nb-panel");
    p.innerHTML='<div class=nb-head><b>Notebook</b><span class=nb-n>'+(h.length?h.length+" saved answer"+(h.length>1?"s":""):"empty")+'</span><button class=nb-x type=button>Close</button></div>'+
      '<div class=nb-body><label class=nb-ground><input type=checkbox id=nbGround'+(window.__askNB?" checked":"")+'> Ground new answers in my active research project (its passages, notes and memo)</label>'+
      (h.length?h.map((x,i)=>{const sl=scopeLabel(x.sc);
        return '<div class=nb-item data-i="'+i+'"><div class=nb-q>'+esc(x.q)+'</div>'+
          '<div class=nb-a>'+esc(String(x.a||"").replace(/\s+/g," ").slice(0,240))+(String(x.a||"").length>240?"…":"")+'</div>'+
          '<div class=nb-when>'+esc(agoLabel(x.ts))+(sl?" · "+esc(sl):"")+((x.s&&x.s.length)?" · "+x.s.length+" source"+(x.s.length>1?"s":""):"")+'</div>'+
          '<div class=nb-act><button class=nb-open type=button>Open</button><button class=nb-again type=button>Ask again</button><button class=nb-del type=button>Delete</button></div></div>';}).join("")
        :'<div class=csn>Nothing here yet. Every answer you get is saved to your notebook automatically — ask something and it will appear.</div>')+
      '</div>';
    panel.appendChild(p);
    const shut=()=>p.remove();
    p.querySelector(".nb-x").onclick=shut;
    {const g=p.querySelector("#nbGround");if(g)g.onchange=()=>{window.__askNB=g.checked;syncNbChip();};}
    p.querySelectorAll(".nb-item").forEach(it=>{
      const i=+it.dataset.i;
      const rec=()=>askHistory()[i];
      const ob=it.querySelector(".nb-open");if(ob)ob.onclick=()=>{const x=rec();if(!x)return;shut();replayAsk(x);};
      const ab=it.querySelector(".nb-again");if(ab)ab.onclick=()=>{const x=rec();if(!x)return;shut();ASK=[];askThread=null;buildAskShell();runAsk(x.q);};
      const db=it.querySelector(".nb-del");if(db)db.onclick=()=>{delAsk(i);openNotebook();};});
  }
  window.__frOpenNotebook=openNotebook;
  const syncNbChip=()=>{const b=document.getElementById("askNbBtn");if(b)b.classList.toggle("on",!!window.__askNB);};
  let askThread=null;   // the live conversation thread element (multi-turn chat)
  const scrollAskBottom=()=>{try{body.scrollTop=body.scrollHeight;}catch(e){}};
  const nearAskBottom=()=>{try{return body.scrollHeight-body.scrollTop-body.clientHeight<130;}catch(e){return true;}};
  const scrollTurnTop=(t)=>{try{body.scrollTop+=t.getBoundingClientRect().top-body.getBoundingClientRect().top-8;}catch(e){}};
  // Build the chat shell once: a scrolling thread + a composer pinned at the bottom (text-message style).
  function buildAskShell(){
    body.innerHTML="";
    askThread=el("div","ask-thread");askThread.id="askThread";body.appendChild(askThread);
    const comp=el("div","ask-composer");
    // DOM order is the DESKTOP order (unchanged apart from the notebook button, which is now a
    // view-opener rather than a retrieval toggle). The mobile stack — chips row / question box /
    // one control row — is pure CSS `order` inside the ≤700px query, so nothing here is layout.
    // ASK SCOPE, ORGANIZED (owner 2026-08-17 'organize the ask for… traditions —
    // everything should be in the site'): one chips row of the library's own shelves.
    // A Fathers shelf retrieves from its corpus namespace; an early-modern shelf
    // post-filters the library; Everything is the ambient default.
    // TRADITION PILLS REMOVED (owner 2026-08-31 "take the traditions pills out of ask") —
    // the composer reads clean like a chat box; parties + schools remain as registry scopes,
    // and shelf confinement still rides ?sh= deep links and the choose-works picker.
    // ONE CHAT BOX (owner 2026-09-05 "an actual chat interface … the whole ask filtering
    // redone from the bottom up"): scope chips above; a bordered box holding the textarea,
    // a round ↑ send, and a muted tools line. The quick scopes (parties + schools, owner
    // 2026-08-22 "combine school and shelf…") now live INSIDE the ⌖ Scope sheet with the
    // works typeahead — one place answers "which part of the library?", and the sheet's
    // first line says the default out loud: leave empty, the AI scopes from the question.
    comp.innerHTML='<div class=ask-scoperow id=askScopeRow style=display:none></div>'+
      '<div class=ask-box>'+
      '<textarea id=askInput rows=1 placeholder="Ask anything" aria-label="Ask a question"></textarea>'+
      '<button id=askSend class=ask-send disabled aria-label="Ask">↑</button>'+
      '<div class=ask-tools>'+
        '<span class=wsc id=askWsc><button class=wsc-add id=wscAdd title="Narrow to an author, work, or school. Optional.">⌖ Scope</button>'+
        '<span class=wsc-pop id=wscPop>'+
          '<div class=wsc-note>Optional — narrow where to search. By default the whole library is searched.</div>'+
          '<input id=wscQ placeholder="An author or a work… (Gerhard, Acts of Trent, Baxter…)" autocomplete=off>'+
          '<div class=wsc-list id=wscList></div>'+
          '<div class=wsc-quick>'+
          /* COLLAPSIBLE SHELF FILTER (owner 2026-09-06 "something collapsible for the
             shelves … English Divines break them out as they are already"): one Shelves
             group; the divines expand into their real sub-bodies. Mutually exclusive with
             Schools — every chip answers "which part of the library?" */
          '<details class=wsc-grp open><summary>Shelves</summary><span class=fcchips>'+
            ['Latin Fathers','Greek Fathers','Eastern Fathers','Medieval','Roman Catholic','Reformed','Lutheran','Humanism and Law'].map(function(t){return '<button class="lchip trx" data-tr="'+t+'">'+t+'</button>';}).join('')+
          '</span>'+
          '<div class=wsc-sub><span class=wsc-sublb>English Divines</span><span class=fcchips id=fcChips>'+
            '<button class="lchip trx" data-tr="English Divines">All divines</button>'+
            ['Puritan','Anglican'].map(function(p){return '<button class="lchip pyx" data-py="'+p+'">'+p+'s</button>';}).join('')+
            '<button class="lchip scx" data-sc="Westminster Assembly">Westminster Assembly</button>'+
          '</span></div></details>'+
          '<details class=wsc-grp><summary>Schools</summary><span class=fcchips>'+
            ['Jesuits','Dominicans','Franciscans'].map(function(s){return '<button class="lchip scx" data-sc="'+s+'">'+s+'</button>';}).join('')+
          '</span></details>'+
          '</div>'+
        '</span></span>'+
        '<label class=atool-t title="Slower, more thorough: a second retrieval pass fills gaps"><input type=checkbox id=askDeep>Deep</label>'+
        '<label class=atool-t title="The AI searches, reads pages, and iterates before answering"><input type=checkbox id=askAgent>Agent</label>'+
        '<span class=atool-sp></span>'+
        '<button id=askNbBtn class="atool nbx" type=button title="Notebook — answers are saved here">▤ Notebook</button>'+
        '<button id=askNew2 class=atool title="Start a new conversation" aria-label="New conversation">＋ New</button>'+
      '</div>'+
      '</div>'+
      '<span class=wsc-sug id=wscSug></span>';
    {const nb=comp.querySelector("#askNbBtn");if(nb){nb.classList.toggle("on",!!window.__askNB);nb.onclick=openNotebook;}}
    window.__askShelf="";window.__askFC=window.__askFC||[];window.__askTradSel="";
    // SCHOOL scope (owner 2026-08-20 'where is sorting by school'): a school chip confines
    // the ask to the school registry's works (Westminster Assembly, the orders…)
    comp.querySelectorAll(".trx").forEach(c=>{
      c.onclick=()=>{const v=c.dataset.tr||"";
        window.__askTradSel=(window.__askTradSel===v)?"":v;
        window.__askSchool="";window.__askParty="";window.__askShelf="";window.__askFC=[];
        comp.querySelectorAll(".trx").forEach(x=>x.classList.toggle("on",(x.dataset.tr||"")===(window.__askTradSel||"")));
        comp.querySelectorAll(".scx,.pyx").forEach(x=>x.classList.remove("on"));
        if(typeof paintScope==="function")paintScope();};});
    comp.querySelectorAll(".scx").forEach(c=>{
      c.onclick=()=>{const v=c.dataset.sc||"";
        window.__askSchool=(window.__askSchool===v)?"":v;
        window.__askShelf="";window.__askFC=[];window.__askTradSel="";   // mutually exclusive with Shelf
        comp.querySelectorAll(".trx").forEach(x=>x.classList.remove("on"));
        comp.querySelectorAll(".scx").forEach(x=>x.classList.toggle("on",(x.dataset.sc||"")===(window.__askSchool||"")));
        comp.querySelectorAll(".pyx").forEach(x=>x.classList.remove("on"));window.__askParty="";
        if(typeof paintScope==="function")paintScope();};});
    // PARTY scope: Puritan / Anglican. The division is already carried on every work as
    // `party`, so this needs no registry — the slug set is computed from the library itself,
    // exactly as the tradition facet is. Mutually exclusive with shelf and school, like they
    // are with each other: all three answer "which part of the library?".
    comp.querySelectorAll(".pyx").forEach(c=>{
      c.onclick=()=>{const v=c.dataset.py||"";
        window.__askParty=(window.__askParty===v)?"":v;
        window.__askSchool="";window.__askShelf="";window.__askFC=[];window.__askTradSel="";
        comp.querySelectorAll(".scx").forEach(x=>x.classList.remove("on"));
        comp.querySelectorAll(".trx").forEach(x=>x.classList.remove("on"));
        comp.querySelectorAll(".pyx").forEach(x=>x.classList.toggle("on",(x.dataset.py||"")===(window.__askParty||"")));
        if(typeof paintScope==="function")paintScope();};});
    body.appendChild(comp);
    const inp=comp.querySelector("#askInput");
    const sendBtn=comp.querySelector("#askSend");
    // one short placeholder at every width (a viewport-dependent one goes stale on rotate/resize);
    // the keyboard hint lives in the tooltip, where it can't crowd a 390px-wide box.
    inp.title="Enter to send, Shift+Enter for a new line";
    const fit=()=>{inp.style.height="auto";inp.style.height=Math.min(inp.scrollHeight,SMALL()?260:150)+"px";sendBtn.disabled=inp.value.trim().length<3;};
    inp.addEventListener("input",()=>{fit();wscSuggest(inp.value);});
    const send=()=>{const v=inp.value.trim();if(v.length>2){inp.value="";fit();try{inp.blur();}catch(e){}runAsk(v);}};
    sendBtn.onclick=send;
    // Enter sends on desktop only — on a phone the return key must make a new line, or a
    // two-sentence question is impossible to type.
    inp.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!SMALL()){e.preventDefault();send();}});
    setTimeout(fit,0);
    // ── works-scope picker: hand-pick works; Ask retrieves ONLY from them ──
    window.__askScope=window.__askScope||[];   // [{slug,label}]
    const wsc=comp.querySelector("#askWsc"),pop=comp.querySelector("#wscPop"),wq=comp.querySelector("#wscQ"),wl=comp.querySelector("#wscList");
    // EVERY active scope paints as one QUIET chip row above the box (owner 2026-09-05
    // "quiet when selected") — works, school, and party alike, each with its own ×.
    const paintScope=()=>{
      const row=comp.querySelector("#askScopeRow");if(!row)return;
      row.innerHTML="";
      const chip=(label,clear)=>{const c=document.createElement("span");c.className="wsc-chip";
        c.innerHTML=`<b>${esc(label)}</b><button aria-label="Remove">×</button>`;
        c.querySelector("button").onclick=clear;row.appendChild(c);};
      if(window.__askTradSel)chip(window.__askTradSel,()=>{window.__askTradSel="";comp.querySelectorAll(".trx").forEach(x=>x.classList.remove("on"));paintScope();});
      if(window.__askSchool)chip(window.__askSchool,()=>{window.__askSchool="";comp.querySelectorAll(".scx").forEach(x=>x.classList.remove("on"));paintScope();});
      if(window.__askParty)chip(window.__askParty+"s",()=>{window.__askParty="";comp.querySelectorAll(".pyx").forEach(x=>x.classList.remove("on"));paintScope();});
      (window.__askScope||[]).forEach((w,i)=>chip(w.label,()=>{window.__askScope.splice(i,1);paintScope();}));
      row.style.display=row.children.length?"":"none";
      const sb=comp.querySelector("#wscAdd");if(sb)sb.classList.toggle("on",!!row.children.length);};
    const addScope=(slug,label)=>{if(!(window.__askScope||[]).some(x=>x.slug===slug)){window.__askScope.push({slug,label});paintScope();}};
    window.__askAddScope=addScope;
    const foldW=t=>String(t).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    const wscPaint=q2=>{
      pWorks.then(d=>{const ws=(d.works||d);const f=foldW(q2.trim());
        const rows=!f?[]:ws.filter(w=>foldW(w.title||"").includes(f)||foldW(w.author||"").includes(f)||foldW((typeof TITLES!=="undefined"&&TITLES[w.slug])||"").includes(f)).slice(0,40);
        wl.innerHTML=rows.map(w=>`<button data-s="${esc(w.slug)}" data-l="${esc(((typeof TITLES!=="undefined"&&TITLES[w.slug])||w.title||w.slug).slice(0,60))}${w.volume?" · "+esc(w.volume):""}">${esc((typeof TITLES!=="undefined"&&TITLES[w.slug])||w.title||w.slug)}${w.volume?" · "+esc(w.volume):""}<small>${esc(w.author||"")}</small></button>`).join("")||(f?'<div style="padding:.5rem;color:var(--muted);font:italic .8rem/1.4 var(--font-body)">No matching works.</div>':"");
        wl.querySelectorAll("button").forEach(b=>b.onclick=()=>{addScope(b.dataset.s,b.dataset.l);wq.value="";wl.innerHTML="";wq.focus();});});};
    comp.querySelector("#wscAdd").onclick=e=>{e.stopPropagation();pop.classList.toggle("on");if(pop.classList.contains("on")){wq.focus();wscPaint("");}};
    wq.addEventListener("input",()=>wscPaint(wq.value));
    document.addEventListener("click",e=>{if(!pop.contains(e.target)&&e.target!==comp.querySelector("#wscAdd"))pop.classList.remove("on");});
    // auto-suggest: the question names a work family or author → one-click scope
    const sug=comp.querySelector("#wscSug");
    let _sugT=null;
    window.wscSuggest=qs=>{clearTimeout(_sugT);_sugT=setTimeout(()=>{
      const f=foldW(qs);
      if(f.length<6){sug.innerHTML="";return;}
      // the reader has ALREADY scoped (works picked or an author filter set) — the question's
      // SUBJECT is not the corpus ("Bucer's view … in Melanchthon" searches Melanchthon, never
      // Bucer; owner complaint 2026-08-20). Explicit scope always wins; suggest nothing.
      try{const _af=askFilters()||{};
        if(window.__askSchool||(window.__askScope&&window.__askScope.length)||_af.author||( _af.authors&&_af.authors.length)||(_af.allowSlugs&&_af.allowSlugs.length)){sug.innerHTML="";return;}
      }catch(e){}
      pWorks.then(d=>{const ws=(d.works||d);
        const fams={};
        ws.forEach(w=>{const t=foldW(w.title||"");const a=foldW(w.author||"");
          let hit=null;
          if(t.length>7&&f.includes(t.slice(0,Math.min(18,t.length))))hit=w.title;
          // possessive = subject-of-discussion, not corpus ("bucers view of…") — never suggest it
          else if(a&&!/various|uncertain|anonymous|unknown|divers/.test(a)&&a.split(" ").some(x=>x.length>4&&!/^(authors?|works?|opera|omnia|sancti|saint|bishop|church)$/.test(x)&&f.includes(x)&&!new RegExp("\\b"+x+"s\\b").test(f)))hit=w.author;
          else if(/\bacts?\b/.test(f)&&/\btrent\b/.test(f)&&t.includes("acta concilii tridentini"))hit=w.title;
          if(hit){const kf=hit;(fams[kf]=fams[kf]||[]).push(w);}});
        const ks=Object.keys(fams).slice(0,2);
        sug.innerHTML=ks.length?("Search only: "+ks.map(k2=>`<button data-k="${esc(k2)}">${esc(k2)} (${fams[k2].length})</button>`).join(" ")):"";
        sug.querySelectorAll("button").forEach(b=>b.onclick=()=>{
          (fams[b.dataset.k]||[]).forEach(w=>addScope(w.slug,((typeof TITLES!=="undefined"&&TITLES[w.slug])||w.title||w.slug).slice(0,50)+(w.volume?" · "+w.volume:"")));
          sug.innerHTML="";});});
    },350);};
    paintScope();
    comp.querySelector("#askNew2").onclick=()=>{ASK=[];askIntro();};
    if(!SMALL())setTimeout(()=>{try{inp.focus();}catch(e){}},40);   // phone: don't raise the keyboard over the sheet
    return askThread;
  }
  function ensureThread(){ return (askThread&&body.contains(askThread))?askThread:buildAskShell(); }
  // Empty state = the composer LIFTED into the intro as a hero (the first thing seen and focused);
  // the moment a conversation starts, dockComposer() returns it to its sticky spot at the foot.
  function dockComposer(){
    const ib=body.querySelector(".ask-introblock");
    const comp=body.querySelector(".ask-composer");
    if(comp&&ib&&ib.contains(comp))body.appendChild(comp);
    if(ib)ib.remove();
  }
  function askIntro(){
    ASK=[];askThread=null;                       // entering the Ask tab opens a fresh conversation
    const t=buildAskShell();
    const h=askHistory();
    const intro=el("div","ask-introblock ask-hero");
    intro.innerHTML='<div class=csn>Answers come from the library\u2019s own pages, with citations.</div>'+
      '<div class=ask-herohost></div>'+
      (h.length?'<details class=ask-histwrap><summary>Saved conversations <span class=ask-histn>'+(h.length>10?"10+":h.length)+'</span></summary><div class=ask-hist>'+h.slice(0,10).map((x,i)=>`<button class=ask-histitem data-i="${i}">${esc(x.q)}</button>`).join("")+'</div></details>':"");
    t.appendChild(intro);
    const comp=body.querySelector(".ask-composer");
    if(comp)intro.querySelector(".ask-herohost").appendChild(comp);   // hero position; dockComposer() returns it to the foot
    intro.querySelectorAll(".ask-histitem").forEach(b=>b.onclick=()=>{const x=askHistory()[+b.dataset.i];if(x)replayAsk(x);});
  }
  // Re-open a saved notebook answer into the live thread, seeded so follow-ups continue from it.
  function replayAsk(x){
    const t=ensureThread();
    ASK=[{role:"user",content:x.q},{role:"assistant",content:x.a}];
    dockComposer();
    const turn=el("div","ask-turn");turn.innerHTML=`<div class=ask-q>${esc(x.q)}</div><div class="ask-a"></div>`;
    turn.dataset.q=x.q;t.appendChild(turn);
    _askCiteSet=(x.s&&x.s.length)?new Set(x.s.map(s=>String(s.slug)+"|"+String(s.page))):null;   // re-arm verify from saved sources
    renderAsk(turn.querySelector(".ask-a"),x.a,x.s||[],null,(x.sc&&x.sc.tradition)||"");
    scrollTurnTop(turn);
  }
  // opts (all optional):
  //   tradition  re-ask the SAME question confined to one tradition's works (the re-ask chips)
  //   fathers    ['pl','pg','po'] — patristic re-ask
  //   prev       {q,a} of the exchange being followed up (sent to /api/ask as `prev`)
  //   fresh      start a new thread rather than appending to the running conversation
  // ── AGENTIC SEARCH (R33 family port 2026-08-03): a tool-calling agent searches, reads the
  // actual pages, iterates ≤14 calls, and answers citing ONLY what it read. NDJSON from
  // /api/agent: {t:'step'} progress rows · {t:'report',md,sources} · {t:'error'}. Any failure
  // falls back to the classic ask so the toggle can never strand a question.
  async function runAgent(question,opts){
    opts=opts||{};
    const thread=ensureThread();
    dockComposer();
    if(opts.fresh)ASK=[];
    ASK.push({role:"user",content:question});
    let scope=(window.__askScope||[]).map(x=>x.slug).slice(0,60);
    // school scope rides into agent mode too (owner 2026-08-20: 'agent is searching for
    // people not in the subset') — the registry's slugs ARE the corpus for this ask
    if(window.__askSchool&&window.__SCHOOLS&&window.__SCHOOLS[window.__askSchool])
      scope=[...new Set([...scope,...(window.__SCHOOLS[window.__askSchool].slugs||[])])].slice(0,600);
    if(window.__askParty&&typeof WORKS!=="undefined"&&WORKS.length)
      scope=[...new Set([...scope,...WORKS.filter(w=>(w.party||"")===window.__askParty).map(w=>w.slug)])].slice(0,600);
    // author filter → the agent searches EVERYTHING the author wrote (owner 2026-08-20);
    // names expand server-side so a prolific author is never truncated by the works cap
    const agAuthors=(typeof PICK!=="undefined"&&PICK.auth&&PICK.auth.size)?[...PICK.auth]:[];
    const turn=el("div","ask-turn");
    turn.innerHTML=`<div class=ask-q>${esc(question)} <span class=ask-fc>🜁 agent</span>${scope.length?' <span class=ask-fc>⧉ '+esc(window.__askScope.length===1?window.__askScope[0].label:window.__askScope.length+" works")+'</span>':""}</div><div class="ask-a"></div>`;
    turn.dataset.q=question;
    thread.appendChild(turn);const aEl=turn.querySelector(".ask-a");
    aEl.innerHTML='<div class=ask-loading><div class=ask-phase><i class=pd></i><span>reading the corpus \u2014 searching, then reading the pages<span class=dots></span></span></div><div class=sk-l></div><div class="sk-l w2"></div><div class="sk-l w3"></div></div><div class=ask-asteps></div>';
    const steps=aEl.querySelector(".ask-asteps");
    scrollTurnTop(turn);
    try{
      const r=await fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/agent",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({question,works:scope,authors:agAuthors,messages:ASK.slice(-7,-1)})});
      if(!r.ok||!r.body)throw new Error("agent "+r.status);
      const rd=r.body.getReader(),dec=new TextDecoder();
      let buf="",rep=null;
      for(;;){
        const {done,value}=await rd.read();
        buf+=dec.decode(value||new Uint8Array(),{stream:!done});
        let nl;
        while((nl=buf.indexOf("\n"))>=0){
          const line=buf.slice(0,nl).trim();buf=buf.slice(nl+1);
          if(!line)continue;
          let f=null;try{f=JSON.parse(line);}catch(e){continue;}
          if(f.t==="step"&&steps){const d=document.createElement("div");d.className="ask-astep";d.textContent=String(f.title||"").replace(/[{}\"]/g," ");steps.appendChild(d);if(nearAskBottom())scrollAskBottom();}
          else if(f.t==="report")rep=f;
          else if(f.t==="error")throw new Error(f.msg||"agent error");
        }
        if(done)break;
      }
      if(!rep||!rep.md)throw new Error("no report");
      const byKey={};(rep.sources||[]).forEach(s=>{byKey[s.slug+":"+s.page]=s;});
      // [Wslug:715] AND range forms [Wslug:715–722] (owner 2026-08-20 'formatting is bad'):
      // every W-token becomes a pretty page link — never raw plumbing in the answer
      const md0=String(rep.md).replace(/\[W\s*([^:\]\s]+):((?:\d+\s*,\s*)+\d+)\]/g,(m0,s2,ps)=>
        ps.split(/\s*,\s*/).map(pn=>{const so=byKey[s2+":"+pn];
          return `[${(so&&so.cite)||("p. "+pn)}](${(so&&so.link)?("/"+so.link):("/the-faith-received/read/?w="+encodeURIComponent(s2)+"#b"+pn+"-0")})`;}).join(", "));
      const md=md0.replace(/\[W\s*([^:\]\s]+):\s*(\d+)(?:\s*[–\-]\s*(\d+))?\]/g,(m0,s2,p,p2)=>{
        const so=byKey[s2+":"+p];
        const label=(so&&so.cite)||("p. "+p+(p2?"–"+p2:""));
        const href=(so&&so.link)?("/"+so.link):("/the-faith-received/read/?w="+encodeURIComponent(s2)+"#b"+p+"-0");
        return `[${label}](${href})`;});
      const md2=md.replace(/\[W\s*[^\]]*\]/g,(m0)=>{   // non-numeric leftovers ("[Wslug: grep result]")
        const s3=m0.replace(/^\[W\s*/,"").replace(/\]$/,"").split(":")[0];
        return s3?("("+((TITLES&&TITLES[s3])||s3).slice(0,60)+")"):"";});
      const srcs=(rep.sources||[]).map(s=>({slug:s.slug,page:s.page,t:s.title,cite:s.cite}));
      _askCiteSet=null;   // agent citations are read-verified server-side; the ask verifier doesn't apply
      {const cnt={};(rep.sources||[]).forEach(s2=>{const k=String(s2.slug||"");if(k)cnt[k]=(cnt[k]||0)+1;});
       _citeLast=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0]||"";}   // same seed for agent replies
      aEl._ans=md2;
      renderAsk(aEl,md2,srcs,null,"");
      ASK.push({role:"assistant",content:md2});
      try{saveAsk(question,md2,srcs,{agent:true,works:scope.length});}catch(e){}
    }catch(e){
      ASK.pop();
      try{turn.remove();}catch(e2){}
      setTimeout(()=>runAsk(question,Object.assign({},opts,{noAgent:true})),300);
    }
  }
  async function runAsk(question,opts){
    if(window.__FR_ASK_WORKSPACE__&&!window.FRAsk){window.__FR_ASK_PENDING__={q:question,autoSend:true,tradition:opts&&opts.tradition};return;}
    if(window.FRAsk){close();return window.FRAsk.open({q:question,autoSend:true,tradition:opts&&opts.tradition});}
    if(!question||question.length<3)return;
    opts=opts||{};
    // a hero-fired ask leaves its carried copy sitting in the composer (owner 2026-09-06
    // screenshot: question in the box after the bubble was already sent) — clear the echo
    {const ai=document.getElementById("askInput");
     if(ai&&ai.value.trim()===String(question).trim()){ai.value="";try{ai.style.height="auto";}catch(e){}}}
    if(!opts.noAgent&&document.getElementById("askAgent")&&document.getElementById("askAgent").checked)return runAgent(question,opts);
    const thread=ensureThread();
    dockComposer();   // first message clears the intro and re-docks the composer to the foot
    if(opts.fresh)ASK=[];
    ASK.push({role:"user",content:question});
    const _fc=opts.fathers||window.__askFC||[];
    const deepOn=!!(document.getElementById("askDeep")&&document.getElementById("askDeep").checked);
    const turn=el("div","ask-turn");turn.innerHTML=`<div class=ask-q>${esc(question)}${opts.tradition?' <span class=ask-fc>◈ '+esc(opts.tradition)+'</span>':""}${(_fc&&_fc.length)?' <span class=ask-fc>+'+_fc.map(c=>({pl:"Latin",pg:"Greek",po:"Oriental"})[c]).join("/")+" Fathers</span>":""}${window.__askNB?' <span class=ask-fc>▤ notebook</span>':""}${deepOn?' <span class=ask-fc>⌖ deep</span>':""}${(window.__askScope&&window.__askScope.length)?' <span class=ask-fc>⧉ '+esc(window.__askScope.length===1?window.__askScope[0].label:window.__askScope.length+" works")+'</span>':""}</div><div class="ask-a"></div>`;
    turn.dataset.q=question;
    thread.appendChild(turn);const aEl=turn.querySelector(".ask-a");
    // _ans is undefined until the first renderAsk — so progress text can never overwrite a
    // rendered answer (and can't reference srcShown, which is still in its TDZ on the first call).
    const PHASE={route:"understanding the question",search:"searching the corpus",rank:"weighing the passages",write:"reading the passages and writing — a long answer can take a minute"};
    const prog=m=>{if(aEl._ans!==undefined)return;
      const label=PHASE[m]||m;
      aEl.innerHTML='<div class=ask-loading><div class=ask-phase><i class=pd></i><span>'+esc(label)+'<span class=dots></span></span></div><div class=sk-l></div><div class="sk-l w2"></div><div class="sk-l w3"></div></div>';};
    prog(deepOn?"starting a deep search of the corpus…":"consulting the corpus…");
    scrollTurnTop(turn);   // bring the question to the top so the answer streams into view (was: snap to bottom)
    const _scEntry={tradition:opts.tradition||"",fathers:(_fc||[]).slice(),works:(window.__askScope||[]).length,deep:deepOn};
    let answer="",srcShown=false,head="",src=[],gr=null,ctl=null,idleT=null;
    // ── STREAM FRAME STRIPPER ────────────────────────────────────────────────────────────────
    // The api interleaves control frames with the answer bytes. They MUST never reach the reader:
    // the owner saw `{"t":"k"}` printed above an answer and spliced mid-word ("but in{"t":"k"}"),
    // because the old parser only filtered frames BEFORE the sources preamble and appended every
    // later chunk verbatim. This strips them anywhere in the stream, and — crucially — is
    // line-buffered, so a frame split across two network chunks is still recognised.
    //   • a frame is a WHOLE line matching {"t":"k"|"p"…}, only honoured at a line start;
    //   • a trailing partial line is emitted immediately (token-by-token streaming is preserved)
    //     UNLESS it sits at a line start and could still grow into a frame — then it is held back
    //     until the newline arrives and we can judge the whole line.
    const FRAME=/^\{"t":"[kp]"[^\n]*\}$/, FPFX='{"t":"';
    const couldBeFrame=s2=>(s2.length<FPFX.length)?FPFX.indexOf(s2)===0:s2.indexOf(FPFX)===0;
    let fbuf="",atLine=true;
    const strip=(chunk,last)=>{
      fbuf+=chunk;let out="";
      for(;;){
        const nl=fbuf.indexOf("\n");if(nl<0)break;
        const line=fbuf.slice(0,nl);fbuf=fbuf.slice(nl+1);
        if(atLine&&FRAME.test(line)){                       // swallow it; we are still at a line start
          let pj=null;try{pj=JSON.parse(line);}catch(e){}
          if(pj&&pj.t==="p"&&pj.m)prog(pj.m);
          continue;}
        out+=line+"\n";atLine=true;
      }
      if(fbuf){
        if(last){if(!(atLine&&FRAME.test(fbuf)))out+=fbuf;fbuf="";}
        else if(!(atLine&&couldBeFrame(fbuf))){out+=fbuf;fbuf="";atLine=false;}
      }
      return out;
    };
    // repaint is throttled: a long Opus answer arrives as hundreds of chunks and renderAsk rebuilds
    // the whole block each time — unthrottled that is O(n²) markdown work on a phone.
    let lastPaint=0,paintT=null;
    const paint=(st,force)=>{
      const doIt=()=>{paintT=null;lastPaint=Date.now();renderAsk(aEl,answer,[],gr,opts.tradition||"");if(st)scrollAskBottom();};
      if(force){if(paintT){clearTimeout(paintT);paintT=null;}doIt();return;}
      const dt=Date.now()-lastPaint;
      if(dt>=90)doIt();else if(!paintT)paintT=setTimeout(doIt,90-dt);
    };
    const feed=clean=>{
      if(!clean)return;
      const st=nearAskBottom();   // follow the stream only if the reader is already at the bottom
      if(!srcShown){
        head+=clean;
        const nl=head.indexOf("\n");if(nl<0)return;
        let pj=null;try{pj=JSON.parse(head.slice(0,nl));}catch(e){}
        src=(pj&&pj.sources)||[];gr=(pj&&pj.graph)||null;
        // a natural-language author scope ("scope to Turretin, Voetius…") rides the preamble;
        // fold it into gr so renderAsk can show the reader that it actually took effect
        if(pj&&pj.authorScope)gr=Object.assign({},gr||{},{authorScope:pj.authorScope});
        // PROVENANCE (owner 2026-09-06 "was it from chatgpt"): the preamble says which model
        // wrote the answer — surface it as a quiet line under the turn
        if(pj&&pj.llm==='byo'){try{const tn=aEl.closest('.ask-turn');
          if(tn&&!tn.querySelector('.ask-llm'))tn.insertAdjacentHTML('beforeend','<div class=ask-llm>✦ answered by your ChatGPT</div>');}catch(e){}}
        _askCiteSet=new Set(src.map(s2=>String(s2.slug)+"|"+String(s2.page)));   // arm citation-verify
        // SEED THE CITATION CONTEXT with the work the answer rests on, and RESET it per answer.
        // A bare [p266] resolves to the last work NAMED in the prose — but an agent answer that
        // lives inside one work often never names it, citing bare pages from the first line. The
        // most-cited source is that work. Resetting per answer stops one reply's context leaking
        // into the next, which would point a bare page at the wrong book entirely.
        {const cnt={};src.forEach(s2=>{const k=String(s2.slug||"");if(k)cnt[k]=(cnt[k]||0)+1;});
         _citeLast=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0]||"";}
        answer=head.slice(nl+1);head="";srcShown=true;
        // FIRST ANSWER BYTE → the no-byte watchdog has done its job (it exists only to catch a dead
        // pre-generation socket). Leaving it armed could abort a long, legitimately slow generation.
        if(idleT){clearInterval(idleT);idleT=null;}
        paint(st);
      }else{answer+=clean;paint(st);}
    };
    try{
      const _f=askFilters()||{};
      if(window.__askSchool&&window.__SCHOOLS&&window.__SCHOOLS[window.__askSchool]){
        const sch=window.__SCHOOLS[window.__askSchool];
        const sl=(sch.slugs||[]);
        if(sl.length)_f.allowSlugs=[...new Set([...(_f.allowSlugs||[]),...sl])];
        _f.scopeLabel=window.__askSchool;_f.scopeAuthors=(sch.authors||[]).slice(0,40);
      }
      // PARTY scope needs no registry — `party` is on the work itself, so the slug set comes
      // straight from the library. 3,065 Puritan works and 1,540 Anglican, already divided.
      if(window.__askParty&&typeof WORKS!=="undefined"&&WORKS.length){
        const sl=WORKS.filter(w=>(w.party||"")===window.__askParty).map(w=>w.slug);
        if(sl.length){_f.allowSlugs=[...new Set([...(_f.allowSlugs||[]),...sl])];
          _f.scopeLabel=window.__askParty+"s";}
      }
      if(window.__askBand){_f.band=window.__askBand.ord;}
      if(opts.tradition)_f.tradition=opts.tradition;                       // native post-filter in ask.mjs
      if(!opts.tradition&&window.__askTradSel)_f.tradition=window.__askTradSel;   // the Shelf chip
      if(opts.fathers&&opts.fathers.length){_f.fathersCorpora=opts.fathers.slice();_f.fathers=true;}
      const _scope=(window.__askScope&&window.__askScope.length)?{scope:{tfr:window.__askScope.map(x=>x.slug)}}:{};
      const _payload=Object.assign({messages:ASK,filters:_f,progress:true},_scope,
        deepOn?{deep:true}:{},
        (opts.prev&&(opts.prev.q||opts.prev.a))?{prev:{q:String(opts.prev.q||"").slice(0,1200),a:String(opts.prev.a||"").slice(0,6000)}}:{});
      // progress:true on EVERY ask (not just Deep): retrieval can idle the socket for a minute on
      // any question now that synthesis is Opus, and mobile Safari drops an idle fetch. The api
      // keeps the connection fed and tells us what it is doing.
      ctl=(typeof AbortController!=="undefined")?new AbortController():null;
      let lastByte=Date.now();
      if(ctl)idleT=setInterval(()=>{if(Date.now()-lastByte>90000){try{ctl.abort();}catch(e){}}},5000);
      const r=await fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/ask",Object.assign({method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(_payload)},ctl?{signal:ctl.signal}:{}));
      if(!r.ok||!r.body){aEl.innerHTML='<span class=csn>The Ask service is unavailable.</span>';return;}
      const rd=r.body.getReader(),dc=new TextDecoder();
      for(;;){const{done,value}=await rd.read();if(done)break;
        lastByte=Date.now();
        feed(strip(dc.decode(value,{stream:true}),false));
      }
      feed(strip(dc.decode(),true));                       // flush any held-back tail
      if(paintT){clearTimeout(paintT);paintT=null;}
      renderAsk(aEl,answer,src,gr,opts.tradition||"");      // attach the (compact, collapsed) sources
      ASK.push({role:"assistant",content:answer});if(ASK.length>16)ASK=ASK.slice(-16);
      if(answer)saveAsk(question,answer,src.slice(),_scEntry);   // AUTO-SAVE — every answer goes to the notebook
    }catch(e){
      if(paintT){clearTimeout(paintT);paintT=null;}
      const aborted=e&&(e.name==="AbortError");
      if(answer){renderAsk(aEl,answer,src,gr,opts.tradition||"");if(answer.length>40)saveAsk(question,answer,src.slice(),_scEntry);}
      else aEl.innerHTML='<span class=csn>'+(aborted
        ? 'That search ran longer than the connection would hold. Try again — or untick <b>Deep</b> for a faster answer.'
        : 'Ask is temporarily unavailable — please try again shortly.')+'</span>';
    }finally{if(idleT)clearInterval(idleT);}
  }
  function decorateResults(qs){
    if(TAB==="ask"||!qs)return;
    // 1. the AI is one click away from any keyword search
    if(!body.querySelector(".askaibar")&&body.firstChild){
      const bar=el("div","askaibar");
      bar.innerHTML=`<button class="lchip aai">\u2726 Ask AI: \u201c${esc(qs.slice(0,60))}\u201d</button><span class=gk>answers with citations</span>`;
      bar.querySelector(".aai").onclick=()=>{setTab("ask");runAsk(qs);};
      if(typeof b64e==="function"){const nb=document.createElement("button");nb.className="lchip nbsave";nb.textContent="\u26c9 results \u2192 notebook";
        nb.title="Save these findings as a named research notebook on /pins \u2014 shareable, citable, exportable";
        nb.onclick=()=>{const items=[...body.querySelectorAll("a.csr")].slice(0,24).map(a2=>{
            const m=(a2.getAttribute("href")||"").match(/\/read(?:\/|\?w=)([a-z0-9-]+)(?:#b(\d+))?/i);
            return m?["fr",m[1],+(m[2]||0)]:null;}).filter(Boolean);
          if(items.length)window.open("/the-faith-received/pins/#c="+b64e({v:3,n:qs.slice(0,60),items}),"_blank");};
        bar.appendChild(nb);}
      body.prepend(bar);}
    // 2. every passage result can be saved to the notebook (★ → fr_pins, same store as the reader)
    const P=()=>{try{return JSON.parse(localStorage.getItem("fr_pins")||"[]");}catch(e){return [];}};
    body.querySelectorAll("a.csr:not(.starred)").forEach(a=>{
      a.classList.add("starred");
      const m=(a.getAttribute("href")||"").match(/\/read(?:\/|\?w=)([a-z0-9-]+)(?:#b(\d+))?/i);
      if(!m)return;
      const st=document.createElement("button");st.className="pinstar";st.title="Save to your notebook / reading list";st.textContent="\u2605";
      const slug=m[1],page=+(m[2]||0);
      if(window.FRResearchNotebook?.hasReference?.(slug,page?String(page):null)||P().some(x=>x.slug===slug&&x.page===page))st.classList.add("on");
      st.onclick=async e=>{e.preventDefault();e.stopPropagation();const N=window.FRResearchNotebook;if(!N?.savePassage){st.title='The notebook could not load.';return;}
        const on=!N.hasReference(slug,page?String(page):null);st.disabled=true;
        try{if(on){const ti=(a.querySelector(".t")||{}).textContent||slug;const meta=(a.querySelector(".m")||{}).textContent||"";const label=((a.querySelector(".x")||{}).textContent||"").slice(0,240),author=meta.split("\u00b7")[0].trim();
            if(page)await N.savePassage({slug,page:String(page),title:ti,author,label});else await N.saveWork({slug,title:ti,author});}
          else await N.unsave(slug,page?String(page):null);st.classList.toggle("on",on);}
        catch(e2){st.title=e2?.message||'Could not save';}finally{st.disabled=false;}};
      a.style.position="relative";a.appendChild(st);});
    const TRS={PL:"pld",PG:"pg",PO:"po",AQ:"aq",TFR:"fr"},TRN={PL:"Latin Fathers",PG:"Greek Fathers",PO:"Oriental Fathers",AQ:"Aquinas",TFR:""};
    body.querySelectorAll("a.tr-hit").forEach(a=>{
      if(a.querySelector(".pinstar"))return;
      const bd=(a.querySelector(".tr-badge")||{}).textContent||"";const site=TRS[bd];if(!site)return;
      const hr=a.getAttribute("href")||"";
      // sister anchor schemes differ (#b26 PLD, #c333 PG, #r44518 AQ, ?w=…#b12-0 TFR) — parse loosely,
      // keep the EXACT href on the pin so the notebook always lands on the right passage.
      const mm=hr.match(/(?:\/read\/|[?&]w=)([A-Za-z0-9_-]+?)(?:\.html)?#(?:dt-p|[bcr])(\d+)/);if(!mm)return;
      const slug=mm[1],page=+mm[2];
      const st=document.createElement("button");st.className="pinstar";st.title="Save to your notebook / reading list";st.textContent="\u2605";
      if(P().some(x=>x.site===site&&x.slug===slug&&x.page===page))st.classList.add("on");
      st.onclick=e=>{e.preventDefault();e.stopPropagation();
        let arr=P();const on=!arr.some(x=>x.site===site&&x.slug===slug&&x.page===page);
        if(on)arr.unshift({site,slug,page,u:a.getAttribute("href"),
          title:((a.querySelector(".tr-cit")||{}).textContent||bd).trim(),
          label:((a.querySelector(".tr-tx")||{}).textContent||"").slice(0,110),author:"",tradition:TRN[bd]||""});
        else arr=arr.filter(x=>!(x.site===site&&x.slug===slug&&x.page===page));
        try{localStorage.setItem("fr_pins",JSON.stringify(arr.slice(0,300)));if(window._frSyncPins)window._frSyncPins();}catch(e2){}
        st.classList.toggle("on",on);};
      a.style.position="relative";a.appendChild(st);});
  }
  // `curTrad` = the tradition this answer was scoped to (""/undefined = the whole corpus), so the
  // re-ask chips can show which one you are standing in.
  function renderAsk(aEl,answer,src,gr,curTrad){
    const tools=answer?'<div class=ask-tools><button class="ask-copy" title="Copy this answer to the clipboard">⧉ Copy answer</button>'+
      ((src&&src.length)?`<a class="ask-copy" style="text-decoration:none" href="/the-faith-received/pins/#c=${b64e({v:3,n:("Ask — "+(answer.split(/\n/)[0]||"answer").replace(/^#+\s*/,"").slice(0,60)),items:src.map(s=>["fr",s.slug,s.page])})}" target=_blank title="Open every cited passage as a shareable collection on /pins — the dossier of this answer">⛉ Sources → collection</a>`:"")+'</div>':"";
    const traced=(gr&&gr.loci&&gr.loci.length)?'<span class=ask-route-k>traced</span>'+
      gr.loci.map(l=>`<span class=ask-loc>${esc(l)}</span>`).join("")+
      ((gr.traditions&&gr.traditions.length)?'<span class=ask-route-x>·</span>'+gr.traditions.map(esc).join(" vs "):"")+
      (gr.works?`<span class=ask-route-x>·</span><span class=ask-route-n>${gr.works} works</span>`:""):"";
    // "scope to Turretin, Heidegger and Voetius" must be VISIBLE, so the reader can tell the scope
    // bound (and which named people the corpus could not place).
    const asc=gr&&gr.authorScope;
    const scoped=(asc&&asc.authors&&asc.authors.length)?
      (traced?'<span class=ask-route-x>·</span>':"")+'<span class=ask-route-k>scoped to</span>'+
      asc.authors.map(a=>`<span class=ask-loc>${esc(a)}</span>`).join("")+
      ((asc.missing&&asc.missing.length)?`<span class=ask-route-n>no works found for ${asc.missing.map(esc).join(", ")}</span>`:""):"";
    const route=(traced||scoped)?'<div class=ask-route>'+traced+scoped+'</div>':"";
    const cards=(src&&src.length)?'<details class=ask-src><summary>'+src.length+' source'+(src.length>1?'s':'')+' cited</summary><div class=ask-srcwrap>'+
      src.map(s=>{
        // sister rows (PL/PG/DTC/Aquinas) carry {cit,link}, never slug/page — they rendered
        // as blank chips with "p.undefined" (owner 2026-09-06)
        if(s&&s.cit){const href=s.link?(/^https?:/.test(s.link)?s.link:s.link):null;
          return `<a class=ask-srcchip ${href?`href="${esc(href)}" target="_blank"`:""}>${esc(s.cit)}<span class=m>${esc(s.sister==="pld"?"Patrologia":s.sister==="aq"?"Aquinas":s.sister||"")}</span></a>`;}
        if(!s||!s.slug)return"";
        return `<a class=ask-srcchip href="/the-faith-received/read/?w=${s.slug}${s.page!=null?`#b${s.page}-0`:""}" target="_blank">${esc(s.title||s.slug)}<span class=m>${esc(s.author||"")?esc(s.author)+" · ":""}${s.page!=null?"p."+s.page:""}</span></a>`;
      }).join("")+'</div></details>':"";
    _askUnver=0;   // slugCite (run inside mdLite) tallies citations that don't match a retrieved passage
    const bodyHTML=answer?mdLite(answer):"<span class=ask-wait>…</span>";
    const vnote=(answer&&_askUnver>0)?`<div class=ask-vnote><span>${_askUnver} cited page${_askUnver>1?"s were":" was"} not among the passages retrieved for this answer (shown dashed) — open to verify.</span></div>`:"";
    const _fcv=window.__askFC||[];
    const guide=(answer&&src&&src.length)?'<div class=ask-guide><span class=gk>Widen</span>'+
      ["pl","pg","po"].map(c=>`<button class="lchip agx${_fcv.includes(c)?" on":""}" data-c="${c}">+ ${({pl:"Latin",pg:"Greek",po:"Oriental"})[c]} Fathers</button>`).join("")+
      '<button class="lchip agtr">⟶ across the tradition</button></div>':"";
    // ── THE CONVERSATION CONTINUES HERE (owner 2026-07-27) ──────────────────────────────────
    // (a) a follow-up box that carries this Q+A forward to /api/ask as `prev`, and
    // (b) tradition re-ask chips that re-run the SAME question inside one tradition's works.
    // Flow the owner asked for: "what is this tradition's view on inerrancy?" → answer (auto-saved)
    // → tap Lutheran → same question against the Lutheran works → tap Roman Catholic → same again.
    // Deep applies to every one of these: the checkbox state is read fresh on each run.
    // The old "⛉ clip → project" button is gone — clipping is no longer a thing the reader has to
    // remember, because every answer is already in the Notebook.
    const TRADS=[["Reformed","Reformed"],["Lutheran","Lutheran"],["Roman Catholic","Catholic"],["Medieval","Medieval"],["__pat","Patristic"]];
    const ct=curTrad||"";
    const follow=answer?'<div class=ask-follow><div class=ask-tradrow><span class=gk>Re-ask in</span>'+
      TRADS.map(function(t){return '<button class="lchip agtrad'+(ct===t[0]?" on":"")+'" data-t="'+esc(t[0])+'">'+esc(t[1])+'</button>';}).join("")+
      (ct?'<button class="lchip agtrad" data-t="">Whole corpus</button>':"")+'</div>'+
      '<div class=ask-fuwrap><input class=ask-fu type=text placeholder="Follow up — or &quot;scope to Turretin, Voetius…&quot;" aria-label="Ask a follow-up"><button class=ask-fusend type=button>Send</button></div>'+
      '<div class=ask-saved><span>✓ saved to your <b class=ask-nblink>Notebook</b></span></div></div>':"";
    aEl.innerHTML=route+`<div class=ask-body>${bodyHTML}</div>`+vnote+tools+guide+follow+cards;
    aEl._ans=answer||"";
    {const turnQ=(aEl.closest(".ask-turn")||{}).dataset?(aEl.closest(".ask-turn").dataset.q||""):"";
     aEl.querySelectorAll(".agx").forEach(b=>b.onclick=()=>{const c=b.dataset.c;const cur=new Set(window.__askFC||[]);cur.has(c)?cur.delete(c):cur.add(c);window.__askFC=[...cur];if(turnQ)runAsk(turnQ);});
     const tr2=aEl.querySelector(".agtr");if(tr2)tr2.onclick=()=>{if(turnQ){q.value=turnQ;setTab("trad");run();}};
     // tradition re-ask — same question, new scope, carrying the answer just read as `prev`
     aEl.querySelectorAll(".agtrad").forEach(b=>b.onclick=()=>{
       if(!turnQ)return;
       const t=b.dataset.t||"",pv={q:turnQ,a:aEl._ans||""};
       if(t==="__pat")runAsk(turnQ,{fathers:["pl","pg","po"],prev:pv,fresh:true});
       else runAsk(turnQ,{tradition:t,prev:pv,fresh:true});});
     // follow-up — a NEW question that carries this exchange forward as context
     {const fu=aEl.querySelector(".ask-fu"),fs=aEl.querySelector(".ask-fusend");
      const go=()=>{if(!fu)return;const v=(fu.value||"").trim();if(v.length<3)return;fu.value="";try{fu.blur();}catch(e){}
        runAsk(v,{prev:{q:turnQ,a:aEl._ans||""},tradition:(ct&&ct!=="__pat")?ct:""});};
      if(fs)fs.onclick=go;
      if(fu)fu.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();go();}});}
     {const nl=aEl.querySelector(".ask-nblink");if(nl)nl.onclick=openNotebook;}}
    const cb=aEl.querySelector(".ask-copy");
    if(cb)cb.onclick=()=>{navigator.clipboard.writeText(aEl._ans).then(()=>{cb.textContent="✓ Copied";setTimeout(()=>{cb.textContent="⧉ Copy answer";},1500);}).catch(()=>{cb.textContent="Copy failed";});};
  }
  const note=h=>{body.innerHTML='<div class=csn>'+h+'</div>';};
  let _pfP=null;
  function initPF(){
    if(_pfP)return _pfP;                                         // one shared load; every caller awaits the same promise
    _pfP=(async()=>{
      const busy=()=>q&&q.value.trim().length>=2;                // only narrate when a query is actually waiting
      if(busy())note("Loading the search index…");
      const man=await fetch(SB+"/v1/search/pagefind/manifest.json?v=4").then(r=>r.json()).catch(()=>({buckets:9}));
      // ?v cache-buster: a browser that import()'d this URL while Blob mis-served it as
      // octet-stream cached the bad response for a year; a fresh URL bypasses that (2026-06-13).
      pf=await import(SB+"/v1/search/pagefind/b0/pagefind.js?v=4");
      // manifest v2 (spec 13): `list` = shelf-keyed buckets (lib b0-8 + eebo/pg/po/pld/new);
      // numeric `buckets` stays the v1 fallback
      const dirs=(man.list&&man.list.length)?man.list.map(e=>e.path.replace(/\/pagefind$/,"")).filter(d=>d!=="b0")
        :Array.from({length:(man.buckets||9)-1},(_,i)=>"b"+(i+1));
      let done=0;const N=dirs.length;
      await Promise.all(dirs.map(d=>                               // merge buckets in PARALLEL (was serial ≈ N round-trips)
        pf.mergeIndex(SB+"/v1/search/pagefind/"+d+"/").catch(()=>null).then(()=>{done++;if(busy())note("Loading the search index… "+done+"/"+N);})));
      return pf;
    })();
    return _pfP;
  }
  // early-modern orthography: u/v and i/j are interchangeable in the sources
  const variants=s=>{const o=new Set([s]);o.add(s.replace(/v/g,"u"));o.add(s.replace(/j/g,"i").replace(/v/g,"u"));return [...o].slice(0,3);};
  /* ── TRADITION search (unification contract): one query, four corpora, one chronology ── */
  const TRAD_IDS={medieval:"Medieval","roman-catholic":"Roman Catholic",reformed:"Reformed",lutheran:"Lutheran"};
  let TRS={c:{pg:1,pl:1,aq:1,po:1,tfr:1},t:{medieval:1,"roman-catholic":1,reformed:1,lutheran:1}};
  try{const _s=JSON.parse(sessionStorage.getItem("fr_tr_scope"));if(_s&&_s.c)TRS=_s;}catch(e){}
  ["pg","pl","aq","po","tfr"].forEach(k=>{if(TRS.c[k]==null)TRS.c[k]=1;});   /* backfill new corpora (aq) default-on for returning users */
  if(TRS.t&&TRS.t.catholic!=null){TRS.t["roman-catholic"]=TRS.t.catholic;delete TRS.t.catholic;}   /* migrate pre-rename sessions */
  Object.keys(TRAD_IDS).forEach(k=>{if(TRS.t[k]==null)TRS.t[k]=1;});
  const trsSave=()=>{try{sessionStorage.setItem("fr_tr_scope",JSON.stringify(TRS));}catch(e){}};
  function trsParams(){
    const cs=Object.keys(TRS.c).filter(k=>TRS.c[k]);let p="";
    if(cs.length&&cs.length<5)p+="&c="+cs.join(",");
    if(TRS.c.tfr){const tt=Object.keys(TRS.t).filter(k=>TRS.t[k]&&TRAD_IDS[k]);
      if(tt.length&&tt.length<Object.keys(TRAD_IDS).length)p+="&trad="+tt.map(x=>TRAD_IDS[x]).join(",");}
    return p;}
  function ensureTrScope(){
    if($("#trScope"))return;
    const d=el("div");d.id="trScope";d.className="tr-scope";
    d.innerHTML='<span class=trs-lb>Corpora</span>'
      +'<button type=button class=trs-c data-c=pg>Greek · PG</button>'
      +'<button type=button class=trs-c data-c=pl>Latin · PL</button>'
      +'<button type=button class=trs-c data-c=po>Oriental · PO</button>'
      +'<button type=button class=trs-c data-c=aq>Scholastic · Aquinas</button>'
      +'<button type=button class=trs-c data-c=tfr>Early-modern</button>'
      +'<span class=trs-sub><span class=trs-lb>Tradition</span>'
      +'<button type=button class=trs-t data-t=medieval>Medieval</button>'
      +'<button type=button class=trs-t data-t=roman-catholic>Roman Catholic</button>'
      +'<button type=button class=trs-t data-t=reformed>Reformed</button>'
      +'<button type=button class=trs-t data-t=lutheran>Lutheran</button></span>';
    body.parentNode.insertBefore(d,body);
    const paint=()=>{
      d.querySelectorAll(".trs-c").forEach(b=>b.classList.toggle("on",!!TRS.c[b.dataset.c]));
      d.querySelectorAll(".trs-t").forEach(b=>b.classList.toggle("on",!!TRS.t[b.dataset.t]));
      d.querySelector(".trs-sub").style.display=TRS.c.tfr?"":"none";};
    d.addEventListener("click",e=>{
      const b=e.target.closest("button");if(!b)return;
      if(b.dataset.c){const on=Object.keys(TRS.c).filter(k=>TRS.c[k]);
        if(TRS.c[b.dataset.c]&&on.length===1)return;      /* one or all — never zero */
        TRS.c[b.dataset.c]=TRS.c[b.dataset.c]?0:1;}
      else if(b.dataset.t){const tn=Object.keys(TRS.t).filter(k=>TRS.t[k]);
        if(TRS.t[b.dataset.t]&&tn.length===1)return;
        TRS.t[b.dataset.t]=TRS.t[b.dataset.t]?0:1;}
      trsSave();paint();
      const v=q.value.trim();if(v.length>=3)runTrad(v);});
    paint();
    if(TAB!=="trad")d.style.display="none";}
  // TFR hits carry no tx in vector metadata — hydrate a 200-char excerpt from our own shards
  const _trExc={};
  async function trExcerpt(slug,page){
    const k=slug+"|"+page;if(k in _trExc)return _trExc[k];
    try{
      const meta=await fetch(SB+"/v1/works/"+slug+"/meta.json").then(r=>r.json());
      const f=meta.single?"work.json":((meta.shards||[]).find(s=>s.from<=page&&page<=s.to)||{}).file;
      if(!f)return _trExc[k]=null;
      const d=await fetch(SB+"/v1/works/"+slug+"/"+f).then(r=>r.json());
      const pg=(d.pages||[]).find(x=>x.n===page);
      const tx=(pg&&(pg.en||pg.la)||"").replace(/\[\^[^\]]*\]:?/g,"").replace(/[#*]+/g,"").replace(/\s+/g," ").trim();
      return _trExc[k]=tx?tx.slice(0,200):null;
    }catch(e){return _trExc[k]=null;}}
  let _trSeq=0;
  // ── SCRIPTURE & CONSTELLATIONS TAB (owner 2026-08-20: Tradition retired; this houses the
  // skies). Renders the PL research layers — Citations · Allusions · Topics — inside the
  // overlay, reusing the same renderer the Latin Fathers shelf uses. PG gets its own index
  // when v1/pgresearch lands; the chooser says so plainly rather than showing an empty sky.
  function renderSkyTab(){
    body.innerHTML='';
    const wrap=el("div");wrap.style.padding=".2rem 0";
    const fam=el("div","plorg");
    fam.innerHTML='<button class="pob on" data-f="pl" data-l="scripture">✧ Scripture</button>'+
                  '<button class="pob" data-f="pl" data-l="topics">✧ Topics</button>'+
                  '<button class="pob" data-f="map" data-l="authors">✧ Who reads alike</button>'+
                  '<button class="pob" data-f="map" data-l="works">✧ Map of works</button>'+
                  '<button class="pob" data-f="map" data-l="topics">✧ Doctrines</button>'+
                  '<button class="pob" data-f="pg" data-l="scripture">✧ Greek Fathers</button>'+
                  '<button class="pob" data-f="mine" data-l="scripture">✧ What the corpus cites</button>';
    wrap.appendChild(fam);
    const host=el("div");wrap.appendChild(host);
    body.appendChild(wrap);
    const paint=(f,layer)=>{
      host.innerHTML='';
      if(f==="mine"){ renderMineInsights(host); return; }
      if(f==="map"){ renderConstellationMap(host, layer||"authors"); return; }
      if(f==="pg"){ window.__plr.fam="pg"; window.__plr.cache={}; }
      window.__plr.fam=(f==="pg")?"pg":"pl";
      window.__plr.cache={};   // family switch invalidates the layer cache
      try{ renderPlScripture(host,{repaint:()=>paint("pl")}); }
      catch(e){ host.innerHTML='<p class=shelfhint>The Scripture index could not load.</p>'; }
    };
    fam.onclick=e=>{const b=e.target.closest(".pob");if(!b)return;
      fam.querySelectorAll(".pob").forEach(x=>x.classList.toggle("on",x===b));
      window.__plr.st.layer=(b.dataset.f==="map")?"scripture":(b.dataset.l||"scripture");window.__plr.st.subj=null;
      paint(b.dataset.f,b.dataset.l);};
    paint("pl","scripture");
  }

  async function runTrad(qs){
    const my=++_trSeq;ensureTrScope();
    body.innerHTML='<div class=csn>searching the whole tradition — Greek, Latin, Oriental, early-modern…</div>';
    try{
      const j=await fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/xsearch?q="+encodeURIComponent(qs)+trsParams()).then(r=>r.json());
      if(my!==_trSeq||TAB!=="trad")return;
      if(!j||!j.bands||!j.bands.length){body.innerHTML='<div class=csn>Nothing close enough across the tradition. Try a broader phrasing.</div>';return;}
      let h='<div class=csn>'+j.n+' passages across '+j.bands.length+' periods</div>';
      j.bands.forEach(b=>{
        h+='<div class=tr-band><span class=tr-ord>'+b.ord+'</span>'+esc(b.band)
          +(b.ord<10?'<button class=tr-ask data-ord="'+b.ord+'" data-band="'+esc(b.band)+'" title="Ask a question answered ONLY from this period&#39;s sources">✦ Ask this period</button>':'')
          +'</div>';
        b.hits.forEach(x=>{
          const home=x.corpus==="TFR";
          const inner='<span class="tr-badge tb-'+x.corpus+'">'+x.corpus+'</span>'
            +'<span class=tr-cit>'+esc(x.cit)+'</span>'
            +(x.trad?'<span class=tr-trad>'+esc(x.trad)+'</span>':'')
            +(x.tx?'<span class=tr-tx>'+esc(x.tx)+'</span>':(home&&x.link?'<span class=tr-tx data-hx="'+esc((x.link.match(/w=([a-z0-9-]+)/)||[])[1]||'')+'|'+(x.page||'')+'"></span>':''));
          h+= x.link
            ? '<a class=tr-hit href="'+esc(x.link)+'"'+(home?'':' target=_blank rel=noopener')+'>'+inner+(home?'':'<span class=tr-ext>↗</span>')+'</a>'
            : '<div class=tr-hit>'+inner+'</div>';});});
      body.innerHTML=h;
      body.querySelectorAll(".tr-ask").forEach(bt=>bt.onclick=()=>{
        window.__askBand={ord:+bt.dataset.ord,name:bt.dataset.band};
        const carried=q.value.trim();
        setTab("ask");
        const ai=$("#askInput");
        if(ai){ai.value=carried;ai.placeholder="Ask "+bt.dataset.band+"…";try{ai.focus();}catch(e){}}
        let ch=$("#askBandChip");
        if(!ch){ch=el("div");ch.id="askBandChip";ch.className="ask-bandchip";
          const comp=$("#askInput");if(comp&&comp.parentNode)comp.parentNode.insertBefore(ch,comp);}
        ch.innerHTML='Answering only from: <b>'+esc(bt.dataset.band)+'</b> <button id=askBandX title="Remove the period restriction">✕</button>';
        ch.style.display="";
        $("#askBandX").onclick=()=>{window.__askBand=null;ch.style.display="none";};});
      // hydrate home-corpus excerpts (bounded)
      [...body.querySelectorAll("[data-hx]")].slice(0,20).forEach(sp=>{
        const [sl,pg]=sp.dataset.hx.split("|");if(!sl||!pg)return;
        trExcerpt(sl,+pg).then(tx=>{if(tx&&my===_trSeq)sp.textContent=tx+"…";});});
    }catch(e){body.innerHTML='<div class=csn>Tradition search unavailable.</div>';}}
  async function runText(qs){
    const p=await initPF();const base=pfFilters();
    // Pagefind treats a filter ARRAY as AND; to OR several chosen authors we run one search each and union.
    const authors=Array.isArray(base.author)?base.author.slice():(base.author?[base.author]:[null]);
    delete base.author;
    const seen={};
    for(const v of variants(qs))for(const au of authors){
      const f=Object.assign({},base);if(au)f.author=au;
      const s=await p.search(v,{filters:f});
      for(const r of s.results)if(!seen[r.id])seen[r.id]=r;
    }
    let all=Object.values(seen).sort((a,b)=>(b.score||0)-(a.score||0));  // relevance order across the unioned author searches
    const __dc={};   // cache of resolved Pagefind data (slug/meta) — reused by the allow-filter, clustering, and more()
    const _al=allowSlugs();   // the 4 filters → allowed slug set; post-filter the results (Pagefind carries slug in data())
    if(_al){const _s=new Set(_al),_cap=all.slice(0,600);   // bound the data() resolution to the top matches by relevance
      const _ds=await Promise.all(_cap.map(r=>r.data().then(d=>(__dc[r.id]=d)).catch(()=>null)));
      all=_cap.filter((r,i)=>_ds[i]&&_s.has((_ds[i].meta&&_ds[i].meta.slug)||""));}
    // QUOTED = EXACT PHRASE (owner 2026-09-06 "did we fix the full text thing"): a query in
    // quotes keeps only hits whose page text carries the contiguous phrase — folded (v→u,
    // j→i, accents) so early-modern spellings still match. Ranking above stays Pagefind's.
    const _phrM=qs.match(/^\s*["“”'](.+)["“”']\s*$/);
    if(_phrM&&_phrM[1].trim().includes(" ")){
      const _fold=t=>String(t).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/v/g,"u").replace(/j/g,"i").replace(/\s+/g," ");
      const _ph=_fold(_phrM[1].trim());
      const _cap2=all.slice(0,400);
      const _ds2=await Promise.all(_cap2.map(r=>(__dc[r.id]?Promise.resolve(__dc[r.id]):r.data().then(d=>(__dc[r.id]=d)).catch(()=>null))));
      all=_cap2.filter((r,i)=>{const d=_ds2[i];if(!d)return false;
        const hay=_fold((d.content||"")+" "+(d.excerpt||"").replace(/<[^>]+>/g," "));
        return hay.includes(_ph);});
    }
    if(q&&q.value.trim()!==qs)return;                            // user typed on while the index loaded — let the newer run paint
    if(!all.length){note("Nothing found for “"+esc(qs)+"”"+(_al?" with those filters":"")+(_phrM?" as an exact phrase":"")+".");return;}
    // enrich each result's meta line from the page's works index (Pagefind records carry slug+url but no author meta)
    const wb={};(typeof WORKS!=="undefined"?WORKS:[]).forEach(w=>wb[w.slug]=w);
    const rowMeta=d=>{const sl=d.meta.slug||"",fm=(d.meta.url||"").match(/#b(\d+)/),fol=fm?fm[1]:"";
      if(sl.indexOf("rc-")===0){const y=(sl.match(/(\d{4})/g)||[]).pop();return ["Reformed confession",y,fol?("§ "+fol):""].filter(Boolean).map(esc).join(" · ");}
      const w=wb[sl]||{};return [w.author,w.volume,w.tradition,fol?("fol. "+fol):""].filter(Boolean).map(esc).join(" · ");};
    const hlP=()=>{const q2=($("#csq")&&$("#csq").value||"").trim();return q2?((u)=>u+(u.indexOf("?")>=0?"&":"?")+"hl="+encodeURIComponent(q2.slice(0,60))):(u=>u);};
    const rowHTML=d=>{const wl=hlP()(d.meta.url);return `<a class=csr href="${wl}"><span class=t>${esc(d.meta.title||"")}</span><div class=x>${d.excerpt}</div><div class=m>${rowMeta(d)}</div></a>`;};
    // Cluster volumes of the same work together: resolve data (bounded), group by author+base-title
    // (volume markers stripped), order groups by best relevance, volumes in order within. Guarded —
    // any failure keeps the flat relevance order. __dc caches resolved data for more() to reuse.
    if(all.length<=500){try{
      const stripVol=t=>String(t||"").replace(/[\s,;:]+(?:Tom\.?|Tomus|Pars|Parte|Vol\.?|Volume|Part)\b.*$/i,"").trim();
      const ds=await Promise.all(all.map(r=>r.data().then(d=>(__dc[r.id]=d))));
      const g=new Map(),ord=[];
      all.forEach((r,i)=>{const w=wb[(ds[i].meta.slug)||""]||{},k=((w.author||"")+"|"+stripVol(w.title||ds[i].meta.title||"")).toLowerCase();
        if(!g.has(k)){g.set(k,[]);ord.push(k);}g.get(k).push(r);});
      ord.sort((a,b)=>Math.max.apply(null,g.get(b).map(r=>r.score||0))-Math.max.apply(null,g.get(a).map(r=>r.score||0)));
      const volOf=r=>((wb[(__dc[r.id].meta.slug)||""]||{}).volume||"");
      const flat=[];ord.forEach(k=>{g.get(k).sort((a,b)=>volOf(a).localeCompare(volOf(b))||(b.score||0)-(a.score||0));flat.push.apply(flat,g.get(k));});
      all.length=0;all.push.apply(all,flat);
    }catch(e){}}
    // incremental rendering so you can page through EVERY instance, not just the first 80
    const BATCH=80;let shown=0;
    body.innerHTML="";const listEl=el("div");body.appendChild(listEl);const foot=el("div","csn");body.appendChild(foot);
    // OMNIBOX topics leg: when the query names a locus (label or Latin alias), offer its topic page —
    // the question-first door — above the passage hits. Tiny loci.json, cached after first use.
    (async()=>{try{
      if(!window.__LOCI)window.__LOCI=await fetch(BLOB+"/v1/graph/loci.json"+VER).then(r=>r.json());
      const ql=qs.toLowerCase();
      const hits=(window.__LOCI||[]).filter(L=>L.label.toLowerCase().includes(ql)||ql.includes(L.label.toLowerCase())||(L.aliases||[]).some(a=>ql.includes(a)||a.includes(ql))).slice(0,3);
      if(hits.length&&q&&q.value.trim()===qs){
      }
    }catch(e){}})();
    let busy=false;
    async function more(){
      if(busy||shown>=all.length)return;busy=true;
      const slice=all.slice(shown,shown+BATCH);
      const datas=await Promise.all(slice.map(r=>__dc[r.id]||r.data()));
      listEl.insertAdjacentHTML("beforeend",datas.map(rowHTML).join(""));
      listEl.querySelectorAll(".csr:not([data-in])").forEach((el2,i)=>{el2.dataset.in="1";el2.style.animationDelay=(Math.min(i,16)*28)+"ms";});  // stagger each new row's enter (#5)
      shown+=slice.length;busy=false;
      if(shown<all.length){
        foot.innerHTML=`${all.length.toLocaleString()} matching sections · showing ${shown} `+
          `<button class=csmore id=csMore>Show ${Math.min(BATCH,all.length-shown)} more</button>`+
          `<button class=csmore id=csAll>Show all</button>`;
        foot.querySelector("#csMore").onclick=more;
        foot.querySelector("#csAll").onclick=async function(){this.textContent="Loading…";while(shown<all.length)await more();};
      }else foot.textContent=all.length.toLocaleString()+" matching section"+(all.length!==1?"s":"")+" — all shown";
    }
    await more();
    // cross-corpus: the Fathers (Patrologia Latina + Orientalis) by sense, when the toggle is on
    {const c=document.getElementById("csPL");
     if(c&&c.checked&&qs===q.value.trim()){
       try{
         const [pl,po]=await Promise.all([
           fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/vsearch?q="+encodeURIComponent(qs)+"&k=8&corpus=pl").then(r=>r.json()).catch(()=>null),
           fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/vsearch?q="+encodeURIComponent(qs)+"&k=4&corpus=po").then(r=>r.json()).catch(()=>null)]);
         if(qs===q.value.trim()&&TAB==="text"){
           const fr=[...((pl&&pl.results)||[]),...((po&&po.results)||[])].filter(x=>x.score>=0.6);
           if(fr.length){const d=el("div");d.innerHTML='<div class=cs-fsec>In the Fathers — Patrologia</div>'
             +fr.map(f=>'<div class=cs-f><span class=cit>'+esc(f.cit)+'</span><span class=tx>'+esc(f.tx)+'…</span></div>').join("");
             body.appendChild(d);}
         }
       }catch(e){}
     }}
  }
  async function initLem(){
    if(!LEMS){note("Loading lemma list…");LEMS=(await fetch(SB+"/v2/idx/lemma/lemmas.json").then(r=>r.json())).lemmas;}
    if(!WMAP)WMAP=(await fetch(SB+"/v2/idx/lemma/works.json").then(r=>r.json())).works;
  }
  const FUNC=new Set(["sum","in","et","non","hic","ad","quis","qui","quod","is","ille","ut","cum","si","a","ab","de","ex","atque","sed","nec","enim","ergo","iam","tam"]);
  async function runLem(qs){
    await initLem();
    qs=qs.toLowerCase().replace(/j/g,"i").replace(/v/g,"u");
    const sugg=LEMS.filter(l=>l.startsWith(qs)&&!FUNC.has(l)).slice(0,9);
    if(!sugg.length){note("No Latin headword starts with “"+esc(qs)+"”.");return;}
    const lem=sugg.includes(qs)?qs:sugg[0];
    const pre=(lem.slice(0,2)||"_").split("").map(c=>/[a-z0-9]/.test(c)?c:"_").join("");
    const shard=await fetch(SB+"/v2/idx/lemma/"+encodeURIComponent(pre)+".json").then(r=>r.json()).catch(()=>null);
    const e=shard&&shard.lemmas[lem];
    let h='<div class=cshint>Headwords: '+sugg.map(s=>`<a href="#" data-l="${esc(s)}" class="${s===lem?"on":""}">${esc(s)}</a>`).join(" · ")+'</div>';
    if(!e)h+='<div class=csn>No postings for “'+esc(lem)+'”.</div>';
    else if(e.d){const ws=Object.entries(e.d).sort((a,b)=>b[1]-a[1]).slice(0,50);
      h+=ws.map(([wid,c])=>{const w=WMAP[+wid]||{};return `<a class=csr href="/read/${w.slug}"><span class=t>${esc(w.title||"")}</span><div class=m>${esc(w.author||"")} · on ${c.toLocaleString()} pages</div></a>`;}).join("");
      h+=`<div class=csn>“${esc(lem)}” is pervasive — per-work coverage shown (${Object.keys(e.d).length} works)</div>`;}
    else{h+=e.w.slice(0,60).map(([wid,pgs])=>{const w=WMAP[+wid]||{};
        return `<div class=csr><span class=t>${esc(w.title||"")}</span><div class=m>${esc(w.author||"")} · ${pgs.length} page${pgs.length>1?"s":""}</div><div class=cs-pages>${pgs.slice(0,16).map(p=>`<a href="/read/${w.slug}#b${p}-0">fol. ${p}</a>`).join("")}${pgs.length>16?`<span style="font:.72rem/1.6 var(--sans);color:var(--muted)">+${pgs.length-16} more</span>`:""}</div></div>`;}).join("");
      h+=`<div class=csn>${e.w.length} works contain forms of “${esc(lem)}”</div>`;}
    body.innerHTML=h;
    body.querySelectorAll(".cshint a").forEach(a=>a.onclick=ev=>{ev.preventDefault();q.value=a.dataset.l;run();});
  }
  async function runSem(qs){
    note("Searching by sense…");
    try{
      const r=await fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/vsearch?q="+encodeURIComponent(qs)+"&k=120").then(r=>r.json());
      if(!r.results||!r.results.length){note("No semantic matches.");return;}
      if(!WMAP)await initLem();
      const bySlug={};WMAP.forEach(w=>bySlug[w.slug]=w);
      body.innerHTML=r.results.map(t=>{const w=bySlug[t.slug]||{title:t.slug};
        return `<a class=csr href="/read/${t.slug}?hl=${encodeURIComponent((($("#csq")||{}).value||"").trim().slice(0,60))}#b${t.page}-0"><span class=t>${esc(w.title||t.slug)}</span><div class=m>${esc(w.author||"")} · fol. ${t.page} · ${(t.score*100).toFixed(0)}% match</div></a>`;}).join("")
        +`<div class=csn>${r.results.length} passages by sense (closest first)</div>`;
    }catch(e){note("Search by sense comes online with the deployed site (it rides the /api function).");}
  }
  async function run(){
    const qs=q.value.trim();
    if(qs.length<2){note("Type at least two characters.");return;}
    try{if(TAB==="lem")await runLem(qs);else if(TAB==="trad")await runTrad(qs);else await runText(qs);}   // Search (pagefind) is default; Ask runs on Enter via runAsk
    catch(err){note("Search error: "+esc(String(err)));}
    finally{decorateResults(qs);}
  }
})();
