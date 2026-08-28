/*
 * "Read this with us" — the reading-plan generator, on every work.
 *
 * WHY THIS IS THE ASK
 *
 * A reader standing in front of 68,724 works does not have an appetite
 * problem that more passages would solve. They have the opposite one:
 * the library is overwhelming, they do not know where to start, and a
 * 900-page folio needs a structure they do not have. So the ask is not
 * "we will send you more of this", it is "we will show you how to read
 * it", which is a question a stranger can actually answer.
 *
 * THE DIAL ONLY TURNS ONE WAY
 *
 * The reader sets minutes a day and we show them the duration. Asking
 * for the duration instead sounds friendlier and produces plans nobody
 * can keep: the median work here is 161,000 words, so "in four weeks"
 * is 5,750 words a day and they fail in week one. Better to say plainly
 * that at fifteen minutes the Institutes takes seven months, and let
 * them choose a shorter work if that is not what they wanted.
 *
 * Hidden entirely for signed-in members, who already have the reader's
 * own tools and do not need to be sold an email.
 */
(function () {
  const mount = document.querySelector("[data-fr-plan]");
  if (!mount) return;

  const API = (mount.getAttribute("data-plans-url") || "").replace(/\/$/, "");
  if (!API) return;

  // Already a member? Then this is not for you.
  if (document.body.getAttribute("data-member-email")) return;

  let slug = "", corpus = "tfr";
  try {
    const q = new URLSearchParams(window.location.search);
    slug = (q.get("w") || "").replace(/[^a-z0-9_-]/gi, "");
    corpus = (q.get("c") || "tfr").replace(/[^a-z0-9_-]/gi, "");
  } catch (_) { /* no query */ }
  if (!slug) return;

  const PACES = [5, 10, 15, 20, 30];
  let minutes = 15;

  // Deliberately not a card. Every other element on this page is a
  // hairline and a typeface; a bordered box with an accent bar and five
  // filled buttons is the only thing shouting, and on the title page of
  // a sixteenth-century folio it reads as an advert someone taped on.
  // One rule above, one sentence, an inline pace, two underlined fields.
  mount.innerHTML =
    `<div class="fr-plan">
       <p class="fr-plan-kicker">Make a reading plan</p>
       <p class="fr-plan-line">
         A portion each morning, at
         <select class="fr-plan-pace" data-plan-pace aria-label="Minutes a day">${
           PACES.map((m) => `<option value="${m}"${m === minutes ? " selected" : ""}>${m} minutes</option>`).join("")
         }</select>
         a day. <span class="fr-plan-est" data-plan-estimate aria-live="polite"></span>
       </p>
       <form class="fr-plan-form" data-plan-form>
         <input type="text" name="name" placeholder="First name" autocomplete="given-name" required />
         <input type="email" name="email" placeholder="Email" autocomplete="email" required />
         <button type="submit" class="fr-plan-go">Start &rarr;</button>
       </form>
       <p class="fr-plan-status" data-plan-status hidden></p>
     </div>`;

  const estimateEl = mount.querySelector("[data-plan-estimate]");
  const statusEl = mount.querySelector("[data-plan-status]");
  const form = mount.querySelector("[data-plan-form]");

  function estimate() {
    estimateEl.textContent = "";
    fetch(`${API}/estimate?c=${encodeURIComponent(corpus)}&w=${encodeURIComponent(slug)}&minutes=${minutes}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || d.error || !d.days) {
          // A work we cannot divide should say so rather than offer a
          // plan that will never arrive.
          mount.hidden = true;
          return;
        }
        const months = d.days / 30.4;
        // The word "about" belongs to the sentence, not to the unit.
        const human = d.days <= 45
          ? `${d.days} days`
          : months < 18
            ? `${Math.round(months)} months`
            : `${(months / 12).toFixed(1)} years`;
        // Both halves of the honest answer: how long the whole thing
        // takes, and how much actually lands each morning. Duration
        // alone tells someone what they are committing to without
        // telling them what it feels like.
        const perDay = d.firstDayWords
          ? ` About ${Math.round(d.firstDayWords / 100) * 100} words a morning.`
          : "";
        estimateEl.textContent = `About ${human}.${perDay}`;
      })
      .catch(() => { estimateEl.textContent = ""; });
  }

  mount.querySelector("[data-plan-pace]").addEventListener("change", (e) => {
    minutes = parseInt(e.target.value, 10) || 15;
    estimate();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const btn = form.querySelector(".fr-plan-go");
    btn.disabled = true;
    statusEl.hidden = false;
    statusEl.textContent = "Setting up your plan…";
    fetch(`${API}/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        c: corpus, w: slug, minutes,
        name: form.name.value, email: form.email.value,
        source: "tfr-work",
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d || !d.ok) throw new Error((d && d.error) || "failed");
        mount.querySelector(".fr-plan-line").hidden = true;
        form.hidden = true;
        statusEl.textContent =
          `Set. ${d.days.toLocaleString()} readings of ${d.work}, starting tomorrow. Check your inbox.`;
      })
      .catch(() => {
        statusEl.textContent = "That did not go through. Try again in a moment.";
        btn.disabled = false;
      });
  });

  estimate();
})();
