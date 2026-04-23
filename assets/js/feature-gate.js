/*
 * Feature gate — blocks clicks on action-row buttons the current
 * visitor isn't entitled to, and presents a modal with the right
 * next step.
 *
 * Tier mapping (Ian, 2026-04-23):
 *   - Members (paid/comped):        audio, bookmark
 *   - Subscribers (any signed-in):  pdf, gift
 *   - Everyone:                     dark mode (no gate)
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
  var STATUS = (document.body.getAttribute("data-member-status") || "anonymous").toLowerCase();

  var FEATURES = {
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
      requires: "subscriber",
      eyebrow: "Free Subscriber",
      title: "Subscribe to download PDFs",
      body: "Become a free subscriber and we'll email a magic link to verify your address. You'll come right back to this essay.",
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
    function (e) {
      var btn = e.target.closest("[data-feature-gate]");
      if (!btn) return;
      var name = btn.getAttribute("data-feature-gate");
      var feature = FEATURES[name];
      if (!feature) return;
      if (hasAccess(feature)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      showModal(name, feature, btn);
    },
    true
  );

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

    var inner;
    if (feature.requires === "subscriber") {
      inner = subscriberInner(featureName, feature);
    } else {
      inner = memberInner(feature);
    }

    overlay.innerHTML =
      '<div class="feature-gate-modal-backdrop" data-fg-dismiss></div>' +
      '<div class="feature-gate-modal-panel">' +
        '<button class="feature-gate-modal-close" type="button" data-fg-dismiss aria-label="Close">&times;</button>' +
        '<p class="eyebrow">' + escapeHtml(feature.eyebrow) + '</p>' +
        '<h3 id="fg-modal-title" class="feature-gate-modal-title">' + escapeHtml(feature.title) + '</h3>' +
        '<p class="feature-gate-modal-body">' + escapeHtml(feature.body) + '</p>' +
        inner +
      '</div>';

    document.body.appendChild(overlay);
    modalEl = overlay;
    document.body.classList.add("feature-gate-modal-open");

    overlay.addEventListener("click", function (e) {
      if (e.target.closest("[data-fg-dismiss]")) dismissModal();
    });
    document.addEventListener("keydown", escHandler);

    requestAnimationFrame(function () {
      overlay.classList.add("is-visible");
      var first =
        overlay.querySelector("#fg-email") ||
        overlay.querySelector(".feature-gate-modal-cta");
      if (first) first.focus();
    });
  }

  function subscriberInner(featureName, feature) {
    // Mirrors partials/digest-cta.hbs form structure so inline-signup.js
    // picks it up unchanged.
    return (
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
      '</div>'
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
