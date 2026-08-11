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
 *
 * ZOOM REGISTRATION
 * The event post carries its own Zoom registration link, the same way
 * it carries its own replay embed. Paste the link Zoom gives you
 * anywhere in the post body:
 *
 *   https://zoom.us/webinar/register/WN_hEhGz14wR4egRWwD4qyEAA
 *
 * either as a visible link or inside an HTML card as
 * <!-- zoom: https://zoom.us/webinar/register/WN_… -->. Both work the
 * same way; a visible one is removed from the rendered prose anyway
 * (see stripZoomLinks) so the page keeps a single call to action.
 *
 * This script pulls the code out and hands it to the registration
 * form, which posts it to mo-forms /zoom-register (see
 * inline-signup.js). No link in the post means the form behaves as it
 * always did: a Ghost subscribe with an `event:` label, and nobody
 * lands in Zoom.
 */
(function () {
  const source = document.querySelector("[data-events-source]");
  if (!source) return;

  // Registration link on the post, matched against the raw post HTML
  // so an HTML-comment marker works as well as a rendered <a href>:
  //
  //   .../webinar/register/WN_xxxx        (the code Zoom puts in the URL)
  //   .../webinar/register/1234/WN_xxxx   (some Zoom subdomains add a
  //                                        numeric segment first)
  //
  // Only the WN_ form is accepted. A bare numeric webinar id would give
  // the worker nothing to build a fallback link from, and the worker
  // rejects it anyway: the WN_ code is already the public credential
  // for registering, a numeric id is not. The code is case-sensitive;
  // nothing here lowercases it. This lives above the item map because
  // that map calls findZoom.
  const ZOOM_URL_RE = /https?:\/\/(?:[a-z0-9-]+\.)?zoom\.us\/(?:[a-z]+\/)*webinar\/register\/(?:\d+\/)?(WN_[A-Za-z0-9_-]+)/i;

  function findZoom(html) {
    const match = ZOOM_URL_RE.exec(html);
    return match ? { id: match[1], url: match[0] } : null;
  }

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
        zoom: findZoom(contentHtml),
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

    // The form posts every registration to mo-forms regardless, so the
    // person is recorded whether or not this event has a webinar yet.
    // What follows only adds the Zoom half.
    const regForm = document.querySelector("[data-inline-signup][data-event-name-from]");
    if (regForm) {
      regForm.setAttribute("data-event-slug", e.slug);
      // The bot check gates the registration endpoint, so it is needed
      // on every event, not just the ones with a webinar. Rendered
      // interaction-only, so most visitors never see anything.
      if (window.MOInlineSignup && window.MOInlineSignup.ensureTurnstile) {
        window.MOInlineSignup.ensureTurnstile(regForm);
      }
    }
    if (regForm && e.zoom) {
      regForm.setAttribute("data-zoom-webinar", e.zoom.id);
      regForm.setAttribute("data-zoom-url", e.zoom.url);
      stripZoomLinks(prose);
      // Careful about what this promises. A link on the post means the
      // page CAN book a seat; whether the worker actually does depends
      // on credentials it has no way to check from here. So the
      // sentence commits to the outcome the reader cares about, which
      // is true in every case, rather than to the mechanism. The
      // subscription clause stays either way: it is the only statement
      // made before anyone submits about what else signing up does.
      const sub = document.querySelector("[data-events-register-sub]");
      if (sub) sub.textContent = "Enter your name and email. We'll register you and send the Zoom join link before the forum starts. If you're not already subscribed, we'll also email you a link to confirm your free subscription to Mere Orthodoxy.";
    }
  }

  // One call to action per page. A visible Zoom link in the post body
  // sits above the form and takes registrations straight to Zoom, which
  // works but leaves no Ghost subscribe and no `event:` label, so the
  // registration is invisible to everything downstream. The link is
  // kept as the form's fallback either way.
  function stripZoomLinks(prose) {
    const links = prose.querySelectorAll('a[href*="zoom.us"]');
    for (let i = 0; i < links.length; i++) {
      const a = links[i];
      if (!ZOOM_URL_RE.test(a.getAttribute("href") || "")) continue;
      // A URL pasted on its own line becomes a Ghost bookmark card, a
      // <figure>, not a <p>. Matching only paragraphs would leave the
      // styled card in place holding its own text with the link torn
      // out of it. Drop whichever block the link wholly occupies, and
      // otherwise just unwrap the anchor so the sentence survives.
      const block = a.closest("figure, .kg-card, p");
      if (block && block.textContent.trim() === a.textContent.trim()) block.remove();
      else a.replaceWith(document.createTextNode(a.textContent));
    }
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
