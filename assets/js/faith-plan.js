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

  mount.innerHTML =
    `<div class="fr-plan">
       <p class="fr-plan-kicker">Read this with us</p>
       <p class="fr-plan-lead">A portion in your inbox each morning, at a pace you set. Free.</p>
       <div class="fr-plan-paces" role="group" aria-label="Minutes a day">${
         PACES.map((m) => `<button type="button" class="fr-plan-pace${m === minutes ? " is-on" : ""}" data-pace="${m}">${m} min</button>`).join("")
       }</div>
       <p class="fr-plan-estimate" data-plan-estimate aria-live="polite">Working out how long that takes&hellip;</p>
       <form class="fr-plan-form" data-plan-form>
         <input type="text" name="name" placeholder="First name" autocomplete="given-name" required />
         <input type="email" name="email" placeholder="Email" autocomplete="email" required />
         <button type="submit" class="fr-plan-go">Start reading</button>
       </form>
       <p class="fr-plan-note">One email a day. Stop, pause or change pace whenever you like.</p>
       <p class="fr-plan-status" data-plan-status hidden></p>
     </div>`;

  const estimateEl = mount.querySelector("[data-plan-estimate]");
  const statusEl = mount.querySelector("[data-plan-status]");
  const form = mount.querySelector("[data-plan-form]");

  function estimate() {
    estimateEl.textContent = "Working that out…";
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
        const human = d.days <= 45
          ? `${d.days} days`
          : months < 18
            ? `about ${Math.round(months)} months`
            : `about ${(months / 12).toFixed(1)} years`;
        estimateEl.innerHTML =
          `At ${minutes} minutes a day, <strong>${human}</strong>. ` +
          `<span class="fr-plan-sub">${d.days.toLocaleString()} readings, ${Number(d.totalWords).toLocaleString()} words in all.</span>`;
      })
      .catch(() => { estimateEl.textContent = ""; });
  }

  mount.querySelectorAll("[data-pace]").forEach((b) => {
    b.addEventListener("click", () => {
      minutes = parseInt(b.getAttribute("data-pace"), 10);
      mount.querySelectorAll("[data-pace]").forEach((x) => {
        x.classList.toggle("is-on", x === b);
      });
      estimate();
    });
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
        form.hidden = true;
        mount.querySelector(".fr-plan-paces").hidden = true;
        estimateEl.hidden = true;
        statusEl.innerHTML =
          `<strong>You are set.</strong> ${d.days.toLocaleString()} readings of ` +
          `<em>${d.work}</em>, starting tomorrow morning. Check your inbox for the first note.`;
      })
      .catch(() => {
        statusEl.textContent = "That did not go through. Try again in a moment.";
        btn.disabled = false;
      });
  });

  estimate();
})();
