/*
 * Events wiring — shared between two templates.
 *
 *   /forum/  → detail view of the single current upcoming event.
 *              Template: custom-forum.hbs. Driven by [data-events-hero].
 *
 *   /events/ → library: lists every event, split into Upcoming and
 *              Past based on whether the post body contains a replay
 *              embed.
 *              Template: custom-events.hbs. Driven by
 *              [data-events-library-upcoming] / [data-events-library-past].
 *
 * Both templates render the full post set hidden inside
 * [data-events-source]; this script parses it, classifies each post
 * (upcoming = no replay iframe, past = replay iframe present), and
 * populates whichever mount elements are on the page.
 *
 * Event display date/time comes straight from the post excerpt —
 * Ian types it in, e.g. "Saturday, April 25 · 7 PM Eastern · With
 * Alan Noble". Ghost 5 no longer allows future published_at on a
 * published post, which is why we lean on the excerpt + the replay-
 * embed signal instead of dates.
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
        ts: Date.parse(el.getAttribute("data-published-at")) || 0,
        contentHtml: contentHtml,
        hasReplay: /<iframe[^>]+(youtube\.com|youtu\.be|vimeo\.com)/i.test(contentHtml),
      };
    });

  var upcoming = items.filter(function (e) { return !e.hasReplay; })
    .sort(function (a, b) { return b.ts - a.ts; });
  var past = items.filter(function (e) { return e.hasReplay; })
    .sort(function (a, b) { return b.ts - a.ts; });

  if (document.querySelector("[data-events-hero]")) renderForum(upcoming);
  if (document.querySelector("[data-events-library-upcoming]")) renderLibrary(upcoming, past);

  // ---- /forum/ detail view -----------------------------------------------

  function renderForum(upcomingEvents) {
    var heroEl = document.querySelector("[data-events-hero]");
    var emptyEl = document.querySelector("[data-events-hero-empty]");
    var featureWrap = document.querySelector("[data-events-feature-wrap]");
    var body = document.querySelector("[data-events-body]");

    if (!upcomingEvents.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    var e = upcomingEvents[0];
    heroEl.hidden = false;
    document.querySelector("[data-events-title]").textContent = e.title;
    var titleLink = document.querySelector("[data-events-title-link]");
    if (titleLink) titleLink.href = e.url;
    if (e.excerpt) {
      var sub = document.querySelector("[data-events-excerpt]");
      sub.textContent = e.excerpt;
      sub.hidden = false;
    }
    if (e.featureImage && featureWrap) {
      featureWrap.hidden = false;
      document.querySelector("[data-events-feature-inner]").style.backgroundImage = "url(" + e.featureImage + ")";
    }
    document.querySelector("[data-events-prose]").innerHTML = e.contentHtml;
    body.hidden = false;
  }

  // ---- /events/ library view --------------------------------------------

  function renderLibrary(upcomingEvents, pastEvents) {
    var upcomingSection = document.querySelector("[data-events-library-upcoming]");
    var pastSection = document.querySelector("[data-events-library-past]");
    var empty = document.querySelector("[data-events-empty]");

    if (upcomingEvents.length) {
      var upList = document.querySelector("[data-events-library-upcoming-list]");
      for (var i = 0; i < upcomingEvents.length; i++) {
        upList.appendChild(renderCard(upcomingEvents[i], i === 0 ? "/forum/" : upcomingEvents[i].url));
      }
      upcomingSection.hidden = false;
    }
    if (pastEvents.length) {
      var pastList = document.querySelector("[data-events-library-past-list]");
      for (var j = 0; j < pastEvents.length; j++) {
        pastList.appendChild(renderCard(pastEvents[j], pastEvents[j].url));
      }
      pastSection.hidden = false;
    }
    if (!upcomingEvents.length && !pastEvents.length) {
      if (empty) empty.hidden = false;
    }
  }

  function renderCard(e, href) {
    var li = document.createElement("li");
    li.className = "events-library-card";
    var a = document.createElement("a");
    a.href = href;
    a.className = "events-library-link";
    if (e.featureImage) {
      var thumb = document.createElement("span");
      thumb.className = "events-library-thumb";
      thumb.style.backgroundImage = "url(" + e.featureImage + ")";
      a.appendChild(thumb);
    }
    var body = document.createElement("div");
    body.className = "events-library-body-col";
    if (e.excerpt) {
      var when = document.createElement("p");
      when.className = "events-library-when";
      when.textContent = e.excerpt;
      body.appendChild(when);
    }
    var title = document.createElement("h3");
    title.className = "events-library-card-title";
    var em = document.createElement("em");
    em.textContent = e.title;
    title.appendChild(em);
    body.appendChild(title);
    a.appendChild(body);
    li.appendChild(a);
    return li;
  }
})();
