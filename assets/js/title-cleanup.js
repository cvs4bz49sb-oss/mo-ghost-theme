/*
 * Title cleanup: suffix removal + smart-quote direction fix.
 *
 * 1. Suffix: older posts carry "- Mere Orthodoxy | Christianity,
 *    Politics, and Culture" in their Ghost title. Strip it.
 *
 * 2. Quotes: HubSpot-imported titles have straight ASCII quotes
 *    or mis-directed curly quotes. Convert to proper typographic
 *    open/close pairs based on surrounding context.
 */
(function () {
  var SUFFIX_RE = /\s*[-–—]\s*Mere\s*Orthodoxy\s*(?:\|[^|]*)?\s*$/i;

  function strip(s) {
    if (typeof s !== "string") return s;
    return s.replace(SUFFIX_RE, "").trimEnd();
  }

  // U+2018 = left single   U+2019 = right single / apostrophe
  // U+201C = left double    U+201D = right double
  var OPEN_CTX = "\\s\\u2014\\u2013(\\[{";

  function fixQuotes(s) {
    if (typeof s !== "string") return s;
    // --- Straight ASCII single quote (U+0027) ---
    // Opening position: after whitespace / start / opening punct
    s = s.replace(new RegExp("(^|[" + OPEN_CTX + "\"\\u201C])\'(?=\\w)", "g"), "$1‘");
    // Closing / apostrophe: after a word character
    s = s.replace(/(\w)'/g, "$1’");
    // Anything left over
    s = s.replace(/'/g, "’");
    // --- Straight ASCII double quote (U+0022) ---
    s = s.replace(new RegExp("(^|[" + OPEN_CTX + "'\\u2018\\u2019])\"(?=\\w)", "g"), "$1“");
    s = s.replace(/"/g, "”");
    // --- Already-curly but wrong direction ---
    s = s.replace(new RegExp("(^|[" + OPEN_CTX + "\"\\u201C])\\u2019(?=\\w)", "g"), "$1‘");
    s = s.replace(new RegExp("(^|[" + OPEN_CTX + "'\\u2018])\\u201D(?=\\w)", "g"), "$1“");
    return s;
  }

  function fixQuotesInTree(root) {
    if (!root) return;
    var SKIP = { CODE: 1, PRE: 1, KBD: 1, SCRIPT: 1, STYLE: 1 };
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (SKIP[node.parentNode.nodeName]) continue;
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
