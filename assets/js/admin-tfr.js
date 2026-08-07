/*
 * /admin/tfr/ — Faith Received engagement.
 *
 * Reads GET /stats on mo-tfr-events (Ghost staff only) via MOAuth.fetch,
 * which attaches the member bearer for allowlisted hosts. All rendering is
 * DOM-built rather than innerHTML: every string here is reader-supplied
 * (work ids, and search queries most of all), and a search box is exactly
 * the surface an XSS would arrive through.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-admin-tfr]");
  if (!root) return;

  const WORKER = (root.getAttribute("data-worker-url") || "").replace(/\/$/, "");
  if (!WORKER) return;

  const statusEl = root.querySelector("[data-tfr-status]");
  const rangeEl = root.querySelector("[data-tfr-range]");
  const totalsEl = root.querySelector("[data-tfr-totals]");

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString() : "0";
  }

  /* Horizontal bar rows — a table would out-precision the data. */
  function renderBars(mount, rows, opts) {
    const target = root.querySelector(mount);
    if (!target) return;
    target.textContent = "";

    if (!rows || !rows.length) {
      target.appendChild(el("p", "admin-tfr-empty", opts.empty || "Nothing yet."));
      return;
    }

    let max = 0;
    rows.forEach((r) => {
      const v = Number(r[opts.value]) || 0;
      if (v > max) max = v;
    });

    const list = el("ol", "admin-tfr-bars");
    rows.forEach((r) => {
      const v = Number(r[opts.value]) || 0;
      const li = el("li", "admin-tfr-bar-row");

      const label = el("span", "admin-tfr-bar-label", opts.label(r));
      // Labels ellipsize; without this the row's identity is unrecoverable.
      label.title = label.textContent;
      const bar = el("span", "admin-tfr-bar");
      const fill = el("span", "admin-tfr-bar-fill");
      // Width is the only thing derived from data, and it is clamped.
      fill.style.width = `${max > 0 ? Math.round((v / max) * 100) : 0}%`;
      bar.appendChild(fill);

      const value = el("span", "admin-tfr-bar-value", opts.suffix ? opts.suffix(r) : num(v));

      li.appendChild(label);
      li.appendChild(bar);
      li.appendChild(value);
      list.appendChild(li);
    });
    target.appendChild(list);
  }

  function renderTotals(t) {
    if (!totalsEl) return;
    totalsEl.textContent = "";
    totalsEl.hidden = false;

    [
      ["Events", t.events],
      ["Signed-in members", t.members],
      ["Anonymous events", t.anonymous],
    ].forEach((pair) => {
      const card = el("div", "admin-tfr-total");
      card.appendChild(el("span", "admin-tfr-total-value", num(pair[1])));
      card.appendChild(el("span", "admin-tfr-total-label", pair[0]));
      totalsEl.appendChild(card);
    });
  }

  function load(days) {
    setStatus("Loading…");
    const url = `${WORKER}/stats?days=${encodeURIComponent(days)}`;
    const go = window.MOAuth && window.MOAuth.fetch ? window.MOAuth.fetch(url) : fetch(url);

    go.then((r) => {
      if (r.status === 401 || r.status === 403) {
        setStatus("Staff access required.");
        return null;
      }
      if (!r.ok) throw new Error(`stats ${r.status}`);
      return r.json();
    })
      .then((d) => {
        if (!d) return;

        renderTotals(d.totals || {});

        renderBars("[data-tfr-zero]", d.zero_result_queries, {
          value: "n",
          label (r) {
            return r.query;
          },
          empty: "No failed searches in this window. Either the library is covering what people want, or nobody is searching.",
        });

        renderBars("[data-tfr-works]", d.works, {
          value: "opens",
          label (r) {
            return (r.author ? `${r.author} · ` : "") + (r.work_id || "unknown");
          },
          suffix (r) {
            return num(r.opens) + (r.members ? ` · ${num(r.members)} members` : "");
          },
          empty: "No reads recorded yet.",
        });

        renderBars("[data-tfr-depth]", d.depth, {
          value: "n",
          label (r) {
            return `${r.bucket} shard${r.bucket === "1" ? "" : "s"}`;
          },
          empty: "No depth data yet.",
        });

        renderBars("[data-tfr-corpora]", d.corpora, {
          value: "opens",
          label (r) {
            return r.corpus;
          },
          empty: "No collection data yet.",
        });

        renderBars("[data-tfr-features]", d.features, {
          value: "uses",
          label (r) {
            return r.feature;
          },
          suffix (r) {
            return num(r.uses) + (r.members ? ` · ${num(r.members)} members` : "");
          },
          empty: "No feature use recorded yet.",
        });

        renderBars("[data-tfr-queries]", d.queries, {
          value: "n",
          label (r) {
            return r.query;
          },
          empty: "No searches yet.",
        });

        setStatus(`Since ${d.since || "—"}.`);
      })
      .catch((err) => {
        setStatus("Could not load engagement data.");
        if (window.console) console.error("admin-tfr", err && err.message);
      });
  }

  if (rangeEl) {
    rangeEl.addEventListener("change", () => {
      load(rangeEl.value || "30");
    });
  }

  load(rangeEl ? rangeEl.value || "30" : "30");
})();
