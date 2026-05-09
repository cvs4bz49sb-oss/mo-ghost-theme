/*
 * /admin/settings/ — read and write site-wide operational settings
 * stored in KV on the mo-admin worker.
 */
(function () {
  const host = document.querySelector("[data-admin-settings]");
  if (!host) return;

  const workerUrl = host.getAttribute("data-worker-url");
  if (!workerUrl) return;

  const form = host.querySelector("[data-settings-form]");
  const submitBtn = host.querySelector("[data-settings-submit]");
  const status = host.querySelector("[data-settings-status]");
  const fields = {
    journal_status_issue: form.querySelector('[name="journal_status_issue"]'),
    journal_status_stage: form.querySelector('[name="journal_status_stage"]'),
    gate_days: form.querySelector('[name="gate_days"]'),
    gate_tier: form.querySelector('[name="gate_tier"]'),
  };

  function showStatus(msg, isError) {
    status.textContent = msg;
    status.classList.toggle("is-error", !!isError);
    status.hidden = false;
    if (!isError) setTimeout(() => { status.hidden = true; }, 3000);
  }

  function populate(settings) {
    for (const key in fields) {
      if (fields[key] && settings[key] !== undefined) {
        fields[key].value = settings[key];
      }
    }
  }

  function collect() {
    const out = {};
    for (const key in fields) {
      if (fields[key]) out[key] = fields[key].value;
    }
    return out;
  }

  // MOAuth.fetch attaches the JWT inside its closure — if there's no
  // signed-in member, the request goes out without auth and the worker
  // returns 401 below.
  window.MOAuth.fetch(`${workerUrl}/settings`)
    .then((r) => {
      if (r.status === 401 || r.status === 403) {
        showStatus("Not authorized — your email must be in the Ghost staff list.", true);
        throw new Error("forbidden");
      }
      return r.json();
    })
    .then(populate)
    .catch((err) => {
      if (err && err.message === "forbidden") return;
      showStatus("Could not load settings.", true);
    });

  submitBtn.addEventListener("click", () => {
    submitBtn.disabled = true;
    status.hidden = true;
    const body = collect();
    window.MOAuth.fetch(`${workerUrl}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
        .then((r) => {
          if (!r.ok) return r.json().then((d) => { throw new Error(d.error || r.status); });
          return r.json();
        })
        .then((saved) => {
          populate(saved);
          try { sessionStorage.removeItem("mo_site_settings"); } catch (e) {}
          showStatus("Saved.");
        })
      .catch((err) => { showStatus(err.message || "Save failed.", true); })
      .finally(() => { submitBtn.disabled = false; });
  });
})();
