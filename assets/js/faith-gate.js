(function () {
  const PASSWORD = "credo";

  if (sessionStorage.getItem("tfr-access") === "1") return;

  document.body.style.overflow = "hidden";

  const overlay = document.createElement("div");
  overlay.className = "faith-gate";
  overlay.innerHTML =
    '<div class="faith-gate-card">' +
      '<p class="faith-gate-lead">Something remarkable is in the works,<br>but it&rsquo;s not yet ready.</p>' +
      '<p class="faith-gate-sub">Only enter if you are working on building it.</p>' +
      '<form class="faith-gate-form">' +
        '<input type="password" class="faith-gate-input" placeholder="Password" autocomplete="off" />' +
        '<button type="submit" class="faith-gate-btn">Enter</button>' +
      '</form>' +
      '<p class="faith-gate-error" hidden>Wrong password.</p>' +
    '</div>';

  document.body.appendChild(overlay);
  const input = overlay.querySelector(".faith-gate-input");
  input.focus();

  overlay.querySelector("form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (input.value === PASSWORD) {
      sessionStorage.setItem("tfr-access", "1");
      overlay.remove();
      document.body.style.overflow = "";
    } else {
      const err = overlay.querySelector(".faith-gate-error");
      err.hidden = false;
      input.value = "";
      input.focus();
      overlay.classList.add("faith-gate--shake");
      setTimeout(() => { overlay.classList.remove("faith-gate--shake"); }, 400);
    }
  });
})();
