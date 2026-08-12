/*
 * Email Builder durable store — makes Cloudflare the source of truth.
 *
 * Why this exists: on 2026-08-12 the builder's ~50 saved versions collapsed to
 * one, and the Ghost key and podcast worker URL were overwritten with empty
 * strings. Everything lived in localStorage and nowhere else, so there was no
 * backup. Root cause was mount-time `useEffect` writes whose React state
 * defaults to "" — opening the page re-wrote the blanks and cemented the loss.
 *
 * Rather than refactor ~100KB of synchronous editor code to async, this keeps
 * localStorage as a CACHE and puts D1 behind it:
 *
 *   boot   — hydrate localStorage from mo-admin before React mounts
 *   write  — every setItem mirrors to mo-admin, debounced
 *   guard  — an empty value is never allowed to overwrite a non-empty one,
 *            locally OR on the server
 *
 * The guard is the actual fix. It is duplicated on the server (isMeaningful in
 * workers/admin/lib/digest-store.js) because a client-side guard is precisely
 * what failed here; this copy exists to stop the bad write at the source, and
 * the server copy exists because clients cannot be trusted to.
 *
 * Load order matters: this must run AFTER admin-auth.js (it needs
 * window.MOAuth.fetch to attach the staff token) and BEFORE app.js mounts.
 * See custom-digest-gen.hbs.
 */
(function () {
  "use strict";

  var DOC_KEY = "mo:content";
  var HISTORY_KEY = "mo:content:history";

  // Everything else the builder persists. Each is stored as its own row
  // server-side, so a write to one can never blank another.
  var SETTING_KEYS = [
    "mo_ghost_url",
    "mo_podcast_worker",
    "mo_podcast_shows",
    "mo:exportTarget",
    "mo:exportImageMode",
    "mo:exportImageOverrides",
    "mo:exportImageBaseUrl",
    "mo:kit:prefs",
    "mo:kit:draftId:free",
    "mo:kit:draftId:paid",
    "mo:sponsorLibrary",
    "mo:blockLibrary",
    "mo:ctaLibrary",
    "mo_content_calendar"
  ];

  var MIRRORED = SETTING_KEYS.concat([DOC_KEY, HISTORY_KEY]);
  var DEBOUNCE_MS = 1200;

  var nativeSetItem = Storage.prototype.setItem;
  var nativeGetItem = Storage.prototype.getItem;
  var pending = {};
  var timers = {};

  /*
   * window.MODigestRoot is the accessor object published by
   * digest-bootstrap.js, NOT a DOM element — it exposes .url(name). Reading
   * it as an element throws, and because that throw happened synchronously
   * inside ready() it prevented React from mounting at all. Falls back to the
   * element only if the accessor is absent.
   */
  function workerBase() {
    try {
      if (window.MODigestRoot && typeof window.MODigestRoot.url === "function") {
        return (window.MODigestRoot.url("workerUrl") || "").replace(/\/+$/, "");
      }
      var el = document.getElementById("mo-digest-root") || document.getElementById("root");
      if (el && typeof el.getAttribute === "function") {
        return (el.getAttribute("data-worker-url") || "").replace(/\/+$/, "");
      }
    } catch (e) {
      console.warn("[digest-store] could not resolve worker URL", e);
    }
    return "";
  }

  /*
   * Mirrors isMeaningful() in workers/admin/lib/digest-store.js. Rejects the
   * exact shapes the editor's state defaults to before its data loads: "",
   * "null", "undefined", [], {}.
   */
  function isMeaningful(raw) {
    if (raw === null || raw === undefined) return false;
    var s = String(raw).trim();
    if (s === "" || s === "null" || s === "undefined") return false;
    if (s === "[]" || s === "{}") return false;
    if (s === '""') return false;
    return true;
  }

  function parse(raw) {
    try { return JSON.parse(raw); } catch (e) { return raw; }
  }

  function post(path, body) {
    var base = workerBase();
    if (!base || !window.MOAuth || !window.MOAuth.fetch) return Promise.resolve(null);
    return window.MOAuth.fetch(base + path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).catch(function (e) { console.warn("[digest-store] mirror failed", path, e); return null; });
  }

  function flush(key) {
    var raw = pending[key];
    delete pending[key];
    if (raw === undefined) return;

    if (key === DOC_KEY) {
      post("/digest/document", { content: parse(raw) });
      return;
    }
    if (key === HISTORY_KEY) {
      // History is stored server-side as rows, so the array is not pushed
      // wholesale. app.jsx prepends the newest entry, so mirror just that one
      // as a new version. Deletions go through MODigestStore.deleteVersion.
      var arr = parse(raw);
      if (!Array.isArray(arr) || !arr.length) return;
      var newest = arr[0];
      if (!newest || !newest.content) return;
      if (newest.__synced) return;
      newest.__synced = true;
      var base = workerBase();
      if (!base || !window.MOAuth || !window.MOAuth.fetch) return;
      window.MOAuth.fetch(base + "/digest/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newest.content, label: newest.label || null })
      }).catch(function (e) { console.warn("[digest-store] version mirror failed", e); });
      return;
    }
    var settings = {};
    settings[key] = parse(raw);
    post("/digest/settings", { settings: settings });
  }

  function queue(key, raw) {
    pending[key] = raw;
    clearTimeout(timers[key]);
    timers[key] = setTimeout(function () { flush(key); }, DEBOUNCE_MS);
  }

  // ------------------------------------------------------------------
  // The guard + mirror
  // ------------------------------------------------------------------
  Storage.prototype.setItem = function (key, value) {
    if (this === window.localStorage && MIRRORED.indexOf(key) !== -1) {
      var existing = nativeGetItem.call(this, key);
      // The bug, stopped at the source: never let a blank overwrite real data.
      if (!isMeaningful(value) && isMeaningful(existing)) {
        console.warn("[digest-store] refused to overwrite " + key + " with an empty value");
        return;
      }
      nativeSetItem.call(this, key, value);
      queue(key, value);
      return;
    }
    return nativeSetItem.call(this, key, value);
  };

  // ------------------------------------------------------------------
  // Boot hydration
  // ------------------------------------------------------------------
  function hydrate() {
    var base = workerBase();
    if (!base || !window.MOAuth || !window.MOAuth.fetch) {
      console.warn("[digest-store] no worker URL or auth; running local-only");
      return Promise.resolve({ ok: false });
    }
    var get = function (path) {
      return window.MOAuth.fetch(base + path)
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    };

    return Promise.all([
      get("/digest/settings"),
      get("/digest/document"),
      get("/digest/versions?full=1&limit=25")
    ]).then(function (res) {
      var settings = res[0] && res[0].settings;
      var doc = res[1] && res[1].content;
      var versions = res[2] && res[2].versions;

      // Written with the native setter so hydration is never mistaken for a
      // user edit and mirrored straight back to the server.
      if (settings) {
        Object.keys(settings).forEach(function (k) {
          var v = settings[k];
          var raw = typeof v === "string" ? v : JSON.stringify(v);
          if (isMeaningful(raw)) nativeSetItem.call(localStorage, k, raw);
        });
      }
      if (doc) nativeSetItem.call(localStorage, DOC_KEY, JSON.stringify(doc));
      if (versions && versions.length) {
        var hist = versions.map(function (v) {
          return {
            id: "v_" + v.id,
            serverId: v.id,
            savedAt: v.savedAt ? Date.parse(v.savedAt + "Z") || Date.parse(v.savedAt) : Date.now(),
            content: v.content,
            __synced: true
          };
        });
        nativeSetItem.call(localStorage, HISTORY_KEY, JSON.stringify(hist));
      }
      return { ok: true, settings: settings ? Object.keys(settings).length : 0, versions: versions ? versions.length : 0 };
    });
  }

  /*
   * One-time upward migration: whatever is in this browser right now predates
   * the server store, so push it up before the first hydrate overwrites it.
   * Only ever sends meaningful values, so a browser that was already wiped
   * cannot push blanks over good server data.
   */
  function seedFromLocal() {
    var base = workerBase();
    if (!base || !window.MOAuth || !window.MOAuth.fetch) return Promise.resolve(null);
    var settings = {};
    SETTING_KEYS.forEach(function (k) {
      var raw = nativeGetItem.call(localStorage, k);
      if (isMeaningful(raw)) settings[k] = parse(raw);
    });
    var jobs = [];
    if (Object.keys(settings).length) jobs.push(post("/digest/settings", { settings: settings }));

    var doc = nativeGetItem.call(localStorage, DOC_KEY);
    if (isMeaningful(doc)) jobs.push(post("/digest/document", { content: parse(doc) }));

    var hist = parse(nativeGetItem.call(localStorage, HISTORY_KEY) || "[]");
    if (Array.isArray(hist)) {
      hist.slice(0, 25).reverse().forEach(function (h) {
        if (!h || !h.content) return;
        jobs.push(window.MOAuth.fetch(base + "/digest/versions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: h.content, label: h.label || null })
        }).catch(function () { return null; }));
      });
    }
    return Promise.all(jobs);
  }

  window.MODigestStore = {
    hydrate: hydrate,
    seedFromLocal: seedFromLocal,
    isMeaningful: isMeaningful,
    deleteVersion: function (serverId) {
      var base = workerBase();
      if (!base || !serverId || !window.MOAuth) return Promise.resolve(null);
      return window.MOAuth.fetch(base + "/digest/versions/" + serverId, { method: "DELETE" })
        .catch(function () { return null; });
    },
    /*
     * Called by app.jsx instead of mounting directly. Seeds this browser's
     * state upward on first run, then hydrates back down, then mounts. If any
     * of it fails the app still mounts against whatever localStorage holds,
     * because a broken network should degrade the builder, not blank the page.
     */
    ready: function () {
      // Everything here is wrapped so that NOTHING — including a synchronous
      // throw — can stop the caller from mounting. An earlier version threw
      // synchronously out of seedFromLocal(), which meant app.jsx's
      // .then(mount, mount) never attached and the builder rendered nothing
      // at all. A storage problem must degrade the builder, never blank it.
      try {
        var SEEDED = "mo:digest:seeded";
        var first = !nativeGetItem.call(localStorage, SEEDED);
        var chain = first
          ? Promise.resolve()
              .then(seedFromLocal)
              .then(function () { nativeSetItem.call(localStorage, SEEDED, "1"); })
          : Promise.resolve();
        return chain
          .then(hydrate)
          .catch(function (e) {
            console.warn("[digest-store] sync failed, using local cache", e);
            return { ok: false };
          });
      } catch (e) {
        console.warn("[digest-store] sync threw, using local cache", e);
        return Promise.resolve({ ok: false });
      }
    }
  };
})();
