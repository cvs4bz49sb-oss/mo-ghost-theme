/**
 * Ghost Editor — Subtitle Generator
 *
 * Injects a "✦ Generate subtitle" button into the Ghost post editor's
 * excerpt area. Reads the article body from the editor DOM, calls the
 * mo-admin worker's /generate/subtitle endpoint (Claude), and shows
 * 3 options. Click one to apply it to the excerpt field.
 *
 * Auth: fetches a Ghost members identity JWT from /members/api/session/
 * (same mechanism as the public site's MOAuth). Staff members have
 * both an admin session and a members session on the same domain.
 *
 * Loading: run once per browser session. The MutationObserver keeps
 * the button injected as the SPA navigates between posts.
 *
 *   Bookmarklet — drag to your bookmark bar:
 *     javascript:void(fetch('https://mo-test.ghost.io/assets/js/editor-subtitle.js').then(r=>r.text()).then(eval))
 *
 *   Or paste the minified version directly (see build output).
 */
(function () {
  if (window.__moSubtitleInjected) return;
  window.__moSubtitleInjected = true;

  const ADMIN_WORKER = "https://mo-admin.mo-podcast-feed.workers.dev";

  // ---- Auth: Ghost members JWT (same path as public site's MOAuth) ----

  let cachedToken = null;
  let cachedExp = 0;

  async function getToken() {
    if (cachedToken && Date.now() < cachedExp - 30_000) return cachedToken;
    try {
      const r = await fetch("/members/api/session/", { credentials: "same-origin" });
      if (!r.ok) return null;
      const text = (await r.text()).trim();
      let token = text;
      if (text.startsWith("{")) {
        try {
          const j = JSON.parse(text);
          token = j.identity || j.token || null;
        } catch (_) { token = null; }
      }
      if (!token) return null;
      try {
        const parts = token.split(".");
        const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
        cachedExp = (payload.exp || 0) * 1000;
      } catch (_) {
        cachedExp = Date.now() + 5 * 60_000;
      }
      cachedToken = token;
      return token;
    } catch (_) {
      return null;
    }
  }

  async function authFetch(url, opts) {
    const token = await getToken();
    if (!token) throw new Error("Not signed in as a member. Open the public site and sign in first.");
    const headers = new Headers(opts.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...opts, headers });
  }

  // ---- Worker call ----

  async function generateSubtitles(text, title) {
    const res = await authFetch(`${ADMIN_WORKER}/generate/subtitle`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: text.substring(0, 8000), title, count: 3 }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Worker returned ${res.status}`);
    }
    return res.json();
  }

  // ---- DOM helpers ----

  function getEditorText() {
    // Koenig Lexical: contenteditable div inside the editor pane.
    const selectors = [
      '[data-lexical-editor="true"]',
      ".koenig-lexical [contenteditable]",
      ".gh-koenig-editor [contenteditable]",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 50) {
        return el.innerText.trim();
      }
    }
    return "";
  }

  function getTitle() {
    const el =
      document.querySelector('[placeholder="Post title"]') ||
      document.querySelector(".gh-editor-title") ||
      document.querySelector("textarea.gh-editor-title");
    return el ? (el.value || el.innerText || "").trim() : "";
  }

  function findExcerptField() {
    // Search all textareas for the excerpt placeholder
    for (const ta of document.querySelectorAll("textarea")) {
      const ph = (ta.placeholder || "").toLowerCase();
      if (ph.includes("excerpt")) return ta;
    }
    // Try by label text
    for (const lbl of document.querySelectorAll("label, .gh-expandable-title, h4")) {
      const t = (lbl.textContent || "").trim().toLowerCase();
      if (t === "excerpt" || t === "custom excerpt") {
        const container = lbl.closest(".gh-expandable-block") || lbl.parentElement;
        const ta = container?.querySelector("textarea");
        if (ta) return ta;
      }
    }
    return null;
  }

  // ---- UI ----

  const BTN_ID = "mo-sub-gen";
  const PANEL_ID = "mo-sub-panel";

  function injectButton() {
    if (document.getElementById(BTN_ID)) return;
    const excerpt = findExcerptField();
    if (!excerpt) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.innerHTML = "✦&ensp;Generate subtitle";
    Object.assign(btn.style, {
      display: "inline-block",
      margin: "8px 0 0",
      padding: "5px 11px",
      fontSize: "12px",
      fontWeight: "600",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: "#394047",
      background: "#f1f3f4",
      border: "1px solid #dde1e5",
      borderRadius: "4px",
      cursor: "pointer",
      letterSpacing: "0.01em",
      lineHeight: "1.4",
    });
    btn.onmouseenter = () => (btn.style.background = "#e4e7ea");
    btn.onmouseleave = () => (btn.style.background = "#f1f3f4");
    btn.onclick = onGenerate;

    excerpt.parentNode.insertBefore(btn, excerpt.nextSibling);
  }

  async function onGenerate() {
    const btn = document.getElementById(BTN_ID);
    if (!btn || btn.disabled) return;

    const text = getEditorText();
    if (!text || text.length < 100) {
      flash("Write a few paragraphs first.", true);
      return;
    }

    btn.disabled = true;
    btn.style.opacity = "0.5";
    btn.innerHTML = "Generating…";

    try {
      const { subtitles } = await generateSubtitles(text, getTitle());
      if (!subtitles?.length) throw new Error("No subtitles returned.");
      showOptions(subtitles);
    } catch (err) {
      flash(err.message, true);
    } finally {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.innerHTML = "✦&ensp;Generate subtitle";
    }
  }

  function showOptions(items) {
    removePanel();
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    Object.assign(panel.style, {
      margin: "8px 0",
      border: "1px solid #e4e7ea",
      borderRadius: "4px",
      background: "#fff",
      overflow: "hidden",
    });

    items.forEach((sub, i) => {
      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "flex",
        gap: "8px",
        padding: "8px 10px",
        cursor: "pointer",
        borderTop: i ? "1px solid #f1f3f4" : "none",
        fontSize: "12.5px",
        lineHeight: "1.45",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: "#394047",
      });
      row.onmouseenter = () => (row.style.background = "#f7f8fa");
      row.onmouseleave = () => (row.style.background = "#fff");

      const num = document.createElement("span");
      num.textContent = `${i + 1}`;
      Object.assign(num.style, { color: "#aaa", fontWeight: "600", minWidth: "14px" });

      const txt = document.createElement("span");
      txt.textContent = sub;
      txt.style.flex = "1";

      row.appendChild(num);
      row.appendChild(txt);
      row.onclick = () => applySubtitle(sub);
      panel.appendChild(row);
    });

    const hint = document.createElement("div");
    hint.textContent = "Click an option to apply it";
    Object.assign(hint.style, {
      padding: "4px 10px 6px",
      fontSize: "11px",
      color: "#aaa",
      textAlign: "right",
      borderTop: "1px solid #f1f3f4",
    });
    panel.appendChild(hint);

    const btn = document.getElementById(BTN_ID);
    if (btn) btn.parentNode.insertBefore(panel, btn.nextSibling);
  }

  function applySubtitle(text) {
    const ta = findExcerptField();
    if (!ta) return;
    // Use native setter to trigger React/Ember change detection
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, text);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new Event("change", { bubbles: true }));
    ta.focus();
    ta.dispatchEvent(new Event("blur", { bubbles: true }));
    flash("✓ Applied", false);
  }

  function flash(msg, isError) {
    removePanel();
    const el = document.createElement("div");
    el.id = PANEL_ID;
    Object.assign(el.style, {
      margin: "6px 0",
      padding: "5px 10px",
      fontSize: "12px",
      fontWeight: "600",
      color: isError ? "#c0392b" : "#30a840",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });
    el.textContent = msg;
    const btn = document.getElementById(BTN_ID);
    if (btn) btn.parentNode.insertBefore(el, btn.nextSibling);
    if (!isError) setTimeout(() => el.remove(), 2500);
  }

  function removePanel() {
    const p = document.getElementById(PANEL_ID);
    if (p) p.remove();
  }

  // ---- SPA observer: re-inject when Ghost navigates ----

  let lastHash = "";
  const observer = new MutationObserver(() => {
    const {hash} = location;
    if (hash !== lastHash) {
      lastHash = hash;
      if (hash.includes("/editor/")) {
        // Ghost renders the sidebar lazily; retry a few times
        setTimeout(injectButton, 300);
        setTimeout(injectButton, 1000);
        setTimeout(injectButton, 2500);
      }
    }
    // Also inject if the settings panel just appeared
    if (hash.includes("/editor/") && !document.getElementById(BTN_ID)) {
      injectButton();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Initial injection
  if (location.hash.includes("/editor/")) {
    setTimeout(injectButton, 500);
    setTimeout(injectButton, 1500);
    setTimeout(injectButton, 3000);
  }

  console.log("[MO] Subtitle generator ready.");
})();
