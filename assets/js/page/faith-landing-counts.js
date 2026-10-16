/* Use the same normalized catalogue as All works, without static totals. */
(function(){
 if(!window.MOCorpora||!document.querySelector('.faith-landing'))return;
 const ids=['pg','pld','po','tfr','eebo','confessions','mo'];
 // Counted as the lists show them: Migne's apparatus (indices, notices, admonitions) is not a work (2026-09-25).
 Promise.all(ids.map(id=>window.MOFaithCatalogue.load(id).catch(()=>[]))).then(raw=>{
   const sets=raw.map(ws=>ws.filter(w=>window.MOFaithCatalogue.shelved(w)));
   sets.forEach((works,i)=>{if(works.length)document.querySelectorAll(`[data-landing-corpus="${ids[i]}"]`).forEach(el=>el.textContent=`${works.length.toLocaleString()} ${ids[i]==='confessions'?'documents':'works'}`);});
   if(sets.some(works=>!works.length))return; // Keep descriptive labels if any catalogue failed.
   const all=sets.filter((_, i)=>ids[i]!=='confessions').flat();
   // THE HEADLINE TOTAL IS THE WHOLE CATALOGUE (Ian, 2026-09-28: "update this to be 19,597"): every entry, Migne's
   // apparatus included, not the lists' shelved count. It was then set in the template and stood still while the catalogue
   // changed ("Works available to read … is not updating", 2026-10-13), so it is counted again from the same files: every
   // entry of the seven catalogues this page loads. The template's figure shows only until the count arrives.
   const whole=raw.reduce((n,ws)=>n+ws.length,0);
   document.querySelectorAll('[data-landing-total]').forEach(el=>el.textContent=whole.toLocaleString());
   // The Councils are Mansi's volumes, counted here and again on Roman Catholic, where the catalogue files them (owner, 2026-10-11).
   const councils=all.filter(w=>/^mansi-/.test(String(w.id||w.slug||'')));
   if(councils.length)document.querySelectorAll('[data-landing-councils]').forEach(el=>el.textContent=`${councils.length.toLocaleString()} ${councils.length===1?'volume':'volumes'}`);
   document.querySelectorAll('[data-landing-tradition]').forEach(el=>{
     const tradition=el.dataset.landingTradition;
     const matches=all.filter(w=>{const t=String(w.tradition||'').trim();const parent=window.MOCorpora.traditionParent?.(t,w.corpus);return (parent==='Protestant'&&['Puritan','Anglican'].includes(t)?'English Divines':t)===tradition;});
     if(matches.length)el.textContent=window.MOFaithCatalogue.countLabel(matches);
   });
 });
})();
