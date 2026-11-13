/*
 * Year-end campaign tracker on /admin/slide-ins/ (Ian, 2026-11-13): the
 * bottom bar, its headline A/B test, /year-end/ itself, and what all of it
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

  const HEADLINES = { a: "Help us build on 2026.", b: "Help us build on our best year ever." };
  const SOURCES = [
    ["bar-a", "Bar, headline A"], ["bar-b", "Bar, headline B"],
    ["email", "Email"], ["page", "Other visits"], ["none", "Did not visit /year-end/"],
  ];
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

  function sumDaily(daily, event, seg, goal) {
    return daily.reduce((t, r) => t
      + ((r.event === event && (seg == null || r.seg === seg) && (goal == null || r.goal === goal)) ? Number(r.n) || 0 : 0), 0);
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

  // Two-proportion z test on click rate. Says "too early" until each side
  // has 30 clicks, so a handful of early clicks is never called a winner.
  function verdict(ca, va, cb, vb) {
    if (ca < 30 || cb < 30) return `Too early to call. Each headline needs at least 30 clicks (A has ${num(ca)}, B has ${num(cb)}).`;
    const pa = ca / va;
    const pb = cb / vb;
    const p = (ca + cb) / (va + vb);
    const se = Math.sqrt(p * (1 - p) * (1 / va + 1 / vb));
    const z = se ? (pa - pb) / se : 0;
    if (Math.abs(z) < 1.96) return `No clear winner yet on clicks (A ${pct(ca, va)}, B ${pct(cb, vb)}). The difference could still be chance.`;
    const win = z > 0 ? "A" : "B";
    return `Headline ${win} gets more clicks (A ${pct(ca, va)}, B ${pct(cb, vb)}). The gap is unlikely to be chance (95% confidence). Check that it also brings in more money below before switching.`;
  }

  function render(data) {
    out.textContent = "";
    const daily = data.daily || [];
    const pays = payments(data);
    const total = tally(pays, () => true);

    // Results
    const res = section("What it has raised online",
      "Every online gift and checkout from every source since November 13. Checks, stock and donor-advised fund gifts are not here. The meter on /year-end/ is still updated by hand.");
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

    // Headline test
    const ab = section("Bottom bar: headline test",
      `Each reader is shown one headline at random and keeps it. Headline A is "${HEADLINES.a}" Headline B is "${HEADLINES.b}" Readers counts each reader once a day. Click rate is clicks per reader. Bar views counts every page the bar appeared on.`);
    const abRows = ["a", "b"].map((v) => {
      const reach = sumDaily(daily, "bar_reach", v);
      const views = sumDaily(daily, "bar_view", v);
      const clicks = sumDaily(daily, "bar_click", v);
      const closes = sumDaily(daily, "bar_close", v);
      const t = tally(pays, (p) => p.src === `bar-${v}`);
      return {
        v, reach, clicks,
        cells: [v.toUpperCase(), num(reach), num(views), num(clicks), pct(clicks, reach), num(closes),
          num(t.n), money(t.cents), reach ? money(t.cents / reach) : "·"],
      };
    });
    ab.appendChild(table(["Headline", "Readers", "Bar views", "Clicks", "Click rate", "Closed", "Gifts", "Raised", "Raised per reader"], abRows, 1));
    ab.appendChild(el("p", "eoy-tracker-verdict", verdict(abRows[0].clicks, abRows[0].reach, abRows[1].clicks, abRows[1].reach)));
    out.appendChild(ab);

    // By source
    const bySrc = section("/year-end/ by where readers came from",
      "Gifts are credited to the last place a reader came from before paying. \"Did not visit /year-end/\" is everything else in the campaign window, such as offer links in emails or a donation straight from Anedot.");
    const srcRows = SOURCES.map(([s, label]) => {
      const reach = s === "none" ? null : sumDaily(daily, "page_reach", s);
      const views = s === "none" ? null : sumDaily(daily, "page_view", s);
      const clicks = s === "none" ? null : sumDaily(daily, "cta", s);
      const t = tally(pays, (p) => p.src === s);
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
      srcKeys.forEach((s) => { cells.push(num(tally(pays, (p) => p.kind === k && p.src === s).n)); });
      const t = tally(pays, (p) => p.kind === k);
      cells.push(num(t.n), money(t.cents));
      return { cells };
    });
    kinds.appendChild(table(["Gift", "Bar A", "Bar B", "Email", "Other", "No visit", "All", "Raised"], kindRows, 1));
    out.appendChild(kinds);

    // Buttons
    const btns = section("Buttons on /year-end/", "Clicks only. What those clicks became is in the tables above.");
    const goalRows = GOALS.map(([g, label]) => {
      const cells = [label];
      ["bar-a", "bar-b", "email", "page"].forEach((s) => cells.push(num(sumDaily(daily, "cta", s, g))));
      cells.push(num(sumDaily(daily, "cta", null, g)));
      return { cells };
    });
    btns.appendChild(table(["Button", "Bar A", "Bar B", "Email", "Other", "All"], goalRows, 1));
    out.appendChild(btns);

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
