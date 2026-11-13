/*
 * The Faith Received — which WORKS are bookmarked.
 *
 * EXTRACTED from assets/js/faith-bookmark.js, which until now was the
 * only thing on the site that could bookmark a work and could only do
 * it from inside the reader: it bound to [data-faith-controls], which
 * exists on the reader page and nowhere else. Three surfaces now write
 * the same bookmark — the reader's Save button, the Bookmark button at
 * the foot of a section, and the rows on the browse, author, room and
 * century pages — and three copies of "POST /bookmarks/add" is how the
 * same reader ends up with two records of the same work.
 *
 * "Notebook saves the text and bookmarks saves the place." This file
 * owns the coarsest place there is: the work itself. Where in it is
 * assets/js/lib/faith-position-store.js, and the passage is
 * assets/js/lib/faith-notebook-store.js. A section bookmark is a work
 * bookmark plus a mark, which is why bookmarking from a list row and
 * then bookmarking a section inside that work cannot produce two
 * competing records: they write the same id here, and only the second
 * adds anything there.
 *
 * WHERE THEY LIVE. The mo-kit Worker's KV, the same store that backs
 * article bookmarks, under `bookmarks:<member email>`:
 *
 *   [ { postId: "tfr:<corpus>:<work id>", savedAt: ISO }, … ]
 *
 * Per MEMBER rather than per browser, so it needs MOAuth and it follows
 * the reader between devices. The ids are namespaced "tfr:" and are
 * opaque to the worker: /bookmarks/add and /bookmarks/remove take the
 * id as a string and /bookmarks?ids_only=1 hands them back raw. The
 * enriched /bookmarks list resolves ids against Ghost and drops what it
 * does not recognise, so a TFR bookmark never appears in the article
 * list and never breaks it. The 200-bookmark cap is shared with article
 * bookmarks.
 *
 * ONE FETCH PER PAGE. ready() caches its promise. A browse page can
 * carry two hundred rows, and two hundred rows each asking "am I
 * bookmarked?" would be two hundred requests for one answer.
 *
 * OPTIMISTIC, THEN RECONCILED. set() flips the local set and paints
 * before the worker answers, then puts it back if the write failed.
 * Every subscriber is notified both times, so a row, the reader's Save
 * button and a section button on the same page never disagree.
 */
(function () {
  "use strict";

  const { body } = document;
  const WORKER = (body.getAttribute("data-kit-worker-url") || "").replace(/\/$/, "");
  const status = body.getAttribute("data-member-status") || "";
  const paid = status === "paid" || status === "comped" || status === "gift";
  /* Who may keep a work. Saving is one of the research tools, so it
     follows the same tier as the rest of them: an account during the
     beta, a membership after it. Before 2026-09-22 this was paid-only
     while Ask, search and Compare were open to any signed-in member,
     which meant a free member could ask the library a question and then
     could not keep the work the answer sent them to.

     The constant is declared once, in assets/js/boot/tfr-tier.js. */
  const signedIn = status === "paid" || status === "comped" || status === "gift" || status === "free";
  const beta = window.MO_TFR_BETA_OPEN_TO_ALL_MEMBERS !== false;
  const allowed = beta ? signedIn : paid;

  // The one place the id is shaped. Mirrors readerUrlFor()'s vocabulary
  // in website/workers/tfr-library/lib/collections.js: the corpus is
  // whatever the URL called it, defaulting to "tfr".
  function idFor(corpus, work) {
    const c = String(corpus || "tfr").replace(/[^a-z0-9_-]/gi, "") || "tfr";
    const w = String(work || "");
    return w ? `tfr:${c}:${w}` : "";
  }

  // "tfr:pld:2741" -> { corpus: "pld", work: "2741" }. A work id can
  // itself contain a colon, so everything after the second one is the
  // work. Same rule as assets/js/page/faith-bookmarks.js.
  function parseId(id) {
    const parts = String(id || "").split(":");
    if (parts[0] !== "tfr") return null;
    const work = parts.slice(2).join(":");
    return work ? { corpus: parts[1] || "tfr", work } : null;
  }

  // Configured AND allowed. A signed-out visitor and a site with no
  // worker both produce "no bookmarks", and every surface has to be
  // able to tell them apart before it decides what to say.
  function available() {
    return !!(allowed && WORKER && window.MOAuth);
  }

  const ids = new Set();
  const aliases = new Map();
  let loaded = false;
  let pending = null;
  const listeners = [];

  // Resolves to the set of bookmarked ids, or to an empty set where
  // bookmarks are not available. Rejects only on a genuine read
  // failure, so a caller can tell "you have none" from "we could not
  // ask" and neither is silently painted as the other.
  function ready() {
    if (pending) return pending;
    if (!available()) {
      loaded = true;
      pending = Promise.resolve(ids);
      return pending;
    }
    pending = window.MOAuth.fetch(`${WORKER}/bookmarks?ids_only=1`, {
      method: "GET", mode: "cors", credentials: "omit",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`bookmarks ${r.status}`);
        return r.json();
      })
      .then((data) => {
        ((data && data.postIds) || []).forEach((raw) => {
          if (/^tfr:/.test(String(raw))) ids.add(String(raw));
        });
        // A RETIRED work saved under its old id counts as saved on the
        // copy that replaced it (lib/faith-work-forwards.js, loaded by
        // the pages that have it). The old id is remembered so that
        // un-saving the new copy removes it too.
        const FWD = window.MOWorkForwards;
        if (FWD) {
          [...ids].forEach((raw) => {
            const now = FWD.savedId(raw);
            if (!now || now === raw) return;
            ids.add(now);
            if (!aliases.has(now)) aliases.set(now, []);
            aliases.get(now).push(raw);
          });
        }
        loaded = true;
        return ids;
      })
      .catch((err) => {
        // A failed read is not an empty shelf. The promise is cleared
        // so a later surface can try again, and `loaded` stays false so
        // has() keeps answering "I do not know yet".
        pending = null;
        throw err;
      });
    return pending;
  }

  // Three answers, not two: true, false, and null for "not read yet".
  // A button that paints "not bookmarked" before the answer arrives
  // teaches a reader that their bookmark was lost.
  function has(id) {
    if (!loaded) return null;
    return ids.has(String(id));
  }

  function notify(id, on) {
    listeners.forEach((fn) => {
      try { fn(id, on); } catch (_) { /* one bad listener is not the others' problem */ }
    });
  }

  function subscribe(fn) {
    if (typeof fn === "function") listeners.push(fn);
  }

  // Resolves true where the work is bookmarked afterwards. Rejects
  // where the write failed, having already put the local state back, so
  // a caller can say so out loud rather than leaving a button that
  // looks saved and is not.
  function set(id, on) {
    const key = String(id || "");
    if (!key || !available()) return Promise.reject(new Error("unavailable"));
    const was = ids.has(key);
    if (was === on) return Promise.resolve(on);
    if (on) ids.add(key); else ids.delete(key);
    loaded = true;
    notify(key, on);
    return window.MOAuth.fetch(`${WORKER}/bookmarks/${on ? "add" : "remove"}`, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: key }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`bookmark ${r.status}`);
        // Un-saving the new copy of a retired work takes its old ids
        // with it, or the work would come back as saved on next load.
        if (!on && aliases.has(key)) {
          const old = aliases.get(key);
          aliases.delete(key);
          old.forEach((postId) => {
            ids.delete(postId);
            window.MOAuth.fetch(`${WORKER}/bookmarks/remove`, {
              method: "POST",
              mode: "cors",
              credentials: "omit",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ postId }),
            }).catch(() => { /* it resurfaces as saved; the reader can un-save again */ });
          });
        }
        return on;
      })
      .catch((err) => {
        if (was) ids.add(key); else ids.delete(key);
        notify(key, was);
        throw err;
      });
  }

  // Adds only where it is not already there, which is what a section
  // bookmark wants: marking a place inside a work saves the work, and
  // marking a second place in the same work must not write again.
  function ensure(id) {
    if (has(id) === true) return Promise.resolve(true);
    return ready().then(() => (ids.has(String(id)) ? true : set(id, true)));
  }

  function toggle(id) {
    return set(id, !ids.has(String(id)));
  }

  window.MOFaithBookmarks = {
    WORKER,
    paid,
    idFor,
    parseId,
    available,
    ready,
    has,
    set,
    ensure,
    toggle,
    subscribe,
  };
})();
