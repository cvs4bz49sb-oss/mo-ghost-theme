
// ── TFR omnibox adapter (engine = master at prdl_backup/_shared/omnibox, inlined above at build) ──
// Rows: authors + works from the already-fetched works-index, topics from loci.json. Escapes deep-link
// the palette via #cs=/#ask= so the box never dead-ends (OMNIBOX.md contract §4).
const _omniAttach=()=>{if(window.__FR_LIBRARY_SEARCH__||window.__omniOn||!window.OMNIBOX||!document.getElementById("omniPanel"))return;window.__omniOn=1;
OMNIBOX.attach({
  input:document.getElementById("heroQ"),panel:document.getElementById("omniPanel"),limit:12,
  sources:async()=>{
    // one parallel wave — the boot-race contract replays any pending query when these land
    const [d,bios,L,SA]=await Promise.all([
      pWorks,
      fetch(BLOB+"/v1/authors.json"+VER).then(r=>r.ok?r.json():{}).catch(()=>({})),
      fetch(BLOB+"/v1/graph/loci.json"+VER).then(r=>r.ok?r.json():[]).catch(()=>[]),
      fetch(BLOB+"/v1/sister_authors.json"+VER).then(r=>r.ok?r.json():[]).catch(()=>[])]);
    const ws=(d.works||d);const rows=[];const byA={};
    const dOf=a=>{const b=bios[a];return b&&b.dates?b.dates:"";};
    ws.forEach(w=>{if(w.author)(byA[w.author]=byA[w.author]||[]).push(w);});
    // MAJOR AUTHORS FIRST (owner 2026-08-17 'luther → Martin Luther does not show up'):
    // the engine keeps the first 12 matches in ROW ORDER — an author added late to the
    // index (Luther, 90 works) lost to every early-index author whose tradition merely
    // contains the query ("Lutheran"). Order authors by corpus size.
    Object.entries(byA).sort((x,y)=>y[1].length-x[1].length)
      .forEach(([a,g])=>rows.push({k:"author",t:a,s:(dOf(a)?dOf(a)+" · ":"")+g.length+(g.length>1?" works":" work")+(g[0].tradition?" · "+g[0].tradition:""),href:"/#a="+encodeURIComponent(a),x:""}));
    ws.forEach(w=>rows.push({k:"work",t:(typeof TITLES!=="undefined"&&TITLES[w.slug])||w.title||w.slug,s:[w.author,w.volume,w.tradition].filter(Boolean).join(" · "),href:"/the-faith-received/read/?w="+encodeURIComponent(w.slug),x:(w.title||"")}));
    {const SITE={pl:["Latin Fathers","https://pld-patrologia-latina.vercel.app/#a="],pg:["Greek Fathers","https://patrologia-graeca.vercel.app/#a="],po:["Oriental Fathers","https://patrologia-orientalis.vercel.app/#a="]};
     (SA||[]).forEach(([n,d,c])=>{const s=SITE[c];if(s)rows.push({k:"father",t:n,s:(d?d+" · ":"")+s[0],href:s[1]+encodeURIComponent(n),x:s[0]});});}
    return rows;},
  escapes:q=>{
    // references ARE queries: a citation typed here routes straight to its question —
    // a tuned Ask prompt first (the conversation), the grid second (the bench).
    const out=[];
    const mSt=q.match(/\b(ia|i-ii|ii-ii|iii|prima pars|prima secundae|secunda secundae|tertia pars)\s*,?\s*q(?:u?aest(?:io)?)?\.?\s*(\d{1,3})\b/i);
    if(mSt){const PN={"ia":"Ia","prima pars":"Ia","i-ii":"I-II","prima secundae":"I-II","ii-ii":"II-II","secunda secundae":"II-II","iii":"III","tertia pars":"III"};
      const ps=PN[mSt[1].toLowerCase()];if(ps){
        out.push({t:"✦ ST "+ps+" q."+mSt[2]+" — ask the commentators",href:"#ask="+encodeURIComponent("Summa Theologiae "+ps+" q."+mSt[2]+" — how do the commentators treat this question?")});
        out.push({t:"ST "+ps+" q."+mSt[2]+" — Thomas + the bench",href:"#st="+ps+"-"+(+mSt[2])});}}
    const mSe=q.match(/\b(i{1,3}|iv|[1-4])\s*sent(?:\.|ent\w*)?\s*,?\s*d(?:ist)?\.?\s*(\d{1,2})\b/i);
    if(mSe){const R={i:1,ii:2,iii:3,iv:4};const bk=R[mSe[1].toLowerCase()]||+mSe[1];
      if(bk>=1&&bk<=4){const ROM=["","I","II","III","IV"];
        out.push({t:"✦ Sent. "+ROM[bk]+" d."+(+mSe[2])+" — ask the commentators",href:"#ask="+encodeURIComponent("Sentences Book "+ROM[bk]+", dist. "+(+mSe[2])+" — how do the commentators treat this distinction?")});
        out.push({t:"Sent. "+ROM[bk]+" d."+(+mSe[2])+" — Lombard, Thomas, the bench",href:"#s="+bk+"-"+(+mSe[2])});}}
    const mB=q.match(/\b(genesis|exodus|psalms?|isaiah|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|hebrews|james|revelation)\s+(\d{1,3})\b/i);
    if(mB){const bk=mB[1].toLowerCase().replace(/^psalm$/,"psalms");
      out.push({t:mB[1]+" "+mB[2]+" — every commentary, open to the chapter",href:"#sc="+bk.replace(/ /g,"_")+"-"+(+mB[2])});}
    const qShaped=/^(what|why|how|did|does|is|are|who|when|where|can|should)\b/i.test(q)||/\?\s*$/.test(q);
    out.push(qShaped?{t:"✦ Ask: “"+q+"”",href:"#ask="+encodeURIComponent(q)}
                    :{t:"Search the corpus for “"+q+"”",href:"#cs="+encodeURIComponent(q)});
    return out;},
});};
{const hq2=document.getElementById("heroQ");
 if(hq2){["focus","pointerdown","keydown","input"].forEach(ev=>hq2.addEventListener(ev,_omniAttach,{once:false}));}
 if(/#(cs|ask|tr)=/.test(location.hash))_omniAttach();}
{document.querySelectorAll(".doors .door").forEach(a=>a.addEventListener("click",e=>{
   if(location.hash===a.getAttribute("href")){e.preventDefault();dispatchEvent(new HashChangeEvent("hashchange"));}}));}
// #a= author deep-link: filter the shelves to that author
{const am=()=>{const m=location.hash.match(/#a=([^&]+)/);if(m){const q2=document.getElementById("q");if(q2){q2.value=decodeURIComponent(m[1]);if(typeof render==="function")render();}}};
 addEventListener("hashchange",am);am();}
// WORK SEARCH FILTERS THE LIBRARY (owner 2026-09-05 "when I search by work I also get back
// results albeit within the author"): the omnibox only ever SUGGESTED — the library below
// never reacted to typing, so a work-title query produced no results on the page. Feed the
// hero query into the #q carrier (matchF already matches titles + TITLES overrides) so the
// shelves re-render as the author-grouped view with the matching works under their author's
// heading. Question-shaped input stays with Ask — it must not blank the shelves.
{const hq3=document.getElementById("heroQ");
 if(hq3&&!window.__FR_LIBRARY_SEARCH__){let _t3=null;
  hq3.addEventListener("input",()=>{clearTimeout(_t3);_t3=setTimeout(()=>{
    const v=hq3.value.trim(),q2=document.getElementById("q");
    if(!q2||typeof render!=="function")return;
    const qShaped=/^(what|why|how|did|does|is|are|who|when|where|can|should)\b/i.test(v)||/\?\s*$/.test(v);
    const want=(qShaped||v.length<3)?"":v;
    if(q2.value!==want){q2.value=want;try{render();}catch(e){}}
  },260);});
 }}
