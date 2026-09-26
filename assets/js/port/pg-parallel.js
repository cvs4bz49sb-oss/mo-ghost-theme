/* Reviewed PG paragraphs and printed-column provenance. No length-based matching. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FRPgParallel=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const text=v=>String(v??'');
const sourceCache=new WeakMap();
function sourceColumns(doc){
 if(sourceCache.has(doc))return sourceCache.get(doc);
 const out={},images=new Map(),alt=new Set(['translation','secondary','diplomatic','witness','edition']);let twoPlate=false;   // 09-25: PG 51 prints an opening twice (a Greek plate and a Latin plate); the canon marks the other plate's lane ana="#second-plate"/"#latin-plate"
 const body=doc.querySelector('body')||doc.documentElement;
 function primaryImages(node){for(const ch of node.children||[]){if(ch.localName==='div'&&alt.has(ch.getAttribute('type')))continue;if(ch.localName==='pb'&&ch.getAttribute('facs')){if(!images.has(ch.getAttribute('facs')))images.set(ch.getAttribute('facs'),ch.getAttribute('n'));}else if(ch.localName==='div')primaryImages(ch);}}primaryImages(body);
 function walk(node,role='reading',state={opening:'',column:'',pending:[]}){for(const ch of node.children||[]){const tag=ch.localName,type=ch.getAttribute('type');
  if(tag==='div'){if(ch.getAttribute('subtype')==='historical-source-snapshot')continue;if(ch.getAttribute('subtype')==='migne-reading'){walk(ch,'verified',{opening:'',column:'',pending:[]});continue;}if(type==='translation')continue;if(type==='secondary')walk(ch,'secondary',{opening:'',column:'',pending:[]});else if(alt.has(type))walk(ch,'supplement',{opening:'',column:'',pending:[]});else walk(ch,role,state);continue;}
  if(role==='supplement'&&ch.getAttribute('resp')!=='#pageview-zone')continue;
  if(tag==='pb'){const n=ch.getAttribute('n')||'',facs=ch.getAttribute('facs');state.opening=(facs&&images.get(facs))||n;state.column=n;if(facs&&!images.has(facs))images.set(facs,state.opening);}
  else if(tag==='milestone'&&ch.getAttribute('unit')==='column')state.column=ch.getAttribute('n')||'';
  else if(tag==='note'&&role!=='supplement'&&state.opening&&(ch.getAttribute('place')||'foot')!=='margin'){   // the page's footnotes (Migne's apparatus, resp #pg-site-vtx): counted as the page's own text, rendered as the folio's note band
   const opening=out[state.opening]||(out[state.opening]={columns:{}});(opening.notes||(opening.notes=[])).push((ch.textContent||'').replace(/\s+/g,' ').trim());}
  else if(tag==='head'&&!state.opening){state.pending.push(ch.textContent||'');}
  else if((tag==='p'||tag==='head')&&state.opening&&state.column){const opening=out[state.opening]||(out[state.opening]={columns:{}}),col=opening.columns[state.column]||(opening.columns[state.column]={});if(/-plate$/.test(ch.getAttribute('ana')||''))twoPlate=true;
   if(role==='verified')opening.verified=true;
   const rich=col[role+'Rich']||(col[role+'Rich']=[]);
   const head=t=>/^[Α-ΩA-B]\s*[—–-]\s/.test(t)?t:'\u0002'+t+'\u0003';
   rich.push(...(state.pending||[]).map(head));state.pending=[];
   if(tag==='p'){(col[role]||(col[role]=[])).push(ch.textContent||'');rich.push(ch.textContent||'');}
   else rich.push(head(ch.textContent||''));
  }
 }}walk(body);
 const printed={};
 // COLUMN RESOLUTION. A column's witness is the first lane role with enough Greek+Latin letters (verified: any; else 100). A column is PURE
 // when 85 of every 100 letters are one script. A MIXED column — a Latin dissertation quoting Greek at length, a Greek text under a Latin
 // apparatus — is admitted only in a work that prints no Greek|Latin pair anywhere (its pure columns are all one script), and then joins
 // the lane that holds most of the work's mixed letters (owner 2026-09-15, PG 78 cols. 61–178 'Isidori doctrina': every right column was
 // refused as mixed and the openings rendered as walls). In a bilingual work the 85 rule stands: a mixed column there is not a lane, and the
 // next role (the secondary witness, the pageview zone) may still speak for the column. The secondary lane is the Latin witness by contract.
 const scripts=t=>{const g=(t.match(/\p{Script=Greek}/gu)||[]).length,l=(t.match(/\p{Script=Latin}/gu)||[]).length,letters=(t.match(/\p{L}/gu)||[]).length;return {g,l,letters,pure:g/Math.max(letters,1)>=.85?'grc':l/Math.max(letters,1)>=.85?'la':null};};
 const cands=new Map();   // opening key + column -> candidate witnesses in role order
 for(const [key,opening]of Object.entries(out))for(const [column,candidates]of Object.entries(opening.columns)){const list=[];
  for(const role of ['verified','reading','secondary','supplement']){const t=(candidates[role]||[]).join(' ').replace(/\s+/g,' ').trim(),s=scripts(t);if(s.g+s.l<(role==='verified'?1:100)||s.g+s.l<s.letters*.5)continue;if(role==='secondary'&&s.pure==='grc')continue;list.push({role,t,...s,mixedSecondary:role==='secondary'&&!s.pure});}
  // (a MIXED secondary column -- the Onomasticon's Greek lemma + Latin gloss, PG 28 cols. 1619-1622 -- used to be refused as 'not the
  //  Latin witness' and the page showed nothing at all; it now enters the page-true split below, never the lane resolution.)
  cands.set(key+'|'+column,list);}
 const pureSet=new Set();let mg=0,ml=0;
 for(const list of cands.values()){const c=list.find(x=>!x.mixedSecondary);if(!c)continue;if(c.pure)pureSet.add(c.pure);else{mg+=c.g;ml+=c.l;}}
 // A TWO-PLATE work (PG 51) prints Greek and Latin as a pair on facing plates with the same column numbers; with both lanes keyed to one
 // column every column reads mixed, and the single-stream rule would pour the whole work into one lane. Such a work is a Greek|Latin pair:
 // its mixed columns are split by paragraph below, never merged.
 const mixedLane=!twoPlate&&pureSet.size<=1&&mg+ml>0?(mg>=ml?'grc':'la'):null;
 for(const [key,opening]of Object.entries(out)){opening.grc=[];opening.la=[];opening.grcRich=[];opening.laRich=[];
  // Paragraph lists (owner 2026-09-15 'rich labelled inner text like the patrologia site'): the printed paragraphs of each lane in column
  // order, a heading folded into the paragraph it introduces; colParas keeps them by printed column for the column basis in alignOpening.
  opening.grcParas=[];opening.laParas=[];opening.colParas=[];
  for(const [column,candidates]of Object.entries(opening.columns)){
   const _list0=cands.get(key+'|'+column)||[];
   const pick=_list0.find(c=>(c.pure||mixedLane)&&!c.mixedSecondary);
   // PAGE-TRUE LANES (owner 2026-09-17 'i care about the right pages, not cols ... sometimes left latin, sometimes right latin,
   // just get it right page by page'): a printed column carrying BOTH scripts -- the tail of a Greek formula above a Latin rubric,
   // PG 28 col. 1587 'QUARTA FORMULA' -- failed the 85% purity test and the WHOLE column was dropped, so the page showed neither
   // its Greek nor its Latin (census on the live canon: 3,092 columns, 2,9xx pages, 6.8M letters). In a work that prints a
   // Greek|Latin pair such a column is now split by PARAGRAPH: each paragraph joins the lane of its own script, in printed order,
   // a head riding with the paragraph it introduces. A column with only a crumb of the second script stays whole under its own
   // voice -- no lane is invented. Nothing the page prints is discarded. (A single-stream work still takes mixedLane; a pure
   // column is untouched.)
   let _pieces=null;
   if(!pick&&_list0.length&&!mixedLane){
    const c0=_list0.find(c=>!c.mixedSecondary)||_list0[0],rich0=candidates[c0.role+'Rich']||candidates[c0.role]||[],runs=[];let pend=[];
    for(const e of rich0){const v=String(e||'').replace(/\s+/g,' ').trim();if(!v)continue;
     const s2=scripts(v);
     if(s2.g+s2.l<12||isLabel(v)){pend.push(v);continue;}
     const lg=s2.g>=s2.l?'grc':'la';
     if(runs.length&&runs[runs.length-1].lang===lg)runs[runs.length-1].rich.push(...pend,v);
     else runs.push({lang:lg,rich:[...pend,v]});
     pend=[];}
    if(pend.length&&runs.length)runs[runs.length-1].rich.push(...pend);
    const side=l2=>runs.filter(r=>r.lang===l2).reduce((a,r)=>a+r.rich.reduce((b,q)=>b+(l2==='grc'?scripts(q).g:scripts(q).l),0),0);
    if(runs.length)_pieces=(runs.length>1&&Math.min(side('grc'),side('la'))>=150)?runs:[{lang:side('grc')>=side('la')?'grc':'la',rich:runs.reduce((a,r)=>a.concat(r.rich),[])}];
   }
   if(_pieces){
    for(const piece of _pieces){const lang=piece.lang,rich=piece.rich,list=[];let pending='';
     for(const e of rich){const v=String(e||'').replace(/\s+/g,' ').trim();if(!v)continue;if(/^\u0002[^\u0003]*\u0003$/.test(v)){pending+=v+' ';continue;}list.push((pending+v).trim());pending='';}
     if(pending.trim()){if(list.length)list[list.length-1]+=' '+pending.trim();else list.push(pending.trim());}
     opening[lang].push(list.join(' ').replace(/\u0002|\u0003/g,'').replace(/\s+/g,' ').trim());
     opening[lang+'Rich'].push(rich.join(' ').replace(/\s+/g,' ').trim());
     if(!printed[key])printed[key]={};(printed[key][lang]||(printed[key][lang]=[])).push(column);
     opening[lang+'Paras'].push(...list);opening.colParas.push({n:column,lang,paras:list});}
    continue;}
   if(!pick)continue;const lang=pick.pure||mixedLane;
   opening[lang].push(pick.t);opening[lang+'Rich'].push((candidates[pick.role+'Rich']||candidates[pick.role]).join(' ').replace(/\s+/g,' ').trim());
   if(!printed[key])printed[key]={};(printed[key][lang]||(printed[key][lang]=[])).push(column);
   const rich=candidates[pick.role+'Rich']||[],list=[];let pending='';
   for(const e of rich){const v=String(e||'').replace(/\s+/g,' ').trim();if(!v)continue;if(/^[^]*$/.test(v)){pending+=v+' ';continue;}list.push((pending+v).trim());pending='';}
   if(pending.trim()){if(list.length)list[list.length-1]+=' '+pending.trim();else list.push(pending.trim());}
   opening[lang+'Paras'].push(...list);opening.colParas.push({n:column,lang,paras:list});}
  opening.grc=opening.grc.join(' ');opening.la=opening.la.join(' ');opening.grcRich=opening.grcRich.join(' ');opening.laRich=opening.laRich.join(' ');}
 const result={openings:out,printed};sourceCache.set(doc,result);return result;
}
function printedColumns(doc){return sourceColumns(doc).printed;}
function canonicalOpenings(doc){return sourceColumns(doc).openings;}
function sectionStarts(value){
 const s=text(value),hits=new Map(),rx=/(?:^|[.!?·»”"']\s+)(\d{1,3})\.\s+(?=[«“"'Α-ΩA-ZἈ-Ὧ])/gu;let m;
 while((m=rx.exec(s))){const key=m[1],index=m.index+m[0].indexOf(key);if(hits.has(key))hits.set(key,null);else hits.set(key,index);}return hits;
}
// A printed label that the lanes carry as its own paragraph — a marked <head>, a short all-caps run (running title, 'S. BASILII MAGNI.'),
// or a short division label ('Caput I.', 'Κεφάλ. Β.', 'ΟΡΟΣ ΙΗ΄', 'Homilia III.') — rides with the paragraph it introduces.
const LABEL=/^(?:Caput|Cap\.|Κεφ(?:αλ|άλ)?\.?|Κεφάλαιον|ΚΕΦΑΛΑΙΟΝ|Regula|ΟΡΟΣ|Ὅρος|Homilia|Sermo|Oratio|Epistola|Liber|Pars|Quaestio|Articulus|Titulus|Λόγος|ΛΟΓΟΣ|Ὁμιλία|ΟΜΙΛΙΑ|Ἐπιστολή|ΕΠΙΣΤΟΛΗ|Chapter|Rule|Homily|Sermon|Letter|Book|Part|Question|Article|Oration|Discourse|Title|Preface|Prologue)(?=[\s.,:;·()\[]|$)/iu;   // no \b: JS word boundaries are ASCII-only, Greek labels would never match
function isLabel(v){const bare=String(v).replace(/\u0002[^\u0003]*\u0003/g,'').replace(/\s+/g,' ').trim();if(!bare)return true;   // marked heads, alone or run together ('Pars I' + 'ISIDORI DOCTRINA.'), are labels
 const letters=bare.replace(/[^\p{L}]/gu,'');if(bare.length<=90&&letters.length>=4&&letters===letters.toUpperCase())return true;   // an all-caps rubric line ('PART THREE. THE DOCTRINE OF ISIDORE OF PELUSIUM.', 49 chars) is a label (owner 2026-09-15, PG 78 col. 61)
 if(bare.length>48)return false;if(!LABEL.test(bare))return false;const rest=bare.replace(LABEL,'').trim();return rest.length<=12&&!/[a-zα-ωά-ώ]{3,}/u.test(rest);}
function hasLabel(v){v=text(v);return /^\u0002/.test(v)||LABEL.test(v);}
function foldHeads(list){const out=[];let pending='';for(const e of list||[]){const v=text(e).replace(/\s+/g,' ').trim();if(!v)continue;if(isLabel(v)){pending+=v+' ';continue;}out.push((pending+v).trim());pending='';}if(pending.trim()){if(out.length)out[out.length-1]+=' '+pending.trim();else out.push(pending.trim());}return out;}
function alignOpening(grc,la,en,paras){
 // COLUMN BASIS (owner 2026-09-15, PG 78 col. 61: the site keys its English by printed column): an opening whose columns all carry ONE lane
 // — a Latin dissertation running from the left column into the right, a Greek-only page — pairs column by column: a column's paragraphs
 // against that column's English when the counts agree, alone when the column has no English. A column whose counts disagree drops the basis.
 if(paras&&Array.isArray(paras.byCol)&&paras.byCol.length>=2&&new Set(paras.byCol.map(c=>c.lang)).size===1){
  const lang=paras.byCol[0].lang,rows=[];let ok=true;
  for(const c of paras.byCol){const s=foldHeads(c.paras||[]),e=foldHeads(c.en||[]);if(e.length&&e.length!==s.length){ok=false;break;}
   s.forEach((t,i)=>rows.push({grc:lang==='grc'?t:'',la:lang==='la'?t:'',en:e[i]||''}));}
  if(ok&&rows.length)return {basis:'column-paragraphs',rows};}
 // Paragraph basis (owner 2026-09-15): when the source and the English carry the same number of printed paragraphs, pair them by
 // position — the patrologia site's rows. Headings ride with the paragraph they introduce. Any count mismatch falls through unchanged.
 if(paras&&Array.isArray(paras.en)){const g=foldHeads(paras.grc||[]),e=foldHeads(paras.en),l=foldHeads(paras.la||[]);
  const src=g.length>=2?g:(l.length>=2?l:null);   // Greek pages pair on the Greek; Latin-only pages on the Latin
  // COUNTS AGREEING OUTRANK A NUMERAL (owner 2026-09-15, PG 78 col. 61 'Isidori doctrina'): a Latin-only page with a '1. De concordia…'
  // section start was refused the paragraph basis, the marker basis then anchored on the empty Greek lane, and the whole opening became one
  // wall. Equal paragraph counts pair by position whatever numerals the text carries; the marker basis below reads only the lanes present.
  if(src){
   // NOTHING A PAGE PRINTS IS DISCARDED (owner 2026-09-17 'make sure the latin and greek is shown completely per page'): when the
   // Latin is the pairing source because the Greek has fewer than two paragraphs (PG 28 page 1603: one Greek paragraph beside five
   // Latin), the Greek rode nowhere and vanished. It takes the first row, as the Latin already does in the mirror case.
   const mk=(t,i)=>({grc:src===g?t:(g.length===l.length?g[i]:(i===0?text(grc):'')),la:src===l?t:(l.length===g.length?l[i]:(i===0?text(la):'')),en:e[i]});
   if(src.length===e.length)return {basis:'paragraphs',rows:src.map(mk)};
   // Label anchors: when the counts differ but both lanes carry the same number of labelled paragraphs (a rule, a chapter — 'ΟΡΟΣ ΙΓ´.',
   // 'RULE XIII'), each lane is cut before every labelled paragraph and the segments pair by position; a segment may hold several paragraphs
   // (the English often prints the rule's statement as its own paragraph where the Greek runs on).
   const segs=list=>{const out=[];list.forEach((t,i)=>{if(i===0||!hasLabel(t))(out.length?out[out.length-1]:(out.push([]),out[0])).push(t);else out.push([t]);});return out.map(a=>a.join(' '));};
   const sg=segs(src),se=segs(e);
   if(sg.length>=2&&sg.length===se.length&&(l.length===0||src===l||l.length===g.length)){
    const rows=sg.map((t,i)=>({grc:src===g?t:(g.length===l.length?segs(g)[i]||'':(i===0?text(grc):'')),la:src===l?t:(l.length===g.length?segs(l)[i]||'':(i===0?text(la):'')),en:se[i]}));return {basis:'label-anchors',rows};}}}
 const source=[text(grc),text(la),text(en)],marks=source.map(sectionStarts),present=source.map(s=>s.trim().length>0),lead=marks[present.findIndex(Boolean)]||new Map();
 const shared=[...lead].filter(([k,v])=>v!==null&&marks.every((m,i)=>!present[i]||m.get(k)!=null)).map(([key])=>({key,at:marks.map((m,i)=>present[i]?m.get(key):0)}));
 // Crossing or repeated markers do not license guessed paragraph pairs.
 const crossing=shared.some((marker,index)=>index>0&&marker.at.some((n,i)=>n<=shared[index-1].at[i]));const anchors=crossing?[]:shared;
 const leading=source.map(s=>/^\s*\u0002[^\u0003]+\u0003\s*/.exec(s));
 const header=leading.every(Boolean)?leading.map(m=>m[0].length):null;
 const cuts=[[0,0,0],...(header?[header]:[]),...anchors.filter(m=>!header||m.at.every((n,i)=>n>=header[i])).map(m=>m.at),source.map(s=>s.length)],rows=[];
 for(let i=1;i<cuts.length;i++){const row=source.map((s,j)=>s.slice(cuts[i-1][j],cuts[i][j]));if(row.some(s=>s.trim()))rows.push({grc:row[0],la:row[1],en:row[2]});}
 if(anchors.length)return {basis:'shared-section-markers',rows};
 // PRINTED PARAGRAPHS (owner 2026-09-15, PG 78 col. 63): when no basis pairs the lanes, the opening still shows its printed paragraphs —
 // each lane's paragraphs in their own order, side by side, with no pair asserted between them (the reader flows such rows as two
 // independent columns). A pair opening whose Latin count differs keeps the whole Latin under the first Greek paragraph, as the
 // paragraph basis does. One wall per lane only when a lane has a single paragraph.
 if(paras&&Array.isArray(paras.en)){const g=foldHeads(paras.grc||[]),l=foldHeads(paras.la||[]),e=foldHeads(paras.en),n=Math.max(g.length,l.length,e.length);
  if(n>1){const prows=[];for(let i=0;i<n;i++)prows.push({grc:g[i]||'',la:g.length?(l.length===g.length?(l[i]||''):(i===0?text(la):'')):(l[i]||''),en:e[i]||''});return {basis:'printed-paragraphs',rows:prows};}}
 return {basis:'printed-opening',rows};
}
function nextWorkReference(works,currentId,page,lastColumn){
 const n=Number(page),last=Number(lastColumn);if(!Number.isFinite(n)||!Number.isFinite(last)||n<=last)return null;
 const index=works.findIndex(w=>String(w.id)===String(currentId)),next=index>=0?works[index+1]:null;
 return next&&Array.isArray(next.c)&&n>=Number(next.c[0])&&n<=Number(next.c[1])?String(next.id):null;
}
// Migne's gutter letters A–D (the quarters of an opening) reached the per-column English as words ("…desirable promise, D by
// adding these words", 2026-09-14). B, C, D are never English words; "A" is the article, so it is a gutter letter only where an
// article cannot stand — before a pronoun, verb, article, preposition, conjunction or negation — or at the end of a paragraph.
const NOT_AFTER_ARTICLE=new Set('you he she it we they i me him her us them your his its our their this that these those the a an and but or nor for yet so in on at by to of from with without into onto over under upon after before against between among through during within is are was were be been being am has have had do does did not no never also then thus therefore whether if when where while as than because since although though unless until'.split(' '));
function dropGutterLetters(value){
 return String(value).replace(/(^|[^\p{L}\p{N}])([ABCD])(?:[ \u00a0]+(?=([\p{L}“"‘(\[]))|[ \u00a0]*$)/gu,(m,pre,letter,next,offset,whole)=>{
  if(letter==='A'&&next){const word=(whole.slice(offset+m.length).match(/^[\p{L}]+/u)||[''])[0].toLowerCase();if(!NOT_AFTER_ARTICLE.has(word))return m;}
  return pre;
 }).replace(/[ \u00a0]{2,}/g,' ').trim();
}
function cleanEnglish(value){
 return dropGutterLetters(text(value).replace(/\s*Continue:\s*Ask about[\s\S]*?search the corpus[\s\S]*?Topics[\s\S]*?The Tradition[\s\S]*?next work\s*→\s*$/,'').trim());
}
function location(data,opening){
 const label=data?.pg_page_labels?.[text(opening)];if(label)return label;
 const map=data?.pg_columns?.[text(opening)];if(!map)return null;const mode=data.pg_source||'grc',cols=[...new Set((mode==='grcla'?[...(map.grc||[]),...(map.la||[])]:map[mode]||[]).map(text))];if(!cols.length)return null;
 cols.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));return cols.length===1?'col. '+cols[0]:'cols. '+cols.join('–');
}
return {canonicalOpenings,alignOpening,printedColumns,location,cleanEnglish,dropGutterLetters,nextWorkReference};
});
