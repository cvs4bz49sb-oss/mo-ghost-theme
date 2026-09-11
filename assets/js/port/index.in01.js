/* theme: an explicit choice wins; otherwise the OS decides (owner 2026-08-29 "dark mode pls") */
try{var _t=localStorage.getItem("fr_theme");
if(_t)document.documentElement.setAttribute("data-theme",_t);
else if(matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.setAttribute("data-theme","dark");
}catch(e){}