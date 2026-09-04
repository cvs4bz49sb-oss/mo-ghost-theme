/*
 * The Faith Received — reader tools: find in work, and the notebook.
 *
 * Two things a reader working in a primary source needs and a reading
 * app usually withholds:
 *
 *   Find    the browser's own find fails here, because the reader
 *           collapses sections and the corpus loads lazily. This one
 *           opens what it has to and says plainly how much of the work
 *           it could actually see.
 *
 *   Notebook  select a passage, keep it. Every entry carries its
 *           citation and a link back to the exact block, so what comes
 *           out is usable in a footnote rather than a naked quotation.
 *
 * Both are local. Nothing here touches a server: the notebook lives in
 * localStorage, which means it survives a reload and does not survive a
 * new browser. That is the right trade before there are accounts to
 * hang it on, and the panel says so.
 *
 * The STORAGE is no longer here. It moved to
 * assets/js/lib/faith-notebook-store.js on 2026-09-04, when the
 * Notebook workspace (partials/faith-received/_notebook-panel.hbs)
 * became a second surface over the same notes. This file still owns
 * every piece of reader-specific behaviour — the selection popover, the
 * work-scoped panel, the constellation import banner — and reads and
 * writes through window.MOFaithNotebook rather than through
 * localStorage. See that file's header for the entry shape.
 */

(function () {
  "use strict";

  const contentEl = document.querySelector("[data-fr-content]");
  const controls = document.querySelector("[data-faith-controls]");
  if (!contentEl || !controls) return;

  // custom-faith-reader.hbs loads the store immediately before this
  // file. Find does not depend on it, so a missing store costs the
  // notebook and nothing else — see boot() at the foot of this file.
  const NB = window.MOFaithNotebook;

  const work = (() => {
    let w = "";
    let c = "tfr";
    try {
      const q = new URLSearchParams(window.location.search);
      w = q.get("w") || "";
      c = q.get("c") || "tfr";
    } catch (_) {}
    return { id: w, corpus: c };
  })();

  const titleOf = () => {
    const t = document.querySelector("[data-fr-title]");
    return t ? t.textContent.trim() : "";
  };
  const authorOf = () => {
    const a = document.querySelector("[data-fr-dek]");
    // The dek is a whole descriptive line — "Anonymous · Tome 2 ·
    // Fasc. 4 · PO 009 · pp. 421–526 · Xe siècle". Only the first
    // segment belongs in front of a title in a citation.
    return a ? a.textContent.trim().split("·")[0].trim() : "";
  };

  // ── Storage ───────────────────────────────────────────────────
  //
  // All of it lives in the store. These are the only names the rest of
  // this file uses, kept so the code below reads as it always did.
  // `remove` now drops the entry's relations with it, which this file's
  // one call site was doing by hand.
  //
  // Each one is guarded rather than aliased straight onto NB, so a
  // missing store cannot throw at load time and take Find down with the
  // notebook. boot() below skips the notebook entirely in that case, so
  // in practice none of these guards is ever the branch taken.

  const load = () => (NB ? NB.load() : []);
  const save = (list) => (NB ? NB.save(list) : false);
  const add = (entry) => (NB ? NB.add(entry) : []);
  const remove = (id) => (NB ? NB.remove(id) : []);

  // ── Helpers ───────────────────────────────────────────────────

  // Never falls back to the identity function: an escaper that stops
  // escaping is worse than one that returns nothing.
  const esc = (s) => (NB ? NB.escapeHtml(s) : "");

  // Nearest citation and anchor above a node — the block a selection
  // started in, or the section that holds it.
  function contextOf(node) {
    let n = node.nodeType === 1 ? node : node.parentNode;
    let cite = "";
    let anchor = "";
    while (n && n !== contentEl) {
      if (!cite && n.getAttribute) cite = n.getAttribute("data-cite") || "";
      if (!anchor && n.getAttribute) anchor = n.getAttribute("data-src-id") || n.id || "";
      if (cite && anchor) break;
      n = n.parentNode;
    }
    return { cite, anchor };
  }

  function linkTo(anchor) {
    return window.location.origin + window.location.pathname +
      window.location.search + (anchor ? `#${anchor}` : "");
  }

  const copyText = (s) => (NB ? NB.copyText(s) : Promise.resolve(false));

  // The shape a citation should take when it leaves this site: enough
  // for a footnote without editing. Shared, so the Notebook workspace's
  // "Copy all" and this panel's produce the same text.
  const formatEntry = (e) => (NB ? NB.formatEntry(e) : "");

  // ── Constellations ────────────────────────────────────────────
  //
  // A note on its own is a clipping. A note joined to another note by
  // a claim — this supports that, this contests it — is an argument,
  // and an argument is the thing a reader of these texts is actually
  // building. So entries can be related, and a set of related entries
  // travels in a URL.
  //
  // The relations UI is here. The wire format, the edge storage and the
  // tuple ↔ entry translation are in the store, because they are not
  // this surface's private business: the Notebook workspace shares a
  // notebook by the same encoder, and a second copy of a format four
  // other sites also read is the last thing this should have two of.
  // See assets/js/lib/faith-notebook-store.js for the payload shape.

  const RELATIONS = NB ? NB.RELATIONS : [];

  const loadEdges = () => (NB ? NB.loadEdges() : []);
  const saveEdges = (list) => { if (NB) NB.saveEdges(list); };
  const fromTuple = (t) => (NB ? NB.fromTuple(t) : null);
  const readerUrl = (e) => (NB ? NB.readerUrl(e) : "/the-faith-received/");
  const encodeShare = (entries, edges, name) => (NB ? NB.encodeShare(entries, edges, name) : "");
  const decodeShare = (hash) => (NB ? NB.decodeShare(hash) : null);

  // ── Find in work ──────────────────────────────────────────────
  //
  // Walks text nodes and wraps hits in <mark>. Collapsed <details> are
  // opened on the way to a match; sections a shard reader has not
  // hydrated yet are counted and reported rather than silently missed.

  let hits = [];
  let hitAt = -1;

  function clearMarks() {
    contentEl.querySelectorAll("mark.faith-find-hit").forEach((m) => {
      const parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });
    hits = [];
    hitAt = -1;
  }

  function runFind(term, statusEl) {
    clearMarks();
    const q = term.trim();
    if (q.length < 2) {
      statusEl.textContent = q ? "Type at least two characters." : "";
      return;
    }

    // Whole words. "sin" in Augustine on the Trinity reported 1,092
    // matches and they were abusing, despising, since and choosing:
    // the letters were there and the word was not.
    const re = window.MOText && window.MOText.wordPattern
      ? window.MOText.wordPattern(q, "giu") : null;
    if (!re) { statusEl.textContent = ""; return; }
    const walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        // Don't match the citation chips or the section headings' own
        // chrome — a hit there scrolls nowhere useful.
        const p = node.parentNode;
        if (p && p.closest && p.closest(".faith-cite, .faith-find, .faith-notebook")) {
          return NodeFilter.FILTER_REJECT;
        }
        re.lastIndex = 0;
        return re.test(node.nodeValue)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    const targets = [];
    let node = walker.nextNode();
    while (node) {
      targets.push(node);
      node = walker.nextNode();
      // A whole Summa is 40,000 blocks; stop before the page does.
      if (targets.length >= 2000) break;
    }

    targets.forEach((t) => {
      const text = t.nodeValue;
      // Collected before splitting: splitText rewrites the node the
      // pattern is walking, and the offsets would drift under it.
      const spans = [];
      re.lastIndex = 0;
      let m = re.exec(text);
      while (m) {
        spans.push([m.index, m[0].length]);
        if (re.lastIndex === m.index) re.lastIndex += 1;
        m = re.exec(text);
      }
      let from = 0;
      let cursor = t;
      spans.forEach(([idx, len]) => {
        const mid = cursor.splitText(idx - from);
        const after = mid.splitText(len);
        const mark = document.createElement("mark");
        mark.className = "faith-find-hit";
        mid.parentNode.insertBefore(mark, mid);
        mark.appendChild(mid);
        hits.push(mark);
        cursor = after;
        from = idx + len;
      });
    });

    // How much of the work this search could actually see. The shard
    // reader hydrates a section only when it is opened, so a long work
    // is mostly not in the DOM — saying "no matches" over text that was
    // never loaded would be a lie.
    const unloaded = contentEl.querySelectorAll(
      '[data-from]:not([data-fr-state="loaded"])'
    ).length;
    const scope = unloaded
      ? ` · ${unloaded} section${unloaded === 1 ? "" : "s"} not loaded yet`
      : "";
    statusEl.textContent = hits.length
      ? `${hits.length} match${hits.length === 1 ? "" : "es"}${scope}`
      : `No matches${scope}`;
    if (hits.length) step(1, statusEl);
  }

  // The sticky Mere Orthodoxy header plus the find bar, measured
  // rather than guessed. The constant that used to live here was 150,
  // which is right on a desktop (85 + 56) and wrong on a phone, where
  // the header is 61 and a three-row find bar is 144: the match the
  // reader had just jumped to landed 55px behind the bar that found it.
  function findChrome(bar) {
    const header = document.querySelector(".site-header");
    const h = header ? header.getBoundingClientRect().height : 0;
    const b = bar && !bar.hidden ? bar.getBoundingClientRect().height : 0;
    return h + b + 12;
  }

  // Smooth when the reader asked for the next match and nothing is
  // moving. Instant when arriving from a link, because the sections
  // are still hydrating and a smooth scroll is cancelled the moment
  // the layout shifts under it — which is exactly how a search result
  // opened the right page and stopped six hundred pixels short of the
  // word it promised.
  function scrollToMark(mark, instant) {
    const bar = document.querySelector(".faith-find");
    const y = mark.getBoundingClientRect().top + window.pageYOffset - findChrome(bar);
    window.scrollTo({ top: Math.max(0, y), behavior: instant ? "instant" : "smooth" });
  }

  // A section opened by the jump fetches its text, and until it lands
  // the section is a closed-height stub. Scrolling immediately put the
  // reader at a position that then moved out from under them as the
  // text arrived, which is why Find felt like it lost you. Wait for the
  // section to report loaded, then scroll, and give up after a beat so
  // a failed fetch cannot hang the jump.
  function whenSettled(mark, done) {
    const section = mark.closest('[data-from]');
    if (!section || section.dataset.frState === "loaded") { done(); return; }
    let stop = false;
    const finish = () => {
      if (stop) return;
      stop = true;
      obs.disconnect();
      window.clearTimeout(timer);
      // One frame after the DOM settles, so layout has run.
      window.requestAnimationFrame(done);
    };
    const obs = new window.MutationObserver(() => {
      if (section.dataset.frState === "loaded") finish();
    });
    obs.observe(section, { attributes: true, attributeFilter: ["data-fr-state"] });
    const timer = window.setTimeout(finish, 2500);
  }

  function step(dir, statusEl) {
    if (!hits.length) return;
    if (hitAt >= 0 && hits[hitAt]) hits[hitAt].classList.remove("is-current");
    hitAt = (hitAt + dir + hits.length) % hits.length;
    const mark = hits[hitAt];
    mark.classList.add("is-current");
    // Open every collapsed ancestor, or the scroll lands on a closed
    // summary and the reader sees nothing.
    let n = mark.parentNode;
    while (n && n !== contentEl) {
      if (n.tagName === "DETAILS" && !n.open) n.open = true;
      n = n.parentNode;
    }
    whenSettled(mark, () => scrollToMark(mark));
    if (statusEl) {
      statusEl.textContent = statusEl.textContent.replace(/^\d+ of \d+ · /, "");
      statusEl.textContent = `${hitAt + 1} of ${hits.length} · ${statusEl.textContent}`;
    }
  }

  function buildFind() {
    const bar = document.createElement("div");
    bar.className = "faith-find";
    bar.hidden = true;
    bar.innerHTML =
      `<input type="search" class="faith-find-input" placeholder="Find in this work" aria-label="Find in this work">` +
      `<button type="button" class="faith-find-nav" data-find-prev aria-label="Previous match">&uarr;</button>` +
      `<button type="button" class="faith-find-nav" data-find-next aria-label="Next match">&darr;</button>` +
      `<span class="faith-find-status" data-find-status role="status" aria-live="polite"></span>` +
      `<button type="button" class="faith-find-close" data-find-close aria-label="Close find">&times;</button>`;
    controls.parentNode.insertBefore(bar, controls.nextSibling);

    const input = bar.querySelector("input");
    const statusEl = bar.querySelector("[data-find-status]");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "faith-toggle-switch faith-find-toggle";
    toggle.setAttribute("aria-pressed", "false");
    toggle.innerHTML = `<span class="faith-toggle-label">Find</span>`;
    controls.appendChild(toggle);

    function open(on) {
      bar.hidden = !on;
      toggle.setAttribute("aria-pressed", on ? "true" : "false");
      if (on) input.focus();
      else { clearMarks(); statusEl.textContent = ""; }
    }

    toggle.addEventListener("click", () => open(bar.hidden));
    bar.querySelector("[data-find-close]").addEventListener("click", () => open(false));
    bar.querySelector("[data-find-prev]").addEventListener("click", () => step(-1, statusEl));
    bar.querySelector("[data-find-next]").addEventListener("click", () => step(1, statusEl));

    let timer = null;
    input.addEventListener("input", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => runFind(input.value, statusEl), 220);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (hits.length) step(e.shiftKey ? -1 : 1, statusEl);
      else runFind(input.value, statusEl);
    });

    // Take over the browser's find, which cannot see collapsed text.
    document.addEventListener("keydown", (e) => {
      if (!(e.key === "f" && (e.metaKey || e.ctrlKey))) return;
      e.preventDefault();
      open(true);
      input.select();
    });

    findFromUrl(bar, open);
  }

  // ── Notebook ──────────────────────────────────────────────────

  function buildNotebook() {
    const panel = document.createElement("aside");
    panel.className = "faith-notebook";
    panel.setAttribute("aria-label", "Notebook");
    panel.hidden = true;
    panel.innerHTML =
      `<div class="faith-notebook-head">` +
      `<p class="faith-notebook-title">Notebook</p>` +
      `<button type="button" class="faith-notebook-close" data-nb-close aria-label="Close notebook">&times;</button>` +
      `</div>` +
      `<div class="faith-notebook-scope">` +
      `<button type="button" class="faith-notebook-tab is-active" data-nb-scope="work">This work</button>` +
      `<button type="button" class="faith-notebook-tab" data-nb-scope="all">Everything</button>` +
      `</div>` +
      `<div class="faith-notebook-list" data-nb-list></div>` +
      `<div class="faith-notebook-foot">` +
      `<button type="button" class="faith-notebook-act" data-nb-copy>Copy all</button>` +
      `<button type="button" class="faith-notebook-act" data-nb-download>Download</button>` +
      `<button type="button" class="faith-notebook-act" data-nb-share>Share</button>` +
      `<p class="faith-notebook-note">Kept in this browser only.</p>` +
      `</div>`;
    document.body.appendChild(panel);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "faith-toggle-switch faith-notebook-toggle";
    toggle.setAttribute("aria-pressed", "false");
    toggle.innerHTML = `<span class="faith-toggle-label">Notebook</span><span class="faith-notebook-count" data-nb-count hidden></span>`;
    controls.appendChild(toggle);

    const listEl = panel.querySelector("[data-nb-list]");
    const countEl = panel.querySelector("[data-nb-count]") || toggle.querySelector("[data-nb-count]");
    let scope = "work";
    // The entry a relation is being drawn from, while it is being drawn.
    let linkFrom = "";

    function entries() {
      const all = load();
      return scope === "all" ? all : all.filter((e) => e.work === work.id && e.corpus === work.corpus);
    }

    function render() {
      const list = entries();
      const mine = load().filter((e) => e.work === work.id && e.corpus === work.corpus).length;
      if (countEl) {
        countEl.hidden = !mine;
        countEl.textContent = mine ? String(mine) : "";
      }
      if (!list.length) {
        listEl.innerHTML =
          `<p class="faith-notebook-empty">Select any passage in the text to keep it here, with its citation and a link back to the exact place.</p>`;
        return;
      }
      const all = load();
      const byId = new Map(all.map((e) => [e.id, e]));
      const edges = loadEdges();
      const relatedTo = (id) => edges
        .filter((x) => x.a === id || x.b === id)
        .map((x) => {
          const other = byId.get(x.a === id ? x.b : x.a);
          if (!other) return "";
          const dir = x.a === id ? x.rel : `${x.rel} ←`;
          return `<li class="faith-notebook-edge">${esc(dir)} <a href="${esc(other.url)}">${esc(other.cite || other.title || "a passage")}</a></li>`;
        })
        .filter(Boolean)
        .join("");

      listEl.innerHTML = list.map((e) => `<article class="faith-notebook-item${linkFrom === e.id ? " is-linking" : ""}" data-nb-id="${esc(e.id)}">
          <p class="faith-notebook-cite">${esc(e.cite || e.title || "Passage")}</p>
          ${scope === "all" && e.title ? `<p class="faith-notebook-work">${esc(e.title)}</p>` : ""}
          <blockquote class="faith-notebook-text">${esc(e.text)}</blockquote>
          <textarea class="faith-notebook-input" data-nb-note placeholder="Note">${esc(e.note || "")}</textarea>
          ${relatedTo(e.id) ? `<ul class="faith-notebook-edges">${relatedTo(e.id)}</ul>` : ""}
          ${linkFrom && linkFrom !== e.id ? `<div class="faith-notebook-relate">
            <select class="faith-notebook-rel" data-nb-rel>${RELATIONS.map((r) => `<option value="${r}">${r}</option>`).join("")}</select>
            <button type="button" class="faith-notebook-act" data-nb-rel-go>Relate to selected</button>
          </div>` : ""}
          <div class="faith-notebook-row">
            <a class="faith-notebook-act" href="${esc(e.url)}">Go to</a>
            <button type="button" class="faith-notebook-act" data-nb-copy-one>Copy</button>
            <button type="button" class="faith-notebook-act" data-nb-link>${linkFrom === e.id ? "Cancel" : "Relate"}</button>
            <button type="button" class="faith-notebook-act faith-notebook-act--quiet" data-nb-remove>Remove</button>
          </div>
        </article>`).join("");
    }

    function open(on) {
      panel.hidden = !on;
      toggle.setAttribute("aria-pressed", on ? "true" : "false");
      document.body.classList.toggle("faith-notebook-open", on);
      if (on) render();
    }

    toggle.addEventListener("click", () => open(panel.hidden));
    panel.querySelector("[data-nb-close]").addEventListener("click", () => open(false));

    panel.querySelectorAll("[data-nb-scope]").forEach((b) => {
      b.addEventListener("click", () => {
        scope = b.getAttribute("data-nb-scope");
        panel.querySelectorAll("[data-nb-scope]").forEach((x) => {
          x.classList.toggle("is-active", x === b);
        });
        render();
      });
    });

    panel.addEventListener("click", (e) => {
      const item = e.target.closest("[data-nb-id]");
      if (!item) return;
      const id = item.getAttribute("data-nb-id");
      const entry = load().filter((x) => x.id === id)[0];
      if (e.target.closest("[data-nb-remove]")) {
        // The store drops the entry's relations with it — a dangling
        // edge is an invisible row that still counts against the cap
        // and still rides into any constellation shared afterwards.
        remove(id);
        render();
        return;
      }
      if (e.target.closest("[data-nb-link]")) {
        linkFrom = linkFrom === id ? "" : id;
        render();
        return;
      }
      if (e.target.closest("[data-nb-rel-go]")) {
        const sel = item.querySelector("[data-nb-rel]");
        const rel = sel ? sel.value : "parallels";
        if (linkFrom && linkFrom !== id) {
          const edges = loadEdges();
          const dupe = edges.some((x) => x.a === linkFrom && x.b === id && x.rel === rel);
          if (!dupe) edges.push({ a: linkFrom, b: id, rel });
          saveEdges(edges);
        }
        linkFrom = "";
        render();
        return;
      }
      if (e.target.closest("[data-nb-copy-one]") && entry) {
        copyText(formatEntry(entry)).then((ok) => {
          e.target.textContent = ok ? "Copied" : "Copy failed";
          window.setTimeout(() => { e.target.textContent = "Copy"; }, 1200);
        });
      }
    });

    panel.addEventListener("change", (e) => {
      const field = e.target.closest("[data-nb-note]");
      if (!field) return;
      const item = field.closest("[data-nb-id]");
      const id = item && item.getAttribute("data-nb-id");
      const list = load();
      const hit = list.filter((x) => x.id === id)[0];
      if (!hit) return;
      hit.note = field.value.slice(0, 2000);
      save(list);
    });

    panel.querySelector("[data-nb-copy]").addEventListener("click", (e) => {
      const text = entries().map(formatEntry).join("\n\n");
      if (!text) return;
      copyText(text).then((ok) => {
        e.target.textContent = ok ? "Copied" : "Copy failed";
        window.setTimeout(() => { e.target.textContent = "Copy all"; }, 1200);
      });
    });

    panel.querySelector("[data-nb-download]").addEventListener("click", () => {
      const text = entries().map(formatEntry).join("\n\n");
      if (!text) return;
      const blob = new Blob([`${text}\n`], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(titleOf() || "notebook").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    panel.querySelector("[data-nb-share]").addEventListener("click", (e) => {
      const list = entries();
      if (!list.length) return;
      const hash = encodeShare(list, loadEdges(), titleOf() || "Notebook");
      // Land the reader inside a work rather than on the tab strip:
      // the notebook lives in the reader, and so does the import.
      const first = list[0];
      const url = window.location.origin +
        (first && first.url ? first.url.split("#")[0].replace(window.location.origin, "") : "/the-faith-received/reader/") +
        hash;
      copyText(url).then((ok) => {
        e.target.textContent = ok ? "Link copied" : "Copy failed";
        window.setTimeout(() => { e.target.textContent = "Share"; }, 1600);
      });
    });

    return { render, open };
  }

  // ── Opening someone else's constellation ──────────────────────

  function buildImport(notebook) {
    const shared = decodeShare(window.location.hash);
    if (!shared || !shared.items.length) return;

    const parsed = shared.items.map(fromTuple).filter(Boolean);
    if (!parsed.length) return;

    const banner = document.createElement("div");
    banner.className = "faith-shared";
    banner.innerHTML =
      `<p class="faith-shared-lead"><em>${esc(shared.name)}</em> &mdash; ` +
      `${parsed.length} passage${parsed.length === 1 ? "" : "s"}` +
      `${shared.edges.length ? `, ${shared.edges.length} relation${shared.edges.length === 1 ? "" : "s"}` : ""}, ` +
      `shared with you.</p>` +
      `<ul class="faith-shared-list">${parsed.map((p) => (
        `<li><a href="${esc(p.pending ? "#" : readerUrl(p))}"${p.pending ? ` data-nb-resolve="${esc(p.pending)}"` : ""}>` +
        `${esc(p.cite || p.pending || p.work)}</a>${p.note ? ` &mdash; ${esc(p.note)}` : ""}</li>`
      )).join("")}</ul>` +
      `<button type="button" class="faith-notebook-act" data-shared-add>Add to my notebook</button>`;
    const host = document.querySelector("[data-faith-controls]");
    if (host && host.parentNode) host.parentNode.insertBefore(banner, host);

    // Patrologia Graeca arrives addressed by volume and column, which
    // is not how we address it — but it is exactly what the citation
    // resolver takes.
    if (window.MOResolve) {
      banner.querySelectorAll("[data-nb-resolve]").forEach((a) => {
        const cite = a.getAttribute("data-nb-resolve");
        const p = window.MOResolve.parse(cite);
        if (!p) return;
        window.MOResolve.resolve(p).then((hit) => {
          if (hit && hit.url) a.setAttribute("href", hit.url);
        });
      });
    }

    banner.querySelector("[data-shared-add]").addEventListener("click", (e) => {
      const base = load();
      const ids = [];
      parsed.forEach((p, i) => {
        const id = `s${Date.now().toString(36)}${i}`;
        ids.push(id);
        base.unshift({
          id,
          corpus: p.corpus,
          work: p.work,
          title: shared.name,
          author: "",
          cite: p.cite,
          anchor: p.anchor,
          url: readerUrl(p),
          text: p.note || p.cite || "",
          note: p.note || "",
          at: new Date().toISOString().slice(0, 10),
        });
      });
      save(base);
      const edges = loadEdges();
      shared.edges.forEach((t) => {
        const a = ids[t[0]];
        const b = ids[t[1]];
        if (a && b) edges.push({ a, b, rel: String(t[2] || "parallels").slice(0, 24) });
      });
      saveEdges(edges);
      notebook.render();
      notebook.open(true);
      e.target.textContent = "Added";
      e.target.disabled = true;
    });
  }

  // ── Selection → save ──────────────────────────────────────────

  function buildSelectionSave(notebook) {
    const pop = document.createElement("button");
    pop.type = "button";
    pop.className = "faith-save-pop";
    pop.hidden = true;
    pop.textContent = "Save to notebook";
    document.body.appendChild(pop);

    let pending = null;

    function hide() { pop.hidden = true; pending = null; }

    document.addEventListener("selectionchange", () => {
      // Only hide on an empty selection; the popover has to survive
      // the mouseup that produced it.
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) hide();
    });

    contentEl.addEventListener("mouseup", () => {
      window.setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) return hide();
        const range = sel.getRangeAt(0);
        if (!contentEl.contains(range.commonAncestorContainer)) return hide();
        // The range, not the selection: Selection.toString() returns
        // empty when the document does not have focus, which is every
        // automated check of this feature and some real ones.
        const text = range.toString().trim();
        if (text.length < 4) return hide();

        const ctx = contextOf(range.startContainer);
        pending = {
          id: `n${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
          corpus: work.corpus,
          work: work.id,
          title: titleOf(),
          author: authorOf(),
          cite: ctx.cite,
          anchor: ctx.anchor,
          url: linkTo(ctx.anchor),
          text: text.length > 1200 ? `${text.slice(0, 1200)}…` : text,
          note: "",
          at: new Date().toISOString().slice(0, 10),
        };

        const r = range.getBoundingClientRect();
        pop.hidden = false;
        pop.style.top = `${Math.max(8, r.top + window.scrollY - 42)}px`;
        pop.style.left = `${Math.max(8, r.left + window.scrollX)}px`;
      }, 10);
    });

    pop.addEventListener("click", () => {
      if (!pending) return;
      add(pending);
      notebook.render();
      pop.textContent = "Saved";
      window.setTimeout(() => {
        pop.textContent = "Save to notebook";
        hide();
      }, 900);
    });
  }

  // ── Boot ──────────────────────────────────────────────────────
  //
  // Wait for the reader to render — the controls exist from the
  // template, but a work that fails to load should not offer tools
  // over an empty page.

  // Arrived from a search across a shelf: the word is in the URL, so
  // open Find with it rather than making the reader type it again.
  function findFromUrl(bar, open) {
    let q = "";
    try { q = new URLSearchParams(window.location.search).get("q") || ""; } catch (_) { return; }
    if (!q || q.length < 2) return;
    const input = bar.querySelector("input");
    const status = bar.querySelector("[data-find-status]");
    if (!input || !status) return;
    open(true);
    input.value = q;
    // After the sections render, or it searches an empty document. The
    // reader only hydrates what is open, so this finds what is there
    // and says how much was not — the same honesty Find already keeps.
    //
    // Then hold the position. A link from a search result usually
    // carries a page as well, to load the right section, and the page
    // lander goes on re-asserting itself as that section's text
    // arrives and moves the layout under it. Landing on the match and
    // then being dragged to the top of its page is the reader losing
    // the thing they clicked. Whoever writes last wins, so Find
    // writes last: the same trick landOnPage already uses on the
    // smooth-scroll that kept getting cancelled.
    const hold = () => {
      const mark = document.querySelector("mark.faith-find-hit.is-current")
        || document.querySelector("mark.faith-find-hit");
      if (mark) scrollToMark(mark, true);
    };
    window.setTimeout(() => {
      runFind(q, status);
      [400, 1200, 2400].forEach((t) => window.setTimeout(hold, t));
    }, 900);
  }

  function boot() {
    if (!contentEl.children.length) return false;
    buildFind();
    // Find is self-contained; the notebook is not. A reader whose page
    // failed to load the store gets Find rather than a broken panel,
    // and the console says which half is missing.
    if (!NB) {
      if (window.console) {
        window.console.warn(
          "faith-reader-tools: js/lib/faith-notebook-store.js did not load; notebook disabled"
        );
      }
      return true;
    }
    const notebook = buildNotebook();
    notebook.render();
    buildSelectionSave(notebook);
    buildImport(notebook);
    return true;
  }

  if (!boot()) {
    const obs = new MutationObserver(() => {
      if (boot()) obs.disconnect();
    });
    obs.observe(contentEl, { childList: true });
  }
})();
