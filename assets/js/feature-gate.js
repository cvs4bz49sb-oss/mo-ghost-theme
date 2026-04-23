/*
 * Feature gate — blocks clicks on action-row buttons the current
 * visitor isn't entitled to, and presents either an inline signup
 * modal (for subscriber-tier features) or a CTA pill (for member-
 * tier features).
 *
 * Tier mapping (Ian, 2026-04-23):
 *   - Members (paid/comped):        audio, bookmark
 *   - Subscribers (any signed-in):  pdf, gift
 *   - Everyone:                     dark mode (no gate)
 *
 * Signed-out visitor clicks a Subscriber feature → modal opens with
 * a Ghost magic-link signup form. On submit, Ghost emails a verify
 * link that redirects back to the same post. They stay on the
 * article, never leave for /#digest.
 *
 * Signed-out or free-tier visitor clicks a Member feature → toast
 * pill with "Become a Member" CTA to /membership/. Member upgrade
 * is Stripe-backed so it belongs on the membership page, not a
 * modal.
 *
 * Member status comes from body[data-member-status] which default.hbs
 * writes for signed-in users. Missing attribute = anonymous.
 *
 * Capture-phase click handler with stopImmediatePropagation so the
 * existing per-feature handlers (article-audio.js, article-bookmark.js,
 * article-gift.js) don't ALSO fire alongside the gate.
 */
(function () {
  var STATUS = (document.body.getAttribute("data-member-status") || "anonymous").toLowerCase();

  var FEATURES = {
    audio: {
      requires: "member",
      ctaText: "Become a Member",
      ctaUrl: "/membership/",
      pillMessage: "Audio articles are for members who support the work.",
    },
    bookmark: {
      requires: "member",
      ctaText: "Become a Member",
      ctaUrl: "/membership/",
      pillMessage: "Bookmarks are for members who support the work.",
    },
    pdf: {
      requires: "subscriber",
      modalTitle: "Subscribe to download PDFs",
      modalBody: "Join the free Weekly Digest. We'll email a magic link to verify your address, and you'll come right back to this essay.",
    },
    gift: {
      requires: "subscriber",
      modalTitle: "Subscribe to gift essays",
      modalBody: "Join the free Weekly Digest. We'll email a magic link to verify your address, and you'll come right back to this essay.",
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
    function (e) {
      var btn = e.target.closest("[data-feature-gate]");
      if (!btn) return;
      var name = btn.getAttribute("data-feature-gate");
      var feature = FEATURES[name];
      if (!feature) return;
      if (hasAccess(feature)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (feature.requires === "subscriber") {
        showModal(name, feature, btn);
      } else {
        showPill(feature);
      }
    },
    true
  );

  // -----------------------------------------------------------------
  // Pill (member-tier features)
  // -----------------------------------------------------------------

  var pillEl = null;
  var pillTimer = null;

  function showPill(feature) {
    dismissPill(true);
    var p = document.createElement("div");
    p.className = "feature-gate-popup";
    p.setAttribute("role", "alert");
    p.innerHTML =
      '<p class="feature-gate-message">' + escapeHtml(feature.pillMessage) + "</p>" +
      '<a href="' + escapeAttr(feature.ctaUrl) + '" class="feature-gate-cta">' +
      escapeHtml(feature.ctaText) + " &rarr;</a>" +
      '<button class="feature-gate-close" type="button" aria-label="Dismiss">&times;</button>';
    document.body.appendChild(p);
    pillEl = p;
    p.querySelector(".feature-gate-close").addEventListener("click", function () {
      dismissPill();
    });
    pillTimer = setTimeout(dismissPill, 8000);
    requestAnimationFrame(function () { p.classList.add("is-visible"); });
  }

  function dismissPill(immediate) {
    if (pillTimer) { clearTimeout(pillTimer); pillTimer = null; }
    if (!pillEl) return;
    var p = pillEl;
    pillEl = null;
    if (immediate) { p.remove(); return; }
    p.classList.add("is-closing");
    setTimeout(function () { if (p.parentNode) p.remove(); }, 220);
  }

  // -----------------------------------------------------------------
  // Modal (subscriber-tier features)
  // -----------------------------------------------------------------

  var modalEl = null;
  var modalOpener = null;

  function showModal(featureName, feature, opener) {
    dismissModal(true);
    modalOpener = opener;

    var overlay = document.createElement("div");
    overlay.className = "feature-gate-modal";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "fg-modal-title");
    overlay.innerHTML =
      '<div class="feature-gate-modal-backdrop" data-fg-dismiss></div>' +
      '<div class="feature-gate-modal-panel">' +
        '<button class="feature-gate-modal-close" type="button" data-fg-dismiss aria-label="Close">&times;</button>' +
        '<p class="eyebrow">The Weekly Digest</p>' +
        '<h3 id="fg-modal-title" class="feature-gate-modal-title">' + escapeHtml(feature.modalTitle) + '</h3>' +
        '<p class="feature-gate-modal-body">' + escapeHtml(feature.modalBody) + '</p>' +
        '<div class="feature-gate-modal-form digest-form" data-inline-signup data-source="feature-gate:' + escapeAttr(featureName) + '">' +
          '<div class="digest-field"><label for="fg-first">First Name</label>' +
            '<input id="fg-first" type="text" autocomplete="given-name" placeholder="First" data-signup-first required /></div>' +
          '<div class="digest-field"><label for="fg-last">Last Name</label>' +
            '<input id="fg-last" type="text" autocomplete="family-name" placeholder="Last" data-signup-last required /></div>' +
          '<div class="digest-field"><label for="fg-email">Email</label>' +
            '<input id="fg-email" type="email" autocomplete="email" placeholder="you@example.com" data-signup-email required /></div>' +
          '<button type="button" class="digest-submit" data-signup-submit>Subscribe</button>' +
          '<p class="digest-fineprint">Free. Unsubscribe anytime.</p>' +
          '<p class="digest-status" data-signup-status></p>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    modalEl = overlay;
    document.body.classList.add("feature-gate-modal-open");

    // Click on backdrop or explicit close element dismisses.
    overlay.addEventListener("click", function (e) {
      if (e.target.closest("[data-fg-dismiss]")) dismissModal();
    });
    document.addEventListener("keydown", escHandler);

    requestAnimationFrame(function () {
      overlay.classList.add("is-visible");
      var first = overlay.querySelector("#fg-email");
      if (first) first.focus();
    });
  }

  function escHandler(e) {
    if (e.key === "Escape") dismissModal();
  }

  function dismissModal(immediate) {
    if (!modalEl) return;
    var m = modalEl;
    modalEl = null;
    document.removeEventListener("keydown", escHandler);
    document.body.classList.remove("feature-gate-modal-open");
    if (immediate) { m.remove(); restoreFocus(); return; }
    m.classList.add("is-closing");
    setTimeout(function () { if (m.parentNode) m.remove(); restoreFocus(); }, 220);
  }

  function restoreFocus() {
    if (modalOpener && modalOpener.focus) {
      try { modalOpener.focus(); } catch (e) { /* no-op */ }
    }
    modalOpener = null;
  }

  // -----------------------------------------------------------------

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) {
    return String(s).replace(/["<>]/g, function (c) {
      return { '"': "&quot;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }
})();
