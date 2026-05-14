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

  function renderPosts(posts) {
    var html = '<p class="dashboard-form-legend"><em>Scheduled Posts</em></p>';

    if (!posts || !posts.length) {
      html += '<p class="admin-sub">No scheduled posts.</p>';
      postsMount.innerHTML = html;
      return;
    }

    html += '<div style="overflow-x:auto;margin-top:16px">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:14px">';
    html += "<thead><tr>";
    html += '<th style="text-align:left;padding:8px 12px;border-bottom:2px solid var(--color-border);font-weight:600">Article</th>';
    html += '<th style="text-align:left;padding:8px 12px;border-bottom:2px solid var(--color-border);font-weight:600">Platform</th>';
    html += '<th style="text-align:left;padding:8px 12px;border-bottom:2px solid var(--color-border);font-weight:600">Scheduled</th>';
    html += '<th style="text-align:left;padding:8px 12px;border-bottom:2px solid var(--color-border);font-weight:600">Text Preview</th>';
    html += "</tr></thead><tbody>";

    for (var i = 0; i < posts.length; i++) {
      var post = posts[i];
      var title = post.article || post.title || "(untitled)";
      var platform = post.platform || "";
      var scheduled = formatTime(post.scheduled_time || post.scheduledTime || post.scheduled);
      var preview = truncate(post.text || post.preview || "", 80);

      html += "<tr>";
      html += '<td style="padding:8px 12px;border-bottom:1px solid var(--color-border)">' + esc(title) + "</td>";
      html += '<td style="padding:8px 12px;border-bottom:1px solid var(--color-border)">' + platformBadge(platform) + "</td>";
      html += '<td style="padding:8px 12px;border-bottom:1px solid var(--color-border);white-space:nowrap">' + esc(scheduled) + "</td>";
      html += '<td style="padding:8px 12px;border-bottom:1px solid var(--color-border);color:var(--color-muted)">' + esc(preview) + "</td>";
      html += "</tr>";
    }

    html += "</tbody></table></div>";
    postsMount.innerHTML = html;
  }

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
