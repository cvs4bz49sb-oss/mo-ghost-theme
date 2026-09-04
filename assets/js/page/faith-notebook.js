/*
 * The Faith Received — the Notebook workspace.
 *
 * Binds to partials/faith-received/_notebook-panel.hbs. Read that
 * partial's header comment for the DOM contract; every selector below
 * is unscoped document.querySelector(), so the markup must appear
 * exactly once on whichever page loads this file.
 *
 * THIS IS A SECOND VIEW OF ONE SET OF NOTES, NOT A SECOND NOTEBOOK.
 * The notes are made in the reader: select a passage, and
 * assets/js/faith-reader-tools.js keeps it with its citation and a link
 * back to the exact block. That panel is scoped to the work in front of
 * you. This one is the whole notebook across every work, which is the
 * view the reader panel could never be.
 *
 * Both surfaces read and write through window.MOFaithNotebook
 * (assets/js/lib/faith-notebook-store.js) and NEITHER touches
 * localStorage directly. That file was factored out of
 * faith-reader-tools.js for exactly this reason: two copies of the
 * parsing code over one storage key is a format that drifts, and the
 * way it drifts is that one side quietly drops a field the other side
 * wrote. If the notebook ever moves off localStorage it moves there,
 * and both surfaces follow without either being rewritten.
 *
 * WHAT IS DELIBERATELY NOT HERE. Drawing a relation between two notes
 * ("Relate") is left to the reader panel and to the Constellations
 * workspace. Relations already made are SHOWN on each entry, because
 * hiding them here would make an entry look like it stood alone. And
 * removing an entry drops its relations with it, which the store does.
 *
 * LINKING BACK. An entry stores an absolute `url` written from the
 * reader's own location, so it addresses the exact block. That is
 * better than anything reconstructable and is used verbatim, after
 * MOSafeHref, since it is also the one field that can arrive from
 * outside in a shared constellation. Where there is none, the store
 * builds one by the same rule as readerUrlFor() in
 * website/workers/tfr-library/lib/collections.js: `?c=pld&w=2741`, with
 * `c` omitted for the default collection.
 */
(function () {
  "use strict";

  const NB = window.MOFaithNotebook;
  const root = document.querySelector("[data-fn-root]");
  if (!root) return;
  // The partial ships its own <script> tags so it can be dropped into
  // any page. If a host page loads this file a second time, bind once.
  if (root.getAttribute("data-fn-bound") === "1") return;
  root.setAttribute("data-fn-bound", "1");

  const listEl = document.querySelector("[data-fn-list]");
  const countEl = document.querySelector("[data-fn-count]");
  const statusEl = document.querySelector("[data-fn-status]");
  const filterEl = document.querySelector("[data-fn-filter]");
  const groupEl = document.querySelector("[data-fn-group]");
  const toolsEl = document.querySelector("[data-fn-tools]");
  const footEl = document.querySelector("[data-fn-foot]");
  if (!listEl) return;

  // The store is loaded by the partial immediately above this file. If
  // it is missing the page has been assembled wrongly, and an empty
  // notebook would read as "you have never taken a note" — which is a
  // lie, and the worst one this panel could tell.
  if (!NB) {
    listEl.innerHTML =
      `<div class="notebook-empty">` +
      `<p class="notebook-empty-lede">The notebook could not be opened.</p>` +
      `<p class="notebook-empty-note">Your notes are safe. This page failed to load the piece that reads them, ` +
      `so nothing is being shown rather than the wrong thing.</p>` +
      `</div>`;
    if (toolsEl) toolsEl.hidden = true;
    if (footEl) footEl.hidden = true;
    return;
  }

  const esc = NB.escapeHtml;

  /* ── State ───────────────────────────────────────────────────── */

  let groupBy = "recent";
  let filter = "";
  // The entry whose Remove button is waiting for its second click.
  let armed = "";

  const matches = (e) => {
    if (!filter) return true;
    return [e.text, e.note, e.cite, e.title, e.author]
      .map((s) => String(s == null ? "" : s).toLowerCase())
      .join(" ")
      .indexOf(filter) >= 0;
  };

  // Everything, newest first, which is the order the store keeps.
  const all = () => NB.load();
  const shown = () => all().filter(matches);

  /* ── Painting ────────────────────────────────────────────────── */

  function setStatus(text, tone) {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.hidden = !text;
    statusEl.classList.toggle("notebook-status--error", tone === "error");
  }

  function edgeMarkup(id, byId, edges) {
    const rows = edges
      .filter((x) => x.a === id || x.b === id)
      .map((x) => {
        const other = byId.get(x.a === id ? x.b : x.a);
        if (!other) return "";
        // Direction matters: "contests" and "is contested by" are not
        // the same claim. The arrow marks the incoming half.
        const dir = x.a === id ? String(x.rel) : `${String(x.rel)} ←`;
        return `<li class="notebook-edge">${esc(dir)} ` +
          `<a href="${esc(NB.linkFor(other))}">${esc(other.cite || other.title || "a passage")}</a></li>`;
      })
      .filter(Boolean)
      .join("");
    return rows ? `<ul class="notebook-edges">${rows}</ul>` : "";
  }

  function entryMarkup(e, byId, edges) {
    const head = esc(e.cite || e.title || "Passage");
    const source = [e.title, e.author].filter(Boolean).map(esc).join(" &middot; ");
    // Ids come out of the store and go into an id= / for= pair, so they
    // are escaped on both sides and stay identical to each other.
    const noteId = `notebook-note-${esc(e.id)}`;
    const sep = source && e.at ? " &middot; " : "";
    return [
      `<article class="notebook-entry" data-fn-id="${esc(e.id)}">`,
      `<p class="notebook-entry-cite">${head}</p>`,
      source || e.at
        ? `<p class="notebook-entry-source">${source}${sep}${esc(e.at || "")}</p>`
        : "",
      e.text ? `<blockquote class="notebook-entry-text">${esc(e.text)}</blockquote>` : "",
      `<label class="visually-hidden" for="${noteId}">Your note on this passage</label>`,
      `<textarea class="notebook-entry-note" id="${noteId}" data-fn-note rows="2" `,
      `placeholder="Your note">${esc(e.note || "")}</textarea>`,
      edgeMarkup(e.id, byId, edges),
      `<div class="notebook-entry-row">`,
      `<a class="notebook-act" href="${esc(NB.linkFor(e))}">Open in the reader</a>`,
      `<button type="button" class="notebook-act" data-fn-copy-one>Copy citation</button>`,
      `<button type="button" class="notebook-act notebook-act--quiet" data-fn-remove `,
      `aria-label="Remove this note from your notebook">Remove</button>`,
      `</div>`,
      `</article>`,
    ].join("");
  }

  function renderEmpty(filtered) {
    if (filtered) {
      listEl.innerHTML =
        `<div class="notebook-empty">` +
        `<p class="notebook-empty-lede">Nothing matches that.</p>` +
        `<p class="notebook-empty-note">The filter looks at the passage, your note, the citation, ` +
        `the work and its author.</p>` +
        `</div>`;
      return;
    }
    listEl.innerHTML =
      `<div class="notebook-empty">` +
      `<p class="notebook-empty-lede">Nothing in the notebook yet.</p>` +
      `<p class="notebook-empty-note">Open a work in the reader and select any passage. ` +
      `Choose Save to notebook and it is kept here, with its citation and a link back to the exact block.</p>` +
      `<p class="notebook-empty-act"><a class="notebook-empty-link" href="/the-faith-received/browse/">Browse the library</a></p>` +
      `</div>`;
  }

  // A render rebuilds every entry from storage, textareas included. If
  // one of them has the cursor in it, that field is holding text the
  // store has not seen yet and the rebuild deletes it mid-sentence.
  // The `storage` event makes this a real case rather than a
  // theoretical one: the reader open in another tab saves a passage,
  // this page renders, and the note being typed here vanishes.
  //
  // So a render that arrives while someone is typing is DEFERRED, not
  // dropped, and runs when the field is released.
  let deferred = false;
  let deferTimer = null;

  function typing() {
    const el = document.activeElement;
    return !!(el && el.matches && el.matches("[data-fn-note]") && listEl.contains(el));
  }

  // Picked up by whichever comes first: the field losing focus, or
  // this. Both, because `focusout` is the immediate signal and is not
  // a guaranteed one — a field can stop being the active element
  // without the reader having blurred it — and a deferred render that
  // nothing ever runs is a list frozen at the moment someone started
  // typing.
  function deferRender() {
    deferred = true;
    if (deferTimer) return;
    deferTimer = window.setInterval(() => {
      if (typing()) return;
      window.clearInterval(deferTimer);
      deferTimer = null;
      if (deferred) render();
    }, 700);
  }

  function render() {
    const list = shown();
    const total = all().length;
    const edges = NB.loadEdges();
    const byId = new Map(all().map((e) => [e.id, e]));

    if (countEl) {
      countEl.hidden = !total;
      if (total) {
        const kept = `${total} ${total === 1 ? "passage" : "passages"}`;
        countEl.textContent = filter ? `${list.length} of ${kept}` : kept;
      } else {
        countEl.textContent = "";
      }
    }
    if (toolsEl) toolsEl.hidden = total < 2;
    if (footEl) footEl.hidden = !list.length;

    // Everything above this line is chrome and cannot eat anyone's
    // typing. Everything below rebuilds the entries.
    if (typing()) { deferRender(); return; }
    deferred = false;

    if (!list.length) { renderEmpty(!!filter && !!total); return; }

    if (groupBy !== "work") {
      listEl.innerHTML = `<div class="notebook-entries">${
        list.map((e) => entryMarkup(e, byId, edges)).join("")}</div>`;
      return;
    }

    // Grouped by the work the passage came from. Works appear in the
    // order their most recent note appears, so what someone is reading
    // now is at the top.
    const order = [];
    const groups = new Map();
    list.forEach((e) => {
      const key = `${e.corpus || "tfr"}|${e.work || ""}`;
      if (!groups.has(key)) { groups.set(key, []); order.push(key); }
      groups.get(key).push(e);
    });
    listEl.innerHTML = order.map((key) => {
      const kept = groups.get(key);
      const first = kept[0];
      const name = first.title || first.work || "This work";
      const n = kept.length;
      return `<section class="notebook-group">` +
        `<h3 class="notebook-group-title">` +
        `<a href="${esc(NB.linkFor(first))}">${esc(name)}</a>` +
        `<span class="notebook-group-count">${n} ${n === 1 ? "passage" : "passages"}</span>` +
        `</h3>` +
        `<div class="notebook-entries">${kept.map((e) => entryMarkup(e, byId, edges)).join("")}</div>` +
        `</section>`;
    }).join("");
  }

  /* ── Removing ────────────────────────────────────────────────── */
  //
  // Two steps. A note is a piece of someone's own work, there is no
  // undo, and it is not re-creatable by clicking anything: it would
  // have to be found and re-selected in the text. The reader's panel
  // removes on one click because it is a short, work-scoped list; this
  // one is the whole notebook and the rows all look alike.

  function disarm() {
    if (!armed) return;
    armed = "";
    listEl.querySelectorAll("[data-fn-remove]").forEach((b) => {
      b.classList.remove("is-armed");
      b.textContent = "Remove";
    });
  }

  /* ── Events ──────────────────────────────────────────────────── */

  listEl.addEventListener("click", (e) => {
    const item = e.target.closest("[data-fn-id]");
    if (!item) { disarm(); return; }
    const id = item.getAttribute("data-fn-id");

    if (e.target.closest("[data-fn-remove]")) {
      const btn = e.target.closest("[data-fn-remove]");
      if (armed !== id) {
        disarm();
        armed = id;
        btn.classList.add("is-armed");
        btn.textContent = "Remove?";
        return;
      }
      armed = "";
      NB.remove(id);
      setStatus("");
      render();
      return;
    }

    if (e.target.closest("[data-fn-copy-one]")) {
      const btn = e.target.closest("[data-fn-copy-one]");
      const entry = all().filter((x) => x.id === id)[0];
      if (!entry) return;
      NB.copyText(NB.formatEntry(entry)).then((ok) => {
        btn.textContent = ok ? "Copied" : "Copy failed";
        window.setTimeout(() => { btn.textContent = "Copy citation"; }, 1200);
      });
      return;
    }

    disarm();
  });

  /* ── Notes ───────────────────────────────────────────────────── */
  //
  // Autosaved while typing, not only on blur. Blur alone loses a note
  // in the ordinary case: type a sentence, then close the tab or follow
  // the "Open in the reader" link, and `change` never fires. The
  // reader's own panel does the same thing on the same schedule, so a
  // note behaves identically in both places.
  //
  // 500ms, trailing. Short enough that a note is safe almost as soon as
  // it is typed, long enough that a whole sentence is one write to
  // localStorage rather than forty.

  let noteTimer = null;
  let noteField = null;

  function saveNote(field) {
    const item = field.closest("[data-fn-id]");
    const id = item && item.getAttribute("data-fn-id");
    if (!id) return;
    const saved = NB.setNote(id, field.value);
    // A failed save here means the entry is gone — removed in another
    // tab, most likely — and the reader is typing into nothing. Said
    // plainly, and left on screen rather than timed out.
    setStatus(saved ? "Note saved." : "That note could not be saved: it is no longer in your notebook.", saved ? "" : "error");
    if (saved) window.setTimeout(() => setStatus(""), 1600);
  }

  listEl.addEventListener("input", (e) => {
    const field = e.target.closest("[data-fn-note]");
    if (!field) return;
    noteField = field;
    window.clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => {
      noteTimer = null;
      if (noteField) saveNote(noteField);
    }, 500);
  });

  // Kept alongside the debounce: `change` is what a paste-then-tab
  // produces, and it commits immediately rather than waiting.
  listEl.addEventListener("change", (e) => {
    const field = e.target.closest("[data-fn-note]");
    if (!field) return;
    window.clearTimeout(noteTimer);
    noteTimer = null;
    saveNote(field);
  });

  root.addEventListener("focusout", (e) => {
    const field = e.target.closest && e.target.closest("[data-fn-note]");
    if (field) {
      // Commit whatever the debounce has not written yet, then run any
      // render that was waiting for this field to be free. A timeout of
      // 0, because during focusout the field is still the active
      // element and typing() would say the reader is still in it.
      window.clearTimeout(noteTimer);
      noteTimer = null;
      saveNote(field);
      noteField = null;
      if (deferred) window.setTimeout(render, 0);
    }
    if (!root.contains(e.relatedTarget)) disarm();
  });

  if (filterEl) {
    let timer = null;
    filterEl.addEventListener("input", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        filter = filterEl.value.trim().toLowerCase();
        disarm();
        render();
      }, 180);
    });
  }

  if (groupEl) {
    groupEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-fn-group-by]");
      if (!btn) return;
      groupBy = btn.getAttribute("data-fn-group-by") || "recent";
      groupEl.querySelectorAll("[data-fn-group-by]").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      disarm();
      render();
    });
  }

  /* ── The whole notebook: copy, download, share ───────────────── */

  const copyBtn = document.querySelector("[data-fn-copy]");
  const downloadBtn = document.querySelector("[data-fn-download]");
  const shareBtn = document.querySelector("[data-fn-share]");

  // Everything currently on screen, not everything stored: if a filter
  // is on, what leaves is what the filter shows. Anything else would
  // mean the button did something other than what the panel says.
  const exportText = () => shown().map(NB.formatEntry).join("\n\n");

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const text = exportText();
      if (!text) return;
      NB.copyText(text).then((ok) => {
        copyBtn.textContent = ok ? "Copied" : "Copy failed";
        window.setTimeout(() => { copyBtn.textContent = "Copy all"; }, 1400);
      });
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const text = exportText();
      if (!text) return;
      const blob = new Blob([`${text}\n`], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "faith-received-notebook.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener("click", () => {
      const list = shown();
      if (!list.length) return;
      const hash = NB.encodeShare(list, NB.loadEdges(), "Notebook");
      // Land whoever opens it inside a work rather than on a tab strip:
      // the import banner lives in the reader, so the link has to be a
      // reader link. Query kept, fragment dropped, since the payload is
      // the fragment.
      let base = "/the-faith-received/reader/";
      try {
        const u = new URL(NB.linkFor(list[0]), window.location.origin);
        base = u.pathname + u.search;
      } catch (_) { /* keep the default */ }
      NB.copyText(window.location.origin + base + hash).then((ok) => {
        shareBtn.textContent = ok ? "Link copied" : "Copy failed";
        window.setTimeout(() => { shareBtn.textContent = "Share as a link"; }, 1800);
      });
    });
  }

  /* ── Boot ────────────────────────────────────────────────────── */

  render();

  // A note taken in another tab, or the reader open beside this page,
  // should not need a reload to show up here.
  window.addEventListener("storage", (e) => {
    if (e.key !== NB.NOTEBOOK_KEY && e.key !== NB.EDGES_KEY) return;
    disarm();
    render();
  });
})();
