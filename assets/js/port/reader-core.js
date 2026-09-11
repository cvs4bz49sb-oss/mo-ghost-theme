
const $=s=>document.querySelector(s),el=(t,c)=>{const e=document.createElement(t);if(c)e.className=c;return e;};
// guarded storage: Safari private mode / quota-exceeded throws on writes — never let that kill a save path
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
// margin-note rail only when the reading area is wide enough for two columns + two gutters (2026-09-02)
(function(){const upd=()=>{const r=document.getElementById('reading');if(!r)return;document.documentElement.classList.toggle('railok',r.getBoundingClientRect().width>=1180);};
  addEventListener('resize',upd);document.addEventListener('DOMContentLoaded',()=>{upd();try{new ResizeObserver(upd).observe(document.getElementById('reading'));}catch(e){}});setTimeout(upd,800);})();
const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
// Blob CDN mode: when the deploy build injects __FR_BLOB_BASE__, all data loads come from Blob; otherwise local server
const BLOB=(window.__FR_BLOB_BASE__&&!/TBD/.test(String(window.__FR_BLOB_BASE__)))?String(window.__FR_BLOB_BASE__).replace(/\/+$/,""):null;
// family identity: ?site= (proof) → window.__FR_SITE__ (deploy env) → default. Loads the sibling's display font on demand.
(function(){const SF={aquinas:"Cardo:ital@0;1",pld:"Spectral:ital,wght@0,400;0,600;1,400",graeca:"GFS+Didot"};
  const s=new URLSearchParams(location.search).get("site")||window.__FR_SITE__||document.documentElement.dataset.site||"faith-received";
  if(["faith-received","aquinas","pld","graeca"].indexOf(s)>=0){document.documentElement.dataset.site=s;
    if(SF[s]){const l=el("link");l.rel="stylesheet";l.href="https://fonts.googleapis.com/css2?family="+SF[s]+"&display=swap";document.head.appendChild(l);}}})();
const esc=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
// editorially-supplied section headings come bracketed (e.g. "[Testimony of Scripture]"); show them
// without the brackets in headings + contents nav (only unwrap when the WHOLE label is bracketed).
const deBracket=s=>(s||"").replace(/^\s*\[\s*(.+?)\s*\]\s*$/,"$1");
function inl(s,scripture=true){s=esc(s);
  s=s.replace(/^\s*\*([^*\n]{2,600}?)\*\s*$/,"<em>$1</em>");   // whole-block argumentum — Migne prints per-epistle summaries in italic, often >200 chars (pg-419); both ends anchored = no bleed risk
  s=s.replace(/\*\*([^*\n]{1,200}?)\*\*/g,"<strong>$1</strong>").replace(/\*([^*\n]{1,200}?)\*/g,"<em>$1</em>")   // 2026-08-23: a bold/italic pair is at most 200 chars on one line — Baxter p31 had `5.** …` pair with a stray ** 3,000 chars later and the whole page went bold
  .replace(/\*\*/g,"")   // bold spans split across paragraphs leave a stray unpaired ** — never show it literally (965 pages: Baxter list numbers, Buddeus cross-page bold)
  .replace(/\[\^([^\]]+)\](?!:)/g,(_,id)=>{const a=id.replace(/"/g,"&quot;");
    if(/^v\d+n\d+$/.test(id))return `<sup class="fnref deg fvar" data-fn="${a}" title="textual variant" role="button" tabindex="0" aria-label="Textual variant">°</sup>`;   // apparatus variant → dimmest mark
    return (id.length>4||/^(\d+n\d+|ed\d+)$/.test(id))
      ?`<sup class="fnref deg" data-fn="${a}" title="${a}" role="button" tabindex="0" aria-label="Note ${a}">°</sup>`   // named/positional note → quiet ° mark (id on hover)
      :`<sup class="fnref" data-fn="${a}" role="button" tabindex="0" aria-label="Note ${a}">${id}</sup>`;})
  .replace(/\u2045/g,'<span class="citedup">').replace(/\u2046/g,"</span>")
  // PG INLINE STRUCTURE (owner 2026-08-27 pg-419): loadPgCanon sentinels run-together
  // printed heads (CLASS FIRST / EPISTLE I) and long italic argumenta — render them
  .replace(/\u0002([^\u0002\u0003]{1,160}?)\u0003/g,'<span class="inhead">$1</span>')
  .replace(/^([^\u0004\u0005]*)\u0005/,"<i>$1</i>").replace(/\u0004/g,"<i>").replace(/\u0005/g,"</i>")
  .replace(/\u0006([^\u0006]*)$/,'<span class="milat">$1</span>')
  .replace(/[\u0002-\u0006]/g,"");
  return scripture?linkScriptureHTML(s):s;}
// scripture book shapes: EN full names + the common Latin abbreviations of this corpus
const XREF_CAP={"Matthew":28,"Mark":16,"Luke":24,"John":21,"Acts":28,"Romans":16,"Corinthians":16,
  "Galatians":6,"Ephesians":6,"Philippians":4,"Colossians":4,"Thessalonians":5,"Timothy":6,"Titus":3,
  "Hebrews":13,"James":5,"Peter":5,"Jude":1,"Revelation":22,"Genesis":50,"Exodus":40,"Leviticus":27,
  "Numbers":36,"Deuteronomy":34,"Joshua":24,"Judges":21,"Kings":25,"Samuel":31,"Chronicles":36,
  "Psalms":150,"Psalm":150,"Proverbs":31,"Ecclesiastes":12,"Isaiah":66,"Jeremiah":52,"Ezekiel":48,
  "Daniel":12,"Hosea":14,"Job":42,"Song of Songs":8,"Lamentations":5,"Obadiah":1,"Habakkuk":3,
  "Zephaniah":3,"Haggai":2,"Zechariah":14,"Malachi":4,"Ezra":10,"Nehemiah":13,"Esther":10,
  "Joel":3,"Amos":9,"Jonah":4,"Micah":7,"Nahum":3,"Ruth":4,"Philemon":1,"Judith":16,
  "1 Samuel":31,"2 Samuel":24,"1 Kings":22,"2 Kings":25,"1 Chronicles":29,"2 Chronicles":36,
  "1 Corinthians":16,"2 Corinthians":13,"1 Thessalonians":5,"2 Thessalonians":3,
  "1 Timothy":6,"2 Timothy":4,"1 Peter":5,"2 Peter":3,"1 John":5,"2 John":1,"3 John":1};
const XREF_EN={"Matth":"Matthew","Matt":"Matthew","Marc":"Mark","Luc":"Luke","Ioh":"John","Joh":"John",
  // short English abbreviations (owner 2026-09-11 "Dt. 6; Mt. 22 … not ingested as scripture links" — Valdés catechism): only the
  // unambiguous two/three-letter forms; Ex/Is/Ac/Am are left out because they are ordinary English words at sentence start
  "Dt":"Deuteronomy","Mt":"Matthew","Mk":"Mark","Lk":"Luke","Jn":"John","Gn":"Genesis","Lv":"Leviticus","Nm":"Numbers",
  "Dn":"Daniel","Rm":"Romans","Hb":"Hebrews","Jas":"James","Jdg":"Judges","Ezk":"Ezekiel","Zec":"Zechariah","Zech":"Zechariah",
  "Mic":"Micah","Zep":"Zephaniah","Hag":"Haggai","Jl":"Joel","Est":"Esther","Ecc":"Ecclesiastes","Eccles":"Ecclesiastes",
  "Lam":"Lamentations","Jdt":"Judith","Rv":"Revelation","Prv":"Proverbs",
  // Latin abbreviations of the PL corpus (owner 2026-08-17 'does scripture hover work?'):
  // Joan. is Migne's John; Reg./Paral. are Vulgate-numbered and resolved by prefix below
    // Latin abbreviations of the PL corpus (owner 2026-08-17 'does scripture hover work?'):
  // Joan. is Migne's John; Reg./Paral. are Vulgate-numbered and resolved by prefix below
  "Joan":"John","Joann":"John","Ioann":"John","Isai":"Isaiah","Isa":"Isaiah","Num":"Numbers",
  "Judic":"Judges","Cant":"Song of Songs","Thren":"Lamentations","Osee":"Hosea","Abd":"Obadiah",
  "Habac":"Habakkuk","Soph":"Zephaniah","Agg":"Haggai","Zach":"Zechariah","Malach":"Malachi",
  "Galat":"Galatians","Philipp":"Philippians","Coloss":"Colossians","Job":"Job",
  "Esdr":"Ezra","Nehem":"Nehemiah","Judith":"Judith",
  "Rom":"Romans","Cor":"Corinthians","Gal":"Galatians","Ephes":"Ephesians","Eph":"Ephesians",
  "Phil":"Philippians","Col":"Colossians","Thess":"Thessalonians","Tim":"Timothy","Tit":"Titus",
  "Hebr":"Hebrews","Heb":"Hebrews","Iac":"James","Jac":"James","Pet":"Peter","Apoc":"Revelation","Rev":"Revelation",
  "Gen":"Genesis","Genes":"Genesis","Exod":"Exodus","Levit":"Leviticus","Deut":"Deuteronomy",
  "Psal":"Psalms","Ps":"Psalms","Psalm":"Psalms","Prov":"Proverbs","Eccl":"Ecclesiastes","Esa":"Isaiah",
  "Ier":"Jeremiah","Jer":"Jeremiah","Ezech":"Ezekiel","Dan":"Daniel","Act":"Acts",
  // German abbreviations (Luther WA corpus, 2026-08-17): Mos is book-numbered 1–5 and is
  // resolved by its digit prefix in the linkifier, not here
  "Röm":"Romans","Roem":"Romans","Offb":"Revelation","Apgsch":"Acts","Apg":"Acts",
  "Jes":"Isaiah","Pred":"Ecclesiastes","Hes":"Ezekiel","Sach":"Zechariah","Richt":"Judges",
  "Klagel":"Lamentations","Spr":"Proverbs","Kön":"Kings","Koen":"Kings","Kon":"Kings",
  "Esr":"Ezra","Neh":"Nehemiah","Esth":"Esther","Hiob":"Job","Jos":"Joshua",
  "Zeph":"Zephaniah","Hagg":"Haggai","Mal":"Malachi","Micha":"Micah","Mich":"Micah",
  "Nah":"Nahum","Hab":"Habakkuk","Jon":"Jonah","Joel":"Joel","Hos":"Hosea","Sam":"Samuel",
  "Jak":"James","Petr":"Peter","Kor":"Corinthians","Phlm":"Philemon","Matth":"Matthew",
  "Marck":"Mark","Luk":"Luke"};
// numbered-Mos books + prefix validity: 4/5 prefixes exist ONLY for Mos; 3 only for John
const XREF_MOS={1:"Genesis",2:"Exodus",3:"Leviticus",4:"Numbers",5:"Deuteronomy"};
const XREF_NAMES=[...new Set([...Object.keys(XREF_CAP).filter(name=>!/^\d/.test(name)),...Object.keys(XREF_EN),'Mos','Reg','Paral'])].sort((a,b)=>b.length-a.length);
const XREF_LOOKUP=new Map(XREF_NAMES.map(name=>[name.toLowerCase(),name]));
const XREF_RE=new RegExp('(^|[^\\p{L}\\p{N}_])((?:(?:[1-5]|III|II|IV|I|V)\\.?\\s*)?(?:'+XREF_NAMES.map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')\\.?)(\\s*)','giu');
function scriptureNumber(value){
  const roman=String(value).toUpperCase();if(/^\d+$/.test(roman))return Number(roman);
  if(!roman||!/^(?=[MDCLXVI]+$)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(roman))return null;
  const values={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};let n=0;for(let i=0;i<roman.length;i++)n+=(values[roman[i]]<(values[roman[i+1]]||0)?-1:1)*values[roman[i]];return n;
}
function scriptureBook(value){
  const match=String(value).match(/^([1-5])\.?\s*(.+)$/)||String(value).match(/^(III|II|IV|I|V)(?:\.\s*|\s+)(.+)$/i),prefix=match?scriptureNumber(match[1]):null,raw=(match?match[2]:value).replace(/\.$/,''),base=XREF_LOOKUP.get(raw.toLowerCase())||raw;
  if(base==='Mos')return prefix?XREF_MOS[prefix]||null:null;
  if(base==='Reg')return prefix&&prefix<=4?(prefix<=2?prefix+' Samuel':(prefix-2)+' Kings'):null;
  if(base==='Paral')return prefix&&prefix<=2?prefix+' Chronicles':null;
  const name=XREF_EN[base]||base;
  if(prefix)return XREF_CAP[prefix+' '+name]?prefix+' '+name:null;
  if(/^(Samuel|Kings|Chronicles|Corinthians|Thessalonians|Timothy|Peter)$/.test(name))return null;
  return XREF_CAP[name]?name:null;
}
function scriptureVerses(selection){
  if(!selection)return [];
  const verses=[];for(const part of String(selection).split(',')){
    const match=/^(\d{1,3})(?:-(\d{1,3}))?$/.exec(part);if(!match)return null;
    const first=Number(match[1]),last=Number(match[2]||match[1]);if(first<1||last<first||last>200)return null;
    for(let verse=first;verse<=last;verse++)if(!verses.includes(verse))verses.push(verse);
  }return verses;
}
// Shared with the Scripture preview: q is canonical Arabic chapter plus explicit verse list/range.
function parseScriptureQuery(query){
  const match=/^(.+?)\s+(\d{1,3})(?::([\d,-]+))?$/.exec(String(query||''));if(!match)return null;
  const book=scriptureBook(match[1]),chapter=Number(match[2]),selection=match[3]||'',verses=scriptureVerses(selection);
  if(!book||!chapter||chapter>XREF_CAP[book]||!verses)return null;
  return {book,chapter,ch:chapter,verse:verses[0]||null,verses,selection,query:book+' '+chapter+(selection?':'+selection:'')};
}
function scriptureLocation(text,start,book){
  const chapterToken=/^([IVXLCDMivxlcdm]+|\d{1,3})(?![\p{L}\p{N}])/u.exec(text.slice(start));if(!chapterToken)return null;
  const chapter=scriptureNumber(chapterToken[1]);if(!chapter||chapter>XREF_CAP[book])return null;
  let end=start+chapterToken[0].length,selection='',following=false;
  const first=/^\s*[.:,]\s*(?:v\.\s*)?(\d{1,3})(?![\p{L}\p{N}])/u.exec(text.slice(end));
  if(!first&&/^\s*[.:,]\s*(?:v\.\s*)?\d/.test(text.slice(end)))return null;
  if(first){
    if(Number(first[1])<1||Number(first[1])>200)return null;
    selection=String(Number(first[1]));end+=first[0].length;let previous=Number(first[1]);
    while(true){
      const range=/^\s*\.?\s*[–—-]\s*(\d{1,3})(?![\p{L}\p{N}])/u.exec(text.slice(end));
      if(range){const last=Number(range[1]);if(last<previous||last>200)return null;selection+='-'+last;end+=range[0].length;previous=last;}
      const list=/^\s*,\s*(\d{1,3})(?![\p{L}\p{N}])/u.exec(text.slice(end));
      if(!list||/^\s*(?::\s*|\.)\d{1,3}(?![\p{L}\p{N}])/u.test(text.slice(end+list[0].length)))break;
      previous=Number(list[1]);if(!previous||previous>200)return null;selection+=','+previous;end+=list[0].length;
    }
    const tail=/^\s*\.?\s*(?:(?:&amp;|&|et)\s*)?(?:seqq?\.|ff?\.)(?!\p{L})/u.exec(text.slice(end));
    if(tail){end+=tail[0].length;following=true;}
  }
  return {start,end,book,chapter,selection,following,query:book+' '+chapter+(selection?':'+selection:'')};
}
function scriptureReferences(text){
  const references=[];XREF_RE.lastIndex=0;let match;
  while((match=XREF_RE.exec(text))){
    if(!match[2].endsWith('.')&&!match[3])continue;
    const book=scriptureBook(match[2]);if(!book)continue;
    let reference=scriptureLocation(text,XREF_RE.lastIndex,book);if(!reference)continue;
    // Lowercase ordinary words such as "mark 3 items" are not chapter citations.
    const plainBook=match[2].replace(/\.$/,'');if(plainBook===plainBook.toLowerCase()&&!reference.selection&&(!match[2].endsWith('.')||plainBook===book.toLowerCase()))continue;
    reference.start=match.index+match[1].length;references.push(reference);
    while(reference.selection){
      const separator=/^\s*(?:,|;|&amp;|&|et\b)\s*/.exec(text.slice(reference.end))||/^\s*\.\s*(?=[IVXLCDM]+\s*[.:,]\s*\d)/i.exec(text.slice(reference.end));if(!separator)break;
      const next=scriptureLocation(text,reference.end+separator[0].length,book);if(!next?.selection)break;
      references.push(next);reference=next;
    }
    XREF_RE.lastIndex=reference.end;
  }return references;
}
function linkScriptureHTML(html){
  const tokens=String(html).split(/(<[^>]*>)/g),output=tokens.slice(),stack=[];let run=[];
  const flush=()=>{
    if(!run.length)return;let text='',offset=0;const segments=run.map(index=>{const segment={index,start:offset,end:offset+tokens[index].length};text+=tokens[index];offset=segment.end;return segment;});
    const references=scriptureReferences(text);
    for(const segment of segments){let value='',cursor=segment.start;for(const ref of references){const start=Math.max(segment.start,ref.start),end=Math.min(segment.end,ref.end);if(start>=end)continue;
        value+=text.slice(cursor,start);const part=text.slice(start,end),fallback=/[,-]/.test(ref.selection)?ref.book+' '+ref.chapter:ref.query;
        value+=part.trim()?'<a class="xref" target="_blank" rel="noopener" data-scripture-ref="'+esc(ref.query).replace(/"/g,'&quot;')+'" href="/the-faith-received/search/?m=scripture&amp;q='+encodeURIComponent(fallback)+'"'+(ref.following?' data-xref-following="true"':'')+' title="Read Scripture">'+part+'</a>':part;cursor=end;}
      output[segment.index]=value+text.slice(cursor,segment.end);}
    run=[];
  };
  for(let i=0;i<tokens.length;i++){
    const token=tokens[i];if(!token.startsWith('<')){if(!stack.some(item=>item.blocked))run.push(i);continue;}
    const match=/^<\s*(\/)?\s*([\w:-]+)/.exec(token);if(!match){flush();continue;}
    const name=match[2].toLowerCase(),closing=!!match[1],entry=closing?stack.findLast(item=>item.name===name):null;
    const blocked=/^(a|script|style|code|button|sup|textarea)$/.test(name),boundary=blocked||!/^(i|em|b|strong|span|small|u|s|mark|abbr)$/.test(name)||/\bmnote\b/.test(token)||entry?.boundary;
    if(boundary)flush();
    if(closing){const index=stack.map(item=>item.name).lastIndexOf(name);if(index>=0)stack.splice(index);}
    else if(!/\/>$/.test(token)&&!/^(br|hr|img|input|wbr|meta|link)$/.test(name))stack.push({name,blocked,boundary});
  }
  flush();return output.join('');
}
window.FRReaderScripture={parseQuery:parseScriptureQuery};
// Link only unambiguous citation metadata across adjacent paragraphs, never move source text.
function scriptureParagraphContinuation(previous,next){
  const prior=scriptureReferences(previous).at(-1),leading=(/^\s*/.exec(next)||[''])[0].length,body=next.slice(leading);
  if(prior&&!prior.selection&&/^[\s.]*$/.test(previous.slice(prior.end))){
    const prefix=prior.chapter+':',joined=scriptureLocation(prefix+body,0,prior.book);
    if(!joined?.selection)return null;
    const end=leading+joined.end-prefix.length,rest=next.slice(end).replace(/^[\s.,;]*(?:(?:&|et)\s*)?/,'');
    const following=scriptureReferences(rest)[0];if(!following||following.start!==0||!following.selection)return null;
    return {...joined,previousStart:prior.start,previousEnd:prior.end,start:leading,end};
  }
  // A bare, explicit book abbreviation may end a paragraph: "Apoc." / "XVI.5. II. God…".
  XREF_RE.lastIndex=0;let match,last;while((match=XREF_RE.exec(previous)))if(/^[\s.]*$/.test(previous.slice(XREF_RE.lastIndex)))last=match;
  if(!last||!last[2].endsWith('.')||!/^\s*[IVXLCDM]+\s*[.:,]\s*\d/i.test(next))return null;
  const book=scriptureBook(last[2]),location=book&&scriptureLocation(next,leading,book);if(!location?.selection)return null;
  return {...location,previousStart:last.index+last[1].length,previousEnd:last.index+last[1].length+last[2].length};
}
function scriptureDOMText(root){
  const nodes=[];let text='';const walk=node=>{if(node.nodeType===3){const start=text.length;text+=node.nodeValue||'';nodes.push({node,start,end:text.length});}else for(const child of node.childNodes||[])walk(child);};walk(root);return {text,nodes};
}
function setScriptureAnchor(anchor,reference){
  const fallback=/[,-]/.test(reference.selection)?reference.book+' '+reference.chapter:reference.query;
  anchor.classList.add('xref');anchor.setAttribute('data-scripture-ref',reference.query);anchor.setAttribute('href','/the-faith-received/search/?m=scripture&q='+encodeURIComponent(fallback));
  anchor.setAttribute('target','_blank');anchor.setAttribute('rel','noopener');anchor.setAttribute('title','Read Scripture');
  if(reference.following)anchor.setAttribute('data-xref-following','true');else anchor.removeAttribute('data-xref-following');
}
function linkScriptureDOMRange(map,start,end,reference){
  for(const item of map.nodes){const from=Math.max(start,item.start)-item.start,to=Math.min(end,item.end)-item.start;if(from>=to)continue;
    let node=item.node;if(!node.nodeValue.slice(from,to).trim())continue;
    const existing=node.parentElement?.closest('a');if(existing){if(existing.classList.contains('xref'))setScriptureAnchor(existing,reference);continue;}
    if(to<node.nodeValue.length)node.splitText(to);if(from>0)node=node.splitText(from);
    const anchor=(node.ownerDocument||document).createElement('a');setScriptureAnchor(anchor,reference);node.parentNode.insertBefore(anchor,node);anchor.appendChild(node);
  }
}
function enhanceScriptureContinuations(root){
  const folios=root.matches?.('.folio')?[root]:Array.from(root.querySelectorAll('.folio'));
  for(const folio of folios)for(const lane of ['en','la']){
    const paragraphs=Array.from(folio.querySelectorAll('p')).filter(p=>{const row=p.closest('.row'),cell=p.closest('.en,.la');return p.closest('.folio')===folio&&cell?.classList.contains(lane)&&row&&!row.matches('.rhead,.rapp,.rtoc,.furn,.redit');});
    for(let i=1;i<paragraphs.length;i++){
      const before=paragraphs[i-1],after=paragraphs[i],beforeRow=before.closest('.row'),afterRow=after.closest('.row');
      if(before.parentNode===after.parentNode?before.nextElementSibling!==after:beforeRow.nextElementSibling!==afterRow)continue;
      const prior=scriptureDOMText(before),next=scriptureDOMText(after),reference=scriptureParagraphContinuation(prior.text,next.text);if(!reference)continue;
      const affected=prior.nodes.filter(item=>item.end>reference.previousStart&&item.start<reference.previousEnd),anchors=affected.map(item=>item.node.parentElement?.closest('a')).filter(Boolean);
      if(anchors.some(anchor=>!anchor.classList.contains('xref')||parseScriptureQuery(anchor.getAttribute('data-scripture-ref'))?.selection))continue;
      if(next.nodes.some(item=>item.end>reference.start&&item.start<reference.end&&item.node.parentElement?.closest('a')))continue;
      linkScriptureDOMRange(prior,reference.previousStart,reference.previousEnd,reference);linkScriptureDOMRange(next,reference.start,reference.end,reference);
    }
  }
}
                  // classic siglum (a, b, 1, †) → superscript
// ---- apparatus criticus (footnotes) ----------------------------------------------------------
// 142 works store scholarly notes as Markdown footnotes: "[^id]" anchors in the body + "[^id]: note"
// definition lines. Display-only split: definitions are pulled out before blocks() and banked at the
// folio FOOT (critical-edition style, la∥en paired by id). pg.la/pg.en stay FULL text so review-mode
// whole-page editing round-trips losslessly. Works without footnotes are untouched.
function splitApp(t){
  const lines=(t||"").split("\n"),main=[],notes=[];let cur=null;
  const D=/^\s*\[\^([^\]]+)\]:\s*(.*)$/;
  for(const ln of lines){
    const m=ln.match(D);
    if(m){cur={id:m[1],text:m[2]};notes.push(cur);continue;}
    if(cur&&ln.trim()&&!/^\s*(#{2,}|\[\[)/.test(ln)){cur.text+=" "+ln.trim();continue;}  // note continuation until blank/heading
    cur=null;main.push(ln);
  }
  // drop content-free notes whose whole text is a lone printed margin siglum (e.g. "b", "c.") — these are
  // OCR'd margin-link letters, not real notes; also strip their now-dangling in-body anchors. Real notes/refs kept.
  const drop=new Set(notes.filter(n=>/^[a-zA-Z][.,;:)]?$/.test((n.text||"").trim())).map(n=>n.id));
  const keep=notes.filter(n=>!drop.has(n.id));
  let body=main.join("\n");
  if(drop.size)drop.forEach(id=>{body=body.split("[^"+id+"]").join("");});
  // display-only: some works (Althusius-class legal texts) carry each citation BOTH inline
  // after its anchor AND as the def — the def bank keeps the text; the inline copy collapses
  // behind the anchor (hover/focus reveals). Content is never modified, only wrapped.
  const dm={};keep.forEach(n=>{const f=_cdFold(n.text);if(f.length>=10)dm[n.id]=f;});
  if(Object.keys(dm).length){
    body=body.replace(/\[\^([^\]]+)\](?!:)([ \t]*)([^\[\n]{0,90})/g,(w,id,sp,after)=>{
      const fd=dm[id];if(!fd)return w;
      if(!_cdFold(after).startsWith(fd))return w;
      let acc="",k=0;
      for(const ch of after){k++;acc+=ch;if(_cdFold(acc)===fd)break;}
      const tp=/^[ \t]*[.,;][ \t]*/.exec(after.slice(k));   // orphan punctuation after the citation collapses with it
      if(tp)k+=tp[0].length;
      return "[^"+id+"]"+sp+"\u2045"+after.slice(0,k)+"\u2046"+after.slice(k);});
  }
  return {main:body,notes:keep};
}
function _cdFold(s){return (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9§]/g,"");}
function appBank(laN,enN){
  // junk guard (owner 2026-08-18 WA screenshots: a '¹ / |' fragment rendered as a note row):
  // a note whose text carries fewer than 3 letters/digits is an OCR shard, not apparatus
  const _sub=n=>((n.text||"").match(/[A-Za-zÀ-ÿ0-9Ͱ-Ͽ]/g)||[]).length>=3;
  laN=laN.filter(_sub);enN=enN.filter(_sub);
  if(!laN.length&&!enN.length)return null;
  // positional binding: printed cues repeat on a folio (two "(*)" notes, per-column "1"s) —
  // a Map keyed by id collapses them to the LAST def, so every LA repeat paired with the same
  // EN text (bossuet Defensio p252 rendered the Goldastus note twice). Queue per id instead:
  // k-th LA note of id X pairs with k-th EN note of id X; unconsumed EN notes render en-only.
  const emq=new Map();enN.forEach(n=>{if(!emq.has(n.id))emq.set(n.id,[]);emq.get(n.id).push(n);});
  const take=id=>{const q=emq.get(id);return q&&q.length?q.shift():null;};
  const laIds=new Set(laN.map(n=>n.id));
  const frag=document.createDocumentFragment();let first=true;
  const nN=Math.max(laN.length,enN.length);
  // Notes start on demand for every edition. The version gate also rejects a
  // stale Show all preference before the deferred footnote enhancer is ready.
  const _appx=window.FRFootnotes?.defaultExpanded?.()??(lsGet("fr_notes_default_version")==="2026-09-09-hidden"&&lsGet("fr_appx")==="1");
  const tog=el("button","apptog"+(_appx?" open":""));tog.type="button";
  // Akademie works: say what the bank holds — "3 notes · 14 textual variants" reads honestly,
  // "17 notes" oversells editorial content when most rows are collation apparatus.
  const _nv=laN.concat(enN.filter(n=>!new Set(laN.map(x=>x.id)).has(n.id))).filter(n=>/^v\d+n\d+$/.test(n.id)).length;
  const _nr=nN-_nv;
  const lbl=_nv>0?`${_nr?_nr+(_nr===1?" note":" notes")+" · ":""}${_nv} textual variant${_nv===1?"":"s"} on this folio`
                 :nN+(nN===1?" note":" notes")+" on this folio";
  tog.dataset.noteLabel=lbl;tog.textContent=(tog.classList.contains("open")?"Hide ":"Show ")+lbl;tog.setAttribute("aria-expanded",String(tog.classList.contains("open")));
  tog.onclick=()=>{const on=tog.classList.toggle("open");
    tog.textContent=(on?"Hide ":"Show ")+lbl;tog.setAttribute("aria-expanded",String(on));window.FRFootnotes?.refreshDisplay();};
  frag.appendChild(tog);window.FRFootnotes?.refreshDisplay();
  // REHAUL P4 (2026-08-17): "band" mode — unanchored apparatus (Trent: ~14k notes vs 800 refs,
  // ratio ~0.06, well under the 0.3 threshold computed in loadTEI) has no callout to hang a
  // numeral on, so — per DESIGN.md §1.4 — this does NOT try to invent one. One new branch, gated
  // strictly behind TEI_ON && APPARATUS_MODE==="band" so every classic-pipeline call to appBank()
  // (APPARATUS_MODE stays at its "anchored" default whenever loadTEI() never ran) takes the exact
  // same numbered/sigla-keyed path as today, unchanged below. Renders as one continuous unnumbered
  // band in source order — apparatus-criticus register, not a footnote list — reusing the same
  // .apptog collapse toggle above via the ~.row.rapp sibling-selector (541) since this row still
  // carries the .rapp class. teiNote() (registers into __TEINOTES) is untouched.
  if(TEI_ON&&APPARATUS_MODE==="band"){
    // REVIEW FIX (2026-08-17): the first version of this branch only rendered laN plus
    // EN notes with NO la-side id match at all, silently dropping every EN translation that
    // shares an id with an LA note — verified against live data this is the MAJORITY case, not
    // an edge case (Trent vol.1: 83.8% of LA foot-note ids have a matching EN note), so the bug
    // would have erased almost the entire English apparatus on exactly the works APPARATUS_MODE
    // targets, on an English-primary reading site. Fixed to reuse the same take()/emq positional
    // pairing the anchored path below already uses: pop each LA note's matching EN translation by
    // id and prefer it (English-primary), falling back to the LA text only when no EN pair
    // exists; genuinely EN-only notes (no LA id at all) are appended after, same as anchored mode.
    const parts=[];
    laN.forEach(l=>{const e=take(l.id);parts.push((e&&e.text&&e.text.trim())?e.text:l.text);});
    enN.forEach(e=>{const q=emq.get(e.id);if(q&&q.includes(e))parts.push(e.text);});
    const band=el("div","row rapp appband"+(first?" fst":""));
    band.innerHTML=`<div class="apbfull">${parts.map(t=>`<span class="apbe">${inl(t)}</span>`).join("")}</div>`;
    frag.appendChild(band);
    return frag;
  }
  // classic sigla (a, b, 1, †) carry a superscript id; NAMED notes (lapide-style marginalia,
  // e.g. "Fuga dignitatis", "Sanderus") carry an italic lemma label instead — as the printed margin reads.
  // Akademie-style POSITIONAL ids (Leibniz: "502n3" refs, "v502n1" variants, "ed61" headnotes) are
  // machine keys, not lemmata — never shown as labels; variants group dimmed behind a sigla-key divider.
  const AKAD=id=>/^(v?\d+n\d+|ed\d+)$/.test(id);
  const ret=id=>`<a class="fn-ret" href="#" data-fn="${esc(id)}" title="Return to the text">↑</a>`;
  // 2026-07-29 apparatus-id normalization: the vision campaigns bank several apparatus TYPES under
  // machine ids — c<N>/c<letter> (printed foot-note cues), mg (margin glosses), cx/ccont/dz* (uncued
  // or continuation notes). Show the printed cue, label margins as "margin", dagger the uncued —
  // never leak the machine prefix into the page.
  const NID=id=>{if(/^mg\d*$/.test(id))return{lem:"margin"};
    if(/^fn\d*-\d+-\d+$/.test(id))return{plain:true};                  // fnN-<page>-<k> positional footnotes (Vitringa): cue lives in the text, never show the id
    if(/^(a|tr)\d+-\d+$/.test(id))return{plain:true};                 // WA page-keyed apparatus ids: the note text carries its own printed cue ("6) …", "33 viri")
    if(/^(cx\d*|ccont\d*|dz\w*|x\d*)$/.test(id))return{sup:"†"};
    if(/^v\d+$/.test(id))return{lem:"variant"};                       // critical-apparatus collation notes ([^v1] lemma] reading)
    if(/^v[a-e]$/.test(id))return{sup:id[1]+")",lem:"variant"};          // lettered witness variants (Finke: a) B donans)
    const mm=/^m(\d{1,3})$/.exec(id);if(mm)return{sup:mm[1]};          // vasquez-class numbered margin notes [^m23]
    const m=/^c(\d{1,3}|[a-z])(\d*)$/.exec(id);if(m)return{sup:m[1]+(m[2]||"")};return null;};
  const cell=(side,n)=>{if(!n)return `<div class="${side}" lang="${side==="la"?"la":"en"}"></div>`;
    const nd=NID(n.id);
    const inner=(AKAD(n.id)||(nd&&nd.plain))?`${inl(n.text)}${ret(n.id)}`
      :nd&&nd.lem?`<span class="fnlem">${esc(nd.lem)}</span><span class="fnsep">—</span>${inl(n.text)}${ret(n.id)}`
      :nd&&nd.sup?`<sup class="fnid">${esc(nd.sup)}</sup><span class="fnsp"> </span>${inl(n.text)}${ret(n.id)}`
      :n.id.length>4
      ?`<span class="fnlem">${esc(n.id)}</span><span class="fnsep">—</span>${inl(n.text)}${ret(n.id)}`
      :`<sup class="fnid">${esc(n.id)}</sup><span class="fnsp"> </span>${inl(n.text)}${ret(n.id)}`;
    return `<div class="${side}" lang="${side==="la"?"la":"en"}">${inner}</div>`;};
  const mk=(l,e,cls)=>{const r=el("div","row rapp"+(first?" fst":"")+(cls?" "+cls:""));first=false;r.dataset.fnid=(l||e).id;
    const _fold=t=>String(t||"").toLowerCase().replace(/[^a-z0-9]/g,"");
    if(l&&e&&_fold(l.text)===_fold(e.text)){r.classList.add("conly");r.innerHTML=cell("la",l)+`<div class="en" lang="en"></div>`;}
    else r.innerHTML=cell("la",l)+cell("en",e);
    if(Math.max(l?l.text.length:0,e?e.text.length:0)>900){                 // wall-of-text note → clamp with expander
      r.classList.add("cl");
      const wds=((e||l).text.match(/\S+/g)||[]).length;
      const b=el("button","fnmore");b.type="button";
      b.innerHTML=`⌄ Continue the note <span>· ${wds} words</span>`;r.appendChild(b);}
    frag.appendChild(r);};
  const isVar=n=>/^v\d+n\d+$/.test(n.id), isEd=n=>/^ed\d+$/.test(n.id);
  if(laN.concat(enN).some(n=>AKAD(n.id))){
    // Akademie ordering: editorial headnotes, then reference notes, then the variant apparatus
    const laMain=laN.filter(n=>!isVar(n)), laVar=laN.filter(isVar);
    laMain.sort((a,b)=>(isEd(b)?1:0)-(isEd(a)?1:0));
    laMain.forEach(l=>mk(l,take(l.id)));
    enN.forEach(e=>{const q=emq.get(e.id);if(q&&q.includes(e)&&!isVar(e))mk(null,e);});
    const enVarCand=enN.filter(isVar);
    if(laVar.length||enVarCand.some(n=>(emq.get(n.id)||[]).includes(n))){
      const d=el("div","appdiv");
      d.innerHTML=`textual variants <span>— the author’s deletions &amp; revisions as printed: (1)(2) successive drafts · <em>erg.</em> added · <em>gestr.</em> struck · L, K = manuscript layers</span>`;
      frag.appendChild(d);
      laVar.forEach(l=>mk(l,take(l.id),"var"));
      enVarCand.forEach(e=>{const q=emq.get(e.id);if(q&&q.includes(e))mk(null,e,"var");});
    }
  }else{
    // POSITIONAL HEAL (owner 2026-08-18, WA 'footnote placing weird and disjointed'): when the
    // lanes bank the same notes under DIFFERENT id schemes (LA '23-2' vs EN corresp '#23en'),
    // id-pairing never fires and the two texts stack as separate one-sided rows. After id
    // pairing, unmatched LA notes absorb leftover EN notes in source order — the same k-th↔k-th
    // logic the id queue already uses, applied across schemes.
    const prs=laN.map(l=>[l,take(l.id)]);
    const left=enN.filter(e=>{const q=emq.get(e.id);return q&&q.includes(e);});
    let li=0;
    prs.forEach(pr=>{if(!pr[1]&&li<left.length){pr[1]=left[li];
      const q=emq.get(left[li].id);q.splice(q.indexOf(left[li]),1);li++;}});
    prs.forEach(([l,e])=>mk(l,e));
    enN.forEach(e=>{const q=emq.get(e.id);if(q&&q.includes(e))mk(null,e);});   // genuinely EN-only notes still shown
  }
  return frag;
}
// lane-confined selection guard: note the lane a selection starts in; suppress the other lane
// until the pointer lifts and the selection collapses.
// Select the initial reference now; the shared navigation owner places it after the reader boots.
(function(){
  if(frReaderBlockReference(location.hash)||location.hash.length>1)return;
  let page=new URLSearchParams(location.search).get("p");
  if(!page)try{const ws=new URLSearchParams(location.search).get("ws")||new URLSearchParams(location.search).get("w"),saved=JSON.parse(localStorage.getItem("fr_lastread")||"{}");
    const last=saved[ws]?.page;if(last!=null&&(!/^\d+$/.test(String(last))||Number(last)>3))page=String(last);
  }catch(_){}
  if(page)window.__frInitialReference=String(page);
})();
(function(){const q=new URLSearchParams(location.search).get("hl");if(!q||q.length<3)return;
  // ?hl= marks the words in the reading and steps through them. CITATION DOORS (owner 2026-09-10 "can't see the
  // thing that was flagged in the work"): the reception and citation surfaces send the flagged name with a
  // #b<page> reference; the bar then starts at the first match ON that page (after its page-turn anchor when the
  // page begins inside a merged row), waits for the landing to settle, and matches stems so "Bonav." and
  // "Bonaventura" count. Punctuation and short tokens ("St.") never become terms.
  const terms=[...new Set(q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).filter(w=>w.length>=4))].sort((a,b)=>b.length-a.length).slice(0,3).map(w=>w.length>=7?w.slice(0,w.length-2):w);
  if(!terms.length)return;
  const ref=frReaderBlockReference(location.hash),refPage=ref?String(ref.page):null;
  let marks=[],idx=0,bar=null,busy=false,mo=null,landed=false,t1=null,t2=null;
  // RE-MARK AFTER REBUILDS (owner 2026-09-10 "highlight when you open the source in a new tab"): a big work
  // paints its first shards, the door marks them, then the shard-complete / TEI-hydration rebuild wipes
  // #reading and the marks with it — the bar kept counting detached nodes and nothing was highlighted.
  // mark() is idempotent (text already inside a mark is skipped) and runs again whenever the reading is
  // rebuilt; × clears the marks AND drops hl from the URL so no later rebuild or reload brings it back.
  function mark(){
    busy=true;
    try{
      const walker=document.createTreeWalker(reading,NodeFilter.SHOW_TEXT,null);
      const todo=[];let n;
      while((n=walker.nextNode())&&todo.length<1200){
        const low=n.textContent.toLowerCase();
        if(terms.some(w=>low.includes(w))&&n.parentElement.closest(".row .en,.row .la")&&!n.parentElement.closest("mark,.pganchor,.fmark"))todo.push(n);}
      todo.forEach(node=>{let html=esc(node.textContent);
        terms.forEach(w=>{html=html.replace(new RegExp("("+w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"[a-zà-ÿ]*)","gi"),"<mark class=hlq>$1</mark>");});
        if(html.indexOf("<mark")<0)return;
        const span=document.createElement("span");span.innerHTML=html;node.replaceWith(span);});
      marks=[...reading.querySelectorAll("mark.hlq")];
    }finally{setTimeout(()=>{busy=false;},0);}
    return marks.length;}
  // start on the cited page: the first mark at or after its folio (or its page-turn anchor inside the previous row)
  function startIndex(){
    if(refPage==null)return 0;
    const start=Array.from(reading.querySelectorAll(".pganchor")).find(a=>String(a.dataset.page)===refPage)||reading.querySelector('.folio[data-page="'+CSS.escape(refPage)+'"]');
    if(!start)return 0;
    const i=marks.findIndex(m=>start===m||(start.compareDocumentPosition(m)&(Node.DOCUMENT_POSITION_FOLLOWING|Node.DOCUMENT_POSITION_CONTAINED_BY)));
    return i>=0?i:0;}
  const count=()=>{if(bar)bar.querySelector(".hln").textContent=(marks.length?idx+1:0)+"/"+marks.length;};
  const paint=()=>marks.forEach((m,i)=>m.classList.toggle("cur",i===idx));
  const go=d=>{if(!marks.length)return;idx=(idx+d+marks.length)%marks.length;count();paint();marks[idx].scrollIntoView({block:"center"});};
  function clear(){
    if(mo){mo.disconnect();mo=null;}
    reading.querySelectorAll("mark.hlq").forEach(m=>{const s=document.createElement("span");s.textContent=m.textContent;m.replaceWith(s);});
    marks=[];if(bar){bar.remove();bar=null;}
    try{const u=new URL(location.href);u.searchParams.delete("hl");history.replaceState(history.state,"",u.pathname+u.search+u.hash);}catch(_){}}
  function ensureBar(){
    if(bar)return;
    bar=el("div","hlbar");
    bar.innerHTML='<span class=hlq-q>“'+esc(q.slice(0,28))+'”</span><span class=hln></span><button data-d=-1 aria-label="Previous match">‹</button><button data-d=1 aria-label="Next match">›</button><button class=hlx aria-label="Clear highlights" title="Clear highlights">×</button>';
    document.body.appendChild(bar);
    bar.addEventListener("click",e2=>{const b2=e2.target.closest("button");if(!b2)return;
      if(b2.classList.contains("hlx")){clear();return;}
      go(+b2.dataset.d);});
    addEventListener("keydown",e2=>{if(!bar||!bar.isConnected)return;
      if(e2.key==="n"&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){go(1);}
      else if(e2.key==="N"&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)){go(-1);}});}
  // a rebuild (shard-complete, TEI hydration, lane change) replaces the rows: re-mark once the DOM settles
  function watch(){
    if(mo||!("MutationObserver" in window))return;
    mo=new MutationObserver(()=>{if(busy)return;clearTimeout(t1);t1=setTimeout(()=>{
      if(!bar){if(mark())finish();return;}          // rows arrived after an empty first pass (streamed TEI hydration)
      const alive=marks.filter(m=>m.isConnected).length;
      if(alive&&alive===marks.length)return;            // nothing was rebuilt
      const wasCur=marks[idx]&&marks[idx].isConnected?marks[idx]:null;
      if(!mark()){count();return;}
      idx=wasCur?Math.max(0,marks.indexOf(wasCur)):startIndex();count();paint();
      if(!window.__frUserScrolled&&marks[idx])marks[idx].scrollIntoView({block:"center"});},400);});
    mo.observe(reading,{childList:true,subtree:true});}
  function apply(){
    // build() streams folios in chunks (and the MereO port hydrates the TEI later still): an empty first pass is not
    // 'no matches' — keep watching the reading and re-try for ~20 s before giving up (owner 2026-09-11 'fix it for mereo')
    if(!mark()){watch();if(!t2){let tries=0;t2=setInterval(()=>{if(bar||++tries>40){clearInterval(t2);t2=null;return;}if(mark()){clearInterval(t2);t2=null;finish();}},500);}return;}
    finish();}
  function finish(){
    idx=startIndex();ensureBar();count();paint();
    if(!landed){landed=true;if(!refPage||!window.__frUserScrolled)setTimeout(()=>go(0),80);}
    watch();}
  // with a page reference, wait for the landing to settle (it re-pins its anchor until stable) before marking
  const ready=()=>reading.querySelector(".row")&&(!refPage||(window.__readerBuilt&&!window.__readerPendingPosition&&!document.getElementById("app")?.classList.contains("prelanding")));
  const t0=setInterval(()=>{if(ready()){clearInterval(t0);apply();}},350);
  setTimeout(()=>clearInterval(t0),30000);})();
document.addEventListener("pointerdown",ev=>{
  const cell=ev.target.closest&&ev.target.closest(".row .la, .row .en");
  document.body.classList.remove("selg-en","selg-la");
  if(!cell)return;
  document.body.classList.add(cell.classList.contains("la")?"selg-la":"selg-en");
},true);
document.addEventListener("pointerup",()=>{setTimeout(()=>{
  const s=getSelection();
  if(!s||s.isCollapsed)document.body.classList.remove("selg-en","selg-la");},80);});
document.addEventListener("keydown",ev=>{                                    // keyboard parity: Enter/Space on a focused note mark = click
  if(ev.key!=="Enter"&&ev.key!==" ")return;
  const f=ev.target.closest&&ev.target.closest(".fnref, .fn-ret");
  if(!f)return; ev.preventDefault(); f.click();
});
// WEB-NATIVE TRAVERSAL (owner 2026-08-10, schola-thomistica analysis): j/k jump to the
// next/previous STRUCTURAL heading — the reader stops being a scroll of pages and becomes a
// document you traverse by its own divisions.
document.addEventListener("keydown",ev=>{
  if(ev.key!=="j"&&ev.key!=="k")return;
  const t=ev.target;
  if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.isContentEditable))return;
  const heads=[...document.querySelectorAll(".row.rhead .csub, .reading h1, .reading h2, .reading h3")]
    .filter(h=>h.offsetParent);
  if(!heads.length)return;
  const y=innerHeight*0.18;
  const cur=heads.findIndex(h=>h.getBoundingClientRect().top>y+2);
  let target=null;
  if(ev.key==="j")target=heads[cur<0?heads.length-1:cur];
  else{const before=heads.filter(h=>h.getBoundingClientRect().top<y-2);target=before[before.length-1]||heads[0];}
  if(target){ev.preventDefault();target.scrollIntoView({behavior:"smooth",block:"start"});
    target.classList.add("kbd-hit");setTimeout(()=>target.classList.remove("kbd-hit"),900);}
});
// phone footnote bottom-sheet (owner 2026-08-10 polish loop): on touch screens a tapped
// superscript opens the note IN PLACE — the old jump-to-bank yanked the reader off their line.
const fnSheet=(()=>{let sh=null,sc=null;
  const ensure=()=>{if(sh)return;
    sc=el("div","fnsheet-scrim");sh=el("div","fnsheet");
    sh.innerHTML='<div class="fns-grab"></div><div class="fns-id"></div><div class="fns-en"></div><div class="fns-la" lang="la"></div><button type="button" class="fns-go">Show in page ↓</button>';
    document.body.append(sc,sh);
    sc.onclick=close;};
  const close=()=>{if(sh){sh.classList.remove("on");sc.classList.remove("on");}};
  const open=(f,sec)=>{ensure();
    const r=[...sec.querySelectorAll(".rapp")].find(x=>x.dataset.fnid===f.dataset.fn);
    if(!r)return false;
    const en=r.querySelector(".en"),la=r.querySelector(".la");
    sh.querySelector(".fns-id").textContent="Note "+(f.dataset.fn||"");
    const enBox=sh.querySelector(".fns-en");
    enBox.innerHTML=en&&en.innerHTML.trim()?en.innerHTML:"";
    enBox.setAttribute("lang","en");   // reset: openNote() (P3, margin notes) can leave lang="la" on this shared node
    const lc=sh.querySelector(".fns-la");
    lc.innerHTML=la&&la.innerHTML.trim()?la.innerHTML:"";lc.style.display=lc.innerHTML?"":"none";
    const go=sh.querySelector(".fns-go");go.style.display="";
    go.textContent="Show in page ↓";
    go.onclick=()=>{close();
      const tg=sec.querySelector(".apptog");if(tg&&!tg.classList.contains("open"))tg.click();
      r.classList.remove("cl");(window.__frPlaceReaderAnchor?window.__frPlaceReaderAnchor(r):r.scrollIntoView({block:"center"}));r.classList.add("flash");setTimeout(()=>r.classList.remove("flash"),1400);};
    sh.classList.add("on");sc.classList.add("on");return true;};
  // REHAUL P3 (2026-08-17): margin-note tap-aside. Reuses the exact same sheet DOM/CSS/scrim as
  // footnote open() above (ensure()/sh/sc) rather than building a second sheet component — the
  // only difference from open() is the source of the content (a live .mnote node already on the
  // page, not a .rapp bank row looked up by id) and that there is nowhere else to "show in page":
  // a margin note is already at its in-flow reading position on a phone (the wide-screen rail in
  // the CSS above is desktop-only), so the jump button is hidden rather than repurposed.
  const openNote=(mn)=>{ensure();
    sh.querySelector(".fns-id").textContent="Margin note";
    const box=sh.querySelector(".fns-en");
    box.innerHTML=mn.innerHTML||"";
    box.setAttribute("lang",mn.closest(".la")?"la":"en");
    sh.querySelector(".fns-la").style.display="none";
    sh.querySelector(".fns-go").style.display="none";
    sh.classList.add("on");sc.classList.add("on");return true;};
  document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
  return {open,openNote,close};})();
document.addEventListener("click",ev=>{                                     // anchor ⇄ note: click a superscript to jump/flash its note
  const m=ev.target.closest(".fnmore");
  if(m){m.closest(".rapp").classList.remove("cl");return;}                   // release a clamped long note
  const f=ev.target.closest(".fnref");if(!f)return;
  const sec=f.closest("section.folio");if(!sec)return;
  if(matchMedia("(hover:none),(max-width:880px)").matches&&fnSheet.open(f,sec))return;
  const tg=sec.querySelector(".apptog");if(tg&&!tg.classList.contains("open"))tg.click();
  const t=[...sec.querySelectorAll(".rapp")].find(r=>r.dataset.fnid===f.dataset.fn);
  if(t){t.classList.remove("cl");(window.__frPlaceReaderAnchor?window.__frPlaceReaderAnchor(t):t.scrollIntoView({block:"center"}));t.classList.add("flash");setTimeout(()=>t.classList.remove("flash"),1400);}
});
// REHAUL P3 (2026-08-17): a tapped margin note opens the same bottom sheet a tapped footnote
// superscript already does — one new dispatch branch, existing sheet component, same gate
// (matchMedia hover:none/max-width:880px) the .fnref handler above already uses. On a wide
// screen this never fires (the .mnote click is a no-op there; the P2 rail is the wide-screen
// treatment for the same DOM node).
document.addEventListener("click",ev=>{
  const mn=ev.target.closest(".mnote");
  if(!mn)return;
  if(mn.classList.contains("mnlong")){mn.classList.toggle("open");return;}
  if(!matchMedia("(hover:none),(max-width:880px)").matches)return;
  ev.preventDefault();
  fnSheet.openNote(mn);
});
// Footnote hover, focus, and tap behavior is shared by reader-footnotes.js.
function segLong(s){
  // Split a page-sized run-on paragraph into readable ones at sentence boundaries (display-only,
  // no content change). The dense scholastic pages otherwise arrive as one giant block.
  if(!s||s.length<=720)return [s];
  // partition at sentence-end boundaries (loss-less: slices re-concatenate to s; a findall/match
  // splitter silently drops chars it can't match, e.g. "etc." or "word.Word").
  // Early-modern Latin is dense with abbreviation dots — "Spiritus S.", "p. 181", "vid. seqq.",
  // "Matth. 5" — so a dot only counts as a boundary when the next char is an uppercase letter AND
  // the token before it isn't a short siglum or a known abbreviation.
  const ABBR=/(?:cap|art|lib|tom|vol|vid|seq|seqq|ibid|etc|viz|fol|pag|num|col|cent|quaest|disp|sect|conf|resp|obs|not|cit|loc|hor|ebr|matth|marc|luc|ioh|joh|act|rom|cor|gal|eph|phil|coloss|thess|tim|tit|philem|hebr|heb|iac|jac|petr|iud|jud|apoc|gen|exod|lev|deut|ios|jos|iud|reg|sam|par|esdr|neh|esth|iob|job|psal|prov|eccl|cant|esa|ies|jes|ier|jer|thren|ezech|dan|hos|ioel|joel|am|abd|ion|jon|mich|nah|hab|soph|agg|zach|mal)$/i;
  const re=/[.?!]["'”’)\]]*\s+/g,bounds=[];let m;
  while(m=re.exec(s)){
    const nxt=s[m.index+m[0].length];
    if(!nxt||!/[A-ZÀ-Þ§]/.test(nxt))continue;                      // continuation ("p. 181", lowercase resume); § opens a section
    if(/§\.?\s?\d{0,3}\.?$/.test(s.slice(Math.max(0,m.index-8),m.index+1)))continue; // "§. 5." glues forward — never strand it at a cut
    if(s[m.index]==="."){const pm=/([A-Za-zÀ-ÖØ-öø-ÿ]+)$/.exec(s.slice(Math.max(0,m.index-14),m.index));
      if(pm&&(pm[1].length<=2||ABBR.test(pm[1])))continue;}        // siglum ("S.","c.") or abbreviation
    bounds.push(m.index+m[0].length);}
  if(!bounds.length)return [s];
  const k=Math.max(2,Math.round(s.length/480)),target=s.length/k,out=[];let start=0;
  for(const b of bounds){if(out.length<k-1&&(b-start)>=target){out.push(s.slice(start,b).trim());start=b;}}
  out.push(s.slice(start).trim());
  return out.filter(Boolean);
}
// Paired segmentation for long la∥en blocks: segLong on each side independently tears the
// lanes apart (different chunk counts, unrelated break points — SCTA born-digital pages are
// one giant block, so parallel mode drifted badly). Cut as PAIRS instead: ¶ marks when both
// sides carry the same count (semantic objection/response units), else LA drives the chunking
// and EN is cut at the sentence boundary nearest each LA cumulative-length fraction.
function segPair(laRaw,enRaw){
  const pcL=(laRaw.match(/¶/g)||[]).length,pcE=(enRaw.match(/¶/g)||[]).length;
  if(pcL>=2&&pcL===pcE){
    const cut=s=>s.split(/(?=¶)/).map(x=>x.trim()).filter(Boolean);
    const A=cut(laRaw),B=cut(enRaw);
    if(A.length===B.length&&A.length>=2)return {A,B};
  }
  // the merged-lane fast path joins REAL paragraphs with \n\n — those are the print's own
  // units; pair by them instead of re-grouping sentences (Báñez QA 2026-07-21: sentence
  // grouping let one EN cut swallow five paragraphs' worth against one LA cell)
  let _paras=laRaw.split(/\n\s*\n/).map(s=>s.trim()).filter(s=>s.length>0);
  // glue tiny transition paragraphs ("His positis ad argumenta facta respondetur.") onto the
  // NEXT paragraph — a one-line cell stretched against a ten-line English cell reads as broken
  // design (owner 2026-07-21); the translation merges them into its paragraph anyway.
  if(_paras.length>=2){const gl=[];
    for(let i=0;i<_paras.length;i++){
      if(_paras[i].length<140&&i<_paras.length-1){_paras[i+1]=_paras[i]+"\n"+_paras[i+1];continue;}
      if(_paras[i].length<140&&gl.length){gl[gl.length-1]+="\n"+_paras[i];continue;}
      gl.push(_paras[i]);}
    _paras=gl;}
  const A=_paras.length>=2?_paras:segLong(laRaw);if(A.length<2)return null;
  const re=/[.?!]["'”’)\]]*\s+/g,bounds=[];let m;
  while(m=re.exec(enRaw)){
    if(/§\.?\s?\d{0,3}\.?$/.test(enRaw.slice(Math.max(0,m.index-8),m.index+1)))continue; // never cut right after "§. 5."
    bounds.push(m.index+m[0].length);}
  const sre=/\s+(?=§)/g;let sm;                                    // and always offer a cut BEFORE a § section cue
  while(sm=sre.exec(enRaw))bounds.push(sm.index+sm[0].length);
  bounds.sort((a,b)=>a-b);
  if(!bounds.length)return null;
  // ── anchor calibration (2026-07-20, rev 2): control points come ONLY from tokens that occur
  // EXACTLY ONCE in each lane — footnote ids [^fnN] (kept verbatim by the translation contract),
  // unique numbers, roman numerals, and 6-char capitalized-word cognates. The earlier greedy
  // forward walk over repeating tokens cascaded: one bad cognate match (Conciliorum↔Concerning)
  // pushed the window ahead, every later Paul/Barnabas matched a LATER occurrence — monotone but
  // skewed (LA 40%→EN 98%) — and the tail cells emptied. Unique tokens cannot cascade.
  const _anch=s=>{const m={},rx=/\[\^[^\]]+\]|\b\d{1,4}\b|\b[IVXLCDM]{2,7}\b|\b[A-ZÀ-Ö][A-Za-zà-öø-ÿ]{5,}/g;let mm;
    while(mm=rx.exec(s)){const t=mm[0];
      // i/j and u/v fold so classical vs anglicized cognates anchor (Caietano↔Cajetan, Vives↔Uiues)
      const k=t[0]==="["?"f:"+t:(/^\d/.test(t)?"n:"+t:(/^[IVXLCDM]+$/.test(t)?"r:"+t:"w:"+t.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/j/g,"i").replace(/v/g,"u").slice(0,6)));
      m[k]=(k in m)?-1:mm.index;}
    return m;};
  const MA=_anch(laRaw),MB=_anch(enRaw);
  const pts=[];for(const k in MA)if(MA[k]>=0&&MB[k]>=0)pts.push([MA[k],MB[k]]);
  pts.sort((a,b)=>a[0]-b[0]);
  const ctrl=[[0,0]];
  for(const p of pts){const last=ctrl[ctrl.length-1];
    if(p[0]>last[0]+8&&p[1]>last[1]+8)ctrl.push(p);}
  ctrl.push([laRaw.length,enRaw.length]);
  const mapPos=lp=>{if(ctrl.length<4)return enRaw.length*lp/laRaw.length;   // <2 real anchors → old behavior
    for(let i=1;i<ctrl.length;i++){if(lp<=ctrl[i][0]){
      const [l0,e0]=ctrl[i-1],[l1,e1]=ctrl[i];
      return l1===l0?e0:e0+(e1-e0)*(lp-l0)/(l1-l0);}}
    return enRaw.length;};
  const tot=A.reduce((s,x)=>s+x.length,0);
  const B=[];let acc=0,prev=0;
  for(let j=0;j<A.length-1;j++){acc+=A[j].length;
    let tgt=mapPos(acc);
    if(tgt<=prev)tgt=enRaw.length*acc/tot;                       // poisoned target → plain proportion for this cut
    if(tgt<=prev)tgt=prev+(enRaw.length-prev)/(A.length-j);      // still behind (overshot cut) → split the REMAINING EN evenly over the remaining cells so the tail never starves (Beza index-page class)
    let best=null;
    for(const b of bounds){if(b<=prev)continue;if(best===null||Math.abs(b-tgt)<Math.abs(best-tgt))best=b;}
    // sentence bounds exhausted (or nearest is wildly far): cut at a word boundary near the target
    // so the remaining LA cells still get their EN share instead of emptying (Salmerón p309 class)
    if(best===null||Math.abs(best-tgt)>Math.max(400,enRaw.length*0.18)){
      const w=enRaw.lastIndexOf(" ",Math.min(Math.round(tgt),enRaw.length-1));
      if(w>prev+20)best=w+1;}
    if(best===null)break;
    B.push(enRaw.slice(prev,best).trim());prev=best;}
  B.push(enRaw.slice(prev).trim());
  // smooth-lane stub guard (owner 2026-07-29): a tiny trailing cell on EITHER lane reads as a
  // broken sliver row against a full paragraph — merge it back into the previous sub-row. Also
  // absorb any mid-run cell that landed empty on one side while the other carries prose.
  while(A.length>1){const j=A.length-1;
    const aS=(A[j]||"").length,bS=(B[j]||"").length;
    if((aS&&aS<90&&bS<160)||(bS&&bS<90&&aS<160)||(!aS&&bS<160)||(!bS&&aS<160)){
      A[j-1]=(A[j-1]||"")+(A[j]?" "+A[j]:"");B[j-1]=(B[j-1]||"")+(B[j]?" "+B[j]:"");
      A.pop();B.length=Math.min(B.length,A.length+0);B.splice(j,1);
    }else break;}
  for(let j=1;j<A.length;j++){
    if((!B[j]||!B[j].trim())&&A[j]&&A[j].length<220){A[j-1]+=" "+A[j];A.splice(j,1);B.splice(j,1);j--;}
  }
  return {A,B:B.filter((x,i)=>i<A.length)};
}
// born-digital pages arrive as ONE block with the section heading — an ALL-CAPS
// salutation ("TO THE MOST REVEREND FATHER…IN THE LORD.") or a division label ("CHAPTER V.", "CAP.
// III.") — smashed inline before the prose. Peel leading heading-like clauses onto their own line so
// they render as <h3> headings instead of running into the body. Gated to born-digital works (the only
// ones with this collapse), which buildRows re-pairs via alignBlocks (h↔h / p↔p), absorbing any la∥en
// asymmetry; facsimile works keep their proven index pairing untouched. High precision: keyword+numeral
// OR a ≥85%-uppercase clause, ≥2 words, ending at the first . or : with more text after it.
const _HEADKW=/^(CHAPTER|CAP|CAPVT|CAPUT|SECT|SECTIO|ARGUMENT|ARGUMENTUM|ARGUMENTVM|QUAEST|QVAEST|QUAESTIO|QVAESTIO|ARTIC|ARTICULUS|ARTICVLVS|DISPUT|DISPVT|DISPUTATIO|PARS|LIBER|PROOEM|PRAEFAT|EPISTOLA|THESIS|MEMBRUM|MEMBRVM|CANON|REGULA|REGVLA|PROBLEMA|COROLLAR|OBSERVAT)\b/i;
function _capsRatio(s){const L=s.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g,"");if(L.length<4)return 0;let up=0;for(const c of L){const u=c.toUpperCase();if(c===u&&u!==c.toLowerCase())up++;}return up/L.length;}
function _leadHead(s){
  // (1) ALL-CAPS leading run (salutation / section title): take the LARGEST span (across internal
  //     abbreviation periods D., COLENDISS., …) that stays ≥85% uppercase, then cut where normal-case
  //     prose begins. We do NOT require the very next word to be lowercase — an English body that opens
  //     with a capital ("I now present…", a proper noun) must still peel so la∥en stay symmetric (else
  //     one lane peels a head the other doesn't → block-count mismatch → unpaired rows with no English).
  const re=/[.:]\s+(?=\S)/g;let m,best=null;
  while((m=re.exec(s))){
    const end=m.index+1,span=s.slice(0,end);
    if(span.length>760)break;                                    // Salmerón-class scriptural lemma titles run long (2026-07-20)
    if(_capsRatio(span)<0.85)break;                                       // adding this clause dropped below caps → stop
    if(span.split(/\s+/).filter(Boolean).length>=2)best=end;             // a valid multi-word caps-heading boundary
  }
  if(best!=null){
    const rest=s.slice(best).trim();
    if(/[a-zà-ÿ]/.test(rest.slice(0,80)))return {head:s.slice(0,best).trim(),rest};   // prose follows → peel here
  }
  // (2) title-case division label: "Chapter V.", "Cap. III." (a scholastic keyword + a numeral).
  // COHERENCE GATE (Turretin garble, 2026-07-20): OCR'd marginal-summary fusions also open with
  // QUAEST/CAP + numerals ("QUAEST opus Legis sibi ipsi essè … συνειδήσει VI.") — never promote those.
  // A real division label is SHORT (≤72ch), mostly title-case, has no Greek, and doesn't repeat words.
  const t=s.match(/^([\s\S]{2,130}?[.:])\s+(?=\S)/);
  if(t&&_HEADKW.test(t[1])&&/\b([IVXLCDM]{1,7}|\d{1,4})\b/.test(t[1])&&t[1].split(/\s+/).filter(Boolean).length>=2){
    const h=t[1].trim(),ws2=h.toLowerCase().split(/\s+/).filter(w=>w.length>3);
    const coherent=h.length<=72&&!/[Ͱ-Ͽἀ-῿]/.test(h)
      &&(new Set(ws2).size>=ws2.length-1)                                  // no heavy word repetition
      &&(_capsRatio(h)>=0.5||h.split(/\s+/).length<=8);                    // label-like, not prose run
    if(coherent)return {head:h,rest:s.slice(t[0].length).trim()};
  }
  return null;
}
function peelHeads(body){
  let rest=(body||"").trim();const out=[];
  const KWD="(?:Chapter|Caput|CAPVT|CAPUT|Book|Liber|LIBER|Part|Pars|PARS|Question|Quaestio|QUAESTIO|QVAESTIO|Section|Sectio|Article|Articulus|Disputatio)";
  rest=rest.replace(new RegExp("^\\s*"+KWD+"\\s+(?:[IVXLCDM]{1,7}|\\d{1,4})\\.?\\s*\\n\\s*(?="+KWD+"\\b)","i"),"");   // AS label doubled with the printed heading — keep the printed one
  for(let g=0;g<8&&rest;g++){const seg=_leadHead(rest);if(!seg)break;out.push({t:"h",h:inl(seg.head)});rest=seg.rest;}
  if(rest)out.push({t:"p",h:inl(rest),raw:rest});
  return out.length?out:[{t:"p",h:inl(body),raw:body}];
}
function blocks(t){
  // Split on blank lines, THEN pull every `### Heading` line out as its own block — so a
  // heading that wasn't blank-line-separated (e.g. "### On the Life of Cajetan.") still lands
  // on its own line instead of being swallowed into the surrounding paragraph.
  const HEAD=/^#{2,4}\s+(.+\S)\s*$/, out=[];
  (t||"").split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean).forEach(para=>{
    let buf=[];
    const flush=()=>{const s=buf.join("\n").trim();buf=[];if(!s)return;
      {const _cm=/^\*\*\[col\.\s*([^\]]+)\]\*\*$/.exec(s);                     // printed column-citation stamp → quiet marker row
       if(_cm){out.push({t:"col",raw:s,label:_cm[1]});return;}}
      {const _ls=s.split("\n");                                             // verse block: '| ' line convention (Gerson 2026-07-30)
       const _nv=_ls.filter(x=>/^\|\s/.test(x.trim()||x)).length;
       if(_ls.length>=2&&_nv>=Math.ceil(_ls.length*0.7)){out.push({t:"v",raw:s});return;}}
      if(ramIsList(s)){out.push({t:"ram",raw:s});return;}                          // genuine "- " bullet list → Ramist brace-diagram (checked BEFORE toc: a bullet list is never a run-on index)
      const toc=tocEntries(s); if(toc){out.push({t:"toc",entries:toc,raw:s});return;}   // run-on Roman index → TOC (keep raw so an asymmetric pair can fall back to prose)
      const body=s.replace(/^#{1,6}\s*/gm,"").replace(/\s*#{2,}\s*/g," ").replace(/\[\[[^\]]*\]\]/g,"").trim();  // drop stray ## marks + leftover [[markers]]
      if(body&&!/^#+$/.test(body)){                                          // one block per source paragraph (keeps la∥en paired); segmentation happens per-cell in buildRows
        if(typeof DATA!=="undefined"&&DATA&&DATA.has_pages===false)peelHeads(body).forEach(b=>out.push(b));  // born-digital: break out smashed-in headings
        else out.push({t:"p",h:inl(body),raw:body});}};
    para.split(/\n/).forEach(ln=>{const m=ln.match(HEAD);
      if(m){let ht=m[1].replace(/#{2,}/g," ").replace(/\s{2,}/g," ").trim();           // strip stray inline ##/### from heading text
        const _lvl=((ln.match(/^\s*(#{1,6})/)||[])[1]||"###").length;                   // heading LEVEL (2026-09-10): ## = main, ### = sub — the contents tree keeps it
        if(!ht)return;                                                                   // markers-only → drop
        // DOUBLED-HEAD guard (owner 2026-08-28 aq-detrin-86 A.4): the ingest ran the heading
        // twice on ONE line with no separator — folded text = X+X exactly. Keep the first half.
        {const _f=ht.toLowerCase().replace(/[^a-z0-9]/g,"");
         if(_f.length>=24&&_f.length%2===0&&_f.slice(0,_f.length/2)===_f.slice(_f.length/2)){
           let acc="",cut=0;const need=_f.length/2;
           for(let k=0;k<ht.length&&acc.length<need;k++){const c=ht[k].toLowerCase();if(/[a-z0-9]/.test(c))acc+=c;cut=k+1;}
           ht=ht.slice(0,cut).trim();
         }}
        // a "heading" carrying prose (a scripture lemma "Verse N. <text>" or a long sentence) is
        // NOT a real heading — render it as its own paragraph (verse marker bolded), never a big header.
        const vm=ht.match(/^((?:Verse|Vers\.?|VERSE|v\.)\s*[\dIVXLCivxlc]+\.?)\s+(\S.*)$/);
        if(vm||(ht.length>100&&/[.!?][)"'”\]]?$/.test(ht))){
          flush();out.push({t:"p",h:inl(vm?("**"+vm[1].trim()+"** "+vm[2].trim()):ht)});
        }else{flush();out.push({t:"h",h:inl(ht),lvl:_lvl});}
      }else buf.push(ln);});
    flush();
  });
  // HEAD-ECHO STRIP (owner 2026-08-28, aq-detrin-86 class): the ingest smashed the heading
  // into the body line AND left it duplicated at the body's start — a head immediately
  // followed by a paragraph that OPENS with the same folded text loses the echoed prefix.
  for(let _i=0;_i<out.length-1;_i++){
    if(out[_i].t!=="h")continue;
    const nx=out[_i+1];if(!nx||nx.t!=="p"||!nx.raw)continue;
    const _fold=s=>String(s).toLowerCase().replace(/<[^>]+>/g,"").replace(/[^a-z0-9]/g,"");
    const hf=_fold(out[_i].h);if(hf.length<12)continue;
    const rf=_fold(nx.raw);
    if(rf.startsWith(hf)&&rf.length>hf.length){
      let cut=0,acc="";
      const raw=nx.raw;
      for(let k=0;k<raw.length&&acc.length<hf.length;k++){const c=raw[k].toLowerCase();if(/[a-z0-9]/.test(c))acc+=c;cut=k+1;}
      const rest=raw.slice(cut).replace(/^[\s.:—–-]+/,"");
      if(rest.length>20){nx.raw=rest;nx.h=inl(rest);}
      else out[_i+1]=null;   // the paragraph WAS only the echo (stub pages) — drop it whole
    }
  }
  return out.filter(Boolean);
}
// born-digital lane reconciliation: blocks() runs per-lane and can DISAGREE — one lane's prose gets
// misread as a run-on TOC (e.g. "D. Martin"/"B. Luther" abbreviations) or an asymmetric Ramist list —
// so the lanes can't pair and the EN goes blank. If exactly one lane carries a special toc/ram block,
// demote it back to prose (peelHeads on its kept raw) so both lanes are prose-comparable and align.
// Real index/diagram pages are symmetric (both lanes detect them), so they're left untouched.
function _demoteSpecial(b){ return (b&&(b.t==="toc"||b.t==="ram")&&b.raw!=null)?peelHeads(b.raw):[b]; }
function symLanes(lb,eb){
  const sp=a=>a.some(b=>b&&(b.t==="toc"||b.t==="ram"));
  if(sp(lb)!==sp(eb)){const fix=a=>a.reduce((o,b)=>o.concat(_demoteSpecial(b)),[]);
    return [sp(lb)?fix(lb):lb, sp(eb)?fix(eb):eb];}
  return [lb,eb];
}
// ---- Ramist diagrams ------------------------------------------------------------------------------
// Baxter's Methodus (and other Ramist works) are built on dichotomous / trichotomous DIVISIONS: a
// concept splits — under a curly brace — into its members, each of which may split again. The source
// encodes these as indented markdown bullet lists; we rebuild the tree from the indentation and render
// it as a real brace-diagram (a scalable { embracing each group), restoring the branching logic the
// printed leaf carries. Detection is precise (genuine "- " markdown bullets) so prose never triggers it.
function ramIsList(s){const ls=s.split(/\n/).filter(x=>x.trim());
  const b=ls.filter(x=>/^[ \t]*-\s+\S/.test(x)).length;
  return ls.length>=2 && b>=2 && b>=ls.length*0.6;}
function ramParse(raw){
  const items=raw.split(/\n/).filter(l=>l.trim()).map(l=>({
    ind:(l.match(/^[ \t]*/)[0]||"").replace(/\t/g,"    ").length,
    text:l.replace(/^[ \t]*[-*]\s*/,"").trim()}))               // \s* so a bare "-" → "" (then dropped)
    .filter(it=>it.text && !/^[-–—.,;:·•\s]+$/.test(it.text));  // drop empty / dash-only / punctuation-only artifacts
  const root={children:[]},stack=[{ind:-1,node:root}];
  for(const it of items){const node={text:it.text,children:[]};
    while(stack.length>1 && it.ind<=stack[stack.length-1].ind)stack.pop();
    stack[stack.length-1].node.children.push(node);stack.push({ind:it.ind,node});}
  return root.children;}
function ramLabel(t){return inl(String(t)
  .replace(/\s*\{\s*/g," ")                  // open brace → space
  .replace(/\s*\}\s*([,.;:)])/g,"$1")        // close brace before punctuation → just drop it (inline {a / b} enumeration)
  .replace(/\s*:?\s*\}\s*/g," — ")           // any remaining close brace → em-dash (the "X } Y" pairing form)
  .replace(/\s{2,}/g," ").trim());}
function ramRender(nodes){return nodes.map(n=>n.children.length
  ? `<div class="rnode"><div class="rlabel rparent">${ramLabel(n.text)}</div><div class="rkids">${ramRender(n.children)}</div></div>`
  : `<div class="rnode"><div class="rlabel">${ramLabel(n.text)}</div></div>`).join("");}
function ramHTML(raw){try{const t=ramParse(raw);return t.length?`<div class="rdiagram">${ramRender(t)}</div>`:`<p>${inl(raw)}</p>`;}catch(e){return `<p>${inl(raw)}</p>`;}}
// Detect a run-on table-of-contents / index paragraph and split it into entries.
// A real prose paragraph almost never has 4+ "Roman-numeral. Capital…" tokens plus page numbers.
function tocEntries(s){
  if(!s||s.length<150)return null;
  const items=(s.match(/\b[IVXLCDM]{1,7}\.\s+[A-ZÀ-Ý"'(]/g)||[]).length;
  const locs=(s.match(/\b\d{1,4}\b|\bibid\b/gi)||[]).length;
  // density guard: a real run-on index has an entry every ~40 chars; prose with stray "D. Martin"/
  // "B. Luther" abbreviations (D/B read as Roman numerals) + a citation number ("pag. 299. Edit. 1648")
  // is sparse and must NOT be misread as a TOC — that flipped the EN lane to a one-sided toc block and
  // blanked the English on born-digital pages. Require the items to be dense relative to the text.
  if(items<4||locs<3||items*110<s.length)return null;
  const re=/\b(?:LIBER|BOOK|QUAESTIO|QUESTION|TRACTATUS|LIBRO)\s+[IVXLCDM]+\b|\b(?:Cap|CAP|Caput|CAPVT)\.?\s*[IVXLCDM]+\b|\b[IVXLCDM]{1,7}\.(?=\s+[A-ZÀ-Ý"'(])/g;
  const idx=[];let m;while((m=re.exec(s)))idx.push(m.index);
  if(idx.length<4)return null;
  const out=[];
  if(idx[0]>0){const intro=s.slice(0,idx[0]).trim();if(intro)out.push({kind:"sub",label:"",title:intro,page:""});}
  for(let i=0;i<idx.length;i++){
    let seg=s.slice(idx[i],i+1<idx.length?idx[i+1]:s.length).trim(),kind="item",label="",mm;
    if(mm=seg.match(/^((?:LIBER|BOOK|QUAESTIO|QUESTION|TRACTATUS|LIBRO)\s+[IVXLCDM]+)\b\.?\s*/i)){kind="major";label=mm[1].toUpperCase();seg=seg.slice(mm[0].length);}
    else if(mm=seg.match(/^((?:Cap|CAP|Caput|CAPVT)\.?\s*[IVXLCDM]+)\b\.?\s*/i)){kind="cap";label=mm[1].replace(/\s+/g," ");seg=seg.slice(mm[0].length);}
    else if(mm=seg.match(/^([IVXLCDM]{1,7})\.\s*/)){label=mm[1]+".";seg=seg.slice(mm[0].length);}
    let title=seg,page="",trailer="";
    const pm=seg.match(/^([\s\S]*?)\s*(\d{1,4}|ibid\.?)\b\s*([\s\S]*)$/i);
    if(pm){title=pm[1].trim();page=pm[2];trailer=(pm[3]||"").trim();}
    out.push({kind,label,title,page});
    if(trailer&&trailer.length<60&&/^[A-ZÀ-Ý][^.]*\.?$/.test(trailer))out.push({kind:"sub",label:"",title:trailer,page:""}); // e.g. "Argumenta Catholica."
  }
  return out.length>=4?out:null;
}
function tocCell(e,side){
  if(!e)return `<div class="tc ${side}"></div>`;
  if(e.kind==="sub")return `<div class="tc ${side} sub"><span class="tn"></span><span class="tt">${inl(e.title)}</span></div>`;
  return `<div class="tc ${side} ${e.kind}"><span class="tn">${esc(e.label||"")}</span><span class="tt">${inl(e.title)}</span>`+
    (e.page?`<span class="dots"></span><span class="tp">${esc(e.page)}</span>`:``)+`</div>`;
}
function renderToc(la,en){const A=la||[],B=en||[],N=Math.max(A.length,B.length);let h="";
  for(let j=0;j<N;j++){const k=(A[j]||B[j]||{}).kind||"item";h+=`<div class="te ${k}">${tocCell(A[j],"la")}${tocCell(B[j],"en")}</div>`;}
  return h;}
// Shared row builder — used by initial build AND review re-render so they never diverge.
// ---- paragraph-correspondence alignment (anchors → length-DP → orphan absorb) -------------------
// Latin and English carry the same content but were segmented into paragraphs differently (and a
// block can sit out of order), so pairing la[i]∥en[i] by index mis-aligns them. We re-pair at render
// time: anchor on translation-invariant markers (leading numbers, ### heading numbers, scholastic
// incipits), length-proportional DP (Gale–Church-style 1:1/1:2/2:1) between anchors, then absorb a
// one-sided orphan paragraph into its neighbour. Deterministic, non-destructive, idempotent on
// already-aligned pages, applies to every work. Falls back to index pairing on any anomaly.
const _ORD={primum:1,secundum:2,tertium:3,quartum:4,quintum:5,sextum:6,first:1,second:2,third:3,fourth:4,fifth:5,sixth:6};
const _INC=[[/respondeo|i answer that|i reply that/i,'resp'],[/sed contra|on the contrary/i,'sc'],[/sic proceditur|proceeded to the|proceeding to the/i,'proc'],[/videtur quod|it seems that/i,'vid']];
function _romi(s){s=String(s).toUpperCase();if(/^\d+$/.test(s))return s;const v={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};if(!/^[IVXLCDM]+$/.test(s))return s;let t=0;for(let i=0;i<s.length;i++){const c=v[s[i]],n=v[s[i+1]]||0;t+=c<n?-c:c;}return String(t);}
function _btxt(b){return(!b?"":(b.t==="h"?(b.h||""):(b.raw!=null?b.raw:(b.h||"")))).replace(/<[^>]+>/g,"");}
function _bstruct(b){return b&&(b.t==="h"||b.t==="toc");}
function _sig(b){if(!b)return null;if(b.t==="toc")return"toc";
  const t=_btxt(b).trim();
  if(b.t==="h"){const n=(t.match(/\b([IVXLCDM]{1,6}|\d{1,3})\b/)||[])[1];return"h:"+(n?_romi(n):t.toLowerCase().replace(/[^a-z]+/g,"").slice(0,7));}
  const m=t.match(/^[\s\-—:.]*(\d{1,3})\s*[.)]/);if(m)return"n:"+m[1];
  const head=t.slice(0,75),om=head.match(/\b(primum|secundum|tertium|quartum|quintum|sextum|first|second|third|fourth|fifth|sixth)\b/i);
  for(const[re,id]of _INC)if(re.test(head))return"i:"+id+(om?_ORD[om[1].toLowerCase()]:"");
  return null;}
function _mergeB(arr,idx){if(!idx.length)return null;if(idx.length===1)return arr[idx[0]];
  const raws=idx.map(i=>arr[i]).map(b=>b.raw!=null?b.raw:_btxt(b));const j=raws.join("\n\n");return{t:"p",raw:j,h:inl(j)};}
function alignBlocks(lb,eb){
  if(lb.length<2&&eb.length<2)return null;
  const ls=lb.map(_sig),es=eb.map(_sig),anc=[];let j=0;
  for(let i=0;i<lb.length;i++){if(!ls[i]||ls[i]==="toc")continue;
    for(let k=j;k<eb.length;k++){if(es[k]&&es[k]===ls[i]){anc.push([i,k]);j=k+1;break;}}}
  const len=b=>_btxt(b).replace(/\s+/g," ").length;
  function span(a1,b1,a2,b2){
    const A=[],B=[];for(let i=a1;i<b1;i++)A.push(i);for(let i=a2;i<b2;i++)B.push(i);
    const n=A.length,m=B.length;if(!n)return B.length?[[[],B]]:[];if(!m)return [[A,[]]];
    const lc=A.map(i=>len(lb[i])),ec=B.map(i=>len(eb[i])),sum=(a,x,y)=>a.slice(x,y).reduce((p,q)=>p+q,0);
    const R=(sum(lc,0,n)+1)/(sum(ec,0,m)+1);
    const cost=(i,di,jj,dj)=>{const lst=A.slice(i,i+di).some(x=>_bstruct(lb[x])),est=B.slice(jj,jj+dj).some(x=>_bstruct(eb[x]));
      if((di+dj>2)&&(lst||est))return 9;if(lst!==est)return 9;
      const ll=sum(lc,i,i+di),ee=sum(ec,jj,jj+dj)*R;return Math.abs(ll-ee)/Math.max(ll,ee,1);};
    const dp=Array.from({length:n+1},()=>Array(m+1).fill(1e9)),bk=Array.from({length:n+1},()=>Array(m+1).fill(null));dp[0][0]=0;
    for(let i=0;i<=n;i++)for(let jj=0;jj<=m;jj++){if(dp[i][jj]>=1e9)continue;const c=dp[i][jj];
      const rel=(ni,nj,cc)=>{if(ni<=n&&nj<=m&&cc<dp[ni][nj]){dp[ni][nj]=cc;bk[ni][nj]=[i,jj];}};
      if(i<n&&jj<m)rel(i+1,jj+1,c+cost(i,1,jj,1));
      if(i<n&&jj+1<m)rel(i+1,jj+2,c+cost(i,1,jj,2)+0.08);
      if(i+1<n&&jj<m)rel(i+2,jj+1,c+cost(i,2,jj,1)+0.08);
      if(i<n)rel(i+1,jj,c+0.5);if(jj<m)rel(i,jj+1,c+0.5);}
    const out=[];let i=n,jj=m;while((i>0||jj>0)&&bk[i][jj]){const[pi,pj]=bk[i][jj];out.push([A.slice(pi,i),B.slice(pj,jj)]);i=pi;jj=pj;}
    return out.reverse();}
  let groups=[],pi=0,pj=0;
  for(const[ai,aj]of anc){span(pi,ai,pj,aj).forEach(g=>groups.push(g));groups.push([[ai],[aj]]);pi=ai+1;pj=aj+1;}
  span(pi,lb.length,pj,eb.length).forEach(g=>groups.push(g));
  let rows=groups.map(([L,E])=>({l:_mergeB(lb,L),e:_mergeB(eb,E)}));
  const isP=b=>b&&b.t!=="h"&&b.t!=="toc",outr=[];
  for(const r of rows){const one=(r.l&&!r.e)||(!r.l&&r.e);
    if(one&&outr.length){const p=outr[outr.length-1];
      if(isP(r.l||r.e)&&isP(p.l)&&isP(p.e)){
        if(r.l&&!r.e){const j2=p.l.raw+"\n\n"+r.l.raw;p.l={t:"p",raw:j2,h:inl(j2)};}
        else{const j2=p.e.raw+"\n\n"+r.e.raw;p.e={t:"p",raw:j2,h:inl(j2)};}
        continue;}}
    outr.push(r);}
  return outr;
}
const _rom=n=>['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'][n]||n;   // Fathers-card century badge (PL era, Round-7 item 3)
let _EDSEC=null;   // Wadding–Vivès apparatus state: inside a SCHOLIUM/COMMENTARIUS/ANNOTATIONES section
                   // (the EDITORS' text, not Scotus's) — persists across page breaks until the next real heading
let _HSEQ=0;   // heading-anchor sequence — reset per full build; deterministic render order makes ids stable deep links
function buildRows(lb,eb,first){
  const nodes=[];
  const VIVES_APP=!!(DATA&&/^duns-scotus-opera-/.test(DATA.slug||""));   // apparatus layers only exist in the Vivès Opera set
  // Re-align ONLY born-digital works (DATA.has_pages===false), whose la∥en were built from chunk
  // alignment and can mis-correspond. Scanned works already have proven, page-image-grounded pairing —
  // leave them untouched on the original index pairing.
  let rows=null;
  // Only re-align when BOTH lanes have content. For en_only / English-only pages the Latin lane is
  // empty (lb=[]) — alignBlocks' span() would lump every English block into one paragraph and destroy
  // all heading structure, so skip it and pair by index (each block its own row; headings survive).
  // born-digital (has_pages===false): always length-proportionally re-align. Facsimile (has_pages===true):
  // index-pair when la∥en block counts MATCH (proven page-grounded pairing), but fall back to the same
  // tolerant alignBlocks when the counts DIFFER (e.g. a seam edit joined a one-lane spurious OCR paragraph
  // break) — the Gale–Church DP maps the merged block 1:2 so the page stays aligned instead of desyncing.
  // COLLAPSED-LANE FAST PATH (Báñez QA 2026-07-21): when one lane arrives as ONE prose block and
  // the other as several (AS works: source-restored multi-paragraph LA ∥ birth-collapsed EN), the
  // Gale–Church DP pins the single block to one row and blanks the rest. Merge each lane's prose
  // to one paired row instead — segPair's anchor calibration then sub-pairs it cleanly.
  if(DATA&&!rows){
    const _isP=b=>b&&b.t!=="h"&&b.t!=="toc"&&b.t!=="ram"&&b.t!=="v"&&b.t!=="col"&&b.raw!=null;
    const _sp2=a=>a.some(b=>b&&(b.t==="toc"||b.t==="ram"));
    const _seqEnum=t=>{const L=(t.match(/\(\s*([a-z])\s*\)/g)||[]).map(x=>x.replace(/[^a-z]/g,""));
      if(L.length<3)return false;let seq=0;for(let i=1;i<L.length;i++)if(L[i].charCodeAt(0)===L[i-1].charCodeAt(0)+1)seq++;
      return seq>=L.length-1;};   // (a)(b)(c)(d)… in order = an enumerated ANSWER, not a citation chain (Hollaz QA 2026-07-24)
    const _citB=b=>{if(!b||b.raw==null)return false;const t=b.raw.replace(/\s+/g," ").trim();
      if(!t||t.length>700)return false;const c=(t.match(/\(\s*[a-z]\s*\)/g)||[]).length;
      return c>=3&&(t.match(/\./g)||[]).length>=c&&!_seqEnum(t);};
    const lp=lb.filter(b=>_isP(b)&&!_citB(b)),ep=eb.filter(b=>_isP(b)&&!_citB(b));
    // SECTION-WISE TRANSPARENCY (owner 2026-07-21): for AS/born-digital works the two lanes'
    // block counts routinely disagree (extraction vs translation paragraphing) and length-based
    // block alignment mispairs (Báñez p132: the argument row got no English). Whenever counts
    // differ, pair by the page's own SECTIONS instead: headings pair in order; ALL prose between
    // one heading and the next merges to ONE paired row per lane; segPair's anchors distribute
    // within. Equal counts keep faithful per-paragraph index pairing.
    // born-digital: ANY count mismatch takes the section path. Facsimile: only SEVERE mismatch
    // (diff ≥3 — Leibniz audit 2026-07-21: 96.4% of facsimile pages match exactly and keep their
    // page-image-grounded pairing; the length-aligner only mispairs at the severe tail).
    const _mm=DATA.has_pages===false?(lp.length!==ep.length):(Math.abs(lp.length-ep.length)>=3);
    if(!_sp2(lb)&&!_sp2(eb)&&lp.length>=1&&ep.length>=1&&_mm){
      const segs=a=>{   // [{h:headBlock|null pairs-in-order}, prose segments between]
        const out=[{h:null,p:[],c:[],v:[]}];
        for(const b of a){
          if(!b)continue;
          if(b.t==="h"){out.push({h:b,p:[],c:[],v:[]});}
          else if(b.t==="v"){out[out.length-1].v.push(b);}
          else if(_citB(b)){out[out.length-1].c.push(b);}
          else if(_isP(b)){out[out.length-1].p.push(b);}
        }
        return out;};
      const LS=segs(lb),ES=segs(eb);
      const mg=a=>{if(!a.length)return null;const j=a.map(b=>b.raw).join("\n\n");return {t:"p",raw:j,h:inl(j)};};
      if(LS.length===ES.length){
        rows=[];
        for(let i=0;i<LS.length;i++){
          if(LS[i].h||ES[i].h)rows.push({l:LS[i].h||null,e:ES[i].h||null});
          LS[i].c.forEach(cb=>rows.push({l:cb,e:null}));
          const _nv=Math.max(LS[i].v.length,ES[i].v.length);
          for(let k=0;k<_nv;k++)rows.push({l:LS[i].v[k]||null,e:ES[i].v[k]||null});
          if(LS[i].p.length||ES[i].p.length)rows.push({l:mg(LS[i].p),e:mg(ES[i].p)});
        }
      }else{
        // heading counts disagree — the old single whole-page merge pooled EVERY prose block at
        // the FIRST prose position, so a later section's body rendered ABOVE its own heading and
        // the section read as EMPTY (owner report 2026-08-10, Albertus Sentences a.1; same family
        // as the Calov p17 lane offset). Keep the LATIN segment skeleton in READING ORDER: heads
        // in place, each segment's prose merged in place; English prose pairs segment-by-segment
        // in order (extra EN segments merge into the last LA prose slot — order over precision).
        const eh=eb.filter(b=>b&&b.t==="h");
        const epSeg=segs(eb).map(s=>s.p).filter(a=>a.length);
        rows=[];let ehi=0,epi=0;
        const laSegs=LS;
        const proseSegs=laSegs.filter(s=>s.p.length).length;
        for(let si=0;si<laSegs.length;si++){
          const S=laSegs[si];
          if(S.h)rows.push({l:S.h,e:eh[ehi++]||null});
          S.c.forEach(cb=>rows.push({l:cb,e:null}));
          S.v.forEach(vb=>rows.push({l:vb,e:null}));
          if(S.p.length){
            let ep2=[];
            if(epi<epSeg.length){
              // last LA prose slot absorbs all remaining EN prose segments
              const isLastProse=laSegs.slice(si+1).every(x=>!x.p.length);
              if(isLastProse){while(epi<epSeg.length)ep2=ep2.concat(epSeg[epi++]);}
              else ep2=epSeg[epi++];
            }
            rows.push({l:mg(S.p),e:mg(ep2)});
          }
        }
        while(ehi<eh.length)rows.push({l:null,e:eh[ehi++]});
        while(epi<epSeg.length)rows.push({l:null,e:mg(epSeg[epi++])});
      }
    }
  }
  if(!rows&&DATA&&lb.length>=1&&eb.length>=1&&(lb.length>=2||eb.length>=2)&&(DATA.has_pages===false||lb.length!==eb.length)){try{rows=alignBlocks(lb,eb);}catch(e){rows=null;}}
  if(!rows||!rows.length){rows=[];const N=Math.max(lb.length,eb.length);for(let i=0;i<N;i++)rows.push({l:lb[i]||null,e:eb[i]||null});}  // scanned works + fallback: index pairing (unchanged)
  for(const rr of rows){const l=rr.l,e=rr.e;
    if(l&&l.t==="toc"&&e&&e.t==="toc"){const w=el("div","row rtoc");   // bilingual TOC only; a one-sided "toc" (a dense index misread on one lane) falls through to a normal la∥en paragraph so the English never drops
      w.innerHTML=`<div class="toc">${renderToc(l.entries,e.entries)}</div>`;nodes.push(w);continue;}
    if((l&&l.t==="h")||(e&&e.t==="h")){const laH=deBracket((l&&l.t==="h")?l.h:""),enH=deBracket((e&&e.t==="h")?e.h:"");
      // Wadding–Vivès apparatus: SCHOLIUM / COMMENTARIUS / ANNOTATIONES sections are the EDITORS'
      // (Lychetus, Hiquaeus …) text printed with Scotus — mark the whole section so it reads, and
      // above all CITES, as apparatus rather than as Scotus's own words. Any other heading ends it.
      if(VIVES_APP){const _ht=(enH||laH).replace(/<[^>]+>/g,"").trim();
        const _m=/^(SCHOLIUM|SCHOLIA|COMMENTAR(?:IUS|II|Y)|ANNOTATION(?:ES|S)?)\b/i.exec(_ht);   // EN lane may translate: COMMENTARY / ANNOTATIONS
        _EDSEC=_m?(/^schol/i.test(_m[1])?"Scholium":(/^comment/i.test(_m[1])?"Commentarius":"Annotationes")):null;}
      let _hen=enH||laH,_hla=laH;
      {const _pt=(_hen||"").replace(/<[^>]+>/g,"");
       const _bm=/^\s*([^()]{6,240}?)\s*\(([^()]{8,300})\)\s*\.?\s*$/.exec(_pt.replace(/\s+/g," "));
       if(_bm&&_bm[1]===_bm[1].toUpperCase()&&/[A-Z]{2}/.test(_bm[1])){_hen=esc(_bm[2]);_hla=_hla||esc(_bm[1]);}}
      // identical-echo guard: an untranslated head arrives with the same text in both lanes
      // ("CAP. IV." over a small-caps "cap. iv." subline reads as a stutter, UX review 2026-07-13)
      {const _norm=s=>(s||"").replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim().toLowerCase();
       if(_hla&&_norm(_hla)===_norm(_hen))_hla="";}
      // SIDE-BY-SIDE HEAD PAIRS (owner 2026-09-04 'headings side by side instead of
      // stacked'): when the heading exists in BOTH languages, each lane's head sits over
      // its own column like every body row — the Latin head was a stacked .56em subline.
      // A one-sided head keeps the full-width banner.
      const _pair=!!(_hla&&_hen);
      const _lvl=Math.min((e&&e.t==="h"&&e.lvl)||(l&&l.t==="h"&&l.lvl)||3,6);
      const h=el("div","row rhead"+(_pair?" hpair":"")+(VIVES_APP&&_EDSEC?" hedit":"")+(_lvl<=2?" hmain":"")+" hl"+_lvl);
      // hover § anchor: every heading is a copyable deep link (schola-thomistica pattern)
      const _hid="h"+(++_HSEQ)+"-"+(_hen||_hla).replace(/<[^>]+>/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40);h.id=_hid;
      const _chip=(VIVES_APP&&_EDSEC)?'<span class="edchip" title="This section is the Wadding–Vivès editors’ apparatus (Lychetus, Hiquaeus …), not Scotus’s own text — citations from it are attributed to the editors">editors’ apparatus · Wadding–Vivès</span>':"";
      if(_pair){
        h.innerHTML=`<div class="la" lang="la"><h3 class="csub"><span class="hla" lang="la">${_hla}</span></h3></div>`+
                    `<div class="en" lang="en"><h3 class="csub"><a class="hanchor" href="#${_hid}" title="Link to this section">§</a><span class="hen">${_hen}</span></h3>${_chip}</div>`;
      }else{
        h.innerHTML=`<h3 class="csub"><a class="hanchor" href="#${_hid}" title="Link to this section">§</a><span class="hla" lang="la">${_hla}</span><span class="hen">${_hen}</span></h3>`+_chip;
      }
      nodes.push(h);continue;}
    if((l&&l.t==="col")||(e&&e.t==="col")){
      const cl=(l&&l.t==="col")?l:(e&&e.t==="col"?e:null);
      const cr=el("div","row rcolm");cr.innerHTML=`<span class="colm">col. ${esc(cl.label)}</span>`;
      nodes.push(cr);first=first&&false||first;continue;}
    if((l&&l.t==="v")||(e&&e.t==="v")){                                     // verse pair: hard line breaks, couplet indents, no sentence re-pairing
      const vr=el("div","row rverse"+(first?" first":""));first=false;
      const vcell=(side,b)=>{if(!b||b.raw==null)return `<div class="${side}" lang="${side==="la"?"la":"en"}"></div>`;
        const lines=b.raw.split("\n").map(x=>{
          const m=/^\|\s?(\s*)(.*)$/.exec(x);
          if(!m)return `<div class="vl">${inl(x)}</div>`;
          return `<div class="vl${m[1].length>=2?" ind":""}">${inl(m[2])}</div>`;});
        return `<div class="${side}" lang="${side==="la"?"la":"en"}"><div class="verse">${lines.join("")}</div></div>`;};
      vr.innerHTML=vcell("la",l&&l.t==="v"?l:null)+vcell("en",e&&e.t==="v"?e:null);
      nodes.push(vr);continue;}
    const capOk=first&&e&&e.raw&&e.raw.replace(/\s+/g," ").length>180&&!/^\s*(?:chapter|caput|liber|book|pars|part|quaestio|question|sectio|section)\b/i.test(e.raw);
    const row=el("div","row"+(first?(capOk?" first cap":" first"):""));first=false;
    // CITATION-APPARATUS ROWS (Bossuet QA 2026-07-21): AS prints bank margin citations as dense
    // "(a) Ibid. n. 12. (b) Anonym. Cap. 4. …" chains; paired as reading prose they collide with a
    // stub in the other lane. Detect (≥3 "(x)" cues, short, citation-shaped) → render as a quiet
    // apparatus row instead of body text.
    {const _cit=b=>{if(!b||b.raw==null)return false;const t=b.raw.replace(/\s+/g," ").trim();
       if(!t||t.length>700)return false;
       const cues=(t.match(/\(\s*[a-z]\s*\)/g)||[]).length;
       const seq=(()=>{const L=(t.match(/\(\s*([a-z])\s*\)/g)||[]).map(x=>x.replace(/[^a-z]/g,""));
         if(L.length<3)return false;let n=0;for(let i=1;i<L.length;i++)if(L[i].charCodeAt(0)===L[i-1].charCodeAt(0)+1)n++;
         return n>=L.length-1;})();
       return cues>=3&&!seq&&(t.match(/\./g)||[]).length>=cues&&!/[.?!]\s+[A-ZÀ-Þ][a-zà-ÿ]+\s+[a-zà-ÿ]+\s+[a-zà-ÿ]+\s+[a-zà-ÿ]/.test(t);};
     if((_cit(l)||_cit(e))&&!(l&&e&&l.raw&&e.raw&&Math.min(l.raw.replace(/\s+/g," ").length,e.raw.replace(/\s+/g," ").length)>400)){
       row.classList.add("rcit");
       // citation-only: the paired cell is absent, itself a citation chain, or a stub tail —
       // collapse to a single full-width source row (no gulf, no stub pairing)
       const _short=b=>!b||b.raw==null||b.raw.replace(/\s+/g," ").trim().length<100;
       if(_cit(l)&&(_short(e)||_cit(e)))row.classList.add("conly");
     }}
    // the SCHOLIUM often ends WITHOUT a heading — Scotus resumes with a structural opener
    // ("Respondeo (b)…", "Ad argumenta…"). Those openers are Scotus's moves, never the editors'
    // (who write ABOUT him: "Resolvit…"), so they close the apparatus section.
    if(VIVES_APP&&_EDSEC){
      const _bt=(((l&&l.raw)||(e&&e.raw)||"")+"").replace(/<[^>]+>/g,"").trim();
      if(/^(Respondeo|Dico\s+(?:ergo|quod|igitur)|Ad\s+(?:primum|secundum|tertium|quartum|quintum|sextum|argumenta|rationes|primam|secundam)\b|I\s+answer|I\s+reply|I\s+say\s+(?:then|therefore)|To\s+the\s+(?:first|second|third|fourth|fifth|arguments?)\b)/i.test(_bt))_EDSEC=null;
    }
    if(VIVES_APP&&_EDSEC){row.classList.add("redit");row.dataset.edit=_EDSEC;}   // body of an editors'-apparatus section
    // one row per source paragraph-pair (la∥en stay aligned). BORN-DIGITAL ONLY: their pages arrive
    // as one giant block, so long pairs segment as PAIRED sub-rows (.sp) to keep lanes synced.
    // Facsimile paragraphs are page-image-grounded units — segPair's length-proportional EN cuts land
    // mid-citation ("p. 181", "Spiritus S.") at points that don't correspond, so never sub-split them.
    // 2026-07-20: anchor-calibrated segPair extends to FACSIMILE works too, but only for LONG pairs
    // (>1200ch) where sub-pairing clearly helps — short facsimile paragraphs stay page-image-grounded units.
    const _spEligible=l&&e&&l.t!=="ram"&&e.t!=="ram"&&l.raw!=null&&e.raw!=null&&
      ((DATA&&DATA.has_pages===false&&(l.raw.length>720||e.raw.length>720))||
       (DATA&&DATA.has_pages!==false&&l.raw.length>1200&&e.raw.length>1200));
    const pair=_spEligible?segPair(l.raw,e.raw):null;
    if(pair){
      row.classList.add("seg");
      const K=Math.max(pair.A.length,pair.B.length);let h="";
      for(let j=0;j<K;j++)h+=`<div class="sp"><div class="la" lang="la">${pair.A[j]?segLong(pair.A[j]).map(x=>`<p>${inl(x)}</p>`).join(""):""}</div><div class="en" lang="en">${pair.B[j]?segLong(pair.B[j]).map(x=>`<p>${inl(x)}</p>`).join(""):""}</div></div>`;
      row.innerHTML=h;nodes.push(row);continue;}
    // one row per source paragraph-pair (la∥en stay aligned); long paragraphs segment INSIDE the cell
    // md HEADINGS (owner 2026-08-20, Denzinger/Carthage: "### Original Sin and Grace" was
    // running inline with the prose and colliding with the § section marker). A block whose
    // first line is a markdown heading renders as a real heading, exactly as the TEI path does.
    const _mdHead=b=>{
      const raw=(b&&b.raw!=null)?String(b.raw):"";
      const m=raw.match(/^\s*#{1,6}\s+(.{2,140}?)\s*$/m);
      if(!m||raw.trim().indexOf(m[0].trim())!==0)return null;
      const rest=raw.slice(raw.indexOf(m[0])+m[0].length).trim();
      return {h:m[1].trim(),rest:rest};
    };
    const cell=b=>{
      if(!b)return "";
      if(b.t==="ram")return ramHTML(b.raw);
      const mh=_mdHead(b);
      if(mh)return `<h3 class="csub inflow">${inl(mh.h)}</h3>`+
        (mh.rest?segLong(mh.rest).map(s=>`<p>${inl(s)}</p>`).join(""):"");
      return b.raw!=null?segLong(b.raw).map(s=>`<p>${inl(s)}</p>`).join(""):`<p>${b.h}</p>`;};
    row.innerHTML=`<div class="la" lang="la">${cell(l)}</div><div class="en" lang="en">${cell(e)}</div>`;nodes.push(row);}
  return {nodes,first};
}
// Zotero/Mendeley COinS (ContextObjects in Spans, OpenURL Z39.88): a reference manager scans the page
// for span.Z3988 and reads this title attribute → one-click "save citation" for the work being read.
function coinsOf(D){
  D=D||{};
  const kv=[["ctx_ver","Z39.88-2004"],["rft_val_fmt","info:ofi/fmt:kev:mtx:book"],
    ["rfr_id","info:sid/thefaithreceived.vercel.app"],["rft.genre","book"],
    ["rft.btitle",D.title||""],["rft.title",D.title||""],["rft.au",D.author||""],
    ["rft.pub","The Faith Received"],["rft.language","lat"]];
  if(D.volume)kv.push(["rft.volume",D.volume]);
  if(D.slug)kv.push(["rft_id","https://thefaithreceived.vercel.app/read?w="+encodeURIComponent(D.slug)]);
  return "url_ver=Z39.88-2004&"+kv.filter(([k,v])=>v).map(([k,v])=>k+"="+encodeURIComponent(v)).join("&");
}
const app=$("#app");let DATA=null,STRUCT=false,cur=null,pickFolio=()=>{},_tick=false,_navClickT=0,SECMAP=null,_EN_TITLES=null,_navView="outline";
function enHalf(t){t=String(t||"");const i=t.indexOf(" — ");if(i<0)return t;const la=t.slice(i+3).replace(/[^A-Za-z]/g,"");return la&&la===la.toUpperCase()?t.slice(0,i):t;}
function rememberReaderChoice(page,title='',id=null){
  const serial=(window.__readerNavSerial||0)+1;window.__readerNavSerial=serial;
  window.__readerRestoreSerial=(window.__readerRestoreSerial||0)+1;window.__readerPendingPosition=null;window.__readerSuspendedPosition=null;window.__readerNavigationSuspended=false;
  window.__readerChoice={page,title,id,serial};window.__frTgt=page;window.__frUserScrolled=false;document.getElementById('app')?.classList.remove('prelanding');
  return serial;
}
function frReaderBlockReference(hash){
  let id;try{id=decodeURIComponent(String(hash||'').replace(/^#/,''));}catch(_){return null;}
  const match=/^b(.+)-(\d+)$/.exec(id);return match?{id,page:match[1],index:match[2]}:null;
}
function captureReaderPosition(){
  if(window.__readerNavigationSuspended&&window.__readerSuspendedPosition)return {...window.__readerSuspendedPosition};
  if(window.__readerPendingPosition?.serial===(window.__readerNavSerial||0))return {...window.__readerPendingPosition};
  const sc=document.getElementById('scroll'),reading=document.getElementById('reading');if(!sc||!reading)return null;
  const base=sc.getBoundingClientRect().top,choice=window.__readerChoice;
  if(choice?.id)return {page:choice.page,title:choice.title||'',choice:true,id:choice.id,...(choice.focusId?{focusId:choice.focusId}:{}),...(choice.sourcePath?{sourcePath:choice.sourcePath,sourceText:choice.sourceText,sourceKey:choice.sourceKey||''}:{}),anchor:true,offset:null,serial:choice.serial};
  const anchor=Array.from(reading.querySelectorAll('.row[id]:not(.rapp),.pganchor')).find(node=>{const r=node.getBoundingClientRect();return node.getClientRects().length&&r.bottom>base+16;});
  let page=anchor?.closest('.folio')?.dataset.page||anchor?.dataset.page||cur;
  const requested=choice?.page??(!window.__frUserScrolled?window.__frTgt:null);
  if(requested!=null)page=requested;
  if(page==null)return null;
  const samePage=String(anchor?.closest('.folio')?.dataset.page||anchor?.dataset.page)===String(page);
  return {page,title:choice?.title||'',choice:!!choice,id:!choice&&samePage?anchor?.id:null,offset:!choice&&samePage?anchor.getBoundingClientRect().top-base:null,serial:window.__readerNavSerial||0};
}
const frSourceHeadingCache={tei:null,paths:new Map()};
function frSourceHeadingFold(value){return String(value||'').normalize('NFKC').replace(/<[^>]*>/g,'').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();}
function frSourceHeadingRecord(path,title='',sourceKey=''){
  if(!/^\d+(?:\.\d+)*$/.test(String(path))||DATA?.nav_source_version!=='eebo-path-v1')return null;
  const tei=typeof TEI_PAGES==='undefined'?null:TEI_PAGES;if(!tei)return null;
  if(frSourceHeadingCache.tei!==tei){
    const paths=new Map(),references=new Map((DATA?.pages||[]).map(p=>[String(p.n).replace(/^0+(?=\d+$)/,''),String(p.n)]));
    if(window.FRSourceOutline?.targetRecords){
      for(const record of window.FRSourceOutline.targetRecords(DATA,tei)){if(!paths.has(record.path))paths.set(record.path,[]);paths.get(record.path).push(record);}
    }else{
    for(const [page,nodes]of Object.entries(tei.en||{})){
      const walk=node=>{if(node.nodeType!==1)return;const source=node.getAttribute?.('data-source-path');
        if(node.localName==='head'&&source){const item={page:references.get(String(page).replace(/^0+(?=\d+$)/,''))||String(page),text:node.textContent||''};item.key=window.FRSourceOutline?.targetKey(item.page,item.text)||'';if(!paths.has(source))paths.set(source,[]);paths.get(source).push(item);}
        for(const child of node.childNodes||[])walk(child);};for(const node of nodes||[])walk(node);
    }
    }
    frSourceHeadingCache.tei=tei;frSourceHeadingCache.paths=paths;
  }
  const rows=frSourceHeadingCache.paths.get(String(path))||[],wanted=frSourceHeadingFold(title);
  if(sourceKey){const exact=rows.filter(row=>row.key===sourceKey&&!row.ambiguous);return exact.length===1?exact[0]:null;}
  // The canonical path identifies the division even when the display outline expands
  // a short heading ("Part") or gives a shared Question 26/27 heading two entries.
  const primary=rows.filter(row=>row.primary&&!row.ambiguous);
  return primary.find(row=>frSourceHeadingFold(row.text)===wanted)||rows.find(row=>!row.ambiguous&&frSourceHeadingFold(row.text)===wanted)||(primary.length===1?primary[0]:rows.length===1&&!rows[0].ambiguous?rows[0]:null)||null;
}
function frResolveSourceHeading(position){
  const record=frSourceHeadingRecord(position.sourcePath,position.sourceText,position.sourceKey);if(!record)return null;
  position.page=record.page;window.__ensurePage?.(record.page);
  const wantedKey=position.sourceKey||record.key;
  const wanted=frSourceHeadingFold(record.text),rows=Array.from(document.querySelectorAll('#reading .rhead[data-source-path],#reading [data-source-heading]')).filter(row=>(row.dataset.sourcePath===position.sourcePath||String(row.dataset.sourcePaths||'').split(' ').includes(position.sourcePath))&&(!wantedKey||String(row.dataset.sourceKeys||row.dataset.sourceKey||'').split(' ').includes(wantedKey))&&row.isConnected&&row.getClientRects().length);
  const text=row=>frSourceHeadingFold(row.querySelector('.hen')?.textContent||row.querySelector('.hla')?.textContent||row.textContent);
  return rows.find(row=>text(row)===wanted)||rows.find(row=>text(row).includes(wanted)&&wanted.length>=1)||(rows.length===1?rows[0]:null)||null;
}
function frResolveReaderAnchor(position){
  if(position.sourcePath)return frResolveSourceHeading(position);
  if(position.page!=null)window.__ensurePage?.(position.page);
  const visible=node=>{if(node?.closest?.('.frontmatter'))document.getElementById('app')?.classList.add('show-fm');return node?.isConnected&&node.getClientRects().length?node:null;};
  // A search occurrence is temporary UI; keep its canonical body ID as the saved location.
  if(position.focusId)return visible(document.getElementById(position.focusId));
  const exact=visible(document.getElementById(position.id));if(exact)return exact;
  const block=frReaderBlockReference(position.id);
  if(!block||block.index!=='0'||!window.__readerBuilt)return null;
  return Array.from(document.querySelectorAll('#reading .pganchor')).filter(node=>String(node.dataset.page)===block.page).map(visible).find(Boolean)
    ||visible(document.getElementById('b'+block.page+'-1'))
    ||Array.from(document.querySelectorAll('#reading .folio:not(.rolled)')).filter(node=>String(node.dataset.page)===block.page).map(visible).find(Boolean)||null;
}
function frReaderNavigationLanded(position){
  if(window.__readerLandedSerial===position.serial)return;window.__readerLandedSerial=position.serial;
  if(typeof CustomEvent==='function'&&window.dispatchEvent)window.dispatchEvent(new CustomEvent('fr-reader-navigation',{detail:{state:'landed',url:location.href,id:position.id||null,page:position.page==null?null:String(position.page),serial:position.serial}}));
}
function restoreReaderPosition(position){
  if(!position||window.__readerNavigationSuspended)return;
  const pending={...position};window.__readerPendingPosition=pending;
  const restore=(window.__readerRestoreSerial||0)+1;window.__readerRestoreSerial=restore;
  let attempts=0,stable=0,offset=position.offset,placed=false;
  const finish=()=>{if(window.__readerPendingPosition===pending)window.__readerPendingPosition=null;};
  const settle=()=>{
    if(restore!==window.__readerRestoreSerial||(window.__readerNavSerial||0)!==position.serial||window.__readerNavigationSuspended||++attempts>(position.anchor?250:40)){finish();return;}
    const sc=document.getElementById('scroll');if(!sc){setTimeout(settle,120);return;}
    // Hidden source frames have no usable geometry. Their parent explicitly resumes the snapshot.
    if(sc.getClientRects&&!sc.getClientRects().length){setTimeout(settle,120);return;}
    let target=position.anchor?frResolveReaderAnchor(position):position.id&&document.getElementById(position.id);
    if(!position.anchor&&!target?.isConnected)target=jump(position.page,position.title);
    if(!target&&position.page!=null&&DATA?.__loadRest)DATA.__loadRest().catch(()=>{});
    if(target){
      if(position.anchor&&!placed){window.__frPlaceReaderAnchor(target,position.sourcePath?{block:'start'}:{});placed=true;target.classList.add('anchor-flash');setTimeout(()=>target.classList.remove('anchor-flash'),2300);document.getElementById('app')?.classList.remove('prelanding');}
      const delta=target.getBoundingClientRect().top-sc.getBoundingClientRect().top;
      // The mobile masthead can grow after fonts load. Keep source-heading arrivals
      // below its current bottom instead of freezing the initial desktop-sized gap.
      const header=position.sourcePath&&document.querySelector?.('.ph');
      if(header)offset=Math.max(14,header.getBoundingClientRect().bottom-sc.getBoundingClientRect().top+14);
      if(offset==null)offset=delta;
      const drift=delta-offset;if(Math.abs(drift)>2){sc.scrollTop+=drift;stable=0;}else stable++;
      const pg=DATA?.pages.find(p=>String(p.n)===String(position.page));
      if(pg){window.__folioLock=Date.now()+400;setFolio(pg);}
      if(position.anchor)frReaderNavigationLanded(position);
      if(window.__readerBuilt&&stable>=3){finish();return;}
    }
    setTimeout(settle,120);
  };
  requestAnimationFrame(settle);
}
function cancelReaderNavigation(suspend=false){
  const saved=suspend?captureReaderPosition():null;
  window.__readerNavSerial=(window.__readerNavSerial||0)+1;window.__readerRestoreSerial=(window.__readerRestoreSerial||0)+1;
  window.__readerChoice=null;window.__readerPendingPosition=null;window.__frUserScrolled=true;
  window.__readerNavigationSuspended=suspend;window.__readerSuspendedPosition=saved;
  document.getElementById('app')?.classList.remove('prelanding');
}
window.__frCaptureReaderPosition=()=>{
  const position=captureReaderPosition();if(!position?.focusId)return position;
  const saved={...position};delete saved.focusId;
  const row=document.getElementById(saved.id),sc=document.getElementById('scroll');
  if(row?.isConnected&&row.getClientRects().length&&sc){saved.anchor=false;saved.choice=false;saved.offset=row.getBoundingClientRect().top-sc.getBoundingClientRect().top;}
  return saved;
};
window.__frCancelReaderNavigation=()=>cancelReaderNavigation(true);
window.__frRestoreReaderPosition=position=>{
  if(!position)return false;
  const serial=rememberReaderChoice(position.page,position.title||'',position.anchor?position.id:null);
  if(position.focusId&&window.__readerChoice)window.__readerChoice.focusId=position.focusId;
  if(position.sourcePath&&window.__readerChoice){window.__readerChoice.sourcePath=position.sourcePath;window.__readerChoice.sourceText=position.sourceText;window.__readerChoice.sourceKey=position.sourceKey||'';}
  if(!position.choice&&!position.anchor){window.__readerChoice=null;window.__frUserScrolled=true;}
  restoreReaderPosition({...position,serial});return true;
};
window.__frNavigateReaderAnchor=href=>{
  try{
    const target=new URL(href,location.href),here=new URL(location.href);
    if(target.origin!==here.origin)return false;
    const work=url=>url.searchParams.get('w')||url.searchParams.get('ws')||(/^\/read\/([^/]+?)(?:\.html)?$/.exec(url.pathname)||[])[1]||'';
    const currentWork=work(here)||window.__FR_SLUG__||DATA?.slug||'',targetWork=work(target);
    // the reader may be mounted under a route prefix (MereO: /the-faith-received/read/) — a citation to the SAME page is
    // always ours; the bare /read shapes stay for cross-page doors (owner 2026-09-11 'fix it for mereo': ?p=&hl= never landed)
    const samePage=target.pathname.replace(/\/+$/,'')===here.pathname.replace(/\/+$/,'');
    if(!(samePage||/^\/read(?:\.html|\/[^/]+)?$/.test(target.pathname))||!targetWork||![currentWork,DATA?.slug].filter(Boolean).includes(targetWork))return false;
    // A citation can omit the current lane/view settings; an explicit change still needs navigation.
    for(const [key,value]of target.searchParams)if(!['w','ws','p','section','heading'].includes(key)&&here.searchParams.get(key)!==value)return false;
    let id;try{id=decodeURIComponent(target.hash.slice(1));}catch(_){return false;}
    const sourcePath=target.searchParams.get('section'),sourceKey=target.searchParams.get('heading')||'';
    if(sourceKey&&!sourcePath)return false;
    const sourceRow=sourcePath?readerDisplayOutline().find(row=>row.navSourcePath===sourcePath&&(!sourceKey||row.navSourceKey===sourceKey)):null;
    const sourceText=sourceRow?.navSourceText||'',source=sourcePath?frSourceHeadingRecord(sourcePath,sourceText,sourceKey):null;
    // Baxter's verified Front Matter label precedes the first page marker, so it has
    // no rendered heading. Its contents entry opens the preserved first page.
    const explicitStart=sourceRow&&DATA?.nav_source_version==='eebo-path-v1'&&DATA?.eebo_source_outline?.some(row=>row.path===sourcePath&&row.beforeFirstPage)&&(sourceRow.navPageStart==null||String(sourceRow.navPageStart)===String(DATA.pages?.[0]?.n));
    const baxterStart=DATA?.slug==='eebo-34087'&&DATA.nav_source_version==='eebo-path-v1'&&sourcePath==='0'&&sourceRow?.title==='Front Matter';
    const sourceStart=!source&&!sourceKey&&(explicitStart||baxterStart)?DATA.pages?.[0]?.n:null;
    if(sourcePath&&!source&&sourceStart==null)return false;
    const reference=frReaderBlockReference(target.hash),page=source?.page||(sourceStart==null?null:String(sourceStart))||reference?.page||(!id?target.searchParams.get('p'):null);
    if(source||sourceStart!=null||!id&&page)id='b'+page+'-0';if(!id)return false;
    const serial=rememberReaderChoice(page,sourceRow?.title||'',id);
    if(source){here.searchParams.set('section',sourcePath);here.searchParams.set('p',page);if(sourceKey)here.searchParams.set('heading',sourceKey);else here.searchParams.delete('heading');window.__readerChoice.sourcePath=sourcePath;window.__readerChoice.sourceText=sourceText;window.__readerChoice.sourceKey=sourceKey;}
    else{here.searchParams.delete('p');here.searchParams.delete('section');here.searchParams.delete('heading');}here.hash=id;history.replaceState(history.state,'',here);
    restoreReaderPosition({page,title:sourceRow?.title||'',choice:true,id,...(source?{sourcePath,sourceText,sourceKey}:{}),anchor:true,offset:null,serial});return true;
  }catch(_){return false;}
};
// Real reading movement wins over arrival targets and late hydration corrections.
(function(){const cancel=e=>{const sc=document.getElementById('scroll');if(!sc?.contains(e.target))return;cancelReaderNavigation();};
  document.addEventListener('wheel',cancel,{capture:true,passive:true});document.addEventListener('touchmove',cancel,{capture:true,passive:true});
  document.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key)&&!e.target.closest('input,textarea,select,[contenteditable]'))cancel(e);},true);
})();
// Citation and research anchors may resolve to a merged Flow row spanning several pages. Start
// a row that is taller than the available reading viewport so its cited opening is visible;
// center short passages for a comfortable reading position. The row scroll margin above clears
// the fixed masthead, and the helper is shared with deferred read-tools.js navigation.
function frAnchorBlock(target){
  if(target?.classList?.contains('pganchor'))return 'start';
  const sc=document.getElementById('scroll'),view=(sc&&sc.clientHeight)||window.innerHeight||0;
  const height=target?.getBoundingClientRect?.().height||0;
  return height>Math.max(240,view-24)?'start':'center';
}
window.__frPlaceReaderAnchor=(target,opts={})=>{
  if(!target)return null;
  const block=opts.block||frAnchorBlock(target);
  target.scrollIntoView({block,behavior:opts.behavior||'auto'});
  return block;
};
window.__frAnchorBlock=frAnchorBlock;
function jump(p,ttl){
  // WINDOWED RENDERING (owner 2026-08-20, Baxter "A Safe Religion" on mobile: inline TOC
  // links did nothing): the target folio may still be a placeholder — hydrate it, and its
  // neighbours, BEFORE looking for it. No-op on small works.
  try{if(window.__ensurePage)window.__ensurePage(p);}catch(e){}
  let t=$("#reading").querySelector(`.folio[data-page="${p}"]`);
  // reading-edition merge can leave a folio empty (its body ran on from the previous page) —
  // the inline page anchor is then the true position of the page start
  if(t&&!t.getBoundingClientRect().height){const a=$("#reading").querySelector(`.pganchor.an-en[data-page="${p}"],.pganchor[data-page="${p}"]`);if(a)t=a;}
  if(!t)return null;
  if(t.classList.contains("frontmatter"))app.classList.add("show-fm");const m=t.previousElementSibling;
  // prefer the page's fmark header — but only when VISIBLE: confession works (.app.flow) hide all
  // fmarks, and scrollIntoView on a display:none node is a silent no-op (TOC clicks dead on all
  // 127 confessions — owner 2026-07-22, Tetrapolitan)
  let tgt=(m&&m.classList.contains("fmark")&&m.getClientRects().length)?m:t;
  // in-page section targeting (owner 2026-07-28, Zanchi: "click Book 2 → header not visible"):
  // when the clicked TOC title matches a heading row INSIDE the page, land on the heading itself —
  // the section often starts mid-page and the page top shows the previous section's tail.
  const exact=window.FRReaderNavigation?.exactHeading(DATA,t,ttl);
  if(exact)tgt=exact.classList?.contains('reader-inline-target')?exact:(exact.closest(".row")||exact);
  if(ttl&&!exact){const _n=s=>String(s||"").toLowerCase().replace(/<[^>]+>/g,"").replace(/[^a-z0-9]+/g," ").trim();
    // strip the "Q. 1 — " / "Article 2 — " label so the subject words drive the match
    const nt=_n(String(ttl).replace(/^[^—]{0,16}—\s*/,""));
    if(nt.length>=6){let best=null,bs=0;
      const a=nt.split(" ").filter(w=>w.length>2);
      const score=txt=>{const ht=_n(txt);if(!ht)return 0;
        const hit=a.length?a.filter(w=>ht.includes(w)).length/a.length:0;
        const pref=(ht.startsWith(nt.slice(0,18))||nt.startsWith(ht.slice(0,18)))?1:0;
        return Math.max(hit,pref);};
      t.querySelectorAll(".row.rhead .csub").forEach(h=>{if(!h.getClientRects().length)return;
        const sc=score(h.textContent);if(sc>bs){bs=sc;best=h;}});
      // headings often don't carry the subject (born-digital: "Q. 1 — Whether uti…" starts as BODY
      // text under a bare "Quaestio I." head, Bonaventure 2026-07-28) — also match each row's
      // opening text and land on the best row.
      if(bs<0.6)t.querySelectorAll(".row:not(.rhead)").forEach(r=>{if(!r.getClientRects().length)return;
        const sc=score((r.textContent||"").slice(0,260));if(sc>bs){bs=sc;best=r;}});
      if(best&&bs>=0.6)tgt=best.closest(".row")||best;}}
  tgt.scrollIntoView({behavior:"auto",block:"start"});window.__frJumpEl=tgt;return tgt;}  // page starts at "pg. N", clear of the masthead (scroll-margin-top)
// ---- canonical locators ----
// Scanned works cite by PRINTED PAGE ("p. N"). Born-digital (SCTA) works have no page image,
// so they're cited by their place in the spine — the scholastic locator (lib./dist./q./art./
// ch.) parsed from the nearest structure heading, e.g. "d. 1, q. 2, a. 2".
function spineLoc(title){
  if(!title)return null;const t=String(title).split("·")[0];
  const pats=[[/\b(?:Liber|Lib|Book)\.?\s+([IVXLCDM\d]+)/i,"lib. "],[/\b(?:Distinctio|Dist)\.?\s+([IVXLCDM\d]+)/i,"d. "],
    [/\b(?:Pars)\s+([IVXLCDM\d]+)/i,"pars "],[/\b(?:Disputatio|Disp)\.?\s+([IVXLCDM\d]+)/i,"disp. "],
    [/\b(?:Quaestio|Quaest|Question|Q)\.?\s+([IVXLCDM\d]+)/i,"q. "],[/\b(?:Articulus|Art|Article)\.?\s+([IVXLCDM\d]+)/i,"a. "],
    [/\b(?:Caput|Cap|Chapter|Ch)\.?\s+([IVXLCDM\d]+)/i,"ch. "],[/\b(?:Sectio|Sect|Section)\.?\s+([IVXLCDM\d]+)/i,"sect. "],
    [/\b(?:Thesis)\s+([IVXLCDM\d]+)/i,"th. "]];
  const out=[];for(const[re,lab]of pats){const m=t.match(re);if(m)out.push(lab+m[1]);}
  return out.length?out.join(", "):null;
}
let _structSorted=null,_pageByN=null;
// Navigation/display consumers share the reader-navigation repair registry. DATA.structure remains
// the canonical source for SECMAP and body assembly; this helper is only for derived display views.
function readerDisplayPageAttr(node,pages){
  const raw=String(node?.page??"").trim(),first=String(pages?.[0]?.n??1).trim()||"1";
  if(!raw)return first;
  const value=Number(raw),floor=Number(first);
  // Numeric page numbers retain the existing front-page lower bound. Compound identifiers
  // (for example "52:0183A") are source IDs and must remain strings throughout navigation.
  return Number.isFinite(value)?String(Math.max(value,Number.isFinite(floor)?floor:1)):raw;
}
function readerDisplayAttribute(value){
  return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function readerDisplayOutline(){
  const source=DATA?.structure||[],reviewed=window.FRReaderNavigation?.outline(DATA)||source;
  if(reviewed!==source)return reviewed;
  return window.FRSourceOutline?.outline(DATA,typeof TEI_PAGES==='undefined'?null:TEI_PAGES)||source;
}
function readerOutlineHref(row){
  const url=new URL(location.href);url.searchParams.delete('section');url.searchParams.delete('heading');
  url.searchParams.set('p',String(row.page));url.hash='b'+String(row.page)+'-0';
  if(row.navSourcePath){url.searchParams.set('section',row.navSourcePath);if(row.navSourceKey)url.searchParams.set('heading',row.navSourceKey);}
  return url.href;
}
function locOf(n){
  const corrected=window.FRReaderNavigation?.locator(DATA,n);if(corrected)return corrected;
  if(DATA&&DATA.has_pages)return (/^P[LG]\s*\d/i.test(DATA.volume||"")?"col. ":"p. ")+n;
  // born-digital: prefer the export-time deep locator (page.loc, body-mined + carried forward),
  // then the nearest TOC heading parse, then the bare section ordinal.
  if(!_pageByN){_pageByN={};(DATA&&DATA.pages||[]).forEach(p=>_pageByN[p.n]=p);}
  const pg=_pageByN[n];if(pg&&pg.loc)return pg.loc;
  if(!_structSorted){_structSorted=readerDisplayOutline().slice().sort((a,b)=>a.page-b.page);_structSorted=_structSorted.filter((e,i,a)=>!i||e.title!==a[i-1].title||e.page!==a[i-1].page||e.depth!==a[i-1].depth);
    // banner furniture ("VOLUME XIII.", "OPERA", "TOMUS VII") is a title-page echo, not a
    // place — the running locator must never wear it (owner 2026-09-02 Melanchthon v13)
    _structSorted=_structSorted.filter(e=>!/^(volume|volumen|tomus|tome|band|opera|liber)[\s.]*[ivxlcd\d]*[\s.]*$/i.test(String(e.title||"").trim()));}
  let node=null;for(const s of _structSorted){if(s.page<=n)node=s;else break;}
  if(!node&&!isFinite(+n))node=_structSorted[0]||null;   // roman-paged front matter: never "§ NaN"
  return (node&&spineLoc(node.title))||(isFinite(+n)?("§ "+n):"");
}
// ---- About: orient ANY reader — WHAT this work is (blurb) + WHO wrote it (author bio). Two small
// Blob artifacts (v1/blurbs.json keyed by slug, v1/authors.json keyed by author) fetched once. ----
let _aboutP=null;
function loadAbout(){ if(_aboutP)return _aboutP; if(!BLOB){_aboutP=Promise.resolve({});return _aboutP;}
  const V=window.__FR_VER?("?v="+window.__FR_VER):"";
  // SHARDED NOTES (2026-08-23): the core files carry the confessional shelves; the four big
  // families (Latin/Greek/Eastern Fathers, English Divines) keep theirs in v1/blurbs/<family>
  // and v1/authors/<family>, so this work fetches its own family's shard and nothing else's.
  // Family comes from the work's meta (DATA.tradition), falling back to the slug prefix.
  const fam=((DATA&&DATA.tradition)||"")||({pld:"Latin Fathers",pg:"Greek Fathers",po:"Eastern Fathers",eebo:"English Divines"}[String((DATA&&DATA.slug)||"").split("-")[0]]||"");
  const sh={"Latin Fathers":"latin-fathers","Greek Fathers":"greek-fathers","Eastern Fathers":"eastern-fathers","English Divines":"english-divines"}[fam];
  const j=u=>fetch(u).then(r=>r.ok?r.json():{}).catch(()=>({}));
  _aboutP=Promise.all([
    j(BLOB+"/v1/blurbs.json"+V), j(BLOB+"/v1/authors.json"+V),
    sh?j(BLOB+"/v1/blurbs/"+sh+".json"+V):Promise.resolve({}), sh?j(BLOB+"/v1/authors/"+sh+".json"+V):Promise.resolve({})
  ]).then(([bl,au,bl2,au2])=>({blurbs:Object.assign({},bl2||{},bl||{}),authors:Object.assign({},au2||{},au||{})}));
  return _aboutP; }
function aboutFor(){ return loadAbout().then(d=>({blurb:d.blurbs[DATA.slug]||null, author:d.authors[DATA.author]||d.authors[DATA.author_la]||null})); }
function enrichSub(){ aboutFor().then(d=>{ if(!d.author&&!d.blurb)return;
  const au='<a class=subau href="/?a='+encodeURIComponent(DATA.author)+'" title="All works by '+esc(DATA.author)+'">'+esc(DATA.author)+'</a>'
    +((d.author&&d.author.dates&&!/unknown/i.test(d.author.dates))?(" ("+esc(d.author.dates)+")"):"");
  const bits=[au];
  if(DATA.volume)bits.push(esc(DATA.volume));
  if(d.blurb&&d.blurb.genre)bits.push(esc(d.blurb.genre));
  const s=$("#sub"); if(!s)return; s.innerHTML=bits.join(" · ");
}).catch(()=>{}); }
function openAbout(){ aboutFor().then(d=>{
  let ov=document.getElementById("aboutOv"); if(ov)ov.remove();
  ov=document.createElement("div"); ov.id="aboutOv"; ov.className="about-ov";
  const a=d.author,b=(typeof d.blurb==="string")?{blurb:d.blurb}:d.blurb;   // blurbs.json carries plain strings for newer works
  const authLine=[a&&a.dates,a&&a.tradition,a&&a.affiliation].filter(Boolean).join(" · ");
  let h='<div class="about-box"><div class="about-h"><div><h2>'+esc(DATA.title_en||DATA.title)+'</h2><div class="ah-meta">'+esc([(DATA.title_en&&DATA.title_en!==DATA.title)?DATA.title:null,DATA.author,DATA.volume].filter(Boolean).join(" · "))+'</div></div><button class="about-x" title="Close (esc)">✕</button></div><div class="about-body">';
  // WHO first — situate the person, then the work
  h+='<div class="about-sec"><h3>'+esc(DATA.author)+'</h3>';
  if(authLine)h+='<div class="about-tags">'+esc(authLine)+'</div>';
  if(a&&a.bio)h+='<div class="about-prose"><p>'+esc(a.bio)+'</p></div>';
  if(a&&a.significance)h+='<div class="about-sig">'+esc(a.significance)+'</div>';
  if(a&&a.key_works&&a.key_works.length)h+='<div class="about-kw"><b>Key works:</b> '+esc(a.key_works.join(" · "))+'</div>';
  h+='</div><div class="about-sec">';
  if(b&&b.blurb){ if(b.genre)h+='<div class="about-tags"><b>'+esc(b.genre)+'</b></div>'; h+='<div class="about-prose"><p>'+esc(b.blurb)+'</p></div>'; }
  h+='</div></div>';    // no machine fallback sentence, no generated-orientation eyebrow (user 2026-07-20): author + work, period.
  ov.innerHTML=h; document.body.appendChild(ov);
  const close=()=>{ov.remove();removeEventListener("keydown",esk);};
  function esk(e){if(e.key==="Escape")close();}
  ov.addEventListener("click",e=>{if(e.target===ov)close();});
  ov.querySelector(".about-x").onclick=close; addEventListener("keydown",esk);
}).catch(()=>{}); }
function wireAbout(){ const b=$("#rdAbout"); if(b)b.onclick=openAbout; enrichSub(); }
// TEI PATH (2026-08-10): fetches the per-lane TEI sidecars, pre-segments them by <pb>, and hands
// renderFolioTEI() (defined inside build(), alongside renderFolio) a page→[elements] map for each
// lane. Never touches the md pipeline. CORRECTED 2026-08-17 (reader-rehaul P0): has_tei is no
// longer dormant — it is set and live in production (verified: luther-wa-schriften-1/meta.json
// carries has_tei:true, tei_v set) and TEI IS THE STANDARD rendering path wherever it exists, on
// by default (see the activation check ~5137 below, updated by the owner 2026-08-13). Everything
// downstream in this file that reads TEI_ON is live-traffic code today, not a dormant branch.
let TEI_ON=false,TEI_PAGES=null;
// REHAUL P4 (2026-08-17): "anchored" (default — genuine in-text callouts, classic superscript
// footnotes via the existing appBank/teiNote path, unchanged) vs "band" (apparatus-criticus style:
// notes vastly outnumber refs, there is no callout to hang a numeral on, so appBank's new branch
// below renders them as an unnumbered continuous band instead of inventing markers — DESIGN.md
// §1.4 is explicit that inventing callouts is the wrong move here). Computed once per work in
// loadTEI() from the parsed sidecars, read by appBank() at render time.
let APPARATUS_MODE="anchored";
// REHAUL P5 (2026-08-17): Map<normalized-page-key, kind> of pages carrying a genuine
// tail-of-volume finding aid (Index Quaestionum / errata / topical / citations / alphabetic —
// DESIGN.md §2), as opposed to the mid-work tabula-of-disputations the existing .ixl branch in
// teiCell already renders correctly and is left untouched. Populated in loadTEI() from
// DATA.index_pages when the corpus pipeline provides it (not yet shipped on any live work as of
// this patch — verified meta.json.index_pages absent even on the flagship Luther-WA publish),
// else via the looksLikeTailIndex() stopgap below, per §2.2's explicit stopgap authorization.
let INDEX_PAGES=null;
const teiNorm=v=>{const s=String(v==null?"":v).trim(),i=parseInt(s,10);return isNaN(i)?s:String(i);};  // strips zero-padding so pb@n="0017" keys the same as pg.n===17
function teiSegment(doc){
  const map={};if(!doc)return map;
  const pbEl=doc.querySelector("pb");
  if(!pbEl){
    // 2026-08-23 (Poncius English, born-digital, NO page breaks by design): a TEI whose
    // pagination is its STRUCTURE. Each leaf <div> becomes a page, and a non-leaf div's own
    // paragraphs (a question's introduction before its conclusions) become a page of their
    // own before its children. Numbered in document order; the TEI itself carries no marks.
    const root=doc.querySelector("text")||doc.documentElement;let i=0;
    const own=d=>Array.from(d.childNodes).filter(k=>k.nodeType===1&&!/^(div|body|front|back|group)$/.test(k.localName));
    (function walk(d){
      const kids=Array.from(d.childNodes).filter(k=>k.nodeType===1);
      const subs=kids.filter(k=>/^(div|body|front|back|group)$/.test(k.localName));
      const mine=own(d);
      if(mine.length&&(d.localName==="div"||!subs.length)){
        // a long leaf (a question with no conclusion sub-divisions can run to 70k chars) is
        // chunked at ~15 paragraphs so no single page is twenty printed pages long
        const chunk=[];let acc=[];
        mine.forEach(e=>{acc.push(e);if(acc.filter(x=>x.localName==="p"||x.localName==="ab").length>=15){chunk.push(acc);acc=[];}});
        if(acc.length)chunk.push(acc);
        chunk.forEach(c=>{i++;map[teiNorm(String(i))]=c;});}
      subs.forEach(walk);
    })(root);
    return map;}
  // walk childNODES: a partially-tagged sidecar page (model left prose/### lines untagged)
  // carries content in stray text nodes — wrap each blank-line block as a synthetic element
  // so NOTHING is invisible and document order is preserved (owner 2026-08-10 Capreolus p28:
  // '### Articulus II.' sat untagged mid-page → heads seemed to teleport, prose vanished).
  const wrapTxt=(s,out)=>{s.split(/\n\s*\n+/).forEach(b=>{
    b=b.trim();if(!b)return;
    if(/^#{1,6}\s/.test(b)){
      b.split(/\n/).forEach(ln=>{ln=ln.trim();if(!ln)return;
        const hm=ln.match(/^(#{1,6})\s+(.*)$/);
        const e=doc.createElement(hm?"head":"p");
        if(hm){e.setAttribute("type",hm[1].length<=2?"main":"sub");e.textContent=hm[2];}
        else e.textContent=ln;
        out.push(e);});
    }else{const e=doc.createElement("p");e.textContent=b;out.push(e);}});};
  let n=null;
  const root=doc.querySelector("text")||pbEl.parentElement;
  const flat=[];
  (function walk(node){node.childNodes.forEach(k=>{
    // v2.1 div nesting: flatten for paging. 2026-08-18 (scholarios/calvin class): sidecars
    // uploaded with the full <TEI><text><body> wrapper intact keep their pbs under <body> —
    // descend through structural containers too, not just <div>.
    if(k.nodeType===1&&/^(div|body|front|back|group)$/.test(k.localName)){walk(k);return;}
    flat.push(k);});})(root);
  flat.forEach(k=>{
    if(k.nodeType===3){if(n!=null&&map[n]&&k.nodeValue.trim())wrapTxt(k.nodeValue,map[n]);return;}
    if(k.nodeType!==1)return;
    if(k.localName==="pb"){n=teiNorm(k.getAttribute("n"));if(n&&!map[n])map[n]=[];return;}
    if(n!=null&&map[n])map[n].push(k);
  });
  return map;}
async function loadTEI(){
  try{
    // PL canon mode: the docs were already parsed straight from the family canon
    if(window.__pldCanonDocs){
      const {la,en}=window.__pldCanonDocs;window.__pldCanonDocs=null;
      TEI_PAGES={la:teiSegment(la),en:teiSegment(en)};TEI_ON=true;
      // canon works ship placeholder pages — backfill plain text from the segments so
      // this-work search and notebook export see real content (Reader Map queue #3)
      try{(DATA.pages||[]).forEach(pg2=>{const k=String(pg2.n).replace(/^0+/,"")||String(pg2.n);
        for(const [lane,seg] of [["la",TEI_PAGES.la],["en",TEI_PAGES.en]]){
          if(pg2[lane])continue;
          const els=seg[pg2.n]||seg[k]||seg[String(pg2.n).padStart(4,"0")];
          if(els&&els.length)pg2[lane]=els.map(e=>e.textContent||"").join("\n\n").trim();
        }});}catch(e){}
      try{document.getElementById("app").classList.add("teiflow");}catch(e){}
      return;
    }
    const base=window.__TEI_BASE||DATA.base||"";   // __TEI_BASE is a deliberate override and wins
    const [laXml,enXml]=await Promise.all([
      fetch(base+"tei.la.xml?v="+(DATA.tei_v||0)).then(r=>r.ok?r.text():"").catch(()=>""),
      fetch(base+"tei.en.xml?v="+(DATA.tei_v||0)).then(r=>r.ok?r.text():"").catch(()=>"")]);
    const P=new DOMParser();
    const parse=x=>{if(!x)return null;const d=P.parseFromString(x,"application/xml");return d.querySelector("parsererror")?null:d;};
    let laDoc=parse(laXml),enDoc=parse(enXml);
    if(!laDoc){
      // French-source works (Guettée, Hefele) carry tei.fr.xml, not tei.la.xml — the
      // source lane is French (owner 2026-08-26 "wheres the latin lane")
      try{const frXml=await fetch(base+"tei.fr.xml?v="+(DATA.tei_v||0)).then(r=>r.ok?r.text():"").catch(()=>"");
        const frDoc=parse(frXml);
        if(frDoc){laDoc=frDoc;
          setTimeout(()=>{const mp=document.getElementById("m-par");if(mp)mp.textContent="French";},400);}}catch(e){}
    }
    if(!laDoc&&!enDoc){
      console.warn("[TEI] sidecar fetch/parse FAILED — falling back to classic rendering",{la:!!laXml,en:!!enXml});
      try{const b=document.createElement("div");b.className="teiwarn";b.textContent="TEI view unavailable for this work — showing classic view";
        b.style.cssText="position:fixed;bottom:14px;left:14px;z-index:99;background:#8a2f2f;color:#fff;font:12px/1.4 sans-serif;padding:6px 10px;border-radius:6px;opacity:.92";
        document.body.appendChild(b);setTimeout(()=>b.remove(),9000);}catch(e){}
      return;}
    TEI_PAGES={la:teiSegment(laDoc),en:teiSegment(enDoc)};TEI_ON=true;
    // SEAM FLOW (owner 2026-08-19, Baxter Confession 'this should flow'): the .cont/.tail
    // page-seam join CSS is gated on .teiflow, which only the PL-canon branch set — so every
    // generic TEI work (the EEBO divines class: en_only, no facsimile) kept a fake paragraph
    // break at each page turn. Born-digital single-lane TEI reads as a flowing edition.
    try{if(DATA.en_only&&!DATA.has_pages)document.getElementById("app").classList.add("teiflow");}catch(e){}
    // TEI-ONLY EXPORTS (owner 2026-08-18, scholarios vol 2 empty): a meta with neither
    // shards nor single never builds DATA.pages, so the folio loop rendered NOTHING even
    // though the TEI sidecar is complete. Synthesize the folio skeleton from the TEI's own
    // page breaks — the same move the canon loaders make.
    try{
      if(DATA&&(!DATA.pages||!DATA.pages.length)){
        const seg=(TEI_PAGES.en&&Object.keys(TEI_PAGES.en).length)?TEI_PAGES.en:TEI_PAGES.la;
        const ks=Object.keys(seg||{});
        if(ks.length){
          // pb facs → the scan pane (Colquhoun class 2026-08-18: archive.org leaf
          // images carried on the sidecar's own pbs)
          const fmap={};
          [laDoc,enDoc].forEach(d2=>{if(!d2)return;
            d2.querySelectorAll("pb[facs]").forEach(pb=>{
              const n=teiNorm(pb.getAttribute("n")||""),f=pb.getAttribute("facs")||"";
              if(n&&/\.(jpe?g|png|webp)(\?|$)/i.test(f)&&!fmap[n])fmap[n]=f;});});
          DATA.pages=ks.map(k=>({n:/^\d+$/.test(k)?parseInt(k,10):k,la:"",en:"",
              img:fmap[teiNorm(k)]||null,thumb:fmap[teiNorm(k)]||null}))
            .sort((a,b)=>(parseInt(String(a.n).replace(/^0+/,""),10)||0)-(parseInt(String(b.n).replace(/^0+/,""),10)||0));
          DATA.n_pages=DATA.pages.length;
          if(Object.keys(fmap).length>3)DATA.has_pages=true;
          // img_base works on the TEI-only path (espen/cic class, 2026-09-09): their pbs
          // carry no facs= — the leaves live at img_base+n+".webp" like every staged
          // facsimile — but the meta-prep img pass runs before this synthesis exists,
          // so without this the scan pane stayed dark on all eight works.
          if(DATA.img_base){DATA.pages.forEach(p=>{if(!p.img&&/^\d+$/.test(String(p.n))){p.img=DATA.img_base+p.n+".webp";p.thumb=p.img;}});DATA.has_pages=true;}
        }
      }
    }catch(e){}
    // REHAUL P4: ref:note ratio across the whole work decides APPARATUS_MODE once (per-page
    // variance exists but a per-work default is the corpus norm — Trent/chandieu/pisani are
    // unanchored cover to cover, not on alternating pages; a per-page recompute is the natural
    // upgrade if a mixed-mode work turns up, not added speculatively here). Excludes margin
    // notes — those are P2's rail, a different apparatus category entirely, not part of this
    // anchored/unanchored footnote question.
    try{
      const refCount=d=>d?d.querySelectorAll("ref").length:0;
      const footCount=d=>d?[...d.querySelectorAll("note")].filter(n=>(n.getAttribute("place")||"foot")!=="margin").length:0;
      const refs=refCount(laDoc)+refCount(enDoc), foot=footCount(laDoc)+footCount(enDoc);
      APPARATUS_MODE=foot>0&&(refs/foot)<=0.3?"band":"anchored";
    }catch(e){APPARATUS_MODE="anchored";}
    // REHAUL P5: resolve INDEX_PAGES — corpus flag first, client stopgap only when it's absent.
    try{
      if(DATA.index_pages&&DATA.index_pages.length){
        INDEX_PAGES=new Map(DATA.index_pages.map(x=>[teiNorm(x.page),x.kind]));
      }else{
        const hit=looksLikeTailIndex();
        INDEX_PAGES=hit?new Map([[hit.page,hit.kind]]):new Map();
      }
    }catch(e){INDEX_PAGES=new Map();}
    // POPOVER ROBUSTNESS (owner 2026-08-12 'hover on 14, nothing is there'): register EVERY
    // note into __TEINOTES straight from the parsed docs — never dependent on folio render
    // order, lane, or a mid-render error starving later registrations.
    try{
      window.__TEINOTES=window.__TEINOTES||{};
      [laDoc,enDoc].forEach(doc=>{if(!doc)return;
        doc.querySelectorAll("note").forEach(e=>{
          const id=(e.getAttribute("xml:id")||"").replace(/^n-/,"").replace(/^(fn\d*)-(?:la|en)-/,"$1-");
          if(id&&!window.__TEINOTES[id])window.__TEINOTES[id]=(e.textContent||"").trim();});});
    }catch(e){}
    try{document.getElementById("app").classList.add("teiflow");}catch(e){}
  }catch(e){}
}
// REHAUL P5 stopgap (2026-08-17, DESIGN.md §2.2 parenthetical): single small function, called
// ONLY when DATA.index_pages is absent from meta.json (verified absent corpus-wide as of this
// patch). Finds the LAST list[type="index"] in the work (scanning TEI_PAGES — no re-parse of the
// raw XML, the segmented map already has everything in page order since object keys with
// integer-like string values iterate ascending in JS regardless of insertion order) and checks
// whether ITS items are dominated by page/pag. locators — the one shape DESIGN.md's TEI audit
// says actually marks a genuine back-of-book finding aid apart from the mid-work tabula the
// existing .ixl branch already handles. Retire this the moment meta.json.index_pages ships —
// do not let the flag and this heuristic both stay live indefinitely (the audit's own warning
// against a third head on the index-detection hydra).
// CORRECTNESS NOTE: the locator regex requires a WORD BOUNDARY before "p"/"pag" (`\bp(?:ag)?\.`).
// Verified against a 36-work live sample (pulling real tei.la/en.xml from the CDN): without the
// boundary, "cap. 78" false-positives as a page locator (the "p. 78" substring inside "cap."), which
// mis-flagged a patristic-citation paragraph list in an Estius volume as a genuine index. With the
// boundary, zero false positives remained in that sample, and — consistent with DESIGN.md §2.4's
// own finding that no work in its 12-work sample is genuinely alphabetic/locator-dominated — zero
// works in the live sample crossed the 0.5 threshold either, so this ships correctly dormant
// against today's corpus rather than falsely activating.
function looksLikeTailIndex(){
  if(DATA.index_pages&&DATA.index_pages.length)return null;
  const src=(TEI_PAGES&&TEI_PAGES.en&&Object.keys(TEI_PAGES.en).length)?TEI_PAGES.en:(TEI_PAGES&&TEI_PAGES.la);
  if(!src)return null;
  let last=null,lastKey=null;
  Object.keys(src).forEach(k=>{
    (src[k]||[]).forEach(e=>{
      if(e.localName==="list"&&e.getAttribute("type")==="index"){last=e;lastKey=k;}
    });
  });
  if(!last)return null;
  const its=[...last.children].filter(c=>c.localName==="item");
  if(its.length<4)return null;   // too small to be a genuine finding aid, not worth the treatment
  const loc=/\bp(?:ag)?\.\s*\d+/i;
  const hits=its.filter(it=>loc.test(it.textContent||"")).length;
  if(hits/its.length<0.5)return null;
  let ph=last.previousElementSibling;
  while(ph&&ph.localName==="pb")ph=ph.previousElementSibling;
  const ht=(ph&&ph.localName==="head"?(ph.textContent||""):"").toLowerCase();
  const kind=/errat|corrig/.test(ht)?"errata":/quaestion|question/.test(ht)?"quaestionum":/citat|auctor|scriptur/.test(ht)?"citations":"topical";
  return {page:teiNorm(lastKey),kind};
}
// REHAUL P5 (2026-08-17): renders a genuine back-of-book finding aid per DESIGN.md §2.3 — sibling
// to teiCell, called from teiCell's list[type=index] branch only when INDEX_PAGES flags the
// current page (client stopgap above, or a future meta.json.index_pages). Returns an HTML string,
// same contract as every other teiCell branch. Operates on plain text (`.textContent`, `esc()`)
// rather than teiInline()'s tag-preserving walk — these are locator lines, not prose; the classic
// .ixl tabula branch keeps its inline-markup fidelity untouched since this is a NEW codepath, not
// a rewrite of it.
function ixReseg(items){
  const bare=/^\s*[\dIVXLCM]+\.?\s*$/i;
  const raw=items.map(it=>{
    const lab=it.querySelector(':scope > label[rend="run-in"]');
    const full=(it.textContent||"").trim();
    const labTxt=lab?(lab.textContent||"").trim():"";
    const tail=lab?full.slice(labTxt.length).replace(/^[.,;:\s]+/,"").trim():full;
    return {label:labTxt,text:tail,full};
  });
  const out=[];let carry="";
  raw.forEach(r=>{
    const isOrphan=bare.test(r.full)||(r.label&&!r.text);
    if(isOrphan){carry+=(carry?" ":"")+r.full;return;}
    // text WITHOUT the label: renderTrueIndex prints the label as its own .ixhw span (Capreolus vol-7
    // p312 showed "INDEX QUÆSTIONUM … ABSTRACTUM" twice, 2026-08-29)
    out.push({label:r.label,text:(carry?carry+" ":"")+r.text});
    carry="";
  });
  if(carry&&out.length)out[out.length-1].text+=" "+carry;   // trailing orphan with no following item — attach rather than drop
  return out;
}
function ixOrdering(merged){
  const labs=merged.map(m=>m.label).filter(Boolean);
  if(labs.length<Math.max(3,merged.length*0.6))return "unmarked";
  const numRe=/^[\dIVXLCMivxlcm]+\.?$|^Q(?:uaestio)?\.?\s*\d+/i;
  if(labs.every(l=>numRe.test(l)))return "numbered";
  const letters=labs.map(l=>l.trim()[0]).filter(Boolean).map(c=>c.toUpperCase());
  if(letters.length<3)return "unmarked";
  let nonDecreasing=true;
  for(let i=1;i<letters.length;i++)if(letters[i]<letters[i-1]){nonDecreasing=false;break;}
  return (nonDecreasing&&new Set(letters).size>=3)?"alphabetic":"unmarked";
}
function renderTrueIndex(items,kind){
  const merged=ixReseg(items);
  if(!merged.length)return "";
  const order=ixOrdering(merged);
  const KIND_LABEL={quaestionum:"Index Quaestionum",errata:"Errata",citations:"Index of Citations",topical:"Index",alphabetic:"Index",contents:"Contents"};
  // Akademie contents (Leibniz, 2026-08-28): meta.piece_pages maps each entry's trailing folio
  // code ('110000') to our page, so the code becomes the jump link and the block is labelled as
  // what it is -- the volume's table of contents, not a quaestio index.
  const PP=(typeof DATA!=="undefined"&&DATA&&DATA.piece_pages)||null;
  const isContents=!!PP&&merged.some(m=>/\d{6}\s*$/.test(m.text||""));
  const heading=isContents?"Contents":(KIND_LABEL[kind]||"Index");
  const pgo=t=>{t=t.replace(/\((?:p|pag)\.\s*(\d+)\s*\.?\s*\)/g,(m,n)=>`<a class="pgo" data-p="${parseInt(n,10)}" href="#">${esc(m)}</a>`);
    if(PP)t=t.replace(/(\d{6})(?!\d)\s*$/,(m,c)=>PP[c]?`<a class="pgo" data-p="${PP[c]}" href="#" title="go to this piece">${c}</a>`:m);
    return t;};
  let lastLetter="";
  const rows=merged.map(m=>{
    let letterHdr="";
    if(order==="alphabetic"&&m.label){
      const L=m.label.trim()[0].toUpperCase();
      if(L&&L!==lastLetter){letterHdr=`<h4 class="ixletter">${esc(L)}</h4>`;lastLetter=L;}
    }
    const markerCls=order==="numbered"?"ixnum":order==="alphabetic"?"ixaz":"ixplain";
    const label=m.label?`<span class="ixhw">${esc(m.label)}</span> `:"";
    return letterHdr+`<p class="${markerCls}">${label}${pgo(esc(m.text||""))}</p>`;
  }).join("");
  const dense=merged.length>=6&&merged.filter(m=>((m.label||"")+" "+(m.text||"")).trim().length<=28&&/\d/.test(m.text||"")).length>=0.6*merged.length;
  return `<div class="ixtrue${dense?" ixdense":""}"><h3 class="csub inflow ixtrueh">${esc(heading)}</h3><div class="ixtruel">${rows}</div></div>`;
}
function build(){
  _structSorted=null;   // recompute spine index for this work
  const _entitle=DATA.title_en||DATA.title;   // English primary; the original Latin goes to the subtitle line
  document.title="The Faith Received — "+_entitle;
  $("#wt").textContent=_entitle;$("#wt").title=_entitle;$("#h1").textContent=_entitle;
  app.classList.toggle('source-en',DATA.src_lang==='en');
  if(DATA.src_lang==='en')applyLanes();
  {const c=$("#coins");if(c)c.title=coinsOf(DATA);}   // Zotero/Mendeley COinS — reference managers auto-detect this citation
  // English-only works (e.g. Baxter's Methodus — no Latin parallel; the Ramist diagrams live in the
  // facsimile): hide the empty Latin lane, render a single English column, drop the Parallel control.
  // canon-mode works (PL) carry PLACEHOLDER pages (la:"") — the empty-lane heuristic
  // misread every one as English-only and hid the Latin button (owner 2026-08-17
  // 'no latin'). Canon works trust their explicit en_only flag alone.
  const _isCanon=!!window.__pldCanonDocs||/^(pld|pg|po)-\d+$/.test(String(DATA.slug||""));
  const _teiLa=!!(typeof TEI_PAGES!=="undefined"&&TEI_PAGES&&TEI_PAGES.la&&Object.keys(TEI_PAGES.la).length);   // a loaded TEI Latin lane is authority — synthesized DATA.pages carry empty la strings (the CIC/Brochmand class; owner 2026-08-26 'no latin')
  const enOnly=DATA.en_only===true || (!_isCanon && !_teiLa && (DATA.pages||[]).length>0 && (DATA.pages||[]).every(p=>!((p.la||"").trim())));
  app.classList.toggle("en-only",enOnly);
  // SEAM FLOW for ALL born-digital single-lane works (owner 2026-08-20 'fix this in
  // confessions too'): md-based confessions/Denzinger have the same meaningless page
  // breaks as the TEI divines — the .cont/.tail join CSS applies via the same class.
  if(enOnly&&!DATA.has_pages){try{app.classList.add("teiflow");}catch(e){}
    // SPLIT-HEAD HEAL (owner 2026-08-20, confessions/Denzinger: 'Chap. 5. On the Necessity
    // of' ¶ 'Adults, and Whence it Proceeds'): a heading broken across a page boundary
    // renders as two head rows — merge when the first ends mid-phrase. Head rows carry no
    // #b ids, so DOM-merging them is anchor-safe. Retried as folios stream in.
    if(!window.__healHeads){window.__healHeads=()=>{try{
      const FN=/\b(of|and|the|for|in|to|on|or|an|by|with|from|unto|whence|what|which|is|are|its|their)$/i;
      let guard=0;
      for(let again=true;again&&guard<40;){again=false;guard++;
        const all=[...document.querySelectorAll("#reading .row")];
        for(let i=0;i<all.length-1;i++){
          const a2=all[i];
          if(!a2.classList.contains("rhead"))continue;
          // next ROW in document order must also be a head — body text between = two real heads
          const b2=all[i+1];
          if(!b2||!b2.classList.contains("rhead"))continue;
          const ta=(a2.textContent||"").trim(),tb=(b2.textContent||"").trim();
          if(!ta||!tb||/[.!?:;]$/.test(ta))continue;
          if(FN.test(ta)||/^[a-z]/.test(tb)){
            const ha=a2.querySelector("h2,h3,h4")||a2;
            ha.textContent=(ta+" "+tb).replace(/\s+/g," ");
            b2.remove();again=true;break;
          }
        }
      }
    }catch(e){}};}
    // SEAM-CONT HEAL (live-DOM finding 2026-08-20: 130 .tail rows, 0 .cont — the pair
    // lives in DIFFERENT folio sections, so the render-time partner never landed).
    // Document-order pass: every .tail row's next body row becomes .cont.
    if(!window.__healSeams){window.__healSeams=()=>{try{
      const rows=[...document.querySelectorAll("#reading .row")].filter(r=>!r.classList.contains("rhead"));
      for(let i=0;i<rows.length-1;i++){
        if(rows[i].classList.contains("tail")&&!rows[i+1].classList.contains("cont"))
          rows[i+1].classList.add("cont");
      }
      // COMBINE THE PARAGRAPH, don't merely un-indent it (owner 2026-08-20: "fix this
      // corpus wide … I have flagged this issue like 10 times"). A sentence the printer
      // broke at a folio turn is ONE paragraph, and every work in the corpus has them.
      // The continuation's prose moves into the paragraph it continues, with an inline
      // folio marker at the junction that CARRIES THE PAGE ANCHOR — so page jumps still
      // land exactly where the page turns. Both lanes must continue, or neither is
      // touched: a one-sided merge desyncs the parallel text (the _alignPair law).
      // EEBO ONLY (owner 2026-08-20: "NO PO is broken by design … because we align with
      // the ocr" / "PG too — just fix EEBO"). Patrologia Graeca and Orientalis break their
      // paragraphs at the SCAN's own segment boundaries: joining them would desync text
      // from image and is not a defect to fix. EEBO's TCP transcription answers to no
      // facsimile lane here, so a sentence the folio split there is simply broken.
      const _eebo=(typeof DATA!=="undefined"&&DATA&&/^eebo-/.test(String(DATA.slug||"")));
      for(let i=1;i<rows.length&&_eebo;i++){
        const r=rows[i], prev=rows[i-1];
        if(r.dataset.seamed||!prev)continue;
        // A BROKEN PARAGRAPH IS A BROKEN PARAGRAPH wherever it occurs — not only at a
        // folio section boundary (owner 2026-08-20: "fix this corpus wide"). Measured on
        // the canon: 13.8% of Patrologia Graeca paragraphs and 20.4% of Patrologia
        // Orientalis paragraphs end mid-sentence with the next beginning in lower case.
        // Either the section pass already marked the pair, or the prose itself says so.
        if(!(prev.classList.contains("tail")&&r.classList.contains("cont"))){
          const A0=prev.querySelector(".la")||prev.querySelector(".en");
          const B0=r.querySelector(".la")||r.querySelector(".en");
          if(!A0||!B0)continue;
          const a0=(A0.textContent||"").trim(), b0=(B0.textContent||"").trim();
          if(!a0||!b0)continue;
          if(/[.!?…:;)\]"'’”»]\s*$/.test(a0))continue;                 // the sentence closed
          if(!/^[a-zà-öø-ÿ0-9(\["'«‘“]/.test(b0))continue;              // …and this one resumes
          if(/\b(?:lib|cap|vers|ver|fol|tom|art|dist|sect|tit|num|col|pag|loc|seq|etc|viz|ibid)\.$/i.test(a0))continue;
          if(a0.length<12||b0.length<12)continue;                       // not a stub or a label
        }
        if(r.classList.contains("rtoc")||r.classList.contains("rapp")
           ||prev.classList.contains("rtoc")||prev.classList.contains("rapp"))continue;
        const lanes=["la","en"].filter(L=>prev.querySelector("."+L)&&r.querySelector("."+L));
        if(!lanes.length)continue;
        const plan=[];
        let ok=true;
        for(const L of lanes){
          const A=prev.querySelector("."+L), B=r.querySelector("."+L);
          const ap=[...A.querySelectorAll("p")].pop(), bp=B.querySelector("p");
          const aTxt=ap?ap.textContent.trim():"", bTxt=bp?bp.textContent.trim():"";
          if(!ap||!bp||!aTxt||!bTxt){                 // a lane with nothing to continue is
            if(lanes.length>1&&(aTxt||bTxt)){ok=false;break;}   // fine only if BOTH are empty
            continue;}
          if(/[.!?…]["'’”»)\]]?\s*$/.test(aTxt))
            {ok=false;break;}                          // the page finished its sentence
          plan.push({A:A,B:B,ap:ap,bp:bp,aTxt:aTxt});
        }
        if(!ok||!plan.length)continue;
        const pg=(r.id.match(/^b(\d+)/)||[])[1]||"";
        let moved=false;
        plan.forEach(x=>{
          const mark=document.createElement("span");
          mark.className="folin";mark.setAttribute("data-n",pg);
          if(/[-\u2011]$/.test(x.aTxt)){               // a word the folio broke in two
            const last=x.ap.lastChild;
            if(last&&last.nodeType===3)last.nodeValue=last.nodeValue.replace(/[-\u2011]\s*$/,"");
          }else{x.ap.appendChild(document.createTextNode(" "));}
          x.ap.appendChild(mark);
          while(x.bp.firstChild)x.ap.appendChild(x.bp.firstChild);
          x.bp.remove();moved=true;
        });
        if(!moved)continue;
        r.dataset.seamed="1";prev.dataset.seamedInto="1";
        // the row is spent when no lane has prose left — retire it and let the inline
        // marker inherit its id, so #b{n}-0 still resolves (and now points AT the turn)
        const empty=["la","en"].every(L=>{const B=r.querySelector("."+L);
          return !B||!B.textContent.trim();});
        if(empty&&r.id){
          const holder=prev.querySelector(".folin[data-n='"+pg+"']");
          const rid=r.id;r.removeAttribute("id");
          if(holder)holder.id=rid;
          r.classList.add("seamgone");
        }
      }
    }catch(e){}};}
    [700,2200,5200].forEach(ms=>setTimeout(()=>{window.__healHeads();window.__healSeams();},ms));
  }
  // seam pairing runs for EVERY single-lane work — md-built (rflow) works showed the same
  // phantom paragraph break at page turns as the TEI ones (owner 2026-08-20 screenshot)
  if(enOnly&&window.__healSeams)[900,2600,5600].forEach(ms=>setTimeout(()=>{try{window.__healSeams();}catch(e){}},ms));
  // "flow" works (e.g. the Reformed Confessions) are born-digital texts with NO folios/page-scans —
  // read them as one continuous document structured by their own headings, with the §-folio running
  // header suppressed entirely.
  app.classList.toggle("flow",DATA.flow===true||DATA.collection==="reformed-confessions");
  {const mp=$("#m-par");if(mp)mp.style.display=enOnly?"none":"";}
  // witness (owner 2026-09-09): a facsimile work reads text AND scan — two witnesses; a digital work is the text alone
  $("#wmeta").textContent=[DATA.author,`${DATA.n_pages} ${DATA.has_pages?"folia":"sections"}`,enOnly||DATA.src_lang==='en'?"English":((window.__SRCNAME||"Latin")+" + English"),DATA.has_pages?"facsimile · text + page scans":"digital text"].filter(Boolean).join(" · ");
  {const bits=[(DATA.title_en&&DATA.title_en!==DATA.title)?esc(DATA.title):null,
     DATA.author?('<a class=subau href="/?a='+encodeURIComponent(DATA.author)+'" title="All works by '+esc(DATA.author)+'">'+esc(DATA.author)+'</a>'):null,
     DATA.volume?esc(DATA.volume):null].filter(Boolean);
   $("#sub").innerHTML=bits.join(" · ");}   // the author byline is an action: → the library, filtered to them
  wireAbout();   // fetch blurb+bio → enrich the subtitle (dates·genre) + wire the About button/link
  STRUCT=!!(DATA.structure&&DATA.structure.length)&&(!DATA.has_pages||DATA.spine_nav===true);  // spine_nav: a facsimile work with an authoritative outline (Baxter) shows the contents tree, not a 1477-folio list
  // per-page running section title (the lowest-depth TOC node active on each page) → shown in the page
  // marker so AS works carry their own contents headings into the reading instead of a bare "section N".
  SECMAP=STRUCT?(()=>{const byPage={};DATA.structure.forEach(n=>{
    // banner furniture ("VOLUME XIII.", "TOMUS VII") is a title-page echo, not a place —
    // the running locator must never wear it (owner 2026-09-02, Melanchthon Opera v13)
    if(/^(volume|volumen|tomus|tome|band|opera|liber|pars)[\s.]*[ivxlcd\d]*[\s.]*$/i.test(String(n.title||"").trim()))return;
    const p=+n.page,d=(n.depth==null?9:n.depth);if(byPage[p]==null||d<byPage[p].d)byPage[p]={t:n.title,d:d};});
    // variant phrasings of the SAME division (Chapter Two / Chapter Second / Caput II) must not
    // flicker the running label between folios — normalize (stem + numeral incl. English
    // cardinal/ordinal words) and keep the carried phrasing when the division is unchanged.
    const _ow={one:1,first:1,two:2,second:2,three:3,third:3,four:4,fourth:4,five:5,fifth:5,six:6,sixth:6,seven:7,seventh:7,eight:8,eighth:8,nine:9,ninth:9,ten:10,tenth:10,eleven:11,eleventh:11,twelve:12,twelfth:12,thirteen:13,thirteenth:13,fourteen:14,fourteenth:14,fifteen:15,fifteenth:15,sixteen:16,sixteenth:16,seventeen:17,seventeenth:17,eighteen:18,eighteenth:18,nineteen:19,nineteenth:19,twenty:20,twentieth:20};
    const _sk=t0=>{const mm=String(t0||"").trim().match(/^([A-Za-z]{3,14})[ .:]+([A-Za-z0-9]+)/);if(!mm)return null;
      const stem=mm[1].toLowerCase().replace(/v/g,"u").slice(0,4);let n=mm[2].toLowerCase();
      if(/^\d+$/.test(n))n=+n;else if(_ow[n]!=null)n=_ow[n];
      else{let s=n.replace(/j/g,"i").replace(/u/g,"v");if(!/^[ivxlcdm]+$/.test(s))return null;
        const v={i:1,v:5,x:10,l:50,c:100,d:500,m:1000};let tot=0,pv=0;
        for(let i=s.length-1;i>=0;i--){const q=v[s[i]]||0;tot+=q<pv?-q:q;pv=Math.max(pv,q);}n=tot;}
      return n?stem+":"+n:null;};
    // carry over the REAL page numbers — canon works page by printed column (533…), and
    // a 1..n_pages walk never met them, leaving the running head blank (2026-08-17)
    const seq=(DATA.pages&&DATA.pages.length)?DATA.pages.map(x=>+x.n):Array.from({length:DATA.n_pages||0},(_,i)=>i+1);
    const m={};let t="";for(const p of seq){if(byPage[p]){const k=_sk(byPage[p].t),pk=_sk(t);if(!(k&&pk&&k===pk))t=byPage[p].t;}m[p]=t;}return m;})():null;
  // facsimile works: the scan pane opens by default on DESKTOP only — on phones .facs is a 100vw
  // fixed overlay, so removing no-facs here would cover the text on arrival ("facsimile first
  // loads"); the reader opens it from the thumb bar (LN.fx) when wanted.
  if(!DATA.has_pages)app.classList.add("nopdf","no-facs");
  // the desktop scan-pane default lives in the lane init (mode/fr_lanes restore) — build() must
  // not fight applyLanes(): a classList.remove here only re-opened the pane when a SECOND build
  // ran (sharded stage-2 rebuild), so single-file works — and small sharded works whose target
  // shard loads in the first batch — arrived with the scan hidden while big sharded works showed
  // it (tour43-58 "EN-only" reader bug, root-caused 2026-07-16).
  {const ms=$("#m-study");if(ms)ms.style.display=DATA.has_pages?"":"none";}   // Study needs a scan; hide for born-digital
  /* en-only facsimile works no longer force Study on first visit — default is Read for every work */   // open en-only facsimile works in Study (English + scan)
  // reading: paragraph-level rows (aquinas-style), headings span
  const R=$("#reading");R.innerHTML="";_HSEQ=0;let first=true,_prevTail=null,_prevSec=null,_rhSeen=[],_tocAt=null;   // _prevTail: last body row of the previous folio (flow continuation); _prevSec: previous folio element, so a continued page can carry its apparatus down out of the sentence; _rhSeen: rolling page-top heads (runhead-repeat); _tocAt: curated-nav page→titles (runhead protection authority)
  // CONFESSIONS CARRY NO EDITORIAL MATTER (owner 2026-08-18 'take out all editorial'):
  // the Editor's Introduction pages and outline entries are removed outright BEFORE any
  // contents/nav render. /review still shows everything.
  if(!REVIEW&&/^rc-/.test(String(DATA.slug||DATA.workspace||""))&&(DATA.structure||[]).length>=2
     &&/^\[?\s*editor/i.test(String(DATA.structure[0].title||"").replace(/^\s*\[\s*/,""))){
    const cut=DATA.structure[1].page||0;
    if(cut>0){
      DATA.pages=(DATA.pages||[]).filter(p=>p.n>=cut);
      DATA.structure=DATA.structure.filter(e=>!/^\[?\s*editor/i.test(String(e.title||"")));
      DATA.n_pages=DATA.pages.length;
      if(DATA.title_page&&DATA.title_page<cut)DATA.title_page=0;
    }
  }
  // IN-COLUMN CONTENTS (owner 2026-08-10, schola-thomistica analysis): structure belongs
  // inside the reading column, not only in the sidebar — the work opens with its own outline,
  // collapsible, entries jumping by page. Depth-capped so folio-list works stay clean.
  try{
    const _isLA=s=>{s=String(s).trim();
      if(/^(CAPUT|LIBER|PARS|SECTIO|PROLOGUS|TABULA|INDEX|DISPUTATIO|QUAESTIO|ARTICULUS|DE)\b/i.test(s)&&!/\b(the|of|on|and|chapter|book|part|whether)\b/i.test(s))return true;
      return false;};
    // DEPTH FALLBACK (owner 2026-08-20 "toc inline doesn't work" on EEBO canon works):
    // those outlines put "Front Matter"/"Div1" at depth 2 and the real divisions (THESIS I…)
    // at depth 3+, so a strict depth<=2 filter left fewer than 4 entries and the inline
    // Contents never rendered. Widen only when the shallow cut is too thin to be a TOC.
    const _stAll=readerDisplayOutline().filter(n=>n.title&&!/^[§\s.·—-]+$/.test(String(n.title))&&String(n.title).trim()!=="NA");
    let _stRaw=_stAll.filter(n=>(n.depth==null||n.depth<=2));
    if(_stRaw.length<4)_stRaw=_stAll.filter(n=>(n.depth==null||n.depth<=4));
    // English-when-inline (owner 2026-08-11): a Latin entry sitting beside a same-page sibling
    // is the untranslated twin of that heading — show the English one only.
    const st=_stRaw.filter((n,i)=>{
      if(n.navSourcePath)return true;   // A canonical source division is not an inferred translation echo.
      if(!_isLA(n.title))return true;
      const nb=_stRaw[i-1],na=_stRaw[i+1];
      const same=x=>x&&Math.abs((+x.page||0)-(+n.page||0))<=1&&!_isLA(x.title);
      return !(same(nb)||same(na));});
    // NO CAP (owner 2026-08-18 'stop the cap'): the Contents never suppresses. Very deep
    // trees (Summa-class) default to the top level for scannability WITH the full tree a
    // click away; if there is no usable top level, render everything (list starts collapsed).
    // Logos-style entry labels: "TRACTATE XXIV. From that which is written, After
    // these things..." reads as a wall at x124. Bold the unit+numeral, mute the gloss,
    // truncate hard — one scannable line per entry.
    const _tocLabel=t=>{t=t.replace(/</g,"&lt;");
      const m=t.match(/^((?:TRACTATE|TRACT|SERMO(?:N)?|HOMIL(?:Y|IA)|EPISTLE|EPISTOLA|LETTER|CAPUT|CHAPTER|LIBER|BOOK|PSALM(?:US)?|QUAESTIO|QUESTION|SECTIO|SECTION|PARS|PART|ARTICULUS|ARTICLE|DISTINCTIO|DISTINCTION|ORATIO|ORATION|CANON|CONCIO|LECTIO|LECTURE|DISPUTATIO|DISPUTATION)\s+[IVXLCDM0-9]+[a-z]?)[.,:]?\s+(\S.*)$/i);
      if(!m)return t.slice(0,96);
      let g=m[2].replace(/^(On|Of|From|Concerning|Again on|Also on|Upon)\s+(that|what|the same|these|which|the)\s+(which\s+)?(is\s+)?(written|read|says?|said|follows)[,.:]?\s*/i,"");
      g=g.replace(/^[,.:\s]+/,"");
      if(g.length>64)g=g.slice(0,64).replace(/\s+\S*$/,"")+"\u2026";
      return `<b class="tcu">${m[1]}</b>${g?`<span class="tcg"> ${g}</span>`:""}`;};
    let stv=st;let _tocFull=null;
    if(stv.length>320){const d1=stv.filter(n=>(n.depth||1)<=1);
      if(d1.length>=4&&d1.length<stv.length){_tocFull=st;stv=d1;}}
    if(stv.length>=4){
      const box=el("div","inctoc");
      const _tocLink=n=>`<li class="d${n.depth||1}"><a href="${readerDisplayAttribute(readerOutlineHref(n))}" data-pg="${readerDisplayPageAttr(n,DATA.pages)}" data-title="${readerDisplayAttribute(n.title)}"${n.navSourcePath?` data-source-path="${readerDisplayAttribute(n.navSourcePath)}"`:''}${n.navSourceKey?` data-source-key="${readerDisplayAttribute(n.navSourceKey)}"`:''}>${_tocLabel(String(n.title))}</a></li>`;
      box.innerHTML=`<div class="inctoc-h"><span>Contents</span>${_tocFull?`<button type="button" class="inctoc-d" title="Show every level of the outline">All levels</button>`:""}<button type="button" class="inctoc-t">${stv.length>14?"Expand":"Collapse"}</button></div>`+
        `<ol class="inctoc-l${stv.length>14?" clp":""}${stv.filter(n=>_tocLabel(String(n.title)).includes("tcu")).length>stv.length/2?" selfnum":""}">`+stv.map(_tocLink).join("")+`</ol>`;
      box.querySelector(".inctoc-t").onclick=e=>{const l=box.querySelector(".inctoc-l");l.classList.toggle("clp");
        e.target.textContent=l.classList.contains("clp")?"Expand":"Collapse";};
      const db=box.querySelector(".inctoc-d");
      if(db)db.onclick=()=>{const l=box.querySelector(".inctoc-l");
        l.innerHTML=_tocFull.map(_tocLink).join("");
        l.classList.remove("clp");db.remove();
        const t=box.querySelector(".inctoc-t");if(t)t.textContent="Collapse";};
      box.addEventListener("click",e=>{const a=e.target.closest("a[data-pg]");if(!a||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();
        const _pg=a.dataset.pg,_title=a.dataset.title||"";
        goNav(_pg,a,_title);});
      R.appendChild(box);
    }
  }catch(e){}
  // title-page marker: leading leaves (n < title_page) are front matter — collapsed behind one toggle so the
  // reader opens on the actual title page. Owner /review shows everything (every page must stay editable).
  let TP=(!REVIEW&&DATA.title_page)?DATA.title_page:0;
  // editorial-as-preface: a confession whose first section is an "Editor's Introduction" should open
  // on the confession itself — the intro collapses behind the front-matter toggle (kept, one click to read).
  let EDIT_PREFACE=false;
  if(!REVIEW&&DATA.structure&&DATA.structure.length>=2){
    const h0=(DATA.structure[0].title||"").replace(/^\s*\[\s*|\s*\]\s*$/g,"");
    if(/^editor[’'`]?s?\s+introduction\b|^editorial\s+introduction\b/i.test(h0)){
      const firstBody=DATA.structure[1].page||0;
      if(firstBody>TP){TP=firstBody;EDIT_PREFACE=true;}
    }
  }

  const FM_N=TP?DATA.pages.filter(p=>p.n<TP).length:0;
  app.classList.remove("show-fm");let fmBar=false;
  // facsimile scroll-spy + folio observer set up BEFORE render so progressive batches register as built
  const vis=new Set(),sc=$("#scroll"),phEl=$(".ph");
  // an inline page anchor is only a valid position while it sits INSIDE its host folio's box:
  // a content-visibility-skipped host keeps its 2400px placeholder box while a forced layout of
  // its subtree parks the anchors thousands of px below it — phantom positions that landed on
  // top of other pages (Leibniz Pol. VI 2026-09-01: reading p.23, scan stuck on the TOC p.13)
  // the page starts at its "pg. N" marker (jump() scrolls the fmark under the masthead), so the
  // pickers measure the marker's top, not the folio box below it — otherwise every deep link
  // named the PREVIOUS page (folio top 5px under the probe line: Leibniz Pol. VI p.23 → "19")
  const folioTop=f=>{const m=f.previousElementSibling;return ((m&&m.classList&&m.classList.contains("fmark")&&m.getClientRects().length)?m:f).getBoundingClientRect().top;};
  const anchorInHost=el=>{const f=el.closest(".folio");if(!f)return true;const fb=f.getBoundingClientRect(),y=el.getBoundingClientRect().top;return y>=fb.top-1&&y<=fb.bottom+1;};
  pickFolio=()=>{
    if(window.__folioLock&&Date.now()<window.__folioLock)return;   // explicit scan turn in flight — the spy yields
    const r0=sc.getBoundingClientRect().top,probe=(phEl?phEl.offsetHeight:90)+12+14;let pick=null,best=-1e9;
    // +14: jump() lands a folio at its scroll-margin (--phh+12, measured 60–68 after late masthead
    // re-measures) while the probe is ph+12 (61) — a page parked 5px under the line IS the page
    // being read, not its predecessor (Leibniz Pol. VI ?p=23 named 19, 2026-09-01)
    vis.forEach(el=>{const y=folioTop(el)-r0;if(y<=probe&&y>best){best=y;pick=el;}});  // last folio whose top (its pg. marker) crossed the header line
    // reading-edition runs: pages merged into a host folio are located by their inline anchors —
    // without this the scan snapped back to the RUN HOST page when scrolling settled (owner
    // report 2026-08-10, Calov Biblia "stuck at p.3 while reading p.10")
    document.querySelectorAll("#reading .pganchor").forEach(el=>{
      if(!el.offsetParent||!anchorInHost(el))return;   // hidden lane's anchors / phantom anchors must not win
      const y=el.getBoundingClientRect().top-r0;if(y<=probe&&y>best){best=y;pick=el;}});
    if(!pick){let mn=1e9;vis.forEach(el=>{const y=folioTop(el)-r0;if(y<mn){mn=y;pick=el;}});}
    if(pick&&pick.dataset.idx!=null)setFolio(DATA.pages[+pick.dataset.idx]);
  };
  const io=new IntersectionObserver(es=>{es.forEach(e=>{e.isIntersecting?vis.add(e.target):vis.delete(e.target);});pickFolio();},{root:sc,rootMargin:"0px 0px -45% 0px"});
  window.__vis=vis;   // debug handle (harmless)
  // scroll-spy heartbeat: Chrome's scroll anchoring silently shifts positions while late shards
  // re-measure ABOVE the reading point — no scroll event, no IO change — so the pager/scan panel
  // could stay stuck on a mid-churn pick (Lapide QA 2026-07-21: reading fol.464, pager frozen at
  // 126). Re-pick from the live intersection set ~1.2s; setFolio no-ops when unchanged.
  if(window.__frSpyIv)clearInterval(window.__frSpyIv);
  // the heartbeat does its own GEOMETRIC pick over the DOM (not the IO `vis` set): after a
  // full-volume rebuild most folios are unmaterialized 0-height shells and the observer set can
  // hold a stale mid-churn pick (Lapide QA 2026-07-21: reading fol.464, pager frozen at 8) —
  // measuring real heights once per beat always names the folio actually under the masthead.
  window.__frSpyIv=setInterval(()=>{try{
    const r0=sc.getBoundingClientRect().top,probe=(phEl?phEl.offsetHeight:90)+12;
    let pick=null,best=-1e9;
    $("#reading").querySelectorAll(".folio,.pganchor").forEach(el=>{const r=el.getBoundingClientRect();
      if(el.classList.contains("pganchor")&&(!el.offsetParent||!anchorInHost(el)))return;   // hidden lane's / phantom anchor must not win
      if(!r.height&&!el.classList.contains("pganchor"))return;const y=(el.classList.contains("pganchor")?r.top:folioTop(el))-r0;if(y<=probe+14&&y>best){best=y;pick=el;}});
    if(pick&&pick.dataset.idx!=null)setFolio(DATA.pages[+pick.dataset.idx]);
  }catch(e){}},1200);
  const goNav=(p,node,title)=>{
    if(node?.dataset.sourcePath){
      const url=new URL(location.href);url.searchParams.set('section',node.dataset.sourcePath);url.searchParams.set('p',String(p));url.hash='b'+String(p)+'-0';
      if(node.dataset.sourceKey)url.searchParams.set('heading',node.dataset.sourceKey);else url.searchParams.delete('heading');
      if(window.__frNavigateReaderAnchor(url.href)){
        _navClickT=performance.now();$('#nav').querySelectorAll('.nav-node.on,.fol.on').forEach(row=>row.classList.remove('on'));node.classList.add('on');
        if(window.FRReaderContents){const items=readerDisplayOutline();window.FRReaderContents.highlight($('#nav'),window.FRReaderContents.currentIndex(items,DATA.pages,p,window.__readerChoice));}
        if(innerWidth<1500)app.classList.add('nosb');
      }
      return;
    }
    const ttl=title??(node&&node.querySelector&&node.querySelector(".nn-t")?node.querySelector(".nn-t").textContent:null);
    const request=rememberReaderChoice(p,ttl||'');
    // shard-streaming guard (2026-07-20, same fix as the pager): if the target folio hasn't rendered
    // yet on a large work, queue it as the settle target and pull the remaining shards — a bare jump()
    // was a silent no-op that left the reader at page 1.
    if(!$("#reading").querySelector(`.folio[data-page="${p}"]`)&&DATA&&p>=1&&p<=(DATA.n_pages||0)){
      window.__frTgt=p;window.__frUserScrolled=false;
      if(DATA.__loadRest)DATA.__loadRest().catch(()=>{});
      // retry until the folio renders (progressive build may still be streaming DOM), then jump
      let k=0;const iv=setInterval(()=>{
        if(request!==window.__readerNavSerial){clearInterval(iv);return;}
        if($("#reading").querySelector(`.folio[data-page="${p}"]`)){clearInterval(iv);jump(p,ttl);}
        else if(++k>120)clearInterval(iv);},250);
    }
    jump(p,ttl);   // jump + light up the clicked node directly (scroll-spy is suppressed briefly so the jump's scroll can't re-pick a neighbouring entry)
    // settle chain (2026-07-20): content-visibility re-measures above the target keep dragging the
    // scroll off — correct for ~3s unless the reader scrolls deliberately (same as deep-links).
    // anti-flicker (owner 2026-07-21): after the first correction only re-jump on BIG drift
    // (>120px), stop once stable twice, cap total corrections — repeated small re-jumps read
    // as flicking while content-visibility re-measures settle.
    // measure the element jump actually scrolled (owner 2026-07-28: measuring the folio while jump
    // scrolled the fmark/heading made corrections ping-pong — "navs are snapping").
    {let k=0,st=0,cj=0;window.__frUserScrolled=false;const iv=setInterval(()=>{
      if(request!==window.__readerNavSerial||window.__frUserScrolled||++k>12||st>=2||cj>=4){clearInterval(iv);return;}
      const t=(window.__frJumpEl&&window.__frJumpEl.isConnected)?window.__frJumpEl:$("#reading").querySelector(`.folio[data-page="${p}"]`);
      if(t){const off=Math.abs(t.getBoundingClientRect().top-((document.querySelector('.ph')?.offsetHeight||64)+14));
        if(off>(cj?120:40)){jump(p,ttl);cj++;st=0;}else st++;}
    },260);}
    if(node){_navClickT=performance.now();$("#nav").querySelectorAll(".nav-node.on,.fol.on").forEach(f=>f.classList.remove("on"));node.classList.add("on");}
    if(window.FRReaderContents){const items=readerDisplayOutline();window.FRReaderContents.highlight($('#nav'),window.FRReaderContents.currentIndex(items,DATA.pages,p,window.__readerChoice));}
    if(innerWidth<1500)app.classList.add("nosb");};   // close the drawer (keep open on very wide screens)
  // one folio (fmark + section), appended to the reading column and observed
  function renderFolio(pg,pi){
    const isFront=TP&&pg.n<TP,isTitle=TP&&pg.n===TP;
    // skip blank born-digital pages: AS digitizes each leaf as a text-page + an image-only page (data-page='NA',
    // no OCR text), and footnote-banking empties the marginalia leaves — both render as blank folios. Hide them
    // (facsimile works keep blanks: they still show the scan image). Title/front-matter kept.
    if(DATA.has_pages===false&&!isFront&&!isTitle&&!((pg.la||"").replace(/#/g,"").trim())&&!((pg.en||"").replace(/#/g,"").trim()))return;
    if(TP&&FM_N&&!fmBar&&pg.n>=TP){fmBar=true;   // the one reveal toggle, just above the title page
      const t=el("div","fmtoggle");t.title=EDIT_PREFACE?"Show / hide the Editor’s Introduction":"Show / hide the preliminary leaves before the title page";
      t.innerHTML=EDIT_PREFACE
        ?`<span class="ic">❧</span><span class="lab"><b>Editor’s Introduction</b> <span style="opacity:.7">· editorial preface · tap to read</span></span><span class="do"></span>`
        :`<span class="ic">❧</span><span class="lab"><b>Front matter</b> — ${FM_N} preliminary ${FM_N>1?"leaves":"leaf"} before the title page <span style="opacity:.7">· scan notice · library marks · blank leaves</span></span><span class="do"></span>`;
      t.onclick=()=>app.classList.toggle("show-fm");R.appendChild(t);}
    const fm=el("div","fmark"+(isFront?" frontmatter":"")+(isTitle?" titlepage":""));
    const _fmlab=isTitle?"title page":(pg.title?esc(enHalf(pg.title)):((SECMAP&&SECMAP[pg.n])?esc(enHalf(SECMAP[pg.n]).slice(0,80)):(DATA.has_pages?`scan ${pg.n} of ${DATA.n_pages}`:`section ${pg.n}`)));
    fm.innerHTML=`<span class="ff" role="button" tabindex="0">${esc(locOf(pg.n))}</span><span class="fr"></span><span class="fm">${_fmlab}</span>`;
    // researcher affordance: clicking the folio pill copies a full citation + deep link
    {const ff=fm.querySelector(".ff");ff.title="Click to copy the citation for this page";
     ff.onclick=()=>{const a=(Array.isArray(DATA.author)?DATA.author.join(", "):(DATA.author||"")),
       cite=[a,[DATA.title,DATA.volume].filter(Boolean).join(", "),locOf(pg.n)].filter(Boolean).join(", ")
         +" — "+location.origin+"/the-faith-received/read/?w="+encodeURIComponent(DATA.slug||"")+"#b"+pg.n+"-0";
       navigator.clipboard.writeText(cite).then(()=>{const old=ff.textContent;ff.textContent="✓ copied";
         setTimeout(()=>{ff.textContent=old;},1200);}).catch(()=>{});};}
    R.appendChild(fm);
    const sec=el("section","folio"+(isFront?" frontmatter":"")+(isTitle?" titlepage":""));sec.dataset.idx=pi;sec.dataset.page=pg.n;
    // RUNHEAD STRIP (Reding QA 2026-07-21): the print repeats a short caps running head at each
    // page top ("EPISTOLA", "PRÆFATIO.", "AD B. VIRGINEM") — page furniture that lands mid-sentence
    // in Flow ("…the new and the ancient TO THE BLESSED VIRGIN Testament Mysteries"). It arrives
    // either as a ### line or fused as the body's FIRST LINE, so strip at TEXT level, both lanes.
    // Signals (either suffices): A. SEAM — the previous page ends mid-clause in either lane (a real
    // division after a truncated sentence is typographically impossible); B. REPEAT — the same short
    // caps text opened one of the recent folios (running heads recur; numbered divisions differ).
    // First occurrences (the real section heads) survive and seed the repeat detector. Scan keeps
    // the original page furniture.
    let _laTxt=pg.la,_enTxt=pg.en;
    if(!isFront&&!isTitle&&!REVIEW){   // owner /review shows the RAW lanes — display filters off (every line must stay visible/editable)
      // INDEX GUARD (owner 2026-07-21): a printed-index page's entries are REAL content — never
      // strip lines there; the ixfolio compact layout handles the clutter instead.
      const _exl=(((pg.en||pg.la||"").match(/[^\n]+/g))||[]).map(l=>l.trim()).filter(l=>l&&!/^\[\^/.test(l));
      const _exnt=_exl.filter(l=>/(\b\d{1,4}|\bibid)\s*\.?\s*$/i.test(l)).length;
      const _isix=(_exl.length>=10&&_exnt>=8&&_exnt>=_exl.length*0.55)||(_exnt>=12&&_exnt>=_exl.length*0.4);
      const _pv=pi>0?DATA.pages[pi-1]:null;
      const _tl=t=>{const ls=String(t||"").trim().split("\n").filter(l=>l.trim()&&!/^\[\^/.test(l.trim())&&!/^#+\s*$/.test(l.trim()));
        return ls.length?ls[ls.length-1].trim().slice(-1):"";};
      const _seam=_pv?(/[a-zà-öø-ÿ0-9,;:—–-]/.test(_tl(_pv.la))||/[a-zà-öø-ÿ0-9,;:—–-]/.test(_tl(_pv.en))):false;
      const _rhFold=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-zA-Z]/g,"").toLowerCase();
      // CURATED-TOC AUTHORITY (owner 2026-07-21: "we did the toc run so we know where things
      // actually are") — a page-top head that matches a curated nav entry at this page (±1) IS the
      // real division: never strip it, in EITHER lane (asymmetric strips would desync the rows).
      // Match by fold-containment or by shared roman numeral with the entry sitting at this page.
      if(!_tocAt){_tocAt={};(DATA.structure||[]).forEach(e=>{if(Number.isInteger(e.page))(_tocAt[e.page]=_tocAt[e.page]||[]).push(String(e.title||""));});}
      const _prot=bare=>{
        const k=_rhFold(bare);
        const rs=(bare.toUpperCase().match(/\b[IVXLCDM]{1,7}\b/g)||[]);
        for(const pp of [pg.n-1,pg.n,pg.n+1]){
          for(const t of (_tocAt[pp]||[])){
            const tf=_rhFold(t);
            if(k.length>=6&&(tf.indexOf(k)>=0||(tf.length>=6&&k.indexOf(tf)>=0)))return true;
            if(rs.length&&rs.some(r=>new RegExp("\\b"+r+"\\b").test(" "+t.toUpperCase()+" ")))return true;
          }
        }
        return false;};
      const _cand=t=>{
        if(!t)return null;
        const body=String(t).replace(/^\s+/,""),lines=body.split("\n");
        const bare=((lines[0]||"").trim()).replace(/^#{1,6}\s*/,"").trim();
        if(!bare||bare.length>48||_capsRatio(bare)<0.8)return null;
        const k=_rhFold(bare);return k?{bare,k,lines}:null;};
      const cl=_cand(pg.la),ce=_cand(pg.en);
      if(!_isix&&(cl||ce)&&!((cl&&_prot(cl.bare))||(ce&&_prot(ce.bare)))){
        for(const c of [cl,ce]){
          if(!c)continue;
          if(_seam||_rhSeen.indexOf(c.k)>=0){c.lines.shift();if(c===cl)_laTxt=c.lines.join("\n");else _enTxt=c.lines.join("\n");}
          else{_rhSeen.push(c.k);if(_rhSeen.length>12)_rhSeen.shift();}   // survivor = a real page-top head; seed the repeat detector
        }
      }
    }
    const SL=splitApp(_laTxt),SE=splitApp(_enTxt);                      // apparatus out of the body, banked at folio foot
    let _lb=blocks(SL.main),_eb=blocks(SE.main);if(DATA&&DATA.has_pages===false){const _s=symLanes(_lb,_eb);_lb=_s[0];_eb=_s[1];}
    const r=buildRows(_lb,_eb,first);first=r.first;
    r.nodes.forEach(n=>sec.appendChild(n));
    // printed-index folio: mostly headings (the book's own Tabula/Index transcribed as ###) → demote
    // the whole folio to a compact list so it can't clog reading. Body prose keeps normal styling.
    {const _nh=sec.querySelectorAll(".row.rhead").length,_nr=sec.querySelectorAll(".row").length;
     // pure-text signals, usable for THIS page and its neighbours:
     // (a) number-tailed lines (Reding QA 2026-07-21): most lines end with a locator;
     // (b) ordinal-run (Sabunde SERIES 2026-07-22): ≥5 SHORT lines led by "CCXIII."/"12." —
     //     a printed TOC whose entries were transcribed as ### heads WITHOUT locators renders
     //     as giant heads mixed with prose otherwise. avg≤160ch excludes numbered quaestio/thesis
     //     BODIES (Voetius p99 class: same ordinals, long paragraphs — must stay normal prose).
     const _ixTxt=t=>{
       const L=((String(t||"").match(/[^\n]+/g))||[]).map(l=>l.trim()).filter(l=>l&&!/^\[\^/.test(l));
       if(L.length<6)return{ix:false,no:0};
       const nt=L.filter(l=>/(\b\d{1,4}|\bibid)\s*\.?\s*$/i.test(l)).length;
       const o=L.filter(l=>/^#{0,6}\s*(?:[IVXLCDM]{1,10}|\d{1,4})[.:]\s+\S/.test(l));
       const nn=L.filter(l=>/^\d{1,4}\.?$/.test(l)).length;
       const avg=o.length?o.reduce((a,l)=>a+l.length,0)/o.length:1e9;
       // index ENTRIES are short lines; citation-dense PROSE (AS Loci works: lines ending in
       // verse numbers) is long lines — median length separates them (owner FP 2026-08-10,
       // 'LOCUS III De Christi Deitate' body stamped "printed index")
       const med=L.slice().sort((a,b)=>a.length-b.length)[Math.floor(L.length/2)].length;
       return{ix:((L.length>=10&&nt>=8&&nt>=L.length*0.55)||(nt>=12&&nt>=L.length*0.4)
              ||(o.length>=5&&(o.length+nn)>=L.length*0.6&&avg<=160))&&med<=90,no:o.length};};
     const _cur=_ixTxt(pg.en||pg.la);
     // INDEX SCOPE (owner 2026-08-10): printed-index treatment is for FACSIMILE works only —
     // CL/SCTA born-digital have no printed indexes, and AS indexes get a bespoke renderer later.
     let _ixOn=(DATA.has_pages===true)&&((_nh>=8&&_nh>=_nr*0.6)||_cur.ix||(INDEX_PAGES&&INDEX_PAGES.has(teiNorm(pg.n))));   // meta.index_pages is the corpus's own word on which leaves are printed indexes/contents (Urraburu contents leaves rendered as display heads, owner 2026-09-04)
     // sandwich smoothing: a page with a few (possibly long) ordinal entries BETWEEN two index
     // pages is the same printed list — heal the seam so one list never renders three ways
     if(!_ixOn&&_cur.no>=3&&pi>0&&pi<DATA.pages.length-1){
       const _pv=DATA.pages[pi-1],_nx=DATA.pages[pi+1];
       if(_ixTxt(_pv.en||_pv.la).ix&&_ixTxt(_nx.en||_nx.la).ix)_ixOn=true;}
     if(!isTitle&&_ixOn){sec.classList.add("ixfolio");
       const chip=el("div","ixchip");chip.textContent="printed index";sec.prepend(chip);}}
    let bi=0;sec.querySelectorAll(".row").forEach(rw=>{if(!rw.classList.contains("rhead")&&!rw.classList.contains("rtoc")&&!rw.classList.contains("rapp"))rw.id="b"+pg.n+"-"+(bi++);});  // stable per-¶ ids for highlights/notes/translations (apparatus rows excluded)
    const ab=appBank(SL.notes,SE.notes);if(ab)sec.appendChild(ab);
    // ── flow continuation: when the printer split a sentence across the page break, mark the
    // two half-paragraphs (.tail on the previous page's last row, .cont on this page's first)
    // so Flow mode closes the false gap and drops the false indent. Heuristic: previous text ends
    // mid-clause (letter/comma/colon/dash — no terminal punctuation) AND this page opens lowercase.
    let _thisCont=false;
    if(isFront||isTitle){_prevTail=null;_EDSEC=null;}
    else{
      // the SOURCE lane carries the print's continuation signal — translations often round a
      // fragment into a capitalized sentence, hiding the seam (Leibniz EN, 2026-07-18)
      // A .row.seg holds SEVERAL .sp sub-pairs, so querySelector(".la") returns the row's FIRST
      // Latin cell. Using that for the page TAIL compared the wrong end of the leaf: Rivet p8
      // reported '…fraudes eius detegendi.' (a full stop, test fails) when the page truly ends
      // '…mutuis se vulneribus conficerent;' — so the continuation onto p9 was never detected and
      // the sentence reopened as a new paragraph. Take the LAST cell for a tail, the FIRST for a head.
      const laneTxtAt=(r,wantLast)=>{
        const pick=sel=>{const n=r.querySelectorAll(sel);return n.length?n[wantLast?n.length-1:0]:null;};
        const la=pick(".la");
        if(la&&la.textContent.trim())return la.textContent;
        const en=pick(".en");
        return en?(en.textContent||""):"";
      };
      const laneTxt=r=>laneTxtAt(r,false);
      const brows=[...sec.querySelectorAll(".row")].filter(x=>!x.classList.contains("rhead")&&!x.classList.contains("rtoc")&&!x.classList.contains("rapp"));
      const firstRow=sec.querySelector(".row");   // if the page OPENS with a heading/TOC, it's a real division — never a continuation
      const head=brows[0];
      if(_prevTail&&head&&firstRow===head){
        const ht=laneTxt(head).trim();
        if(ht&&/\b(?:lib|cap|vers|ver|fol|tom|art|dist|sect|tit|num|col|pag|loc|seq)\.$/i.test(_prevTail.txt)&&/^[IVXLCDM0-9]/.test(ht)){head.classList.add("cont");_prevTail.row.classList.add("tail");}
        else if(ht&&/[a-zà-öø-ÿ0-9,;:—–-]$/.test(_prevTail.txt)&&(/^[a-zà-öø-ÿ(\["'«‘“]/.test(ht)||(/[a-zà-öø-ÿ0-9]$/.test(_prevTail.txt)&&/^[A-ZÀ-Þ][a-zà-öø-ÿ]/.test(ht)&&!/^(?:Cap|Lib|Quaest|Art|Sect|Disp|Tit|Pars|Prop)/.test(ht)))){
          head.classList.add("cont");_prevTail.row.classList.add("tail");_thisCont=true;}
      }
      const last=brows[brows.length-1];
      if(last){const lt=laneTxtAt(last,true).trim();if(lt)_prevTail={row:last,txt:lt};}   // TAIL = last sub-pair
    }
    // GAPPY-PAGE RESCUE: if most rows pair a short cell against a very long one, the shared
    // row heights create dead space — re-flow this section as two independent columns.
    try{
      const rws=[...sec.querySelectorAll(".row")].filter(r=>!r.classList.contains("rhead")&&!r.classList.contains("rtoc")&&!r.classList.contains("rapp"));
      // NEVER restructure sub-paired rows: a .row.seg holds .sp pairs, and lifting only its first
      // .la/.en shreds the pairing (owner screenshot 2026-08-09: boxed Latin cells, dead space).
      // A .row.seg holds .sp sub-pairs; lifting only its first .la/.en shreds the pairing. But
      // skipping the WHOLE section whenever ONE such row exists left 29-row sections row-locked
      // off a single seg row — and a grid row stretches both cells to the taller one, so every
      // Latin paragraph was padded out to the length of its (~20% longer) translation.
      // Owner screenshot 2026-08-09: an 8-line void in the Latin column of Polanus IX.
      // FIX: stack each RUN of consecutive ordinary rows; leave seg rows untouched in place.
      const isSeg=r=>!!(r.querySelector(".sp")||r.classList.contains("seg"));
      let run=[],stacked=false;
      const flushRun=()=>{
        if(!run.length)return;
        const w=el("div","stkwrap"),c1=el("div","stk stk-la"),c2=el("div","stk stk-en");
        const first=run[0];
        run.forEach(r=>{
          const la=r.querySelector(".la"),en=r.querySelector(".en");
          if(en&&r.id){en.id=r.id;r.removeAttribute("id");}   // deep links point at the EN cell
          // CARRY THE SEAM CLASSES. .tail/.cont are set on the ROW just above, and every rule for
          // them is scoped '.row.cont' — lifting the cells out of the row silently dropped the
          // page-break re-join, so a sentence the printer split across leaves reopened as a new
          // indented paragraph (owner 2026-08-09: "why would a paragraph start mid sentence").
          ["cont","tail"].forEach(cl=>{ if(r.classList.contains(cl)){ if(la)la.classList.add(cl); if(en)en.classList.add(cl); } });
          if(la)c1.appendChild(la);
          if(en)c2.appendChild(en);
        });
        w.appendChild(c1);w.appendChild(c2);
        first.parentNode.insertBefore(w,first);
        run.forEach(r=>{if(!r.childElementCount)r.remove();});
        stacked=true;run=[];
      };
      rws.forEach(r=>{ if(isSeg(r)){flushRun();} else {run.push(r);} });
      flushRun();
      if(stacked)sec.classList.add("sec-stacked");
    }catch(e){}
    // SMOOTH READING (owner 2026-08-09: "the reading experience must be perfect").
    // In Flow, a sentence the printer split across the leaf has to close up — but page N's
    // footnote bank sat physically between N's prose and N+1's prose, so no seam rule could ever
    // join them (measured: a 120px gap where a paragraph gap is 9px). When this page CONTINUES
    // the previous one, carry the previous page's apparatus down to sit after THIS page's text.
    // Applied per page it cascades, so a run of continued leaves reads as one unbroken column
    // with its notes gathered at the end of the run, each still labelled with its own folio.
    try{
      if(_thisCont&&_prevSec&&document.getElementById("app").classList.contains("rflow")){
        const carry=[..._prevSec.querySelectorAll(":scope > .apptog, :scope > .row.rapp")];
        carry.forEach(n=>sec.appendChild(n));
      }
    }catch(e){}
    _prevSec=sec;
    R.appendChild(sec);io.observe(sec);
  }
  // TEI PATH (2026-08-10): folio content built straight from the parsed TEI sidecars — bypasses
  // splitApp/blocks/buildRows entirely. Same section.folio[data-idx][data-page] + fmark contract
  // as renderFolio() above, so scroll-spy/jump()/scan-pane are unaffected by which path rendered
  // a given folio. Structural pairing: k-th LA element of a tag pairs with k-th EN element of the
  // SAME tag (head↔head, p↔p, list↔list, quote↔quote); leftovers render single-lane. Notes reuse
  // the existing appBank() so footnote click/sheet wiring (.row.rapp, data-fnid) is untouched.
  // heads pair head↔head; ALL body tags (p/list/quote) share ONE positional queue — a LA
  // <quote> facing an EN <p> still pairs side-by-side (owner 2026-08-10 Capreolus screenshots:
  // per-tag queues left tag-mismatched lanes unpaired → staggered solo rows + blank columns).
  function teiKids(els){const q={head:[],body:[]};
    (els||[]).forEach(e=>{if(e.localName==="head"&&(e.getAttribute("rend")||"")!=="lemma")q.head.push(e);
      else if(e.localName==="p"||e.localName==="ab"||e.localName==="list"||e.localName==="quote"||e.localName==="table"||e.localName==="figure")q.body.push(e);});return q;}
  function teiInline(node){let out="";
    node.childNodes.forEach(c=>{
      if(c.nodeType===3)out+=inl(c.nodeValue,false);
      else if(c.nodeType===1)out+=c.localName==="foreign"?`<span lang="${esc(c.getAttribute("xml:lang")||"")}">${esc(c.textContent)}</span>`
        :c.localName==="label"?`<span class="rl">${esc(c.textContent.trim())}</span> `
        :c.localName==="ref"?(t=>{const id=t.replace(/^#n-?/,"");
          // Leibniz screenshots 2026-08-25: v599n1/ed599 machine keys rendered as raw digits
          // ("599 599") in the reading flow — Akademie ids are ° marks, variants dimmed (md-path parity)
          return /^v\d+n\d+$/.test(id)?`<sup class="fnref deg fvar"><a href="${esc(t)}" title="textual variant">°</a></sup>`
               :/^(ed\d+|\d+n\d+)$/.test(id)?`<sup class="fnref deg"><a href="${esc(t)}" title="editors’ note">°</a></sup>`
               :`<sup class="fnref"><a href="${esc(t)}">${esc(c.getAttribute("n")||(t.match(/\d+/)||["*"])[0])}</a></sup>`;})(c.getAttribute("target")||"#")   // WA 2026-09-01: printed cue travels on ref@n (ids are page-keyed)
        :c.localName==="hi"&&/gapfill/.test(c.getAttribute("rend")||"")?`<span class="${esc(c.getAttribute("rend"))}" title="${/inferred/.test(c.getAttribute("rend"))?"restored from the surviving letters":"restored from the scan"}">${esc(c.textContent)}</span>`
        :c.localName==="hi"?(r=>r.includes("bold")?`<b>${esc(c.textContent)}</b>`:r.includes("sup")?`<sup>${esc(c.textContent)}</sup>`:r.includes("caps")||r==="sc"?`<span style="font-variant:small-caps">${esc(c.textContent)}</span>`:`<i>${esc(c.textContent)}</i>`)(String(c.getAttribute("rend")||"italic").toLowerCase())   // 2026-08-23: was always <b>; @rend now honoured, italic default (the TEI convention for a bare <hi>)
        :c.localName==="fw"?""                                   // furniture (running-head/title echo) inside a paragraph: not text to read (Akademie, 2026-08-29)
        :c.localName==="note"?`<span class="mnote${(c.getAttribute("type")||"")==="headnote"?" headnote":""}">${esc(c.textContent.trim())}</span>`
        :c.localName==="list"&&c.getAttribute("type")==="eebo-list"?teiCell(c)
        :c.localName==="p"&&node.localName==="item"&&node.parentNode?.getAttribute("type")==="eebo-list"?`<p>${teiInline(c)}</p>`
        :inl(c.textContent,false);
    });
    return linkScriptureHTML(out);}
  function teiSourceHeadingAttrs(e,page){
    if(e.localName!=="head"&&e.getAttribute("data-source-heading")!=="true")return "";
    if(!e.getAttribute("data-source-path")&&!e.getAttribute("data-source-paths"))return "";
    const key=!e.getAttribute('data-source-keys')&&page!=null&&typeof window!=='undefined'&&window.FRSourceOutline?.targetKey(page,e.textContent,e.__frSourcePrimaryPath===e.getAttribute('data-source-path')?'primary':'');
    return ' data-source-heading="true"'+(key?` data-source-keys="${esc(key)}"`:'')+["data-source-path","data-source-paths","data-source-region","data-source-regions","data-source-keys"].map(name=>{
      const value=e.getAttribute(name);return value!=null?` ${name}="${esc(value)}"`:"";}).join("");
  }
  function teiCell(e,pgN){
    if(!e)return "";
    const sourceAttrs=teiSourceHeadingAttrs(e,pgN);
    if(e.localName==="head"){
      let ht=teiInline(e);
      // VERSE LEMMA heads (Lapide, owner 2026-08-31): 'Vers. 10. 10. ET VOCAVIT…' is a compact commentary
      // lemma in the print, not a display heading — set it as a lemma paragraph; also collapse the doubled
      // numeral our margin-glue produced ('Vers. 10. 10.' → 'Vers. 10.')
      ht=ht.replace(/^((?:Vers|Verse|V)\.?\s*)(\d+)\.\s*\2\./,'$1$2.');
      if(/^(?:Vers\.|Verse\b|V\.\s*\d)/.test(ht))return `<p class="vlem"${sourceAttrs}>${ht}</p>`;
      if((e.getAttribute("rend")||"")==="editorial")return `<h3 class="csub inflow editorial"${sourceAttrs}>${ht}</h3>`;
      // COMMENTARY LEMMATA (Scholarios on Aristotle/Aquinas, owner 2026-09-10 "clean up the scholarios"): a
      // <head rend="lemma"> is the printed incipit lead-in ("Εἰ δὲ ἡ τέχνη." / "But if art."), set as a lemma
      // paragraph like the verse lemmata — never a display heading, never a TOC row.
      if((e.getAttribute("rend")||"")==="lemma")return `<p class="vlem"${sourceAttrs}>${ht}</p>`;
      return `<h3 class="csub inflow"${sourceAttrs}>${ht}</h3>`;
    }
    // margin note kept IN-FLOW at its text position (owner 2026-08-12 'get margins right'):
    // renders as the .mnote aside, not a bank footnote
    if(e.localName==="note")return `<p class="mnp"><span class="mnote${(e.getAttribute("type")||"")==="headnote"?" headnote":""}">${teiInline(e)}</span></p>`;
    if(e.localName==="list"){
      if(e.getAttribute("type")==="eebo-list"){
        const tag=e.getAttribute("rend")==="ordered"?"ol":"ul";
        const items=Array.from(e.childNodes).map(child=>child.nodeType===3?inl(child.nodeValue,false)
          :child.localName==="item"?`<li${child.getAttribute("part")==="M"?' style="list-style:none"':""}>${teiInline(child)}</li>`
          :child.localName==="head"?`<li style="list-style:none"${teiSourceHeadingAttrs(child,pgN)}><b>${teiInline(child)}</b></li>`
          :child.localName==="list"?`<li style="list-style:none">${teiCell(child,pgN)}</li>`:teiCell(child,pgN)).join("");
        return `<${tag} class="eebo-source-list">${items}</${tag}>`;
      }
      const its=[...e.children].filter(c=>c.localName==="item");
      if(e.getAttribute("type")!=="index")return its.map(it=>`<p>${teiInline(it)}</p>`).join("");
      // REHAUL P5 (2026-08-17): a genuine tail-of-volume finding aid (DESIGN.md §2) gets its own
      // renderer instead of the mid-work tabula typography below. Gated per-PAGE (pgN, passed in
      // by renderFolioTEI's teiCell() call sites) against INDEX_PAGES (§2.2) — a work with no flag
      // for this page falls straight through to the unmodified tabula branch beneath, byte-
      // identical to before this patch.
      if(pgN!=null&&INDEX_PAGES&&INDEX_PAGES.has(teiNorm(pgN))){
        return renderTrueIndex(its,INDEX_PAGES.get(teiNorm(pgN)));
      }
      // printed-index typography (owner 2026-08-10 TABULA scan): hierarchy like the print —
      // DISTINCTIO small-caps entry heads, Quaestio, italic Utrum lines, (p. N.) as jump links
      const denseL=its.length>=6&&its.filter(it=>{const r=it.textContent.trim();return r.length<=28&&/\d/.test(r);}).length>=0.6*its.length;
      return `<div class="ixl${denseL?" ixdense":""}">`+its.map(it=>{
        const raw=it.textContent.trim();
        const lv=/^(distinctio|distinction|liber|tabula|table|index)\b/i.test(raw)?"ix1"
                :/^(quaestio|question|q\.)\b/i.test(raw)?"ix2"
                :/^(utrum|whether)\b/i.test(raw)?"ix3":"ix4";
        let t=teiInline(it).replace(/\((?:p|pag)\.\s*(\d+)\s*\.?\s*\)/g,(m,n)=>`<a class="pgo" data-p="${parseInt(n,10)}" href="#">(${"p. "+n}.)</a>`);
        // Akademie contents (Leibniz Vorausedition, 2026-08-28): the entry's trailing six-digit
        // code is the piece's folio label, not a page number; meta.piece_pages (built by
        // leibniz_toc_rebuild.py from the volume's own running heads) maps it to our page.
        const PP=DATA&&DATA.piece_pages;
        if(PP)t=t.replace(/(?:\.\s*){2,}\s*(\d{6})(?!\d)\s*$/,(m,c)=>PP[c]?` <span class="dots"></span><a class="pgo tp" data-p="${PP[c]}" href="#">${c}</a>`:m)
                .replace(/(?:^|\s)(\d{6})(?!\d)\s*$/,(m,c)=>PP[c]?` <span class="dots"></span><a class="pgo tp" data-p="${PP[c]}" href="#">${c}</a>`:m);
        return `<p class="${lv}">${t}</p>`;}).join("")+`</div>`;
    }
    if(e.localName==="ab"){
      // TEI anonymous block: the disputation turn (Piscator–Lucius–Gataker). Render as a
      // paragraph; @who initials become a quiet leading tag.
      const who=(e.getAttribute("who")||"").replace(/^#/,"");
      return `<p>${who?`<b class="abwho">${esc(who)}.</b> `:""}${teiInline(e)}</p>`;}
    if(e.localName==="figure"){
      // PLATES (owner 2026-09-02, Westminster Minutes): <figure><graphic url> renders the
      // image the work hosts beside its TEI; caption from <head>/<figDesc>
      const g=[...e.querySelectorAll("*")].find(x=>x.localName==="graphic");
      const cap=[...e.children].find(c=>/^(head|figDesc)$/.test(c.localName));
      const u=g&&g.getAttribute("url");
      if(!u)return "";
      const src=/^https?:/.test(u)?u:`${BLOB}/v1/works/${esc(String((DATA&&DATA.slug)||""))}/${esc(u)}`;
      return `<figure class="teifig"><img loading="lazy" src="${src}" alt="${esc(cap?cap.textContent.trim():"Plate")}">${cap?`<figcaption>${esc(cap.textContent.trim())}</figcaption>`:""}</figure>`;}
    if(e.localName==="table"){
      // BD back-matter (errata etc.): real table typography
      const rows=[...e.children].filter(c=>c.localName==="row").map(r=>{
        const cs=[...r.children].filter(c=>c.localName==="cell").map(c=>`<td>${esc(c.textContent.trim())}</td>`).join("");
        return `<tr${(r.getAttribute("role")||"")==="label"?' class="tlab"':""}>${cs}</tr>`;}).join("");
      return `<div class="teitblwrap" style="overflow-x:auto"><table class="teitbl">${rows}</table></div>`;}
    const pv=e.previousElementSibling;
    const pre=(e.localName==="p"&&pv&&pv.localName==="label"&&(pv.getAttribute("rend")||"")==="run-in")
      ?`<span class="rl">${esc(pv.textContent.trim())}</span> `:"";
    // RAMIST DIAGRAMS ON THE TEI PATH (owner 2026-08-18, Baxter Methodus p.24 'the reader
    // should mimic how the pdf does it'): the TEI <p> preserves the indented "- " bullet
    // tree, but the HTML whitespace collapse was flattening it to run-on prose. Detect the
    // tree on the RAW text (newlines intact) and hand it to the same brace renderer the md
    // path uses. Glue heal: md2tei joins a root bullet onto the previous line's end —
    // re-break at sentence-terminal + " - " + list numeral (safe inside a bullet block).
    if(e.localName==="p"&&!e.getAttribute("rend")){
      const rawT=e.textContent;
      if(/\n[ \t]*-\s+\S/.test(rawT)){
        const healed=rawT.replace(/([.:;!?])[ \t]+-[ \t]+(?=(?:[IVXLC]{1,6}|\d{1,3})\.\s)/g,"$1\n- ");
        const lines=healed.split(/\n/);
        let lead=[];while(lines.length&&!/^[ \t]*-\s+\S/.test(lines[0])){lead.push(lines.shift());}
        const listPart=lines.join("\n");
        if(ramIsList(listPart)){
          const leadTxt=lead.join(" ").replace(/\s+/g," ").trim();
          return (leadTxt?`<p>${inl(leadTxt)}</p>`:"")+ramHTML(listPart);
        }
      }
    }
    const _rnd=e.localName==="p"?(e.getAttribute("rend")||""):"";
    if(_rnd==="monogram")return `<p class="monogram"${sourceAttrs}>${esc(e.textContent.trim())}</p>`;
    const cls=(_rnd==="caps")?' class="caps"':(_rnd==="editorial")?' class="editorial"':"";   // WA Einleitung / editor lines (2026-09-01): set petit like the edition
    let inner=pre+teiInline(e);
    // PILCROW BREAKS (owner 2026-08-30, Ockham/Biel/Lefèvre incunable-style prints): a ¶ inside running
    // text marks the start of a new paragraph in the print -- break there, keep the mark as a muted lead
    if(!_rnd&&/\S\s*[¶⸿⁋]\s+\S/.test(inner)){                      // ¶ U+00B6, capitulum ⸿ U+2E3F, reversed pilcrow ⁋ U+204B (Ockham 1495: 6,952 of them)
      // ONE <p> with internal block breaks -- separate <p>s broke the bilingual row pairing when only
      // one lane carries the pilcrows (owner screenshot 2026-08-31: EN column gapped for a whole page)
      const parts=inner.split(/\s*[¶⸿⁋]\s+/);
      return `<p${cls}${sourceAttrs}>`+parts.map((t,i)=>i?`<span class="pilpar"><span class="pil">¶</span> ${t}</span>`:t).join("")+`</p>`;
    }
    // literal '### ' surviving inside a <p> (minted bare marker) → inline head styling
    const hm=inner.match(/^#{1,6}\s+(.{3,140})$/);
    if(hm)return `<h3 class="csub inflow"${sourceAttrs}>${hm[1]}</h3>`;
    inner=inner.replace(/^#{1,6}\s+/,'');
    // caps-lead display break: 'EPISTOLA D. PAULI AD EPHESIOS (…) In which…' → banner line + prose
    inner=inner.replace(/^((?:[A-ZÆŒ0-9 .,:;()'&-]|&amp;){18,}?[.)])\s+(?=[A-Z][a-z])/,'<span class="capslead">$1</span>');
    // stray footnote-def runs → margin notes
    inner=inner.replace(/\[\^[\w-]+\]:\s*([^[<]{3,140}?)(?=\s*\[\^|\s*$)/g,'<span class="mnote">$1</span>');
    // ENGINEERED SEAMS (2026-08-13): carry the corpus part= attribute into the DOM so the
    // flow join is authoritative, not heuristic
    const prt=e.getAttribute?(e.getAttribute("part")||""):"";
    return `<p${cls}${prt?` data-part="${prt}"`:""}${sourceAttrs}>${inner}</p>`;}
  function teiHeadRow(sec,laEl,enEl){
    // LANE-INTEGRITY heads (owner 2026-08-10 'slipping from latin to english on subheadings'):
    // the Latin column NEVER shows English — each lane renders its OWN heading in its own
    // cell, both styled as true headings (Loeb parallel-edition rule). .h2col scopes the CSS
    // so the md path's banner heads are untouched.
    let hla=laEl?teiInline(laEl):"";const hen=enEl?teiInline(enEl):"";
    if(!(hla||hen).replace(/<[^>]+>/g,"").trim())return;   // empty-head marker ('##') — render nothing
    const _n=s=>(s||"").replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim().toLowerCase();
    // identical-echo guard retired for the facing layout (owner 2026-09-04 "no more middle display at milestone"): an untranslated
    // head used to be shown ONCE as a centred full-width block; with heads paired side by side it belongs in BOTH lanes, Latin left,
    // (untranslated) Latin right — the Loeb facing law, and no lone centred block at a tome's title milestone
    const typ=((enEl||laEl)?(enEl||laEl).getAttribute("type"):null)||"sub";
    const _ed=[laEl,enEl].some(x=>x&&(x.getAttribute("rend")||"")==="editorial");   // WA Einleitung label (2026-09-01)
    // hpair → the .row grid applies and the two heads sit side by side, each over its
    // own column (owner 2026-09-04); a one-sided head keeps the full-width block
    const h=el("div","row rhead h2col"+(hla&&hen?" hpair":"")+(typ==="main"?" hmain":"")+(_ed?" hedit":""));
    const sourcePath=(enEl||laEl)?.getAttribute("data-source-path");if(sourcePath!=null)h.dataset.sourcePath=sourcePath;
    for(const [attr,key]of [['data-source-paths','sourcePaths'],['data-source-keys','sourceKeys']]){const value=(enEl||laEl)?.getAttribute(attr);if(value)h.dataset[key]=value;}
    const hid="h"+(++_HSEQ)+"-"+(hen||hla).replace(/<[^>]+>/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40);
    h.id=hid;
    h.innerHTML=`<div class="la" lang="la">${hla?`<h3 class="csub"><span class="hla">${hla}</span></h3>`:""}</div>`+
                `<div class="en" lang="en">${hen?`<h3 class="csub"><a class="hanchor" href="#${hid}" title="Link to this section">§</a><span class="hen">${hen}</span></h3>`:""}</div>`;
    sec.appendChild(h);}
  window.__TEINOTES=window.__TEINOTES||{};
  function teiNote(e){
    const id=(e.getAttribute("xml:id")||"").replace(/^n-/,"").replace(/^(fn\d*)-(?:la|en)-/,"$1-");
    const txt=(e.textContent||"").trim();
    if(id)window.__TEINOTES[id]=txt;
    return {id,text:txt,place:e.getAttribute("place")||"foot"};}
  // HEAD REPAIR (owner 2026-08-18 screenshots — Holtzfus 'Cap.'+'III.' as two stacked heads,
  // 'I.'+'N.'+'D.' monogram as three, 'H O M I N U M' letterspacing kept): printed titles
  // arrive fragmented; merge each RUN of consecutive short heads into one, demote pious
  // monograms (I.N.D., V.D.M.) to a quiet ornament row, and close up letterspaced caps.
  const _joinCaps=s=>String(s).replace(/(^|[\s(])([A-ZÆŒ](?:\s[A-ZÆŒ]){2,})(?=[\s.,)]|$)/g,(m,pre,run)=>pre+run.replace(/\s+/g,""));
  function teiHeadFix(els,page){
    if(!els||!els.length)return els;
    const sourceFrom=(target,sources)=>{
      const paths=[],regions=[],keys=[];
      for(const source of sources){
        for(const path of (source.getAttribute("data-source-paths")||source.getAttribute("data-source-path")||"").split(/\s+/))if(path&&!paths.includes(path))paths.push(path);
        for(const region of (source.getAttribute("data-source-regions")||source.getAttribute("data-source-region")||"").split(/\s+/))if(region&&!regions.includes(region))regions.push(region);
        const targetKey=(source.getAttribute('data-source-path')||source.getAttribute('data-source-paths'))&&page!=null&&typeof window!=='undefined'&&window.FRSourceOutline?.targetKey(page,source.textContent,source.__frSourcePrimaryPath===source.getAttribute('data-source-path')?'primary':'');
        for(const key of (source.getAttribute('data-source-keys')||targetKey||'').split(/\s+/))if(key&&!keys.includes(key))keys.push(key);
      }
      if(paths.length){target.setAttribute("data-source-heading","true");target.setAttribute("data-source-path",paths[0]);target.setAttribute("data-source-paths",paths.join(" "));}
      if(paths.length&&keys.length)target.setAttribute('data-source-keys',keys.join(' '));
      if(regions.length){target.setAttribute("data-source-region",regions[0]);target.setAttribute("data-source-regions",regions.join(" "));}
      return target;
    };
    // BD HEAD HYGIENE (owner 2026-08-18, Calov Systema: '### CAPUT I.' literal markers,
    // prose sentences promoted to heads, 'S.'/'Dn.' fragments): strip minted ### from head
    // text; demote prose-length heads and isolated non-numeral fragments back to paragraphs.
    els=els.map(e=>{
      if(e.localName!=="head")return e;
      const t=e.textContent.replace(/\s+/g," ").replace(/^#{1,6}\s*/,"").trim();
      const D2=e.ownerDocument;
      const isProse=t.length>140||(t.length>100&&/[.!?][)"'”\]]?$/.test(t)&&(t.match(/[a-zà-ÿ]/g)||[]).length>t.length*0.45);
      const isFrag=t.length<=3&&!/^[IVXLC]+\.?$/.test(t);
      if(isProse||isFrag){const p=sourceFrom(D2.createElement("p"),[e]);p.textContent=t;return p;}
      if(t!==e.textContent.replace(/\s+/g," ").trim()){
        const h=sourceFrom(D2.createElement("head"),[e]);h.setAttribute("type",e.getAttribute("type")||"sub");if(e.getAttribute("rend"))h.setAttribute("rend",e.getAttribute("rend"));h.textContent=t;return h;}
      return e;});
    const out=[];let i=0;
    while(i<els.length){
      const e=els[i];
      if(e.localName!=="head"){out.push(e);i++;continue;}
      const short=x=>x.localName==="head"&&x.textContent.replace(/\s+/g," ").trim().length<=6;
      if(short(e)){
        // gather the run of consecutive short heads (+ one trailing long head absorbs a "Cap."-style label)
        const run=[e];let j=i+1;
        while(j<els.length&&short(els[j])){run.push(els[j]);j++;}
        const txt=run.map(x=>x.textContent.replace(/\s+/g," ").trim()).join(" ");
        const D2=e.ownerDocument;
        if(/^(?:[A-Z]\.\s*){2,4}$/.test(txt)&&!(j<els.length&&els[j].localName==="head")){
          const p=sourceFrom(D2.createElement("p"),run);p.setAttribute("rend","monogram");p.textContent=txt;out.push(p);
        }else if(j<els.length&&els[j].localName==="head"&&run.length<=2){
          // "Cap." + "III." glue onto the next head when it is short too — else prefix the long head
          const h=sourceFrom(D2.createElement("head"),[...run,els[j]]);h.setAttribute("type",e.getAttribute("type")||"main");if(e.getAttribute("rend"))h.setAttribute("rend",e.getAttribute("rend"));
          const nxt=els[j].textContent.replace(/\s+/g," ").trim();
          h.textContent=_joinCaps(txt+" "+nxt);out.push(h);j++;
        }else{
          const h=sourceFrom(D2.createElement("head"),run);h.setAttribute("type",e.getAttribute("type")||"main");if(e.getAttribute("rend"))h.setAttribute("rend",e.getAttribute("rend"));
          h.textContent=_joinCaps(txt);out.push(h);
        }
        i=j;continue;
      }
      const h=sourceFrom(e.ownerDocument.createElement("head"),[e]);
      h.setAttribute("type",e.getAttribute("type")||"sub");if(e.getAttribute("rend"))h.setAttribute("rend",e.getAttribute("rend"));h.textContent=_joinCaps(e.textContent.replace(/\s+/g," ").trim());
      out.push(h);i++;
    }
    return out;
  }
  function renderFolioTEI(pg,pi){
    const isFront=TP&&pg.n<TP,isTitle=TP&&pg.n===TP,key=teiNorm(pg.n);
    const laEls=teiHeadFix(TEI_PAGES.la[key]||[],String(pg.n)),enEls=teiHeadFix(TEI_PAGES.en[key]||[],String(pg.n));
    // mirror renderFolio's ONLY skip rule: born-digital blank leaves. Facsimile blanks still
    // get a section (the scan stays visible) — every DATA.pages entry must produce a folio.
    if(DATA.has_pages===false&&!isFront&&!isTitle&&!laEls.length&&!enEls.length)return;
    const fm=el("div","fmark"+(isFront?" frontmatter":"")+(isTitle?" titlepage":""));
    fm.innerHTML=`<span class="ff" role="button" tabindex="0">${esc(locOf(pg.n))}</span><span class="fr"></span><span class="fm">${isTitle?"title page":"p. "+pg.n}</span>`;
    R.appendChild(fm);
    const sec=el("section","folio"+(isFront?" frontmatter":"")+(isTitle?" titlepage":""));sec.dataset.idx=pi;sec.dataset.page=pg.n;
    const enQ=teiKids(enEls),notesLA=[],notesEN=[];
    // SECTION-SYNC pairing (owner 2026-08-11 'all deadspace at the bottom'): heads are the
    // only hard sync points — everything between renders as TWO CONTINUOUS FACING COLUMNS,
    // so imperfect block correspondence can never open mid-flow gaps; length differences
    // settle once at the end of each synced section (Loeb facing-page law).
    const segments=els=>{const out=[{head:null,body:[],notes:[]}];
      (els||[]).forEach(e=>{
        // margin notes are READING content at their position; only foot notes go to the bank
        if(e.localName==="note"){if((e.getAttribute("place")||"foot")==="margin")out[out.length-1].body.push(e);else out[out.length-1].notes.push(e);return;}
        // a commentary lemma (<head rend="lemma">) is READING content, not a section boundary (Scholarios 09-10)
        if(e.localName==="head"&&(e.getAttribute("rend")||"")==="lemma"){out[out.length-1].body.push(e);return;}
        if(e.localName==="head"){out.push({head:e,body:[],notes:[]});return;}
        if(e.localName==="p"||e.localName==="quote"||e.localName==="list"||e.localName==="table"||e.localName==="ab"||e.localName==="figure")out[out.length-1].body.push(e);});
      return out;};
    let SL=segments(laEls),SE=segments(enEls);
    // HEAD-COUNT MISMATCH GUARD (owner 2026-08-11 braun Part II: one lane's chapter head is a
    // plain <p> → section counts differ → whole sections shear across the page). When counts
    // differ, collapse to PAGE-level sync: one facing pair carrying each lane's full flow,
    // heads rendered inline in their own column. Content always faces content.
    if(SL.length!==SE.length&&(SL.length>1||SE.length>1)){
      const flat=S=>{const seg={head:null,body:[],notes:[]};
        S.forEach(x=>{if(x.head)seg.body.push(x.head);seg.body.push(...x.body);seg.notes.push(...x.notes);});
        return [seg];};
      SL=flat(SL);SE=flat(SE);
    }
    for(let k=0;k<Math.max(SL.length,SE.length);k++){
      const a=SL[k],b=SE[k];
      // EDITORIAL MATTER (owner 2026-08-16 'Notes label but what comes is not a complete
      // sentence'): sections headed Anmerkungen/Notes are the WA editors' apparatus prose,
      // not Luther — set them in quieter, indented editorial typography so the register
      // shift is visible instead of reading as broken body text.
      const _ht=(x)=>x?x.textContent.replace(/\s+/g," ").trim().toLowerCase():"";
      const isEdit=/^(anmerkungen|anmerkung|notes?)\b\.?$/.test(_ht((b&&b.head)||(a&&a.head)));
      if((a&&a.head)||(b&&b.head)){teiHeadRow(sec,a&&a.head,b&&b.head);
        if(isEdit&&sec.lastElementChild)sec.lastElementChild.classList.add("hedit");}
      const _rowsBefore=sec.children.length;
      const laB=a?a.body:[],enB=b?b.body:[];
      if(laB.length||enB.length){
        // PARAGRAPH-LEVEL SYNC (owner 2026-08-16 'enhance syncing'): when both lanes agree
        // on block count inside a section — guaranteed for parity-built corpora (Luther
        // para-sync, en_mirror) — pair block-for-block so the columns stay level through
        // long sections instead of drifting until the next head. Mismatched sections keep
        // the section-sync fallback: content always faces content, never a mid-flow gap.
        // MARGIN NOTES RIDE WITH THEIR PARAGRAPH (owner 2026-09-02, Scheibler p52 / Billuart p14: 7 Latin vs 5
        // English glosses on a page made the block counts differ, so the whole page fell back to facing columns and
        // the English ran out halfway; when counts happened to match, glosses paired with paragraphs). The
        // alignment now counts PARAGRAPHS only; each lane's glosses render inside the row of the paragraph they precede.
        const _split=arr=>{const out=[];let pend=[];arr.forEach(e=>{if(e.localName==="note")pend.push(e);else{out.push({e,notes:pend});pend=[];}});
          if(pend.length){if(out.length)out[out.length-1].after=pend;else out.push({e:null,notes:pend});}return out;};
        const LAp=_split(laB),ENp=_split(enB);

        // ANCHOR ALIGNMENT (owner 2026-09-02, readqa baseline: proportional-zip rows judged ~50% MATCH, 189 sampled pages
        // still facing columns). Tokens UNIQUE to one Latin and one English paragraph on the page — a paragraph-initial
        // cue numeral, a number of 2+ digits, a Greek word, a capitalised name stem — pin an English paragraph to its
        // Latin row; a monotone DP keeps English order following Latin order; unanchored English paragraphs are placed
        // by length share between their anchored neighbours. Needs >=2 anchored English paragraphs or a cue anchor,
        // otherwise null and the proportional zip / facing columns decide as before. Rows carry .palign.
        const _alignByAnchors=(LAp,ENp)=>{
          const fold=s=>s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
          const rom=s=>{const M={i:1,v:5,x:10,l:50,c:100,d:500,m:1000};let t=0,p=0;s.toLowerCase().split("").reverse().forEach(ch=>{const v=M[ch]||0;t+=v<p?-v:v;p=v;});return t;};
          // tiers: paragraph-initial cue numeral, numbers of 2+ digits, Greek words. (Name stems measured too noisy on one-line paragraphs, 09-02.)
          const anchors=x=>{const t=(x.e.textContent||"").replace(/\s+/g," ").trim();const A=new Map();
            const cue=t.match(/^(?:§\s*)?([IVXLC]{1,7}|\d{1,4})[.)]\s/);if(cue){const c=cue[1];A.set("c:"+(/^\d/.test(c)?+c:rom(c)),3);}
            (t.match(/\d{2,}/g)||[]).forEach(n=>A.set("n:"+n,2));
            (t.match(/[Ͱ-Ͽἀ-῿]{3,}/g)||[]).forEach(g=>A.set("g:"+fold(g),2));
            return A;};
          const LA=LAp.map(anchors),EN=ENp.map(anchors);
          const count=arrs=>{const c=new Map();arrs.forEach(A=>A.forEach((w,k)=>c.set(k,(c.get(k)||0)+1)));return c;};
          const cl=count(LA),ce=count(EN);const n=LAp.length,m=ENp.length;
          // per English paragraph: the Latin rows its unique anchors point at
          const hits=EN.map(A=>{const rows=[];A.forEach((w,k)=>{if(cl.get(k)!==1||ce.get(k)!==1)return;const i=LA.findIndex(B=>B.has(k));if(i>=0)rows.push(i);});return rows.sort((a,b)=>a-b);});
          const anchored=hits.filter(h=>h.length).length;const cueHit=EN.some((A,j)=>hits[j].length&&[...A.keys()].some(k=>k.startsWith("c:")&&cl.get(k)===1&&ce.get(k)===1));
          if(anchored<2&&!cueHit)return null;
          // monotone greedy: an anchored English paragraph sits beside the FIRST Latin row it covers (a merged
          // translation starts where its Latin starts); its last anchored row is where the merge ends.
          const asg=new Array(m).fill(-1),cover=new Array(m).fill(-1);let prev=0;
          for(let j=0;j<m;j++){const h=hits[j].filter(i=>i>=prev);if(h.length){asg[j]=h[0];cover[j]=h[h.length-1];prev=h[0];}}
          const len=x=>(x.e.textContent||"").replace(/\s+/g," ").length+1;const laLen=LAp.map(len),enLen=ENp.map(len);
          for(let j=0;j<m;){if(asg[j]>=0){j++;continue;}
            let j1=j;while(j1<m&&asg[j1]<0)j1++;
            let lo=j>0?cover[j-1]+1:0;let hi=j1<m?asg[j1]-1:n-1;
            if(hi<lo){lo=hi=Math.min(Math.max(lo-1,0),n-1);if(j1<m)lo=hi=Math.max(asg[j1]-1,j>0?asg[j-1]:0);}
            let laTot=0;for(let i=lo;i<=hi;i++)laTot+=laLen[i];
            let enTot=0;for(let q=j;q<j1;q++)enTot+=enLen[q];let acc=0;
            for(let q=j;q<j1;q++){const mid=(acc+enLen[q]/2)/enTot*laTot;acc+=enLen[q];let c=0,k=hi;for(let i=lo;i<=hi;i++){c+=laLen[i];if(mid<=c){k=i;break;}}asg[q]=k;}
            j=j1;}
          for(let q=1;q<m;q++)if(asg[q]<asg[q-1])asg[q]=asg[q-1];
          const buckets=LAp.map(()=>[]);ENp.forEach((x,q)=>buckets[asg[q]].push(x));return buckets;};
        const _cellHtml=x=>x.notes.map(n=>teiCell(n,pg.n)).join("")+(x.e?teiCell(x.e,pg.n):"")+(x.after||[]).map(n=>teiCell(n,pg.n)).join("");
        if(LAp.length===ENp.length&&LAp.length>1&&LAp.every(x=>x.e)&&ENp.every(x=>x.e)){
          for(let j=0;j<LAp.length;j++){
            const row=el("div","row prow");
            row.innerHTML=`<div class="la" lang="la">${_cellHtml(LAp[j])}</div><div class="en" lang="en">${_cellHtml(ENp[j])}</div>`;
            sec.appendChild(row);}
        }else{
          // REHAUL §1.1 (2026-08-17): asymmetric block counts collapse to one unsplit row —
          // correct behavior per the head-count mismatch guard above, left as-is — but the
          // concatenated <p>s inside each lane had no visible paragraph-break cue. .pfallback is
          // a pure CSS signal (see the ::before rule on .row.pfallback>.la p+p / >.en p+p) —
          // no change to what teiCell emits per paragraph, just a class on the row so CSS can
          // draw a hairline rhythm between the concatenated paragraphs.
          const row=el("div","row pfallback");
          // LA-ONLY APPARATUS (owner 2026-08-20 pld-3481: Migne's editorial note — 'Divisionis
          // istius formulam primus edidit Petrus Pithoeus…' — has no EN facing text and left a
          // column-length hole). Trailing LA blocks beyond the EN count that read as editorial
          // apparatus (edition citations, tome/col refs) set QUIET — apparatus, not a bug.
          const APPRX=/\b(edidit|editionem|edition|tom\.|col\.|Patrologi\w*|seqq|videsis|Mabillon|Baluz\w*|Sirmond\w*|Labbe\w*|Monum\w*|apud|codice|SS\.\s|annotat\w*)\b/;
          const laHtml=laB.map((x,j)=>{
            const h=teiCell(x,pg.n);
            return (enB.length&&j>=enB.length&&APPRX.test(x.textContent||""))?`<div class="laonly">${h}</div>`:h;
          }).join("");
          // SOLO SECTION (owner 2026-08-27 screenshots: a column-length void where one
          // lane has no facing text): an empty side renders the other lane full-width
          // instead of leaving a blank facing column.
          if(!enB.length&&laB.length){
            row.classList.add("solo");
            row.innerHTML=`<div class="la" lang="la">${laHtml}</div>`;
          }else if(!laB.length&&enB.length){
            row.classList.add("solo");
            row.innerHTML=`<div class="en" lang="en">${enB.map(x=>teiCell(x,pg.n)).join("")}</div>`;
          }else if(LAp.length>=2&&ENp.length>=2&&LAp.every(x=>x.e)&&ENp.every(x=>x.e)&&(window.__frAlignBuckets=_alignByAnchors(LAp,ENp))){
            const buckets=window.__frAlignBuckets;row.remove();
            for(let j=0;j<LAp.length;j++){
              const r=el("div","row prow palign");
              r.innerHTML=`<div class="la" lang="la">${_cellHtml(LAp[j])}</div><div class="en" lang="en">${buckets[j].map(_cellHtml).join("")}</div>`;
              sec.appendChild(r);}
          }else if(LAp.length>=2&&ENp.length>=2&&LAp.every(x=>x.e)&&ENp.every(x=>x.e)&&Math.min(LAp.length,ENp.length)>=0.5*Math.max(LAp.length,ENp.length)){
            // PROPORTIONAL ZIP (owner 2026-09-02, Scheibler p52: 5 Latin vs 7 English paragraphs left the English
            // column blank beside the last Latin paragraphs): one row per Latin paragraph; each English paragraph
            // joins the Latin row whose cumulative share of the text contains its own midpoint. Never a void column.
            const len=x=>(x.e.textContent||"").replace(/\s+/g," ").length+1;
            const laLen=LAp.map(len),enLen=ENp.map(len);const laTot=laLen.reduce((s,v)=>s+v,0),enTot=enLen.reduce((s,v)=>s+v,0);
            const laCum=[];laLen.reduce((s,v,i)=>(laCum[i]=s+v,s+v),0);
            const buckets=LAp.map(()=>[]);let acc=0;
            ENp.forEach((x,i)=>{const mid=(acc+enLen[i]/2)/enTot*laTot;acc+=enLen[i];let k=laCum.findIndex(c=>mid<=c);if(k<0)k=LAp.length-1;buckets[k].push(x);});
            row.remove();
            for(let j=0;j<LAp.length;j++){
              const r=el("div","row prow pzip");
              r.innerHTML=`<div class="la" lang="la">${_cellHtml(LAp[j])}</div><div class="en" lang="en">${buckets[j].map(_cellHtml).join("")}</div>`;
              sec.appendChild(r);}
          }else{
            row.innerHTML=`<div class="la" lang="la">${laHtml}</div><div class="en" lang="en">${enB.map(x=>teiCell(x,pg.n)).join("")}</div>`;
          }
          if(row.innerHTML)sec.appendChild(row);}}
      if(isEdit)for(let ri=_rowsBefore;ri<sec.children.length;ri++)sec.children[ri].classList.add("redit");
      (a?a.notes:[]).forEach(e=>notesLA.push(teiNote(e)));
      (b?b.notes:[]).forEach(e=>notesEN.push(teiNote(e)));
    }
    let bi=0;sec.querySelectorAll(".row").forEach(rw=>{if(!rw.classList.contains("rhead"))rw.id="b"+pg.n+"-"+(bi++);});
    // REF MIRROR (owner 2026-08-18 hover parity): when the source cell of a paired row
    // carries footnote anchors and the English cell carries none, mirror the anchors at
    // the English paragraph's end — hover pops the English note via the band pairing.
    [...sec.querySelectorAll(".row:not(.rhead):not(.rapp)")].forEach(rw=>{
      const laRefs=[...rw.querySelectorAll(".la sup.fnref a")];
      if(!laRefs.length||rw.querySelector(".en sup.fnref"))return;
      const enP=[...rw.querySelectorAll(".en p")].pop();
      if(!enP||enP.textContent.trim().length<20)return;
      laRefs.forEach(a=>{const s2=document.createElement("sup");s2.className="fnref mirror";
        const a2=document.createElement("a");a2.href=a.getAttribute("href");a2.textContent=a.textContent;
        s2.appendChild(a2);enP.appendChild(document.createTextNode(" "));enP.appendChild(s2);});});
    // KNAAKE-INTRO FOLD (owner 2026-08-18 'think about editorial, intro' — WA class only):
    // the editors' German introduction runs from a work head to the editor-signature
    // paragraph ("D. Knaake"). Fold those rows like the Anmerkungen apparatus.
    if(/^luther-wa-/.test(String(DATA.slug||""))){
      const rows=[...sec.children];
      const isSig=r=>/^(D|Dr)\.\s+[A-ZÄÖÜ][a-zä-üßA-Z]+\.?$/.test((r.textContent||"").replace(/\s+/g," ").trim());
      rows.forEach((r,i)=>{
        if(!r.classList||!r.classList.contains("rhead")||r.querySelector(".editchip"))return;
        const grp=[];let j=i+1;
        while(j<rows.length&&rows[j].classList&&rows[j].classList.contains("row")&&!rows[j].classList.contains("rhead")){
          grp.push(rows[j]);if(isSig(rows[j])){
            if(grp.length&&grp.length<=14){
              grp.forEach(x=>{x.classList.add("redit","redit-hid");});
              const chip=document.createElement("button");chip.className="editchip";chip.type="button";
              chip.textContent="show the editors’ introduction";
              chip.onclick=()=>{const open=chip.classList.toggle("open");
                grp.forEach(x=>x.classList.toggle("redit-hid",!open));
                chip.textContent=(open?"hide":"show")+" the editors’ introduction";};
              r.appendChild(chip);}
            return;}
          j++;}
      });
    }
    // EDITORIAL SECTIONS FOLD (owner 2026-08-18 'esp for luther — easier to navigate,
    // editorial, intro'): Anmerkungen/Notes sections collapse behind their head with a
    // count — Luther's own text reads through; the WA editors' apparatus opens on demand.
    [...sec.querySelectorAll(".rhead.hedit")].forEach(hr=>{
      const grp=[];let sib=hr.nextElementSibling;
      while(sib&&sib.classList.contains("redit")){grp.push(sib);sib=sib.nextElementSibling;}
      if(!grp.length)return;
      grp.forEach(r=>r.classList.add("redit-hid"));
      const chip=document.createElement("button");chip.className="editchip";chip.type="button";
      chip.textContent=`show the editors’ ${grp.length===1?"note":grp.length+" paragraphs"}`;
      chip.onclick=()=>{const open=chip.classList.toggle("open");
        grp.forEach(r=>r.classList.toggle("redit-hid",!open));
        chip.textContent=(open?"hide":"show")+` the editors’ ${grp.length===1?"note":grp.length+" paragraphs"}`;};
      hr.appendChild(chip);});
    // INDEX-RUN guard (owner 2026-08-10 'terrible to read': a TABULA leaf tagged as heads
    // rendered as a tower of giant display headings). ≥4 consecutive head rows = index
    // typography, not chapter openings — render the run compact.
    {const rows=[...sec.children];let run=[];
     // …but never on the TITLE leaf (owner 2026-09-06 "no stacking of source and english": Poinsot Cursus t.7-2 p3 —
     // eight paired title heads compacted into Latin-over-English; the title page keeps its side-by-side pairs)
     const flush=()=>{if(run.length>=3&&!isTitle)run.forEach(r=>r.classList.add("ixh"));run=[];};
     rows.forEach(r=>{if(r.classList.contains("rhead"))run.push(r);else flush();});flush();
     const nh=sec.querySelectorAll(".rhead").length,nb=[...sec.querySelectorAll(".row")].filter(x=>!x.classList.contains("rhead")&&!x.classList.contains("rapp")).length;
     if(nh>=6&&nb<=2&&!isTitle)sec.querySelectorAll(".rhead").forEach(r=>r.classList.add("ixh"));
     // meta.index_pages (the corpus's own flag): a printed index / contents leaf — every head row is a catalogue
     // line and the folio takes the compact index typography whatever the run lengths (Urraburu Psychologia II
     // p.5 rendered its contents table as centred display heads stacked lane over lane, owner 2026-09-04)
     if(!isTitle&&INDEX_PAGES&&INDEX_PAGES.has(key)){sec.querySelectorAll(".rhead").forEach(r=>r.classList.add("ixh"));sec.classList.add("ixfolio");}}
    // TEI PATH (2026-08-10): mirror renderFolio's flow-continuation seam mark on the same
    // outer _prevTail carrier, so readingEditionPass's tail/cont merge also closes sentences
    // split across a TEI leaf. Lane preference is reversed from the md path — EN is the TEI
    // reading surface, so prefer it over a thinner/absent LA transcription.
    if(isFront||isTitle){_prevTail=null;}
    else{
      const teiLaneTxt=(r,wantLast)=>{
        const pick=sel=>{const n=r.querySelectorAll(sel);return n.length?n[wantLast?n.length-1:0]:null;};
        const en=pick(".en");if(en&&en.textContent.trim())return en.textContent;
        const la=pick(".la");return la?(la.textContent||""):"";
      };
      const brows=[...sec.querySelectorAll(".row")].filter(x=>!x.classList.contains("rhead")&&!x.classList.contains("rtoc")&&!x.classList.contains("rapp"));
      const firstRow=sec.querySelector(".row"),head=brows[0];
      if(_prevTail&&head&&firstRow===head){
        // ENGINEERED SEAMS FIRST (owner 2026-08-13): the corpus marks continuations with
        // part="F|M" — authoritative; the textual heuristic remains only as fallback for
        // works minted before the marks existed
        if(head.querySelector('[data-part="F"],[data-part="M"]')){
          head.classList.add("cont");_prevTail.row.classList.add("tail");
          // seamHyphen (2026-08-13): cross-page 'xx- yy' joins as one word at render, per lane
          try{for(const ln of [".la",".en"]){
            const lastP=_prevTail.row.querySelector(ln+" p:last-of-type");
            const firstP=head.querySelector(ln+' [data-part="F"],'+ln+' [data-part="M"]');
            if(lastP&&firstP&&/\w-\s*$/.test(lastP.textContent)&&/^[a-zà-ÿ]/.test(firstP.textContent.trim())){
              lastP.innerHTML=lastP.innerHTML.replace(/-(\s*)$/,"");firstP.classList.add("hyphjoin");}
          }}catch(e){}
        }else{
        const ht=teiLaneTxt(head,false).trim();
        if(ht&&/\b(?:lib|cap|vers|ver|fol|tom|art|dist|sect|tit|num|col|pag|loc|seq)\.$/i.test(_prevTail.txt)&&/^[IVXLCDM0-9]/.test(ht)){head.classList.add("cont");_prevTail.row.classList.add("tail");}
        else if(ht&&(
              /[,;:—–-]$/.test(_prevTail.txt)                       // mid-clause: ALWAYS a continuation
              || (/[a-zà-öø-ÿ0-9]$/.test(_prevTail.txt)&&(/^[a-zà-öø-ÿ(\["'«‘“]/.test(ht)
                  || (/^[A-ZÀ-Þ][a-zà-öø-ÿ]/.test(ht)&&!/^(?:Cap|Lib|Quaest|Art|Sect|Disp|Tit|Pars|Prop|Chap|The\s)/.test(ht))
                  || /^I\s/.test(ht))))){
          head.classList.add("cont");_prevTail.row.classList.add("tail");}
        }
      }
      const last=brows[brows.length-1];
      if(last){const lt=teiLaneTxt(last,true).trim();if(lt)_prevTail={row:last,txt:lt};}
    }
    enhanceScriptureContinuations(sec);
    const ab=appBank(notesLA,notesEN);if(ab)sec.appendChild(ab);
    R.appendChild(sec);io.observe(sec);
  }
  // READING EDITION post-pass (owner 2026-08-10): (1) body runs continue across page
  // boundaries — when a page ends in a stacked run and the next begins with one, the columns
  // are joined with an inline page anchor at the true boundary (scan-sync + ?p= track the
  // anchors); (2) surviving print furniture rows (signature marks, lone catch-syllables)
  // are tagged .furn — hidden in Flow, dimmed in page views. DOM-level; text untouched.
  const readingEditionPass=()=>{try{
    // SMALL-CAPS DISPLAY (owner 2026-08-17, Baronius: 'look at all caps'): shouted
    // address blocks and title-page runs in the ENGLISH lane set as true small caps —
    // the display transform printers use. Text content untouched (display-only spans);
    // the source lane keeps its authentic capitals.
    if(!R.__capsWired){R.__capsWired=1;
      const CAPS=/((?:[A-Z0-9ÆŒ&(),.:;'’\-\[\]]{2,}(?![a-z])\s+){2,}[A-Z0-9ÆŒ&(),.:;'’\-\[\]]{2,}(?![a-z]))/g;
      const fix=()=>{document.querySelectorAll('#reading .row .en p:not([data-caps]), #reading .row .la p:not([data-caps]), #reading .row .en:not(:has(p)):not([data-caps]), #reading .row .la:not(:has(p)):not([data-caps])').forEach(el2=>{
        el2.setAttribute('data-caps','1');
        if(!/[A-Z]{3}/.test(el2.textContent))return;
        [...el2.childNodes].forEach(nd=>{
          if(nd.nodeType!==3)return;
          const t=nd.textContent;if(!/[A-Z]{3,}\s+[A-Z]{3,}/.test(t))return;
          const frag=document.createDocumentFragment();let last=0;
          t.replace(CAPS,(m,run,off)=>{
            const letters=(run.match(/[A-Z]/g)||[]).length,lower=(run.match(/[a-z]/g)||[]).length;
            if(letters<8||lower>letters/4)return m;
            frag.appendChild(document.createTextNode(t.slice(last,off)));
            // STRUCTURAL SPLIT (owner 2026-08-17 'no page would have a block of caps
            // smushed into a sentence'): a display block ends at its LAST sentence
            // terminal — trailing caps that OPEN the next sentence (the printer's
            // opening-words convention) stay inline with the prose.
            let blkPart=run,tailPart='';
            if(run.length>=40&&!/[.!?:]\s*$/.test(run)){
              const mm2=run.match(/^([\s\S]*[.!?:])\s+([\s\S]*)$/);
              if(mm2){blkPart=mm2[1];tailPart=mm2[2];}
              else{blkPart='';tailPart=run;}
            }
            if(blkPart){const sp=document.createElement('span');
              // PARAGRAPH-OPENING caps run = a displayed title line (owner 2026-08-20
              // 'new line after the ALL CAPS'): when the run OPENS the paragraph and the
              // prose resumes with a fresh capitalized sentence, break after it even
              // under the 40-char structural threshold.
              const opensPara=(off===0&&blkPart===run&&blkPart.split(/\s+/).length>=3&&/^\s*[A-Z"“]/.test(t.slice(off+run.length)));
              sp.className='capsrun'+((blkPart.length>=40||opensPara)?' blk':'');
              sp.textContent=blkPart;frag.appendChild(sp);}
            if(tailPart){const sp2=document.createElement('span');
              sp2.className='capsrun';sp2.textContent=(blkPart?' ':'')+tailPart;frag.appendChild(sp2);}
            const sp={remove(){}};sp.textContent=run;
            last=off+run.length;return m;});
          if(last){frag.appendChild(document.createTextNode(t.slice(last)));nd.replaceWith(frag);}
        });});};
      fix();setTimeout(fix,2500);setTimeout(fix,6000);
      // GREEK RUBRIC ENTRANCES (owner 2026-08-18 'inline chapter divisions'): Migne prints
      // section rubrics (ΛΟΓΟΣ Β΄. / ΚΕΦΑΛΑΙΟΝ Αʹ.) INSIDE the flowing paragraph in 25
      // PG works with no head elements. Closed rubric vocabulary + sentence-boundary
      // precondition (citation guard: mid-sentence chapter references stay inline).
      const GRUB=/(^|[.·;:!?»\]]\s+)((?:ΚΕΦΑΛΑΙΟΝ|Κεφάλαιον|ΛΟΓΟΣ|ΟΜΙΛΙΑ|ΒΙΒΛΙΟΝ|ΠΡΟΛΟΓΟΣ|ΕΠΙΛΟΓΟΣ|ΕΡΩΤΗΣΙΣ|ΑΠΟΚΡΙΣΙΣ)(?:\s+[Α-Ω]{1,4}[΄ʹ’'.]{0,2})?)(?=\s|$)/g;
      const gfix=()=>{document.querySelectorAll('#reading .row .la p:not([data-grub]), #reading .row .la:not(:has(p)):not([data-grub])').forEach(el2=>{
        el2.setAttribute('data-grub','1');
        if(!/ΚΕΦΑΛΑΙΟΝ|ΛΟΓΟΣ|ΟΜΙΛΙΑ|ΒΙΒΛΙΟΝ|ΠΡΟΛΟΓΟΣ|ΕΠΙΛΟΓΟΣ|ΕΡΩΤΗΣΙΣ|ΑΠΟΚΡΙΣΙΣ/.test(el2.textContent))return;
        [...el2.childNodes].forEach(nd=>{
          if(nd.nodeType!==3||!GRUB.test(nd.textContent))return;
          GRUB.lastIndex=0;
          const t=nd.textContent,frag=document.createDocumentFragment();let last=0,hit=false;
          t.replace(GRUB,(m,pre,rub,off)=>{
            hit=true;
            frag.appendChild(document.createTextNode(t.slice(last,off)+pre));
            const sp=document.createElement('span');sp.className='capsrun blk grub';sp.textContent=rub;
            frag.appendChild(sp);
            last=off+m.length;return m;});
          if(hit){frag.appendChild(document.createTextNode(t.slice(last)));nd.replaceWith(frag);}
        });});};
      gfix();setTimeout(gfix,2600);setTimeout(gfix,6100);
      document.addEventListener('scroll',()=>{clearTimeout(window.__capsT);window.__capsT=setTimeout(()=>{fix();gfix();},700);},{passive:true});
    }
    if(!R.__fnpopWired){R.__fnpopWired=1;
      const pop=document.createElement("div");pop.id="fnpop";document.body.appendChild(pop);
      const show=(a)=>{if(window.FRFootnotes)return false;const id=(a.getAttribute("href")||"").replace(/^#n-/,"").replace(/^(fn\d*)-(?:la|en)-/,"$1-").replace(/^#/,"");
        let txt=(window.__TEINOTES||{})[id];
        // ENGLISH-FIRST HOVER (owner 2026-08-18 'german lane had footnote hoverable but en
        // did not'): when the note band positionally paired an English translation for this
        // note, the hover shows it (with the source note beneath) instead of German alone
        try{const band=a.closest("section.folio")?.querySelector(`.row.rapp[data-fnid="${CSS.escape(id)}"] .en`);
          const enT=band&&band.textContent.replace(/\s*↑\s*$/,"").trim();
          if(enT&&enT.length>8)txt=enT+(txt?"\n\n— "+txt:"");}catch(e){}
        if(!txt)return false;
        pop.textContent=txt;pop.style.display="block";
        const r=a.getBoundingClientRect();
        pop.style.left=Math.min(window.innerWidth-pop.offsetWidth-12,Math.max(8,r.left-40))+"px";
        pop.style.top=(r.bottom+8+window.scrollY)+"px";return true;};
      const hide=()=>{pop.style.display="none";};
      R.addEventListener("mouseover",e=>{const a=e.target.closest("sup.fnref a, a.fn");if(a)show(a);});
      R.addEventListener("mouseout",e=>{if(e.target.closest("sup.fnref a, a.fn"))hide();});
      // Scripture hover, focus, and single-tap behavior is installed by reader-scripture-preview.js.
      // Retain the existing touch guard for patristic work links.
      if(matchMedia("(pointer:coarse)").matches){let armed=null,armT=0;
        R.addEventListener("click",e=>{const a=e.target.closest("a.plref");if(!a)return;const now=Date.now();if(armed===a&&now-armT<2500)return;e.preventDefault();armed=a;armT=now;a.classList.add("tapped");setTimeout(()=>a.classList.remove("tapped"),2500);},true);}
      R.addEventListener("click",e=>{if(window.FRFootnotes)return;const a=e.target.closest("sup.fnref a, a.fn");
        if(a){e.preventDefault();if(pop.style.display==="block")hide();else show(a);}});
      window.addEventListener("scroll",hide,{passive:true});
    }
    if(!R.__pgoWired){R.__pgoWired=1;R.addEventListener("click",ev=>{
      const a=ev.target.closest(".pgo");if(!a)return;ev.preventDefault();
      const n=a.dataset.p;
      const s=R.querySelector(`.folio[data-page="${n}"]`)||R.querySelector(`.folio[data-page="${String(n).padStart(4,"0")}"]`);
      if(s)s.scrollIntoView({behavior:"smooth",block:"start"});});}
    const secs=[...R.querySelectorAll(".folio")];
    // SOLO-LANE rule (owner 2026-08-10, Aretius §530 'this is empty'): a row whose text
    // survives in only one lane must never render as a void in a single-lane view — the
    // surviving lane stays visible whatever the lane mode. (.rcit.conly hides EN by design.)
    R.querySelectorAll(".row").forEach(r=>{
      if(r.classList.contains("rcit"))return;
      const la=r.querySelector(".la"),en=r.querySelector(".en");if(!la||!en)return;
      // rows born from count-mismatch pairing (.pzip/.palign) keep their two columns: a Latin paragraph whose translation
      // was merged into the previous row must stay in the Latin column, not become a centred full-width block that
      // reads as a heading (readqa vision judge 09-02: GIANT_GAP / EMPTY_PANE on Urraburu p926, Albertus p311)
      if(r.classList.contains("pzip")||r.classList.contains("palign"))return;
      const lt=la.textContent.trim(),et=en.textContent.trim();
      if(lt&&!et)r.classList.add("solola");else if(et&&!lt)r.classList.add("soloen");});
    // RAMIST SCHEMATA (owner 2026-09-01, Baxter Methodus p635): the ingest preserves the
    // bracket-diagrams as indented "- N." lines inside <p> text — 6,367 of them in the
    // Methodus alone — and whitespace-collapse flattened every schema into a wall. Rebuild
    // any such paragraph as a hanging outline, indent from the source's own leading spaces.
    R.querySelectorAll(".row .en p,.row .la p,.row .en,.row .la").forEach(el=>{
      if(el.__rml||el.children.length>1)return;
      const t=el.textContent;
      if(!t||t.length<80)return;
      const lines=t.split("\n");
      const items=lines.filter(l=>/^\s{2,}- /.test(l)).length;
      if(items<2)return;
      el.__rml=1;
      const esc2=x=>x.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
      let html="";
      lines.forEach(l=>{
        const m=l.match(/^(\s*)- (.*)$/);
        if(m){const lv=Math.min(7,Math.round(m[1].length/4));
          const txt=m[2];
          const nm=txt.match(/^([IVXivx\d]{1,4}[.)]|[a-z][.)])\s*(.*)$/);
          html+=`<span class="rml" style="--lv:${lv}">${nm?`<b class="rmn">${esc2(nm[1])}</b> ${esc2(nm[2])}`:esc2(txt)}</span>`;
        }else if(l.trim()){html+=`<span class="rml rml0">${esc2(l.trim())}</span>`;}
      });
      if(html)el.innerHTML=html;
    });
    // HEAD-ECHO row (owner 2026-08-28 aq-detrin-86): a single-paragraph row immediately
    // after a heading whose text IS that heading (the ingest echoed it) — remove it.
    {let lastH=null;const _f=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
     R.querySelectorAll(".row").forEach(r=>{
       if(r.classList.contains("rhead")){lastH=r;return;}
       if(!lastH)return;
       const hs=lastH;lastH=null;
       const ps=r.querySelectorAll("p");
       if(ps.length!==1)return;
       const pf=_f(ps[0].textContent);if(pf.length<12)return;
       const hen=hs.querySelector(".hen");
       const hf=_f(hen?hen.textContent:"")||_f(hs.textContent);
       // the echo often drops the head's 'A. 4'-style prefix — ends-with covers both shapes
       if(hf&&(hf===pf||hf.endsWith(pf))&&pf.length>=hf.length*0.6)r.remove();
     });}
    // furniture tagger — BOTH lanes short junk shapes, never headings/apparatus
    const JUNK=/^(?:[A-Za-z]{1,2}\s?\d{0,2}|[¶*†‡§)(\[\]|]+\s*\d*|[ivxlc]{1,4}\s?\d?)$/;
    // RUN-IN LABEL GUARD (owner 2026-08-10, Capreolus/Decas II/Meisner class): a display
    // heading that sits MID-SENTENCE in the flow (prev row ends unterminated, or next row
    // begins lowercase) is the print's run-in label mis-promoted — render it quiet & inline.
    secs.forEach(sec=>{
      const rows=[...sec.querySelectorAll(".row")].filter(r=>!r.classList.contains("rapp"));
      rows.forEach((r,ix)=>{
        if(!r.classList.contains("rhead"))return;
        const txt=n=>{if(!n)return"";const c=n.querySelector(".en")||n.querySelector(".la");return c?c.textContent.trim():"";};
        const pv=txt(rows[ix-1]),nx=txt(rows[ix+1]);
        const midPrev=pv&&/[a-zà-öø-ÿ0-9,;:—–-]$/.test(pv);
        const midNext=nx&&/^[a-zà-öø-ÿ]/.test(nx);
        if(midPrev&&midNext)r.classList.add("runin");
        // BARE ENUMERATOR (owner 2026-08-28, Le Blanc p25 'XVIII.'/'XIX.'): a head whose ENTIRE
        // text is a numeral is not a heading at all — it is the print's section number, set run-in
        // at the head of its paragraph. 252,401 of these across 932 works were rendering as
        // full display headings, breaking the flow every few paragraphs. The mid-sentence test
        // above can't catch them: they sit between a finished sentence and a capital letter.
        const ht=(txt(r)||r.textContent||"").trim();
        if(/^(?:[IVXLCDM]{1,8}|\d{1,4})\.?$/i.test(ht)&&ht.length<=9)r.classList.add("runin","numlab");
      });
    });
    // APPARATUS IN THE MARGIN (owner 2026-08-28, Leibniz p83 'disastrous'): the Akademie ingest
    // put the collation apparatus into place="margin" notes -- 'mot (1) pour faire (a) tant les
    // (b) voir (2)' -- which the reader floats into the right margin as a narrow column of
    // fragments, while the English lane banks the same lines as foot notes ('20 mot (1) pour
    // faire ...'). Two rules, display only, TEI untouched: (1) a margin note the bank already
    // holds (the bank line contains it) is an echo -- drop it; (2) a margin note written in the
    // collation grammar ((1)(2) drafts, (a)(b) readings, erg./gestr., a trailing L/K siglum) is
    // apparatus, not a marginal gloss -- move it into the folio's variant bank as a row.
    const COLL=/\(\d\)|\([a-z]\)\s|\berg\.|\bgestr\.|\bstreicht\b|〈|〉|\s[LKl]\s*$/;
    secs.forEach(sec=>{
      const bankCells=[...sec.querySelectorAll(".row.rapp .la,.row.rapp .en")]
        .map(x=>x.textContent.toLowerCase().replace(/[^a-z0-9]/g,"")).filter(t=>t.length>8);
      const bankTok=[...sec.querySelectorAll(".row.rapp .la,.row.rapp .en")].map(x=>new Set((x.textContent.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/(\w)-\s+(\w)/g,"$1$2").match(/[a-z0-9]{4,}/g)||[]))).filter(s=>s.size>=8);
      const legend=[...sec.querySelectorAll(".appdiv")].find(d=>/textual variants/.test(d.textContent));
      const lastVar=[...sec.querySelectorAll(".row.rapp.var")].pop();
      sec.querySelectorAll(".mnp>.mnote").forEach(m=>{
        const raw=m.textContent.trim(),t=raw.toLowerCase().replace(/[^a-z0-9]/g,"");
        const _tk=raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/(\w)-\s+(\w)/g,"$1$2").match(/[a-z0-9]{4,}/g)||[];
        const _echo=(t.length>8&&bankCells.some(b=>b.includes(t)))||(_tk.length>=8&&bankTok.some(bt=>_tk.filter(w=>bt.has(w)).length>=0.8*_tk.length));
        if(_echo){const host=m.parentElement;m.remove();if(!host.querySelector(".mnote"))host.remove();return;}
        if(COLL.test(raw)&&(legend||lastVar)){
          const r=document.createElement("div");r.className="row rapp var conly solola moved";
          r.innerHTML=`<div class="la" lang="la">${m.innerHTML}</div><div class="en" lang="en"></div>`;
          const after=[...sec.querySelectorAll(".row.rapp.var")].pop()||legend;
          after.insertAdjacentElement("afterend",r);m.parentElement.remove();
        }
      });
      sec.querySelectorAll(".row").forEach(r=>{                 // a row emptied of everything but its apparatus
        const la=r.querySelector(".la"),en=r.querySelector(".en");
        if(!r.classList.contains("rhead")&&!r.classList.contains("rapp")&&la&&en&&!la.textContent.trim()&&!en.textContent.trim())r.remove();
      });
    });
    // EDITORIAL HEADNOTE (owner 2026-08-28, Leibniz p83): the Akademie's transmission / dating /
    // bibliography block ('Konzept: LH IV 8, Bl. 68 ...', '[Points for dating:] ...', 'BODEMANN,
    // Die Leibniz-Handschriften ...') was ingested as place="margin" notes, so the reader floats
    // a paragraph of prose into a 9.5rem margin column. A printed marginal gloss is a few words
    // ('Obj. 1', a Scripture reference); anything this long is a headnote and belongs in the flow,
    // set small and full-width under the title as the edition prints it. Display only.
    // (owner 2026-09-02, Scheibler/Billuart: a translator-merged margin note became a full-width block that split
    // the page) — only Akademie works / typed headnotes get the in-flow block; everywhere else a long gloss stays
    // in the rail, clamped to a few lines with a click to open
    const _akadWork=/gottfried-wilhelm-leibniz/.test(String((window.DATA&&DATA.slug)||new URLSearchParams(location.search).get("w")||""));
    secs.forEach(sec=>sec.querySelectorAll(".mnp>.mnote").forEach(m=>{
      const L=m.textContent.trim().length;
      if(L>80&&(_akadWork||m.classList.contains("headnote")))m.parentElement.classList.add("edblock");
      else if(L>220)m.classList.add("mnlong");
    }));
    // consecutive margin notes (a printed gloss column, or OCR line-edge shreds) collapse into ONE compact group
    secs.forEach(sec=>sec.querySelectorAll(".row>.la,.row>.en").forEach(cell=>{
      const kids=[...cell.children];let run=[];
      const flush=()=>{if(run.length>=2){const host=run[0];run.slice(1).forEach(p=>{[...p.querySelectorAll(":scope>.mnote")].forEach(n=>host.appendChild(n));p.remove();});host.classList.add("mngroup");if(run.length>=6)host.classList.add("mndense");}run=[];};
      kids.forEach(k=>{if(k.classList.contains("mnp")&&!k.classList.contains("edblock"))run.push(k);else flush();});flush();
    }));
    // same rule for a note that sits INLINE at the head of its paragraph (Akademie headnote,
    // <note type="headnote"> inside <p>): a paragraph-long note is a block, not a marginal gloss
    secs.forEach(sec=>sec.querySelectorAll(".row p>span.mnote").forEach(m=>{
      const L=m.textContent.trim().length;
      if(m.classList.contains("headnote")||(L>80&&_akadWork))m.classList.add("edinl");
      else if(L>220)m.classList.add("mnlong");            // ordinary long gloss: stays a floated aside, clamped, click opens
    }));
    // HEAD ECHO IN THE BODY (owner 2026-08-28, Leibniz p83): the paragraph under a piece title
    // opens by repeating the running head, the folio code and the title itself -- 'on the number
    // of possible truths or falsehoods 110000 1100. PROVISIONAL WORKING TITLE: ON THE NUMBER ...'
    // -- before the real text begins. The existing echo rule above drops a whole ROW that repeats
    // its head; this hides the echo when it is only the PREFIX of the paragraph. The text stays in
    // the DOM (search, copy and the source lane are untouched); only its display is suppressed.
    const _f=t=>String(t||"").toLowerCase().replace(/[^a-z0-9]/g,"");
    secs.forEach(sec=>{
      const rows=[...sec.querySelectorAll(".row")];
      rows.forEach((r,ix)=>{
        if(!r.classList.contains("rhead"))return;
        const nx=rows[ix+1];if(!nx||nx.classList.contains("rhead")||nx.classList.contains("rapp"))return;
        [["en",".hen"],["la",".hla"]].forEach(([lane,hsel])=>{
          const h=r.querySelector(hsel),cell=nx.querySelector("."+lane),para=cell&&cell.querySelector("p");
          if(!h||!para)return;
          const hf=_f(h.textContent);if(hf.length<12)return;
          const pf=_f(para.textContent);const at=pf.indexOf(hf);
          if(at<0||at>240)return;                        // echo must sit at the very opening
          const endF=at+hf.length;
          // walk text nodes to the DOM position where the folded prefix reaches endF
          const tw=document.createTreeWalker(para,NodeFilter.SHOW_TEXT);let acc=0,node,off=null;
          while((node=tw.nextNode())){const t=node.nodeValue;
            for(let i=0;i<t.length;i++){if(/[a-z0-9]/i.test(t[i]))acc++;if(acc===endF){off=[node,i+1];break;}}
            if(off)break;}
          if(!off)return;
          const rg=document.createRange();rg.setStart(para,0);rg.setEnd(off[0],off[1]);
          const frag=rg.extractContents();const sp=document.createElement("span");sp.className="rhecho";sp.appendChild(frag);
          para.insertBefore(sp,para.firstChild);
          // swallow the punctuation/space left dangling after the echo
          const nt=sp.nextSibling;if(nt&&nt.nodeType===3)nt.nodeValue=nt.nodeValue.replace(/^[\s:.\-–—]+/,"");
        });
      });
    });
    // DENSE REGISTER (owner 2026-08-28, Leibniz 'unreadable' pp15-21): an abbreviation table or
    // sigla list ingested as one <p> per line gets full paragraph rhythm -- a screen of two-word
    // rows separated by blank space. When a folio is mostly such rows, set it like a table:
    // no paragraph gap, tighter leading. Display only; nothing in the text changes.
    secs.forEach(sec=>{
      const rows=[...sec.querySelectorAll(".row:not(.rhead):not(.rtoc):not(.rapp):not(.furn)")];
      if(rows.length<8)return;
      const short=rows.filter(r=>{const a=(r.querySelector(".la")||{}).textContent||"",b=(r.querySelector(".en")||{}).textContent||"";
        return a.trim().length<=90&&b.trim().length<=90;}).length;
      if(short>=rows.length*0.75)sec.classList.add("dense");
    });
    secs.forEach(sec=>sec.querySelectorAll(".row:not(.rhead):not(.rtoc):not(.rapp)").forEach(r=>{
      const la=(r.querySelector(".la")||{}).textContent||"",en=(r.querySelector(".en")||{}).textContent||"";
      const t1=la.trim(),t2=en.trim();
      if((t1||t2)&&(t1.length<=6&&t2.length<=6)&&(!t1||JUNK.test(t1))&&(!t2||JUNK.test(t2)))r.classList.add("furn");
    }));
    // cross-page run continuation
    let prev=null;
    for(const cur of secs){
      if(!prev){prev=cur;continue;}
      if(cur.classList.contains("frontmatter")!==prev.classList.contains("frontmatter")){prev=cur;continue;}
      const kidsP=[...prev.children].filter(x=>!x.classList.contains("apptog")&&!x.classList.contains("rapp"));
      const kidsC=[...cur.children].filter(x=>!x.classList.contains("ixchip"));
      const pw=kidsP[kidsP.length-1],cw=kidsC[0];
      if(!pw||!cw||!pw.classList.contains("stkwrap")||!cw.classList.contains("stkwrap")){prev=cur;continue;}
      const mk=cls=>{const s=document.createElement("span");s.className="pganchor "+cls;
        s.dataset.idx=cur.dataset.idx;s.dataset.page=cur.dataset.page;
        s.textContent="p. "+cur.dataset.page;s.title="page "+cur.dataset.page;return s;};
      const [pl,pe]=pw.children,[cl,ce]=cw.children;
      if(!pl||!pe||!cl||!ce){prev=cur;continue;}
      pl.appendChild(mk("an-la"));while(cl.firstChild)pl.appendChild(cl.firstChild);
      pe.appendChild(mk("an-en"));while(ce.firstChild)pe.appendChild(ce.firstChild);
      cw.remove();
      // if the page had nothing but that run, the run rolls on — keep merging into the same host;
      // the emptied folio must drop its content-visibility placeholder or it leaves a phantom gap
      if(![...cur.children].some(x=>x.classList.contains("stkwrap")||x.classList.contains("row"))){
        cur.classList.add("rolled");continue;}
      prev=cur;
    }
    // ROW-path seam merge (owner 2026-08-10 "smooth this out"): a sentence split across the
    // leaf on ORDINARY rows carries .tail/.cont marks — merge the continuation's cells into
    // the tail row with an inline page anchor, same treatment the stacked runs get.
    prev=null;
    for(const cur of R.querySelectorAll(".folio")){
      if(!prev){prev=cur;continue;}
      const pk=[...prev.children].filter(x=>!x.classList.contains("apptog")&&!x.classList.contains("rapp"));
      const pr=pk[pk.length-1],cr=[...cur.children].find(x=>!x.classList.contains("ixchip"));
      if(pr&&cr&&pr.classList.contains("row")&&pr.classList.contains("tail")
         &&cr.classList.contains("row")&&cr.classList.contains("cont")
         &&!pr.classList.contains("furn")&&!cr.classList.contains("furn")   // Grotius Rom. p.5→6 (owner 2026-09-04): a signature-mark row ('A 3') tagged .furn swallowed the next page's opening paragraph — hidden in Flow, dimmed as "print furniture" in page view
         &&!cr.classList.contains("rhead")&&!pr.classList.contains("rhead")
         &&!pr.querySelector(".sp")&&!cr.querySelector(".sp")){
        const mk=cls=>{const s=document.createElement("span");s.className="pganchor "+cls;
          s.dataset.idx=cur.dataset.idx;s.dataset.page=cur.dataset.page;s.textContent="p. "+cur.dataset.page;return s;};
        ["la","en"].forEach(ln=>{
          const a=pr.querySelector("."+ln),b=cr.querySelector("."+ln);
          if(a&&b){
            // print split a word across the leaf ('antece-' | 'dent'): butt-join without the hyphen
            const lp=a.querySelector("p:last-of-type"),fp=b.querySelector("p:first-of-type");
            if(lp&&fp&&/-\s*$/.test(lp.textContent)&&/^[a-zà-ÿ]/.test(fp.textContent)){
              lp.innerHTML=lp.innerHTML.replace(/-\s*$/,"");
              a.appendChild(mk(ln==="en"?"an-en":"an-la"));
              lp.innerHTML+=fp.innerHTML;fp.remove();
            } else a.appendChild(mk(ln==="en"?"an-en":"an-la"));
            while(b.firstChild)a.appendChild(b.firstChild);
          }
        });
        cr.remove();
        if(![...cur.children].some(x=>x.classList.contains("stkwrap")||x.classList.contains("row")))
          cur.classList.add("rolled");
        else prev=cur;
        continue;
      }
      prev=cur;
    }
    // POST-MERGE HYGIENE (owner 2026-09-04, Grotius Rom. pp.4–6): (a) a .furn tag is only valid on a row
    // that is STILL nothing but furniture — a row that gained real text in the seam merges above is a
    // body row again; (b) a folio whose whole content rolled into the previous page's run has no page of
    // its own to head — its "pg. N" chip would stack on the next page's chip (the inline p. N anchor at
    // the true seam already names the page for scan-sync and citations), so the chip is hidden.
    R.querySelectorAll(".row.furn").forEach(r=>{const t=((r.querySelector(".la")||{}).textContent||"")+" "+((r.querySelector(".en")||{}).textContent||"");if(t.replace(/p\.\s*\d+/g,"").trim().length>12)r.classList.remove("furn");});
    R.querySelectorAll(".folio.rolled").forEach(f=>{const m=f.previousElementSibling;if(m&&m.classList&&m.classList.contains("fmark"))m.classList.add("rolled");});
    // a BLANK leaf (title verso, blank page: no rows at all) has nothing to head either — its chip would stack on the next page's (owner 2026-09-04)
    R.querySelectorAll(".folio:not(.titlepage)").forEach(f=>{if(f.querySelector(".row,.stkwrap"))return;const m=f.previousElementSibling;if(m&&m.classList&&m.classList.contains("fmark"))m.classList.add("rolled");});
    // RUNNING-HEAD ECHO HEADS (owner 2026-09-04, Urraburu Psych. II p.13 "DISPUTATIO PRIMA." printed as the leaf's
    // running head AND as the display head): within one folio, a head row whose Latin (or English) repeats the
    // text of a head row earlier in the same consecutive run of heads is the echo — hide it, keep the first.
    R.querySelectorAll(".folio").forEach(f=>{let run=[];const flush=()=>{const seen=new Set();run.forEach(h=>{const k=((h.querySelector(".hla")||h.querySelector(".hen")||{}).textContent||"").toLowerCase().replace(/[^a-z0-9]+/g,"");if(!k)return;if(seen.has(k))h.classList.add("rhecho");else seen.add(k);});run=[];};
      [...f.children].forEach(k=>{if(k.classList.contains("rhead"))run.push(k);else if(k.classList.contains("row"))flush();});flush();});
    // REHAUL P2 (2026-08-17): margin-note rail tagging — runs LAST in this pass, after the
    // cross-page/cross-row seam merges above have finished moving DOM between rows, so a .mnp
    // that migrated into a merged tail row is still correctly found. Purely additive: tags the
    // lane cell (.la/.en) that DIRECTLY holds a margin-note paragraph with .hasmn so the CSS at
    // ≥1250px (the file's existing, previously-inert `.en .mnote,.la .mnote{position:relative}`
    // hook) can promote it into an outer-margin rail — no DOM reparenting, teiCell's emitted
    // markup (<p class="mnp"><span class="mnote">) is untouched, only how it's later targeted.
    // Gated on the cell literally containing a .mnp child, so a page with no margin notes is a
    // no-op scan and every other page renders byte-identical to before this patch.
    R.querySelectorAll(".row > .la, .row > .en").forEach(cell=>{
      cell.classList.toggle("hasmn",!!cell.querySelector(":scope > .mnp"));
    });
  }catch(e){}};
  // phone parallel zip: interleave each stacked run's Latin/English columns into per-paragraph
  // pairs (called from applyLanes when both lanes are on at <=880px; anchors stay in sequence)
  window.__frZipStacks=()=>{try{
    R.querySelectorAll(".stkwrap:not(.zipped)").forEach(w=>{
      const [c1,c2]=w.children;if(!c1||!c2)return;
      const A=[...c1.children],B=[...c2.children];
      const zip=document.createElement("div");zip.className="zipcol";
      const N=Math.max(A.length,B.length);
      for(let i=0;i<N;i++){
        if(A[i])zip.appendChild(A[i]);
        if(B[i])zip.appendChild(B[i]);
      }
      w.appendChild(zip);w.classList.add("zipped");
    });
  }catch(e){}};
  // PROGRESSIVE RENDER: first screenful synchronously (instant paint), the rest in rAF chunks so the
  // main thread never freezes — turns a 3,000-folio work from a multi-second lock into immediate reading.
  window.__readerBuilt=false;
  const pages=DATA.pages, FIRST=Math.min(pages.length,50);
  const RENDER=(p,i)=>(TEI_ON?renderFolioTEI:renderFolio)(p,i);
  // ── WINDOWED RENDERING (owner 2026-08-20, Suárez vol 16 = 5,210 rows built up front) ──
  // Big works mount a light PLACEHOLDER per folio and hydrate it only as it nears the
  // viewport. content-visibility already skipped PAINT for off-screen folios; this skips
  // DOM CREATION too, which is what actually cost seconds. Hydrated folios are never
  // unmounted (nothing that scans #reading can lose ground it already had), and
  // __ensureAllFolios() force-hydrates everything for search / export / print / restore.
  const WINDOWED = pages.length >= 400;
  if(WINDOWED){
    // PLACEHOLDER HEIGHT MUST FOLLOW THE TEXT (owner 2026-08-20: Arriaga "fails on
    // mobile"). A flat 760px guess over a work of 3,130 SHORT source-pages built a
    // 2.4-MILLION-pixel scroll column: on a phone that is an unusable scroller and a
    // compositing load, and the reader looked broken. Estimate each folio from its own
    // character mass at the current column width, clamped so a stub still has a target
    // and a giant folio does not blow the column back up. Hydration corrects it anyway.
    const _cw = Math.max(280, (R.clientWidth || 640));
    const _cpl = Math.max(26, _cw / 9.2);            // characters per rendered line
    const _lh = 30;                                  // line box, px
    const _chars = (p)=>{ if(!p)return 0;
      let n = (p.la ? p.la.length : 0) + (p.en ? p.en.length : 0);
      // a TEI work carries no text on DATA.pages — its mass lives in TEI_PAGES, keyed by
      // the same normalised page key the renderer uses
      if(!n && TEI_ON && typeof TEI_PAGES !== 'undefined' && typeof teiNorm === 'function'){
        try{ const k = teiNorm(p.n);
          const one = (side)=>(TEI_PAGES[side] && TEI_PAGES[side][k] || [])
            .reduce((s,e)=>s + ((e.textContent||'').length), 0);
          n = one('la') + one('en');
        }catch(e){}
      }
      return n; };
    const _est = (p)=>{ const n=_chars(p);
      if(!n) return 420;                             // unknown: a modest, honest guess
      return Math.max(90, Math.min(1600, Math.round((n / _cpl) * _lh) + 60)); };
    const PH_H = 760;                       // intrinsic guess; corrected on hydration
    const phs = new Array(pages.length);
    const hydrated = new Array(pages.length).fill(false);
    const hydrate = (i)=>{
      if(i<0||i>=pages.length||hydrated[i])return;
      hydrated[i]=true;
      const ph = phs[i]; if(!ph||!ph.isConnected)return;
      const mark = R.childNodes.length;
      try{ RENDER(pages[i], i); }catch(e){ console.warn('[window] folio',i,e); }
      const added = [...R.childNodes].slice(mark);   // renderFolio* appends to R
      added.forEach(n=>R.insertBefore(n, ph));
      ph.remove(); phs[i]=null;
      const sec = added.find(n=>n.classList&&n.classList.contains('folio'));
      if(window.__afterHydrate)window.__afterHydrate(sec||null);
    };
    window.__hydrateFolio = hydrate;
    const phIO = new IntersectionObserver(es=>{
      es.forEach(e=>{ if(!e.isIntersecting)return;
        const i = +e.target.dataset.i;
        phIO.unobserve(e.target);
        hydrate(i-1); hydrate(i); hydrate(i+1);   // neighbours too: scrolling never hits a gap
      });
    },{root:sc, rootMargin:'1800px 0px 2400px 0px'});
    for(let i=0;i<pages.length;i++){
      const ph=document.createElement('div');
      ph.className='fph'; ph.dataset.i=String(i); ph.style.height=_est(pages[i])+'px';
      R.appendChild(ph); phs[i]=ph; phIO.observe(ph);
    }
    // SCROLL FALLBACK (owner 2026-08-20: Arriaga "fails on mobile"). On a 3,130-section
    // work the IntersectionObserver was not delivering — the reader scrolled through
    // thousands of placeholders and hydrated nothing, so the work looked empty past its
    // first folios. Never let the observer be the only path: on every scroll, hydrate the
    // placeholders that are actually near the viewport. Document order lets the scan stop
    // as soon as it is past them, so this stays cheap on the longest work in the corpus.
    let _phTick=0;
    const scanNear=()=>{
      const vh=window.innerHeight||800;
      let started=false;
      for(let i=0;i<phs.length;i++){
        const ph=phs[i];
        if(!ph||!ph.isConnected)continue;
        const r=ph.getBoundingClientRect();
        if(r.top>3*vh){ if(started)break; else continue; }
        if(r.bottom< -2*vh)continue;
        started=true;
        hydrate(i-1);hydrate(i);hydrate(i+1);
      }
    };
    const onScroll=()=>{ if(_phTick)return;
      _phTick=setTimeout(()=>{_phTick=0;scanNear();},160); };
    (sc||window).addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('resize',onScroll,{passive:true});
    setTimeout(scanNear,400);
    // first screenful + EVERY deep-link target, immediately (owner 2026-08-20: a cited link
    // landed on page 1 and only later jumped — the target folio was still a placeholder, so
    // the anchor did not exist for the browser OR for __frBlockLand's first ticks).
    for(let i=0;i<FIRST;i++)hydrate(i);
    const _hashPg=frReaderBlockReference(location.hash)?.page;
    const _qp=new URLSearchParams(location.search).get("p");
    [window.__frTgt,_hashPg,_qp].forEach(v=>{
      if(v==null||v==="")return;
      const k=pages.findIndex(p=>String(p.n)===String(v));
      if(k>=0)for(let j=Math.max(0,k-2);j<=Math.min(pages.length-1,k+2);j++)hydrate(j);
    });
    window.__ensureAllFolios = ()=>{ for(let i=0;i<pages.length;i++)hydrate(i);
      try{readingEditionPass();}catch(e){} return true; };
    // hydrate by PAGE NUMBER (TOC clicks, jump(), deep links all speak page numbers)
    window.__ensurePage = (n)=>{
      const k = pages.findIndex(p=>String(p.n)===String(n));
      if(k<0) return false;
      for(let j=Math.max(0,k-1);j<=Math.min(pages.length-1,k+1);j++)hydrate(j);
      return true; };
    if(window.__mkGrip)window.__mkGrip();
    setFolio((TP&&pages.find(p=>p.n>=TP))||pages[0]);
    readingEditionPass();window.__readerBuilt=true;buildNav();
    if(window._afterBuild)window._afterBuild();
    return;
  }
  window.__ensureAllFolios = ()=>true;      // small works are fully built already
  window.__ensurePage = ()=>true;
  for(let i=0;i<FIRST;i++)RENDER(pages[i],i);
  if(window.__mkGrip)window.__mkGrip();                          // re-attach the column-split grip (R was wiped)
  setFolio((TP&&pages.find(p=>p.n>=TP))||pages[0]);              // open on the title page, not the front matter
  let _i=FIRST;
  // rAF pauses in background tabs, stranding big works at ~140 folios (2026-07-20) — fall back to
  // setTimeout when hidden so the column keeps building even while the reader isn't looking.
  const _sched=cb=>{if(document.hidden)setTimeout(cb,200);else requestAnimationFrame(cb);};
  (function chunk(){const end=Math.min(pages.length,_i+90);for(;_i<end;_i++)(TEI_ON?renderFolioTEI:renderFolio)(pages[_i],_i);   // TEI PATH (2026-08-10)
    if(_i<pages.length){_sched(chunk);} else {readingEditionPass();window.__readerBuilt=true;buildNav();if(window._afterBuild)window._afterBuild();}})();
  if(pages.length<=FIRST){readingEditionPass();window.__readerBuilt=true;buildNav();if(window._afterBuild)window._afterBuild();}
  // rebuild a single folio's rows in place (used by the owner inline editor for optimistic update)
  window.__rebuildFolio=function(n){if(typeof TEI_ON!=="undefined"&&TEI_ON){console.warn("[__rebuildFolio] TEI-rendered work — md rebuild skipped (Reader Map #1)");return;}
    const pg=DATA.pages.find(p=>p.n===n),sec=R.querySelector(`.folio[data-page="${n}"]`);if(!pg||!sec)return;
    sec.innerHTML="";const SL=splitApp(pg.la),SE=splitApp(pg.en);
    let _lb=blocks(SL.main),_eb=blocks(SE.main);if(DATA&&DATA.has_pages===false){const _s=symLanes(_lb,_eb);_lb=_s[0];_eb=_s[1];}
    const r=buildRows(_lb,_eb,false);r.nodes.forEach(nd=>sec.appendChild(nd));
    let bi=0;sec.querySelectorAll(".row").forEach(rw=>{if(!rw.classList.contains("rhead")&&!rw.classList.contains("rtoc")&&!rw.classList.contains("rapp"))rw.id="b"+n+"-"+(bi++);});
    const ab=appBank(SL.notes,SE.notes);if(ab)sec.appendChild(ab);};
  // navigator built AFTER the reading column (sidebar is collapsed by default, so this is never on the
  // critical path); TEI contents for born-digital, page-scan filmstrip for scanned.
  function buildNav(){
    // TEI-DERIVED OUTLINE (2026-08-13): fleet facsimile works have no authored structure,
    // but their TEI carries section heads — synthesize the contents tree from the EN lane
    // (fallback LA) so CONTENTS is an outline, not a bare page filmstrip.
    if((!DATA.structure||!DATA.structure.length)&&!STRUCT){
      try{
        const syn=[];
        document.querySelectorAll("section.folio").forEach(sec=>{
          const pg=sec.dataset.page??DATA.pages?.[Number(sec.dataset.idx)]?.n;if(pg==null)return;
          let hs=sec.querySelectorAll(".en h3,.en h4,.stk-en h3,.stk-en h4");
          if(!hs.length)hs=sec.querySelectorAll(".la h3,.la h4,.stk-la h3,.stk-la h4");
          hs.forEach(h=>{
            const t=(h.textContent||"").trim().replace(/\s+/g," ");
            if(t.length<3||t.length>160)return;
            syn.push({depth:h.tagName==="H4"?2:1,page:pg,title:t});
          });
        });
        if(syn.length>=3){DATA.structure=syn;STRUCT=true;}
      }catch(e){}
    }
    const nav=$("#nav");window.FRReaderContents?.capture(nav);nav.innerHTML="";
    // NEVER A DEAD END ON A PHONE (owner 2026-08-31 "when I'm in a confession I can't get
    // out"): the brand home link is hidden on small screens, so the contents sheet opens
    // with the ways OUT — home, and the section this work belongs to. Library-tab work
    // switching stays one tab over.
    if(document.documentElement.classList.contains("g-mobile")){
      const esc2=x=>String(x).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
      const home=el("div","nav-home");
      home.style.cssText="display:flex;gap:.4rem;flex-wrap:wrap;padding:.15rem 0 .5rem;border-bottom:1px solid var(--border);margin-bottom:.4rem";
      const mk=(href,label)=>`<a href="${href}" style="font:600 .78rem/1 var(--sans);color:var(--accent);text-decoration:none;border:1px solid var(--border);border-radius:999px;padding:.45rem .7rem">${label}</a>`;
      const conf=window.FRReaderNavigation?.isConfession(DATA)||/confessio|catechis|bekenntnis|helvetic|augsburg|westminster-confession|dennison/i.test((DATA.slug||"")+" "+(DATA.title||""));
      home.innerHTML=mk("/","\u2302 Library")+ (conf?mk("/#confessions","\u274d All confessions"):"")+mk("/the-faith-received/fathers/","Authors")+mk("/the-faith-received/bible/","Scripture");
      nav.appendChild(home);
    }
    // A facsimile work with an authoritative outline can be browsed two ways: the OUTLINE tree
    // or the PAGE-scan filmstrip. Offer a toggle; born-digital (no scans) is outline-only.
    const canPages=DATA.has_pages&&DATA.pages&&DATA.pages.length>0;
    {const vt=el("div","nav-vt");                                          // view tabs — Library is always offered
      const tab=(label,view)=>{const b=el("button",_navView===view?"on":"");b.textContent=label;b.onclick=()=>{_navView=view;buildNav();};vt.appendChild(b);};
      if(STRUCT)tab("Outline","outline");
      if(canPages)tab("Pages","pages");
      // REHAUL P6 (2026-08-17): fourth tab, shown only when this work actually has a true
      // back-of-book index (INDEX_PAGES, §2.2/P5) — same gate as P5's render dispatch, so the
      // tab and the content it opens always agree. Everything else in this tab strip/state
      // machine (_navView, the "on" class, buildNav() re-invocation on click) is untouched.
      if(INDEX_PAGES&&INDEX_PAGES.size)tab("Index","index");
      tab("Library","library");
      if(vt.children.length>1)nav.appendChild(vt);
    }
    if(_navView==="library"){renderLibrary(nav);return;}
    if(_navView==="index"&&INDEX_PAGES&&INDEX_PAGES.size){renderIndexNav(nav);return;}
    if(_navView==="outline"&&window.FRReaderNavigation?.isConfession(DATA)&&renderConfessionContents(nav))return;
    const showOutline=STRUCT&&_navView!=="pages";
    if(showOutline) renderOutline(nav);
    else renderPages(nav);
    // light ONLY the deepest node at-or-before the current page — `page<=cur` used to light every
    // top-level entry from the first to the current one (UX review 2026-07-13)
    if(cur){const _nodes=[...nav.querySelectorAll(".nav-node,.fol")];let _best=null;
      _nodes.forEach(f=>{const p=+f.dataset.page;
        if(p===cur)_best=f;else if(showOutline&&p<=cur&&(!_best||+_best.dataset.page<=p))_best=f;});
      _nodes.forEach(f=>f.classList.toggle("on",f===_best));}
  }
  // REHAUL P6 (2026-08-17): INDEX nav destination, sibling to renderOutline/renderPages/
  // renderLibrary (DESIGN.md §3.2). Lists each true-index page (usually just one — most works
  // have at most one back-of-book finding aid) by its kind-appropriate label; a click is a page
  // jump via the existing goNav(), same as every .nav-node in renderOutline. When a page's
  // ordering is genuinely alphabetic (the rare case — see ixOrdering()), the entry additionally
  // shows an A–Z chip rail: clicking a letter jumps to the page (goNav, unmodified) and then —
  // once the page's own .ixletter markers exist in the DOM — scrolls to the matching one. This
  // extra scroll-to-letter step is layered ON TOP of goNav rather than inside it, so goNav's own
  // poll-until-rendered contract (2560ish) stays exactly as every other nav destination uses it.
  function renderIndexNav(nav){
    const KIND_LABEL={quaestionum:"Index Quaestionum",errata:"Errata",citations:"Index of Citations",topical:"Index",alphabetic:"Index",contents:"Contents"};
    const box=el("div","nav-index");
    [...INDEX_PAGES.entries()].forEach(([page,kind])=>{
      const row=el("div","nav-node nd1 ixnavrow");
      row.dataset.page=page;
      row.innerHTML=`<span class="cv leaf">▾</span><span class="nn-t">${esc(KIND_LABEL[kind]||"Index")}</span>`;
      row.onclick=()=>goNav(+page,row);
      box.appendChild(row);
      if(kind==="alphabetic"){
        const rail=el("div","ixnav-az");
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(L=>{
          const chip=el("button","ixnav-chip");chip.type="button";chip.textContent=L;
          chip.onclick=ev=>{ev.stopPropagation();
            goNav(+page,row);
            // same plain-then-zero-padded data-page lookup the .pgo jump handler already uses
            // (readingEditionPass, ~3288) — INDEX_PAGES' key comes from teiNorm() (padding
            // stripped) while .folio's own data-page mirrors pg.n, which isn't always in the
            // same padded/unpadded form across works.
            let k=0;const iv=setInterval(()=>{
              const sec=document.querySelector(`.folio[data-page="${page}"]`)||document.querySelector(`.folio[data-page="${String(page).padStart(4,"0")}"]`);
              const hit=sec&&[...sec.querySelectorAll(".ixletter")].find(h=>h.textContent.trim()===L);
              if(hit){clearInterval(iv);hit.scrollIntoView({behavior:"smooth",block:"start"});}
              else if(++k>40)clearInterval(iv);
            },200);};
          rail.appendChild(chip);
        });
        box.appendChild(rail);
      }
    });
    nav.appendChild(box);
  }
  // LIBRARY: browse every work in the corpus without leaving the reader — a filterable
  // author-sorted list in the drawer; the open work is marked. Index cached across views.
  function renderLibrary(nav){
    const box=el("div","nav-lib");
    box.innerHTML='<input class="nl-q" placeholder="Filter by title or author…" autocomplete=off spellcheck=false><div class="nl-list"><div class="nl-msg">Loading the library…</div></div>';
    nav.appendChild(box);
    const list=box.querySelector(".nl-list"),inp=box.querySelector(".nl-q");
    const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");  // Suárez matches "suarez"
    const paint=(ws,f)=>{
      const t=norm(f).trim();
      const m=t?ws.filter(w=>(w._q||(w._q=norm((w.title||"")+" "+(w.author||"")+" "+(w.title_en||"")))).includes(t)):ws;
      // organized by AUTHOR, groups COLLAPSED by default (click to expand; filtering expands matches).
      // Titles show the ENGLISH title when available (user 2026-07-20).
      let h="",lastA=null;
      m.slice(0,900).forEach(w=>{
        const a=w._confession?"Confessions":w.author||"No named author";
        if(a!==lastA){h+='<div class="nl-au'+(t?" open":"")+'" data-au="'+esc(a)+'"><span class="nl-cv">▸</span>'+esc(a)+'</div>';lastA=a;}
        h+='<a class="nl-w'+(DATA&&w.slug===DATA.slug?" here":"")+'" href="/the-faith-received/read/?w='+encodeURIComponent(w.slug)+'">'
          +'<span class="nl-t">'+esc(w.title_en||w.title||w.slug)+(w.volume?' <span class="nl-v">· '+esc(String(w.volume))+'</span>':'')+'</span></a>';
      });
      list.innerHTML=h||'<div class="nl-msg">No matches.</div>';
      if(!t)list.classList.add("nl-collapsed");else list.classList.remove("nl-collapsed");
      list.querySelectorAll(".nl-au").forEach(g=>{g.onclick=()=>g.classList.toggle("open");});
      // keep the current work's author expanded
      if(DATA){let group=list.querySelector("a.here")?.previousElementSibling;while(group&&!group.classList.contains("nl-au"))group=group.previousElementSibling;if(group)group.classList.add("open");}
      if(m.length>900)list.insertAdjacentHTML("beforeend",'<div class="nl-msg">'+(m.length-900)+' more — narrow the filter</div>');
    };
    const go=ws=>{if(!box.isConnected)return;paint(ws,inp.value);inp.oninput=()=>paint(ws,inp.value);};
    const load=async()=>{
      list.innerHTML='<div class="nl-msg" role="status">Loading the library…</div>';
      try{
        if(window.__WORKSLIST){go(window.__WORKSLIST);return;}
        const v=window.__FR_VER?'?v='+window.__FR_VER:'';
        const [d,te,confs]=await Promise.all([
          fetch(BLOB+'/v1/works-index.json'+v,{signal:AbortSignal.timeout(25000)}).then(r=>{if(!r.ok)throw Error('Catalogue '+r.status);return r.json();}),
          fetch(BLOB+'/v1/titles_en.json'+v,{signal:AbortSignal.timeout(25000)}).then(r=>r.ok?r.json():{}).catch(()=>({})),
          fetch(BLOB+'/v1/confessions-index.json'+v,{signal:AbortSignal.timeout(25000)}).then(r=>{if(!r.ok)throw Error('Confessions '+r.status);return r.json();}).then(d=>Array.isArray(d.confessions)?d:null).catch(()=>null)
        ]);
        const ws=FRReaderNavigation.catalogue(d,te,confs?.confessions||[]);if(confs)window.__WORKSLIST=ws;go(ws);
        if(!confs&&box.isConnected){list.insertAdjacentHTML('afterbegin','<p class="nl-msg">The confession catalogue could not load. <button type="button" class="nl-retry">Retry loading</button></p>');list.querySelector('.nl-retry').onclick=load;}
      }catch(error){if(!box.isConnected)return;list.innerHTML='<div class="nl-msg" role="status">The library could not load. <button type="button" class="nl-retry">Retry loading</button> <a href="/the-faith-received/library/">Open library</a></div>';list.querySelector('.nl-retry').onclick=load;}
    };load();
  }
  // Confessions can carry chapter rubrics in the text that their brief metadata outline omits.
  // Navigate the existing elements directly; never alter text, rows, or source pagination.
  function renderConfessionContents(nav){
    const rows=FRReaderNavigation.contents($('#reading'));if(rows.length<2)return false;
    if(window.FRReaderContents){
      const depths=rows.map(row=>Math.max(1,row.depth||1)),parents=rows.map(()=>-1),children=rows.map(()=>false),stack=[];
      rows.forEach((row,i)=>{while(stack.length&&depths[stack[stack.length-1]]>=depths[i])stack.pop();if(stack.length){parents[i]=stack[stack.length-1];children[parents[i]]=true;}stack.push(i);});
      const views=rows.map((row,i)=>{
        const view=el('div','nav-node nd'+Math.min(depths[i],5));view.dataset.page=row.page;view.dataset.idx=i;view.title=row.title;view.style.paddingLeft=(.5+(Math.min(depths[i],6)-1)*.85)+'rem';view.style.setProperty('--nav-depth',Math.min(depths[i]-1,3));
        view.innerHTML=(children[i]?'<button type="button" class="cv" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>':'<span class="cv leaf" aria-hidden="true"></span>');
        const link=el('a','nn-t nav-open'),url=new URL(location.href);url.searchParams.delete('section');url.searchParams.delete('heading');if(row.page!=='')url.searchParams.set('p',row.page);url.hash=row.anchor;link.href=url.href;link.textContent=row.title;view.appendChild(link);
        link.onclick=e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();if(row.element.closest('.frontmatter'))app.classList.add('show-fm');
          history.replaceState(history.state,'',url);window.__frRestoreReaderPosition({page:row.page,id:row.anchor,title:row.title,anchor:true,choice:true,offset:null});_navClickT=performance.now();
          window.FRReaderContents.highlight(nav,i);if(innerWidth<1500)app.classList.add('nosb');};
        const caret=view.querySelector('button.cv');if(caret)caret.dataset.label=row.title;nav.appendChild(view);return view;
      });
      window.FRReaderContents.bind({nav,items:rows,rows:views,parents,children,depths,key:(DATA.slug||DATA.workspace)+':confession',onCurrent:()=>window.FRReaderContents.currentIndex(rows,DATA.pages,cur,window.__readerChoice)});
      return true;
    }
    const box=el('div','conf-contents');box.innerHTML='<label class="cc-label">Find a chapter or article<input type="search" class="cc-search" placeholder="Filter contents"></label><p class="cc-count" role="status"></p><div class="cc-list"></div>';
    nav.appendChild(box);const list=box.querySelector('.cc-list'),input=box.querySelector('input');
    const draw=()=>{
      const q=input.value.toLocaleLowerCase().trim(),hits=rows.filter(r=>!q||r.title.toLocaleLowerCase().includes(q));
      box.querySelector('.cc-count').textContent=hits.length+' contents entries';list.replaceChildren();
      for(const r of hits){const a=el('a','nav-node nd'+r.depth);a.href='#'+encodeURIComponent(r.anchor);a.dataset.page=r.page;a.innerHTML='<span class="nn-t">'+esc(r.title)+'</span>';
        a.onclick=e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();
          window.__frUserScrolled=true;_navClickT=performance.now();if(innerWidth<1500)app.classList.add('nosb');
          if(r.element.closest('.frontmatter'))app.classList.add('show-fm');
          const url=new URL(location.href);url.hash=r.anchor;history.replaceState(null,'',url);
          requestAnimationFrame(()=>{const target=r.element.isConnected?r.element:document.getElementById(r.anchor);if(target){target.scrollIntoView({block:'start'});target.tabIndex=-1;target.focus({preventScroll:true});}});
          list.querySelectorAll('.on').forEach(n=>n.classList.remove('on'));a.classList.add('on');};list.appendChild(a);
      }
      if(!hits.length)list.innerHTML='<p class="nl-msg">No headings match. Try another word.</p>';
    };input.oninput=draw;draw();return true;
  }

  // OUTLINE: a collapsible hierarchical tree of arbitrary depth (Book › Distinction › Question ›
  // Article › …). A node with deeper-depth successors gets a caret; collapsing hides its subtree.
  function renderOutline(nav){
    const S=readerDisplayOutline();
    // parent[i] = index of the nearest preceding node with smaller depth (its container)
    const dep=S.map(s=>Math.max(1,s.depth||1)), par=new Array(S.length).fill(-1), stack=[];
    // SIBLING-RANK HARMONIZATION (owner 2026-08-31, Westminster Annotations: Isaiah..Peter
    // stamped depth 1 while Genesis..Chronicles sit at depth 3 — same rank, mixed bolding).
    // Entries sharing the same two-word title stem in bulk are the same rank: snap the
    // group to its majority depth. Display-only; the stored outline is untouched.
    // THREE-word stems (2026-09-01 Baxter Methodus): two-word stems unified a PARENT
    // ("Part I — The Kingdom…") with its CHILDREN ("Part I. Chapter II…") and snapped the
    // Part heads under the Preface; word 3 ('the' vs 'chapter') separates the ranks while
    // Westminster's 66 "annotations on the" books still unify.
    {const stem=t=>String(t||"").toLowerCase().replace(/[^a-z ]/g," ").split(/\s+/).filter(Boolean).slice(0,3).join(" ");
     const g={};S.forEach((s2,i)=>{const k=stem(s2.title);if(k.length>3)(g[k]=g[k]||[]).push(i);});
     Object.values(g).forEach(ix=>{
       if(ix.length<6)return;
       const ds=ix.map(i=>dep[i]);if(new Set(ds).size<2)return;
       const cnt={};ds.forEach(d=>cnt[d]=(cnt[d]||0)+1);
       const maj=+Object.keys(cnt).sort((x,y)=>cnt[y]-cnt[x])[0];
       // NESTING GUARD (2026-09-02, Becanus Summa from its printed index): the same stem lives at
       // two TRUE depths ("Question 1" d3 under the prooemial Disputatio, d5 under Part›Treatise›
       // Chapter). Snapping the d3 group to the d5 majority put questions BELOW their own articles.
       // Snap only when the target depth still sits strictly between the node's container and
       // its first child (structure from the ORIGINAL depths); otherwise the node keeps its depth.
       ix.forEach(i=>{
         if(S[i].navDepthExact||dep[i]===maj)return;
         let pd=0;for(let j=i-1;j>=0;j--){if(S[j].depth<S[i].depth){pd=Math.max(1,S[j].depth||1);break;}}
         // first DEEPER entry inside the same container (siblings may separate a node from the
         // level its container's children live at): scan forward until the container is left
         let cd=Infinity;for(let j=i+1;j<S.length;j++){const dj=S[j].depth||1;if(dj<(S[i].depth||1))break;if(dj>(S[i].depth||1)){cd=Math.max(1,dj);break;}}
         if(maj>pd&&maj<cd)dep[i]=maj;
       });
     });}
    // DEPTH FLOOR (owner 2026-08-31, Westminster Annotations: "one part bold, other not"):
    // a work whose outline happens to start at depth 3 rendered with NO bold top level,
    // while its sister volume starting at depth 1 got bold books — normalize the floor so
    // the top level of every work is nd1 and weight is consistent corpus-wide.
    {const d0=dep.reduce((m,v)=>v<m?v:m,9);if(d0>1)for(let i=0;i<dep.length;i++)dep[i]=dep[i]-d0+1;}
    for(let i=0;i<S.length;i++){while(stack.length&&dep[stack[stack.length-1]]>=dep[i])stack.pop();
      par[i]=stack.length?stack[stack.length-1]:-1;stack.push(i);}
    const kids=S.map(()=>false);par.forEach(p=>{if(p>=0)kids[p]=true;});
    // default collapse: large trees open compact (top level only); small trees fully open
    const big=S.length>60;
    const collapsed=new Set();if(big)for(let i=0;i<S.length;i++)if(kids[i]&&dep[i]>=1)collapsed.add(i);
    const frag=document.createDocumentFragment();     // batch DOM writes: 1,900-entry trees were appended live one-by-one
    const rows=S.map((s,i)=>{
      const d=Math.min(dep[i],5);const a=el("div","nav-node nd"+d);a.dataset.page=s.page;a.dataset.idx=i;if(s.navSourcePath)a.dataset.sourcePath=s.navSourcePath;if(s.navSourceKey)a.dataset.sourceKey=s.navSourceKey;
      a.style.paddingLeft=(.5+(Math.min(dep[i],6)-1)*.85)+"rem";
      a.style.setProperty("--nav-depth",Math.min(dep[i]-1,3));
      let raw=deBracket(s.title||"");
      // DISPLAY CASE (2026-08-31): EEBO prints heads as caps runs — "ANNOTATIONS ON THE
      // PENTATEVCH…", "THE ARGUMENT." — ragged next to mixed-case siblings. Title-case
      // them for the outline DISPLAY only (the lane keeps the printed form; the data is
      // untouched). Roman numerals after a division word stay upper.
      const mi=raw.indexOf(" — ");
      // BILINGUAL SPLIT, not every dash (owner 2026-08-28, Gregory of Rimini): the AS convention
      // is "English — LATIN ECHO" where the echo is ALL-CAPS (see enHalf ~2791). A dash that
      // merely separates a rubric from its own text ("Question 1 — Whether the divine will …")
      // is NOT a language boundary: splitting it tore 28,512 outline titles across 600 works
      // into a bare rubric plus an orphan line. Split only when the tail is the caps echo.
      let en=raw,la="";
      if(mi>=0){const _b=raw.slice(mi+3),_l=_b.replace(/[^A-Za-z]/g,"");
        if(_l&&_l===_l.toUpperCase()){en=raw.slice(0,mi).trim();la=_b.trim();}}
      // DISPLAY CASE (2026-08-31, Westminster): caps runs title-cased for the outline ONLY —
      // AFTER the bilingual split (the caps echo IS the split's detection signal), English
      // half only, data untouched. Roman numerals stay upper; roman-lookalike words don't.
      if(!/[Ͱ-Ͽἀ-῿]/.test(en)){
        const SMALL=/^(OF|THE|AND|IN|ON|TO|A|AN|OR|FOR|BY|WITH|VPON|UPON|FROM|AT|AS)$/;
        const LOOKALIKE=/^(DID|DIM|MID|MIX|LID|ILL|MILL|MILD|CIVIL|LIVID|VIVID|DILL)$/;
        let first=true;
        en=en.replace(/[A-Za-z]{2,}/g,w=>{
          const isFirst=first;first=false;
          if(w!==w.toUpperCase())return w;                       // mixed already — printed that way
          if(/^[IVXLCDM]+$/.test(w)&&!LOOKALIKE.test(w))return w;// roman numeral stays upper
          if(SMALL.test(w)&&!isFirst)return w.toLowerCase();
          return w.charAt(0)+w.slice(1).toLowerCase();
        });
        en=en.replace(/\s*\.\s*$/,"");
      }
      const cv=kids[i]?`<button type="button" class="cv" aria-expanded="${!collapsed.has(i)}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>`:`<span class="cv leaf" aria-hidden="true"></span>`;
      a.title=s.navFullTitle||raw;a.innerHTML=cv+`<a class="nn-t nav-open" href="${esc(readerOutlineHref(s))}">${esc(en||raw)}</a>`+(la?`<span class="nn-la">${esc(la)}</span>`:"");
      const caret=a.querySelector(".cv");
      if(kids[i]){caret.dataset.label=en||raw;caret.onclick=(e)=>{e.stopPropagation();if(collapsed.has(i))collapsed.delete(i);else collapsed.add(i);refresh();};}
      a.onclick=e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();goNav(s.page,a);};
      frag.appendChild(a);return a;});
    nav.appendChild(frag);
    function refresh(){
      for(let i=0;i<rows.length;i++){
        rows[i].classList.toggle("collapsed",collapsed.has(i));
        const caret=rows[i].querySelector("button.cv");if(caret){caret.setAttribute("aria-expanded",String(!collapsed.has(i)));caret.setAttribute("aria-label",(collapsed.has(i)?"Expand ":"Collapse ")+caret.dataset.label);}
        // hidden if ANY ancestor is collapsed
        let p=par[i],hide=false;while(p>=0){if(collapsed.has(p)){hide=true;break;}p=par[p];}
        rows[i].classList.toggle("nd-hidden",hide);
      }
    }
    if(window.FRReaderContents){
      window.FRReaderContents.bind({nav,items:S,rows,parents:par,children:kids,depths:dep,key:DATA.slug||DATA.workspace||location.pathname,onCurrent:()=>window.FRReaderContents.currentIndex(S,DATA.pages,cur,window.__readerChoice)});
    }else refresh();
  }
  // PAGES: the page-scan filmstrip, grouped under the outline's top-level headings (collapsible).
  function renderPages(nav){
    if(FM_N){const ft=el("div","fmnav");ft.title="Show / hide the front matter";ft.innerHTML=`❧ Front matter (${FM_N})`;ft.onclick=()=>app.classList.toggle("show-fm");nav.appendChild(ft);}
    const sects=readerDisplayOutline().slice().filter(s=>(s.depth||1)<=1).sort((a,b)=>a.page-b.page);
    let si=0, curBody=nav;
    DATA.pages.forEach(pg=>{
      while(si<sects.length&&sects[si].page<=pg.n){
        const sc2=sects[si];const wrapper=el("div","nav-sec");const sc2t=deBracket(sc2.title);
        const h=el("div","nav-sech");h.innerHTML=`<span class="cv">▾</span>${esc(sc2t.length>52?sc2t.slice(0,52)+"…":sc2t)}`;
        h.title=sc2t;h.onclick=()=>wrapper.classList.toggle("closed");
        const body=el("div","nav-secb");wrapper.appendChild(h);wrapper.appendChild(body);nav.appendChild(wrapper);
        curBody=body;si++;
      }
      const a=el("div","fol"+(TP&&pg.n<TP?" frontmatter":""));a.dataset.page=pg.n;
      const w=(pg.en||"").replace(/[#*\[\]^]/g,"").trim().split(/\s+/).slice(0,10).join(" ");
      a.innerHTML=`${pg.thumb?`<img src="${pg.thumb}" loading="lazy" alt="">`:""}<div><div class="fn">fol. ${pg.n}</div><div class="fp">${esc(w)}…</div></div>`;a.onclick=()=>goNav(pg.n);curBody.appendChild(a);});
  }
}
// PAGE DENOMINATOR IN THE SAME UNIT AS THE INPUT (owner 2026-09-04 '191 / 70'): the
// jump box takes the PRINTED label (Migne column, folio number) — showing the folio
// COUNT beside it read as nonsense on column-numbered works. When the labels ascend,
// the denominator is the last printed label (how the edition itself is cited); the
// count remains in the tooltip.
function goReaderReference(pg){
 // An explicit choice supersedes the arrival/resume position, including late shard loads.
 rememberReaderChoice(pg.n);
 window.__frUserScrolled=true;window.__frTgt=pg.n;window.__folioLock=Date.now()+1600;
 const url=new URL(location.href);url.hash='b'+String(pg.n)+'-0';history.replaceState(null,'',url);
 jump(pg.n);setFolio(pg);
 setTimeout(()=>{if(window.__frTgt===pg.n&&window.__jumpSettle)window.__jumpSettle(pg.n);},900);
}
function syncReaderHeader(n){
 if(!DATA)return;
 const author=$("#reader-author"),volume=$("#reader-volume"),place=$("#reader-location");
 author.textContent=DATA.author||"";author.href="/?a="+encodeURIComponent(DATA.author||"");
 volume.textContent=String(DATA.volume||"").replace(/\b(P[LG]|PO)\s*(\d+)/g,"$1 $2");
 place.textContent=locOf(n);place.setAttribute('aria-label','Go to a place in this work, currently '+locOf(n));
 const column=/^P[LG]\s*\d/i.test(DATA.volume||""),unit=column?'column':DATA.has_pages?'page':'section';
 $("#pgJump").setAttribute('aria-label',unit[0].toUpperCase()+unit.slice(1)+' number');$("#pgJump").title='Go to '+unit;
 $("#reader-jump-label").textContent='Go to '+unit;
 if(!$("#aaPop").classList.contains('on'))$("#reader-jump").value=String(n);
 $("#pPrev").setAttribute('aria-label','Previous '+unit);$("#pNext").setAttribute('aria-label','Next '+unit);
 $("#pPrev").title='Previous '+unit;$("#pNext").title='Next '+unit;
 const source=window.__SRCNAME||'Latin',enOnly=app.classList.contains('en-only')||DATA?.src_lang==='en';
 app.style.setProperty('--source-label',JSON.stringify(source));
 $("#source-size-name").textContent=source;$("#source-size").hidden=enOnly;
 $("#source-size .lt").textContent=source==='Greek'?'Gr':source==='Latin'?'La':'Aa';
 $("#source-size label").title=source+' text size';
 $("#m-par").title='Show '+source+' text';$("#m-en").title='Show English translation';
}
function pgDenom(){const ns=(DATA&&DATA.pages||[]).map(x=>+x.n).filter(Number.isFinite);
  if(ns.length>1&&ns.every((v,i)=>i===0||v>=ns[i-1])&&ns[ns.length-1]!==ns.length)
    return {txt:String(ns[ns.length-1]),tip:(DATA.pages.length)+" pages, numbered to "+ns[ns.length-1]};
  return {txt:String(DATA&&DATA.pages?DATA.pages.length:0),tip:""};}
function setFolio(pg){if(!pg||cur===pg.n)return;cur=pg.n;syncReaderHeader(pg.n);try{if(window.__relFollow)window.__relFollow(pg.n);}catch(e){}{const pj=$("#pgJump");if(pj){if(document.activeElement!==pj)pj.value=pg.n;pj.min=DATA.pages[0].n;pj.max=DATA.pages[DATA.pages.length-1].n;}const pt=$("#pgTotal");if(pt){const _pd=pgDenom();pt.textContent="/ "+_pd.txt+(DATA.__loadRest?"+":"");pt.title=DATA.__loadRest?"Loading the rest of the volume…":_pd.tip;}}
  {const pl=$("#phLoc");if(pl){let _sv=SECMAP&&SECMAP[pg.n];
    if(!_sv&&SECMAP){const _ks=Object.keys(SECMAP).map(Number).filter(n2=>n2<=pg.n);if(_ks.length)_sv=SECMAP[Math.max(..._ks)];}
    const t=_sv?String(_sv).slice(0,90):"";
    if(pl.textContent!==t){pl.textContent=t;}
    if(!pl.onclick)pl.onclick=()=>{app.classList.remove("nosb");const n=$(".nav-node.on");if(n)n.scrollIntoView({block:"center"});};}}
  try{const lr=JSON.parse(lsGet("fr_lastread")||"{}");
    {const _q=new URLSearchParams(location.search);const _k=_q.get("ws")||_q.get("w")||DATA.slug||DATA.workspace;
     lr[_k]={page:pg.n,slug:DATA.slug||"",title:DATA.title||"",author:DATA.author||"",ts:Date.now()};
     if(lr["undefined"])delete lr["undefined"];}
    lsSet("fr_lastread",JSON.stringify(lr));
    if(window._frSyncLastread)window._frSyncLastread(lr);
    if(window._frSyncReading)window._frSyncReading();}catch(e){}
  if(DATA.has_pages){const f=$("#fimg");
    // SEGMENT-STACK scans (PO): a printed page arrives as ordered strip segments — stack
    // them where the single scan would sit; single-image works keep the classic path.
    let fs=$("#fimgs");
    if(pg.imgs&&pg.imgs.length){
      if(!fs){fs=document.createElement("div");fs.id="fimgs";f.parentElement.insertBefore(fs,f);}
      f.style.display="none";fs.style.display="block";
      const key=pg.imgs.join("|");
      if(fs.dataset.key!==key){fs.dataset.key=key;
        fs.innerHTML=pg.imgs.map(u=>`<img src="${esc(u)}" loading="eager" decoding="async" style="width:100%;display:block">`).join("");}
      // PAGE BY PAGE (owner 2026-08-28 "the scan is not broken up by page"): when the
      // sidecar knows this page's band inside the strip, show THAT page — the stack is
      // translated up by the band start inside a clipping window sized to the band. The
      // whole strip is still one image, so zoom and pan are unaffected.
      const band=pg.fband;
      if(band&&band[1]>band[0]){
        fs.style.overflow="hidden";fs.style.position="relative";
        const apply=()=>{const inner=fs.firstElementChild&&fs.firstElementChild.parentElement===fs?fs:null;
          const h=[...fs.querySelectorAll("img")].reduce((a,im)=>a+(im.naturalWidth?im.clientHeight:0),0);
          if(!h)return;
          const top=band[0]*h, hgt=Math.max(24,(band[1]-band[0])*h);
          [...fs.querySelectorAll("img")].forEach(im=>{im.style.marginTop="";});
          fs.style.height=hgt+"px";
          const first=fs.querySelector("img");
          if(first)first.style.marginTop=(-top)+"px";};
        setTimeout(apply,120);
        [...fs.querySelectorAll("img")].forEach(im=>{if(!im.complete)im.addEventListener("load",apply,{once:true});});
        const st0=fs.closest(".fstage");if(st0)setTimeout(()=>{try{st0.scrollTop=0;}catch(e){}},160);
      }else if(pg.fseek!=null){
        fs.style.overflow="";fs.style.height="";fs.style.position="";
        const fi=fs.querySelector("img");if(fi)fi.style.marginTop="";
        const st=fs.closest(".fstage");
        const doSeek=()=>{if(!st)return;const h=fs.scrollHeight;if(h>st.clientHeight+40)st.scrollTop=Math.max(0,pg.fseek*(h-st.clientHeight*0.25)-8);};
        setTimeout(doSeek,150);
        [...fs.querySelectorAll("img")].forEach(im=>{if(!im.complete)im.addEventListener("load",doSeek,{once:true});});}
    }else{
      if(fs)fs.style.display="none";f.style.display="";
      f.style.opacity=0;f.style.visibility="visible";f.setAttribute("fetchpriority","high");f.decoding="async";setTimeout(()=>{f.src=pg.img;f.style.opacity=1;},110);
    }
    $("#ffol").textContent=locOf(pg.n);
    if(window.__fscrubSync)window.__fscrubSync();{const c=$("#fhct");if(c)c.textContent=(DATA.pages.indexOf(pg)+1)+" of "+DATA.pages.length;}
    // SCAN PRELOAD (owner 2026-08-10 "the facsimile loads slow"): warm the next/prev page
    // scans while this one is viewed — a page turn then paints from cache instantly.
    {const ix=DATA.pages.indexOf(pg);clearTimeout(window.__frPre);
     window.__frPre=setTimeout(()=>{[1,-1,2].forEach(d=>{const q=DATA.pages[ix+d];
       if(q&&q.img){const im=new Image();im.decoding="async";im.src=q.img;}});},350);}
    // warm the neighbors: paging through scans is the reader's hottest loop — prefetching ±1
    // makes the next turn paint from cache instead of a fresh CDN round-trip (perf pass 2026-07-16)
    {const i=DATA.pages.indexOf(pg);[DATA.pages[i+1],DATA.pages[i-1]].forEach(q=>{if(q&&q.img)(new Image()).src=q.img;});}}
  if(performance.now()-_navClickT>800){const nav=$("#nav");let active=null;const outline=STRUCT&&_navView!=="pages";   // after a TOC click keep the clicked node lit; don't let the jump's own scroll re-pick a neighbour
  // Update the current branch without moving a contents list the reader is browsing.
  if(outline&&window.FRReaderContents){const items=window.FRReaderContents.itemsFor(nav)||readerDisplayOutline();window.FRReaderContents.highlight(nav,window.FRReaderContents.currentIndex(items,DATA.pages,pg.n,window.__readerChoice));}
  else{
    nav.querySelectorAll(".nav-node,.fol").forEach(f=>{const fp=String(f.dataset.page);if(outline){if(f.classList.contains("nd-hidden"))return;if(Number.isFinite(Number(fp))&&Number(fp)<=Number(pg.n)&&(!active||Number(fp)>Number(active.dataset.page)))active=f;}else if(fp===String(pg.n))active=f;});
    nav.querySelectorAll(".nav-node,.fol").forEach(f=>f.classList.toggle("on",f===active));
  }}}
$("#scroll").addEventListener("scroll",()=>{const s=$("#scroll");$("#prog").style.width=(s.scrollTop/(s.scrollHeight-s.clientHeight)*100)+"%";
  if(!_tick){_tick=true;requestAnimationFrame(()=>{pickFolio();_tick=false;});}},{passive:true});
// Read · Parallel · Study. Read = English-primary single column; Parallel = EN∥LA (rows are
// locus-paired, so the columns stay in sync inherently); Study = Parallel + the source scan.
/* the masthead never auto-hides: .app's padding-top never reclaims the space (dead strip), the
   deep-link settle scroll hid it before any user gesture, and the Aa popover is anchored inside
   the header so it rode the transform off-screen. */
/* ── independent lanes: English · Latin · Scan combine freely (EN+LA+Scan, EN+Scan, LA+Scan, …).
   LN is the single source of truth; the old preset mode() survives as a thin wrapper (thumb bar,
   deep links, saved fr_mode values). At least one TEXT lane stays on — turning the last one off
   flips the other on, so the reading column can never go empty. */
window.LN={en:true,la:true,fx:false};   // owner 2026-08-17: the Latin lane shows by DEFAULT ("no latin" report) — this is a Latin library
function applyLanes(){
  // An English source is already read in the English lane. A parallel preference
  // carried from a Latin work must not open two English versions side by side.
  const englishSource=DATA?.src_lang==='en';
  const singleLane=englishSource||DATA?.en_only===true||app.classList.contains('en-only');
  if(singleLane){LN.en=true;LN.la=false;}
  if(!LN.en&&!LN.la)LN.en=true;
  if(!(DATA&&DATA.has_pages))LN.fx=false;                 // born-digital: no scan exists
  app.classList.toggle("only-en",LN.en&&!LN.la);
  app.classList.toggle("only-la",LN.la&&!LN.en);
  app.classList.toggle("no-facs",!LN.fx);
  const P={en:LN.en,par:LN.la,study:LN.fx};
  ["en","par","study"].forEach(x=>{const b=$("#m-"+x);if(b)b.setAttribute("aria-pressed",!!P[x]);});
  if(!LN.fx){app.classList.remove("facs-only");const fe=$("#facsExp");if(fe){fe.setAttribute("aria-pressed","false");fe.textContent="⤢";}}  // dropping the scan drops facsimile-only too
  if(!singleLane)lsSet("fr_lanes2",JSON.stringify(LN));if(window.__frThumbSync)window.__frThumbSync();
  // PHONE PARALLEL (owner 2026-08-10 "work on this on mobile"): stacked runs render la-column-
  // then-en-column — pages of Latin before any English on a phone. Zip them into la∥en pairs,
  // paragraph by paragraph, whenever both lanes are on at phone width. One-way per stkwrap
  // (desktop grid ignores .zpair children order via column re-split? no — zip is phone-only
  // and phones don't grow into desktops mid-read; a rebuild restores columns).
  if(LN.en&&LN.la&&matchMedia("(max-width:880px)").matches&&window.__frZipStacks)window.__frZipStacks();
  // keep your place: the row that was under the top of the viewport stays there across the relayout
  if(window.__frAnchorRow&&window.__frAnchorRow.isConnected){
    const navigation=window.__readerNavSerial||0,anchor=window.__frAnchorRow;
    requestAnimationFrame(()=>{if(navigation===(window.__readerNavSerial||0)&&anchor?.isConnected)anchor.scrollIntoView({block:"start"});});}
}
function mode(m){                                          // legacy presets → lane states
  if(m==="en")Object.assign(LN,{en:true,la:false,fx:false});
  else if(m==="par")Object.assign(LN,{en:true,la:true,fx:false});
  else if(m==="study")Object.assign(LN,{en:true,la:true,fx:true});
  applyLanes();}
document.addEventListener("pointerdown",ev=>{if(ev.target.closest&&ev.target.closest(".ph .seg,[data-t]"))
  window.__frAnchorRow=[...reading.querySelectorAll(".row[id]")].find(r=>r.getBoundingClientRect().bottom>120);},true);
$("#m-en").onclick=()=>{LN.en=!LN.en;if(!LN.en&&!LN.la)LN.la=true;applyLanes();};
$("#m-par").onclick=()=>{LN.la=!LN.la;if(!LN.en&&!LN.la)LN.en=true;applyLanes();};
$("#m-study")&&($("#m-study").onclick=()=>{LN.fx=!LN.fx;applyLanes();});
$("#sbT").onclick=()=>app.classList.toggle("nosb");   // collapse / show the left contents sidebar
// mobile: scrim behind the open sidebar + tap-to-dismiss; nav taps auto-close the sheet
(function(){const sc=document.createElement("div");sc.id="sbScrim";app.appendChild(sc);
  sc.onclick=()=>{app.classList.add("nosb");window.__frThumbSync&&window.__frThumbSync();};
  $("#nav").addEventListener("click",e=>{if(matchMedia("(max-width:880px)").matches&&e.target.closest("a,.fmnav,[data-page]")){app.classList.add("nosb");window.__frThumbSync&&window.__frThumbSync();}});})();
/* MOBILE SHELL (ported from Patrologia Graeca, 2026-07-04) — the phone reading model:
   a fixed bottom thumb bar [English · + Latin · Scan · ☰ Contents · ★ Notebook] driving the
   EXISTING mode()/sidebar/notebook controls. html.g-mobile flips live with the 880px query;
   CSS shows the bar only there, so desktop is untouched. */
(function mobileShell(){
  const HTML=document.documentElement,mq=matchMedia("(max-width:880px)");
  const applyM=()=>HTML.classList.toggle("g-mobile",mq.matches);
  applyM();mq.addEventListener?mq.addEventListener("change",applyM):mq.addListener(applyM);
  const bar=document.createElement("nav");bar.className="frthumb";bar.setAttribute("aria-label","Reading controls");
  bar.innerHTML=
    '<button type="button" data-t="en"><span class="ic" aria-hidden="true">A</span><span class="lb">English</span></button>'+
    '<button type="button" data-t="par"><span class="ic" aria-hidden="true">∥</span><span class="lb">+ Latin</span></button>'+
    '<button type="button" data-t="study"><span class="ic" aria-hidden="true">▦</span><span class="lb">Scan</span></button>'+
    '<button type="button" data-t="find"><span class="ic" aria-hidden="true">⌕</span><span class="lb">Search</span></button>'+
    '<button type="button" data-t="toc"><span class="ic" aria-hidden="true">☰</span><span class="lb">Contents</span></button>'+
    '<button type="button" data-t="nb"><span class="ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v15M12 5C8 2 3 4 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-1 0-6-2-10 1Z"/></svg></span><span class="lb">Research</span></button>'+
    '<button type="button" data-t="ask"><span class="ic" aria-hidden="true">✦</span><span class="lb">Ask</span></button>';
  document.body.appendChild(bar);
  const B={};bar.querySelectorAll("button").forEach(b=>{B[b.dataset.t]=b;
    b.style.touchAction="manipulation";
    b.addEventListener("touchend",e=>{e.preventDefault();b.onclick&&b.onclick();},{passive:false});});
  // Lane model (2026-07-19, after user confusion): "English" is an absolute switch — always
  // lands on English-only (and exits the scan). "Latin" cycles Both → Latin-only → Both, so
  // every state is reachable in ≤2 taps and the highlights literally mean "this lane is visible".
  B.en.onclick=()=>{LN.fx=false;LN.en=true;LN.la=false;applyLanes();};
  B.par.onclick=()=>{
    if(LN.fx)LN.fx=false;
    if(!LN.la){LN.la=true;LN.en=true;}          // from English-only → Both
    else if(LN.en){LN.en=false;}                 // from Both → Latin-only
    else{LN.en=true;}                            // from Latin-only → Both
    applyLanes();};
  B.study.onclick=()=>{LN.fx=!LN.fx;applyLanes();};                   // "Scan" = toggle the facsimile
  B.find.onclick=()=>{if(window.__frOpenSearch)window.__frOpenSearch();};
  if(B.ask)B.ask.onclick=()=>{if(window.__openAsk)window.__openAsk("");};
  B.toc.onclick=()=>{app.classList.toggle("nosb");window.__frThumbSync&&window.__frThumbSync();};
  B.nb.onclick=()=>{if(window.__frOpenNotebook)window.__frOpenNotebook();};
  // chrome auto-hide while reading down (phones): accumulate same-direction travel so tiny
  // jitters don't flap it; near the top it is always shown. A tap on the prose toggles it
  // (the Books model) — interactive elements, active selections, and review mode excluded.
  (function(){const sc=document.getElementById("scroll");if(!sc)return;
    let y0=sc.scrollTop,acc=0;
    sc.addEventListener("scroll",()=>{
      const mob=mq.matches;
      const y=sc.scrollTop,d=y-y0;y0=y;
      if(y<90){HTML.classList.remove("mh-hide","mh-mini");acc=0;return;}
      acc=(d>0)===(acc>0)?acc+d:d;
      if(acc>140)HTML.classList.add(mob?"mh-hide":"mh-mini");
      else if(acc<-24)HTML.classList.remove("mh-hide","mh-mini");
    },{passive:true});
    const rd=document.getElementById("reading");
    if(rd)rd.addEventListener("click",e=>{
      if(!mq.matches||document.body.classList.contains("cloud-review"))return;
      if(e.target.closest("a,button,sup,input,textarea,select,mark,[contenteditable],.la-rev,.fmark,.rowx,.trpencil"))return;
      const s=document.getSelection();if(s&&!s.isCollapsed)return;
      if(!HTML.classList.contains("mh-hide")&&sc.scrollTop<90)return;   // at the top, chrome stays
      HTML.classList.toggle("mh-hide");acc=0;
    });})();
  window.__frThumbSync=()=>{
    const hasScan=(typeof DATA!=="undefined")&&!!(DATA&&DATA.has_pages),enOnly=app.classList.contains("en-only")||DATA?.src_lang==='en';
    B.study.style.display=hasScan?"":"none";
    B.par.style.display=enOnly?"none":"";
    B.en.classList.toggle("on",!!(window.LN&&LN.en&&!LN.fx));
    B.par.classList.toggle("on",!!(window.LN&&LN.la&&!LN.fx));
    {const lb=B.par.querySelector(".lb");const SN=window.__SRCNAME||"Latin";
     if(lb)lb.textContent=(window.LN&&LN.la&&!LN.en)?(SN+" only"):(window.LN&&LN.la)?"∥ Both":("+ "+SN);}
    B.study.classList.toggle("on",!!(window.LN&&LN.fx));
    B.toc.classList.toggle("on",!app.classList.contains("nosb"));
    {const w=document.getElementById("m-wit"),bp=document.querySelector(".aamob [data-x=\'m-wit\']");
     if(bp){bp.style.display=w?"":"none";if(w)bp.textContent="⇄ "+w.textContent+" text";}}
  };
  window.__frThumbSync();
  setTimeout(window.__frThumbSync,1600);   // the witness pill is created ~800ms after canon load
  // fold the header controls hidden under g-mobile into the Aa menu (proxy the originals)
  const pop=$("#aaPop");
  if(pop&&!pop.querySelector(".aamob")){
    const row=document.createElement("div");row.className="aamob";
    row.innerHTML='<button data-x="pPrev" aria-label="Previous place">Previous</button><button data-x="pNext" aria-label="Next place">Next</button>'
      +'<button data-x="rdAbout">About this work</button><button data-x="rdRel">Related passages</button>';
    const jumpBox=document.createElement('form');jumpBox.className='reader-jump-form';
    jumpBox.innerHTML='<label id="reader-jump-label" for="reader-jump">Go to page</label><div><input id="reader-jump" type="text" autocomplete="off" aria-describedby="reader-jump-status"><button type="submit">Go</button></div><p id="reader-jump-status" role="status"></p>';
    pop.prepend(jumpBox);
    jumpBox.onsubmit=e=>{e.preventDefault();const value=$('#reader-jump').value.trim(),pg=DATA?.pages.find(p=>String(p.n)===value);if(pg){pop.classList.remove('on');$('#reader-jump').blur();$('#aaBtn').setAttribute('aria-expanded','false');$('#reader-jump-status').textContent='';goReaderReference(pg);}else{$('#reader-jump-status').textContent='That reference is not available in this work.';}};
    $('#reader-location').onclick=e=>{e.stopPropagation();$('#reader-jump').value=String(cur??'');pop.classList.add('on');$('#aaBtn').setAttribute('aria-expanded','true');$('#reader-jump').focus();$('#reader-jump').select();};
    pop.insertBefore(row,pop.firstChild);
    row.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
      const tgt=$("#"+b.dataset.x);if(tgt)tgt.click();});
  }
})();
// mobile: ✕ on the facsimile overlay exits Study back to single-column reading
{const fx=$("#facsX");if(fx)fx.onclick=()=>{LN.fx=false;applyLanes();};}   // ✕ closes only the scan; text lanes keep their state
// facsimile-only: fill the window with the scan, hide the text (same control toggles back). Contextual —
// the button lives in the scan header, only visible in Study, so the main mode toggle stays uncrowded.
{const fe=$("#facsExp");if(fe)fe.onclick=function(){const on=app.classList.toggle("facs-only");
  this.setAttribute("aria-pressed",on?"true":"false");this.textContent=on?"⤡":"⤢";
  this.title=on?"Bring the text back":"Fill the window with the scan (click again to bring the text back)";};}
// text-size + facsimile-zoom controls (persisted), like server.py's image slider
// "Aa" settings popover open/close
(function(){const b=$("#aaBtn"),p=$("#aaPop");if(!b||!p)return;
  const set=on=>{if(on)$("#reader-jump").value=String(cur??'');p.classList.toggle("on",on);b.setAttribute("aria-expanded",on?"true":"false");};
  b.onclick=e=>{e.stopPropagation();set(!p.classList.contains("on"));};
  document.addEventListener("click",e=>{if(p.classList.contains("on")&&!p.contains(e.target)&&e.target!==b)set(false);});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&p.classList.contains("on"))set(false);});})();
// Flow (continuous reading) — default ON; remembered across works
(function(){const on=lsGet("fr_flow")!=="0";app.classList.toggle("rflow",on);
  const b=$("#rdFlow");if(b){const sync=()=>{const flow=app.classList.contains("rflow");b.textContent=flow?"Flow":"Pages";b.setAttribute("aria-pressed",String(flow));b.title=flow?"Continuous reading. Switch to page view.":"Page view. Switch to continuous reading.";$("#readerFlowView")?.setAttribute("aria-pressed",String(flow));$("#readerPageView")?.setAttribute("aria-pressed",String(!flow));};sync();
    $("#readerFlowView").onclick=()=>{if(!app.classList.contains("rflow"))b.click();};$("#readerPageView").onclick=()=>{if(app.classList.contains("rflow"))b.click();};
    b.onclick=()=>{const now=!app.classList.contains("rflow");
      // keep the reader's place across the reflow: pin the topmost visible folio/row to the same viewport offset
      const els=document.querySelectorAll("#reading .folio,#reading .row");
      let anchor=null,top0=0;
      for(const el of els){const r=el.getBoundingClientRect();if(r.bottom>90){anchor=el;top0=r.top;break;}}
      app.classList.toggle("rflow",now);
      sync();lsSet("fr_flow",now?"1":"0");
      // the reader scrolls an INNER container (.app is overflow:hidden) — window.scrollBy was a
      // no-op there, so the toggle lost the reading position (Leibniz UX 2026-07-18). Walk to the
      // real scroll parent, then settle-correct over ~1.3s: content-visibility re-measures folio
      // heights lazily after the reflow, so a single-frame delta reads as zero (same lesson as the
      // deep-link settle chain, 2026-07-13). A deliberate user scroll cancels the correction.
      if(anchor){let sc=anchor.parentElement;
        while(sc&&sc!==document.body&&sc.scrollHeight<=sc.clientHeight+4)sc=sc.parentElement;
        let k=0;const navigation=window.__readerNavSerial||0;const iv=setInterval(()=>{
          if(navigation!==(window.__readerNavSerial||0)||!anchor.isConnected){stop();return;}
          const r=anchor.getBoundingClientRect(),d=r.top-top0;
          if(Math.abs(d)>1){if(sc&&sc!==document.body)sc.scrollTop+=d;else window.scrollBy(0,d);}
          if(++k>14)stop();},90);
        const stop=()=>{clearInterval(iv);removeEventListener("wheel",stop,true);removeEventListener("touchstart",stop,true);};
        addEventListener("wheel",stop,true);addEventListener("touchstart",stop,true);}};}})();
// ── Related passages panel: where this folio's themes appear elsewhere in the library and in the
// Fathers (Patrologia Latina/Orientalis). Query = the page's own stored vector (api/related). ──
(function(){
  const btn=$("#rdRel");if(!btn)return;
  let pn=null,lastPg=null,relatedSerial=0,relatedController=null;
  const localRelatedPreview=()=>['localhost','127.0.0.1','::1','[::1]'].includes(location.hostname);
  const relatedSlug=()=>new URLSearchParams(location.search).get('w')||DATA?.slug||'';
  function liveRelatedReader(pg){const url=new URL('/the-faith-received/read/','https://thefaithreceived.vercel.app');url.searchParams.set('w',relatedSlug());if(pg!=null){url.searchParams.set('p',String(pg));url.hash='b'+String(pg)+'-0';}return url.href;}
  function cancelRelated(){relatedSerial++;relatedController?.abort();relatedController=null;}
  async function relatedJSON(url,signal){const response=await fetch(url,{signal});if(!response.ok){const error=Error('Related service returned HTTP '+response.status);error.status=response.status;throw error;}let data;try{data=await response.json();}catch(_){throw Error('The related service returned an unreadable response.');}if(!data||typeof data!=='object'||Array.isArray(data)||data.error)throw Error('The related service could not return results.');return data;}
  function relatedState(kind,pg,error,retry){
    const box=$('#rpB'),preview=kind==='preview',missing=kind==='missing',auth=error?.status===401||error?.status===403;
    const message=preview?'Related passages use the live library. This local preview does not include its search service.':missing?'No similarity results are available for this page yet. You can still search the library or ask about this passage.':auth?'Your library session needs renewing. Open the live reader to sign in, then try again.':'Related passages could not load. Your place in the book is unchanged.';
    box.innerHTML='<div class="rp-note" role="status">'+esc(message)+'</div><div class="rp-act">'+(preview||auth?'<a href="'+esc(liveRelatedReader(pg))+'" target="_blank" rel="noopener">Open this page on the live site</a>':'')+(!preview?'<button type="button" class="rp-refresh" id="rpRetry">Retry related passages</button><a href="/the-faith-received/ask/?q='+encodeURIComponent('Help me understand '+(DATA?.title||relatedSlug())+', '+locOf(pg)+'.')+'" target="_blank" rel="noopener">Ask about this page</a>':'')+'<a href="https://thefaithreceived.vercel.app/?q='+encodeURIComponent(DATA?.author||DATA?.title||relatedSlug())+'" target="_blank" rel="noopener">Search the library</a></div>';
    const button=box.querySelector('#rpRetry');if(button)button.onclick=retry;
  }
  function panel(){if(pn)return pn;
    pn=el("aside","relpanel");
    pn.setAttribute("role","complementary");pn.setAttribute("aria-label","Related passages");pn.setAttribute("aria-hidden","true");
    pn.innerHTML='<div class=relpanel-h><b>✧ Related passages</b><span class=rp-pg id=rpPg></span><button class=rp-pins id=rpHist title="Saved parallels — every lookup is kept automatically">⏱</button><button class=rp-pins id=rpPins title="Your pinned parallels">★ <span id=rpPinN>0</span></button><button class=relpanel-x aria-label=Close>✕</button></div><div class=relpanel-b id=rpB></div>';
    document.body.appendChild(pn);
    pn.querySelector(".relpanel-x").onclick=()=>setRelOpen(false);
    // dismissal parity with Notebook/search: Escape closes when open
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&pn&&pn.classList.contains("on")){setRelOpen(false);}});
    pn.querySelector("#rpPins").onclick=paintPins;
    pn.querySelector("#rpHist").onclick=paintHist;
    const n=$("#rpPinN");if(n)n.textContent=pins().length;
    pn.addEventListener("click",ev=>{
      const pb=ev.target.closest(".rp-pin");if(!pb)return;
      ev.preventDefault();ev.stopPropagation();
      const [s,page]=pb.dataset.pin.split("|");
      let P=pins();
      if(isPinned(s,page))P=P.filter(x=>!((x.site||'fr')==='fr'&&x.slug===s&&String(x.page)===String(page)));
      else{const wb={};(window.__WORKS||[]).forEach(w=>wb[w.slug]=w);const m=wb[s]||{};
        P.unshift({slug:s,page,title:m.title||s,author:m.author||"",tradition:m.tradition||""});}
      setPins(P);
      const on=isPinned(s,page);pb.classList.toggle("on",on);pb.textContent=on?"★":"☆";pb.title=on?"Unpin":"Pin to your reading list";});
    return pn;}
  // ── THE MINED LAYER (2026-08-20): works with a mined unit sidecar open the panel with
  // "§ On this page" — the unit's title, the page's gist, its verified positions (with
  // evidence spans), authorities with intent chips, definitions. 404 = silently absent.
  let _mineP=null;
  function mineUnits(){
    if(_mineP)return _mineP;
    const slug=(new URLSearchParams(location.search).get("w"))||DATA.slug||"";
    _mineP=fetch(BLOB+"/v1/mine/units/"+encodeURIComponent(slug)+".json").then(r=>r.ok?r.json():null).catch(()=>null);
    return _mineP;}
  function mineHtml(d,pg){
    if(!d||!d.units)return "";
    const u=d.units.find(x=>x.pages&&x.pages.some(p=>String(p)===String(pg)));
    if(!u)return "";
    const pos=(u.positions||[]).filter(x=>String(x.page)===String(pg)).slice(0,4);
    const auth=(u.authorities||[]).filter(x=>String(x.page)===String(pg)).slice(0,6);
    const defs=(u.definitions||[]).filter(x=>String(x.page)===String(pg)).slice(0,3);
    const gi=(u.gists||[])[Math.max(0,(u.pages||[]).findIndex(p=>String(p)===String(pg)))]||"";
    if(!pos.length&&!auth.length&&!defs.length&&!gi)return "";
    let h='<div class=rp-mined><div class=rpm-h>§ On this page <span class=rpm-u>'+esc(String(u.title).slice(0,60))+'</span></div>';
    if(gi)h+='<div class=rpm-gist>'+esc(String(gi).slice(0,200))+'</div>';
    pos.forEach(x=>{
      const v=x.verify||{};const ok=x.tier==="verified";
      h+='<div class="rpm-pos'+(ok?" ok":"")+'" title="'+(v.span?esc(String(v.span).slice(0,180)):"unverified")+'">'
        +(ok?'<span class=rpm-tick title="Verified against the page">✓</span>':'<span class=rpm-tick title="Proposed — not yet verified">○</span>')
        +'<b>'+esc(String(x.stance||""))+'</b> '+esc(String(x.claim).slice(0,140))
        +(x.against?' <span class=rpm-ag>vs '+esc(String(x.against).slice(0,30))+'</span>':"")+'</div>';});
    if(auth.length)h+='<div class=rpm-auth>'+auth.map(a=>{
      // RESOLVED CITATIONS ARE DOORS (owner 2026-08-28 'can our related go to the works
      // mentioned'): a class-A authority names a held work — the chip opens it.
      const rz=a.resolved||{};
      const inner=esc(String(a.surface).slice(0,26))+(a.intent==="DISAGREES"?" ⚔":a.intent==="AUTHORITY"?" ✓":"");
      const tt=esc((a.locator?a.locator+" · ":"")+(a.intent||""));
      if(rz.cls==="A"&&rz.work_slug)
        return '<a class="rpm-chip rpm-go" href="/the-faith-received/read/?w='+encodeURIComponent(rz.work_slug)+'" target=_blank title="'+tt+' — open the cited work">'+inner+' ↗</a>';
      return '<span class=rpm-chip'+(tt?' title="'+tt+'"':"")+'>'+inner+'</span>';}).join("")
      +'<a class="rpm-chip rpm-web" href="/the-faith-received/web/#a='+encodeURIComponent(String((window.DATA&&DATA.author)||"").trim())+'" target=_blank title="This author in the Web of Theology">✧ Web</a></div>';
    defs.forEach(x=>{h+='<div class=rpm-def><i>'+esc(String(x.term).slice(0,40))+'</i> — '+esc(String(x.definition).slice(0,120))+'</div>';});
    return h+'</div>';}
  async function load(pg){
    cancelRelated();const request=relatedSerial;lastPg=pg;
    const b=$("#rpB");$("#rpPg").textContent=locOf(pg);
    if(localRelatedPreview()){relatedState('preview',pg);return;}
    const current=()=>request===relatedSerial&&!txtMode&&pn?.classList.contains('on');
    const controller=new AbortController();relatedController=controller;const timeout=setTimeout(()=>controller.abort(),20000);
    b.innerHTML='<div class=rp-skel><div></div><div></div><div></div></div><div class=rp-skel><div></div><div></div><div></div></div><div class=rp-skel><div></div><div></div><div></div></div>';
    // EVERY terminal branch below assigns b.innerHTML and was WIPING this block (found
    // 2026-08-27 when the units sidecars went live corpus-wide) — insert is re-run per
    // branch, guarded so it never doubles.
    const _mineIn=()=>mineUnits().then(md=>{const mh=mineHtml(md,pg);
      if(mh&&current()&&String(lastPg)===String(pg)&&!b.querySelector(".rp-mined")){const w=document.createElement("div");w.innerHTML=mh;b.insertBefore(w.firstChild,b.firstChild);}});
    _mineIn();
    let d;
    try{d=await relatedJSON('https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/related?'+new URLSearchParams({s:relatedSlug(),p:String(pg)}),controller.signal);}catch(error){if(current()){relatedState('error',pg,error,()=>load(pg));_mineIn();}return;}finally{clearTimeout(timeout);if(relatedController===controller)relatedController=null;}
    if(!current())return;
    if(!Array.isArray(d.works)||!Array.isArray(d.fathers)){relatedState('error',pg,null,()=>load(pg));_mineIn();return;}
    if(d.missing){relatedState('missing',pg,null,()=>load(pg));_mineIn();return;}
    const wb={};(window.__WORKS||[]).forEach(w=>wb[w.slug]=w);
    let h='<div class=rp-follow><i></i>Following your reading — parallels update as you scroll</div>';
    if(d.works&&d.works.length){
      h+='<div class=rp-sec>Elsewhere in the library</div>'+d.works.map(w=>card(w,wb[w.slug]||{})).join("");}
    if(d.fathers&&d.fathers.length){
      h+='<div class=rp-sec>Among the authors</div>'+d.fathers.map(fRow).join("");}
    if(!(d.works&&d.works.length)&&!(d.fathers&&d.fathers.length))h+='<div class=rp-note>No strong parallels found for this page.</div>';
    saveRun("page",pg,d);
    b.innerHTML=h;hydrate(b);_mineIn();
    // documented reception: explicit patristic citations mined from THIS page's text —
    // similarity above, citation below: the two kinds of connective tissue side by side
    const cts=await cites();
    if(!current())return;
    const here=(cts&&cts[String(pg)])||[];
    if(here.length){
      b.insertAdjacentHTML('beforeend','<div class=rp-sec>Cited on this page — documented reception</div><div class=rp-cites>'
        +here.map(c=>'<a class=rp-cite href="/?tq='+encodeURIComponent(c.a+" "+(c.m||"").replace(/[^A-Za-z0-9 .]/g," ").slice(0,60))+'" target=_blank title="'+esc(c.m||c.a)+'">'
          +'<span class="cbadge cb-'+c.c+'">'+(c.c==="pg"?"PG":"PL")+'</span>'+esc(c.a)+'</a>').join("")+'</div>');}
    const re=$("#rpRe");if(re)re.onclick=()=>{if(cur)load(cur);};
  }
  // AUTO-FOLLOW (2026-09-02): the panel tracks the page in view — no manual refresh
  let _fT=null;
  window.__relFollow=n=>{
    if(!pn||!pn.classList.contains("on")||txtMode)return;
    clearTimeout(_fT);_fT=setTimeout(()=>{if(pn?.classList.contains('on')&&!txtMode&&String(n)!==String(lastPg))load(n);},800);};
  // PEEK inside the panel: the passage itself, embedded
  document.addEventListener("click",e=>{
    const pk=e.target.closest(".rp-peek");if(!pk)return;
    e.preventDefault();e.stopPropagation();
    const host=pk.closest("a.rsr");
    let wrap=host&&host.nextElementSibling&&host.nextElementSibling.classList&&host.nextElementSibling.classList.contains("rp-peekwrap")?host.nextElementSibling:null;
    if(wrap){const on=wrap.classList.toggle("on");pk.classList.toggle("on",on);return;}
    const [w,pp]=String(pk.dataset.pk).split("|");
    wrap=document.createElement("div");wrap.className="rp-peekwrap";
    wrap.innerHTML='<div><iframe loading=lazy src="/the-faith-received/read/?w='+encodeURIComponent(w)+'#b'+pp+'-0" title=Passage></iframe></div>';
    host.insertAdjacentElement("afterend",wrap);
    requestAnimationFrame(()=>{wrap.classList.add("on");pk.classList.add("on");});
  });
  let _cites=null;
  function cites(){
    if(_cites)return _cites;
    _cites=fetch(BLOB+"/v1/works/"+DATA.slug+"/cites.json").then(r=>r.ok?r.json():{}).catch(()=>({}));
    return _cites;}
  // excerpts: pull a short passage snippet for the top result cards (meta → shard → page), cached
  const _exc={};
  async function excerpt(slug,page){
    const k=slug+"|"+page;
    if(k in _exc)return _exc[k];
    try{
      const meta=await fetch(BLOB+"/v1/works/"+slug+"/meta.json").then(r=>r.json());
      const f=meta.single?"work.json":((meta.shards||[]).find(s=>s.from<=page&&page<=s.to)||{}).file;
      if(!f)return _exc[k]=null;
      const d=await fetch(BLOB+"/v1/works/"+slug+"/"+f).then(r=>r.json());
      const pg=(d.pages||[]).find(x=>x.n===page);
      const tx=(pg&&(pg.en||pg.la)||"").replace(/\[\^[^\]]*\]:?/g,"").replace(/[#*]+/g,"").replace(/\s+/g," ").trim();
      return _exc[k]=tx?tx.slice(0,190):null;
    }catch(e){return _exc[k]=null;}
  }
  function hydrate(container){
    [...container.querySelectorAll("a.rsr[data-x]")].slice(0,5).forEach(a=>{
      excerpt(a.dataset.x.split("|")[0],+a.dataset.x.split("|")[1]).then(tx=>{
        if(tx&&!a.querySelector(".rsx2"))a.insertAdjacentHTML("beforeend",'<span class=rsx2>'+esc(tx)+'…</span>');});});
  }
  // ── pinned parallels: a persistent reading list (localStorage) — the researcher's notebook seed ──
  const isReference=i=>!!i&&i.type!=='note'&&!i.quoteImage&&!i.askAnswer&&!i.askTurn&&!!(i.slug||i.u);
  const referenceKey=i=>JSON.stringify([i.site||'fr',i.slug||'',String(i.page??''),i.u||'']);
  const legacyPins=()=>{try{const a=JSON.parse(lsGet('fr_pins')||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}};
  const pins=()=>{try{const C=JSON.parse(lsGet('fr_collections_v1')||'[]'),act=C.find(c=>c.id===(lsGet('fr_pincol')||'default'))||C[0];if(act)return(act.items||[]).filter(isReference);}catch(e){}return legacyPins().filter(isReference);};
  const setPins=a=>{
    const references=a.filter(isReference);
    try{ // Collections own research objects; fr_pins is only a reference mirror.
      let C=JSON.parse(lsGet('fr_collections_v1')||'[]');
      if(!C.length)C=[{id:'default',name:'Reading list',items:legacyPins()}];
      const act=C.find(c=>c.id===(lsGet('fr_pincol')||'default'))||C[0],old=act.items||[];
      const remaining=new Map(references.map(i=>[referenceKey(i),i])),items=[];
      for(const i of old){
        if(!isReference(i)){items.push(i);continue;}
        const key=referenceKey(i),next=remaining.get(key);
        if(next){items.push({...i,...next});remaining.delete(key);}
      }
      act.items=[...remaining.values(),...items];
      lsSet('fr_collections_v1',JSON.stringify(C));
      if(window._frSyncCollections)window._frSyncCollections(C);
    }catch(e){}
    lsSet('fr_pins',JSON.stringify(references.slice(0,300)));if(window._frSyncPins)window._frSyncPins(references.slice(0,300));const n=$('#rpPinN');if(n)n.textContent=references.length;
    window.dispatchEvent(new Event('fr-notebook-updated'));
  };
  // notebook/selpop hooks: pin the current page; run a parallels query for arbitrary text
  window.__frPinToggle=(page)=>{
    page=String(page);let P=pins();const on=!isPinned(DATA.slug,page);
    if(on){const wb={};(window.__WORKS||[]).forEach(w=>wb[w.slug]=w);const m=wb[DATA.slug]||{};
      let label="";try{label=(typeof locOf==="function"?locOf(page):"")||"";}catch(e){}
      P.unshift({site:"fr",slug:DATA.slug,page,label:label.slice(0,90),title:m.title||DATA.title||DATA.slug,author:m.author||DATA.author||"",tradition:m.tradition||""});}
    else P=P.filter(x=>!((x.site||'fr')==='fr'&&x.slug===DATA.slug&&String(x.page)===page));
    setPins(P);return on;};
  const isPinned=(s,p)=>pins().some(x=>(x.site||'fr')==='fr'&&x.slug===s&&String(x.page)===String(p));
  function card(w,m){
    const pinned=isPinned(w.slug,+w.page);
    const aff=w.score?Math.max(8,Math.round((w.score-0.55)/0.45*100)):null;
    return '<a class=rsr data-x="'+esc(w.slug)+'|'+w.page+'" href="/the-faith-received/read/?w='+encodeURIComponent(w.slug)+'#b'+w.page+'-0" target=_blank rel=noopener>'
      +'<span class=rst>'+esc(m.title||w.slug)+(m.tradition?'<span class=rtrad>'+esc(m.tradition)+'</span>':'')+'</span>'
      +'<span class=rsm>'+esc(m.author||"")+(m.author?" · ":"")+'pg. '+w.page
      +'<button class=rp-peek data-pk="'+esc(w.slug)+'|'+w.page+'" title="Peek — read it right here">⌄</button></span>'
      +(aff?'<span class=rsaff style="width:'+Math.min(100,aff)+'%" title="affinity '+w.score+'"></span>':'')
      +'<button class="rp-pin'+(pinned?' on':'')+'" data-pin="'+esc(w.slug)+'|'+w.page+'" title="'+(pinned?'Unpin':'Pin to your reading list')+'">'+(pinned?'★':'☆')+'</button></a>';}
  function paintPins(){
    cancelRelated();
    const b=$("#rpB");$("#rpPg").textContent="pinned parallels";txtMode=true;
    const P=pins();
    if(!P.length){b.innerHTML='<div class=rp-note>Nothing pinned yet — ☆ a result to keep it here.</div><a class=rp-copy href="/the-faith-received/pins/" style="text-align:center;text-decoration:none">▤ Open collections</a><button class=rp-refresh id=rpRe>↻ Back to parallels for this page</button>';}
    else{
      b.innerHTML='<a class=rp-copy href="/the-faith-received/pins/" style="text-align:center;text-decoration:none">▤ Open collections — group, share, manage</a>'
        +'<button class=rp-copy id=rpCopy>⧉ Copy as citation list</button>'
        +P.map(x=>card({slug:x.slug,page:x.page},{title:x.title,author:x.author,tradition:x.tradition})).join("")
        +'<button class=rp-refresh id=rpRe>↻ Back to parallels for this page</button>';
      const c=$("#rpCopy");if(c)c.onclick=()=>{
        const txt=P.map(x=>(x.author?x.author+", ":"")+(x.title||x.slug)+", pg. "+x.page+" — https://thefaithreceived.vercel.app/read?w="+x.slug+"%23b"+x.page+"-0").join("\n");
        navigator.clipboard.writeText(txt).then(()=>{c.textContent="✓ copied";setTimeout(()=>{c.textContent="⧉ Copy as citation list";},1200);});};
      hydrate(b);}
    const re=$("#rpRe");if(re)re.onclick=()=>{txtMode=false;if(cur)load(cur);};}
  function fRow(f){
    const base=f.src==='PO'?'https://patrologia-orientalis.vercel.app':f.src==='AQ'?'https://aquinas-studies.vercel.app':'https://pld-patrologia-latina.vercel.app';
    const frag=f.src==='AQ'?'#'+(f.anchor||''):'#b'+(f.anchor||'');   // Aquinas anchors are r-ids (#r123), PL/PO are #b<page>
    const inner='<span class=cit>'+esc(f.cit||f.src)+(f.era?' <span class=era>s. '+_rom(f.era)+'</span>':'')+'</span><span class=tx>'+esc(f.tx)+'…</span>';
    return f.doc?'<a class=rp-f href="'+base+'/the-faith-received/read/'+encodeURIComponent(f.doc)+'.html'+frag+'" target=_blank style="display:block;text-decoration:none;color:inherit">'+inner+'</a>'
                :'<div class=rp-f>'+inner+'</div>';}
  // ── auto-saved parallels: every lookup that returns results is kept, no action needed
  // (owner 2026-07-21: "allow me to save these parallels automatically"). localStorage, cap 40,
  // deduped by source (same page / same selection refreshes its entry to the top). ──
  const hist=()=>{try{return JSON.parse(lsGet("fr_parhist_v1")||"[]");}catch(e){return [];}};
  const setHist=a=>{try{lsSet("fr_parhist_v1",JSON.stringify(a.slice(0,40)));}catch(e){}};
  function saveRun(kind,src,d){
    if(!d)return;
    const works=(d.works||[]).slice(0,12).map(w=>({slug:w.slug,page:w.page,score:w.score}));
    const fathers=(d.fathers||[]).slice(0,8).map(f=>({src:f.src,cit:f.cit,tx:String(f.tx||"").slice(0,130),doc:f.doc,anchor:f.anchor,era:f.era}));
    if(!works.length&&!fathers.length)return;
    const key=kind==="page"?("p|"+DATA.slug+"|"+src):("s|"+String(src).toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,80));
    const e={k:key,ts:Date.now(),kind,slug:DATA.slug,title:DATA.title||DATA.slug,
      page:kind==="page"?src:undefined,q:kind==="sel"?String(src).slice(0,220):undefined,works,fathers};
    setHist([e].concat(hist().filter(x=>x.k!==key)));}
  function paintHist(){
    cancelRelated();
    const b=$("#rpB");$("#rpPg").textContent="saved parallels";txtMode=true;
    const H=hist();
    let h='';
    if(!H.length)h+='<div class=rp-note>Every parallels lookup is saved here automatically — run one and it will appear.</div>';
    else h+='<div class=rp-note>Saved automatically, newest first — nothing to do on your side.</div>'
      +H.map((e2,i)=>{
        const when=new Date(e2.ts).toLocaleDateString(undefined,{month:"short",day:"numeric"});
        const lab=e2.kind==="page"?esc(e2.title||e2.slug)+' · pg. '+e2.page
                                  :'“'+esc((e2.q||"").slice(0,64))+((e2.q||"").length>64?"…":"")+'”';
        const n=(e2.works||[]).length+(e2.fathers||[]).length;
        return '<a class=rsr href=# data-h="'+i+'"><span class=rst>'+(e2.kind==="page"?"✧ ":"❝ ")+lab+'</span>'
          +'<span class=rsm>'+n+' parallels · '+when+'</span>'
          +'<button class=rp-del data-hx="'+esc(e2.k)+'" title="Remove from saved">✕</button></a>';}).join("");
    h+='<button class=rp-refresh id=rpRe>↻ Back to parallels for this page</button>';
    b.innerHTML=h;
    [...b.querySelectorAll("a[data-h]")].forEach(a=>a.onclick=ev=>{
      if(ev.target.closest(".rp-del"))return;ev.preventDefault();
      const e2=hist()[+a.dataset.h];if(e2)renderSaved(e2);});
    [...b.querySelectorAll("button[data-hx]")].forEach(x=>x.onclick=ev=>{
      ev.preventDefault();ev.stopPropagation();
      setHist(hist().filter(e2=>e2.k!==x.dataset.hx));paintHist();});
    const re=$("#rpRe");if(re)re.onclick=()=>{txtMode=false;if(cur)load(cur);};}
  function renderSaved(e2){
    txtMode=true;
    const b=$("#rpB");
    $("#rpPg").textContent=e2.kind==="page"?"saved · pg. "+e2.page:"saved selection";
    const paint=()=>{
      const wb={};(window.__WORKS||[]).forEach(w=>wb[w.slug]=w);
      let h='<button class=rp-refresh id=rpHb>⏱ Back to saved parallels</button>';
      if(e2.kind==="page")h+='<div class=rp-note>From '+esc(e2.title||e2.slug)+', pg. '+e2.page+'.</div>';
      else h+='<div class=rp-note>“'+esc((e2.q||"").slice(0,120))+((e2.q||"").length>120?"…":"")+'”</div>';
      if(e2.works&&e2.works.length)h+='<div class=rp-sec>Elsewhere in the library</div>'+e2.works.map(w=>card(w,wb[w.slug]||{})).join("");
      if(e2.fathers&&e2.fathers.length)h+='<div class=rp-sec>In the Fathers</div>'+e2.fathers.map(fRow).join("");
      b.innerHTML=h;hydrate(b);
      const hb=$("#rpHb");if(hb)hb.onclick=paintHist;};
    if(!window.__WORKS&&BLOB)fetch(BLOB+"/v1/works-index.json").then(r=>r.json()).then(d=>{window.__WORKS=d.works||[];paint();}).catch(()=>{window.__WORKS=[];paint();});
    else paint();}
  // SELECTION → parallels: highlight any passage and query the corpus with it directly.
  let txtMode=false;
  window.__frParallels=q=>{const p=panel();p.classList.add("on");loadText(q);};
  async function loadText(q){
    cancelRelated();const request=relatedSerial;txtMode=true;
    if(localRelatedPreview()){$('#rpPg').textContent='your selection';relatedState('preview',cur);return;}
    if(!window.__WORKS&&BLOB){try{const [d,te]=await Promise.all([fetch(BLOB+"/v1/works-index.json").then(r=>r.json()),fetch(BLOB+"/v1/titles_en.json").then(r=>r.json()).catch(()=>({}))]);window.__WORKS=d.works||[];window.__TEN=te||{};}catch(e){window.__WORKS=[];window.__TEN={};}}
    if(request!==relatedSerial||!pn?.classList.contains('on'))return;
    const b=$("#rpB");$("#rpPg").textContent="your selection";
    b.innerHTML='<div class=rp-note>Finding parallels for “'+esc(q.slice(0,70))+(q.length>70?"…":"")+'”…</div>';
    let lib=null,pl=null;
    const controller=new AbortController();relatedController=controller;const timeout=setTimeout(()=>controller.abort(),20000);let failure;
    try{[lib,pl]=await Promise.all([
      relatedJSON("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/vsearch?q="+encodeURIComponent(q.slice(0,480))+"&k=12&sparse=1",controller.signal),
      (lsGet("fr_srchpl")!=="0"?relatedJSON("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/vsearch?q="+encodeURIComponent(q.slice(0,480))+"&k=4&corpus=pl",controller.signal).catch(()=>null):Promise.resolve(null))]);}catch(error){failure=error;}finally{clearTimeout(timeout);if(relatedController===controller)relatedController=null;}
    if(request!==relatedSerial||!txtMode||!pn?.classList.contains('on'))return;
    if(!lib||!Array.isArray(lib.results)){relatedState('error',cur,failure,()=>loadText(q));return;}
    const wb={};(window.__WORKS||[]).forEach(w=>wb[w.slug]=w);
    let h='<button class=rp-refresh id=rpRe>↻ Back to parallels for this page</button>';
    const res=(lib.results||[]).filter(x=>!(x.slug===DATA.slug));
    if(res.length)h+='<div class=rp-sec>Elsewhere in the library</div>'+res.map(w=>card(w,wb[w.slug]||{})).join("");
    const fr=((pl&&pl.results)||[]).filter(x=>x.score>=0.6);
    if(fr.length)h+='<div class=rp-sec>In the Fathers — Patrologia</div>'+fr.map(f=>
      '<div class=rp-f><span class=cit>'+esc(f.cit)+(f.era?' <span class=era>s. '+_rom(f.era)+'</span>':'')+'</span><span class=tx>'+esc(f.tx)+'…</span></div>').join("");
    if(!res.length&&!fr.length)h+='<div class=rp-note>No strong parallels for that passage.</div>';
    b.innerHTML=h;hydrate(b);
    saveRun("sel",q,{works:res,fathers:fr.map(f=>({src:'PL',cit:f.cit,tx:f.tx,era:f.era}))});
    const re=$("#rpRe");if(re)re.onclick=()=>{txtMode=false;if(cur)load(cur);};
  }
  const chip=el("div","selchip");
  chip.innerHTML='<button class=sc-b id=scPar>✧ Parallels</button><button class=sc-b id=scAsk>✦ Ask</button>';
  chip.title="Research the selected passage";
  document.body.appendChild(chip);
  let selTxt="";
  // Selection actions live in RIGHT-CLICK, not an auto-popup (owner 2026-07-21: the chip jumping
  // out at every selection breaks reading). Pointer devices: contextmenu on a selection inside
  // #reading shows the chip at the cursor. Touch (no right-click): the old auto-chip remains —
  // it is the only reachable affordance there.
  const _touchOnly=matchMedia("(hover: none)").matches;
  document.addEventListener("selectionchange",()=>{
    const s=document.getSelection();
    const t=s&&!s.isCollapsed?String(s):"";
    const inR=s&&s.anchorNode&&$("#reading")&&$("#reading").contains(s.anchorNode);
    if(t.trim().length>=25&&t.length<=600&&inR){
      selTxt=t.trim();
      if(_touchOnly){try{const r=s.getRangeAt(0).getBoundingClientRect();
        chip.style.left=Math.max(8,Math.min(r.left+r.width/2-46,innerWidth-104))+"px";
        chip.style.top=Math.max(8,r.top-40)+"px";chip.classList.add("on");}catch(e){}}
    } else chip.classList.remove("on");
  });
  if(!_touchOnly)document.addEventListener("contextmenu",e=>{
    const s=document.getSelection();
    const t=s&&!s.isCollapsed?String(s).trim():"";
    if(t.length>=25&&t.length<=600&&$("#reading")&&$("#reading").contains(s.anchorNode)){
      e.preventDefault();selTxt=t;
      chip.style.left=Math.max(8,Math.min(e.clientX-46,innerWidth-104))+"px";
      chip.style.top=Math.max(8,e.clientY-46)+"px";chip.classList.add("on");
      const off=ev=>{if(!chip.contains(ev.target))chip.classList.remove("on");};
      setTimeout(()=>document.addEventListener("pointerdown",off,{once:true}),0);
    }
  });
  chip.querySelector("#scPar").onclick=()=>{chip.classList.remove("on");const p=panel();p.classList.add("on");
    if(!window.__WORKS&&BLOB)fetch(BLOB+"/v1/works-index.json").then(r=>r.json()).then(d=>{window.__WORKS=d.works||[];}).catch(()=>{window.__WORKS=[];});
    loadText(selTxt);};
  chip.querySelector("#scAsk").onclick=()=>{chip.classList.remove("on");
    const q='Regarding the passage “'+selTxt.slice(0,240)+(selTxt.length>240?"…":"")+'” — ';
    if(window.__openAsk)window.__openAsk(q);};
  // panel follows the reading position: when open in page mode, refresh after the reader settles on a new page
  let _rt=null;
  addEventListener("scroll",()=>{chip.classList.remove("on");
    if(!pn||!pn.classList.contains("on")||txtMode)return;
    clearTimeout(_rt);_rt=setTimeout(()=>{if(pn.classList.contains("on")&&!txtMode&&cur&&cur!==lastPg)load(cur);},1400);
  },{passive:true});
  function setRelOpen(open){const p=panel();
    if(!open){cancelRelated();clearTimeout(_fT);clearTimeout(_rt);}
    p.classList.toggle("on",open);
    p.setAttribute("aria-hidden",open?"false":"true");
    btn.setAttribute("aria-pressed",open?"true":"false");   // the CSS active-dot keys off this
  }
  window.__frSetRelOpen=setRelOpen;
  btn.onclick=()=>{const p=panel();
    if(p.classList.contains("on")){setRelOpen(false);return;}
    setRelOpen(true);txtMode=false;
    // lazy works index for titles/authors on the result cards
    if(!localRelatedPreview()&&!window.__WORKS&&BLOB){fetch(BLOB+"/v1/works-index.json").then(r=>r.json()).then(d=>{window.__WORKS=d.works||[];if(pn?.classList.contains('on')&&!txtMode&&String(cur)===String(lastPg))load(lastPg);}).catch(()=>{window.__WORKS=[];});fetch(BLOB+"/v1/titles_en.json").then(r=>r.json()).then(d=>{window.__TEN=d||{};}).catch(()=>{window.__TEN={};});}
    if(cur)load(cur);};
})();
const _mobSz=matchMedia("(max-width:880px)").matches;   // phones read smaller by default — more text per screen
let rdsz=+lsGet(_mobSz?"fr_rdsz_m":"fr_rdsz")||(_mobSz?17:21),imz=+lsGet("fr_imz")||100;
function applySz(){const rd=$("#reading");rd.style.fontSize=rdsz+"px";rd.style.setProperty("--rdszm",rdsz+"px");if($("#tzs"))$("#tzs").value=rdsz;lsSet(_mobSz?"fr_rdsz_m":"fr_rdsz",rdsz);}
function applyImz(){app.style.setProperty("--imz",imz+"%");if($("#izs"))$("#izs").value=imz;lsSet("fr_imz",imz);}
$("#tzs").oninput=e=>{rdsz=+e.target.value;applySz();};
$("#szDn")&&($("#szDn").onclick=()=>{rdsz=Math.max(14,rdsz-1);applySz();});
$("#szUp")&&($("#szUp").onclick=()=>{rdsz=Math.min(34,rdsz+1);applySz();});
$("#izs").oninput=e=>{window.__imzManual=1;const _fc=$("#facs");if(_fc)_fc.style.removeProperty("--imz");imz=+e.target.value;applyImz();};
{const zi=$("#fzIn"),zo=$("#fzOut");
 const man=()=>{window.__imzManual=1;const fc=$("#facs");if(fc)fc.style.removeProperty("--imz");};
 if(zi)zi.onclick=()=>{man();imz=Math.min(400,imz+20);applyImz();};
 if(zo)zo.onclick=()=>{man();imz=Math.max(50,imz-20);applyImz();};}
// per-lane sizes: Latin and English scale independently around the base size (Study/Parallel)
let lasz=+lsGet("fr_lasz")||100, ensz=+lsGet("fr_ensz")||100;
function applyLaneSizes(){$("#reading").style.setProperty("--lasz",(lasz/100).toFixed(2));
  // RENAMED from applyLanes (2026-07-12): the duplicate declaration shadowed the REAL lane
  // switcher at ~1827 via function hoisting — every lane toggle silently ran this instead.
  $("#reading").style.setProperty("--ensz",(ensz/100).toFixed(2));
  if($("#lzs"))$("#lzs").value=lasz;if($("#ezs"))$("#ezs").value=ensz;
  lsSet("fr_lasz",lasz);lsSet("fr_ensz",ensz);}
applyLaneSizes();
$("#lzs")&&($("#lzs").oninput=e=>{lasz=+e.target.value;applyLaneSizes();});
$("#ezs")&&($("#ezs").oninput=e=>{ensz=+e.target.value;applyLaneSizes();});
$("#lzs")&&($("#lzs").ondblclick=()=>{lasz=100;applyLaneSizes();});
$("#ezs")&&($("#ezs").ondblclick=()=>{ensz=100;applyLaneSizes();});
// adjustable la∥en column split: drag the gap between the columns; double-click resets.
// Default gives English (the primary reading text, ~15% wordier) the larger share.
let lar=+lsGet("fr_split")||0.44;
function applySplit(){lar=Math.min(.75,Math.max(.25,lar));
  app.style.setProperty("--laf",lar.toFixed(3)+"fr");app.style.setProperty("--enf",(1-lar).toFixed(3)+"fr");
  app.style.setProperty("--lar",lar.toFixed(3));lsSet("fr_split",lar.toFixed(3));}
applySplit();
window.__mkGrip=function(){const rd=$("#reading");if(!rd||$("#colgrip"))return;   // build() wipes #reading -> re-attach after every build
  const grip=document.createElement("div");grip.id="colgrip";
  grip.title="Drag to resize the Latin ∥ English columns · double-click to reset";
  rd.appendChild(grip);let gdn=false;
  grip.addEventListener("pointerdown",e=>{gdn=true;grip.setPointerCapture(e.pointerId);document.body.classList.add("gripping");e.preventDefault();});
  grip.addEventListener("pointermove",e=>{if(!gdn)return;const r=rd.getBoundingClientRect();lar=(e.clientX-r.left)/r.width;applySplit();});
  const up=()=>{gdn=false;document.body.classList.remove("gripping");};
  grip.addEventListener("pointerup",up);grip.addEventListener("pointercancel",up);
  grip.addEventListener("dblclick",()=>{lar=0.44;applySplit();});};
window.__mkGrip();
applySz();applyImz();
// reading theme — Light / Sepia / Dark (persisted; honors prefers-color-scheme until first choice)
const THEMES=["light","sepia","dark"],thIcon=t=>t==="sepia"?"☼":t==="dark"?"☾":"◐";
function applyTheme(t){document.documentElement.setAttribute("data-theme",t);lsSet("fr_theme",t);for(const id of ["th","thTop"]){const b=$("#"+id);if(b){b.textContent=thIcon(t);b.title="Reading theme: "+t+" — click to change";}}}
// Kindle-style reading options: body font (Serif / Sans / Easy=Atkinson Hyperlegible) + line spacing
function applyFont(f){if(f==="serif")document.documentElement.removeAttribute("data-font");
  else document.documentElement.setAttribute("data-font",f);
  lsSet("fr_font",f);
  const M={serif:"fSerif",sans:"fSans",easy:"fEasy"};
  Object.entries(M).forEach(([k,id])=>{const b=$("#"+id);if(b)b.setAttribute("aria-pressed",k===f?"true":"false");});}
function applyLH(l){if(l==="normal")document.documentElement.removeAttribute("data-lh");
  else document.documentElement.setAttribute("data-lh",l);
  lsSet("fr_lh",l);
  const M={compact:"lhC",normal:"lhN",relaxed:"lhR"};
  Object.entries(M).forEach(([k,id])=>{const b=$("#"+id);if(b)b.setAttribute("aria-pressed",k===l?"true":"false");});}
(function(){
  const f=lsGet("fr_font")||"serif",l=lsGet("fr_lh")||"normal";
  applyFont(f);applyLH(l);
  const on=(id,fn)=>{const b=$("#"+id);if(b)b.onclick=fn;};
  on("fSerif",()=>applyFont("serif"));on("fSans",()=>applyFont("sans"));on("fEasy",()=>applyFont("easy"));
  on("lhC",()=>applyLH("compact"));on("lhN",()=>applyLH("normal"));on("lhR",()=>applyLH("relaxed"));
})();
(function(){const s=lsGet("fr_theme");if(s)applyTheme(s);
else if(matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.setAttribute("data-theme","dark");const b=$("#th");if(b)b.textContent="◐";}
else{const b=$("#th");if(b)b.textContent="◐";}})();   /* OS dark by default; the Aa choice still wins (owner 2026-08-29) */
const _thCycle=()=>{const cur=document.documentElement.getAttribute("data-theme")||(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light");applyTheme(THEMES[(THEMES.indexOf(cur)+1)%THEMES.length]);};
$("#th")&&($("#th").onclick=_thCycle);
$("#thTop")&&($("#thTop").onclick=_thCycle);   /* masthead theme switch — light/dark reachable without opening Aa (owner 2026-09-05) */
// keep the content offset equal to the fixed masthead's height (it wraps taller on narrow screens)
function setPhh(){const p=$(".ph");if(p)document.documentElement.style.setProperty("--phh",p.offsetHeight+"px");}
addEventListener("resize",setPhh);new ResizeObserver(setPhh).observe($(".ph"));setTimeout(setPhh,60);setTimeout(setPhh,600);
// seamless facsimile navigation: plain wheel = pan (down/across), Ctrl/Cmd+wheel = zoom the scan
// (contained — never the browser), drag = pan. So you zoom in and still move freely.
const fst=$(".fstage");
if(fst){
  // ── FRONTIER ZOOM (owner 2026-09-04 'zooming in and out left and right natural and
  // frontier'): the point under the pointer STAYS under the pointer. Continuous
  // cursor-anchored wheel/trackpad zoom (a Mac trackpad pinch arrives as ctrl+wheel),
  // Safari gesture events, a true two-finger pinch on touch, desktop double-click
  // fit↔200%, and a fading % HUD. Any manual zoom clears the per-image autofit
  // override (the old wheel handler didn't — wheel-zoom was a silent no-op on
  // autofitted works).
  const _zman=()=>{window.__imzManual=1;const fc=$("#facs");if(fc)fc.style.removeProperty("--imz");fst.style.removeProperty("--imz");};
  let _hudT=null;
  const _zhud=v=>{let h=document.getElementById("zoomHud");
    if(!h){h=document.createElement("div");h.id="zoomHud";(fst.closest(".facs")||fst.parentElement).appendChild(h);}
    h.textContent=Math.round(v)+"%";h.classList.add("on");
    clearTimeout(_hudT);_hudT=setTimeout(()=>h.classList.remove("on"),850);};
  const zoomAt=(nz,cx,cy)=>{
    nz=Math.min(400,Math.max(50,nz));
    const r=fst.getBoundingClientRect();
    const ox=(cx-r.left+fst.scrollLeft)/Math.max(1,fst.scrollWidth),
          oy=(cy-r.top+fst.scrollTop)/Math.max(1,fst.scrollHeight);
    _zman();imz=nz;applyImz();_zhud(nz);
    // SYNCHRONOUS correction: reading scrollWidth after applyImz flushes layout at the
    // new size — an rAF here let a fast tick-chain compute anchors from a half-updated
    // pane (the point drifted under the cursor; measured 0.60→0.41 over 3 ticks)
    const w2=fst.scrollWidth,h2=fst.scrollHeight;
    fst.scrollLeft=ox*w2-(cx-r.left);
    fst.scrollTop=oy*h2-(cy-r.top);
  };
  window.__zoomAt=zoomAt;
  fst.addEventListener("wheel",e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();
    zoomAt(imz*Math.exp(-e.deltaY*0.0028),e.clientX,e.clientY);}},{passive:false}); // else: native scroll = pan
  // Safari trackpad pinch: gesture events, scale cumulative from gesturestart
  let _gz0=100;
  fst.addEventListener("gesturestart",e=>{e.preventDefault();_gz0=imz;},{passive:false});
  fst.addEventListener("gesturechange",e=>{e.preventDefault();zoomAt(_gz0*e.scale,e.clientX,e.clientY);},{passive:false});
  fst.addEventListener("gestureend",e=>e.preventDefault(),{passive:false});
  // desktop double-click: fit ↔ 200% at the cursor (mobile has double-tap below)
  fst.addEventListener("dblclick",e=>{e.preventDefault();
    if(fst.scrollWidth>fst.clientWidth+24){_zman();imz=100;applyImz();_zhud(100);fst.scrollLeft=0;}
    else zoomAt(200,e.clientX,e.clientY);});
  // true two-finger pinch: pointer-tracked, midpoint-anchored; native pan is suspended
  // for exactly the duration of the pinch
  {const _pts=new Map();let _p0=null;
   fst.addEventListener("pointerdown",e=>{if(e.pointerType!=="touch")return;
     _pts.set(e.pointerId,[e.clientX,e.clientY]);
     if(_pts.size===2){const [a,b]=[..._pts.values()];
       _p0={d:Math.hypot(a[0]-b[0],a[1]-b[1]),z:imz};fst.style.touchAction="none";}});
   fst.addEventListener("pointermove",e=>{if(e.pointerType!=="touch"||!_pts.has(e.pointerId))return;
     _pts.set(e.pointerId,[e.clientX,e.clientY]);
     if(_p0&&_pts.size===2){const [a,b]=[..._pts.values()];
       const d=Math.hypot(a[0]-b[0],a[1]-b[1]);
       if(d>10&&_p0.d>10)zoomAt(_p0.z*d/_p0.d,(a[0]+b[0])/2,(a[1]+b[1])/2);}});
   const _pdrop=e=>{_pts.delete(e.pointerId);if(_pts.size<2){_p0=null;fst.style.removeProperty("touch-action");}};
   fst.addEventListener("pointerup",_pdrop);fst.addEventListener("pointercancel",_pdrop);}
  let dn=false,sx,sy,sl,st,tx=null,ty=null;
  // jumpSettle: jump() lands the page's fmark AT the spy's probe line, so after the
  // lock expires the spy re-picked the PREVIOUS page ("stuck at p.533", 2026-08-17).
  // Nudge the scroll until the target folio's own top crosses the probe.
  window.__jumpSettle=(n)=>{const sc2=document.getElementById("scroll");
    const f=document.querySelector('#reading .folio[data-page="'+n+'"]');
    if(!sc2||!f)return;
    const ph2=document.querySelector(".ph");
    const probe=(ph2?ph2.offsetHeight:90)+12;
    const y=f.getBoundingClientRect().top-sc2.getBoundingClientRect().top;
    if(y>probe-4)sc2.scrollTop+=y-(probe-8);};
  // ── MOBILE SCAN GESTURES (2026-08-17) ─────────────────────────────────────
  (function(){
    const st=document.querySelector(".fstage");if(!st)return;
    const mobile=()=>matchMedia("(max-width:880px)").matches;
    // swipe = page turn (only when the scan is NOT zoomed past the pane width)
    let tx0=0,ty0=0,tt0=0;
    st.addEventListener("touchstart",e=>{if(e.touches.length!==1)return;
      tx0=e.touches[0].clientX;ty0=e.touches[0].clientY;tt0=Date.now();},{passive:true});
    st.addEventListener("touchend",e=>{
      window.__swDbg={m:mobile(),ct:!!(e.changedTouches&&e.changedTouches[0])};
      if(!mobile())return;
      const t=e.changedTouches&&e.changedTouches[0];if(!t)return;
      const dx=t.clientX-tx0,dy=t.clientY-ty0,dt=Date.now()-tt0;
      Object.assign(window.__swDbg,{dx,dy,dt,sw:st.scrollWidth,cw:st.clientWidth});
      if(st.scrollWidth>st.clientWidth+24)return;          // zoomed in: horizontal pan wins
      if(dt>600||Math.abs(dx)<64||Math.abs(dx)<Math.abs(dy)*1.6)return;
      window.__swDbg.fired=1;
      // in scan mode the SCAN is the page: step by the pages array and set it directly —
      // stepFolio's text-scroll can land the scroll-spy back on the boundary page.
      {const pgs=(typeof DATA!=="undefined"&&DATA)?DATA.pages:null;
       const i2=pgs?pgs.findIndex(x=>+x.n===+cur):-9;
       const nx=pgs?pgs[i2+(dx<0?1:-1)]:null;
       Object.assign(window.__swDbg,{pgsN:pgs?pgs.length:null,i2,nxn:nx?nx.n:null,curv:(typeof cur!=="undefined")?cur:"nd"});
       if(nx){window.__folioLock=Date.now()+1600;if(typeof jump==="function")jump(nx.n);
         setTimeout(()=>setFolio(nx),80);setTimeout(()=>window.__jumpSettle(nx.n),900);}}
    },{passive:true});
    // double-tap = zoom toggle (fit ↔ 2×), centered on the tap
    let lastTap=0,lastX=0,lastY=0;
    st.addEventListener("touchend",e=>{
      if(!mobile())return;
      const t=e.changedTouches&&e.changedTouches[0];if(!t)return;
      const now=Date.now();
      if(now-lastTap<320&&Math.hypot(t.clientX-lastX,t.clientY-lastY)<40){
        const cur=parseFloat(getComputedStyle(st).getPropertyValue("--imz"))||1;
        const zoomed=st.scrollWidth>st.clientWidth+24;
        if(zoomed){st.style.setProperty("--imz","100%");st.scrollLeft=0;}
        else{const rx=(t.clientX-st.getBoundingClientRect().left+st.scrollLeft)/st.scrollWidth;
          st.style.setProperty("--imz","200%");
          requestAnimationFrame(()=>{st.scrollLeft=rx*st.scrollWidth-st.clientWidth/2;});}
        lastTap=0;return;
      }
      lastTap=now;lastX=t.clientX;lastY=t.clientY;
    },{passive:true});
    // page scrubber: drag to any page, released = jump (shows "p. N · i/total" while dragging)
    const fx=document.querySelector(".facs");
    if(fx&&!document.getElementById("fscrub")){
      const sc=document.createElement("div");sc.id="fscrub";
      sc.innerHTML='<span class="fsc-n" id="fscN">&#8212;</span><input type="range" min="0" max="1" value="0" step="1" aria-label="Go to page">';
      fx.appendChild(sc);
      const rg=sc.querySelector("input"),nEl=sc.querySelector("#fscN");
      const sync=()=>{const pgs=(typeof DATA!=="undefined"&&DATA)?DATA.pages:null;if(!pgs||!pgs.length)return;
        rg.max=String(pgs.length-1);
        const ci=(typeof cur!=="undefined"&&cur!=null)?pgs.findIndex(x=>+x.n===+cur):-1;   // cur is the page NUMBER
        const cur2=ci>=0?ci:0;
        rg.value=String(cur2);nEl.textContent="p. "+(pgs[cur2]?pgs[cur2].n:"");};
      rg.addEventListener("input",()=>{const pgs=(typeof DATA!=="undefined"&&DATA)?DATA.pages:null;if(!pgs)return;
        const i2=+rg.value;nEl.textContent="p. "+(pgs[i2]?pgs[i2].n:"")+" \u00b7 "+(i2+1)+"/"+pgs.length;});
      rg.addEventListener("change",()=>{const pgs=(typeof DATA!=="undefined"&&DATA)?DATA.pages:null;if(!pgs)return;
        const pg2=pgs[+rg.value];
        if(pg2){window.__folioLock=Date.now()+1600;if(typeof jump==="function")jump(pg2.n);
          setTimeout(()=>setFolio(pg2),120);setTimeout(()=>window.__jumpSettle(pg2.n),900);}   // jump the text AND set the scan authoritatively
        setTimeout(sync,900);});
      window.__fscrubSync=sync;
      setTimeout(sync,1500);
    }
  })();
  // drag-pan is MOUSE-only: touch keeps native scrolling (touch-action pan-x pan-y) so phones pan the
  // zoomed scan with a finger; a horizontal SWIPE (image fits the width → nothing to pan) turns the page.
  fst.addEventListener("pointerdown",e=>{
    if(e.pointerType==="touch"){tx=e.clientX;ty=e.clientY;return;}
    dn=true;sx=e.clientX;sy=e.clientY;sl=fst.scrollLeft;st=fst.scrollTop;try{fst.setPointerCapture(e.pointerId);}catch(_){}fst.classList.add("grabbing");});
  fst.addEventListener("pointermove",e=>{if(!dn)return;fst.scrollLeft=sl-(e.clientX-sx);fst.scrollTop=st-(e.clientY-sy);});
  fst.addEventListener("pointerup",e=>{
    if(e.pointerType==="touch"&&tx!=null){
      const dx=e.clientX-tx,dy=e.clientY-ty;tx=ty=null;
      if(Math.abs(dx)>70&&Math.abs(dy)<50&&fst.scrollWidth<=fst.clientWidth+8)stepFolio(dx<0?1:-1);
    }
    dn=false;fst.classList.remove("grabbing");});
  fst.addEventListener("pointercancel",()=>{dn=false;tx=ty=null;fst.classList.remove("grabbing");});
}
// page nav (‹ ›, ← →) + sidebar close (×, [ )
function stepFolio(dir){const c=$("#reading").querySelector('.folio[data-page="'+cur+'"]');if(!c)return;let e=c;while(e=(dir>0?e.nextElementSibling:e.previousElementSibling)){if(e.classList&&e.classList.contains("folio")){rememberReaderChoice(e.dataset.page);jump(e.dataset.page);return;}}}  // step to the next/prev RENDERED folio (skips hidden blank pages)
$("#pPrev").onclick=()=>stepFolio(-1);$("#pNext").onclick=()=>stepFolio(1);
{const a=$("#fPrev"),b=$("#fNext");
 const stepScan=d=>{const pgs=DATA&&DATA.pages;if(!pgs)return stepFolio(d);
   const i2=pgs.findIndex(x=>String(x.n)===String(cur));const nx=pgs[i2+d];
   if(nx){rememberReaderChoice(nx.n);window.__folioLock=Date.now()+1600;jump(nx.n);setTimeout(()=>setFolio(nx),80);
     if(window.__jumpSettle)setTimeout(()=>window.__jumpSettle(nx.n),900);}};
 if(a)a.onclick=()=>stepScan(-1);if(b)b.onclick=()=>stepScan(1);}   // page-turn from the scan header (the only nav on a phone's full-screen scan)
{const pj=$("#pgJump");if(pj){const go=e=>{const value=e.target.value.trim(),exact=DATA&&DATA.pages.find(x=>String(x.n)===value),p=/^\d+$/.test(value)?Number(value):null;
   if(exact)goReaderReference(exact);   // exact printed label; a new choice replaces the arrival target
   else if(p&&DATA&&p>=1&&p<=(DATA.n_pages||0)){
     // folio lives in a shard that hasn't loaded yet (large works stream in chunks):
     // queue it as the settle target — the shard-complete rebuild jumps there (Leibniz UX 2026-07-18)
     rememberReaderChoice(p);
     if(DATA.__loadRest)DATA.__loadRest().catch(()=>{});}
   else if(DATA)e.target.value=cur||"";};
   pj.addEventListener("focus",e=>{try{e.target.select();}catch(_){}});   // click-then-type replaces the whole number
   pj.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();go(e);e.target.blur();}});
   pj.addEventListener("change",go);}}
// mobile: the on-screen keyboard shrinks only the VISUAL viewport — a 100dvh sheet keeps its
// composer underneath it. Track visualViewport and pin the open sheet to the visible height.
if(window.visualViewport&&document.documentElement.classList.contains("g-mobile")){
  const vv=window.visualViewport;
  const fit=()=>{const ov=document.querySelector(".rsov .rsp");if(!ov)return;
    const kb=innerHeight-vv.height>80;   // keyboard open
    ov.style.height=kb?vv.height+"px":"";
    if(kb){const th=document.getElementById("rsathread");if(th)th.scrollTop=th.scrollHeight;}};
  vv.addEventListener("resize",fit);vv.addEventListener("scroll",fit);
}
/* sidebar close button removed with the brand block; masthead ☰ (#sbT) + [ ] keys toggle the sidebar */
addEventListener("keydown",e=>{if(/^(TEXTAREA|INPUT|SELECT)$/.test(e.target.tagName))return;
  if(e.key==="ArrowLeft")stepFolio(-1);
  else if(e.key==="ArrowRight")stepFolio(1);
  else if(e.key==="["||e.key==="]")app.classList.toggle("nosb");});
const rz=$("#rz");let rd=false;rz.addEventListener("pointerdown",e=>{rd=true;rz.classList.add("drag");rz.setPointerCapture(e.pointerId);document.body.style.userSelect="none";});
rz.addEventListener("pointermove",e=>{if(!rd)return;app.style.setProperty("--fw",Math.min(Math.max(innerWidth-e.clientX,280),Math.max(360,innerWidth-740))+"px");});
function er(){if(!rd)return;rd=false;rz.classList.remove("drag");document.body.style.userSelect="";}rz.addEventListener("pointerup",er);rz.addEventListener("pointercancel",er);
rz.addEventListener("dblclick",()=>app.style.removeProperty("--fw"));
const light=$("#light"),limg=$("#limg");$("#fimg").onclick=function(){if(!this.src)return;limg.src=this.src;light.classList.add("open");};light.onclick=()=>light.classList.remove("open");
// a missing/unmigrated scan hides quietly instead of showing the broken-image icon
{const f=$("#fimg");f.onerror=()=>{if(!f.src)return;f.style.visibility="hidden";const ff=$("#ffol");if(ff&&!/unavailable/.test(ff.textContent))ff.textContent+=" — scan unavailable";};
 // SMART INK-FIT (owner 2026-08-28 'the reader can be better'): the raw leaf photos carry
 // wide paper margins, so the printed block floated small in the pane. Measure the ink box
 // once per image on a 96px canvas and zoom+scroll the pane to the PRINT, not the paper.
 // The outer 3% frame is ignored (fore-edge scan bands); a manual zoom disables the fit
 // for the session; blank/tainted images fall through untouched.
 const _fitInk=()=>{if(window.__imzManual)return;const st=document.querySelector(".fstage");
   if(!st||!f.naturalWidth)return;
   try{
     const W=96,H=Math.max(24,Math.round(f.naturalHeight/f.naturalWidth*96));
     const c=document.createElement("canvas");c.width=W;c.height=H;
     const g=c.getContext("2d",{willReadFrequently:true});
     g.drawImage(f,0,0,W,H);
     const d=g.getImageData(0,0,W,H).data;
     const fx=Math.round(W*0.03),fy=Math.round(H*0.03);
     const colD=new Array(W).fill(0),rowD=new Array(H).fill(0);
     for(let y=fy;y<H-fy;y++)for(let x=fx;x<W-fx;x++){
       const i=(y*W+x)*4;
       if((d[i]*0.3+d[i+1]*0.6+d[i+2]*0.1)<200){colD[x]++;rowD[y]++;}}
     const thC=(H-2*fy)*0.035,thR=(W-2*fx)*0.035;
     let x0=fx;while(x0<W-fx-1&&colD[x0]<thC)x0++;
     let x1=W-fx-1;while(x1>x0&&colD[x1]<thC)x1--;
     let y0=fy;while(y0<H-fy-1&&rowD[y0]<thR)y0++;
     if(x1-x0<W*0.25)return;
     const z=Math.min(1.7,Math.max(1,0.95*W/(x1-x0+2)));
     const fc=$("#facs");if(!fc)return;
     fc.style.setProperty("--imz",(z*100).toFixed(0)+"%");
     requestAnimationFrame(()=>{
       st.scrollLeft=Math.max(0,x0/W*f.clientWidth-10);
       st.scrollTop=Math.max(0,(y0/H)*f.clientHeight-8);});
   }catch(e){}};
 f.onload=()=>{f.style.visibility="visible";const ff=$("#ffol");if(ff)ff.textContent=ff.textContent.replace(/ — scan unavailable$/,"");_fitInk();};}
addEventListener("keydown",e=>{if(e.key==="Escape")light.classList.remove("open");});
// ---- owner review layer: inline edit + progress + mark + redo, over server.py's APIs ----
const REVIEW=location.pathname==="/the-faith-received/review/"&&!BLOB;   // local server: the /api/* admin review machinery (initReview)
const CLOUD_REVIEW=location.pathname==="/the-faith-received/review/"&&BLOB;  // deployed (Blob): a clear "Review mode" banner over the live reader — owner review = masthead ✎/✓/⚑/⟳ + double-click (Blob-authoritative)
const stripPM=s=>(s||"").replace(/\[\[p\.\d+\]\]/g,"").trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function jget(p){const r=await fetch(p);if(!r.ok)throw new Error(p+" → "+r.status);return r.json();}
async function jpost(p,b){const r=await fetch(p,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});if(!r.ok)throw new Error(p+" → "+r.status);return r.json();}
function rerenderFolio(sec,pi){if(typeof TEI_ON!=="undefined"&&TEI_ON){console.warn("[rerenderFolio] TEI-rendered work — md rebuild skipped (Reader Map #1)");return;}const pg=DATA.pages[pi],ed=sec.querySelector(".rv-edit");
  sec.querySelectorAll(".row").forEach(r=>r.remove());                       // .rapp rows are .row too — auto-cleaned
  const SL=splitApp(pg.la),SE=splitApp(pg.en);
  buildRows(blocks(SL.main),blocks(SE.main),false).nodes.forEach(n=>sec.insertBefore(n,ed));
  const ab=appBank(SL.notes,SE.notes);if(ab)sec.insertBefore(ab,ed);}
// READER-TOOLS SPLIT (owner 2026-08-18 'first-text under a second'): initReview/initSearch/
// initReaderTools (~100KB) live in /read-tools.js, loaded deferred — none run until after
// build() paints. __frTools resolves when the file lands; the boot awaits it lazily.
window.__frToolsReady=new Promise(res=>{window.__frToolsRes=res;});
window.__frLoadTools=()=>{if(window.__frToolsTag)return;window.__frToolsTag=1;
  const sc=document.createElement("script");sc.src="/assets/js/port/read-tools.js?v="+encodeURIComponent(window.__FR_VER||"local");document.body.appendChild(sc);};
function _lateInit(name){return async function(){await window.__frToolsReady;return window[name].apply(null,arguments);};}
const initReview=_lateInit("__initReview"),initSearch=_lateInit("__initSearch"),initReaderTools=_lateInit("__initReaderTools");
async function jfetch(u,tries){for(let i=0;;i++){try{const r=await fetch(u);if(!r.ok){const e=new Error("HTTP "+r.status+" "+u);if(r.status===404)e.no_retry=1;throw e;}return await r.json();}catch(e){if(e.no_retry||i>=(tries||1))throw e;await new Promise(z=>setTimeout(z,400*(i+1)));}}}

// VOLUME TRAVEL (generalized 2026-08-17): every canon work knows its tome — sidebar
// spine ("In this volume"), ‹ › adjacent tomes, end-of-work continuation. Used by the
// PL, PG and PO loaders with their own stores.
// ENGLISH AUTHOR NAMES (owner 2026-08-19 'can a user just type in Augustine — use english
// names'): canon TEI headers carry Migne's Latin ('Augustinus Hipponensis'); the corpus-wide
// alias table (v1/authors_en.json, built with runs/authors_en_map.json) maps them to the
// standard English form for the masthead. Prefetched in the early block, so the await is free.
function _auEn(a){
  if(!a)return Promise.resolve(a);
  window.__frEarly=window.__frEarly||{};
  const p=window.__frEarly.auEn||(window.__frEarly.auEn=fetch(BLOB+"/v1/authors_en.json").then(r=>r.ok?r.json():{}).catch(()=>({})));
  return p.then(m=>(m&&m[a])||a).catch(()=>a);
}
function wireVolTravel(volWord,volN,meId,prefix,store){
  if(!volN)return;
  const spineP=fetch(BLOB+"/v1/"+store+"/"+volN+".json").then(r=>r.ok?r.json():null).catch(()=>null);
  const wire=()=>{spineP.then(sp=>{
    if(!sp||!sp.works||!sp.works.length)return;
    const nav=document.getElementById("nav");
    const i=sp.works.findIndex(x=>+x.id===meId);
    if(nav&&!document.getElementById("volnav")){
      const box=document.createElement("div");box.id="volnav";
      // NESTED SPINE (owner 2026-08-18 'the site shows nested, here it is flat'):
      // when the family voltoc hierarchy is present, mirror it — work heads with their
      // chapter children indented, in the volume's printed order. Flat works[] is the
      // fallback for volumes without a harvested voltoc.
      let rows;
      const _fm=t=>/^(Admonitio|Admonition|Monitum|Praefatio|Preface|Prooemium|Index|Elenchus|Notice|Notitia|Ordo|Retractat|Editorial)/i.test(String(t||""));
      if(sp.toc&&sp.toc.length>3){
        const ranges={};(sp.works||[]).forEach(x=>{if(x.c)ranges[+x.id]=x.c;});
        let seenWork=null;
        rows=sp.toc.map(e=>{
          const lvl=Math.min(+e.lvl||0,4);
          const cur=e.id===meId&&lvl===0;
          let cc="";
          if(lvl===0&&e.id!=null&&ranges[e.id]&&seenWork!==e.id){const c=ranges[e.id];
            cc=`<span class=vnc>${c[0]===c[1]?c[0]:c[0]+"&#8211;"+c[1]}</span>`;}
          else if(e.c!=null)cc=`<span class=vnc>${e.c}</span>`;
          if(lvl===0)seenWork=e.id;
          const body=`${cc}<span class=vnt>${esc(e.t||"")}</span>`;
          const fm=lvl===0&&_fm(e.t)?" vnfm":"";
          if(e.id==null)return `<span class="vnrow vnd${lvl} off${fm}">${body}</span>`;
          return `<a class="vnrow vnd${lvl}${cur?" on":""}${fm}" target="_blank" rel="noopener" href="/the-faith-received/read/?w=${prefix}-${e.id}${e.c!=null?`#b${e.c}-0`:""}">${body}</a>`;
        }).join("");
      }else rows=sp.works.map(x=>{
        const cur=+x.id===meId;
        const cc=x.c?`<span class=vnc>${x.c[0]===x.c[1]?x.c[0]:x.c[0]+"&#8211;"+x.c[1]}</span>`:"";
        return `<a class="vnrow${cur?" on":""}${_fm(x.t)?" vnfm":""}" target="_blank" rel="noopener" href="/the-faith-received/read/?w=${prefix}-${x.id}">${cc}<span class=vnt>${esc(x.t||(prefix+"-"+x.id))}</span></a>`;}).join("");
      box.innerHTML=`<div class=vnhead><span>In this volume &#8212; ${volWord} ${volN}</span>`+
        `<span class=vnnav>${sp.prev?`<a target="_blank" rel="noopener" href="/the-faith-received/read/?w=${prefix}-${sp.prev.first}" title="${volWord} ${sp.prev.vol}">&#8249; ${volWord} ${sp.prev.vol}</a>`:""}`+
        `${sp.next?`<a target="_blank" rel="noopener" href="/the-faith-received/read/?w=${prefix}-${sp.next.first}" title="${volWord} ${sp.next.vol}">${volWord} ${sp.next.vol} &#8250;</a>`:""}</span></div>`+rows;
      nav.appendChild(box);
      // NEVER scrollIntoView here: #nav is the SHARED scroll container — centering the
      // volume row dragged the outline 8,800px away from the reader's position on every
      // canon work (Opus audit P0). Center the OUTLINE's active node; the volume list
      // keeps its own place below it.
      const onN=nav.querySelector(".nav-node.on");
      if(onN)nav.scrollTop=Math.max(0,onN.offsetTop-nav.clientHeight/3);
      else nav.scrollTop=0;
    }
    const R=document.getElementById("reading");
    if(R&&!document.getElementById("volnext")){
      const nx=i>=0?sp.works[i+1]:null;
      const band=document.createElement("div");band.id="volnext";
      const nxUrl=nx?`/the-faith-received/read/?w=${prefix}-${nx.id}`:(sp.next?`/the-faith-received/read/?w=${prefix}-${sp.next.first}`:null);
      band.innerHTML=nx
        ?`<span class=vk>Next in ${volWord} ${volN}</span><a href="${nxUrl}">${esc(nx.t||"")} &#8250;</a>`
        :(sp.next?`<span class=vk>End of ${volWord} ${volN}</span><a href="${nxUrl}">Continue into ${volWord} ${sp.next.vol} &#8250;</a>`:"");
      if(band.innerHTML)R.appendChild(band);
      // CONTINUOUS VOLUME SCROLLING (owner 2026-08-27): scrolling past the end of a work
      // flows into the next one — once the band is in view, a deliberate further
      // downward scroll (350px accumulated) advances in the SAME tab.
      if(nxUrl){
        const hint=document.createElement("div");
        hint.style.cssText="text-align:center;font:600 .72rem/1 var(--sans);color:var(--muted);margin:-1.6rem 0 2.4rem;opacity:.7";
        hint.textContent="keep scrolling to continue";
        band.after(hint);
        let armed=false,acc=0,fired=false;
        try{new IntersectionObserver(es=>{es.forEach(x=>{armed=x.isIntersecting;if(!x.isIntersecting)acc=0;});},{threshold:.9}).observe(band);}catch(e){}
        const go=()=>{if(fired)return;fired=true;hint.textContent="continuing\u2026";location.href=nxUrl;};
        window.addEventListener("wheel",ev=>{if(!armed||fired)return;
          if(ev.deltaY>0){acc+=ev.deltaY;if(acc>350)go();}else acc=0;},{passive:true});
        let ty=null;
        window.addEventListener("touchstart",ev=>{ty=ev.touches[0].clientY;},{passive:true});
        window.addEventListener("touchmove",ev=>{if(!armed||fired||ty==null)return;
          const dy=ty-ev.touches[0].clientY;
          if(dy>0){acc+=dy;ty=ev.touches[0].clientY;if(acc>350)go();}},{passive:true});
      }
    }
  });};
  const t=setInterval(()=>{if(window.__readerBuilt){clearInterval(t);wire();}},700);
  setTimeout(()=>clearInterval(t),30000);
}
// SOURCE-LANE SELECTOR (PG/PO): the source column can carry more than one witness —
// PG: Greek (vision) · Latin (Migne's facing column) · OCR (the scholarios diplomatic
// floor the graeca site never exposed); PO: the original script · the fascicle's printed
// translation. Rendered as quiet links in the sidebar; switching reloads with ?src=.
function wireSrcSel(options,cur){
  const t=setInterval(()=>{const nav=document.getElementById("nav");
    if(!nav||!window.__readerBuilt)return;clearInterval(t);
    if(document.getElementById("srcsel"))return;
    const box=document.createElement("div");box.id="srcsel";
    const u=new URL(location.href);
    box.innerHTML='<div class=sshead>Source column</div>'+options.map(o=>{
      u.searchParams.set("src",o.v);
      return `<a class="ssopt${o.v===cur?" on":""}" href="${u.pathname+u.search}">${o.l}</a>`;}).join("");
    nav.insertBefore(box,nav.firstChild);
  },600);
  setTimeout(()=>clearInterval(t),30000);
}
async function loadPldCanon(ws){
  const id=ws.slice(4);
  const [xml,toc]=await Promise.all([
    ((window.__frEarly&&window.__frEarly.canon)?window.__frEarly.canon.catch(()=>fetch(BLOB+"/v1/tei/pld/"+id+".xml").then(r=>{if(!r.ok)throw new Error("canon "+r.status);return r.text();})):fetch(BLOB+"/v1/tei/pld/"+id+".xml").then(r=>{if(!r.ok)throw new Error("canon "+r.status);return r.text();})),
    fetch(BLOB+"/v1/pldtoc/"+id+".json").then(r=>r.ok?r.json():{}).catch(()=>({}))]);
  const doc=new DOMParser().parseFromString(xml,"application/xml");
  if(doc.querySelector("parsererror"))throw new Error("canon parse");
  const gt=(sel)=>{const e=doc.querySelector(sel);return e?e.textContent.trim():"";};
  const title=gt("titleStmt > title")||("PL "+id);
  const author_la=gt("titleStmt > author")||"", author=await _auEn(author_la);
  const vol=(()=>{const e=[...doc.querySelectorAll("idno")].find(x=>x.getAttribute("type")==="PL-volume");return e?("PL "+e.textContent.trim()):"";})();
  const IS_PL_INDEX=/^PL 2(1[89]|2[01])$/.test(vol);   // Migne's index tomes
  // Build the la/en sidecar DOMs the TEI renderer already consumes: milestones→<pb>,
  // heads→both lanes (identical-echo guard shows once), p pairs by xml:lang, unpaired→la.
  const NS="http://www.tei-c.org/ns/1.0";
  const mk=()=>{const d=document.implementation.createDocument(null,"TEI",null);
    const tx=d.createElement("text");d.documentElement.appendChild(tx);return [d,tx];};   // site sidecars put pb/p directly under <text> — teiSegment walks THAT
  const [laD,laB]=mk(),[enD,enB]=mk();
  const seen=new Set();const pages=[];const struct=[];
  // PLD milestones carry n="vol:col" ("35:1380") with one bare volume marker ("35") up
  // front. parseInt read every one as the volume number, so after the first ALL columns
  // were "seen" and the whole work rendered as ONE mega-folio (pld-2824: 3.8M chars,
  // 11s frozen). Colon format present ⇒ key on the column part, skip bare vol markers.
  const COLONFMT=[...doc.querySelectorAll("milestone")].some(m=>/:/.test(m.getAttribute("n")||""));
  const colN=raw=>{raw=String(raw||"");
    if(COLONFMT){if(!raw.includes(":"))return 0;return parseInt(raw.split(":")[1],10)||0;}
    return parseInt(raw,10)||0;};
  let depth0=null;
  const walk=(node,depth)=>{
    for(const ch of node.children){
      const ln=ch.localName;
      if(ln==="milestone"&&ch.getAttribute("unit")==="column"){
        const n=colN(ch.getAttribute("n"));
        if(n&&!seen.has(n)){seen.add(n);pages.push(n);
          for(const [d,b] of [[laD,laB],[enD,enB]]){const pb=d.createElement("pb");pb.setAttribute("n",String(n));b.appendChild(pb);}}
      }else if(ln==="head"){
        const t=ch.textContent.replace(/\s+/g," ").trim();
        // deep-TOC: prefer the family's English label for this div (xml:id w{id}-d{path})
        const did=(ch.parentElement.getAttribute("xml:id")||"").replace(/^w\d+-d/,"").replace(/_/g," ");
        const en=(toc&&toc[did])||"";
        if(depth0===null)depth0=depth;
        if(t||en)struct.push({title:(en||t).slice(0,140),page:pages.length?pages[pages.length-1]:1,depth:Math.min(Math.max(depth-depth0+1,1),5)});
        if(t){const h=laD.createElement("head");h.textContent=t;laB.appendChild(h);}
        {const h=enD.createElement("head");h.textContent=en||t;enB.appendChild(h);window.__pldLastEnHead=h;window.__pldLastEnHeadEcho=!en;}
      }else if(ln==="p"){
        const lang=ch.getAttribute("xml:lang");
        let t=ch.textContent.replace(/\s+/g," ").trim();
        // DEHYPHENATION (owner 2026-08-18 mobile screenshot 'ho- moeusion', 'un- derstanding'):
        // the canon keeps the print's line-break hyphens; a hyphen + space + lowercase
        // continuation is a break residue, never a compound — join it. Caps runs too
        // ('A PI- OUS'), where the continuation is uppercase inside an all-caps stretch.
        t=t.replace(/([A-Za-zÀ-ÿæœ])-\s+([a-zà-ÿæœ])/g,"$1$2")
           .replace(/([A-Z]{2,})-\s+([A-Z]{2,})/g,"$1$2");
        if(!t)continue;
        // INDEX-VOLUME FORMATTING (owner 2026-08-17 'one big block'): Migne's index tomes
        // (PL 218-221) print thousands of entries glued with ".--"; give each its own line.
        const parts=(IS_PL_INDEX&&t.length>500&&t.split(" .--").length>3)?t.split(/\s*\.--\s*/):[t];
        const [D,B]=lang==="en"?[enD,enB]:[laD,laB];
        // EN HEAD-TWIN PROMOTION (owner 2026-08-18 'fix the cosmetic issue'): ~10% of PLD
        // works carry the English chapter label as a plain <p> right after the Latin
        // <head> (CAPUT II. / CHAPTER II.) — the EN lane then shows the untranslated Latin
        // echo as its heading and the real translation as body text. When a bare-label EN
        // p follows a head whose EN slot was only the Latin echo, it IS the head.
        if(lang==="en"&&window.__pldLastEnHead&&window.__pldLastEnHeadEcho&&t.length<70
           &&/^(BOOK|CHAPTER|QUESTION|PART|PREFACE|PROLOGUE|SERMON|HOMILY|LETTER|EPISTLE)\b/i.test(t)
           &&!window.__pldLastEnHead.nextSibling){
          window.__pldLastEnHead.textContent=t;window.__pldLastEnHeadEcho=false;continue;}
        parts.forEach(pt=>{pt=pt.trim();if(!pt)return;const e=D.createElement("p");e.textContent=pt;B.appendChild(e);});
      }else if(ln==="div"){walk(ch,depth+1);}
    }
  };
  const body=doc.querySelector("body");if(body)walk(body,0);
  if(!pages.length)pages.push(1);
  if(IS_PL_INDEX){
    // CLICKABLE CITATIONS (owner 2026-08-17 'this is not clickable'): every "S. August.,
    // XXXIX, 2183" in an index entry resolves through the family refindex (236k
    // vol:col -> doc mappings) to the passage itself. Linkified post-render, lazily.
    window.__plrRefidx=window.__plrRefidx||fetch(BLOB+"/v1/plresearch/refindex.json").then(r=>r.ok?r.json():null).catch(()=>null);
    const ROM={i:1,v:5,x:10,l:50,c:100,d:500,m:1000};
    const romN=r=>{let n=0,p=0;for(const c of r.toLowerCase().split("").reverse()){const v=ROM[c]||0;n+=v<p?-v:v;p=Math.max(p,v);}return n;};
    const linkify=idx=>{
      document.querySelectorAll(".la p,.en p,.la,.en").forEach(elm=>{
        if(elm.dataset.plref||elm.querySelector("a.plref"))return;
        if(!/[IVXLCDM]{1,9},\s*\d/.test(elm.textContent))return;
        elm.dataset.plref="1";
        elm.innerHTML=elm.innerHTML.replace(/\b([IVXLCDM]{1,9})\b(,\s*)(\d{1,4})/g,(m,rom,sep,col)=>{
          const vol2=romN(rom);if(!vol2||vol2>221)return m;
          const doc2=idx["PL"+vol2+":"+col];
          if(doc2==null)return m;
          return `<a class=plref target="_blank" rel="noopener" href="/the-faith-received/read/?w=pld-${doc2}#b${col}-0" title="PL ${vol2}, col. ${col}">${rom}${sep}${col}</a>`;});
      });};
    window.__plrRefidx.then(idx=>{if(!idx)return;
      const tick=()=>linkify(idx);
      setTimeout(tick,1200);setTimeout(tick,3500);setTimeout(tick,8000);   // catch late-rendered folios
      document.addEventListener("scroll",()=>{clearTimeout(window.__plrT);window.__plrT=setTimeout(tick,600);},{passive:true});});
  }
  wireVolTravel("PL",(vol.match(/\d+/)||[])[0],+id,"pld","plvol");
  window.__pldCanonDocs={la:laD,en:enD};   // loadTEI consumes these instead of fetching sidecars
  return {slug:ws,title,title_en:title,author,author_la:author_la!==author?author_la:undefined,volume:vol,tradition:"Latin Fathers",
    has_pages:false,has_tei:true,tei_v:0,en_only:false,n_pages:pages.length,
    structure:struct,base:null,
    pages:pages.map(n=>({n,la:"",en:""}))};
}


// ── PG CANON (2026-08-17): Greek Fathers hydrate from tei/pg/{id}.xml. The printed page
// is a DOUBLE COLUMN — the Greek and Migne's own Latin of the same text — plus our
// English and the diplomatic OCR floor. ?src= picks the source column; facsimile URLs
// ride on every <pb facs>, so the scan pane syncs exactly like a native TFR facsimile.
// READABLE COLUMNS (owner 2026-08-17 'reader interface sucks — upgrade it'): a Migne
// column arrives as ONE wall of text per lane. Split each lane into sentence-bounded
// chunks (~600 chars) and pair them proportionally — the eye gets paragraphs again.
function _splitSents(t){
  // sentence enders incl. the Greek ano teleia (·) and erotimatiko (;) — and Greek prose
  // may continue lowercase after an ender, so no capital requirement follows · or ;
  const parts=String(t).split(/(?<=[.!?\u00b7;:\u037e\u00bb"\u201d])\s+(?=[\u00abA-Za-z\u0370-\u03ff\u1f00-\u1fff\u2018\u201c0-9])/g).filter(x=>x.trim());
  return parts;}
function _chunkText(t,target){
  const sents=_splitSents(t);
  let out=[];let cur="";
  for(const sn of (sents.length?sents:[t])){
    if(cur&&(cur.length+sn.length)>target){out.push(cur.trim());cur=sn;}
    else cur=cur?cur+" "+sn:sn;}
  if(cur.trim())out.push(cur.trim());
  // BULLETPROOF: whatever the punctuation, no chunk may remain a wall — hard-split
  // oversized survivors at word boundaries near the target.
  const final=[];
  for(const c of out){
    if(c.length<=target*2.5){final.push(c);continue;}
    const words=c.split(/\s+/);let w="";
    for(const wd of words){
      if(w&&(w.length+wd.length)>target){final.push(w);w=wd;}
      else w=w?w+" "+wd:wd;}
    if(w)final.push(w);}
  return final.length?final:[t];}
function _alignPair(laArr,enArr){
  // both lanes for ONE column → equal-count chunk lists, paired by index
  const la=laArr.join(" ").trim(),en=enArr.join(" ").trim();
  if(!la&&!en)return [];
  if(!la)return _chunkText(en,700).map(e=>["",e]);
  if(!en)return laArr.flatMap(x=>x.length>1500?_chunkText(x,900):[x.trim()]).filter(Boolean).map(l=>[l,""]);
  // the transcription's OWN paragraphs are the reading unit (owner 2026-08-17 'are we
  // formatting the transcription the best way' — re-chunking real paragraphs was not);
  // only genuine walls split, and the machine translation is shaped to those units.
  let L=laArr.flatMap(x=>x.length>1500?_chunkText(x,900):[x.trim()]).filter(Boolean);
  let E=enArr.flatMap(x=>x.length>1600?_chunkText(x,950):[x.trim()]).filter(Boolean);
  const k=Math.max(L.length,E.length);
  const stretch=(arr,n)=>{ // re-chunk to n pieces proportionally by sentences
    if(arr.length===n)return arr;
    const sents=_splitSents(arr.join(" "));if(sents.length<n)return arr.length<n?arr.concat(Array(n-arr.length).fill("")):arr.slice(0,n-1).concat([arr.slice(n-1).join(" ")]);
    const tot=sents.reduce((a,x)=>a+x.length,0);const per=tot/n;const out=[];let cur="",acc=0;
    for(const sn of sents){cur=cur?cur+" "+sn:sn;acc+=sn.length;
      if(acc>=per*(out.length+1)&&out.length<n-1){out.push(cur.trim());cur="";}}
    if(cur.trim())out.push(cur.trim());
    while(out.length<n)out.push("");
    return out;};
  L=stretch(L,k);E=stretch(E,k);
  // never hand the renderer one-sided pairs — a lane-count mismatch on any page makes it
  // collapse the WHOLE page into a .pfallback wall. Merge stragglers into neighbours.
  const pairs=L.map((l,i)=>[l||"",E[i]||""]);
  const out=[];
  for(const pr of pairs){
    const [l,e]=pr;
    if(l&&e){out.push([l,e]);continue;}
    if(!l&&!e)continue;
    if(out.length){out[out.length-1][0]+=l?" "+l:"";out[out.length-1][1]+=e?" "+e:"";}
    else out.push([l,e]);
  }
  // HARD CEILING (pg-627 86K wall): an oversize pair splits into aligned sub-pairs —
  // both sides re-chunked to the same count so lane parity survives.
  const final2=[];
  for(const [l,e] of out){
    const mx=Math.max(l.length,e.length);
    if(mx<=6000){final2.push([l,e]);continue;}
    const n=Math.ceil(mx/2000);
    const Ls=_chunkText(l,Math.ceil(l.length/n)||1),Es=_chunkText(e,Math.ceil(e.length/n)||1);
    const k2=Math.max(Ls.length,Es.length);
    for(let i2=0;i2<k2;i2++)final2.push([Ls[i2]||"\u00A0",Es[i2]||"\u00A0"]);
  }
  return final2;}
// PGZONE SIDECAR (owner 2026-08-18 'optimize speed to text'): the whole-volume pageview is
// 1-4 MB and sat on the FIRST-TEXT path of every mixed/zone work — per-work v1/pgzone/{id}.json
// (zones+facs already sliced to the work's columns, ~50-200 KB) replaces it; the volume file
// remains the fallback for works without a sidecar.
async function pgZoneSidecar(id){
  window.__pgzCache=window.__pgzCache||{};
  if(!(id in window.__pgzCache)){
    window.__pgzCache[id]=fetch(BLOB+"/v1/pgzone/"+id+".json").then(r=>r.ok?r.json():null).catch(()=>null);
  }
  return window.__pgzCache[id];
}
async function loadPgCanon(ws){
  const id=ws.slice(3);
  let _pgZone=null;   // page-keyed ColGreek zones (set when the body is mixed)
  const _healGrc=s=>String(s)
    .replace(/([\u0370-\u03FF\u1F00-\u1FFF])-\s?(?=[\u0370-\u03FF\u1F00-\u1FFF])/g,"$1")
    .replace(/\u00A1/g,"i").replace(/[{}]/g,"");

  let _zoneReplace=true;   // false = CLEAN body (owner 2026-08-18 pg-3223: dirty vol-34 zones
                           // were OVERWRITING a 99%-Greek body with Latin+apparatus glue) —
                           // zones then serve ARBITRATION only (post-walk <0.15 disagreement)
  window.__pgAuth=window.__pgAuth||fetch(BLOB+"/v1/pgauthors.json").then(r=>r.ok?r.json():{}).catch(()=>({}));
  window.__pgFetchCache=window.__pgFetchCache||{};
  const _pfc=window.__pgFetchCache[id]=window.__pgFetchCache[id]||{};
  const _cached=(k,mk)=>(_pfc[k]=_pfc[k]||mk().catch(e=>{delete _pfc[k];throw e;}));
  const [xml,toc,vtx,pgen,pggap]=await Promise.all([
    _cached("xml",()=>((window.__frEarly&&window.__frEarly.canon)?window.__frEarly.canon.catch(()=>fetch(BLOB+"/v1/tei/pg/"+id+".xml").then(r=>{if(!r.ok)throw new Error("canon "+r.status);return r.text();})):fetch(BLOB+"/v1/tei/pg/"+id+".xml").then(r=>{if(!r.ok)throw new Error("canon "+r.status);return r.text();}))),
    _cached("toc",()=>fetch(BLOB+"/v1/pgtoc/"+id+".json").then(r=>r.ok?r.json():null).catch(()=>null)),
    // the PG site's own cleaned vision transcription, per column (owner 2026-08-17
    // 'let the reader just copy the page') — staged for mixed works; absent elsewhere
    _cached("vtx",()=>fetch(BLOB+"/v1/pgvtx/"+id+".json").then(r=>r.ok?r.json():null).catch(()=>null)),
    // EN top-up sidecar (2026-08-17): column-keyed translations for the 28 works the
    // canon (and the PG site) never carried English for
    _cached("pgen",()=>fetch(BLOB+"/v1/pgen/"+id+".json").then(r=>r.ok?r.json():null).catch(()=>null)),
    // BOUNDARY-LOSS sidecar (owner 2026-08-18 'transition between works — one work ending
    // and another beginning on the same page'): the opening column(s) the canon never
    // carried, recovered from the volume pageview zones / plate vision (125 works,
    // pg-105 class — Justin's Apology opened mid-sentence at col 329)
    _cached("pggap",()=>fetch(BLOB+"/v1/pggap/"+id+".json").then(r=>r.ok?r.json():null).catch(()=>null))]);
  // the SITE vtx / gap sidecars are reading surfaces too — heal them like the canon
  const _healDeep=o=>{if(!o)return o;for(const k in o){const v=o[k];
    if(typeof v==="string")o[k]=_healGrc(v);
    else if(v&&typeof v==="object")_healDeep(v);}return o;};
  _healDeep(vtx);_healDeep(pggap);
  const doc=new DOMParser().parseFromString(xml,"application/xml");
  if(doc.querySelector("parsererror"))throw new Error("canon parse");
  // CANON TEXT HEAL (owner 2026-08-27 screenshots): line-break hyphens kept inside Greek
  // words (ὕαπι-ζόμενοι) — Greek never hyphenates internally, join them; plus the
  // Migne-OCR garble chars ({ } ¡) that are never legitimate in the canon.
  try{const w=doc.createTreeWalker(doc.documentElement,NodeFilter.SHOW_TEXT);let nd;
    const GR="[\u0370-\u03FF\u1F00-\u1FFF]";
    const reG=new RegExp("("+GR+")-\\s?(?="+GR+")","g");
    while((nd=w.nextNode())){const t=nd.nodeValue;
      if(!t||t.length<3)continue;
      let s2=t.replace(reG,"$1").replace(/\u00A1/g,"i").replace(/[{}]/g,"")
        // double-escaped entities leak as literals (owner 2026-09-01, po-170 "d&#x27;un")
        .replace(/&#x27;|&#039;|&apos;/g,"'").replace(/&quot;/g,'"')
        .replace(/&#xe9;/gi,"\u00E9").replace(/&amp;(?=[a-z#])/g,"&");
      if(s2!==t)nd.nodeValue=s2;}}catch(e){}
  const gt=sel=>{const e=doc.querySelector(sel);return e?e.textContent.replace(/\s+/g," ").trim():"";};
  const auEl=doc.querySelector("titleStmt > author");
  let author="",author_gr="";
  if(auEl){author_gr=(auEl.querySelector("persName")||{textContent:""}).textContent.trim();
    author=(auEl.childNodes[0]&&auEl.childNodes[0].textContent||auEl.textContent).replace(/\s+/g," ").trim();}
  const title=gt("titleStmt > title")||("PG "+id);
  const vol=(()=>{const e=[...doc.querySelectorAll("idno")].find(x=>x.getAttribute("type")==="PG-volume");return e?e.textContent.trim():"";})();
  const _srcParam=window.__srcOverride||new URLSearchParams(location.search).get("src");
  let src=_srcParam||"grc";
  // MOSTLY-LATIN WORKS DEFAULT TO THE PAGE TRANSCRIPTION (owner 2026-08-18 'for works that
  // are mostly latin with some greek this division by lane is very bad'): when the reading
  // body is Latin-dominant, the split lanes serve Greek fragments out of context — the
  // whole-page vtx (both columns as printed) is the faithful reading surface. Explicit
  // ?src= always wins.
  if(!_srcParam&&doc.querySelector('div[type="diplomatic"]')){
    let _lat=0,_grc=0;
    (function _cnt(node){for(const ch of node.children){
      const ty=ch.getAttribute?ch.getAttribute("type"):null;
      if(ch.localName==="div"&&(ty==="translation"||ty==="secondary"||ty==="diplomatic"))continue;
      if(ch.localName==="p"){const t=ch.textContent;
        _lat+=(t.match(/[A-Za-z]/g)||[]).length;_grc+=(t.match(/[Ͱ-Ͽἀ-῿]/g)||[]).length;}
      else if(ch.localName==="div")_cnt(ch);}})(doc.querySelector("body")||doc.documentElement);
    if(_lat+_grc>2000&&_lat>(_lat+_grc)*0.6)src="ocr";
  }
  const mk=()=>{const d=document.implementation.createDocument(null,"TEI",null);
    const tx=d.createElement("text");d.documentElement.appendChild(tx);return [d,tx];};
  const [laD,laB]=mk(),[enD,enB]=mk();
  const seen=new Set();const pages=[];const struct=[];const facs={};let depth0=null;
  [...doc.querySelectorAll("pb[facs]")].forEach(pb=>{const n=+pb.getAttribute("n");
    if(n&&!facs[n])facs[n]=pb.getAttribute("facs");});
  // the translation witness repeats as ONE DIV PER SECTION (28 in pg-658) — read them ALL
  const enByCol={};
  // a short ALL-CAPS block is a printed division rubric (Menologion "OF THE SAME MONTH. /
  // THE THIRD DAY."), never a paragraph — sentinel it as a head at EVERY EN fill site,
  // canon translation and pgen sidecar alike (owner 2026-08-31 pg-2239)
  const _capsHead=t=>{const _c=String(t).replace(/\[[^\]]{1,10}\]/g,"").replace(/\s+/g," ").trim();
    const _lets=_c.replace(/[^A-Za-z]/g,"");
    return (_c.length>=6&&_c.length<=90&&_lets.length>=5&&_lets===_lets.toUpperCase())?_c:null;};
  // carve embedded rubrics — caps runs AND the sentence-case day form — out of a paragraph
  const _RXC=/(?:^|(?<=[.!?:\u00bb]))\s*((?:[A-Z][A-Z'\u2019.\-]*[.,]?\s+){1,8}[A-Z][A-Z'\u2019.\-]*\s*[.:])(?=\s+|$)/;
  const _DAYRX=/(?:^|(?<=[.!?:\u00bb]))\s*((?:On|Of|In)\s+the\s+same\s+(?:month|day)[.,]?(?:\s+(?:the\s+)?[A-Za-z-]{3,14}\s+day\.?)?)(?=\s+[A-Z\u201c"(]|$)/i;
  // a 3-6k-char English wall reads as badly as a Greek one (owner 2026-09-03 pg-16
  // append columns): group long prose into ~800-char paragraphs at sentence ends --
  // the same law the Greek lane already applies
  const _pushEn=(s2,bucket)=>{
    if(s2.length<=1600){bucket.push(s2);return;}
    let cur="";
    s2.split(/(?<=[.!?\u201d"]) +/).forEach(sn=>{
      if(cur&&cur.length+sn.length>800){bucket.push(cur);cur=sn;}
      else cur=cur?cur+" "+sn:sn;});
    if(cur)bucket.push(cur);};
  const _carveEn=(t,bucket)=>{
    let _rest=t,_guard=0;
    while(_rest&&_guard++<12){
      const m2=_rest.match(_RXC),cand2=m2&&_capsHead(m2[1]);
      const m3=_rest.match(_DAYRX);
      let mm=null,hd=null;
      if(m2&&cand2&&(!m3||m2.index<=m3.index)){mm=m2;hd=cand2;}
      else if(m3){mm=m3;hd=m3[1].replace(/\s+/g," ").trim();}
      if(!mm){_pushEn(_rest,bucket);break;}
      const pre=_rest.slice(0,mm.index).trim();
      if(pre)_pushEn(pre,bucket);
      bucket.push("\u0001H"+hd);
      _rest=_rest.slice(mm.index+mm[0].length).trim();
    }
    return bucket;};
  let _lastEnCol=0;
  [...doc.querySelectorAll('div[type="translation"] p')].forEach(pp=>{
    let n=+(pp.getAttribute("n")||0);
    if(!n){const m=(pp.getAttribute("corresp")||"").match(/-c(\d+)/);if(m)n=+m[1];}
    if(!n)n=_lastEnCol;else _lastEnCol=n;   // unanchored p continues the previous column
    if(!n)return;
    const t=pp.textContent.replace(/\s+/g," ").trim();if(!t)return;
    // a whole-block caps line is a printed division head — 'HOMILY I' (no period, so the
    // embedded-rubric regex never fires) arrived as body text and the outline lost the
    // division (owner 2026-09-03 pg-16). Same law the pgen path already applies.
    {const _wh=_capsHead(t);
     if(_wh){(enByCol[n]=enByCol[n]||[]).push("\u0001H"+_wh);return;}}
    // the canon prints day-rubrics EMBEDDED mid-paragraph ("…rescued her from death. OF
    // THE SAME MONTH. THE THIRD DAY. The contest…") — carve every caps-run out as its own
    // head block so the aligner can never fuse a division into a paragraph
    _carveEn(t,enByCol[n]=enByCol[n]||[]);});
  // page spans (n -> next pb) for span-union of vtx and EN lanes
  const _bodyPage={};
  {let _bp=null;
   (function bt(node){for(const ch of node.children){
     const ty=ch.getAttribute?ch.getAttribute("type"):null;
     if(ch.localName==="div"&&(ty==="translation"||ty==="secondary"||ty==="diplomatic"))continue;
     if(ch.localName==="pb"||(ch.localName==="milestone"&&ch.getAttribute("unit")==="column")){const nn=+ch.getAttribute("n");if(nn)_bp=nn;}
     else if(ch.localName==="p"&&_bp!=null){const t=ch.textContent.replace(/\s+/g," ").trim();
       if(t)_bodyPage[_bp]=(_bodyPage[_bp]?_bodyPage[_bp]+" ":"")+t;}
     else if(ch.localName==="div")bt(ch);}})(doc.querySelector("body")||doc.documentElement);}
  {window.__pgPbNext={};window.__enUsed=new Set();window.__vtxApplied=new Set();window.__vtxByCanon=undefined;window.__vtxDelta=undefined;
   const pbs=[];
   (function pw(node){for(const ch of node.children){
     const ty=ch.getAttribute?ch.getAttribute("type"):null;
     if(ch.localName==="div"&&(ty==="translation"||ty==="secondary"||ty==="diplomatic"))continue;
     if(ch.localName==="pb"||(ch.localName==="milestone"&&ch.getAttribute("unit")==="column")){const nn=+ch.getAttribute("n");if(nn)pbs.push(nn);}
     else if(ch.localName==="div")pw(ch);}})(doc.querySelector("body")||doc.documentElement);
   for(let i=0;i<pbs.length;i++){if(window.__pgPbNext[pbs[i]]!==undefined)continue;
     let j=i+1;while(j<pbs.length&&pbs[j]===pbs[i])j++;
     window.__pgPbNext[pbs[i]]=j<pbs.length?pbs[j]:pbs[i]+2;}
   // PARITY-SHIFT EN (pg-1737 Cyril class, owner 2026-08-19 work-transition case): a few
   // volumes key the translation to the column AFTER the Greek it translates (verified on
   // 1737: EN[1191] 'Entirely so' = Greek[1190] 'Καὶ μάλα'). No structural signature
   // separates this class from the healthy 99.85% (tracking audit 2026-08-18), so the
   // correction is a CURATED per-work list — extend as verified reports arrive.
   {const SHIFT=new Set(["1737"]);
    if(SHIFT.has(String(id))){
      const ek=Object.keys(enByCol).map(Number).filter(Boolean).sort((a,b)=>a-b);
      const shifted={};
      ek.forEach(n=>{(shifted[n-1]=shifted[n-1]||[]).push(...enByCol[n]);});
      for(const k in enByCol)delete enByCol[k];
      Object.assign(enByCol,shifted);
    }}}
  // pgen top-up: columns the canon translation never covered take the sidecar English
  if(pgen)Object.keys(pgen).forEach(k=>{const n=+k;
    if(!n||(enByCol[n]&&enByCol[n].join("").length>120))return;
    // a '## ' line is the printed division heading (HOMILY III. On the firmament), not a
    // paragraph — mark it so the renderer sets a head and the outline can see it
    {const _out=[];
     String(pgen[k]).split(/\n\s*\n+/).forEach(t=>{t=t.trim();if(!t)return;
       if(/^#{1,6}\s/.test(t)){_out.push("\u0001H"+t.replace(/^#+\s*/,""));return;}
       const _ch=_capsHead(t);if(_ch){_out.push("\u0001H"+_ch);return;}
       _carveEn(t,_out);});
     enByCol[n]=_out;}});
  // SPREAD-FOLIO LAW (owner 2026-09-03 pg-1445 'HOMILY II … don't want the greek in the
  // middle'): the Chrysostom-commentary class keys BOTH its <pb>s and its English at the
  // opening's odd column — the milestone between two pbs is the SAME physical page.
  // Paginating per column guaranteed one page carrying all the opening's English against
  // half its Greek, then a page with Greek and none. When pbs step by 2 and the English
  // keys sit on the pbs, the even milestone continues the folio instead of opening one.
  window.__pgSpread=null;
  {const pbOnly=[];
   (function pspd(node){for(const ch of node.children){
     const ty=ch.getAttribute?ch.getAttribute("type"):null;
     if(ch.localName==="div"&&(ty==="translation"||ty==="secondary"||ty==="diplomatic"))continue;
     if(ch.localName==="pb"){const nn=+ch.getAttribute("n");if(nn&&!pbOnly.includes(nn))pbOnly.push(nn);}
     else if(ch.localName==="div")pspd(ch);}})(doc.querySelector("body")||doc.documentElement);
   if(pbOnly.length>=5){
     let s2=0;for(let i=1;i<pbOnly.length;i++)if(pbOnly[i]-pbOnly[i-1]===2)s2++;
     const ek=Object.keys(enByCol).map(Number).filter(Boolean);
     const pset=new Set(pbOnly);
     const onPb=ek.length?ek.filter(n=>pset.has(n)).length/ek.length:0;
     if(s2>=(pbOnly.length-1)*0.8&&ek.length>=5&&onPb>=0.9){
       window.__pgSpread=pset;
       for(let i=0;i<pbOnly.length;i++)window.__pgPbNext[pbOnly[i]]=i+1<pbOnly.length?pbOnly[i+1]:pbOnly[i]+2;
     }
   }}
  // VTX GAP-FILL (owner 2026-08-17 'do we use the PG pageview for vtx to account for the
  // greek and latin'): columns whose English exists but whose Greek the work file never
  // carried are re-hydrated from the volume PAGEVIEW — the diplomatic vision transcription,
  // surfaces keyed by the opening's odd column, MainText_ColGreek zones. One fetch per
  // volume, cached for the session.
  const pgpvFill={};
  {
    // mixed-body detection: strip the witness divs, then script census
    {
      const bodyEl=doc.querySelector("body");
      if(bodyEl){
        const clone=bodyEl.cloneNode(true);
        clone.querySelectorAll('div[type="translation"],div[type="secondary"],div[type="diplomatic"]').forEach(d=>d.remove());
        const t=clone.textContent;
        const g=(t.match(/[\u0370-\u03ff\u1f00-\u1fff]/g)||[]).length;
        const l=(t.match(/[A-Za-z]/g)||[]).length;
        const ratio=l/Math.max(1,l+g);
        if(ratio<0.9&&g>1500){   // any Greek work: zones are the scan-true ALIGNMENT authority (spot-check 2026-08-17: pg-658 body offset, pg-105 site-numbering offset)
          _zoneReplace=ratio>=0.10;   // essentially-pure-Greek bodies keep their own text
          const _sc=await pgZoneSidecar(id);
          if(_sc&&_sc.zones&&Object.keys(_sc.zones).length){
            _pgZone={};
            for(const k in _sc.zones){
              _pgZone[+k]=_healGrc(String(_sc.zones[k])
                .replace(/^\d+\s+[^\u0370-\u03ff]{0,120}?(?=[\u0370-\u03ff])/,"")
                .replace(/\s+\d+\s*$/,""));
            }
          }else{
          const pvW0=[...doc.querySelectorAll("witness")].find(w=>w.getAttribute("xml:id")==="pageview");
          const pvUrl0=pvW0?((pvW0.textContent.match(/https?:\/\/\S+/)||[])[0]||null):null;
          if(pvUrl0){
            try{
              window.__pgpvCache=window.__pgpvCache||{};
              window.__pgpvCache[pvUrl0]=window.__pgpvCache[pvUrl0]||fetch(pvUrl0).then(r=>r.ok?r.text():null).catch(()=>null);
              const pvXml=await window.__pgpvCache[pvUrl0];
              if(pvXml){
                const pv=new DOMParser().parseFromString(pvXml,"application/xml");
                _pgZone={};
                [...pv.querySelectorAll("surface")].forEach(sf=>{
                  const n=+sf.getAttribute("n");if(!n)return;
                  const grc=[...sf.querySelectorAll("zone")]
                    .filter(z=>(z.getAttribute("type")||"").includes("ColGreek"))
                    .map(z=>z.textContent.replace(/\s+/g," ").trim()).join(" ").trim();
                  if(grc)_pgZone[n]=_healGrc(grc
                    .replace(/^\d+\s+[^\u0370-\u03ff]{0,120}?(?=[\u0370-\u03ff])/,"")   // strip the runhead
                    .replace(/\s+\d+\s*$/,""));
                });
              }
            }catch(e){_pgZone=null;}
          }}
        }
      }
    }
    const bodyCols=new Set();
    [...doc.querySelectorAll("body pb, body milestone")].forEach(x=>{
      if(x.closest&&x.closest('div[type="translation"],div[type="secondary"],div[type="diplomatic"]'))return;
      const n=+x.getAttribute("n");if(n)bodyCols.add(n);});
    const gaps=Object.keys(enByCol).map(Number).filter(n=>!bodyCols.has(n)).sort((a,b)=>a-b);
    const pvW=[...doc.querySelectorAll("witness")].find(w=>w.getAttribute("xml:id")==="pageview");
    const pvUrl=pvW?((pvW.textContent.match(/https?:\/\/\S+/)||[])[0]||null):null;
    let gapsLeft=gaps;
    if(gaps.length&&_pgZone){
      gapsLeft=[];
      gaps.forEach(g=>{const z=_pgZone[g];
        if(z&&z.length>80)pgpvFill[g]=z;else gapsLeft.push(g);});
    }
    if(gapsLeft.length&&pvUrl){
      try{
        window.__pgpvCache=window.__pgpvCache||{};
        window.__pgpvCache[pvUrl]=window.__pgpvCache[pvUrl]||fetch(pvUrl).then(r=>r.ok?r.text():null).catch(()=>null);
        const pvXml=await window.__pgpvCache[pvUrl];
        if(pvXml){
          const pv=new DOMParser().parseFromString(pvXml,"application/xml");
          const surfs=[...pv.querySelectorAll("surface")].map(sf=>({n:+sf.getAttribute("n"),
            grc:[...sf.querySelectorAll("zone")].filter(z=>(z.getAttribute("type")||"").includes("ColGreek"))
              .map(z=>z.textContent.replace(/\s+/g," ").trim()).join(" ")})).filter(x=>x.n&&x.grc).sort((a,b)=>a.n-b.n);
          const usedSurf=new Set();
          gapsLeft.forEach(g=>{
            let best=null;for(const sf of surfs){if(sf.n<=g)best=sf;else break;}
            if(best&&!usedSurf.has(best.n)){usedSurf.add(best.n);
              pgpvFill[g]=best.grc.replace(/^\d+\s+[^\u0370-\u03ff]*?(?=[\u0370-\u03ff])/,"");}
          });
        }
      }catch(e){window.__pgDbgErr=String(e).slice(0,120);}
    }
    window.__pgDbg={gaps:gaps.length,bodyCols:bodyCols.size,enCols:Object.keys(enByCol).length,
      pvUrl:!!pvUrl,fill:Object.keys(pgpvFill).length};
  }
  let _colLa=[],_colEn=[];
  // READING-SURFACE TIDY (owner 2026-08-18 'page transcription good + read cleanly'):
  // join line-break hyphens (the facsimile shows the break; the reading text joins the
  // word — standard editorial practice), strip Migne margin letters and OCR bullets,
  // close space-before-punctuation. Display-only — the canon text is untouched.
  const _tidy=t=>{if(!t)return t;
    for(let i=0;i<2;i++)t=t.replace(/([\u0370-\u03ff\u1f00-\u1fff])-\s+([\u0370-\u03ff\u1f00-\u1fff])/g,"$1$2");
    t=t.replace(/([a-zæœ])-\s+([a-zæœ])/g,"$1$2");
    t=t.replace(/([\u0370-\u03ff\u1f00-\u1fff][\s.,;·]+)[A-Fa-f]\s+(?=[\u0370-\u03ff\u1f00-\u1fff])/g,"$1");
    t=t.replace(/\s*[\u2022\ufffd]+\s*/g," ");
    t=t.replace(/\bDigitized\s+by\s+Google\b/gi," ").replace(/\bOriginal\s+from\b[\sA-Z]{0,40}/g," ");   // scanner watermarks (owner 2026-08-27 pg-557)
    t=t.replace(/\s+([.,;·:!?\u00bb)])/g,"$1");
    return t.replace(/\s{2,}/g," ").trim();};
  // RUN-TOGETHER PRINTED HEADS + LONG ARGUMENTA (owner 2026-08-27 pg-419 'CLASS FIRST
  // EPISTLE I *Basil feigns…*'): Migne's translation runs epistle heads and italic
  // argumenta INSIDE the paragraph text — no <head> exists to fix. Sentinel them here
  // (\u0002…\u0003 = block head, \u0004…\u0005 = italic; inl() renders both). Display-only,
  // the canon is untouched. Anchored to block start / sentence end / a preceding caps
  // word so prose mentions ("in his letter…") never match.
  const _MKRE=/(^|[.!?\u00bb\u201d\u2026]\s+|[A-Z\u00c6\u0152]{2,}[.,]?\s+)((?:CLASS(?:IS|E)?\s+[A-Z]+\.?\s+)?)((?:EPISTLE|LETTER|EPISTOLA|HOMILY|HOMILIA|ORATIONS?|ORATIO|SERMONS?|SERMO|BOOK|LIBER|CHAPTER|CAPUT|CANON|PSALMUS|PSALM|CARMEN|QUAESTIO|QUESTION)\s+(?:[IVXLCD]+|\d+)[.\u2019']{0,2})(?=\s)/g;
  const _mk=t=>{if(!t)return t;
    t=t.replace(_MKRE,(m,pre,cls,ep)=>pre+(cls?"\u0002"+cls.trim()+"\u0003":"")+"\u0002"+ep+"\u0003 ");
    return t.replace(/\*([^*\n]{2,600}?)\*/g,"\u0004$1\u0005");};
  const flushCol=()=>{
    // CHOKE-POINT CARVE (owner 2026-09-03 PG audit): a dozen builders feed _colLa (canon
    // walk, zones, vtx, pggap, pageview, grcla) and several push whole columns raw — the
    // walls and fused running-titles land here regardless of path. Carve once, for the
    // Greek reading lane only: paired greek\u0006latin blocks and non-Greek witnesses
    // pass through verbatim.
    if(src==="grc"&&_colLa.length&&!_colLa._carved){
      const _out=[];
      _colLa.forEach(x=>{
        if(typeof x!=="string"||x.indexOf("\u0006")>=0||!/[\u0370-\u03ff\u1f00-\u1fff]/.test(x)){_out.push(x);return;}
        _carveGr(x,_out);});
      // the LONG leading caps-run is the printed running title — page furniture the EN
      // lane already demotes to the folio head; drop it so the letter-address rubric is
      // the one Greek head and the section aligner pairs it with the EN head 1:1
      if(_out.length>1){
        const f0=String(_out[0]||"");
        const gcaps=f0.replace(/[^\u0370-\u03FF\u1F00-\u1FFF]/g,"");
        if(gcaps.length>=30&&gcaps===gcaps.toUpperCase())_out.shift();
      }
      const _pr=_colLa._prune,_zn2=_colLa._zoned;
      _colLa=_out;_colLa._prune=_pr;_colLa._zoned=_zn2;_colLa._carved=true;
    }
    let src2=_colLa;
    if(_colLa._prune&&!_colLa._zoned){
      // page had no ColGreek zone in a mixed work — whole-cell Latin bleed pruned
      src2=_colLa.filter(t=>{const g2=(t.match(/[\u0370-\u03ff\u1f00-\u1fff]/g)||[]).length;
        const l2=(t.match(/[A-Za-z]/g)||[]).length;
        return !(t.length>60&&l2>3*g2);});
    }
    // SEGMENT AT THE PRINTED RUBRICS (owner 2026-08-31 pg-2239): the aligner re-chunks by
    // sentences, which FUSED day-rubrics into paragraphs. Both lanes now split at their
    // rubric markers (EN: \u0001H sentinels; LA: short caps runs) — when the counts agree,
    // each day/section aligns on its own and a boundary can never fuse across.
    const _enM=_colEn.map(x=>typeof x==="string"&&x.charCodeAt(0)!==1?_mk(x):x);
    const _isLaRub=t=>{const c=String(t).trim();const lets=c.replace(/[^A-Za-z]/g,"");
      if(c.length>=6&&c.length<=90&&lets.length>=5&&lets===lets.toUpperCase())return true;
      // GREEK rubrics too (2026-09-03): the choke-point carver emits caps-run rows
      // (running titles, letter addresses) — A-Za-z stripping scored them zero and the
      // aligner re-fused them into the walls it was meant to prevent
      const gl=c.replace(/[^\u0370-\u03FF\u1F00-\u1FFF]/g,"");
      return c.length>=6&&c.length<=160&&gl.length>=6&&gl===gl.toUpperCase();};
    let _pairs;
    {
      const sE=[[]],hE=[null];
      _enM.forEach(x=>{if(typeof x==="string"&&x.charCodeAt(0)===1){hE.push(x);sE.push([]);}else sE[sE.length-1].push(x);});
      const sL=[[]],hL=[null];
      src2.forEach(t=>{if(_isLaRub(t)&&sL.length<hE.length){hL.push(t);sL.push([]);}else sL[sL.length-1].push(t);});
      if(hE.length>1&&hL.length===hE.length){
        _pairs=[];
        for(let i=0;i<sE.length;i++){
          if(i>0)_pairs.push([hL[i],hE[i]]);   // the head pair rides through to the head branch below
          _pairs.push(..._alignPair(sL[i],sE[i]));
        }
      }else if(hE.length>1){
        // the LA lane has no matching caps rubric (p.189's "Die tertia" prints lowercase):
        // keep the EN heads anyway and hand each EN segment a proportional sentence-slice
        // of the Latin — the head can never fuse back into a paragraph
        const sents=_splitSents(src2.join(" ").trim());
        const totE=sE.reduce((a2,seg)=>a2+seg.join(" ").length,0)||1;
        _pairs=[];let si=0;
        for(let i=0;i<sE.length;i++){
          const isLast=i===sE.length-1;
          const share=Math.round(sents.length*(sE[i].join(" ").length/totE));
          const take=isLast?sents.slice(si):sents.slice(si,si+Math.max(share,0));
          si+=take.length;
          if(i>0)_pairs.push(["\u00A0",hE[i]]);
          const laSeg=take.join(" ").trim();
          if(laSeg||sE[i].length)_pairs.push(..._alignPair(laSeg?[laSeg]:[],sE[i]));
        }
      }else _pairs=_alignPair(src2,_enM.map(x=>(typeof x==="string"&&x.charCodeAt(0)===1)?x.slice(2):x));
    }
    _pairs.forEach(([l,e])=>{
      // A DIVISION HEADING IS A HEADING, not a paragraph (owner 2026-08-20: "make sure
      // inline headers etc for pg are good"). The English sidecar marks the printed heads
      // — HOMILY III. On the firmament — and rendering them as body text left the reading
      // lane with no divisions at all and nothing for the outline to hang on.
      if(typeof e==="string"&&e.charCodeAt(0)===1&&e[1]==="H"){
        const ht=e.slice(2).trim();
        if(ht){
          // the structural div-head ('Homilia II') is a catalogue label parked at the pb \u2014
          // the PRINTED head is the true boundary (mid-page, after the previous homily's
          // tail). When both announce the same division the printed pair wins; the echo
          // (same trailing numeral, both lanes, within the last few rows) goes.
          const _hnum=s=>{const m=String(s).toUpperCase().match(/\b([IVXLCDM]+|\d+)\b(?=[.\s]*$)/);return m?m[1]:null;};
          const hn=_hnum(ht);
          if(hn){
            const _tailH=B=>{const els=[...B.children];
              for(let i=els.length-1;i>=0&&i>=els.length-14;i--)
                if(els[i].localName==="head"&&_hnum(els[i].textContent)===hn)return els[i];
              return null;};
            const eh=_tailH(enB),lh=_tailH(laB);
            if(eh&&lh){enB.removeChild(eh);laB.removeChild(lh);
              for(let i=struct.length-1;i>=Math.max(0,struct.length-6);i--)
                if(_hnum(struct[i].title)===hn){struct.splice(i,1);break;}}
          }
          const h1=enD.createElement("head");h1.textContent=ht;enB.appendChild(h1);
          const h2=laD.createElement("head");h2.textContent=_tidy(l)||"\u00A0";laB.appendChild(h2);
          struct.push({title:ht.slice(0,140),page:pages.length?pages[pages.length-1]:1,depth:2});
          return;}
      }
      // equal block counts per page, ALWAYS — an empty side gets a placeholder cell
      // (renders as a quiet solo row, never a page-collapsing mismatch)
      // punctuation-only residue (a lone '.' after a watermark strip) is not a row
      if(!(String(l||"").replace(/[^A-Za-z0-9\u0370-\u1FFF]/g,""))&&!(String(e||"").replace(/[^A-Za-z0-9\u0370-\u1FFF]/g,"")))return;
      const el2=laD.createElement("p");el2.textContent=_mk(_tidy(l))||"\u00A0";laB.appendChild(el2);
      // harvest residue is not reading text (owner 2026-09-03 pg-1445): the site EN pages
      // carry '[alt-version omitted]' markers and bare apparatus cue letters ('A its
      // punishment', 'therefore: B *But you shall\u2026', 'shown A For by the fire') \u2014 strip
      // the marker always, a lone A\u2013F only in cue positions (after :;, before a function
      // word, or block-initial before lowercase) so the article 'A Christian' survives
      const e2=enD.createElement("p");e2.textContent=(e?_mk(e.replace(/\bDigitized\s+by\s+Google\b/gi," ").replace(/\s*\[alt-version omitted\]\s*/g," ").replace(/(^|[a-z][;:] )[A-F] (?=[A-Z\u201c"*])/g,"$1").replace(/([a-z][.,;:] )[A-F] (?=\u0004)/g,"$1").replace(/^[A-F] (?=[a-z])/,"").replace(/\b[A-F] (?=\u0004?(?:For|But|And|When|Then|Thus|Yet|Nor|Therefore|Moreover|Wherefore|The|This|That|These|Those|Saint|Holy)\b)/g,"").replace(/([.!?\u201d"]) [A-F]$/,"$1").replace(/([a-z])-\s+([a-z])/g,"$1$2").replace(/\s*[\u2022\ufffd]+\s*/g," ").replace(/\s+([.,;:!?\u00bb)])/g,"$1").replace(/\s{2,}/g," ").trim()):"")||"\u00A0";enB.appendChild(e2);});
    const _pr=_colLa._prune;_colLa=[];_colEn=[];_colLa._prune=_pr;};
  // PG READABILITY (owner 2026-09-03 audit: canon columns render as 2-5k-char walls with
  // the printed running titles fused in): carve UPPERCASE-GREEK rubric runs out as their
  // own blocks, then group the rest into ~700-char paragraphs at Greek sentence terminals
  // (the same law the vtx lane already applies).
  const _parasG=t=>{const out=[];let cur="";
    String(t).split(/(?<=[.;\u0387!?])\s+/).forEach(sn=>{
      if(cur&&cur.length+sn.length>700){out.push(cur);cur=sn;}
      else cur=cur?cur+" "+sn:sn;});
    if(cur)out.push(cur);return out;};
  const _GRCAPS=/((?:[\u0391-\u03A9\u1F08-\u1FFC\u0386-\u038F][\u0391-\u03A9\u1F08-\u1FFC\u0386-\u038F'\u2019.,\u0374\u00b4\u02b9\u0384\u1fbd()\d\u2014\u2013-]*\s+){2,14}[\u0391-\u03A9\u1F08-\u1FFC\u0386-\u038F][\u0391-\u03A9\u1F08-\u1FFC'\u2019.\u0374\u00b4\u02b9\u0384\u1fbd()\d]*\s*[.:]?)(?![\u0370-\u03ff\u1f00-\u1fff])/;
  const _carveGr=(t0,bucket)=>{
    let _rest=String(t0),_g=0;
    while(_rest&&_g++<10){
      const m=_rest.match(_GRCAPS);
      if(!m||m[1].replace(/[^\u0391-\u03A9\u1F08-\u1FFC]/g,"").length<8)break;
      const pre=_rest.slice(0,m.index).trim();
      if(pre)_parasG(pre).forEach(x=>bucket.push(x));
      bucket.push(m[1].replace(/\s+/g," ").trim());
      _rest=_rest.slice(m.index+m[0].length).trim();
    }
    if(_rest)_parasG(_rest).forEach(x=>bucket.push(x));
  };
  const addPb=n=>{if(!n||seen.has(n))return;
    // spread-folio: the even milestone is the same physical page — no flush, no new page,
    // the opening's Greek keeps flowing into the current folio
    if(window.__pgSpread&&!window.__pgSpread.has(n)){seen.add(n);return;}
    flushCol();seen.add(n);pages.push(n);
    for(const [D,B] of [[laD,laB],[enD,enB]]){const pb=D.createElement("pb");pb.setAttribute("n",String(n));B.appendChild(pb);}
    // EN SPAN-UNION (owner 2026-08-18 'matching vol by col'): opening-keyed canons carry
    // EN under BOTH columns of the opening — consume every EN column in [n .. nextPb-1],
    // and mark them so the tail loop can't re-append them as orphan pages.
    _colEn=[];{
      const nx=(window.__pgPbNext&&window.__pgPbNext[n])||n+1;
      for(let k=n;k<nx;k++){if(enByCol[k]&&enByCol[k].length){_colEn.push(...enByCol[k]);(window.__enUsed=window.__enUsed||new Set()).add(k);}}
      if(!_colEn.length&&enByCol[n])_colEn=(enByCol[n]||[]).slice();
    }
    // witness lanes (?src=la|ocr) take the walked witness VERBATIM — the vtx/zone/
    // pageview machinery below is Greek-reading-lane authority only (2026-08-18:
    // it was injecting pageview Greek into the Latin witness on every even column)
    if(src!=="grc"){_colLa._prune=false;return;}
    // PAGE-KEYED SOURCE (owner 2026-08-17 'the PG site doesn't have these issues —
    // everything is keyed by page'): when the volume pageview has this opening's
    // layout-zoned Greek column, it IS the source text — the mixed vision/OCR body
    // is bypassed entirely for this page (deterministic column separation).
    _colLa._prune=!!_pgZone&&_zoneReplace;
    // ALIGNMENT AUTHORITY = the zone (derived from the very scan shown beside the text).
    // The site vtx is cleaner typography — used only at the offset that MATCHES the zone.
    const _zn=_pgZone&&_pgZone[n]&&_pgZone[n].length>200?_pgZone[n]:null;
    const _sh=(t,k)=>{t=(t||"").replace(/[^\u0370-\u03ff\u1f00-\u1fff]/g,"");const o=new Set();
      for(let i=0;i+12<=t.length;i+=3)o.add(t.slice(i,i+12));return o;};
    const _ov=(a,b)=>{const A=_sh(a),B2=_sh(b);if(!A.size||!B2.size)return 0;
      let c=0;A.forEach(x=>{if(B2.has(x))c++;});return c/Math.min(A.size,B2.size);};
    if(window.__vtxByCanon===undefined&&vtx){
      // SPAN-UNION vtx assembly (owner 2026-08-18 'do whatever is needed — perfect'):
      // the canon may key OPENINGS (odd pbs only) while the site keys individual COLUMNS —
      // a scalar offset silently drops half of every opening (pg-3223). Each canon page
      // takes the JOIN of all site columns in its span [n .. nextPb-1], at the best
      // work-level offset verified against the body (clean works) or zones (mixed).
      window.__vtxByCanon=null;
      try{
        const refMap={};let curN=null;const pbList=[];
        (function bw(node){for(const ch of node.children){
          const ty=ch.getAttribute?ch.getAttribute("type"):null;
          if(ch.localName==="div"&&(ty==="translation"||ty==="secondary"||ty==="diplomatic"))continue;
          if(ch.localName==="pb"||(ch.localName==="milestone"&&ch.getAttribute("unit")==="column")){const nn=+ch.getAttribute("n");if(nn){curN=nn;if(!pbList.includes(nn))pbList.push(nn);}}
          else if(ch.localName==="p"&&curN)refMap[curN]=(refMap[curN]||"")+" "+ch.textContent;
          else if(ch.localName==="div")bw(ch);}})(doc.querySelector("body")||doc.documentElement);
        // spread-folio: vtx spans must cover the whole opening [pb .. nextPb-1], so the
        // span list is the pb-only list — otherwise the folio's Greek is one column short
        if(window.__pgSpread){const pl2=pbList.filter(n2=>window.__pgSpread.has(n2));
          if(pl2.length){pbList.length=0;pbList.push(...pl2);}}
        let ref=_zoneReplace&&_pgZone?_pgZone:refMap;
        const spanOf=(i)=>{const a=pbList[i];const b=i+1<pbList.length?pbList[i+1]-1:a+1;return [a,Math.max(a,b)];};
        const assemble=(i,d)=>{const [a,b]=spanOf(i);const out=[];
          for(let k=a+d;k<=b+d;k++){const t=vtx[String(k)];if(t&&t.length>60)out.push(t);}
          return out.join(" ");};
        let best=null;
        for(const d of [0,-1,1,-2,2,-3,3,-5,5,-12,12]){
          let sc=0,tries=0;
          for(let i=0;i<Math.min(16,pbList.length);i++){
            const t=assemble(i,d),r=ref[pbList[i]];
            if(!t||!r||_sh(r).size<4)continue;
            sc+=_ov(t,r);tries++;
          }
          if(tries>=2&&(best===null||sc/tries>best[1]))best=[d,sc/tries];
        }
        if((!best||best[1]<0.3)&&ref!==refMap){
          // dirty volume zones can veto a good site map — re-verify against the body itself
          ref=refMap;best=null;
          for(const d of [0,-1,1,-2,2,-3,3,-5,5,-12,12]){
            let sc=0,tries=0;
            for(let i=0;i<Math.min(16,pbList.length);i++){
              const t=assemble(i,d),r=ref[pbList[i]];
              if(!t||!r||_sh(r).size<4)continue;
              sc+=_ov(t,r);tries++;
            }
            if(tries>=2&&(best===null||sc/tries>best[1]))best=[d,sc/tries];
          }
        }
        if(best&&best[1]>=0.3){
          const map={};
          for(let i=0;i<pbList.length;i++){const t=assemble(i,best[0]);if(t.length>120)map[pbList[i]]=t;}
          window.__vtxByCanon=map;window.__vtxDelta=best[0];
        }else window.__vtxDelta=null;
      }catch(e){window.__vtxByCanon=null;}
    }
    const _vt=(window.__vtxByCanon&&window.__vtxByCanon[n])?window.__vtxByCanon[n]:null;
    // GOOD INLINE FORMATTING (owner 2026-08-18): the site text arrives as one flat run —
    // group sentences into ~700-char paragraphs at Greek sentence terminals so the lane
    // reads as prose paragraphs, not a wall or arbitrary chunk cuts.
    const _paras=t=>{const out=[];let cur="";
      t.split(/(?<=[.;·!?])\s+/).forEach(sn=>{
        if(cur&&cur.length+sn.length>700){out.push(cur);cur=sn;}
        else cur=cur?cur+" "+sn:sn;});
      if(cur)out.push(cur);return out;};
    if(_vt&&(!_zoneReplace||!_zn||(_ov(_vt,_zn)>=0.3&&_vt.length>=_zn.length*0.45))){_carveGr(_vt,_colLa);_colLa._zoned=true;(window.__vtxApplied=window.__vtxApplied||new Set()).add(n);}
    else if(_zn&&_zoneReplace){
      // zone = page-keying authority; the BODY's text wins when it covers the same page
      // (complete, Greek-dominant, agreeing) — canon/vision text is cleaner than zone OCR
      const bt=_bodyPage[n]||"";
      const bg=(bt.match(/[\u0370-\u03ff\u1f00-\u1fff]/g)||[]).length;
      const bl=(bt.match(/[A-Za-z]/g)||[]).length;
      if(bt.length>=_zn.length*0.85&&bg>bl&&_ov(bt,_zn)>=0.2){_carveGr(bt,_colLa);}
      else{_carveGr(_zn,_colLa);}
      _colLa._zoned=true;}
    else if(typeof pgpvFill!=="undefined"&&typeof pgpvFill[n]==="string"&&pgpvFill[n].length>40)_carveGr(pgpvFill[n],_colLa);};
  // DIALOGUE-TURN heads (Cyril's dialogi, pg-1737 class): the canon encodes each speaker
  // turn ('Α— …' / 'Β— Καὶ μάλα') as <head> — the family site renders them as TEXT. A
  // single-letter speaker tag + dash is prose, not structure: keep it in the lane as a
  // paragraph and OUT of the Contents.
  const _isTurn=t=>/^[Α-ΩA-B]\s*[—–-]\s/.test(t);
  const addHead=(t,depth)=>{flushCol();if(depth0===null)depth0=depth;
    if(!t)return;
    if(_isTurn(t)){_colLa.push(t);return;}
    struct.push({title:t.slice(0,140),page:pages.length?pages[pages.length-1]:1,depth:Math.min(Math.max(depth-depth0+1,1),5)});
    const h=laD.createElement("head");h.textContent=t;laB.appendChild(h);
    const h2=enD.createElement("head");h2.textContent=t;enB.appendChild(h2);};
  const hasSecondary=!!doc.querySelector('div[type="secondary"]');
  const hasDipl=!!doc.querySelector('div[type="diplomatic"]');
  // OFFER THE COLUMNS THE PRINT HAS (owner 2026-09-11 pg-1938 'this has greek
  // and latin, why does only greek appear'): wireSrcSel existed but was never
  // called — the Latin facing column sat in the TEI unreachable.
  {const _pvW0=[...doc.querySelectorAll("witness")].find(w=>w.getAttribute("xml:id")==="pageview");
   const _opts=[{v:"grc",l:"Greek (as printed)"}];
   if(hasSecondary||_pvW0)_opts.push({v:"la",l:"Latin — Migne’s facing column"});
   if(_pvW0)_opts.push({v:"grcla",l:"Greek · Latin, per opening"});
   if(hasDipl)_opts.push({v:"ocr",l:"Page transcription"});
   if(_opts.length>1)wireSrcSel(_opts,src);}
  // BACKFILLED BODY BEATS THE WITNESS FLOOR (owner 2026-09-04 pg-1891): the zone
  // backfill gives the body full column coverage — and a Latin-heavy backfill flips the
  // script census to 'ocr', which switched the build to a diplomatic witness covering a
  // FRACTION of the columns (every other page rendered English-only). When the body
  // carries clearly more column anchors than the chosen witness, the body is the source.
  const _witColsN=(sel)=>[...doc.querySelectorAll(`div[type="${sel}"] pb, div[type="${sel}"] milestone`)].length;
  const _bodyColsN=[...doc.querySelectorAll("body pb, body milestone")].filter(x=>!(x.closest&&x.closest('div[type="translation"],div[type="secondary"],div[type="diplomatic"]'))).length;
  const _witRicher=(sel)=>_bodyColsN<=_witColsN(sel)*1.2;
  if((src==="la"&&hasSecondary&&_witRicher("secondary"))||(src==="ocr"&&hasDipl&&_witRicher("diplomatic"))){
    const walk2=(node,depth)=>{for(const ch of node.children){
      const ln=ch.localName;
      if(ln==="milestone"&&ch.getAttribute("unit")==="column")addPb(+ch.getAttribute("n"));
      else if(ln==="pb")addPb(+ch.getAttribute("n"));
      else if(ln==="head")addHead(ch.textContent.replace(/\s+/g," ").trim(),depth);
      else if(ln==="p"){const t=ch.textContent.replace(/\s+/g," ").trim();
        if(t)_carveGr(t,_colLa);}
      else if(ln==="div")walk2(ch,depth+1);}};
    // the witness repeats as ONE DIV PER COLUMN BLOCK — walk them all, in document order
    [...doc.querySelectorAll(src==="la"?'div[type="secondary"]':'div[type="diplomatic"]')].forEach(d2=>walk2(d2,0));
  }else{
    const body=doc.querySelector("body");
    const walk=(node,depth)=>{for(const ch of node.children){
      const ln=ch.localName,ty=ch.getAttribute?ch.getAttribute("type"):null;
      if(ln==="div"&&(ty==="translation"||ty==="secondary"||ty==="diplomatic"))continue;
      if(ln==="pb")addPb(+ch.getAttribute("n"));
      else if(ln==="milestone"&&ch.getAttribute("unit")==="column")addPb(+ch.getAttribute("n"));
      else if(ln==="head")addHead(ch.textContent.replace(/\s+/g," ").trim(),depth);
      else if(ln==="p"){if(!_colLa._zoned){
        // THE TRANSCRIPTION KNOWS ITS PARAGRAPHS (owner 2026-09-03 pg-1445 'so please
        // figure it out'): vision-era canon <p>s carry real \n\n breaks — the homily head
        // (ΟΜΙΛΙΑ Β΄.), the lemma and each paragraph arrive pre-segmented; flattening the
        // whitespace re-fused the homily boundary into a wall. A band marker
        // (== COL 25 (BOTTOM) ==) is a splice seam, not text; a critical-apparatus block
        // (ᵃ Morel…) is not reading text — the scan and the source lane carry it.
        String(ch.textContent).split(/\n\s*\n+/).forEach(bk=>{
          const t=bk.replace(/\s+/g," ").trim();
          if(!t)return;
          if(/^=+\s*COL\b.{0,30}=+$/i.test(t))return;
          if(/^[ᵃᵇᶜᵈᵉᶠ]/.test(t)||(t.length<700&&(t.match(/[A-Za-z]/g)||[]).length>8&&/(Alius|Morel|Savil|deest|Duo mss|Erasm|in solo|codd\.)/.test(t)))return;
          _carveGr(t,_colLa);});
      }}
      else if(ln==="div")walk(ch,depth+1);}};
    // MIGNE'S FACING LATIN (owner 2026-08-27 'account for both greek and latin'): most PG
    // canons never carried the secondary Latin witness, but the volume pageview transcribes
    // it per opening — MainText_ColLatin zones keyed by the opening's odd column. ?src=la
    // builds the source lane from those zones, paired with the span-union English, so the
    // reader offers Greek | Latin like the print does. Falls back to the Greek walk (and an
    // honest lane label) when the volume carries no Latin zones.
    let _latBuilt=false;
    window.__pgLatFallback=false;
    if(src==="grcla"||(src==="la"&&(!hasSecondary||!_witRicher("secondary")))){
      // grcla = the pageview parallel BY DEFINITION; src=la uses it whenever the secondary
      // witness is thin (owner 2026-09-04 pg-1844: a single Sirmond excerpt div made
      // hasSecondary true, the parallel path was skipped, and "Greek · Latin" showed no
      // Latin at all while the volume pageview carries ColLatin on every surface)   // grcla = the MIGNE PARALLEL: Greek with its Latin under-voice, per opening (owner 2026-08-28 'how greek + latin interact with migne')
      const pvW3=[...doc.querySelectorAll("witness")].find(w=>w.getAttribute("xml:id")==="pageview");
      const pvUrl3=pvW3?((pvW3.textContent.match(/https?:\/\/\S+/)||[])[0]||null):null;
      if(pvUrl3)try{
        window.__pgpvCache=window.__pgpvCache||{};
        window.__pgpvCache[pvUrl3]=window.__pgpvCache[pvUrl3]||fetch(pvUrl3).then(r=>r.ok?r.text():null).catch(()=>null);
        const pvXml3=await window.__pgpvCache[pvUrl3];
        if(pvXml3){
          const pv3=new DOMParser().parseFromString(pvXml3,"application/xml");
          // this work's column window — its own pbs, else its EN columns (NEVER the whole volume)
          const cols3=[];
          (function cw(node){for(const ch of node.children){
            const ty3=ch.getAttribute?ch.getAttribute("type"):null;
            if(ch.localName==="div"&&(ty3==="translation"||ty3==="secondary"||ty3==="diplomatic"))continue;
            if(ch.localName==="pb"||(ch.localName==="milestone"&&ch.getAttribute("unit")==="column")){const nn=+ch.getAttribute("n");if(nn)cols3.push(nn);}
            else if(ch.localName==="div")cw(ch);}})(doc.querySelector("body")||doc.documentElement);
          if(!cols3.length)cols3.push(...Object.keys(enByCol).map(Number).filter(Boolean));
          if(cols3.length){
            const lo3=Math.min(...cols3)-1,hi3=Math.max(...cols3)+1;
            const _paras3=t=>{const out=[];let cur="";
              t.split(/(?<=[.;!?])\s+/).forEach(sn=>{
                if(cur&&cur.length+sn.length>700){out.push(cur);cur=sn;}
                else cur=cur?cur+" "+sn:sn;});
              if(cur)out.push(cur);return out;};
            const surfs3=[...pv3.querySelectorAll("surface")].map(sf=>({n:+sf.getAttribute("n"),
              lat:[...sf.querySelectorAll("zone")].filter(z=>(z.getAttribute("type")||"").includes("ColLatin"))
                .map(z=>z.textContent.replace(/\s+/g," ").trim()).join(" ").trim(),
              grc:[...sf.querySelectorAll("zone")].filter(z=>(z.getAttribute("type")||"").includes("ColGreek"))
                .map(z=>z.textContent.replace(/\s+/g," ").trim()).join(" ").trim()}))
              .filter(x=>x.n&&(x.lat.length>40||(src==="grcla"&&x.grc.length>40))&&x.n>=lo3&&x.n<=hi3).sort((a,b)=>a.n-b.n);
            window.__grclaDbg={surfs:surfs3.length,pv:!!pvXml3,cols:cols3.length};
            if(surfs3.length){
              _latBuilt=true;
              surfs3.forEach(sf=>{
                flushCol();
                if(!seen.has(sf.n)){seen.add(sf.n);pages.push(sf.n);
                  for(const [D,B] of [[laD,laB],[enD,enB]]){const pb=D.createElement("pb");pb.setAttribute("n",String(sf.n));B.appendChild(pb);}}
                // sentinel the printed heads FIRST — the runhead strip below must never eat
                // an EPISTOLA marker (measured on pgpv 032: 'S. BASILII MAGNI EPISTOLA II.')
                let lt=_mk(sf.lat.replace(/^\d[\d:. ]*\s+/,""));
                // leading page furniture peels in layers on boundary pages (pg-557 427:
                // runhead + '(cod.' apparatus fragments before the text proper) — up to 3 passes
                for(let _st=0;_st<3;_st++){const _b4=lt;
                  lt=lt.replace(/^[A-Z\u00c6\u0152][A-Z\u00c6\u0152\d .,'\u2019:-]{5,60}?\s(?=\u0002|\(|[A-Z\u00c6\u0152]?[a-z\u00e6\u0153])/,"");
                  lt=lt.replace(/^(?:\(cod\.?[^)]{0,16}\)?\.?\s*){1,4}/,"");
                  if(lt===_b4)break;}
                lt=lt.replace(/\s[A-E](?=\s+[a-z\u00e6\u0153])/g,"").replace(/\s[A-E](?=\s+[a-z\u00e6\u0153])/g,"");   // Migne margin letters, incl. A B pairs
                _colLa=[];_colLa._prune=false;
                if(src==="grcla"){
                  // the print's own pairing: Greek authoritative, Migne's Latin beneath it —
                  // aligned per paragraph by the same proportional aligner the EN lane uses
                  let gt=_healGrc(sf.grc.replace(/^\d+\s+[^\u0370-\u03ff]{0,120}?(?=[\u0370-\u03ff])/,"").replace(/\s+\d+\s*$/,""));
                  _alignPair(_paras3(gt),_paras3(lt)).forEach(([g2,l2])=>{
                    _colLa.push((g2||"")+(l2?"\u0006"+l2:""));});
                }else lt.split(/(?<=[.!?])\s+(?=[A-Z\u00c6\u0152]{2,}(?:\s+[A-Z\u00c6\u0152]{2,}\.?)+)/)
                  .forEach(seg2=>_paras3(seg2).forEach(t2=>_colLa.push(t2)));
                _colEn=[];
                for(let k3=sf.n;k3<sf.n+2;k3++){if(enByCol[k3]&&enByCol[k3].length){_colEn.push(...enByCol[k3]);(window.__enUsed=window.__enUsed||new Set()).add(k3);}}
              });
              flushCol();
            }
          }
        }
      }catch(e){window.__grclaErr=String(e&&e.stack||e).slice(0,300);}
      window.__pgLatFallback=!_latBuilt;
    }
    // BOUNDARY HEAL: the recovered opening column(s) lead the reading order, before the
    // canon's own first pb — the work now begins where it begins on the plate
    if(!_latBuilt&&pggap){Object.keys(pggap).map(Number).filter(Boolean).sort((a,b)=>a-b).forEach(n=>{
      const t=String(pggap[n]||"");if(t.length<60)return;
      addPb(n);
      // the sidecar is CURATED (prev-work tail already cut, vision-cleaned) — it wins
      // over the raw zone the addPb machinery may have pushed for this column
      _colLa.length=0;_colLa._zoned=true;_carveGr(t,_colLa);});}
    // MARKERLESS CANON + sidecar EN (owner 2026-08-18 'want en to read well'): open the
    // page BEFORE the walk so source and translation pair on one folio — otherwise the
    // walked text flushes ahead of the synthesized pb and the lanes render as two walls.
    // SECONDARY-ONLY CANON (owner 2026-08-18: index/anthology docs whose whole body is one
    // witness div rendered BLANK — the walk skips witness divs): when no reading content
    // exists outside witness divs, the largest witness div IS the document — walk it.
    let wroot=body;
    if(body){
      const rd=[...body.children].some(ch=>!(ch.localName==="div"&&["translation","secondary","diplomatic"].includes(ch.getAttribute("type")||"")));
      if(!rd){let best=null;
        for(const ch of body.children){const L=(ch.textContent||"").length;if(!best||L>best[0])best=[L,ch];}
        if(best)wroot=best[1];}
    }
    if(wroot&&!wroot.querySelector("pb,milestone")&&!pages.length){
      const ks=Object.keys(enByCol).map(Number).filter(Boolean);
      addPb(ks.length?Math.min(...ks):1);}
    if(wroot&&!_latBuilt)walk(wroot,0);
  }
  flushCol();
  // BODY-vs-SCAN arbitration (pg-658 class): where the body's Greek disagrees with the
  // zone of ITS OWN page, the zone (scan-true) replaces it — the English + facsimile
  // already agree with the zone, so this restores three-lane alignment.
  if(_pgZone&&src==="grc"&&_zoneReplace){
    // pages built from the SITE vtx (body-verified) are FINAL — the zones never overrule them
    const zsh=t=>{t=(t||"").replace(/[^\u0370-\u03ff\u1f00-\u1fff]/g,"");const o=new Set();
      for(let i=0;i+12<=t.length;i+=3)o.add(t.slice(i,i+12));return o;};
    const kids=[...laB.childNodes];let pgN2=null,buf2=[],els=[];
    const arb=()=>{if(pgN2==null||!els.length)return;if(window.__vtxApplied&&window.__vtxApplied.has(pgN2))return;
      const zn3=_pgZone[pgN2];if(!zn3||zn3.length<200)return;
      const A=zsh(buf2.join(" ")),Z2=zsh(zn3);
      if(!A.size)return;
      let c=0;A.forEach(x=>{if(Z2.has(x))c++;});
      if(c/Math.min(A.size,Z2.size)<0.15){
        const ref=els[els.length-1].nextSibling;
        els.forEach(e2=>e2.remove());
        _chunkText(zn3,900).forEach(t2=>{const e2=laD.createElement("p");e2.textContent=_tidy(t2);
          laB.insertBefore(e2,ref||null);});
      }};
    kids.forEach(k=>{if(k.localName==="pb"){arb();pgN2=+k.getAttribute("n");buf2=[];els=[];}
      else if(k.localName==="p"&&pgN2!=null){buf2.push(k.textContent||"");els.push(k);}});
    arb();
  }
  // columns whose English exists but whose source lane never page-broke: append them in
  // column order so no translation is silently dropped (pg-658 lost 43 of 63 columns).
  Object.keys(enByCol).map(Number).filter(n=>!seen.has(n)&&!(window.__enUsed&&window.__enUsed.has(n))).sort((a,b)=>a-b).forEach(n=>{addPb(n);});
  flushCol();
  // FACS-CARRIER PRUNE (owner 2026-08-18 'vtx/en/facs should track by design'): Migne
  // canons emit <pb> for the PAGE (facs carrier) and key the Greek to the column
  // <milestone> right after it — the pb's own column is the facing LATIN column. A pb
  // whose folio would be empty in BOTH lanes is page furniture, not a content page:
  // drop it and hand its facs to the next real page (pg-1837: 285 empty folios).
  {const prune=(B)=>{const out=[];let curPb=null,has=false;
     for(const k of [...B.childNodes]){
       if(k.localName==="pb"){if(curPb!==null)out.push([curPb,has]);curPb=k;has=false;}
       else if(k.localName==="p"&&(k.textContent||"").trim().length>0)has=true;}
     if(curPb!==null)out.push([curPb,has]);return out;};
   const laHas={} ,enHas={};
   prune(laB).forEach(([pb,h])=>{laHas[+pb.getAttribute("n")]=h;});
   prune(enB).forEach(([pb,h])=>{enHas[+pb.getAttribute("n")]=h;});
   const dead=pages.filter(n=>!laHas[n]&&!enHas[n]);
   if(dead.length&&dead.length<pages.length*0.7){
     const deadSet=new Set(dead);
     for(const B of [laB,enB]){
       [...B.childNodes].forEach(k=>{if(k.localName==="pb"&&deadSet.has(+k.getAttribute("n")))B.removeChild(k);});}
     for(let i=0;i<pages.length;i++){
       if(!deadSet.has(pages[i]))continue;
       const nx2=pages.slice(i+1).find(n=>!deadSet.has(n));
       if(nx2!==undefined&&facs[pages[i]]&&!facs[nx2])facs[nx2]=facs[pages[i]];}
     for(let i=pages.length-1;i>=0;i--)if(deadSet.has(pages[i]))pages.splice(i,1);
   }}
  // OPENING MERGE (owner 2026-08-27 pg-3084 'trouble to sync col with english'): Migne's
  // pb carries the facing-LATIN column and the Greek rides the milestone AFTER it — the
  // opening's EN lands on the pb folio and its Greek on the next, reading as two
  // half-empty pages. When adjacent folios are STRICTLY complementary (one-sided,
  // opposite ways), fuse them into the first — pure structure, no text touched.
  {const _has=(B)=>{const m={};let cur=null,h=false;
     for(const k of [...B.childNodes]){
       if(k.localName==="pb"){if(cur!==null)m[cur]=m[cur]||h;cur=+k.getAttribute("n");h=false;}
       else if((k.localName==="p"||k.localName==="head")&&(k.textContent||"").replace(/\u00A0/g,"").trim().length>0)h=true;}
     if(cur!==null)m[cur]=m[cur]||h;return m;};
   const laH=_has(laB),enH=_has(enB);
   for(let i=0;i<pages.length-1;i++){
     const a=pages[i],b2=pages[i+1];
     if(b2!==a+1)continue;
     const comp=(laH[a]&&!enH[a]&&!laH[b2]&&enH[b2])||(!laH[a]&&enH[a]&&laH[b2]&&!enH[b2]);
     if(!comp)continue;
     for(const B of [laB,enB])
       [...B.childNodes].forEach(k=>{if(k.localName==="pb"&&+k.getAttribute("n")===b2)B.removeChild(k);});
     if(!facs[a]&&facs[b2])facs[a]=facs[b2];
     pages.splice(i+1,1);
     // RE-PAIR the fused folio: its cells were built as one-sided placeholders per half —
     // gather both lanes' real texts and align them side by side again
     const _coll=(B)=>{const ts=[];let on=false;
       for(const k of [...B.childNodes]){
         if(k.localName==="pb"){on=(+k.getAttribute("n")===a);continue;}
         if(on&&k.localName==="p"){const t=(k.textContent||"").replace(/\u00A0/g,"").trim();
           if(t)ts.push(k.textContent);k.remove();}}
       return ts;};
     const _laT=_coll(laB),_enT=_coll(enB);
     const _ref=(B)=>{let on=false;
       for(const k of [...B.childNodes]){
         if(k.localName==="pb"){if(on)return k;if(+k.getAttribute("n")===a)on=true;}}
       return null;};
     const _rl=_ref(laB),_re=_ref(enB);
     _alignPair(_laT,_enT).forEach(([l2,e2])=>{
       const p1=laD.createElement("p");p1.textContent=l2||"\u00A0";laB.insertBefore(p1,_rl);
       const p2=enD.createElement("p");p2.textContent=e2||"\u00A0";enB.insertBefore(p2,_re);});
   }}
  if(!pages.length)pages.push(1);
  // PG OUTLINE IN ENGLISH (owner 2026-08-31 pg-584 "the toc in greek..."): the in-body
  // outline mixes the Greek TEI heads (Λόγος ζ Φορεῖον ἐποίησεν…) with the translation's
  // printed heads (HOMILY VII), unpaired and case-ragged. Pair them BY NUMERAL — Greek
  // letter-numeral ↔ roman numeral — into one English-first entry, keep the Greek incipit
  // (it is the verse being expounded), synthesize the English label for divisions the
  // printed translation left unheaded, and translate the common Greek division words.
  (function(){
    const GNUM={"α":1,"β":2,"γ":3,"δ":4,"ε":5,"ϛ":6,"στ":6,"ς":6,"ζ":7,"η":8,"θ":9,"ι":10,
      "ια":11,"ιβ":12,"ιγ":13,"ιδ":14,"ιε":15,"ιϛ":16,"ις":16,"ιζ":17,"ιη":18,"ιθ":19,"κ":20,
      "κα":21,"κβ":22,"κγ":23,"κδ":24,"κε":25,"κϛ":26,"κς":26,"κζ":27,"κη":28,"κθ":29,"λ":30};
    const RNUM=t=>{const m=String(t).match(/\b([IVXL]+)\b/);if(!m)return 0;
      const V={I:1,V:5,X:10,L:50};let n=0;const r=m[1];
      for(let i=0;i<r.length;i++){const c=V[r[i]],d=V[r[i+1]]||0;n+=c<d?-c:c;}return n;};
    const GDIV={"Λόγος":"Discourse","Ὁμιλία":"Homily","Ομιλία":"Homily","Πρόλογος":"Prologue",
      "Προοίμιον":"Proem","Ἐπίλογος":"Epilogue","Κεφάλαιον":"Chapter","Ἐπιστολή":"Epistle",
      "Βίβλος":"Book","Βιβλίον":"Book","Θεωρία":"Contemplation","Προθεωρία":"Introduction"};
    const tidy=t=>String(t||"").replace(/^[\s\-–—·•]+/,"").replace(/[,;·]?\s*(\.{3}|…)\s*$/,"").replace(/\s+/g," ").trim();
    const caseEn=t=>{const s=tidy(t).replace(/\.+$/,"");
      if(!/[A-Z]/.test(s)||s.replace(/[^A-Za-z]/g,"").length<4)return s;
      const up=s.replace(/[^A-Za-z]/g,"");if(up!==up.toUpperCase())return s;
      // ALL-CAPS printed head → title case, roman numerals kept
      return s.toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase())
        .replace(/\b(?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)\b/gi,m=>m.toUpperCase());};
    const isGr=t=>/[Ͱ-Ͽἀ-῿]/.test(t);
    // classify + number every entry
    const info=struct.map(e=>{
      const t=tidy(e.title);let kind=null,num=0,rest=t;
      if(isGr(t)){
        const m=t.match(/^([Ͱ-Ͽἀ-῿]+)\s+([Ͱ-Ͽἀ-῿]{1,2})[΄'ʹ.]?\s*(.*)$/);
        if(m&&GDIV[m[1]]&&GNUM[m[2].toLowerCase()]!==undefined){kind=GDIV[m[1]];num=GNUM[m[2].toLowerCase()];rest=m[3]||"";}
        else{const w=t.match(/^([Ͱ-Ͽἀ-῿]+)\s*(.*)$/);
          if(w&&GDIV[w[1]]){kind=GDIV[w[1]];rest=w[2]||"";}}
        return {e,gr:true,kind,num,rest,t};
      }
      const m=t.match(/^(HOMILY|ORATION|DISCOURSE|SERMON|EPISTLE|LETTER|BOOK|CHAPTER)\b/i);
      return {e,gr:false,kind:m?caseEn(m[1]):null,num:RNUM(t),rest:"",t:caseEn(t)};
    });
    // the printed translation's dominant division word (Homily for pg-584) wins over the
    // generic Λόγος→Discourse mapping, so paired and unpaired entries agree
    const enKinds=info.filter(x=>!x.gr&&x.kind&&x.num).map(x=>x.kind);
    const domEn=enKinds.sort((a,b)=>enKinds.filter(k=>k===b).length-enKinds.filter(k=>k===a).length)[0]||null;
    const out=[];const used=new Set();
    info.forEach((x,i)=>{
      if(used.has(i))return;
      if(x.gr&&x.num){
        // find the EN printed head with the same numeral within ±6 pages
        const j=info.findIndex((y,k)=>!used.has(k)&&k!==i&&!y.gr&&y.num===x.num&&Math.abs((y.e.page||0)-(x.e.page||0))<=6);
        const kind=(j>=0?info[j].kind:null)||domEn||x.kind||"Discourse";
        if(j>=0)used.add(j);
        out.push({title:(kind+" "+x.num+(x.rest?" · "+x.rest:"")).slice(0,140),
          page:j>=0?Math.min(x.e.page||1,info[j].e.page||1):(x.e.page||1),depth:x.e.depth||1});
        return;}
      if(x.gr&&x.kind){
        // an UNNUMBERED Greek division (pg-584's sixth Λόγος prints no numeral) still pairs
        // with an adjacent numbered printed head — absorb it so the run stays "Homily 6".
        // Sermon-type divisions ONLY: a Πρόλογος must never be swallowed by "Homily I".
        const j=/^(Discourse|Homily|Oration|Sermon)$/.test(x.kind)?info.findIndex((y,k)=>!used.has(k)&&k!==i&&!y.gr&&y.num&&y.kind&&Math.abs((y.e.page||0)-(x.e.page||0))<=6):-1;
        if(j>=0){used.add(j);out.push({title:(info[j].kind+" "+info[j].num+(x.rest?" · "+x.rest:"")).slice(0,140),
          page:Math.min(x.e.page||1,info[j].e.page||1),depth:x.e.depth||1});return;}
        out.push({title:(x.kind+(x.rest?" · "+x.rest:"")).slice(0,140),page:x.e.page||1,depth:x.e.depth||1});return;}
      if(!x.gr&&x.num&&x.kind){
        // EN head whose Greek twin follows later — absorb it now so it doesn't duplicate
        const j=info.findIndex((y,k)=>!used.has(k)&&k!==i&&y.gr&&y.num===x.num&&Math.abs((y.e.page||0)-(x.e.page||0))<=6);
        if(j>=0){used.add(j);out.push({title:(x.kind+" "+x.num+(info[j].rest?" · "+info[j].rest:"")).slice(0,140),
          page:Math.min(x.e.page||1,info[j].e.page||1),depth:info[j].e.depth||x.e.depth||1});return;}
        // standalone printed head: same arabic style as its paired siblings (Homily VI → Homily 6)
        const m2=x.t.match(/^(\w+)\s+[IVXL]+\.?\s*(.*)$/);
        out.push({title:(m2?(x.kind+" "+x.num+(m2[2]?" · "+m2[2]:"")):x.t).slice(0,140),page:x.e.page||1,depth:x.e.depth||1});return;}
      out.push({title:(x.gr?tidy(x.t):x.t).slice(0,140),page:x.e.page||1,depth:x.e.depth||1});
    });
    if(out.length){struct.length=0;out.forEach(e=>struct.push(e));}   // struct is const — mutate, never reassign
  })();
  // TOC quality (owner 2026-08-17 'make sure the tocs are good'): the family voltoc,
  // sliced to this work's columns, beats sparse in-body heads — use it when it exists.
  let structure=struct;
  if(toc&&toc.length>1){
    const d0=Math.min(...toc.map(e=>e.lvl||0));
    structure=toc.map(e=>({title:String(e.t).slice(0,140),page:(src==="la"&&e.c)?(e.c%2?e.c:e.c-1):e.c,depth:Math.min(Math.max((e.lvl||0)-d0+1,1),5)}));
  }
  const pv=[...doc.querySelectorAll("witness")].find(w=>w.getAttribute("xml:id")==="pageview");
  window.__PGPV_URL=pv?((pv.textContent.match(/https?:\/\/\S+/)||[])[0]||null):null;
  // FACS BACKFILL (owner 2026-08-17 'does it match where the work is on the facsimile'):
  // milestone-derived pages carry no facs — the pageview's surface map knows every
  // opening's image (verified identical where both exist: 318/318). Fill the gaps.
  if(pages.some(n=>!facs[n])){
    try{
      const _sc2=await pgZoneSidecar(id);
      if(_sc2&&_sc2.facs&&Object.keys(_sc2.facs).length){
        const sm={};for(const k in _sc2.facs)sm[+k]=_sc2.facs[k];
        pages.forEach(n=>{if(!facs[n])facs[n]=sm[n%2===1?n:n-1]||sm[n]||null;});
      }else if(window.__PGPV_URL){
        window.__pgpvCache=window.__pgpvCache||{};
        window.__pgpvCache[window.__PGPV_URL]=window.__pgpvCache[window.__PGPV_URL]||fetch(window.__PGPV_URL).then(r=>r.ok?r.text():null).catch(()=>null);
        const pvXml=await window.__pgpvCache[window.__PGPV_URL];
        if(pvXml){
          const sm={};
          for(const mm of pvXml.matchAll(/<surface[^>]*n="(\d+)"[^>]*facs="([^"]+)"/g))sm[+mm[1]]=mm[2];
          pages.forEach(n=>{if(!facs[n])facs[n]=sm[n%2===1?n:n-1]||sm[n]||null;});
        }
      }
    }catch(e){}
  }
  // LAST-RESORT DERIVATION (owner 2026-08-26 pg-250 'scan unavailable' at col 837): every
  // PG scan lives as mg{vol}_{oddcol}.jpg in ONE directory per work — a column the canon,
  // zone sidecar and pageview all miss (the pggap opening-column class: the work opens at
  // 837 but the first canon pb is 839) gets its URL rewritten from any known neighbour.
  // A wrong guess 404s into the reader's graceful "scan unavailable", no worse than today.
  if(pages.some(n=>!facs[n])){
    const kv=Object.values(facs).find(u=>/_(\d{3,5})\.(jpg|jpeg|png|webp)(\?|$)/i.test(u||""));
    if(kv){const mm=kv.match(/_(\d{3,5})\.(jpg|jpeg|png|webp)/i);const pad=mm[1].length;
      pages.forEach(n=>{if(!facs[n]){const t=(n%2===1?n:n-1);
        facs[n]=kv.replace(/_(\d{3,5})\.(jpg|jpeg|png|webp)/i,"_"+String(t).padStart(pad,"0")+".$2");}});}
  }
  wireVolTravel("PG",vol,+id,"pg","pgvol");
  // ?src=ocr (the whole page transcription, both columns as printed) stays a quiet power URL;
  // the Latin witness gets a REAL pill (owner 2026-08-18 'the whole vtx is important')
  // ALL MIGNE VIEWS VISIBLE FROM T=0 (owner 2026-09-04 'i want all the options available
  // at the beginning in a pg volume'): every PG volume has a pageview, so the source
  // views are pills up front — Greek | Latin | Greek·Latin — each an in-place switch,
  // the active one highlighted. The old single cycle-pill appeared only after an
  // interaction (gated on a lazily-set __PGPV_URL) and named just one next view.
  setTimeout(()=>{const mp=document.getElementById("m-par");
    if(!mp)return;
    mp.textContent=src==="ocr"?"Page transcription":(src==="grcla"&&!window.__pgLatFallback)?"Greek \u00b7 Latin":(src==="la"&&!window.__pgLatFallback)?"Latin (Migne)":"Greek";
    const mkPill=(pid,ps,label,title)=>{
      let b=document.getElementById(pid);
      if(!b){b=document.createElement("button");b.id=pid;mp.after(b);}
      b.textContent=label;b.title=title;
      b.classList.toggle("srcon",src===ps);
      b.setAttribute("aria-pressed",src===ps?"true":"false");
      b.onclick=()=>{if(src===ps)return;
        if(window.__switchSrc)window.__switchSrc(ps);
        else{const u=new URL(location.href);u.searchParams.set("src",ps);location.href=u.toString();}};
      return b;};
    // insert in reverse so document order reads: [Greek] [Latin] [Greek·Latin]
    mkPill("m-wit2","grcla","Greek \u00b7 Latin","The Migne parallel: Greek with its Latin beneath, per opening — as the printed page lays them");
    mkPill("m-wit","la","Latin","Migne's facing Latin column — the other half of the printed page");
    mkPill("m-wit0","grc","Greek","The Greek reading text");
    let choices=document.getElementById('reader-witnesses');
    if(!choices){choices=document.createElement('div');choices.id='reader-witnesses';choices.className='reader-witnesses';choices.innerHTML='<span>Source edition</span><div role="group" aria-label="Source edition"></div>';document.getElementById('aaPop').appendChild(choices);}
    for(const id of ['m-wit0','m-wit','m-wit2'])choices.querySelector('div').appendChild(document.getElementById(id));
    if(typeof DATA!=='undefined'&&DATA)syncReaderHeader(cur||DATA.pages[0]?.n);
  },800);
  try{const am=await window.__pgAuth;if(am&&am[id])author=am[id];}catch(e){}   // English byline (owner 2026-08-17)
  window.__SRCNAME=src==="grcla"?(window.__pgLatFallback?"Greek":"Greek \u00b7 Latin"):src==="la"?(window.__pgLatFallback?"Greek":"Latin"):src==="ocr"?"Page":"Greek";
  // polytonic face for the Greek reading lane (lazily; Cardo covers Greek+Latin so mixed
  // apparatus pages stay coherent)
  try{
    if(src!=="la"){document.getElementById("app").classList.add("grcwork");
      if(!document.getElementById("grcFont")){const l=document.createElement("link");
        l.id="grcFont";l.rel="stylesheet";
        l.href="https://fonts.googleapis.com/css2?family=Cardo:ital,wght@0,400;0,700;1,400&display=swap";
        document.head.appendChild(l);}}
  }catch(e){}
  window.__pldCanonDocs={la:laD,en:enD};
  const _aula=author;author=await _auEn(author);
  return {slug:ws,title,title_en:title,author:author||author_gr,author_la:_aula&&_aula!==author?_aula:undefined,volume:vol?("PG "+vol):"",
    tradition:"Greek Fathers",has_pages:true,has_tei:true,tei_v:0,en_only:false,
    n_pages:pages.length,structure:structure,base:null,spine_nav:structure.length>1,
    pages:pages.map(n=>({n,la:"",en:"",img:facs[n]||null,thumb:facs[n]||null}))};
}
// ── PO CANON (2026-08-17): Eastern Fathers hydrate from tei/po/{id}.xml — page-keyed
// sibling triples: the original script, the fascicle's printed translation, our English.
// The facsimile arrives as ordered page SEGMENTS (v1/pofacs sidecar) and stacks in the
// scan pane. ?src= swaps the source column between original and printed translation.
async function loadPoCanon(ws){
  const id=ws.slice(3);
  const [xml,facsMap,povtx,poen,pofx2]=await Promise.all([
    ((window.__frEarly&&window.__frEarly.canon)?window.__frEarly.canon.catch(()=>fetch(BLOB+"/v1/tei/po/"+id+".xml").then(r=>{if(!r.ok)throw new Error("canon "+r.status);return r.text();})):fetch(BLOB+"/v1/tei/po/"+id+".xml").then(r=>{if(!r.ok)throw new Error("canon "+r.status);return r.text();})),
    fetch(BLOB+"/v1/pofacs/"+id+".json").then(r=>r.ok?r.json():null).catch(()=>null),
    // the PO site's own original-script text, page-keyed — harvested for thin-lane works
    fetch(BLOB+"/v1/povtx/"+id+".json").then(r=>r.ok?r.json():null).catch(()=>null),
    // EN top-up sidecar (2026-08-17): page-keyed translations for the handful of works
    // whose canon (and the PO site) carry no English
    fetch(BLOB+"/v1/poen/"+id+".json").then(r=>r.ok?r.json():null).catch(()=>null),
    // page-cut sidecar (2026-08-28): printed page -> one clean image of the original text,
    // cut at the render's own orange page chips — family-PO reads like every other shelf
    fetch(BLOB+"/v1/pofacs2/"+id+".json").then(r=>r.ok?r.json():null).catch(()=>null)]);
  // the SITE sidecars are reading surfaces too — heal them like the canon.
  // FIX 2026-08-28 (owner: "ReferenceError: vtx is not defined" on po-285): this block was
  // copied from loadPgCanon and kept ITS variable names — `vtx`/`pggap` do not exist here
  // (PO reads povtx/poen), and `_healGrc` is scoped inside loadPgCanon. Both threw before
  // the first paint, so EVERY Patrologia Orientalis work failed to load. Own the helper,
  // heal the right sidecars.
  const _healGrcPo=s=>String(s)
    .replace(/([\u0370-\u03FF\u1F00-\u1FFF])-\s?(?=[\u0370-\u03FF\u1F00-\u1FFF])/g,"$1")
    .replace(/\u00A1/g,"i").replace(/[{}]/g,"");
  const _healDeep=o=>{if(!o)return o;for(const k in o){const v=o[k];
    if(typeof v==="string")o[k]=_healGrcPo(v);
    else if(v&&typeof v==="object")_healDeep(v);}return o;};
  _healDeep(povtx);_healDeep(poen);
  // OCR LINE-NOISE SCRUB (owner 2026-09-01, po-319 p424 "(11081) \u0723( 06110["): the
  // original-script OCR interleaves digit/bracket junk with the real text — in a lane whose
  // script is non-Latin, an ASCII-digit-heavy token is never language. Drop tokens that are
  // >=60% digits/brackets with no script letters; peel orphan ASCII brackets off script
  // tokens; collapse the leftover separators. Display-only (the sidecar is untouched).
  {const SCRIPT=/[\u0590-\u08FF\u1200-\u137F\u10A0-\u10FF\u0530-\u058F\u2C80-\u2CFF\u0370-\u03FF\u1F00-\u1FFF]/;
   const scrub=t=>{
     if(!SCRIPT.test(t))return t;
     const toks=t.split(/[ \t]+/).map(w=>{
       const scr=(w.match(new RegExp(SCRIPT.source,"g"))||[]).length;
       const junk=(w.match(/[0-9()\[\]{}|~^`]/g)||[]).length;
       if(!scr&&junk>=2&&junk>=w.length*0.5)return null;           // "(11081)" "06110[" ".111"
       if(!scr&&/^[0-9.,;:()\[\]|—–-]+$/.test(w)&&w.length>=2)return null;
       if(scr)w=w.replace(/^[()\[\]{}|]+|[()\[\]{}|]+$/g,x=>x.length<w.length?"":x);   // "\u0723(" → "\u0723"
       return w||null;
     }).filter(Boolean);
     return toks.join(" ").replace(/(?:\s*--\s*)+/g," ").replace(/\s{2,}/g," ").replace(/^[\s.,;:—–-]+/,"");
   };
   const deent=t=>t.replace(/&#x27;|&#039;|&apos;/g,"'").replace(/&quot;/g,'"')
     .replace(/&#xe9;/gi,"é").replace(/&amp;(?=[a-z#])/g,"&");
   const scrubDeep=o=>{if(!o)return;for(const k in o){
     if(typeof o[k]==="string")o[k]=deent(scrub(o[k]));
     else if(o[k]&&typeof o[k]==="object")scrubDeep(o[k]);}};
   scrubDeep(povtx);scrubDeep(poen);}
  const doc=new DOMParser().parseFromString(xml,"application/xml");
  if(doc.querySelector("parsererror"))throw new Error("canon parse");
  // CANON TEXT HEAL (owner 2026-08-27 screenshots): line-break hyphens kept inside Greek
  // words (ὕαπι-ζόμενοι) — Greek never hyphenates internally, join them; plus the
  // Migne-OCR garble chars ({ } ¡) that are never legitimate in the canon.
  try{const w=doc.createTreeWalker(doc.documentElement,NodeFilter.SHOW_TEXT);let nd;
    const GR="[\u0370-\u03FF\u1F00-\u1FFF]";
    const reG=new RegExp("("+GR+")-\\s?(?="+GR+")","g");
    while((nd=w.nextNode())){const t=nd.nodeValue;
      if(!t||t.length<3)continue;
      let s2=t.replace(reG,"$1").replace(/\u00A1/g,"i").replace(/[{}]/g,"")
        // double-escaped entities leak as literals (owner 2026-09-01, po-170 "d&#x27;un")
        .replace(/&#x27;|&#039;|&apos;/g,"'").replace(/&quot;/g,'"')
        .replace(/&#xe9;/gi,"\u00E9").replace(/&amp;(?=[a-z#])/g,"&");
      if(s2!==t)nd.nodeValue=s2;}}catch(e){}
  const gt=sel=>{const e=doc.querySelector(sel);return e?e.textContent.replace(/\s+/g," ").trim():"";};
  const title=gt("titleStmt > title")||("PO "+id);
  let _pola=gt("titleStmt > author")||"";
  if(!_pola||/^anonym/i.test(_pola)){
    try{window.__poMeta=window.__poMeta||fetch(BLOB+"/v1/po_meta.json").then(r=>r.ok?r.json():{}).catch(()=>({}));
      const pm=await window.__poMeta;if(pm[id]&&pm[id].a)_pola=pm[id].a;}catch(e){}
  }
  const author=await _auEn(_pola);
  const tome=(()=>{const e=[...doc.querySelectorAll("idno")].find(x=>x.getAttribute("type")==="PO-tome");return e?e.textContent.trim():"";})();
  const src=(new URLSearchParams(location.search).get("src"))||"orig";
  const mk=()=>{const d=document.implementation.createDocument(null,"TEI",null);
    const tx=d.createElement("text");d.documentElement.appendChild(tx);return [d,tx];};
  const [laD,laB]=mk(),[enD,enB]=mk();
  const seen=new Set();const pages=[];const struct=[];let depth0=null;let origLang=null;
  const addPb=n=>{if(!n||seen.has(n))return;seen.add(n);pages.push(n);
    for(const [D,B] of [[laD,laB],[enD,enB]]){const pb=D.createElement("pb");pb.setAttribute("n",String(n));B.appendChild(pb);}};
  const walk=(node,depth)=>{for(const ch of node.children){
    const ln=ch.localName;
    if(ln==="pb")addPb(+ch.getAttribute("n"));
    else if(ln==="head"){const t=ch.textContent.replace(/\s+/g," ").trim();
      if(depth0===null)depth0=depth;
      if(t){struct.push({title:t.slice(0,140),page:pages.length?pages[pages.length-1]:1,depth:Math.min(Math.max(depth-depth0+1,1),5)});
        const h=laD.createElement("head");h.textContent=t;laB.appendChild(h);
        const h2=enD.createElement("head");h2.textContent=t;enB.appendChild(h2);}}
    else if(ln==="p"){
      const t=ch.textContent.replace(/\s+/g," ").trim();if(!t)continue;
      const lang=ch.getAttribute("xml:lang")||"";
      const printed=(ch.getAttribute("rend")||"")==="printed-translation";
      if(lang==="en"&&!printed){const e=enD.createElement("p");e.textContent=t;enB.appendChild(e);}
      else if(printed){if(src==="pr"){const e=laD.createElement("p");e.textContent=t;laB.appendChild(e);}}
      else{if(!origLang&&lang)origLang=lang;
        if(src!=="pr"){const e=laD.createElement("p");e.textContent=t;laB.appendChild(e);}}}
    else if(ln==="div")walk(ch,depth+1);}};
  const body=doc.querySelector("body");if(body)walk(body,0);
  // UNTRANSCRIBED ORIGINALS (owner 2026-08-17 screenshots — a vast empty left lane): many
  // PO fascicles never transcribed the eastern script (the scan carries it). When the
  // original lane is near-empty, the printed translation becomes the source column.
  let usedFallback=false;
  if(src!=="pr"){
    // PER-PAGE fallback (Reader Map #4): a thin page borrows the printed translation
    // for THAT page only — genuinely-transcribed pages keep their original script.
    const laCount=laB.querySelectorAll("p").length,enCount=enB.querySelectorAll("p").length;
    // printed translation per page — the last-resort fill for pages the site lacks too
    const prByPage0={};{let cp=null;
      const wpr=(node)=>{for(const ch of node.children){
        if(ch.localName==="pb")cp=+ch.getAttribute("n")||cp;
        else if(ch.localName==="p"&&(ch.getAttribute("rend")||"")==="printed-translation"&&cp){
          const t=ch.textContent.replace(/\s+/g," ").trim();
          if(t)(prByPage0[cp]=prByPage0[cp]||[]).push(t);}
        else if(ch.localName==="div")wpr(ch);}};
      if(body)wpr(body);}
    if(laCount<Math.max(3,enCount*0.1)){
      if(povtx&&Object.keys(povtx).length>3){
        // the site HAS the original text (owner spot-check 2026-08-17, po-249 Syriac):
        // rebuild the source lane from it, page-keyed — no French substitution needed
        while(laB.firstChild)laB.removeChild(laB.firstChild);
        seen.clear();pages.length=0;
        const walkPb=(node)=>{for(const ch of node.children){
          if(ch.localName==="pb"){const n=+ch.getAttribute("n");if(n&&!seen.has(n)){seen.add(n);pages.push(n);
            const pb=laD.createElement("pb");pb.setAttribute("n",String(n));laB.appendChild(pb);
            const vt=povtx[String(n)];
            if(vt&&vt.length>60)_chunkText(vt,900).forEach(t2=>{const e2=laD.createElement("p");e2.textContent=t2;laB.appendChild(e2);});
            else if(prByPage0[n])prByPage0[n].forEach(t2=>{const e2=laD.createElement("p");e2.textContent=t2;laB.appendChild(e2);});}}
          else if(ch.localName==="head"){const t=ch.textContent.replace(/\s+/g," ").trim();
            if(t){const h=laD.createElement("head");h.textContent=t;laB.appendChild(h);}}
          else if(ch.localName==="div")walkPb(ch);}};
        if(body)walkPb(body);
        // direction comes from the harvested script itself, not a syr default —
        // Coptic/Ge'ez/Armenian/Georgian PO fascicles are LTR
        if(!origLang){const smp=Object.values(povtx).slice(0,4).join("").slice(0,2000);
          if(/[܀-ݏ]/.test(smp))origLang="syr";
          else if(/[؀-ۿ]/.test(smp))origLang="ara";
          else if(/[֐-׿]/.test(smp))origLang="heb";}
      }else{
      usedFallback=true;   // whole work untranscribed AND site has nothing — printed translation
      while(laB.firstChild)laB.removeChild(laB.firstChild);
      seen.clear();pages.length=0;
      const walkPr=(node)=>{for(const ch of node.children){
        const ln=ch.localName;
        if(ln==="pb"){const n=+ch.getAttribute("n");if(n&&!seen.has(n)){seen.add(n);pages.push(n);
          const pb=laD.createElement("pb");pb.setAttribute("n",String(n));laB.appendChild(pb);}}
        else if(ln==="head"){const t=ch.textContent.replace(/\s+/g," ").trim();
          if(t){const h=laD.createElement("head");h.textContent=t;laB.appendChild(h);}}
        else if(ln==="p"&&(ch.getAttribute("rend")||"")==="printed-translation"){
          const t=ch.textContent.replace(/\s+/g," ").trim();
          if(t){const e=laD.createElement("p");e.textContent=t;laB.appendChild(e);}}
        else if(ln==="div")walkPr(ch);}};
      if(body)walkPr(body);
      }
    }else{
      // page-level: splice originals (or printed translation) into thin pages
      const prByPage=prByPage0;
      // census the la sidecar per page; thin pages get the printed translation appended
      const kids=[...laB.childNodes];let pgN=null,buf=[];const thinFill=[];
      const flush=()=>{if(pgN==null)return;
        const chars=buf.join("").length;
        const vtHas=povtx&&povtx[String(pgN)]&&povtx[String(pgN)].length>60;
        if(chars<120&&(vtHas||(prByPage[pgN]&&prByPage[pgN].join("").length>200)))thinFill.push(pgN);
        buf=[];};
      kids.forEach(k=>{if(k.localName==="pb"){flush();pgN=+k.getAttribute("n");}
        else if(k.localName==="p")buf.push(k.textContent||"");});
      flush();
      thinFill.forEach(n2=>{
        const pbEl=[...laB.querySelectorAll("pb")].find(x=>+x.getAttribute("n")===n2);
        if(!pbEl)return;
        let ref=pbEl.nextSibling;
        // site original text beats the printed-translation substitute for a thin page
        const vt=povtx&&povtx[String(n2)];
        const fill=(vt&&vt.length>60)?_chunkText(vt,900):prByPage[n2];
        fill.forEach(t=>{const e=laD.createElement("p");e.textContent=t;
          laB.insertBefore(e,ref);});
      });
    }
  }
  // EN top-up: pages whose English lane is thin take the sidecar translation
  if(poen){
    const kids=[...enB.childNodes];let pgN=null,buf=[];const enThin=[];
    const eflush=()=>{if(pgN==null)return;
      const vt=poen[String(pgN)];
      // thin is RELATIVE to the sidecar (po-216: 664 chars of 'p.0' machine junk vs 150K real)
      if(vt&&vt.length>60&&buf.join("").length<Math.max(120,vt.length*0.05))enThin.push(pgN);
      buf=[];};
    kids.forEach(k=>{if(k.localName==="pb"){eflush();pgN=+k.getAttribute("n");}
      else if(k.localName==="p")buf.push(k.textContent||"");});
    eflush();
    enThin.forEach(n2=>{
      const pbEl=[...enB.querySelectorAll("pb")].find(x=>+x.getAttribute("n")===n2);
      if(!pbEl)return;
      let ref=pbEl.nextSibling;
      while(ref&&ref.localName==="p"){const junk=ref;ref=ref.nextSibling;enB.removeChild(junk);}
      String(poen[String(n2)]).split(/\n\s*\n+/).forEach(t=>{t=t.replace(/^#+\s*/,"").trim();
        if(t){const e=enD.createElement("p");e.textContent=t;enB.insertBefore(e,ref);}});
    });
  }
  if(!pages.length)pages.push(1);
  // SOURCE SCRIPT, NAMED AND FACED (owner 2026-09-01 eastern audit): census the assembled
  // source lane itself — every byline read "Latin + English" whatever the script — then
  // name the lane, set RTL where the script runs right-to-left, and load the right Noto face.
  {
    const smp=(laB.textContent||"").slice(0,4000)+Object.values(povtx||{}).slice(0,3).join("").slice(0,2000);
    const CEN=[[/[\u0700-\u074F]/,"syr","Syriac","Noto+Sans+Syriac",1],
      [/[\u0600-\u06FF]/,"ara","Arabic","Noto+Naskh+Arabic",1],
      [/[\u0590-\u05FF]/,"heb","Hebrew","Noto+Serif+Hebrew",1],
      [/[\u2C80-\u2CFF\u03E2-\u03EF]/,"cop","Coptic","Noto+Sans+Coptic",0],
      [/[\u1200-\u137F]/,"gez","Ge\u02bfez","Noto+Serif+Ethiopic",0],
      [/[\u0530-\u058F]/,"hye","Armenian","Noto+Serif+Armenian",0],
      [/[\u10A0-\u10FF]/,"kat","Georgian","Noto+Serif+Georgian",0],
      [/[\u0400-\u04FF]/,"chu","Slavonic","Noto+Serif",0],
      [/[\u0370-\u03FF\u1F00-\u1FFF]/,"grc","Greek","Cardo:ital,wght@0,400;0,700;1,400",0]];
    let best=null,bestN=0;
    for(const [rx,code,name,fam,rtl] of CEN){
      const n2=(smp.match(new RegExp(rx.source,"g"))||[]).length;
      if(n2>bestN&&n2>40){best=[code,name,fam,rtl];bestN=n2;}
    }
    if(best&&!usedFallback&&src!=="pr"){
      const [code,name,fam,rtl]=best;
      origLang=origLang||code;
      window.__SRCNAME=name;
      if(rtl)document.documentElement.classList.add("po-rtl");
      document.documentElement.classList.add("po-src");
      if(!document.getElementById("poFont")){const l=document.createElement("link");
        l.id="poFont";l.rel="stylesheet";
        l.href="https://fonts.googleapis.com/css2?family="+fam+"&display=swap";document.head.appendChild(l);}
    } else if(usedFallback||src==="pr"){window.__SRCNAME="Printed tr.";}
  }
  wireVolTravel("PO Tome",tome,+id,"po","povol");
  // source picker removed (owner 2026-08-17); ?src=pr remains a quiet power URL
  setTimeout(()=>{const mp=document.getElementById("m-par");
    if(mp)mp.textContent=(src==="pr"||usedFallback)?"Printed tr.":"Original";},800);
  window.__pldCanonDocs={la:laD,en:enD};
  // pofacs sidecar: {full: oneStripURL} or {base,nseg,pad} + marks[{n,top}] — the printed
  // fascicle is ONE continuous scan; a page = the segment slices covering its fraction.
  // PAGE-BY-PAGE like the family PO site (owner 2026-08-17 'this is critical — the OCR
  // on the original lane can not be accurate'): the scan is the authority, so each page
  // turn must land the pane on the EXACT printed page: segments + a seek fraction.
  let pageData=()=>null;
  const hasF=!!(facsMap&&(facsMap.full||facsMap.base))||!!(pofx2&&pofx2.pages);
  if(hasF){
    const marks=facsMap.marks||[];
    // PO marks come in PAIRS — one scan is an OPENING carrying two printed page numbers at
    // nearly the same height — and a few early marks are mis-measured slivers. So a page's
    // band runs to the next DISTINCT mark, floored at three quarters of the median leaf so a
    // bad measurement can never render a 180px sliver instead of a leaf (owner 2026-08-28).
    // a leaf's height is the marked span divided by the number of OPENINGS (two printed
    // pages per scan) — taking a median over distinct marks instead lands on the tiny
    // intra-pair gaps and yields a 100px sliver.
    const _tp=marks.map(m=>m.top);
    const _lo=Math.min(..._tp),_hi=Math.max(..._tp);
    const _leaf=marks.length>3?((_hi-_lo)/Math.max(1,marks.length/2)):0.02;
    const _minH=_leaf*0.92;
    const rng={};marks.forEach((m,i)=>{
      let nx=1;for(let k=i+1;k<marks.length;k++){if(marks[k].top>m.top+1e-6){nx=marks[k].top;break;}}
      rng[m.n]=[m.top,Math.min(1,Math.max(nx,m.top+_minH))];});
    if(facsMap.full){pageData=n=>{const r=rng[n];
      return {imgs:[facsMap.full],seek:r?r[0]:0};};}
    else{
      // EXACT boundaries (owner 2026-08-17 'verify that the fraction thing is correct'
      // — it was NOT: segments have unequal heights; uniform math landed p.496 on
      // p.483). hts = measured pixel heights of every segment, baked into the sidecar;
      // cumulative fractions replace the uniform assumption. Uniform stays as fallback.
      const H=facsMap.hts&&facsMap.hts.length===facsMap.nseg?facsMap.hts:null;
      const tot=H?H.reduce((a,x)=>a+x,0):facsMap.nseg;
      const cum=[0];for(let k=0;k<facsMap.nseg;k++)cum.push(cum[k]+(H?H[k]:1));
      const fOf=k=>cum[k]/tot;   // fraction of the strip where segment k begins
      pageData=n=>{const r=rng[n];if(!r)return null;
        let a=0;while(a<facsMap.nseg-1&&fOf(a+1)<=r[0])a++;
        let b=a;while(b<facsMap.nseg-1&&fOf(b+1)<r[1])b++;
        const out=[];for(let k=a;k<=b;k++)out.push(facsMap.base+String(k).padStart(facsMap.pad||2,"0")+".jpg");
        const span=fOf(b+1)-fOf(a);
        // band = where this printed page begins and ends INSIDE the returned stack, so the
        // pane can show that page alone instead of the whole strip (owner 2026-08-28)
        const b0=span>0?Math.max(0,Math.min(1,(r[0]-fOf(a))/span)):0;
        const b1=span>0?Math.max(0,Math.min(1,(r[1]-fOf(a))/span)):1;
        return {imgs:out,seek:b0,band:(b1>b0+0.004)?[b0,b1]:null};};
    }
  }
  // the cut page wins; a page the cutter could not certify keeps the strip band
  if(pofx2&&pofx2.pages){
    const stripPD=pageData;
    pageData=n=>{const f=pofx2.pages[String(n)];
      return f?{imgs:[BLOB+"/"+pofx2.base+f]}:stripPD(n);};
  }
  return {slug:ws,title,title_en:title,author,author_la:_pola!==author?_pola:undefined,volume:tome?("PO Tome "+tome):"",
    tradition:"Eastern Fathers",has_pages:hasF,has_tei:true,tei_v:0,en_only:false,
    n_pages:pages.length,structure:struct,base:null,spine_nav:struct.length>1,
    pages:pages.map(n=>{const pd=pageData(n);
      return {n,la:"",en:"",img:pd?pd.imgs[0]:null,thumb:pd?pd.imgs[0]:null,
        imgs:pd?pd.imgs:undefined,fseek:pd?pd.seek:undefined,
        fband:pd?pd.band:undefined};})};   // band = this page's own slice of the strip
}
// ── EEBO CANON (owner 2026-08-18 'EEBO should fully integrate into the regular tfr
// reader'): eebo-{id} hydrates from the same eebo/{id}.json.gz the standalone reader used
// — division tree with pb spans — into the standard lanes, so every organ (outline, search,
// Related, notes, Ask, print) applies. Modern English (eebo_modern) IS the reading text
// where the campaign covered it (owner 2026-08-17).
async function loadEeboCanon(ws){
  const id=ws.slice(5);
  const gunz=async r=>{const buf=await r.arrayBuffer();
    try{const ds=new DecompressionStream("gzip");
      return await new Response(new Blob([buf]).stream().pipeThrough(ds)).text();}
    catch(e){return new TextDecoder().decode(buf);}};
  const [d,mod]=await Promise.all([
    fetch(BLOB+"/eebo/"+encodeURIComponent(id)+".json.gz").then(async r=>{if(!r.ok)throw new Error("eebo "+r.status);return JSON.parse(await gunz(r));}),
    fetch(BLOB+"/eebo_modern/"+encodeURIComponent(id)+".json.gz").then(async r=>r.ok?JSON.parse(await gunz(r)):null).catch(()=>null)]);
  const M=(mod&&mod.m)||null;
  const mk=()=>{const D2=document.implementation.createDocument(null,"TEI",null);
    const tx=D2.createElement("text");D2.documentElement.appendChild(tx);return [D2,tx];};
  const [laD,laB]=mk(),[enD,enB]=mk();
  const seen=new Set(),pages=[],struct=[];
  const sourceOutline=[],sourceLabelNodes=new Map();
  let _sourceRegion="body",_sourcePath="";
  const sourceBlock=e=>{e.setAttribute("data-source-region",_sourceRegion);e.setAttribute("data-source-path",_sourcePath);return e;};
  const addPb=n=>{if(!n||seen.has(n))return;seen.add(n);pages.push(n);
    const pb=enD.createElement("pb");pb.setAttribute("n",String(n));enB.appendChild(pb);
    const pb2=laD.createElement("pb");pb2.setAttribute("n",String(n));laB.appendChild(pb2);};
  // inline fidelity (owner 2026-08-18 'EEBO v1 flattens italics'): printed emphasis
  // survives as markdown markers — inl() renders them in the reading lane
  const md=h=>String(h)
    .replace(/<\/?(?:i|em)\b[^>]*>/g,"*").replace(/<\/?(?:b|strong)\b[^>]*>/g,"**")
    .replace(/<[^>]+>/g," ").replace(/\s+/g," ").replace(/\*\s+\*/g,"").trim();
  // HEADING DETECTION (owner 2026-08-20 "toc inline doesn't work"): many EEBO canon files
  // carry no `label` nodes — their divisions are ordinary short paragraphs the renderer
  // later promotes (teiHeadFix). Record those shapes as structure at load time, so the
  // inline Contents exists for these works too. Conservative: short, numbered/capitalised,
  // no terminal prose punctuation.
  const HEADRX=/^(?:\*{0,2})(THESIS|THES|CHAP(?:TER)?|SECT(?:ION)?|DISP(?:UTATION)?|QUEST(?:ION)?|ARTICLE|ARG(?:UMENT)?|BOOK|PART|APPENDIX|PREFACE|CONCLUSION|EXPLICATION|OBJECT(?:ION)?|ANSW(?:ER)?)\b/i;
  const isHead=s=>{const x=String(s).replace(/[*]/g,"").trim();
    if(!x||x.length>90)return false;
    if(/[.;:,]\s*\S{12,}$/.test(x))return false;              // a sentence, not a head
    if(HEADRX.test(x))return true;
    const L=(x.match(/[A-Z]/g)||[]).length, l=(x.match(/[a-z]/g)||[]).length;
    return x.length<=60 && L>=4 && l<=L/3;                     // a caps display line
  };
  let _lastHead="", _lastP=null;   // _lastP: the paragraph a mid-sentence page mark continues into
  const emit=t=>{t=md(t);
    if(/^\s*[⟨(]\s*\d+\s+page[s]?\s+duplicate\s*[⟩)]\s*$/i.test(t)){
      const e=enD.createElement("note");e.setAttribute("place","margin");
      e.textContent=t.replace(/[⟨⟩()]/g,"").trim();enB.appendChild(e);_lastP=null;return;}
    // a division's label is often reprinted as the first words of its own first paragraph;
    // the reader then shows it twice (owner 2026-08-20). Strip the echo, keep the prose.
    if(_lastHead){
      const norm=s=>String(s).replace(/[*\s]+/g," ").replace(/[^\w\s]/g,"").trim().toLowerCase();
      const h=norm(_lastHead), b=norm(t);
      if(h.length>8&&b.startsWith(h)){
        const cut=t.toLowerCase().indexOf(_lastHead.replace(/[*]/g,"").trim().toLowerCase().slice(0,12));
        if(cut>=0){const after=t.slice(cut+_lastHead.replace(/[*]/g,"").trim().length).replace(/^[\s.:,—-]+/,"");
          if(after.length>20)t=after;}
      }
      _lastHead="";
    }
    if(t&&t.replace(/[*\s]/g,"")){
      // FLOW ACROSS THE PAGE MARK (owner 2026-08-20, Dyke's sermon: "crownes Faith" |
      // "therewith," — "this should be combined but it's split"). EEBO sets a <pb> wherever
      // the folio turns, which is usually MID-SENTENCE; splitting a <p> at every one broke
      // the prose on every page of every work. The page is still recorded on the spine —
      // only the paragraph stays whole, and only when the printed text plainly continues.
      const prev=_lastP?_lastP.textContent:"";
      if(_lastP&&!isHead(t)&&prev&&
         !/[.!?…:;)\]"'’”»]\s*$/.test(prev)&&                 // the last page did not finish a sentence
         /^[a-zà-öø-ÿ0-9,;:)\]"'’”»(]/.test(t.replace(/^[*]+/,""))){   // …and this one resumes in the middle
        _lastP.textContent=/[-‑]$/.test(prev)
          ? prev.replace(/[-‑]\s*$/,"")+t.replace(/^\s+/,"")   // a word broken by the folio
          : prev.replace(/\s+$/,"")+" "+t.replace(/^\s+/,"");
        return;
      }
      const e=enD.createElement("p");e.textContent=t;enB.appendChild(e);_lastP=e;
      if(isHead(t))struct.push({title:t.replace(/[*]/g,"").trim().slice(0,140),
        page:pages.length?pages[pages.length-1]:1,depth:1});
    }};
  // BLOCK-AWARE EMISSION (owner 2026-09-08, Baxter eebo-34087 "reads as one long body" next to the
  // Michigan TCP view): the canon html keeps TCP's <p> paragraphs, its <b> heads and its
  // <span class="note"> margin notes, but emit() was fed one FOLIO chunk at a time and md() strips
  // every tag — so a division rendered as one paragraph per page with the margin notes spliced
  // into the running prose. Walk the blocks instead: each <p> is a paragraph (kept whole across a
  // folio turn; the pb lands after it, as the old flow-merge did), a standalone <b> is a head, a
  // margin note becomes <note place="margin"> at its text position (the reader's .mnote gloss),
  // and a restored word keeps <hi rend="gapfill …"> so the lane can mark it.
  const PBRX=/<span class="pb" data-n="(\d+)"><\/span>/g;
  const md2=h=>String(h).replace(/<\/?(?:i|em)\b[^>]*>/g,"*").replace(/<\/?(?:b|strong)\b[^>]*>/g,"**").replace(/<[^>]+>/g," ").replace(/\s+/g," ");
  const normT=x=>String(x).replace(/[*\s]+/g," ").replace(/[^\w\s]/g,"").trim().toLowerCase();
  let _curDepth=1,_labelHead=null;
  const fillInline=(el,html)=>{               // nesting-aware: a margin note may itself hold a restored word
    const OPEN=/<span class="(note|gapfill[^"]*)"[^>]*>/g;
    const txt=x=>{const t=md2(x);if(t.replace(/[*\s]/g,""))el.appendChild(enD.createTextNode(t));else if(t)el.appendChild(enD.createTextNode(" "));};
    let last=0,m;
    while((m=OPEN.exec(html))){
      // find the matching </span> (spans nest: note ⊃ gapfill)
      let depth=1,i=OPEN.lastIndex;const T=/<\/?span\b[^>]*>/g;T.lastIndex=i;let k,close=-1,closeEnd=-1;
      while((k=T.exec(html))){if(k[0][1]==="/"){depth--;if(!depth){close=k.index;closeEnd=T.lastIndex;break;}}else depth++;}
      if(close<0)break;
      if(m.index>last)txt(html.slice(last,m.index));
      const inner=html.slice(i,close);
      if(m[1]==="note"){const t=md(inner);if(t){
          const lc=el.lastChild;if(lc&&lc.nodeType===3&&!/\s$/.test(lc.nodeValue))el.appendChild(enD.createTextNode(" "));   // the print glues "and<note>": keep the words apart
          const n=enD.createElement("note");n.setAttribute("place","margin");n.textContent=t;el.appendChild(n);
          if(!/^\s/.test(html.slice(closeEnd,closeEnd+1)))el.appendChild(enD.createTextNode(" "));}}
      else{const t=md(inner);if(t){const h=enD.createElement("hi");h.setAttribute("rend",m[1]);h.textContent=t;el.appendChild(h);}}
      last=closeEnd;OPEN.lastIndex=closeEnd;}
    if(last<html.length)txt(html.slice(last));
  };
  const emitPara=(inner,asHead,noStruct)=>{
    const plain=md(inner);
    if(!plain||!plain.replace(/[*\s]/g,""))return;
    if(/^\s*[⟨(]\s*\d+\s+page[s]?\s+duplicate\s*[⟩)]\s*$/i.test(plain)){
      const e=enD.createElement("note");e.setAttribute("place","margin");
      e.textContent=plain.replace(/[⟨⟩()]/g,"").trim();enB.appendChild(e);_lastP=null;return;}
    if(_lastHead&&!asHead){                    // label echoed as the first words of the first paragraph
      const h=normT(_lastHead), b=normT(plain);
      if(h.length>8&&b.startsWith(h)){
        const lab=_lastHead.replace(/[*]/g,"").trim();const cut=plain.toLowerCase().indexOf(lab.toLowerCase().slice(0,12));
        if(cut>=0){const after=plain.slice(cut+lab.length).replace(/^[\s.:,—-]+/,"");
          if(after.length>20){const e=sourceBlock(enD.createElement("p"));e.textContent=after;enB.appendChild(e);_lastP=e;_lastHead="";return;}}}
      _lastHead="";}
    const e=sourceBlock(enD.createElement(asHead?"head":"p"));fillInline(e,inner);enB.appendChild(e);
    if(asHead){_lastHead=plain;_lastP=null;
      const t=plain.replace(/[*]/g,"").trim();
      if(!noStruct&&t.length>=4&&t.length<=140)struct.push({title:t.slice(0,140),page:pages.length?pages[pages.length-1]:1,depth:Math.min(_curDepth+1,5)});}
    else{_lastP=e;
      if(isHead(plain))struct.push({title:plain.replace(/[*]/g,"").trim().slice(0,140),page:pages.length?pages[pages.length-1]:1,depth:1});}
  };
  const flatBlockTokens=html=>{
    const rx=/<p\b[^>]*>([\s\S]*?)<\/p>|<b>([\s\S]*?)<\/b>|<span class="pb" data-n="(\d+)"><\/span>/g;
    const toks=[];let last=0,m;
    const push=(t,h)=>{if(t==="txt"&&toks.length&&toks[toks.length-1].t==="txt")toks[toks.length-1].h+=h;else toks.push({t,h});};
    while((m=rx.exec(html))){
      if(m.index>last)push("txt",html.slice(last,m.index));
      if(m[3]!=null)push("pb",m[3]);else if(m[1]!=null)push("p",m[1]);else push("b",m[2]);
      last=rx.lastIndex;}
    if(last<html.length)push("txt",html.slice(last));
    // a <b> outside any <p> is a printed head — unless it is bold running text inside a bare run
    for(let k=0;k<toks.length;k++){
      if(toks[k].t!=="b")continue;
      const plain=md(toks[k].h),prev=toks[k-1],next=toks[k+1];
      const okPrev=!prev||prev.t!=="txt"||!prev.h.replace(/<[^>]+>/g,"").trim()||/[.:;!?\]\)»”]\s*$/.test(md(prev.h));
      const okNext=!next||next.t!=="txt"||!next.h.replace(/<[^>]+>/g,"").trim()||/^\s*(?:[A-Z§¶\d(\[*"“‘']|$)/.test(md2(next.h));
      if(plain.length>160||!okPrev||!okNext){toks[k]={t:"txt",h:"**"+toks[k].h+"**"};
        if(k>0&&toks[k-1].t==="txt"){toks[k-1].h+=toks[k].h;toks.splice(k,1);k--;}
        if(k+1<toks.length&&toks[k+1].t==="txt"){toks[k].h+=toks[k+1].h;toks.splice(k+1,1);}}
    }
    return toks;
  };
  const emitFlatBlocks=html=>{
    const toks=flatBlockTokens(html);
    const pbIn=h=>{PBRX.lastIndex=0;let k;while((k=PBRX.exec(h)))addPb(+k[1]);};
    toks.forEach(tk=>{
      if(tk.t==="pb")addPb(+tk.h);
      else if(tk.t==="p"){emitPara(tk.h.replace(PBRX," "),false);pbIn(tk.h);}
      else if(tk.t==="b"){
        const plain=md(tk.h);
        const echo=_lastHead&&plain&&(normT(_lastHead).startsWith(normT(plain).slice(0,60))||normT(plain).startsWith(normT(_lastHead).slice(0,60)));
        if(!echo)emitPara(tk.h.replace(PBRX," "),true);
        else if(_labelHead&&plain.replace(/[*]/g,"").trim().length>_labelHead.textContent.length+8){   // label was truncated: the printed head is the fuller text
          const lh=_lastHead,sourceEntry=sourceLabelNodes.get(_labelHead);_labelHead.remove();emitPara(tk.h.replace(PBRX," "),true,true);
          if(sourceEntry){sourceLabelNodes.delete(_labelHead);enB.lastChild.__frSourcePrimaryPath=sourceEntry.path;sourceLabelNodes.set(enB.lastChild,sourceEntry);}_lastHead=lh;}
        else{const rx=/<span class="note">([\s\S]*?)<\/span>/g;let k;               // short echo: skip the text, keep its margin notes
          while((k=rx.exec(tk.h))){const t=md(k[1]);if(t){const n=enD.createElement("note");n.setAttribute("place","margin");n.textContent=t;enB.appendChild(n);}}}
        _labelHead=null;pbIn(tk.h);}
      else{const plain=md(tk.h);if(plain.replace(/[*\s]/g,""))emitPara(tk.h.replace(PBRX," "),false);pbIn(tk.h);}
    });
  };
  // The public EEBO HTML has real nested lists. Keep their item boundaries;
  // the old flat emitter treated every run between heads/page marks as prose.
  const sourceHTML=html=>String(html).replace(/&amp;/g,"&"); // undo serialization escaping before the existing inline-text emitter
  const emitSourceList=root=>{
    const stack=[];
    const container=()=>{let parent=enB;for(const frame of stack){
      if(!frame.out){frame.out=sourceBlock(enD.createElement(frame.tag));
        if(frame.tag==="list"){frame.out.setAttribute("type","eebo-list");frame.out.setAttribute("rend",frame.ordered?"ordered":"unordered");}
        if(frame.continued&&frame.tag==="item")frame.out.setAttribute("part","M");
        parent.appendChild(frame.out);}
      parent=frame.out;}return parent;};
    const boundary=value=>{const before=pages.length;addPb(/^\d+$/.test(value)?Number(value):value);
      if(pages.length!==before)stack.forEach(frame=>{if(frame.out)frame.continued=true;frame.out=null;});};
    const htmlOf=node=>node.nodeType===3?String(node.nodeValue||"").replace(/</g,"&lt;").replace(/>/g,"&gt;"):sourceHTML(node.outerHTML||"");
    const walk=node=>{
      const tag=(node.localName||"").toLowerCase();
      if(tag==="ul"||tag==="ol"||tag==="li"){
        stack.push({tag:tag==="li"?"item":"list",ordered:tag==="ol",out:null,continued:false});
        Array.from(node.childNodes).forEach(walk);stack.pop();return;
      }
      if(tag==="span"&&node.classList.contains("pb")){boundary(node.getAttribute("data-n")||"");return;}
      if(tag==="p"){
        const html=sourceHTML(node.innerHTML),plain=md(html.replace(PBRX," "));
        if(plain){const p=sourceBlock(enD.createElement("p"));fillInline(p,html.replace(PBRX," "));container().appendChild(p);}
        // Match existing paragraph paging: a turn inside a paragraph follows
        // the whole paragraph, without moving or inventing any page marker.
        PBRX.lastIndex=0;let hit;while((hit=PBRX.exec(html)))boundary(hit[1]);return;
      }
      if(tag==="b"&&stack.at(-1)?.tag==="list"){
        const head=sourceBlock(enD.createElement("head"));fillInline(head,sourceHTML(node.innerHTML));if(head.textContent.trim())container().appendChild(head);return;
      }
      // Inline wrappers may contain a nested list or a page marker. Descend
      // around those boundaries; ordinary emphasis/notes retain fillInline.
      if(node.nodeType===1&&node.querySelector('ul,ol,span.pb')){Array.from(node.childNodes).forEach(walk);return;}
      const html=htmlOf(node);if(node.nodeType===3&&!String(node.nodeValue||"").trim()){
        if(stack.at(-1)?.tag==="item")fillInline(container(),html);return;
      }
      if(!md(html).replace(/[*\s]/g,""))return;
      fillInline(container(),html);
    };
    walk(root);_lastP=null;_lastHead="";_labelHead=null;
  };
  const emitBlocks=html=>{
    if(!/<(?:ul|ol)\b/i.test(html)){emitFlatBlocks(html);return;}
    // Preserve the existing navigation outline independently of the new list
    // representation. This uses the same token/heading rules, without emitting
    // duplicate text or changing the source page sequence.
    const outline=[],known=new Set(seen),outlineStart=struct.length;let at=pages.at(-1)||1,lastHead=_lastHead;
    const advance=value=>{const n=Number(value);if(n&&!known.has(n)){known.add(n);at=n;}};
    for(const token of flatBlockTokens(html)){
      if(token.t==="pb"){advance(token.h);continue;}
      let plain=md(token.h.replace(PBRX," "));
      if(token.t==="b"){
        const echo=lastHead&&plain&&(normT(lastHead).startsWith(normT(plain).slice(0,60))||normT(plain).startsWith(normT(lastHead).slice(0,60)));
        if(!echo&&plain){lastHead=plain;const title=plain.replace(/[*]/g,"").trim();if(title.length>=4&&title.length<=140)outline.push({title,page:at,depth:Math.min(_curDepth+1,5)});}
      }else if(plain.replace(/[*\s]/g,"")){
        let echoed=false;
        if(lastHead&&normT(lastHead).length>8&&normT(plain).startsWith(normT(lastHead))){const label=lastHead.replace(/[*]/g,"").trim(),cut=plain.toLowerCase().indexOf(label.toLowerCase().slice(0,12));if(cut>=0&&plain.slice(cut+label.length).replace(/^[\s.:,—-]+/,"").length>20)echoed=true;}
        lastHead="";if(!echoed&&isHead(plain))outline.push({title:plain.replace(/[*]/g,"").trim().slice(0,140),page:at,depth:1});
      }
      PBRX.lastIndex=0;let hit;while((hit=PBRX.exec(token.h)))advance(hit[1]);
    }
    // HTML parsers close a <p> before its nested list. Keep the converter's
    // established paragraph-turn convention before parsing that legacy shape:
    // page markers inside the original paragraph still follow its entire text.
    const listHTML=html.replace(/<p\b(?![^>]*\/>)[^>]*>([\s\S]*?)<\/p>/g,(whole,inner)=>{
      if(!/<(?:ul|ol)\b/i.test(inner))return whole;
      const marks=inner.match(PBRX)||[];return whole.replace(PBRX," ")+marks.join("");});
    const template=document.createElement("template");template.innerHTML=listHTML;let run="";
    const flush=()=>{if(run){emitFlatBlocks(sourceHTML(run));run="";}};
    const walk=node=>{const tag=(node.localName||"").toLowerCase();
      if(tag==="ul"||tag==="ol"){flush();emitSourceList(node);}
      else if(node.nodeType===1&&node.querySelector("ul,ol")){flush();Array.from(node.childNodes).forEach(walk);}
      else run+=node.nodeType===3?String(node.nodeValue||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"):node.outerHTML||"";};
    Array.from(template.content.childNodes).forEach(walk);flush();struct.splice(outlineStart,struct.length-outlineStart,...outline);
  };
  (function walk(nodes,base,depth,region="body"){(nodes||[]).forEach((nd,i)=>{
    const path=base===""?String(i):base+"."+i;_curDepth=(nd.depth||depth);
    const regionLabel=String(nd.label||"").replace(/_/g," ").trim();
    _sourceRegion=/^(?:table of contents|contents)$/i.test(regionLabel)?"contents":/^front matter$/i.test(regionLabel)?"frontmatter":region;_sourcePath=path;
    const sourceLabel=String(nd.label||""),displayLabel=window.FRSourceOutline?.cleanLabel(sourceLabel,nd.html,document)||sourceLabel;
    const sourceEntry={path,parentPath:base||null,depth:path.split(".").length,label:sourceLabel,region:_sourceRegion,beforeFirstPage:pages.length===0,
      ...(displayLabel!==sourceLabel?{displayLabel}:{})};sourceOutline.push(sourceEntry);
    if(nd.label){const t=String(nd.label).replace(/\s+/g," ").trim();
      if(t){struct.push({title:t.slice(0,140),page:pages.length?pages[pages.length-1]:1,depth:Math.min((nd.depth||depth)+1,5)});
        const h=sourceBlock(enD.createElement("head"));h.textContent=t;h.__frSourcePrimaryPath=path;enB.appendChild(h);sourceLabelNodes.set(h,sourceEntry);_lastHead=t;_lastP=null;_labelHead=h;}}
    if(nd.html){
      // THE MODERN LANE IS THE SAME DOCUMENT, RESPELLED (2026-08-20). eebo_modern rewrites
      // the division's TEXT NODES only, so it still carries the pb marks and the printed
      // italics — it must go through the ordinary split/emit path, or its markup renders as
      // visible tags. Only a tagless modern payload needs the old proportional re-paging.
      const _mv=(M&&M[path]!=null)?String(M[path]):null;
      const _mHtml=(_mv!==null&&/<[a-z!\/]/i.test(_mv));
      const parts=String(_mHtml?_mv:nd.html).split(/<span class="pb" data-n="(\d+)"><\/span>/);
      if(_mv!==null&&!_mHtml){
        // PROPORTIONAL PAGING (owner 2026-08-18): the modern text replaces the whole
        // division — assign its paragraphs to the division's pages by the ORIGINAL
        // text's cumulative fraction per page, so the spine stays honest
        const segs=[];               // [{n, chars}] original mass per page
        if(parts[0].replace(/<[^>]+>/g,"").trim())segs.push({n:null,chars:parts[0].length});
        for(let k=1;k<parts.length;k+=2)segs.push({n:+parts[k],chars:(parts[k+1]||"").length});
        const tot=Math.max(1,segs.reduce((s,x)=>s+x.chars,0));
        const paras=String(M[path]).split(/\n\s*\n+/).map(t=>t.trim()).filter(Boolean);
        const ptot=Math.max(1,paras.reduce((s,t)=>s+t.length,0));
        let si=0,acc=0,pacc=0;
        if(segs.length&&segs[0].n!=null)addPb(segs[0].n);
        paras.forEach(t=>{
          // advance the page pointer when the paragraph's cumulative fraction passes the segment's
          while(si+1<segs.length&&(pacc/ptot)>=(acc+segs[si].chars)/tot){
            acc+=segs[si].chars;si++;
            if(segs[si].n!=null)addPb(segs[si].n);}
          pacc+=t.length;
          const e=sourceBlock(enD.createElement("p"));e.textContent=t;enB.appendChild(e);});
        for(let k=si+1;k<segs.length;k++)if(segs[k].n!=null)addPb(segs[k].n);
      }else{
        emitBlocks(String(_mHtml?_mv:nd.html));   // 2026-09-08: blocks, not folio chunks (see emitBlocks)
      }
    }
    if(nd.kids&&nd.kids.length)walk(nd.kids,path,(nd.depth||depth)+1,_sourceRegion);
  });})(d.toc||[],"",0);
  if(!pages.length)pages.push(1);
  // The actual retained node-label element supplies its target. Raw printed
  // page numbers and duplicate auxiliary headings never choose this location.
  let sourcePage=null;
  for(const node of enB.childNodes){
    if(node.localName==="pb"){sourcePage=String(node.getAttribute("n"));continue;}
    const entry=sourceLabelNodes.get(node);if(!entry)continue;
    entry.primaryTarget={text:node.textContent,origin:"primary",...(sourcePage!==null?{page:sourcePage,key:window.FRSourceOutline?.targetKey(sourcePage,node.textContent,"primary")||""}:!seen.size?{unpaged:true}:{})};
  }
  const meta=d.meta||{};
  window.__pldCanonDocs={la:laD,en:enD};
  // STRUCTURE FALLBACK (owner 2026-08-20 "toc inline doesn't work"): many EEBO canon files
  // carry no `label` nodes — their divisions are <h*> inside the html blocks, so `struct`
  // came out empty and the inline Contents never rendered (the sidebar still had heads,
  // because buildNav walks the DOM). Synthesise the outline from the emitted heads.
  if(!struct.length){
    let cur=pages[0]||1;
    [...enB.childNodes].forEach(n=>{
      if(n.nodeType!==1)return;
      if(n.localName==="pb"){const v=parseInt(n.getAttribute("n"),10);if(v)cur=v;return;}
      if(n.localName==="head"){
        const tx=(n.textContent||"").replace(/\s+/g," ").trim();
        if(tx&&tx.length<=140)struct.push({title:tx,page:cur,depth:1});
      }});
  }
  return {slug:ws,title:meta.title||("EEBO "+id),title_en:meta.title||"",author:meta.author||"",
    volume:String(meta.year||meta.date||""),tradition:meta.tradition||"English Divines",
    has_pages:false,has_tei:true,tei_v:0,en_only:true,nav_source_version:"eebo-path-v1",eebo_source_outline:sourceOutline,
    n_pages:pages.length,structure:struct,base:null,spine_nav:struct.length>1,
    pages:pages.map(n=>({n,la:"",en:""}))};
}
// PRETTY SLUGS (owner 2026-08-20 "make the eebo slugs match the author title"): the id
// space stays eebo-N — 563k vectors, every mined citation and saved link are keyed to it —
// but v1/slug-aliases.json maps author-title → slug, so /read?w=samuel-rutherford-lex-rex
// resolves to eebo-266. Unknown ids fall through untouched.
async function resolveAlias(ws){
  if(!ws || /^(eebo|pld|pg|po|aq)-\d/.test(ws)) return ws;
  try{
    const m = await (window.__aliasP = window.__aliasP ||
      fetch(BLOB+"/v1/slug-aliases.json").then(r=>r.ok?r.json():{}).catch(()=>({})));
    return m[ws] || ws;
  }catch(e){ return ws; }
}
async function loadWork(ws){
  if(!BLOB)return await jfetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/work?ws="+encodeURIComponent(ws),1);
  // ── PL CANON MODE (2026-08-17): pld-{id} works hydrate straight from the family canon
  // on this same Blob store — tei/pld/{id}.xml (structure, columns, la∥en pairs) +
  // v1/pldtoc/{id}.json (English deep-TOC labels). No copied text anywhere: the canon is
  // the single source, and family-site corrections reach TFR automatically.
  const _canon=/^pld-\d+$/.test(ws)?loadPldCanon:/^pg-\d+$/.test(ws)?loadPgCanon:/^po-\d+$/.test(ws)?loadPoCanon:/^eebo-/.test(ws)?loadEeboCanon:null;
  if(_canon){
    const D=await _canon(ws);
    // the English display-title overlay applies to canon works too (it used to live only
    // on the classic path below the early returns — Latin h1 on every canon work)
    try{if(!_EN_TITLES)_EN_TITLES=await jfetch(BLOB+"/v1/titles_en.json"+(window.__FR_VER?("?v="+window.__FR_VER):""),1);}catch(e){_EN_TITLES=_EN_TITLES||{};}
    D.title_en=(_EN_TITLES&&_EN_TITLES[ws])||D.title_en||"";
    return D;
  }
  const base=BLOB+"/v1/works/"+encodeURIComponent(ws);
  const V=window.__FR_VER?("?v="+window.__FR_VER):"";   // bust the 1-yr browser cache on mutable JSON
  // the <body>-top early-fetch already has these on the wire; fall back to a fresh jfetch on any miss
  const _early=(window.__frEarly&&window.__frEarly.ws===ws)?window.__frEarly:null;
  const meta=await (_early&&_early.meta?_early.meta.catch(()=>jfetch(base+"/meta.json"+V,2)):jfetch(base+"/meta.json"+V,2));
  // Source-verified edition labels are shared display metadata, not corpus rewrites.
  try{
    const label=window.__FR_EDITION_VOLUMES__?.[ws];if(label)meta.volume=label;
  }catch(_){}
  meta.base=base+"/";   // TEI PATH (2026-08-10): same base the shards use, exposed for the TEI sidecar fetch
  // SOURCE LANGUAGE (owner 2026-08-27 "label the non-Latin works"): meta.src_lang stamps the 122
  // works whose source lane is not Latin (lang census + LLM verify, runs/lang_final.json). The
  // lane toggle, headings and About copy all read __SRCNAME instead of assuming Latin.
  {const LGN={de:"German",fr:"French",el:"Greek",it:"Italian",es:"Spanish",nl:"Dutch",cy:"Welsh",en:"Original",mul:"Source"};
   if(meta.src_lang&&LGN[meta.src_lang])window.__SRCNAME=LGN[meta.src_lang];else if(!/^pg-/.test(ws))window.__SRCNAME="Latin";
   try{const SN=window.__SRCNAME,mp=document.getElementById("m-par");
     if(mp&&SN&&SN!=="Latin"){mp.textContent=SN;mp.title=SN+" source text — a toggle; read it beside the English, or alone with the scan";}
     const me=document.getElementById("m-en");
     if(me&&SN&&SN!=="Latin")me.title="English translation — a toggle; combine freely with the "+SN+" source";
   }catch(e){}}
  // titles overlay is CHROME (masthead label), never content — don't serialize it into the
  // first-text path; patch the title in whenever it lands.
  meta.title_en=(_EN_TITLES&&_EN_TITLES[ws])||"";
  if(!_EN_TITLES){
    ((window.__frEarly&&window.__frEarly.titles)||jfetch(BLOB+"/v1/titles_en.json"+V,1))
      .then(t=>{_EN_TITLES=t||{};const te=_EN_TITLES[ws];
        if(te){meta.title_en=te;try{const wt=document.getElementById("wt");
          if(wt&&wt.textContent&&wt.textContent!==te&&!/[A-Za-z]/.test(meta.title||"")===false){}
          if(window.DATA===meta&&wt)wt.textContent=te;}catch(e){}}})
      .catch(()=>{_EN_TITLES={};});
  }
  // single works: take ONLY pages from work.json — meta.json is the canonical metadata and
  // carries the FINALIZED img_base/has_pages; Object.assign(meta,work.json) used to clobber
  // them back to the stale pre-finalize values, hiding the facsimile on all single works (fix 2026-06-13).
  if(meta.single){
    const d=await ((meta.single==="work.json"&&_early&&_early.work)
      ?_early.work.catch(()=>jfetch(base+"/"+meta.single+V,2))
      :jfetch(base+"/"+meta.single+V,2));
    meta.pages=d.pages||d.pages;}
  else if(meta.shards&&meta.shards.length){
    // PROGRESSIVE load: paint from the target's shard immediately; the rest streams in the
    // background and triggers one quiet rebuild. A 15-shard Hollaz was ~4MB gz before first
    // paint under the old whole-book Promise.all (audit 2026-07-12) — now ~1/15th.
    const tgt=frReaderBlockReference(location.hash)?.page
           ||new URLSearchParams(location.search).get("p")
           ||(()=>{try{const lr=JSON.parse(lsGet("fr_lastread")||"{}");return (lr[ws]||{}).page;}catch(e){return null;}})();
    let ti=0;
    if(tgt){const k=meta.shards.findIndex(s=>+tgt>=s.from&&+tgt<=s.to);if(k>=0)ti=k;}
    const first=[...new Set([ti,0])];                       // target shard + the spine start
    const parts=new Array(meta.shards.length);
    const ld=$("#reading").querySelector(".loading");let got=0;
    const fetchShard=async i=>{
      const sp=(i===0&&_early&&_early.shard0)?_early.shard0.catch(()=>jfetch(base+"/"+meta.shards[0].file+V,2)):jfetch(base+"/"+meta.shards[i].file+V,2);
      parts[i]=(await sp).pages;
      got++;if(ld)ld.textContent="Loading the text… ("+got+" of "+meta.shards.length+")";};
    await Promise.all(first.map(fetchShard));
    meta.pages=[].concat.apply([],parts.filter(Boolean));
    const rest=meta.shards.map((s,i)=>i).filter(i=>!first.includes(i));
    if(rest.length){let _lr=null;meta.__loadRest=()=>{_lr=_lr||(async()=>{   // memoized: pager + boot may both call
      await Promise.all(rest.map(fetchShard));
      meta.pages=[].concat.apply([],parts);
      // late-streamed pages need their facsimile URLs too — the initial img_base pass only saw
      // the entry shards ("scan unavailable" on every page outside them, UX review 2026-07-13)
      if(meta.img_base)meta.pages.forEach(p=>{if(!p.img){p.img=meta.img_base+p.n+".webp";p.thumb=p.img;}});
      delete meta.__loadRest;})();return _lr;};}
  }
  // facsimile URLs come from img_base (set per work once its scans are migrated to Blob); absent → text-only
  // no separate thumbnail objects were rendered (full-pages-only to save space) — the filmstrip
  // reuses the full page image, lazy-loaded only when the sidebar is opened and scrolled.
  // TEI-ONLY EXPORTS (scholarios/calvin class, 2026-08-18): no shards, no single — pages
  // stay empty here and are synthesized from the TEI's own <pb>s in loadTEI() before build().
  if(!meta.pages)meta.pages=[];
  if(meta.img_base){meta.pages.forEach(p=>{p.img=meta.img_base+p.n+".webp";p.thumb=meta.img_base+p.n+".webp";});}
  else meta.has_pages=false;
  return meta;
}
(async()=>{const _qp=new URLSearchParams(location.search);let ws=_qp.get("ws")||_qp.get("w")||window.__FR_SLUG__||null;   // let: the alias resolver rewrites it (2026-08-20)   // ?w=<title-slug> canonical; ?ws=<path> legacy; /read/<slug> shells bake __FR_SLUG__
  // owner affordances: review mode shows a slim exit banner; the public reader injects a
  // discreet ✎ masthead button ONLY once /api/me confirms the owner (nothing rendered otherwise).
  // In Blob mode there is no /api/me — owner detection arrives with the Firebase sign-in (Phase 4); skip the call.
  if(REVIEW){
    const bn=document.createElement("div");bn.className="rvbanner";
    bn.innerHTML='✎&ensp;<b>Review mode</b>&nbsp;— edits write to the corpus'
      +'<a class="rv-exit" href="'+(ws?"/the-faith-received/read/?w="+encodeURIComponent(ws):"/")+'">⏎ Exit to reading</a>';
    const mn=document.querySelector(".main");mn.insertBefore(bn,mn.firstChild);
  } else if(CLOUD_REVIEW){
    // deployed review page: a clear banner over the live reader. Owner signs in (stivenpeter@gmail.com)
    // → the masthead ✎/✓/⚑/⟳ controls light up (Blob-authoritative edit/redo). State driven by Firebase auth.
    const mn=document.querySelector(".main");
    const bn=document.createElement("div");bn.className="rvbanner";bn.id="cloudRv";mn.insertBefore(bn,mn.firstChild);
    const exit='<a class="rv-exit" href="'+(ws?"/the-faith-received/read/?w="+encodeURIComponent(ws):"/")+'">⏎ Exit to reading</a>';
    window.__frRvSet=function(state,email){
      document.body.classList.toggle("cloud-review",state==="owner");
      if(state==="owner"){
        const nf=window.__frNsCount?window.__frNsCount():0;
        bn.innerHTML='✎&ensp;<b>Review mode — active</b><span class="rv-tip">Double-click any paragraph to edit · ✓ OK / ⚑ Needs / ⟳ redo (model picker) in the masthead</span>'
          +(nf?'<button class="rv-act" id="rvNext">⚑ '+nf+' flagged · next →</button>':'')+exit;
        const nx=document.getElementById("rvNext");if(nx)nx.onclick=()=>{if(window.__frNsNext)window.__frNsNext();};
      }else if(state==="wrong"){
        bn.innerHTML='✎&ensp;<b>Review mode</b><span class="rv-tip">Signed in as '+esc(email||"")+' — not the owner account.</span><button class="rv-act" id="rvSign">Switch account</button>'+exit;
      }else{
        bn.innerHTML='✎&ensp;<b>Review mode</b><span class="rv-tip">Sign in with the owner account to edit this corpus.</span><button class="rv-act" id="rvSign">Sign in</button>'+exit;
      }
      const sg=document.getElementById("rvSign");if(sg)sg.onclick=()=>{if(window.__frSignIn)window.__frSignIn();else{const b=$("#frSync");if(b)b.click();}};
    };
    window.__frRvSet(window.__frRvState||"out");
  } else if(ws&&!BLOB){
    fetch("https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/me").then(r=>r.json()).then(m=>{if(m&&m.owner){
      const b=document.createElement("a");b.id="ownerEdit";b.href="/the-faith-received/review/?ws="+encodeURIComponent(ws);
      b.title="Owner review / QA for this work";b.textContent="✎ Review";
      const ph=document.querySelector(".ph");if(ph)ph.appendChild(b);
    }}).catch(()=>{});
  }
  if(!ws){$("#reading").innerHTML='<div class="loading">No work specified. <a href="/the-faith-received/library/">Return to the library.</a></div>';return;}
  try{ws=await resolveAlias(ws);DATA=await loadWork(ws);
  // TEI-only exports (scholarios/calvin class 2026-08-18) arrive with ZERO pages here —
  // loadTEI() synthesizes the folio skeleton from the sidecar's <pb>s, so only bail
  // pre-TEI when the work has no sidecar to synthesize from.
  if((!DATA.pages||!DATA.pages.length)&&!DATA.has_tei){$("#reading").innerHTML='<div class="loading">No text found for this work.</div>';return;}
  // TEI PATH (2026-08-10): CORRECTED 2026-08-17 (reader-rehaul P0) — has_tei is live in
  // production today (confirmed on luther-wa-schriften-1 and the rest of the Luther-WA
  // publish), so this is real-traffic code, not a dormant path. TEI activates automatically
  // whenever the work declares a sidecar; ?tei=0 remains an escape hatch back to classic
  // rendering, ?tei=1 is now redundant with the default but kept for explicit opt-in links.
  const _teiWanted=(()=>{const q=new URLSearchParams(location.search).get("tei");
      if(q==="0")return false;                       // escape hatch
      if(q==="1")return !!DATA.has_tei;
      return !!DATA.has_tei; // TEI IS THE STANDARD wherever it exists (owner 2026-08-13: smooth reading)
    })();
  // FIRST PAINT BEFORE THE TEI (owner 2026-08-31 "loading much faster"): awaiting the
  // whole-book two-lane TEI held the blank screen ~20s+ on phone bandwidth for a big
  // volume. When shard pages EXIST, paint them now and hydrate the TEI behind — build()
  // re-runs when it lands, restoring the reader to the same folio. TEI-only works
  // (scholarios class: zero pages until the sidecar synthesizes them) still await.
  if(_teiWanted&&(!DATA.pages||!DATA.pages.length))await loadTEI();
  else if(_teiWanted){
    window.__teiHydrating=loadTEI().then(()=>{
      try{
        const position=captureReaderPosition();
        build();
        restoreReaderPosition(position);
        requestAnimationFrame(()=>setTimeout(window.__frLoadTools,60));
      }catch(e){}
      window.__teiHydrating=null;
    }).catch(()=>{window.__teiHydrating=null;});
  }
  if(!DATA.pages||!DATA.pages.length){$("#reading").innerHTML='<div class="loading">No text found for this work.</div>';return;}
  build();requestAnimationFrame(()=>setTimeout(window.__frLoadTools,60));initSearch();
  // ── SEAMLESS SOURCE-LANE SWITCH (owner 2026-09-04 'switching and having both
  // seamless, minimal load time, its a big bug'): the Greek/Latin/parallel pill used to
  // set location.href — a FULL reload, re-downloading a multi-MB TEI per click. Now the
  // lane rebuilds in place: the TEI and pageview ride session caches, the URL updates via
  // replaceState, and the reader stays on the same folio.
  window.__switchSrc=async ns=>{
    try{
      const u=new URL(location.href);u.searchParams.set("src",ns);history.replaceState(null,"",u);
      window.__srcOverride=ns;
      const keep=cur;
      const rd=$("#reading");if(rd)rd.style.opacity=".45";
      DATA=await loadWork(ws);
      await loadTEI();   // re-segment the fresh lane docs — build() renders TEI_PAGES, not DATA
      build();
      if(rd)rd.style.opacity="";
      // the user chose a source view — make sure the source lane is actually showing
      {const mp2=document.getElementById("m-par");
       if(mp2&&mp2.getAttribute("aria-pressed")==="false")mp2.click();}
      if(keep){window.__folioLock=Date.now()+1600;
        try{jump(keep);}catch(e){}
        setTimeout(()=>{try{window.__jumpSettle&&window.__jumpSettle(keep);}catch(e){}},700);}
    }catch(e){location.reload();}
  };
  // Cold arrival and same-document source choices share one cancellable navigation owner.
  const arrive=()=>{
    if(window.__readerChoice||window.__frUserScrolled||window.__readerNavigationSuspended)return false;
    const url=new URL(location.href);if(!url.hash&&window.__frInitialReference)url.searchParams.set('p',window.__frInitialReference);
    return window.__frNavigateReaderAnchor(url.href);
  };
  window.__frHashLand=()=>location.hash.length>1?arrive():false;
  window.__frBlockLand=()=>frReaderBlockReference(location.hash)?arrive():false;
  if(!window.__readerChoice&&!window.__frUserScrolled&&(location.hash.length>1||new URLSearchParams(location.search).has('section')||window.__frInitialReference)){
    app.classList.add('prelanding');setTimeout(()=>app.classList.remove('prelanding'),2500);arrive();}
  // stage-2 of the progressive shard load: stream the remaining shards, then one quiet rebuild
  // that restores the reading position (build() is re-entrant; the grip re-attaches after it).
  if(DATA.__loadRest){DATA.__loadRest().then(()=>{const position=captureReaderPosition(),keep=(window.__frTgt&&!window.__frUserScrolled)?window.__frTgt:cur;delete DATA.__loadRest;build();
    {const pt=$("#pgTotal");if(pt){const _pd=pgDenom();pt.textContent="/ "+_pd.txt;pt.title=_pd.tip;}}   // drop the "+" loading cue now the volume is complete
    if(window.__mkGrip)window.__mkGrip();
    // one scrollIntoView is NOT enough after the full rebuild: build() streams folios in chunks,
    // so the target row may not EXIST yet on the first tick (a bare `if(!t)return` left every
    // outside-shard deep link stranded at the pre-rebuild offset — Olearius ?p=1118 sat at ~102),
    // and once it exists, content-visibility placeholders above it re-measure as rendering catches
    // up, dragging the viewport off-target. Retry through both phases; measure the delta against
    // the scroll CONTAINER's top, not the viewport (the masthead offset never converges to 0).
    if(position&&(position.choice||window.__frUserScrolled)){restoreReaderPosition(position);}
    else if(window.__frHashLand&&window.__frHashLand()){/* heading deep link wins over the folio target */}
    else if(window.__frBlockLand&&window.__frBlockLand()){/* citation-door #b target re-lands after the rebuild */}
    else if(position){restoreReaderPosition(position);}
    else if(keep){let n=0,st=0,cj=0;const fix=()=>{if(++n>40||window.__frUserScrolled||st>=3||cj>=5)return;
      const t=$("#reading").querySelector(`.folio[data-page="${keep}"]`);
      if(t){const base=($("#scroll")||document.body).getBoundingClientRect().top;
        const off=Math.abs(t.getBoundingClientRect().top-base);
        if(off>(cj?120:80)){t.scrollIntoView({block:"start"});cj++;st=0;}else st++;}
      setTimeout(fix,180);};fix();}
  }).catch(()=>{});}
  if(REVIEW)await initReview();else{initReaderTools();
    // first-run orientation (2026-07-21): one quiet line for new readers — what the lane buttons,
    // Contents drawer, and search do. Dismissible; stops appearing after 3 visits regardless.
    try{const seen=+((lsGet("fr_coach_v1"))||0);
      if(seen>=0&&seen<3){lsSet("fr_coach_v1",String(seen+1));
        const c=document.createElement("div");c.className="coach";
        c.innerHTML='Welcome — read in <b>English</b>, <b>Latin</b>, or both, and open the original <b>Scan</b>, from the buttons above · <b>☰&hairsp;Contents</b> holds the work’s outline · <b>⌕</b>&hairsp;(⌘K) searches this work, the whole library, and asks questions with citations.<button class="coach-x" aria-label="Dismiss">✕</button>';
        c.querySelector(".coach-x").onclick=()=>{try{lsSet("fr_coach_v1","9");}catch(e){}c.remove();};
        c.style.marginTop=((document.querySelector(".ph")||{}).offsetHeight||56)+"px";   // clear the fixed masthead — the scroll content's first strip runs under it
        const sc0=$("#scroll");if(sc0)sc0.insertBefore(c,sc0.firstChild);}}catch(e){}
    // default layout: English only. The reader's last explicit lane combination (fr_lanes) wins on
    // return visits; pre-lanes visitors fall back to their old preset (fr_mode).
    let restored=false;
    try{const sl=JSON.parse(lsGet("fr_lanes2")||"null");
      if(sl&&typeof sl.en==="boolean"){Object.assign(LN,{en:!!sl.en,la:!!sl.la,fx:!!sl.fx});applyLanes();restored=true;}}catch(e){}
    // on phones the facsimile is a 100vw fixed overlay — a Scan lane restored from a previous
    // session must not cover the text on arrival ("facsimile first loads", 2026-07-12); the
    // reader re-opens it from the thumb bar when wanted.
    if(matchMedia("(max-width:880px)").matches&&LN.fx){LN.fx=false;applyLanes();}
    if(!restored){const saved=lsGet("fr_mode");
      if(saved==="en"||saved==="par"||saved==="study")mode(saved);   // pre-lanes visitors keep their explicit preset
      // true first visit: ONE reading column (owner 2026-09-05 "single column first" — the book
      // measure and reading stamina come before the apparatus; supersedes the 2026-08-17/26
      // parallel-first ruling). Latin and the scan are one gesture away and, once chosen,
      // fr_lanes2 remembers the reader's own combination on every return.
      else{Object.assign(LN,{en:true,la:false,fx:false});applyLanes();}}}
    if(window.__frApplyOwner)window.__frApplyOwner();}   // owner signed in BEFORE the text loaded → wire review controls now
  catch(err){$("#reading").innerHTML='<div class="loading">Failed to load: '+esc(String(err))+' — <a href="/the-faith-received/library/">return to the library</a></div>';}})();
