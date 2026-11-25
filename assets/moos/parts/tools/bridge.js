// MOOS module: the Tools bridge. How MOOS reaches the site's admin backend.
//
// Why curl: an artifact page has no network of its own (the runtime blocks fetch to every other
// origin), so MOOS cannot call mo-admin from the page. The installed desktop app can run programs,
// so the bridge runs curl (built into macOS and Windows 10+) through the desktop app's child
// processes. That needs the "full-access" permission, asked on the first Connect. Tools therefore
// work in the installed MOOS app on Mac and Windows and read "unavailable" in a browser, the artifact
// panel and the phone apps.
//
// Auth: Connect asks mo-admin for a pairing (POST /moos/pair/start), shows the person a code and a
// link to mereorthodoxy.com/admin/moos/, where a signed-in Ghost staff member types the code and
// approves. The bridge polls /moos/pair/token and receives a MOOS token: 30 days, revocable, bound to
// the approving staff email. mo-admin and mo-email re-check the live Ghost staff list on every call
// and accept a MOOS token only on the Tools' own routes (workers/_shared/moos-token.js). The token is
// kept in one file in this computer's app-support folder (mode 600 on a Mac), never in the shared
// database, the page source or localStorage, and it is only ever sent to mo-admin and mo-email.
//
// Contract (Tools modules code against exactly this):
//   MOOS.tools.status()          "connected" | "disconnected" | "unavailable"
//   MOOS.tools.connect()         Promise<void>: runs the connect flow, UI included; settles when it ends
//   MOOS.tools.disconnect()      Promise<void>: revokes the token on the site and forgets it here
//   MOOS.tools.onChange(fn)      fn(status) on every change; returns unsubscribe
//   MOOS.tools.api(path, { method = "GET", body, worker = "admin" })
//       The same endpoints, paths and payloads the old admin pages use ("/slide-ins/all").
//       body: an object (sent as JSON), a string, or a FormData (multipart, for /images/upload).
//       worker: "admin" (mo-admin), "email" (mo-email, the Email Builder's /kit/*), "site"
//       (public GETs on mereorthodoxy.com) or "podcast" (public GETs on mo-podcast-feed). The
//       token goes only to admin and email; site and podcast are GET only and get no token.
//       Resolves the parsed JSON (the text when the answer isn't JSON).
//       Rejects an Error carrying { code, message, status } (and `data`, the worker's JSON, when it
//       sent one). code: "unavailable" | "disconnected" | "bad_request" | "unauthorized" |
//       "forbidden" | "not_found" | "conflict" | "rate_limited" | "server" | "network" | "timeout".
//       message is the worker's own `error` text when it gave one. A 401 means the token is gone:
//       the bridge forgets it and the status becomes "disconnected".
//   MOOS.tools.register(id, label, factory, { icon })  = MOOS.addView(id, label, factory, { group: "tools", icon })
//   MOOS.tools.gate(el)          null when connected. Otherwise the shared Connect state: put into el
//                                (when given) and returned. Call it at the top of every paint:
//                                  const paint = () => { if (T.gate(el)) return; ...draw the tool... };
//                                  const off = T.onChange(paint);   // and off() in the view's leave()
// Extras: MOOS.tools.ready (a Promise, settles once the first status is known),
//   MOOS.tools.who() ({ email, expires_at, device } or null), MOOS.tools.chip() (a small
//   "connected as" control with Disconnect, for a tool's header), MOOS.tools.image(url)
//   (a picture from the web as a data: URL for <img src>, since the page can't load one itself).
//
// On the web (mereorthodoxy.com/admin/moos/app/, where the host page sets window.MOOS_WEB; see
// website/moos/WEB.md) the page is already signed in as a Ghost staff member and can reach the
// workers itself, so none of the pairing above runs. Tools are always "connected"; api() calls
// MOAuth.fetch(MOOS_WEB.workers[worker] + path), the admin pages' own helper, which adds the staff
// bearer (admin and email only: site and podcast stay plain GETs with no credentials); a FormData
// body goes up as the admin pages send it (POST /images/upload). gate() is null, chip() shows the
// signed-in email, connect() and disconnect() do nothing, and image(url) answers the https address
// itself, which the page can show. Same return values and error codes as the desktop bridge.
const M = window.MOOS;
const { h, put, icon, toast } = M;
const WEB = window.MOOS_WEB && typeof window.MOOS_WEB === "object" ? window.MOOS_WEB : null;

const WORKERS = {
  admin: { base: "https://mo-admin.mo-podcast-feed.workers.dev", auth: true },
  email: { base: "https://mo-email.mo-podcast-feed.workers.dev", auth: true },
  site: { base: "https://mereorthodoxy.com", auth: false },
  podcast: { base: "https://mo-podcast-feed.mo-podcast-feed.workers.dev", auth: false },
};
const APPROVE_URL = "https://mereorthodoxy.com/admin/moos/";
const TOKEN_RE = /^moos_[A-Za-z0-9_-]{43}$/;
const MARK = "__MOOS_TOOLS__";
const INLINE_BODY_MAX = 60000;  // bigger bodies go through a temp file, not curl's config
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = (code, message, status = 0, data) => Object.assign(new Error(message), { code, status, ...(data !== undefined ? { data } : {}) });

let desktop = null, plat = "", state = "disconnected", isReady = false, cred = null, flow = null, installState = "unavailable", inApp = false;
const subs = new Set();
function set(next) {
  if (next === state) return;
  state = next;
  for (const fn of [...subs]) { try { fn(state); } catch (e) { console.warn("MOOS tools:", e); } }
  paintGates();
}

// ---------------------------------------------------------------- the computer: curl and one file
const curlBin = () => plat === "win32" ? "curl.exe" : "curl";
function run(cmd, args, { input, timeout = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    let out = "", err = "", done = false;
    const p = desktop.childProcess.spawn(cmd, args);
    const end = (res, e) => { if (done) return; done = true; clearTimeout(timer); e ? reject(e) : resolve(res); };
    const timer = setTimeout(() => { p.kill("SIGKILL").catch(() => {}); end(null, fail("timeout", "The site took too long to answer")); }, timeout);
    p.stdout.on("data", c => { out += c; });
    p.stderr.on("data", c => { err += c; });
    p.on("error", e => end(null, e));
    p.on("close", code => end({ code, out, err }));
    (input != null ? p.stdin.write(input).then(() => p.stdin.end()) : p.stdin.end()).catch(e => end(null, e));
  });
}
// curl runs at most six at once; the app has 32 process slots in all
let busy = 0;
const queue = [];
async function slot(work) {
  if (busy >= 6) await new Promise(r => queue.push(r));
  busy++;
  try { return await work(); } finally { busy--; queue.shift()?.(); }
}
// One value in curl's config syntax. Everything variable (URL, token, body) reaches curl on stdin,
// never on its command line, so nothing shows in a process list and nothing is parsed by a shell.
const q = s => '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';

async function tempFile(ext, data, encoding) {
  const dir = (await desktop.os.tmpdir()).replace(/[\\/]+$/, "");
  const sep = plat === "win32" ? "\\" : "/";
  const file = `${dir}${sep}moos-${crypto.randomUUID()}.${ext}`;
  await desktop.fs.writeFile(file, data, encoding);
  return file;
}

async function curl(url, { method = "GET", headers = [], body, form, timeout = 45000 }) {
  const cfg = [`url = ${q(url)}`, `request = ${q(method)}`, ...headers.map(x => `header = ${q(x)}`), `write-out = ${q(`\n${MARK}%{http_code} %{content_type}`)}`];
  const temp = [];
  try {
    if (form) {
      for (const [name, value] of form.entries()) {
        if (!/^[A-Za-z0-9_-]{1,40}$/.test(name)) throw fail("bad_request", "Bad form field");
        if (typeof value === "string") {
          if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw fail("bad_request", "Bad form value");
          cfg.push(`form-string = ${q(`${name}=${value}`)}`);
        }
        else {
          const ext = (/\.([A-Za-z0-9]{1,5})$/.exec(value.name || "")?.[1] || "bin").toLowerCase();
          const file = await tempFile(ext, new Uint8Array(await value.arrayBuffer()));
          temp.push(file);
          const type = /^[\w.+-]+\/[\w.+-]+$/.test(value.type || "") ? `;type=${value.type}` : "";
          cfg.push(`form = ${q(`${name}=@${file}${type}`)}`);
        }
      }
    } else if (body != null) {
      if (body.length > INLINE_BODY_MAX) { const file = await tempFile("json", body, "utf8"); temp.push(file); cfg.push(`data-binary = ${q("@" + file)}`); }
      else cfg.push(`data-raw = ${q(body)}`);
    }
    const args = ["-q", "--silent", "--show-error", "--proto", "=https", "--max-time", String(Math.round(timeout / 1000)), "--config", "-"];
    const r = await slot(() => run(curlBin(), args, { input: cfg.join("\n") + "\n", timeout: timeout + 5000 }));
    const at = r.out.lastIndexOf("\n" + MARK);
    if (r.code !== 0 || at < 0) {
      if (r.code === 28) throw fail("timeout", "The site took too long to answer");
      throw fail("network", r.code === 6 || r.code === 7 ? "This computer can't reach the site right now" : "Couldn't reach the site");
    }
    const [code, ...ct] = r.out.slice(at + 1 + MARK.length).trim().split(" ");
    const text = r.out.slice(0, at), type = ct.join(" ");
    let data = text;
    if (/json/i.test(type) || /^\s*[[{]/.test(text)) { try { data = JSON.parse(text); } catch { data = text; } }
    return { status: Number(code) || 0, data };
  } finally {
    for (const f of temp) desktop.fs.rm(f, { force: true }).catch(() => {});
  }
}

// A picture from the web as a data: URL, since the page can't load one itself. https only, at most
// 8 MB, an image type only; no token is sent. Kept for the session.
const pictures = new Map();
function image(src) {
  let u;
  try { u = new URL(String(src || ""), "https://mereorthodoxy.com/"); } catch { return Promise.reject(fail("bad_request", "Bad image address")); }
  if (u.protocol !== "https:") return Promise.reject(fail("bad_request", "Images must be https"));
  if (WEB) return Promise.resolve(u.href);  // a web page loads https pictures itself
  if (pictures.has(u.href)) return pictures.get(u.href);
  const job = (async () => {
    await ready;
    if (state === "unavailable") throw fail("unavailable", "Tools work in the MOOS app on your computer");
    const dir = (await desktop.os.tmpdir()).replace(/[\\/]+$/, "");
    const file = `${dir}${plat === "win32" ? "\\" : "/"}moos-${crypto.randomUUID()}.img`;
    try {
      const cfg = [`url = ${q(u.href)}`, `output = ${q(file)}`, "max-filesize = 8000000", `header = ${q("Accept: image/*")}`, `write-out = ${q(`${MARK}%{http_code} %{content_type}`)}`];
      const args = ["-q", "--silent", "--show-error", "--proto", "=https", "--proto-redir", "=https", "--location", "--max-redirs", "3", "--max-time", "25", "--config", "-"];
      const r = await slot(() => run(curlBin(), args, { input: cfg.join("\n") + "\n", timeout: 30000 }));
      const at = r.out.lastIndexOf(MARK);
      const [code, type = ""] = at < 0 ? [] : r.out.slice(at + MARK.length).trim().split(/\s+/);
      const mime = type.split(";")[0].toLowerCase();
      if (r.code !== 0 || code !== "200" || !/^image\/(png|jpeg|gif|webp|avif|svg\+xml)$/.test(mime)) throw fail("not_found", "Couldn't load the image");
      return `data:${mime};base64,${await desktop.fs.readFile(file, "base64")}`;
    } finally { desktop.fs.rm(file, { force: true }).catch(() => {}); }
  })();
  pictures.set(u.href, job);
  job.catch(() => pictures.delete(u.href));
  return job;
}

async function where() {
  const dir = plat === "win32" ? "~/AppData/Roaming/MOOS" : plat === "darwin" ? "~/Library/Application Support/MOOS" : "~/.config/moos";
  return { dir, file: `${dir}/tools.json` };
}
async function readCred() {
  try {
    const { file } = await where();
    if (!(await desktop.fs.exists(file))) return null;
    const c = JSON.parse(await desktop.fs.readFile(file, "utf8"));
    if (!TOKEN_RE.test(c?.token || "") || !(Date.parse(c.expires_at) > Date.now())) { await forget(); return null; }
    return c;
  } catch { return null; }
}
async function writeCred(c) {
  const { dir, file } = await where();
  await desktop.fs.mkdir(dir, { recursive: true });
  if (plat !== "win32") {
    // Owner-only before the secret goes in: create empty, chmod, then write (a rewrite keeps the mode)
    const home = (await desktop.os.homedir()).replace(/\/+$/, "");
    const abs = p => home + p.slice(1);
    if (!(await desktop.fs.exists(file))) await desktop.fs.writeFile(file, "", "utf8");
    await run("chmod", ["700", abs(dir)]).catch(() => {});
    const r = await run("chmod", ["600", abs(file)]).catch(() => ({ code: 1 }));
    if (r.code !== 0) throw fail("server", "Couldn't protect the connection file");
  }
  await desktop.fs.writeFile(file, JSON.stringify(c), "utf8");
}
async function forget() {
  cred = null;
  try { const { file } = await where(); await desktop.fs.rm(file, { force: true }); } catch {}
}

// ---------------------------------------------------------------- calls
const CODES = { 400: "bad_request", 401: "unauthorized", 403: "forbidden", 404: "not_found", 409: "conflict", 410: "not_found", 413: "bad_request", 422: "bad_request", 429: "rate_limited" };
const SAYS = { unauthorized: "Connect again to use Tools", forbidden: "The site won't let MOOS do that", not_found: "That isn't on the site anymore", rate_limited: "Too many tries. Wait a minute.", server: "The site had a problem. Try again." };

async function request(worker, path, { method = "GET", body, auth = true, timeout } = {}) {
  const w = WORKERS[worker];
  if (!w) throw fail("bad_request", `No backend named ${worker}`);
  method = String(method || "GET").toUpperCase();
  if (!["GET", "POST", "PUT", "DELETE"].includes(method)) throw fail("bad_request", `Method ${method} isn't allowed`);
  if (!w.auth && method !== "GET") throw fail("bad_request", `The ${worker} backend is read only`);
  if (typeof path !== "string" || path[0] !== "/" || path[1] === "/" || path.length > 4096 || /[\s\x00-\x1f\x7f"\\]/.test(path)) throw fail("bad_request", "Bad path");
  if (WEB) return webRequest(worker, path, { method, body, auth: w.auth && auth, timeout });
  const url = new URL(path, w.base);
  if (url.origin !== new URL(w.base).origin) throw fail("bad_request", "Bad path");
  await ready;
  if (state === "unavailable") throw fail("unavailable", "Tools work in the MOOS app on your computer");
  const headers = ["Accept: application/json", "User-Agent: MOOS-Tools/1"];
  const sendAuth = w.auth && auth;
  if (sendAuth) {
    if (!cred) throw fail("disconnected", "Connect to use Tools");
    headers.push(`Authorization: Bearer ${cred.token}`);
  }
  let text = null, form = null;
  if (body != null && method !== "GET") {
    if (typeof FormData !== "undefined" && body instanceof FormData) form = body;
    else if (typeof body === "string") { text = body; headers.push("Content-Type: application/json"); }
    else { text = JSON.stringify(body); headers.push("Content-Type: application/json"); }
  }
  const res = await curl(url.href, { method, headers, body: text, form, timeout });
  if (sendAuth && res.status === 401 && cred) { await forget(); set("disconnected"); toast("Connect again to use Tools"); }
  return res;
}

// The web: the browser's own fetch, through MOAuth for the workers that take the staff bearer
async function webRequest(worker, path, { method, body, auth, timeout = 45000 }) {
  const base = String(WEB.workers?.[worker] || WORKERS[worker].base).replace(/\/+$/, "");
  let url;
  try { url = new URL(base + path); } catch { throw fail("bad_request", "Bad path"); }
  if (url.origin !== new URL(base).origin || url.protocol !== "https:") throw fail("bad_request", "Bad path");
  if (auth && typeof window.MOAuth?.fetch !== "function") throw fail("unauthorized", SAYS_WEB.unauthorized, 401);
  const headers = { Accept: "application/json" };
  let payload;
  if (body != null && method !== "GET") {
    if (typeof FormData !== "undefined" && body instanceof FormData) payload = body;  // the browser sets the multipart boundary
    else { payload = typeof body === "string" ? body : JSON.stringify(body); headers["Content-Type"] = "application/json"; }
  }
  const once = async () => {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const init = { method, headers, body: payload, signal: ctl.signal };
      const res = auth ? await window.MOAuth.fetch(url.href, init) : await fetch(url.href, { ...init, credentials: "omit" });
      const text = await res.text(), type = res.headers.get("content-type") || "";
      let data = text;
      if (/json/i.test(type) || /^\s*[[{]/.test(text)) { try { data = JSON.parse(text); } catch { data = text; } }
      return { status: res.status, data };
    } catch (e) {
      if (ctl.signal.aborted) throw fail("timeout", "The site took too long to answer");
      throw fail("network", e?.message?.startsWith("MOAuth") ? "MOOS isn't allowed to reach that site" : "Couldn't reach the site");
    } finally { clearTimeout(timer); }
  };
  const res = await once();
  // MOAuth drops a bearer the worker refused; one more try asks the site for a fresh one
  if (auth && res.status === 401) { await sleep(300); return once(); }
  return res;
}
const SAYS_WEB = { ...SAYS, unauthorized: "Sign in to mereorthodoxy.com again to use Tools" };

async function api(path, opts = {}) {
  const { status: s, data } = await request(opts.worker || "admin", path, opts);
  if (s >= 200 && s < 300) return data;
  const code = CODES[s] || (s >= 500 ? "server" : "bad_request");
  const said = data && typeof data === "object" ? data.error || data.message : "";
  throw fail(code, typeof said === "string" && said ? said : (WEB ? SAYS_WEB : SAYS)[code] || `The site answered ${s}`, s, data && typeof data === "object" ? data : undefined);
}

// ---------------------------------------------------------------- connect and disconnect
async function deviceLabel() {
  let name = "";
  try { name = (await desktop.os.hostname()).replace(/\.(local|lan|home)$/i, "").replace(/[-_]+/g, " ").trim(); } catch {}
  return (name || (plat === "win32" ? "Windows PC" : plat === "darwin" ? "Mac" : "Computer")).slice(0, 60);
}
function setFlow(next) { flow = next; paintGates(); }

async function connect() {
  if (WEB) return;
  await ready;
  if (state === "connected") return;
  if (flow?.promise && (flow.step === "starting" || flow.step === "code")) { ensureShown(); return flow.promise; }
  if (state === "unavailable") { setFlow({ step: "unavailable" }); ensureShown(); return; }
  const job = (async () => {
    let perm = await desktop.permissions.state("full-access").catch(() => "unavailable");
    if (perm === "prompt") perm = (await desktop.permissions.request(["full-access"]).catch(() => ({})))["full-access"] || "unavailable";
    if (perm !== "granted") return setFlow({ step: "permission", perm });
    setFlow({ ...flow, step: "starting" });
    let start;
    try {
      const r = await request("admin", "/moos/pair/start", { method: "POST", body: { device: await deviceLabel() }, auth: false, timeout: 20000 });
      if (r.status !== 200 || !/^[A-Z]{8}$/.test(r.data?.user_code || "") || typeof r.data?.device_code !== "string") throw fail(r.status === 429 ? "rate_limited" : "server", "");
      start = r.data;
    } catch (e) { return setFlow({ step: "error", why: e.code }); }
    const mine = { step: "code", code: start.user_code, ttl: start.expires_in || 600, until: Date.now() + (start.expires_in || 600) * 1000, promise: flow?.promise };
    setFlow(mine);
    const every = Math.max(3, start.interval || 4) * 1000;
    let slack = 0;
    while (flow === mine) {
      await sleep(every + slack);
      if (flow !== mine) return;  // cancelled, or a new flow began
      if (Date.now() > mine.until) return setFlow({ step: "expired" });
      let r;
      try { r = await request("admin", "/moos/pair/token", { method: "POST", body: { device_code: start.device_code, user_code: start.user_code }, auth: false, timeout: 20000 }); }
      catch { slack = Math.min(slack + 2000, 10000); continue; }  // a blip: keep waiting
      if (flow !== mine) return;
      if (r.status === 429) { slack = Math.min(slack + 4000, 16000); continue; }
      if (r.status === 202) continue;
      if (r.status === 403 && r.data?.status === "denied") return setFlow({ step: "denied" });
      if (r.status === 410) return setFlow({ step: "expired" });
      if (r.status === 200 && TOKEN_RE.test(r.data?.token || "")) {
        const c = { token: r.data.token, email: String(r.data.email || ""), expires_at: r.data.expires_at, device: await deviceLabel(), connected_at: new Date().toISOString() };
        try { await writeCred(c); } catch { return setFlow({ step: "error", why: "file" }); }
        cred = c;
        setFlow({ step: "done", email: c.email });
        await sleep(M.calm ? 200 : 1500);  // let the line fill and the check land
        flow = null;
        closeSheet();
        set("connected");
        return;
      }
      slack = Math.min(slack + 2000, 10000);
    }
  })().finally(() => { if (flow && flow.step !== "code" && flow.step !== "starting") flow.promise = null; });
  flow = { ...(flow || {}), step: "starting", promise: job };
  paintGates();
  ensureShown();
  return job;
}
function cancel() { flow = null; paintGates(); closeSheet(); }

async function disconnect() {
  if (WEB) return;
  await ready;
  if (!cred) return set(state === "unavailable" ? "unavailable" : "disconnected");
  try { await request("admin", "/moos/token/revoke", { method: "POST", timeout: 15000 }); } catch {}
  await forget();
  set("disconnected");
  toast("Disconnected");
}

// ---------------------------------------------------------------- the gate, the sheet and the chip
const gates = new Set();
function gate(el) {
  if (WEB || state === "connected") return null;
  const g = h("div", { class: "tl-gate" });
  gates.add(g);
  paintGate(g);
  if (el) put(el, g);
  return g;
}
// A gate is painted while it is on the page, or not yet placed; once it has been shown and then
// removed (the tool drew itself, or the person moved on) it is let go.
function paintGates() {
  for (const g of [...gates]) {
    if (g.isConnected || g === sheetBody) { g.seen = true; paintGate(g); }
    else if (g.seen) gates.delete(g);
    else paintGate(g);
  }
}

// MOOS on the left, the site on the right, and the line between them that the code travels
function bridgeArt(phase) {
  const s = (tag, attrs, ...kids) => M.svg(tag, attrs, ...kids);
  const art = s("svg", { class: `tl-art ${phase}`, viewBox: "0 0 360 120", role: "img", "aria-label": phase === "done" ? "Connected" : "MOOS and the site" },
    s("rect", { class: "tl-moos", x: 24, y: 22, width: 76, height: 76, rx: 18 }),
    s("text", { class: "tl-m", x: 57, y: 75 }, "M"),
    s("rect", { class: "tl-dot", x: 77, y: 63, width: 11, height: 11, rx: 1.5 }),
    s("path", { class: "tl-wire", d: "M114 60 H246", pathLength: 100 }),
    s("path", { class: "tl-fill", d: "M114 60 H246", pathLength: 100 }),
    s("circle", { class: "tl-runner", cx: 114, cy: 60, r: 5 }),
    s("g", { class: "tl-site" },
      s("rect", { x: 260, y: 22, width: 76, height: 76, rx: 18 }),
      s("circle", { cx: 298, cy: 60, r: 21 }),
      s("path", { d: "M277 60 H319 M298 39 C288 50 288 70 298 81 M298 39 C308 50 308 70 298 81" })),
    s("g", { class: "tl-ok" }, s("circle", { cx: 180, cy: 60, r: 17 }), s("path", { d: "M172 60.5l5.5 5.5 10.5-11" })));
  return art;
}

function paintGate(g) {
  const step = state === "unavailable" ? "unavailable" : flow?.step || (isReady ? "idle" : "loading");
  if (g.dataset.step === step && step !== "code" && step !== "permission" && step !== "unavailable") return;
  if (g.dataset.step === "code" && step === "code" && g.dataset.code === flow.code) return;
  g.dataset.step = step;
  if (step === "loading") return put(g, h("div", { class: "skel" }));
  const btn = (label, onclick, cls = "btn solid") => h("button", { type: "button", class: cls, onclick }, label);
  const phase = step === "done" ? "done" : step === "code" || step === "starting" ? "live" : "idle";
  const card = (title, ...rest) => h("div", { class: "tl-card card" }, bridgeArt(phase), h("h2", {}, title), ...rest);
  if (step === "unavailable") {
    const can = installState === "available";
    return put(g, card(inApp ? "MOOS can't reach the site from this computer" : installState === "installed" ? "Open the MOOS app to use Tools" : can ? "Tools open in the MOOS app" : "Open MOOS on your computer to use Tools",
      can ? h("div", { class: "tl-acts" }, btn("Install as app", () => desktop?.install?.request().catch(() => {}))) : null));
  }
  if (step === "idle") return put(g, card("Connect to the site", h("div", { class: "tl-acts" }, btn("Connect", () => connect()))));
  if (step === "starting") return put(g, card("Getting a code", h("div", { class: "tl-acts" }, h("span", { class: "tl-wait" }, h("i", { "aria-hidden": "true" }), "One moment"))));
  if (step === "code") {
    g.dataset.code = flow.code;
    const left = Math.max(0, flow.until - Date.now()) / 1000;
    const tiles = h("div", { class: "tl-code", "aria-label": `Code ${flow.code.split("").join(" ")}` },
      [...flow.code].map((c, i) => [i === 4 ? h("span", { class: "tl-dash", "aria-hidden": "true" }) : null, h("span", { class: "tl-tile", style: `--i:${i}`, "aria-hidden": "true" }, c)]));
    return put(g, card("Approve this code on the site", tiles,
      h("div", { class: "tl-ttl", "aria-hidden": "true" }, h("span", { style: `animation-duration:${left}s; --from:${left / flow.ttl}` })),
      h("div", { class: "tl-acts" },
        h("a", { class: "btn solid", href: APPROVE_URL, target: "_blank", rel: "noopener noreferrer" }, "Open mereorthodoxy.com"),
        btn("Copy code", () => M.copy(`${flow.code.slice(0, 4)}-${flow.code.slice(4)}`), "btn quiet")),
      h("div", { class: "tl-foot" }, h("span", { class: "tl-wait", role: "status" }, h("i", { "aria-hidden": "true" }), "Waiting for approval"),
        h("button", { type: "button", class: "plain tl-cancel", onclick: cancel }, "Cancel"))));
  }
  if (step === "done") return put(g, card("Connected", h("p", { class: "tl-who" }, flow.email)));
  if (step === "permission") {
    const denied = flow.perm === "denied";
    return put(g, card(flow.perm === "unavailable" ? "MOOS can't reach the site from this computer" : "Let MOOS reach the site",
      flow.perm === "unavailable" ? null : h("div", { class: "tl-acts" }, btn(denied ? "Open permissions" : "Allow", async () => {
        if (denied) await desktop.permissions.manage().catch(() => {});
        flow = null; connect();
      }))));
  }
  const again = { denied: ["Declined on the site", "Start again"], expired: ["That code expired", "Get a new code"], error: [flow?.why === "rate_limited" ? "Too many tries. Wait a minute." : "Couldn't reach the site", "Try again"] }[step] || ["Couldn't reach the site", "Try again"];
  return put(g, card(again[0], h("div", { class: "tl-acts" }, btn(again[1], () => { flow = null; connect(); }), h("button", { type: "button", class: "plain tl-cancel", onclick: cancel }, "Cancel"))));
}

// When connect() runs with no gate on screen, the flow shows in a sheet over the page
let sheet = null, sheetBody = null;
function ensureShown() {
  if ([...gates].some(g => g.isConnected && g !== sheetBody)) return;
  if (sheet) return;
  sheetBody = h("div", { class: "tl-gate" });
  gates.add(sheetBody);
  sheet = h("div", { class: "tl-scrim", onclick: e => { if (e.target === sheet) cancel(); } },
    h("div", { class: "tl-sheet", role: "dialog", "aria-modal": "true", "aria-label": "Connect to the site" },
      h("button", { type: "button", class: "x tl-close", "aria-label": "Close", onclick: cancel }, icon("x")), sheetBody));
  document.body.append(sheet);
  paintGate(sheetBody);
  sheet.querySelector("a, button.btn")?.focus();
}
function closeSheet() { if (!sheet) return; gates.delete(sheetBody); sheet.remove(); sheet = sheetBody = null; }
addEventListener("keydown", e => { if (e.key === "Escape" && sheet) cancel(); });

function chip() {
  const el = h("div", { class: "tl-chip" });
  if (WEB) {  // signed in on the site: who, and nothing to disconnect
    webWho.then(email => { if (email) put(el, h("span", { class: "tl-live", "aria-hidden": "true" }), h("span", { class: "tl-as" }, email)); });
    return el;
  }
  const paint = () => {
    if (!el.isConnected && el.dataset.drawn) { subs.delete(paint); return; }
    el.dataset.drawn = "1";
    put(el, state === "connected" && cred
      ? [h("span", { class: "tl-live", "aria-hidden": "true" }), h("span", { class: "tl-as" }, cred.email), h("button", { type: "button", class: "plain tl-cancel", onclick: () => disconnect() }, "Disconnect")]
      : null);
  };
  subs.add(paint); paint();
  return el;
}

// ---------------------------------------------------------------- start
// The web: connected from the start; the signed-in email comes from MOOS's own user (GET /moos/web/me)
let webEmail = "";
const webWho = WEB ? Promise.resolve(M.use("user")).then(u => u?.me?.()).then(me => (webEmail = typeof me?.email === "string" ? me.email : "")).catch(() => "") : Promise.resolve("");
const ready = WEB ? (state = "connected", isReady = true, Promise.resolve()) : (async () => {
  try {
    desktop = await M.use("desktop");
    installState = await desktop?.install?.state().catch(() => "unavailable") || "unavailable";
    if (!desktop?.childProcess || !desktop?.permissions || !desktop?.fs) return set("unavailable");
    inApp = true;
    plat = await desktop.os.platform().catch(() => "");
    let perm = await desktop.permissions.state("full-access").catch(() => "unavailable");
    if (perm === "unavailable") { await sleep(2500); perm = await desktop.permissions.state("full-access").catch(() => "unavailable"); }  // still signing in
    if (perm === "unavailable") return set("unavailable");
    if (perm === "granted") cred = await readCred();
    set(cred ? "connected" : "disconnected");
  } catch (e) {
    console.warn("MOOS tools:", e);
    set("unavailable");
  } finally {
    isReady = true;
    paintGates();
  }
})();

M.tools = {
  status: () => state,
  connect, disconnect, api, gate, chip, ready, image,
  onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
  register(id, label, factory, { icon: markup } = {}) { M.addView(id, label, factory, { group: "tools", icon: markup }); },
  who: () => WEB ? (webEmail ? { email: webEmail, expires_at: null, device: "Web" } : null) : cred ? { email: cred.email, expires_at: cred.expires_at, device: cred.device } : null,
};

document.body.append(h("style", {}, `
.tl-gate { display: grid; place-items: center; padding: 8px 0 40px }
.tl-gate .tl-card { width: min(620px, 100%); display: grid; justify-items: center; gap: 22px; padding: 48px 40px 42px; text-align: center }
.tl-card h2 { font-size: 24px }
.tl-art { width: min(340px, 100%); height: auto; overflow: visible }
.tl-moos { fill: var(--ink) }
.tl-m { fill: var(--ground); font: 700 44px var(--serif); text-anchor: middle }
.tl-dot { fill: var(--ring) }
.tl-site rect { fill: var(--card); stroke: var(--rule-strong); stroke-width: 1.5 }
.tl-site circle, .tl-site path { fill: none; stroke: var(--muted); stroke-width: 1.6; stroke-linecap: round }
.tl-wire { fill: none; stroke: var(--rule-strong); stroke-width: 2; stroke-dasharray: 2 6; stroke-linecap: round }
.tl-fill { fill: none; stroke: var(--accent); stroke-width: 3; stroke-linecap: round; stroke-dasharray: 100; stroke-dashoffset: 100; transition: stroke-dashoffset .9s cubic-bezier(.2, .7, .2, 1) }
.tl-runner { fill: var(--accent); opacity: 0 }
.tl-ok { opacity: 0; transform-box: fill-box; transform-origin: center; transform: scale(.4) }
.tl-ok circle { fill: var(--accent) } .tl-ok path { fill: none; stroke: var(--on-accent); stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round }
.tl-art.idle .tl-site { animation: tl-breathe 3.2s ease-in-out infinite }
.tl-art.live .tl-runner { opacity: 1; animation: tl-run 2.2s cubic-bezier(.45, 0, .55, 1) infinite }
.tl-art.live .tl-site rect { stroke: var(--accent) }
.tl-art.done .tl-fill { stroke-dashoffset: 0 }
.tl-art.done .tl-site rect { stroke: var(--accent) } .tl-art.done .tl-site circle, .tl-art.done .tl-site path { stroke: var(--accent) }
.tl-art.done .tl-ok { opacity: 1; transform: scale(1); transition: transform .5s .45s cubic-bezier(.3, 1.6, .5, 1), opacity .2s .45s }
@keyframes tl-run { 0% { transform: translateX(0); opacity: 0 } 12% { opacity: 1 } 88% { opacity: 1 } 100% { transform: translateX(132px); opacity: 0 } }
@keyframes tl-breathe { 50% { opacity: .55 } }
.tl-code { display: flex; align-items: center; gap: 8px; margin-top: 4px }
.tl-tile { display: grid; place-items: center; width: 50px; height: 62px; border: 1px solid var(--rule-strong); border-radius: 6px; background: var(--field); font-size: 30px; letter-spacing: 0; animation: rise .55s cubic-bezier(.2, .7, .2, 1) both; animation-delay: calc(var(--i) * 55ms) }
.tl-dash { width: 12px; height: 2px; margin: 0 4px; background: var(--rule-strong); border-radius: 1px }
.tl-ttl { width: min(300px, 80%); height: 3px; border-radius: 2px; background: color-mix(in srgb, var(--ink) 7%, transparent); overflow: hidden }
.tl-ttl span { display: block; height: 100%; background: var(--accent); transform-origin: left; animation: tl-drain linear forwards }
@keyframes tl-drain { from { transform: scaleX(var(--from, 1)) } to { transform: scaleX(0) } }
.tl-acts { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px }
.tl-foot { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px 26px; color: var(--muted); font-size: 15px }
.tl-wait { display: inline-flex; align-items: center; gap: 10px; color: var(--muted); font-size: 15px }
.tl-wait i { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: beat 1.6s ease-in-out infinite }
.tl-cancel { color: var(--muted); font-size: 15px } .tl-cancel:hover { color: var(--accent) }
.tl-who { margin: -8px 0 0; color: var(--muted) }
.tl-scrim { position: fixed; inset: 0; z-index: 55; display: grid; place-items: center; padding: 20px; background: color-mix(in srgb, var(--ink) 30%, transparent); animation: rise .2s ease-out }
.tl-sheet { position: relative; width: min(640px, 100%); animation: drop .2s ease-out }
.tl-sheet .tl-gate { padding: 0 }
.tl-sheet .tl-card { box-shadow: 0 2px 4px rgba(45, 41, 39, .05), 0 14px 38px rgba(45, 41, 39, .2) }
.tl-close { position: absolute; top: 12px; right: 12px; z-index: 1 }
.tl-chip { display: inline-flex; align-items: center; gap: 10px; font-size: 14px; color: var(--muted); min-width: 0 }
.tl-chip .tl-as { overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.tl-live { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex: none }
@media (max-width: 560px) { .tl-gate .tl-card { padding: 36px 22px 32px } .tl-tile { width: 34px; height: 46px; font-size: 22px } .tl-code { gap: 5px } .tl-dash { width: 8px; margin: 0 2px } }
`));
