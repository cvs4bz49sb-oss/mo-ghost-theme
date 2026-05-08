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

  // On narrow viewports (tablet and phone), collapse every
  // dashboard-module at load so the page isn't an endless scroll.
  // Native <details> toggles on tap; belt-and-braces, we also bind
  // a click handler to the summary so even if some mobile browser
  // swallows the native behavior, tapping still opens/closes.
  var isNarrow = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
  if (isNarrow) {
    document.querySelectorAll(".dashboard-module[open]").forEach(function (d) {
      d.removeAttribute("open");
    });
  }
  document.querySelectorAll(".dashboard-module > summary").forEach(function (s) {
    s.addEventListener("click", function (e) {
      // If native toggle isn't working (rare), fall back to manual.
      var details = s.parentElement;
      if (!details) return;
      // Give native behavior a tick; if the open state didn't flip,
      // flip it ourselves. Prevents double-toggling on browsers
      // where native works correctly.
      var wasOpen = details.hasAttribute("open");
      setTimeout(function () {
        var isOpen = details.hasAttribute("open");
        if (isOpen === wasOpen) {
          if (wasOpen) details.removeAttribute("open");
          else details.setAttribute("open", "");
        }
      }, 0);
    });
  });

  hydrateBookmarks();
  hydrateCommonplace();
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

  // --- Commonplace Book --------------------------------------------------

  function hydrateCommonplace() {
    var mount = document.querySelector("[data-dashboard-commonplace]");
    if (!mount) return;
    if (!WORKER || !EMAIL) {
      showEmpty(mount, "Commonplace Book is only available for signed-in members.");
      return;
    }
    fetch(WORKER.replace(/\/$/, "") + "/commonplace?email=" + encodeURIComponent(EMAIL), {
      method: "GET", mode: "cors", credentials: "omit",
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var list = (data && data.entries) || [];
        renderCommonplaceList(mount, list);
      })
      .catch(function () {
        showEmpty(mount, "Couldn’t load your commonplace book right now. Try reloading.");
      });
  }

  function renderCommonplaceList(mount, fullList) {
    if (!fullList.length) {
      showEmpty(mount, "No passages saved yet. Highlight any text on an article and tap Save to start your commonplace book.");
      return;
    }

    var limitRaw = parseInt(mount.getAttribute("data-limit") || "", 10);
    var limit = isNaN(limitRaw) ? fullList.length : limitRaw;
    var visible = fullList.slice(0, limit);
    var viewAllHref = mount.getAttribute("data-view-all") || "";
    var isCompact = mount.hasAttribute("data-limit");

    clear(mount);

    var container = document.createElement("div");
    container.className = "commonplace-list";

    for (var i = 0; i < visible.length; i++) {
      container.appendChild(renderCommonplaceEntry(visible[i], isCompact));
    }
    mount.appendChild(container);

    if (viewAllHref && fullList.length > limit) {
      var wrap = document.createElement("p");
      wrap.className = "dashboard-view-all";
      var a = document.createElement("a");
      a.href = viewAllHref;
      a.textContent = "View all " + fullList.length + " →";
      wrap.appendChild(a);
      mount.appendChild(wrap);
    }
  }

  function renderCommonplaceEntry(entry, isCompact) {
    var item = document.createElement("div");
    item.className = "commonplace-entry";

    var quote = document.createElement("blockquote");
    quote.className = "commonplace-quote";
    var displayText = entry.text || "";
    if (isCompact && displayText.length > 180) {
      displayText = displayText.slice(0, 180).replace(/\s+\S*$/, "") + "…";
    }
    quote.textContent = displayText;
    item.appendChild(quote);

    var meta = document.createElement("div");
    meta.className = "commonplace-meta";

    if (entry.sourceTitle) {
      var source = document.createElement("a");
      source.className = "commonplace-source";
      source.href = entry.sourceUrl || "#";
      source.textContent = entry.sourceTitle;
      meta.appendChild(source);
    }

    if (entry.savedAt) {
      var date = document.createElement("span");
      date.className = "commonplace-date";
      date.textContent = formatRelative(entry.savedAt);
      meta.appendChild(date);
    }

    item.appendChild(meta);

    var actions = document.createElement("div");
    actions.className = "commonplace-actions";

    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "commonplace-action-btn";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", function () {
      var copyText = "“" + entry.text + "”";
      if (entry.sourceTitle) copyText += " — " + entry.sourceTitle;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(copyText).then(function () {
          copyBtn.textContent = "Copied";
          setTimeout(function () { copyBtn.textContent = "Copy"; }, 1500);
        });
      }
    });
    actions.appendChild(copyBtn);

    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "commonplace-action-btn commonplace-action-remove";
    removeBtn.textContent = "Remove";
    var confirmState = 0; // 0=idle, 1=awaiting confirm
    removeBtn.addEventListener("click", function () {
      if (confirmState === 0) {
        confirmState = 1;
        removeBtn.textContent = "Are you sure?";
        removeBtn.classList.add("is-confirming");
        setTimeout(function () {
          if (confirmState === 1) {
            confirmState = 0;
            removeBtn.textContent = "Remove";
            removeBtn.classList.remove("is-confirming");
          }
        }, 3000);
        return;
      }
      removeBtn.disabled = true;
      removeBtn.textContent = "Removing…";
      fetch(WORKER.replace(/\/$/, "") + "/commonplace/remove", {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: EMAIL, id: entry.id }),
      }).then(function () {
        item.remove();
      }).catch(function () {
        removeBtn.disabled = false;
        removeBtn.textContent = "Remove";
        removeBtn.classList.remove("is-confirming");
        confirmState = 0;
      });
    });
    actions.appendChild(removeBtn);

    item.appendChild(actions);
    return item;
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

    // Two render modes:
    //   - Inline dashboard modules (data-limit set) → compact
    //     dashboard-essay rows (small thumb left, text right).
    //   - Full-page /dashboard/bookmarks/ + /history/ (no limit) →
    //     archive-style .week-grid of .entry cards matching the
    //     rest of the blog listings (/archive/, This Week on home).
    var isCompact = mount.hasAttribute("data-limit");

    clear(mount);

    var container;
    if (isCompact) {
      container = document.createElement("ol");
      container.className = "dashboard-essay-list";
      for (var i = 0; i < visible.length; i++) {
        container.appendChild(renderCompactItem(visible[i], kind));
      }
    } else {
      container = document.createElement("div");
      container.className = "week-grid dashboard-entry-grid";
      for (var j = 0; j < visible.length; j++) {
        container.appendChild(renderEntryItem(visible[j], kind));
      }
    }
    mount.appendChild(container);

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

  function renderCompactItem(entry, kind) {
    var remove = buildRemoveButton(kind, entry);

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

    wireRemove(remove, kind, entry, li);
    return li;
  }

  function renderEntryItem(entry, kind) {
    var url = entry.url || ("/" + (entry.slug || ""));
    var metaText = kind === "bookmarks"
      ? (entry.savedAt ? "Saved " + formatRelative(entry.savedAt) : "")
      : "Read " + formatRelative(entry.readAt);

    var wrap = document.createElement("div");
    wrap.className = "dashboard-entry";

    var a = document.createElement("a");
    a.href = url;
    a.className = "entry";

    var plate = document.createElement("div");
    plate.className = "entry-plate";
    var plateInner = document.createElement("div");
    plateInner.className = "entry-plate-inner";
    if (entry.feature_image) plateInner.style.backgroundImage = "url(" + entry.feature_image + ")";
    plate.appendChild(plateInner);
    a.appendChild(plate);

    var text = document.createElement("div");
    text.className = "entry-text";

    if (entry.primary_tag && entry.primary_tag.name) {
      var topic = document.createElement("p");
      topic.className = "entry-topic";
      var topicTag = document.createElement("span");
      topicTag.className = "entry-topic-tag";
      topicTag.textContent = entry.primary_tag.name;
      topic.appendChild(topicTag);
      text.appendChild(topic);
    }

    var h3 = document.createElement("h3");
    h3.className = "entry-title";
    h3.textContent = entry.title || entry.slug || entry.postId;
    text.appendChild(h3);

    if (metaText) {
      var meta = document.createElement("div");
      meta.className = "entry-meta";
      var date = document.createElement("p");
      date.className = "entry-date";
      date.textContent = metaText;
      meta.appendChild(date);
      text.appendChild(meta);
    }

    a.appendChild(text);
    wrap.appendChild(a);

    var remove = buildRemoveButton(kind, entry);
    wrap.appendChild(remove);
    wireRemove(remove, kind, entry, wrap);

    return wrap;
  }

  function buildRemoveButton(kind, entry) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dashboard-essay-remove";
    btn.setAttribute("aria-label", kind === "bookmarks" ? "Remove bookmark" : "Remove from reading history");
    btn.textContent = "Remove";
    return btn;
  }

  function wireRemove(btn, kind, entry, removeNode) {
    var endpoint = kind === "bookmarks" ? "/bookmarks/remove" : "/history/remove";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      btn.disabled = true;
      fetch(WORKER.replace(/\/$/, "") + endpoint, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: EMAIL, postId: entry.postId }),
      }).then(function () { removeNode.remove(); }).catch(function () { btn.disabled = false; });
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
