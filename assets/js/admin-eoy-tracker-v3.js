/*
 * Year-end campaign tracker on /admin/slide-ins/ (Ian, 2026-11-13): the
 * bottom bar, /year-end/ itself, and what all of it
 * raised. Reads mo-admin GET /eoy/stats (admin/lib/eoy-stats.js), which
 * returns raw daily rows; everything is added up here.
 *
 * Conversions are counted from the money (Stripe and Anedot webhooks,
 * Ghost's offer redemptions), never from the browser. Each one carries the
 * source the reader came from: bar-a, bar-b, email, page, or none when the
 * payment did not pass through /year-end/.
 *
 * Every value goes into the page with textContent.
 */
(function () {
  const host = document.querySelector("[data-eoy-tracker]");
  if (!host) return;
  const workerUrl = (host.getAttribute("data-worker-url") || "").replace(/\/+$/, "");
  const out = host.querySelector("[data-eoy-out]");
  const asOf = host.querySelector("[data-eoy-asof]");
  const refresh = host.querySelector("[data-eoy-refresh]");

  // The bar's headline A/B test ended 2026-11-20 (Ian). Every reader now
  // sends "a" / "bar-a"; rows from the test's "b" side are added in, so
  // "Bar" is the whole bar from Nov 13 on. The -v2 file name is a
  // cache-buster.
  const BAR_SRCS = ["bar-a", "bar-b"];
  // Support menu and dashboard card sources added 2026-11-20 (the -v3
  // file name is a cache-buster). Gifts there are credited even when the
  // reader went straight to a checkout without opening /year-end/.
  const SOURCES = [
    ["bar", "Bottom bar"], ["menu", "Support menu"], ["dash", "Dashboard card"],
    ["email", "Email"], ["page", "Other visits"], ["none", "Did not visit /year-end/"],
  ];
  const SHORT = { bar: "Bar", menu: "Menu", dash: "Dashboard", email: "Email", page: "Other", none: "No visit" };
  const LINKS = [
    ["eoy-nav", "Support (header link)"], ["eoy-menu", "Menu: Shape the conversation"],
    ["eoy-menu-why", "Menu: Why it matters"], ["eoy-menu-give", "Menu: Give online"],
    ["eoy-menu-lifetime", "Menu: Lifetime"], ["eoy-menu-gift", "Menu: Gift a membership"],
    ["eoy-menu-member", "Menu: Become a member"], ["eoy-menu-other", "Menu: Stock, fund or check"],
    ["eoy-menu-ways", "Menu: See every way to give"],
    ["eoy-dashboard", "Dashboard: Shape the conversation"], ["eoy-dashboard-why", "Dashboard: Why it matters"],
  ];
  const srcIs = (s) => (s === "bar" ? (x) => BAR_SRCS.includes(x) : (x) => x === s);
  const KINDS = [
    ["donation", "Donations (Anedot)"], ["lifetime", "Lifetime"],
    ["offer", "Membership, year-end offer"], ["membership", "Membership, full price"],
    ["gift", "Gift memberships"],
  ];
  const GOALS = [
    ["eoy-give", "Make a gift (hero and Give online card)"],
    ["eoy-give-supporting", "Make a gift (What you're supporting)"],
    ["eoy-lifetime", "Lifetime"], ["eoy-lifetime-gift", "Give Lifetime as a gift"],
    ["eoy-member", "Become a Member (monthly offer)"], ["eoy-member-annual", "Annual offer link"],
    ["eoy-gift", "Gift a Membership"],
  ];

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  };
  const num = (n) => Number(n || 0).toLocaleString("en-US");
  const money = (cents) => `$${(Number(cents || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : "·");

  // seg: null for any, a string, or a function that tests the segment.
  function sumDaily(daily, event, seg, goal) {
    const segOk = (x) => (seg == null || (typeof seg === "function" ? seg(x) : x === seg));
    return daily.reduce((t, r) => t
      + ((r.event === event && segOk(r.seg) && (goal == null || r.goal === goal)) ? Number(r.n) || 0 : 0), 0);
  }

  // One list of every payment: { day, kind, src, cents }.
  function payments(data) {
    const list = [];
    (data.conversions || []).forEach((c) => {
      const kind = c.kind === "membership" ? (c.offer ? "offer" : "membership") : c.kind;
      list.push({ day: c.day, kind, src: c.src || "none", cents: c.cents || 0 });
    });
    (data.donations || []).forEach((d) => list.push({ day: d.day, kind: "donation", src: d.src || "none", cents: d.cents || 0 }));
    return list;
  }
  const tally = (list, pred) => list.reduce((t, p) => (pred(p) ? { n: t.n + 1, cents: t.cents + p.cents } : t), { n: 0, cents: 0 });

  function table(head, rows, numericFrom) {
    const wrap = el("div", "admin-table-wrap");
    const t = el("table", "admin-table eoy-tracker-table");
    const thead = el("thead");
    const hr = el("tr");
    head.forEach((h, i) => { const th = el("th", i >= numericFrom ? "is-num" : "", h); th.scope = "col"; hr.appendChild(th); });
    thead.appendChild(hr);
    t.appendChild(thead);
    const tb = el("tbody");
    rows.forEach((r) => {
      const tr = el("tr", r.cls || "");
      r.cells.forEach((c, i) => tr.appendChild(el(i === 0 ? "th" : "td", i >= numericFrom ? "is-num" : "", c)));
      tr.firstChild.scope = "row";
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    return wrap;
  }

  function section(title, note) {
    const s = el("section", "eoy-tracker-section");
    s.appendChild(el("h3", "eoy-tracker-h", title));
    if (note) s.appendChild(el("p", "admin-sub", note));
    return s;
  }

  let justSaved = false; // keeps the "Saved" line through the re-render

  function render(data) {
    out.textContent = "";
    const daily = data.daily || [];
    const pays = payments(data);
    const total = tally(pays, () => true);

    // Meter (Ian, 2026-11-17): online payments count themselves; offline
    // gifts are one figure kept here. PUT /eoy/offline saves it.
    if (data.meter) {
      const m = data.meter;
      const off = data.offline || {};
      const met = section("The meter on /year-end/ and the bar",
        "The meter adds every online payment below to the offline amount here, and updates itself within a few minutes. Add each check, stock gift or donor-advised fund gift to the offline amount and save. Do not add online gifts here. They are already counted.");
      const ms = el("ul", "admin-stats");
      [["Meter total", money(m.raised_cents)], ["Online", money(m.online_cents)], ["Offline", money(m.offline_cents)],
        ["Goal", money(m.goal_cents)], ["Reached", pct(m.raised_cents, m.goal_cents)]].forEach(([label, value]) => {
        const li = el("li", "admin-stat");
        li.appendChild(el("span", "admin-stat-label", label));
        li.appendChild(el("span", "admin-stat-value", value));
        ms.appendChild(li);
      });
      met.appendChild(ms);

      const form = el("form", "eoy-offline-form");
      const amount = el("label", "dashboard-form-field");
      amount.appendChild(el("span", "dashboard-form-label", "Offline amount (dollars)"));
      const amountInput = el("input");
      amountInput.type = "text";
      amountInput.inputMode = "decimal";
      amountInput.name = "dollars";
      amountInput.required = true;
      // Cents are shown when there are any, so saving only a new note
      // never rounds the stored figure.
      amountInput.value = ((off.cents || 0) / 100).toFixed((off.cents || 0) % 100 ? 2 : 0);
      amount.appendChild(amountInput);
      const note = el("label", "dashboard-form-field");
      note.appendChild(el("span", "dashboard-form-label", "Note"));
      const noteInput = el("input");
      noteInput.type = "text";
      noteInput.name = "note";
      noteInput.maxLength = 200;
      noteInput.placeholder = "e.g. Added $5,000 check from the Smith family";
      noteInput.value = off.note || "";
      note.appendChild(noteInput);
      const save = el("button", "btn btn-primary btn-sm", "Save offline amount");
      save.type = "submit";
      const status = el("p", "admin-sub eoy-offline-status");
      status.setAttribute("role", "status");
      const who = off.updated_at
        ? `Last saved ${new Date(off.updated_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })} Central${off.by ? ` by ${off.by}` : ""}.`
        : "Not saved yet. This is the starting amount from the hand-set meter on November 13.";
      status.textContent = justSaved ? `Saved. The meter on the site shows it within a few minutes. ${who}` : who;
      justSaved = false;
      form.appendChild(amount);
      form.appendChild(note);
      form.appendChild(save);
      form.appendChild(status);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        save.disabled = true;
        status.textContent = "Saving…";
        window.MOAuth.fetch(`${workerUrl}/eoy/offline`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dollars: amountInput.value, note: noteInput.value }),
        })
          .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
          .then(({ ok, j }) => {
            if (!ok) throw new Error((j && j.error) || "Could not save.");
            justSaved = true;
            load();
          })
          .catch((err) => {
            status.textContent = (err && err.message) || "Could not save. Try again.";
            save.disabled = false;
          });
      });
      met.appendChild(form);
      out.appendChild(met);
    }

    // Results
    const res = section("What it has raised online",
      "Every online gift and checkout from every source since November 13. Checks, stock and donor-advised fund gifts are not here. They go in the offline amount above.");
    const stats = el("ul", "admin-stats");
    const tile = (label, value) => {
      const li = el("li", "admin-stat");
      li.appendChild(el("span", "admin-stat-label", label));
      li.appendChild(el("span", "admin-stat-value", value));
      stats.appendChild(li);
    };
    tile("All online payments", money(total.cents));
    KINDS.forEach(([k, label]) => {
      const t = tally(pays, (p) => p.kind === k);
      tile(label, `${num(t.n)} · ${money(t.cents)}`);
    });
    res.appendChild(stats);
    const notes = el("ul", "jr-caveats");
    if (data.offers && data.offers.length) {
      notes.appendChild(el("li", "", `Ghost counts ${data.offers.map((o) => `${num(o.redemptions)} ${o.cadence === "year" ? "annual" : "monthly"}`).join(" and ")} year-end offer redemptions in all, wherever they started.`));
    }
    notes.appendChild(el("li", "", "Membership amounts are the first payment only. A monthly member is $8 here and renews."));
    const zero = (data.donations || []).filter((d) => !d.cents).length;
    if (zero) notes.appendChild(el("li", "", `${num(zero)} ${zero === 1 ? "donation" : "donations"} arrived without an amount we could read. Anedot sent these fields: ${data.donation_fields || "none"}.`));
    res.appendChild(notes);
    out.appendChild(res);

    // The bar
    const ab = section("Bottom bar",
      "\"Ideas shape the world.\" with the button \"Shape the conversation\". Readers counts each reader once a day. Click rate is clicks per reader. Bar views counts every page the bar appeared on. Gifts are payments made after clicking the bar. Includes the headline test that ran Nov 13 to 20.");
    const reach = sumDaily(daily, "bar_reach");
    const views = sumDaily(daily, "bar_view");
    const clicks = sumDaily(daily, "bar_click");
    const closes = sumDaily(daily, "bar_close");
    const bt = tally(pays, (p) => BAR_SRCS.includes(p.src));
    ab.appendChild(table(["Surface", "Readers", "Bar views", "Clicks", "Click rate", "Closed", "Gifts", "Raised", "Raised per reader"],
      [{ cells: ["Bar", num(reach), num(views), num(clicks), pct(clicks, reach), num(closes), num(bt.n), money(bt.cents), reach ? money(bt.cents / reach) : "·"] }], 1));
    out.appendChild(ab);

    // By source
    const bySrc = section("/year-end/ by where readers came from",
      "Gifts are credited to the last place a reader came from before paying. \"Did not visit /year-end/\" is everything else in the campaign window, such as offer links in emails or a donation straight from Anedot.");
    const srcRows = SOURCES.map(([s, label]) => {
      const is = srcIs(s);
      const reach = s === "none" ? null : sumDaily(daily, "page_reach", is);
      const views = s === "none" ? null : sumDaily(daily, "page_view", is);
      const clicks = s === "none" ? null : sumDaily(daily, "cta", is);
      const t = tally(pays, (p) => is(p.src));
      return { cells: [label, reach == null ? "·" : num(reach), views == null ? "·" : num(views),
        clicks == null ? "·" : num(clicks), num(t.n), money(t.cents), reach ? pct(t.n, reach) : "·"] };
    });
    bySrc.appendChild(table(["Source", "Readers", "Page views", "Button clicks", "Gifts", "Raised", "Gave"], srcRows, 1));
    out.appendChild(bySrc);

    // What people chose, by source
    const kinds = section("What people gave, by source");
    const srcKeys = SOURCES.map(([s]) => s);
    const kindRows = KINDS.map(([k, label]) => {
      const cells = [label];
      srcKeys.forEach((s) => { const is = srcIs(s); cells.push(num(tally(pays, (p) => p.kind === k && is(p.src)).n)); });
      const t = tally(pays, (p) => p.kind === k);
      cells.push(num(t.n), money(t.cents));
      return { cells };
    });
    kinds.appendChild(table(["Gift"].concat(srcKeys.map((s) => SHORT[s]), ["All", "Raised"]), kindRows, 1));
    out.appendChild(kinds);

    // Buttons
    const btns = section("Buttons on /year-end/", "Clicks only. What those clicks became is in the tables above.");
    const goalRows = GOALS.map(([g, label]) => {
      const cells = [label];
      ["bar", "menu", "dash", "email", "page"].forEach((s) => cells.push(num(sumDaily(daily, "cta", srcIs(s), g))));
      cells.push(num(sumDaily(daily, "cta", null, g)));
      return { cells };
    });
    btns.appendChild(table(["Button", "Bar", "Menu", "Dashboard", "Email", "Other", "All"], goalRows, 1));
    out.appendChild(btns);

    // Links in the Support menu and the dashboard card
    const links = section("Support menu and dashboard card",
      "Clicks on the desktop menu and the dashboard card, from Nov 20. Phone menu taps are not counted here. Gifts after them are still credited to Support menu, except Become a member, which opens the membership popup without a source on phones.");
    const linkRows = LINKS.map(([g, label]) => ({ cells: [label, num(sumDaily(daily, "link_click", null, g))] }));
    links.appendChild(table(["Link", "Clicks"], linkRows, 1));
    out.appendChild(links);

    // By day
    const days = {};
    const day = (d) => (days[d] = days[d] || { bar: 0, clicks: 0, page: 0, gifts: 0, cents: 0 });
    daily.forEach((r) => {
      const d = day(r.day);
      if (r.event === "bar_reach") d.bar += Number(r.n) || 0;
      if (r.event === "bar_click") d.clicks += Number(r.n) || 0;
      if (r.event === "page_reach") d.page += Number(r.n) || 0;
    });
    pays.forEach((p) => { const d = day(p.day); d.gifts += 1; d.cents += p.cents; });
    const dayRows = Object.keys(days).sort().reverse().map((k) => {
      const d = days[k];
      const label = new Date(`${k}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
      return { cells: [label, num(d.bar), num(d.clicks), num(d.page), num(d.gifts), money(d.cents)] };
    });
    const byDay = section("By day", "Central time, newest first.");
    byDay.appendChild(dayRows.length ? table(["Day", "Bar readers", "Bar clicks", "/year-end/ readers", "Gifts", "Raised"], dayRows, 1)
      : el("p", "admin-sub", "No activity yet."));
    out.appendChild(byDay);

    if (asOf) {
      const t = new Date(data.as_of);
      asOf.textContent = `Data as of ${t.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })} Central.`;
    }
  }

  function load() {
    if (!workerUrl || !window.MOAuth) return;
    if (refresh) refresh.disabled = true;
    window.MOAuth.fetch(`${workerUrl}/eoy/stats`)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(render)
      .catch(() => {
        out.textContent = "";
        out.appendChild(el("p", "admin-sub", "Could not load the year-end numbers. Try Refresh in a minute."));
      })
      .then(() => { if (refresh) refresh.disabled = false; });
  }

  if (refresh) refresh.addEventListener("click", load);
  load();
})();
