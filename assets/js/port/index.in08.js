
(function(){
  const bar=document.createElement("nav");bar.id="appbar";bar.setAttribute("aria-label","App sections");
  bar.innerHTML='<button data-a=lib class=on><span class=ai>&#9636;</span>Library</button>'+
    '<button data-a=search><span class=ai></span>Search</button>'+'<button data-a=ask><span class=ai></span>Ask</button>'+
    '<button data-a=sections aria-expanded=false aria-controls=secSheet aria-haspopup=dialog><span class=ai>&#9776;</span>Sections</button>'+
    '<button data-a=notebook><span class=ai></span>Notebook</button>';
  document.body.appendChild(bar);
  // One close path keeps the mobile sheet, trigger, and focus in the same state.
  const sheet=document.createElement("div");sheet.id="secSheet";sheet.hidden=true;
  sheet.setAttribute("role","dialog");sheet.setAttribute("aria-modal","true");sheet.setAttribute("aria-label","Site sections");
  sheet.innerHTML='<div class=ss-scrim></div><nav class=ss-panel aria-label="Site sections">'+
    [['/#confessions','Confessions'],['/the-faith-received/bible/','Scripture'],['/the-faith-received/fathers/','\u25cc Authors'],['/the-faith-received/fathers/#works','\u25a4 Works'],
     ['/the-faith-received/topics/','\u2318 Topics'],['/the-faith-received/web/','\u2727 The Web'],['/the-faith-received/desk/','\u270e Desk'],['/the-faith-received/pins/','\u25a4 Notebook']]
    .map(x=>'<a href="'+x[0]+'">'+x[1]+'</a>').join("")+'</nav>';
  document.body.appendChild(sheet);
  const sectionsButton=bar.querySelector('[data-a="sections"]');
  const setOn=a=>bar.querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.a===a));
  const focusContent=()=>{
    const content=document.getElementById("lib");if(!content)return;
    if(!content.hasAttribute("tabindex")){content.setAttribute("tabindex","-1");content.addEventListener("blur",()=>content.removeAttribute("tabindex"),{once:true});}
    content.focus({preventScroll:true});
  };
  const closeSheet=(restoreFocus=true)=>{
    const wasOpen=!sheet.hidden;sheet.hidden=true;sectionsButton.setAttribute("aria-expanded","false");
    if(wasOpen){setOn("lib");if(restoreFocus)sectionsButton.focus({preventScroll:true});}
  };
  const openSheet=()=>{
    sheet.hidden=false;sectionsButton.setAttribute("aria-expanded","true");setOn("sections");
    sheet.querySelector("a[href]")?.focus({preventScroll:true});
  };
  const closeForNavigation=()=>{
    const focusedInSheet=!sheet.hidden&&sheet.contains(document.activeElement);
    closeSheet(false);if(focusedInSheet)focusContent();
  };
  sheet.querySelector(".ss-scrim").onclick=()=>closeSheet();
  sheet.addEventListener("click",e=>{
    const link=e.target.closest("a[href]");if(!link)return;
    closeSheet(false);
    const destination=new URL(link.href,location.href),path=p=>p.replace(/index\.html$/i,"");
    if(destination.origin===location.origin&&path(destination.pathname)===path(location.pathname))requestAnimationFrame(focusContent);
  });
  document.addEventListener("keydown",e=>{
    if(sheet.hidden)return;
    if(e.key==="Escape"){e.preventDefault();e.stopPropagation();closeSheet();return;}
    if(e.key!=="Tab")return;
    const links=[...sheet.querySelectorAll("a[href]")],first=links[0],last=links[links.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  });
  addEventListener("hashchange",closeForNavigation);
  addEventListener("popstate",closeForNavigation);
  addEventListener("pageshow",closeForNavigation);
  matchMedia("(max-width:700px)").addEventListener("change",e=>{if(!e.matches)closeForNavigation();});
  bar.addEventListener("click",e=>{
    const b=e.target.closest("button");if(!b)return;const a=b.dataset.a;
    if(a==="sections"){if(sheet.hidden)openSheet();else closeSheet();return;}
    closeSheet(false);setOn(a);
    if(a==="lib"){const nb=document.getElementById("navLib");if(nb)nb.click();window.scrollTo({top:0,behavior:"smooth"});}
    else if(a==="conf"){const nb=document.getElementById("navConf");if(nb)nb.click();}
    // ONE surface for search AND ask: the overlay's own tabs switch modes inline
    else if(a==="ask"){if(window.FRAsk)window.FRAsk.open();}
    else if(a==="search"){if(window.FRHome)window.FRHome.focus();}
    else if(a==="notebook"){location.href="/the-faith-received/pins/";}
  });
})();
