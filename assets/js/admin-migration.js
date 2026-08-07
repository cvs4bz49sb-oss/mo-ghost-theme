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
      ready: '<span class="mig-badge is-ready">Ready</span>',
      clear: '<span class="mig-badge is-clear">Nothing to cancel</span>',
      risk: '<span class="mig-badge is-risk">Do not cancel</span>'
    };
    const badge = BADGE[r.kind] || BADGE.risk;

    const nextDue = sub && sub.next_payment_due ? ` · next ${mdy(sub.next_payment_due)}` : "";
    const nextAmt = sub && sub.next_payment_amount != null ? ` for ${usd(sub.next_payment_amount)}` : "";
    const subLine = sub
      ? `${esc(sub.name || "Subscription")} · ${esc(sub.status)}${nextDue}${nextAmt}`
      : "No HubSpot subscription found";

    const payLine = pay
      ? `${usd(pay.amount)} on ${mdy(pay.at)}${pay.status ? ` · ${esc(pay.status)}` : ""}`
      : "No payment records found";

    return `<div class="mig-row is-${esc(r.kind || "risk")}" data-mig-contact="${esc(r.contact_id)}">
      <div class="mig-head">
        <div class="mig-who">
          <b>${who}</b>${badge}
          <span class="mig-email">${esc(r.email)}</span>
        </div>
        <div class="mig-when">Migrated ${mdy(r.migrated_at)} · Ghost: <b>${esc(r.ghost_status || "?")}</b></div>
      </div>

      <div class="mig-facts">
        <div><span class="mig-label">Old subscription</span>${subLine}</div>
        <div><span class="mig-label">Latest payment</span>${payLine}</div>
      </div>

      ${r.eligible ? "" : `<p class="mig-why is-${esc(r.kind)}">${esc(r.blocked_reason)}</p>`}

      <div class="mig-actions">
        <button type="button" class="kpi-btn" data-mig-do="cancel" ${r.eligible ? "" : "disabled"}>
          Cancel old subscription
        </button>
        ${pay
    ? `<a class="kpi-btn" href="${esc(pay.url)}" target="_blank" rel="noopener">Refund ${usd(pay.amount)} ↗</a>`
    : ""}
        <a class="kpi-btn kpi-btn--quiet" href="${esc(r.hubspot_contact_url)}" target="_blank" rel="noopener">Contact ↗</a>
        <button type="button" class="kpi-btn kpi-btn--quiet" data-mig-do="processed">Mark done</button>
      </div>
    </div>`;
  }

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

    els.list.innerHTML = queue.rows.length
      ? queue.rows.map(rowHtml).join("")
      : '<p class="kpi-empty">Queue is empty — nobody is waiting on a cancellation.</p>';
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
