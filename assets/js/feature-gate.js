/*
 * Feature gate — blocks clicks on action-row buttons the current
 * visitor isn't entitled to, and presents a modal with the right
 * next step.
 *
 * Tier mapping (Ian, 2026-04-23; pdf moved to member 2026-09-02):
 *   - Members (paid/comped):        audio, bookmark, pdf
 *   - Subscribers (any signed-in):  gift
 *   - Everyone:                     dark mode (no gate)
 *
 * pdf was listed as subscriber-tier here while article-pdf.js required
 * paid and hard-redirected to /membership/ when it didn't find it. A free
 * subscriber therefore passed this gate, got no modal, and was bounced off
 * the essay with no explanation. Anselm House reported it on 2026-08-29.
 * Resolved in favour of member-tier: the modal now says so, and the same
 * check is enforced in article-pdf.js and in mo-pdf's /sign endpoint.
 *
 * Subscriber-tier features → modal with an inline Ghost magic-link
 * signup form. On submit, Ghost emails a verify link that redirects
 * back to the current post; the subscriber stays on the article.
 *
 * Member-tier features → modal with a prominent "Become a Member"
 * CTA to /membership/, since upgrade needs Stripe checkout, not an
 * email form.
 *
 * Member status comes from body[data-member-status] which default.hbs
 * writes for signed-in users. Missing attribute = anonymous.
 *
 * Capture-phase click handler with stopImmediatePropagation so the
 * existing per-feature handlers (article-audio.js, article-bookmark.js,
 * article-gift.js) don't ALSO fire alongside the gate.
 */
(function () {
  let STATUS = (document.body.getAttribute("data-member-status") || "anonymous").toLowerCase();

  // QA override: ?gate=force on any URL forces STATUS to anonymous
  // so every gated button fires. Persists to sessionStorage for
  // tab-internal navigation. ?gate=off clears.
  let forced = false;
  try {
    const params = new URLSearchParams(window.location.search);
    const g = params.get("gate");
    if (g === "force") sessionStorage.setItem("mo-gate-force", "1");
    if (g === "off") sessionStorage.removeItem("mo-gate-force");
    forced = sessionStorage.getItem("mo-gate-force") === "1";
  } catch (e) { /* private mode — ignore */ }

  if (forced) {
    STATUS = "anonymous";
  }

  const FEATURES = {
    audio: {
      requires: "member",
      eyebrow: "Members Only",
      title: "Audio articles are for members",
      body: "Members get audio on every essay, the print journal, Discord, and a growing library of benefits. Support the work to unlock it all.",
    },
    bookmark: {
      requires: "member",
      eyebrow: "Members Only",
      title: "Bookmarks are for members",
      body: "Members get saved essays, the print journal, Discord, and a growing library of benefits. Support the work to unlock it all.",
    },
    pdf: {
      requires: "member",
      eyebrow: "Members Only",
      title: "PDFs are for members",
      body: "Members get downloadable PDFs of every essay, the print journal, Discord, and a growing library of benefits. Support the work to unlock it all.",
    },
    gift: {
      requires: "subscriber",
      eyebrow: "Free Subscriber",
      title: "Subscribe to gift essays",
      body: "Become a free subscriber and we'll email a magic link to verify your address. You'll come right back to this essay.",
    },
  };

  function hasAccess(feature) {
    if (feature.requires === "subscriber") {
      return STATUS === "free" || STATUS === "paid" || STATUS === "comped";
    }
    if (feature.requires === "member") {
      return STATUS === "paid" || STATUS === "comped";
    }
    return true;
  }

  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest("[data-feature-gate]");
      if (!btn) return;
      const name = btn.getAttribute("data-feature-gate");
      const feature = FEATURES[name];
      if (!feature) return;
      if (hasAccess(feature)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      showModal(name, feature, btn);
    },
    true
  );

  let modalEl = null;
  let modalOpener = null;

  function showModal(featureName, feature, opener) {
    dismissModal(true);
    modalOpener = opener;

    const overlay = document.createElement("div");
    overlay.className = "feature-gate-modal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "fg-modal-title");

    // Build the panel scaffold via DOM construction (textContent for
    // anything dynamic). Pass 3 #7 in audits/SYNTHESIS.md flagged
    // this innerHTML pattern as fragile — same H4 class. Inner
    // contents (subscriberInner / memberInner) are hardcoded strings
    // so they remain innerHTML for now; if any data-driven field
    // ever lands inside them, convert those too.
    const backdrop = document.createElement("div");
    backdrop.className = "feature-gate-modal-backdrop";
    backdrop.setAttribute("data-fg-dismiss", "");

    const panel = document.createElement("div");
    panel.className = "feature-gate-modal-panel";

    const closeBtn = document.createElement("button");
    closeBtn.className = "feature-gate-modal-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("data-fg-dismiss", "");
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×"; // ×

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = feature.eyebrow;

    const title = document.createElement("h3");
    title.id = "fg-modal-title";
    title.className = "feature-gate-modal-title";
    title.textContent = feature.title;

    const bodyP = document.createElement("p");
    bodyP.className = "feature-gate-modal-body";
    bodyP.textContent = feature.body;

    panel.append(closeBtn, eyebrow, title, bodyP);

    const innerWrap = document.createElement("div");
    if (feature.requires === "subscriber") {
      innerWrap.innerHTML = subscriberInner(featureName, feature);
    } else {
      innerWrap.innerHTML = memberInner(feature);
    }
    while (innerWrap.firstChild) panel.appendChild(innerWrap.firstChild);

    overlay.append(backdrop, panel);

    document.body.appendChild(overlay);
    modalEl = overlay;
    document.body.classList.add("feature-gate-modal-open");

    overlay.addEventListener("click", (e) => {
      if (e.target.closest("[data-fg-dismiss]")) dismissModal();
    });
    document.addEventListener("keydown", escHandler);

    requestAnimationFrame(() => {
      overlay.classList.add("is-visible");
      const first =
        overlay.querySelector("#fg-email") ||
        overlay.querySelector(".feature-gate-modal-cta");
      if (first) first.focus();
    });
  }

  function subscriberInner(featureName, feature) {
    // Mirrors partials/digest-cta.hbs form structure so inline-signup.js
    // picks it up unchanged.
    return (
      `<div class="feature-gate-modal-form digest-form" data-inline-signup data-source="feature-gate:${escapeAttr(featureName)}">` +
        `<div class="digest-field"><label for="fg-first">First Name</label>` +
          `<input id="fg-first" type="text" autocomplete="given-name" placeholder="First" data-signup-first required /></div>` +
        `<div class="digest-field"><label for="fg-last">Last Name</label>` +
          `<input id="fg-last" type="text" autocomplete="family-name" placeholder="Last" data-signup-last required /></div>` +
        `<div class="digest-field"><label for="fg-email">Email</label>` +
          `<input id="fg-email" type="email" autocomplete="email" placeholder="you@example.com" data-signup-email required /></div>` +
        `<button type="button" class="digest-submit" data-signup-submit>Subscribe</button>` +
        `<p class="digest-fineprint">Free. Unsubscribe anytime.</p>` +
        `<p class="digest-status" data-signup-status></p>` +
      `</div>`
    );
  }

  function memberInner() {
    return (
      '<div class="feature-gate-modal-actions">' +
        '<a href="/membership/" class="feature-gate-modal-cta btn btn-primary">Become a Member</a>' +
      '</div>'
    );
  }

  function escHandler(e) {
    if (e.key === "Escape") dismissModal();
  }

  function dismissModal(immediate) {
    if (!modalEl) return;
    const m = modalEl;
    modalEl = null;
    document.removeEventListener("keydown", escHandler);
    document.body.classList.remove("feature-gate-modal-open");
    if (immediate) { m.remove(); restoreFocus(); return; }
    m.classList.add("is-closing");
    setTimeout(() => { if (m.parentNode) m.remove(); restoreFocus(); }, 220);
  }

  function restoreFocus() {
    if (modalOpener && modalOpener.focus) {
      try { modalOpener.focus(); } catch (e) { /* no-op */ }
    }
    modalOpener = null;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) {
    return String(s).replace(/["<>]/g, (c) => {
      return { '"': "&quot;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }
})();
