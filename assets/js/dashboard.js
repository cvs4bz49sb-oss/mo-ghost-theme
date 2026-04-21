/*
 * Dashboard reading-history hydration.
 *
 * Server-side rendering handles everything else (hero, members-only
 * essays via {{#get}}, rail). This fetches /history from the mo-kit
 * worker and injects an editorial-style essay list into
 * [data-dashboard-history].
 */
(function () {
  var body = document.body;
  var WORKER = body.getAttribute("data-kit-worker-url") || "";
  var EMAIL = body.getAttribute("data-member-email") || "";

  // Ghost only exposes @member.name as a single string. Swap the
  // hero headline's "Welcome, {full name}" to first name only.
  var nameEl = document.querySelector(".dashboard-hero .highlight em");
  if (nameEl) {
    var full = (nameEl.textContent || "").trim();
    if (full) {
      var first = full.split(/\s+/)[0];
      if (first) nameEl.textContent = first;
    }
  }

  hydrateBookmarks(body, WORKER, EMAIL);

  var mount = document.querySelector("[data-dashboard-history]");
  if (!mount) return;

  if (!WORKER || !EMAIL) {
    showEmpty(mount, "Reading history is only available for signed-in members.");
    return;
  }

  fetch(WORKER.replace(/\/$/, "") + "/history?email=" + encodeURIComponent(EMAIL) + "&limit=20", {
    method: "GET", mode: "cors", credentials: "omit",
  })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      var list = (data && data.history) || [];
      if (!list.length) {
        showEmpty(mount, "You haven't finished any essays yet. Read one for 60 seconds or scroll to the end, and it'll appear here.");
        return;
      }
      var ol = document.createElement("ol");
      ol.className = "dashboard-essay-list";
      for (var i = 0; i < list.length; i++) ol.appendChild(renderItem(list[i]));
      clear(mount);
      mount.appendChild(ol);
    })
    .catch(function () {
      showEmpty(mount, "Couldn't load your reading history right now. Try reloading.");
    });

  function renderItem(entry) {
    return buildEssayRow({
      url: entry.url || ("/" + (entry.slug || "")),
      title: entry.title || entry.slug || entry.postId,
      topic: entry.primary_tag && entry.primary_tag.name,
      image: entry.feature_image,
      metaText: "Read " + formatRelative(entry.readAt),
    });
  }

  function buildEssayRow(opts) {
    var li = document.createElement("li");
    li.className = "dashboard-essay";

    var thumb = document.createElement("a");
    thumb.className = "dashboard-essay-thumb";
    thumb.href = opts.url;
    thumb.setAttribute("aria-hidden", "true");
    thumb.setAttribute("tabindex", "-1");
    if (opts.image) thumb.style.backgroundImage = "url(" + opts.image + ")";
    li.appendChild(thumb);

    var body = document.createElement("div");
    body.className = "dashboard-essay-body";

    if (opts.topic) {
      var topic = document.createElement("p");
      topic.className = "dashboard-essay-topic";
      topic.textContent = opts.topic;
      body.appendChild(topic);
    }
    var h3 = document.createElement("h3");
    h3.className = "dashboard-essay-title";
    var a = document.createElement("a");
    a.href = opts.url;
    var em = document.createElement("em");
    em.textContent = opts.title;
    a.appendChild(em);
    h3.appendChild(a);
    body.appendChild(h3);

    if (opts.metaText) {
      var meta = document.createElement("p");
      meta.className = "dashboard-essay-meta";
      meta.textContent = opts.metaText;
      body.appendChild(meta);
    }
    if (opts.remove) body.appendChild(opts.remove);
    li.appendChild(body);
    return li;
  }

  function showEmpty(mount, msg) {
    clear(mount);
    var p = document.createElement("p");
    p.className = "dashboard-empty";
    p.textContent = msg;
    mount.appendChild(p);
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function hydrateBookmarks(body, WORKER, EMAIL) {
    var mount = document.querySelector("[data-dashboard-bookmarks]");
    if (!mount) return;
    if (!WORKER || !EMAIL) {
      showEmpty(mount, "Bookmarks are only available for signed-in members.");
      return;
    }
    fetch(WORKER.replace(/\/$/, "") + "/bookmarks?email=" + encodeURIComponent(EMAIL), {
      method: "GET", mode: "cors", credentials: "omit",
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var list = (data && data.bookmarks) || [];
        if (!list.length) {
          showEmpty(mount, "No bookmarks yet. Tap the bookmark icon on any essay to save it here.");
          return;
        }
        var ol = document.createElement("ol");
        ol.className = "dashboard-essay-list";
        for (var i = 0; i < list.length; i++) ol.appendChild(renderBookmarkItem(list[i], WORKER, EMAIL));
        clear(mount);
        mount.appendChild(ol);
      })
      .catch(function () {
        showEmpty(mount, "Couldn't load your bookmarks right now. Try reloading.");
      });
  }

  function renderBookmarkItem(entry, WORKER, EMAIL) {
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "dashboard-essay-remove";
    remove.setAttribute("aria-label", "Remove bookmark");
    remove.textContent = "Remove";
    var li = buildEssayRow({
      url: entry.url || ("/" + (entry.slug || "")),
      title: entry.title || entry.slug || entry.postId,
      topic: entry.primary_tag && entry.primary_tag.name,
      image: entry.feature_image,
      metaText: entry.savedAt ? "Saved " + formatRelative(entry.savedAt) : "",
      remove: remove,
    });
    remove.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      remove.disabled = true;
      fetch(WORKER.replace(/\/$/, "") + "/bookmarks/remove", {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: EMAIL, postId: entry.postId }),
      }).then(function () { li.remove(); }).catch(function () { remove.disabled = false; });
    });
    return li;
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
