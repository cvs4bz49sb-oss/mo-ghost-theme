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

    // Payload mirrors what Ghost Portal itself sends. requestSrc
     // identifies the caller; Ghost 5.x rejects the request without
     // it. redirect is honored when the magic-link link is clicked.
    fetch(MAGIC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: email,
        emailType: "signup",
        name: name,
        labels: [],
        requestSrc: "portal",
        redirect: window.location.href,
      }),
      credentials: "same-origin",
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
    root.parentNode.replaceChild(success, root);
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

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
