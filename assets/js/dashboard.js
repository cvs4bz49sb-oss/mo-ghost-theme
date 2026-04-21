/*
 * Dashboard list hydration.
 *
 * Renders bookmarks and reading history into their mount elements.
 * Each mount carries two optional data attributes:
 *   data-limit    — max rows to show; blank/absent means render all
 *   data-view-all — href to navigate to when truncated (adds a
 *                   "View All N →" link under the list)
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
    // Skip when the highlight isn't a name (e.g. "Bookmarks" page).
    if (full && /\s/.test(full) && /^[A-Z]/.test(full)) {
      var first = full.split(/\s+/)[0];
      if (first) nameEl.textContent = first;
    }
  }

  hydrateBookmarks();
  hydrateHistory();

  // --- Bookmarks ---------------------------------------------------------

  function hydrateBookmarks() {
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
        renderList(mount, list, "bookmarks", {
          emptyMsg: "No bookmarks yet. Tap the bookmark icon on any essay to save it here.",
        });
      })
      .catch(function () {
        showEmpty(mount, "Couldn't load your bookmarks right now. Try reloading.");
      });
  }

  // --- Reading History ---------------------------------------------------

  function hydrateHistory() {
    var mount = document.querySelector("[data-dashboard-history]");
    if (!mount) return;
    if (!WORKER || !EMAIL) {
      showEmpty(mount, "Reading history is only available for signed-in members.");
      return;
    }
    fetch(WORKER.replace(/\/$/, "") + "/history?email=" + encodeURIComponent(EMAIL) + "&limit=50", {
      method: "GET", mode: "cors", credentials: "omit",
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var list = (data && data.history) || [];
        renderList(mount, list, "history", {
          emptyMsg: "You haven't finished any essays yet. Read one for 60 seconds or scroll to the end, and it'll appear here.",
        });
      })
      .catch(function () {
        showEmpty(mount, "Couldn't load your reading history right now. Try reloading.");
      });
  }

  // --- Shared rendering --------------------------------------------------

  function renderList(mount, fullList, kind, opts) {
    if (!fullList.length) { showEmpty(mount, opts.emptyMsg); return; }

    var limitRaw = parseInt(mount.getAttribute("data-limit") || "", 10);
    var limit = isNaN(limitRaw) ? fullList.length : limitRaw;
    var visible = fullList.slice(0, limit);
    var viewAllHref = mount.getAttribute("data-view-all") || "";

    var ol = document.createElement("ol");
    ol.className = "dashboard-essay-list";
    for (var i = 0; i < visible.length; i++) {
      ol.appendChild(renderItem(visible[i], kind));
    }

    clear(mount);
    mount.appendChild(ol);

    if (viewAllHref && fullList.length > limit) {
      var wrap = document.createElement("p");
      wrap.className = "dashboard-view-all";
      var a = document.createElement("a");
      a.href = viewAllHref;
      a.textContent = "View all " + fullList.length + " \u2192";
      wrap.appendChild(a);
      mount.appendChild(wrap);
    }
  }

  function renderItem(entry, kind) {
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "dashboard-essay-remove";
    remove.setAttribute("aria-label", kind === "bookmarks" ? "Remove bookmark" : "Remove from reading history");
    remove.textContent = "Remove";

    var metaText = kind === "bookmarks"
      ? (entry.savedAt ? "Saved " + formatRelative(entry.savedAt) : "")
      : "Read " + formatRelative(entry.readAt);

    var li = buildEssayRow({
      url: entry.url || ("/" + (entry.slug || "")),
      title: entry.title || entry.slug || entry.postId,
      topic: entry.primary_tag && entry.primary_tag.name,
      image: entry.feature_image,
      metaText: metaText,
      remove: remove,
    });

    var endpoint = kind === "bookmarks" ? "/bookmarks/remove" : "/history/remove";
    remove.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      remove.disabled = true;
      fetch(WORKER.replace(/\/$/, "") + endpoint, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: EMAIL, postId: entry.postId }),
      }).then(function () { li.remove(); }).catch(function () { remove.disabled = false; });
    });

    return li;
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
