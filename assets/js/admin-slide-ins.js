/*
 * /admin/slide-ins/ — CRUD for slide-in CTAs stored in KV.
 */
(function () {
  const host = document.querySelector("[data-admin-slide-ins]");
  if (!host) return;

  const workerUrl = host.getAttribute("data-worker-url");
  if (!workerUrl) return;

  const listView = host.querySelector("[data-slide-in-list]");
  const itemsContainer = host.querySelector("[data-slide-in-items]");
  const editorView = host.querySelector("[data-slide-in-editor]");
  const form = host.querySelector("[data-slide-in-form]");
  const createBtn = host.querySelector("[data-slide-in-create]");
  const saveBtn = host.querySelector("[data-slide-in-save]");
  const cancelBtn = host.querySelector("[data-slide-in-cancel]");
  const statusEl = host.querySelector("[data-slide-in-status]");
  const pagesSelect = form.querySelector('[name="pages_type"]');
  const tagField = form.querySelector("[data-tag-field]");
  const tagInput = form.querySelector('[name="tag_slug"]');
  const triggerSelect = form.querySelector('[name="trigger"]');
  const triggerValueField = form.querySelector("[data-trigger-value-field]");
  const triggerValueInput = form.querySelector('[name="trigger_value"]');
  const triggerHint = form.querySelector("[data-trigger-hint]");
  const audienceGroup = form.querySelector("[data-audience-group]");
  const audienceBoxes = form.querySelectorAll('[name="audience"]');
  const previewBtn = host.querySelector("[data-slide-in-preview]");
  const previewPanel = host.querySelector("[data-slide-in-preview-panel]");
  const previewStage = host.querySelector("[data-slide-in-preview-stage]");
  const previewCloseBtn = host.querySelector("[data-slide-in-preview-close]");
  const previewViewport = host.querySelector("[data-preview-viewport]");
  const previewModeBtns = host.querySelectorAll("[data-preview-mode]");

  // Image upload elements
  const imageHidden = form.querySelector('[name="image"]');
  const imagePreview = form.querySelector("[data-image-preview]");
  const imagePreviewImg = form.querySelector("[data-image-preview-img]");
  const imagePicker = form.querySelector("[data-image-picker]");
  const imageFile = form.querySelector("[data-image-file]");
  const imageChoose = form.querySelector("[data-image-choose]");
  const imageRemove = form.querySelector("[data-image-remove]");
  const imageUploading = form.querySelector("[data-image-uploading]");

  let editingId = null;

  pagesSelect.addEventListener("change", () => {
    tagField.hidden = pagesSelect.value !== "tag";
  });

  // Audience checkbox logic: "everyone" clears the rest, picking specifics clears "everyone"
  audienceBoxes.forEach((box) => {
    box.addEventListener("change", () => {
      if (box.value === "everyone" && box.checked) {
        audienceBoxes.forEach((b) => { if (b.value !== "everyone") b.checked = false; });
      } else if (box.value !== "everyone" && box.checked) {
        var everyoneBox = form.querySelector('[name="audience"][value="everyone"]');
        if (everyoneBox) everyoneBox.checked = false;
      }
    });
  });

  function updateTriggerUI() {
    const t = triggerSelect.value;
    if (t === "exit") {
      triggerValueField.hidden = true;
    } else {
      triggerValueField.hidden = false;
      if (t === "scroll") {
        triggerHint.textContent = "Percentage of page scrolled (e.g. 50 = halfway).";
      } else {
        triggerHint.textContent = "Seconds before showing (default 3).";
      }
    }
  }
  triggerSelect.addEventListener("change", updateTriggerUI);

  // Image upload handlers
  imageChoose.addEventListener("click", () => { imageFile.click(); });
  imageRemove.addEventListener("click", () => { setImage(""); });

  imageFile.addEventListener("change", () => {
    const file = imageFile.files && imageFile.files[0];
    if (!file) return;
    uploadImage(file);
    imageFile.value = "";
  });

  function setImage(url) {
    imageHidden.value = url;
    if (url) {
      imagePreviewImg.src = url;
      imagePreview.hidden = false;
      imagePicker.hidden = true;
    } else {
      imagePreviewImg.src = "";
      imagePreview.hidden = true;
      imagePicker.hidden = false;
    }
  }

  function uploadImage(file) {
    imageChoose.hidden = true;
    imageUploading.hidden = false;

    const fd = new FormData();
    fd.append("file", file);

    // MOAuth.fetch attaches the JWT in its closure; the bearer never
    // appears on `window`. Headers passed here are kept; Auth is added.
    window.MOAuth.fetch(`${workerUrl}/images/upload`, {
      method: "POST",
      body: fd,
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error || r.status); });
        return r.json();
      })
      .then((data) => { setImage(data.url); })
      .catch((err) => { showStatus(`Image upload failed: ${err.message}`, true); })
      .finally(() => {
        imageChoose.hidden = false;
        imageUploading.hidden = true;
      });
  }

  function showStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("is-error", !!isError);
    statusEl.hidden = false;
    if (!isError) setTimeout(() => { statusEl.hidden = true; }, 3000);
  }

  function showList() {
    editorView.hidden = true;
    listView.hidden = false;
    editingId = null;
    statusEl.hidden = true;
  }

  function showEditor(item) {
    listView.hidden = true;
    editorView.hidden = false;
    statusEl.hidden = true;

    if (item) {
      editingId = item.id;
      form.querySelector('[name="name"]').value = item.name || "";
      form.querySelector('[name="eyebrow"]').value = item.eyebrow || "";
      form.querySelector('[name="headline"]').value = item.headline || "";
      setImage(item.image || "");
      form.querySelector('[name="body"]').value = item.body || "";
      form.querySelector('[name="button_text"]').value = item.button_text || "";
      form.querySelector('[name="button_url"]').value = item.button_url || "";
      // Populate audience checkboxes
      var aud = (item.audience || "everyone").split(",");
      audienceBoxes.forEach((b) => { b.checked = aud.indexOf(b.value) >= 0; });
      form.querySelector('[name="frequency"]').value = item.frequency || "weekly";
      form.querySelector('[name="priority"]').value = item.priority || 0;
      form.querySelector('[name="active"]').checked = item.active !== false;
      triggerSelect.value = item.trigger || "delay";
      triggerValueInput.value = item.trigger_value || 0;
      updateTriggerUI();

      const pages = item.pages || "all";
      if (pages.indexOf("tag:") === 0) {
        pagesSelect.value = "tag";
        tagInput.value = pages.slice(4);
        tagField.hidden = false;
      } else {
        pagesSelect.value = pages;
        tagInput.value = "";
        tagField.hidden = true;
      }
    } else {
      editingId = null;
      form.querySelectorAll("input:not([type=file]):not([type=hidden]), textarea, select").forEach((el) => {
        if (el.name === "audience") { el.checked = el.value === "everyone"; }
        else if (el.name === "active" && el.type === "checkbox") el.checked = true;
        else if (el.type === "checkbox") el.checked = false;
        else if (el.type === "number") el.value = "0";
        else if (el.tagName === "SELECT") el.selectedIndex = 0;
        else el.value = "";
      });
      setImage("");
      tagField.hidden = true;
      triggerValueInput.value = "3";
      updateTriggerUI();
    }
  }

  function collect() {
    let pages = pagesSelect.value;
    if (pages === "tag") {
      const slug = tagInput.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
      pages = slug ? `tag:${slug}` : "all";
    }
    return {
      name: form.querySelector('[name="name"]').value.trim(),
      eyebrow: form.querySelector('[name="eyebrow"]').value.trim(),
      headline: form.querySelector('[name="headline"]').value.trim(),
      image: form.querySelector('[name="image"]').value.trim(),
      body: form.querySelector('[name="body"]').value.trim(),
      button_text: form.querySelector('[name="button_text"]').value.trim(),
      button_url: form.querySelector('[name="button_url"]').value.trim(),
      pages,
      audience: Array.from(audienceBoxes).filter(function (b) { return b.checked; }).map(function (b) { return b.value; }).join(",") || "everyone",
      frequency: form.querySelector('[name="frequency"]').value,
      priority: parseInt(form.querySelector('[name="priority"]').value, 10) || 0,
      active: form.querySelector('[name="active"]').checked,
      trigger: triggerSelect.value,
      trigger_value: parseInt(triggerValueInput.value, 10) || 0,
    };
  }

  function renderList(items, stats) {
    stats = stats || {};
    if (!items.length) {
      itemsContainer.innerHTML = '<p class="admin-sub">No slide-ins yet. Create one to get started.</p>';
      return;
    }
    let html = '<ul class="admin-slide-in-list">';
    items.forEach((item) => {
      const statusClass = item.active ? "is-active" : "is-inactive";
      const statusLabel = item.active ? "Active" : "Inactive";
      const target = item.pages === "all" ? "All pages" :
        item.pages === "homepage" ? "Homepage" :
        item.pages === "posts" ? "All posts" :
        item.pages.indexOf("tag:") === 0 ? `Tag: ${item.pages.slice(4)}` : item.pages;
      const audLabels = {
        everyone: "Everyone", "not-signed-in": "Not signed in",
        "signed-in": "Signed in", free: "Free", paid: "Paid"
      };
      const audience = (item.audience || "everyone").split(",").map(function (a) { return audLabels[a] || a; }).join(", ");

      let triggerLabel = { delay: "Delay", exit: "Exit intent", scroll: "Scroll" }[item.trigger || "delay"] || "Delay";
      if (item.trigger === "scroll" && item.trigger_value) triggerLabel += ` ${item.trigger_value}%`;
      else if ((!item.trigger || item.trigger === "delay") && item.trigger_value) triggerLabel += ` ${item.trigger_value}s`;

      html += `<li class="admin-slide-in-item">`
        + `<div class="admin-slide-in-info">`
        + `<h3 class="admin-slide-in-name"><em>${esc(item.name || item.headline)}</em></h3>`
        + `<p class="admin-slide-in-meta">`
        + `<span class="admin-slide-in-status ${statusClass}">${statusLabel}</span>`
        + ` &middot; ${esc(target)} &middot; ${esc(audience)
         } &middot; ${esc(triggerLabel)
         } &middot; ${esc(item.frequency)
         }${stats[item.id] ? ` &middot; ${stats[item.id].impressions || 0} views, ${stats[item.id].clicks || 0} clicks` : ''
         }</p>`
        + `</div>`
        + `<div class="admin-slide-in-actions">`
        + `<button type="button" class="btn btn-ghost btn-sm" data-toggle="${item.id}">${item.active ? 'Deactivate' : 'Activate'}</button>`
        + `<button type="button" class="btn btn-ghost btn-sm" data-edit="${item.id}">Edit</button>`
        + `<button type="button" class="btn btn-ghost btn-sm btn-danger" data-delete="${item.id}">Delete</button>`
        + `</div>`
        + `</li>`;
    });
    html += '</ul>';
    itemsContainer.innerHTML = html;

    itemsContainer.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-toggle");
        const item = items.find((i) => { return i.id === id; });
        if (!item) return;
        btn.disabled = true;
        window.MOAuth.fetch(`${workerUrl}/slide-ins/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !item.active }),
        })
          .then((r) => { if (!r.ok) throw new Error(r.status); })
          .then(() => { clearCache(); loadAll(); })
          .catch((err) => { alert(`Toggle failed: ${err.message}`); })
          .finally(() => { btn.disabled = false; });
      });
    });

    itemsContainer.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit");
        const item = items.find((i) => { return i.id === id; });
        if (item) showEditor(item);
      });
    });

    itemsContainer.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-delete");
        const item = items.find((i) => { return i.id === id; });
        if (!item || !confirm(`Delete "${item.name || item.headline}"?`)) return;
        window.MOAuth.fetch(`${workerUrl}/slide-ins/${id}`, {
          method: "DELETE",
        })
          .then((r) => { if (!r.ok) throw new Error(r.status); })
          .then(() => { clearCache(); loadAll(); })
          .catch((err) => { alert(`Delete failed: ${err.message}`); });
      });
    });
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  function clearCache() {
    try { sessionStorage.removeItem("mo_slide_ins"); } catch (e) {}
  }

  function loadAll() {
    Promise.all([
      window.MOAuth.fetch(`${workerUrl}/slide-ins/all`).then((r) => { return r.json(); }),
      window.MOAuth.fetch(`${workerUrl}/slide-ins/stats`).then((r) => { return r.json(); }).catch(() => { return {}; }),
    ])
      .then((results) => { renderList(results[0], results[1]); })
      .catch(() => { itemsContainer.innerHTML = '<p class="admin-sub">Could not load slide-ins.</p>'; });
  }

  createBtn.addEventListener("click", () => { showEditor(null); });
  cancelBtn.addEventListener("click", showList);

  saveBtn.addEventListener("click", () => {
    saveBtn.disabled = true;
    statusEl.hidden = true;
    const data = collect();
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `${workerUrl}/slide-ins/${editingId}` : `${workerUrl}/slide-ins`;

    window.MOAuth.fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error || r.status); });
        return r.json();
      })
      .then(() => {
        clearCache();
        showList();
        loadAll();
      })
      .catch((err) => { showStatus(err.message || "Save failed.", true); })
      .finally(() => { saveBtn.disabled = false; });
  });

  // ── Preview ──────────────────────────────────────────────────
  function renderPreview() {
    var data = collect();
    previewStage.innerHTML = "";

    var el = document.createElement("aside");
    el.className = "slide-in" + (data.image ? " has-image" : "") + " is-visible";
    el.setAttribute("role", "complementary");
    el.style.position = "relative";
    el.style.transform = "none";

    var close = document.createElement("button");
    close.type = "button";
    close.className = "slide-in-close";
    close.setAttribute("aria-label", "Dismiss");
    close.innerHTML = "&times;";
    el.appendChild(close);

    if (data.image) {
      var img = document.createElement("img");
      img.className = "slide-in-image";
      img.src = data.image;
      img.alt = "";
      el.appendChild(img);
    }

    var content = document.createElement("div");
    content.className = "slide-in-content";

    if (data.eyebrow) {
      var ey = document.createElement("p");
      ey.className = "eyebrow slide-in-eyebrow";
      ey.textContent = data.eyebrow;
      content.appendChild(ey);
    }

    var h = document.createElement("h3");
    h.className = "slide-in-headline";
    var em = document.createElement("em");
    em.textContent = data.headline || "(no headline)";
    h.appendChild(em);
    content.appendChild(h);

    if (data.body) {
      var p = document.createElement("p");
      p.className = "slide-in-body";
      p.textContent = data.body;
      content.appendChild(p);
    }

    var btn = document.createElement("a");
    btn.href = "#";
    btn.className = "btn btn-primary slide-in-btn";
    btn.textContent = data.button_text || "(no button text)";
    btn.addEventListener("click", function (e) { e.preventDefault(); });
    content.appendChild(btn);

    el.appendChild(content);
    previewStage.appendChild(el);
    previewPanel.hidden = false;
  }

  previewBtn.addEventListener("click", renderPreview);

  previewCloseBtn.addEventListener("click", function () {
    previewPanel.hidden = true;
    previewStage.innerHTML = "";
  });

  previewModeBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var mode = btn.getAttribute("data-preview-mode");
      previewViewport.setAttribute("data-preview-viewport", mode);
      previewModeBtns.forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      // Re-render to pick up size changes
      renderPreview();
    });
  });

  // MOAuth.fetch attaches the JWT internally; loadAll's first call
  // will surface 401/403 if the visitor isn't a staff member.
  loadAll();
})();
