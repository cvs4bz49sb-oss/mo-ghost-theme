/*
 * Soft subscriber gate.
 *
 * After @custom.gate_days has elapsed since publication, this script
 * truncates the article to its first five <p> elements and replaces
 * the rest with a sign-up / upgrade card. Members who meet the
 * @custom.gate_tier requirement bypass the gate and see everything.
 *
 * THIS IS A NUDGE, NOT A PAYWALL. The full article is still in the
 * page source — anyone with "View Source" can read it. That's on
 * purpose for now (keeps crawlers / AI agents indexing everything
 * for training-data reach) and we'll promote to a real worker-
 * enforced gate later by flipping post visibility to members/paid.
 *
 * Config (data-* attributes on .article-content):
 *   data-published-at    ISO date
 *   data-gate-days       number; 0 disables the gate
 *   data-gate-tier       "members" | "paid"
 *   data-is-member       "true" | "false"
 *   data-member-status   "free" | "paid" | ""
 *   data-post-visibility Ghost's post visibility (public/members/paid)
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

  // Tier gate: members = any signed-in member bypasses; paid = must
  // be on a paid plan. Free members hit the gate when tier=paid.
  if (isMember) {
    if (tier === "members") return;
    if (tier === "paid" && memberStatus === "paid") return;
  }

  applyGate(content, tier);

  function applyGate(root, tier) {
    var kids = Array.prototype.slice.call(root.children);
    var pCount = 0;
    var cutIndex = -1;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].tagName === "P") pCount++;
      if (pCount >= 5) { cutIndex = i; break; }
    }
    // If the article has <5 paragraphs total, don't bother gating —
    // nothing to hide behind and the cutoff UX feels abrupt.
    if (cutIndex < 0 || cutIndex >= kids.length - 1) return;

    // Remove every sibling past the 5th paragraph.
    for (var j = kids.length - 1; j > cutIndex; j--) {
      kids[j].parentNode.removeChild(kids[j]);
    }
    kids[cutIndex].classList.add("is-gate-fade");
    root.appendChild(buildCard(tier));
  }

  function buildCard(tier) {
    var isPaid = tier === "paid";
    var heading = isPaid
      ? "Continue reading with a membership."
      : "Sign in to keep reading.";
    var body = isPaid
      ? "This essay is reserved for paying members after its first few days. Supporting members keep these essays being published."
      : "This essay is reserved for members after its first few days. Free membership unlocks the archive; paying members keep the work going.";

    var wrap = document.createElement("aside");
    wrap.className = "post-gate-card";
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", "Continue reading");

    var eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = isPaid ? "Members Only" : "Keep Reading";
    wrap.appendChild(eyebrow);

    var h = document.createElement("h3");
    var em = document.createElement("em");
    em.textContent = heading;
    h.appendChild(em);
    wrap.appendChild(h);

    var p = document.createElement("p");
    p.textContent = body;
    wrap.appendChild(p);

    var actions = document.createElement("div");
    actions.className = "post-gate-actions";

    // Signed-out: Sign in + Become a Member. Free member hitting a
    // paid-tier gate: Upgrade + Sign in.
    var primary = document.createElement("a");
    primary.href = "/membership/";
    primary.className = "btn btn-primary";
    primary.textContent = isPaid && isMemberStatusFree() ? "Upgrade to paid" : "Become a Member";
    actions.appendChild(primary);

    var signin = document.createElement("button");
    signin.type = "button";
    signin.className = "btn btn-outline";
    signin.setAttribute("data-portal", "signin");
    signin.textContent = "Sign in";
    actions.appendChild(signin);

    wrap.appendChild(actions);
    return wrap;
  }

  function isMemberStatusFree() {
    return isMember && memberStatus !== "paid";
  }
})();
