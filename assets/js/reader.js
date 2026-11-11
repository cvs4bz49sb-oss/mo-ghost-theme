/*
 * Shared reader script for the journal and ebook reader pages
 * (page-journal-issue-NN-read.hbs, page-ebook-*-read.hbs), redesigned
 * 2026-11-10 with assets/css/reader-v2.css. reader-init.js applies the
 * saved theme and size before paint; this file runs the controls.
 *
 *   - Contents: a drawer on narrow screens, a column on wide ones
 *     (#menuToggle, #sidebar, #sidebarOverlay; Escape closes)
 *   - The bar names the essay being read (#rdNow); the contents mark it
 *   - Reading progress (#progressBar)
 *   - Text settings: size and theme (#rdTypeToggle / #rdTypePop)
 *   - Download and share popovers (#downloadToggle, #shareToggle)
 *   - "Continue reading" on the title page from the last essay read
 *   - Highlight-and-share tooltip (#highlightShare)
 *   - ?print=true adds body.print-mode (PDF generation hook)
 *
 * Per-page data comes from <body data-reader ...>: share title/text and
 * the quote attribution lines (data-reader-attr-full / -short).
 */
(function () {
  const {body} = document;
  if (!body.hasAttribute("data-reader")) return;
  const html = document.documentElement;
  const WIDE = window.matchMedia("(min-width: 1240px)");
  const POS_KEY = `mo-reader-pos:${window.location.pathname}`;

  if (new URLSearchParams(window.location.search).get("print") === "true") {
    body.classList.add("print-mode");
  }

  function store(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* blocked */ } }
  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

  // ---- Popovers (text settings, download, share) ----------------------
  const pops = [];
  function popover(btnId, popId) {
    const btn = document.getElementById(btnId);
    const pop = document.getElementById(popId);
    if (!btn || !pop) return;
    pops.push([btn, pop]);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !pop.classList.contains("open");
      closePops();
      pop.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
  }
  function closePops() {
    pops.forEach(([b, p]) => { p.classList.remove("open"); b.setAttribute("aria-expanded", "false"); });
  }
  popover("rdTypeToggle", "rdTypePop");
  popover("downloadToggle", "downloadPopup");
  popover("shareToggle", "sharePopup");
  document.addEventListener("click", (e) => {
    if (!pops.some(([b, p]) => { return p.contains(e.target) || b.contains(e.target); })) closePops();
  });

  // ---- Text settings ----------------------------------------------------
  function syncSettings() {
    const theme = html.getAttribute("data-theme") || "paper";
    const size = html.getAttribute("data-rd-size") || "m";
    document.querySelectorAll("[data-rd-theme]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-rd-theme") === theme));
    });
    document.querySelectorAll("[data-rd-size]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-rd-size") === size));
    });
  }
  document.querySelectorAll("[data-rd-theme]").forEach((b) => {
    b.addEventListener("click", () => {
      const t = b.getAttribute("data-rd-theme");
      if (t === "paper") html.removeAttribute("data-theme"); else html.setAttribute("data-theme", t);
      store("mo-reader-theme", t);
      syncSettings();
    });
  });
  document.querySelectorAll("[data-rd-size]").forEach((b) => {
    b.addEventListener("click", () => {
      const s = b.getAttribute("data-rd-size");
      if (s === "m") html.removeAttribute("data-rd-size"); else html.setAttribute("data-rd-size", s);
      store("mo-reader-size", s);
      syncSettings();
    });
  });
  syncSettings();

  // ---- Contents ---------------------------------------------------------
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (read("mo-reader-toc") === "hidden") body.classList.add("rd-toc-hidden");

  function drawer(open) {
    if (!sidebar) return;
    sidebar.classList.toggle("open", open);
    if (overlay) overlay.classList.toggle("open", open);
    if (menuToggle) menuToggle.setAttribute("aria-expanded", String(open));
    if (open) {
      const first = sidebar.querySelector("a.active") || sidebar.querySelector("a, button");
      if (first) first.focus();
    }
  }
  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", () => {
      if (WIDE.matches) {
        const hide = !body.classList.contains("rd-toc-hidden");
        body.classList.toggle("rd-toc-hidden", hide);
        store("mo-reader-toc", hide ? "hidden" : "shown");
        menuToggle.setAttribute("aria-expanded", String(!hide));
      } else {
        drawer(!sidebar.classList.contains("open"));
      }
    });
    menuToggle.setAttribute("aria-expanded", String(WIDE.matches && !body.classList.contains("rd-toc-hidden")));
  }
  if (overlay) overlay.addEventListener("click", () => { drawer(false); });
  document.querySelectorAll(".rd-toc-close").forEach((b) => {
    b.addEventListener("click", () => { drawer(false); if (menuToggle) menuToggle.focus(); });
  });
  document.querySelectorAll(".toc-list a").forEach((link) => {
    link.addEventListener("click", () => { if (!WIDE.matches) drawer(false); });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closePops();
    if (sidebar && sidebar.classList.contains("open")) { drawer(false); if (menuToggle) menuToggle.focus(); }
  });

  // ---- Progress, current essay, remembered place -----------------------
  const progressBar = document.getElementById("progressBar");
  const nowEl = document.getElementById("rdNow");
  const nowDefault = nowEl ? nowEl.textContent : "";
  const tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc-list a"));
  const sections = Array.prototype.slice.call(document.querySelectorAll(".content-section"));

  let ticking = false;
  function onScroll() {
    ticking = false;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    if (progressBar) progressBar.style.width = `${docH > 0 ? (window.scrollY / docH) * 100 : 0}%`;
    // The essay under the top quarter of the screen is the one being read.
    const line = window.innerHeight * 0.25;
    let current = null;
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= line) current = sections[i]; else break;
    }
    tocLinks.forEach((a) => { a.classList.toggle("active", !!current && a.getAttribute("href") === `#${current.id}`); });
    if (nowEl) {
      const t = current && current.querySelector(".section-title");
      nowEl.textContent = t ? t.textContent : nowDefault;
    }
    // Remember essays only, not the letter, contributors or about pages.
    if (current && current.querySelector(".rd-essay-n")) store(POS_KEY, current.id);
  }
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  const cont = document.getElementById("rdContinue");
  const saved = read(POS_KEY);
  if (cont && saved && sections.length && saved !== sections[0].id) {
    const target = document.getElementById(saved);
    const t = target && target.querySelector(".section-title");
    if (t) {
      cont.href = `#${saved}`;
      cont.querySelector("[data-rd-continue-title]").textContent = t.textContent;
      cont.hidden = false;
    }
  }

  // ---- Share + download popovers --------------------------------------
  const SHARE_URL = window.location.origin + window.location.pathname;
  const SHARE_TITLE = body.getAttribute("data-reader-share-title") || document.title || "";
  const SHARE_TEXT = body.getAttribute("data-reader-share-text") || SHARE_TITLE;
  const ATTR_FULL = body.getAttribute("data-reader-attr-full") || "";
  const ATTR_SHORT = body.getAttribute("data-reader-attr-short") || ATTR_FULL;

  // Copy link
  const copyLink = document.getElementById("copyLink");
  if (copyLink) {
    copyLink.addEventListener("click", () => {
      navigator.clipboard.writeText(SHARE_URL).then(() => {
        const msg = document.getElementById("copiedMsg");
        if (msg) {
          msg.classList.add("show");
          setTimeout(() => { msg.classList.remove("show"); }, 2000);
        }
      });
    });
  }

  // SMS
  const shareSMS = document.getElementById("shareSMS");
  if (shareSMS) {
    shareSMS.href = `sms:?&body=${encodeURIComponent(`${SHARE_TEXT} ${SHARE_URL}`)}`;
  }

  // X (Twitter)
  const shareX = document.getElementById("shareX");
  if (shareX) {
    shareX.href = `https://x.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT) 
      }&url=${encodeURIComponent(SHARE_URL)}`;
  }

  // Facebook
  const shareFB = document.getElementById("shareFB");
  if (shareFB) {
    shareFB.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}`;
  }

  // Instagram Stories
  const shareIG = document.getElementById("shareIG");
  if (shareIG) {
    shareIG.addEventListener("click", (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(SHARE_URL).then(() => {
        window.open("https://www.instagram.com/create/story/", "_blank");
        const msg = document.getElementById("copiedMsg");
        if (msg) {
          msg.textContent = "Link copied! Paste it in your Story.";
          msg.classList.add("show");
          setTimeout(() => {
            msg.classList.remove("show");
            msg.textContent = "Link copied!";
          }, 4000);
        }
      });
    });
  }

  // ---- Highlight & Share -----------------------------------------------
  const hsTooltip = document.getElementById("highlightShare");
  const hsCopiedMsg = document.getElementById("hsCopied");
  let selectedQuote = "";

  function buildShareText(rawQuote, limit) {
    const quote = rawQuote.replace(/\s+/g, " ").trim();
    const wrapped = `“${quote}”`;
    if (!limit) return wrapped + ATTR_FULL;
    if ((wrapped + ATTR_FULL).length <= limit) return wrapped + ATTR_FULL;
    if ((wrapped + ATTR_SHORT).length <= limit) return wrapped + ATTR_SHORT;
    return wrapped;
  }

  function positionTooltip(range) {
    if (!hsTooltip) return;
    const rect = range.getBoundingClientRect();
    const tooltipWidth = hsTooltip.offsetWidth || 200;
    const isMobile = window.innerWidth <= 960;
    const x = rect.left + rect.width / 2;
    const clampedX = Math.max(tooltipWidth / 2 + 8, Math.min(x, window.innerWidth - tooltipWidth / 2 - 8));
    hsTooltip.style.left = `${clampedX}px`;
    if (isMobile) {
      hsTooltip.style.top = `${rect.bottom + window.scrollY + 10}px`;
    } else {
      hsTooltip.style.top = `${rect.top + window.scrollY - 10}px`;
    }
  }

  function hideTooltip() {
    if (hsTooltip) hsTooltip.classList.remove("visible");
    selectedQuote = "";
  }

  function checkSelection() {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : "";
    const mainContent = document.querySelector(".main-content");
    if (
      text.length > 3 &&
      sel.rangeCount > 0 &&
      mainContent &&
      mainContent.contains(sel.anchorNode) &&
      hsTooltip
    ) {
      selectedQuote = text;
      positionTooltip(sel.getRangeAt(0));
      hsTooltip.classList.add("visible");
    } else {
      hideTooltip();
    }
  }

  if (hsTooltip) {
    document.addEventListener("mouseup", (e) => {
      if (hsTooltip.contains(e.target)) return;
      setTimeout(checkSelection, 10);
    });
    document.addEventListener("mousedown", (e) => {
      if (!hsTooltip.contains(e.target)) hideTooltip();
    });
    let selectionChangeTimer = null;
    document.addEventListener("selectionchange", () => {
      if (!("ontouchstart" in window)) return;
      clearTimeout(selectionChangeTimer);
      selectionChangeTimer = setTimeout(checkSelection, 300);
    });

    const hsCopy = document.getElementById("hsCopy");
    if (hsCopy) {
      hsCopy.addEventListener("click", () => {
        const text = `${buildShareText(selectedQuote, 0)}\n\n${SHARE_URL}`;
        navigator.clipboard.writeText(text).then(() => {
          if (hsCopiedMsg) {
            hsCopiedMsg.classList.add("show");
            setTimeout(() => { hsCopiedMsg.classList.remove("show"); }, 1500);
          }
        });
      });
    }
    const hsSMS = document.getElementById("hsSMS");
    if (hsSMS) {
      hsSMS.addEventListener("click", () => {
        const text = `${buildShareText(selectedQuote, 0)}\n\n${SHARE_URL}`;
        window.open(`sms:?&body=${encodeURIComponent(text)}`);
      });
    }
    const hsX = document.getElementById("hsX");
    if (hsX) {
      hsX.addEventListener("click", () => {
        const text = buildShareText(selectedQuote, 250);
        window.open(
          `https://x.com/intent/tweet?text=${encodeURIComponent(text) 
            }&url=${encodeURIComponent(SHARE_URL)}`,
          "_blank",
        );
      });
    }
    const hsFB = document.getElementById("hsFB");
    if (hsFB) {
      hsFB.addEventListener("click", () => {
        const text = buildShareText(selectedQuote, 0);
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${ 
            encodeURIComponent(SHARE_URL)}&quote=${encodeURIComponent(text)}`,
          "_blank",
        );
      });
    }
    const hsIG = document.getElementById("hsIG");
    if (hsIG) {
      hsIG.addEventListener("click", () => {
        const text = `${buildShareText(selectedQuote, 0)}\n\n${SHARE_URL}`;
        navigator.clipboard.writeText(text).then(() => {
          window.open("https://www.instagram.com/create/story/", "_blank");
          if (hsCopiedMsg) {
            hsCopiedMsg.textContent = "Quote + link copied! Paste in your Story.";
            hsCopiedMsg.classList.add("show");
            setTimeout(() => {
              hsCopiedMsg.classList.remove("show");
              hsCopiedMsg.textContent = "Copied!";
            }, 4000);
          }
        });
      });
    }
  }
})();
