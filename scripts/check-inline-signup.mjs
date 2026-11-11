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

// ---------------------------------------------------------------------
// Existing subscribers: the newsletter opt-in carried on the sign-in link
// ---------------------------------------------------------------------

function storage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    data,
  };
}

test("a newsletter form marks its sign-in link and remembers the nonce here", async () => {
  const listeners = {};
  const requests = [];
  const attrs = { "data-newsletter": "daily-liturgy", "data-source": "nav-daily-liturgy", "data-signup-redirect": "/daily-liturgy/read/" };
  const email = { value: "reader@example.test", checkValidity: () => true, matches: () => true };
  const fields = {
    "[data-signup-email]": email,
    "[data-signup-first]": { value: "Test" },
    "[data-signup-last]": { value: "Reader" },
    "[data-signup-status]": { textContent: "", classList: { toggle() {} } },
  };
  const root = { getAttribute: (k) => attrs[k] ?? null, hasAttribute: (k) => k in attrs, querySelector: (s) => fields[s] ?? null };
  const button = { disabled: false, textContent: "Sign up free", closest: () => root };
  const localStorage = storage();
  vm.runInNewContext(source, {
    window: { location: new URL("https://mereorthodoxy.com/some-essay/"), localStorage, crypto: globalThis.crypto },
    document: { referrer: "", addEventListener: (n, h) => { listeners[n] = h; }, querySelector: () => null, querySelectorAll: () => [] },
    fetch: (url, init) => {
      requests.push({ url, init });
      if (url.includes("integrity-token")) return Promise.resolve({ ok: true, text: () => Promise.resolve("t") });
      return new Promise(() => {});
    },
    URL, URLSearchParams, Promise, WeakMap, setTimeout, console, Uint8Array,
  });
  listeners.click({ target: { closest: () => button }, preventDefault() {} });
  await tick();
  const body = JSON.parse(requests.find((r) => r.init?.method === "POST").init.body);
  const redirect = new URL(body.redirect);
  assert.equal(redirect.pathname, "/daily-liturgy/read/");
  const [newsletter, nonce] = redirect.searchParams.get("mo_optin").split(".");
  assert.equal(newsletter, "daily-liturgy");
  assert.ok(nonce.length >= 12);
  assert.equal(JSON.parse(localStorage.data["mo-optin"]).nonce, nonce);
  assert.ok(body.labels.includes("source:nav-daily-liturgy"));
});

function landing({ href, signedIn = true, stored = null, preferences = { liturgy: false, digest: true }, failPost = false }) {
  const calls = [];
  const appended = [];
  let replaced = null;
  const localStorage = storage();
  if (stored) localStorage.setItem("mo-optin", JSON.stringify(stored));
  const bodyAttrs = { "data-kit-worker-url": "https://mo-kit.example.test/" };
  if (signedIn) bodyAttrs["data-member-email"] = "reader@example.test";
  const el = () => {
    const node = { children: [], className: "", textContent: "", attrs: {}, listeners: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      appendChild(c) { this.children.push(c); return c; },
      addEventListener(n, h) { this.listeners[n] = h; },
      remove() { node.removed = true; },
      querySelector(sel) { return sel === "p" ? this.children.find((c) => c.tag === "p") : null; } };
    return node;
  };
  const document = {
    readyState: "complete",
    referrer: "",
    body: { getAttribute: (k) => bodyAttrs[k] ?? null, appendChild: (n) => { appended.push(n); return n; } },
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => Object.assign(el(), { tag }),
    createTextNode: (t) => ({ tag: "#text", textContent: t }),
  };
  const MOAuth = {
    fetch: (url, init) => {
      calls.push({ url, init });
      if (init?.method === "POST") return Promise.resolve({ ok: !failPost, json: () => Promise.resolve({}) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ preferences }) });
    },
  };
  const location = new URL(href);
  vm.runInNewContext(source, {
    window: { location, localStorage, MOAuth, history: { state: null, replaceState: (_s, _t, u) => { replaced = u; } } },
    document,
    fetch: () => { throw new Error("no plain fetch on landing"); },
    URL, URLSearchParams, Promise, WeakMap, setTimeout, console,
  });
  return { calls, appended, localStorage, get replaced() { return replaced; } };
}

const settle = async () => { for (let i = 0; i < 5; i++) await tick(); };

test("the same browser turns the newsletter on and clears the marker", async () => {
  const page = landing({
    href: "https://mereorthodoxy.com/daily-liturgy/read/?mo_optin=daily-liturgy.abc123def456&action=signin&success=true",
    stored: { newsletter: "daily-liturgy", nonce: "abc123def456", at: Date.now() },
  });
  await settle();
  assert.equal(page.replaced, "/daily-liturgy/read/?action=signin&success=true");
  assert.equal(page.calls.length, 2);
  assert.equal(page.calls[0].url, "https://mo-kit.example.test/preferences");
  assert.equal(page.calls[1].init.method, "POST");
  assert.deepEqual(JSON.parse(page.calls[1].init.body), { liturgy: true });
  assert.equal(page.localStorage.getItem("mo-optin"), null);
  assert.match(page.appended[0].children[0].textContent, /signed up/);
});

test("another device or a crafted link asks first and writes nothing", async () => {
  const page = landing({ href: "https://mereorthodoxy.com/?mo_optin=daily-liturgy.someoneelse" });
  await settle();
  assert.equal(page.calls.filter((c) => c.init?.method === "POST").length, 0);
  const bar = page.appended[0];
  assert.match(bar.children[0].textContent, /Daily Liturgy/);
  const yes = bar.children.find((c) => c.textContent === "Yes");
  yes.listeners.click();
  await settle();
  assert.deepEqual(JSON.parse(page.calls.find((c) => c.init?.method === "POST").init.body), { liturgy: true });
});

test("a newsletter that is already on is left alone", async () => {
  const page = landing({
    href: "https://mereorthodoxy.com/?mo_optin=weekly-digest.abc123def456",
    stored: { newsletter: "weekly-digest", nonce: "abc123def456", at: Date.now() },
  });
  await settle();
  assert.equal(page.calls.length, 1);
  assert.equal(page.appended.length, 0);
});

test("signed out, unknown newsletters and expired nonces never write", async () => {
  const out = landing({ href: "https://mereorthodoxy.com/?mo_optin=daily-liturgy.abc", signedIn: false });
  const odd = landing({ href: "https://mereorthodoxy.com/?mo_optin=mailbag.abc" });
  const old = landing({
    href: "https://mereorthodoxy.com/?mo_optin=daily-liturgy.abc123def456",
    stored: { newsletter: "daily-liturgy", nonce: "abc123def456", at: Date.now() - 10 * 24 * 60 * 60 * 1000 },
  });
  await settle();
  assert.equal(out.calls.length, 0);
  assert.equal(out.replaced, "/");
  assert.equal(odd.calls.length, 0);
  assert.equal(old.calls.filter((c) => c.init?.method === "POST").length, 0);
});

test("a failed write points to email preferences", async () => {
  const page = landing({
    href: "https://mereorthodoxy.com/?mo_optin=daily-liturgy.abc123def456",
    stored: { newsletter: "daily-liturgy", nonce: "abc123def456", at: Date.now() },
    failPost: true,
  });
  await settle();
  const p = page.appended.at(-1).children[0];
  assert.match(p.textContent, /couldn't sign you up/);
  assert.equal(p.children[0].attrs.href ?? p.children[0].href, "/email-preferences/");
});
