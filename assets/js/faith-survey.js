/*
 * The Faith Received — reader survey.
 *
 * A slim bar across the foot of every TFR landing page with one tab on
 * it. Pressing the tab slides a panel up; eight questions go by one at
 * a time, and the answers post once, at the end, to mo-forms
 * /tfr-survey. The results are read on /admin/tfr-survey/.
 *
 * LANDING PAGES ONLY. A work is a page someone is reading, and a bar
 * across the foot of a text is an interruption of the one thing this
 * project exists to do. Which pages are works is decided by the
 * markers <main> carries, never by a path list, for the reasons
 * written out at length in slide-in.js: one reader template serves
 * several routes and the routes move. The four selectors here are the
 * same four, deliberately.
 *
 * ANONYMOUS. Nothing sent from here names the reader: no email, no
 * member id, no Ghost uuid. member_status is one of three words and
 * goes along because "are the people answering the people paying" is
 * worth being able to ask. The worker allowlists it to those three.
 *
 * ONE SUBMIT, AT THE END. The welcome survey at /welcome/ saves after
 * every step, because a member abandoning it half way is still data we
 * are entitled to keep. This one is anonymous and unsolicited, so it
 * writes one row when the reader says so and nothing before that. The
 * cost is that abandonment loses the answers; the answers stay in
 * localStorage meanwhile, so closing the panel and coming back does
 * not.
 *
 * Rides site.min.js rather than ~100 custom-faith-*.hbs templates, for
 * the same reason faith-events.js does: one missed template would be a
 * landing page with no bar, and nobody would notice. It returns on its
 * first test for every page that is not a TFR landing page, so the
 * cost elsewhere is one string comparison.
 */
(function () {
  const FAITH_ROOT = "/the-faith-received/";
  const ENDPOINT = "https://mo-forms.mo-podcast-feed.workers.dev/tfr-survey";
  const EVENT_ENDPOINT = `${ENDPOINT}/event`;

  const KEY_STATE = "mo_tfr_survey";
  const KEY_DONE = "mo_tfr_survey_done";
  const KEY_OFF = "mo_tfr_survey_off";

  // ── Where are we ────────────────────────────────────────────────
  function normalizePath(p) {
    const s = String(p || "/").toLowerCase().split("?")[0].split("#")[0];
    return `${s.replace(/\/+$/, "")}/`;
  }
  const path = normalizePath(window.location.pathname);
  if (path.indexOf(FAITH_ROOT) !== 0) return;

  // The same four markers slide-in.js uses. faith-doc--topic is a topic
  // anthology, which is a way into the collection rather than a text,
  // so it counts as a landing page and keeps the bar.
  function isWork() {
    if (document.querySelector("main#reading, main.reader")) return true;
    const doc = document.querySelector("main.faith-doc");
    return !!doc && !doc.classList.contains("faith-doc--topic");
  }
  if (isWork()) return;

  function readFlag(key) {
    try { return !!window.localStorage.getItem(key); } catch (_) { return false; }
  }
  function writeFlag(key) {
    try { window.localStorage.setItem(key, String(Date.now())); } catch (_) { /* private mode */ }
  }
  if (readFlag(KEY_DONE) || readFlag(KEY_OFF)) return;

  // ── The questions ───────────────────────────────────────────────
  //
  // Q4-Q7 reuse the wording of the live subscriber survey at /welcome/
  // (custom-welcome.hbs) so the two instruments pool. Change a string
  // here and that join breaks silently — answers keep arriving, they
  // just stop matching. Tradition is the exception: /welcome/ asks
  // denomination instead, so those four values come from the 2026
  // subscriber survey, which is where the tradition baseline is.
  //
  // Every value below is allowlisted again in mo-forms. That copy is
  // the one that decides what reaches the table; this one only decides
  // what a reader can click.
  const QUESTIONS = [
    {
      key: "liking",
      type: "scale",
      q: "How much do you like The Faith Received?",
      low: "Not much",
      high: "A great deal",
    },
    {
      key: "usefulness",
      type: "scale",
      q: "How useful do you think The Faith Received will be to you?",
      low: "Not useful",
      high: "Very useful",
    },
    {
      key: "uses",
      type: "multi",
      q: "How do you see yourself using The Faith Received?",
      hint: "Select any that apply.",
      options: [
        "Sermon prep",
        "Academic research",
        "Searching for resources for my faith",
        "Reading my tradition",
        "Reading across traditions",
      ],
    },
    {
      key: "tradition",
      type: "single",
      q: "What tradition are you part of?",
      options: ["Protestant", "Catholic", "Eastern Orthodox", "Other"],
    },
    // Asked only of Protestants. "Protestant" is four in five of the
    // subscriber base and on its own it says almost nothing — the
    // interesting split in this audience is Presbyterian against Baptist
    // against Anglican, which is the split /admin/audience/ reports on.
    //
    // Nine options, not the welcome survey's ten: /welcome/ asks
    // denomination with no tradition question before it, so it needs
    // "Not Protestant" as the way out. Here the branch has already
    // established the answer and that option could only ever contradict
    // it. The nine that remain are word-for-word the welcome survey's,
    // which is what the join needs.
    {
      key: "denomination",
      type: "single",
      q: "What is your denomination?",
      showIf: (a) => a.tradition === "Protestant",
      options: [
        "Presbyterian",
        "Baptist",
        "Non-Denominational",
        "Anglican",
        "Lutheran",
        "Methodist",
        "Episcopal",
        "Pentecostal",
        "Other",
      ],
    },
    {
      key: "church_role",
      type: "multi",
      q: "What is your relationship to the church?",
      hint: "Select any that apply.",
      options: [
        "Member or Lay Person",
        "Home or Small Group Leader",
        "Elder or Deacon",
        "Pastor",
        "Academic",
        "Parachurch Ministry",
        "Not currently attending",
        "Student",
      ],
    },
    {
      key: "age_range",
      type: "single",
      q: "What is your age range?",
      options: ["18-24", "25-34", "35-44", "45-54", "55-64", "65-74", "75+"],
    },
    {
      key: "gender",
      type: "single",
      q: "What is your gender?",
      options: ["Male", "Female", "Prefer not to say"],
    },
    {
      key: "likes",
      type: "text",
      q: "What do you like about The Faith Received?",
      placeholder: "Anything at all. This one is the most useful to us.",
    },
  ];
  /*
   * The questions this reader will actually be asked, in order.
   *
   * One of them is conditional, so the list is recomputed rather than
   * fixed: answering "Protestant" grows it from eight to nine, and
   * changing that answer on the way back shrinks it again. `index` is a
   * position in THIS list, never in QUESTIONS.
   *
   * The count in the footer follows it. The welcome survey does the
   * same thing for the same reason — a bar that counts questions nobody
   * will see reads as broken — except that it can prune once on load
   * and this cannot, because the answer that decides it is given
   * mid-flow.
   */
  function active() {
    return QUESTIONS.filter((q) => !q.showIf || q.showIf(answers));
  }

  // ── State ───────────────────────────────────────────────────────
  //
  // Held in localStorage so that closing the panel, following a link to
  // another room and coming back does not throw away six answers. It is
  // cleared on submit and on "Don't show this again".
  let answers = {};
  let index = 0;
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY_STATE) || "null");
    if (saved && typeof saved === "object") {
      answers = saved.answers && typeof saved.answers === "object" ? saved.answers : {};
      const n = parseInt(saved.index, 10);
      if (n >= 0 && n < active().length) index = n;
    }
  } catch (_) { answers = {}; }

  function persist() {
    try {
      window.localStorage.setItem(KEY_STATE, JSON.stringify({ answers, index }));
    } catch (_) { /* private mode: the panel still works, it just forgets */ }
  }
  function forget() {
    try { window.localStorage.removeItem(KEY_STATE); } catch (_) { /* ignore */ }
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // Ghost member.status is "free", "paid" or "comped". Comped members
  // have complimentary full access, so they count as paid — the same
  // rule slide-in.js applies for the same reason.
  function memberStatus() {
    const email = document.body.getAttribute("data-member-email") || "";
    if (!email) return "anon";
    const status = document.body.getAttribute("data-member-status") || "";
    return status === "paid" || status === "comped" || status === "gift" ? "paid" : "free";
  }

  /*
   * Two counters: the bar was opened, the bar was turned off. Both land
   * on a daily total in D1 and record nothing about who pressed them.
   *
   * Fire and forget, and silent on failure. This is telemetry behind a
   * button a reader pressed for their own reasons; nothing they are
   * doing should stall or break because a counter did. keepalive is set
   * so the dismissal still sends when the click is the last thing that
   * happens before they leave the page.
   */
  function count(kind) {
    try {
      fetch(EVENT_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind }),
        keepalive: true,
      }).catch(() => {});
    } catch (_) { /* nothing here is worth interrupting a reader for */ }
  }

  // ── Markup ──────────────────────────────────────────────────────
  const root = document.createElement("div");
  root.className = "fr-survey";
  root.setAttribute("data-fr-survey", "");
  root.innerHTML =
    `<div class="fr-survey-bar">` +
      `<button type="button" class="fr-survey-tab" data-fr-open ` +
        `aria-expanded="false" aria-controls="fr-survey-panel">Tell Us What You Think</button>` +
    `</div>` +
    // No `hidden` attribute: the panel slides, and display:none cannot
    // be transitioned from. The stylesheet parks it below the fold with
    // visibility:hidden instead, which takes it out of the
    // accessibility tree and out of the tab order exactly as `hidden`
    // would while leaving the transform animatable.
    `<div class="fr-survey-panel" id="fr-survey-panel" role="dialog" aria-modal="false" ` +
      `aria-labelledby="fr-survey-q">` +
      `<div class="fr-survey-inner">` +
        `<button type="button" class="fr-survey-close" data-fr-close aria-label="Close survey">&times;</button>` +
        `<div class="fr-survey-body" data-fr-body></div>` +
        `<p class="fr-survey-msg" data-fr-msg role="status" aria-live="polite" hidden></p>` +
        `<div class="fr-survey-foot">` +
          `<span class="fr-survey-count" data-fr-count></span>` +
          `<span class="fr-survey-actions">` +
            `<button type="button" class="fr-survey-back" data-fr-back>Back</button>` +
            `<button type="button" class="fr-survey-skip" data-fr-skip>Skip</button>` +
            `<button type="button" class="fr-survey-next" data-fr-next>Next</button>` +
          `</span>` +
        `</div>` +
        `<div class="fr-survey-turnstile" data-fr-turnstile></div>` +
        `<button type="button" class="fr-survey-off" data-fr-off>Don't show this again</button>` +
      `</div>` +
    `</div>`;
  document.body.appendChild(root);
  document.body.classList.add("has-fr-survey");

  const panel = root.querySelector(".fr-survey-panel");
  const tab = root.querySelector("[data-fr-open]");
  const body = root.querySelector("[data-fr-body]");
  const msg = root.querySelector("[data-fr-msg]");
  const countEl = root.querySelector("[data-fr-count]");
  const backBtn = root.querySelector("[data-fr-back]");
  const skipBtn = root.querySelector("[data-fr-skip]");
  const nextBtn = root.querySelector("[data-fr-next]");

  function say(text, bad) {
    if (!text) { msg.hidden = true; msg.textContent = ""; return; }
    msg.hidden = false;
    msg.className = `fr-survey-msg${bad ? " is-bad" : ""}`;
    msg.textContent = text;
  }

  // ── Rendering one question ──────────────────────────────────────
  function render() {
    const item = active()[index];
    if (!item) return;
    const chosen = answers[item.key];
    let html = `<p class="fr-survey-q" id="fr-survey-q">${escapeHtml(item.q)}</p>`;
    if (item.hint) html += `<p class="fr-survey-hint">${escapeHtml(item.hint)}</p>`;

    if (item.type === "scale") {
      // A radio group, not a row of buttons: five options of which one
      // can be chosen is what a radio group is, and screen readers and
      // arrow keys already know how to work one.
      html += `<div class="fr-survey-scale" role="radiogroup" aria-labelledby="fr-survey-q">`;
      html += `<span class="fr-survey-scale-end">${escapeHtml(item.low)}</span>`;
      for (let n = 1; n <= 5; n += 1) {
        html +=
          `<label class="fr-survey-dot${chosen === n ? " is-on" : ""}">` +
          `<input type="radio" name="${escapeHtml(item.key)}" value="${n}"` +
          `${chosen === n ? " checked" : ""} />` +
          `<span>${n}</span></label>`;
      }
      html += `<span class="fr-survey-scale-end">${escapeHtml(item.high)}</span>`;
      html += `</div>`;
    } else if (item.type === "text") {
      html +=
        `<textarea class="fr-survey-text" data-fr-input rows="3" maxlength="2000" ` +
        `placeholder="${escapeHtml(item.placeholder || "")}">${escapeHtml(chosen || "")}</textarea>`;
    } else {
      const multi = item.type === "multi";
      const picked = multi ? (Array.isArray(chosen) ? chosen : []) : [];
      html += `<div class="fr-survey-options${item.options.length > 5 ? " fr-survey-options--two" : ""}">`;
      item.options.forEach((opt) => {
        const on = multi ? picked.indexOf(opt) !== -1 : chosen === opt;
        html +=
          `<label class="fr-survey-option${on ? " is-on" : ""}">` +
          `<input type="${multi ? "checkbox" : "radio"}" name="${escapeHtml(item.key)}" ` +
          `value="${escapeHtml(opt)}"${on ? " checked" : ""} />` +
          `<span>${escapeHtml(opt)}</span></label>`;
      });
      html += `</div>`;
    }

    body.innerHTML = html;
    const total = active().length;
    countEl.textContent = `Question ${index + 1} of ${total}`;
    backBtn.hidden = index === 0;
    nextBtn.textContent = index === total - 1 ? "Submit" : "Next";
    say("");
  }

  /** True when the reader is standing on the last active question. */
  function onLast() {
    return index >= active().length - 1;
  }

  // The chosen class is what colours an option; the input underneath is
  // what holds the answer. Toggled here rather than with :has() so it
  // behaves the same in every browser the site supports.
  //
  // Bound once, to the container. render() replaces the container's
  // contents rather than the container, so binding inside it would add
  // one more listener per question and run the handler eight times on
  // the last one.
  /*
   * A one-answer question advances itself.
   *
   * Ian, 2026-09-21: "if they click an answer and it isn't multiple
   * choice, automatically proceed to the next question." On a question
   * that takes exactly one answer, pressing Next afterwards is a second
   * tap that carries no information -- the answer already said
   * everything the step was asking.
   *
   * ONLY RADIOS. Checkboxes are the multi-select questions, where
   * advancing on the first tick would take the other options away
   * before the reader had finished, and the text box has nothing to
   * advance on.
   *
   * NEVER OFF THE LAST QUESTION. Auto-advancing there means
   * auto-submitting, which would send the survey out from under
   * somebody who was still deciding.
   *
   * GOING BACK DOES NOT BOUNCE THEM FORWARD AGAIN. `change` only fires
   * on a real interaction; re-rendering an already-chosen option with
   * `checked` fires nothing. So Back lands on the answer and stays
   * there, and only a fresh choice moves.
   *
   * The delay is the point, not an implementation detail: the fill has
   * to be seen landing on the thing they picked, or the panel reads as
   * having jumped on its own.
   */
  const ADVANCE_MS = 260;
  let advanceTimer = null;
  function cancelAdvance() {
    if (advanceTimer) { window.clearTimeout(advanceTimer); advanceTimer = null; }
  }

  body.addEventListener("change", (e) => {
    const input = e.target;
    if (!input || !input.name) return;
    const box = input.closest(".fr-survey-option, .fr-survey-dot");
    if (!box) return;
    if (input.type === "radio") {
      body.querySelectorAll(".fr-survey-option, .fr-survey-dot")
        .forEach((el) => el.classList.remove("is-on"));
      box.classList.add("is-on");

      if (!onLast()) {
        cancelAdvance();
        advanceTimer = window.setTimeout(() => {
          advanceTimer = null;
          // Re-checked on arrival rather than trusted from 260ms ago:
          // the reader may have pressed Back, Skip or the close button
          // in the meantime, and this must not move them then.
          if (!root.classList.contains("is-open") || finished) return;
          if (box.isConnected && input.checked && !onLast()) go(1, true);
        }, ADVANCE_MS);
      }
    } else {
      box.classList.toggle("is-on", input.checked);
    }
  });

  /** Read whatever is on screen into `answers`. Nothing chosen clears the key. */
  function capture() {
    const item = active()[index];
    if (!item) return;
    if (item.type === "text") {
      const el = body.querySelector("[data-fr-input]");
      const v = el ? el.value.trim().slice(0, 2000) : "";
      if (v) answers[item.key] = v; else delete answers[item.key];
      return;
    }
    const checked = [].slice.call(body.querySelectorAll("input:checked"));
    if (!checked.length) { delete answers[item.key]; return; }
    if (item.type === "multi") {
      answers[item.key] = checked.map((i) => i.value);
    } else if (item.type === "scale") {
      answers[item.key] = parseInt(checked[0].value, 10);
    } else {
      answers[item.key] = checked[0].value;
    }
  }

  function go(delta, keep) {
    const here = active()[index];
    if (keep) capture(); else if (here) delete answers[here.key];

    // The answer just captured can change which questions exist: going
    // back to Tradition and changing Protestant to Catholic takes
    // Denomination out of the flow. Drop the answer it is no longer
    // asking for, or a denomination would be filed against a Catholic
    // because of a choice they changed their mind about.
    QUESTIONS.forEach((q) => {
      if (q.showIf && !q.showIf(answers)) delete answers[q.key];
    });

    // Recomputed AFTER that, so stepping off Tradition onto a freshly
    // created Denomination lands on the right question.
    const list = active();
    const at = list.indexOf(here);
    const from = at === -1 ? index : at;
    const next = from + delta;
    if (next < 0 || next >= list.length) return;
    index = next;
    persist();
    cancelAdvance();
    render();
  }

  // ── Turnstile ───────────────────────────────────────────────────
  //
  // Rendered when the panel first opens rather than at submit, so the
  // challenge has the length of the survey to resolve in and the reader
  // never waits on it. mo-forms fails CLOSED on this route, so a missing
  // token is a refusal rather than a warning — hence the short wait at
  // submit rather than sending without one.
  let token = "";
  let turnstileRendered = false;
  function mountTurnstile() {
    if (turnstileRendered) return;
    const wrap = root.querySelector("[data-fr-turnstile]");
    const meta = document.querySelector('meta[name="turnstile-site-key"]');
    const siteKey = meta ? meta.getAttribute("content") : "";
    if (!wrap || !siteKey || !window.turnstile || !window.turnstile.render) return;
    try {
      window.turnstile.render(wrap, {
        sitekey: siteKey,
        callback(t) { token = t; },
        "expired-callback"() { token = ""; },
      });
      turnstileRendered = true;
    } catch (_) { /* submit reports the refusal; nothing to do here */ }
  }

  function waitForToken(tries) {
    if (token) return Promise.resolve(token);
    if (tries <= 0) return Promise.resolve("");
    mountTurnstile();
    return new Promise((resolve) => {
      window.setTimeout(() => resolve(waitForToken(tries - 1)), 400);
    });
  }

  // ── Submit ──────────────────────────────────────────────────────
  function submit() {
    capture();
    persist();

    const answered = QUESTIONS.some((q) => {
      const v = answers[q.key];
      return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "";
    });
    if (!answered) {
      say("Answer at least one question before sending.", true);
      return;
    }

    nextBtn.disabled = true;
    skipBtn.disabled = true;
    say("Sending…");

    waitForToken(15).then((t) => {
      if (!t) {
        nextBtn.disabled = false;
        skipBtn.disabled = false;
        say("The bot check did not finish. Reload the page and try again.", true);
        return;
      }
      const payload = {
        submission_id: newId(),
        turnstile_token: t,
        liking: answers.liking ?? null,
        usefulness: answers.usefulness ?? null,
        uses: answers.uses || [],
        tradition: answers.tradition || null,
        denomination: answers.denomination || null,
        church_role: answers.church_role || [],
        age_range: answers.age_range || null,
        gender: answers.gender || null,
        likes: answers.likes || "",
        page_path: path,
        member_status: memberStatus(),
      };
      return fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json().catch(() => ({ ok: false })))
        .then((res) => {
          if (res && res.ok) { thanks(); return; }
          nextBtn.disabled = false;
          skipBtn.disabled = false;
          say((res && res.error) || "That did not send. Please try again.", true);
        })
        .catch(() => {
          nextBtn.disabled = false;
          skipBtn.disabled = false;
          say("That did not send. Please try again.", true);
        });
    });
  }

  // crypto.randomUUID is not in every browser the site still serves, and
  // the id only has to be unique, not unguessable — it is a dedupe key
  // for a retry, not a secret and not an identity.
  function newId() {
    if (window.crypto && window.crypto.randomUUID) {
      try { return window.crypto.randomUUID(); } catch (_) { /* fall through */ }
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // Set once the row is in. After this the panel is a receipt, and
  // close() must not read answers back out of a replaced body and save
  // them over the state submitting just cleared.
  let finished = false;

  function thanks() {
    finished = true;
    writeFlag(KEY_DONE);
    forget();
    root.querySelector(".fr-survey-inner").innerHTML =
      `<div class="fr-survey-done">` +
      `<p class="fr-survey-q">Thank you.</p>` +
      `<p class="fr-survey-hint">That tells us more than any number we can measure ourselves.</p>` +
      `<button type="button" class="fr-survey-next" data-fr-close>Close</button>` +
      `</div>`;
  }

  // ── Open / close ────────────────────────────────────────────────
  function open() {
    count("open");
    root.classList.add("is-open");
    tab.setAttribute("aria-expanded", "true");
    mountTurnstile();
    if (!finished) render();
    document.addEventListener("keydown", onKey);
    const first = panel.querySelector("input, textarea, button");
    if (first && first.focus) first.focus();
  }

  function close() {
    // Whatever is on screen is kept. Someone who closes the panel
    // mid-question and comes back should find their answer where they
    // left it, not an empty one.
    if (!finished && body.childNodes.length) { capture(); persist(); }
    cancelAdvance();
    root.classList.remove("is-open");
    tab.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onKey);
  }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); tab.focus(); }
  }

  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-fr-open]")) { open(); return; }
    if (e.target.closest("[data-fr-close]")) { close(); return; }
    if (e.target.closest("[data-fr-back]")) { go(-1, true); return; }
    if (e.target.closest("[data-fr-skip]")) {
      // Skipping the last question still submits: "skip" means "I have
      // nothing to say to this", not "throw away the other seven".
      if (onLast()) {
        const here = active()[index];
        if (here) delete answers[here.key];
        submit();
        return;
      }
      go(1, false);
      return;
    }
    if (e.target.closest("[data-fr-next]")) {
      if (onLast()) submit(); else go(1, true);
      return;
    }
    if (e.target.closest("[data-fr-off]")) {
      count("dismiss");
      writeFlag(KEY_OFF);
      forget();
      root.remove();
      document.body.classList.remove("has-fr-survey");
    }
  });
}());
