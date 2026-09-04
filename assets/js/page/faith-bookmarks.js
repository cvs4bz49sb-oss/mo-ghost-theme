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
 * it. Same approach as assets/js/faith-saved.js, which is the dashboard
 * version of this list.
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

  // A bookmark whose corpus is the default one and which the Latin
  // Library does not have is very probably a confession. Deliberately a
  // list of one: the alternative is loading every catalogue in the
  // library (15,569 works in EEBO alone) to answer a question about a
  // handful of ids.
  const CONFESSION_FALLBACK = "confessions";

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

  const safeHref = (url) => {
    const clean = window.MOSafeHref ? window.MOSafeHref.sanitize(url) : url;
    return clean || "/the-faith-received/";
  };

  // Same rule as readerUrlFor() in the worker's collections.js, for the
  // ids no catalogue could match. No page and no quote: this library
  // mostly has neither, and a bookmark carries neither.
  function constructedUrl(corpusId, workId) {
    const c = corpusId && corpusId !== "tfr"
      ? `c=${encodeURIComponent(corpusId)}&` : "";
    return `/the-faith-received/reader/?${c}w=${encodeURIComponent(workId)}`;
  }

  // The reader link, plus the place this browser last saw this reader
  // in this work. The store returns the URL untouched where there is no
  // position, so this is safe to run over every row.
  const POS = () => window.MOFaithPosition || null;

  function resumeUrl(url, corpusId, workId) {
    const store = POS();
    return store ? store.appendTo(url, corpusId, workId) : url;
  }

  function hasResume(corpusId, workId) {
    const store = POS();
    return !!(store && store.has(corpusId, workId));
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
      `<p class="bookmarks-empty-note">Open any work in the reader, then choose Save in the text tools. ` +
      `It will appear here with the collection it came from and a link straight back to it.</p>` +
      `<p class="bookmarks-empty-act"><a class="bookmarks-empty-link" href="/the-faith-received/browse/">Browse the library</a></p>` +
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
      // would be a promise the row could not keep.
      r.resume ? `<span class="bookmarks-row-note">Picks up where you left off.</span>` : "",
      `</a>`,
      `<span class="bookmarks-row-side">`,
      // The shelf name is already the group heading when grouped.
      sortBy === "collection" ? "" : `<span class="bookmarks-row-shelf">${esc(r.corpusLabel)}</span>`,
      `<button type="button" class="bookmarks-remove" data-fb-remove `,
      `aria-label="Remove ${esc(r.title)} from your saved works">Remove</button>`,
      `</span>`,
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
    return aa.localeCompare(bb) || String(a.title || "").localeCompare(String(b.title || ""));
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

  function parseIds(ids) {
    return ids.map((raw) => {
      const parts = String(raw).split(":");
      const corpus = parts[1] || "tfr";
      const work = parts.slice(2).join(":");
      return work ? { id: raw, corpus, work } : null;
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
    return Promise.all(ids.map((id) =>
      MO.load(id)
        .then((works) => [id, works])
        .catch(() => [id, []])
    )).then((pairs) => new Map(pairs));
  }

  function build(wants, catalogues) {
    const MO = window.MOCorpora;
    const indexOf = new Map();
    catalogues.forEach((works, id) => {
      const byId = new Map();
      (works || []).forEach((w) => byId.set(String(w.id), w));
      indexOf.set(id, byId);
    });

    const labelOf = (id) => {
      const c = MO && MO.get ? MO.get(id) : null;
      return (c && c.label) || "The library";
    };

    return wants.map((want) => {
      let corpusId = want.corpus;
      let hit = (indexOf.get(corpusId) || new Map()).get(want.work);
      if (!hit && corpusId === "tfr") {
        hit = (indexOf.get(CONFESSION_FALLBACK) || new Map()).get(want.work);
        if (hit) corpusId = CONFESSION_FALLBACK;
      }
      // The position was stored by the reader under the corpus the URL
      // carried, which is what the bookmark id records — NOT the
      // confessions fallback, which is a catalogue we retry against and
      // not an address the reader ever used.
      const resume = hasResume(want.corpus, want.work);
      if (hit) {
        return {
          id: want.id,
          resolved: true,
          resume,
          corpus: want.corpus,
          work: want.work,
          title: hit.title || hit.id,
          author: hit.author || "",
          eyebrow: hit.eyebrow || "",
          corpusLabel: labelOf(corpusId),
          // The catalogue's own url. Built by the same rule the worker
          // uses; never reconstructed here.
          url: hit.url,
        };
      }
      return {
        id: want.id,
        resolved: false,
        resume,
        corpus: want.corpus,
        work: want.work,
        title: want.work,
        author: "",
        eyebrow: "",
        corpusLabel: labelOf(want.corpus),
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
    rows = rows.filter((r) => r.id !== id);
    armed = "";
    setStatus("");
    render();
    window.MOAuth.fetch(`${WORKER}/bookmarks/remove`, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: id }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`remove ${r.status}`);
      })
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
  } else if (!paid) {
    setStatus("");
    if (sortEl) sortEl.hidden = true;
    renderSignedOut();
  } else {
    load();
  }
})();
