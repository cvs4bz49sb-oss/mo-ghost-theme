/*
 * One honest sentence for a request that never completed.
 *
 * Every dynamic thing on this site (the library, checkout, gifts, the
 * store, forms, ebook access, audio, PDFs, search) is fetched from a
 * worker on a *.workers.dev host. From the browser's point of view that
 * is a third-party request to a domain privacy blocklists periodically
 * start catching. When one of them catches it the fetch never leaves
 * the browser, and `fetch()` rejects with a bare TypeError whose
 * message is "Failed to fetch" (Chrome), "Load failed" (Safari) or
 * "NetworkError when attempting to fetch resource" (Firefox).
 *
 * Printed raw, as it was until 2026-09-04, that reads to a reader as
 * "this site is broken" and is indistinguishable from a bug of ours, so
 * nobody reports it. Worse, it is invisible to us: the page itself is
 * served first-party by Ghost and records a normal pageview, and the
 * error beacon is on a workers.dev host too, so the one reporter that
 * would tell us is blocked by the same thing it would report.
 *
 * This says what actually happened and what the reader can do about it.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: claim to know WHICH cause it was.
 * A blocked request and a service that is genuinely down are the same
 * TypeError from inside the page, and there is no way to tell them
 * apart client-side. Probing a same-origin URL would only prove the
 * site is up, which we already know, since the page is running. So the
 * copy leads with the cause the reader can act on and names the other
 * rather than guessing between them.
 *
 * Absence-safe by design: every call site is expected to read this as
 *   var msg = (window.MONet && MONet.describe(err, "checkout")) || "<its own text>";
 * so a page that loads before this file, or without it, degrades to
 * exactly what it said before. describe() returning "" for anything
 * that is not a network failure is what makes that one-liner work:
 * an HTTP error, a JSON parse failure or a bug of ours falls straight
 * through to whatever the call site already said.
 *
 * Loaded from boot.min.js, which default.hbs runs before {{{body}}}.
 * That is the only position that serves every caller: the ~40 page
 * templates load their own <script> tags inside the body, which is
 * before site.min.js, so a lib in the site bundle would be undefined
 * at exactly the moment a page script needs it.
 */
(function () {
  "use strict";

  // The shapes a network-level failure takes across engines. These are
  // failures where the request did not complete at all, as opposed to
  // an HTTP error, which arrives as a perfectly good Response with a
  // 4xx or 5xx status and never reaches here.
  //
  // Kept tight on purpose. A bare "blocked" or "connection" would also
  // match a worker's own reader-facing error text ("this account is
  // blocked"), and those arrive as ordinary Errors that must be shown
  // as written. Real fetch rejections are TypeErrors and are caught
  // below regardless of wording; this list is only for the wrappers
  // that rethrow a network failure as a plain Error.
  const NETWORK_MESSAGES = /failed to fetch|load failed|networkerror|network request failed|network connection was lost|err_network|err_connection|err_blocked/i;

  // A rejected fetch is always a TypeError, but not every TypeError is
  // a rejected fetch. The commerce call sites all do their redirect
  // inside the same try block as the fetch, so a missing
  // window.MOSafeRedirect would land here as "Cannot read properties
  // of undefined", and telling a reader to switch off their ad blocker
  // to fix our own bug is worse than saying nothing. These are the
  // shapes a property-access or call-on-nothing TypeError takes across
  // engines; matching one means we let the error through untouched.
  //
  // "MOAuth.fetch refused" is in here for the same reason and is not a
  // hypothetical: admin-auth.js rejects with a TypeError when a host is
  // missing from the page's mo-trusted-hosts allowlist. That request
  // was indeed blocked, but by us, and telling the reader to switch off
  // their ad blocker would send them chasing a fix that cannot work.
  const PROGRAMMER_ERRORS = /is not a function|is not a constructor|is not iterable|cannot read propert|undefined is not|null is not|is not an object|is undefined|is null|assignment to constant|moauth\.fetch refused/i;

  function isNetworkError(err) {
    if (!err) return false;
    // AbortError is ours (a timeout or a cancelled request), not the
    // network's, and must not be described as a blocked request.
    if (err.name === "AbortError") return false;
    const msg = String(err.message || err || "");
    if (PROGRAMMER_ERRORS.test(msg)) return false;
    if (typeof TypeError === "function" && err instanceof TypeError) return true;
    return NETWORK_MESSAGES.test(msg);
  }

  // The subject varies by surface, so the caller names the thing whose
  // service could not be reached: "checkout", "the library", "Ask",
  // "this form". It has to read as the object of "the service that
  // handles ___", so a bare noun, not a sentence.
  function subjectOf(subject) {
    return subject || "this page";
  }

  // Deliberately ordered: the cause the reader can do something about
  // first, the one they cannot second. Which of the two it actually is
  // cannot be known from in here, so neither is asserted. The address
  // is the last sentence because a blocked request also blocks the
  // error beacon, and a reader who writes in is the only report we get.
  function describe(err, subject) {
    if (!isNetworkError(err)) return "";

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "Your device says it is offline. The request did not go through. Check your connection, then try again.";
    }

    return `We could not reach the service that handles ${subjectOf(subject)}. `
      + "An ad blocker, privacy extension, or network filter is the usual cause. "
      + "Allowing this page usually fixes it. "
      + "If it does not, the service may be down. "
      + "Let us know at ian@mereorthodoxy.com.";
  }

  // Same judgement, one line, for a slot with no room for the full
  // explanation (an inline status line, a row beside a retry button).
  function describeShort(err, subject) {
    if (!isNetworkError(err)) return "";
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "Your device says it is offline. Check your connection, then try again.";
    }
    return `We could not reach the service that handles ${subjectOf(subject)}. `
      + "An ad blocker or privacy extension is the usual cause.";
  }

  window.MONet = {
    isNetworkError,
    describe,
    describeShort,
  };
})();
