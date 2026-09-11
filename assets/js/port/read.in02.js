
/* early fetch: kick off the work's meta.json + the EN-titles overlay while the rest of this
   ~300KB document is still parsing — loadWork() consumes these promises instead of starting the
   network cold after full parse (saves 2 sequential RTTs on first paint; perf pass 2026-07-16).
   The config block at the end of <head> has already run, so __FR_BLOB_BASE__/__FR_VER exist. */
(function(){try{
  var B=(window.__FR_BLOB_BASE__&&!/TBD/.test(String(window.__FR_BLOB_BASE__)))?String(window.__FR_BLOB_BASE__).replace(/\/+$/,""):null;
  if(!B)return;
  var q=new URLSearchParams(location.search),ws=q.get("ws")||q.get("w");
  var V=window.__FR_VER?("?v="+window.__FR_VER):"";
  var j=function(u){return fetch(u).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();});};
  window.__frEarly={ws:ws,titles:j(B+"/v1/titles_en.json"+V)};
  var cm=ws&&ws.match(/^(pld|pg|po)-(\d+)$/);
  var eb=ws&&ws.match(/^eebo-(\d+)$/);   // canon family: never probe the per-work store
  if(cm){window.__frEarly.canon=fetch(B+"/v1/tei/"+cm[1]+"/"+cm[2]+".xml").then(function(r){if(!r.ok)throw 0;return r.text();});
    window.__frEarly.canon.catch(function(){});
    window.__frEarly.auEn=j(B+"/v1/authors_en.json"+V);window.__frEarly.auEn.catch(function(){});}
  else if(eb){window.__frEarly.canonEebo=fetch(B+"/eebo/"+eb[1]+".json.gz").then(function(r){if(!r.ok)throw 0;return r;});
    window.__frEarly.canonEebo.catch(function(){});}
  else if(ws){window.__frEarly.meta=j(B+"/v1/works/"+encodeURIComponent(ws)+"/meta.json"+V);
    // speculative: most works are single-file work.json — having it on the wire alongside
    // meta saves a full serialized RTT on the first-text path. Sharded/TEI-only works just
    // never consume it (the .catch keeps a stray 404 quiet).
    window.__frEarly.work=j(B+"/v1/works/"+encodeURIComponent(ws)+"/work.json"+V);
    window.__frEarly.work.catch(function(){});
    // sharded works: shard 0 is ALWAYS fetched (spine start) — speculate it alongside meta
    window.__frEarly.shard0=j(B+"/v1/works/"+encodeURIComponent(ws)+"/pages/0000.json"+V);
    window.__frEarly.shard0.catch(function(){});}
  
}catch(e){}})();
