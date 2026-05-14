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
    threads: "#000000"
  };

  /* -- State -------------------------------------------------------- */
  var groupedPosts = [];
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
    if (minutes < 60) return minutes + " min ago";
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h ago";
    var days = Math.floor(hours / 24);
    return days + "d ago";
  }

  function formatTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    try {
      return d.toLocaleDateString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
      });
    } catch (_) { return d.toLocaleString(); }
  }

  function platformBadge(platform) {
    var name = (platform || "").toLowerCase();
    var color = PLATFORM_COLORS[name] || "#666";
    var label = name.charAt(0).toUpperCase() + name.slice(1);
    return '<span style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:11px;font-weight:600;color:#fff;background:' + esc(color) + ';margin-right:4px">' + esc(label) + "</span>";
  }

  /* -- Group flat posts by article ---------------------------------- */
  function groupByArticle(posts) {
    var map = {};
    var order = [];
    for (var i = 0; i < posts.length; i++) {
      var p = posts[i];
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
    for (var j = 0; j < order.length; j++) result.push(map[order[j]]);
    return result;
  }

  /* -- Summary ------------------------------------------------------ */
  function renderSummary(data) {
    var html = '<p class="dashboard-form-legend"><em>Status</em></p>';
    var lastRun = data.lastRun ? relativeTime(data.lastRun) : "Never";
    var summary = data.summary || {};
    var articles = summary.articles_selected || summary.articlesSelected || 0;
    var scheduled = summary.posts_scheduled || summary.postsScheduled || 0;
    var errors = (data.errors || []).length;

    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:16px">';
    html += statBox("Last Run", lastRun, "");
    html += statBox("Articles", String(articles), "");
    html += statBox("Scheduled", String(scheduled), "");
    html += statBox("Errors", String(errors), errors > 0 ? "color:#c0392b" : "");
    html += "</div>";
    summaryMount.innerHTML = html;
  }

  function statBox(label, value, style) {
    return '<div><p class="admin-sub" style="margin:0 0 4px">' + esc(label) + '</p><p style="font-size:16px;font-weight:600;margin:0;' + style + '">' + esc(value) + "</p></div>";
  }

  /* -- Posts --------------------------------------------------------- */
  function renderPosts(posts) {
    groupedPosts = groupByArticle(posts || []);
    var html = '<p class="dashboard-form-legend"><em>Scheduled Posts</em></p>';

    if (!groupedPosts.length) {
      html += '<p class="admin-sub">No scheduled posts.</p>';
      postsMount.innerHTML = html;
      return;
    }

    // Table header
    html += '<table style="width:100%;border-collapse:collapse;margin-top:16px;table-layout:fixed">';
    html += "<colgroup>";
    html += '<col style="width:40%">';   // Article
    html += '<col style="width:25%">';   // Platforms
    html += '<col style="width:35%">';   // Scheduled
    html += "</colgroup>";
    html += "<thead><tr>";
    html += th("Article");
    html += th("Platforms");
    html += th("Scheduled");
    html += "</tr></thead><tbody>";

    for (var i = 0; i < groupedPosts.length; i++) {
      html += renderGroupRow(groupedPosts[i], i);
    }

    html += "</tbody></table>";
    postsMount.innerHTML = html;
    bindClicks();
  }

  function th(label) {
    return '<th style="text-align:left;padding:10px 12px;border-bottom:2px solid var(--color-border);font-weight:600;font-size:13px;letter-spacing:.03em;text-transform:uppercase;color:var(--color-muted)">' + esc(label) + "</th>";
  }

  function renderGroupRow(group, idx) {
    var isExpanded = idx === expandedIndex;
    var html = "";

    // Summary row
    html += '<tr data-group-idx="' + idx + '" class="social-group-summary" style="cursor:pointer' + (isExpanded ? ";background:rgba(0,0,0,.02)" : "") + '">';
    html += '<td style="padding:12px;border-bottom:1px solid var(--color-border);font-size:14px;font-weight:500;vertical-align:middle">' + esc(group.article) + "</td>";
    // Platform badges
    html += '<td style="padding:12px;border-bottom:1px solid var(--color-border);vertical-align:middle">';
    for (var i = 0; i < group.platforms.length; i++) {
      html += platformBadge(group.platforms[i].platform);
    }
    html += "</td>";
    html += '<td style="padding:12px;border-bottom:1px solid var(--color-border);font-size:14px;color:var(--color-muted);vertical-align:middle;white-space:nowrap">' + esc(formatTime(group.scheduled)) + "</td>";
    html += "</tr>";

    // Detail panel row
    if (isExpanded) {
      html += '<tr><td colspan="3" style="padding:0;border-bottom:2px solid var(--color-accent, #b45309)">';
      html += renderDetail(group, idx);
      html += "</td></tr>";
    }

    return html;
  }

  function renderDetail(group, groupIdx) {
    var html = '<div style="padding:16px 12px 24px">';

    // Article URL (editable)
    html += '<div style="margin-bottom:16px">';
    html += '<label style="display:block;font-size:12px;font-weight:600;color:var(--color-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.03em">Article Link</label>';
    html += '<input data-field="url" data-group="' + groupIdx + '" type="text" value="' + esc(group.article_url) + '" style="width:100%;padding:8px 10px;border:1px solid var(--color-border);border-radius:4px;font-size:14px;font-family:inherit;color:var(--color-dark);background:var(--color-bg,#fff)">';
    html += "</div>";

    // Scheduled time (editable)
    html += '<div style="margin-bottom:20px">';
    html += '<label style="display:block;font-size:12px;font-weight:600;color:var(--color-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.03em">Scheduled Date &amp; Time</label>';
    var isoLocal = toLocalISO(group.scheduled);
    html += '<input data-field="scheduled" data-group="' + groupIdx + '" type="datetime-local" value="' + esc(isoLocal) + '" style="padding:8px 10px;border:1px solid var(--color-border);border-radius:4px;font-size:14px;font-family:inherit;color:var(--color-dark);background:var(--color-bg,#fff)">';
    html += "</div>";

    // Per-platform posts
    for (var i = 0; i < group.platforms.length; i++) {
      var plat = group.platforms[i];
      var uid = groupIdx + "-" + i;
      var isFirst = i === 0;

      html += '<div style="' + (isFirst ? "" : "margin-top:20px;padding-top:20px;border-top:1px solid var(--color-border)") + '">';
      html += '<div style="margin-bottom:8px">' + platformBadge(plat.platform) + "</div>";

      if (plat.post_id) {
        html += '<textarea data-edit="' + esc(uid) + '" data-post-id="' + esc(plat.post_id) + '" style="width:100%;min-height:120px;padding:10px;border:1px solid var(--color-border);border-radius:4px;font-size:14px;font-family:inherit;line-height:1.6;resize:vertical;background:var(--color-bg,#fff);color:var(--color-dark)">' + esc(plat.text) + "</textarea>";
        html += '<div style="display:flex;align-items:center;gap:12px;margin-top:8px">';
        html += '<button data-save="' + esc(uid) + '" data-post-id="' + esc(plat.post_id) + '" data-group="' + groupIdx + '" data-plat="' + i + '" style="padding:6px 16px;border:none;border-radius:4px;background:var(--color-accent,#b45309);color:#fff;font-size:13px;font-weight:600;cursor:pointer">Save to Buffer</button>';
        html += '<span data-status="' + esc(uid) + '" style="font-size:13px"></span>';
        html += "</div>";
      } else {
        html += '<div style="padding:10px;border:1px solid var(--color-border);border-radius:4px;font-size:14px;line-height:1.6;white-space:pre-wrap;color:var(--color-dark)">' + esc(plat.text) + "</div>";
        html += '<p style="margin:6px 0 0;font-size:12px;color:var(--color-muted)">Not scheduled (channel not connected in Buffer).</p>';
      }
      html += "</div>";
    }

    html += "</div>";
    return html;
  }

  function toLocalISO(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    var h = String(d.getHours()).padStart(2, "0");
    var min = String(d.getMinutes()).padStart(2, "0");
    return y + "-" + m + "-" + day + "T" + h + ":" + min;
  }

  /* -- Events ------------------------------------------------------- */
  function bindClicks() {
    var rows = postsMount.querySelectorAll(".social-group-summary");
    for (var i = 0; i < rows.length; i++) {
      (function (el) {
        el.addEventListener("click", function () {
          var idx = parseInt(el.getAttribute("data-group-idx"), 10);
          expandedIndex = expandedIndex === idx ? -1 : idx;
          renderPosts(flattenGroups());
        });
      })(rows[i]);
    }

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

  /* -- Save --------------------------------------------------------- */
  function savePost(uid, postId, groupIdx, platIdx) {
    if (!postId) return;
    var textarea = postsMount.querySelector('[data-edit="' + uid + '"]');
    var statusEl = postsMount.querySelector('[data-status="' + uid + '"]');
    var btn = postsMount.querySelector('[data-save="' + uid + '"]');
    if (!textarea) return;

    var newText = textarea.value.trim();
    if (!newText) { if (statusEl) statusEl.textContent = "Text cannot be empty."; return; }

    if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
    if (statusEl) statusEl.textContent = "";

    authedFetch("/social/post/" + postId, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newText })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (res.ok) {
          if (groupedPosts[groupIdx] && groupedPosts[groupIdx].platforms[platIdx]) {
            groupedPosts[groupIdx].platforms[platIdx].text = newText;
          }
          if (statusEl) { statusEl.style.color = "#27ae60"; statusEl.textContent = "Saved."; }
        } else {
          if (statusEl) { statusEl.style.color = "#c0392b"; statusEl.textContent = res.data.error || "Failed."; }
        }
      })
      .catch(function () { if (statusEl) { statusEl.style.color = "#c0392b"; statusEl.textContent = "Network error."; } })
      .finally(function () { if (btn) { btn.disabled = false; btn.textContent = "Save to Buffer"; } });
  }

  /* -- Errors ------------------------------------------------------- */
  function renderErrors(errors) {
    if (!errors || !errors.length) { errorsMount.hidden = true; return; }
    errorsMount.hidden = false;
    var html = '<p class="dashboard-form-legend"><em>Errors</em></p><div style="margin-top:16px">';
    for (var i = 0; i < errors.length; i++) {
      var err = errors[i];
      var ts = formatTime(err.timestamp || err.time || "");
      var msg = err.message || err.error || String(err);
      html += '<div style="padding:8px 0;border-bottom:1px solid var(--color-border);font-size:14px">';
      if (ts) html += '<span style="color:var(--color-muted);margin-right:8px">' + esc(ts) + "</span>";
      html += '<span style="color:#c0392b">' + esc(msg) + "</span></div>";
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
        summaryMount.innerHTML = '<p class="dashboard-form-legend"><em>Status</em></p><p class="admin-sub">Failed to load.</p>';
        postsMount.innerHTML = '<p class="dashboard-form-legend"><em>Scheduled Posts</em></p><p class="admin-sub">Failed to load.</p>';
        errorsMount.hidden = true;
      });
  }

  load();
})();
