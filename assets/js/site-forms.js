/*
 * Shared submit handler for /contact/ and /submissions/.
 *
 *   <form data-site-form="contact" data-worker-url="…">
 *   <form data-site-form="submissions" data-worker-url="…">
 *
 * Contact posts JSON; Submissions posts FormData so file inputs
 * survive. Both talk to the mo-forms worker. Status is shown in
 * [data-form-status] inside the same form.
 *
 * Bot protection (Codex audit 2026-05-11 follow-up): every form has
 * a [data-turnstile-wrap] slot that we render a Cloudflare Turnstile
 * widget into. The form submit is gated on the Turnstile callback
 * having fired with a valid token. Token is sent as the
 * `turnstile_token` field; mo-forms worker verifies via
 * https://challenges.cloudflare.com/turnstile/v0/siteverify.
 */
(function () {
  // ---------------------------------------------------------------------
  // Turnstile bootstrap
  // ---------------------------------------------------------------------

  // Site key from default.hbs <meta>. Public — visible in rendered
  // widget anyway. Hardcoded as meta tag because Ghost @custom is at
  // the 20-setting cap.
  const TURNSTILE_SITE_KEY = (function () {
    const m = document.querySelector('meta[name="turnstile-site-key"]');
    return m ? (m.getAttribute("content") || "").trim() : "";
  })();

  // Map of form-element → captured token. Populated by the Turnstile
  // callback; cleared after each submit so an expired token can't be
  // reused.
  const tokenByForm = new WeakMap();

  function renderTurnstileIn(form) {
    if (!TURNSTILE_SITE_KEY) return;
    const wrap = form.querySelector("[data-turnstile-wrap]");
    if (!wrap || wrap.dataset.turnstileRendered === "1") return;
    // The widget needs the Turnstile JS (loaded async in default.hbs).
    // If it hasn't arrived yet, retry shortly.
    if (!window.turnstile) {
      setTimeout(() => renderTurnstileIn(form), 200);
      return;
    }
    wrap.dataset.turnstileRendered = "1";
    window.turnstile.render(wrap, {
      sitekey: TURNSTILE_SITE_KEY,
      callback(token) { tokenByForm.set(form, token); },
      "error-callback"() { tokenByForm.delete(form); },
      "expired-callback"() { tokenByForm.delete(form); },
      theme: "light",
    });
  }

  // Render the widget once the DOM has the forms and the Turnstile
  // script has loaded.
  function bootstrapTurnstile() {
    document.querySelectorAll("[data-site-form]").forEach(renderTurnstileIn);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapTurnstile);
  } else {
    bootstrapTurnstile();
  }

  // ---------------------------------------------------------------------
  // File-input UX + form submit
  // ---------------------------------------------------------------------

  // Show the selected filename next to the upload button. Event
  // delegation so forms injected dynamically still pick this up.
  document.addEventListener("change", (e) => {
    const input = e.target;
    if (!input || !input.matches || !input.matches('[data-upload] input[type="file"]')) return;
    const host = input.closest("[data-upload]");
    if (!host) return;
    const nameEl = host.querySelector("[data-upload-name]");
    if (!nameEl) return;
    const f = input.files && input.files[0];
    nameEl.textContent = f ? f.name : "No file chosen";
    host.classList.toggle("has-file", !!f);
  });

  document.addEventListener("submit", (e) => {
    const form = e.target && e.target.closest && e.target.closest("[data-site-form]");
    if (!form) return;
    e.preventDefault();
    handleSubmit(form);
  });

  function handleSubmit(form) {
    const kind = form.getAttribute("data-site-form");
    const worker = (form.getAttribute("data-worker-url") || "").trim().replace(/\/$/, "");
    const status = form.querySelector("[data-form-status]");
    const submitBtn = form.querySelector(".site-form-submit, button[type=submit]");

    if (!worker) {
      setStatus(status, "The form isn't configured yet. Email us instead.", true);
      return;
    }

    // Native required/email validation first.
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Require a Turnstile token \u2014 the widget callback populates this.
    // If the visitor hasn't completed the challenge yet, surface a
    // friendly message rather than POSTing without proof and getting
    // a 403 from the worker.
    const turnstileToken = tokenByForm.get(form) || "";
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setStatus(status, "Please complete the bot check above, then resubmit.", true);
      return;
    }

    setStatus(status, "Sending\u2026");
    if (submitBtn) { submitBtn.disabled = true; }

    let url, init;
    // Null-safe field read: a form variant that omits a field would
    // otherwise throw on `.value` (checkValidity only catches empty
    // present fields, not absent ones), leaving submit stuck disabled.
    const val = (sel) => { const el = form.querySelector(sel); return el ? el.value : ""; };
    if (kind === "contact") {
      url = `${worker}/contact`;
      const typeEl = form.querySelector("[name=type]");
      const body = {
        firstName: val("[name=firstName]"),
        lastName: val("[name=lastName]"),
        email: val("[name=email]"),
        type: typeEl ? typeEl.value : "other",
        message: val("[name=message]"),
        turnstile_token: turnstileToken,
      };
      init = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      };
    } else if (kind === "newsletter") {
      // Daily Liturgy signup → mo-kit /newsletter-subscribe. JSON body;
      // worker subscribes to Kit (double opt-in form) + ensures a Ghost
      // free member. Only an email (and optional name) is collected.
      url = `${worker}/newsletter-subscribe`;
      const body = {
        email: val("[name=email]"),
        firstName: val("[name=firstName]"),
        lastName: val("[name=lastName]"),
        turnstile_token: turnstileToken,
      };
      init = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      };
    } else if (kind === "sponsorship") {
      url = `${worker}/sponsorship`;
      const checked = Array.from(form.querySelectorAll('[name="interests"]:checked'))
        .map((cb) => cb.value);
      if (!checked.length) {
        setStatus(status, "Please select at least one placement.", true);
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
      const body = {
        firstName: val("[name=firstName]"),
        lastName: val("[name=lastName]"),
        email: val("[name=email]"),
        organization: val("[name=organization]"),
        interests: checked,
        startDate: val("[name=startDate]"),
        months: val("[name=months]"),
        message: val("[name=message]"),
        turnstile_token: turnstileToken,
      };
      init = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      };
    } else if (kind === "writers-meetings") {
      // New Writers Meetings RSVP → mo-forms /writers-meetings. Emails
      // Nadya and copies the row into a Google Form's linked sheet.
      // `meetings` is a RADIO group of date keys (one meeting per
      // registration, matching the single-select question on the Google
      // Form). Still sent as an array so the worker contract is unchanged;
      // the worker filters to its own known set and takes the first, so an
      // unexpected value is dropped there rather than trusted here.
      url = `${worker}/writers-meetings`;
      const meetings = Array.from(form.querySelectorAll('[name="meetings"]:checked'))
        .map((cb) => cb.value);
      if (!meetings.length) {
        setStatus(status, "Please choose a meeting.", true);
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
      const body = {
        firstName: val("[name=firstName]"),
        lastName: val("[name=lastName]"),
        email: val("[name=email]"),
        meetings,
        note: val("[name=note]"),
        turnstile_token: turnstileToken,
      };
      init = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      };
    } else {
      url = `${worker}/submissions`;
      const fd = new FormData(form);
      // Normalize the checkbox to the value the worker expects.
      const attEl = form.querySelector("[name=aiAttested]");
      fd.set("aiAttested", attEl && attEl.checked ? "true" : "false");
      fd.set("turnstile_token", turnstileToken);
      init = { method: "POST", body: fd };
    }

    fetch(url, init)
      .then((r) => {
        return r.json().then(
          (j) => { return { ok: r.ok, body: j }; },
          () => { return { ok: r.ok, body: {} }; }
        );
      })
      .then((res) => {
        if (res.ok && res.body && res.body.ok) {
          renderSuccess(form, kind, res.body);
        } else {
          const msg = (res.body && res.body.error) || "Something went wrong. Try again.";
          setStatus(status, msg, true);
          if (submitBtn) submitBtn.disabled = false;
          resetTurnstile(form);
        }
      })
      .catch(() => {
        setStatus(status, "Couldn't reach the server. Try again.", true);
        if (submitBtn) submitBtn.disabled = false;
        resetTurnstile(form);
      });
  }

  // Turnstile tokens are single-use server-side. On any failed submit,
  // discard the cached token and ask the widget for a fresh one so the
  // visitor can retry without seeing "bot check expired" on the next
  // attempt.
  function resetTurnstile(form) {
    tokenByForm.delete(form);
    const wrap = form.querySelector("[data-turnstile-wrap]");
    if (wrap && window.turnstile) {
      try { window.turnstile.reset(wrap); } catch (_) { /* ignore */ }
    }
  }

  function renderSuccess(form, kind, resBody) {
    const success = document.createElement("div");
    success.className = "site-form-success";
    success.setAttribute("role", "status");
    const titles = {
      contact: "Thanks — message sent.",
      sponsorship: "Thanks — inquiry received.",
      "writers-meetings": "You're on the list.",
    };
    const bodies = {
      contact: "We'll be in touch soon.",
      sponsorship: "We'll follow up with rates and availability shortly.",
      "writers-meetings": "We'll send the Zoom link and the essay before the first meeting you picked.",
    };
    const eyebrows = { "writers-meetings": "Registered" };
    let eyebrow = eyebrows[kind] || "Sent";
    let title = titles[kind] || "Thanks — submission received.";
    let body = bodies[kind] || "We'll read your essay and be in touch within two weeks.";
    if (kind === "newsletter") {
      // Double opt-in returns pending:true — tell them to confirm. The
      // single-opt-in fallback (no Kit form configured) returns pending:false.
      if (resBody && resBody.pending) {
        eyebrow = "Almost there";
        title = "Check your inbox.";
        body = "We sent a confirmation link. Click it and the daily devotional starts arriving each morning.";
      } else {
        eyebrow = "You're in";
        title = "Welcome.";
        body = "The daily devotional will arrive in your inbox each morning.";
      }
    }
    success.innerHTML =
      `<p class="eyebrow">${eyebrow}</p>` +
      `<h3><em>${title}</em></h3>` +
      `<p>${body}</p>`;
    // Make the success block programmatically focusable and move focus to
    // it so keyboard / screen-reader users aren't dropped to <body> when
    // the form they were in is removed from the DOM.
    success.setAttribute("tabindex", "-1");
    form.parentNode.replaceChild(success, form);
    try { success.focus(); } catch (_) { /* ignore */ }
  }

  function setStatus(el, msg, isError) {
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("is-error", !!isError);
  }
})();
