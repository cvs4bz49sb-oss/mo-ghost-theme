/*
 * The Faith Received — "Report An Issue".
 *
 * A reader who has found a bad translation, a broken page, or text
 * that has come out as nonsense is already looking at the thing that
 * is wrong. So the form comes to them, carries the work they are
 * reading, and does not make them describe where they were.
 *
 * The work name is prefilled and left editable: the catalogue's title
 * is sometimes not the title the reader would use, and a volume that
 * gathers several works is one page under one name. The page URL is
 * sent alongside it and is not editable, because that is the evidence.
 *
 * Posts to mo-forms /tfr-issue, which writes the row that the inbox on
 * /admin/tfr/ reads.
 */
(function () {
  const ENDPOINT = "https://mo-forms.mo-podcast-feed.workers.dev/tfr-issue";
  const TYPES = ["Translation", "Formatting", "Page Error", "Other"];

  // The reader mounts this as a tool; the landing page opens the same
  // form from a button of its own. So the module no longer requires the
  // reader's controls to exist, and exposes the dialog instead.
  const controls = document.querySelector("[data-faith-controls]");

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // What the reader is looking at, when they are looking at a work at
  // all. The reader stamps the work's own title on <html> once its
  // metadata lands.
  //
  // Off a work page this must come back empty rather than guessing.
  // Falling through to the first h1 on the landing page would prefill
  // "The Christian tradition is the Christian's inheritance" as the
  // name of a work, which is not a work and not what they meant.
  function workName() {
    const stamped = document.documentElement.getAttribute("data-fr-work-title");
    if (stamped) return stamped;
    if (!param("w")) return "";
    const h1 = document.querySelector("[data-faith-work-name], .faith-work-title, h1");
    const t = h1 && h1.textContent ? h1.textContent.trim() : "";
    if (t) return t;
    return (document.title || "").replace(/\s+—\s+The Faith Received.*$/, "").trim();
  }

  function param(name) {
    try { return new URLSearchParams(window.location.search).get(name) || ""; }
    catch (_) { return ""; }
  }

  let overlay = null;
  let lastFocused = null;

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.removeEventListener("keydown", onKey);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab" || !overlay) return;
    // Keep the tab ring inside the dialog while it is open.
    const f = overlay.querySelectorAll(
      'a[href], button:not([disabled]), input, select, textarea'
    );
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function open() {
    if (overlay) return;
    lastFocused = document.activeElement;
    const here = workName();
    const onWork = !!here;

    overlay = document.createElement("div");
    overlay.className = "fr-report-overlay";
    overlay.innerHTML =
      `<div class="fr-report" role="dialog" aria-modal="true" aria-labelledby="fr-report-title">` +
      `<div class="fr-report-head">` +
      `<h2 class="fr-report-title" id="fr-report-title">${onWork ? "Report an issue" : "Give feedback"}</h2>` +
      `<button type="button" class="fr-report-close" data-fr-close aria-label="Close">&times;</button>` +
      `</div>` +
      `<p class="fr-report-note">${onWork
        ? "Tell us what is wrong and we will look at it."
        : "Tell us what is wrong or missing and we will look at it. If it concerns a particular work, name it."}</p>` +
      `<form class="fr-report-form" data-fr-form novalidate>` +
      `<div class="fr-report-row">` +
      `<label class="fr-report-field"><span>First name</span>` +
      `<input type="text" name="firstName" autocomplete="given-name" required></label>` +
      `<label class="fr-report-field"><span>Last name</span>` +
      `<input type="text" name="lastName" autocomplete="family-name" required></label>` +
      `</div>` +
      `<label class="fr-report-field"><span>Email</span>` +
      `<input type="email" name="email" autocomplete="email" required></label>` +
      `<label class="fr-report-field"><span>Work name</span>` +
      `<input type="text" name="workName" value="${escapeHtml(here)}" ` +
      `placeholder="${onWork ? "" : "The work this is about, or the page"}" required></label>` +
      `<label class="fr-report-field"><span>Issue type</span>` +
      `<select name="issueType" required>` +
      `<option value="">Choose one</option>${ 
      TYPES.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("") 
      }</select></label>` +
      `<label class="fr-report-field"><span>Comment</span>` +
      `<textarea name="comment" rows="5" placeholder="Describe The Issue" required></textarea></label>` +
      `<div class="fr-report-turnstile" data-turnstile-wrap></div>` +
      `<p class="fr-report-msg" data-fr-msg role="status" aria-live="polite" hidden></p>` +
      `<div class="fr-report-actions">` +
      `<button type="button" class="fr-report-cancel" data-fr-close>Cancel</button>` +
      `<button type="submit" class="fr-report-send" data-fr-send>Send report</button>` +
      `</div>` +
      `</form></div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
      if (e.target.closest("[data-fr-close]")) close();
    });
    document.addEventListener("keydown", onKey);

    const form = overlay.querySelector("[data-fr-form]");
    const msg = overlay.querySelector("[data-fr-msg]");
    const send = overlay.querySelector("[data-fr-send]");

    // The same bot check the other forms use. Rendered here rather
    // than in the markup because the dialog does not exist until it is
    // opened, and Turnstile will not render into a detached node.
    let token = "";
    const wrap = overlay.querySelector("[data-turnstile-wrap]");
    const meta = document.querySelector('meta[name="turnstile-site-key"]');
    const siteKey = meta ? meta.getAttribute("content") : "";
    if (wrap && siteKey && window.turnstile && window.turnstile.render) {
      try {
        window.turnstile.render(wrap, {
          sitekey: siteKey,
          callback(t) { token = t; },
          "expired-callback"() { token = ""; },
        });
      } catch (_) { /* the form still sends; the worker decides */ }
    }

    const firstField = overlay.querySelector('input[name="firstName"]');
    if (firstField) firstField.focus();

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const need = ["firstName", "lastName", "email", "workName", "issueType", "comment"];
      const missing = need.filter((k) => !String(data.get(k) || "").trim());
      if (missing.length) {
        msg.hidden = false;
        msg.className = "fr-report-msg is-bad";
        msg.textContent = "Please fill in every field.";
        return;
      }
      data.set("turnstile_token", token);
      data.set("pageUrl", window.location.href.split("#")[0]);
      data.set("corpus", param("c") || "tfr");
      data.set("workId", param("w"));

      send.disabled = true;
      msg.hidden = false;
      msg.className = "fr-report-msg";
      msg.textContent = "Sending…";

      fetch(ENDPOINT, { method: "POST", body: data })
        .then((r) => r.json().catch(() => ({ ok: false })))
        .then((res) => {
          if (res && res.ok) {
            // The dialog becomes the receipt rather than vanishing. A
            // form that closes on success leaves the reader wondering
            // whether it sent.
            overlay.querySelector(".fr-report").innerHTML =
              `<div class="fr-report-done">` +
              `<h2 class="fr-report-title">Thank you</h2>` +
              `<p>We have your report and we will look at it.</p>` +
              `<button type="button" class="fr-report-send" data-fr-close>Close</button>` +
              `</div>`;
            return;
          }
          send.disabled = false;
          msg.className = "fr-report-msg is-bad";
          msg.textContent = (res && res.error) || "That did not send. Please try again.";
        })
        .catch(() => {
          send.disabled = false;
          msg.className = "fr-report-msg is-bad";
          msg.textContent = "That did not send. Please try again.";
        });
    });
  }

  if (controls) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "faith-tool faith-report-toggle";
    btn.innerHTML = `<span class="faith-toggle-label">Report An Issue</span>`;
    btn.addEventListener("click", open);
    controls.appendChild(btn);
  }

  // Anything on the page can raise it. The landing page's feedback
  // button does, and so could a collection page.
  window.MOReportIssue = { open };

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-report-issue]");
    if (!t) return;
    e.preventDefault();
    open();
  });
}());
