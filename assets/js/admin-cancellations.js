/*
 * /admin/members/cancellations/ — who left and why.
 *
 * Mirrors admin-journeys.js: three JWT+staff endpoints on mo-admin, a
 * sortable table, and a drawer that opens with the story in prose before
 * the timeline.
 *
 * Everything is built with createElement and textContent, never
 * innerHTML. Cancellation reasons in particular are free text a member
 * typed into Ghost Portal, which makes them exactly the field someone
 * could put markup in.
 *
 * Page-template script: runs BEFORE site.min.js, so it uses only
 * window.MOAuth from the admin-auth.js sibling above it.
 */
(function () {
  const root = document.querySelector("[data-cancellations]");
  if (!root) return;

  const WORKER = (root.getAttribute("data-worker-url") || "").replace(/\/+$/, "");
  const statusEl = root.querySelector("[data-cx-status]");
  const panelsEl = root.querySelector("[data-cx-panels]");
  const tableSection = root.querySelector("[data-cx-table-section]");
  const tbody = root.querySelector("[data-cx-tbody]");
  const countEl = root.querySelector("[data-cx-count]");
  const emptyEl = root.querySelector("[data-cx-empty]");
  const drawer = document.querySelector("[data-cx-drawer]");
  const drawerBody = drawer && drawer.querySelector("[data-cx-drawer-body]");
  const drawerSub = drawer && drawer.querySelector("[data-cx-drawer-sub]");

  let days = 90;
  let rows = [];
  let sortKey = "canceled_at";
  let sortDir = "desc";
  let lastFocus = null;

  function api(path, init) {
    if (!window.MOAuth) return Promise.reject(new Error("no-auth"));
    return window.MOAuth.fetch(WORKER + path, init).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
  }
  // POST so the member address never lands in a URL, log, or Referer.
  const fetchMember = (email) => api("/cancellations/member", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }),
  });

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function setStatus(m) { if (statusEl) { statusEl.textContent = m || ""; statusEl.hidden = !m; } }

  // Year always shown: these timelines span years and "Jun 3" alone has
  // already been misread once as the wrong year on the journeys page.
  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d) ? "—" : d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  function fmtTenure(d) {
    if (d === null || d === undefined) return "—";
    if (d >= 365) return `${(d / 365).toFixed(1)} yr`;
    if (d >= 60) return `${Math.round(d / 30)} mo`;
    return `${d} d`;
  }
  const money = (cents) => `$${((cents || 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  // ── summary ───────────────────────────────────────────────────────

  function renderSummary(data) {
    const t = data.totals || {};
    const set = (k, v) => { const n = root.querySelector(`[data-stat="${k}"]`); if (n) n.textContent = v; };
    const n = t.members || 0;
    set("members", n);
    set("arr_lost", money(t.arr_lost_cents));
    set("involuntary", t.involuntary || 0);
    set("gave_reason", n ? `${t.gave_reason || 0} of ${n}` : "—");
    set("never_read", t.never_read || 0);
    set("tenure", t.avg_tenure ? fmtTenure(Math.round(t.avg_tenure)) : "—");

    const caveats = [];
    if (n && (t.gave_reason || 0) < n) {
      caveats.push(`${n - (t.gave_reason || 0)} of ${n} left without giving a reason. Stripe's cancellation survey is switched off, so the only stated reasons are the ones Ghost Portal collected. Everything else here is inferred from behaviour.`);
    }
    if (t.dark_final_30) {
      caveats.push(`${t.dark_final_30} read nothing at all in their final 30 days. That is the strongest available signal of why, when nobody typed one.`);
    }
    if (t.refunded_cents) caveats.push(`${money(t.refunded_cents)} was refunded across this window.`);
    const cav = root.querySelector("[data-cx-caveats]");
    if (cav) {
      cav.textContent = "";
      caveats.forEach((c) => cav.appendChild(el("li", null, c)));
      cav.hidden = !caveats.length;
    }

    // Say what the real-churn filter removed.
    const ex = root.querySelector("[data-cx-excluded]");
    if (ex) {
      const other = (data.by_type || []).filter((r) => !["voluntary", "involuntary"].includes(r.type));
      if (!other.length) ex.hidden = true;
      else {
        const parts = other.map((r) => `${r.n} ${EXCLUDED[r.type] || r.type}`);
        ex.textContent = `Excluded: ${parts.join(", ")}. These cancelled a subscription but did not stop being members.`;
        ex.hidden = false;
      }
    }

    const reasons = root.querySelector("[data-cx-reasons]");
    if (reasons) {
      reasons.textContent = "";
      const list = data.reasons || [];
      if (!list.length) reasons.appendChild(el("li", "cx-reason", "Nobody gave a reason in this window."));
      list.forEach((r) => {
        const li = el("li", "cx-reason");
        li.appendChild(el("blockquote", "cx-reason-quote", r.reason));
        li.appendChild(el("span", "cx-reason-who",
          `${r.name || r.email} · stayed ${fmtTenure(r.tenure_days)} · ${r.reads_lifetime === null ? "reads unknown" : `${r.reads_lifetime} reads`}`));
        reasons.appendChild(li);
      });
    }

    const ten = root.querySelector("[data-cx-tenure]");
    if (ten) {
      ten.textContent = "";
      const list = data.by_tenure || [];
      const max = list.reduce((m, r) => Math.max(m, r.n || 0), 0) || 1;
      list.forEach((r) => {
        const li = el("li", "admin-ranked-item");
        const bar = el("div", "admin-ranked-bar");
        bar.style.width = `${Math.round((r.n / max) * 100)}%`;
        li.appendChild(bar);
        li.appendChild(el("span", "admin-ranked-label", r.bucket));
        li.appendChild(el("span", "admin-ranked-value", r.n));
        ten.appendChild(li);
      });
    }
    if (panelsEl) panelsEl.hidden = false;
  }

  const EXCLUDED = { migration: "billing migrations", "billing-change": "plan changes or duplicate cleanups" };

  // ── table ─────────────────────────────────────────────────────────

  function sortRows(list) {
    const dir = sortDir === "asc" ? 1 : -1;
    return list.slice().sort((a, b) => {
      const x = a[sortKey], y = b[sortKey];
      const xe = x === null || x === undefined || x === "";
      const ye = y === null || y === undefined || y === "";
      if (xe && ye) return 0;
      if (xe) return 1; // missing data sinks, in both directions
      if (ye) return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" }) * dir;
    });
  }

  function wireSorting() {
    root.querySelectorAll("[data-cx-sort]").forEach((th) => {
      const key = th.getAttribute("data-cx-sort");
      th.setAttribute("aria-sort", key === sortKey ? (sortDir === "asc" ? "ascending" : "descending") : "none");
      th.classList.toggle("is-sorted", key === sortKey);
      th.classList.toggle("is-desc", key === sortKey && sortDir === "desc");
      if (th.getAttribute("data-cx-wired")) return;
      th.setAttribute("data-cx-wired", "1");
      th.tabIndex = 0;
      const go = () => {
        if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
        else { sortKey = key; sortDir = th.getAttribute("data-cx-sort-default") || "asc"; }
        renderRows(rows);
      };
      th.addEventListener("click", go);
      th.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
  }

  function renderRows(list) {
    if (!tbody) return;
    rows = list;
    wireSorting();
    tbody.textContent = "";
    sortRows(list).forEach((m) => {
      const tr = document.createElement("tr");

      const who = document.createElement("td");
      who.appendChild(el("span", "jr-name", m.name || m.email));
      who.appendChild(el("span", "jr-email", m.email));
      if (m.involuntary) who.appendChild(el("span", "jr-flag jr-flag--warn", "card failed"));
      if (m.still_has_access) who.appendChild(el("span", "jr-flag", "access until period end"));
      if (m.refunded_cents) who.appendChild(el("span", "jr-flag jr-flag--warn", `refunded ${money(m.refunded_cents)}`));
      tr.appendChild(who);

      tr.appendChild(el("td", null, fmtDate(m.canceled_at)));
      tr.appendChild(el("td", null, m.plan || "—"));
      tr.appendChild(el("td", null, fmtTenure(m.tenure_days)));

      const reading = document.createElement("td");
      if (m.reads_lifetime === null || m.reads_lifetime === undefined) {
        reading.appendChild(el("span", "jr-d7", "unknown"));
      } else if (!m.ever_read) {
        reading.appendChild(el("span", "jr-d7 jr-d7--silent", "never read"));
      } else {
        reading.appendChild(el("span", "jr-d7", `${m.reads_lifetime} total · ${m.reads_last_30d ?? "?"} in final 30d`));
      }
      tr.appendChild(reading);

      const dark = el("td", null, m.days_dark_before_cancel === null || m.days_dark_before_cancel === undefined
        ? "—" : `${m.days_dark_before_cancel} d`);
      if ((m.days_dark_before_cancel || 0) >= 30) dark.className = "cx-dark";
      tr.appendChild(dark);

      tr.appendChild(el("td", null, money(m.annualized_value)));

      const act = document.createElement("td");
      const btn = el("button", "btn btn-ghost btn-sm", "Story");
      btn.type = "button";
      btn.addEventListener("click", () => openDrawer(m));
      act.appendChild(btn);
      tr.appendChild(act);
      tbody.appendChild(tr);
    });
    if (countEl) countEl.textContent = `${list.length} cancellation${list.length === 1 ? "" : "s"}`;
    if (tableSection) tableSection.hidden = false;
  }

  // ── drawer ────────────────────────────────────────────────────────

  const PHASE = { member: "While they were a member", "final-30": "Final 30 days", after: "After cancelling" };

  function openDrawer(m) {
    if (!drawer) return;
    lastFocus = document.activeElement;
    drawer.hidden = false;
    document.body.style.overflow = "hidden";
    if (drawerSub) drawerSub.textContent = `${m.name || m.email} · ${m.email}`;
    if (drawerBody) { drawerBody.textContent = ""; drawerBody.appendChild(el("p", "admin-table-status", "Loading…")); }
    const close = drawer.querySelector("button[data-cx-drawer-close]");
    if (close) close.focus();
    fetchMember(m.email).then((d) => renderStory(d, m)).catch((err) => {
      if (!drawerBody) return;
      drawerBody.textContent = "";
      drawerBody.appendChild(el("p", "admin-empty", err.message === "no-auth" ? "Not signed in." : `Could not load (${err.message}).`));
    });
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /*
   * The churn story in prose.
   *
   * Same discipline as the journeys narrative: every clause is driven by
   * a field and is dropped when the data is missing rather than hedged.
   * Where a member typed a reason it is quoted verbatim and leads,
   * because their words beat any inference. Where they did not, the
   * paragraph says so plainly instead of implying we know.
   */
  function narrate(row) {
    const s = [];
    const plan = (row.plan || "").toLowerCase();

    if (row.involuntary) {
      s.push(`Their card failed. This was not a decision to leave, and after ${fmtTenure(row.tenure_days)} as a member it is likely recoverable.`);
    } else {
      s.push(`Paid ${plan ? `on the ${plan} plan ` : ""}for ${fmtTenure(row.tenure_days)}${row.renewals ? `, renewing ${row.renewals} time${row.renewals === 1 ? "" : "s"}` : ""}.`);
    }

    if (row.reads_lifetime === null || row.reads_lifetime === undefined) {
      s.push("Their reading history could not be read, so engagement is unknown.");
    } else if (!row.ever_read) {
      s.push("Never read a single article while paying.");
    } else {
      const decay = row.reads_prior_30d > 0 && row.reads_last_30d === 0;
      s.push(`Read ${row.reads_lifetime} article${row.reads_lifetime === 1 ? "" : "s"} in total, ${row.reads_last_30d} of them in the final 30 days${decay ? `, down from ${row.reads_prior_30d} in the month before that` : ""}.`);
      if (row.last_read_title) s.push(`The last thing they read was "${row.last_read_title}".`);
    }

    if (row.days_dark_before_cancel !== null && row.days_dark_before_cancel >= 14) {
      s.push(`They had been silent for ${row.days_dark_before_cancel} days before cancelling.`);
    }

    if (row.emails_sent) {
      s.push(`Of ${row.emails_sent} emails, they opened ${row.emails_opened || 0} and clicked ${row.emails_clicked || 0}.`);
    }

    if (row.stated_reason) s.push(`Asked why, they said: "${row.stated_reason}"`);
    else if (!row.involuntary) s.push("They gave no reason.");

    if (row.refunded_cents) s.push(`${money(row.refunded_cents)} was refunded.`);
    if (row.still_has_access) s.push("They keep access until the end of the paid period.");
    return s.join(" ");
  }

  function renderStory(data, m) {
    if (!drawerBody) return;
    drawerBody.textContent = "";
    const row = data.member || m;

    drawerBody.appendChild(el("p", "jr-narrative", narrate(row)));

    const dl = el("dl", "jr-facts");
    const fact = (k, v) => { dl.appendChild(el("dt", null, k)); dl.appendChild(el("dd", null, v === null || v === undefined || v === "" ? "—" : String(v))); };
    fact("Became a member", fmtDateTime(row.became_paid_at));
    fact("Cancelled", fmtDateTime(row.canceled_at));
    if (row.ends_at) fact("Access ends", fmtDateTime(row.ends_at));
    fact("Stayed", fmtTenure(row.tenure_days));
    fact("ARR lost", money(row.annualized_value));
    fact("Churn type", row.churn_type);
    if (row.last_read_at) fact("Last read", `${fmtDateTime(row.last_read_at)}${row.last_read_title ? ` — ${row.last_read_title}` : ""}`);
    if (row.newsletters) fact("Newsletters", row.newsletters);
    if (row.stated_reason) fact("Stated reason", row.stated_reason);
    drawerBody.appendChild(dl);

    const events = data.events || [];
    if (!events.length) { drawerBody.appendChild(el("p", "admin-empty", "No events recorded.")); return; }

    let phase = null;
    const ol = el("ol", "jr-timeline");
    events.forEach((e) => {
      const d = describe(e);
      if (!d) return;
      if (e.phase !== phase) { phase = e.phase; ol.appendChild(el("li", "jr-timeline-phase", PHASE[e.phase] || e.phase)); }
      const li = el("li", "jr-timeline-item");
      li.appendChild(el("span", "jr-timeline-time", fmtDateTime(e.ts)));
      li.appendChild(el("span", "jr-timeline-what", d.label));
      if (d.detail) li.appendChild(el("span", "jr-timeline-detail", d.detail));
      ol.appendChild(li);
    });
    drawerBody.appendChild(ol);
  }

  function describe(e) {
    let d = {};
    try { d = e.detail ? JSON.parse(e.detail) : {}; } catch (_) { d = {}; }
    const t = e.type;
    if (t === "read_completed") return { label: "Read", detail: d.title || d.postId || "" };
    if (t === "login") return { label: "Signed in", detail: "" };
    if (t === "signup") return { label: "Signed up", detail: d.url || "" };
    if (t === "payment") return { label: "Paid", detail: d.amount ? money(d.amount) : "" };
    if (t === "invoice_paid") return { label: "Renewed", detail: d.amount ? money(d.amount) : "" };
    if (t === "canceled") return { label: "Cancelled", detail: d.reason || "" };
    if (t === "subscription_created") return { label: "Started paid membership", detail: "" };
    if (t === "subscription_canceled") return { label: "Subscription cancelled", detail: "" };
    if (t === "newsletter") return { label: "Newsletter change", detail: d.newsletter || "" };
    if (t === "email_last_opened") return { label: "Most recent email open", detail: "" };
    if (t === "saw_offer") return { label: "Saw the offer", detail: d.surface || "" };
    if (t === "comment") return { label: "Commented", detail: "" };
    if (t.startsWith("tag:")) {
      const tag = t.slice(4);
      if (tag.startsWith("topic-audio:")) return { label: "Played audio", detail: tag.slice(12) };
      if (tag.startsWith("Newsletter:")) return { label: "Joined", detail: tag.slice(11) };
      return null; // bookkeeping tags add nothing to a churn story
    }
    return null;
  }

  if (drawer) {
    drawer.querySelectorAll("[data-cx-drawer-close]").forEach((n) => n.addEventListener("click", closeDrawer));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !drawer.hidden) closeDrawer(); });
  }

  function load() {
    setStatus("Loading cancellations…");
    if (emptyEl) emptyEl.hidden = true;
    Promise.all([api(`/cancellations/summary?days=${days}`), api(`/cancellations/list?days=${days}`)])
      .then(([summary, list]) => {
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
      })
      .catch((err) => setStatus(err.message === "no-auth" ? "Not signed in." : `Could not load (${err.message}).`));
  }

  root.querySelectorAll("[data-cx-days]").forEach((b) => {
    b.addEventListener("click", () => {
      root.querySelectorAll("[data-cx-days]").forEach((x) => x.classList.remove("is-active"));
      b.classList.add("is-active");
      days = parseInt(b.getAttribute("data-cx-days"), 10) || 90;
      load();
    });
  });

  load();
})();
