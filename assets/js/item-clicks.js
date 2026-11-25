/*
 * Book, ebook and journal clicks, one record per item.
 *
 * Ian, 2026-11-25: "All Bookstore and ebook and digital journal clicks need
 * to be tracked too. Specifically each one." Every click on a single book,
 * ebook or journal issue is posted to mo-kit POST /item-click, which writes
 * one row to item_clicks in the mo-membership D1 (workers repo:
 * kit/lib/item-clicks.js, membership/migrations/0038_item_clicks.sql).
 * MOOS reads that table for each person's activity feed and to rank items.
 *
 * Where it runs
 * =============
 * In site.min.js, so on every page that extends default.hbs, and loaded on
 * its own (after admin-auth.js) by the standalone reader templates,
 * page-ebook-*-read.hbs and page-journal-issue-*-read.hbs. It runs once
 * per page however it was loaded. Staff pages under /admin/ and the
 * heatmap's preview frame are never recorded.
 *
 * What counts (by the link's destination, site-wide)
 * ==================================================
 *   book     any link to bookshop.org
 *              /p/books/<slug>/<id>        item p/<id>        action click
 *              /books/<slug>/<isbn>, /a/<aff>/<isbn>,
 *              /search?keywords=<isbn>     item isbn/<isbn>   action click
 *              /lists/<slug>               item list/<slug>   action list
 *              anything else (the shop)    item shop          action shop
 *            A "Read review" link on a /books/ shelf card (.shelf-review)
 *            counts as action review for that card's book.
 *   ebook    /ebook/<slug>/                open
 *            /ebook/<slug>/read/           read
 *            .../files/ebooks/<slug>.pdf|.epub   download
 *   journal  /journal-archive/issue-NN/    open
 *            .../journals/Journal-IssueNN.pdf    download
 *            /journal/preview/             preview (also the first click
 *                                          or key press inside the preview
 *                                          frame on /journal/)
 *            a store buy button for a journal-issue SKU     buy
 * Loading a reader page counts once per page view: /ebook/<slug>/read/ is
 * ebook read and /journal-archive/issue-NN/ is journal read, so an issue
 * opened from an email link is recorded too. (An on-site "Read online"
 * click on an ebook therefore makes two read rows: one with the page it
 * was clicked on, one with the reader's own path as its page.)
 *
 * What it sends
 * =============
 * { kind, item, action, title, page }. page is location.pathname only,
 * never the query or hash. title is the item's name: from the maps below
 * for ebooks and journal issues, from a /books/ shelf card's title and
 * author, otherwise the link's own text. Inside a member's own workspace
 * (notes, saved views, the Ask panel) or on the account and dashboard pages
 * the link text may be the member's own words, so a book's title is left
 * empty there (SECURITY-AGENT 6.43). No email is ever sent.
 *
 * Signed in: sent with window.MOAuth.fetch, which attaches the member JWT;
 * the worker takes the email from the verified token. Not signed in: a
 * plain fetch with no credentials and no identifier, and nothing at all
 * when the browser sends Do Not Track or Global Privacy Control (the
 * promise on /privacy/) or reports itself as automated. keepalive lets
 * the request outlive a same-tab navigation. Best effort: it never
 * delays a link and never throws.
 */
(function () {
  if (window.__moItemClicks) return;
  window.__moItemClicks = true;

  const EBOOK_TITLES = new Map([
    ["ai-and-the-church", "Christians and Artificial Intelligence"],
    ["formation", "Christian Formation in the Modern World"],
    ["spiritual-formation-for-the-family", "Spiritual Formation for the Family"],
    ["navigating-the-fracture", "Navigating the Evangelical Fracture"],
    ["blueprint-for-renewal", "Blueprint for Renewal"],
  ]);

  // partials/journal-shelf.hbs and partials/journals-list.hbs.
  const JOURNAL_TITLES = new Map([
    ["issue-01", "Issue 001, Fall 2021"],
    ["issue-02", "Issue 002, Winter 2022"],
    ["issue-03", "Issue 003, Summer 2022"],
    ["issue-04", "Issue 004, Winter 2023"],
    ["issue-05", "Issue 005, Fall 2024"],
    ["issue-06", "Issue 006, Winter 2025"],
    ["issue-07", "Issue 007, Spring 2025"],
    ["issue-08", "Issue 008, Fall 2025"],
    ["issue-09", "Issue 009, Winter 2026"],
    ["issue-10", "Issue 010, Summer 2026"],
    ["issue-11", "Issue 011, Fall 2026"],
  ]);

  // The issue custom-journal-preview.hbs shows, when its own heading cannot
  // be read. Keep in step with that template.
  const PREVIEW_ISSUE = "issue-07";

  const SITE_HOSTS = new Set(["mereorthodoxy.com", "www.mereorthodoxy.com", "mo-test.ghost.io"]);
  const TITLE_MAX = 140;
  const PAGE_MAX = 120;

  // heatmap-collect.js PRIVATE_PAGES and PRIVATE_ZONES: places where a
  // link's text can be the member's own words.
  const PRIVATE_PATH = /^\/(dashboard|welcome|complete-membership|manage|group-manage|institution-manage|migrate)(\/|$)/;
  const PRIVATE_ZONES = "[data-hm-private], [data-fn-root], .faith-notebook, [data-pr-workspace], " +
    ".pr-sequence, .pr-inspector, .vr-comparison, .vr-draft, .cmp-saved-row, #fra-workspace";

  function init() {
    const { body } = document;
    if (!body) return;

    const path = window.location.pathname || "/";
    if (/^\/admin(\/|$)/i.test(path)) return;
    try {
      if (new URLSearchParams(window.location.search).get("mo-hm-preview") === "1") return;
    } catch (_) { /* no query support: carry on */ }

    const base = (body.getAttribute("data-kit-worker-url") || "").trim().replace(/\/+$/, "");
    if (!base) return;
    let endpoint;
    try {
      const u = new URL(`${base}/item-click`);
      if (u.protocol !== "https:") return;
      endpoint = u.toString();
    } catch (_) {
      return;
    }

    // default.hbs sets data-member-email for a signed-in member; the reader
    // templates (members only) set data-member-status.
    const signedIn = !!(body.getAttribute("data-member-email") || body.getAttribute("data-member-status"));
    const optedOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === "1";
    const automated = navigator.webdriver === true;
    if (!signedIn && (optedOut || automated)) return;

    const page = path.slice(0, PAGE_MAX);
    const privatePage = PRIVATE_PATH.test(path);

    let lastKey = "";
    let lastAt = 0;

    // A reader who is not signed in but came from one of our emails: the Kit subscriber id kit-events.js keeps for 90
    // days (localStorage "mo:ksid"). It lets MOOS put their clicks in their activity feed. Never sent when signed in
    // (the JWT is the identity) or when the reader opted out.
    let ksid = null;
    if (!signedIn && !optedOut) {
      try {
        const saved = JSON.parse(window.localStorage.getItem("mo:ksid") || "null");
        if (saved && saved.exp > Date.now() && /^\d{1,12}$/.test(String(saved.id))) ksid = String(saved.id);
      } catch (_) { /* storage blocked: anonymous */ }
    }

    function send(ev) {
      if (!ev || !ev.kind || !ev.item || !ev.action) return;
      // A double click is one click.
      const key = `${ev.kind}|${ev.item}|${ev.action}`;
      const now = Date.now();
      if (key === lastKey && now - lastAt < 1500) return;
      lastKey = key;
      lastAt = now;

      const payload = JSON.stringify({
        kind: ev.kind,
        item: ev.item,
        action: ev.action,
        title: clip(ev.title || ""),
        page,
        ...(ksid ? { sid: ksid } : {}),
      });
      try {
        if (signedIn && window.MOAuth && typeof window.MOAuth.fetch === "function") {
          window.MOAuth.fetch(endpoint, {
            method: "POST",
            mode: "cors",
            credentials: "omit",
            keepalive: true,
            headers: { "content-type": "application/json" },
            body: payload,
          }).catch(() => { /* best effort */ });
        } else if (!optedOut && !automated) {
          // text/plain keeps this a simple request: no preflight to wait on
          // while the page navigates away. The worker parses the body
          // whatever its type.
          fetch(endpoint, {
            method: "POST",
            mode: "cors",
            credentials: "omit",
            keepalive: true,
            headers: { "content-type": "text/plain;charset=UTF-8" },
            body: payload,
          }).catch(() => { /* best effort */ });
        }
      } catch (_) { /* never break the page */ }
    }

    // ── Reader page loads ────────────────────────────────────────────
    const ebookRead = /^\/ebook\/([a-z0-9-]+)\/read\/?$/.exec(path);
    const issueRead = /^\/journal-archive\/(issue-\d{2})\/?$/.exec(path);
    if (ebookRead) {
      send({ kind: "ebook", item: ebookRead[1], action: "read", title: EBOOK_TITLES.get(ebookRead[1]) || docTitle() });
    } else if (issueRead) {
      send({ kind: "journal", item: issueRead[1], action: "read", title: journalTitle(issueRead[1]) });
    }

    // ── Clicks ───────────────────────────────────────────────────────
    function onClick(e) {
      try {
        if (e.type === "auxclick" && e.button !== 1) return;
        const t = e.target;
        const el = t && t.closest ? t.closest("a[href], [data-store-buy]") : null;
        if (!el) return;
        send(classify(el));
      } catch (_) { /* never break a link */ }
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);

    // ── The free preview on /journal/ ────────────────────────────────
    // A same-origin frame: clicks inside it never reach this document, so
    // listen inside it. The first click or key press is the preview.
    const frames = document.querySelectorAll("iframe[src]");
    for (let i = 0; i < frames.length; i++) watchPreview(frames[i]);

    function watchPreview(frame) {
      let src;
      try { src = new URL(frame.getAttribute("src"), window.location.href); } catch (_) { return; }
      if (src.origin !== window.location.origin || !/^\/journal\/preview\/?$/.test(src.pathname)) return;
      let sent = false;
      const fire = () => {
        if (sent) return;
        sent = true;
        const item = previewIssue(frame);
        send({ kind: "journal", item, action: "preview", title: journalTitle(item) });
      };
      const hook = () => {
        try {
          const doc = frame.contentDocument;
          if (!doc) return;
          doc.addEventListener("pointerdown", fire, true);
          doc.addEventListener("keydown", fire, true);
        } catch (_) { /* not reachable: no preview count */ }
      };
      frame.addEventListener("load", hook);
      try {
        const doc = frame.contentDocument;
        if (doc && doc.readyState === "complete" && doc.location.href !== "about:blank") hook();
      } catch (_) { /* the load listener covers it */ }
    }

    // ── Classification ───────────────────────────────────────────────
    function classify(el) {
      // Store buy buttons: the SKU says which issue, whatever the href is.
      if (el.hasAttribute("data-store-buy")) {
        const card = el.closest("[data-store-sku]");
        const sku = card ? (card.getAttribute("data-store-sku") || "") : "";
        const m = /^journal-issue-0*(\d{1,2})$/i.exec(sku.trim());
        if (!m) return null;
        const item = issueId(m[1]);
        return { kind: "journal", item, action: "buy", title: journalTitle(item) };
      }

      const href = el.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#") return null;
      let u;
      try { u = new URL(href, window.location.href); } catch (_) { return null; }
      if (u.protocol !== "https:" && u.protocol !== "http:") return null;
      const host = u.hostname.toLowerCase();

      if (host === "bookshop.org" || host.endsWith(".bookshop.org")) {
        const book = bookItem(u);
        return { kind: "book", item: book.item, action: book.action, title: bookTitle(el, book) };
      }

      // A "Read review" link on a /books/ shelf card is about that card's book.
      if (el.classList.contains("shelf-review")) {
        const cardLink = el.closest(".shelf-book") && el.closest(".shelf-book").querySelector("a.shelf-book-link[href]");
        if (cardLink) {
          let cu;
          try { cu = new URL(cardLink.getAttribute("href"), window.location.href); } catch (_) { cu = null; }
          if (cu && (cu.hostname === "bookshop.org" || cu.hostname.endsWith(".bookshop.org"))) {
            const book = bookItem(cu);
            if (book.action === "click") {
              return { kind: "book", item: book.item, action: "review", title: bookTitle(cardLink, book) };
            }
          }
        }
        return null;
      }

      if (u.origin !== window.location.origin && !SITE_HOSTS.has(host)) return null;
      const p = u.pathname;
      let m;

      if ((m = /^\/ebook\/([a-z0-9-]+)\/?$/.exec(p))) {
        return { kind: "ebook", item: m[1], action: "open", title: ebookTitle(m[1], el) };
      }
      if ((m = /^\/ebook\/([a-z0-9-]+)\/read\/?$/.exec(p))) {
        return { kind: "ebook", item: m[1], action: "read", title: ebookTitle(m[1], el) };
      }
      if ((m = /\/files\/ebooks\/([a-z0-9-]+)\.(?:pdf|epub)$/i.exec(p))) {
        const slug = m[1].toLowerCase();
        return { kind: "ebook", item: slug, action: "download", title: ebookTitle(slug, el) };
      }
      if ((m = /^\/journal-archive\/issue-(\d{1,2})\/?$/.exec(p))) {
        const item = issueId(m[1]);
        return { kind: "journal", item, action: "open", title: journalTitle(item) };
      }
      if ((m = /\/journals\/journal-issue0*(\d{1,2})\.pdf$/i.exec(p))) {
        const item = issueId(m[1]);
        return { kind: "journal", item, action: "download", title: journalTitle(item) };
      }
      if (/^\/journal\/preview\/?$/.test(p)) {
        return { kind: "journal", item: PREVIEW_ISSUE, action: "preview", title: journalTitle(PREVIEW_ISSUE) };
      }
      return null;
    }

    function bookItem(u) {
      const parts = u.pathname.split("/").filter(Boolean).map((s) => s.toLowerCase());
      if (parts[0] === "p" && parts[1] === "books" && /^[0-9a-f]{6,40}$/.test(parts[3] || "")) {
        return { item: `p/${parts[3]}`, action: "click" };
      }
      if ((parts[0] === "books" || parts[0] === "a") && isIsbn(parts[2])) {
        return { item: `isbn/${parts[2]}`, action: "click" };
      }
      if (parts[0] === "search") {
        const k = (u.searchParams.get("keywords") || "").replace(/[\s-]/g, "").toLowerCase();
        if (isIsbn(k)) return { item: `isbn/${k}`, action: "click" };
      }
      if (parts[0] === "lists" && /^[a-z0-9][a-z0-9_-]{0,100}$/.test(parts[1] || "")) {
        return { item: `list/${parts[1]}`, action: "list" };
      }
      return { item: "shop", action: "shop" };
    }

    function isIsbn(s) {
      return typeof s === "string" && /^(?:\d{9}[\dx]|\d{13})$/.test(s);
    }

    function bookTitle(el, book) {
      // A /books/ shelf card: title and author.
      const card = el.matches("a.shelf-book-link") ? el : null;
      if (card) {
        const t = text(card.querySelector(".shelf-book-title"));
        const a = text(card.querySelector(".shelf-book-author"));
        if (t) return a ? `${t} by ${a}` : t;
      }
      // A shelf's "See all on Bookshop.org": the shelf's own name.
      if (book.action === "list") {
        const shelf = el.closest("[data-shelf]");
        const name = shelf ? text(shelf.querySelector(".shelf-title")) : "";
        if (name) return name;
      }
      if (book.action === "shop") return "Bookshop.org";
      if (isPrivate(el)) return "";
      return linkText(el);
    }

    function ebookTitle(slug, el) {
      return EBOOK_TITLES.get(slug) || (isPrivate(el) ? "" : linkText(el));
    }

    function isPrivate(el) {
      return privatePage || !!(el && el.closest && el.closest(PRIVATE_ZONES));
    }

    function linkText(el) {
      const own = text(el);
      if (own) return own;
      const label = (el.getAttribute("aria-label") || el.getAttribute("title") || "").trim();
      if (label) return label;
      const img = el.querySelector("img[alt]");
      return img ? img.getAttribute("alt").trim() : "";
    }

    function previewIssue(frame) {
      let heading = "";
      try {
        const doc = frame.contentDocument;
        heading = doc ? text(doc.querySelector("h1.rd-title")) : "";
      } catch (_) { /* fall through */ }
      const m = /\bIssue\s+0*(\d{1,2})\b/i.exec(heading) || /\bIssue\s+0*(\d{1,2})\b/i.exec(frame.getAttribute("title") || "");
      return m ? issueId(m[1]) : PREVIEW_ISSUE;
    }
  }

  function issueId(n) {
    return `issue-${String(parseInt(n, 10)).padStart(2, "0")}`;
  }

  function journalTitle(item) {
    const known = JOURNAL_TITLES.get(item);
    if (known) return known;
    const n = parseInt(item.replace(/^issue-/, ""), 10);
    return Number.isFinite(n) ? `Issue ${String(n).padStart(3, "0")}` : "";
  }

  function docTitle() {
    return (document.title || "").split(/\s+[\u2014|]\s+/)[0].trim();
  }

  function text(node) {
    return node ? (node.textContent || "").replace(/\s+/g, " ").trim() : "";
  }

  function clip(s) {
    return Array.from(String(s).replace(/\s+/g, " ").trim()).slice(0, TITLE_MAX).join("");
  }

  try { init(); } catch (_) { /* never break the page */ }
})();
