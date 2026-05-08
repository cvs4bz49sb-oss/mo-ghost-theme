/*
 * Title cleanup: suffix removal + smart-quote direction fix.
 *
 * 1. Suffix: older posts carry "- Mere Orthodoxy | Christianity,
 *    Politics, and Culture" in their Ghost title. Strip it.
 *
 * 2. Quotes: HubSpot-imported titles sometimes have right curly
 *    quotes in opening position (’ where ‘ belongs,
 *    ” where “ belongs). Fix direction based on context.
 */
(function () {
  var SUFFIX_RE = /\s*[-\u2013\u2014]\s*Mere\s*Orthodoxy\s*(?:\|[^|]*)?\s*$/i;

  function strip(s) {
    if (typeof s !== "string") return s;
    return s.replace(SUFFIX_RE, "").trimEnd();
  }

  function fixQuotes(s) {
    if (typeof s !== "string") return s;
    // Right single quote in opening position → left single quote
    s = s.replace(/(^|[\s—–(\[{"“])’(?=\w)/g, '$1‘');
    // Right double quote in opening position → left double quote
    s = s.replace(/(^|[\s—–(\[{'‘])”(?=\w)/g, '$1“');
    return s;
  }

  function fixQuotesInTree(root) {
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      var fixed = fixQuotes(node.nodeValue);
      if (fixed !== node.nodeValue) node.nodeValue = fixed;
    }
  }

  function cleanMeta(selector, attr) {
    var el = document.querySelector(selector);
    if (!el) return;
    var v = el.getAttribute(attr);
    var next = fixQuotes(strip(v || ""));
    if (next !== v) el.setAttribute(attr, next);
  }

  function cleanDocument() {
    var t = fixQuotes(strip(document.title));
    if (t !== document.title) document.title = t;
    cleanMeta('meta[property="og:title"]', "content");
    cleanMeta('meta[name="twitter:title"]', "content");
  }

  // Walk known title-bearing selectors. Conservative list — only
  // cleans text nodes whose full textContent matches the suffix,
  // avoiding collateral damage to intentional prose.
  var TITLE_SELECTORS = [
    ".article-title",
    ".post-full-title",
    ".entry-title",
    ".feature-title",
    ".card-title",
    ".pod-title",
    ".dashboard-essay-title",
    ".replays-title",
    ".ebook-entry-title",
    ".hero-feature h3",
    ".today-sidebar h4",
    "article h1",
  ];

  function cleanElement(el) {
    if (!el) return;
    var text = el.textContent || "";
    if (SUFFIX_RE.test(text)) {
      var last = null;
      (function walk(node) {
        for (var i = 0; i < node.childNodes.length; i++) {
          var c = node.childNodes[i];
          if (c.nodeType === 3) last = c;
          else if (c.nodeType === 1) walk(c);
        }
      })(el);
      if (last) {
        var next = strip(last.nodeValue);
        if (next !== last.nodeValue) last.nodeValue = next;
        if (SUFFIX_RE.test(el.textContent)) el.textContent = strip(el.textContent);
      } else {
        el.textContent = strip(el.textContent);
      }
    }
    fixQuotesInTree(el);
  }

  function cleanAll() {
    cleanDocument();
    TITLE_SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(cleanElement);
    });
    document.querySelectorAll(".article-content, .article-dek, .entry-excerpt")
      .forEach(fixQuotesInTree);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cleanAll);
  } else {
    cleanAll();
  }

  // Late-loaded lists (reading history, bookmarks, replays, podcast
  // feed, ebooks) are injected by their own scripts after DOMContentLoaded.
  // Re-run cleanup when the body mutates. Throttled so we don't
  // reflow on every keystroke in inline forms.
  var pending = false;
  var observer = new MutationObserver(function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      cleanAll();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
