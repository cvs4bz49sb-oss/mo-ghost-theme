/*
 * Ebook landing page — free-subscriber lead-gen flow.
 *
 * Two surfaces:
 *   SIGNUP (anonymous) — form posts to mo-ebook-access /grant. The
 *     worker creates a free Ghost member if one doesn't exist (or
 *     finds the existing one), writes attribution labels
 *     (`ebook:<slug>`, `source:ebook-<slug>`) so Kit segmentation
 *     knows which ebook brought them in, and sends a magic link
 *     redirecting back to this page.
 *   OPEN (signed in) — "Open the ebook" is a plain anchor to
 *     /ebook/<slug>/read/. The read template's {{#if @member}} wrap
 *     gates the content; signed-in members go straight in.
 *
 * No per-ebook access gate at the read level (B+ model — ebooks are
 * free with any subscription; attribution lives in labels). Existing
 * subscribers who fill the form for additional ebooks get fresh
 * label-add events that mo-kit mirrors to Kit, so per-ebook
 * conversion sequences can fire on signup, not just on first
 * subscription.
 */
(function () {
  const root = document.querySelector("[data-ebook-landing]");
  if (!root) return;

  const slug = root.getAttribute("data-ebook-slug");
  const title = root.getAttribute("data-ebook-title") || "the ebook";
  const readUrl = root.getAttribute("data-ebook-read-url");
  const workerUrl = (root.getAttribute("data-worker-url") || "").trim().replace(/\/$/, "");
  const memberEmail = (root.getAttribute("data-member-email") || "").trim().toLowerCase();

  const signupEl = root.querySelector("[data-ebook-signup]");
  const openEl = root.querySelector("[data-ebook-open]");
  const openBtn = root.querySelector("[data-ebook-open-btn]");

  if (openBtn && readUrl) {
    openBtn.setAttribute("href", readUrl);
  }

  if (memberEmail) {
    show(openEl); hide(signupEl);
  } else {
    show(signupEl); hide(openEl);
  }

  // -------------------------------------------------------------------------
  // Anonymous signup — POST /grant. Capture-phase listener so we
  // intercept BEFORE inline-signup.js's plain magic-link handler.
  signupEl && signupEl.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest && e.target.closest("[data-signup-submit]");
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    submitSignup(btn);
  }, true);

  signupEl && signupEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    if (!e.target.matches || !e.target.matches("[data-signup-email]")) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const btn = signupEl.querySelector("[data-signup-submit]");
    if (btn) submitSignup(btn);
  }, true);

  function submitSignup(btn) {
    const email = val("[data-signup-email]");
    if (!email || !/.+@.+\..+/.test(email)) return setSignupStatus("Enter a valid email address.", true);
    const first = val("[data-signup-first]");
    const last = val("[data-signup-last]");
    const name = [first, last].filter(Boolean).join(" ");

    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Sending\u2026";
    setSignupStatus("");

    fetch(`${workerUrl}/grant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        ebook: slug,
        name,
        source: "ebook-landing",
        redirect: window.location.href,
      }),
    })
      .then((r) => { return r.ok ? r.json() : r.json().then((j) => { throw new Error(j.error || "Couldn't sign you up."); }); })
      .then(() => {
        const card = root.querySelector("[data-ebook-card]");
        if (!card) return;
        card.innerHTML =
          `<p class="eyebrow">Check your inbox</p>` +
          `<h2 class="ebook-landing-form-title"><em>Almost there.</em></h2>` +
          `<p class="ebook-landing-form-sub">We sent a link to <strong>${escapeHtml(email)}</strong>. ` +
          `Open it and you'll land back here with <em>${escapeHtml(title)}</em> ready to read.</p>`;
      })
      .catch((err) => {
        btn.disabled = false;
        btn.textContent = orig;
        setSignupStatus(err.message || "Couldn't sign you up. Try again.", true);
      });
  }

  // -------------------------------------------------------------------------

  function val(sel) { const el = root.querySelector(sel); return el ? (el.value || "").trim() : ""; }
  function show(el) { if (el) el.removeAttribute("hidden"); }
  function hide(el) { if (el) el.setAttribute("hidden", ""); }
  function setSignupStatus(msg, isError) {
    if (!signupEl) return;
    const el = signupEl.querySelector("[data-signup-status]");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
