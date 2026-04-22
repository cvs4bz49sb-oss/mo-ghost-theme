/*
 * Soft subscriber gate.
 *
 * After @custom.gate_days has elapsed since publication, this script
 * truncates the article to its first eight <p> elements and replaces
 * the rest with a sign-up / upgrade card:
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
 */
(function () {
  var content = document.querySelector("[data-post-gate]");
  if (!content) return;

  var days = parseInt(content.getAttribute("data-gate-days"), 10);
  if (!days || days <= 0) return;

  // Ghost already gates members/paid posts server-side; no need to
  // double up with a JS overlay on those.
  var visibility = content.getAttribute("data-post-visibility") || "public";
  if (visibility !== "public") return;

  var publishedAt = Date.parse(content.getAttribute("data-published-at") || "");
  if (isNaN(publishedAt)) return;

  var gateAt = publishedAt + days * 24 * 60 * 60 * 1000;
  if (Date.now() < gateAt) return;

  var tier = content.getAttribute("data-gate-tier") || "members";
  var isMember = content.getAttribute("data-is-member") === "true";
  var memberStatus = content.getAttribute("data-member-status") || "";

  // Gift-link bypass: if URL carries ?gift=<token> and the reader
  // isn't already a signed-in member, decode the token for display
  // (name + tier), skip the gate, and render a top banner crediting
  // the gifter with an inline free-subscribe form. Token is signed
  // but not verified client-side — the soft gate is bypassable
  // anyway. See workers/gift/gift.js.
  if (!isMember) {
    var giftClaims = readGiftClaims();
    if (giftClaims) {
      renderGiftBanner(content, giftClaims);
      return;
    }
  }

  // Tier gate: members = any signed-in account bypasses; paid = must
  // be on a paid plan. Free Subscribers hit the gate when tier=paid.
  if (isMember) {
    if (tier === "members") return;
    if (tier === "paid" && memberStatus === "paid") return;
  }

  applyGate(content, tier);

  function applyGate(root, tier) {
    // Mobile readers get fewer free paragraphs so the gate sits at a
    // comparable scroll depth on a phone vs a desktop. 640px matches
    // the rest of the theme's mobile breakpoint.
    var maxParagraphs = (window.innerWidth || 1024) <= 640 ? 4 : 8;
    var kids = Array.prototype.slice.call(root.children);
    var pCount = 0;
    var cutIndex = -1;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].tagName === "P") pCount++;
      if (pCount >= maxParagraphs) { cutIndex = i; break; }
    }
    // Very short articles don't need gating — nothing meaningful to
    // hide behind and the cutoff UX feels abrupt.
    if (cutIndex < 0 || cutIndex >= kids.length - 1) return;

    for (var j = kids.length - 1; j > cutIndex; j--) {
      kids[j].parentNode.removeChild(kids[j]);
    }
    kids[cutIndex].classList.add("is-gate-fade");
    root.appendChild(buildCard(tier));
  }

  function buildCard(tier) {
    var wrap = document.createElement("aside");
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
      var paidActions = document.createElement("div");
      paidActions.className = "post-gate-actions";
      var becomeMember = document.createElement("a");
      becomeMember.href = "/membership/";
      becomeMember.className = "btn btn-primary";
      becomeMember.textContent = isMember && memberStatus !== "paid"
        ? "Become a Member"
        : "Become a Member";
      paidActions.appendChild(becomeMember);
      if (!isMember) {
        var signin = document.createElement("button");
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

    var signinRow = document.createElement("p");
    signinRow.className = "post-gate-signin";
    signinRow.innerHTML = 'Already a subscriber? ';
    var signinBtn = document.createElement("button");
    signinBtn.type = "button";
    signinBtn.className = "post-gate-signin-link";
    signinBtn.setAttribute("data-portal", "signin");
    signinBtn.textContent = "Sign in";
    signinRow.appendChild(signinBtn);
    signinRow.appendChild(document.createTextNode("."));
    wrap.appendChild(signinRow);
    return wrap;
  }

  function buildSubscribeForm() {
    // [data-inline-signup] is picked up by inline-signup.js via
    // event delegation; it POSTs directly to
    // /members/api/send-magic-link/ and renders an inline success
    // state. No Portal modal.
    var form = document.createElement("div");
    form.className = "post-gate-form";
    form.setAttribute("data-inline-signup", "");
    form.setAttribute("data-source", "gate-modal");
    // On successful subscribe, swap the entire gate card (pitch copy
    // + form + Sign-in row) for the success state so the messaging
    // doesn't double up.
    form.setAttribute("data-replace-on-success", ".post-gate-card");

    form.appendChild(field("post-gate-first", "First Name", "text", "given-name", "data-signup-first"));
    form.appendChild(field("post-gate-last", "Last Name", "text", "family-name", "data-signup-last"));
    form.appendChild(field("post-gate-email", "Email", "email", "email", "data-signup-email"));

    var submit = document.createElement("button");
    submit.type = "button";
    submit.className = "btn btn-primary post-gate-submit";
    submit.setAttribute("data-signup-submit", "");
    submit.textContent = "Subscribe";
    form.appendChild(submit);

    var status = document.createElement("p");
    status.className = "post-gate-status";
    status.setAttribute("data-signup-status", "");
    form.appendChild(status);

    return form;
  }

  function field(id, label, type, autocomplete, signupAttr) {
    var wrap = document.createElement("div");
    wrap.className = "post-gate-field";
    var lbl = document.createElement("label");
    lbl.setAttribute("for", id);
    lbl.textContent = label;
    var input = document.createElement("input");
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

  function readGiftClaims() {
    try {
      var params = new URLSearchParams(window.location.search);
      var token = params.get("gift");
      if (!token) return null;
      var dot = token.indexOf(".");
      if (dot < 0) return null;
      var payload = token.slice(0, dot);
      // Base64url → base64 → UTF-8 string. Signature is not verified
      // here; presence is the signal. A forged token just shows a
      // bogus name on an already-soft-gated article.
      var b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var json = decodeURIComponent(Array.prototype.map.call(atob(b64), function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(""));
      var claims = JSON.parse(json);
      if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) return null;
      return {
        by: String(claims.by || "A Subscriber"),
        tier: String(claims.tier || "Subscriber"),
      };
    } catch (_) { return null; }
  }

  function renderGiftBanner(root, claims) {
    // Reuse the homepage Digest CTA's markup + styling exactly
    // (.digest-cta / .digest-copy / .digest-form) so the top-of-article
    // gift note sits in the same visual family as the rest of the site.
    var cta = document.createElement("div");
    cta.className = "gift-banner digest-cta";
    cta.setAttribute("role", "region");
    cta.setAttribute("aria-label", "Gifted article");

    var copy = document.createElement("div");
    copy.className = "digest-copy";

    var eb = document.createElement("p");
    eb.className = "eyebrow";
    eb.textContent = "A gift from a " + claims.tier;
    copy.appendChild(eb);

    var h = document.createElement("h3");
    h.textContent = claims.by + " shared this essay with you.";
    copy.appendChild(h);

    var body = document.createElement("p");
    body.textContent = "Subscribe for free to read all of our essays.";
    copy.appendChild(body);

    cta.appendChild(copy);
    cta.appendChild(buildGiftSubscribeForm());

    root.insertBefore(cta, root.firstChild);
  }

  function buildGiftSubscribeForm() {
    var form = document.createElement("div");
    form.className = "digest-form";
    form.setAttribute("data-inline-signup", "");
    // source:gift-link lands as a Kit tag on the new subscriber
    // (mo-kit mirrors Ghost labels to Kit tags). Pairs with the
    // "used:gift-link" tag the mo-kit worker sets on the gifter.
    form.setAttribute("data-source", "gift-link");
    form.setAttribute("data-replace-on-success", ".gift-banner");

    form.appendChild(giftField("gift-first", "First Name", "text", "given-name", "First", "data-signup-first"));
    form.appendChild(giftField("gift-last", "Last Name", "text", "family-name", "Last", "data-signup-last"));
    form.appendChild(giftField("gift-email", "Email", "email", "email", "you@example.com", "data-signup-email"));

    var submit = document.createElement("button");
    submit.type = "button";
    submit.className = "digest-submit";
    submit.setAttribute("data-signup-submit", "");
    submit.textContent = "Subscribe";
    form.appendChild(submit);

    var status = document.createElement("p");
    status.className = "digest-status";
    status.setAttribute("data-signup-status", "");
    form.appendChild(status);

    return form;
  }

  function giftField(id, labelText, type, autocomplete, placeholder, signupAttr) {
    var wrap = document.createElement("div");
    wrap.className = "digest-field";
    var lbl = document.createElement("label");
    lbl.setAttribute("for", id);
    lbl.textContent = labelText;
    var input = document.createElement("input");
    input.id = id;
    input.type = type;
    if (autocomplete) input.autocomplete = autocomplete;
    if (placeholder) input.placeholder = placeholder;
    input.required = true;
    if (signupAttr) input.setAttribute(signupAttr, "");
    wrap.appendChild(lbl);
    wrap.appendChild(input);
    return wrap;
  }

  function eyebrow(text) {
    var p = document.createElement("p");
    p.className = "eyebrow";
    p.textContent = text;
    return p;
  }
  function heading(text) {
    var h = document.createElement("h3");
    var em = document.createElement("em");
    em.textContent = text;
    h.appendChild(em);
    return h;
  }
  function body(text) {
    var p = document.createElement("p");
    p.textContent = text;
    return p;
  }
})();
