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

  function render() {
    var pad = 90;
    var color = fg();

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = state.bg;
    ctx.fillRect(0, 0, W, H);

    // Opening quote mark.
    ctx.font = "italic 220px 'IM Fell Great Primer', Georgia, serif";
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.12;
    ctx.textAlign = "left";
    ctx.fillText("“", pad - 30, 230);
    ctx.globalAlpha = 1;

    // Quote text.
    var fs = state.fontSize;
    ctx.font = "italic " + fs + "px 'IM Fell Great Primer', Georgia, serif";
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    var lines = wrapLines(state.text || "Enter a quote...", W - pad * 2, ctx);
    var lineH = fs * 1.4;
    var startY = Math.max(pad + fs + 180, (H - lines.length * lineH) / 2);
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], pad, startY + i * lineH);
    }

    // Attribution.
    var attrY = H - pad - 20;
    if (state.source) {
      ctx.font = "italic 18px 'Source Serif Pro', Georgia, serif";
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.5;
      ctx.fillText(state.source, pad, attrY);
      ctx.globalAlpha = 1;
      attrY -= 30;
    }
    if (state.author) {
      ctx.font = "600 22px 'Source Serif Pro', Georgia, serif";
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.fillText("— " + state.author, pad, attrY);
      ctx.globalAlpha = 1;
    }

    // Hairline.
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, H - pad - 70);
    ctx.lineTo(W - pad, H - pad - 70);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Watermark.
    if (state.watermark) {
      ctx.font = "600 14px 'Source Serif Pro', Georgia, serif";
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.textAlign = "right";
      ctx.fillText("MERE ORTHODOXY", W - pad, 60);
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
