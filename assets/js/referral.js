/*
 * Member referral program — client side. Loaded site-wide via
 * site.min.js, so it runs on every page after boot.min.js has set up
 * window.MO_API_BASE and window.MOAuth.
 *
 * Three jobs:
 *   1. Capture ?ref=<code> into a first-party cookie (any page, logged
 *      in or out) so the attribution survives the Portal signup round
 *      trip.
 *   2. Repoint the /membership/ "Become a Member" CTA at the new-member
 *      Ghost Offer (read from <meta name="mo-referral-offer">) when a
 *      ref is present, so the referred person gets the first-period
 *      discount. Degrades to the normal Portal signup if no offer is set.
 *   3. Once a member is signed in (body[data-member-email]), POST the
 *      stored ref to /api/referral/attribute. Identity is taken from the
 *      member JWT server-side; we only send the code. Clear the cookie
 *      once the worker has handled it.
 *   4. On /dashboard/, render the member's own code, share link, and
 *      stats into [data-mo-referral-widget].
 */
(function () {
  "use strict";

  const REF_RE = /^[A-Za-z0-9_-]{1,64}$/;
  const COOKIE = "mo_ref";

  function setCookie(name, value, maxAge) {
    const secure = location.protocol === "https:" ? ";Secure" : "";
    document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax${secure}`;
  }
  function getCookie(name) {
    const all = document.cookie ? document.cookie.split("; ") : [];
    for (let i = 0; i < all.length; i++) {
      const eq = all[i].indexOf("=");
      if (eq > -1 && all[i].slice(0, eq) === name) {
        return decodeURIComponent(all[i].slice(eq + 1));
      }
    }
    return null;
  }
  function clearCookie(name) {
    document.cookie = `${name}=;path=/;max-age=0;SameSite=Lax`;
  }

  function metaContent(name) {
    const el = document.querySelector(`meta[name="${name}"]`);
    const v = el && el.getAttribute("content");
    return v && v.trim() ? v.trim() : null;
  }

  const API = window.MO_API_BASE || null;

  // --- 1. Capture ?ref into a cookie (365 days) ---------------------------
  let refParam = null;
  try {
    refParam = new URLSearchParams(location.search).get("ref");
  } catch (e) { /* no URLSearchParams */ }
  if (refParam && REF_RE.test(refParam)) {
    setCookie(COOKIE, refParam, 60 * 60 * 24 * 365);
  }

  const storedRef = getCookie(COOKIE);

  // --- 2. Repoint membership CTAs at the new-member Offer -----------------
  // Only when we actually have a referral in play; never alter the CTA for
  // ordinary (non-referred) visitors.
  if (storedRef) {
    const offer = metaContent("mo-referral-offer");
    if (offer) {
      const ctas = document.querySelectorAll('[data-portal="signup"]');
      for (let c = 0; c < ctas.length; c++) {
        ctas[c].setAttribute("href", offer);
        ctas[c].removeAttribute("data-portal"); // stop the Portal handler hijacking it
      }
    }
  }

  // --- 3. Attribute once the visitor is a signed-in member ---------------
  const memberEmail = document.body ? document.body.getAttribute("data-member-email") : null;
  const isMember = !!(memberEmail && memberEmail.indexOf("@") > -1);

  if (isMember && storedRef && API && window.MOAuth && REF_RE.test(storedRef)) {
    window.MOAuth.fetch(`${API}/api/referral/attribute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ref: storedRef })
    })
      .then((r) => { return r.ok ? r.json() : null; })
      .then((data) => {
        // Any definitive answer (attributed, self, already, unknown,
        // pre-existing) means stop trying. Only a network/401 (null)
        // keeps the cookie so a later navigation retries.
        if (data) clearCookie(COOKIE);
      })
      .catch(() => { /* keep cookie, retry next navigation */ });
  }

  // --- 4. Dashboard widget -----------------------------------------------
  const widget = document.querySelector("[data-mo-referral-widget]");
  if (widget && API && window.MOAuth) {
    renderWidget(widget);
  }

  function renderWidget(root) {
    window.MOAuth.fetch(`${API}/api/referral/me`)
      .then((r) => { return r.ok ? r.json() : null; })
      .then((data) => {
        if (!data) return;
        if (!data.eligible) {
          // Free members: invite them to upgrade rather than showing a
          // broken widget. Keep it quiet.
          root.hidden = true;
          return;
        }
        const linkEl = root.querySelector("[data-referral-link]");
        const copyEl = root.querySelector("[data-referral-copy]");
        const s = data.stats || {};
        if (linkEl) {
          linkEl.value = data.link;
        }
        setText(root, "[data-referral-converted]", s.converted || 0);
        setText(root, "[data-referral-pending]", s.pending || 0);
        setText(root, "[data-referral-earned]", `$${((s.earned_cents || 0) / 100).toFixed(2)}`);
        root.hidden = false;

        if (copyEl && linkEl) {
          copyEl.addEventListener("click", () => {
            linkEl.select();
            const done = function () {
              const label = copyEl.textContent;
              copyEl.textContent = "Copied";
              setTimeout(() => { copyEl.textContent = label; }, 1500);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(linkEl.value).then(done, () => {
                try { document.execCommand("copy"); done(); } catch (e) {}
              });
            } else {
              try { document.execCommand("copy"); done(); } catch (e) {}
            }
          });
        }
      })
      .catch(() => { root.hidden = true; });
  }

  function setText(root, sel, value) {
    const el = root.querySelector(sel);
    if (el) el.textContent = value;
  }
})();
