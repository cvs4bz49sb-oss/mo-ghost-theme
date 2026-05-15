(function () {
  "use strict";

  var root = document.querySelector("[data-quote-creator]");
  if (!root) return;

  var canvas = root.querySelector("[data-quote-canvas]");
  var ctx = canvas.getContext("2d");
  var W = 1080, H = 1080;

  var state = { text: "", author: "", source: "", bg: "#1d1b18", fontSize: 40, watermark: true };

  var $text = root.querySelector("[data-quote-text]");
  var $author = root.querySelector("[data-quote-author]");
  var $source = root.querySelector("[data-quote-source]");
  var $fontSlider = root.querySelector("[data-quote-fontsize]");
  var $fontVal = root.querySelector("[data-quote-fontsize-val]");
  var $watermark = root.querySelector("[data-quote-watermark]");
  var $bgSwatches = root.querySelectorAll("[data-qbg]");
  var $export = root.querySelector("[data-quote-export]");

  $text.addEventListener("input", function () { state.text = $text.value; render(); });
  $author.addEventListener("input", function () { state.author = $author.value; render(); });
  $source.addEventListener("input", function () { state.source = $source.value; render(); });
  $fontSlider.addEventListener("input", function () {
    state.fontSize = parseInt($fontSlider.value, 10);
    $fontVal.textContent = $fontSlider.value;
    render();
  });
  $watermark.addEventListener("change", function () { state.watermark = $watermark.checked; render(); });

  $bgSwatches.forEach(function (btn) {
    btn.addEventListener("click", function () {
      $bgSwatches.forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
      state.bg = btn.dataset.qbg;
      render();
    });
  });

  $export.addEventListener("click", function () {
    var link = document.createElement("a");
    link.download = "mo-quote.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  function fg() {
    return (state.bg === "#1d1b18" || state.bg === "#2d2927") ? "#ffffff" :
           state.bg === "#ee7d51" ? "#ffffff" : "#1d1b18";
  }

  function drawTracked(text, x, y, tracking, align) {
    align = align || “center”;
    var old = ctx.textAlign;
    ctx.textAlign = “left”;
    var chars = text.split(“”);
    var tw = 0;
    for (var i = 0; i < chars.length; i++) {
      tw += ctx.measureText(chars[i]).width;
      if (i < chars.length - 1) tw += tracking;
    }
    var sx;
    if (align === “center”) sx = x - tw / 2;
    else if (align === “right”) sx = x - tw;
    else sx = x;
    for (var j = 0; j < chars.length; j++) {
      ctx.fillText(chars[j], sx, y);
      sx += ctx.measureText(chars[j]).width + tracking;
    }
    ctx.textAlign = old;
  }

  function render() {
    var pad = 90;
    var color = fg();

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = state.bg;
    ctx.fillRect(0, 0, W, H);

    // Wordmark top-right.
    if (state.watermark) {
      ctx.save();
      ctx.font = “600 13px 'Source Serif Pro', Georgia, serif”;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.28;
      drawTracked(“MERE ORTHODOXY”, W - pad, pad + 12, 3.5, “right”);
      ctx.restore();
    }

    // Large opening quotation mark.
    ctx.font = “italic 260px 'IM Fell Great Primer', Georgia, serif”;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.07;
    ctx.textAlign = “left”;
    ctx.fillText(““”, pad - 35, pad + 240);
    ctx.globalAlpha = 1;

    // Quote text.
    var fs = state.fontSize;
    ctx.font = “italic “ + fs + “px 'IM Fell Great Primer', Georgia, serif”;
    ctx.fillStyle = color;
    ctx.textAlign = “left”;
    var lines = wrapLines(state.text || “Enter a quote…”, W - pad * 2, ctx);
    var lineH = fs * 1.4;
    var startY = Math.max(pad + fs + 220, (H - lines.length * lineH) / 2);
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], pad, startY + i * lineH);
    }

    // Hairline.
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.1;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, H - pad - 95);
    ctx.lineTo(W * 0.45, H - pad - 95);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Attribution.
    var attrY = H - pad - 20;
    if (state.source) {
      ctx.font = “italic 17px 'Source Serif Pro', Georgia, serif”;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.textAlign = “left”;
      ctx.fillText(state.source, pad + 24, attrY);
      ctx.globalAlpha = 1;
      attrY -= 34;
    }
    if (state.author) {
      ctx.font = “600 21px 'Source Serif Pro', Georgia, serif”;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.6;
      ctx.textAlign = “left”;
      ctx.fillText(“— “ + state.author, pad, attrY);
      ctx.globalAlpha = 1;
    }
  }

  function wrapLines(text, maxWidth, ctx) {
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

  render();
})();
