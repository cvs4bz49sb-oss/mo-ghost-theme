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
  var groupedPosts = [];   // [{article, article_url, scheduled, platforms: [{platform, text, post_id}]}]
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

  function platformBadge(platform) {
    var name = (platform || "").toLowerCase();
    var color = PLATFORM_COLORS[name] || "#666666";
    var label = name.charAt(0).toUpperCase() + name.slice(1);
    return '<span style="display:inline-block;padding:2px 8px;border-radius:3px;' +
      "font-size:12px;font-weight:600;color:#fff;background:" + esc(color) + ";margin-right:4px" + '">' +
      esc(label) + "</span>";
  }

  /* -- Group flat posts by article ---------------------------------- */
  function groupByArticle(posts) {
    var map = {};
    var order = [];
    for (var i = 0; i < posts.length; i++) {
      var p = posts[i];
      // Key by article + scheduled time to group same article/slot
      var key = (p.article || "") + "|" + (p.scheduled_time || p.scheduledTime || "");
      if (!map[key]) {
        map[key] = {
          article: p.article || p.title || "(untitled)",
          article_url: p.article_url || p.articleUrl || "",
          scheduled: p.scheduled_time || p.scheduledTime || p.scheduled || "",
          platforms: []
        };
        order.push(key);
      }
      map[key].platforms.push({
        platform: p.platform || "",
        text: p.text || p.preview || "",
        post_id: p.post_id || p.postId || ""
      });
    }
    var result = [];
    for (var j = 0; j < order.length; j++) {
      result.push(map[order[j]]);
    }
    return result;
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

  /* -- Posts list ---------------------------------------------------- */
  function renderPosts(posts) {
    groupedPosts = groupByArticle(posts || []);
    var html = '<p class="dashboard-form-legend"><em>Scheduled Posts</em></p>';

    if (!groupedPosts.length) {
      html += '<p class="admin-sub">No scheduled posts.</p>';
      postsMount.innerHTML = html;
      return;
    }

    html += '<div style="margin-top:16px">';
    for (var i = 0; i < groupedPosts.length; i++) {
      html += renderArticleRow(groupedPosts[i], i);
    }
    html += "</div>";

    postsMount.innerHTML = html;
    bindClicks();
  }

  function renderArticleRow(group, idx) {
    var isExpanded = idx === expandedIndex;
    var borderColor = isExpanded ? "var(--color-accent, #b45309)" : "var(--color-border)";

    var html = '<div data-group-idx="' + idx + '" style="border-bottom:1px solid ' + borderColor + '">';

    // Summary row
    html += '<div class="social-group-summary" style="display:grid;grid-template-columns:1fr auto auto;gap:16px;align-items:center;padding:14px 0;cursor:pointer">';
    html += '<span style="font-size:14px;font-weight:500">' + esc(group.article) + "</span>";
    // Platform badges
    html += "<span>";
    for (var i = 0; i < group.platforms.length; i++) {
      html += platformBadge(group.platforms[i].platform);
    }
    html += "</span>";
    html += '<span style="font-size:14px;white-space:nowrap;color:var(--color-muted)">' + esc(formatTime(group.scheduled)) + "</span>";
    html += "</div>";

    // Detail panel
    if (isExpanded) {
      html += renderDetailPanel(group, idx);
    }

    html += "</div>";
    return html;
  }

  function renderDetailPanel(group, groupIdx) {
    var html = '<div style="padding:0 0 24px">';

    // Article link
    if (group.article_url) {
      html += '<p style="margin:0 0 16px;font-size:13px"><a href="' + esc(group.article_url) + '" target="_blank" style="color:var(--color-accent)">' + esc(group.article_url) + "</a></p>";
    }

    // One section per platform
    for (var i = 0; i < group.platforms.length; i++) {
      var plat = group.platforms[i];
      var uid = groupIdx + "-" + i;

      html += '<div style="' + (i > 0 ? "margin-top:20px;padding-top:20px;border-top:1px solid var(--color-border)" : "") + '">';
      html += '<div style="margin-bottom:8px">' + platformBadge(plat.platform) + "</div>";

      if (plat.post_id) {
        html += '<textarea data-edit="' + esc(uid) + '" data-post-id="' + esc(plat.post_id) + '" style="width:100%;min-height:100px;padding:10px;border:1px solid var(--color-border);border-radius:4px;font-size:14px;font-family:inherit;line-height:1.5;resize:vertical;background:var(--color-bg, #fff);color:var(--color-dark)">' + esc(plat.text) + "</textarea>";
        html += '<div style="display:flex;align-items:center;gap:12px;margin-top:8px">';
        html += '<button data-save="' + esc(uid) + '" data-post-id="' + esc(plat.post_id) + '" data-group="' + groupIdx + '" data-plat="' + i + '" style="padding:6px 16px;border:none;border-radius:4px;background:var(--color-accent, #b45309);color:#fff;font-size:13px;font-weight:600;cursor:pointer">Save to Buffer</button>';
        html += '<span data-status="' + esc(uid) + '" style="font-size:13px;color:var(--color-muted)"></span>';
        html += "</div>";
      } else {
        html += '<div style="padding:10px;border:1px solid var(--color-border);border-radius:4px;font-size:14px;line-height:1.5;white-space:pre-wrap;color:var(--color-dark)">' + esc(plat.text) + "</div>";
      }

      html += "</div>";
    }

    html += "</div>";
    return html;
  }

  /* -- Event binding ------------------------------------------------ */
  function bindClicks() {
    // Toggle expand/collapse
    var summaries = postsMount.querySelectorAll(".social-group-summary");
    for (var i = 0; i < summaries.length; i++) {
      (function (el) {
        el.addEventListener("click", function () {
          var row = el.closest("[data-group-idx]");
          var idx = parseInt(row.getAttribute("data-group-idx"), 10);
          expandedIndex = expandedIndex === idx ? -1 : idx;
          renderPosts(flattenGroups());
        });
      })(summaries[i]);
    }

    // Save buttons
    var saveBtns = postsMount.querySelectorAll("[data-save]");
    for (var j = 0; j < saveBtns.length; j++) {
      (function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var uid = btn.getAttribute("data-save");
          var postId = btn.getAttribute("data-post-id");
          var groupIdx = parseInt(btn.getAttribute("data-group"), 10);
          var platIdx = parseInt(btn.getAttribute("data-plat"), 10);
          savePost(uid, postId, groupIdx, platIdx);
        });
      })(saveBtns[j]);
    }
  }

  /* -- Flatten grouped state back to flat array for re-render ------- */
  function flattenGroups() {
    var flat = [];
    for (var i = 0; i < groupedPosts.length; i++) {
      var g = groupedPosts[i];
      for (var j = 0; j < g.platforms.length; j++) {
        flat.push({
          article: g.article,
          article_url: g.article_url,
          scheduled_time: g.scheduled,
          platform: g.platforms[j].platform,
          text: g.platforms[j].text,
          post_id: g.platforms[j].post_id
        });
      }
    }
    return flat;
  }

  /* -- Save edit to Buffer ------------------------------------------ */
  function savePost(uid, postId, groupIdx, platIdx) {
    if (!postId) return;

    var textarea = postsMount.querySelector('[data-edit="' + uid + '"]');
    var statusEl = postsMount.querySelector('[data-status="' + uid + '"]');
    var btn = postsMount.querySelector('[data-save="' + uid + '"]');
    if (!textarea) return;

    var newText = textarea.value.trim();
    if (!newText) {
      if (statusEl) statusEl.textContent = "Text cannot be empty.";
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
    if (statusEl) statusEl.textContent = "";

    authedFetch("/social/post/" + postId, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newText })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (result) {
        if (result.ok) {
          // Update local state so re-renders keep the edit
          if (groupedPosts[groupIdx] && groupedPosts[groupIdx].platforms[platIdx]) {
            groupedPosts[groupIdx].platforms[platIdx].text = newText;
          }
          if (statusEl) { statusEl.style.color = "#27ae60"; statusEl.textContent = "Saved."; }
        } else {
          if (statusEl) { statusEl.style.color = "#c0392b"; statusEl.textContent = result.data.error || "Save failed."; }
        }
      })
      .catch(function () {
        if (statusEl) { statusEl.style.color = "#c0392b"; statusEl.textContent = "Network error."; }
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = "Save to Buffer"; }
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
