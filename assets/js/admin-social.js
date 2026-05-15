(function () {
  const root = document.querySelector("[data-admin-social]");
  if (!root) return;
  const WORKER = (root.getAttribute("data-worker-url") || "").replace(/\/$/, "");
  if (!WORKER) return;

  const statusEl = root.querySelector("[data-social-status]");
  const statusText = root.querySelector("[data-status-text]");
  const draftsSection = root.querySelector("[data-social-drafts]");
  const draftsList = root.querySelector("[data-drafts-list]");
  const selectAllCb = root.querySelector("[data-select-all]");
  const deleteModal = root.querySelector("[data-delete-modal]");
  const deleteBody = root.querySelector("[data-delete-body]");
  const deleteConfirm = root.querySelector("[data-delete-confirm]");
  const deleteCancel = root.querySelector("[data-delete-cancel]");

  const btnGenerate = root.querySelector('[data-action="generate"]');
  const btnDelete = root.querySelector('[data-action="delete"]');
  const btnPush = root.querySelector('[data-action="push"]');

  let drafts = [];
  let channels = [];
  const channelMap = {};

  function esc(s) {
    const d = document.createElement("div");
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
    const hasDrafts = drafts.length > 0;
    btnDelete.disabled = !hasDrafts;
    btnPush.disabled = !hasDrafts || !Object.keys(channelMap).length;
  }

  function platformLabel(p) {
    const names = { twitter: "X", linkedin: "LinkedIn", facebook: "Facebook", threads: "Threads" };
    return names[p] || p;
  }

  function platformColor(p) {
    const colors = { twitter: "#000", linkedin: "#0A66C2", facebook: "#1877F2", threads: "#000" };
    return colors[p] || "#666";
  }

  /* -- Render drafts -------------------------------------------------- */
  function renderDrafts() {
    if (!drafts.length) {
      draftsSection.hidden = true;
      return;
    }
    draftsSection.hidden = false;

    const grouped = {};
    const order = [];
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      const key = d.article_slug || d.article_title;
      if (!grouped[key]) {
        grouped[key] = { title: d.article_title, url: d.article_url, posts: [] };
        order.push(key);
      }
      grouped[key].posts.push(d);
    }

    draftsList.innerHTML = "";
    for (let j = 0; j < order.length; j++) {
      const group = grouped[order[j]];
      const card = document.createElement("div");
      card.className = "social-draft-card";

      const header = document.createElement("div");
      header.className = "social-draft-card-header";
      const title = document.createElement("h3");
      title.className = "social-draft-card-title";
      title.textContent = group.title;
      header.appendChild(title);
      if (group.url) {
        const link = document.createElement("a");
        link.href = group.url;
        link.target = "_blank";
        link.className = "social-draft-card-link";
        link.textContent = "View article";
        header.appendChild(link);
      }
      card.appendChild(header);

      for (let k = 0; k < group.posts.length; k++) {
        const post = group.posts[k];
        const row = document.createElement("div");
        row.className = "social-draft-row";
        row.setAttribute("data-draft-id", post.id);

        const rowHead = document.createElement("div");
        rowHead.className = "social-draft-row-head";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = true;
        cb.className = "social-draft-cb";
        cb.setAttribute("data-draft-cb", post.id);
        rowHead.appendChild(cb);

        const badge = document.createElement("span");
        badge.className = "social-draft-badge";
        badge.style.background = platformColor(post.platform);
        badge.textContent = platformLabel(post.platform);
        rowHead.appendChild(badge);

        const charCount = document.createElement("span");
        charCount.className = "social-draft-chars";
        charCount.textContent = `${post.text.length} chars`;
        rowHead.appendChild(charCount);

        row.appendChild(rowHead);

        const schedRow = document.createElement("div");
        schedRow.className = "social-draft-schedule";
        const schedLabel = document.createElement("span");
        schedLabel.className = "social-draft-schedule-label";
        schedLabel.textContent = "Publish:";
        schedRow.appendChild(schedLabel);
        const schedInput = document.createElement("input");
        schedInput.type = "datetime-local";
        schedInput.className = "social-draft-schedule-input";
        schedInput.setAttribute("data-draft-schedule", post.id);
        if (post.scheduled_at) {
          schedInput.value = post.scheduled_at.substring(0, 16);
        }
        schedInput.addEventListener("change", (function (postRef) {
          return function () {
            postRef.scheduled_at = this.value ? new Date(this.value).toISOString() : null;
          };
        })(post));
        schedRow.appendChild(schedInput);
        row.appendChild(schedRow);

        const textarea = document.createElement("textarea");
        textarea.className = "social-draft-text";
        textarea.value = post.text;
        textarea.setAttribute("data-draft-text", post.id);
        textarea.addEventListener("input", (function (postRef, countRef) {
          return function () {
            postRef.text = this.value;
            countRef.textContent = `${this.value.length} chars`;
          };
        })(post, charCount));
        row.appendChild(textarea);

        card.appendChild(row);
      }

      draftsList.appendChild(card);
    }
  }

  /* -- Generate ------------------------------------------------------- */
  btnGenerate.addEventListener("click", () => {
    btnGenerate.disabled = true;
    btnGenerate.textContent = "Generating…";
    showStatus("Pulling recent articles and generating social copy with Claude. This may take a minute…");

    authedFetch("/social/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: 7, platforms: ["twitter", "linkedin", "facebook"] }),
    })
      .then((r) => { return r.json(); })
      .then((data) => {
        if (data.error) { showStatus(data.error, true); return; }
        drafts = data.drafts || [];
        if (!drafts.length) {
          showStatus(data.message || "No articles found to generate posts for.");
        } else {
          showStatus(`${drafts.length} posts generated for ${countArticles(drafts)} article(s).`);
        }
        renderDrafts();
        updateButtons();
      })
      .catch(() => { showStatus("Failed to generate. Check network and try again.", true); })
      .finally(() => {
        btnGenerate.disabled = false;
        btnGenerate.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Generate';
      });
  });

  function countArticles(list) {
    const seen = {};
    for (let i = 0; i < list.length; i++) seen[list[i].article_slug || list[i].article_title] = true;
    return Object.keys(seen).length;
  }

  /* -- Delete --------------------------------------------------------- */
  btnDelete.addEventListener("click", () => {
    if (!drafts.length) return;
    deleteBody.innerHTML = "";

    const info = document.createElement("p");
    info.className = "social-modal-info";
    info.textContent = "Select posts to delete:";
    deleteBody.appendChild(info);

    const allLabel = document.createElement("label");
    allLabel.className = "social-modal-option social-modal-option--all";
    const allCb = document.createElement("input");
    allCb.type = "checkbox";
    allCb.setAttribute("data-modal-all", "");
    allCb.checked = true;
    allLabel.appendChild(allCb);
    allLabel.appendChild(document.createTextNode(` Delete all (${drafts.length} posts)`));
    deleteBody.appendChild(allLabel);

    const itemsDiv = document.createElement("div");
    itemsDiv.className = "social-modal-items";
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      const label = document.createElement("label");
      label.className = "social-modal-option";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.setAttribute("data-modal-id", d.id);
      label.appendChild(cb);
      label.appendChild(document.createTextNode(` ${platformLabel(d.platform)}: ${d.article_title.substring(0, 50)}`));
      itemsDiv.appendChild(label);
    }
    deleteBody.appendChild(itemsDiv);

    allCb.addEventListener("change", () => {
      const cbs = itemsDiv.querySelectorAll("input[type=checkbox]");
      for (let j = 0; j < cbs.length; j++) cbs[j].checked = allCb.checked;
    });

    deleteModal.classList.add("is-open");
  });

  deleteCancel.addEventListener("click", () => { deleteModal.classList.remove("is-open"); });
  deleteModal.addEventListener("click", (e) => {
    if (e.target === deleteModal) deleteModal.classList.remove("is-open");
  });

  deleteConfirm.addEventListener("click", () => {
    const allCb = deleteBody.querySelector("[data-modal-all]");
    const deleteAll = allCb && allCb.checked;
    const idsToDelete = [];

    if (!deleteAll) {
      const cbs = deleteBody.querySelectorAll("[data-modal-id]");
      for (let i = 0; i < cbs.length; i++) {
        if (cbs[i].checked) idsToDelete.push(cbs[i].getAttribute("data-modal-id"));
      }
      if (!idsToDelete.length) { deleteModal.classList.remove("is-open"); return; }
    }

    deleteConfirm.disabled = true;
    deleteConfirm.textContent = "Deleting…";

    let promise;
    if (deleteAll) {
      promise = authedFetch("/social/drafts", { method: "DELETE" });
    } else {
      promise = Promise.all(idsToDelete.map((id) => {
        return authedFetch(`/social/drafts/${id}`, { method: "DELETE" });
      }));
    }

    promise
      .then(() => {
        if (deleteAll) {
          drafts = [];
        } else {
          const set = {};
          for (let j = 0; j < idsToDelete.length; j++) set[idsToDelete[j]] = true;
          drafts = drafts.filter((d) => { return !set[d.id]; });
        }
        renderDrafts();
        updateButtons();
        showStatus(deleteAll ? "All drafts deleted." : `${idsToDelete.length} post(s) deleted.`);
      })
      .catch(() => { showStatus("Delete failed.", true); })
      .finally(() => {
        deleteModal.classList.remove("is-open");
        deleteConfirm.disabled = false;
        deleteConfirm.textContent = "Delete Selected";
      });
  });

  /* -- Push ----------------------------------------------------------- */
  btnPush.addEventListener("click", () => {
    const selected = getSelectedDraftIds();
    if (!selected.length) { showStatus("No posts selected to push.", true); return; }
    if (!Object.keys(channelMap).length) { showStatus("No Buffer channels found. Check BUFFER_API_KEY.", true); return; }

    btnPush.disabled = true;
    btnPush.textContent = "Pushing…";
    showStatus(`Sending ${selected.length} post(s) to Buffer…`);

    const schedules = {};
    for (let s = 0; s < drafts.length; s++) {
      if (drafts[s].scheduled_at && selected.indexOf(drafts[s].id) !== -1) {
        schedules[drafts[s].id] = drafts[s].scheduled_at;
      }
    }

    authedFetch("/social/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelMap,
        draftIds: selected,
        schedules,
      }),
    })
      .then((r) => { return r.json(); })
      .then((data) => {
        if (data.error) { showStatus(data.error, true); return; }
        const results = data.results || [];
        const ok = results.filter((r) => { return r.ok; }).length;
        const fail = results.filter((r) => { return !r.ok; }).length;
        let msg = `${ok} post(s) pushed to Buffer.`;
        if (fail) msg += ` ${fail} failed.`;
        showStatus(msg, fail > 0);

        // Remove pushed drafts from local state
        const pushedIds = {};
        for (let i = 0; i < results.length; i++) {
          if (results[i].ok) pushedIds[results[i].id] = true;
        }
        drafts = drafts.filter((d) => { return !pushedIds[d.id]; });
        renderDrafts();
        updateButtons();
      })
      .catch(() => { showStatus("Push failed. Check network and try again.", true); })
      .finally(() => {
        btnPush.disabled = false;
        btnPush.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Push to Buffer';
      });
  });

  function getSelectedDraftIds() {
    const ids = [];
    const cbs = draftsList.querySelectorAll("[data-draft-cb]");
    for (let i = 0; i < cbs.length; i++) {
      if (cbs[i].checked) ids.push(cbs[i].getAttribute("data-draft-cb"));
    }
    return ids;
  }

  /* -- Select all ----------------------------------------------------- */
  if (selectAllCb) {
    selectAllCb.addEventListener("change", () => {
      const cbs = draftsList.querySelectorAll("[data-draft-cb]");
      for (let i = 0; i < cbs.length; i++) cbs[i].checked = selectAllCb.checked;
    });
  }

  /* -- Load channels + existing drafts -------------------------------- */
  function init() {
    authedFetch("/social/channels")
      .then((r) => { return r.json(); })
      .then((data) => {
        channels = data.channels || [];
        for (let i = 0; i < channels.length; i++) {
          const ch = channels[i];
          const svc = (ch.service || "").toLowerCase();
          if (svc === "twitter" || svc === "x") channelMap.twitter = ch.id;
          else if (svc === "linkedin") channelMap.linkedin = ch.id;
          else if (svc === "facebook") channelMap.facebook = ch.id;
          else if (svc === "threads") channelMap.threads = ch.id;
        }
        updateButtons();
      })
      .catch(() => { /* channels unavailable — push will be disabled */ });

    authedFetch("/social/drafts")
      .then((r) => { return r.json(); })
      .then((data) => {
        drafts = data.drafts || [];
        renderDrafts();
        updateButtons();
      })
      .catch(() => { /* no existing drafts */ });
  }

  init();
})();
