/*
 * Shared reader script for journal and ebook landing-page templates
 * (page-journal-issue-NN-read.hbs, page-ebook-*-read.hbs).
 *
 * Behaviors:
 *   - Print-mode class on `?print=true`
 *   - Light/dark theme toggle (#themeToggle)
 *   - Sidebar collapse (desktop) / slide-in (mobile) via #menuToggle
 *   - Reading-progress bar (#progressBar)
 *   - Active-section highlighting in TOC via IntersectionObserver
 *   - Share + download popovers (#shareToggle, #downloadToggle)
 *   - Highlight-and-share tooltip (#highlightShare)
 *
 * Per-issue data (title, attribution lines) is read from data-*
 * attributes on the wrapping <body data-reader>. The previous
 * per-template inline scripts hardcoded these as JS literals; pulling
 * them into data-attrs lets us share one external file across all 12
 * journal/ebook reader pages and removes ~3,000 lines of duplicated
 * inline JS.
 *
 * Required data attributes on the body element:
 *   data-reader                  presence enables this script
 *   data-reader-share-title      e.g. "Mere Orthodoxy Journal: Issue 001 — Fall 2021"
 *   data-reader-share-text       same as title (or a custom hook line)
 *   data-reader-attr-full        e.g. "\n\n— Mere Orthodoxy Journal, Issue 001"
 *   data-reader-attr-short       e.g. "\n\n— MO Journal 001"
 *
 * Required DOM ids the script wires into. Templates already provide
 * all of these.
 */
(function () {
  var body = document.body;
  if (!body.hasAttribute("data-reader")) return;

  // Print mode detection (for PDF generation)
  if (new URLSearchParams(window.location.search).get("print") === "true") {
    body.classList.add("print-mode");
  }

  // ---- Theme toggle ----------------------------------------------------
  var themeToggle = document.getElementById("themeToggle");
  var html = document.documentElement;
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var current = html.getAttribute("data-theme");
      html.setAttribute("data-theme", current === "dark" ? "light" : "dark");
    });
  }

  // ---- Sidebar toggle --------------------------------------------------
  var menuToggle = document.getElementById("menuToggle");
  var sidebar = document.getElementById("sidebar");
  var overlay = document.getElementById("sidebarOverlay");

  // Desktop: restore collapsed state from localStorage.
  if (sidebar && window.innerWidth > 960) {
    if (localStorage.getItem("sidebarCollapsed") === "true") {
      sidebar.classList.add("collapsed");
    }
  }

  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", function () {
      if (window.innerWidth <= 960) {
        sidebar.classList.toggle("open");
        if (overlay) overlay.classList.toggle("open");
      } else {
        if (sidebar.classList.contains("collapsed")) {
          sidebar.classList.remove("collapsed");
          localStorage.setItem("sidebarCollapsed", "false");
        } else {
          sidebar.classList.add("collapsed");
          localStorage.setItem("sidebarCollapsed", "true");
        }
      }
    });
  }

  if (overlay) {
    overlay.addEventListener("click", function () {
      if (sidebar) sidebar.classList.remove("open");
      overlay.classList.remove("open");
    });
  }

  // Close sidebar on link click (mobile)
  document.querySelectorAll(".toc-list a").forEach(function (link) {
    link.addEventListener("click", function () {
      if (window.innerWidth <= 960 && sidebar) {
        sidebar.classList.remove("open");
        if (overlay) overlay.classList.remove("open");
      }
    });
  });

  // ---- Reading progress bar -------------------------------------------
  var progressBar = document.getElementById("progressBar");
  if (progressBar) {
    window.addEventListener("scroll", function () {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = (scrollTop / docHeight) * 100;
      progressBar.style.width = progress + "%";
    });
  }

  // ---- Active TOC highlighting ----------------------------------------
  // Journal pages tag sections with .content-section. Some ebook pages
  // don't apply that class — fall back to "every element with an id
  // that the TOC links to."
  var tocLinks = document.querySelectorAll(".toc-list a");
  var contentSections = document.querySelectorAll(".content-section");
  if (!contentSections.length && tocLinks.length) {
    var tocIds = new Set();
    tocLinks.forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (href.charAt(0) === "#") tocIds.add(href.slice(1));
    });
    contentSections = Array.prototype.filter.call(
      document.querySelectorAll("[id]"),
      function (el) { return tocIds.has(el.id); },
    );
  }
  if (contentSections.length && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var id = entry.target.getAttribute("id");
            tocLinks.forEach(function (link) {
              link.classList.remove("active");
              if (link.getAttribute("href") === "#" + id) {
                link.classList.add("active");
              }
            });
          }
        });
      },
      { rootMargin: "-10% 0px -80% 0px", threshold: 0 },
    );
    contentSections.forEach(function (section) {
      observer.observe(section);
    });
  }

  // ---- Share + download popovers --------------------------------------
  var SHARE_URL = window.location.origin + window.location.pathname;
  var SHARE_TITLE = body.getAttribute("data-reader-share-title") || document.title || "";
  var SHARE_TEXT = body.getAttribute("data-reader-share-text") || SHARE_TITLE;
  var ATTR_FULL = body.getAttribute("data-reader-attr-full") || "";
  var ATTR_SHORT = body.getAttribute("data-reader-attr-short") || ATTR_FULL;

  var shareToggle = document.getElementById("shareToggle");
  var sharePopup = document.getElementById("sharePopup");
  var downloadToggle = document.getElementById("downloadToggle");
  var downloadPopup = document.getElementById("downloadPopup");

  if (shareToggle && sharePopup) {
    shareToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      sharePopup.classList.toggle("open");
      if (downloadPopup) downloadPopup.classList.remove("open");
    });
  }
  if (downloadToggle && downloadPopup) {
    downloadToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      downloadPopup.classList.toggle("open");
      if (sharePopup) sharePopup.classList.remove("open");
    });
  }
  document.addEventListener("click", function (e) {
    if (sharePopup && shareToggle && !sharePopup.contains(e.target) && e.target !== shareToggle) {
      sharePopup.classList.remove("open");
    }
    if (downloadPopup && downloadToggle && !downloadPopup.contains(e.target) && !downloadToggle.contains(e.target)) {
      downloadPopup.classList.remove("open");
    }
  });

  // Copy link
  var copyLink = document.getElementById("copyLink");
  if (copyLink) {
    copyLink.addEventListener("click", function () {
      navigator.clipboard.writeText(SHARE_URL).then(function () {
        var msg = document.getElementById("copiedMsg");
        if (msg) {
          msg.classList.add("show");
          setTimeout(function () { msg.classList.remove("show"); }, 2000);
        }
      });
    });
  }

  // SMS
  var shareSMS = document.getElementById("shareSMS");
  if (shareSMS) {
    shareSMS.href = "sms:?&body=" + encodeURIComponent(SHARE_TEXT + " " + SHARE_URL);
  }

  // X (Twitter)
  var shareX = document.getElementById("shareX");
  if (shareX) {
    shareX.href = "https://x.com/intent/tweet?text=" + encodeURIComponent(SHARE_TEXT) +
      "&url=" + encodeURIComponent(SHARE_URL);
  }

  // Facebook
  var shareFB = document.getElementById("shareFB");
  if (shareFB) {
    shareFB.href = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(SHARE_URL);
  }

  // Instagram Stories
  var shareIG = document.getElementById("shareIG");
  if (shareIG) {
    shareIG.addEventListener("click", function (e) {
      e.preventDefault();
      navigator.clipboard.writeText(SHARE_URL).then(function () {
        window.open("https://www.instagram.com/create/story/", "_blank");
        var msg = document.getElementById("copiedMsg");
        if (msg) {
          msg.textContent = "Link copied! Paste it in your Story.";
          msg.classList.add("show");
          setTimeout(function () {
            msg.classList.remove("show");
            msg.textContent = "Link copied!";
          }, 4000);
        }
      });
    });
  }

  // ---- Highlight & Share -----------------------------------------------
  var hsTooltip = document.getElementById("highlightShare");
  var hsCopiedMsg = document.getElementById("hsCopied");
  var selectedQuote = "";

  function buildShareText(rawQuote, limit) {
    var quote = rawQuote.replace(/\s+/g, " ").trim();
    var wrapped = "“" + quote + "”";
    if (!limit) return wrapped + ATTR_FULL;
    if ((wrapped + ATTR_FULL).length <= limit) return wrapped + ATTR_FULL;
    if ((wrapped + ATTR_SHORT).length <= limit) return wrapped + ATTR_SHORT;
    return wrapped;
  }

  function positionTooltip(range) {
    if (!hsTooltip) return;
    var rect = range.getBoundingClientRect();
    var tooltipWidth = hsTooltip.offsetWidth || 200;
    var isMobile = window.innerWidth <= 960;
    var x = rect.left + rect.width / 2;
    var clampedX = Math.max(tooltipWidth / 2 + 8, Math.min(x, window.innerWidth - tooltipWidth / 2 - 8));
    hsTooltip.style.left = clampedX + "px";
    if (isMobile) {
      hsTooltip.style.top = (rect.bottom + window.scrollY + 10) + "px";
    } else {
      hsTooltip.style.top = (rect.top + window.scrollY - 10) + "px";
    }
  }

  function hideTooltip() {
    if (hsTooltip) hsTooltip.classList.remove("visible");
    selectedQuote = "";
  }

  function checkSelection() {
    var sel = window.getSelection();
    var text = sel ? sel.toString().trim() : "";
    var mainContent = document.querySelector(".main-content");
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
    document.addEventListener("mouseup", function (e) {
      if (hsTooltip.contains(e.target)) return;
      setTimeout(checkSelection, 10);
    });
    document.addEventListener("mousedown", function (e) {
      if (!hsTooltip.contains(e.target)) hideTooltip();
    });
    var selectionChangeTimer = null;
    document.addEventListener("selectionchange", function () {
      if (!("ontouchstart" in window)) return;
      clearTimeout(selectionChangeTimer);
      selectionChangeTimer = setTimeout(checkSelection, 300);
    });

    var hsCopy = document.getElementById("hsCopy");
    if (hsCopy) {
      hsCopy.addEventListener("click", function () {
        var text = buildShareText(selectedQuote, 0) + "\n\n" + SHARE_URL;
        navigator.clipboard.writeText(text).then(function () {
          if (hsCopiedMsg) {
            hsCopiedMsg.classList.add("show");
            setTimeout(function () { hsCopiedMsg.classList.remove("show"); }, 1500);
          }
        });
      });
    }
    var hsSMS = document.getElementById("hsSMS");
    if (hsSMS) {
      hsSMS.addEventListener("click", function () {
        var text = buildShareText(selectedQuote, 0) + "\n\n" + SHARE_URL;
        window.open("sms:?&body=" + encodeURIComponent(text));
      });
    }
    var hsX = document.getElementById("hsX");
    if (hsX) {
      hsX.addEventListener("click", function () {
        var text = buildShareText(selectedQuote, 250);
        window.open(
          "https://x.com/intent/tweet?text=" + encodeURIComponent(text) +
            "&url=" + encodeURIComponent(SHARE_URL),
          "_blank",
        );
      });
    }
    var hsFB = document.getElementById("hsFB");
    if (hsFB) {
      hsFB.addEventListener("click", function () {
        var text = buildShareText(selectedQuote, 0);
        window.open(
          "https://www.facebook.com/sharer/sharer.php?u=" +
            encodeURIComponent(SHARE_URL) + "&quote=" + encodeURIComponent(text),
          "_blank",
        );
      });
    }
    var hsIG = document.getElementById("hsIG");
    if (hsIG) {
      hsIG.addEventListener("click", function () {
        var text = buildShareText(selectedQuote, 0) + "\n\n" + SHARE_URL;
        navigator.clipboard.writeText(text).then(function () {
          window.open("https://www.instagram.com/create/story/", "_blank");
          if (hsCopiedMsg) {
            hsCopiedMsg.textContent = "Quote + link copied! Paste in your Story.";
            hsCopiedMsg.classList.add("show");
            setTimeout(function () {
              hsCopiedMsg.classList.remove("show");
              hsCopiedMsg.textContent = "Copied!";
            }, 4000);
          }
        });
      });
    }
  }
})();
