/*
 * Inline subscribe flow.
 *
 * Any element with [data-inline-signup] becomes a self-contained
 * Subscribe form. Click on [data-signup-submit] within it posts
 * directly to Ghost's /members/api/send-magic-link/ endpoint, then
 * swaps the form for an inline success message. No Portal modal
 * flash, no redirect — the magic link the subscriber receives carries
 * a `redirect` param back to the current page so they land where they
 * left off once they confirm.
 *
 * Expected markup:
 *   <div data-inline-signup>
 *     <input data-signup-first>
 *     <input data-signup-last>
 *     <input data-signup-email required>
 *     <button data-signup-submit>Subscribe</button>
 *     <p data-signup-status></p>    <!-- optional -->
 *   </div>
 *
 * Event delegation so dynamically-injected forms (e.g. the post gate
 * card) work without init.
 */
(function () {
  var MAGIC_URL = "/members/api/send-magic-link/";
  var INTEGRITY_URL = "/members/api/integrity-token/";

  document.addEventListener("click", function (e) {
    var submit = e.target && e.target.closest && e.target.closest("[data-signup-submit]");
    if (!submit) return;
    var root = submit.closest("[data-inline-signup]");
    if (!root) return;
    e.preventDefault();
    handleSubmit(root, submit);
  });

  // Enter-in-email triggers submit too.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    var target = e.target;
    if (!target || !target.matches) return;
    if (!target.matches("[data-inline-signup] [data-signup-email]")) return;
    var root = target.closest("[data-inline-signup]");
    var submit = root && root.querySelector("[data-signup-submit]");
    if (submit) {
      e.preventDefault();
      handleSubmit(root, submit);
    }
  });

  function handleSubmit(root, submit) {
    var emailInput = root.querySelector("[data-signup-email]");
    if (!emailInput) return;
    var email = (emailInput.value || "").trim();
    if (!email || !/.+@.+\..+/.test(email)) {
      setStatus(root, "Enter a valid email address.", true);
      return;
    }
    var first = getValue(root, "[data-signup-first]");
    var last = getValue(root, "[data-signup-last]");
    var name = [first, last].filter(Boolean).join(" ");

    var originalText = submit.textContent;
    submit.disabled = true;
    submit.textContent = "Subscribing\u2026";
    setStatus(root, "");

    var labels = buildContextLabels(root);

    // Ghost 5.x requires an integrity token fetched from a dedicated
    // endpoint (anti-abuse). The token is single-use and short-lived,
    // so it has to be fetched per-submit, not cached.
    fetch(INTEGRITY_URL, { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (integrityToken) {
        return fetch(MAGIC_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: email,
            emailType: "signup",
            name: name,
            labels: labels,
            requestSrc: "portal",
            redirect: window.location.href,
            integrityToken: integrityToken,
          }),
          credentials: "same-origin",
        });
      })
      .then(function (res) {
        if (res.ok) return null;
        return res.json().then(
          function (j) {
            var msg = j && j.errors && j.errors[0] && j.errors[0].message;
            throw new Error(msg || "Something went wrong. Try again.");
          },
          function () { throw new Error("Something went wrong. Try again."); }
        );
      })
      .then(function () { renderSuccess(root, email); })
      .catch(function (err) {
        submit.disabled = false;
        submit.textContent = originalText;
        setStatus(root, err.message || "Something went wrong. Try again.", true);
      });
  }

  function renderSuccess(root, email) {
    var success = document.createElement("div");
    success.className = "inline-signup-success";
    success.setAttribute("role", "status");
    success.innerHTML =
      '<p class="eyebrow">Check your inbox</p>' +
      "<h4><em>Almost there.</em></h4>" +
      "<p>We sent a link to <strong>" + escapeHtml(email) + "</strong>. " +
      "Open it to finish subscribing and you'll land right back on this page.</p>";
    // The form may declare a larger container to swap out (e.g. the
    // whole post-gate card with its pitch copy above the form) so the
    // success state fully replaces the surrounding messaging instead
    // of appearing below it.
    var replaceSelector = root.getAttribute("data-replace-on-success");
    var target = replaceSelector ? root.closest(replaceSelector) || root : root;
    target.parentNode.replaceChild(success, target);
  }

  function setStatus(root, msg, isError) {
    var status = root.querySelector("[data-signup-status]");
    if (!status) return;
    status.textContent = msg;
    status.classList.toggle("is-error", !!isError);
  }

  function getValue(root, selector) {
    var el = root.querySelector(selector);
    return el ? (el.value || "").trim() : "";
  }

  // Build the context labels that Ghost will attach to the new member.
  // Our mo-kit worker mirrors Ghost labels onto Kit tags, so these
  // labels are the single source of truth for signup provenance.
  //
  // TOPIC_TAGS must stay in sync with the TOPIC_TAGS var on the
  // mo-kit worker; anything outside this set would still become a
  // Ghost label but the worker won't turn it into a meaningful tag.
  var TOPIC_TAGS = [
    "church", "culture", "family", "formation",
    "technology", "theology", "book-reviews"
  ];
  function buildContextLabels(root) {
    var out = [];
    // Form location, e.g. "home", "article-inline", "footer".
    var source = root.getAttribute("data-source");
    if (source) out.push("source:" + source);
    // Article topic(s): read the article's visible topic links if
    // present. Any tag outside TOPIC_TAGS is skipped to keep Ghost
    // labels/Kit tags bounded.
    var tagLinks = document.querySelectorAll(".article-topic [data-tag-slug], .article-topic-tag[data-tag-slug]");
    var added = Object.create(null);
    for (var i = 0; i < tagLinks.length; i++) {
      var slug = tagLinks[i].getAttribute("data-tag-slug") || "";
      if (TOPIC_TAGS.indexOf(slug) === -1) continue;
      if (added[slug]) continue;
      added[slug] = true;
      out.push("topic:" + slug);
    }
    // UTM campaign.
    try {
      var params = new URLSearchParams(window.location.search);
      var utm = params.get("utm_campaign");
      if (utm) out.push("utm:" + utm);
    } catch (_) {}
    // Event registration: form declares `data-event-name-from="sel"`
    // pointing at an element (populated client-side by events.js)
    // whose textContent is the event title. Emits "event: Title" as
    // a Ghost label; mo-kit mirrors to Kit tag with the same name.
    var eventSel = root.getAttribute("data-event-name-from");
    if (eventSel) {
      var nameEl = document.querySelector(eventSel);
      var eventName = nameEl ? (nameEl.textContent || "").trim() : "";
      if (eventName) out.push("event: " + eventName);
    }
    return out;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
