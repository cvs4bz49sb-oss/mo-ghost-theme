/*
 * /admin/slide-ins/ — CRUD for slide-in CTAs stored in KV.
 */
(function () {
  var host = document.querySelector("[data-admin-slide-ins]");
  if (!host) return;

  var workerUrl = host.getAttribute("data-worker-url");
  if (!workerUrl) return;

  var listView = host.querySelector("[data-slide-in-list]");
  var itemsContainer = host.querySelector("[data-slide-in-items]");
  var editorView = host.querySelector("[data-slide-in-editor]");
  var form = host.querySelector("[data-slide-in-form]");
  var createBtn = host.querySelector("[data-slide-in-create]");
  var saveBtn = host.querySelector("[data-slide-in-save]");
  var cancelBtn = host.querySelector("[data-slide-in-cancel]");
  var statusEl = host.querySelector("[data-slide-in-status]");
  var pagesSelect = form.querySelector('[name="pages_type"]');
  var tagField = form.querySelector("[data-tag-field]");
  var tagInput = form.querySelector('[name="tag_slug"]');
  var triggerSelect = form.querySelector('[name="trigger"]');
  var triggerValueField = form.querySelector("[data-trigger-value-field]");
  var triggerValueInput = form.querySelector('[name="trigger_value"]');
  var triggerHint = form.querySelector("[data-trigger-hint]");

  // Image upload elements
  var imageHidden = form.querySelector('[name="image"]');
  var imagePreview = form.querySelector("[data-image-preview]");
  var imagePreviewImg = form.querySelector("[data-image-preview-img]");
  var imagePicker = form.querySelector("[data-image-picker]");
  var imageFile = form.querySelector("[data-image-file]");
  var imageChoose = form.querySelector("[data-image-choose]");
  var imageRemove = form.querySelector("[data-image-remove]");
  var imageUploading = form.querySelector("[data-image-uploading]");

  var editingId = null;
  var authHeaders = null;

  pagesSelect.addEventListener("change", function () {
    tagField.hidden = pagesSelect.value !== "tag";
  });

  function updateTriggerUI() {
    var t = triggerSelect.value;
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
  imageChoose.addEventListener("click", function () { imageFile.click(); });
  imageRemove.addEventListener("click", function () { setImage(""); });

  imageFile.addEventListener("change", function () {
    var file = imageFile.files && imageFile.files[0];
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
    if (!authHeaders) return;
    imageChoose.hidden = true;
    imageUploading.hidden = false;

    var fd = new FormData();
    fd.append("file", file);

    fetch(workerUrl + "/images/upload", {
      method: "POST",
      headers: { Authorization: authHeaders.Authorization },
      body: fd,
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || r.status); });
        return r.json();
      })
      .then(function (data) { setImage(data.url); })
      .catch(function (err) { showStatus("Image upload failed: " + err.message, true); })
      .finally(function () {
        imageChoose.hidden = false;
        imageUploading.hidden = true;
      });
  }

  function showStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("is-error", !!isError);
    statusEl.hidden = false;
    if (!isError) setTimeout(function () { statusEl.hidden = true; }, 3000);
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
      form.querySelector('[name="audience"]').value = item.audience || "everyone";
      form.querySelector('[name="frequency"]').value = item.frequency || "weekly";
      form.querySelector('[name="priority"]').value = item.priority || 0;
      form.querySelector('[name="active"]').checked = item.active !== false;
      triggerSelect.value = item.trigger || "delay";
      triggerValueInput.value = item.trigger_value || 0;
      updateTriggerUI();

      var pages = item.pages || "all";
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
      form.querySelectorAll("input:not([type=file]):not([type=hidden]), textarea, select").forEach(function (el) {
        if (el.type === "checkbox") el.checked = true;
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
    var pages = pagesSelect.value;
    if (pages === "tag") {
      var slug = tagInput.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
      pages = slug ? "tag:" + slug : "all";
    }
    return {
      name: form.querySelector('[name="name"]').value.trim(),
      eyebrow: form.querySelector('[name="eyebrow"]').value.trim(),
      headline: form.querySelector('[name="headline"]').value.trim(),
      image: form.querySelector('[name="image"]').value.trim(),
      body: form.querySelector('[name="body"]').value.trim(),
      button_text: form.querySelector('[name="button_text"]').value.trim(),
      button_url: form.querySelector('[name="button_url"]').value.trim(),
      pages: pages,
      audience: form.querySelector('[name="audience"]').value,
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
    var html = '<ul class="admin-slide-in-list">';
    items.forEach(function (item) {
      var statusClass = item.active ? "is-active" : "is-inactive";
      var statusLabel = item.active ? "Active" : "Inactive";
      var target = item.pages === "all" ? "All pages" :
        item.pages === "homepage" ? "Homepage" :
        item.pages === "posts" ? "All posts" :
        item.pages.indexOf("tag:") === 0 ? "Tag: " + item.pages.slice(4) : item.pages;
      var audience = {
        everyone: "Everyone", "not-signed-in": "Not signed in",
        "signed-in": "Signed in", free: "Free", paid: "Paid"
      }[item.audience] || item.audience;

      var triggerLabel = { delay: "Delay", exit: "Exit intent", scroll: "Scroll" }[item.trigger || "delay"] || "Delay";
      if (item.trigger === "scroll" && item.trigger_value) triggerLabel += " " + item.trigger_value + "%";
      else if ((!item.trigger || item.trigger === "delay") && item.trigger_value) triggerLabel += " " + item.trigger_value + "s";

      html += '<li class="admin-slide-in-item">'
        + '<div class="admin-slide-in-info">'
        + '<h3 class="admin-slide-in-name"><em>' + esc(item.name || item.headline) + '</em></h3>'
        + '<p class="admin-slide-in-meta">'
        + '<span class="admin-slide-in-status ' + statusClass + '">' + statusLabel + '</span>'
        + ' &middot; ' + esc(target) + ' &middot; ' + esc(audience)
        + ' &middot; ' + esc(triggerLabel)
        + ' &middot; ' + esc(item.frequency)
        + (stats[item.id] ? ' &middot; ' + (stats[item.id].impressions || 0) + ' views, ' + (stats[item.id].clicks || 0) + ' clicks' : '')
        + '</p>'
        + '</div>'
        + '<div class="admin-slide-in-actions">'
        + '<button type="button" class="btn btn-pill btn-ghost btn-sm" data-toggle="' + item.id + '">' + (item.active ? 'Deactivate' : 'Activate') + '</button>'
        + '<button type="button" class="btn btn-pill btn-ghost btn-sm" data-edit="' + item.id + '">Edit</button>'
        + '<button type="button" class="btn btn-pill btn-ghost btn-sm btn-danger" data-delete="' + item.id + '">Delete</button>'
        + '</div>'
        + '</li>';
    });
    html += '</ul>';
    itemsContainer.innerHTML = html;

    itemsContainer.querySelectorAll("[data-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-toggle");
        var item = items.find(function (i) { return i.id === id; });
        if (!item) return;
        btn.disabled = true;
        fetch(workerUrl + "/slide-ins/" + id, {
          method: "PUT",
          headers: Object.assign({ "Content-Type": "application/json" }, authHeaders),
          body: JSON.stringify({ active: !item.active }),
        })
          .then(function (r) { if (!r.ok) throw new Error(r.status); })
          .then(function () { clearCache(); loadAll(); })
          .catch(function (err) { alert("Toggle failed: " + err.message); })
          .finally(function () { btn.disabled = false; });
      });
    });

    itemsContainer.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-edit");
        var item = items.find(function (i) { return i.id === id; });
        if (item) showEditor(item);
      });
    });

    itemsContainer.querySelectorAll("[data-delete]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-delete");
        var item = items.find(function (i) { return i.id === id; });
        if (!item || !confirm('Delete "' + (item.name || item.headline) + '"?')) return;
        fetch(workerUrl + "/slide-ins/" + id, {
          method: "DELETE",
          headers: authHeaders,
        })
          .then(function (r) { if (!r.ok) throw new Error(r.status); })
          .then(function () { clearCache(); loadAll(); })
          .catch(function (err) { alert("Delete failed: " + err.message); });
      });
    });
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  function clearCache() {
    try { sessionStorage.removeItem("mo_slide_ins"); } catch (e) {}
  }

  function loadAll() {
    Promise.all([
      fetch(workerUrl + "/slide-ins/all", { headers: authHeaders }).then(function (r) { return r.json(); }),
      fetch(workerUrl + "/slide-ins/stats", { headers: authHeaders }).then(function (r) { return r.json(); }).catch(function () { return {}; }),
    ])
      .then(function (results) { renderList(results[0], results[1]); })
      .catch(function () { itemsContainer.innerHTML = '<p class="admin-sub">Could not load slide-ins.</p>'; });
  }

  createBtn.addEventListener("click", function () { showEditor(null); });
  cancelBtn.addEventListener("click", showList);

  saveBtn.addEventListener("click", function () {
    saveBtn.disabled = true;
    statusEl.hidden = true;
    var data = collect();
    var method = editingId ? "PUT" : "POST";
    var url = editingId ? workerUrl + "/slide-ins/" + editingId : workerUrl + "/slide-ins";

    fetch(url, {
      method: method,
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders),
      body: JSON.stringify(data),
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || r.status); });
        return r.json();
      })
      .then(function () {
        clearCache();
        showList();
        loadAll();
      })
      .catch(function (err) { showStatus(err.message || "Save failed.", true); })
      .finally(function () { saveBtn.disabled = false; });
  });

  MOAdminAuth.headers().then(function (headers) {
    if (!headers.Authorization) {
      itemsContainer.innerHTML = '<p class="admin-sub">Not authorized.</p>';
      return;
    }
    authHeaders = headers;
    loadAll();
  });
})();
