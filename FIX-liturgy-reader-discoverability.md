# FIX — Daily Liturgy reader: no way in, no visible way back

**Raised by:** Ray Kinzler (busbus@gmail.com), contact form 2026-08-05.
**Status: DRAFTED, NOT APPLIED, NOT DEPLOYED.** Working tree untouched.

> "I signed up for free access to the daily readings and it was perfect! I read it
> today at my normal time. But I signed in later and cannot figure out how to get
> to the daily readings. Your site says I can go back to previous days, but I
> can't see how?"

Ray is not confused. Both things he could not find are genuinely not findable.

---

## Problem 1 — `/daily-liturgy/read/` is linked from exactly one place on the site

```
grep -rn "daily-liturgy/read" --include="*.hbs" --include="*.js" ghost-theme/
→ custom-daily-liturgy.hbs:142   (one sentence inside the About copy)
```

That single link is mid-paragraph, below the fold, on the marketing page:

> "Subscribers can also <a href="/daily-liturgy/read/">read the full devotional
> online</a> with Scripture text, translation options, **and the ability to go back
> through past days**. Subscribe above to get access."

It is not in the site header, not on `/dashboard/`, and not on the `/daily-liturgy/`
hero. So a subscriber who signs in and wants today's reading has nowhere to click.
The one place that promises "go back through past days" is the same sentence Ray
quoted back at us — the site makes a claim it then gives him no way to act on.

The daily email does carry `[Read online with full formatting]`
(`workers/kit/lib/liturgy-generate.js:256`), which is how Ray got there the first
time. Once he was signed in on the site instead of in his inbox, the door was gone.

## Problem 2 — the back-navigation is two unlabelled circles

`custom-daily-liturgy-reader.hbs:19-23` renders the day nav as bare arrow glyphs,
and `assets/js/daily-liturgy-reader.js:248` hides the "Today" button whenever you
are on today — which is always true on first load. So the first thing every reader
sees is:

```
( ← )              ( → )      ← 40px circles, no text, right one dimmed
```

`aria-label="Previous day"` is set, so a screen reader gets it. A sighted reader
gets an arrow. Worse, **the page never shows what date you are looking at** —
`$title` is set to the devotional title (`daily-liturgy-reader.js:239`), never the
date. So even after clicking `←`, there is no confirmation you moved.

The prev/next machinery itself is fine (`findPrevDate`/`findNextDate`, keyboard
arrows at `:451`). Nothing is broken. It is invisible.

---

## The fix

Three edits. No logic changes, no new dependencies, no API calls.

### Edit 1 — label the navigation and show the date

`ghost-theme/custom-daily-liturgy-reader.hbs`, lines 18-26.

**OLD**
```hbs
  {{!-- Navigation --}}
  <nav class="dlr-nav" data-dlr-nav>
    <button class="dlr-nav-btn" data-dlr-prev aria-label="Previous day">&larr;</button>
    <button class="dlr-nav-today" data-dlr-today>Today</button>
    <button class="dlr-nav-btn" data-dlr-next aria-label="Next day" disabled>&rarr;</button>
  </nav>

  {{!-- Catch-up notice --}}
  <p class="dlr-catchup" data-dlr-catchup hidden>You're viewing a past devotional.</p>
```

**NEW**
```hbs
  {{!-- Navigation. Arrows carry visible text, not just aria-label: the reader
       loads on today, where the "Today" button is hidden, so unlabelled glyphs
       were the only affordance for reaching past days. --}}
  <nav class="dlr-nav" data-dlr-nav>
    <button class="dlr-nav-btn" data-dlr-prev aria-label="Previous day">
      <span aria-hidden="true">&larr;</span><span class="dlr-nav-btn-text">Previous day</span>
    </button>
    <span class="dlr-nav-date" data-dlr-date></span>
    <button class="dlr-nav-btn" data-dlr-next aria-label="Next day" disabled>
      <span class="dlr-nav-btn-text">Next day</span><span aria-hidden="true">&rarr;</span>
    </button>
  </nav>
  <p class="dlr-nav-hint" data-dlr-nav-hint>Every past devotional stays available. Step back a day at a time.</p>
  <div class="dlr-nav-today-row">
    <button class="dlr-nav-today" data-dlr-today hidden>Back to today</button>
  </div>

  {{!-- Catch-up notice --}}
  <p class="dlr-catchup" data-dlr-catchup hidden>You're viewing a past devotional.</p>
```

Note the `Today` button moves out of the arrow row and gains an explicit `hidden`
attribute — the JS at `:248` already sets `.hidden`, so behaviour is unchanged, but
it no longer leaves a gap between the arrows on first paint.

### Edit 2 — populate the date, hide the hint once they've used it

`ghost-theme/assets/js/daily-liturgy-reader.js`.

**OLD** (line 41, in the DOM refs block)
```js
  var $catchup = $("[data-dlr-catchup]");
```

**NEW**
```js
  var $catchup = $("[data-dlr-catchup]");
  var $date = $("[data-dlr-date]");
  var $navHint = $("[data-dlr-nav-hint]");
```

**OLD** (lines 242-249, inside `render`)
```js
    var prevDate = findPrevDate(dateStr);
    var nextDate = findNextDate(dateStr);
    $prev.disabled = !prevDate;
    $next.disabled = !nextDate;
    $prev._date = prevDate;
    $next._date = nextDate;
    $today.hidden = isToday;
    $catchup.hidden = isToday;
```

**NEW**
```js
    var prevDate = findPrevDate(dateStr);
    var nextDate = findNextDate(dateStr);
    $prev.disabled = !prevDate;
    $next.disabled = !nextDate;
    $prev._date = prevDate;
    $next._date = nextDate;
    $today.hidden = isToday;
    $catchup.hidden = isToday;
    // Which day am I on? Nothing on the page said, so moving between days gave
    // no feedback that anything had happened.
    if ($date) {
      $date.textContent = new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, {
        weekday: "long", month: "long", day: "numeric",
      });
    }
    // The hint is for people who have not yet realised past days exist. Once
    // they are off today, they have found it.
    if ($navHint) $navHint.hidden = !isToday;
```

`toLocaleDateString` with an explicit options object is already the pattern used in
`assets/js/dashboard.js`; no new formatter needed.

### Edit 3 — CSS for the new pieces

`ghost-theme/assets/built/screen.css`, appended immediately after the `.dlr-catchup`
rule (currently line 22221-22227).

```css
.dlr-nav-btn-text {
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.03em;
}
.dlr-nav-btn {
  width: auto;
  min-height: 40px;
  gap: 6px;
  padding: 0 16px;
  border-radius: 999px;
}
.dlr-nav-date {
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dlr-text-secondary);
  text-align: center;
  min-width: 12ch;
}
.dlr-nav-hint {
  text-align: center;
  font-size: 12.5px;
  font-style: italic;
  color: var(--dlr-text-secondary);
  margin: -18px 0 22px;
}
.dlr-nav-today-row {
  text-align: center;
  margin-bottom: 24px;
}
.dlr-nav-today[hidden] { display: none; }
```

And inside the existing `@media` block at line 22595, replace

```css
  .dlr-nav-btn { width: 36px; height: 36px; font-size: 16px; }
```

with

```css
  .dlr-nav-btn { width: auto; min-height: 36px; padding: 0 12px; font-size: 15px; }
  .dlr-nav-btn-text { font-size: 11px; }
  .dlr-nav-date { font-size: 11.5px; min-width: 0; }
```

At 375px the row is `← Previous day` / date / `Next day →`. If Mobile flags that as
tight, the fallback is `.dlr-nav-btn-text { display: none }` under 400px with the
date and the hint line carrying the meaning — but ship it labelled first and
measure, because hiding the labels is what caused this.

### Edit 4 — give the reader a front door

**4a. Dashboard card.** `ghost-theme/partials/dashboard-body.hbs`, in the
`.dash-cards` block, after the Reading History card (line 78):

```hbs
          <a class="dash-card" href="/daily-liturgy/read/">
            <span class="dash-card-kind">Pray</span>
            <h2 class="dash-card-title"><em>The Daily Liturgy</em></h2>
            <p class="dash-card-meta">Today's devotional, and every past day.</p>
            <span class="dash-card-foot"><span class="dash-card-open">Open &rarr;</span></span>
          </a>
```

**4b. Landing-page hero CTA.** `ghost-theme/custom-daily-liturgy.hbs`, line 15-18.

**OLD**
```hbs
      <div class="dl-hero-ctas">
        <a href="#subscribe" class="btn btn-copper btn-lg">Subscribe free</a>
        <a href="#listen" class="btn btn-ghost-light btn-lg">Listen on podcast</a>
      </div>
```

**NEW**
```hbs
      <div class="dl-hero-ctas">
        <a href="#subscribe" class="btn btn-copper btn-lg">Subscribe free</a>
        <a href="/daily-liturgy/read/" class="btn btn-ghost-light btn-lg">Read today's</a>
        <a href="#listen" class="btn btn-ghost-light btn-lg">Listen on podcast</a>
      </div>
```

The reader is currently ungated (`custom-daily-liturgy-reader.hbs:7`, "Gate
temporarily removed for public access"), so this link works for everyone today.
**If the gate is restored, this CTA must move behind `{{#if @member}}` or it becomes
a dead end for logged-out visitors.** Flagging rather than pre-writing it, because
whether the reader stays public is a product decision, not mine.

**4c. Fix the promise on line 142** so it stops describing a thing with no visible
control. Only if 4a/4b ship:

**OLD**
```hbs
          <p class="dl-about-text">Subscribers can also <a href="/daily-liturgy/read/">read the full devotional online</a> with Scripture text, translation options, and the ability to go back through past days. Subscribe above to get access.</p>
```

**NEW**
```hbs
          <p class="dl-about-text">Subscribers can also <a href="/daily-liturgy/read/">read the full devotional online</a> with Scripture text, translation options, and arrows at the top of the page for stepping back through past days. Subscribe above to get access.</p>
```

---

## Agent review required before this ships

Per `CLAUDE.md` § Agent Team, this touches `.hbs`, `.css`, and client-side `.js`:

| Agent | Why |
|---|---|
| **Frontend** | template + JS edits, Ghost conventions |
| **Design** | nav row now has text; check against brand spec |
| **Mobile** | 375px is the real risk — three labelled items in one row |
| **UX** | this whole fix *is* a UX finding; confirm the hint copy earns its space |
| **SEO** | new internal links to `/daily-liturgy/read/` (currently orphaned) |

Security and Backend are not needed — no auth, no network, no user input.

## Not fixed here

- **The reader has no archive index.** Stepping back one day at a time is fine for
  Ray, who missed a couple of days. Someone wanting a specific date in April has to
  click ~100 times. `findPrevDate` only searches 7 days back per hop
  (`daily-liturgy-reader.js:93`), so a gap longer than a week is a hard wall. A date
  picker or a month list is the real answer and is a bigger piece of work.
- **`?date=YYYY-MM-DD` is not supported.** The reader always opens on today; there
  is no way to link someone to a specific day. Worth adding when the archive is
  built — it is a few lines in `init()`.
