/*
 * Title suffix cleanup.
 *
 * Some older posts carry a legacy SEO suffix in their Ghost title,
 * e.g. "A Legacy of Letters: … - Mere Orthodoxy | Christianity,
 * Politics, and Culture". Rather than editing every post, strip
 * the suffix at render time from:
 *   - document.title (browser tab, share scrapers at least while JS-able)
 *   - <meta property="og:title"> / <meta name="twitter:title">
 *   - Any visible element whose text content ends in the suffix.
 *
 * Matches "[-–—] Mere Orthodoxy" with optional trailing "| ...".
 */
(function () {
  var SUFFIX_RE = /\s*[-\u2013\u2014]\s*Mere\s*Orthodoxy\s*(?:\|[^|]*)?\s*$/i;

  function strip(s) {
    if (typeof s !== "string") return s;
    return s.replace(SUFFIX_RE, "").trimEnd();
  }

  function cleanMeta(selector, attr) {
    var el = document.querySelector(selector);
    if (!el) return;
    var v = el.getAttribute(attr);
    var next = strip(v || "");
    if (next !== v) el.setAttribute(attr, next);
  }

  function cleanDocument() {
    var t = strip(document.title);
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
    if (!SUFFIX_RE.test(text)) return;
    // If the element contains child elements (e.g. <em> wrappers),
    // only rewrite the last text node so italics / highlights stay.
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
      // If the suffix spanned a previous node, also clear any
      // residual separator text lingering on the element.
      if (SUFFIX_RE.test(el.textContent)) el.textContent = strip(el.textContent);
    } else {
      el.textContent = strip(el.textContent);
    }
  }

  function cleanAll() {
    cleanDocument();
    TITLE_SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(cleanElement);
    });
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
