/* Disputed questions: ported from The Faith Received (tools/prdl_reader_prototype/atlas.html); the data from the library worker, links into the reader on this site. */
window.__FR_BLOB_BASE__=window.__FR_BLOB_BASE__||"https://mo-tfr-library.mo-podcast-feed.workers.dev";
window.__FR_READER_PATH__=window.__FR_READER_PATH__||"/the-faith-received/read/";
window.__FR_LEXICON_PATH__=window.__FR_LEXICON_PATH__||"/the-faith-received/lexicon/";
const BLOB=(window.__FR_BLOB_BASE__||"").replace(/\/$/,"");
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const J=u=>fetch(BLOB+u).then(r=>r.ok?r.json():null).catch(()=>null);
// MereO hosts the same page with its own reader path (window.__FR_READER_PATH__ = '/the-faith-received/read/') and data address
const READER=(window.__FR_READER_PATH__||'/read');
const read=(w,p)=>`${READER}?w=${encodeURIComponent(w)}#b${encodeURIComponent(p)}-0`;
const ANS=[['affirms','Affirm'],['denies','Deny'],['distinguishes','Distinguish'],['reports only','Report others only'],['unclear','Unclear']];
let CUR=null,FILTER=null,DATA=null;
// an open question ("For whom Christ died") carries the positions the schools took, in place of affirm and deny
const answersOf=d=>d.options?[...d.options.map(o=>[o,o]),['reports only','Report others only'],['unclear','Unclear']]:ANS;
// the pages an answer stands on, grouped by work: "Theology of the Scotist School, Vol. I: pp. 361, 373, 375"
function srcs(list){
  const by=new Map();for(const [w,p,t] of list){if(!by.has(w))by.set(w,{t:t||w,ps:[]});if(!by.get(w).ps.includes(p))by.get(w).ps.push(p);}
  return [...by.entries()].map(([w,{t,ps}])=>`<span class="src">${esc(t)}: ${ps.length>1?'pp.':'p.'} ${ps.map(p=>`<a href="${read(w,p)}">${esc(p)}</a>`).join(', ')}</span>`).join('');
}
function renderQ(){
  const d=DATA;if(!d)return;const A=answersOf(d);
  const counts=Object.fromEntries(A.map(([k])=>[k,d.answers.filter(a=>a.answer===k).length]));
  const shown=FILTER?d.answers.filter(a=>a.answer===FILTER):d.answers.filter(a=>a.answer!=='unclear'&&a.answer!=='reports only');
  const groups=A.map(([k,l])=>[k,l,shown.filter(a=>a.answer===k)]).filter(([,,v])=>v.length);
  $('#q').innerHTML=`<h2>${esc(d.q)}</h2><p class="muted">${esc(d.locus)} · ${d.answers.length} authors · ${d.n_pages.toLocaleString()} pages</p>${window.TFRMethod?window.TFRMethod.html("<p>Each answer is read by machine from the claims recorded on the author's pages: open the pages to check it.</p>"):'<p class="note">Each answer is read by machine from the claims recorded on the author\'s pages: open the pages to check it.</p>'}`
    +`<div class="tally" role="group" aria-label="Filter by answer"><button type="button" data-f="" aria-pressed="${!FILTER}">Answers</button>${A.map(([k,l])=>counts[k]?`<button type="button" data-f="${esc(k)}" aria-pressed="${FILTER===k}">${esc(l)} ${counts[k]}</button>`:'').join('')}</div>${
    groups.length?groups.map(([k,l,v])=>`<h3 class="ans">${esc(l)} <span class="muted">${v.length}</span></h3><ul class="rows">${v.map(a=>`<li><span class="who">${esc(a.author)}${a.dates||a.tradition?`<small>${esc([a.dates,a.tradition].filter(Boolean).join(' · '))}</small>`:''}</span><p>${esc(a.line)}</p><span class="pp">${srcs(a.cited.length?a.cited:a.pages.slice(0,3))}</span></li>`).join('')}</ul>`).join('')
      :'<p class="muted">No author in the library states an answer on the pages filed under this question yet.</p>'}`;
}
async function showQ(id,write){
  CUR=id;FILTER=null;document.querySelectorAll('[data-q]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.q===id)));
  DATA=await J(`/v1/atlas/q/${encodeURIComponent(id)}.json`);
  if(!DATA){$('#q').innerHTML='<p class="muted">This question could not be loaded.</p>';return;}
  renderQ();if(write)history.replaceState(null,'',`#${id}`);
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-q]');if(b){showQ(b.dataset.q,true);return;}const f=e.target.closest('[data-f]');if(f){FILTER=f.dataset.f||null;renderQ();}});
J('/v1/atlas/index.json').then(d=>{
  if(!d){$('#loci').innerHTML='<p class="muted">The atlas could not be loaded. Reload the page to try again.</p>';return;}
  const by=new Map();for(const x of d.questions){if(!by.has(x.locus))by.set(x.locus,[]);by.get(x.locus).push(x);}
  const want=location.hash.slice(1)||d.questions[0].id,wl=(d.questions.find(x=>x.id===want)||{}).locus;
  $('#loci').innerHTML=[...by.entries()].map(([l,qs])=>`<details${l===wl?' open':''}><summary>${esc(l)}<small>${qs.length}</small></summary><ul>${qs.map(x=>`<li><button type="button" data-q="${esc(x.id)}" aria-current="false">${esc(x.q)}</button></li>`).join('')}</ul></details>`).join('');
  showQ(want,false);
});
