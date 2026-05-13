(function () {
  var root = document.querySelector("[data-admin-engagement]");
  if (!root) return;
  var WORKER = (root.getAttribute("data-worker-url") || "").replace(/\/$/, "");
  if (!WORKER) return;

  var form = root.querySelector("[data-engagement-form]");
  var statusEl = root.querySelector("[data-engagement-status]");
  var saveBtn = root.querySelector("[data-engagement-save]");
  var clearBtn = root.querySelector("[data-engagement-clear]");
  var responsesMount = root.querySelector("[data-engagement-responses]");
  var typeSelect = form.querySelector('[name="type"]');
  var typeFieldGroups = form.querySelectorAll("[data-type-fields]");

  function field(name) { return form.querySelector('[name="' + name + '"]'); }

  function showStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.hidden = false;
    setTimeout(function () { statusEl.hidden = true; }, 3000);
  }

  function toggleTypeFields() {
    var t = typeSelect.value;
    for (var i = 0; i < typeFieldGroups.length; i++) {
      typeFieldGroups[i].hidden = typeFieldGroups[i].getAttribute("data-type-fields") !== t;
    }
  }
  typeSelect.addEventListener("change", toggleTypeFields);
  toggleTypeFields();

  function populate(config) {
    field("active").value = config.active ? "true" : "false";
    field("type").value = config.type || "announcement";
    field("title").value = config.title || "";
    field("body").value = config.body || "";
    if (config.options) {
      config.options.forEach(function (o, i) {
        var f = field("option_" + i);
        if (f) f.value = o;
      });
    }
    field("url").value = config.url || "";
    field("linkLabel").value = config.linkLabel || "";
    field("allowAnonymous").checked = config.allowAnonymous !== false;
    toggleTypeFields();
  }

  function collect() {
    var data = {
      active: field("active").value === "true",
      type: field("type").value,
      title: field("title").value,
      body: field("body").value,
    };
    if (data.type === "poll") {
      data.options = [];
      for (var i = 0; i < 6; i++) {
        var v = (field("option_" + i).value || "").trim();
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

  authedFetch("/engagement")
    .then(function (r) { return r.json(); })
    .then(function (data) { populate(data); })
    .catch(function () { showStatus("Failed to load config."); });

  saveBtn.addEventListener("click", function () {
    saveBtn.disabled = true;
    authedFetch("/engagement", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(collect()),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { showStatus("Error: " + data.error); }
        else { showStatus("Saved."); populate(data); }
      })
      .catch(function () { showStatus("Save failed."); })
      .finally(function () { saveBtn.disabled = false; });
  });

  function loadResponses() {
    authedFetch("/engagement/responses")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        renderResponses(data.config || {}, data.responses || [], data.votes || {});
      })
      .catch(function () {
        responsesMount.innerHTML = '<p class="admin-sub">Failed to load responses.</p>';
      });
  }

  function renderResponses(config, responses, votes) {
    responsesMount.innerHTML = "";

    if (config.type === "poll" && Object.keys(votes).length) {
      var total = Object.values(votes).reduce(function (s, n) { return s + n; }, 0);
      var dl = document.createElement("div");
      dl.className = "engagement-poll-results";
      (config.options || Object.keys(votes)).forEach(function (opt) {
        var count = votes[opt] || 0;
        var pct = total ? Math.round((count / total) * 100) : 0;
        dl.innerHTML += '<div class="engagement-poll-row">' +
          '<span class="engagement-poll-label">' + esc(opt) + '</span>' +
          '<span class="engagement-poll-bar"><span style="width:' + pct + '%"></span></span>' +
          '<span class="engagement-poll-count">' + count + ' (' + pct + '%)</span>' +
          '</div>';
      });
      dl.innerHTML += '<p class="admin-sub" style="margin-top:12px">' + total + ' total vote' + (total === 1 ? "" : "s") + '</p>';
      responsesMount.appendChild(dl);
    }

    if (responses.length) {
      var list = document.createElement("ol");
      list.className = "engagement-response-list";
      responses.slice().reverse().forEach(function (r) {
        var li = document.createElement("li");
        li.className = "engagement-response-item";
        var who = r.anonymous || !r.email ? "Anonymous" : r.email;
        var when = new Date(r.createdAt).toLocaleDateString();
        li.innerHTML = '<p class="engagement-response-meta">' + esc(who) + ' &middot; ' + when + '</p><p class="engagement-response-text">' + esc(r.answer) + '</p>';
        list.appendChild(li);
      });
      responsesMount.appendChild(list);
    }

    if (!responses.length && !Object.keys(votes).length) {
      responsesMount.innerHTML = '<p class="admin-sub">No responses yet.</p>';
    }
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  loadResponses();

  clearBtn.addEventListener("click", function () {
    if (!confirm("Clear all responses? This cannot be undone.")) return;
    authedFetch("/engagement/responses", { method: "DELETE" })
      .then(function () { loadResponses(); showStatus("Responses cleared."); })
      .catch(function () { showStatus("Failed to clear."); });
  });
})();
