/*
 * Dashboard client-side hydration.
 *
 * The page template renders sections server-side from Ghost context
 * (member identity, members-only essays via {{#get}}). This file only
 * fetches reading history from the mo-kit worker and injects it into
 * [data-dashboard-history].
 */
(function () {
  var body = document.body;
  var WORKER = body.getAttribute("data-kit-worker-url") || "";
  var EMAIL = body.getAttribute("data-member-email") || "";
  var mount = document.querySelector("[data-dashboard-history]");
  if (!mount) return;

  if (!WORKER || !EMAIL) {
    renderEmpty(mount, "Reading history is only available for signed-in members.");
    return;
  }

  var placeholder = mount.querySelector("[data-history-placeholder]");

  fetch(WORKER.replace(/\/$/, "") + "/history?email=" + encodeURIComponent(EMAIL) + "&limit=20", {
    method: "GET",
    mode: "cors",
    credentials: "omit",
  })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (placeholder) placeholder.remove();
      var list = (data && data.history) || [];
      if (!list.length) {
        renderEmpty(mount, "You haven't finished any essays yet. Read one for 60 seconds or scroll to the end, and it'll appear here.");
        return;
      }
      var grid = document.createElement("div");
      grid.className = "dashboard-grid dashboard-grid--history";
      for (var i = 0; i < list.length; i++) grid.appendChild(renderCard(list[i]));
      mount.appendChild(grid);
    })
    .catch(function () {
      if (placeholder) placeholder.remove();
      renderEmpty(mount, "Couldn't load your reading history right now. Try reloading.");
    });

  function renderCard(entry) {
    var card = document.createElement("a");
    card.className = "dashboard-card dashboard-card--history";
    card.href = entry.url || ("/" + (entry.slug || ""));
    if (entry.feature_image) {
      var img = document.createElement("div");
      img.className = "dashboard-card-img";
      img.style.backgroundImage = "url(" + entry.feature_image + ")";
      card.appendChild(img);
    }
    var body = document.createElement("div");
    body.className = "dashboard-card-body";
    if (entry.primary_tag && entry.primary_tag.name) {
      var topic = document.createElement("p");
      topic.className = "dashboard-card-topic";
      topic.textContent = entry.primary_tag.name;
      body.appendChild(topic);
    }
    var title = document.createElement("h3");
    title.className = "dashboard-card-title";
    title.textContent = entry.title || entry.slug || entry.postId;
    body.appendChild(title);
    if (entry.readAt) {
      var meta = document.createElement("p");
      meta.className = "dashboard-card-meta";
      meta.textContent = "Read " + formatRelative(entry.readAt);
      body.appendChild(meta);
    }
    card.appendChild(body);
    return card;
  }

  function renderEmpty(mount, msg) {
    var p = mount.querySelector("[data-history-placeholder]");
    if (p) p.remove();
    var empty = document.createElement("p");
    empty.className = "dashboard-empty";
    empty.textContent = msg;
    mount.appendChild(empty);
  }

  function formatRelative(iso) {
    var then = Date.parse(iso);
    if (isNaN(then)) return "";
    var delta = Math.max(0, Date.now() - then);
    var mins = Math.floor(delta / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + " min ago";
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + "h ago";
    var days = Math.floor(hours / 24);
    if (days < 30) return days + "d ago";
    var months = Math.floor(days / 30);
    if (months < 12) return months + "mo ago";
    return Math.floor(months / 12) + "y ago";
  }
})();
