import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../assets/js/inline-signup.js", import.meta.url), "utf8");
const tick = () => new Promise((resolve) => setImmediate(resolve));

// Run the real delegated handlers. Network calls are recorded and answered
// locally; these checks cannot send email or create an account.
function form({ redirect, failIntegrity = false, failPost = false } = {}) {
  const listeners = {};
  const requests = [];
  const attrs = { "data-account-signup": "", "data-source": "tfr-beta" };
  if (redirect) attrs["data-signup-redirect"] = redirect;
  const status = { textContent: "", classList: { toggle() {} } };
  const email = { value: "reader@example.test", checkValidity: () => true, matches: () => true };
  const fields = {
    "[data-signup-email]": email,
    "[data-signup-first]": { value: "Test" },
    "[data-signup-last]": { value: "Reader" },
    "[data-signup-status]": status,
  };
  const root = {
    getAttribute: (key) => attrs[key] ?? null,
    hasAttribute: (key) => key in attrs,
    querySelector: (selector) => fields[selector] ?? null,
  };
  const button = { disabled: false, textContent: "Create free account", closest: () => root };
  fields["[data-signup-submit]"] = button;
  email.closest = () => root;
  const location = new URL("https://mereorthodoxy.com/the-faith-received/?token=secret&utm_campaign=tfr");
  let tokenNumber = 0;
  vm.runInNewContext(source, {
    window: { location },
    document: {
      referrer: "",
      addEventListener: (name, handler) => { listeners[name] = handler; },
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    fetch: (url, init) => {
      requests.push({ url, init });
      if (url.includes("integrity-token")) {
        tokenNumber += 1;
        return Promise.resolve({ ok: !failIntegrity, text: () => Promise.resolve(`token-${tokenNumber}`) });
      }
      if (failPost) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({ errors: [{ message: "Please try later." }] }) });
      }
      // Hold the POST open so a duplicate submission would be observable.
      return new Promise(() => {});
    },
    URL, URLSearchParams, Promise, WeakMap, setTimeout, console,
  });
  return {
    requests, button, status, email, fields,
    click: () => listeners.click({ target: { closest: () => button }, preventDefault() {} }),
    enter: () => listeners.keydown({ key: "Enter", target: email, preventDefault() {} }),
  };
}

const posts = (fixture) => fixture.requests.filter((request) => request.init?.method === "POST");

test("click and Enter share one in-flight signup", async () => {
  const fixture = form();
  fixture.click();
  fixture.enter();
  fixture.click();
  await tick();
  fixture.enter();
  assert.equal(fixture.requests.length, 2);
  assert.equal(posts(fixture).length, 1);
  assert.equal(fixture.button.disabled, true);
  const body = JSON.parse(posts(fixture)[0].init.body);
  assert.equal(body.emailType, "signup");
  assert.ok(body.labels.includes("source:tfr-beta"));
});

test("tool return preserves its location and removes credentials", async () => {
  const fixture = form({ redirect: "/the-faith-received/research/?token=secret&key=private&utm_campaign=x#compare" });
  fixture.click();
  await tick();
  const body = JSON.parse(posts(fixture)[0].init.body);
  assert.equal(body.redirect, "https://mereorthodoxy.com/the-faith-received/research/?utm_campaign=x#compare");
  assert.equal(body.urlHistory[0].path, "/the-faith-received/?utm_campaign=tfr");
  assert.equal(posts(fixture)[0].init.credentials, "same-origin");
});

for (const redirect of ["https://evil.example/tool", "//evil.example/tool", "javascript:alert(1)", "http://mereorthodoxy.com/tool"]) {
  test(`unsafe return falls back to the current page: ${redirect}`, async () => {
    const fixture = form({ redirect });
    fixture.click();
    await tick();
    assert.equal(JSON.parse(posts(fixture)[0].init.body).redirect,
      "https://mereorthodoxy.com/the-faith-received/?utm_campaign=tfr");
  });
}

test("integrity failure sends no magic-link request and permits retry", async () => {
  const fixture = form({ failIntegrity: true });
  fixture.click();
  await tick();
  assert.equal(posts(fixture).length, 0);
  assert.equal(fixture.button.disabled, false);
  assert.ok(fixture.status.textContent);
  fixture.click();
  await tick();
  assert.equal(fixture.requests.length, 2);
  assert.equal(posts(fixture).length, 0);
});

test("server refusal restores the form and retry obtains a fresh token", async () => {
  const fixture = form({ failPost: true });
  fixture.click();
  await tick();
  assert.equal(fixture.button.disabled, false);
  assert.ok(fixture.status.textContent);
  fixture.enter();
  await tick();
  const bodies = posts(fixture).map((request) => JSON.parse(request.init.body));
  assert.equal(bodies.length, 2);
  assert.notEqual(bodies[0].integrityToken, bodies[1].integrityToken);
  assert.equal(fixture.button.disabled, false);
});

test("invalid email and missing account names never reach the network", () => {
  const fixture = form();
  fixture.email.checkValidity = () => false;
  fixture.click();
  assert.equal(fixture.requests.length, 0);
  fixture.email.checkValidity = () => true;
  fixture.email.value = "not-an-email";
  fixture.click();
  assert.equal(fixture.requests.length, 0);
  fixture.email.value = "reader@example.test";
  fixture.fields["[data-signup-first]"].value = "";
  fixture.click();
  assert.equal(fixture.requests.length, 0);
});
