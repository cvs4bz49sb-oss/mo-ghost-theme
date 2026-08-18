# mo-admin Worker Patch — Homepage Click Heatmap

Apply these changes to the **mo-admin** worker source. They add the
ingest beacon and the two staff-read endpoints behind
`/admin/heatmap/`. Until this patch ships, the theme side is inert:
`heatmap-collect.js` posts into a 404 and the admin page shows
"The mo-admin worker has no /heatmap endpoints yet."

Theme side (already merged): `assets/js/heatmap-collect.js`,
`assets/js/admin-heatmap.js`, `custom-admin-heatmap.hbs`,
`[data-hm-section]` / `[data-hm-goal]` markers in `index.hbs`,
`default.hbs` and the membership/digest partials.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /heatmap/collect | Origin + 120/10min/IP | Ingest a homepage session beacon |
| GET | /heatmap/summary | JWT+staff | Sessions, goals, section funnel, scroll depth, friction |
| GET | /heatmap/points | JWT+staff | Aggregated click grid for the overlay |

---

## 1. Bindings

mo-admin is KV-only today. Click data is row-shaped and needs
aggregation, so it goes to D1 — the existing `mo-membership` database,
which mo-forms and mo-errors already write into for the same reason.

Add to `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "mo-membership"
database_id = "9aa2b78e-b690-4bb2-a5f0-0412c76e522f"
```

Add the retention cron (§6) alongside it:

```toml
[triggers]
crons = ["30 4 * * *"]
```

---

## 2. Schema

Run once against the `mo-membership` D1 database:

```sql
-- One row per homepage session (a browser tab, not a person).
CREATE TABLE IF NOT EXISTS heatmap_sessions (
  sid        TEXT PRIMARY KEY,
  day        TEXT NOT NULL,              -- YYYY-MM-DD, UTC
  device     TEXT NOT NULL,              -- desktop | tablet | mobile
  vw         INTEGER NOT NULL DEFAULT 0,
  vh         INTEGER NOT NULL DEFAULT 0,
  dh         INTEGER NOT NULL DEFAULT 0,
  member     INTEGER NOT NULL DEFAULT 0, -- 1 if signed in. Boolean only.
  ref        TEXT NOT NULL DEFAULT '',   -- referrer HOSTNAME, never a full URL
  dwell_ms   INTEGER NOT NULL DEFAULT 0,
  scroll     INTEGER NOT NULL DEFAULT 0, -- max depth, permille of page height
  clicked    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS heatmap_sessions_day ON heatmap_sessions (day, device);

-- Which sections each session actually reached, and whether it clicked
-- inside them. This is the denominator for the fall-off funnel.
CREATE TABLE IF NOT EXISTS heatmap_section_views (
  sid     TEXT NOT NULL,
  sec     TEXT NOT NULL,
  day     TEXT NOT NULL,
  device  TEXT NOT NULL,
  clicked INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (sid, sec)
);
CREATE INDEX IF NOT EXISTS heatmap_section_views_day ON heatmap_section_views (day, device, sec);

-- Click rollup. Rolled up at write time on a 1% grid within each
-- section, so the table grows with the number of distinct places
-- people click, not with traffic.
CREATE TABLE IF NOT EXISTS heatmap_points (
  day    TEXT NOT NULL,
  device TEXT NOT NULL,
  sec    TEXT NOT NULL,
  gx     INTEGER NOT NULL,               -- 0..100, percent across the section
  gy     INTEGER NOT NULL,               -- 0..100, percent down the section
  goal   TEXT NOT NULL DEFAULT '',
  label  TEXT NOT NULL DEFAULT '',
  sel    TEXT NOT NULL DEFAULT '',
  dead   INTEGER NOT NULL DEFAULT 0,
  rage   INTEGER NOT NULL DEFAULT 0,
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, device, sec, gx, gy, goal, label, dead, rage)
);
CREATE INDEX IF NOT EXISTS heatmap_points_day ON heatmap_points (day, device);
CREATE INDEX IF NOT EXISTS heatmap_points_goal ON heatmap_points (day, device, goal);

-- Distinct sessions per goal, so "180 sessions clicked Become a Member"
-- can't be inflated by one visitor clicking six times.
CREATE TABLE IF NOT EXISTS heatmap_goal_sessions (
  sid    TEXT NOT NULL,
  goal   TEXT NOT NULL,
  day    TEXT NOT NULL,
  device TEXT NOT NULL,
  PRIMARY KEY (sid, goal)
);
CREATE INDEX IF NOT EXISTS heatmap_goal_sessions_day ON heatmap_goal_sessions (day, device, goal);
```

---

## 3. Ingest: `POST /heatmap/collect`

Public, same trust model as the existing slide-in impression pings:
Origin allowlist plus a rate limit. Forged clicks would skew a chart,
not leak anything — the endpoint reads nothing and returns nothing.

The body arrives as `text/plain` because `sendBeacon` with a JSON
content type needs a CORS preflight, and a beacon fired during
`pagehide` has no opportunity to perform one. Parse the text.

**Add this function:**

```js
const HM_ORIGINS = [
  "https://mereorthodoxy.com",
  "https://www.mereorthodoxy.com",
];

const HM_DEVICES = ["desktop", "tablet", "mobile"];
const HM_MAX_BODY = 32 * 1024;
const HM_MAX_CLICKS = 200;
const HM_MAX_SECTIONS = 40;

function hmClamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function hmText(value, max) {
  return String(value == null ? "" : value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .trim()
    .slice(0, max);
}

async function handleHeatmapCollect(request, env, ctx) {
  const origin = request.headers.get("Origin") || "";
  if (!HM_ORIGINS.includes(origin)) return new Response(null, { status: 204 });

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const limited = await rateLimit(env, `hm:${ip}`, 120, 600);
  if (limited) return new Response(null, { status: 204 });

  const raw = await request.text();
  if (!raw || raw.length > HM_MAX_BODY) return new Response(null, { status: 204 });

  let body;
  try { body = JSON.parse(raw); } catch (_) { return new Response(null, { status: 204 }); }
  if (!body || body.v !== 1 || body.path !== "/") return new Response(null, { status: 204 });

  const sid = hmText(body.sid, 32);
  if (!/^[a-f0-9]{8,32}$/.test(sid)) return new Response(null, { status: 204 });

  const device = HM_DEVICES.includes(body.dev) ? body.dev : "desktop";
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const clicks = Array.isArray(body.clicks) ? body.clicks.slice(0, HM_MAX_CLICKS) : [];
  const seen = Array.isArray(body.seen) ? body.seen.slice(0, HM_MAX_SECTIONS) : [];

  const stmts = [];

  // Session row. A session beacons more than once (an early flush at 25
  // clicks, then the final one at pagehide), so later writes must
  // ratchet the aggregates up rather than overwrite them.
  stmts.push(
    env.DB.prepare(
      `INSERT INTO heatmap_sessions
         (sid, day, device, vw, vh, dh, member, ref, dwell_ms, scroll, clicked, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(sid) DO UPDATE SET
         dwell_ms = MAX(dwell_ms, excluded.dwell_ms),
         scroll   = MAX(scroll,   excluded.scroll),
         dh       = MAX(dh,       excluded.dh),
         clicked  = MAX(clicked,  excluded.clicked)`
    ).bind(
      sid, day, device,
      hmClamp(body.vw, 0, 10000, 0),
      hmClamp(body.vh, 0, 10000, 0),
      hmClamp(body.dh, 0, 200000, 0),
      body.mem ? 1 : 0,
      hmText(body.ref, 80),
      hmClamp(body.dwell, 0, 3600000, 0),
      hmClamp(body.scroll, 0, 1000, 0),
      clicks.length ? 1 : 0,
      now.toISOString()
    )
  );

  for (const sec of seen) {
    const key = hmText(sec, 40);
    if (!key) continue;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO heatmap_section_views (sid, sec, day, device, clicked)
         VALUES (?, ?, ?, ?, 0)
         ON CONFLICT(sid, sec) DO NOTHING`
      ).bind(sid, key, day, device)
    );
  }

  const goalsSeen = new Set();

  for (const c of clicks) {
    const sec = hmText(c.s, 40) || "page";
    const gx = Math.round(hmClamp(c.x, 0, 1000, 0) / 10);
    const gy = Math.round(hmClamp(c.y, 0, 1000, 0) / 10);
    const goal = hmText(c.g, 40);
    const label = hmText(c.l, 60);
    const sel = hmText(c.e, 120);
    const dead = c.d ? 1 : 0;
    const rage = c.r ? 1 : 0;

    stmts.push(
      env.DB.prepare(
        `INSERT INTO heatmap_points (day, device, sec, gx, gy, goal, label, sel, dead, rage, n)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(day, device, sec, gx, gy, goal, label, dead, rage)
         DO UPDATE SET n = n + 1`
      ).bind(day, device, sec, gx, gy, goal, label, sel, dead, rage)
    );

    // A click proves the section was seen, even if the observer missed
    // it (bfcache restore, observer not yet attached, JS-disabled edge).
    stmts.push(
      env.DB.prepare(
        `INSERT INTO heatmap_section_views (sid, sec, day, device, clicked)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(sid, sec) DO UPDATE SET clicked = 1`
      ).bind(sid, sec, day, device)
    );

    if (goal && !goalsSeen.has(goal)) {
      goalsSeen.add(goal);
      stmts.push(
        env.DB.prepare(
          `INSERT INTO heatmap_goal_sessions (sid, goal, day, device)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(sid, goal) DO NOTHING`
        ).bind(sid, goal, day, device)
      );
    }
  }

  // Beacons must not block the unloading page on a database round trip.
  ctx.waitUntil(env.DB.batch(stmts).catch(() => {}));
  return new Response(null, { status: 204 });
}
```

**CORS:** add `/heatmap/collect` to the existing OPTIONS handler with
`Access-Control-Allow-Methods: POST` and
`Access-Control-Allow-Headers: content-type`. The beacon itself is a
simple request and skips the preflight; the `fetch(keepalive)` fallback
in the theme does not.

---

## 4. Read: `GET /heatmap/summary`

```js
function hmRange(url) {
  const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get("days") || "30", 10) || 30));
  const device = HM_DEVICES.includes(url.searchParams.get("dev")) ? url.searchParams.get("dev") : "desktop";
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return { days, device, since };
}

async function handleHeatmapSummary(request, env) {
  const err = await assertStaff(request, env);
  if (err) return err;

  const url = new URL(request.url);
  const { days, device, since } = hmRange(url);
  const args = [since, device];

  const [totals, goals, sections, scroll, elements, dead, rage] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS sessions,
              SUM(clicked) AS click_sessions,
              AVG(dwell_ms) AS avg_dwell,
              AVG(scroll) AS avg_scroll
         FROM heatmap_sessions WHERE day >= ? AND device = ?`
    ).bind(...args).first(),

    env.DB.prepare(
      `SELECT p.goal AS goal, SUM(p.n) AS clicks,
              (SELECT COUNT(*) FROM heatmap_goal_sessions g
                WHERE g.goal = p.goal AND g.day >= ? AND g.device = ?) AS sessions
         FROM heatmap_points p
        WHERE p.day >= ? AND p.device = ? AND p.goal <> ''
        GROUP BY p.goal ORDER BY clicks DESC`
    ).bind(since, device, since, device).all(),

    env.DB.prepare(
      `SELECT v.sec AS sec,
              COUNT(*) AS reached,
              SUM(v.clicked) AS click_sessions,
              (SELECT COALESCE(SUM(p.n), 0) FROM heatmap_points p
                WHERE p.sec = v.sec AND p.day >= ? AND p.device = ?) AS clicks
         FROM heatmap_section_views v
        WHERE v.day >= ? AND v.device = ?
        GROUP BY v.sec ORDER BY reached DESC`
    ).bind(since, device, since, device).all(),

    env.DB.prepare(
      `SELECT bucket, COUNT(*) AS sessions FROM (
         SELECT (MIN(scroll, 1000) / 100) * 10 AS bucket FROM heatmap_sessions
          WHERE day >= ? AND device = ?
       ) GROUP BY bucket ORDER BY bucket`
    ).bind(...args).all(),

    env.DB.prepare(
      `SELECT label, sel, sec, goal, SUM(n) AS clicks
         FROM heatmap_points
        WHERE day >= ? AND device = ? AND dead = 0
        GROUP BY label, sec, goal ORDER BY clicks DESC LIMIT 25`
    ).bind(...args).all(),

    env.DB.prepare(
      `SELECT label, sel, sec, SUM(n) AS clicks FROM heatmap_points
        WHERE day >= ? AND device = ? AND dead = 1
        GROUP BY label, sec ORDER BY clicks DESC LIMIT 10`
    ).bind(...args).all(),

    env.DB.prepare(
      `SELECT label, sel, sec, SUM(n) AS clicks FROM heatmap_points
        WHERE day >= ? AND device = ? AND rage = 1
        GROUP BY label, sec ORDER BY clicks DESC LIMIT 5`
    ).bind(...args).all(),
  ]);

  const clickTotal = await env.DB.prepare(
    `SELECT SUM(n) AS clicks, SUM(CASE WHEN dead = 1 THEN n ELSE 0 END) AS dead_clicks
       FROM heatmap_points WHERE day >= ? AND device = ?`
  ).bind(...args).first();

  // Scroll buckets are cumulative to read as a funnel: a session that
  // reached 80% also reached 40%. Grouping alone gives the histogram,
  // which is the wrong shape for a fall-off chart.
  const rawBuckets = (scroll.results || []).map((r) => ({
    bucket: Number(r.bucket) || 0,
    sessions: Number(r.sessions) || 0,
  }));
  const cumulative = [];
  for (let b = 10; b <= 100; b += 10) {
    cumulative.push({
      bucket: b,
      sessions: rawBuckets.reduce((sum, r) => (r.bucket >= b ? sum + r.sessions : sum), 0),
    });
  }

  return json({
    ok: true,
    days,
    device,
    updated: new Date().toISOString(),
    sessions: Number(totals?.sessions) || 0,
    clickSessions: Number(totals?.click_sessions) || 0,
    clicks: Number(clickTotal?.clicks) || 0,
    deadClicks: Number(clickTotal?.dead_clicks) || 0,
    medianDwellMs: Math.round(Number(totals?.avg_dwell) || 0),
    medianScroll: Math.round(Number(totals?.avg_scroll) || 0),
    goals: (goals.results || []).map((r) => ({
      goal: r.goal, clicks: Number(r.clicks) || 0, sessions: Number(r.sessions) || 0,
    })),
    sections: (sections.results || []).map((r) => ({
      sec: r.sec,
      reached: Number(r.reached) || 0,
      clickSessions: Number(r.click_sessions) || 0,
      clicks: Number(r.clicks) || 0,
    })),
    scroll: cumulative,
    elements: (elements.results || []).map((r) => ({
      label: r.label, sel: r.sel, sec: r.sec, goal: r.goal, clicks: Number(r.clicks) || 0,
    })),
    dead: (dead.results || []).map((r) => ({
      label: r.label, sel: r.sel, sec: r.sec, clicks: Number(r.clicks) || 0,
    })),
    rage: (rage.results || []).map((r) => ({
      label: r.label, sel: r.sel, sec: r.sec, clicks: Number(r.clicks) || 0,
    })),
  });
}
```

`medianDwellMs` / `medianScroll` are means in this implementation; the
admin tile labels them "median" because that is the more useful stat.
If it matters, swap in a percentile query — D1 has no `PERCENTILE`, so
it needs an `ORDER BY … LIMIT 1 OFFSET count/2` subquery.

---

## 5. Read: `GET /heatmap/points`

```js
async function handleHeatmapPoints(request, env) {
  const err = await assertStaff(request, env);
  if (err) return err;

  const url = new URL(request.url);
  const { days, device, since } = hmRange(url);
  const kind = ["all", "dead", "rage"].includes(url.searchParams.get("kind"))
    ? url.searchParams.get("kind") : "all";

  const filter = kind === "dead" ? "AND dead = 1" : kind === "rage" ? "AND rage = 1" : "";

  // Collapsed across days and across the label dimension: the overlay
  // needs one weight per grid cell. The label of the busiest variant
  // rides along so the click-count view can name what was clicked.
  const rows = await env.DB.prepare(
    `SELECT sec, gx, gy, SUM(n) AS n,
            (SELECT label FROM heatmap_points q
              WHERE q.day >= ? AND q.device = ? AND q.sec = p.sec
                AND q.gx = p.gx AND q.gy = p.gy
              ORDER BY q.n DESC LIMIT 1) AS label,
            (SELECT goal FROM heatmap_points q
              WHERE q.day >= ? AND q.device = ? AND q.sec = p.sec
                AND q.gx = p.gx AND q.gy = p.gy AND q.goal <> ''
              ORDER BY q.n DESC LIMIT 1) AS goal
       FROM heatmap_points p
      WHERE p.day >= ? AND p.device = ? ${filter}
      GROUP BY sec, gx, gy
      ORDER BY n DESC
      LIMIT 4000`
  ).bind(since, device, since, device, since, device).all();

  const points = (rows.results || []).map((r) => ({
    s: r.sec,
    x: (Number(r.gx) || 0) * 10,   // back to permille for the overlay
    y: (Number(r.gy) || 0) * 10,
    n: Number(r.n) || 0,
    l: r.label || "",
    g: r.goal || "",
  }));

  return json({
    ok: true,
    kind,
    days,
    device,
    max: points.reduce((m, p) => Math.max(m, p.n), 0),
    points,
  });
}
```

The `LIMIT 4000` is a real cap, not a formality: past a few thousand
blobs the overlay stops being readable and starts being a wash of red.
Cells are returned hottest-first, so what gets dropped is the tail.

---

## 6. Routes + retention

Register alongside the existing routes:

```js
if (method === "POST" && path === "/heatmap/collect") return handleHeatmapCollect(request, env, ctx);
if (method === "GET"  && path === "/heatmap/summary") return handleHeatmapSummary(request, env);
if (method === "GET"  && path === "/heatmap/points")  return handleHeatmapPoints(request, env);
```

Add `heatmap: true` to whatever the staff permissions map returns for
`/my-permissions`, so the sidebar can hide the tool from non-marketing
staff. The theme already maps the `heatmap` page id to a `heatmap`
tool in `assets/js/admin-sidebar.js`.

Retention — 120 days, dropped daily by the cron added in §1:

```js
async scheduled(event, env, ctx) {
  const cutoff = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
  ctx.waitUntil(env.DB.batch([
    env.DB.prepare("DELETE FROM heatmap_points WHERE day < ?").bind(cutoff),
    env.DB.prepare("DELETE FROM heatmap_section_views WHERE day < ?").bind(cutoff),
    env.DB.prepare("DELETE FROM heatmap_goal_sessions WHERE day < ?").bind(cutoff),
    env.DB.prepare("DELETE FROM heatmap_sessions WHERE day < ?").bind(cutoff),
  ]).catch(() => {}));
}
```

---

## 7. Framing

`/admin/heatmap/` puts the live homepage in a same-origin iframe. The
mo-headers worker sets `X-Frame-Options` and CSP `frame-ancestors` for
the whole site. Confirm both allow same-origin framing —
`X-Frame-Options: SAMEORIGIN` (not `DENY`) and `frame-ancestors 'self'`.
If they don't, the admin page still renders every table and funnel and
shows a banner where the overlay would be; only the picture is lost.

---

## 8. Verifying after deploy

1. Open the homepage in a normal tab, click a few things, scroll to the
   bottom, then close the tab. The final beacon fires on `pagehide`.
2. `wrangler d1 execute mo-membership --command "SELECT * FROM heatmap_sessions ORDER BY created_at DESC LIMIT 5"`
3. Open `/admin/heatmap/`. The tiles should show at least one session and
   the overlay should put a blob on whatever you clicked.
4. Confirm the frame does **not** record: click inside the preview on the
   admin page, refresh, and check that `heatmap_points` didn't grow.

---

## 9. Page buckets (added 2026-08-18)

The collector originally returned on every URL but `/`. It now records
two buckets, named by the beacon's `page` field rather than its URL:

| Bucket | Matches | Sections |
|--------|---------|----------|
| `home` | pathname `/` | `index.hbs` + `default.hbs` |
| `post` | `post-template` on `<body>` | `post.hbs` + `default.hbs` |

**Articles are bucketed by template, not by URL.** Every essay rolls
into one heatmap. Per-URL would mean thousands of maps holding a handful
of sessions each: useless statistically, and unbounded in storage. The
consequence to keep in mind when reading it is the same one the homepage
already has, only stronger — the map shows where people click *on the
article template*, and the prose under the blobs is whichever essay the
frame happened to load.

### Storage, without a table rebuild

`page` is an additive column on all four tables
(`migrations/heatmap-add-page.sql`). No primary key changed, because two
things make the existing keys sufficient:

1. **Section keys are namespaced on write.** Non-home sections are stored
   as `post:body`, `post:header`, and so on. `header` and `footer` come
   from `default.hbs` and appear on both templates, so without the prefix
   an article's header clicks would land on the homepage's row and become
   unfilterable. The worker strips the prefix on read (`hmStripSec`), so
   the overlay still matches the bare `data-hm-section` attribute.
2. **Session ids are scoped per page view.** `heatmap_sessions` is keyed
   on `sid` alone, and the two session tables on `(sid, sec)` /
   `(sid, goal)`. The collector mixes an FNV hash of the pathname into
   its tab id, so a tab that reads three essays writes three rows rather
   than one row carrying the deepest scroll of the three.

For the `post` bucket this means **"sessions" is article page views**,
which is the denominator the per-template rates want. The homepage
bucket is unchanged: one row per tab.

The tradeoff bought by not rebuilding: a tab's homepage view and its
article view can no longer be joined, so a cross-page funnel ("read an
essay, then hit #join on the homepage") is not answerable from these
tables. Nothing built today asks that question.

### Deploy order

1. `migrations/heatmap-add-page.sql` against mo-membership.
2. mo-admin worker. Every read query carries `AND page = ?`, so deploying
   it before the migration 500s the whole dashboard.
3. Theme. The collector starts sending `page`; the worker drops any
   beacon whose bucket isn't on the allowlist, so an old cached
   collector (no `page` field) is ignored rather than misfiled.

### Range semantics

`days` is now inclusive of today: `1` is today alone, `7` is today plus
the six before it. It previously subtracted N whole days from now, so
`day >= since` spanned N+1 days and "last 7 days" was really 8. Every
range therefore reports very slightly lower than it did before this
change. `day` is a UTC date, so "Today" rolls over at 7pm Central.
