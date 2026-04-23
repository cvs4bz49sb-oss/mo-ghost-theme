/*
 * Feature gate — shows a "subscribe / become a member" popup when
 * a user without the required access clicks a gated button in the
 * post action row.
 *
 * Tier mapping (Ian, 2026-04-23):
 *   - Members (paid or comped):     audio, bookmark
 *   - Subscribers (any signed-in):  pdf, gift
 *   - Everyone:                     dark mode (no gate)
 *
 * How it works:
 *   - Reads body[data-member-status] (anonymous | free | paid | comped)
 *     which default.hbs writes from @member on every page.
 *   - Intercepts click events in the CAPTURE phase on any element
 *     with [data-feature-gate]. If the user lacks access, blocks the
 *     click (stopImmediatePropagation + preventDefault) and shows a
 *     bottom-center toast pill with a CTA. If the user has access,
 *     does nothing — the existing per-feature handler runs.
 *
 * Why capture phase: article-audio.js, article-bookmark.js, and
 * article-gift.js wire their own bubble-phase handlers. By grabbing
 * the click first in capture and calling stopImmediatePropagation,
 * we ensure the popup fires instead of (not alongside) the existing
 * redirect-to-/membership/ behavior those handlers had for non-paid
 * users.
 */
(function () {
  var STATUS = (document.body.getAttribute("data-member-status") || "anonymous").toLowerCase();

  var FEATURES = {
    audio: {
      requires: "member",
      message: "Audio articles are for members who support the work.",
      ctaText: "Become a Member",
      ctaUrl: "/membership/",
    },
    bookmark: {
      requires: "member",
      message: "Bookmarks are for members who support the work.",
      ctaText: "Become a Member",
      ctaUrl: "/membership/",
    },
    pdf: {
      requires: "subscriber",
      message: "PDF downloads are for subscribers.",
      ctaText: "Subscribe (free)",
      ctaUrl: "/#digest",
    },
    gift: {
      requires: "subscriber",
      message: "Gifting essays is for subscribers.",
      ctaText: "Subscribe (free)",
      ctaUrl: "/#digest",
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
      showPopup(feature);
    },
    true
  );

  var current = null;
  var dismissTimer = null;

  function showPopup(feature) {
    dismissCurrent(true);

    var pop = document.createElement("div");
    pop.className = "feature-gate-popup";
    pop.setAttribute("role", "alert");
    pop.innerHTML =
      '<p class="feature-gate-message">' +
      escapeHtml(feature.message) +
      '</p>' +
      '<a href="' +
      escapeAttr(feature.ctaUrl) +
      '" class="feature-gate-cta">' +
      escapeHtml(feature.ctaText) +
      ' &rarr;</a>' +
      '<button class="feature-gate-close" type="button" aria-label="Dismiss">&times;</button>';

    document.body.appendChild(pop);
    current = pop;

    pop.querySelector(".feature-gate-close").addEventListener("click", function () {
      dismissCurrent();
    });

    dismissTimer = setTimeout(dismissCurrent, 8000);

    requestAnimationFrame(function () {
      pop.classList.add("is-visible");
    });
  }

  function dismissCurrent(immediate) {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    if (!current) return;
    var pop = current;
    current = null;
    if (immediate) {
      pop.remove();
      return;
    }
    pop.classList.add("is-closing");
    setTimeout(function () {
      if (pop.parentNode) pop.remove();
    }, 220);
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
