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
      for (var i = 0; i < list.length; i++) ol.appendChild(renderItem(list[i], i + 1));
      clear(mount);
      mount.appendChild(ol);
    })
    .catch(function () {
      showEmpty(mount, "Couldn't load your reading history right now. Try reloading.");
    });

  function renderItem(entry, n) {
    var li = document.createElement("li");
    li.className = "dashboard-essay";

    var num = document.createElement("span");
    num.className = "dashboard-essay-numeral";
    num.textContent = toRoman(n);
    li.appendChild(num);

    var body = document.createElement("div");
    body.className = "dashboard-essay-body";

    if (entry.primary_tag && entry.primary_tag.name) {
      var topic = document.createElement("p");
      topic.className = "dashboard-essay-topic";
      topic.textContent = entry.primary_tag.name;
      body.appendChild(topic);
    }
    var h3 = document.createElement("h3");
    h3.className = "dashboard-essay-title";
    var a = document.createElement("a");
    a.href = entry.url || ("/" + (entry.slug || ""));
    var em = document.createElement("em");
    em.textContent = entry.title || entry.slug || entry.postId;
    a.appendChild(em);
    h3.appendChild(a);
    body.appendChild(h3);

    var meta = document.createElement("p");
    meta.className = "dashboard-essay-meta";
    meta.textContent = "Read " + formatRelative(entry.readAt);
    body.appendChild(meta);

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

  function toRoman(n) {
    var values = [10, 9, 5, 4, 1];
    var symbols = ["X", "IX", "V", "IV", "I"];
    var out = "";
    var i = 0;
    while (n > 0 && i < values.length) {
      while (n >= values[i]) { out += symbols[i]; n -= values[i]; }
      i++;
    }
    // Fallback to arabic for numbers this loop doesn't cover (20+).
    return out || String(n);
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
