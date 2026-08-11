/*
 * Inline subscribe flow.
 *
 * Any element with [data-inline-signup] becomes a self-contained
 * Subscribe form. Click on [data-signup-submit] within it posts
 * directly to Ghost's /members/api/send-magic-link/ endpoint, then
 * swaps the form for an inline success message. No Portal modal
 * flash, no redirect — the magic link the subscriber receives carries
 * a `redirect` param back to the current page so they land where they
 * left off once they confirm.
 *
 * Expected markup:
 *   <div data-inline-signup>
 *     <input data-signup-first>
 *     <input data-signup-last>
 *     <input data-signup-email required>
 *     <button data-signup-submit>Subscribe</button>
 *     <p data-signup-status></p>    <!-- optional -->
 *   </div>
 *
 * Event delegation so dynamically-injected forms (e.g. the post gate
 * card) work without init.
 *
 * ZOOM MODE (/forum/)
 * A form that also carries
 *
 *   data-zoom-webinar="WN_…"   the webinar, set by events.js off the post
 *   data-zoom-endpoint="…"     the mo-forms worker base URL
 *   data-zoom-url="…"          the public Zoom registration page
 *   <div data-turnstile-wrap>  slot for the bot check
 *
 * registers the person for that Zoom webinar first, then does the same
 * Ghost subscribe as every other form. Order matters: the button says
 * Register, so the seat is what must succeed, and a Ghost failure after
 * Zoom said yes is logged rather than shown. If the Zoom call fails the
 * form surfaces the error and a link to Zoom's own registration page,
 * so a worker outage never leaves someone with no way to sign up.
 */
(function () {
  const MAGIC_URL = "/members/api/send-magic-link/";
  const ZOOM_PATH = "/zoom-register";

  // Mirrors what Portal records: where the visitor is, where they came
  // from, and any campaign tagging on the URL. Ghost reads UTM parameters
  // off the path, so the query string is kept intact.
  function signupHistory() {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = document.referrer || "";
      let refHost = "";
      try { refHost = ref ? new URL(ref).hostname.replace(/^www\./, "") : ""; } catch (_) { refHost = ""; }
      const sameSite = refHost && refHost === window.location.hostname.replace(/^www\./, "");
      const entry = {
        path: window.location.pathname + window.location.search,
        time: Date.now()
      };
      // utm_source wins over the referring host: a campaign says what it is,
      // a referrer only says where the click happened to come from.
      const source = params.get("utm_source") || params.get("ref") || params.get("source")
        || (sameSite ? "" : refHost);
      if (source) entry.referrerSource = source;
      const medium = params.get("utm_medium");
      if (medium) entry.referrerMedium = medium;
      if (ref && !sameSite) entry.referrerUrl = ref;
      return [entry];
    } catch (_) {
      // Attribution is a nice-to-have; never let it stop a signup.
      return [];
    }
  }
  const INTEGRITY_URL = "/members/api/integrity-token/";

  document.addEventListener("click", (e) => {
    const submit = e.target && e.target.closest && e.target.closest("[data-signup-submit]");
    if (!submit) return;
    const root = submit.closest("[data-inline-signup]");
    if (!root) return;
    e.preventDefault();
    handleSubmit(root, submit);
  });

  // Enter-in-email triggers submit too.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const {target} = e;
    if (!target || !target.matches) return;
    if (!target.matches("[data-inline-signup] [data-signup-email]")) return;
    const root = target.closest("[data-inline-signup]");
    const submit = root && root.querySelector("[data-signup-submit]");
    if (submit) {
      e.preventDefault();
      handleSubmit(root, submit);
    }
  });

  function handleSubmit(root, submit) {
    const emailInput = root.querySelector("[data-signup-email]");
    if (!emailInput) return;
    const email = (emailInput.value || "").trim();
    if (!email || !/.+@.+\..+/.test(email)) {
      setStatus(root, "Enter a valid email address.", true);
      return;
    }
    const first = getValue(root, "[data-signup-first]");
    const last = getValue(root, "[data-signup-last]");
    const name = [first, last].filter(Boolean).join(" ");
    const webinar = (root.getAttribute("data-zoom-webinar") || "").trim();

    // Zoom requires both halves of the name. Ghost is happy without
    // them, which is why this check is scoped to zoom mode.
    if (webinar && (!first || !last)) {
      setStatus(root, "Enter your first and last name.", true);
      return;
    }

    const originalText = submit.textContent;
    submit.disabled = true;
    submit.textContent = webinar ? "Registering\u2026" : "Subscribing\u2026";
    setStatus(root, "");

    if (!webinar) {
      ghostSignup(root, email, name)
        .then(() => { renderSuccess(root, email); })
        .catch((err) => { restore(root, submit, originalText, err); });
      return;
    }

    registerZoom(root, webinar, { first, last, email })
      .then((joinUrl) => {
        const success = renderZoomSuccess(root, email, joinUrl);
        // Two emails land within seconds of each other, so the second
        // one gets explained rather than looking like spam. It is
        // announced only once Ghost has actually accepted, because
        // this call is deliberately not allowed to fail the
        // registration and we shouldn't promise mail that never comes.
        ghostSignup(root, email, name)
          .then(() => { addSubscribeNote(success); })
          .catch((err) => {
            console.warn("inline-signup: Ghost subscribe failed after Zoom registration", err && err.message);
          });
      })
      .catch((err) => {
        restore(root, submit, originalText, err);
        showZoomFallback(root);
      });
  }

  function restore(root, submit, originalText, err) {
    submit.disabled = false;
    submit.textContent = originalText;
    // Turnstile tokens are single-use, so a retry without a reset would
    // fail the bot check no matter what the visitor does.
    resetTurnstile(root);
    setStatus(root, (err && err.message) || "Something went wrong. Try again.", true);
  }

  function ghostSignup(root, email, name) {
    const labels = buildContextLabels(root);

    // Ghost 5.x requires an integrity token fetched from a dedicated
    // endpoint (anti-abuse). The token is single-use and short-lived,
    // so it has to be fetched per-submit, not cached.
    return fetch(INTEGRITY_URL, { credentials: "same-origin" })
      .then((r) => {
        // Reject (don't fall through with an empty token) so the
        // magic-link POST below is skipped — sending it without a
        // valid integrity token would have Ghost reject the signup
        // with a confusing error. Surface a real error instead.
        if (!r.ok) throw new Error("Couldn't verify request. Try again.");
        return r.text();
      })
      .then((integrityToken) => {
        return fetch(MAGIC_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email,
            emailType: "signup",
            name,
            labels,
            requestSrc: "portal",
            redirect: window.location.href,
            // Ghost derives member attribution from urlHistory — it is how
            // Portal populates referrer_source and the utm_* columns. We were
            // not sending it, so 456 of the last 600 signups recorded their
            // source as "Integration: Workers" and every subscription event
            // came through with no attribution at all. Without this there is
            // no way to tell which email or page brought someone in.
            urlHistory: signupHistory(),
            integrityToken,
          }),
          credentials: "same-origin",
        });
      })
      .then((res) => {
        if (res.ok) return null;
        return res.json().then(
          (j) => {
            const msg = j && j.errors && j.errors[0] && j.errors[0].message;
            throw new Error(msg || "Something went wrong. Try again.");
          },
          () => { throw new Error("Something went wrong. Try again."); }
        );
      });
  }

  // -------------------------------------------------------------------
  // Zoom webinar registration (see the header comment)
  // -------------------------------------------------------------------

  function registerZoom(root, webinar, person) {
    const base = (root.getAttribute("data-zoom-endpoint") || "").trim().replace(/\/$/, "");
    if (!base) {
      return Promise.reject(new Error("Registration isn't set up yet. Register on Zoom directly."));
    }
    return awaitTurnstile(root).then((token) => {
      if (TURNSTILE_KEY && !token) {
        // Two messages, and the distinction matters. If the script
        // never loaded (extension, corporate proxy) there is no widget
        // on the page, so telling someone to complete one reads as
        // nonsense and leaves them stuck; send them to Zoom instead.
        // Otherwise the check is rendered but hasn't produced a token
        // after the wait above. That is either a passive check still
        // running or a visible challenge nobody has touched, and since
        // the widget is interaction-only there is no reliable way to
        // tell those apart from here. The wording covers both without
        // claiming there is something on screen to click.
        throw new Error(root.hasAttribute("data-turnstile-failed")
          ? "The bot check didn't load. Register on Zoom directly."
          : "The bot check hasn't finished. Wait a moment, then register again.");
      }
      return fetch(base + ZOOM_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: person.first,
          lastName: person.last,
          email: person.email,
          webinar,
          turnstile_token: token,
        }),
      });
    }).then((res) => {
      return res.json().catch(() => null).then((data) => {
        if (!res.ok || !data || data.ok !== true) {
          throw new Error((data && data.error) || "We couldn't book your seat. Try again in a minute, or register on Zoom directly.");
        }
        return safeZoomUrl(data.joinUrl);
      });
    });
  }

  /**
   * Give an in-flight bot check a moment to finish before treating a
   * missing token as an error. The widget runs interaction-only, so for
   * most visitors it resolves invisibly a second or so after load, and
   * anyone who types fast enough to beat it would otherwise be told to
   * complete a challenge they cannot see.
   */
  function awaitTurnstile(root, waited) {
    const token = turnstileToken(root);
    if (!TURNSTILE_KEY || token) return Promise.resolve(token);
    if (root.hasAttribute("data-turnstile-failed")) return Promise.resolve("");
    const elapsed = waited || 0;
    if (elapsed >= 2000) return Promise.resolve("");
    return new Promise((resolve) => setTimeout(resolve, 250))
      .then(() => awaitTurnstile(root, elapsed + 250));
  }

  // The join link comes back through our worker from Zoom, and it goes
  // straight into an href. Anything that isn't an https zoom.us URL is
  // dropped rather than rendered.
  function safeZoomUrl(value) {
    try {
      const url = new URL(String(value || ""));
      if (url.protocol !== "https:") return "";
      const host = url.hostname.toLowerCase();
      if (host !== "zoom.us" && !host.endsWith(".zoom.us")) return "";
      return url.href;
    } catch (_) {
      return "";
    }
  }

  // Built with createElement rather than innerHTML. The only dynamic
  // value is the visitor's own email, but this is the one success
  // renderer that also embeds a URL from an external service, and a
  // string-built version of it will fail every future audit's
  // innerHTML grep on principle.
  function renderZoomSuccess(root, email, joinUrl) {
    const success = document.createElement("div");
    success.className = "inline-signup-success";
    success.setAttribute("role", "status");

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "You're registered";

    // h2, not the h4 the post-gate card uses: on /forum/ this replaces
    // the section's own <h2>, so an h4 would skip from the page h1
    // straight to h4 and shrink the heading that now carries the
    // section alone.
    const heading = document.createElement("h2");
    heading.className = "inline-signup-success-title";
    const em = document.createElement("em");
    em.textContent = "Your seat is saved.";
    heading.appendChild(em);

    const line = document.createElement("p");
    line.appendChild(document.createTextNode("Zoom sent your join link to "));
    const strong = document.createElement("strong");
    strong.textContent = email;
    line.appendChild(strong);
    line.appendChild(document.createTextNode(joinUrl
      ? ": keep that email, it's how you get in on the day."
      : ": watch for it, that link is how you get in on the day."));

    success.appendChild(eyebrow);
    success.appendChild(heading);
    success.appendChild(line);

    if (joinUrl) {
      const a = document.createElement("a");
      // Outline, not the filled primary pill: on a forum that is days
      // out, opening the link now only lands you in a "waiting for the
      // host" screen. The email is the instruction that matters, so it
      // keeps the visual weight.
      a.className = "btn btn-outline inline-signup-join";
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Save your Zoom link";
      // Host-pinned by safeZoomUrl already; MOSafeHref adds the
      // scheme check every href in this theme goes through.
      window.MOSafeHref.set(a, joinUrl, "#");
      success.appendChild(a);
    }

    // The widget lives inside the block we are about to remove, so tell
    // Turnstile before orphaning its iframe and timers.
    const widgetId = widgetByRoot.get(root);
    if (widgetId && window.turnstile && window.turnstile.remove) {
      try { window.turnstile.remove(widgetId); } catch (_) { /* already gone */ }
    }

    swapInSuccess(root, success);
    return success;
  }

  function addSubscribeNote(success) {
    if (!success || !success.parentNode) return;
    const note = document.createElement("p");
    note.className = "inline-signup-note";
    note.textContent = "We also sent a separate note to confirm your free subscription. Your seat is saved either way.";
    // After the button, not before it: this lands about a second after
    // the card takes focus, and inserting above the button would slide
    // it out from under a cursor already on the way to it.
    success.appendChild(note);
  }

  /**
   * Replace the form (or the larger container it names) with a success
   * card, and move focus into it.
   *
   * Focus is the part that is easy to miss: replaceChild removes the
   * button the visitor just activated, so focus falls to <body> and a
   * screen-reader or keyboard user is silently dropped at the top of
   * the document with no idea the registration worked.
   */
  function swapInSuccess(root, success) {
    const replaceSelector = root.getAttribute("data-replace-on-success");
    const target = replaceSelector ? root.closest(replaceSelector) || root : root;
    target.parentNode.replaceChild(success, target);
    success.setAttribute("tabindex", "-1");
    try { success.focus(); } catch (_) { /* pre-focus() browsers */ }
  }

  // Last resort when our own registration path fails: Zoom's public
  // registration page for the same webinar, straight off the event post.
  function showZoomFallback(root) {
    const url = safeZoomUrl(root.getAttribute("data-zoom-url"));
    if (!url || root.querySelector("[data-zoom-fallback]")) return;
    const p = document.createElement("p");
    p.className = "digest-fallback";
    p.setAttribute("data-zoom-fallback", "");
    const a = document.createElement("a");
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = "Register on Zoom instead";
    window.MOSafeHref.set(a, url, "#");
    p.appendChild(a);
    const status = root.querySelector("[data-signup-status]");
    if (status) status.insertAdjacentElement("afterend", p);
    else root.appendChild(p);
  }

  // -------------------------------------------------------------------
  // Turnstile (zoom mode only)
  // -------------------------------------------------------------------

  const TURNSTILE_KEY = (function () {
    const m = document.querySelector('meta[name="turnstile-site-key"]');
    return m ? (m.getAttribute("content") || "").trim() : "";
  })();

  const tokenByRoot = new WeakMap();
  const widgetByRoot = new WeakMap();

  /**
   * Render the bot check into a form's [data-turnstile-wrap] slot.
   * Called by events.js once it knows the event has a webinar, so no
   * other inline-signup form on the site grows a widget.
   */
  function ensureTurnstile(root, attempt) {
    if (!TURNSTILE_KEY || !root) return;
    const wrap = root.querySelector("[data-turnstile-wrap]");
    if (!wrap || wrap.dataset.turnstileRendered === "1") return;
    if (!window.turnstile) {
      // Turnstile's script is async. Retry for ~10s, then give up
      // rather than leaving a timer running for the life of the page.
      // Record the giving-up so the submit path can say what actually
      // went wrong instead of pointing at a widget that never arrived.
      const next = (attempt || 0) + 1;
      if (next > 50) { root.setAttribute("data-turnstile-failed", ""); return; }
      setTimeout(() => ensureTurnstile(root, next), 200);
      return;
    }
    wrap.dataset.turnstileRendered = "1";
    wrap.hidden = false;
    // Two retry chains can be in flight (events.js and the sweep at the
    // bottom of this file). If one gave up while the other went on to
    // succeed, a stale flag would misreport a pending token as a
    // widget that never loaded.
    root.removeAttribute("data-turnstile-failed");
    const id = window.turnstile.render(wrap, {
      sitekey: TURNSTILE_KEY,
      callback(token) { tokenByRoot.set(root, token); },
      "error-callback"() { tokenByRoot.delete(root); },
      "expired-callback"() { tokenByRoot.delete(root); },
      // Invisible unless Cloudflare actually wants a challenge. Most
      // visitors pass passively and never see a widget, which keeps a
      // vendor card out of an editorial page and avoids shoving the
      // Register button down the screen mid-interaction.
      appearance: "interaction-only",
      theme: "light",
    });
    widgetByRoot.set(root, id);
  }

  function turnstileToken(root) {
    return tokenByRoot.get(root) || "";
  }

  function resetTurnstile(root) {
    const id = widgetByRoot.get(root);
    if (!id || !window.turnstile) return;
    tokenByRoot.delete(root);
    try { window.turnstile.reset(id); } catch (_) { /* widget already gone */ }
  }

  window.MOInlineSignup = window.MOInlineSignup || {};
  window.MOInlineSignup.ensureTurnstile = ensureTurnstile;

  // This file ships in site.min.js, which loads AFTER {{{body}}} —
  // events.js runs inside the body and therefore earlier, so its call
  // to MOInlineSignup.ensureTurnstile lands before this global exists.
  // Pick up anything it already marked. Both paths are idempotent via
  // wrap.dataset.turnstileRendered, so whichever runs second is a
  // no-op. The arrow wrapper matters: passing ensureTurnstile straight
  // to forEach would feed it the index as `attempt`.
  document.querySelectorAll("[data-inline-signup][data-zoom-webinar]")
    .forEach((el) => ensureTurnstile(el));

  function renderSuccess(root, email) {
    const success = document.createElement("div");
    success.className = "inline-signup-success";
    success.setAttribute("role", "status");
    success.innerHTML =
      `<p class="eyebrow">Check your inbox</p>` +
      `<h4><em>Almost there.</em></h4>` +
      `<p>We sent a link to <strong>${escapeHtml(email)}</strong>. ` +
      `Open it to finish subscribing and you'll land right back on this page.</p>`;
    // The form may declare a larger container to swap out (e.g. the
    // whole post-gate card with its pitch copy above the form) so the
    // success state fully replaces the surrounding messaging instead
    // of appearing below it.
    swapInSuccess(root, success);
  }

  function setStatus(root, msg, isError) {
    const status = root.querySelector("[data-signup-status]");
    if (!status) return;
    status.textContent = msg;
    status.classList.toggle("is-error", !!isError);
  }

  function getValue(root, selector) {
    const el = root.querySelector(selector);
    return el ? (el.value || "").trim() : "";
  }

  // Build the context labels that Ghost will attach to the new member.
  // Our mo-kit worker mirrors Ghost labels onto Kit tags, so these
  // labels are the single source of truth for signup provenance.
  //
  // TOPIC_TAGS must stay in sync with the TOPIC_TAGS var on the
  // mo-kit worker; anything outside this set would still become a
  // Ghost label but the worker won't turn it into a meaningful tag.
  const TOPIC_TAGS = [
    "church", "culture", "family", "formation",
    "technology", "theology", "book-reviews"
  ];
  function buildContextLabels(root) {
    const out = [];
    // Form location, e.g. "home", "article-inline", "footer".
    const source = root.getAttribute("data-source");
    if (source) out.push(`source:${source}`);
    // Explicit newsletter opt-in for this form, e.g.
    // data-newsletter="weekly-digest" → "Newsletter:weekly-digest" label.
    // This makes the weekly digest an explicit opt-in that's independent of
    // the Daily Liturgy signup: mo-kit reads this label so a member who took
    // Daily Liturgy (held out of the digest by default) can still be on the
    // digest too, and neither signup auto-subscribes to the other.
    const newsletter = root.getAttribute("data-newsletter");
    if (newsletter) out.push(`Newsletter:${newsletter}`);
    // Article topic(s): read the article's visible topic links if
    // present. Any tag outside TOPIC_TAGS is skipped to keep Ghost
    // labels/Kit tags bounded.
    const tagLinks = document.querySelectorAll(".article-topic [data-tag-slug], .article-topic-tag[data-tag-slug]");
    const added = Object.create(null);
    for (let i = 0; i < tagLinks.length; i++) {
      const slug = tagLinks[i].getAttribute("data-tag-slug") || "";
      if (TOPIC_TAGS.indexOf(slug) === -1) continue;
      if (added[slug]) continue;
      added[slug] = true;
      out.push(`topic:${slug}`);
    }
    // UTM campaign.
    try {
      const params = new URLSearchParams(window.location.search);
      const utm = params.get("utm_campaign");
      if (utm) out.push(`utm:${utm}`);
    } catch (_) {}
    // Event registration: form declares `data-event-name-from="sel"`
    // pointing at an element (populated client-side by events.js)
    // whose textContent is the event title. Emits "event: Title" as
    // a Ghost label; mo-kit mirrors to Kit tag with the same name.
    const eventSel = root.getAttribute("data-event-name-from");
    if (eventSel) {
      const nameEl = document.querySelector(eventSel);
      const eventName = nameEl ? (nameEl.textContent || "").trim() : "";
      if (eventName) out.push(`event: ${eventName}`);
    }
    return out;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
