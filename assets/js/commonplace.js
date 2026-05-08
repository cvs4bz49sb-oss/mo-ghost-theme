/*
 * Commonplace Book — highlight-to-save for paid members.
 *
 * Detects text selection inside article/ebook/journal content areas,
 * shows a floating "Save" tooltip, and POSTs the highlight to the
 * mo-kit worker. Paid/comped members only — the script exits early
 * if the member status isn't paid or comped.
 */
(function () {
  var body = document.body;
  var WORKER = body.getAttribute("data-kit-worker-url") || "";
  var EMAIL = body.getAttribute("data-member-email") || "";
  var STATUS = body.getAttribute("data-member-status") || "";

  if (!WORKER || !EMAIL) return;
  if (STATUS !== "paid" && STATUS !== "comped") return;

  // Content zones where highlights are saveable
  var SELECTORS = [
    ".article-content",
    ".ebook-chapter",
    ".main-content",
    ".post-content",
    ".gh-content"
  ];

  // Build the tooltip
  var tooltip = document.createElement("div");
  tooltip.className = "commonplace-tooltip";
  tooltip.innerHTML =
    '<button type="button" class="commonplace-save-btn">' +
      '<svg width="14" height="14" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M40 8 Q46 18 36 26 Q24 30 16 34 Q20 22 28 14 Q34 10 40 8 Z"/>' +
        '<path d="M38 10 L18 32" stroke-width="1"/>' +
        '<path d="M16 34 L12 38"/>' +
        '<line x1="12" y1="42" x2="32" y2="42"/>' +
      '</svg>' +
      '<span>Save</span>' +
    '</button>';
  document.body.appendChild(tooltip);

  var saveBtn = tooltip.querySelector(".commonplace-save-btn");
  var currentText = "";
  var hiding = false;

  function getPostId() {
    var el = document.querySelector("[data-post-id]");
    return el ? el.getAttribute("data-post-id") : "";
  }

  function getSourceTitle() {
    var og = document.querySelector('meta[property="og:title"]');
    if (og && og.content) return og.content;
    var h1 = document.querySelector(".article-title, .ebook-title, h1");
    return h1 ? (h1.textContent || "").trim() : document.title;
  }

  function getSourceUrl() {
    var canon = document.querySelector('link[rel="canonical"]');
    return canon ? canon.href : window.location.href;
  }

  function isInsideContent(node) {
    var el = node.nodeType === 3 ? node.parentElement : node;
    if (!el) return false;
    for (var i = 0; i < SELECTORS.length; i++) {
      if (el.closest(SELECTORS[i])) return true;
    }
    return false;
  }

  function showTooltip(rect) {
    var scrollX = window.pageXOffset || window.scrollX || 0;
    var scrollY = window.pageYOffset || window.scrollY || 0;

    var tooltipWidth = 90;
    var tooltipHeight = 38;

    var top, left;
    var isMobile = window.innerWidth <= 960;

    left = rect.left + scrollX + (rect.width / 2) - (tooltipWidth / 2);
    left = Math.max(8, Math.min(left, document.documentElement.clientWidth - tooltipWidth - 8));

    if (isMobile) {
      top = rect.bottom + scrollY + 8;
    } else {
      top = rect.top + scrollY - tooltipHeight - 8;
    }

    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
    tooltip.classList.add("visible");
    tooltip.classList.toggle("below", isMobile);
    hiding = false;
  }

  function hideTooltip() {
    tooltip.classList.remove("visible");
    currentText = "";
    hiding = false;
  }

  function checkSelection() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { hideTooltip(); return; }

    var text = sel.toString().trim();
    if (text.length < 3) { hideTooltip(); return; }

    var range = sel.getRangeAt(0);
    if (!isInsideContent(range.startContainer) && !isInsideContent(range.endContainer)) {
      hideTooltip();
      return;
    }

    // Don't show if selection is inside the tooltip itself
    var anc = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
    if (anc && anc.closest(".commonplace-tooltip")) return;

    currentText = text;
    var rect = range.getBoundingClientRect();
    showTooltip(rect);
  }

  // Desktop: mouseup
  var mouseTimer;
  document.addEventListener("mouseup", function (e) {
    if (e.target.closest(".commonplace-tooltip")) return;
    clearTimeout(mouseTimer);
    mouseTimer = setTimeout(checkSelection, 10);
  });

  // Mobile: selectionchange
  var selTimer;
  document.addEventListener("selectionchange", function () {
    clearTimeout(selTimer);
    selTimer = setTimeout(checkSelection, 300);
  });

  // Hide on click outside
  document.addEventListener("mousedown", function (e) {
    if (!e.target.closest(".commonplace-tooltip")) {
      hiding = true;
      setTimeout(function () { if (hiding) hideTooltip(); }, 200);
    }
  });

  // Save handler
  saveBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (!currentText || saveBtn.disabled) return;

    saveBtn.disabled = true;
    var label = saveBtn.querySelector("span");
    label.textContent = "Saving…";

    fetch(WORKER.replace(/\/$/, "") + "/commonplace/add", {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: EMAIL,
        text: currentText,
        postId: getPostId(),
        sourceTitle: getSourceTitle(),
        sourceUrl: getSourceUrl(),
      }),
    })
      .then(function (r) {
        if (r.ok) {
          label.textContent = "Saved!";
          setTimeout(function () {
            hideTooltip();
            label.textContent = "Save";
            saveBtn.disabled = false;
            window.getSelection().removeAllRanges();
          }, 1200);
        } else {
          throw new Error("save failed");
        }
      })
      .catch(function () {
        label.textContent = "Error";
        setTimeout(function () {
          label.textContent = "Save";
          saveBtn.disabled = false;
        }, 1500);
      });
  });
})();
