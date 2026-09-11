/* UI-only research helpers. Published counts and identifiers are preserved. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FRResearch=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const shelves={pl:'Latin Fathers',gf:'Greek Fathers',po:'Eastern Fathers',ed:'English Divines',md:'Medieval',rc:'Roman Catholic',lu:'Lutheran',rf:'Continental Reformed',hl:'Humanism and Law'};
 const shelfMaps={pl:'latin-fathers',gf:'greek-fathers',po:'eastern-fathers',ed:'english-divines',md:'medieval',rc:'roman-catholic',lu:'lutheran',rf:'reformed',hl:'humanism-and-law'};
 const topicURL=(slug='',sh='')=>'/the-faith-received/topics/'+(shelves[sh]?'?sh='+encodeURIComponent(sh):'')+(slug?'#'+encodeURIComponent(slug):'');
 // Map weights are not page counts. Only the published count label has that meaning.
 function scopedTopics(topics,nodes){const byName=new Map(nodes.map(n=>[fold(n.a),n]));return topics.flatMap(t=>{const node=byName.get(fold(t.t));if(!node)return [];const m=String(node.sub||'').match(/^([\d,]+) mined pages?$/);return [{...t,n:m?Number(m[1].replace(/,/g,'')):null,na:null}];});}
 function mergePageRefs(...lists){const rows=new Map();for(const r of lists.flat()){if(!r.w||page(r.p)===null)continue;const key=JSON.stringify([r.w,page(r.p)]);if(!rows.has(key))rows.set(key,{...r,p:page(r.p)});else{const old=rows.get(key);if(String(r.g||'').length>String(old.g||'').length)old.g=r.g;}}return [...rows.values()];}
 function mapAuthorPages(nodes,topic,author){const n=nodes.find(n=>fold(n.a)===fold(topic)),prefix=author+' · ';return (n?.rows||[]).filter(r=>String(r.t||'').startsWith(prefix)).map(r=>({...r,wt:r.t.slice(prefix.length),a:author}));}
 const eras={E:'Early patristic',L:'Later patristic',C:'Carolingian',H:'High medieval',R:'Reformation',P:'Seventeenth century',M:'Later authors',U:'Undated'};
 const fold=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const nameWords=value=>fold(value).replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
 function authorScore(author,query){
  const q=nameWords(query);if(!q)return 1;const tokens=q.split(' '),compact=q.replace(/ /g,'');
  const names=[author.a,author.s,...(author.variants||[]).flatMap(v=>[v.a,v.s]),...(author.aliases||[])].filter(v=>typeof v==='string').map(nameWords);
  let score=0;for(const name of names){const words=name.split(' ');if(name===q)score=Math.max(score,100);else if(words.every(w=>tokens.includes(w))&&tokens.every(t=>words.includes(t)))score=Math.max(score,95);
    else if(tokens.every(t=>words.some(w=>w.startsWith(t))))score=Math.max(score,80);
    else if(name.includes(q))score=Math.max(score,65);
    else if(compact.length>=4&&name.replace(/ /g,'').includes(compact))score=Math.max(score,50);}
  return score;
 }
 const isRawTopic=v=>/\bloci_other\b|\bunplaced\b|\buse closest\b|\bnot (?:(?:in|on)(?: the| a)? (?:(?:closed|canonical) )?list|listed|a (?:listed )?locus)\b|\babsent from (?:the )?list\b/i.test(String(v||''));
 const era=r=>!Number(r.y)?'U':r.y<500?'E':r.y<800?'L':r.y<1100?'C':r.y<1450?'H':r.y<1600?'R':r.y<1700?'P':'M';
 const page=p=>p===undefined||p===null||p===''?null:String(p);
 const authorURL=(r,topic)=>'/the-faith-received/fathers/'+(r.sh?'?sh='+encodeURIComponent(r.sh):'')+'#'+encodeURIComponent(r.s)+(topic?'/'+encodeURIComponent(topic):'');
 function roster(rows){const groups=new Map();for(const r of rows){if(!r.s)continue;const key=/^(anonymous|unknown|unattributed)$/.test(r.s)?r.s+'|'+r.sh:r.s; if(!groups.has(key))groups.set(key,[]);groups.get(key).push({...r,e:era(r)});}return [...groups.values()].map(variants=>{variants.sort((a,b)=>(b.w||0)-(a.w||0));return {...variants[0],variants};});}
 function voices(data){const out=new Map();for(const a of data.authors||[]){const key=a.a;if(!out.has(key))out.set(key,{...a,rows:[],variants:[]});out.get(key).variants.push(a);}for(const r of data.pos||[]){const key=r.a||'Unattributed';if(!out.has(key))out.set(key,{a:key,rows:[],variants:[]});out.get(key).rows.push(r);}return [...out.values()].map(a=>a.variants.length>1?{...a,sh:null,s:null,n:null,np:null}:a);}
 function connections(topics){const pairs=new Map(),seen=new Set();for(const t of topics){for(const r of [...(t.pages||[]),...(t.pos||[])]){if(!r.w||page(r.p)===null)continue;const names=[...new Set([t.t,...(r.x||[])])].filter(x=>x&&!isRawTopic(x));for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){const [a,b]=[names[i],names[j]].sort();const k=JSON.stringify([a,b]),pk=JSON.stringify([a,b,r.w,page(r.p)]);if(seen.has(pk))continue;seen.add(pk);if(!pairs.has(k))pairs.set(k,{a,b,pages:[]});pairs.get(k).pages.push(r);}}}return [...pairs.values()].sort((a,b)=>b.pages.length-a.pages.length||a.a.localeCompare(b.a));}
 function safeReaderURL(h){try{const u=new URL(h,'https://thefaithreceived.vercel.app');return u.origin==='https://thefaithreceived.vercel.app'&&/^\/read(?:\.html)?$/.test(u.pathname)&&u.searchParams.get('w')?u.pathname+u.search+u.hash:null;}catch(_){return null;}}
 function volumeNumber(value){const s=String(value||'').toUpperCase();if(/^\d+$/.test(s))return Number(s);if(!/^(?=.)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(s))return null;const v={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};return [...s].reduce((n,c,i)=>n+(v[c]<(v[s[i+1]]||0)?-v[c]:v[c]),0);}
 function seriesRef(value){const text=String(value||'').replace(/\bPatrologia\s+(Latina|Graeca|Orientalis)\b/i,(_,s)=>({latina:'PL',graeca:'PG',orientalis:'PO'}[s.toLowerCase()]));const m=text.match(/\b(PL|PG|PO)\s*(?:(?:vol(?:ume)?\.?|tome|t\.)\s*)?(\d+|[IVXLCDM]+)\b/i);if(m){const volume=volumeNumber(m[2]);if(volume!=null)return {series:m[1].toUpperCase(),volume,rest:text.replace(m[0],' ').trim()};}return /^(PL|PG|PO)$/i.test(text.trim())?{series:text.trim().toUpperCase(),volume:null,rest:''}:null;}
 function edition(work){const value=work.volume||work.vs||'',ref=seriesRef(value);if(!ref)return value;let label=ref.series+(ref.volume!=null?' '+ref.volume:'');if(ref.series!=='PO'&&Array.isArray(work.cols)&&work.cols.length===2&&work.cols.every(c=>c!=null)){const [a,b]=work.cols.map(String);label+=a===b?', col. '+a:', cols. '+a+'–'+b;}return label;}
 const volumeLabel=w=>{const ref=seriesRef(w.volume||w.vs);return ref?ref.series+' '+(ref.volume??'volume not recorded'):(w.volume||w.vs||'Volume not recorded');};
 const collator=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
 function volumeOrder(a,b){const key=w=>{const value=volumeLabel(w),ref=seriesRef(value);if(ref)return {label:ref.series,n:ref.volume||0};const m=value.match(/\b(vol(?:ume)?|tome|tomus|band|part|pars)\.?\s+(\d+|[IVXLCDM]+)\b/i);return m&&volumeNumber(m[2])!=null?{label:fold(value.replace(m[0],m[1])),n:volumeNumber(m[2])}:{label:value,n:0};};const x=key(a),y=key(b);return collator.compare(x.label,y.label)||x.n-y.n;}
 function workOrder(a,b){return volumeOrder(a,b)||collator.compare(String(a.cols?.[0]??''),String(b.cols?.[0]??''))||collator.compare(a.t||a.title||'',b.t||b.title||'')||collator.compare(a.w||a.slug||'',b.w||b.slug||'');}
 return {shelves,shelfMaps,topicURL,scopedTopics,mergePageRefs,mapAuthorPages,eras,fold,authorScore,isRawTopic,era,page,authorURL,roster,voices,connections,safeReaderURL,volumeNumber,seriesRef,edition,volumeLabel,workOrder};
});
