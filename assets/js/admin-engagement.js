(function () {
  const root = document.querySelector("[data-admin-engagement]");
  if (!root) return;
  const WORKER = (root.getAttribute("data-worker-url") || "").replace(/\/$/, "");
  if (!WORKER) return;

  const form = root.querySelector("[data-engagement-form]");
  const statusEl = root.querySelector("[data-engagement-status]");
  const saveBtn = root.querySelector("[data-engagement-save]");
  const clearBtn = root.querySelector("[data-engagement-clear]");
  const responsesMount = root.querySelector("[data-engagement-responses]");
  const pollFields = root.querySelector("[data-poll-fields]");
  const linkFields = root.querySelector("[data-link-fields]");
  const responseFields = root.querySelector("[data-response-fields]");
  const typeSelect = form.querySelector('[name="type"]');

  function field(name) { return form.querySelector(`[name="${name}"]`); }

  function showStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.hidden = false;
    setTimeout(() => { statusEl.hidden = true; }, 3000);
  }

  function toggleTypeFields() {
    const t = typeSelect.value;
    pollFields.hidden = t !== "poll";
    linkFields.hidden = t !== "link";
    responseFields.hidden = t !== "open-response";
  }
  typeSelect.addEventListener("change", toggleTypeFields);

  function populate(config) {
    field("active").value = config.active ? "true" : "false";
    field("type").value = config.type || "announcement";
    field("title").value = config.title || "";
    field("body").value = config.body || "";
    if (config.options) {
      config.options.forEach((o, i) => {
        const f = field("option_" + i);
        if (f) f.value = o;
      });
    }
    field("url").value = config.url || "";
    field("linkLabel").value = config.linkLabel || "";
    field("allowAnonymous").checked = config.allowAnonymous !== false;
    toggleTypeFields();
  }

  function collect() {
    const data = {
      active: field("active").value === "true",
      type: field("type").value,
      title: field("title").value,
      body: field("body").value,
    };
    if (data.type === "poll") {
      data.options = [];
      for (let i = 0; i < 6; i++) {
        const v = (field("option_" + i).value || "").trim();
        if (v) data.options.push(v);
      }
    }
    if (data.type === "link") {
      data.url = field("url").value;
      data.linkLabel = field("linkLabel").value;
    }
    if (data.type === "open-response") {
      data.allowAnonymous = field("allowAnonymous").checked;
    }
    return data;
  }

  function authedFetch(path, opts) {
    return window.MOAuth.fetch(WORKER + path, opts || {});
  }

  // Load config
  authedFetch("/engagement")
    .then((r) => r.json())
    .then((data) => { populate(data); })
    .catch(() => { showStatus("Failed to load config."); });

  // Save
  saveBtn.addEventListener("click", () => {
    saveBtn.disabled = true;
    authedFetch("/engagement", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(collect()),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { showStatus("Error: " + data.error); }
        else { showStatus("Saved."); populate(data); }
      })
      .catch(() => { showStatus("Save failed."); })
      .finally(() => { saveBtn.disabled = false; });
  });

  // Load responses
  function loadResponses() {
    authedFetch("/engagement/responses")
      .then((r) => r.json())
      .then((data) => {
        renderResponses(data.config || {}, data.responses || [], data.votes || {});
      })
      .catch(() => {
        responsesMount.innerHTML = '<p class="admin-sub">Failed to load responses.</p>';
      });
  }

  function renderResponses(config, responses, votes) {
    responsesMount.innerHTML = "";

    if (config.type === "poll" && Object.keys(votes).length) {
      const total = Object.values(votes).reduce((s, n) => s + n, 0);
      const dl = document.createElement("div");
      dl.className = "engagement-poll-results";
      (config.options || Object.keys(votes)).forEach((opt) => {
        const count = votes[opt] || 0;
        const pct = total ? Math.round((count / total) * 100) : 0;
        dl.innerHTML += `<div class="engagement-poll-row">
          <span class="engagement-poll-label">${esc(opt)}</span>
          <span class="engagement-poll-bar"><span style="width:${pct}%"></span></span>
          <span class="engagement-poll-count">${count} (${pct}%)</span>
        </div>`;
      });
      dl.innerHTML += `<p class="admin-sub" style="margin-top:12px">${total} total vote${total === 1 ? "" : "s"}</p>`;
      responsesMount.appendChild(dl);
    }

    if (responses.length) {
      const list = document.createElement("ol");
      list.className = "engagement-response-list";
      responses.slice().reverse().forEach((r) => {
        const li = document.createElement("li");
        li.className = "engagement-response-item";
        const who = r.anonymous || !r.email ? "Anonymous" : r.email;
        const when = new Date(r.createdAt).toLocaleDateString();
        li.innerHTML = `<p class="engagement-response-meta">${esc(who)} &middot; ${when}</p><p class="engagement-response-text">${esc(r.answer)}</p>`;
        list.appendChild(li);
      });
      responsesMount.appendChild(list);
    }

    if (!responses.length && !Object.keys(votes).length) {
      responsesMount.innerHTML = '<p class="admin-sub">No responses yet.</p>';
    }
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  loadResponses();

  clearBtn.addEventListener("click", () => {
    if (!confirm("Clear all responses? This cannot be undone.")) return;
    authedFetch("/engagement/responses", { method: "DELETE" })
      .then(() => { loadResponses(); showStatus("Responses cleared."); })
      .catch(() => { showStatus("Failed to clear."); });
  });
})();
