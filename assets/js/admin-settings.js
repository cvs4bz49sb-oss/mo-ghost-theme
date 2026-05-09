/*
 * /admin/settings/ — read and write site-wide operational settings
 * stored in KV on the mo-admin worker.
 */
(function () {
  var host = document.querySelector("[data-admin-settings]");
  if (!host) return;

  var workerUrl = host.getAttribute("data-worker-url");
  if (!workerUrl) return;

  var form = host.querySelector("[data-settings-form]");
  var submitBtn = host.querySelector("[data-settings-submit]");
  var status = host.querySelector("[data-settings-status]");
  var fields = {
    journal_status_issue: form.querySelector('[name="journal_status_issue"]'),
    journal_status_stage: form.querySelector('[name="journal_status_stage"]'),
    gate_days: form.querySelector('[name="gate_days"]'),
    gate_tier: form.querySelector('[name="gate_tier"]'),
  };

  function showStatus(msg, isError) {
    status.textContent = msg;
    status.classList.toggle("is-error", !!isError);
    status.hidden = false;
    if (!isError) setTimeout(function () { status.hidden = true; }, 3000);
  }

  function populate(settings) {
    for (var key in fields) {
      if (fields[key] && settings[key] !== undefined) {
        fields[key].value = settings[key];
      }
    }
  }

  function collect() {
    var out = {};
    for (var key in fields) {
      if (fields[key]) out[key] = fields[key].value;
    }
    return out;
  }

  // MOAuth.fetch attaches the JWT inside its closure — if there's no
  // signed-in member, the request goes out without auth and the worker
  // returns 401 below.
  window.MOAuth.fetch(workerUrl + "/settings")
    .then(function (r) {
      if (r.status === 401 || r.status === 403) {
        showStatus("Not authorized — your email must be in the Ghost staff list.", true);
        throw new Error("forbidden");
      }
      return r.json();
    })
    .then(populate)
    .catch(function (err) {
      if (err && err.message === "forbidden") return;
      showStatus("Could not load settings.", true);
    });

  submitBtn.addEventListener("click", function () {
    submitBtn.disabled = true;
    status.hidden = true;
    var body = collect();
    window.MOAuth.fetch(workerUrl + "/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
        .then(function (r) {
          if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || r.status); });
          return r.json();
        })
        .then(function (saved) {
          populate(saved);
          try { sessionStorage.removeItem("mo_site_settings"); } catch (e) {}
          showStatus("Saved.");
        })
      .catch(function (err) { showStatus(err.message || "Save failed.", true); })
      .finally(function () { submitBtn.disabled = false; });
  });
})();
