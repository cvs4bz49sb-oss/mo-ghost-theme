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
    foot: root.querySelector("[data-mig-footnote]"),
    stamp: document.querySelector("[data-mig-stamp]")
  };

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const usd = (n) => (typeof n === "number" ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—");
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
      + cell(t.clear, "Just needs filing")
      + cell(t.at_risk_people, "Do not cancel")
      + cell(usd(t.at_risk), "Still billing, per year");
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

    // One primary per row, and which one depends on what is actually left
    // to do: cancel it, or just file it.
    const actions = [];
    if (r.eligible) {
      actions.push('<button type="button" class="kpi-btn kpi-btn--primary" data-mig-do="cancel">Cancel</button>');
    } else if (r.kind === "risk") {
      actions.push('<button type="button" class="kpi-btn" data-mig-do="cancel" disabled>Cancel</button>');
    }
    if (pay) {
      actions.push(`<a class="kpi-btn${r.kind === "clear" ? " kpi-btn--quiet" : ""}" href="${esc(pay.url)}" target="_blank" rel="noopener">Refund ↗</a>`);
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
    if (!quiet) say(`Cancelled — now refund ${usd(out.payment && out.payment.amount)} for ${out.email}.`, "ok");
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
      } else {
        await api("/migration/processed", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contact_id: id })
        });
        say("Marked done — they drop out of the segment.", "ok");
      }
      await load();
    } catch (err) {
      say(err.message, "error");
      btn.disabled = false;
    }
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
      } catch (err) {
        failed.push(`${r.email}: ${err.message}`);
      }
    }
    await load();
    say(failed.length
      ? `Cancelled ${done}. ${failed.length} failed — ${failed[0]}`
      : `Cancelled ${done}. Now work down the refund links.`, failed.length ? "error" : "ok");
  });

  load();
}());
