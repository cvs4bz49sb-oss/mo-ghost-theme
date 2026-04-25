/*
 * Ebook landing page — free-subscriber gate, Ghost-native edition.
 *
 * Three surfaces the right-column card can show, picked based on
 * the visitor's member state at page load:
 *
 *   SIGNUP (anonymous) — default form. POSTs to mo-ebook-access
 *     /grant, which creates a free Ghost member and comps them into
 *     the matching ebook tier, then sends a magic link redirecting
 *     back to this page. After they click the link they land here
 *     signed in, and this script transitions them to OPEN.
 *
 *   UNLOCK (signed in but no matching tier) — single button posts
 *     to /grant to comp the existing member into the ebook tier.
 *     On success, transitions to OPEN.
 *
 *   OPEN (signed in and eligible) — paid/comped Member tier, OR
 *     already in the per-ebook tier. The "Open the ebook" button is
 *     a plain anchor to /ebook/<slug>/read/ — Ghost serves the page
 *     and enforces tier visibility. No worker round-trip.
 *
 * The actual access check is server-side: Ghost decides at /ebook/
 * <slug>/read/ render time whether the visitor's tiers include one
 * of the page's allowed tiers. The client only picks WHICH surface
 * to render initially.
 */
(function () {
  var root = document.querySelector("[data-ebook-landing]");
  if (!root) return;

  var slug = root.getAttribute("data-ebook-slug");
  var title = root.getAttribute("data-ebook-title") || "the ebook";
  var readUrl = root.getAttribute("data-ebook-read-url");
  var workerUrl = (root.getAttribute("data-worker-url") || "").trim().replace(/\/$/, "");
  var memberEmail = (root.getAttribute("data-member-email") || "").trim().toLowerCase();
  var memberStatus = (root.getAttribute("data-member-status") || "").trim().toLowerCase();
  var memberHasTier = (root.getAttribute("data-member-has-ebook-tier") || "").trim() === "true";

  var signupEl = root.querySelector("[data-ebook-signup]");
  var openEl = root.querySelector("[data-ebook-open]");
  var grantEl = root.querySelector("[data-ebook-grant]");
  var openBtn = root.querySelector("[data-ebook-open-btn]");
  var grantBtn = root.querySelector("[data-ebook-grant-btn]");
  var grantStatus = root.querySelector("[data-ebook-grant-status]");
  var signedEmailEl = root.querySelector("[data-ebook-signed-email]");

  // Anchor the "Open" button to the Ghost-served read page.
  if (openBtn && readUrl) {
    openBtn.setAttribute("href", readUrl);
    openBtn.setAttribute("target", "_blank");
    openBtn.setAttribute("rel", "noopener");
  }

  // State picker.
  if (memberEmail) {
    var paidLike = memberStatus === "paid" || memberStatus === "comped";
    if (paidLike || memberHasTier) {
      show(openEl); hide(signupEl); hide(grantEl);
    } else {
      if (signedEmailEl) signedEmailEl.textContent = memberEmail;
      show(grantEl); hide(signupEl); hide(openEl);
    }
  } else {
    show(signupEl); hide(openEl); hide(grantEl);
  }

  // -------------------------------------------------------------------------
  // Anonymous signup — POST /grant. We piggy-back on the inline-signup
  // data attributes for the input fields, but intercept the click /
  // Enter key in capture phase so the request goes to /grant (which
  // comps the member into the ebook tier) instead of plain magic-link
  // signup.
  signupEl && signupEl.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest && e.target.closest("[data-signup-submit]");
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    submitSignup(btn);
  }, true);

  signupEl && signupEl.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    if (!e.target.matches || !e.target.matches("[data-signup-email]")) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var btn = signupEl.querySelector("[data-signup-submit]");
    if (btn) submitSignup(btn);
  }, true);

  function submitSignup(btn) {
    var email = val("[data-signup-email]");
    if (!email || !/.+@.+\..+/.test(email)) return setSignupStatus("Enter a valid email address.", true);
    var first = val("[data-signup-first]");
    var last = val("[data-signup-last]");
    var name = [first, last].filter(Boolean).join(" ");

    var orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Sending\u2026";
    setSignupStatus("");

    fetch(workerUrl + "/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email,
        ebook: slug,
        name: name,
        source: "ebook-landing",
        redirect: window.location.href,
      }),
    })
      .then(function (r) { return r.ok ? r.json() : r.json().then(function (j) { throw new Error(j.error || "Couldn't sign you up."); }); })
      .then(function () {
        var card = root.querySelector("[data-ebook-card]");
        if (!card) return;
        card.innerHTML =
          '<p class="eyebrow">Check your inbox</p>' +
          '<h2 class="ebook-landing-form-title"><em>Almost there.</em></h2>' +
          '<p class="ebook-landing-form-sub">We sent a link to <strong>' + escapeHtml(email) + '</strong>. ' +
          'Open it and you\'ll land back here with <em>' + escapeHtml(title) + '</em> ready to read.</p>';
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = orig;
        setSignupStatus(err.message || "Couldn't sign you up. Try again.", true);
      });
  }

  // -------------------------------------------------------------------------
  // Unlock — signed-in member without the per-ebook tier. One click
  // posts to /grant; on success, swap to the OPEN surface. We pass
  // no `redirect` since they're already signed in — no need for a
  // fresh magic link round-trip just to get back here.
  grantBtn && grantBtn.addEventListener("click", function () {
    if (!memberEmail) return;
    var orig = grantBtn.textContent;
    grantBtn.disabled = true;
    grantBtn.textContent = "Unlocking\u2026";
    setGrantStatus("");
    fetch(workerUrl + "/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: memberEmail,
        ebook: slug,
        source: "ebook-landing-already-signed-in",
      }),
    })
      .then(function (r) { return r.ok ? r.json() : r.json().then(function (j) { throw new Error(j.error || "Couldn't unlock."); }); })
      .then(function () { show(openEl); hide(grantEl); })
      .catch(function (err) {
        grantBtn.disabled = false;
        grantBtn.textContent = orig;
        setGrantStatus(err.message || "Couldn't unlock. Try again.", true);
      });
  });

  // -------------------------------------------------------------------------

  function val(sel) { var el = root.querySelector(sel); return el ? (el.value || "").trim() : ""; }
  function show(el) { if (el) el.removeAttribute("hidden"); }
  function hide(el) { if (el) el.setAttribute("hidden", ""); }
  function setSignupStatus(msg, isError) { setStatus(signupEl, msg, isError); }
  function setGrantStatus(msg, isError) { setStatus(grantEl, msg, isError, "[data-ebook-grant-status]"); }
  function setStatus(host, msg, isError, sel) {
    if (!host) return;
    var el = host.querySelector(sel || "[data-signup-status]");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
