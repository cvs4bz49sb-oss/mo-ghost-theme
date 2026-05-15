(function () {
  var root = document.querySelector("[data-admin-social]");
  if (!root) return;
  var WORKER = (root.getAttribute("data-worker-url") || "").replace(/\/$/, "");
  if (!WORKER) return;

  var statusEl = root.querySelector("[data-social-status]");
  var statusText = root.querySelector("[data-status-text]");
  var draftsSection = root.querySelector("[data-social-drafts]");
  var draftsList = root.querySelector("[data-drafts-list]");
  var selectAllCb = root.querySelector("[data-select-all]");
  var deleteModal = root.querySelector("[data-delete-modal]");
  var deleteBody = root.querySelector("[data-delete-body]");
  var deleteConfirm = root.querySelector("[data-delete-confirm]");
  var deleteCancel = root.querySelector("[data-delete-cancel]");

  var btnGenerate = root.querySelector('[data-action="generate"]');
  var btnDelete = root.querySelector('[data-action="delete"]');
  var btnPush = root.querySelector('[data-action="push"]');

  var drafts = [];
  var channels = [];
  var channelMap = {};

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function authedFetch(path, opts) {
    return window.MOAuth.fetch(WORKER + path, opts || {});
  }

  function showStatus(msg, isError) {
    statusEl.hidden = false;
    statusText.textContent = msg;
    statusText.style.color = isError ? "#c0392b" : "var(--color-muted)";
  }

  function hideStatus() { statusEl.hidden = true; }

  function updateButtons() {
    var hasDrafts = drafts.length > 0;
    btnDelete.disabled = !hasDrafts;
    btnPush.disabled = !hasDrafts || !Object.keys(channelMap).length;
  }

  function platformLabel(p) {
    var names = { twitter: "X", linkedin: "LinkedIn", facebook: "Facebook", threads: "Threads" };
    return names[p] || p;
  }

  function platformColor(p) {
    var colors = { twitter: "#000", linkedin: "#0A66C2", facebook: "#1877F2", threads: "#000" };
    return colors[p] || "#666";
  }

  /* -- Render drafts -------------------------------------------------- */
  function renderDrafts() {
    if (!drafts.length) {
      draftsSection.hidden = true;
      return;
    }
    draftsSection.hidden = false;

    var grouped = {};
    var order = [];
    for (var i = 0; i < drafts.length; i++) {
      var d = drafts[i];
      var key = d.article_slug || d.article_title;
      if (!grouped[key]) {
        grouped[key] = { title: d.article_title, url: d.article_url, posts: [] };
        order.push(key);
      }
      grouped[key].posts.push(d);
    }

    draftsList.innerHTML = "";
    for (var j = 0; j < order.length; j++) {
      var group = grouped[order[j]];
      var card = document.createElement("div");
      card.className = "social-draft-card";

      var header = document.createElement("div");
      header.className = "social-draft-card-header";
      var title = document.createElement("h3");
      title.className = "social-draft-card-title";
      title.textContent = group.title;
      header.appendChild(title);
      if (group.url) {
        var link = document.createElement("a");
        link.href = group.url;
        link.target = "_blank";
        link.className = "social-draft-card-link";
        link.textContent = "View article";
        header.appendChild(link);
      }
      card.appendChild(header);

      for (var k = 0; k < group.posts.length; k++) {
        var post = group.posts[k];
        var row = document.createElement("div");
        row.className = "social-draft-row";
        row.setAttribute("data-draft-id", post.id);

        var rowHead = document.createElement("div");
        rowHead.className = "social-draft-row-head";

        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = true;
        cb.className = "social-draft-cb";
        cb.setAttribute("data-draft-cb", post.id);
        rowHead.appendChild(cb);

        var badge = document.createElement("span");
        badge.className = "social-draft-badge";
        badge.style.background = platformColor(post.platform);
        badge.textContent = platformLabel(post.platform);
        rowHead.appendChild(badge);

        var charCount = document.createElement("span");
        charCount.className = "social-draft-chars";
        charCount.textContent = post.text.length + " chars";
        rowHead.appendChild(charCount);

        row.appendChild(rowHead);

        var textarea = document.createElement("textarea");
        textarea.className = "social-draft-text";
        textarea.value = post.text;
        textarea.setAttribute("data-draft-text", post.id);
        textarea.addEventListener("input", (function (postRef, countRef) {
          return function () {
            postRef.text = this.value;
            countRef.textContent = this.value.length + " chars";
          };
        })(post, charCount));
        row.appendChild(textarea);

        card.appendChild(row);
      }

      draftsList.appendChild(card);
    }
  }

  /* -- Generate ------------------------------------------------------- */
  btnGenerate.addEventListener("click", function () {
    btnGenerate.disabled = true;
    btnGenerate.textContent = "Generating…";
    showStatus("Pulling recent articles and generating social copy with Claude. This may take a minute…");

    authedFetch("/social/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: 7, platforms: ["twitter", "linkedin", "facebook"] }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { showStatus(data.error, true); return; }
        drafts = data.drafts || [];
        if (!drafts.length) {
          showStatus(data.message || "No articles found to generate posts for.");
        } else {
          showStatus(drafts.length + " posts generated for " + countArticles(drafts) + " article(s).");
        }
        renderDrafts();
        updateButtons();
      })
      .catch(function () { showStatus("Failed to generate. Check network and try again.", true); })
      .finally(function () {
        btnGenerate.disabled = false;
        btnGenerate.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Generate';
      });
  });

  function countArticles(list) {
    var seen = {};
    for (var i = 0; i < list.length; i++) seen[list[i].article_slug || list[i].article_title] = true;
    return Object.keys(seen).length;
  }

  /* -- Delete --------------------------------------------------------- */
  btnDelete.addEventListener("click", function () {
    if (!drafts.length) return;
    deleteBody.innerHTML = "";

    var info = document.createElement("p");
    info.className = "social-modal-info";
    info.textContent = "Select posts to delete:";
    deleteBody.appendChild(info);

    var allLabel = document.createElement("label");
    allLabel.className = "social-modal-option social-modal-option--all";
    var allCb = document.createElement("input");
    allCb.type = "checkbox";
    allCb.setAttribute("data-modal-all", "");
    allCb.checked = true;
    allLabel.appendChild(allCb);
    allLabel.appendChild(document.createTextNode(" Delete all (" + drafts.length + " posts)"));
    deleteBody.appendChild(allLabel);

    var itemsDiv = document.createElement("div");
    itemsDiv.className = "social-modal-items";
    for (var i = 0; i < drafts.length; i++) {
      var d = drafts[i];
      var label = document.createElement("label");
      label.className = "social-modal-option";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.setAttribute("data-modal-id", d.id);
      label.appendChild(cb);
      label.appendChild(document.createTextNode(" " + platformLabel(d.platform) + ": " + d.article_title.substring(0, 50)));
      itemsDiv.appendChild(label);
    }
    deleteBody.appendChild(itemsDiv);

    allCb.addEventListener("change", function () {
      var cbs = itemsDiv.querySelectorAll("input[type=checkbox]");
      for (var j = 0; j < cbs.length; j++) cbs[j].checked = allCb.checked;
    });

    deleteModal.hidden = false;
  });

  deleteCancel.addEventListener("click", function () { deleteModal.hidden = true; });

  deleteConfirm.addEventListener("click", function () {
    var allCb = deleteBody.querySelector("[data-modal-all]");
    var deleteAll = allCb && allCb.checked;
    var idsToDelete = [];

    if (!deleteAll) {
      var cbs = deleteBody.querySelectorAll("[data-modal-id]");
      for (var i = 0; i < cbs.length; i++) {
        if (cbs[i].checked) idsToDelete.push(cbs[i].getAttribute("data-modal-id"));
      }
      if (!idsToDelete.length) { deleteModal.hidden = true; return; }
    }

    deleteConfirm.disabled = true;
    deleteConfirm.textContent = "Deleting…";

    var promise;
    if (deleteAll) {
      promise = authedFetch("/social/drafts", { method: "DELETE" });
    } else {
      promise = Promise.all(idsToDelete.map(function (id) {
        return authedFetch("/social/drafts/" + id, { method: "DELETE" });
      }));
    }

    promise
      .then(function () {
        if (deleteAll) {
          drafts = [];
        } else {
          var set = {};
          for (var j = 0; j < idsToDelete.length; j++) set[idsToDelete[j]] = true;
          drafts = drafts.filter(function (d) { return !set[d.id]; });
        }
        renderDrafts();
        updateButtons();
        showStatus(deleteAll ? "All drafts deleted." : idsToDelete.length + " post(s) deleted.");
      })
      .catch(function () { showStatus("Delete failed.", true); })
      .finally(function () {
        deleteModal.hidden = true;
        deleteConfirm.disabled = false;
        deleteConfirm.textContent = "Delete Selected";
      });
  });

  /* -- Push ----------------------------------------------------------- */
  btnPush.addEventListener("click", function () {
    var selected = getSelectedDraftIds();
    if (!selected.length) { showStatus("No posts selected to push.", true); return; }
    if (!Object.keys(channelMap).length) { showStatus("No Buffer channels found. Check BUFFER_API_KEY.", true); return; }

    btnPush.disabled = true;
    btnPush.textContent = "Pushing…";
    showStatus("Sending " + selected.length + " post(s) to Buffer…");

    authedFetch("/social/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelMap: channelMap,
        draftIds: selected,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { showStatus(data.error, true); return; }
        var results = data.results || [];
        var ok = results.filter(function (r) { return r.ok; }).length;
        var fail = results.filter(function (r) { return !r.ok; }).length;
        var msg = ok + " post(s) pushed to Buffer.";
        if (fail) msg += " " + fail + " failed.";
        showStatus(msg, fail > 0);

        // Remove pushed drafts from local state
        var pushedIds = {};
        for (var i = 0; i < results.length; i++) {
          if (results[i].ok) pushedIds[results[i].id] = true;
        }
        drafts = drafts.filter(function (d) { return !pushedIds[d.id]; });
        renderDrafts();
        updateButtons();
      })
      .catch(function () { showStatus("Push failed. Check network and try again.", true); })
      .finally(function () {
        btnPush.disabled = false;
        btnPush.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Push to Buffer';
      });
  });

  function getSelectedDraftIds() {
    var ids = [];
    var cbs = draftsList.querySelectorAll("[data-draft-cb]");
    for (var i = 0; i < cbs.length; i++) {
      if (cbs[i].checked) ids.push(cbs[i].getAttribute("data-draft-cb"));
    }
    return ids;
  }

  /* -- Select all ----------------------------------------------------- */
  if (selectAllCb) {
    selectAllCb.addEventListener("change", function () {
      var cbs = draftsList.querySelectorAll("[data-draft-cb]");
      for (var i = 0; i < cbs.length; i++) cbs[i].checked = selectAllCb.checked;
    });
  }

  /* -- Load channels + existing drafts -------------------------------- */
  function init() {
    authedFetch("/social/channels")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        channels = data.channels || [];
        for (var i = 0; i < channels.length; i++) {
          var ch = channels[i];
          var svc = (ch.service || "").toLowerCase();
          if (svc === "twitter" || svc === "x") channelMap.twitter = ch.id;
          else if (svc === "linkedin") channelMap.linkedin = ch.id;
          else if (svc === "facebook") channelMap.facebook = ch.id;
          else if (svc === "threads") channelMap.threads = ch.id;
        }
        updateButtons();
      })
      .catch(function () { /* channels unavailable — push will be disabled */ });

    authedFetch("/social/drafts")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        drafts = data.drafts || [];
        renderDrafts();
        updateButtons();
      })
      .catch(function () { /* no existing drafts */ });
  }

  init();
})();
