try{var _t=localStorage.getItem("fr_theme");
if(_t==="dark")document.documentElement.setAttribute("data-theme","dark");
else if(!_t&&matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.setAttribute("data-theme","dark");
}catch(e){}