/*
 * /admin/migration/ — working the double-billing backlog.
 *
 * One row per person in the HubSpot segment. Each row carries the two
 * things needed to close them out: a button that cancels the legacy
 * subscription, and a link to the exact payment to refund.
 *
 * Deliberately not automatic. "Cancel all eligible" does the whole queue
 * in one press, but a person presses it. The reason this backlog exists
 * is that something cancelled subscriptions unattended, silently did
 * nothing for months, and the confirmation emails kept saying otherwise.
 *
 * Ineligible rows are shown rather than filtered out, with the reason —
 * a name missing from the list is indistinguishable from a name that was
 * never in it, and at least one person here would be cut off by a
 * cancellation.
 */
(function () {
  const root = document.querySelector("[data-mig-root]");
  if (!root) return;
  const worker = (root.getAttribute("data-worker-url") || "").trim().replace(/\/$/, "");

  const els = {
    list: root.querySelector("[data-mig-list]"),
    stats: root.querySelector("[data-mig-stats]"),
    msg: root.querySelector("[data-mig-msg]"),
    refresh: root.querySelector("[data-mig-refresh]"),
    cancelAll: root.querySelector("[data-mig-cancel-all]"),
    doneAll: root.querySelector("[data-mig-done-all]"),
    foot: root.querySelector("[data-mig-footnote]"),
    ledger: root.querySelector("[data-mig-ledger]"),
    rebuild: root.querySelector("[data-mig-rebuild]"),
    stamp: document.querySelector("[data-mig-stamp]")
  };

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  // Cents always, never $909.5 — this page is a refund worksheet and a
  // dropped trailing zero reads as a different number.
  const usd = (n) => (typeof n === "number"
    ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—");
  const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en-US") : "0");
  const mdy = (iso) => (iso ? new Date(String(iso).length <= 10 ? `${iso}T12:00:00Z` : iso)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—");

  let queue = null;
  let msgTimer = null;

  function say(text, tone) {
    if (!els.msg) return;
    els.msg.textContent = text;
    els.msg.className = `kpi-layoutmsg${tone ? ` is-${tone}` : ""}`;
    clearTimeout(msgTimer);
    if (tone !== "error") msgTimer = setTimeout(() => { els.msg.textContent = ""; }, 5000);
  }

  const api = async (path, init) => {
    const r = await MOAuth.fetch(worker + path, init);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
    return d;
  };

  function statsHtml(t) {
    const cell = (v, l) => `<div class="kpi-stat"><span class="kpi-stat-v">${v}</span><span class="kpi-stat-l">${l}</span></div>`;
    return cell(t.queue, "In the queue")
      + cell(t.eligible, "Ready to cancel")
      + cell(t.at_risk_people, "Do not cancel")
      + cell(usd(t.at_risk), "Still billing, per year")
      // Scoped label deliberately: this counts only the unprocessed
      // segment, and the ledger below reports a much larger figure over
      // everyone who migrated. Two unqualified "owed back" numbers on one
      // page read as a contradiction rather than two populations.
      + cell(usd(t.owed), `Owed back in this queue, ${fmt(t.owed_people)} people`);
  }

  function rowHtml(r) {
    const sub = r.subscription;
    const pay = r.payment;
    const who = esc(r.name || r.email || `Contact ${r.contact_id}`);
    const BADGE = {
      ready: "", // the group heading already says it; a badge on every row is noise
      clear: "",
      risk: '<span class="mig-badge is-risk">Do not cancel</span>'
    };

    const nextDue = sub && sub.next_payment_due ? `next ${mdy(sub.next_payment_due)}` : "";
    const nextAmt = sub && sub.next_payment_amount != null ? usd(sub.next_payment_amount) : "";
    const subMain = sub ? esc(sub.name || "Subscription") : "—";
    const subSub = sub
      ? [esc(sub.status), [nextDue, nextAmt].filter(Boolean).join(" · ")].filter(Boolean).join(" · ")
      : "no legacy subscription";

    const payMain = pay ? usd(pay.amount) : "—";
    const paySub = pay ? `${mdy(pay.at)}${pay.status ? ` · ${esc(pay.status)}` : ""}` : "no payments on file";

    // The number Ian actually acts on, with the band that produced it so
    // it can be checked at a glance rather than taken on trust.
    const ref = r.refund;
    const refMain = ref ? usd(ref.amount) : "—";
    const refSub = ref
      ? (ref.blocked
        ? `HubSpot will not refund this — ${esc(String(ref.blocked).replace(/_/g, " "))}`
        : `${esc(ref.band)} · ${Math.round(ref.pct * 100)}% of ${usd(ref.of)}`)
      : "nothing to refund";

    // One primary per row, and which one depends on what is actually left
    // to do: cancel it, or just file it.
    const actions = [];
    if (r.cancelled_now) {
      // Only reachable after the worker re-read the subscription and saw it
      // was no longer active. Never set from the request succeeding.
      actions.push('<button type="button" class="kpi-btn kpi-btn--done" disabled>✓ Cancelled</button>');
    } else if (r.eligible) {
      actions.push('<button type="button" class="kpi-btn kpi-btn--primary" data-mig-do="cancel">Cancel</button>');
    } else if (r.kind === "risk") {
      actions.push('<button type="button" class="kpi-btn" data-mig-do="cancel" disabled>Cancel</button>');
    }
    if (pay) {
      const owed = ref && ref.amount > 0 ? ` ${usd(ref.amount)}` : "";
      actions.push(`<a class="kpi-btn${r.kind === "clear" ? " kpi-btn--quiet" : ""}" href="${esc(pay.url)}" target="_blank" rel="noopener">Refund${owed} ↗</a>`);
    }
    actions.push(`<a class="kpi-btn kpi-btn--quiet" href="${esc(r.hubspot_contact_url)}" target="_blank" rel="noopener">HubSpot ↗</a>`);
    actions.push(`<button type="button" class="kpi-btn${r.kind === "clear" ? " kpi-btn--primary" : " kpi-btn--quiet"}" data-mig-do="processed">Done</button>`);

    return `<div class="mig-row is-${esc(r.kind || "risk")}" data-mig-contact="${esc(r.contact_id)}">
      <div class="mig-c mig-c--who">
        <span class="mig-name">${who}${BADGE[r.kind] || ""}</span>
        <span class="mig-sub">${esc(r.email)}</span>
        <span class="mig-sub">Migrated ${mdy(r.migrated_at)} · Ghost ${esc(r.ghost_status || "?")}</span>
      </div>
      <div class="mig-c">
        <span class="mig-label">Old subscription</span>
        <span class="mig-main">${subMain}</span>
        <span class="mig-sub">${subSub}</span>
      </div>
      <div class="mig-c">
        <span class="mig-label">Latest payment</span>
        <span class="mig-main">${payMain}</span>
        <span class="mig-sub">${paySub}</span>
      </div>
      <div class="mig-c mig-c--owed">
        <span class="mig-label">Refund owed</span>
        <span class="mig-main mig-owed">${refMain}</span>
        <span class="mig-sub${ref && ref.blocked ? " is-blocked-refund" : ""}">${refSub}</span>
      </div>
      <div class="mig-c mig-c--actions">${actions.join("")}</div>
      ${r.kind === "risk" ? `<p class="mig-why is-risk">${esc(r.blocked_reason)}</p>` : ""}
    </div>`;
  }

  // Grouped by what you would do next, in the order you would do it.
  // A flat list sorted by eligibility looked the same at a glance whether
  // a row was safe or dangerous.
  const GROUPS = [
    { kind: "ready", title: "Ready to cancel",
      note: "Paid in Ghost with an active legacy subscription. Cancel, then refund the last payment." },
    { kind: "clear", title: "Just needs filing",
      note: "Nothing left to cancel. Marking done clears them from the queue and the HubSpot segment." },
    { kind: "risk", title: "Do not cancel",
      note: "These would lose the only membership they are paying for. Sort out the Ghost side first." }
  ];

  function render() {
    if (!queue) return;
    if (queue.error) {
      els.list.innerHTML = `<p class="kpi-empty">${esc(queue.error)}</p>`;
      return;
    }
    els.stats.innerHTML = statsHtml(queue.totals);
    els.foot.hidden = false;
    if (els.stamp) els.stamp.textContent = `Checked ${new Date(queue.updated).toLocaleString()}`;
    els.cancelAll.disabled = !queue.totals.eligible;
    els.cancelAll.textContent = queue.totals.eligible
      ? `Cancel all ${queue.totals.eligible} eligible`
      : "Nothing eligible";

    const filed = filedByBulk().length;
    els.doneAll.disabled = !filed;
    els.doneAll.textContent = filed ? `Mark ${filed} done` : "Nothing to file";

    if (!queue.rows.length) {
      els.list.innerHTML = '<p class="kpi-empty">Queue is empty — nobody is waiting on a cancellation.</p>';
      return;
    }
    els.list.innerHTML = GROUPS.map((g) => {
      const rows = queue.rows.filter((r) => (r.kind || "risk") === g.kind);
      if (!rows.length) return "";
      return `<section class="mig-group is-${g.kind}">
        <div class="mig-group-head">
          <h2 class="mig-group-title">${g.title}<span class="mig-group-n">${rows.length}</span></h2>
          <p class="mig-group-note">${g.note}</p>
        </div>
        ${rows.map(rowHtml).join("")}
      </section>`;
    }).join("");
  }

  /*
   * What "mark all done" covers: the rows with nothing left to do — no
   * legacy subscription, so nothing to cancel and nothing to refund.
   *
   * Not the cancelled-this-session rows, even though they look finished.
   * Filing one removes it from the queue, and HubSpot has no way to tell
   * us whether the refund was actually issued — so a bulk sweep could
   * quietly bury someone who is still owed money. Those get filed one at
   * a time, after the refund. And never the do-not-cancel rows: those are
   * unresolved by definition.
   */
  const filedByBulk = () => (queue ? queue.rows.filter((r) => r.kind === "clear") : []);

  async function load() {
    try {
      queue = await api("/migration/queue");
      render();
    } catch (err) {
      els.list.innerHTML = `<p class="kpi-empty">${err.message === "denied"
        ? "You need a Ghost staff seat to see this."
        : esc(err.message)}</p>`;
    }
  }

  async function cancelOne(contactId, quiet) {
    const out = await api("/migration/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contact_id: contactId })
    });
    if (!out.verified) {
      throw new Error(`HubSpot still reports this subscription as "${out.status}" — not marking it cancelled.`);
    }
    const row = queue.rows.find((x) => String(x.contact_id) === String(contactId));
    if (row) {
      row.cancelled_now = true;
      row.eligible = false;
      if (row.subscription) row.subscription.status = out.status;
      queue.totals.eligible = queue.rows.filter((x) => x.eligible).length;
    }
    if (!quiet) {
      const owed = out.refund && out.refund.amount > 0 ? ` Now refund ${usd(out.refund.amount)}.` : "";
      say(`Cancelled ${out.email}.${owed}`, "ok");
    }
    return out;
  }

  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-mig-do]");
    if (!btn) return;
    const row = btn.closest("[data-mig-contact]");
    const id = row && row.getAttribute("data-mig-contact");
    if (!id) return;
    const what = btn.getAttribute("data-mig-do");
    btn.disabled = true;
    try {
      if (what === "cancel") {
        await cancelOne(id);
        // Deliberately not reloading: a reload re-sorts the cancelled row
        // into "Just needs filing" and the confirmation vanishes the instant
        // it appears, before the refund has been issued.
        render();
      } else {
        await api("/migration/processed", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contact_id: id })
        });
        say("Marked done — they drop out of the segment.", "ok");
        await load();
      }
    } catch (err) {
      say(err.message, "error");
      btn.disabled = false;
    }
  });

  els.doneAll.addEventListener("click", async () => {
    const rows = filedByBulk();
    if (!rows.length) return;
    const pending = queue.rows.filter((r) => r.kind === "ready" && !r.cancelled_now).length;
    const risky = queue.rows.filter((r) => r.kind === "risk").length;
    const held = [
      pending ? `${pending} still to cancel` : "",
      risky ? `${risky} flagged do-not-cancel` : "",
      queue.rows.filter((r) => r.cancelled_now).length
        ? `${queue.rows.filter((r) => r.cancelled_now).length} cancelled but not yet refunded`
        : ""
    ].filter(Boolean);
    const tail = held.length ? `Left alone: ${held.join(", ")}.` : "Nothing else is left in the queue.";
    const ok = window.confirm(
      `Mark ${rows.length} ${rows.length === 1 ? "person" : "people"} done?\n\n`
      + `These have no legacy subscription — nothing to cancel, nothing to refund. `
      + `It clears them from this queue and from the HubSpot segment.\n\n${tail}`
    );
    if (!ok) return;
    els.doneAll.disabled = true;
    let done = 0;
    const failed = [];
    for (const r of rows) {
      try {
        await api("/migration/processed", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contact_id: r.contact_id })
        });
        done += 1;
        say(`Filed ${done} of ${rows.length}…`);
      } catch (err) {
        failed.push(`${r.email}: ${err.message}`);
      }
    }
    await load();
    say(failed.length
      ? `Filed ${done} of ${rows.length}. ${failed.length} failed — ${failed[0]}`
      : `Filed ${done}. They are out of the queue.`, failed.length ? "error" : "ok");
  });

  /*
   * The ladder ledger: everyone who migrated, against every payment.
   * Wider than the cancel queue above, which only sees the unprocessed
   * segment — and it separates the three things that need acting on
   * differently rather than laddering them all the same way.
   */
  let ledger = null;

  function ledgerHtml() {
    if (!ledger) return "";
    if (ledger.error) return `<p class="kpi-empty">${esc(ledger.error)}</p>`;
    const c = ledger.counts;
    const out = [];

    const person = (r, right, sub) => `<div class="mig-row is-${esc(r.kind || "ready")}">
      <div class="mig-c mig-c--who">
        <span class="mig-name">${esc(r.name || r.email)}</span>
        <span class="mig-sub">${esc(r.email)}</span>
        ${r.migrated_at ? `<span class="mig-sub">Migrated ${mdy(r.migrated_at)}</span>` : ""}
      </div>
      ${sub}
      <div class="mig-c mig-c--owed"><span class="mig-label">Owed</span>
        <span class="mig-main mig-owed">${right}</span></div>
      <div class="mig-c mig-c--actions">
        <a class="kpi-btn kpi-btn--primary" href="${esc(r.payments_url)}" target="_blank" rel="noopener">Refund ↗</a>
        ${r.hubspot_contact_url ? `<a class="kpi-btn kpi-btn--quiet" href="${esc(r.hubspot_contact_url)}" target="_blank" rel="noopener">Contact ↗</a>` : ""}
      </div>
    </div>`;

    // 0. Still billing. The cause, not the symptom: refunding a wrong
    //    charge does not stop the next one, and on 2026-08-07 all five
    //    people below were refunded within the hour while every one of
    //    them kept an active subscription with a next payment date.
    const billing = ledger.billing || [];
    if (billing.length) {
      out.push(`<section class="mig-group is-risk">
        <div class="mig-group-head">
          <h2 class="mig-group-title">Still billing on HubSpot<span class="mig-group-n">${fmt(c.still_billing)}</span></h2>
          <p class="mig-group-note"><b>${usd(c.still_billing_annualised)}</b> a year still being charged on the
            old system to people who have already moved. Refunding a charge does not stop the next one — these
            recur until the subscription itself is cancelled, and the section above only empties when the
            charges are refunded, not when the cause is fixed.${c.still_billing_unsafe
    ? ` <b>${c.still_billing_unsafe === 1 ? "One of them is not a paid member"
      : `${fmt(c.still_billing_unsafe)} of them are not paid members`} in Ghost</b>, so cancelling could cut off
            ${c.still_billing_unsafe === 1 ? "their" : "someone's"} only membership — do
            ${c.still_billing_unsafe === 1 ? "that one" : "those"} from the queue at the top, which re-checks
            Ghost server-side and refuses.` : ""}${c.still_billing_unchecked
    ? ` Ghost could not be checked for ${fmt(c.still_billing_unchecked)} of them, so treat those as unverified
            rather than safe.` : ""}</p>
        </div>
        ${billing.map((r) => `<div class="mig-row is-${r.safe_to_cancel ? "ready" : "risk"}">
          <div class="mig-c mig-c--who">
            <span class="mig-name">${esc(r.name || r.email)}</span>
            <span class="mig-sub">${esc(r.email)}</span>
            <span class="mig-sub">Migrated ${mdy(r.migrated_at)} · Ghost: ${esc(r.ghost_status || "unchecked")}</span>
          </div>
          <div class="mig-c"><span class="mig-label">Next charge</span>
            <span class="mig-main">${r.next_charge ? mdy(r.next_charge) : "—"}</span>
            <span class="mig-sub">${esc(r.active_subs[0].name || "legacy subscription")}</span></div>
          <div class="mig-c"><span class="mig-label">Amount</span>
            <span class="mig-main">${usd(r.active_subs[0].amount)}</span></div>
          <div class="mig-c mig-c--owed"><span class="mig-label">${r.safe_to_cancel ? "Safe to cancel" : "Do not cancel"}</span>
            <span class="mig-sub">${r.cancel_warning ? esc(r.cancel_warning) : "Paid in Ghost, so the legacy sub is redundant."}</span></div>
          <div class="mig-c mig-c--actions">
            <a class="kpi-btn kpi-btn--quiet" href="${esc(r.active_subs[0].url)}" target="_blank" rel="noopener">Subscription ↗</a>
          </div>
        </div>`).join("")}
      </section>`);
    }

    // 1. Charged after migrating — errors, not policy. Full refund, and
    //    they recur every month until the subscription is cancelled.
    const post = ledger.rows.filter((r) => r.post_owed > 0)
      .sort((a, b) => b.post_owed - a.post_owed);
    if (post.length) {
      out.push(`<section class="mig-group is-risk">
        <div class="mig-group-head">
          <h2 class="mig-group-title">Charged after they migrated<span class="mig-group-n">${fmt(c.post_people)}</span></h2>
          <p class="mig-group-note">${fmt(c.post_charges)} charges, <b>${usd(c.post_total)}</b>. These are the
            auto-cancel failure, not policy — the ladder does not apply and they are refunded in full. They keep
            recurring every billing cycle until the legacy subscription is actually cancelled.</p>
        </div>
        ${post.map((r) => person(r, usd(r.post_owed),
    `<div class="mig-c"><span class="mig-label">Charges since migrating</span>
       <span class="mig-main">${fmt(r.post_charges.length)}</span>
       <span class="mig-sub">${r.post_charges.map((p) => `${usd(p.paid)} ${mdy(p.at)}`).join(" · ")}</span></div>
     <div class="mig-c"><span class="mig-label">Latest</span>
       <span class="mig-main">${mdy(r.post_charges[r.post_charges.length - 1].at)}</span></div>`)).join("")}
      </section>`);
    }

    // 2. Promised in writing but never stamped — no query keyed on
    //    mo_migrated_at can see these people at all.
    if ((ledger.promised || []).length) {
      out.push(`<section class="mig-group is-risk">
        <div class="mig-group-head">
          <h2 class="mig-group-title">Promised a refund, but invisible to the queue<span class="mig-group-n">${fmt(ledger.promised.length)}</span></h2>
          <p class="mig-group-note">mo_migrated_at is only written by the migration webhook, so anyone handled
            another way never gets the stamp. These were promised a refund in writing and appear in no query
            scoped to that property — including the queue above.</p>
        </div>
        ${ledger.promised.map((p) => `<div class="mig-row is-risk">
          <div class="mig-c mig-c--who">
            <span class="mig-name">${esc(p.email)}</span>
            <span class="mig-sub">no mo_migrated_at stamp</span>
          </div>
          <div class="mig-c"><span class="mig-label">Latest payment</span>
            <span class="mig-main">${p.latest ? usd(p.latest.paid) : "—"}</span>
            <span class="mig-sub">${p.latest ? mdy(p.latest.at) : "no collected payments"}</span></div>
          <div class="mig-c"><span class="mig-label">Already refunded</span>
            <span class="mig-main">${p.latest ? usd(p.latest.refunded) : "—"}</span></div>
          <div class="mig-c mig-c--owed"><span class="mig-label">Outstanding</span>
            <span class="mig-main mig-owed">${usd(p.outstanding)}</span></div>
          <div class="mig-c mig-c--actions">
            <a class="kpi-btn${p.outstanding > 0 ? " kpi-btn--primary" : " kpi-btn--quiet"}" href="${esc(p.payments_url)}" target="_blank" rel="noopener">Payments ↗</a>
          </div>
        </div>`).join("")}
      </section>`);
    }

    // 3. The ladder itself. 76 rows is too many to sit open, so it leads
    //    with the band summary and opens on demand.
    const owed = ledger.rows.filter((r) => r.category === "owed")
      .sort((a, b) => b.ladder_owed - a.ladder_owed);
    const bands = ["0–3 mo", "3–6 mo", "6–9 mo", "9–12 mo"];
    const summary = bands.map((b) => {
      const g = owed.filter((r) => r.band === b);
      return g.length
        ? `<tr><td>${b}</td><td class="is-num">${fmt(g.length)}</td><td class="is-num">${usd(g.reduce((s, r) => s + r.ladder_owed, 0))}</td></tr>`
        : "";
    }).join("");
    out.push(`<section class="mig-group">
      <div class="mig-group-head">
        <h2 class="mig-group-title">Owed under the ladder<span class="mig-group-n">${fmt(c.owed)}</span></h2>
        <p class="mig-group-note"><b>${usd(c.owed_total)}</b> across everyone who migrated — not just the queue
          above. Already netted against anything refunded, capped at what HubSpot will still allow, and
          excluding ${fmt(c.outside_12_months)} past twelve months, ${fmt(c.already_covered)} already covered
          and ${fmt(c.no_legacy_payment)} with no legacy charge.</p>
      </div>
      <div class="kpi-tablewrap"><table class="kpi-table kpi-table-cmp">
        <thead><tr><th>Band</th><th class="is-num">People</th><th class="is-num">Owed</th></tr></thead>
        <tbody>${summary}<tr class="is-total"><td>Total</td><td class="is-num">${fmt(c.owed)}</td>
          <td class="is-num">${usd(c.owed_total)}</td></tr></tbody>
      </table></div>
      <p class="kpi-more"><button type="button" class="kpi-btn" data-mig-ladder-toggle>Show all ${fmt(owed.length)}</button></p>
      <div data-mig-ladder hidden>${owed.map((r) => person(r, usd(r.ladder_owed),
    `<div class="mig-c"><span class="mig-label">Last legacy payment</span>
       <span class="mig-main">${usd(r.paid)}</span>
       <span class="mig-sub">${mdy(r.legacy_payment.at)} · ${r.days_since_payment} days</span></div>
     <div class="mig-c"><span class="mig-label">Band</span>
       <span class="mig-main">${esc(r.band)}</span>
       <span class="mig-sub">${Math.round(r.pct * 100)}% of ${usd(r.paid)}${r.already_refunded > 0 ? ` less ${usd(r.already_refunded)} refunded` : ""}${r.refund_blocked ? " · HubSpot will not refund this" : ""}${r.outlier ? " · large charge, review" : ""}</span></div>`)).join("")}</div>
    </section>`);

    return out.join("");
  }

  function renderLedger() {
    if (!els.ledger) return;
    els.ledger.innerHTML = ledgerHtml();
    const t = els.ledger.querySelector("[data-mig-ladder-toggle]");
    if (t) {
      t.addEventListener("click", () => {
        const list = els.ledger.querySelector("[data-mig-ladder]");
        const open = !list.hasAttribute("hidden");
        if (open) list.setAttribute("hidden", ""); else list.removeAttribute("hidden");
        t.textContent = open ? `Show all ${fmt(list.children.length)}` : "Hide";
      });
    }
  }

  async function loadLedgerData() {
    try {
      ledger = await api("/migration/ledger");
    } catch (err) {
      ledger = { error: `${err.message} — press Rebuild ledger.` };
    }
    renderLedger();
  }

  els.rebuild.addEventListener("click", async () => {
    els.rebuild.disabled = true;
    say("Rebuilding the ledger — walking every migrated contact against every payment…");
    try {
      const out = await api("/migration/ledger/rebuild", { method: "POST" });
      await loadLedgerData();
      say(`Ledger rebuilt: ${fmt(out.counts.owed)} owed ${usd(out.counts.owed_total)}, `
        + `${fmt(out.counts.post_people)} charged after migrating ${usd(out.counts.post_total)}.`, "ok");
    } catch (err) {
      say(err.message, "error");
    }
    els.rebuild.disabled = false;
  });

  els.refresh.addEventListener("click", async () => {
    els.refresh.disabled = true;
    say("Rechecking…");
    await load();
    els.refresh.disabled = false;
  });

  // Bulk, but never unattended: the count is named in the confirm so a
  // stale page cannot cancel more than the reader thinks it will.
  els.cancelAll.addEventListener("click", async () => {
    const ready = queue.rows.filter((r) => r.eligible);
    if (!ready.length) return;
    const ok = window.confirm(
      `Cancel ${ready.length} legacy subscription${ready.length === 1 ? "" : "s"}?\n\n`
      + "This stops billing on the old system. It does NOT refund anything — you still need to "
      + "open each payment and refund it."
    );
    if (!ok) return;
    els.cancelAll.disabled = true;
    let done = 0;
    const failed = [];
    for (const r of ready) {
      try {
        await cancelOne(r.contact_id, true);
        done += 1;
        say(`Cancelled ${done} of ${ready.length}…`);
        render();
      } catch (err) {
        failed.push(`${r.email}: ${err.message}`);
      }
    }
    render();
    const owed = queue.rows.filter((x) => x.cancelled_now)
      .reduce((sum, x) => sum + ((x.refund && x.refund.amount) || 0), 0);
    say(failed.length
      ? `Cancelled ${done} of ${ready.length}. ${failed.length} failed — ${failed[0]}`
      : `Cancelled ${done}. ${usd(owed)} now to refund.`, failed.length ? "error" : "ok");
  });

  load();
  loadLedgerData();
}());
