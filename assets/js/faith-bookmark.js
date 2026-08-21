/*
 * Bookmark a work in The Faith Received.
 *
 * Reuses the mo-kit bookmark store that already backs article
 * bookmarks. Ids are namespaced "tfr:<corpus>:<slug>", which needs no
 * worker change: /bookmarks/add and /bookmarks/remove take the id as
 * an opaque string, and /bookmarks?ids_only=1 hands them back raw.
 *
 * The enriched /bookmarks list resolves ids against Ghost and drops
 * what it does not recognise, so a TFR bookmark never appears in the
 * article list and never breaks it. The dashboard's Faith Received
 * section reads the raw ids instead and resolves them against the
 * catalogues.
 *
 * The 200-bookmark cap in the worker is shared with article
 * bookmarks.
 */
(function () {
  const host = document.querySelector("[data-faith-controls]");
  const content = document.querySelector("[data-fr-content]");
  if (!host || !content) return;

  const body = document.body;
  const WORKER = (body.getAttribute("data-kit-worker-url") || "").replace(/\/$/, "");
  const status = body.getAttribute("data-member-status") || "";
  const paid = status === "paid" || status === "comped";

  let slug = "";
  let corpusId = "tfr";
  try {
    const q = new URLSearchParams(window.location.search);
    slug = (q.get("w") || "").replace(/[^a-z0-9_-]/gi, "");
    corpusId = (q.get("c") || "tfr").replace(/[^a-z0-9_-]/gi, "");
  } catch (_) { /* no query */ }
  if (!slug) return;

  const id = `tfr:${corpusId}:${slug}`;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "faith-tool faith-bookmark";
  btn.setAttribute("aria-pressed", "false");
  const label = document.createElement("span");
  label.className = "faith-toggle-label";
  label.textContent = "Save";
  btn.appendChild(label);

  const state = { on: false, busy: false };

  function paint() {
    btn.setAttribute("aria-pressed", state.on ? "true" : "false");
    label.textContent = state.on ? "Saved" : "Save";
    btn.title = state.on
      ? "Remove this work from your dashboard"
      : "Save this work to your dashboard";
  }

  // Not a member: the button still shows, because hiding it hides the
  // feature. It goes to the membership page rather than failing.
  if (!paid || !WORKER || !window.MOAuth) {
    btn.addEventListener("click", () => {
      // eslint-disable-next-line no-restricted-syntax -- same-origin path literal
      window.location.href = "/membership/";
    });
    paint();
    host.appendChild(btn);
    return;
  }

  window.MOAuth.fetch(`${WORKER}/bookmarks?ids_only=1`, {
    method: "GET", mode: "cors", credentials: "omit",
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const ids = (data && data.postIds) || [];
      state.on = ids.indexOf(id) !== -1;
      paint();
    })
    .catch(() => { /* silent; the button starts unsaved */ });

  btn.addEventListener("click", () => {
    if (state.busy) return;
    state.busy = true;
    const next = !state.on;
    // Optimistic, then reconciled: a save should feel instant even on
    // a slow connection, and the only cost of being wrong is a button
    // that flips back.
    state.on = next;
    paint();
    window.MOAuth.fetch(`${WORKER}/bookmarks/${next ? "add" : "remove"}`, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: id }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`bookmark ${r.status}`);
      })
      .catch(() => {
        state.on = !next;
        paint();
      })
      .then(() => { state.busy = false; });
  });

  paint();
  host.appendChild(btn);
})();
