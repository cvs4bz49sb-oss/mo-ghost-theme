/*
 * Shared submit handler for /contact/ and /submissions/.
 *
 *   <form data-site-form="contact" data-worker-url="…">
 *   <form data-site-form="submissions" data-worker-url="…">
 *
 * Contact posts JSON; Submissions posts FormData so file inputs
 * survive. Both talk to the mo-forms worker. Status is shown in
 * [data-form-status] inside the same form.
 */
(function () {
  // Show the selected filename next to the upload button. Event
  // delegation so forms injected dynamically still pick this up.
  document.addEventListener("change", function (e) {
    var input = e.target;
    if (!input || !input.matches || !input.matches('[data-upload] input[type="file"]')) return;
    var host = input.closest("[data-upload]");
    if (!host) return;
    var nameEl = host.querySelector("[data-upload-name]");
    if (!nameEl) return;
    var f = input.files && input.files[0];
    nameEl.textContent = f ? f.name : "No file chosen";
    host.classList.toggle("has-file", !!f);
  });

  document.addEventListener("submit", function (e) {
    var form = e.target && e.target.closest && e.target.closest("[data-site-form]");
    if (!form) return;
    e.preventDefault();
    handleSubmit(form);
  });

  function handleSubmit(form) {
    var kind = form.getAttribute("data-site-form");
    var worker = (form.getAttribute("data-worker-url") || "").trim().replace(/\/$/, "");
    var status = form.querySelector("[data-form-status]");
    var submitBtn = form.querySelector(".site-form-submit");

    if (!worker) {
      setStatus(status, "The form isn't configured yet. Email us instead.", true);
      return;
    }

    // Native required/email validation first.
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    setStatus(status, "Sending\u2026");
    if (submitBtn) { submitBtn.disabled = true; }

    var url, init;
    if (kind === "contact") {
      url = worker + "/contact";
      var body = {
        firstName: form.querySelector("[name=firstName]").value,
        lastName: form.querySelector("[name=lastName]").value,
        email: form.querySelector("[name=email]").value,
        message: form.querySelector("[name=message]").value,
      };
      init = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      };
    } else if (kind === "migrate") {
      url = worker + "/migrate";
      var startedNewEl = form.querySelector("[name=startedNew]");
      var migrateBody = {
        firstName: form.querySelector("[name=firstName]").value,
        lastName: form.querySelector("[name=lastName]").value,
        email: form.querySelector("[name=email]").value,
        startedNew: !!(startedNewEl && startedNewEl.checked),
      };
      init = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(migrateBody),
      };
    } else {
      url = worker + "/submissions";
      var fd = new FormData(form);
      // Normalize the checkbox to the value the worker expects.
      fd.set("aiAttested", form.querySelector("[name=aiAttested]").checked ? "true" : "false");
      init = { method: "POST", body: fd };
    }

    fetch(url, init)
      .then(function (r) {
        return r.json().then(
          function (j) { return { ok: r.ok, body: j }; },
          function () { return { ok: r.ok, body: {} }; }
        );
      })
      .then(function (res) {
        if (res.ok && res.body && res.body.ok) {
          renderSuccess(form, kind);
        } else {
          var msg = (res.body && res.body.error) || "Something went wrong. Try again.";
          setStatus(status, msg, true);
          if (submitBtn) submitBtn.disabled = false;
        }
      })
      .catch(function () {
        setStatus(status, "Couldn't reach the server. Try again.", true);
        if (submitBtn) submitBtn.disabled = false;
      });
  }

  function renderSuccess(form, kind) {
    var success = document.createElement("div");
    success.className = "site-form-success";
    success.setAttribute("role", "status");
    var title, body;
    if (kind === "contact") {
      title = "Thanks — message sent.";
      body = "We'll be in touch soon.";
    } else if (kind === "migrate") {
      title = "Thanks — request received.";
      body = "We'll cancel your old Membership within a day or two.";
    } else {
      title = "Thanks — submission received.";
      body = "We'll read your essay and be in touch within two weeks.";
    }
    success.innerHTML =
      '<p class="eyebrow">Sent</p>' +
      '<h3><em>' + title + '</em></h3>' +
      '<p>' + body + '</p>';
    form.parentNode.replaceChild(success, form);
  }

  function setStatus(el, msg, isError) {
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("is-error", !!isError);
  }
})();
