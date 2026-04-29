/*
 * /the-faith-received/ — frontend.
 *
 * Posts questions to the mo-faith-received Cloudflare Worker and
 * renders each answer as an editorial section appended below the
 * ask form. Multiple questions can stack; previous answers stay
 * on screen so the page reads as a session, not a chat replacement.
 *
 * Worker URL is hardcoded because the theme @custom settings cap
 * is full. If the worker route differs on your account, update
 * WORKER_URL below and redeploy the theme.
 */
(function () {
  var WORKER_URL = "https://mo-faith-received.mo-podcast-feed.workers.dev";

  var form = document.querySelector("[data-faith-form]");
  var input = document.querySelector("[data-faith-input]");
  var submit = document.querySelector("[data-faith-submit]");
  var submitLabel = document.querySelector("[data-faith-submit-label]");
  var status = document.querySelector("[data-faith-status]");
  var answers = document.querySelector("[data-faith-answers]");
  var answersList = document.querySelector("[data-faith-answers-list]");
  var template = document.querySelector("[data-faith-answer-template]");

  if (!form || !input || !template || !answersList) return;

  // Wire example pills to fill the input + submit immediately.
  document.querySelectorAll("[data-faith-example]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.querySelector(".faith-example-text");
      input.value = text ? text.textContent.trim() : btn.textContent.trim();
      input.focus();
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var question = input.value.trim();
    if (question.length < 3) {
      setStatus("Please write a longer question.", true);
      return;
    }
    submitQuestion(question);
  });

  function submitQuestion(question) {
    setStatus("Searching primary sources and synthesizing an answer. This usually takes 5 to 15 seconds.");
    setBusy(true);

    var node = renderQuestionShell(question);
    revealAnswers();
    node.scrollIntoView({ behavior: "smooth", block: "start" });

    fetch(WORKER_URL + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question }),
    })
      .then(function (r) {
        if (!r.ok) {
          return r.json().then(function (j) {
            throw new Error(j.error || ("Worker " + r.status));
          }).catch(function () {
            throw new Error("Worker " + r.status);
          });
        }
        return r.json();
      })
      .then(function (data) {
        renderAnswerInto(node, data);
        setStatus("");
        input.value = "";
      })
      .catch(function (err) {
        renderErrorInto(node, err.message || "Something went wrong.");
        setStatus("");
      })
      .then(function () {
        setBusy(false);
      });
  }

  function renderQuestionShell(question) {
    var fragment = template.content.cloneNode(true);
    var article = fragment.querySelector(".faith-answer");
    var qEl = article.querySelector("[data-faith-answer-question]");
    var proseEl = article.querySelector("[data-faith-answer-prose]");
    var sourcesEl = article.querySelector("[data-faith-answer-sources]");

    qEl.textContent = question;
    proseEl.innerHTML =
      '<div class="faith-loading" aria-live="polite">' +
        '<span class="faith-loading-dots" aria-hidden="true"><span></span><span></span><span></span></span>' +
        '<span class="faith-loading-text">Searching the archive…</span>' +
      "</div>";
    sourcesEl.innerHTML = '<li class="faith-source-empty">Working…</li>';

    answersList.insertBefore(article, answersList.firstChild);
    return article;
  }

  function renderAnswerInto(article, data) {
    var proseEl = article.querySelector("[data-faith-answer-prose]");
    var sourcesEl = article.querySelector("[data-faith-answer-sources]");

    proseEl.innerHTML = formatAnswerHtml(data.answer || "");

    var citations = (data.citations && data.citations.length ? data.citations : data.sources) || [];
    if (!citations.length) {
      sourcesEl.innerHTML = '<li class="faith-source-empty">No sources matched this query.</li>';
      return;
    }
    sourcesEl.innerHTML = citations.map(function (s, i) {
      return (
        '<li class="faith-source">' +
          '<span class="faith-source-numeral">' + toRoman(i + 1) + "</span>" +
          '<div class="faith-source-body">' +
            '<h3 class="faith-source-title"><em>' + escapeHtml(s.title || "Untitled") + "</em></h3>" +
            (s.creator ? '<p class="faith-source-author">' + escapeHtml(s.creator) + "</p>" : "") +
            (s.url ? '<a class="faith-source-link" href="' + escapeAttr(s.url) + '" target="_blank" rel="noopener">Read full text &rarr;</a>' : "") +
          "</div>" +
        "</li>"
      );
    }).join("");
  }

  function renderErrorInto(article, message) {
    var proseEl = article.querySelector("[data-faith-answer-prose]");
    var sourcesEl = article.querySelector("[data-faith-answer-sources]");
    proseEl.innerHTML = '<p class="faith-error">' + escapeHtml(message) + "</p>";
    sourcesEl.innerHTML = "";
  }

  // ----- Answer formatting ---------------------------------------------------

  function formatAnswerHtml(text) {
    if (!text) return "";
    var safe = escapeHtml(text);
    // Bold: **word** → <strong>
    safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // Citation markers: [Source N] → styled span. The numeral stays
    // visible inline with the prose so readers can match it to the
    // sidebar list.
    safe = safe.replace(/\[Source (\d+)\]/g, function (_, n) {
      return '<span class="faith-citation">[' + toRoman(parseInt(n, 10)) + "]</span>";
    });
    // Paragraphs from blank lines.
    var paragraphs = safe.split(/\n{2,}/).map(function (p) {
      return "<p>" + p.replace(/\n/g, "<br>") + "</p>";
    });
    return paragraphs.join("");
  }

  function toRoman(n) {
    if (!n || n < 1) return String(n || "");
    var map = [
      [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
      [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
      [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
    ];
    var out = "";
    for (var i = 0; i < map.length; i++) {
      while (n >= map[i][0]) {
        out += map[i][1];
        n -= map[i][0];
      }
    }
    return out;
  }

  // ----- UI plumbing ---------------------------------------------------------

  function setBusy(busy) {
    if (submit) submit.disabled = !!busy;
    if (input) input.disabled = !!busy;
    if (submitLabel) submitLabel.textContent = busy ? "Asking…" : "Ask";
  }

  function setStatus(msg, isError) {
    if (!status) return;
    status.textContent = msg || "";
    status.classList.toggle("is-error", !!isError);
  }

  function revealAnswers() {
    if (answers && answers.hasAttribute("hidden")) answers.removeAttribute("hidden");
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
