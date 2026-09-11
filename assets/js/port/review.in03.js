
/* an Ask tab beside Outline/Index/Library opens the workspace docked in place */
(function(){var tries=0,t=setInterval(function(){
  var nav=document.querySelector('.sidebar .nav-vt');
  if(++tries>200){clearInterval(t);return}
  if(!nav||!window.FRAsk||!window.FRAsk.open)return;
  clearInterval(t);
  if(nav.querySelector('[data-ask-rail]'))return;
  var b=document.createElement('button');b.type='button';b.textContent='Ask';
  b.setAttribute('data-ask-rail','1');
  b.onclick=function(){try{window.FRAsk.open({});}catch(e){}};
  nav.appendChild(b);
},400);})();
