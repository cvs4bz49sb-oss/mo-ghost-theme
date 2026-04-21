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

  // Tier gate: members = any signed-in account bypasses; paid = must
  // be on a paid plan. Free Subscribers hit the gate when tier=paid.
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
      if (pCount >= 8) { cutIndex = i; break; }
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
    // Hidden members-* inputs get read by Ghost Portal when the
    // Subscribe button (data-portal="signup") is clicked. Portal
    // handles the magic-link email and the success state.
    var form = document.createElement("div");
    form.className = "post-gate-form";

    form.appendChild(field("post-gate-first", "First Name", "text", "given-name"));
    form.appendChild(field("post-gate-last", "Last Name", "text", "family-name"));

    var emailWrap = document.createElement("div");
    emailWrap.className = "post-gate-field";
    var emailLabel = document.createElement("label");
    emailLabel.setAttribute("for", "post-gate-email");
    emailLabel.textContent = "Email";
    var emailInput = document.createElement("input");
    emailInput.id = "post-gate-email";
    emailInput.type = "email";
    emailInput.autocomplete = "email";
    emailInput.placeholder = "you@example.com";
    emailInput.required = true;
    emailInput.setAttribute("data-members-email", "");
    emailWrap.appendChild(emailLabel);
    emailWrap.appendChild(emailInput);
    form.appendChild(emailWrap);

    var nameHidden = document.createElement("input");
    nameHidden.type = "hidden";
    nameHidden.id = "post-gate-name";
    nameHidden.setAttribute("data-members-name", "");
    form.appendChild(nameHidden);

    var submit = document.createElement("button");
    submit.type = "button";
    submit.className = "btn btn-primary post-gate-submit";
    submit.setAttribute("data-portal", "signup");
    submit.textContent = "Subscribe";
    form.appendChild(submit);

    // Sync first+last into the hidden name field Ghost Portal reads.
    var first = form.querySelector("#post-gate-first");
    var last = form.querySelector("#post-gate-last");
    function syncName() {
      var parts = [first.value.trim(), last.value.trim()].filter(Boolean);
      nameHidden.value = parts.join(" ");
    }
    first.addEventListener("input", syncName);
    last.addEventListener("input", syncName);
    submit.addEventListener("click", syncName);

    return form;
  }

  function field(id, label, type, autocomplete) {
    var wrap = document.createElement("div");
    wrap.className = "post-gate-field";
    var lbl = document.createElement("label");
    lbl.setAttribute("for", id);
    lbl.textContent = label;
    var input = document.createElement("input");
    input.id = id;
    input.type = type;
    if (autocomplete) input.autocomplete = autocomplete;
    input.placeholder = label.split(" ")[0];
    input.required = true;
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
