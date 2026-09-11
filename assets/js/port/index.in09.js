
/* CHAT DYNAMICS (2026-09-02): a new turn glides into view the way every good chat does,
   and the draft box grows with the thought (capped by its CSS max-height). */
(function(){
  const mo=new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes){
    if(n.nodeType===1&&n.classList&&n.classList.contains("ask-turn")){
      setTimeout(()=>{try{n.scrollIntoView({behavior:"smooth",block:"start"});}catch(e){}},80);}}});
  const arm=()=>{const t=document.querySelector(".ask-thread");if(t&&!t.__mo){t.__mo=1;mo.observe(t,{childList:true});}};
  arm();new MutationObserver(arm).observe(document.body,{childList:true,subtree:true});
  document.addEventListener("input",e=>{
    const t=e.target;
    if(t&&t.tagName==="TEXTAREA"&&t.closest(".ask-composer")){
      t.style.height="auto";t.style.height=Math.min(t.scrollHeight,152)+"px";}});
})();
