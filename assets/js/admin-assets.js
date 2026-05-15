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
  var $showBody = root.querySelector("[data-asset-show-body]");
  var $wordmarkSlider = root.querySelector("[data-asset-wordmark-size]");
  var $wordmarkVal = root.querySelector("[data-asset-wordmark-size-val]");
  var $authorSlider = root.querySelector("[data-asset-author-size]");
  var $authorVal = root.querySelector("[data-asset-author-size-val]");
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
      wordmarkSize: 13,
      authorSize: 22,
      watermark: true,
      showBody: true,
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
        var sp = panels[0];
        if (sp.fontSize < 64) sp.fontSize = 72;
        if (sp.wordmarkSize < 16) sp.wordmarkSize = 18;
        if (sp.authorSize < 28) sp.authorSize = 32;
      } else {
        $panelsBar.hidden = false;
      }
      syncFields();
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
  $showBody.addEventListener("change", function () { p().showBody = $showBody.checked; render(); });
  $wordmarkSlider.addEventListener("input", function () {
    p().wordmarkSize = parseInt($wordmarkSlider.value, 10);
    $wordmarkVal.textContent = $wordmarkSlider.value;
    render();
  });
  $authorSlider.addEventListener("input", function () {
    p().authorSize = parseInt($authorSlider.value, 10);
    $authorVal.textContent = $authorSlider.value;
    render();
  });
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
    var apiUrl = siteUrl + "/ghost/api/content/posts/slug/" + slug +
      "/?key=" + contentApiKey + "&include=authors,tags&formats=plaintext";
    fetch(apiUrl)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var post = data.posts && data.posts[0];
        if (!post) return;
        p().title = post.title || "";

        var allTags = post.tags || [];
        var authorTags = allTags
          .filter(function (t) { return t.slug && t.slug.indexOf("author-") === 0; })
          .map(function (t) { return t.name; });
        p().subtitle = authorTags.length
          ? authorTags.join(", ")
          : (post.primary_author && post.primary_author.name) || "";

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
    panel.wordmarkSize = parseInt($wordmarkSlider.value, 10);
    panel.authorSize = parseInt($authorSlider.value, 10);
    panel.watermark = $watermark.checked;
    panel.showBody = $showBody.checked;
    panel.overlayOpacity = parseInt($overlaySlider.value, 10);
  }

  function syncFields() {
    var panel = p();
    $titleField.value = panel.title;
    $subtitleField.value = panel.subtitle;
    $bodyField.value = panel.body;
    $fontSlider.value = panel.fontSize;
    $fontVal.textContent = panel.fontSize;
    $wordmarkSlider.value = panel.wordmarkSize;
    $wordmarkVal.textContent = panel.wordmarkSize;
    $authorSlider.value = panel.authorSize;
    $authorVal.textContent = panel.authorSize;
    $watermark.checked = panel.watermark;
    $showBody.checked = panel.showBody;
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

    // Background color (full canvas).
    ctx.fillStyle = panel.bg;
    ctx.fillRect(0, 0, w, h);

    // Full-bleed image for templates that overlay text on image.
    var fullBleed = (panel.template === "image-card" || panel.template === "blank");
    if (panel.bgImage && fullBleed) {
      drawCoverImage(panel.bgImage, 0, 0, w, h);
      ctx.fillStyle = panel.bg;
      ctx.globalAlpha = panel.overlayOpacity / 100;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    switch (panel.template) {
      case "title-card": renderTitleCard(panel, w, h, pad); break;
      case "quote-card": renderQuoteCard(panel, w, h, pad); break;
      case "image-card": renderImageCard(panel, w, h, pad); break;
      case "text-card":  renderTextCard(panel, w, h, pad);  break;
      case "cta-card":   renderCtaCard(panel, w, h, pad);   break;
      default:           break;
    }

    if (mode === "story") drawSafetyZones(w, h);
  }

  /* -- Helpers --------------------------------------------------------- */

  function drawCoverImage(img, rx, ry, rw, rh) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();
    var iw = img.naturalWidth;
    var ih = img.naturalHeight;
    var scale = Math.max(rw / iw, rh / ih);
    var sw = iw * scale;
    var sh = ih * scale;
    ctx.drawImage(img, rx + (rw - sw) / 2, ry + (rh - sh) / 2, sw, sh);
    ctx.restore();
  }

  function hexToRgba(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  function drawTrackedText(text, x, y, tracking, align) {
    align = align || "center";
    var oldAlign = ctx.textAlign;
    ctx.textAlign = "left";
    var chars = text.split("");
    var totalW = 0;
    for (var i = 0; i < chars.length; i++) {
      totalW += ctx.measureText(chars[i]).width;
      if (i < chars.length - 1) totalW += tracking;
    }
    var sx;
    if (align === "center") sx = x - totalW / 2;
    else if (align === "right") sx = x - totalW;
    else sx = x;
    for (var j = 0; j < chars.length; j++) {
      ctx.fillText(chars[j], sx, y);
      sx += ctx.measureText(chars[j]).width + tracking;
    }
    ctx.textAlign = oldAlign;
  }

  function drawSafetyZones(w, h) {
    ctx.save();
    ctx.strokeStyle = "#ff3b30";
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(0, 200); ctx.lineTo(w, 200);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, h - 200); ctx.lineTo(w, h - 200);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawMark(panel, w, h, pad, position) {
    if (!panel.watermark) return;
    ctx.save();
    ctx.font = "600 " + panel.wordmarkSize + "px 'Source Serif Pro', Georgia, serif";
    ctx.fillStyle = panel.fg;
    ctx.globalAlpha = 0.32;
    if (position === "top-right") {
      drawTrackedText("MERE ORTHODOXY", w - pad, pad + 16, 3.5, "right");
    } else if (position === "bottom-center") {
      drawTrackedText("MERE ORTHODOXY", w / 2, h - 44, 3.5, "center");
    } else {
      drawTrackedText("MERE ORTHODOXY", w / 2, pad + 16, 3.5, "center");
    }
    ctx.restore();
  }

  /* -- Template renderers ----------------------------------------------- */

  function renderTitleCard(panel, w, h, pad) {
    var fg = panel.fg;
    var fs = panel.fontSize;

    if (panel.bgImage) {
      // Split layout: hero image top, text band bottom.
      var splitRatio = mode === "story" ? 0.48 : 0.52;
      var imgH = Math.round(h * splitRatio);
      var gradH = 100;

      drawCoverImage(panel.bgImage, 0, 0, w, imgH + gradH);

      // Solid text band.
      ctx.fillStyle = panel.bg;
      ctx.fillRect(0, imgH, w, h - imgH);

      // Gradient blend from image into band.
      var grad = ctx.createLinearGradient(0, imgH - 20, 0, imgH + gradH);
      grad.addColorStop(0, hexToRgba(panel.bg, 0));
      grad.addColorStop(1, hexToRgba(panel.bg, 1));
      ctx.fillStyle = grad;
      ctx.fillRect(0, imgH - 20, w, gradH + 20);

      // Wordmark in band.
      if (panel.watermark) {
        ctx.save();
        ctx.font = "600 " + panel.wordmarkSize + "px 'Source Serif Pro', Georgia, serif";
        ctx.fillStyle = fg;
        ctx.globalAlpha = 0.32;
        drawTrackedText("MERE ORTHODOXY", w / 2, imgH + 52, 3.5, "center");
        ctx.restore();
      }

      // Title.
      ctx.font = "italic " + fs + "px 'IM Fell Great Primer', Georgia, serif";
      ctx.fillStyle = fg;
      ctx.textAlign = "center";
      var titleY = imgH + 105;
      var lines = getWrappedLines(panel.title || "Article Title", w - pad * 2);
      var lineH = fs * 1.15;
      for (var i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], w / 2, titleY + i * lineH);
      }
      var titleBottom = titleY + (lines.length - 1) * lineH;

      // Hairline.
      var hairY = titleBottom + 40;
      ctx.strokeStyle = fg;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w * 0.28, hairY);
      ctx.lineTo(w * 0.72, hairY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Author.
      if (panel.subtitle) {
        ctx.font = "400 " + panel.authorSize + "px 'Source Serif Pro', Georgia, serif";
        ctx.fillStyle = fg;
        ctx.globalAlpha = 0.6;
        ctx.textAlign = "center";
        ctx.fillText(panel.subtitle, w / 2, hairY + 38);
        ctx.globalAlpha = 1;
      }
    } else {
      // No image: elegant centered text.
      drawMark(panel, w, h, pad, "top-center");

      // Top hairline.
      ctx.strokeStyle = fg;
      ctx.globalAlpha = 0.12;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, h * 0.16);
      ctx.lineTo(w - pad, h * 0.16);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Title (vertically centered).
      ctx.font = "italic " + fs + "px 'IM Fell Great Primer', Georgia, serif";
      ctx.fillStyle = fg;
      ctx.textAlign = "center";
      var noImgLines = getWrappedLines(panel.title || "Article Title", w - pad * 2);
      var noImgLineH = fs * 1.15;
      var totalH = noImgLines.length * noImgLineH;
      var originY = (h - totalH) / 2 + noImgLineH * 0.3;
      for (var j = 0; j < noImgLines.length; j++) {
        ctx.fillText(noImgLines[j], w / 2, originY + j * noImgLineH);
      }
      var noImgBottom = originY + (noImgLines.length - 1) * noImgLineH;

      // Bottom hairline.
      ctx.strokeStyle = fg;
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.moveTo(w * 0.22, noImgBottom + 50);
      ctx.lineTo(w * 0.78, noImgBottom + 50);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Author.
      if (panel.subtitle) {
        ctx.font = "400 " + panel.authorSize + "px 'Source Serif Pro', Georgia, serif";
        ctx.fillStyle = fg;
        ctx.globalAlpha = 0.55;
        ctx.textAlign = "center";
        ctx.fillText(panel.subtitle, w / 2, noImgBottom + 90);
        ctx.globalAlpha = 1;
      }
    }
  }

  function renderQuoteCard(panel, w, h, pad) {
    var fg = panel.fg;
    var fs = panel.fontSize;

    drawMark(panel, w, h, pad, "top-right");

    // Large opening quotation mark.
    ctx.font = "italic 240px 'IM Fell Great Primer', Georgia, serif";
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.08;
    ctx.textAlign = "left";
    ctx.fillText("“", pad - 30, pad + 220);
    ctx.globalAlpha = 1;

    // Quote text.
    if (panel.showBody !== false) {
      ctx.font = "italic " + fs + "px 'IM Fell Great Primer', Georgia, serif";
      ctx.fillStyle = fg;
      ctx.textAlign = "left";
      var qLines = getWrappedLines(panel.body || "Enter a quote…", w - pad * 2);
      var qLineH = fs * 1.4;
      var qStartY = Math.max(pad + 250, h * 0.30);
      for (var i = 0; i < qLines.length; i++) {
        ctx.fillText(qLines[i], pad, qStartY + i * qLineH);
      }
    }

    // Hairline near bottom.
    var hairY = h - pad - 100;
    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, hairY);
    ctx.lineTo(w * 0.45, hairY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Attribution.
    if (panel.subtitle) {
      ctx.font = "600 21px 'Source Serif Pro', Georgia, serif";
      ctx.fillStyle = fg;
      ctx.globalAlpha = 0.6;
      ctx.textAlign = "left";
      ctx.fillText("— " + panel.subtitle, pad, hairY + 38);
      ctx.globalAlpha = 1;
    }

    // Source.
    if (panel.title && panel.subtitle) {
      ctx.font = "italic 17px 'Source Serif Pro', Georgia, serif";
      ctx.fillStyle = fg;
      ctx.globalAlpha = 0.4;
      ctx.textAlign = "left";
      ctx.fillText(panel.title, pad + 24, hairY + 68);
      ctx.globalAlpha = 1;
    }
  }

  function renderImageCard(panel, w, h, pad) {
    var fs = Math.min(panel.fontSize, 56);

    // Full-bleed image already drawn by render(). Add gradient at bottom.
    if (panel.bgImage) {
      var gradStart = h * 0.45;
      var grad = ctx.createLinearGradient(0, gradStart, 0, h);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(0.5, "rgba(0,0,0,0.35)");
      grad.addColorStop(1, "rgba(0,0,0,0.8)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, gradStart, w, h - gradStart);
    }

    var textColor = panel.bgImage ? "#ffffff" : panel.fg;

    // Wordmark top-right.
    if (panel.watermark) {
      ctx.save();
      ctx.font = "600 " + panel.wordmarkSize + "px 'Source Serif Pro', Georgia, serif";
      ctx.fillStyle = textColor;
      ctx.globalAlpha = 0.35;
      drawTrackedText("MERE ORTHODOXY", w - pad, pad + 16, 3.5, "right");
      ctx.restore();
    }

    // Title at bottom.
    ctx.font = "italic " + fs + "px 'IM Fell Great Primer', Georgia, serif";
    ctx.fillStyle = textColor;
    ctx.textAlign = "left";
    var imgLines = getWrappedLines(panel.title || "Title", w - pad * 2);
    var imgLineH = fs * 1.15;
    var titleY = h - pad - 35;
    if (panel.subtitle) titleY -= 40;
    titleY -= (imgLines.length - 1) * imgLineH;
    for (var i = 0; i < imgLines.length; i++) {
      ctx.fillText(imgLines[i], pad, titleY + i * imgLineH);
    }

    // Author.
    if (panel.subtitle) {
      ctx.font = "400 21px 'Source Serif Pro', Georgia, serif";
      ctx.fillStyle = textColor;
      ctx.globalAlpha = 0.7;
      ctx.textAlign = "left";
      ctx.fillText(panel.subtitle, pad, h - pad - 12);
      ctx.globalAlpha = 1;
    }
  }

  function renderTextCard(panel, w, h, pad) {
    var fg = panel.fg;
    var fs = Math.max(panel.fontSize * 0.55, 20);

    drawMark(panel, w, h, pad, "top-center");

    // Top hairline.
    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.1;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad + 44);
    ctx.lineTo(w - pad, pad + 44);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Body text.
    if (panel.showBody !== false) {
      ctx.font = "400 " + fs + "px 'Source Serif Pro', Georgia, serif";
      ctx.fillStyle = fg;
      ctx.textAlign = "left";
      wrapText(panel.body || "Enter body text…", pad, pad + 44 + fs * 1.6, w - pad * 2, fs * 1.65, "left");
    }

    // Bottom hairline.
    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.1;
    ctx.beginPath();
    ctx.moveTo(pad, h - pad - 10);
    ctx.lineTo(w - pad, h - pad - 10);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function renderCtaCard(panel, w, h, pad) {
    var fg = panel.fg;
    var bg = panel.bg;

    // Pilcrow ornament.
    ctx.font = "italic 120px 'IM Fell Great Primer', Georgia, serif";
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.06;
    ctx.textAlign = "center";
    ctx.fillText("¶", w / 2, h * 0.30);
    ctx.globalAlpha = 1;

    // "Read more at" label.
    ctx.font = "600 15px 'Source Serif Pro', Georgia, serif";
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.4;
    ctx.textAlign = "center";
    drawTrackedText("READ MORE AT", w / 2, h * 0.40, 3, "center");
    ctx.globalAlpha = 1;

    // Site name.
    ctx.font = "italic 54px 'IM Fell Great Primer', Georgia, serif";
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.fillText("Mere Orthodoxy", w / 2, h * 0.50);

    // Hairlines around CTA.
    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.55);
    ctx.lineTo(w * 0.8, h * 0.55);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // CTA pill button.
    var btnW = 360;
    var btnH = 58;
    var btnX = (w - btnW) / 2;
    var btnY = h * 0.60;
    ctx.fillStyle = fg;
    ctx.beginPath();
    roundRect(ctx, btnX, btnY, btnW, btnH, 29);
    ctx.fill();

    ctx.font = "600 18px 'Source Serif Pro', Georgia, serif";
    ctx.fillStyle = bg;
    ctx.textAlign = "center";
    ctx.fillText(panel.title || "mereorthodoxy.com", w / 2, btnY + 37);

    // Bottom hairline.
    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.69);
    ctx.lineTo(w * 0.8, h * 0.69);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* -- Text helpers ----------------------------------------------------- */

  function wrapText(text, x, y, maxWidth, lineHeight, align) {
    align = align || "center";
    ctx.textAlign = align;
    var lines = getWrappedLines(text, maxWidth);
    for (var i = 0; i < lines.length; i++) {
      var lx = align === "left" ? x : align === "right" ? x + maxWidth : x;
      ctx.fillText(lines[i], lx, y + i * lineHeight);
    }
    return lines.length;
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
