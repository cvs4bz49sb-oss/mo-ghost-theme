/*
 * /events/ page wiring.
 *
 * Reads every #event post rendered hidden inside [data-events-source],
 * sorts by published_at, promotes the closest future event into the
 * hero + body, and populates the "Past Events" footer list with the
 * rest. Also stamps the registration form with the upcoming event's
 * title so the inline-signup flow can attach it as a Ghost label
 * (mirrored by mo-kit into a Kit tag).
 */
(function () {
  var source = document.querySelector("[data-events-source]");
  if (!source) return;

  var items = Array.prototype.slice.call(source.querySelectorAll(".events-item"))
    .map(function (el) {
      var ts = Date.parse(el.getAttribute("data-published-at"));
      return {
        slug: el.getAttribute("data-slug") || "",
        url: el.getAttribute("data-url") || "",
        title: el.getAttribute("data-title") || "",
        excerpt: el.getAttribute("data-excerpt") || "",
        featureImage: el.getAttribute("data-feature-image") || "",
        publishedAt: el.getAttribute("data-published-at") || "",
        ts: isNaN(ts) ? 0 : ts,
        contentHtml: (el.querySelector(".events-item-content") || {}).innerHTML || "",
      };
    })
    .filter(function (e) { return e.ts > 0; });

  var now = Date.now();
  var upcoming = items.filter(function (e) { return e.ts > now; }).sort(function (a, b) { return a.ts - b.ts; });
  var past = items.filter(function (e) { return e.ts <= now; }).sort(function (a, b) { return b.ts - a.ts; });

  var heroUpcoming = document.querySelector("[data-events-hero]");
  var heroEmpty = document.querySelector("[data-events-hero-empty]");
  var feature = document.querySelector("[data-events-feature]");
  var body = document.querySelector("[data-events-body]");
  var pastEl = document.querySelector("[data-events-past]");

  if (upcoming.length) {
    var e = upcoming[0];
    heroUpcoming.hidden = false;
    document.querySelector("[data-events-title]").textContent = e.title;
    var titleLink = document.querySelector("[data-events-title-link]");
    if (titleLink) titleLink.href = e.url;
    document.querySelector("[data-events-date]").textContent = formatDate(e.ts);
    if (e.excerpt) {
      var sub = document.querySelector("[data-events-excerpt]");
      sub.textContent = e.excerpt;
      sub.hidden = false;
    }
    if (e.featureImage) {
      feature.hidden = false;
      document.querySelector("[data-events-feature-inner]").style.backgroundImage = "url(" + e.featureImage + ")";
    }
    var prose = document.querySelector("[data-events-prose]");
    prose.innerHTML = e.contentHtml;
    body.hidden = false;
  } else {
    heroEmpty.hidden = false;
  }

  if (past.length) {
    var list = document.querySelector("[data-events-past-list]");
    for (var i = 0; i < past.length; i++) list.appendChild(renderPastItem(past[i]));
    pastEl.hidden = false;
  }

  function renderPastItem(e) {
    var li = document.createElement("li");
    li.className = "events-past-item";
    var a = document.createElement("a");
    a.href = e.url;
    a.className = "events-past-link";
    if (e.featureImage) {
      var thumb = document.createElement("span");
      thumb.className = "events-past-thumb";
      thumb.style.backgroundImage = "url(" + e.featureImage + ")";
      a.appendChild(thumb);
    }
    var body = document.createElement("div");
    body.className = "events-past-body";
    var date = document.createElement("p");
    date.className = "events-past-date";
    date.textContent = formatDate(e.ts);
    body.appendChild(date);
    var title = document.createElement("h3");
    title.className = "events-past-event-title";
    var em = document.createElement("em");
    em.textContent = e.title;
    title.appendChild(em);
    body.appendChild(title);
    a.appendChild(body);
    li.appendChild(a);
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
