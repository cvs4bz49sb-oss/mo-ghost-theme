/* Reviewed PG paragraphs and printed-column provenance. No length-based matching. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FRPgParallel=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const text=v=>String(v??'');
const sourceCache=new WeakMap();
function sourceColumns(doc){
 if(sourceCache.has(doc))return sourceCache.get(doc);
 const out={},images=new Map(),alt=new Set(['translation','secondary','diplomatic','witness','edition']);
 const body=doc.querySelector('body')||doc.documentElement;
 function primaryImages(node){for(const ch of node.children||[]){if(ch.localName==='div'&&alt.has(ch.getAttribute('type')))continue;if(ch.localName==='pb'&&ch.getAttribute('facs')){if(!images.has(ch.getAttribute('facs')))images.set(ch.getAttribute('facs'),ch.getAttribute('n'));}else if(ch.localName==='div')primaryImages(ch);}}primaryImages(body);
 function walk(node,role='reading',state={opening:'',column:'',pending:[]}){for(const ch of node.children||[]){const tag=ch.localName,type=ch.getAttribute('type');
  if(tag==='div'){if(type==='translation')continue;if(type==='secondary')walk(ch,'secondary',{opening:'',column:'',pending:[]});else if(alt.has(type))walk(ch,'supplement',{opening:'',column:'',pending:[]});else walk(ch,role,state);continue;}
  if(role==='supplement'&&ch.getAttribute('resp')!=='#pageview-zone')continue;
  if(tag==='pb'){const n=ch.getAttribute('n')||'',facs=ch.getAttribute('facs');state.opening=(facs&&images.get(facs))||n;state.column=n;if(facs&&!images.has(facs))images.set(facs,state.opening);}
  else if(tag==='milestone'&&ch.getAttribute('unit')==='column')state.column=ch.getAttribute('n')||'';
  else if(tag==='head'&&!state.opening){state.pending.push(ch.textContent||'');}
  else if((tag==='p'||tag==='head')&&state.opening&&state.column){const opening=out[state.opening]||(out[state.opening]={columns:{}}),col=opening.columns[state.column]||(opening.columns[state.column]={});
   const rich=col[role+'Rich']||(col[role+'Rich']=[]);
   const head=t=>/^[Α-ΩA-B]\s*[—–-]\s/.test(t)?t:'\u0002'+t+'\u0003';
   rich.push(...(state.pending||[]).map(head));state.pending=[];
   if(tag==='p'){(col[role]||(col[role]=[])).push(ch.textContent||'');rich.push(ch.textContent||'');}
   else rich.push(head(ch.textContent||''));
  }
 }}walk(body);
 const printed={};
 for(const [key,opening]of Object.entries(out)){opening.grc=[];opening.la=[];opening.grcRich=[];opening.laRich=[];for(const [column,candidates]of Object.entries(opening.columns)){
  for(const role of ['reading','secondary','supplement']){const t=(candidates[role]||[]).join(' ').replace(/\s+/g,' ').trim(),g=(t.match(/\p{Script=Greek}/gu)||[]).length,l=(t.match(/\p{Script=Latin}/gu)||[]).length,letters=(t.match(/\p{L}/gu)||[]).length;if(g+l<100)continue;const lang=g/Math.max(letters,1)>=.85?'grc':l/Math.max(letters,1)>=.85?'la':null;if(!lang||role==='secondary'&&lang!=='la')continue;opening[lang].push(t);opening[lang+'Rich'].push((candidates[role+'Rich']||candidates[role]).join(' ').replace(/\s+/g,' ').trim());if(!printed[key])printed[key]={};(printed[key][lang]||(printed[key][lang]=[])).push(column);break;}
 }opening.grc=opening.grc.join(' ');opening.la=opening.la.join(' ');opening.grcRich=opening.grcRich.join(' ');opening.laRich=opening.laRich.join(' ');}
 const result={openings:out,printed};sourceCache.set(doc,result);return result;
}
function printedColumns(doc){return sourceColumns(doc).printed;}
function canonicalOpenings(doc){return sourceColumns(doc).openings;}
function sectionStarts(value){
 const s=text(value),hits=new Map(),rx=/(?:^|[.!?·»”"']\s+)(\d{1,3})\.\s+(?=[«“"'Α-ΩA-ZἈ-Ὧ])/gu;let m;
 while((m=rx.exec(s))){const key=m[1],index=m.index+m[0].indexOf(key);if(hits.has(key))hits.set(key,null);else hits.set(key,index);}return hits;
}
function alignOpening(grc,la,en){
 const source=[text(grc),text(la),text(en)],marks=source.map(sectionStarts);const shared=[...marks[0]].filter(([k,v])=>v!==null&&marks.every(m=>m.get(k)!=null)).map(([key])=>({key,at:marks.map(m=>m.get(key))}));
 // Crossing or repeated markers do not license guessed paragraph pairs.
 const crossing=shared.some((marker,index)=>index>0&&marker.at.some((n,i)=>n<=shared[index-1].at[i]));const anchors=crossing?[]:shared;
 const cuts=[[0,0,0],...anchors.map(m=>m.at),source.map(s=>s.length)],rows=[];
 for(let i=1;i<cuts.length;i++){const row=source.map((s,j)=>s.slice(cuts[i-1][j],cuts[i][j]));if(row.some(s=>s.trim()))rows.push({grc:row[0],la:row[1],en:row[2]});}
 return {basis:anchors.length?'shared-section-markers':'printed-opening',rows};
}
function location(data,opening){
 const map=data?.pg_columns?.[text(opening)];if(!map)return null;const mode=data.pg_source||'grc',cols=[...new Set((mode==='grcla'?[...(map.grc||[]),...(map.la||[])]:map[mode]||[]).map(text))];if(!cols.length)return null;
 cols.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));return cols.length===1?'col. '+cols[0]:'cols. '+cols.join('–');
}
return {canonicalOpenings,alignOpening,printedColumns,location};
});
