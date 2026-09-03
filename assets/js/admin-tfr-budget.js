/*
 * /admin/tfr/ — Ask spend & budget panel.
 *
 * Reads GET /admin/ask-usage on mo-tfr-library directly (Ghost staff
 * only, via window.MOAuth.fetch — same auth pattern admin-tfr.js
 * already uses for mo-tfr-events's /stats). A separate worker and a
 * separate concern from the rest of this page: everything else here
 * is reading engagement, this is reading spend against the $3.35/day
 * (~$100/month) budget lib/budget.js enforces on /v1/ask and the
 * paid-translation branch of /v1/dtc-translate — see that module's
 * header for why /v1/vsearch is not part of this number.
 *
 * All rendering is DOM-built rather than innerHTML, matching this
 * page's existing discipline (admin-tfr.js, admin-tfr-issues.js) even
 * though the data here comes from our own D1 ledger rather than
 * reader input — day strings and dollar amounts are trusted today,
 * but "trusted today" is not a reason to skip the pattern everywhere
 * else on this page follows.
 */
(function () {
  const root = document.querySelector("[data-tfr-budget]");
  if (!root) return;

  const WORKER = (root.getAttribute("data-worker-url") || "").replace(/\/$/, "");
  if (!WORKER) return;

  const totalsEl = root.querySelector("[data-tfr-budget-totals]");
  const trendEl = root.querySelector("[data-tfr-budget-trend]");

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }

  function usd(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "$0.00";
    return `$${n.toFixed(2)}`;
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString() : "0";
  }

  function renderTotals(d) {
    if (!totalsEl) return;
    totalsEl.textContent = "";
    totalsEl.hidden = false;

    const today = d.today || { spentUsd: 0, budgetUsd: 3.35, requestCount: 0 };
    const pct = today.budgetUsd > 0 ? Math.round((today.spentUsd / today.budgetUsd) * 100) : 0;

    [
      ["Spent today", usd(today.spentUsd)],
      ["Today's budget", usd(today.budgetUsd)],
      ["% of today's budget", `${pct}%`],
      ["Ask questions today", num(today.requestCount)],
      [`Unique members (last ${d.days || 30}d)`, num(d.uniqueAskMembers)],
    ].forEach((pair) => {
      const card = el("div", "admin-tfr-total");
      card.appendChild(el("span", "admin-tfr-total-value", pair[1]));
      card.appendChild(el("span", "admin-tfr-total-label", pair[0]));
      totalsEl.appendChild(card);
    });
  }

  // Horizontal bar rows, same shape as admin-tfr.js's renderBars() —
  // not shared code because that helper is scoped inside a different
  // file's closure, but deliberately the identical markup/classes so
  // the two panels read as one design.
  function renderTrend(rows) {
    if (!trendEl) return;
    trendEl.textContent = "";

    if (!rows || !rows.length) {
      trendEl.appendChild(el("p", "admin-tfr-empty", "No spend recorded yet."));
      return;
    }

    let max = 0;
    rows.forEach((r) => { if (r.budgetUsd > max) max = r.budgetUsd; if (r.spentUsd > max) max = r.spentUsd; });

    const list = el("ol", "admin-tfr-bars");
    rows.forEach((r) => {
      const li = el("li", "admin-tfr-bar-row");
      const overBudget = r.spentUsd >= r.budgetUsd;

      const label = el("span", "admin-tfr-bar-label", r.day);
      label.title = `${r.day} — ${usd(r.spentUsd)} of ${usd(r.budgetUsd)}, ${num(r.requestCount)} request${r.requestCount === 1 ? "" : "s"}`;

      const bar = el("span", "admin-tfr-bar");
      const fill = el("span", "admin-tfr-bar-fill");
      fill.style.width = `${max > 0 ? Math.min(100, Math.round((r.spentUsd / max) * 100)) : 0}%`;
      if (overBudget) fill.style.background = "var(--color-secondary)";
      bar.appendChild(fill);

      const value = el("span", "admin-tfr-bar-value", `${usd(r.spentUsd)} / ${usd(r.budgetUsd)}`);

      li.appendChild(label);
      li.appendChild(bar);
      li.appendChild(value);
      list.appendChild(li);
    });
    trendEl.appendChild(list);
  }

  function load() {
    const url = `${WORKER}/admin/ask-usage?days=30`;
    const go = window.MOAuth && window.MOAuth.fetch ? window.MOAuth.fetch(url) : fetch(url);

    go.then((r) => {
      if (r.status === 401 || r.status === 403) return null;
      if (!r.ok) throw new Error(`ask-usage ${r.status}`);
      return r.json();
    })
      .then((d) => {
        if (!d) return;
        renderTotals(d);
        renderTrend(d.daily);
      })
      .catch((err) => {
        if (window.console) console.error("admin-tfr-budget", err && err.message);
      });
  }

  load();
})();
