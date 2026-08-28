/*
 * "Make a reading plan" — the offer on every work, and the dialog behind it.
 *
 * WHY A BUTTON AND NOT A FORM
 *
 * The inline version asked four questions on the title page of a
 * sixteenth-century folio, which is three too many for a page somebody
 * came to in order to read. One button costs a reader nothing to
 * ignore. Everything else happens after they have said yes to the idea.
 *
 * WHY THE EMAIL IS LAST
 *
 * The steps run pace, days, English, then name and address. Someone who
 * has chosen a pace and a schedule has decided to read the thing; asking
 * for the address first asks them to pay before they know the price. It
 * also means every question before the last one is about the reading
 * rather than about us.
 *
 * Hidden entirely for signed-in members, who have the reader's own tools
 * and do not need to be sold an email.
 */
(function () {
  const mount = document.querySelector("[data-fr-plan]");
  if (!mount) return;

  const API = (mount.getAttribute("data-plans-url") || "").replace(/\/$/, "");
  if (!API) return;
  if (document.body.getAttribute("data-member-email")) return;

  let slug = "", corpus = "tfr";
  try {
    const q = new URLSearchParams(window.location.search);
    slug = (q.get("w") || "").replace(/[^a-z0-9_-]/gi, "");
    corpus = (q.get("c") || "tfr").replace(/[^a-z0-9_-]/gi, "");
  } catch (_) { /* no query */ }
  if (!slug) return;

  const PACES = [5, 10, 15, 20, 30];
  const DAYS = [
    ["1", "M"], ["2", "T"], ["3", "W"], ["4", "T"], ["5", "F"], ["6", "S"], ["7", "S"],
  ];

  const state = { minutes: 15, days: "1234567", variant: "original", step: 0 };
  let est = null;

  // ── The trigger ───────────────────────────────────────────────
  mount.innerHTML =
    `<div class="fr-plan">
       <button type="button" class="fr-plan-open" data-plan-open>Make a reading plan</button>
       <span class="fr-plan-hint" data-plan-hint></span>
     </div>`;

  const hint = mount.querySelector("[data-plan-hint]");

  // ── The dialog ────────────────────────────────────────────────
  const dlg = document.createElement("div");
  dlg.className = "fr-modal";
  dlg.hidden = true;
  dlg.innerHTML =
    `<div class="fr-modal-backdrop" data-plan-close></div>
     <div class="fr-modal-card" role="dialog" aria-modal="true" aria-label="Make a reading plan">
       <button type="button" class="fr-modal-x" data-plan-close aria-label="Close">&times;</button>
       <p class="fr-modal-step" data-plan-stepno></p>
       <div data-plan-body></div>
       <div class="fr-modal-nav">
         <button type="button" class="fr-modal-back" data-plan-back>Back</button>
         <button type="button" class="fr-modal-next" data-plan-next>Next</button>
       </div>
       <p class="fr-modal-status" data-plan-status hidden></p>
     </div>`;
  document.body.appendChild(dlg);

  const body = dlg.querySelector("[data-plan-body]");
  const stepNo = dlg.querySelector("[data-plan-stepno]");
  const backBtn = dlg.querySelector("[data-plan-back]");
  const nextBtn = dlg.querySelector("[data-plan-next]");
  const statusEl = dlg.querySelector("[data-plan-status]");

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));

  function summary() {
    if (!est) return "";
    const wk = est.weeks;
    const span = wk <= 8 ? `${wk} weeks` : `${Math.round(wk / 4.35)} months`;
    return `${est.days.toLocaleString()} emails, about ${
      (Math.round(est.firstDayWords / 100) * 100).toLocaleString()} words each, over ${span}.`;
  }

  const STEPS = [
    {
      title: "How much at a time",
      render: () => `<div class="fr-opts">${
        PACES.map((m) => `<button type="button" class="fr-opt${m === state.minutes ? " is-on" : ""}" data-set-minutes="${m}">${m} minutes</button>`).join("")
      }</div><p class="fr-modal-note" data-plan-summary>${esc(summary())}</p>`,
    },
    {
      title: "Which days",
      render: () => `<div class="fr-opts">${
        DAYS.map(([d, label]) => `<button type="button" class="fr-opt fr-opt--day${state.days.indexOf(d) > -1 ? " is-on" : ""}" data-toggle-day="${d}" aria-pressed="${state.days.indexOf(d) > -1}">${label}</button>`).join("")
      }</div><p class="fr-modal-note" data-plan-summary>${esc(summary())}</p>`,
    },
    {
      title: "Which English",
      render: () => `<div class="fr-opts fr-opts--stack">
        <button type="button" class="fr-opt${state.variant === "original" ? " is-on" : ""}" data-set-variant="original">
          Original spelling<span>As the work was printed.</span></button>
        <button type="button" class="fr-opt${state.variant === "modern" ? " is-on" : ""}" data-set-variant="modern">
          Modern English<span>Archaic forms updated. Hath becomes has, saith becomes says.</span></button>
      </div>`,
    },
    {
      title: "Where to send it",
      render: () => `<form class="fr-modal-form" data-plan-form>
        <input type="text" name="first" placeholder="First name" autocomplete="given-name" required />
        <input type="text" name="last" placeholder="Last name" autocomplete="family-name" required />
        <input type="email" name="email" placeholder="Email" autocomplete="email" required />
      </form><p class="fr-modal-note">${esc(summary())}</p>`,
    },
  ];

  function paint() {
    const s = STEPS[state.step];
    stepNo.textContent = `Step ${state.step + 1} of ${STEPS.length} · ${s.title}`;
    body.innerHTML = s.render();
    backBtn.hidden = state.step === 0;
    nextBtn.textContent = state.step === STEPS.length - 1 ? "Start reading" : "Next";
  }

  /*
   * Debounced, and sequenced.
   *
   * Turning four days off fires four requests, and a big work takes a
   * second or two to divide, so without a guard whichever reply lands
   * last wins rather than whichever was asked last. That is not a
   * cosmetic race: it showed Monday/Wednesday/Friday as nine months
   * when the answer is sixteen, which is exactly the number somebody
   * uses to decide whether to start.
   */
  let estSeq = 0;
  let estTimer = 0;
  function refreshEstimate() {
    window.clearTimeout(estTimer);
    estTimer = window.setTimeout(() => {
      const seq = ++estSeq;
      fetch(`${API}/estimate?c=${encodeURIComponent(corpus)}&w=${encodeURIComponent(slug)}&minutes=${state.minutes}&days=${state.days}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          // A later question is already out; this answer is stale.
          if (seq !== estSeq) return;
          if (!d || d.error || !d.days) { mount.hidden = true; return; }
          est = d;
          hint.textContent = summary();
          const el = body.querySelector("[data-plan-summary]");
          if (el) el.textContent = summary();
        })
        .catch(() => {});
    }, 220);
  }

  // Delegated: the body is rewritten on every step.
  body.addEventListener("click", (e) => {
    const m = e.target.closest("[data-set-minutes]");
    if (m) { state.minutes = parseInt(m.getAttribute("data-set-minutes"), 10); paint(); refreshEstimate(); return; }
    const v = e.target.closest("[data-set-variant]");
    if (v) { state.variant = v.getAttribute("data-set-variant"); paint(); return; }
    const d = e.target.closest("[data-toggle-day]");
    if (d) {
      const k = d.getAttribute("data-toggle-day");
      const set = new Set(state.days.split(""));
      if (set.has(k)) set.delete(k); else set.add(k);
      // Never let them arrive at a plan that sends nothing.
      if (!set.size) set.add(k);
      state.days = [...set].sort().join("");
      paint(); refreshEstimate();
    }
  });

  function open() {
    dlg.hidden = false;
    document.body.style.overflow = "hidden";
    state.step = 0;
    paint();
    refreshEstimate();
  }
  function close() {
    dlg.hidden = true;
    document.body.style.overflow = "";
  }

  mount.querySelector("[data-plan-open]").addEventListener("click", open);
  dlg.querySelectorAll("[data-plan-close]").forEach((b) => b.addEventListener("click", close));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !dlg.hidden) close(); });
  backBtn.addEventListener("click", () => { if (state.step > 0) { state.step--; paint(); } });

  /*
   * Ghost signup, the same call the rest of the site makes. A reading
   * plan should make somebody a free member, so mo-kit mirrors them into
   * Kit with their provenance and they are counted where members are
   * counted. It runs after the plan is stored and its failure is
   * swallowed: they asked for a reading plan, not an account.
   */
  function ghostSignup(first, last, email) {
    return fetch("/members/api/integrity-token/", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("integrity"))))
      .then((integrityToken) => fetch("/members/api/send-magic-link/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email, emailType: "signup",
          name: [first, last].filter(Boolean).join(" "),
          labels: ["source:tfr-plan"],
          requestSrc: "portal",
          redirect: window.location.href,
          integrityToken,
        }),
      }))
      .catch(() => null);
  }

  nextBtn.addEventListener("click", () => {
    if (state.step < STEPS.length - 1) { state.step++; paint(); refreshEstimate(); return; }

    const form = body.querySelector("[data-plan-form]");
    if (!form.reportValidity()) return;
    const first = form.first.value.trim();
    const last = form.last.value.trim();
    const email = form.email.value.trim();

    nextBtn.disabled = true;
    statusEl.hidden = false;
    statusEl.textContent = "Setting up your plan…";

    fetch(`${API}/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        c: corpus, w: slug,
        minutes: state.minutes, days: state.days, variant: state.variant,
        name: first, last, email, source: "tfr-work",
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.ok) throw new Error((d && d.error) || "failed");
        ghostSignup(first, last, email);
        body.innerHTML = "";
        stepNo.textContent = "";
        dlg.querySelector(".fr-modal-nav").hidden = true;
        statusEl.textContent =
          `Set. ${d.days.toLocaleString()} emails, starting tomorrow. The first one confirms it.`;
      })
      .catch(() => {
        statusEl.textContent = "That did not go through. Try again in a moment.";
        nextBtn.disabled = false;
      });
  });

  refreshEstimate();
})();
