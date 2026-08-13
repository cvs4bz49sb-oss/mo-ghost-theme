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

  function api(path, init) {
    if (!window.MOAuth) return Promise.reject(new Error("no-auth"));
    return window.MOAuth.fetch(WORKER + path, init).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
  }

  // A member address never goes in a query string — it would leak into
  // logs and Referer headers. The lookup is a POST with the subject in
  // the body; the JWT still identifies the staff member making it.
  function fetchMember(email) {
    return api("/journeys/member", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
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

  // The year is not optional. These timelines routinely open in 2022 and
  // close this week, and without it "Jun 3" on a HubSpot signup reads as
  // this June — i.e. after the May 2026 switchover, which would be
  // impossible. Dropping the year turned real 2025 history into an
  // apparent data corruption.
  function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
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
    set("opened_before", n ? `${t.opened_before || 0} of ${n}` : "—");
    set("abandoned", t.abandoned || 0);
    set("silent", t.silent || 0);
    set("churned", t.churned || 0);

    /*
     * Caveats live here, not in the tiles.
     *
     * The first version wrote "11 of 18 (+11 unsplittable)" into a stat
     * value. It wrapped to three lines, broke the tile heights, leaked
     * the word "unsplittable" into the UI, and read as though 11 + 11
     * exceeded the 18 it was counting. A stat value has to be a short
     * token; anything qualifying it belongs in prose underneath.
     */
    const caveats = [];
    if (t.pre_conv_unknown) {
      caveats.push(`${t.pre_conv_unknown} more had email history before paying, but Kit reports opens as a lifetime total only, so those cannot be split at the conversion date. The count above is a floor.`);
    }
    if (t.partial_windows) {
      caveats.push(`${t.partial_windows} of these converted less than seven days ago, so their reading figures are still filling in. "Read nothing yet" is not final for them.`);
    }
    const cavEl = root.querySelector("[data-jr-caveats]");
    if (cavEl) {
      cavEl.textContent = "";
      caveats.forEach((c) => cavEl.appendChild(el("li", null, c)));
      cavEl.hidden = !caveats.length;
    }

    renderRanked(root.querySelector("[data-jr-surfaces]"), data.by_surface || [], "surface");
    renderRanked(root.querySelector("[data-jr-firstseen]"), data.by_first_seen || [], "system");
    if (panelsEl) panelsEl.hidden = false;

    // Say what was filtered out. Without this the headline number just
    // looks smaller than Ghost's and nobody can tell why.
    const excludedEl = root.querySelector("[data-jr-excluded]");
    if (excludedEl) {
      const rows = data.excluded || [];
      if (!rows.length) {
        excludedEl.hidden = true;
      } else {
        const parts = rows.map((r) => `${r.n} ${EXCLUDED_LABEL[r.type] || r.type}`);
        excludedEl.textContent = `Excluded from this view: ${parts.join(", ")}. These are existing paid relationships moving into Ghost, not new members.`;
        excludedEl.hidden = false;
      }
    }
  }

  const EXCLUDED_LABEL = {
    migration: "HubSpot billing migrations",
    substack: "Substack subscribers comped on Ghost",
    lifetime: "lifetime members",
  };

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

    fetchMember(m.email)
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
    // The number Ian actually wants: engagement BEFORE they paid.
    // Kit has no date-bounded figure, so say which basis this rests on
    // rather than presenting a derived number as a measured one.
    const preParts = [];
    if (row.pre_conv_basis === "partial") {
      preParts.push("not split by Kit — they opened email after converting too");
    } else if (row.pre_conv_basis === "none") {
      preParts.push("no email relationship before they paid");
    } else if (row.pre_conv_emails_opened !== null && row.pre_conv_emails_opened !== undefined) {
      preParts.push(`${row.pre_conv_emails_opened} opened, ${row.pre_conv_emails_clicked ?? 0} clicked (Kit)`);
    }
    if (row.pre_conv_hubspot_opens) {
      preParts.push(`${row.pre_conv_hubspot_opens} opened, ${row.pre_conv_hubspot_clicks || 0} clicked (HubSpot era)`);
    }
    if (preParts.length) fact("Email before converting", preParts.join(" · "));

    if (row.kit_emails_sent) {
      // Lifetime, not windowed — Kit does not expose a date-bounded
      // figure. Say so, because for anyone whose Kit record predates
      // conversion this spans their whole free-subscriber history.
      fact("Emails (lifetime)", `${row.kit_emails_opened || 0} opened / ${row.kit_emails_sent} sent · ${row.kit_emails_clicked || 0} clicked${row.kit_record_predates_conv ? " — spans their free-subscriber history" : ""}`);
    }
    if (row.d7_first_read_title) fact("First thing read", row.d7_first_read_title);
    if (row.notes) fact("Notes", row.notes);
    drawerBody.appendChild(facts);

    const events = data.events || [];
    if (!events.length) {
      drawerBody.appendChild(el("p", "admin-empty", "No events recorded."));
      return;
    }

    const shown = events.map(describe).filter(Boolean);
    const behaviour = shown.filter((x) => !x.system);
    const showAll = drawer.hasAttribute("data-jr-show-all");
    const visible = showAll ? shown : behaviour;

    let currentPhase = null;
    const list = el("ol", "jr-timeline");
    visible.forEach((x) => {
      if (x.phase !== currentPhase) {
        currentPhase = x.phase;
        list.appendChild(el("li", "jr-timeline-phase", PHASE_LABEL[x.phase] || x.phase));
      }
      const li = el("li", `jr-timeline-item${x.system ? " jr-timeline-item--system" : ""}`);
      li.appendChild(el("span", "jr-timeline-time", fmtDateTime(x.ts)));
      li.appendChild(el("span", "jr-timeline-what", x.label));
      if (x.url && x.link) {
        const wrap = el("span", "jr-timeline-detail");
        const a = el("a", null, x.detail || x.url);
        a.href = x.url;
        a.target = "_blank";
        a.rel = "noopener";
        wrap.appendChild(a);
        if (x.suffix) wrap.appendChild(el("span", "jr-timeline-suffix", ` ${x.suffix}`));
        li.appendChild(wrap);
      } else if (x.detail) {
        li.appendChild(el("span", "jr-timeline-detail", x.detail));
      }
      list.appendChild(li);
    });
    drawerBody.appendChild(list);

    const hidden = shown.length - behaviour.length;
    if (hidden > 0) {
      const toggle = el("button", "btn btn-ghost btn-sm jr-timeline-toggle",
        showAll ? "Hide system events" : `Show ${hidden} system events`);
      toggle.type = "button";
      toggle.addEventListener("click", () => {
        if (showAll) drawer.removeAttribute("data-jr-show-all");
        else drawer.setAttribute("data-jr-show-all", "");
        renderTimeline(data, m);
      });
      drawerBody.appendChild(toggle);
    }
  }

  /*
   * Turn a stored event into something that reads like behaviour.
   *
   * The first version of this printed the raw type and a JSON summary,
   * so a timeline read "read_completed" fourteen times without ever
   * naming an article, buried in "tag:ghost-member" and
   * "kit_record_created". Those are bookkeeping, not behaviour: they
   * are marked system:true and hidden behind a toggle.
   *
   * Returns null for events not worth a row at all.
   */
  function describe(e) {
    let d = {};
    try { d = e.detail ? JSON.parse(e.detail) : {}; } catch (_) { d = {}; }
    const base = { ts: e.ts, phase: e.phase };
    const t = e.type;

    if (t === "read_completed") {
      return { ...base, label: "Read", detail: d.title || d.postId, url: d.url, link: !!d.url,
        suffix: d.visibility && d.visibility !== "public" ? `(${d.visibility})` : "" };
    }
    if (t === "clicked_upgrade") {
      return { ...base, label: "Clicked", detail: `${buttonName(d.href)} on ${surfaceName(d.surface, d.path)}` };
    }
    if (t === "saw_offer") {
      return { ...base, label: "Saw the offer", detail: `on ${surfaceName(d.surface, d.path)}${d.via === "inline" ? " (scrolled to it)" : ""}` };
    }
    if (t === "checkout_completed") {
      return { ...base, label: "Completed checkout", detail: `${d.page || "unknown page"}${d.amount ? ` · $${(d.amount / 100).toFixed(2)}` : ""}` };
    }
    if (t === "checkout_abandoned") {
      return { ...base, label: "Abandoned checkout", detail: d.page || "unknown page" };
    }
    if (t === "signup") {
      return { ...base, label: "Signed up (free)", detail: [d.url, d.referrer && `via ${d.referrer}`].filter(Boolean).join(" · ") };
    }
    if (t === "login") return { ...base, label: "Signed in", detail: "" };
    if (t === "payment") return { ...base, label: "Paid", detail: d.amount ? `$${(d.amount / 100).toFixed(2)}` : "" };
    if (t === "subscription_created") return { ...base, label: "Started paid membership", detail: "" };
    if (t === "subscription_canceled") return { ...base, label: "Cancelled", detail: "" };
    if (t === "subscription_expired") return { ...base, label: "Subscription expired", detail: "" };
    if (t === "first_visit") return { ...base, label: "First ever visit", detail: d.url || "", url: d.url, link: !!d.url };
    if (t === "free_subscription") return { ...base, label: "Subscribed free (HubSpot)", detail: d.event || "" };
    // Not a visit — an imported or API-created contact record.
    // Dated HubSpot-era engagement. Labelled "last" because HubSpot only
    // exposes the most recent one without the marketing.email.read scope.
    if (t === "hubspot_email_open") {
      return { ...base, label: "Last email open (HubSpot)",
        detail: d.total ? `${d.total} opens in the HubSpot era` : "" };
    }
    if (t === "hubspot_email_click") {
      return { ...base, label: "Clicked an email (HubSpot)",
        detail: [d.email, d.total ? `${d.total} clicks total` : ""].filter(Boolean).join(" · ") };
    }
    if (t === "hubspot_last_visit") {
      return { ...base, label: "Last visit (HubSpot)",
        detail: [d.visits ? `${d.visits} visits` : "", d.views ? `${d.views} page views` : ""].filter(Boolean).join(" · ") };
    }
    if (t === "hubspot_record_created") {
      return { ...base, label: "HubSpot record created", detail: `no visit recorded · source ${d.source || "unknown"}`, system: true };
    }
    if (t === "newsletter_subscribed") return { ...base, label: "Joined newsletter", detail: d.newsletter || "" };
    if (t === "comment") return { ...base, label: "Commented", detail: "" };
    // Kit has no per-email open event, so these two timestamps are the
    // only dated email engagement that exists. Labelled "most recent" so
    // nobody reads them as "the only time they opened an email".
    if (t === "email_last_opened") {
      return { ...base, label: "Most recent email open",
        detail: d.opened ? `${d.opened} of ${d.sent} opened, lifetime` : "" };
    }
    if (t === "email_last_clicked") {
      return { ...base, label: "Most recent email click",
        detail: d.clicked ? `${d.clicked} clicked, lifetime` : "" };
    }

    if (t.startsWith("tag:")) {
      const tag = t.slice(4);
      if (tag.startsWith("Newsletter:")) return { ...base, label: "Joined", detail: tag.slice(11) };
      if (tag.startsWith("topic-audio:")) return { ...base, label: "Played audio", detail: tag.slice(12) };
      if (tag === "Address:Known") return { ...base, label: "Gave shipping address", detail: "" };
      if (tag === "used:comments") return { ...base, label: "Commented", detail: "" };
      if (tag === "used:gift-link") return { ...base, label: "Sent a gift link", detail: "" };
      // Everything else is bookkeeping: ghost-member, ghost-status-*,
      // source:*, tier:*, Upgraded, topic-read:* (duplicates the read
      // event above it), top-topic:*, offer-seen:* / upgrade-from:*
      // (duplicate the saw_offer / clicked_upgrade rows).
      return { ...base, label: tag, detail: "", system: true };
    }

    // Stripe/Kit plumbing with no behavioural meaning.
    if (["customer_created", "kit_record_created"].includes(t) || t.startsWith("invoice_")) {
      return { ...base, label: t.replace(/_/g, " "), detail: "", system: true };
    }
    return { ...base, label: t.replace(/_/g, " "), detail: "", system: true };
  }

  // The href tells you which control was clicked. Portal signup is the
  // buy button inside the pricing block; a /membership/ link is the
  // "Become a Member" nav/CTA that only navigates.
  function buttonName(href) {
    if (!href) return "upgrade";
    if (/portal\/signup/.test(href)) return "the buy button";
    if (/portal\/offers/.test(href)) return "an offer link";
    if (/stripe\.com/.test(href)) return "a Stripe checkout link";
    if (/^\/membership\/?$/.test(href)) return "Become a Member";
    return href;
  }

  function surfaceName(surface, path) {
    const names = {
      home: "the homepage", article: "an article", membership: "the membership page",
      about: "the about page", groups: "the groups page", institutions: "the institutions page",
      gift: "the gift page", offer: "an offer page", other: "another page",
    };
    return names[surface] || path || "an unknown page";
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
