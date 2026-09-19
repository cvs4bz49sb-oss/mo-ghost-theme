/*
 * author-address.js — this site's author address, resolved for the ported room.
 *
 * Ian's links say /the-faith-received/author/?a=<folded name> (richardbaxter);
 * the corpus site's research shell deep-links by slug hash (#richard-baxter) and
 * resolves the shelf itself. Fold-match the param against the nine shelf rosters on
 * the library worker and set the hash; the shell's router does the rest. An
 * external file because the site's CSP forbids inline scripts (2026-09-19).
 */
(function(){try{var q=new URLSearchParams(location.search);var a=q.get("a");if(!a||location.hash)return;var fold=function(s){return String(s).toLowerCase().replace(/[^a-z0-9]/g,"")};var want=fold(a);var B="https://mo-tfr-library.mo-podcast-feed.workers.dev";var NS=["pl","gf","po","ed","md","rc","lu","rf","hl"];Promise.all(NS.map(function(ns){return fetch(B+"/v1/bible/"+ns+"/rooms/index.json").then(function(r){return r.ok?r.json():null}).catch(function(){return null})})).then(function(all){for(var i=0;i<all.length;i++){var d=all[i];if(!d||!d.authors)continue;for(var j=0;j<d.authors.length;j++){var e=d.authors[j];if(fold(e.s)===want||fold(e.a)===want){location.hash=e.s;return}}}location.hash=a;});}catch(e){}})();
