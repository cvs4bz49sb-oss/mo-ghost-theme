/*
 * /events/ page wiring.
 *
 * Each #event post rendered hidden inside [data-events-source] is
 * classified as "past" if its body contains a YouTube embed (Ian
 * pastes the replay in after the event), otherwise "upcoming". The
 * newest upcoming post becomes the hero; past posts go to the
 * footer list, newest first.
 *
 * Display date/time comes straight from the post excerpt — Ian
 * types it as part of the excerpt, e.g. "Saturday, April 25 at
 * 7 PM Eastern — With Alan Noble", and we render it verbatim
 * under the hero title.
 */
(function () {
  var source = document.querySelector("[data-events-source]");
  if (!source) return;

  var items = Array.prototype.slice.call(source.querySelectorAll(".events-item"))
    .map(function (el) {
      var contentHtml = (el.querySelector(".events-item-content") || {}).innerHTML || "";
      return {
        slug: el.getAttribute("data-slug") || "",
        url: el.getAttribute("data-url") || "",
        title: el.getAttribute("data-title") || "",
        excerpt: el.getAttribute("data-excerpt") || "",
        featureImage: el.getAttribute("data-feature-image") || "",
        publishedAt: el.getAttribute("data-published-at") || "",
        ts: Date.parse(el.getAttribute("data-published-at")) || 0,
        contentHtml: contentHtml,
        hasReplay: /<iframe[^>]+(youtube\.com|youtu\.be|vimeo\.com)/i.test(contentHtml),
      };
    });

  var upcoming = items.filter(function (e) { return !e.hasReplay; })
    .sort(function (a, b) { return b.ts - a.ts; }); // newest first = the one to feature
  var past = items.filter(function (e) { return e.hasReplay; })
    .sort(function (a, b) { return b.ts - a.ts; });

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
    if (e.excerpt) {
      var when = document.createElement("p");
      when.className = "events-past-date";
      when.textContent = e.excerpt;
      body.appendChild(when);
    }
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
})();
