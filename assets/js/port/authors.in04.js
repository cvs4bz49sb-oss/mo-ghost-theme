(function(){var b=document.getElementById("thBtn");if(!b)return;
var r=document.documentElement;function ic(){b.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></svg>';}ic();
b.onclick=function(){var n=(r.getAttribute("data-theme")==="dark")?"light":"dark";
r.setAttribute("data-theme",n);
try{localStorage.setItem("fr_theme",n)}catch(e){}ic();};})();