/*
 * Commonplace Book — highlight-to-save for paid members.
 *
 * Detects text selection inside article/ebook/journal content areas,
 * shows a floating "Save" tooltip, and POSTs the highlight to the
 * mo-kit worker. Paid/comped members only — the script exits early
 * if the member status isn't paid or comped.
 */
(function () {
  const {body} = document;
  const WORKER = body.getAttribute("data-kit-worker-url") || "";
  const EMAIL = body.getAttribute("data-member-email") || "";
  const STATUS = body.getAttribute("data-member-status") || "";

  if (!WORKER || !EMAIL) return;
  if (STATUS !== "paid" && STATUS !== "comped") return;

  // Content zones where highlights are saveable
  const SELECTORS = [
    ".article-content",
    ".ebook-chapter",
    ".main-content",
    ".post-content",
    ".gh-content"
  ];

  // Build the tooltip
  const tooltip = document.createElement("div");
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
  // Share image (quote-card.js) sits beside Save on essays only. The Faith
  // Received reader makes its own quote image in its own template.
  const canShare = body.classList.contains("post-template") &&
    !!window.MOQuoteCard && typeof window.MOQuoteCard.openDialog === "function";
  if (canShare) {
    tooltip.classList.add("has-share");
    tooltip.insertAdjacentHTML("beforeend",
      '<button type="button" class="commonplace-share-btn">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<rect x="3" y="4" width="18" height="16" rx="1.5"/>' +
          '<path d="M3 16l5-5 4 4 3-3 6 6"/>' +
          '<circle cx="16" cy="9" r="1.5"/>' +
        '</svg>' +
        '<span>Share image</span>' +
      '</button>');
  }
  document.body.appendChild(tooltip);

  const saveBtn = tooltip.querySelector(".commonplace-save-btn");
  const shareBtn = tooltip.querySelector(".commonplace-share-btn");
  let currentText = "";
  let hiding = false;

  function getPostId() {
    const el = document.querySelector("[data-post-id]");
    return el ? el.getAttribute("data-post-id") : "";
  }

  function getSourceTitle() {
    const og = document.querySelector('meta[property="og:title"]');
    if (og && og.content) return og.content;
    const h1 = document.querySelector(".article-title, .ebook-title, h1");
    return h1 ? (h1.textContent || "").trim() : document.title;
  }

  function getSourceAuthor() {
    const el = document.querySelector("[data-post-author]");
    if (el) return el.getAttribute("data-post-author") || "";
    const og = document.querySelector('meta[property="article:author"]');
    if (og && og.content) return og.content;
    return "";
  }

  // The card's byline. primary_author is the house account on most essays;
  // the writers are the author- tags in the byline (post.hbs .meta-authors).
  function getCardAuthor() {
    const names = [...new Set([...document.querySelectorAll(
      '.meta-authors [data-tag-slug^="author-"] .meta-author-name')]
      .map((n) => (n.textContent || "").trim()).filter(Boolean))];
    if (names.length) {
      return names.length < 3 ? names.join(" and ")
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    }
    const a = getSourceAuthor();
    return a === "Mere Orthodoxy" ? "" : a;
  }

  function getSourceUrl() {
    const canon = document.querySelector('link[rel="canonical"]');
    return canon ? canon.href : window.location.href;
  }

  function isInsideContent(node) {
    const el = node.nodeType === 3 ? node.parentElement : node;
    if (!el) return false;
    for (let i = 0; i < SELECTORS.length; i++) {
      if (el.closest(SELECTORS[i])) return true;
    }
    return false;
  }

  function showTooltip(rect) {
    const scrollX = window.pageXOffset || window.scrollX || 0;
    const scrollY = window.pageYOffset || window.scrollY || 0;

    const tooltipWidth = tooltip.offsetWidth || 90;
    const tooltipHeight = tooltip.offsetHeight || 38;

    let top, left;
    const isMobile = window.innerWidth <= 960;

    left = rect.left + scrollX + (rect.width / 2) - (tooltipWidth / 2);
    left = Math.max(8, Math.min(left, document.documentElement.clientWidth - tooltipWidth - 8));

    if (isMobile) {
      // Clear of the iOS selection handle that hangs below the last line.
      top = rect.bottom + scrollY + 28;
    } else {
      top = rect.top + scrollY - tooltipHeight - 8;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add("visible");
    tooltip.classList.toggle("below", isMobile);
    hiding = false;
  }

  function hideTooltip() {
    tooltip.classList.remove("visible");
    // Park it at the corner: left where it was last shown, the wider
    // Save + Share bar can hang past the edge after a phone turns and
    // widen the page.
    tooltip.style.left = "0px";
    tooltip.style.top = "0px";
    currentText = "";
    hiding = false;
  }

  function checkSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { hideTooltip(); return; }

    const text = sel.toString().trim();
    if (text.length < 3) { hideTooltip(); return; }

    const range = sel.getRangeAt(0);
    if (!isInsideContent(range.startContainer) && !isInsideContent(range.endContainer)) {
      hideTooltip();
      return;
    }

    // Don't show if selection is inside the tooltip itself
    const anc = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
    if (anc && anc.closest(".commonplace-tooltip")) return;

    currentText = text;
    const rect = range.getBoundingClientRect();
    showTooltip(rect);
  }

  // Desktop: mouseup
  let mouseTimer;
  document.addEventListener("mouseup", (e) => {
    if (e.target.closest(".commonplace-tooltip")) return;
    clearTimeout(mouseTimer);
    mouseTimer = setTimeout(checkSelection, 10);
  });

  // Mobile: selectionchange
  let selTimer;
  document.addEventListener("selectionchange", () => {
    clearTimeout(selTimer);
    selTimer = setTimeout(checkSelection, 300);
  });

  // Hide on click outside
  document.addEventListener("mousedown", (e) => {
    if (!e.target.closest(".commonplace-tooltip")) {
      hiding = true;
      setTimeout(() => { if (hiding) hideTooltip(); }, 200);
    }
  });

  // Share image handler
  if (shareBtn) {
    shareBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!currentText) return;
      const quote = currentText;
      hideTooltip();
      window.MOQuoteCard.openDialog({
        brand: "mo",
        quote,
        author: getCardAuthor(),
        cite: getSourceTitle(),
        url: getSourceUrl(),
      });
    });
  }

  // Save handler
  saveBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentText || saveBtn.disabled) return;

    saveBtn.disabled = true;
    const label = saveBtn.querySelector("span");
    label.textContent = "Saving…";

    // MOAuth.fetch attaches the JWT inside its closure; worker derives
    // email from payload.sub. Drop email from body.
    window.MOAuth.fetch(`${WORKER.replace(/\/$/, "")}/commonplace/add`, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: currentText,
        postId: getPostId(),
        sourceTitle: getSourceTitle(),
        sourceAuthor: getSourceAuthor(),
        sourceUrl: getSourceUrl(),
      }),
    })
      .then((r) => {
        if (r.ok) {
          label.textContent = "Saved!";
          setTimeout(() => {
            hideTooltip();
            label.textContent = "Save";
            saveBtn.disabled = false;
            window.getSelection().removeAllRanges();
          }, 1200);
        } else {
          throw new Error("save failed");
        }
      })
      .catch(() => {
        label.textContent = "Error";
        setTimeout(() => {
          label.textContent = "Save";
          saveBtn.disabled = false;
        }, 1500);
      });
  });
})();
