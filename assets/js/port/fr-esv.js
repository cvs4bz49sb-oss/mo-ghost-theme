/*
 * fr-esv.js — runtime ESV layer (owner 2026-09-10: "change everything
 * from asv to esv").
 *
 * The corpus's chapter files (/v1/bible/all/<book>/<ch>.json.gz) carry the
 * public-domain ASV as each verse's `t`. This shim swaps the DISPLAY text
 * to the ESV at runtime, fetched per chapter from our worker proxy (the
 * same bolls.life upstream the site's mo-bible worker uses) and cached in
 * memory + at the edge. Licensed text is never written into our data
 * files; every consumer falls back to the ASV when the proxy is
 * unreachable, and books outside the 66 (the deuterocanon) keep their
 * Douay-Rheims text. The original ASV stays on each verse as `t_asv`.
 *
 * Mechanism: a fetch() wrapper. Any response whose URL matches a chapter
 * file is parsed, its verses re-texted from the ESV chapter, and handed
 * back as a fresh JSON Response — so the bible scroll, the verse
 * previews, the pair page and the research views all switch together.
 */
(function () {
  "use strict";
  var PROXY = "https://mo-tfr-ask-dev.mo-podcast-feed.workers.dev/v1/chapter/ESV/";
  var BOOKS = ["genesis","exodus","leviticus","numbers","deuteronomy","joshua","judges","ruth",
    "1-samuel","2-samuel","1-kings","2-kings","1-chronicles","2-chronicles","ezra","nehemiah",
    "esther","job","psalms","proverbs","ecclesiastes","song-of-solomon","isaiah","jeremiah",
    "lamentations","ezekiel","daniel","hosea","joel","amos","obadiah","jonah","micah","nahum",
    "habakkuk","zephaniah","haggai","zechariah","malachi",
    "matthew","mark","luke","john","acts","romans","1-corinthians","2-corinthians","galatians",
    "ephesians","philippians","colossians","1-thessalonians","2-thessalonians","1-timothy",
    "2-timothy","titus","philemon","hebrews","james","1-peter","2-peter","1-john","2-john",
    "3-john","jude","revelation"];
  var NUM = {};
  BOOKS.forEach(function (s, i) { NUM[s] = i + 1; NUM[s.replace(/-/g, "")] = i + 1; });
  // common alternate slugs seen in the corpus index
  var ALT = { "song-of-songs": 22, canticles: 22, "revelation-of-john": 66, psalm: 19 };
  Object.keys(ALT).forEach(function (k) { NUM[k] = ALT[k]; NUM[k.replace(/-/g, "")] = ALT[k]; });

  var cache = new Map(); // "num/ch" -> Promise<Map(verse->text)>
  function esvChapter(num, ch) {
    var key = num + "/" + ch;
    if (!cache.has(key)) {
      cache.set(key, fetch(PROXY.replace(/ESV\/$/, "ESV/") + num + "/" + ch, { mode: "cors" })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (rows) {
          var m = new Map();
          (rows || []).forEach(function (v) {
            if (v && v.verse) m.set(+v.verse, String(v.text || "").replace(/<[^>]+>/g, "").trim());
          });
          if (!m.size) throw 0;
          return m;
        })
        .catch(function () { cache.delete(key); return null; }));
    }
    return cache.get(key);
  }
  window.FRESV = { chapter: esvChapter, bookNum: function (slug) { return NUM[String(slug || "").toLowerCase()] || null; } };

  var CH_RE = /\/v1\/bible\/(?:all|[a-z]{2})\/([a-z0-9-]+)\/(\d{1,3})\.json(?:\.gz)?(?:$|\?)/;
  var origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var m = CH_RE.exec(url);
    if (!m) return origFetch(input, init);
    var num = NUM[m[1]];
    if (!num) return origFetch(input, init);
    return origFetch(input, init).then(function (resp) {
      if (!resp.ok) return resp;
      return resp.clone().arrayBuffer().then(function (buf) {
        var u8 = new Uint8Array(buf);
        var textP = (u8[0] === 31 && u8[1] === 139)
          ? new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text()
          : Promise.resolve(new TextDecoder().decode(u8));
        return Promise.all([textP, esvChapter(num, +m[2])]).then(function (res) {
          var doc; try { doc = JSON.parse(res[0]); } catch (e) { return resp; }
          var esv = res[1];
          if (esv && doc && Array.isArray(doc.verses)) {
            doc.verses.forEach(function (v) {
              var t2 = esv.get(+v.v);
              if (t2) { v.t_asv = v.t; v.t = t2; }
            });
            doc.text = "English Standard Version (Crossway), fetched at read time; American Standard Version fallback.";
          }
          return new Response(JSON.stringify(doc), { status: 200,
            headers: { "Content-Type": "application/json" } });
        });
      }).catch(function () { return resp; });
    });
  };

  // visible attribution labels: ASV -> ESV wherever the UI names the text
  function relabel(root) {
    var walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
    var n; var hits = [];
    while ((n = walker.nextNode())) {
      if (/American Standard Version|\bASV\b/.test(n.nodeValue)) hits.push(n);
    }
    hits.forEach(function (t) {
      t.nodeValue = t.nodeValue
        .replace(/American Standard Version \(1901\)/g, "English Standard Version")
        .replace(/American Standard Version/g, "English Standard Version")
        .replace(/\bASV\b/g, "ESV");
    });
  }
  document.addEventListener("DOMContentLoaded", function () {
    relabel(document.body);
    new MutationObserver(function (muts) {
      muts.forEach(function (mu) {
        mu.addedNodes && mu.addedNodes.forEach(function (nd) {
          if (nd.nodeType === 1) relabel(nd);
          else if (nd.nodeType === 3 && /American Standard|\bASV\b/.test(nd.nodeValue)) relabel(nd.parentNode || document.body);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  });
})();
