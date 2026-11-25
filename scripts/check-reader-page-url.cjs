// TFR ticket #66: the reader's address follows the page being read, and a page typed into the address bar lands.
// Runs the reader-core.js functions themselves against a stub window, so a rename or a dropped call fails here.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(path.join(__dirname,'../assets/js/port/reader-core.js'),'utf8');
const pick=(start,end)=>{const a=src.indexOf(start);assert(a>=0,'missing '+start);const b=src.indexOf(end,a);assert(b>a,'missing end of '+start);return src.slice(a,b);};
const code=[
  pick('function frReaderBlockReference(','function captureReaderPosition('),
  pick('function frReaderPageHref(','// Citation and research anchors'),
].join('\n');
assert(/function setFolio\(pg\)\{if\(!pg\|\|cur===pg\.n\)return;cur=pg\.n;[^\n]*syncReaderPageUrl\(pg\.n\)/.test(src),'setFolio calls syncReaderPageUrl');

function run(href,state){
  const timers=[],listeners={},calls=[];
  const location=new URL(href);
  const win={...state,addEventListener:(t,f)=>{listeners[t]=f;},__frNavigateReaderAnchor:h=>{calls.push(h);return true;}};
  const ctx={window:win,location,URL,String,decodeURIComponent,cur:null,addEventListener:win.addEventListener,
    history:{state:null,replaceState:(_s,_t,u)=>{const n=new URL(u,location.href);location.href=n.href;}},
    setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout:id=>{if(id)timers[id-1]=null;}};
  vm.createContext(ctx);vm.runInContext(code,ctx);
  const flush=()=>{const t=timers.splice(0);t.forEach(f=>f&&f());};
  return {ctx,win,location,flush,listeners,calls};
}
let n=0;const ok=(c,m)=>{assert(c,m);n++;};

// A reader who scrolled on their own: the address now names their page, and stale arrival params go.
{const r=run('https://mereorthodoxy.com/the-faith-received/read/?w=keckermann-opera-vol-2&p=13&section=4#b13-0',{__frUserScrolled:true});
 r.ctx.cur=500;vm.runInContext('syncReaderPageUrl(500)',r.ctx);r.flush();
 ok(r.location.href==='https://mereorthodoxy.com/the-faith-received/read/?w=keckermann-opera-vol-2#b500-0','scrolled page is in the address: '+r.location.href);}
// A bare link the reader has not touched keeps its address, so it still opens at the top (report #42).
{const r=run('https://mereorthodoxy.com/the-faith-received/read/?w=keckermann-opera-vol-2',{});
 r.ctx.cur=10;vm.runInContext('syncReaderPageUrl(10)',r.ctx);r.flush();
 ok(r.location.hash==='','an unmoved reader leaves the address alone');}
// An arrival still being placed (a choice or a pending position) keeps its own target.
for(const s of [{__frUserScrolled:true,__readerChoice:{page:'900'}},{__frUserScrolled:true,__readerPendingPosition:{}},{__frUserScrolled:true,__readerNavigationSuspended:true}]){
 const r=run('https://mereorthodoxy.com/the-faith-received/read/?w=keckermann-opera-vol-2#b900-0',s);
 r.ctx.cur=899;vm.runInContext('syncReaderPageUrl(899)',r.ctx);r.flush();
 ok(r.location.hash==='#b900-0','an arrival in flight keeps its target ('+Object.keys(s).join(',')+')');}
// Only the page the reader settles on is written: fast scrolling past pages writes once.
{const r=run('https://mereorthodoxy.com/the-faith-received/read/?w=x#b1-0',{__frUserScrolled:true});
 let writes=0;const rs=r.ctx.history.replaceState;r.ctx.history.replaceState=(...a)=>{writes++;rs(...a);};
 for(const p of [2,3,4]){r.ctx.cur=p;vm.runInContext(`syncReaderPageUrl(${p})`,r.ctx);}r.flush();
 ok(writes===1&&r.location.hash==='#b4-0','fast scrolling writes the settled page once (writes='+writes+')');}
// The same page already in the address (any block on it) is left as it is.
{const r=run('https://mereorthodoxy.com/the-faith-received/read/?w=x#b7-3',{__frUserScrolled:true});
 r.ctx.cur=7;vm.runInContext('syncReaderPageUrl(7)',r.ctx);r.flush();ok(r.location.hash==='#b7-3','a row on the same page keeps its precise anchor');}
// Typing a new page into the address bar lands it; other hashes are not the reader's.
{const r=run('https://mereorthodoxy.com/the-faith-received/read/?w=x#b10-0',{});
 r.location.hash='#b500-0';r.listeners.hashchange();ok(r.calls.length===1&&r.calls[0].endsWith('#b500-0'),'a typed #b500-0 navigates');
 r.location.hash='#reading';r.listeners.hashchange();ok(r.calls.length===1,'#reading (skip link) is left to the browser');}
console.log(`check-reader-page-url: ${n} checks passed`);
