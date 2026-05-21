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
  const source = document.querySelector("[data-events-source]");
  if (!source) return;

  const items = Array.prototype.slice.call(source.querySelectorAll(".events-item"))
    .map((el) => {
      const contentHtml = (el.querySelector(".events-item-content") || {}).innerHTML || "";
      return {
        slug: el.getAttribute("data-slug") || "",
        url: el.getAttribute("data-url") || "",
        title: el.getAttribute("data-title") || "",
        excerpt: el.getAttribute("data-excerpt") || "",
        featureImage: el.getAttribute("data-feature-image") || "",
        ts: Date.parse(el.getAttribute("data-published-at")) || 0,
        contentHtml,
        hasReplay: /<iframe[^>]+(youtube\.com|youtu\.be|vimeo\.com)/i.test(contentHtml),
      };
    });

  const upcoming = items.filter((e) => { return !e.hasReplay; })
    .sort((a, b) => { return b.ts - a.ts; });
  const past = items.filter((e) => { return e.hasReplay; })
    .sort((a, b) => { return b.ts - a.ts; });

  if (document.querySelector("[data-events-hero]")) renderForum(upcoming);
  if (document.querySelector("[data-events-library-upcoming]")) renderLibrary(upcoming, past);

  // ---- /forum/ detail view -----------------------------------------------

  function renderForum(upcomingEvents) {
    const heroEl = document.querySelector("[data-events-hero]");
    const emptyEl = document.querySelector("[data-events-hero-empty]");
    const featureWrap = document.querySelector("[data-events-feature-wrap]");
    const body = document.querySelector("[data-events-body]");

    if (!upcomingEvents.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    const e = upcomingEvents[0];
    heroEl.hidden = false;
    document.querySelector("[data-events-title]").textContent = e.title;
    const titleLink = document.querySelector("[data-events-title-link]");
    // Codex audit 2026-05-11: worker-supplied URL. Route through
    // MOSafeHref so an unsafe scheme can't slip through to .href.
    if (titleLink) window.MOSafeHref.set(titleLink, e.url, "#");
    if (e.excerpt) {
      const sub = document.querySelector("[data-events-excerpt]");
      sub.textContent = e.excerpt;
      sub.hidden = false;
    }
    if (e.featureImage && featureWrap) {
      featureWrap.hidden = false;
      document.querySelector("[data-events-feature-inner]").style.backgroundImage = `url(${e.featureImage})`;
    }
    // Sanitize the post body before innerHTML assignment. Ghost
    // sanitizes server-side, but defense-in-depth: a compromised
    // staff account or a Ghost sanitizer bypass becomes a stored XSS
    // vector here without this. ADD_TAGS includes iframe so YouTube/
    // Vimeo replay embeds keep working.
    //
    // FAIL CLOSED: if DOMPurify failed to load (CDN incident, CSP,
    // ad-block matching `purify`), render a placeholder rather than
    // assigning the unsanitized HTML. The defense-in-depth claim
    // must not depend on a 22 KB asset succeeding.
    const prose = document.querySelector("[data-events-prose]");
    if (!window.DOMPurify) {
      prose.textContent = "Could not display this event. Please reload.";
      body.hidden = false;
      return;
    }
    prose.innerHTML = window.DOMPurify.sanitize(e.contentHtml, {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: ["allowfullscreen", "frameborder", "allow"],
    });
    body.hidden = false;
  }

  // ---- /events/ library view --------------------------------------------

  function renderLibrary(upcomingEvents, pastEvents) {
    const upcomingSection = document.querySelector("[data-events-library-upcoming]");
    const pastSection = document.querySelector("[data-events-library-past]");
    const empty = document.querySelector("[data-events-empty]");

    if (upcomingEvents.length) {
      const upList = document.querySelector("[data-events-library-upcoming-list]");
      for (let i = 0; i < upcomingEvents.length; i++) {
        upList.appendChild(renderCard(upcomingEvents[i], i === 0 ? "/forum/" : upcomingEvents[i].url));
      }
      upcomingSection.hidden = false;
    }
    if (pastEvents.length) {
      const pastList = document.querySelector("[data-events-library-past-list]");
      for (let j = 0; j < pastEvents.length; j++) {
        pastList.appendChild(renderCard(pastEvents[j], pastEvents[j].url));
      }
      pastSection.hidden = false;
    }
    if (!upcomingEvents.length && !pastEvents.length) {
      if (empty) empty.hidden = false;
    }
  }

  function renderCard(e, href) {
    const li = document.createElement("li");
    li.className = "events-library-card";
    const a = document.createElement("a");
    // Codex audit 2026-05-11: worker-supplied URL → MOSafeHref.set.
    window.MOSafeHref.set(a, href, "#");
    a.className = e.featureImage
      ? "events-library-link"
      : "events-library-link events-library-link--no-thumb";
    if (e.featureImage) {
      const thumb = document.createElement("span");
      thumb.className = "events-library-thumb";
      thumb.style.backgroundImage = `url(${e.featureImage})`;
      a.appendChild(thumb);
    }
    const body = document.createElement("div");
    body.className = "events-library-body-col";
    if (e.excerpt) {
      const when = document.createElement("p");
      when.className = "events-library-when";
      when.textContent = e.excerpt;
      body.appendChild(when);
    }
    const title = document.createElement("h3");
    title.className = "events-library-card-title";
    const em = document.createElement("em");
    em.textContent = e.title;
    title.appendChild(em);
    body.appendChild(title);
    a.appendChild(body);
    li.appendChild(a);
    return li;
  }
})();
