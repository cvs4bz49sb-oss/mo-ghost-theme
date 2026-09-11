
const BLOB=(window.__FR_BLOB_BASE__&&!/TBD/.test(String(window.__FR_BLOB_BASE__)))?String(window.__FR_BLOB_BASE__).replace(/\/+$/,""):null;
const VER=window.__FR_VER?("?v="+window.__FR_VER):"";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fold=s=>String(s).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
let IDX=[],LETTER=null,QY="",CUR=null,SEEALSO={},LANEPREF=null;
let SZ=parseFloat(localStorage.getItem("dtc_sz"))||1.02;
document.documentElement.style.setProperty("--dtcsz",SZ+"rem");
document.addEventListener("click",e=>{const pp=document.getElementById("olPop");
  if(pp&&pp.classList.contains("on")&&!e.target.closest(".outline"))pp.classList.remove("on");});
document.addEventListener("keydown",e=>{
  const inInput=/INPUT|TEXTAREA/.test(document.activeElement.tagName);
  if((e.key==="/"&&!inInput)||((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k")){e.preventDefault();$("#q").focus();$("#q").select();return;}
  if(inInput){if(e.key==="Enter"){const f=document.querySelector(".hw");if(f){f.click();$("#q").blur();}}
    if(e.key==="Escape")$("#q").blur();return;}
  if(e.key==="[")$("#pPrev")&&$("#pPrev").click();
  if(e.key==="]")$("#pNext")&&$("#pNext").click();
});
function paintAlpha(){
  const has={};IDX.forEach(a=>has[a[2]]=1);
  $("#alpha").innerHTML="ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(L=>
    `<button data-l="${L}" ${has[L]?"":"disabled"} class="${LETTER===L?"on":""}">${L}</button>`).join("");
}
function matches(){
  const f=fold(QY.trim());
  let rows=IDX;
  if(LETTER)rows=rows.filter(a=>a[2]===LETTER);
  if(f)rows=rows.filter(a=>fold(a[1]).includes(f)||fold(a[5]||"").includes(f));
  return rows;
}
function paintList(){
  const rows=matches();
  $("#count").textContent=`${rows.length} of ${IDX.length} articles`;
  const f=fold(QY.trim());
  let html="",lastL="";
  if(!rows.length){$("#list").innerHTML='<div class=empty>No headword matches. Full-text search of the articles arrives with the English translation.</div>';return;}
  for(const a of rows.slice(0,600)){
    if(!QY&&a[2]!==lastL){lastL=a[2];html+=`<div class=lether>${esc(lastL)}</div>`;}
    const en=a[5]||a[1];
    let t=esc(en);
    if(f){const i=fold(en).indexOf(f);
      if(i>=0)t=esc(en.slice(0,i))+"<mark>"+esc(en.slice(i,i+QY.trim().length))+"</mark>"+esc(en.slice(i+QY.trim().length));}
    const frDiff=fold(a[1])!==fold(en)?esc(a[1])+" · ":"";
    html+=`<button class="hw${CUR===a[0]?" on":""}" data-id="${esc(a[0])}">${t}<small>${frDiff}${(a[3]/1000).toFixed(0)}k${a[4]?" · English ready":""}</small></button>`;
  }
  if(rows.length>600)html+=`<div class=empty>…and ${rows.length-600} more — narrow the search.</div>`;
  $("#list").innerHTML=html;
}
function cell(p){const t=String(p??"").trim();return t?tok(t):'<span style="color:var(--border)">\u2014</span>';}
function tok(p){
  // ⟦id|label⟧ → internal article links; the translation bank carries literal <em>/<i>
  // pairs for work titles (owner 2026-09-03 screenshot: "the <em>Defensiones</em>") —
  // escape everything, then re-admit exactly those as italics
  return esc(p).replace(/⟦([a-z0-9-]+)\|([^⟧]+)⟧/g,(m,id,lab)=>`<a class=xref data-id="${id}" href="#${id}">${lab}</a>`)
    .replace(/&lt;(\/?)(?:em|i)&gt;/g,'<$1i>');
}
// outline labels and list rows are plain text — em/i markup is dropped, not shown
function detok(p){return String(p??"").replace(/<\/?(?:em|i)>/g,"");}
const isHead=p=>{const t=p.replace(/\u27e6[^\u27e7]+\u27e7/g,"").trim();
  return t.length<170&&/^([IVXLC]+|\d+\u00b0?)[.)\u2014\u00b0]?\s+\S/.test(t)&&t.length<150;};
function renderArt(d){
  const FR=Array.isArray(d.fr)?d.fr:String(d.fr||"").split(/\n\n+/);
  const EN=Array.isArray(d.en)?d.en:null;
  const hasEn=EN&&EN.length===FR.length;
  const lane=hasEn?"both":"fr";
  const frLen=FR.join(" ").length;
  const heads=FR.map((f,i)=>isHead(f)?i:-1).filter(i=>i>=0);
  const paint=l=>{
    let body="";
    if(l==="both"&&hasEn){
      body=FR.map((f,i)=>isHead(f)
        ?`<div class=hpair id=sec${i}><h3>${tok(EN[i])}</h3><div class=hsub>${tok(f)}</div></div>`
        :`<div class=pp id=sec${i}><p class=pen>${cell(EN[i])}</p><p class=pfr>${cell(f)}</p></div>`).join("");
    }else if(l==="en"&&hasEn){
      body=EN.map((p,i)=>`<p id=sec${i}${isHead(FR[i])?' class=shead':''}>${tok(p)}</p>`).join("");
    }else{
      body=FR.map((p,i)=>`<p id=sec${i}${isHead(p)?' class=shead':''}>${tok(p)}</p>`).join("");
    }
    const rows=matches();const ci=rows.findIndex(a=>a[0]===d.id);
    const prev=ci>0?rows[ci-1]:null,next=ci>=0&&ci<rows.length-1?rows[ci+1]:null;
    const olHtml=heads.length>=3?`<span class=outline id=olWrap><button id=olBtn aria-haspopup=true>Contents \u25be</button>
      <div class=ol-pop id=olPop>${heads.map(i=>`<a href="#" data-sec="${i}">${esc(detok((hasEn?EN[i]:FR[i]).replace(/\u27e6[^|]+\|([^\u27e7]+)\u27e7/g,"$1")).slice(0,90))}</a>`).join("")}</div></span>`:"";
    $("#art").innerHTML=`<div class=artbar><button class=mb onclick="closeArt()">\u2039 Dictionary</button><span class=cw>${esc(d.te&&d.te!==d.t?d.te:d.t)}</span></div>
    <div class=artscroll><div class=inner>
      <h1>${esc(d.te&&d.te!==d.t?d.te:d.t)}</h1>
      ${d.te&&d.te!==d.t?`<div class=frlemma>${esc(d.t)}</div>`:""}
      <div class=meta>
        <span class=pnav><button id=pPrev title="Previous article" ${prev?"":"disabled"}>\u2039</button><button id=pNext title="Next article" ${next?"":"disabled"}>\u203a</button></span>
        <span class=lane-t>
          <button data-l=both class="${l==="both"?"on":""}" ${hasEn?"":"disabled"}>\u2225 Both</button>
          <button data-l=en class="${l==="en"?"on":""}" ${hasEn?"":"disabled"}>English</button>
          <button data-l=fr class="${l==="fr"?"on":""}">Fran\u00e7ais</button>
        </span>
        ${olHtml}
        <span class=szc><button id=szDn title="Smaller text">A\u2212</button><button id=szUp title="Larger text">A+</button></span>
        ${hasEn?"":'<span class=pend>ENGLISH TRANSLATION IN PROGRESS</span>'}
        ${d.q==="ocr"?'<span class=pend title="Wikisource transcription not yet proofread">RAW OCR TEXT</span>':""}
        <span>${(frLen/1000).toFixed(0)}k chars</span>
      </div>
      ${d.renvoi?`<div class=welcome>A cross-reference entry — it points to <a class=xref data-id="${esc(d.renvoi)}" href="#${esc(d.renvoi)}"><b>the main article</b></a>.</div>`:""}
      <div class=body>${body}</div>
      ${(SEEALSO[d.id]||[]).length?`<div class=seealso><b>Referenced as</b><br>${SEEALSO[d.id].map(esc).join(" · ")}</div>`:""}
      <div class=srcnote>Text: fr.wikisource.org, <i>Dictionnaire de théologie catholique</i> (public domain). Part of the Roman Catholic shelf of The Faith Received.</div>
    </div></div>`;
    $("#art").querySelectorAll(".lane-t button").forEach(b=>b.onclick=()=>{if(!b.disabled){LANEPREF=b.dataset.l;paint(b.dataset.l);}});
    $("#art").querySelectorAll("a.xref").forEach(a=>a.onclick=e=>{e.preventDefault();openArt(a.dataset.id);});
    const pv=$("#pPrev"),nx=$("#pNext");
    if(pv&&prev)pv.onclick=()=>openArt(prev[0]);
    if(nx&&next)nx.onclick=()=>openArt(next[0]);
    const ob=$("#olBtn");
    if(ob){ob.onclick=e=>{e.stopPropagation();$("#olPop").classList.toggle("on");};
      $("#olPop").querySelectorAll("a").forEach(a=>a.onclick=e=>{e.preventDefault();
        const t=document.getElementById("sec"+a.dataset.sec);if(t)t.scrollIntoView({block:"start",behavior:"smooth"});
        $("#olPop").classList.remove("on");});}
    const setSz=v=>{SZ=Math.max(.86,Math.min(1.3,v));try{localStorage.setItem("dtc_sz",SZ);}catch(e){}
      document.documentElement.style.setProperty("--dtcsz",SZ+"rem");};
    $("#szDn").onclick=()=>setSz(SZ-0.06);$("#szUp").onclick=()=>setSz(SZ+0.06);
    const asc=$("#art .artscroll");
    asc.onscroll=()=>{$("#art").classList.toggle("scrolled",asc.scrollTop>10);};
    $("#art").classList.remove("scrolled");
    asc.scrollTop=0;
  };
  paint(LANEPREF&&(LANEPREF==="fr"||hasEn)?LANEPREF:lane);
}
function openArt(id,push){
  CUR=id;paintList();
  document.body.classList.add("reading");
  $("#art").innerHTML='<div class=inner><div class=welcome>Loading…</div></div>';
  fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/dtc/a/"+encodeURIComponent(id)+".json"+VER).then(r=>r.json()).then(d=>{
    d.id=id;renderArt(d);
    document.title=d.t+" — Dictionnaire de Théologie Catholique";
    if(push!==false)history.replaceState(null,"","#"+encodeURIComponent(id));
  }).catch(()=>{$("#art").innerHTML='<div class=artbar></div><div class=artscroll><div class=inner><div class=welcome>Could not load this article.</div></div></div>';});
}
let LISTPOS=0;
function closeArt(){document.body.classList.remove("reading");CUR=null;
  history.replaceState(null,"",location.pathname);
  document.title="Dictionnaire de Th\u00e9ologie Catholique \u2014 The Faith Received";
  requestAnimationFrame(()=>{$("#list").scrollTop=LISTPOS;paintList();});}
$("#list").addEventListener("click",e=>{const b=e.target.closest(".hw");
  if(b){LISTPOS=$("#list").scrollTop;openArt(b.dataset.id);}});
$("#alpha").addEventListener("click",e=>{const b=e.target.closest("button[data-l]");if(!b||b.disabled)return;
  LETTER=(LETTER===b.dataset.l?null:b.dataset.l);paintAlpha();paintList();});
$("#q").addEventListener("input",()=>{QY=$("#q").value;paintList();});
fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/dtc/index.json"+VER).then(r=>r.json()).then(d=>{
  IDX=d.articles||[];SEEALSO=d.seealso||{};
  paintAlpha();paintList();
  const h=decodeURIComponent(location.hash.slice(1));
  if(h)openArt(h,false);
}).catch(()=>{$("#list").innerHTML='<div class=empty>The dictionary index is not published yet.</div>';});
