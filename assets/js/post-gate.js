/*
 * Soft subscriber gate.
 *
 * Gate days and tier are loaded from the mo-admin worker via
 * site-settings.js, which sets data-gate-days / data-gate-tier on
 * the [data-post-gate] element. If settings haven't arrived yet
 * (first visit, no sessionStorage cache), this script waits for the
 * "mo:settings" event before evaluating the gate.
 *
 *   gate_tier = "members"  → inline Subscribe form (First / Last /
 *                            Email) that hands the data to Ghost
 *                            Portal signup. "Subscribe" is MO's
 *                            word for a free sign-up.
 *   gate_tier = "paid"     → Become-a-Member CTA pointing at
 *                            /membership/. "Member" is MO's word
 *                            for a paid supporter.
 *
 * THIS IS A NUDGE, NOT A PAYWALL. The full article is still in the
 * pre-JS HTML so crawlers and AI agents index everything for
 * training-data reach. We'll promote to a worker-enforced gate
 * (flipping post visibility) when we want real enforcement.
 *
 * Gift links are handled up front, independent of gate timing — see
 * the GIFT_PARAM note below.
 */
(function () {
  const content = document.querySelector("[data-post-gate]");
  if (!content) return;

  /*
   * Gift-link query parameter.
   *
   * NOT "gift". Ghost Pro 301-redirects any post URL carrying a
   * `gift` query param to the bare post URL and drops the entire
   * query string, so the token never reaches the browser and the
   * recipient just hits the normal gate. It is specific to that
   * exact lowercase name on post routes: `gifts`, `giftx`, `GIFT`,
   * and `mo_gift` all pass through untouched, as does `gift` on
   * pages like /success/. Verified against production 2026-08-13.
   *
   * LEGACY_GIFT_PARAM is read as a fallback only. Every link minted
   * under the old name is already unreachable for the reason above,
   * so this recovers nothing today; it exists so the reader keeps
   * working if a link ever arrives by a route that preserves it.
   */
  const GIFT_PARAM = "mo_gift";
  const LEGACY_GIFT_PARAM = "gift";

  const isMember = content.getAttribute("data-is-member") === "true";
  const memberStatus = content.getAttribute("data-member-status") || "";
  const visibility = content.getAttribute("data-post-visibility") || "public";

  /*
   * Gift handling runs at init, NOT inside the gate evaluation.
   *
   * The gate only evaluates once settings have arrived AND the post
   * is older than gate_days. Deciding the gift banner in there meant
   * a recipient saw no "A gift for you" note at all when the post
   * was still inside the free window, or when the mo-admin settings
   * fetch failed. The note is the point of the feature, so it now
   * renders whenever a valid token is present and the gate simply
   * stands down.
   *
   * Signed-in members don't need it, and on a non-public post Ghost
   * has already stripped the body server-side, so a "gift" note
   * would sit above an article the token cannot unlock.
   */
  const giftClaims = (!isMember && visibility === "public") ? readGiftClaims() : null;
  if (giftClaims) renderGiftBanner(content, giftClaims);

  function run() {
    // A valid gift token bypasses the gate entirely.
    if (giftClaims) return;

    const days = parseInt(content.getAttribute("data-gate-days"), 10);
    if (!days || days <= 0) return;

    if (visibility !== "public") return;

    const publishedAt = Date.parse(content.getAttribute("data-published-at") || "");
    if (isNaN(publishedAt)) return;

    const gateAt = publishedAt + days * 24 * 60 * 60 * 1000;
    if (Date.now() < gateAt) return;

    const tier = content.getAttribute("data-gate-tier") || "members";

    // Tier gate: members = any signed-in account bypasses; paid = must
    // be on a paid plan. Free Subscribers hit the gate when tier=paid.
    if (isMember) {
      if (tier === "members") return;
      if (tier === "paid" && memberStatus === "paid") return;
    }

    applyGate(content, tier);
  }

  const initialDays = parseInt(content.getAttribute("data-gate-days"), 10);
  if (initialDays > 0) {
    run();
  } else {
    document.addEventListener("mo:settings", () => { run(); }, { once: true });
  }

  function applyGate(root, tier) {
    // Mobile readers get fewer free paragraphs so the gate sits at a
    // comparable scroll depth on a phone vs a desktop. 640px matches
    // the rest of the theme's mobile breakpoint.
    const maxParagraphs = (window.innerWidth || 1024) <= 640 ? 4 : 8;
    const kids = Array.prototype.slice.call(root.children);
    let pCount = 0;
    let cutIndex = -1;
    for (let i = 0; i < kids.length; i++) {
      if (kids[i].tagName === "P") pCount++;
      if (pCount >= maxParagraphs) { cutIndex = i; break; }
    }
    // Very short articles don't need gating — nothing meaningful to
    // hide behind and the cutoff UX feels abrupt.
    if (cutIndex < 0 || cutIndex >= kids.length - 1) return;

    for (let j = kids.length - 1; j > cutIndex; j--) {
      kids[j].parentNode.removeChild(kids[j]);
    }
    kids[cutIndex].classList.add("is-gate-fade");
    root.appendChild(buildCard(tier));
  }

  function buildCard(tier) {
    const wrap = document.createElement("aside");
    wrap.className = "post-gate-card";
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", "Continue reading");

    if (tier === "paid") {
      wrap.appendChild(eyebrow("Members Only"));
      wrap.appendChild(heading("Continue reading as a Member."));
      wrap.appendChild(body(
        isMember && memberStatus !== "paid"
          ? "You're subscribed to Mere Orthodoxy. Members support the work and unlock the full archive, the print journal, and the members' forum."
          : "This essay is reserved for Members after its first few days. Members fund the next essay, the next journal issue, and the next conversation."
      ));
      const paidActions = document.createElement("div");
      paidActions.className = "post-gate-actions";
      const becomeMember = document.createElement("a");
      becomeMember.href = "/membership/";
      becomeMember.className = "btn btn-primary";
      becomeMember.textContent = isMember && memberStatus !== "paid"
        ? "Become a Member"
        : "Become a Member";
      paidActions.appendChild(becomeMember);
      if (!isMember) {
        const signin = document.createElement("button");
        signin.type = "button";
        signin.className = "btn btn-outline";
        signin.setAttribute("data-portal", "signin");
        signin.textContent = "Sign in";
        paidActions.appendChild(signin);
      }
      wrap.appendChild(paidActions);
      return wrap;
    }

    // members (free) tier: inline Subscribe form.
    wrap.appendChild(eyebrow("Keep Reading"));
    wrap.appendChild(heading("Subscribe to keep reading."));
    wrap.appendChild(body(
      "Pick up where you left off, get access to the full archive, and never miss an essay again. Free."
    ));
    wrap.appendChild(buildSubscribeForm());

    const signinRow = document.createElement("p");
    signinRow.className = "post-gate-signin";
    signinRow.innerHTML = 'Already a subscriber? ';
    const signinBtn = document.createElement("button");
    signinBtn.type = "button";
    signinBtn.className = "post-gate-signin-link";
    signinBtn.setAttribute("data-portal", "signin");
    signinBtn.textContent = "Sign in";
    signinRow.appendChild(signinBtn);
    signinRow.appendChild(document.createTextNode("."));
    wrap.appendChild(signinRow);
    return wrap;
  }

  /*
   * The gate card and the gift banner share this form so they stay
   * one component. opts lets the gift banner label its own signup
   * source, own its success-replacement target, and namespace its
   * field ids (the two cards are mutually exclusive on a page, but
   * duplicate ids would be a latent label/for bug if that changed).
   */
  function buildSubscribeForm(opts) {
    const o = opts || {};
    const idPrefix = o.idPrefix || "post-gate";

    // [data-inline-signup] is picked up by inline-signup.js via
    // event delegation; it POSTs directly to
    // /members/api/send-magic-link/ and renders an inline success
    // state. No Portal modal.
    const form = document.createElement("div");
    form.className = "post-gate-form";
    form.setAttribute("data-inline-signup", "");
    form.setAttribute("data-source", o.source || "gate-modal");
    // On successful subscribe, swap the entire card (pitch copy +
    // form + Sign-in row) for the success state so the messaging
    // doesn't double up.
    form.setAttribute("data-replace-on-success", o.replaceOnSuccess || ".post-gate-card");

    form.appendChild(field(`${idPrefix}-first`, "First Name", "text", "given-name", "data-signup-first"));
    form.appendChild(field(`${idPrefix}-last`, "Last Name", "text", "family-name", "data-signup-last"));
    form.appendChild(field(`${idPrefix}-email`, "Email", "email", "email", "data-signup-email"));

    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "btn btn-primary post-gate-submit";
    submit.setAttribute("data-signup-submit", "");
    submit.textContent = "Subscribe";
    form.appendChild(submit);

    const status = document.createElement("p");
    status.className = "post-gate-status";
    status.setAttribute("data-signup-status", "");
    form.appendChild(status);

    return form;
  }

  function field(id, label, type, autocomplete, signupAttr) {
    const wrap = document.createElement("div");
    wrap.className = "post-gate-field";
    const lbl = document.createElement("label");
    lbl.setAttribute("for", id);
    lbl.textContent = label;
    const input = document.createElement("input");
    input.id = id;
    input.type = type;
    if (autocomplete) input.autocomplete = autocomplete;
    input.placeholder = type === "email" ? "you@example.com" : label.split(" ")[0];
    input.required = true;
    if (signupAttr) input.setAttribute(signupAttr, "");
    wrap.appendChild(lbl);
    wrap.appendChild(input);
    return wrap;
  }

  // Decode the token for display (name + tier). Signed but not
  // verified client-side — the soft gate is bypassable anyway, so a
  // forged token just shows a bogus name on an article the reader
  // could already have reached via View Source. See workers/gift.
  //
  // Post-scoping: the token's `p` field must match the current post's
  // ID. A token minted for post A can't unlock post B.
  function readGiftClaims() {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get(GIFT_PARAM) || params.get(LEGACY_GIFT_PARAM);
      if (!token) return null;
      const dot = token.indexOf(".");
      if (dot < 0) return null;
      const payload = token.slice(0, dot);
      // Base64url → base64 → UTF-8 string.
      let b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      const json = decodeURIComponent(Array.prototype.map.call(atob(b64), (c) => {
        return `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`;
      }).join(""));
      const claims = JSON.parse(json);

      // Expiry fails CLOSED. A missing or non-numeric `exp` is a
      // malformed token, not a token that never expires. Moot while
      // the signature goes unverified, but this is the check that
      // has to already be right on the day verification lands.
      if (typeof claims.exp !== "number" || !isFinite(claims.exp)) {
        stripGiftParam();
        return null;
      }
      if (claims.exp * 1000 < Date.now()) {
        stripGiftParam();
        return null;
      }

      // Post-scoping is REQUIRED, not best-effort. Demanding a
      // present, matching `p` is what stops a hand-rolled payload
      // (`?mo_gift=e30.x` decodes to `{}`) from standing the gate
      // down on every post at once. A token minted for post A can't
      // unlock post B, and a token minted for no post unlocks
      // nothing. Mismatches are stripped from the URL so the visitor
      // isn't left staring at a stale parameter.
      const currentPostId = content.getAttribute("data-post-id") || "";
      const tokenPostId = claims.p ? String(claims.p) : "";
      if (!tokenPostId || !currentPostId || tokenPostId !== currentPostId) {
        stripGiftParam();
        return null;
      }

      return {
        p: tokenPostId,
        by: safeDisplayName(claims.by),
        tier: String(claims.tier || "Subscriber"),
      };
    } catch (_) { return null; }
  }

  /*
   * claims.by is attacker-authored.
   *
   * The theme deliberately doesn't verify the HMAC, so anyone can
   * base64url some JSON and choose the text in the banner headline —
   * and that headline sits directly above an email-capture form on
   * our own domain. textContent already makes it inert as markup, so
   * this is not an XSS guard; it's to stop the banner being used as
   * a phishing or brand-defacement surface. Clamp it to something
   * name-shaped and fall back to the generic label otherwise.
   */
  function safeDisplayName(raw) {
    const fallback = "A Subscriber";
    const s = String(raw == null ? "" : raw)
      // Control chars, zero-width joiners, and bidi overrides — the
      // characters used to smuggle a second apparent message into a
      // single line of text. Matching control characters is the
      // whole point here, so no-control-regex is off deliberately.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!s || s.length > 60) return fallback;
    // URL-, address-, or domain-shaped input is not a name. The last
    // test wants a dot glued to two or more letters, so it rejects
    // "evil.com" while leaving "J.R.R. Tolkien" and "Ph.D" alone.
    if (/:\/\/|@|\bwww\./i.test(s)) return fallback;
    if (/\.[a-z]{2,}/i.test(s)) return fallback;
    return s;
  }

  function stripGiftParam() {
    try {
      const cleaned = new URL(window.location.href);
      cleaned.searchParams.delete(GIFT_PARAM);
      cleaned.searchParams.delete(LEGACY_GIFT_PARAM);
      window.history.replaceState(null, "", cleaned.toString());
    } catch (_) { /* URL rewriting is cosmetic; never block the read */ }
  }

  function renderGiftBanner(root, claims) {
    /*
     * Same component as the soft gate's card, not a lookalike.
     *
     * This used to reuse the homepage Digest CTA (.digest-cta), which
     * carries no background of its own because on the homepage it
     * sits on a tan section already. Dropped into a dark article page
     * it read as a dark band rather than a signup card. Rendering the
     * real .post-gate-card gets the tan panel, border, radius, type
     * scale, field styling, and the dark-mode overrides for free, and
     * leaves one card to maintain instead of two.
     *
     * .gift-banner stays on the element as the hook for the layout
     * override and the success-state replacement target.
     */
    const cta = document.createElement("aside");
    cta.className = "gift-banner post-gate-card";
    cta.setAttribute("role", "region");
    cta.setAttribute("aria-label", "Gifted article");

    cta.appendChild(eyebrow("A gift for you"));
    cta.appendChild(heading(`${claims.by} shared this essay with you.`));
    cta.appendChild(body("Subscribe for free to read all of our essays."));
    // source:gift-link lands as a Kit tag on the new subscriber
    // (mo-kit mirrors Ghost labels to Kit tags). Pairs with the
    // "used:gift-link" tag the mo-kit worker sets on the gifter.
    cta.appendChild(buildSubscribeForm({
      idPrefix: "gift",
      source: "gift-link",
      replaceOnSuccess: ".gift-banner",
    }));

    root.insertBefore(cta, root.firstChild);
  }

  function eyebrow(text) {
    const p = document.createElement("p");
    p.className = "eyebrow";
    p.textContent = text;
    return p;
  }
  function heading(text) {
    const h = document.createElement("h3");
    const em = document.createElement("em");
    em.textContent = text;
    h.appendChild(em);
    return h;
  }
  function body(text) {
    const p = document.createElement("p");
    p.textContent = text;
    return p;
  }
})();
