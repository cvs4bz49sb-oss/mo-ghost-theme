/* Source-tree navigation, projected onto existing reader headings and pages. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.FRSourceOutline=api;})(typeof window==='undefined'?globalThis:window,function(root){
'use strict';
const string=value=>value==null?'':String(value),space=value=>string(value).replace(/\s+/g,' ').trim();
const fold=value=>space(value).normalize('NFKC').replace(/<[^>]*>/g,'').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
const pathPattern=/^\d+(?:\.\d+)*$/;
const pageKey=value=>/^\d+$/.test(string(value))?string(value).replace(/^0+(?=\d)/,''):string(value);
function hash(value){let a=2166136261,b=2246822507;
 for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);a=Math.imul(a^c,16777619)>>>0;b=Math.imul(b^c,2246822519)>>>0;}
 return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0');
}
const targetKey=(page,text,origin='')=>'s-'+hash(JSON.stringify(origin?[string(page),fold(text),string(origin)]:[string(page),fold(text)]));
const sourceFingerprint=source=>hash(JSON.stringify(source.map(row=>[row.path,row.label])));
const reviewedOverrides={"version":1,"works":{"eebo-21938":{"sourceRows":461,"sourceFingerprint":"19066cea6b501810","edits":{"1":{"title":"Part I"},"2":{"parentPath":"1"},"3":{"title":"Part II"},"4":{"parentPath":"3"},"5":{"title":"Part III"},"6":{"parentPath":"5"},"7":{"title":"Part IV"},"8":{"parentPath":"7"},"9":{"parentPath":"8"}}},"eebo-7306":{"sourceRows":214,"sourceFingerprint":"0cef8e3dfacc322f","edits":{"2":{"parentPath":"1"},"3":{"parentPath":"1"},"4":{"parentPath":"1"},"5":{"parentPath":"1"},"6":{"parentPath":"1"},"7":{"parentPath":"1"},"8":{"parentPath":"1"},"9":{"title":"The Second and Third Bookes of the Cases of Conscience"},"10":{"parentPath":"9"},"11":{"parentPath":"9"},"12":{"parentPath":"11"},"13":{"parentPath":"11"},"14":{"parentPath":"11"},"15":{"parentPath":"11"},"16":{"parentPath":"11"},"17":{"parentPath":"11"},"18":{"parentPath":"11"},"19":{"parentPath":"11"},"20":{"parentPath":"11"},"21":{"parentPath":"11"},"22":{"parentPath":"11"},"23":{"parentPath":"11"},"24":{"parentPath":"11"},"25":{"parentPath":"11"},"26":{"parentPath":"9"},"27":{"parentPath":"26"},"28":{"parentPath":"27"},"29":{"parentPath":"27"},"30":{"parentPath":"26"},"31":{"parentPath":"26"},"11.2":{"parentPath":"11.1"},"26.3":{"parentPath":"26.2"}}}}};
function withoutNotes(node){
 if(node.nodeType===3)return node.nodeValue||'';
 if(node.localName==='note'||(' '+(node.getAttribute?.('class')||'')+' ').includes(' note '))return ' ';
 return node.childNodes?.length?Array.from(node.childNodes).map(withoutNotes).join(''):node.textContent||'';
}
function openingArgumentLabel(label,html,document=root.document){
 const bare=space(label);
 if(!/^(?:chap(?:ter)?|book|sect(?:ion)?|caput|capitulum|liber|pars)\.?\s+(?:\d+|[ivxlcdm]+)\.?$/i.test(bare)||!html||!document?.createElement)return bare;
 const prefix=string(html).slice(0,4096),argument=/<div\b(?![^>]*\/>)[^>]*\bclass=["'][^"']*\barg\b[^"']*["'][^>]*>[\s\S]*?<\/div\s*>/i.exec(prefix);
 if(!argument)return bare;
 const template=document.createElement('template');template.innerHTML=prefix.slice(0,argument.index+argument[0].length);let heading=false;
 for(const node of template.content.childNodes){
  if(node.nodeType===3){if(space(node.nodeValue))return bare;continue;}
  const tag=node.localName;
  if(tag==='span'&&(' '+(node.getAttribute('class')||'')+' ').includes(' pb ')&&!space(node.textContent))continue;
  if(!heading&&['b','strong','h1','h2','h3','h4','h5','h6'].includes(tag)&&fold(node.textContent)===fold(bare)&&!node.querySelectorAll('note,ref,.note,.fnref').length){heading=true;continue;}
  if(tag!=='div'||!(' '+(node.getAttribute('class')||'')+' ').includes(' arg ')||node.querySelectorAll('note,ref,.note,.fnref,table,ul,ol,div').length)return bare;
  const subtitle=space(withoutNotes(node));
  return subtitle&&Array.from(subtitle).length<=180&&fold(subtitle)!==fold(bare)?bare+' '+subtitle:bare;
 }
 return bare;
}
function cleanLabel(label,html,document=root.document){
 let result=openingArgumentLabel(label,html,document);
 if(result.length<8||/^(?:front[ _]matter|back[ _]matter|title[ _]page|table[ _]of[ _]contents|div\d*|body|text|part|treatise)$/i.test(result)||!html||!document?.createElement||!/<span\b[^>]*class=["'][^"']*\bnote\b/i.test(html))return result;
 const fragments=/<(b|strong|h[1-6])\b[^>]*>[\s\S]*?<\/\1\s*>/gi,labelFold=fold(result);let match,parsed=0;
 // Remove only note text demonstrably embedded in this label's source head.
 // Body notes and short/numeral-only cues cannot be guessed out of a title.
 while((match=fragments.exec(html))){
  const fragment=match[0],candidate=fold(fragment);
  if(fragment.length>32768||!fragment.includes('note')||candidate.length<8||!labelFold.includes(candidate)||parsed+fragment.length>65536)continue;
  const template=document.createElement('template');template.innerHTML=fragment;parsed+=fragment.length;
  for(const heading of template.content.querySelectorAll('b,strong,h1,h2,h3,h4,h5,h6')){
  const source=fold(heading.textContent);if(source.length<8||!fold(result).includes(source))continue;
  for(const note of heading.querySelectorAll('.note')){
   const text=space(note.textContent);if(text.length<4)continue;
   const first=result.indexOf(text);if(first<0||result.indexOf(text,first+text.length)>=0)continue;
   result=space(result.slice(0,first)+' '+result.slice(first+text.length));
  }
  }
 }
 return result;
}
function displayLabel(value){return space(value).replace(/_/g,' ');}
function shortLabel(value,limit=140){
 const chars=Array.from(value);if(chars.length<=limit)return value;
 const prefix=chars.slice(0,limit-1).join(''),boundary=prefix.lastIndexOf(' ');
 return (boundary>=limit*.65?prefix.slice(0,boundary):prefix).trimEnd()+'…';
}
function targetRecords(data,tei){
 const records=[],references=new Map(),seenNodes=new Set(),headRecords=new WeakMap(),entries=Object.entries(tei?.en||{}),byPage=new Map(),ordered=[],usedPages=new Set();
 for(const page of data?.pages||[]){const key=pageKey(page.n);if(!references.has(key))references.set(key,new Set());references.get(key).add(string(page.n));}
 for(const entry of entries){const key=pageKey(entry[0]);if(!byPage.has(key))byPage.set(key,[]);byPage.get(key).push(entry);}
 for(const page of data?.pages||[])for(const entry of byPage.get(pageKey(page.n))||[])if(!usedPages.has(entry[0])){usedPages.add(entry[0]);ordered.push(entry);}
 for(const entry of entries)if(!usedPages.has(entry[0]))ordered.push(entry);
 for(const [key,nodes]of ordered){
  const aliases=references.get(pageKey(key)),page=aliases?.size===1?[...aliases][0]:string(key);
  const walk=(node,parentPath='',parentRegion='',previousSibling=null)=>{
   if(node?.nodeType!==1||seenNodes.has(node))return;seenNodes.add(node);
   const path=node.getAttribute?.('data-source-path')||parentPath,region=node.getAttribute?.('data-source-region')||parentRegion;
   if(node.localName==='head'&&pathPattern.test(path)){
    const text=space(node.textContent);if(text){
     const primary=node.__frSourcePrimaryPath===path,key=targetKey(page,text,primary?'primary':''),previous=headRecords.get(previousSibling);
     if(previous&&previousSibling.localName==='head'&&previousSibling.parentNode===node.parentNode&&previous.path===path&&previous.page===page&&previous.key===key){previous.echoCount++;headRecords.set(node,previous);}
     else{const record={path,page,text,displayText:space(withoutNotes(node)),region,key,primary,order:records.length,echoCount:1,unsupported:!aliases,ambiguous:!!aliases&&aliases.size>1||(byPage.get(pageKey(page))||[]).length>1};records.push(record);headRecords.set(node,record);}
    }
   }
   const children=node.childNodes||[];for(let i=0;i<children.length;i++)walk(children[i],path,region,children[i-1]||null);
  };
  for(let i=0;i<(nodes||[]).length;i++)walk(nodes[i],'','',nodes[i-1]||null);
 }
 const counts=new Map();for(const record of records){const key=record.path+'|'+record.key;counts.set(key,(counts.get(key)||0)+1);}
 for(const record of records)if(counts.get(record.path+'|'+record.key)>1)record.ambiguous=true;
 return records;
}
// Only explicitly numbered source heads become auxiliary navigation. Plain
// emphasis, answers, directions in running prose, and quoted titles stay out.
const number='(?:\\d+|[ivxlcdm]+)';
const auxiliaryPattern=new RegExp('^(?:(?:the\\s+)?(?:chap(?:ter)?|sect(?:ion)?|sermon|quest(?:ion)?|q|book|part|article|caput|capitulum|liber|sermo|quaestio|pars|articulus)\\.?\\s+'+number+'(?:[. :;,)–—-]|$))','i');
const numberedHeading=record=>record.displayText.length<=360&&auxiliaryPattern.test(record.displayText);
const genuineAuxiliary=record=>!record.ambiguous&&!record.unsupported&&numberedHeading(record);
function applyOverride(data,source,rows){
 const rule=reviewedOverrides.works?.[data.slug];
 if(!rule||rule.sourceRows!==source.length||rule.sourceFingerprint!==sourceFingerprint(source))return rows;
 const parents=new Map(source.map(node=>[node.path,node.parentPath])),edits=rule.edits||{},primary=new Map(),auxiliary=new Map();
 for(const [path,edit]of Object.entries(edits)){
  if(!parents.has(path)||!edit||typeof edit!=='object'||Object.keys(edit).some(key=>!['parentPath','title'].includes(key))||
     edit.title!==undefined&&(typeof edit.title!=='string'||!space(edit.title)))return rows;
  if(Object.prototype.hasOwnProperty.call(edit,'parentPath')){
   if(edit.parentPath!==null&&(!parents.has(edit.parentPath)||edit.parentPath===path))return rows;parents.set(path,edit.parentPath);
  }
 }
 const depths=new Map();
 const depth=(path,visiting=new Set())=>{if(depths.has(path))return depths.get(path);if(visiting.has(path))throw Error('Cyclic reviewed ancestry');visiting.add(path);const parent=parents.get(path),value=parent===null?1:depth(parent,visiting)+1;visiting.delete(path);depths.set(path,value);return value;};
 try{for(const path of parents.keys())depth(path);}catch(_){return rows;}
 for(const row of rows){if(row.navAuxiliary){if(!auxiliary.has(row.navSourcePath))auxiliary.set(row.navSourcePath,[]);auxiliary.get(row.navSourcePath).push(row);}else primary.set(row.navSourcePath,row);}
 const children=new Map();for(const node of source){const parent=parents.get(node.path);if(!children.has(parent))children.set(parent,[]);children.get(parent).push(node.path);}
 const result=[];const visit=path=>{const row=primary.get(path);if(!row)return;const title=edits[path]?.title;
  result.push({...row,depth:depths.get(path),navParentSourcePath:parents.get(path),...(title?{title:shortLabel(space(title)),navFullTitle:space(title)}:{})});
  result.push(...(auxiliary.get(path)||[]).map(child=>({...child,depth:depths.get(path)+1})));
  for(const child of children.get(path)||[])visit(child);};
 for(const path of children.get(null)||[])visit(path);
 return result.length===rows.length?result:rows;
}
function inspect(data,tei){
 const source=data?.eebo_source_outline,issues=[];
 if(!Array.isArray(source)||!source.length||!tei?.en)return {rows:null,issues:[{reason:'Source outline or rendered TEI is unavailable'}]};
 const nodes=new Map();
 for(const node of source){
  if(!node||!pathPattern.test(node.path)||nodes.has(node.path)||typeof node.label!=='string'||
     !Number.isInteger(node.depth)||node.depth<1||typeof node.beforeFirstPage!=='boolean')return {rows:null,issues:[{reason:'Invalid canonical outline entry'}]};
  const parent=node.path.includes('.')?node.path.slice(0,node.path.lastIndexOf('.')):null;
  if(node.parentPath!==parent||parent&&!nodes.has(parent)||node.depth!==(parent?nodes.get(parent).depth+1:1))return {rows:null,issues:[{path:node.path,reason:'Canonical ancestry is inconsistent'}]};
  nodes.set(node.path,node);
 }
 const records=targetRecords(data,tei),byPath=new Map(),firstPage=data.pages?.[0]?.n,rows=[];
 for(const record of records){if(!byPath.has(record.path))byPath.set(record.path,[]);byPath.get(record.path).push(record);}
 for(const node of source){
  const candidates=byPath.get(node.path)||[],label=space(node.label),exact=candidates.filter(record=>fold(record.text)===fold(label));
  let target=null,start=false,fullTitle=displayLabel(node.displayLabel||label);
  if(node.primaryTarget?.page!=null||node.primaryTarget?.unpaged){
   const primary=node.primaryTarget,matches=candidates.filter(record=>fold(record.text)===fold(primary.text)&&(primary.page==null||record.page===string(primary.page))&&(!primary.key||record.key===primary.key)&&(!primary.origin||record.primary===(primary.origin==='primary')));
   if(matches.length!==1||matches[0].ambiguous||matches[0].unsupported){issues.push({path:node.path,reason:'Recorded canonical heading has no unique mapped target'});continue;}
   target=matches[0];
  }
  else if(exact.length===1&&!exact[0].ambiguous&&!exact[0].unsupported)target=exact[0];
  else if(exact.length){issues.push({path:node.path,reason:'Repeated canonical heading has no unique target'});continue;}
  else if(!label){target=candidates.find(genuineAuxiliary)||null;if(target)fullTitle=displayLabel(target.displayText);}
  else if(node.beforeFirstPage&&firstPage!=null)start=true;
  else if(candidates.length===1&&!candidates[0].ambiguous&&!candidates[0].unsupported)target=candidates[0];
  if(!fullTitle){issues.push({path:node.path,reason:'Source node has no supported display label'});continue;}
  if(!target&&!start){issues.push({path:node.path,reason:candidates.some(record=>record.ambiguous)?'Source heading targets are ambiguous':'Canonical heading has no supported emitted target'});continue;}
  const page=start?string(firstPage):target.page;
  const row={title:shortLabel(fullTitle),navFullTitle:fullTitle,navRawLabel:node.label,page,depth:node.depth,navDepthExact:true,
   navSourcePath:node.path,navSourceText:target?.text||label,navParentSourcePath:node.parentPath,sourceRegion:node.region||target?.region||'body'};
  if(start)row.navPageStart=page;else row.navSourceKey=target.key;
  rows.push(row);
  const used=new Set(target?[target.key]:[]);
  for(const record of candidates){
   if(record.unsupported&&numberedHeading(record)){issues.push({path:node.path,reason:'Auxiliary heading is on an unmapped source page'});continue;}
   if(record.ambiguous&&numberedHeading(record)){issues.push({path:node.path,reason:'Repeated auxiliary heading has no unique target'});continue;}
   if(used.has(record.key)||!genuineAuxiliary(record)||fold(record.text)===fold(label))continue;
   used.add(record.key);const title=displayLabel(record.displayText);
   rows.push({title:shortLabel(title),navFullTitle:title,page:record.page,depth:node.depth+1,navDepthExact:true,
    navSourcePath:node.path,navSourceText:record.text,navSourceKey:record.key,navParentSourcePath:node.path,navAuxiliary:true,sourceRegion:node.region||record.region||'body'});
  }
 }
 // An incomplete new projection must not silently replace the published outline.
 return {rows:issues.length?null:rows.length?applyOverride(data,source,rows):null,issues};
}
const outlineCache=new WeakMap();
function outline(data,tei){
 if(!data||typeof data!=='object')return null;
 const source=data.eebo_source_outline,pages=data.pages,cached=outlineCache.get(data);
 if(cached&&cached.source===source&&cached.sourceLength===source?.length&&cached.tei===tei&&cached.en===tei?.en&&cached.pages===pages&&cached.pageLength===pages?.length)return cached.rows;
 const rows=inspect(data,tei).rows;
 outlineCache.set(data,{source,sourceLength:source?.length,tei,en:tei?.en,pages,pageLength:pages?.length,rows});return rows;
}
return {outline,inspect,targetKey,targetRecords,sourceFingerprint,cleanLabel,openingArgumentLabel};
});
