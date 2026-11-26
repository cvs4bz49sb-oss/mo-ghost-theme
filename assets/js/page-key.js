/*
 * Page keys and heatmap sections, shared by the click heatmap
 * (heatmap-collect.js), the form counter (form-track.js) and the
 * /admin/heatmap/ overlay (admin-heatmap.js).
 *
 * Page keys
 * =========
 * One stable name per part of the site. Clicks, scroll and form counts
 * are bucketed by these, never by URL: four thousand essays roll up
 * into "post", ninety-odd Faith Received documents into "tfr-document".
 * A key is a template family, so it survives slugs changing, pages
 * being added and query strings.
 *
 * The list in KEYS is mirrored by HM_PAGES in mo-admin
 * (workers/admin/lib/heatmap-pages.js). The worker drops any beacon
 * whose page is not on its list, so a key added here and not there is
 * silently unrecorded. Add to both.
 *
 * Path rules run first because routed custom templates render with an
 * empty body class; the template classes (post-template, tag-template,
 * author-template, page-template) decide everything else.
 *
 * Sections
 * ========
 * A click is stored as a position inside a section, not on the page
 * (see heatmap-collect.js). A section is, in order:
 *   1. the nearest [data-hm-section] ancestor (explicit markup);
 *   2. a piece of site chrome that floats over every page (the slide-in,
 *      the year-end bar, the mobile and mega menus, the search modal,
 *      the gate modal, the member bar), named by CHROME below;
 *   3. otherwise an automatic section: the direct child of the page's
 *      content root that holds the click. The content root is <main>
 *      (or <body> when a template has none), stepping through a lone
 *      wrapper such as a single .container. Its key is the child's id,
 *      else its first class, else its tag, with "-2", "-3" for later
 *      siblings that would share a key. So the Faith Received landing's
 *      bands come out as lp-hero, lp-band, lp-band-2 ... in page order.
 *   4. "page", the whole document, when none of those applies.
 *
 * The overlay runs sections() against its framed copy of the page, so a
 * click stored against an automatic key lands back on the same block.
 */
(function () {
  "use strict";

  // Every key the site can send. Mirror: workers/admin/lib/heatmap-pages.js.
  const KEYS = [
    "home", "post", "event", "transcript",
    "tfr-home", "tfr-reader", "tfr-reader-classic", "tfr-document",
    "tfr-scripture", "tfr-topics", "tfr-authors", "tfr-curated",
    "tfr-library", "tfr-collections", "tfr-search", "tfr-ask", "tfr-workspace",
    "tfr-other",
    "liturgy", "liturgy-reader", "liturgy-advent",
    "membership", "offer", "student", "groups", "institutions",
    "welcome", "complete-membership", "success", "account",
    "give", "give-lifetime", "year-end",
    "podcast", "journal", "archive", "tag", "author", "contributors",
    "search", "about", "events", "forum", "contact", "submissions",
    "writers-meetings", "sponsorship", "store", "ebooks", "dashboard",
    "bible", "page", "other",
  ];

  // Paths under /the-faith-received/, without that prefix.
  const TFR_RULES = [
    [/^(read|review|readen)\/$/, "tfr-reader"],
    [/^reader\/$/, "tfr-reader-classic"],
    [/^(scripture|bible)\//, "tfr-scripture"],
    [/^(topics|doctrines)\//, "tfr-topics"],
    [/^(authors|author|fathers)\//, "tfr-authors"],
    [/^(curated|browse)\//, "tfr-curated"],
    [/^(search|research)\//, "tfr-search"],
    [/^ask(-workspace)?\//, "tfr-ask"],
    // A member's own workspaces: pins, the desk, saved comparisons.
    [/^(pins|desk|compare)\//, "tfr-workspace"],
    [/^(all-works|library|century|centuries|scans)\//, "tfr-library"],
    [/^(latin-library|early-english-books|english-editions|patrologia-(latina|graeca|orientalis)|augustine|confessions|room|puritans|anglicans|methodists|westminster-assembly|jesuits|franciscans|dominicans|augustinians|traditions?)\//, "tfr-collections"],
  ];

  const SITE_RULES = [
    [/^\/daily-liturgy\/read\/$/, "liturgy-reader"],
    [/^\/daily-liturgy\/advent\/$/, "liturgy-advent"],
    [/^\/daily-liturgy\//, "liturgy"],
    [/^\/membership\/$/, "membership"],
    [/^\/(offer|kirk-offer)\/$|^\/welcome-back/, "offer"],
    [/^\/student\/$/, "student"],
    [/^\/groups\/$/, "groups"],
    [/^\/(institutions|join)\//, "institutions"],
    [/^\/welcome\/$/, "welcome"],
    [/^\/complete-membership\/$/, "complete-membership"],
    [/^\/success\/$/, "success"],
    [/^\/(manage|group-manage|institution-manage|migrate)\/$/, "account"],
    [/^\/give\/lifetime\/$/, "give-lifetime"],
    [/^\/give\/$/, "give"],
    [/^\/year-end\/$/, "year-end"],
    [/^\/podcasts\//, "podcast"],
    [/^\/transcripts\//, "transcript"],
    [/^\/journal(-archive)?\//, "journal"],
    [/^\/contributors\//, "contributors"],
    [/^\/archive\/|^\/page\/\d+\/$/, "archive"],
    [/^\/search\/$/, "search"],
    [/^\/about\/$/, "about"],
    [/^\/events\/$/, "events"],
    [/^\/forum\/$/, "forum"],
    [/^\/contact\/$/, "contact"],
    [/^\/submissions\/$/, "submissions"],
    [/^\/writers-meetings\/$/, "writers-meetings"],
    [/^\/sponsorship\/$/, "sponsorship"],
    [/^\/(store|books)\//, "store"],
    [/^\/ebooks?\//, "ebooks"],
    [/^\/dashboard\//, "dashboard"],
    [/^\/bible\/$/, "bible"],
  ];

  // Staff tools are never measured: the people using them are not the
  // audience the numbers describe.
  const SKIP = /^\/(admin|digest-gen)\//;

  function normPath(path) {
    let p = String(path || "/").toLowerCase();
    if (p.charAt(0) !== "/") p = `/${p}`;
    if (p.charAt(p.length - 1) !== "/") p += "/";
    return p;
  }

  // classify(path, bodyClass, doc) -> key or null. `doc` is only read
  // for two DOM tells the URL cannot give: an event post shares the
  // essay permalink pattern, and the Faith Received's document pages
  // share no path prefix of their own.
  function classify(path, bodyClass, doc) {
    const p = normPath(path);
    const cls = ` ${String(bodyClass || "")} `;
    const has = (sel) => {
      try { return !!(doc && doc.querySelector(sel)); } catch (_) { return false; }
    };

    if (p === "/") return "home";
    if (SKIP.test(p)) return null;

    if (p.indexOf("/the-faith-received/") === 0) {
      const rest = p.slice("/the-faith-received/".length);
      if (!rest) return "tfr-home";
      for (const [re, key] of TFR_RULES) if (re.test(rest)) return key;
      return has("main.faith-doc") ? "tfr-document" : "tfr-other";
    }

    for (const [re, key] of SITE_RULES) if (re.test(p)) return key;

    if (cls.indexOf(" post-template ") >= 0) {
      return has("[data-event-post]") ? "event" : "post";
    }
    if (cls.indexOf(" tag-template ") >= 0) {
      return / tag-author-/.test(cls) ? "author" : "tag";
    }
    if (cls.indexOf(" author-template ") >= 0) return "author";
    if (cls.indexOf(" page-template ") >= 0) return "page";
    return "other";
  }

  // ── Sections ──────────────────────────────────────────────────────

  // Overlays that sit outside every template's content. Matched by
  // closest(), so a click anywhere inside one is charged to it.
  const CHROME = [
    ["aside.slide-in", "slide-in"],
    [".eoy-bar", "eoy-bar"],
    ["#mobile-nav", "mobile-nav"],
    ["#mm, .mm-backdrop", "mega-menu"],
    [".mo-search-modal", "search-modal"],
    [".feature-gate-modal", "gate-modal"],
    [".journal-address", "member-bar"],
    // The Faith Received's own navigation, on every TFR page.
    ["nav.tfr-rail", "tfr-rail"],
  ];
  const CHROME_SEL = CHROME.map((c) => c[0]).join(", ");

  const NON_CONTENT = /^(SCRIPT|STYLE|LINK|META|TEMPLATE|NOSCRIPT|BR)$/;

  function contentKids(node) {
    const out = [];
    const kids = node ? node.children : [];
    for (let i = 0; i < kids.length; i += 1) {
      if (!NON_CONTENT.test(kids[i].tagName)) out.push(kids[i]);
    }
    return out;
  }

  function contentRoot(doc) {
    let root = doc.querySelector("main") || doc.body;
    for (let i = 0; i < 3 && root; i += 1) {
      const kids = contentKids(root);
      if (kids.length !== 1 || kids[0].hasAttribute("data-hm-section")) break;
      root = kids[0];
    }
    return root;
  }

  function slug(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);
  }

  function baseKey(node) {
    const cls = (node.getAttribute("class") || "").trim().split(/\s+/)[0];
    return slug(node.id) || slug(cls) || node.tagName.toLowerCase();
  }

  // A root with more children than this is a list (a feed of entries,
  // the pages of a loaded text), not a layout of a few blocks. It gets
  // no automatic sections: clicks in it fall back to "page".
  const MAX_AUTO = 30;

  // [{ key, node }] for every automatic section, in page order. Children
  // that carry their own marker, or that are site chrome, are skipped:
  // they are sections already. A root that is itself marked (the Faith
  // Received reader's text) or sits inside a marked section has none.
  function autoSections(doc) {
    const root = contentRoot(doc || document);
    if (!root || root.closest("[data-hm-section]")) return [];
    const kids = contentKids(root);
    if (kids.length > MAX_AUTO) return [];
    const count = Object.create(null);
    const out = [];
    kids.forEach((node) => {
      if (node.hasAttribute("data-hm-section")) return;
      if (CHROME_SEL && node.matches(CHROME_SEL)) return;
      const base = baseKey(node);
      count[base] = (count[base] || 0) + 1;
      out.push({ key: count[base] === 1 ? base : `${base}-${count[base]}`, node });
    });
    return out;
  }

  // Every section on the page, explicit first, for the overlay and for
  // the collector's "which sections were reached" observer.
  function sections(doc) {
    const d = doc || document;
    const out = [];
    const seen = new Set();
    d.querySelectorAll("[data-hm-section]").forEach((node) => {
      const key = node.getAttribute("data-hm-section");
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ key, node });
    });
    autoSections(d).forEach((s) => {
      if (seen.has(s.key)) return;
      seen.add(s.key);
      out.push(s);
    });
    // Site chrome present on this page (the rail, the year-end bar ...),
    // so it can be reached and the overlay has a box to draw it on.
    CHROME.forEach(([sel, key]) => {
      if (seen.has(key)) return;
      const node = d.querySelector(sel);
      if (!node) return;
      seen.add(key);
      out.push({ key, node });
    });
    return out;
  }

  // The section a click belongs to: { key, node }.
  function sectionOf(el, doc) {
    const d = doc || document;
    if (!el || !el.closest) return { key: "page", node: d.documentElement };

    const marked = el.closest("[data-hm-section]");
    if (marked) return { key: marked.getAttribute("data-hm-section") || "page", node: marked };

    for (const [sel, key] of CHROME) {
      const node = el.closest(sel);
      if (node) return { key, node };
    }

    const root = contentRoot(d);
    if (root && root !== el && root.contains(el)) {
      let node = el;
      while (node && node.parentElement !== root) node = node.parentElement;
      if (node) {
        const hit = autoSections(d).find((s) => s.node === node);
        if (hit) return hit;
      }
    }
    return { key: "page", node: d.documentElement };
  }

  function pageKey() {
    try {
      return classify(window.location.pathname, document.body ? document.body.className : "", document);
    } catch (_) {
      return null;
    }
  }

  pageKey.KEYS = KEYS;
  pageKey.classify = classify;
  pageKey.sections = sections;
  pageKey.sectionOf = sectionOf;
  pageKey.autoSections = autoSections;
  window.MOPageKey = pageKey;
})();
