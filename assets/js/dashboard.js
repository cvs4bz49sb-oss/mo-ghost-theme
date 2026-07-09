/*
 * Dashboard list hydration.
 *
 * Renders bookmarks and reading history into their mount elements.
 * Each mount carries two optional data attributes:
 *   data-limit    — max rows to show; blank/absent means render all
 *   data-view-all — href to navigate to when truncated (adds a
 *                   "View All N →" link under the list)
 */
(function () {
  const {body} = document;
  const WORKER = body.getAttribute("data-kit-worker-url") || "";
  const EMAIL = body.getAttribute("data-member-email") || "";

  // Ghost only exposes @member.name as a single string. Swap the
  // hero headline's "Welcome, {full name}" to first name only.
  const nameEl = document.querySelector(".dashboard-hero .highlight em");
  if (nameEl) {
    const full = (nameEl.textContent || "").trim();
    // Skip when the highlight isn't a name (e.g. "Bookmarks" page).
    if (full && /\s/.test(full) && /^[A-Z]/.test(full)) {
      const first = full.split(/\s+/)[0];
      if (first) nameEl.textContent = first;
    }
  }

  const greetingEl = document.querySelector("[data-greeting]");
  if (greetingEl) {
    const hour = new Date().getHours();
    if (hour >= 12 && hour < 17) greetingEl.textContent = "Good afternoon";
    else if (hour >= 17 || hour < 5) greetingEl.textContent = "Good evening";
  }

  // On narrow viewports (tablet and phone), collapse every
  // dashboard-module at load so the page isn't an endless scroll.
  // Native <details> toggles on tap; belt-and-braces, we also bind
  // a click handler to the summary so even if some mobile browser
  // swallows the native behavior, tapping still opens/closes.
  const isNarrow = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
  if (isNarrow) {
    document.querySelectorAll(".dashboard-module[open]").forEach((d) => {
      d.removeAttribute("open");
    });
  }
  document.querySelectorAll(".dashboard-module > summary").forEach((s) => {
    s.addEventListener("click", (e) => {
      // If native toggle isn't working (rare), fall back to manual.
      const details = s.parentElement;
      if (!details) return;
      // Give native behavior a tick; if the open state didn't flip,
      // flip it ourselves. Prevents double-toggling on browsers
      // where native works correctly.
      const wasOpen = details.hasAttribute("open");
      setTimeout(() => {
        const isOpen = details.hasAttribute("open");
        if (isOpen === wasOpen) {
          if (wasOpen) details.removeAttribute("open");
          else details.setAttribute("open", "");
        }
      }, 0);
    });
  });

  // mo-kit helpers — JWT attached inside MOAuth.fetch's closure so
  // the bearer never appears on `window`. Worker derives caller's
  // email from payload.sub.
  function moKitGet(path) {
    return window.MOAuth.fetch(WORKER.replace(/\/$/, "") + path, {
      method: "GET", mode: "cors", credentials: "omit",
    });
  }
  function moKitPost(path, body) {
    return window.MOAuth.fetch(WORKER.replace(/\/$/, "") + path, {
      method: "POST", mode: "cors", credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    });
  }

  const MEMBERSHIP_API = (document.querySelector('meta[name="mo-api-base"]') || {}).content || "";
  function moMembershipGet(path) {
    if (!MEMBERSHIP_API) return Promise.resolve({ ok: false });
    return window.MOAuth.fetch(MEMBERSHIP_API.replace(/\/$/, "") + path, {
      method: "GET", mode: "cors", credentials: "omit",
    });
  }

  hydrateMigrationBanner();
  hydrateEngagement();
  hydrateBookmarks();
  hydrateCommonplace();
  hydrateHistory();
  hydrateReadingTracker();
  hydrateCardCounts();
  hydrateInstitutions();
  hydrateRenewalBanner();

  // --- Migration banner ---------------------------------------------------

  function hydrateMigrationBanner() {
    const banner = document.querySelector("[data-migration-banner]");
    if (!banner) return;
    const textEl = banner.querySelector("[data-migration-banner-text]");
    const btnEl = banner.querySelector("[data-migration-banner-btn]");
    const inner = banner.querySelector("[data-migration-banner-inner]");

    // Preview mode: ?migration=preview-migrated or ?migration=preview-pending
    const params = new URLSearchParams(window.location.search);
    const preview = params.get("migration");
    if (preview === "preview-migrated") {
      showBanner(true);
      return;
    }
    if (preview === "preview-pending") {
      showBanner(false);
      return;
    }

    if (!WORKER) return;
    moKitGet("/migration-status")
      .then((r) => { return r.ok ? r.json() : null; })
      .then((data) => {
        if (!data || !data.show) return;
        showBanner(data.migrated);
      })
      .catch(() => {});

    function showBanner(migrated) {
      if (!inner || !textEl) return;
      if (migrated) {
        inner.classList.add("migration-banner--success");
        textEl.textContent = "You have successfully migrated your membership. Thank you!";
      } else {
        inner.classList.add("migration-banner--action");
        textEl.textContent = "You still need to migrate your membership. You can do so here.";
        if (btnEl) btnEl.hidden = false;
      }
      banner.hidden = false;
    }
  }

  // --- Student renewal banner ---------------------------------------------
  // Student memberships are one-time annual payments. In the last month
  // before expiry, /api/student/me returns needs_renewal:true and we
  // surface a banner linking to /student/ to renew.

  function hydrateRenewalBanner() {
    const banner = document.querySelector("[data-renewal-banner]");
    if (!banner) return;
    const textEl = banner.querySelector("[data-renewal-banner-text]");
    if (!MEMBERSHIP_API) return;

    moMembershipGet("/api/student/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !data.is_student || !data.needs_renewal) return;
        const days = data.days_left;
        const when = days <= 0
          ? "today"
          : days === 1 ? "tomorrow" : `in ${days} days`;
        textEl.textContent = `Your student membership expires ${when} (${data.expires_at}). Renew to keep your access.`;
        banner.hidden = false;
      })
      .catch(() => {});
  }

  // --- Engagement module --------------------------------------------------

  function hydrateEngagement() {
    const mod = document.querySelector("[data-engagement-module]");
    if (!mod) return;
    const ADMIN = (body.getAttribute("data-admin-worker-url") || "").replace(/\/$/, "");
    if (!ADMIN) return;

    fetch(`${ADMIN}/engagement`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data || !data.active) return;
        mod.hidden = false;
        mod.querySelector("[data-engagement-title]").textContent = data.title || "";
        mod.querySelector("[data-engagement-body]").textContent = data.body || "";

        const content = mod.querySelector("[data-engagement-content]");
        content.innerHTML = "";

        if (data.type === "poll" && data.options) {
          renderPoll(content, data.options, data.results || {});
        } else if (data.type === "open-response") {
          renderOpenResponse(content, data.allowAnonymous);
        } else if (data.type === "link" && data.url) {
          const a = document.createElement("a");
          a.href = data.url;
          a.className = "btn btn-pill btn-primary engagement-link-btn";
          a.textContent = data.linkLabel || "Learn more";
          content.appendChild(a);
        }
      })
      .catch(() => {});

    function renderPoll(mount, options, results) {
      const total = Object.values(results).reduce((s, n) => s + n, 0);
      const wrap = document.createElement("div");
      wrap.className = "engagement-poll";
      options.forEach((opt) => {
        const count = results[opt] || 0;
        const pct = total ? Math.round((count / total) * 100) : 0;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "engagement-poll-option";
        btn.innerHTML = `<span class="engagement-poll-option-label">${esc(opt)}</span><span class="engagement-poll-option-bar" style="width:${pct}%"></span><span class="engagement-poll-option-pct">${pct}%</span>`;
        btn.addEventListener("click", () => {
          if (btn.disabled) return;
          wrap.querySelectorAll("button").forEach((b) => { b.disabled = true; });
          window.MOAuth.fetch(`${ADMIN}/engagement/vote`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ option: opt }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.results) {
                const newTotal = Object.values(d.results).reduce((s, n) => s + n, 0);
                wrap.querySelectorAll(".engagement-poll-option").forEach((b) => {
                  const label = b.querySelector(".engagement-poll-option-label").textContent;
                  const c = d.results[label] || 0;
                  const p = newTotal ? Math.round((c / newTotal) * 100) : 0;
                  b.querySelector(".engagement-poll-option-bar").style.width = `${p}%`;
                  b.querySelector(".engagement-poll-option-pct").textContent = `${p}%`;
                });
              }
            })
            .catch(() => {});
        });
        wrap.appendChild(btn);
      });
      mount.appendChild(wrap);
    }

    function renderOpenResponse(mount, allowAnon) {
      const wrap = document.createElement("div");
      wrap.className = "engagement-respond";
      wrap.innerHTML = `<textarea class="engagement-respond-input" placeholder="Your response..." rows="3"></textarea>${ 
        allowAnon ? `<label class="engagement-respond-anon"><input type="checkbox" /> Respond anonymously</label>` : "" 
        }<button type="button" class="btn btn-pill btn-primary engagement-respond-btn">Submit</button>` +
        `<p class="engagement-respond-status" hidden></p>`;
      const textarea = wrap.querySelector("textarea");
      const anonBox = wrap.querySelector('input[type="checkbox"]');
      const btn = wrap.querySelector("button");
      const status = wrap.querySelector(".engagement-respond-status");
      btn.addEventListener("click", () => {
        const answer = textarea.value.trim();
        if (!answer) return;
        btn.disabled = true;
        window.MOAuth.fetch(`${ADMIN}/engagement/respond`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answer, anonymous: anonBox ? anonBox.checked : false }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.ok) {
              status.textContent = "Thanks for your response!";
              status.hidden = false;
              textarea.value = "";
              textarea.disabled = true;
              btn.hidden = true;
            } else {
              status.textContent = d.error || "Something went wrong.";
              status.hidden = false;
              btn.disabled = false;
            }
          })
          .catch(() => { status.textContent = "Failed to submit."; status.hidden = false; btn.disabled = false; });
      });
      mount.appendChild(wrap);
    }

    function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
  }

  // --- Bookmarks ---------------------------------------------------------

  // Hub cards: fill the read-only count on each saved-content card
  // (Bookmarks / Commonplace / Reading History). Hub-only — no-ops on the
  // full pages and anywhere the cards aren't present. Read-only; a failed
  // fetch just leaves the count blank, never blocks navigation.
  function hydrateCardCounts() {
    const cards = document.querySelectorAll("[data-card-count]");
    if (!cards.length || !WORKER || !EMAIL) return;
    const CFG = {
      bookmarks: { path: "/bookmarks", key: "bookmarks", noun: "saved" },
      commonplace: { path: "/commonplace", key: "entries", noun: "entries" },
      history: { path: "/history?limit=500", key: "history", noun: "essays" },
    };
    cards.forEach((el) => {
      const c = CFG[el.getAttribute("data-card-count")];
      if (!c) return;
      moKitGet(c.path)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const list = (data && data[c.key]) || [];
          const n = Array.isArray(list) ? list.length : 0;
          el.textContent = `${n} ${c.noun}`;
        })
        .catch(() => { /* leave the count blank */ });
    });
  }

  function hydrateBookmarks() {
    const mount = document.querySelector("[data-dashboard-bookmarks]");
    if (!mount) return;
    if (!WORKER || !EMAIL) {
      showEmpty(mount, "Bookmarks are only available for signed-in members.");
      return;
    }
    moKitGet("/bookmarks")
      .then((r) => { return r.ok ? r.json() : null; })
      .then((data) => {
        const list = (data && data.bookmarks) || [];
        renderList(mount, list, "bookmarks", {
          emptyMsg: "No bookmarks yet. Tap the bookmark icon on any essay to save it here.",
        });
      })
      .catch(() => {
        showEmpty(mount, "Couldn't load your bookmarks right now. Try reloading.");
      });
  }

  // --- Commonplace Book --------------------------------------------------

  function hydrateCommonplace() {
    const mount = document.querySelector("[data-dashboard-commonplace]");
    if (!mount) return;
    if (!WORKER || !EMAIL) {
      showEmpty(mount, "Commonplace Book is only available for signed-in members.");
      return;
    }
    moKitGet("/commonplace")
      .then((r) => { return r.ok ? r.json() : null; })
      .then((data) => {
        const list = (data && data.entries) || [];
        renderCommonplaceList(mount, list);
      })
      .catch(() => {
        showEmpty(mount, "Couldn’t load your commonplace book right now. Try reloading.");
      });
  }

  function renderCommonplaceList(mount, fullList) {
    if (!fullList.length) {
      showEmpty(mount, "No passages saved yet. Highlight any text on an article and tap Save to start your commonplace book.");
      return;
    }

    const limitRaw = parseInt(mount.getAttribute("data-limit") || "", 10);
    const limit = isNaN(limitRaw) ? fullList.length : limitRaw;
    const visible = fullList.slice(0, limit);
    const viewAllHref = mount.getAttribute("data-view-all") || "";
    const isCompact = mount.hasAttribute("data-limit");

    clear(mount);

    const container = document.createElement("div");
    container.className = "commonplace-list";

    for (let i = 0; i < visible.length; i++) {
      container.appendChild(renderCommonplaceEntry(visible[i], isCompact));
    }
    mount.appendChild(container);

    if (viewAllHref && fullList.length > limit) {
      const wrap = document.createElement("p");
      wrap.className = "dashboard-view-all";
      const a = document.createElement("a");
      a.href = viewAllHref;
      a.textContent = `View all ${fullList.length} →`;
      wrap.appendChild(a);
      mount.appendChild(wrap);
    }
  }

  function renderCommonplaceEntry(entry, isCompact) {
    const item = document.createElement("div");
    item.className = "commonplace-entry";

    const quote = document.createElement("blockquote");
    quote.className = "commonplace-quote";
    let displayText = entry.text || "";
    if (isCompact && displayText.length > 180) {
      displayText = `${displayText.slice(0, 180).replace(/\s+\S*$/, "")}…`;
    }
    quote.textContent = displayText;
    item.appendChild(quote);

    const meta = document.createElement("div");
    meta.className = "commonplace-meta";

    if (entry.sourceTitle) {
      const source = document.createElement("a");
      source.className = "commonplace-source";
      window.MOSafeHref.set(source, entry.sourceUrl, "#");
      source.textContent = entry.sourceTitle;
      meta.appendChild(source);
    }

    item.appendChild(meta);

    if (entry.savedAt) {
      const date = document.createElement("p");
      date.className = "commonplace-date";
      date.textContent = `Saved ${formatRelative(entry.savedAt)}`;
      item.appendChild(date);
    }

    const actions = document.createElement("div");
    actions.className = "commonplace-actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "commonplace-action-btn";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      let copyText = `“${entry.text}”`;
      const attr = [];
      if (entry.sourceAuthor) attr.push(entry.sourceAuthor);
      if (entry.sourceTitle) attr.push(entry.sourceTitle);
      attr.push("Mere Orthodoxy");
      copyText += `\n\n— ${attr.join(", ")}`;
      if (entry.sourceUrl) copyText += `\n\n${entry.sourceUrl}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(copyText).then(() => {
          copyBtn.textContent = "Copied";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
        });
      }
    });
    actions.appendChild(copyBtn);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "commonplace-action-btn commonplace-action-remove";
    removeBtn.textContent = "Remove";
    let confirmState = 0; // 0=idle, 1=awaiting confirm
    removeBtn.addEventListener("click", () => {
      if (confirmState === 0) {
        confirmState = 1;
        removeBtn.textContent = "Are you sure?";
        removeBtn.classList.add("is-confirming");
        setTimeout(() => {
          if (confirmState === 1) {
            confirmState = 0;
            removeBtn.textContent = "Remove";
            removeBtn.classList.remove("is-confirming");
          }
        }, 3000);
        return;
      }
      removeBtn.disabled = true;
      removeBtn.textContent = "Removing…";
      moKitPost("/commonplace/remove", { id: entry.id }).then(() => {
        item.remove();
      }).catch(() => {
        removeBtn.disabled = false;
        removeBtn.textContent = "Remove";
        removeBtn.classList.remove("is-confirming");
        confirmState = 0;
      });
    });
    actions.appendChild(removeBtn);

    item.appendChild(actions);
    return item;
  }

  // --- Reading History ---------------------------------------------------

  function hydrateHistory() {
    const mount = document.querySelector("[data-dashboard-history]");
    if (!mount) return;
    if (!WORKER || !EMAIL) {
      showEmpty(mount, "Reading history is only available for signed-in members.");
      return;
    }
    moKitGet("/history?limit=50")
      .then((r) => { return r.ok ? r.json() : null; })
      .then((data) => {
        const list = (data && data.history) || [];
        renderList(mount, list, "history", {
          emptyMsg: "You haven't finished any essays yet. Read one for 60 seconds or scroll to the end, and it'll appear here.",
        });
      })
      .catch(() => {
        showEmpty(mount, "Couldn't load your reading history right now. Try reloading.");
      });
  }

  // --- Reading Tracker (rail) --------------------------------------------

  function hydrateReadingTracker() {
    const tracker = document.querySelector("[data-reading-tracker]");
    if (!tracker || !WORKER || !EMAIL) return;
    moKitGet("/history?limit=500")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const list = (data && data.history) || [];
        const countEl = tracker.querySelector("[data-reading-count]");
        if (countEl) countEl.textContent = list.length;

        const dotsEl = tracker.querySelector("[data-reading-dots]");
        if (!dotsEl) return;
        const dots = dotsEl.querySelectorAll(".dot");
        const now = new Date();
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() + mondayOffset);
        weekStart.setHours(0, 0, 0, 0);

        const daysWithReads = new Set();
        list.forEach((entry) => {
          const d = new Date(entry.readAt);
          if (d >= weekStart) {
            const day = d.getDay();
            if (day >= 1 && day <= 5) daysWithReads.add(day - 1);
          }
        });
        dots.forEach((dot, i) => {
          if (daysWithReads.has(i)) dot.classList.add("is-filled");
        });
      })
      .catch(() => {});
  }

  // --- Institution curated content ----------------------------------------

  function hydrateInstitutions() {
    const mount = document.querySelector("[data-dashboard-institutions]");
    if (!mount) return;
    if (!MEMBERSHIP_API || !EMAIL) return;

    // Show institution admin link in sidebar if this member is an admin
    moMembershipGet("/api/institution/am-i-admin")
      .then((r) => { return r.ok ? r.json() : null; })
      .then((data) => {
        const insts = (data && data.institutions) || [];
        if (!insts.length) return;
        const linkEl = document.querySelector("[data-institution-admin-link]");
        if (!linkEl) return;
        const nameEl = linkEl.querySelector("[data-institution-admin-name]");
        if (nameEl) nameEl.textContent = insts[0].name;
        linkEl.hidden = false;
        const sepEl = document.querySelector("[data-institution-admin-sep]");
        if (sepEl) sepEl.hidden = false;
      })
      .catch(() => {});

    moMembershipGet("/api/institution/curated-for-me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const institutions = (data && data.institutions) || [];
        const withItems = institutions.filter((inst) => (inst.curated || []).length);
        if (!withItems.length) return;

        // Reveal the institution card. The curated list itself lives on the
        // full page (/dashboard/institution/) the card links to — same
        // click-through pattern as the other saved-content cards.
        const card = document.querySelector("[data-institution-card]");
        if (!card) return;
        const total = withItems.reduce((sum, inst) => sum + (inst.curated || []).length, 0);
        const kindEl = card.querySelector("[data-institution-card-kind]");
        if (kindEl && withItems[0].name) kindEl.textContent = withItems[0].name;
        const countEl = card.querySelector("[data-institution-card-count]");
        if (countEl) countEl.textContent = total + (total === 1 ? " reading" : " readings");
        card.hidden = false;
      })
      .catch(() => {
        // Silent — institution module just doesn't show
      });
  }

  // --- Shared rendering --------------------------------------------------

  function renderList(mount, fullList, kind, opts) {
    if (!fullList.length) { showEmpty(mount, opts.emptyMsg); return; }

    const limitRaw = parseInt(mount.getAttribute("data-limit") || "", 10);
    const limit = isNaN(limitRaw) ? fullList.length : limitRaw;
    const visible = fullList.slice(0, limit);
    const viewAllHref = mount.getAttribute("data-view-all") || "";

    // Two render modes:
    //   - Inline dashboard modules (data-limit set) → compact
    //     dashboard-essay rows (small thumb left, text right).
    //   - Full-page /dashboard/bookmarks/ + /history/ (no limit) →
    //     archive-style .week-grid of .entry cards matching the
    //     rest of the blog listings (/archive/, This Week on home).
    const isCompact = mount.hasAttribute("data-limit");

    clear(mount);

    let container;
    if (isCompact) {
      container = document.createElement("ol");
      container.className = "dashboard-essay-list";
      for (let i = 0; i < visible.length; i++) {
        container.appendChild(renderCompactItem(visible[i], kind));
      }
    } else {
      container = document.createElement("div");
      container.className = "week-grid dashboard-entry-grid";
      for (let j = 0; j < visible.length; j++) {
        container.appendChild(renderEntryItem(visible[j], kind));
      }
    }
    mount.appendChild(container);

    if (viewAllHref && fullList.length > limit) {
      const wrap = document.createElement("p");
      wrap.className = "dashboard-view-all";
      const a = document.createElement("a");
      a.href = viewAllHref;
      a.textContent = `View all ${fullList.length} \u2192`;
      wrap.appendChild(a);
      mount.appendChild(wrap);
    }
  }

  function renderCompactItem(entry, kind) {
    const remove = buildRemoveButton(kind, entry);

    const metaText = kind === "bookmarks"
      ? (entry.savedAt ? `Saved ${formatRelative(entry.savedAt)}` : "")
      : `Read ${formatRelative(entry.readAt)}`;

    const li = buildEssayRow({
      url: entry.url || (`/${entry.slug || ""}`),
      title: entry.title || entry.slug || entry.postId,
      topic: entry.primary_tag && entry.primary_tag.name,
      image: entry.feature_image,
      metaText,
      remove,
    });

    wireRemove(remove, kind, entry, li);
    return li;
  }

  function renderEntryItem(entry, kind) {
    const url = entry.url || (`/${entry.slug || ""}`);
    const metaText = kind === "bookmarks"
      ? (entry.savedAt ? `Saved ${formatRelative(entry.savedAt)}` : "")
      : `Read ${formatRelative(entry.readAt)}`;

    const wrap = document.createElement("div");
    wrap.className = "dashboard-entry";

    const a = document.createElement("a");
    window.MOSafeHref.set(a, url);
    a.className = "entry";

    const plate = document.createElement("div");
    plate.className = "entry-plate";
    const plateInner = document.createElement("div");
    plateInner.className = "entry-plate-inner";
    // Safe-URL filter then JSON-stringify into the CSS url() so a
    // value containing `");` can't break out of the CSS string.
    if (entry.feature_image && window.MOSafeHref.isSafe(entry.feature_image)) {
      plateInner.style.backgroundImage = `url(${JSON.stringify(entry.feature_image)})`;
    }
    plate.appendChild(plateInner);
    a.appendChild(plate);

    const text = document.createElement("div");
    text.className = "entry-text";

    if (entry.primary_tag && entry.primary_tag.name) {
      const topic = document.createElement("p");
      topic.className = "entry-topic";
      const topicTag = document.createElement("span");
      topicTag.className = "entry-topic-tag";
      topicTag.textContent = entry.primary_tag.name;
      topic.appendChild(topicTag);
      text.appendChild(topic);
    }

    const h3 = document.createElement("h3");
    h3.className = "entry-title";
    h3.textContent = entry.title || entry.slug || entry.postId;
    text.appendChild(h3);

    if (metaText) {
      const meta = document.createElement("div");
      meta.className = "entry-meta";
      const date = document.createElement("p");
      date.className = "entry-date";
      date.textContent = metaText;
      meta.appendChild(date);
      text.appendChild(meta);
    }

    a.appendChild(text);
    wrap.appendChild(a);

    const remove = buildRemoveButton(kind, entry);
    wrap.appendChild(remove);
    wireRemove(remove, kind, entry, wrap);

    return wrap;
  }

  function buildRemoveButton(kind, entry) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dashboard-essay-remove";
    btn.setAttribute("aria-label", kind === "bookmarks" ? "Remove bookmark" : "Remove from reading history");
    btn.textContent = "Remove";
    return btn;
  }

  function wireRemove(btn, kind, entry, removeNode) {
    const endpoint = kind === "bookmarks" ? "/bookmarks/remove" : "/history/remove";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.disabled = true;
      moKitPost(endpoint, { postId: entry.postId })
        .then(() => { removeNode.remove(); })
        .catch(() => { btn.disabled = false; });
    });
  }

  function buildEssayRow(opts) {
    const li = document.createElement("li");
    li.className = "dashboard-essay";

    const thumb = document.createElement("a");
    thumb.className = "dashboard-essay-thumb";
    window.MOSafeHref.set(thumb, opts.url);
    thumb.setAttribute("aria-hidden", "true");
    thumb.setAttribute("tabindex", "-1");
    if (opts.image && window.MOSafeHref.isSafe(opts.image)) {
      thumb.style.backgroundImage = `url(${JSON.stringify(opts.image)})`;
    }
    li.appendChild(thumb);

    const body = document.createElement("div");
    body.className = "dashboard-essay-body";

    if (opts.topic) {
      const topic = document.createElement("p");
      topic.className = "dashboard-essay-topic";
      topic.textContent = opts.topic;
      body.appendChild(topic);
    }
    const h3 = document.createElement("h3");
    h3.className = "dashboard-essay-title";
    const a = document.createElement("a");
    window.MOSafeHref.set(a, opts.url);
    const em = document.createElement("em");
    em.textContent = opts.title;
    a.appendChild(em);
    h3.appendChild(a);
    body.appendChild(h3);

    if (opts.metaText) {
      const meta = document.createElement("p");
      meta.className = "dashboard-essay-meta";
      meta.textContent = opts.metaText;
      body.appendChild(meta);
    }
    if (opts.remove) body.appendChild(opts.remove);
    li.appendChild(body);
    return li;
  }

  function showEmpty(mount, msg) {
    clear(mount);
    const p = document.createElement("p");
    p.className = "dashboard-empty";
    p.textContent = msg;
    mount.appendChild(p);
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function formatRelative(iso) {
    const then = Date.parse(iso);
    if (isNaN(then)) return "";
    const delta = Math.max(0, Date.now() - then);
    const mins = Math.floor(delta / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }
})();
