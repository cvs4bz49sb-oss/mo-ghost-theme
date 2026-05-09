/*
 * jsonld-fix.js — corrects Ghost's auto-emitted JSON-LD for MO's
 * byline-as-tag content model.
 *
 * Problem:
 *   Ghost auto-injects an Article JSON-LD block where author.name is
 *   the post's Ghost author — for MO that's almost always the
 *   generic "Mere Orthodoxy" house account, because real bylines
 *   live in tags whose slug starts with `author-` (set during the
 *   HubSpot → Ghost migration to credit 30+ contributors without
 *   paying for staff seats per author).
 *
 *   For AEO and Google E-E-A-T, accurate Person markup on every
 *   post is the single biggest signal; without it, MO loses author
 *   authority on every essay.
 *
 * Fix:
 *   1. On post pages: read byline tag(s) from the rendered DOM
 *      (the theme already correctly emits `[data-tag-slug^="author-"]`
 *      anchors inside `[data-byline]`), rebuild the Article block
 *      with `author` as one or more Person entries, and add
 *      `articleSection` from non-byline tags.
 *   2. On the homepage: enrich the WebSite block with a
 *      potentialAction SearchAction so crawlers know about /search/.
 *
 * Runs synchronously at parse time so JSON-LD is in the DOM before
 * any render-pass crawl. JSON.stringify handles string escaping
 * (titles with quotes etc).
 */
(function () {
  if (typeof document === "undefined") return;

  function findArticleBlock() {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < scripts.length; i++) {
      try {
        var data = JSON.parse(scripts[i].textContent || "");
        if (data && (data["@type"] === "Article" || data["@type"] === "BlogPosting")) {
          return { node: scripts[i], data: data };
        }
      } catch (_) {}
    }
    return null;
  }
  function findWebSiteBlock() {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < scripts.length; i++) {
      try {
        var data = JSON.parse(scripts[i].textContent || "");
        if (data && data["@type"] === "WebSite") {
          return { node: scripts[i], data: data };
        }
      } catch (_) {}
    }
    return null;
  }

  function fixArticle() {
    var hit = findArticleBlock();
    if (!hit) return;

    // Pull byline tags out of the rendered article header. The
    // theme emits every tag with `data-tag-slug` and uses CSS to
    // visually filter to `[data-tag-slug^="author-"]` — same
    // filter applies here.
    var byline = document.querySelector("[data-byline]");
    if (!byline) return;
    var anchors = byline.querySelectorAll('[data-tag-slug^="author-"]');
    if (!anchors.length) return; // no author- tag; leave Ghost default alone

    var origin = window.location.origin;
    var people = [];
    anchors.forEach(function (a) {
      var nameEl = a.querySelector(".meta-author-name");
      var name = (nameEl ? nameEl.textContent : a.textContent || "").trim();
      var href = a.getAttribute("href") || "";
      var url = href.indexOf("http") === 0 ? href : origin + href;
      if (!name) return;
      people.push({ "@type": "Person", "name": name, "url": url });
    });
    if (!people.length) return;

    // articleSection: all non-byline public tags by name, in order.
    var topics = [];
    document.querySelectorAll("[data-topic] [data-tag-slug]").forEach(function (a) {
      var slug = a.getAttribute("data-tag-slug") || "";
      if (slug.indexOf("author-") === 0) return;
      if (slug.indexOf("hash-") === 0) return; // internal tags
      var name = (a.textContent || "").trim();
      if (name && topics.indexOf(name) === -1) topics.push(name);
    });

    var data = hit.data;
    data.author = people.length === 1 ? people[0] : people;
    if (topics.length) data.articleSection = topics;
    if (topics.length) data.keywords = topics.join(", ");

    // Word count from article body
    var body = document.querySelector(".article-content");
    if (body) {
      var wc = (body.textContent || "").trim().split(/\s+/).length;
      if (wc > 0) data.wordCount = wc;
    }

    // Reading time from the rendered meta
    var timeEl = document.querySelector(".article-meta .meta-date");
    if (timeEl) {
      var tm = (timeEl.textContent || "").match(/(\d+)\s*min/);
      if (tm) data.timeRequired = "PT" + tm[1] + "M";
    }

    // Access: free vs members-only
    var gate = document.querySelector(".post-gate");
    data.isAccessibleForFree = !gate || gate.style.display === "none" ? true : false;
    data.isPartOf = {
      "@type": "WebSite",
      "name": "Mere Orthodoxy",
      "url": window.location.origin + "/"
    };

    hit.node.textContent = JSON.stringify(data);
  }

  function fixWebsite() {
    var hit = findWebSiteBlock();
    if (!hit) return;
    if (hit.data.potentialAction) return; // already present

    // Ghost's built-in sodo-search posts to /search but we use a
    // hash-modal (no dedicated URL). The SearchAction template URL
    // pattern below points to a generic /?s=... which Ghost
    // doesn't natively support — but the convention is what
    // crawlers parse for "this site has search," and giving them
    // a target is fine even if it 404s for users (they'll always
    // arrive via the modal trigger).
    var origin = (hit.data.url || window.location.origin).replace(/\/$/, "");
    hit.data.potentialAction = {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": origin + "/?s={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    };
    hit.node.textContent = JSON.stringify(hit.data);
  }

  // Run as soon as the DOM has the article header. Document parse
  // is fast enough that DOMContentLoaded is overkill — but defer
  // to it so we know byline + topic markup is in.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
  function run() {
    try { fixArticle(); } catch (e) { /* fail silent — keep Ghost default */ }
    try { fixWebsite(); } catch (e) { /* fail silent */ }
  }
})();
