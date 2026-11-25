// MOOS on the web: the in-page adapter (website/moos/WEB.md, piece C).
//
// On mereorthodoxy.com/admin/moos/app/ the host page sets window.MOOS_WEB = { api, workers: { admin, email, site,
// podcast } } and loads this file before MOOS. It defines window.claude = { use } with the parts of the Claude
// artifact runtime MOOS calls, so MOOS runs unchanged:
//   use("db")         the artifact's document store (collection/doc, where/orderBy/limit, get/set/update/delete/add,
//                     onSnapshot), backed by mo-admin's /moos/web/* routes. A collection is read whole the first time
//                     anything asks for it and kept here. One poll of /moos/web/changes every 15 seconds (paused while
//                     the tab is hidden; at once after a write and when the tab comes back) keeps every kept
//                     collection current and fires the listeners. Snapshots have the artifact's shape.
//   use("user")       who is signed in (/moos/web/me), names (/moos/web/profiles) and staff search.
//   use("downloads")  save({ filename, data }) through a Blob link.
//   anything else     null, as the artifact answers a page that can't use it ("desktop" included).
// Every call goes through window.MOAuth.fetch (theme assets/js/admin-auth.js), which adds the Ghost staff bearer.
// mo-admin applies the access rules; nothing here decides who may read or write.
// Without window.MOOS_WEB this file does nothing, so the artifact build is untouched.
(() => {
  const WEB = window.MOOS_WEB;
  if (!WEB || typeof WEB !== "object" || typeof WEB.api !== "string" || !/^https?:\/\//.test(WEB.api)) return;
  const API = WEB.api.replace(/\/+$/, "");
  const POLL_MS = 15000, OVERLAP_MS = 5000, GET_WAIT_MS = 20000;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const enc = encodeURIComponent;

  // ---------------------------------------------------------------- HTTP
  const httpError = (message, status, data) => Object.assign(new Error(message), { status, data });
  async function call(path, { method = "GET", body } = {}) {
    const fetcher = window.MOAuth?.fetch;
    if (typeof fetcher !== "function") throw httpError("Not signed in", 0);
    const init = { method, headers: { Accept: "application/json" } };
    if (body !== undefined) { init.body = JSON.stringify(body); init.headers["Content-Type"] = "application/json"; }
    let res, text;
    try { res = await fetcher(API + path, init); text = await res.text(); }
    catch (e) { throw Object.assign(httpError("Couldn't reach MOOS", 0), { cause: e }); }
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = null; } }
    if (!res.ok) throw httpError(String(data?.error || data?.message || `MOOS answered ${res.status}`), res.status, data);
    noteSkew(data?.now);
    return data;
  }
  // A dropped connection, an expired bearer (MOAuth forgets it on a 401, so the next try fetches a new one) or a
  // server hiccup is worth one more try. Writes here are safe to repeat: set and delete are idempotent, an update is
  // a merge, and add() picks its id before the first try.
  const passing = e => e.status === 0 || e.status === 401 || e.status >= 500;
  async function again(work) {
    try { return await work(); } catch (e) { if (!passing(e)) throw e; await sleep(400 + Math.random() * 400); return work(); }
  }

  // Server time: changes are asked for since a server timestamp, so keep the gap between this clock and the server's
  let skew = null;
  function noteSkew(now) { if (typeof now === "number" && isFinite(now)) skew = now - Date.now(); }
  const serverTime = t => skew == null ? t - 60000 : t + skew;

  // ---------------------------------------------------------------- errors, shaped like the artifact's
  const dbError = (code, message, extra) => Object.assign(new Error(message), { code, ...extra });
  function fromHttp(e) {
    const s = e.status;
    if (s === 409) return dbError("conflict", "Someone changed this first", { status: s, version: e.data?.version ?? null });
    if (s === 507 || e.data?.code === "quota_exceeded") return dbError("quota_exceeded", e.message, { status: s });
    if (s === 429) return dbError("resource_exhausted", e.message, { status: s });
    if (s >= 400 && s < 500 && s !== 401 && s !== 408) return dbError("invalid_argument", e.message, { status: s });
    return dbError("unavailable", e.message, { status: s });
  }

  // ---------------------------------------------------------------- paths
  const SEG = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
  function check(path, isDoc) {
    if (typeof path !== "string") throw new TypeError("A MOOS path must be a string");
    const segs = path.split("/");
    if (segs.length > 16 || path.length > 1000) throw new TypeError(`The path "${path}" is too long`);
    for (const s of segs) if (!SEG.test(s) || s === "." || s === "..") throw new TypeError(`The path "${path}" has a bad segment`);
    if ((segs.length % 2 === 0) !== isDoc) throw new TypeError(`A ${isDoc ? "document" : "collection"} path has ${isDoc ? "an even" : "an odd"} number of segments; "${path}" has ${segs.length}`);
    return path;
  }
  const split = path => { const at = path.lastIndexOf("/"); return [path.slice(0, at), path.slice(at + 1)]; };
  const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(20)), b => ALNUM[b % 62]).join("");

  // ---------------------------------------------------------------- the cache
  // entry: { id, data, version, updated, deleted, pending, local, snap }
  // Documents arrive frozen, as the artifact delivers them.
  function freeze(v) {
    if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); for (const k in v) freeze(v[k]); }
    return v;
  }
  function parse(d) {
    if (typeof d !== "string") return d && typeof d === "object" ? d : {};
    try { const v = JSON.parse(d); return v && typeof v === "object" ? v : {}; } catch { return {}; }
  }
  const fromServer = d => d.deleted
    ? { id: String(d.id), data: undefined, version: +d.version || 0, updated: +d.updated || 0, deleted: true }
    : { id: String(d.id), data: freeze(parse(d.data)), version: +d.version || 0, updated: +d.updated || 0, deleted: false };
  // Versions climb by one on every write to a path, deletes included. A tombstone the nightly sweep dropped can come
  // back at version 1, so a live document newer than a deleted one also wins.
  const newer = (inc, cur) => !cur || inc.version > cur.version || (cur.deleted && !inc.deleted && inc.updated > cur.updated);

  const colls = new Map();
  function C(path) {
    let c = colls.get(path);
    if (!c) colls.set(path, c = { path, docs: new Map(), loaded: false, loading: null, tracked: new Set(), docLoads: new Map(), listeners: new Set(), local: false });
    return c;
  }
  const dirtyColls = new Set();
  let flushing = 0;
  function dirty(path) {
    dirtyColls.add(path);
    if (!flushing) flushing = setTimeout(flush, 0);
  }
  function flush() {
    flushing = 0;
    const list = [...dirtyColls];
    dirtyColls.clear();
    for (const p of list) { const c = colls.get(p); if (c) for (const l of [...c.listeners]) evaluate(c, l); }
  }

  // A whole collection, read once; retried until it answers (a collection this person can't read comes back empty)
  function ensureColl(c) {
    if (c.loaded) return Promise.resolve();
    return c.loading ||= (async () => {
      for (let wait = 1000; ; wait = Math.min(wait * 2, 30000)) {
        const started = Date.now();
        try { ingest(c, await call("/moos/web/docs?coll=" + enc(c.path)), started); return; }
        catch (e) {
          if (e.status === 403 || e.status === 404) { ingest(c, { docs: [] }, started); return; }
          await sleep(wait + Math.random() * 500);
        }
      }
    })();
  }
  function ingest(c, r, started) {
    const seen = new Set();
    for (const d of Array.isArray(r?.docs) ? r.docs : []) {
      if (!d || d.id == null) continue;
      const inc = fromServer(d), cur = c.docs.get(inc.id);
      seen.add(inc.id);
      if (!cur?.pending && newer(inc, cur)) c.docs.set(inc.id, inc);
    }
    for (const [id, cur] of c.docs) if (!seen.has(id) && !cur.pending && !cur.local) c.docs.delete(id);
    c.loaded = true;
    noteRead(typeof r?.now === "number" ? r.now : serverTime(started));
    dirty(c.path);
  }
  // One document of a collection nobody reads whole (config/access, a journey slice): read it alone
  function ensureDoc(c, id) {
    if (c.loaded || c.tracked.has(id)) return Promise.resolve();
    if (c.loading) return c.loading;
    if (!c.docLoads.has(id)) c.docLoads.set(id, (async () => {
      for (let wait = 1000; ; wait = Math.min(wait * 2, 30000)) {
        const started = Date.now();
        try {
          const d = await call("/moos/web/doc?path=" + enc(c.path + "/" + id));
          const inc = fromServer({ ...d, id }), cur = c.docs.get(id);
          if (!cur?.pending && newer(inc, cur)) c.docs.set(id, inc);
        } catch (e) {
          if (e.status !== 403 && e.status !== 404) { await sleep(wait + Math.random() * 500); continue; }
        }
        c.tracked.add(id);
        c.docLoads.delete(id);
        noteRead(serverTime(started));
        dirty(c.path);
        return;
      }
    })());
    return c.docLoads.get(id);
  }
  const ready = (c, id) => c.loaded || (id != null && c.tracked.has(id));
  const live = e => e && !e.deleted ? e : null;

  // ---------------------------------------------------------------- queries
  const rank = v => v === null ? 0 : typeof v === "boolean" ? 1 : typeof v === "number" ? 2 : typeof v === "string" ? 3 : Array.isArray(v) ? 4 : 5;
  function cmp(a, b) {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 2) return a - b;
    if (ra === 1 || ra === 3) return a < b ? -1 : a > b ? 1 : 0;
    const ja = JSON.stringify(a), jb = JSON.stringify(b);
    return ja < jb ? -1 : ja > jb ? 1 : 0;
  }
  const same = (a, b) => a === b || (a !== null && b !== null && typeof a === "object" && typeof b === "object" && JSON.stringify(a) === JSON.stringify(b));
  function test(v, op, b) {
    if (op === "array-contains") return Array.isArray(v) && v.some(x => same(x, b));
    if (v === undefined) return false;
    switch (op) {
      case "==": return same(v, b);
      case "!=": return !same(v, b);
      case "in": return Array.isArray(b) && b.some(x => same(v, x));
      case "not-in": return Array.isArray(b) && !b.some(x => same(v, x));
      case "<": return rank(v) === rank(b) && cmp(v, b) < 0;
      case "<=": return rank(v) === rank(b) && cmp(v, b) <= 0;
      case ">": return rank(v) === rank(b) && cmp(v, b) > 0;
      case ">=": return rank(v) === rank(b) && cmp(v, b) >= 0;
      default: return false;
    }
  }
  const byId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  function run(c, ops) {
    let rows = [];
    for (const e of c.docs.values()) if (!e.deleted) rows.push(e);
    for (const [kind, f, op, v] of ops) if (kind === "where") rows = rows.filter(e => test(e.data[f], op, v));
    const order = ops.find(o => o[0] === "order"), lim = ops.find(o => o[0] === "limit");
    if (order) {
      const [, f, dir] = order, k = dir === "desc" ? -1 : 1;
      rows.sort((a, b) => {
        const x = a.data[f], y = b.data[f];
        if (x === undefined || y === undefined) return (x === undefined) - (y === undefined) || byId(a, b);  // missing sorts last
        return cmp(x, y) * k || byId(a, b);
      });
    } else rows.sort(byId);
    return lim ? rows.slice(0, lim[1]) : rows;
  }

  // ---------------------------------------------------------------- snapshots
  function docSnap(id, e, fromCache) {
    if (e && !fromCache && e.snap) return e.snap;
    const s = Object.freeze({
      id, exists: !!e, data: e ? () => e.data : () => undefined, version: e ? e.version : null,
      metadata: Object.freeze({ fromCache, hasPendingWrites: !!e?.pending }),
    });
    if (e && !fromCache) e.snap = s;
    return s;
  }
  function querySnap(docs, before, fromCache) {
    return Object.freeze({
      docs, size: docs.length, empty: !docs.length,
      metadata: Object.freeze({ fromCache, hasPendingWrites: docs.some(d => d.metadata.hasPendingWrites) }),
      docChanges() {
        const was = new Map((before || []).map((d, i) => [d.id, [d, i]])), now = new Set(), out = [];
        docs.forEach((d, i) => {
          now.add(d.id);
          const b = was.get(d.id);
          if (!b) out.push({ type: "added", doc: d, oldIndex: -1, newIndex: i });
          else if (b[0] !== d || b[1] !== i) out.push({ type: "modified", doc: d, oldIndex: b[1], newIndex: i });
        });
        for (const [id, [d, i]] of was) if (!now.has(id)) out.push({ type: "removed", doc: d, oldIndex: i, newIndex: -1 });
        return out;
      },
    });
  }

  // ---------------------------------------------------------------- listeners
  function evaluate(c, l) {
    if (!l.on) return;
    const isReady = ready(c, l.id);
    if (!isReady && !c.local) return;  // nothing to say before the first read lands, unless this page wrote here
    const fromCache = !isReady;
    if (l.id != null) {
      const e = live(c.docs.get(l.id));
      if (l.delivered && e === l.last && l.fromCache === fromCache) return;
      Object.assign(l, { last: e, delivered: true, fromCache });
      deliver(l, docSnap(l.id, e, fromCache));
    } else {
      const rows = run(c, l.ops);
      if (l.delivered && l.fromCache === fromCache && rows.length === l.last.length && rows.every((r, i) => r === l.last[i])) return;
      const docs = rows.map(e => docSnap(e.id, e, fromCache)), before = l.snaps;
      Object.assign(l, { last: rows, snaps: docs, delivered: true, fromCache });
      deliver(l, querySnap(docs, before, fromCache));
    }
  }
  function deliver(l, snap) {
    try { l.next(snap); } catch (e) { console.error("MOOS web: a listener failed", e); }
  }
  function listen(c, l) {
    Object.assign(l, { on: true, delivered: false, last: null, snaps: null, fromCache: true });
    c.listeners.add(l);
    (l.id != null ? ensureDoc(c, l.id) : ensureColl(c)).then(() => evaluate(c, l));
    return () => { l.on = false; c.listeners.delete(l); };
  }
  function waitFor(promise) {
    let timer;
    return Promise.race([promise, new Promise((_, no) => { timer = setTimeout(() => no(dbError("unavailable", "MOOS can't be reached right now")), GET_WAIT_MS); })])
      .finally(() => clearTimeout(timer));
  }

  // ---------------------------------------------------------------- writes
  // Applied here at once (hasPendingWrites until mo-admin answers), put back if it refuses.
  // No if_version is added for the caller; pass { ifVersion } to pin one. A 409 rejects with code "conflict".
  async function write(op, path, data, opts) {
    const [cp, id] = split(path), c = C(cp), prev = c.docs.get(id);
    let body;
    if (op !== "delete") {
      if (!data || typeof data !== "object" || Array.isArray(data)) throw dbError("invalid_argument", "A document must be an object");
      try { body = JSON.parse(JSON.stringify(data)); } catch { throw dbError("invalid_argument", "A document must be plain JSON"); }
    }
    const base = live(prev);
    let mine = null;
    if (op === "set") mine = { id, data: freeze(body) };  // body is this call's own copy
    else if (op === "update" && base) mine = { id, data: freeze({ ...base.data, ...body }) };
    else if (op === "delete") mine = { id, data: undefined, deleted: true };
    if (mine) {
      Object.assign(mine, { deleted: !!mine.deleted, version: (prev?.version || 0) + 1, updated: prev?.updated || 0, pending: true, local: true });
      c.docs.set(id, mine);
      if (!c.loaded) c.local = true;
      dirty(cp);
    }
    const ifVersion = opts?.ifVersion ?? opts?.if_version;
    const req = { op, path, ...(body !== undefined ? { data: body } : {}), ...(ifVersion != null ? { if_version: ifVersion } : {}) };
    try {
      const r = await again(() => call("/moos/web/write", { method: "POST", body: req }));
      if (mine && c.docs.get(id) === mine) {
        mine.pending = false; mine.snap = null;
        if (typeof r?.version === "number") mine.version = r.version;
      }
      pollSoon();
    } catch (e) {
      if (mine && c.docs.get(id) === mine) { if (prev) c.docs.set(id, prev); else c.docs.delete(id); dirty(cp); }
      throw fromHttp(e);
    }
  }

  // ---------------------------------------------------------------- the poll
  // cursor: the server time of the last poll. A read that lands between polls may be older than it, so the next poll
  // starts from the earliest of the two; every poll also reaches back OVERLAP_MS for writes still landing.
  let cursor = null, earliest = Infinity, timer = 0, polling = false, rerun = false, lastPoll = 0, exact = false;
  function noteRead(t) {
    if (typeof t === "number" && isFinite(t)) earliest = Math.min(earliest, t);
    if (!timer && !polling) schedule(POLL_MS);
  }
  function schedule(ms) {
    clearTimeout(timer); timer = 0;
    if (document.visibilityState === "hidden") return;  // paused; the tab coming back polls at once
    timer = setTimeout(poll, ms);
  }
  const pollSoon = () => polling ? (rerun = true) : schedule(250);
  async function poll() {
    timer = 0;
    if (polling) { rerun = true; return; }
    const from = Math.min(cursor ?? Infinity, earliest);
    if (from === Infinity) return;  // nothing read yet
    earliest = Infinity;
    polling = true;
    try {
      const r = await call("/moos/web/changes?since=" + Math.max(0, Math.floor(exact ? from : from - OVERLAP_MS)));
      exact = false;
      await apply(Array.isArray(r?.changes) ? r.changes : []);
      cursor = typeof r?.now === "number" ? r.now : from;
      // mo-admin's answer can say more (a page stopped at 1,000 rows: ask again from its cursor, without the overlap,
      // so a big hourly push can't repeat itself) or stale (the cursor is older than the 7-day sweep: read again whole)
      if (r?.more) { exact = true; rerun = true; }
      if (r?.stale) for (const c of colls.values()) if (c.loaded) { c.loaded = false; c.loading = null; ensureColl(c); }
    } catch {
      earliest = Math.min(earliest, from);  // ask for the same stretch next time
    } finally {
      polling = false; lastPoll = Date.now();
      if (rerun) { rerun = false; schedule(0); } else schedule(POLL_MS);
    }
  }
  async function apply(changes) {
    const big = [];
    const take = (c, inc) => { const cur = c.docs.get(inc.id); if (!cur?.pending && newer(inc, cur)) { c.docs.set(inc.id, inc); dirty(c.path); } };
    for (const ch of changes) {
      if (!ch || typeof ch.path !== "string" || !ch.path.includes("/")) continue;
      const [cp, id] = split(ch.path), c = colls.get(cp);
      if (!c || !ready(c, id)) continue;  // nobody here reads it
      const cur = c.docs.get(id), inc = { id, version: +ch.version || 0, updated: +ch.updated || 0, deleted: !!ch.deleted };
      if (cur?.pending || !newer(inc, cur)) continue;
      if (inc.deleted) take(c, fromServer({ ...ch, id }));
      else if (ch.data !== undefined && ch.data !== null) take(c, fromServer({ ...ch, id, deleted: false }));
      else big.push([c, id, ch.path]);  // over 64 KB: fetched on its own
    }
    // Fetch the big ones, four at a time, and apply them together so a listener redraws once
    const got = [];
    for (let i = 0; i < big.length; i += 4) {
      await Promise.all(big.slice(i, i + 4).map(async ([c, id, p]) => {
        try { got.push([c, fromServer({ ...(await call("/moos/web/doc?path=" + enc(p))), id })]); }
        catch (e) { if (e.status === 404 || e.status === 403) got.push([c, { id, data: undefined, version: Infinity, updated: 0, deleted: true }]); }
      }));
    }
    for (const [c, inc] of got) {
      if (inc.version === Infinity) { if (!c.docs.get(inc.id)?.pending) { c.docs.delete(inc.id); dirty(c.path); } }
      else take(c, inc);
    }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") schedule(0); else { clearTimeout(timer); timer = 0; } });
  addEventListener("focus", () => { if (Date.now() - lastPoll > 3000) schedule(0); });

  // ---------------------------------------------------------------- db
  function docRef(path) {
    check(path, true);
    const [cp, id] = split(path);
    return Object.freeze({
      id, path,
      async get() { const c = C(cp); await waitFor(ensureDoc(c, id)); return docSnap(id, live(c.docs.get(id)), false); },
      set: (data, opts) => write("set", path, data, opts),
      update: (data, opts) => write("update", path, data, opts),
      delete: opts => write("delete", path, undefined, opts),
      onSnapshot: (next, error) => listen(C(cp), { id, next, error }),
      collection: sub => collRef(path + "/" + sub),
    });
  }
  function query(path, ops) {
    return {
      where: (field, op, value) => Object.freeze(query(path, [...ops, ["where", field, op, value]])),
      orderBy: (field, dir = "asc") => Object.freeze(query(path, [...ops.filter(o => o[0] !== "order"), ["order", field, dir]])),
      limit: n => Object.freeze(query(path, [...ops.filter(o => o[0] !== "limit"), ["limit", Math.max(1, Math.min(1000, Math.floor(n) || 1))]])),
      async get() { const c = C(path); await waitFor(ensureColl(c)); return querySnap(run(c, ops).map(e => docSnap(e.id, e, false)), null, false); },
      onSnapshot: (next, error) => listen(C(path), { ops, next, error }),
    };
  }
  function collRef(path) {
    check(path, false);
    return Object.freeze({
      ...query(path, []), path,
      doc: id => docRef(path + "/" + (id === undefined ? newId() : id)),
      async add(data) { const ref = docRef(path + "/" + newId()); await ref.set(data); return ref; },
    });
  }
  const db = Object.freeze({ doc: docRef, collection: collRef });

  // ---------------------------------------------------------------- user
  const nobody = Object.freeze({ id: null, name: "", email: null, avatarUrl: "", color: "", isOwner: false, canEdit: false, canWrite: false });
  let meJob = null;
  function me() {
    return meJob ||= (async () => {
      for (let i = 0; i < 3; i++) {
        try {
          const r = await call("/moos/web/me");
          return Object.freeze({ id: typeof r?.id === "string" ? r.id : null, name: String(r?.name || ""), email: typeof r?.email === "string" ? r.email : null,
            avatarUrl: "", color: "", isOwner: !!r?.isOwner, canEdit: !!r?.isOwner, canWrite: !!r?.canWrite });
        } catch (e) {
          if (e.status === 403) break;  // not staff: the host page's gate should have stopped this
          await sleep(800 * (i + 1));
        }
      }
      meJob = null;  // ask again next time
      return nobody;
    })();
  }
  const https = u => typeof u === "string" && /^https:\/\//.test(u) ? u : "";
  const profile = (id, p) => ({ id, name: String(p?.name || ""), avatarUrl: https(p?.avatarUrl), color: "", email: null, guest: false, roles: null });
  const known = new Map();  // id -> Promise<profile>, for the page's life (a failed lookup is asked again)
  async function profiles(ids) {
    const list = [...new Set([].concat(ids ?? []).filter(x => typeof x === "string" && x))];
    const want = list.filter(id => !known.has(id));
    for (let i = 0; i < want.length; i += 40) {
      const chunk = want.slice(i, i + 40);
      const job = call("/moos/web/profiles?ids=" + chunk.map(enc).join(",")).catch(() => null);
      for (const id of chunk) known.set(id, job.then(r => { if (!r) known.delete(id); return profile(id, r?.[id]); }));
    }
    const mine = (await me()).id, out = {};
    for (const id of list) out[id] = Object.freeze({ ...(await known.get(id)), isMe: id === mine });
    return out;
  }
  async function search(q) {
    try {
      const r = await call("/moos/web/search?q=" + enc(String(q ?? "")));
      const hits = Array.isArray(r) ? r : Array.isArray(r?.results) ? r.results : Array.isArray(r?.people) ? r.people : [];
      const mine = (await me()).id;
      return hits.filter(x => x && typeof x.id === "string").slice(0, 8)
        .map(x => Object.freeze({ id: x.id, name: String(x.name || ""), email: typeof x.email === "string" ? x.email : null, avatarUrl: https(x.avatarUrl), color: "", isMe: x.id === mine }));
    } catch { return []; }
  }
  const user = Object.freeze({
    me, profiles, search,
    id: async () => (await me()).id,
    isOwner: async () => (await me()).isOwner,
    canEdit: async () => (await me()).canEdit,
    // data.write: owner, or Access gives edit or admin; mo-admin decides every write either way
    can: async name => name === "data.write" ? (await me()).canWrite : null,
  });

  // ---------------------------------------------------------------- downloads
  const TYPES = { csv: "text/csv;charset=utf-8", html: "text/html;charset=utf-8", htm: "text/html;charset=utf-8", json: "application/json", txt: "text/plain;charset=utf-8",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pdf: "application/pdf", png: "image/png", svg: "image/svg+xml" };
  const downloads = Object.freeze({
    async save({ filename, data } = {}) {
      if (typeof filename !== "string" || !filename.trim() || filename.length > 512 || data == null) throw dbError("bad_request", "A download needs a filename and data");
      const name = filename.replace(/[\\/:*?"<>|\x00-\x1f]+/g, "_").trim();
      const ext = (/\.([A-Za-z0-9]{1,5})$/.exec(name)?.[1] || "").toLowerCase();
      const blob = data instanceof Blob ? data : new Blob([data], { type: TYPES[ext] || "application/octet-stream" });
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = name; a.rel = "noopener"; a.hidden = true;
      document.body.append(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
      return { status: "saved" };
    },
  });

  const ns = { db, user, downloads };
  window.claude = Object.freeze({ use: name => Promise.resolve(Object.hasOwn(ns, name) ? ns[name] : null) });
})();
