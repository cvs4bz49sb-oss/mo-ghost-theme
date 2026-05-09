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
  const SUFFIX_RE = /\s*[-–—]\s*Mere\s*Orthodoxy\s*(?:\|[^|]*)?\s*$/i;

  function strip(s) {
    if (typeof s !== "string") return s;
    return s.replace(SUFFIX_RE, "").trimEnd();
  }

  // U+2018 = left single   U+2019 = right single / apostrophe
  // U+201C = left double    U+201D = right double
  const OPEN_CTX = "\\s\\u2014\\u2013(\\[{";

  function fixQuotes(s) {
    if (typeof s !== "string") return s;
    // --- Straight ASCII single quote (U+0027) ---
    // Opening position: after whitespace / start / opening punct
    s = s.replace(new RegExp(`(^|[${OPEN_CTX}"\\u201C])\'(?=\\w)`, "g"), "$1‘");
    // Closing / apostrophe: after a word character
    s = s.replace(/(\w)'/g, "$1’");
    // Anything left over
    s = s.replace(/'/g, "’");
    // --- Straight ASCII double quote (U+0022) ---
    s = s.replace(new RegExp(`(^|[${OPEN_CTX}'\\u2018\\u2019])"(?=\\w)`, "g"), "$1“");
    s = s.replace(/"/g, "”");
    // --- Already-curly but wrong direction ---
    s = s.replace(new RegExp(`(^|[${OPEN_CTX}"\\u201C])\\u2019(?=\\w)`, "g"), "$1‘");
    s = s.replace(new RegExp(`(^|[${OPEN_CTX}'\\u2018])\\u201D(?=\\w)`, "g"), "$1“");
    return s;
  }

  function fixQuotesInTree(root) {
    if (!root) return;
    const SKIP = { CODE: 1, PRE: 1, KBD: 1, SCRIPT: 1, STYLE: 1 };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (SKIP[node.parentNode.nodeName]) continue;
      const fixed = fixQuotes(node.nodeValue);
      if (fixed !== node.nodeValue) node.nodeValue = fixed;
    }
  }

  function cleanMeta(selector, attr) {
    const el = document.querySelector(selector);
    if (!el) return;
    const v = el.getAttribute(attr);
    const next = fixQuotes(strip(v || ""));
    if (next !== v) el.setAttribute(attr, next);
  }

  function cleanDocument() {
    const t = fixQuotes(strip(document.title));
    if (t !== document.title) document.title = t;
    cleanMeta('meta[property="og:title"]', "content");
    cleanMeta('meta[name="twitter:title"]', "content");
  }

  const TITLE_SELECTORS = [
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
    const text = el.textContent || "";
    if (SUFFIX_RE.test(text)) {
      let last = null;
      (function walk(node) {
        for (let i = 0; i < node.childNodes.length; i++) {
          const c = node.childNodes[i];
          if (c.nodeType === 3) last = c;
          else if (c.nodeType === 1) walk(c);
        }
      })(el);
      if (last) {
        const next = strip(last.nodeValue);
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
    TITLE_SELECTORS.forEach((sel) => {
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

  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      cleanAll();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
