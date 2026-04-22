/*
 * Article gift-link button.
 *
 * Only useful on articles where the soft gate is (or will be) in
 * effect — i.e. visibility:public + gate_days > 0 + past the gate
 * window. For fresh posts still in the free-read window, or for
 * already-paid posts, the recipient can read without a gift link so
 * the button would be noise. We hide it in those cases.
 *
 * Click flow: mint a signed token via mo-gift Worker, copy the
 * article URL with ?gift=TOKEN to the clipboard, flash a toast.
 */
(function () {
  var btn = document.querySelector("[data-article-gift]");
  if (!btn) return;

  var gateRoot = document.querySelector("[data-post-gate]");
  if (!gateInEffect(gateRoot)) {
    btn.setAttribute("hidden", "");
    return;
  }

  var workerUrl = (btn.getAttribute("data-worker-url") || "").trim().replace(/\/$/, "");
  var email = (btn.getAttribute("data-member-email") || "").trim();
  var postId = (btn.getAttribute("data-post-id") || "").trim();
  var postUrl = (btn.getAttribute("data-post-url") || "").trim();
  if (!workerUrl || !email || !postId || !postUrl) {
    btn.setAttribute("hidden", "");
    return;
  }

  btn.addEventListener("click", function () {
    if (btn.disabled) return;
    btn.disabled = true;
    fetch(workerUrl + "/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, postId: postId }),
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.token) { toast("Gift link unavailable. Try again."); return; }
        var u;
        try {
          u = new URL(postUrl);
          u.searchParams.set("gift", data.token);
        } catch (_) {
          toast("Couldn't build gift link.");
          return;
        }
        copyText(u.toString())
          .then(function () { toast("Gift link copied — share it with anyone."); })
          .catch(function () { toast("Link: " + u.toString(), 8000); });
        // Tag the gifter in Kit so the audience team can segment
        // who's actively sharing. mo-kit handles the enqueue; this
        // is fire-and-forget.
        if (window.__kitEmit) window.__kitEmit("gifted_article", { postId: postId });
      })
      .catch(function () { toast("Gift link unavailable. Try again."); })
      .then(function () { btn.disabled = false; });
  });

  function gateInEffect(root) {
    if (!root) return false;
    if ((root.getAttribute("data-post-visibility") || "public") !== "public") return false;
    var days = parseInt(root.getAttribute("data-gate-days"), 10);
    if (!days || days <= 0) return false;
    var pub = Date.parse(root.getAttribute("data-published-at") || "");
    if (isNaN(pub)) return false;
    var gateAt = pub + days * 24 * 60 * 60 * 1000;
    return Date.now() >= gateAt;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error("copy failed"));
      } catch (e) { reject(e); }
    });
  }

  function toast(msg, ttl) {
    var host = document.querySelector(".gift-toast");
    if (!host) {
      host = document.createElement("div");
      host.className = "gift-toast";
      host.setAttribute("role", "status");
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    host.textContent = msg;
    host.classList.add("is-visible");
    clearTimeout(host._hideT);
    host._hideT = setTimeout(function () { host.classList.remove("is-visible"); }, ttl || 3500);
  }
})();
