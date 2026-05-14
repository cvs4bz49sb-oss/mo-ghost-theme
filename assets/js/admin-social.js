(function () {
  var root = document.querySelector("[data-admin-social]");
  if (!root) return;
  var WORKER = (root.getAttribute("data-worker-url") || "").replace(/\/$/, "");
  if (!WORKER) return;

  var summaryMount = root.querySelector("[data-social-summary]");
  var postsMount = root.querySelector("[data-social-posts]");
  var errorsMount = root.querySelector("[data-social-errors]");

  var PLATFORM_COLORS = {
    x: "#000000",
    linkedin: "#0A66C2",
    instagram: "#E4405F",
    threads: "#000000",
    facebook: "#1877F2"
  };

  /* -- State -------------------------------------------------------- */
  var allPosts = [];
  var expandedIndex = -1;

  /* -- Helpers ------------------------------------------------------ */
  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function authedFetch(path, opts) {
    return window.MOAuth.fetch(WORKER + path, opts || {});
  }

  function relativeTime(iso) {
    if (!iso) return "Never";
    var diff = Date.now() - new Date(iso).getTime();
    var seconds = Math.floor(diff / 1000);
    if (seconds < 60) return "just now";
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + " minute" + (minutes === 1 ? "" : "s") + " ago";
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + " hour" + (hours === 1 ? "" : "s") + " ago";
    var days = Math.floor(hours / 24);
    return days + " day" + (days === 1 ? "" : "s") + " ago";
  }

  function formatTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    var opts = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
    try { return d.toLocaleDateString("en-US", opts); }
    catch (_) { return d.toLocaleString(); }
  }

  function truncate(str, len) {
    if (!str) return "";
    if (str.length <= len) return str;
    return str.slice(0, len) + "…";
  }

  function platformBadge(platform) {
    var name = (platform || "").toLowerCase();
    var color = PLATFORM_COLORS[name] || "#666666";
    var label = name.charAt(0).toUpperCase() + name.slice(1);
    return '<span style="display:inline-block;padding:2px 8px;border-radius:3px;' +
      "font-size:12px;font-weight:600;color:#fff;background:" + esc(color) + '">' +
      esc(label) + "</span>";
  }

  /* -- Summary ------------------------------------------------------ */
  function renderSummary(data) {
    var html = '<p class="dashboard-form-legend"><em>Status</em></p>';

    var lastRun = data.lastRun ? relativeTime(data.lastRun) : "Never";
    var summary = data.summary || {};
    var articlesSelected = summary.articles_selected || summary.articlesSelected || 0;
    var postsScheduled = summary.posts_scheduled || summary.postsScheduled || 0;
    var errorCount = (data.errors || []).length;

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin-top:16px">';
    html += '<div><p class="admin-sub" style="margin:0 0 4px">Last Run</p><p style="font-size:16px;font-weight:600;margin:0">' + esc(lastRun) + "</p></div>";
    html += '<div><p class="admin-sub" style="margin:0 0 4px">Articles Selected</p><p style="font-size:16px;font-weight:600;margin:0">' + esc(String(articlesSelected)) + "</p></div>";
    html += '<div><p class="admin-sub" style="margin:0 0 4px">Posts Scheduled</p><p style="font-size:16px;font-weight:600;margin:0">' + esc(String(postsScheduled)) + "</p></div>";
    html += '<div><p class="admin-sub" style="margin:0 0 4px">Errors</p><p style="font-size:16px;font-weight:600;margin:0;' + (errorCount > 0 ? "color:#c0392b" : "") + '">' + esc(String(errorCount)) + "</p></div>";
    html += "</div>";

    summaryMount.innerHTML = html;
  }

  /* -- Posts table --------------------------------------------------- */
  function renderPosts(posts) {
    allPosts = posts || [];
    var html = '<p class="dashboard-form-legend"><em>Scheduled Posts</em></p>';

    if (!allPosts.length) {
      html += '<p class="admin-sub">No scheduled posts.</p>';
      postsMount.innerHTML = html;
      return;
    }

    html += '<div style="margin-top:16px">';
    for (var i = 0; i < allPosts.length; i++) {
      html += renderPostRow(allPosts[i], i);
    }
    html += "</div>";

    postsMount.innerHTML = html;
    bindPostClicks();
  }

  function renderPostRow(post, idx) {
    var title = post.article || post.title || "(untitled)";
    var platform = post.platform || "";
    var scheduled = formatTime(post.scheduled_time || post.scheduledTime || post.scheduled);
    var preview = truncate(post.text || post.preview || "", 80);
    var isExpanded = idx === expandedIndex;
    var borderColor = isExpanded ? "var(--color-accent, #b45309)" : "var(--color-border)";
    var cursor = "cursor:pointer";

    var html = '<div class="social-post-row" data-post-idx="' + idx + '" style="border-bottom:1px solid ' + borderColor + '">';

    // Summary row (always visible)
    html += '<div class="social-post-summary" style="display:grid;grid-template-columns:1fr auto auto 1fr;gap:12px;align-items:center;padding:12px 0;' + cursor + '">';
    html += '<span style="font-size:14px">' + esc(title) + "</span>";
    html += "<span>" + platformBadge(platform) + "</span>";
    html += '<span style="font-size:14px;white-space:nowrap;color:var(--color-muted)">' + esc(scheduled) + "</span>";
    html += '<span style="font-size:14px;color:var(--color-muted)">' + esc(preview) + "</span>";
    html += "</div>";

    // Detail panel (expanded)
    if (isExpanded) {
      html += renderDetailPanel(post, idx);
    }

    html += "</div>";
    return html;
  }

  function renderDetailPanel(post, idx) {
    var fullText = post.text || post.preview || "";
    var articleUrl = post.article_url || post.articleUrl || "";
    var postId = post.post_id || post.postId || "";
    var canEdit = !!postId;

    var html = '<div class="social-post-detail" style="padding:0 0 20px;border-top:1px solid var(--color-border)">';

    // Article link
    if (articleUrl) {
      html += '<p style="margin:12px 0 8px;font-size:13px"><a href="' + esc(articleUrl) + '" target="_blank" style="color:var(--color-accent)">' + esc(articleUrl) + "</a></p>";
    }

    // Full text area
    html += '<label style="display:block;margin:12px 0 6px;font-size:13px;font-weight:600;color:var(--color-muted)">Post Text</label>';
    if (canEdit) {
      html += '<textarea data-edit-textarea="' + idx + '" style="width:100%;min-height:120px;padding:10px;border:1px solid var(--color-border);border-radius:4px;font-size:14px;font-family:inherit;line-height:1.5;resize:vertical;background:var(--color-bg, #fff);color:var(--color-dark)">' + esc(fullText) + "</textarea>";
      html += '<div style="display:flex;align-items:center;gap:12px;margin-top:10px">';
      html += '<button data-save-btn="' + idx + '" style="padding:8px 20px;border:none;border-radius:4px;background:var(--color-accent, #b45309);color:#fff;font-size:14px;font-weight:600;cursor:pointer">Save to Buffer</button>';
      html += '<span data-save-status="' + idx + '" style="font-size:13px;color:var(--color-muted)"></span>';
      html += "</div>";
    } else {
      html += '<div style="padding:10px;border:1px solid var(--color-border);border-radius:4px;font-size:14px;line-height:1.5;white-space:pre-wrap;color:var(--color-dark)">' + esc(fullText) + "</div>";
      html += '<p style="margin:8px 0 0;font-size:12px;color:var(--color-muted)">No Buffer post ID. This post was generated but not scheduled (channel not connected).</p>';
    }

    html += "</div>";
    return html;
  }

  function bindPostClicks() {
    var summaries = postsMount.querySelectorAll(".social-post-summary");
    for (var i = 0; i < summaries.length; i++) {
      (function (el) {
        el.addEventListener("click", function () {
          var row = el.closest("[data-post-idx]");
          var idx = parseInt(row.getAttribute("data-post-idx"), 10);
          if (expandedIndex === idx) {
            expandedIndex = -1;
          } else {
            expandedIndex = idx;
          }
          renderPosts(allPosts);
        });
      })(summaries[i]);
    }

    // Bind save buttons
    var saveBtns = postsMount.querySelectorAll("[data-save-btn]");
    for (var j = 0; j < saveBtns.length; j++) {
      (function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var idx = parseInt(btn.getAttribute("data-save-btn"), 10);
          savePost(idx);
        });
      })(saveBtns[j]);
    }
  }

  /* -- Save edit to Buffer ------------------------------------------ */
  function savePost(idx) {
    var post = allPosts[idx];
    if (!post) return;

    var postId = post.post_id || post.postId || "";
    if (!postId) return;

    var textarea = postsMount.querySelector('[data-edit-textarea="' + idx + '"]');
    var statusEl = postsMount.querySelector('[data-save-status="' + idx + '"]');
    var btn = postsMount.querySelector('[data-save-btn="' + idx + '"]');
    if (!textarea) return;

    var newText = textarea.value.trim();
    if (!newText) {
      if (statusEl) statusEl.textContent = "Text cannot be empty.";
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving…";
    }
    if (statusEl) statusEl.textContent = "";

    authedFetch("/social/post/" + postId, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newText })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (result) {
        if (result.ok) {
          // Update local state
          post.text = newText;
          if (statusEl) {
            statusEl.style.color = "#27ae60";
            statusEl.textContent = "Saved.";
          }
        } else {
          if (statusEl) {
            statusEl.style.color = "#c0392b";
            statusEl.textContent = result.data.error || "Save failed.";
          }
        }
      })
      .catch(function () {
        if (statusEl) {
          statusEl.style.color = "#c0392b";
          statusEl.textContent = "Network error.";
        }
      })
      .finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Save to Buffer";
        }
      });
  }

  /* -- Errors ------------------------------------------------------- */
  function renderErrors(errors) {
    if (!errors || !errors.length) {
      errorsMount.hidden = true;
      return;
    }

    errorsMount.hidden = false;
    var html = '<p class="dashboard-form-legend"><em>Errors</em></p>';
    html += '<div style="margin-top:16px">';

    for (var i = 0; i < errors.length; i++) {
      var err = errors[i];
      var timestamp = formatTime(err.timestamp || err.time || err.at || "");
      var message = err.message || err.error || String(err);

      html += '<div style="padding:8px 0;border-bottom:1px solid var(--color-border);font-size:14px">';
      if (timestamp) {
        html += '<span style="color:var(--color-muted);margin-right:8px">' + esc(timestamp) + "</span>";
      }
      html += '<span style="color:#c0392b">' + esc(message) + "</span>";
      html += "</div>";
    }

    html += "</div>";
    errorsMount.innerHTML = html;
  }

  /* -- Load --------------------------------------------------------- */
  function load() {
    authedFetch("/social/status")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        renderSummary(data);
        renderPosts(data.posts || []);
        renderErrors(data.errors || []);
      })
      .catch(function () {
        summaryMount.innerHTML = '<p class="dashboard-form-legend"><em>Status</em></p><p class="admin-sub">Failed to load social status.</p>';
        postsMount.innerHTML = '<p class="dashboard-form-legend"><em>Scheduled Posts</em></p><p class="admin-sub">Failed to load.</p>';
        errorsMount.hidden = true;
      });
  }

  load();
})();
