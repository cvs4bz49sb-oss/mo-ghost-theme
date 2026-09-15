/* Printed Migne columns remain citations; a reader opening can contain two columns. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FRMigneNavigation=api;})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const key=value=>String(value??'').trim();
  const isReadingDivision=type=>!['translation','secondary','diplomatic','witness','edition'].includes(String(type||''));
  function openingKey(data,column){
    const wanted=key(column),pages=data?.pages||[];
    const exact=pages.find(page=>key(page.n)===wanted);if(exact)return key(exact.n);
    if(!(/^pg-/.test(data?.slug||'')||/^PG\s/.test(data?.volume||''))||!/^\d+$/.test(wanted))return wanted;
    const n=Number(wanted);if(!Number.isSafeInteger(n)||n<2||n%2)return wanted;
    const opening=pages.find(page=>key(page.n)===String(n-1));
    return opening?key(opening.n):wanted;
  }
  function indexLabel(entry,range,showRange=false){
    const column=key(entry?.c);
    if(showRange&&Array.isArray(range)&&range.length===2&&key(range[0])===column){
      return key(range[0])===key(range[1])?column:key(range[0])+'–'+key(range[1]);
    }
    return column;
  }
  function sourceForOpening(text){
    text=String(text||'');
    const latin=(text.match(/[A-Za-z]/g)||[]).length,greek=(text.match(/[\u0370-\u03ff\u1f00-\u1fff]/g)||[]).length;
    const words=new Set(text.toLowerCase().match(/\b(?:et|quod|qui|quae|cum|autem|enim|sunt|ejus|eius|atque|igitur|haec|fuit|erat)\b/g)||[]);
    return latin>=200&&latin>greek*10&&words.size>=3?'la':'grc';
  }
  return {isReadingDivision,openingKey,indexLabel,sourceForOpening};
});
