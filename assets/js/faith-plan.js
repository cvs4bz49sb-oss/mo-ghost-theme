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
  /* Available to everyone. It began as a way of collecting an address
     from strangers, but a reading plan is a feature, and a subscriber or
     a member has as much reason to want one. What changes for someone
     signed in is that we stop asking for details we already hold. */
  const memberEmail = document.body.getAttribute("data-member-email") || "";
  const memberName = document.body.getAttribute("data-member-name") || "";
  const signedIn = !!memberEmail;

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

  const state = { mode: "time", minutes: 15, per: 1, days: "1234567", variant: "original", step: 0 };
  /* 1, 2, 3, 4. The old list skipped 4, which looked like it meant
     something and did not.

     Filtered against the work, because a fixed list offers a creed with
     three sections a plan of five per email. Nothing is offered that
     would produce fewer than two instalments, since one email is not a
     reading plan. */
  const SECTIONS_PER = [1, 2, 3, 4];
  const persFor = (n) => SECTIONS_PER.filter((p) => p === 1 || n / p >= 2);
  let est = null;

  // ── The trigger ───────────────────────────────────────────────
  mount.innerHTML =
    `<div class="fr-plan">
       <button type="button" class="fr-plan-open" data-plan-open>Make a reading plan</button>
     </div>`;

  // ── The dialog ────────────────────────────────────────────────
  const dlg = document.createElement("div");
  dlg.className = "fr-modal";
  dlg.hidden = true;
  dlg.innerHTML =
    `<div class="fr-modal-backdrop" data-plan-close></div>
     <div class="fr-modal-card" role="dialog" aria-modal="true" aria-label="Make a reading plan">
       <header class="fr-modal-head">
         <p class="fr-modal-title">Make a reading plan</p>
         <p class="fr-modal-work" data-plan-work></p>
         <button type="button" class="fr-modal-x" data-plan-close aria-label="Close">&times;</button>
       </header>
       <div class="fr-modal-main">
         <p class="fr-modal-q" data-plan-stepno></p>
         <div data-plan-body></div>
         <p class="fr-modal-note" data-plan-summary></p>
       </div>
       <footer class="fr-modal-foot">
         <span class="fr-dots" data-plan-dots aria-hidden="true"></span>
         <button type="button" class="fr-modal-back" data-plan-back>Back</button>
         <button type="button" class="fr-modal-next" data-plan-next>Next</button>
       </footer>
       <p class="fr-modal-status" data-plan-status hidden></p>
     </div>`;

  document.body.appendChild(dlg);

  const body = dlg.querySelector("[data-plan-body]");
  const stepNo = dlg.querySelector("[data-plan-stepno]");
  const backBtn = dlg.querySelector("[data-plan-back]");
  const nextBtn = dlg.querySelector("[data-plan-next]");
  const statusEl = dlg.querySelector("[data-plan-status]");
  const dotsEl = dlg.querySelector("[data-plan-dots]");
  const noteEl = dlg.querySelector("[data-plan-summary]");
  const workEl = dlg.querySelector("[data-plan-work]");

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));

  function summary() {
    if (!est) return "";
    const wk = est.weeks;
    const span = wk <= 8 ? `${wk} weeks` : `${Math.round(wk / 4.35)} months`;
    /* By time every instalment is the same size by construction, so the
       first one is a fair description of all of them. By section they
       vary enormously — Calvin's chapters run from about 1,100 words to
       well over twenty thousand — and quoting the first would promise a
       short read and deliver a long one. Average, and say so. */
    const bySection = est.mode === "section";
    const n = bySection ? est.wordsPerDay : est.firstDayWords;
    const each = (Math.round(n / 100) * 100).toLocaleString();
    return `${est.days.toLocaleString()} emails, ${
      bySection ? "averaging" : "about"} ${each} words each, over ${span}.`;
  }

  const STEPS = [
    {
      q: "How much at a time",
      render() {
        /* Some books are already divided, and dividing them again is
           vandalism: the Imitation is a hundred short chapters, a
           catechism is a sequence of questions, an article of a
           confession is the unit its author wrote. Offered only where
           the work actually has an outline. */
        const hasSections = est && est.sections > 1;
        const tabs = hasSections
          ? `<div class="fr-tabs">
               <button type="button" class="fr-tab${state.mode === "time" ? " is-on" : ""}" data-set-mode="time">By time</button>
               <button type="button" class="fr-tab${state.mode === "section" ? " is-on" : ""}" data-set-mode="section">By section</button>
             </div>`
          : "";
        if (hasSections && state.mode === "section") {
          const pers = persFor(est.sections);
          // A pace that no longer fits the work must not stay selected.
          if (pers.indexOf(state.per) === -1) state.per = pers[pers.length - 1];
          return `${tabs}<div class="fr-opts fr-opts--${pers.length}">${
            pers.map((n) => `<button type="button" class="fr-opt${n === state.per ? " is-on" : ""}" data-set-per="${n}">${n}</button>`).join("")
          }</div><p class="fr-opts-cap">${
            est.sections.toLocaleString()} sections in this work, ${
            state.per === 1 ? "one" : state.per} per email</p>`;
        }
        return `${tabs}<div class="fr-opts fr-opts--5">${
          PACES.map((m) => `<button type="button" class="fr-opt${m === state.minutes ? " is-on" : ""}" data-set-minutes="${m}">${m}</button>`).join("")
        }</div><p class="fr-opts-cap">minutes a day</p>`;
      },
    },
    {
      q: "Which days",
      render: () => `<div class="fr-opts fr-opts--7">${
        DAYS.map(([d, label]) => `<button type="button" class="fr-opt${state.days.indexOf(d) > -1 ? " is-on" : ""}" data-toggle-day="${d}" aria-pressed="${state.days.indexOf(d) > -1}">${label}</button>`).join("")
      }</div><p class="fr-opts-cap">tap to add or remove a day</p>`,
    },
    {
      q: "Which English",
      render: () => `<div class="fr-opts fr-opts--stack">
        <button type="button" class="fr-opt fr-opt--wide${state.variant === "original" ? " is-on" : ""}" data-set-variant="original">
          Original spelling<span>As the work was printed.</span></button>
        <button type="button" class="fr-opt fr-opt--wide${state.variant === "modern" ? " is-on" : ""}" data-set-variant="modern">
          Modern English<span>Hath becomes has, saith becomes says, etc.</span></button>
      </div>`,
    },
    {
      q: "Where to send it",
      render: () => (signedIn
        ? `<p class="fr-modal-to">Sent to <strong>${esc(memberEmail)}</strong>.</p>
           <p class="fr-opts-cap">Not the right address? Change it in your account.</p>`
        : `<form class="fr-modal-form" data-plan-form>
        <div class="fr-modal-row">
          <input type="text" name="first" placeholder="First name" autocomplete="given-name" required />
          <input type="text" name="last" placeholder="Last name" autocomplete="family-name" required />
        </div>
        <input type="email" name="email" placeholder="Email" autocomplete="email" required />
      </form>`),
    },
  ];

  function paint() {
    const s = STEPS[state.step];
    stepNo.textContent = s.q;
    body.innerHTML = s.render();
    dotsEl.innerHTML = STEPS.map((_, i) =>
      `<i class="fr-dot${i === state.step ? " is-on" : ""}"></i>`).join("");
    // The numbers sit in one place all the way through, so the figure a
    // reader is weighing does not move around the card.
    noteEl.textContent = summary();
    backBtn.disabled = state.step === 0;
    nextBtn.textContent = state.step === STEPS.length - 1 ? "Start reading" : "Next";
  }

  let estSeq = 0;
  let estTimer = 0;
  function refreshEstimate() {
    window.clearTimeout(estTimer);
    estTimer = window.setTimeout(() => {
      const seq = ++estSeq;
      fetch(`${API}/estimate?c=${encodeURIComponent(corpus)}&w=${encodeURIComponent(slug)}&minutes=${state.minutes}&days=${state.days}&mode=${state.mode}&per=${state.per}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          // A later question is already out; this answer is stale.
          if (seq !== estSeq) return;
          if (!d || d.error || !d.days) { mount.hidden = true; return; }
          est = d;
          noteEl.textContent = summary();
        })
        .catch(() => {});
    }, 220);
  }

  // Delegated: the body is rewritten on every step.
  body.addEventListener("click", (e) => {
    const md = e.target.closest("[data-set-mode]");
    if (md) { state.mode = md.getAttribute("data-set-mode"); paint(); refreshEstimate(); return; }
    const pr = e.target.closest("[data-set-per]");
    if (pr) { state.per = parseInt(pr.getAttribute("data-set-per"), 10); paint(); refreshEstimate(); return; }
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
    // Read the title now rather than at load. The reader ships
    // <h1 data-fr-title>Loading…</h1> and fills it in once the work has
    // been fetched, so anything captured at init is the placeholder,
    // and the card sat there saying "Loading…" for good.
    const t = document.querySelector("[data-fr-title]");
    const name = t ? t.textContent.trim() : "";
    workEl.textContent = /^loading/i.test(name) ? "" : name;
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
    if (form && !form.reportValidity()) return;
    const first = signedIn ? memberName.split(" ")[0] : form.first.value.trim();
    const last = signedIn ? memberName.split(" ").slice(1).join(" ") : form.last.value.trim();
    const email = signedIn ? memberEmail : form.email.value.trim();

    nextBtn.disabled = true;
    statusEl.hidden = false;
    statusEl.textContent = "Setting up your plan…";

    fetch(`${API}/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        c: corpus, w: slug,
        minutes: state.minutes, mode: state.mode, per: state.per,
        days: state.days, variant: state.variant,
        name: first, last, email, source: "tfr-work",
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.ok) throw new Error((d && d.error) || "failed");
        // Only a stranger needs an account made. Signing an existing
        // member up again would send them a magic link they did not ask
        // for.
        if (!signedIn) ghostSignup(first, last, email);
        dlg.querySelector(".fr-modal-main").hidden = true;
        dlg.querySelector(".fr-modal-foot").hidden = true;
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
