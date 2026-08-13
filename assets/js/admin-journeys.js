/*
 * /admin/members/journeys/ — New Member Journeys.
 *
 * Renders the member_journeys tables written by
 * scripts/build-member-journeys.mjs. Three endpoints on mo-admin, all
 * JWT+staff: /journeys/summary (aggregates), /journeys/list (rows), and
 * /journeys/member?email= (one person's full cross-system timeline,
 * fetched only when a row is opened).
 *
 * Everything here is built with createElement and textContent, never
 * innerHTML. Member names and emails are reader-supplied strings that
 * travelled Ghost -> D1 -> here, and a name is exactly the field
 * someone would put a tag in.
 *
 * Loaded as a page-template script, so it runs BEFORE site.min.js and
 * cannot use anything that bundle defines. window.MOAuth comes from
 * admin-auth.js, which is a sibling <script> above it.
 */
(function () {
  const root = document.querySelector("[data-journeys]");
  if (!root) return;

  const WORKER = (root.getAttribute("data-worker-url") || "").replace(/\/+$/, "");

  const statusEl = root.querySelector("[data-jr-status]");
  const panelsEl = root.querySelector("[data-jr-panels]");
  const tableSection = root.querySelector("[data-jr-table-section]");
  const tbody = root.querySelector("[data-jr-tbody]");
  const countEl = root.querySelector("[data-jr-count]");
  const emptyEl = root.querySelector("[data-jr-empty]");
  const drawer = document.querySelector("[data-jr-drawer]");
  const drawerBody = drawer && drawer.querySelector("[data-jr-drawer-body]");
  const drawerSub = drawer && drawer.querySelector("[data-jr-drawer-sub]");

  let days = 30;
  let lastFocus = null;

  // ── helpers ───────────────────────────────────────────────────────

  function api(path) {
    if (!window.MOAuth) return Promise.reject(new Error("no-auth"));
    return window.MOAuth.fetch(WORKER + path).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.hidden = !msg;
  }

  // Dates are stored UTC. Staff read them against Central, which is what
  // the Ghost admin shows, so render local and keep it unambiguous.
  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function fmtDuration(row) {
    if (row.minutes_to_convert !== null && row.minutes_to_convert !== undefined && row.minutes_to_convert < 1440) {
      return `${row.minutes_to_convert} min`;
    }
    if (row.days_since_first_seen !== null && row.days_since_first_seen !== undefined) {
      return `${row.days_since_first_seen} d`;
    }
    return "—";
  }

  function renderRanked(container, rows, keyName) {
    if (!container) return;
    container.textContent = "";
    const max = rows.reduce((m, r) => Math.max(m, r.n || 0), 0) || 1;
    if (!rows.length) {
      container.appendChild(el("li", "admin-ranked-item", "No data yet"));
      return;
    }
    rows.forEach((r) => {
      const li = el("li", "admin-ranked-item");
      const bar = el("div", "admin-ranked-bar");
      bar.style.width = `${Math.round(((r.n || 0) / max) * 100)}%`;
      li.appendChild(bar);
      li.appendChild(el("span", "admin-ranked-label", r[keyName] || "unknown"));
      li.appendChild(el("span", "admin-ranked-value", r.n));
      container.appendChild(li);
    });
  }

  // ── summary ───────────────────────────────────────────────────────

  function renderSummary(data) {
    const t = data.totals || {};
    const set = (key, value) => {
      const node = root.querySelector(`[data-stat="${key}"]`);
      if (node) node.textContent = value;
    };
    const n = t.members || 0;
    set("members", n);
    set("same_day", n ? `${t.same_day || 0} of ${n}` : "—");
    set("avg_days", t.avg_days_to_convert === null || t.avg_days_to_convert === undefined
      ? "—" : Math.round(t.avg_days_to_convert));
    set("abandoned", t.abandoned || 0);
    set("silent", t.silent || 0);
    set("churned", t.churned || 0);

    renderRanked(root.querySelector("[data-jr-surfaces]"), data.by_surface || [], "surface");
    renderRanked(root.querySelector("[data-jr-firstseen]"), data.by_first_seen || [], "system");
    if (panelsEl) panelsEl.hidden = false;
  }

  // ── member table ──────────────────────────────────────────────────

  function renderRows(members) {
    if (!tbody) return;
    tbody.textContent = "";

    members.forEach((m) => {
      const tr = document.createElement("tr");

      const who = document.createElement("td");
      who.appendChild(el("span", "jr-name", m.name || m.email));
      who.appendChild(el("span", "jr-email", m.email));
      if (m.duplicate_record) who.appendChild(el("span", "jr-flag jr-flag--warn", "duplicate"));
      if (m.legacy_match === "name-inferred") who.appendChild(el("span", "jr-flag", "legacy (inferred)"));
      else if (m.legacy_match === "email") who.appendChild(el("span", "jr-flag", "legacy"));
      tr.appendChild(who);

      tr.appendChild(el("td", null, fmtDate(m.converted_at)));
      tr.appendChild(el("td", null, m.is_comped ? "comped" : (m.plan || "—")));
      tr.appendChild(el("td", null, m.first_seen_system || "—"));
      tr.appendChild(el("td", null, fmtDuration(m)));

      const surface = document.createElement("td");
      surface.appendChild(el("span", "jr-surface", m.conversion_surface || "unrecorded"));
      if (m.abandoned_checkouts > 0) {
        surface.appendChild(el("span", "jr-flag jr-flag--warn", `${m.abandoned_checkouts} abandoned`));
      }
      tr.appendChild(surface);

      const d7 = document.createElement("td");
      const silent = !m.d7_essays_read;
      d7.appendChild(el("span", silent ? "jr-d7 jr-d7--silent" : "jr-d7",
        `${m.d7_essays_read || 0} read · ${m.d7_days_active || 0}d active`));
      if (!m.d7_window_complete) d7.appendChild(el("span", "jr-flag", "partial"));
      if (!m.d7_still_active) d7.appendChild(el("span", "jr-flag jr-flag--warn", "churned"));
      tr.appendChild(d7);

      const actions = document.createElement("td");
      const btn = el("button", "btn btn-ghost btn-sm", "Journey");
      btn.type = "button";
      btn.addEventListener("click", () => openDrawer(m));
      actions.appendChild(btn);
      tr.appendChild(actions);

      tbody.appendChild(tr);
    });

    if (countEl) countEl.textContent = `${members.length} member${members.length === 1 ? "" : "s"}`;
    if (tableSection) tableSection.hidden = false;
  }

  // ── timeline drawer ───────────────────────────────────────────────

  const PHASE_LABEL = { pre: "Before paying", d7: "First 7 days", post: "Later" };

  function openDrawer(m) {
    if (!drawer) return;
    lastFocus = document.activeElement;
    drawer.hidden = false;
    document.body.style.overflow = "hidden";
    if (drawerSub) drawerSub.textContent = `${m.name || m.email} · ${m.email}`;
    if (drawerBody) {
      drawerBody.textContent = "";
      drawerBody.appendChild(el("p", "admin-table-status", "Loading timeline…"));
    }
    const closeBtn = drawer.querySelector("button[data-jr-drawer-close]");
    if (closeBtn) closeBtn.focus();

    api(`/journeys/member?email=${encodeURIComponent(m.email)}`)
      .then((data) => renderTimeline(data, m))
      .catch((err) => {
        if (!drawerBody) return;
        drawerBody.textContent = "";
        drawerBody.appendChild(el("p", "admin-empty",
          err.message === "no-auth" ? "Not signed in." : `Could not load timeline (${err.message}).`));
      });
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function renderTimeline(data, m) {
    if (!drawerBody) return;
    drawerBody.textContent = "";

    const row = data.member || m;
    const facts = el("dl", "jr-facts");
    const fact = (label, value) => {
      facts.appendChild(el("dt", null, label));
      facts.appendChild(el("dd", null, value === null || value === undefined || value === "" ? "—" : String(value)));
    };
    fact("First trackable touch", `${fmtDateTime(row.first_seen_at)} (${row.first_seen_system || "unknown"})`);
    if (row.legacy_email) fact("Prior identity", `${row.legacy_email} (${row.legacy_match})`);
    if (row.legacy_first_url) fact("First page ever", row.legacy_first_url);
    fact("Signed up", `${fmtDateTime(row.signup_at)} · referrer ${row.signup_referrer_source || "unknown"}`);
    fact("Converted", `${fmtDateTime(row.converted_at)} · ${row.is_comped ? "comped" : (row.plan || "—")}`);
    fact("Converted on", `${row.conversion_surface || "unrecorded"}${row.conversion_page ? ` (${row.conversion_page})` : ""}`);
    if (row.abandoned_checkouts) fact("Abandoned", `${row.abandoned_checkouts} on ${row.abandoned_pages || "unknown"}`);
    if (row.d7_first_read_title) fact("First thing read", row.d7_first_read_title);
    if (row.notes) fact("Notes", row.notes);
    drawerBody.appendChild(facts);

    const events = data.events || [];
    if (!events.length) {
      drawerBody.appendChild(el("p", "admin-empty", "No events recorded."));
      return;
    }

    let currentPhase = null;
    const list = el("ol", "jr-timeline");
    events.forEach((e) => {
      if (e.phase !== currentPhase) {
        currentPhase = e.phase;
        const head = el("li", "jr-timeline-phase", PHASE_LABEL[e.phase] || e.phase);
        list.appendChild(head);
      }
      const li = el("li", "jr-timeline-item");
      li.appendChild(el("span", "jr-timeline-time", fmtDateTime(e.ts)));
      li.appendChild(el("span", `jr-timeline-system jr-timeline-system--${e.system}`, e.system));
      li.appendChild(el("span", "jr-timeline-type", e.type));
      const detail = summariseDetail(e.detail);
      if (detail) li.appendChild(el("span", "jr-timeline-detail", detail));
      list.appendChild(li);
    });
    drawerBody.appendChild(list);
  }

  // detail is a JSON blob written by the builder. Show the few keys
  // worth reading rather than dumping the object.
  function summariseDetail(raw) {
    if (!raw) return "";
    let obj;
    try { obj = JSON.parse(raw); } catch (_) { return ""; }
    if (!obj || typeof obj !== "object") return "";
    const parts = [];
    if (obj.page) parts.push(obj.page);
    if (obj.url) parts.push(obj.url);
    if (obj.referrer) parts.push(`via ${obj.referrer}`);
    if (obj.newsletter) parts.push(obj.newsletter);
    if (obj.event) parts.push(obj.event);
    if (typeof obj.amount === "number") parts.push(`$${(obj.amount / 100).toFixed(2)}`);
    return parts.join(" · ");
  }

  if (drawer) {
    drawer.querySelectorAll("[data-jr-drawer-close]").forEach((node) => {
      node.addEventListener("click", closeDrawer);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !drawer.hidden) closeDrawer();
    });
  }

  // ── load ──────────────────────────────────────────────────────────

  function load() {
    setStatus("Loading journeys…");
    if (emptyEl) emptyEl.hidden = true;

    Promise.all([
      api(`/journeys/summary?days=${days}`),
      api(`/journeys/list?days=${days}`),
    ]).then(([summary, list]) => {
      const members = list.members || [];
      setStatus("");
      if (!members.length) {
        if (panelsEl) panelsEl.hidden = true;
        if (tableSection) tableSection.hidden = true;
        if (emptyEl) emptyEl.hidden = false;
        return;
      }
      renderSummary(summary);
      renderRows(members);
    }).catch((err) => {
      setStatus(err.message === "no-auth"
        ? "Not signed in."
        : `Could not load journeys (${err.message}).`);
    });
  }

  root.querySelectorAll("[data-jr-days]").forEach((btn) => {
    btn.addEventListener("click", () => {
      root.querySelectorAll("[data-jr-days]").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      days = parseInt(btn.getAttribute("data-jr-days"), 10) || 30;
      load();
    });
  });

  load();
})();
