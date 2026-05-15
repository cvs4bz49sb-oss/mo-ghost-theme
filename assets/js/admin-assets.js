(function () {
  "use strict";

  var root = document.querySelector("[data-asset-creator]");
  if (!root) return;

  var siteUrl = (root.dataset.siteUrl || "").replace(/\/$/, "");
  var contentApiKey = root.dataset.contentApiKey || "";

  var canvas = root.querySelector("[data-asset-canvas]");
  var ctx = canvas.getContext("2d");

  // Dimensions per mode.
  var MODES = { carousel: { w: 1080, h: 1350 }, story: { w: 1080, h: 1920 } };
  var mode = "carousel";

  // Panels (carousel can have up to 12).
  var panels = [makePanel()];
  var currentPanel = 0;

  // DOM refs.
  var $modeButtons = root.querySelectorAll("[data-asset-mode]");
  var $templates = root.querySelectorAll("[data-template]");
  var $bgSwatches = root.querySelectorAll("[data-bg]");
  var $fgSwatches = root.querySelectorAll("[data-fg]");
  var $bgCustom = root.querySelector("[data-asset-bg-custom]");
  var $fgCustom = root.querySelector("[data-asset-fg-custom]");
  var $titleField = root.querySelector('[data-asset-field="title"]');
  var $subtitleField = root.querySelector('[data-asset-field="subtitle"]');
  var $bodyField = root.querySelector('[data-asset-field="body"]');
  var $fontSlider = root.querySelector("[data-asset-fontsize]");
  var $fontVal = root.querySelector("[data-asset-fontsize-val]");
  var $watermark = root.querySelector("[data-asset-watermark]");
  var $overlaySlider = root.querySelector("[data-asset-overlay]");
  var $overlayVal = root.querySelector("[data-asset-overlay-val]");
  var $urlInput = root.querySelector("[data-asset-url]");
  var $pullBtn = root.querySelector("[data-asset-pull]");
  var $panelStrip = root.querySelector("[data-asset-panel-strip]");
  var $panelAdd = root.querySelector("[data-asset-panel-add]");
  var $panelRemove = root.querySelector("[data-asset-panel-remove]");
  var $panelsBar = root.querySelector("[data-asset-panels]");
  var $exportBtn = root.querySelector("[data-asset-export]");
  var $exportAllBtn = root.querySelector("[data-asset-export-all]");
  var $imageUpload = root.querySelector("[data-asset-image-upload]");
  var $imageFile = root.querySelector("[data-asset-image-file]");
  var $imageClear = root.querySelector("[data-asset-image-clear]");
  var $canvasWrap = root.querySelector("[data-asset-canvas-wrap]");

  function makePanel() {
    return {
      template: "title-card",
      bg: "#1d1b18",
      fg: "#ffffff",
      title: "",
      subtitle: "",
      body: "",
      fontSize: 48,
      watermark: true,
      bgImage: null,
      overlayOpacity: 60
    };
  }

  function p() { return panels[currentPanel]; }

  // ---- Mode switching ----
  $modeButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      mode = btn.dataset.assetMode;
      $modeButtons.forEach(function (b) { b.classList.toggle("is-active", b === btn); });
      var dim = MODES[mode];
      canvas.width = dim.w;
      canvas.height = dim.h;
      if (mode === "story") {
        $panelsBar.hidden = true;
        panels = [panels[currentPanel] || makePanel()];
        currentPanel = 0;
      } else {
        $panelsBar.hidden = false;
      }
      rebuildPanelStrip();
      render();
    });
  });

  // ---- Template switching ----
  $templates.forEach(function (btn) {
    btn.addEventListener("click", function () {
      $templates.forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      p().template = btn.dataset.template;
      render();
    });
  });

  // ---- Background color ----
  $bgSwatches.forEach(function (btn) {
    btn.addEventListener("click", function () {
      $bgSwatches.forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      p().bg = btn.dataset.bg;
      $bgCustom.value = p().bg;
      render();
    });
  });
  $bgCustom.addEventListener("input", function () {
    $bgSwatches.forEach(function (b) { b.classList.remove("is-active"); });
    p().bg = $bgCustom.value;
    render();
  });

  // ---- Text color ----
  $fgSwatches.forEach(function (btn) {
    btn.addEventListener("click", function () {
      $fgSwatches.forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      p().fg = btn.dataset.fg;
      $fgCustom.value = p().fg;
      render();
    });
  });
  $fgCustom.addEventListener("input", function () {
    $fgSwatches.forEach(function (b) { b.classList.remove("is-active"); });
    p().fg = $fgCustom.value;
    render();
  });

  // ---- Content fields ----
  $titleField.addEventListener("input", function () { p().title = $titleField.value; render(); });
  $subtitleField.addEventListener("input", function () { p().subtitle = $subtitleField.value; render(); });
  $bodyField.addEventListener("input", function () { p().body = $bodyField.value; render(); });
  $fontSlider.addEventListener("input", function () {
    p().fontSize = parseInt($fontSlider.value, 10);
    $fontVal.textContent = $fontSlider.value;
    render();
  });
  $watermark.addEventListener("change", function () { p().watermark = $watermark.checked; render(); });
  $overlaySlider.addEventListener("input", function () {
    p().overlayOpacity = parseInt($overlaySlider.value, 10);
    $overlayVal.textContent = $overlaySlider.value + "%";
    render();
  });

  // ---- Background image ----
  $imageUpload.addEventListener("click", function () { $imageFile.click(); });
  $imageFile.addEventListener("change", function () {
    var file = $imageFile.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        p().bgImage = img;
        $imageClear.hidden = false;
        render();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
  $imageClear.addEventListener("click", function () {
    p().bgImage = null;
    $imageClear.hidden = true;
    $imageFile.value = "";
    render();
  });

  // ---- Article URL pull ----
  $pullBtn.addEventListener("click", pullArticle);

  function pullArticle() {
    var url = $urlInput.value.trim();
    if (!url || !contentApiKey) return;
    var slug = extractSlug(url);
    if (!slug) return;
    $pullBtn.disabled = true;
    $pullBtn.textContent = "Pulling...";
    var apiUrl = siteUrl + "/ghost/api/content/posts/slug/" + slug + "/?key=" + contentApiKey + "&fields=title,custom_excerpt,feature_image,primary_author&include=authors";
    fetch(apiUrl)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var post = data.posts && data.posts[0];
        if (!post) return;
        p().title = post.title || "";
        p().subtitle = (post.primary_author && post.primary_author.name) || "";
        $titleField.value = p().title;
        $subtitleField.value = p().subtitle;
        if (post.custom_excerpt) {
          p().body = post.custom_excerpt;
          $bodyField.value = p().body;
        }
        if (post.feature_image) loadBgImage(post.feature_image);
        render();
      })
      .catch(function (err) { console.error("Pull failed:", err); })
      .finally(function () { $pullBtn.disabled = false; $pullBtn.textContent = "Pull"; });
  }

  function extractSlug(url) {
    try {
      var u = new URL(url, window.location.origin);
      var parts = u.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1] || "";
    } catch (e) { return ""; }
  }

  function loadBgImage(src) {
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      p().bgImage = img;
      $imageClear.hidden = false;
      render();
    };
    img.src = src;
  }

  // ---- Panel management (carousel) ----
  $panelAdd.addEventListener("click", function () {
    if (panels.length >= 12) return;
    panels.push(makePanel());
    currentPanel = panels.length - 1;
    rebuildPanelStrip();
    syncFields();
    render();
  });

  $panelRemove.addEventListener("click", function () {
    if (panels.length <= 1) return;
    panels.splice(currentPanel, 1);
    if (currentPanel >= panels.length) currentPanel = panels.length - 1;
    rebuildPanelStrip();
    syncFields();
    render();
  });

  function rebuildPanelStrip() {
    $panelStrip.innerHTML = "";
    panels.forEach(function (_, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "asset-panel-thumb" + (i === currentPanel ? " is-active" : "");
      btn.textContent = i + 1;
      btn.dataset.panelIdx = i;
      btn.addEventListener("click", function () {
        saveFields();
        currentPanel = i;
        rebuildPanelStrip();
        syncFields();
        render();
      });
      $panelStrip.appendChild(btn);
    });
  }

  function saveFields() {
    var panel = p();
    panel.title = $titleField.value;
    panel.subtitle = $subtitleField.value;
    panel.body = $bodyField.value;
    panel.fontSize = parseInt($fontSlider.value, 10);
    panel.watermark = $watermark.checked;
    panel.overlayOpacity = parseInt($overlaySlider.value, 10);
  }

  function syncFields() {
    var panel = p();
    $titleField.value = panel.title;
    $subtitleField.value = panel.subtitle;
    $bodyField.value = panel.body;
    $fontSlider.value = panel.fontSize;
    $fontVal.textContent = panel.fontSize;
    $watermark.checked = panel.watermark;
    $overlaySlider.value = panel.overlayOpacity;
    $overlayVal.textContent = panel.overlayOpacity + "%";
    $bgCustom.value = panel.bg;
    $fgCustom.value = panel.fg;
    $imageClear.hidden = !panel.bgImage;

    $templates.forEach(function (b) { b.classList.toggle("is-active", b.dataset.template === panel.template); });
    $bgSwatches.forEach(function (b) { b.classList.toggle("is-active", b.dataset.bg === panel.bg); });
    $fgSwatches.forEach(function (b) { b.classList.toggle("is-active", b.dataset.fg === panel.fg); });
  }

  // ---- Canvas rendering ----
  function render() {
    var panel = p();
    var w = canvas.width;
    var h = canvas.height;
    var pad = 80;

    ctx.clearRect(0, 0, w, h);

    // Background color.
    ctx.fillStyle = panel.bg;
    ctx.fillRect(0, 0, w, h);

    // Background image with overlay.
    if (panel.bgImage) {
      drawCoverImage(panel.bgImage, w, h);
      ctx.fillStyle = panel.bg;
      ctx.globalAlpha = panel.overlayOpacity / 100;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    // Dispatch to template renderer.
    switch (panel.template) {
      case "title-card": renderTitleCard(panel, w, h, pad); break;
      case "quote-card": renderQuoteCard(panel, w, h, pad); break;
      case "image-card": renderImageCard(panel, w, h, pad); break;
      case "text-card":  renderTextCard(panel, w, h, pad);  break;
      case "cta-card":   renderCtaCard(panel, w, h, pad);   break;
      default:           break;
    }

    // Watermark.
    if (panel.watermark) {
      ctx.font = "600 14px 'Source Serif Pro', Georgia, serif";
      ctx.fillStyle = panel.fg;
      ctx.globalAlpha = 0.35;
      ctx.textAlign = "center";
      ctx.fillText("MERE ORTHODOXY", w / 2, h - 40);
      ctx.globalAlpha = 1;
    }
  }

  function drawCoverImage(img, w, h) {
    var iw = img.naturalWidth;
    var ih = img.naturalHeight;
    var scale = Math.max(w / iw, h / ih);
    var sw = iw * scale;
    var sh = ih * scale;
    ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
  }

  // ---- Template renderers ----

  function renderTitleCard(panel, w, h, pad) {
    var fg = panel.fg;
    var fs = panel.fontSize;
    var centerY = h * 0.42;

    // Decorative line above title.
    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, centerY - fs - 20);
    ctx.lineTo(w - pad, centerY - fs - 20);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Title.
    ctx.font = "italic " + fs + "px 'IM Fell Great Primer', Georgia, serif";
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    wrapText(panel.title || "Article Title", w / 2, centerY, w - pad * 2, fs * 1.15);

    // Subtitle / author.
    if (panel.subtitle) {
      ctx.font = "400 22px 'Source Serif Pro', Georgia, serif";
      ctx.globalAlpha = 0.7;
      var titleLines = getWrappedLines(panel.title || "Article Title", w - pad * 2, fs + "px 'IM Fell Great Primer', Georgia, serif");
      var subY = centerY + titleLines.length * (fs * 1.15) + 30;
      ctx.fillText(panel.subtitle, w / 2, subY);
      ctx.globalAlpha = 1;
    }

    // Decorative line below.
    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(w * 0.35, h * 0.78);
    ctx.lineTo(w * 0.65, h * 0.78);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function renderQuoteCard(panel, w, h, pad) {
    var fg = panel.fg;
    var fs = panel.fontSize;

    // Large opening quotation mark.
    ctx.font = "italic 200px 'IM Fell Great Primer', Georgia, serif";
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.15;
    ctx.textAlign = "left";
    ctx.fillText("“", pad - 20, 240);
    ctx.globalAlpha = 1;

    // Quote body.
    ctx.font = "italic " + fs + "px 'IM Fell Great Primer', Georgia, serif";
    ctx.fillStyle = fg;
    ctx.textAlign = "left";
    wrapText(panel.body || "Enter a quote...", pad, h * 0.3, w - pad * 2, fs * 1.35, "left");

    // Attribution.
    if (panel.subtitle) {
      ctx.font = "600 20px 'Source Serif Pro', Georgia, serif";
      ctx.globalAlpha = 0.65;
      ctx.textAlign = "left";
      ctx.fillText("— " + panel.subtitle, pad, h * 0.85);
      ctx.globalAlpha = 1;
    }
  }

  function renderImageCard(panel, w, h, pad) {
    var fg = panel.fg;
    var fs = Math.min(panel.fontSize, 56);

    // Title at bottom third.
    ctx.font = "italic " + fs + "px 'IM Fell Great Primer', Georgia, serif";
    ctx.fillStyle = fg;
    ctx.textAlign = "left";
    wrapText(panel.title || "Title", pad, h * 0.68, w - pad * 2, fs * 1.2, "left");

    // Subtitle.
    if (panel.subtitle) {
      ctx.font = "400 20px 'Source Serif Pro', Georgia, serif";
      ctx.globalAlpha = 0.7;
      ctx.fillText(panel.subtitle, pad, h * 0.90);
      ctx.globalAlpha = 1;
    }
  }

  function renderTextCard(panel, w, h, pad) {
    var fg = panel.fg;
    var fs = Math.max(panel.fontSize * 0.55, 20);

    ctx.font = "400 " + fs + "px 'Source Serif Pro', Georgia, serif";
    ctx.fillStyle = fg;
    ctx.textAlign = "left";
    wrapText(panel.body || "Enter body text...", pad, pad + fs, w - pad * 2, fs * 1.6, "left");
  }

  function renderCtaCard(panel, w, h, pad) {
    var fg = panel.fg;
    var bg = panel.bg;

    // "Read more at" label.
    ctx.font = "600 16px 'Source Serif Pro', Georgia, serif";
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.5;
    ctx.textAlign = "center";
    ctx.fillText("READ MORE AT", w / 2, h * 0.38);
    ctx.globalAlpha = 1;

    // Site name.
    ctx.font = "italic 52px 'IM Fell Great Primer', Georgia, serif";
    ctx.fillStyle = fg;
    ctx.fillText("Mere Orthodoxy", w / 2, h * 0.48);

    // CTA button shape.
    var btnW = 340;
    var btnH = 56;
    var btnX = (w - btnW) / 2;
    var btnY = h * 0.58;
    ctx.fillStyle = fg;
    ctx.beginPath();
    roundRect(ctx, btnX, btnY, btnW, btnH, 28);
    ctx.fill();

    ctx.font = "600 18px 'Source Serif Pro', Georgia, serif";
    ctx.fillStyle = bg;
    ctx.fillText(panel.title || "mereorthodoxy.com", w / 2, btnY + 36);
  }

  // ---- Text wrapping ----
  function wrapText(text, x, y, maxWidth, lineHeight, align) {
    align = align || "center";
    ctx.textAlign = align;
    var lines = getWrappedLines(text, maxWidth);
    for (var i = 0; i < lines.length; i++) {
      var lx = align === "left" ? x : align === "right" ? x + maxWidth : x;
      ctx.fillText(lines[i], lx, y + i * lineHeight);
    }
  }

  function getWrappedLines(text, maxWidth) {
    var words = text.split(" ");
    var lines = [];
    var line = "";
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  // ---- Export ----
  $exportBtn.addEventListener("click", function () {
    saveFields();
    render();
    downloadCanvas("mo-asset-" + (currentPanel + 1) + ".png");
  });

  $exportAllBtn.addEventListener("click", function () {
    saveFields();
    for (var i = 0; i < panels.length; i++) {
      currentPanel = i;
      syncFields();
      render();
      downloadCanvas("mo-asset-" + (i + 1) + ".png");
    }
    rebuildPanelStrip();
  });

  function downloadCanvas(filename) {
    var link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  // ---- Initial render ----
  render();
})();
