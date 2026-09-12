/* Browser-local Ask history, using the same IndexedDB store as the full Ask port. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MOFaithAskHistory = api;
})(typeof globalThis === "undefined" ? this : globalThis, () => {
  "use strict";
  function create(store) {
    if (!store) throw new Error("Question storage is unavailable. Reload before asking.");
    return {
      async begin(question, scope) {
        const id = store.id(), turnId = store.id(), now = Date.now();
        await store.put({ id, t: question.slice(0, 120), ts: now, mode: "ask", archived: false,
          scope: { works: [], shelves: scope.traditions || [] }, mereoScope: scope,
          turns: [{ id: turnId, q: question, a: "", src: [], mode: "ask", status: "running", ts: now }] });
        await store.setMeta("active-conversation", id);
        return id;
      },
      async complete(id, result) {
        await store.update(id, record => {
          const turn = record.turns[0];
          turn.a = String(result.answer || ""); turn.status = "complete";
          turn.mereo = { ...result, question: turn.q };
          turn.src = (result.citations || []).map(c => ({ cit: String(c.n), title: c.cit || c.doc || "Source", link: c.url || "", author: c.author || "" }));
          record.ts = Date.now();
        });
      },
      async fail(id, message) {
        if (!id) return;
        await store.update(id, record => { const t = record.turns[0]; if (t.status === "running") { t.status = "interrupted"; t.error = message || "This question did not finish. You can retry it."; } });
      },
      async list(query = "") {
        const q = query.trim().toLowerCase();
        return (await store.all()).filter(c => !c.archived && c.turns?.length && (!q || (`${c.t} ${c.turns.map(t => t.q).join(" ")}`).toLowerCase().includes(q))).sort((a, b) => (b.ts || 0) - (a.ts || 0));
      },
      async restore(id) {
        const record = await store.get(id);
        if (!record?.turns?.length) return null;
        await store.setMeta("active-conversation", id);
        const turn = record.turns.at(-1);
        const citations = (turn.src || []).map((s, i) => ({ n: i + 1, cit: s.title || s.t || s.cit || s.slug || "Source", url: s.link || (s.slug ? `/the-faith-received/read/?w=${encodeURIComponent(s.slug)}${s.page == null ? "" : `#b${encodeURIComponent(s.page)}-0`}` : "") }));
        let answer = turn.a || "";
        (turn.src || []).forEach((s, i) => { if (s.slug && s.page != null) answer = answer.split(`[${s.slug}/p${s.page}]`).join(`[${i + 1}]`); });
        return { record, status: turn.status, error: turn.error, result: turn.mereo || { question: turn.q, answer, citations, works: [], gaps: [] } };
      },
      async latest() { return (await store.meta("active-conversation"))?.value; },
    };
  }
  function mount({ store, onRestore, isBusy = () => false, canAutoRestore = () => true }) {
    const history = create(store), list = document.querySelector("[data-ask-history-list]"), filter = document.querySelector("[data-ask-history-search]"), note = document.querySelector("[data-ask-save-state]");
    let timer;
    const rememberURL = id => { const u = new URL(location.href); u.searchParams.set("chat", id); window.history.replaceState(window.history.state, "", u); };
    const activate = async id => { const saved = await history.restore(id); if (saved) { rememberURL(id); onRestore(saved); } };
    const message = text => { if (note) note.textContent = text; };
    async function refresh() {
      if (!list) return;
      const records = await history.list(filter?.value || ""); list.replaceChildren();
      records.slice(0, 50).forEach(c => {
        const li = document.createElement("li"), button = document.createElement("button");
        button.type = "button"; button.textContent = c.t || c.turns[0].q;
        button.addEventListener("click", async () => {
          if (isBusy()) { message("Wait for the current answer before opening another saved question."); return; }
          await activate(c.id);
        }); li.appendChild(button); list.appendChild(li);
      });
      if (!records.length) { const li = document.createElement("li"); li.textContent = "No saved questions yet."; list.appendChild(li); }
      if (records.length > 50) { const li = document.createElement("li"); li.textContent = "Showing the 50 most recent. Search to find an older question."; list.appendChild(li); }
    }
    if (filter) filter.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => refresh().catch(() => message("Saved questions could not be loaded.")), 150); });
    refresh().then(async () => { const requested = new URLSearchParams(location.search).get("chat"), id = requested || await history.latest(); if (id && !isBusy() && (requested || canAutoRestore())) await activate(id); }).catch(() => message("Saved questions could not be loaded. Enable browser storage and reload."));
    return { ...history, refresh, message, async begin(question, scope) { const id = await history.begin(question, scope); rememberURL(id); return id; } };
  }
  return { create, mount };
});
