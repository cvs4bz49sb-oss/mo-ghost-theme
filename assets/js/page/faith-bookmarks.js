/*
 * The Faith Received — the Bookmarks workspace.
 *
 * Binds to partials/faith-received/_bookmarks-panel.hbs. Read that
 * partial's header comment for the DOM contract; every selector below
 * is unscoped document.querySelector(), so the markup must appear
 * exactly once on whichever page loads this file.
 *
 * WHERE BOOKMARKS ACTUALLY LIVE. Not localStorage, and not Ghost. They
 * are in the mo-kit Worker's KV, the same store that backs article
 * bookmarks, under `bookmarks:<member email>`:
 *
 *   [ { postId: "tfr:<corpus>:<work id>", savedAt: ISO }, … ]
 *
 * which means:
 *
 *   - It is per MEMBER, not per browser, and it needs MOAuth. A signed
 *     out visitor has no bookmarks to show, and there is no local copy
 *     to fall back on. Say so rather than showing an empty list.
 *   - The list is newest-first. mo-kit's handleBookmarkAdd unshifts,
 *     and GET /bookmarks?ids_only=1 hands the ids back in stored order.
 *     So ARRAY ORDER IS RECENCY and nothing here may re-sort in place.
 *   - `savedAt` exists in KV but is NOT returned by ids_only=1, and the
 *     enriched /bookmarks list cannot be used instead: it resolves ids
 *     against Ghost and drops everything Ghost does not know, which is
 *     every work in this library. So there are no dates on screen. We
 *     have an order and we do not have a timestamp, and printing a
 *     guessed date would be worse than printing none.
 *   - The 200-bookmark cap is shared with article bookmarks.
 *
 * RESOLVING AN ID. `tfr:pld:2741` is corpus `pld`, work `2741`. The
 * catalogues are the only place a work's title, author and URL live, so
 * each corpus that has a saved work in it is loaded once (not once per
 * work) through window.MOCorpora and the wanted ids are picked out of
 * it. There is no second version of this list: /dashboard/faith-received/
 * used to carry its own (assets/js/faith-saved.js) and now renders this
 * panel instead, so this file is the one that resolves a saved work.
 *
 * THE LINK BACK. Never constructed by hand where the catalogue has one.
 * MOCorpora's normalize() already writes `url` for every record, by the
 * same rule as readerUrlFor() in
 * website/workers/tfr-library/lib/collections.js: the corpus goes in
 * `c=` and the work's own id in `w=`, and `c` is omitted for the
 * default collection. `?c=pld&w=2741`, never `?w=pld-2741` — most of
 * this corpus has no page numbers and a wrong link silently loads
 * nothing. Only an id that resolves to no record at all gets a
 * constructed link, and that construction mirrors the same rule.
 *
 * WHERE THE WORK OPENS. A bookmark says which work and nothing more:
 * the id is a bare string and KV has no field to hang a position on, so
 * a resume point cannot ride along with it. It is kept separately, in
 * this browser, by assets/js/lib/faith-position-store.js, and appended
 * to the row's link here — `&p=57` for a paginated work, `#r42942`
 * everywhere else, and nothing at all where there is no position, so
 * the link is never dead. The consequence is stated on screen rather
 * than hidden: the work follows the member between devices and the
 * place in it does not (see [data-fb-foot] in the partial).
 *
 * The locator is appended AFTER MOSafeHref has passed the base URL.
 * That is deliberate and it is safe: a decimal page number and an
 * encodeURIComponent'd anchor cannot introduce a scheme or a host.
 *
 * THE CONFESSIONS FOOTNOTE. Creeds and confessions are opened by the
 * reader with no `?c=` at all (see MOCorpora's `confessions` adapter,
 * whose url is `?w=<slug>`), because that collection shares the Latin
 * Library's shard reader and its host. faith-bookmark.js reads the
 * corpus off the URL, so saving one stores it as `tfr:tfr:<slug>` — and
 * the Latin Library catalogue has never heard of it. Every confession
 * anyone has ever bookmarked is therefore unresolvable against the
 * corpus its id names. It is resolvable against `confessions`, which is
 * a 260-document file, so an unmatched `tfr` id is retried there before
 * it is reported missing. See CONFESSION_FALLBACK below.
 */
(function () {
  "use strict";
  /* One shelf order for the whole library, so a multi-volume set reads
   1, 2, 3 rather than 1, 10, 11, 2. window.MOTitleOrder ships in boot,
   which runs before every page script; the fallback is the ordering
   this line had before it existed, so a boot that failed to load costs
   the order and never the list. See assets/js/lib/faith-title-order.js. */
  function cmpTitle(a, b) {
    const x = String(a || ""), y = String(b || "");
    return window.MOTitleOrder
      ? window.MOTitleOrder.compareTitles(x, y)
      : x.localeCompare(y);
  }

  const root = document.querySelector("[data-fb-root]");
  if (!root) return;
  // The partial ships its own <script> tags so it can be dropped into
  // any page. If a host page loads this file a second time, bind once.
  if (root.getAttribute("data-fb-bound") === "1") return;
  root.setAttribute("data-fb-bound", "1");

  const listEl = document.querySelector("[data-fb-list]");
  const statusEl = document.querySelector("[data-fb-status]");
  const countEl = document.querySelector("[data-fb-count]");
  const sortEl = document.querySelector("[data-fb-sort]");
  const footEl = document.querySelector("[data-fb-foot]");
  if (!listEl || !statusEl) return;

  const { body } = document;
  const WORKER = (body.getAttribute("data-kit-worker-url") || "").replace(/\/$/, "");
  const memberStatus = body.getAttribute("data-member-status") || "";
  const signedIn = !!body.getAttribute("data-member-email");
  const paid = memberStatus === "paid" || memberStatus === "comped";
  /* Who may SEE their saved works, which has to be whoever may make one.
     This panel used to hardcode paid/comped while
     assets/js/lib/faith-work-bookmarks.js — the file that decides
     whether the Save button works at all — reads the beta constant from
     assets/js/boot/tfr-tier.js (`beta ? signedIn : paid`). During the
     beta those two disagree, and the disagreement is visible: a free
     member saves a work from a browse row, opens the list of their
     saved works, and is told saved works are part of membership. The
     worker never had this bug — mo-kit deliberately serves the READ to
     any signed-in member so someone whose card lapses can still see and
     clear what they saved (website/workers/kit/kit.js, handleListBookmarks).
     So the panel was the only thing refusing, and it was refusing to
     show a member their own data.

     Read rather than copied, for the reason tfr-tier.js gives: a
     constant copied into both is a constant that drifts. boot.min.js is
     in <head> and has already run by the time this page script does. */
  const beta = window.MO_TFR_BETA_OPEN_TO_ALL_MEMBERS !== false;
  const allowed = beta ? signedIn : paid;

  // A bookmark whose corpus is the default one and which the Latin
  // Library does not have is very probably a confession. Deliberately a
  // list of one: the alternative is loading every catalogue in the
  // library (15,569 works in EEBO alone) to answer a question about a
  // handful of ids.
  const CONFESSION_FALLBACK = "confessions";
  // The same for our own English Editions: an earlier build of the reader
  // saved them as "tfr:tfr:<slug>" too, and they are in neither the Latin
  // Library nor the confessions. 31 KB.
  const ENGLISH_FALLBACK = "mo";

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

  const safeHref = (url) => {
    const clean = window.MOSafeHref ? window.MOSafeHref.sanitize(url) : url;
    return clean || "/the-faith-received/all-works/?collection=all";
  };

  // Same rule as readerUrlFor() in the worker's collections.js, for the
  // ids no catalogue could match. No page and no quote: this library
  // mostly has neither, and a bookmark carries neither.
  function constructedUrl(corpusId, workId) {
    const c = corpusId && corpusId !== "tfr"
      ? `c=${encodeURIComponent(corpusId)}&` : "";
    return `/the-faith-received/reader/?${c}w=${encodeURIComponent(workId)}`;
  }

  // The reader link, plus a place inside the work. The store returns
  // the URL untouched where there is no place at all, so this is safe
  // to run over every row.
  //
  // "mark" rather than the default: this list is what the reader SAVED,
  // so a place they chose outranks the one recorded on their behalf.
  // The Library's "Continue reading" shelf asks the same store the
  // other way round, because that row means "carry on".
  const POS = () => window.MOFaithPosition || null;
  const PREFER = "mark";

  function resumeUrl(url, corpusId, workId) {
    const store = POS();
    return store ? store.appendTo(url, corpusId, workId, PREFER) : url;
  }

  function hasResume(corpusId, workId) {
    const store = POS();
    return !!(store && store.has(corpusId, workId, PREFER));
  }

  // Every place inside one work, marks first and the stop last. This is
  // what turns a bookmark from a bare title into something a reader
  // recognises: the work, and where in it.
  function placesFor(corpusId, workId) {
    const store = POS();
    return store && store.places ? store.places(corpusId, workId) : [];
  }

  // A place's label. A mark carries a heading or a citation, never the
  // passage: keeping the text is the notebook's job, and a bookmark
  // that copied it would be a second copy drifting away from the first.
  // A place with no label still gets a row, because the reader put it
  // there and it still opens.
  function placeLabel(p) {
    if (p.kind === "stop") {
      return p.page ? `Where you stopped, page ${p.page}` : "Where you stopped";
    }
    return p.cite || "A place you marked";
  }

  /* ── State ───────────────────────────────────────────────────── */

  // Rows, in the order the worker returned them, which is newest-first.
  let rows = [];
  let sortBy = "recent";

  /* ── Painting ────────────────────────────────────────────────── */

  function setStatus(text, tone) {
    statusEl.textContent = text || "";
    statusEl.hidden = !text;
    statusEl.classList.toggle("bookmarks-status--error", tone === "error");
  }

  function setCount() {
    if (!countEl) return;
    if (!rows.length) { countEl.textContent = ""; countEl.hidden = true; return; }
    countEl.hidden = false;
    countEl.textContent = rows.length === 1 ? "1 work saved" : `${rows.length} works saved`;
  }

  // An empty state is a claim. This one is only ever painted after a
  // successful read that came back with nothing in it; a failed read
  // paints renderError() instead, and the two never share wording.
  function renderEmpty() {
    listEl.innerHTML =
      `<div class="bookmarks-empty">` +
      `<p class="bookmarks-empty-lede">Nothing saved yet.</p>` +
      `<p class="bookmarks-empty-note">Use the bookmark on any work in the library, or the ` +
      `Bookmark button at the foot of a section while you are reading. It will appear here with ` +
      `the collection it came from and a link straight back to it.</p>` +
      `<p class="bookmarks-empty-act"><a class="bookmarks-empty-link" href="/the-faith-received/curated/">Browse the library</a></p>` +
      `</div>`;
  }

  function renderSignedOut() {
    if (footEl) footEl.hidden = true;
    const lede = signedIn
      ? "Saved works are part of membership."
      : "Sign in to see the works you have saved.";
    const note = signedIn
      ? "Your bookmarks are kept with your membership rather than in this browser, so they follow you between devices."
      : "Bookmarks are kept with your membership rather than in this browser, so they follow you between devices.";
    const act = signedIn
      ? `<a class="bookmarks-empty-link" href="/membership/">Become a member</a>`
      : `<a class="bookmarks-empty-link" href="#/portal/signin" data-portal="signin">Sign in</a>`;
    listEl.innerHTML =
      `<div class="bookmarks-empty">` +
      `<p class="bookmarks-empty-lede">${esc(lede)}</p>` +
      `<p class="bookmarks-empty-note">${esc(note)}</p>` +
      `<p class="bookmarks-empty-act">${act}</p>` +
      `</div>`;
  }

  function renderError(message) {
    // Nothing on screen is a row, so nothing on screen resumes.
    if (footEl) footEl.hidden = true;
    listEl.innerHTML =
      `<div class="bookmarks-empty">` +
      `<p class="bookmarks-empty-lede">Your saved works could not be loaded.</p>` +
      `<p class="bookmarks-empty-note">${esc(message)} Nothing has been lost: this is a problem reading the list, not the list itself.</p>` +
      `<p class="bookmarks-empty-act"><button type="button" class="bookmarks-retry" data-fb-retry>Try again</button></p>` +
      `</div>`;
  }

  // The places under a work, each its own link into the reader. Built
  // from the same sanitized base as the row's own link, with the
  // locator appended after: a decimal page and an encoded anchor cannot
  // reintroduce a scheme or a host.
  function placesMarkup(r) {
    if (!r.places.length) return "";
    const base = safeHref(r.url);
    const items = r.places.map((p) => {
      const href = p.page
        ? `${base}${base.indexOf("?") >= 0 ? "&" : "?"}p=${encodeURIComponent(p.page)}`
        : `${base}#${encodeURIComponent(p.anchor)}`;
      return `<li class="bookmarks-place bookmarks-place--${esc(p.kind)}">` +
        `<a class="bookmarks-place-link" href="${esc(href)}">${esc(placeLabel(p))}</a>` +
        `</li>`;
    }).join("");
    return `<ul class="bookmarks-places">${items}</ul>`;
  }

  // A list row does not carry a tradition label (Ian, 2026-09-22: labels
  // in lists are decoration, and "English Divines" named a nationality).
  // Several catalogues use the tradition as their eyebrow, so the parts
  // of it that name one are dropped; a series eyebrow ("PL 32", a year,
  // a document type) is kept.
  const TOP_TRADITIONS = new Set(["english divines", "protestant", "roman catholic",
    "eastern orthodox", "the whole church", "the fathers"]);
  function plainEyebrow(hit) {
    const MO = window.MOCorpora;
    const trad = String(hit.tradition || "").trim().toLowerCase();
    const isTrad = (part) => {
      const t = part.toLowerCase();
      if (!t) return true;
      if (t === trad || TOP_TRADITIONS.has(t)) return true;
      return !!(MO && MO.traditionParent && MO.traditionParent(part));
    };
    return String(hit.eyebrow || "").split(" · ")
      .map((p) => p.trim()).filter((p) => !isTrad(p)).join(" · ");
  }

  function rowMarkup(r) {
    const meta = [r.author, r.eyebrow].filter(Boolean).map(esc).join(" &middot; ");
    // Sanitize first, then add the locator: a page number and an
    // encoded anchor cannot reintroduce a scheme, and doing it in this
    // order means the catalogue's own url is the thing being checked.
    const href = resumeUrl(safeHref(r.url), r.corpus, r.work);
    return [
      `<li class="bookmarks-row${r.resolved ? "" : " bookmarks-row--unmatched"}" data-fb-id="${esc(r.id)}">`,
      `<a class="bookmarks-row-main" href="${esc(href)}">`,
      `<span class="bookmarks-row-title">${esc(r.title)}</span>`,
      meta ? `<span class="bookmarks-row-meta">${meta}</span>` : "",
      // An id the catalogues could not match is still a real bookmark
      // and the link still works. Saying so is better than dropping the
      // row, which would read as "we lost it".
      r.resolved ? "" : `<span class="bookmarks-row-note">Not in the catalogue just now. The link still opens the reader.</span>`,
      // Only where the link really does resume. An unconditional label
      // would be a promise the row could not keep. A work with a marked
      // place opens at the newest one; a work with only a stop opens
      // where reading stopped, and the two are not the same promise.
      r.marked
        ? `<span class="bookmarks-row-note">Opens at the place you bookmarked.</span>`
        : (r.resume ? `<span class="bookmarks-row-note">Picks up where you left off.</span>` : ""),
      `</a>`,
      `<span class="bookmarks-row-side">`,
      // The shelf name is already the group heading when grouped.
      sortBy === "collection" ? "" : `<span class="bookmarks-row-shelf">${esc(r.corpusLabel)}</span>`,
      `<button type="button" class="bookmarks-remove" data-fb-remove `,
      `aria-label="Remove ${esc(r.title)} from your saved works">Remove</button>`,
      `</span>`,
      // Last in the row and on a line of its own: the row is a flex
      // row that wraps, and the places are a list under the work rather
      // than a third column beside it. At 640 the row is already a
      // column and this simply falls to the bottom of it.
      placesMarkup(r),
      `</li>`,
    ].join("");
  }

  // Works with no author sort last rather than first: a blank sorts
  // before every letter, so the anonymous half of Early English Books
  // would otherwise open the list.
  function byName(a, b) {
    const aa = String(a.author || "");
    const bb = String(b.author || "");
    if (!aa !== !bb) return aa ? -1 : 1;
    return aa.localeCompare(bb) || cmpTitle(a.title, b.title);
  }

  function sortedRows() {
    if (sortBy === "recent") return rows.slice();
    return rows.slice().sort(byName);
  }

  function render() {
    setCount();
    if (sortEl) sortEl.hidden = rows.length < 2;
    // The note explains a label. Where no row carries the label it
    // explains nothing, so it is not shown.
    if (footEl) footEl.hidden = !rows.some((r) => r.resume);

    if (!rows.length) { renderEmpty(); return; }

    if (sortBy !== "collection") {
      listEl.innerHTML = `<ol class="bookmarks-rows">${sortedRows().map(rowMarkup).join("")}</ol>`;
      return;
    }

    // Grouped. Collections appear in the order their first saved work
    // appears, so the shelf someone has been reading is at the top
    // rather than whichever collection sorts first alphabetically.
    const order = [];
    const groups = new Map();
    rows.forEach((r) => {
      if (!groups.has(r.corpusLabel)) { groups.set(r.corpusLabel, []); order.push(r.corpusLabel); }
      groups.get(r.corpusLabel).push(r);
    });
    listEl.innerHTML = order.map((label) => {
      const kept = groups.get(label).slice().sort(byName);
      return `<section class="bookmarks-group">` +
        `<h3 class="bookmarks-group-title">${esc(label)}</h3>` +
        `<ol class="bookmarks-rows">${kept.map(rowMarkup).join("")}</ol>` +
        `</section>`;
    }).join("");
  }

  /* ── Loading ─────────────────────────────────────────────────── */

  // A RETIRED work (lib/faith-work-forwards.js) is shown as the copy
  // that replaced it, but keeps its own id: `id` is what Remove sends
  // back to the worker, and the worker only knows the id it stored.
  // Two old ids for the same work would be two rows; the second is
  // dropped (its Remove still reaches the first's id only, so both are
  // removed when the reader removes the one row).
  function parseIds(ids) {
    const FWD = window.MOWorkForwards;
    const seen = new Map();
    return ids.map((raw) => {
      const now = (FWD && FWD.savedId(raw)) || String(raw);
      const parts = now.split(":");
      const corpus = parts[1] || "tfr";
      const work = parts.slice(2).join(":");
      if (!work) return null;
      if (seen.has(now)) { seen.get(now).also.push(String(raw)); return null; }
      const want = { id: raw, corpus, work, also: [] };
      seen.set(now, want);
      return want;
    }).filter(Boolean);
  }

  function loadCatalogues(wants) {
    const MO = window.MOCorpora;
    if (!MO) return Promise.resolve(new Map());
    const ids = [...new Set(wants.map((w) => w.corpus))];
    // Only pay for the confessions catalogue if there is an id that
    // might be one. See the CONFESSION_FALLBACK note in the header.
    if (wants.some((w) => w.corpus === "tfr") && ids.indexOf(CONFESSION_FALLBACK) < 0) {
      ids.push(CONFESSION_FALLBACK);
    }
    // And English Editions, which an earlier reader also saved as "tfr:".
    if (wants.some((w) => w.corpus === "tfr") && ids.indexOf(ENGLISH_FALLBACK) < 0) {
      ids.push(ENGLISH_FALLBACK);
    }
    /* The dictionary is not a corpus and deliberately is not one: every
       surface that iterates MOCorpora.all would then carry its 1,916
       articles, Browse and the indexes among them. It resolves through
       its own file instead, and lands in the same map so build() does
       not have to know the difference. See assets/js/lib/faith-dictionary-refs.js. */
    const DICT = window.MODictionaryRefs;
    const wantsDict = DICT && wants.some((w) => w.corpus === DICT.CORPUS);
    return Promise.all(ids.filter((id) => !(DICT && id === DICT.CORPUS)).map((id) =>
      MO.load(id)
        .then((works) => [id, works])
        .catch(() => [id, []])
    ).concat(wantsDict ? [DICT.load().then((by) => [DICT.CORPUS, by ? [...by.values()] : []])
      .catch(() => [DICT.CORPUS, []])] : []))
      .then((pairs) => new Map(pairs));
  }

  function build(wants, catalogues) {
    const MO = window.MOCorpora;
    const indexOf = new Map();
    catalogues.forEach((works, id) => {
      const byId = new Map();
      (works || []).forEach((w) => byId.set(String(w.id), w));
      indexOf.set(id, byId);
    });

    const DICT = window.MODictionaryRefs;
    /* The shelf a saved work sits on, which is what the row says and
       what the groups are headed by. It was the collection ("The Latin
       Library", "Early English Books"), the pipeline the work arrived
       through, until the owner asked for that split to go (2026-09-23,
       PR #37). The dictionary keeps its own name, and a work whose
       tradition we do not have falls back to the collection rather than
       to nothing, so no row is ever unlabelled. */
    const labelOf = (id) => {
      if (DICT && id === DICT.CORPUS) return DICT.LABEL;
      const c = MO && MO.get ? MO.get(id) : null;
      return (c && c.label) || "The library";
    };
    const shelfOf = (id, hit) => {
      if (DICT && id === DICT.CORPUS) return DICT.LABEL;
      const t = String((hit && hit.tradition) || "").trim();
      const L = window.MOFaithLabel;
      if (t) return (L && L.of ? L.of(t, hit) : t);
      return labelOf(id);
    };

    return wants.map((want) => {
      let corpusId = want.corpus;
      let hit = (indexOf.get(corpusId) || new Map()).get(want.work);
      if (!hit && corpusId === "tfr") {
        hit = (indexOf.get(CONFESSION_FALLBACK) || new Map()).get(want.work);
        if (hit) corpusId = CONFESSION_FALLBACK;
      }
      if (!hit && corpusId === "tfr") {
        hit = (indexOf.get(ENGLISH_FALLBACK) || new Map()).get(want.work);
        if (hit) corpusId = ENGLISH_FALLBACK;
      }
      // The position was stored by the reader under the corpus the URL
      // carried, which is what the bookmark id records — NOT the
      // confessions fallback, which is a catalogue we retry against and
      // not an address the reader ever used.
      const isDict = !!(DICT && want.corpus === DICT.CORPUS);
      const resume = isDict ? DICT.hasResume(want.work) : hasResume(want.corpus, want.work);
      // The places list builds each link by appending a locator to the
      // row's URL, which the dictionary's URL cannot take: the article
      // id is already the fragment. A dictionary row therefore carries
      // its one place in its own link (see url below) and lists none.
      const places = isDict ? [] : placesFor(want.corpus, want.work);
      const marked = places.some((p) => p.kind === "mark");
      if (hit) {
        return {
          id: want.id,
          also: want.also || [],
          resolved: true,
          resume,
          places,
          marked,
          corpus: want.corpus,
          work: want.work,
          title: hit.title || hit.id,
          author: hit.author || "",
          eyebrow: plainEyebrow(hit),
          corpusLabel: shelfOf(corpusId, hit),
          // The catalogue's own url. Built by the same rule the worker
          // uses; never reconstructed here. A dictionary row asks its
          // own file, which folds the stop into the link.
          url: isDict ? DICT.resumeUrl(want.work) : hit.url,
        };
      }
      return {
        id: want.id,
        also: want.also || [],
        resolved: false,
        resume,
        places,
        marked,
        corpus: want.corpus,
        work: want.work,
        title: want.work,
        author: "",
        eyebrow: "",
        corpusLabel: shelfOf(want.corpus, null),
        url: constructedUrl(want.corpus, want.work),
      };
    });
  }

  function load() {
    setStatus("Loading your saved works…");
    listEl.innerHTML = "";
    window.MOAuth.fetch(`${WORKER}/bookmarks?ids_only=1`, {
      method: "GET", mode: "cors", credentials: "omit",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`bookmarks ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const ids = ((data && data.postIds) || []).filter((s) => /^tfr:/.test(String(s)));
        const wants = parseIds(ids);
        if (!wants.length) { rows = []; setStatus(""); render(); return null; }
        return loadCatalogues(wants).then((catalogues) => {
          rows = build(wants, catalogues);
          setStatus("");
          render();
        });
      })
      .catch((err) => {
        setStatus("");
        if (countEl) { countEl.hidden = true; countEl.textContent = ""; }
        renderError(err && err.message === "bookmarks 401"
          ? "Your session could not be verified."
          : "The bookmark service did not answer.");
      });
  }

  /* ── Removing ────────────────────────────────────────────────── */

  // Two steps, because this list is where someone scans a shelf rather
  // than toggles one work, and re-finding a work in a 19,000-work
  // library is not the same cost as re-clicking Save on the page you
  // are already reading. The second click is the real one; anything
  // else on the panel cancels.
  let armed = "";

  function disarm() {
    if (!armed) return;
    armed = "";
    listEl.querySelectorAll("[data-fb-remove]").forEach((b) => {
      b.classList.remove("is-armed");
      b.textContent = "Remove";
    });
  }

  function removeRow(id, btn) {
    // The whole list, so a failed remove restores the row to the place
    // it was in rather than to the end.
    const before = rows.slice();
    const gone = rows.find((r) => r.id === id);
    rows = rows.filter((r) => r.id !== id);
    armed = "";
    setStatus("");
    render();
    // A retired work saved under two old ids is one row; both go.
    const ids = [id].concat((gone && gone.also) || []);
    Promise.all(ids.map((postId) => window.MOAuth.fetch(`${WORKER}/bookmarks/remove`, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`remove ${r.status}`);
      })))
      .catch(() => {
        // Optimistic, then reconciled, the same way the reader's own
        // Save button works: put the row back and say why, rather than
        // leaving a work that looks removed and is not.
        rows = before;
        render();
        setStatus("That could not be removed just now. Nothing has changed.", "error");
      });
    if (btn) btn.blur();
  }

  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-fb-remove]");
    const retry = e.target.closest("[data-fb-retry]");
    if (retry) { load(); return; }
    if (!btn) { disarm(); return; }
    const row = btn.closest("[data-fb-id]");
    if (!row) return;
    const id = row.getAttribute("data-fb-id");
    if (armed === id) { removeRow(id, btn); return; }
    disarm();
    armed = id;
    btn.classList.add("is-armed");
    btn.textContent = "Remove?";
  });

  // Clicking anywhere else in the panel, or leaving it, cancels.
  root.addEventListener("click", (e) => {
    if (!e.target.closest("[data-fb-remove]")) disarm();
  });
  root.addEventListener("focusout", (e) => {
    if (!root.contains(e.relatedTarget)) disarm();
  });

  /* ── Sort ────────────────────────────────────────────────────── */

  if (sortEl) {
    sortEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-fb-sort-by]");
      if (!btn) return;
      sortBy = btn.getAttribute("data-fb-sort-by") || "recent";
      sortEl.querySelectorAll("[data-fb-sort-by]").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      disarm();
      render();
    });
  }

  /* ── Boot ────────────────────────────────────────────────────── */

  // Never return silently out of a config guard: a member who is not
  // signed in and a worker that was never configured both produce an
  // empty panel, and they mean completely different things.
  if (!WORKER || !window.MOAuth) {
    setStatus("");
    renderError("Bookmarks are not configured on this site.");
  } else if (!allowed) {
    setStatus("");
    if (sortEl) sortEl.hidden = true;
    renderSignedOut();
  } else {
    load();
  }
})();
