/*
 * /dashboard/replays/ hydration.
 *
 * Reads [data-replays-source] (hidden-rendered #event posts), filters
 * to past events (published_at < now), and renders each with its body
 * content (which contains the YouTube embed Ian pasted after the
 * event). Collapsed by default — click the title to expand the video.
 */
(function () {
  var source = document.querySelector("[data-replays-source]");
  var list = document.querySelector("[data-replays-list]");
  var placeholder = document.querySelector("[data-replays-placeholder]");
  if (!source || !list) return;

  var now = Date.now();
  var items = Array.prototype.slice.call(source.querySelectorAll(".replays-item"))
    .map(function (el) {
      var ts = Date.parse(el.getAttribute("data-published-at"));
      return {
        slug: el.getAttribute("data-slug") || "",
        url: el.getAttribute("data-url") || "",
        title: el.getAttribute("data-title") || "",
        excerpt: el.getAttribute("data-excerpt") || "",
        ts: isNaN(ts) ? 0 : ts,
        contentHtml: (el.querySelector(".replays-item-content") || {}).innerHTML || "",
      };
    })
    .filter(function (e) { return e.ts > 0 && e.ts < now; });

  if (placeholder) placeholder.remove();
  if (!items.length) {
    var empty = document.createElement("li");
    empty.className = "replays-empty";
    empty.textContent = "No event replays yet. Once we host and wrap up an online event, the video appears here.";
    list.appendChild(empty);
    return;
  }

  for (var i = 0; i < items.length; i++) list.appendChild(renderItem(items[i]));

  function renderItem(e) {
    var li = document.createElement("li");
    li.className = "replays-card";

    var header = document.createElement("details");
    header.className = "replays-details";
    if (items[0] && e === items[0]) header.open = true; // auto-expand newest

    var summary = document.createElement("summary");
    summary.className = "replays-summary";
    var date = document.createElement("p");
    date.className = "replays-date";
    date.textContent = formatDate(e.ts);
    summary.appendChild(date);
    var title = document.createElement("h3");
    title.className = "replays-title";
    var em = document.createElement("em");
    em.textContent = e.title;
    title.appendChild(em);
    summary.appendChild(title);
    if (e.excerpt) {
      var sub = document.createElement("p");
      sub.className = "replays-sub";
      sub.textContent = e.excerpt;
      summary.appendChild(sub);
    }
    var chev = document.createElement("span");
    chev.className = "replays-chev";
    chev.setAttribute("aria-hidden", "true");
    summary.appendChild(chev);
    header.appendChild(summary);

    var body = document.createElement("div");
    body.className = "replays-body";
    body.innerHTML = e.contentHtml;
    header.appendChild(body);

    li.appendChild(header);
    return li;
  }

  function formatDate(ts) {
    try {
      return new Date(ts).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      });
    } catch (_) { return ""; }
  }
})();
