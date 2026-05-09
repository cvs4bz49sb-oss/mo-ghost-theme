// Security regression guard for the theme's JS.
//
// Aim: catch the kinds of mistakes the audit (and the post-fix
// audit) flagged, before they ship — not full lint coverage. Add
// rules over time as new patterns prove worth pinning.
//
// Run locally: `npm install && npm run lint`
// CI: .github/workflows/lint.yml

import js from "@eslint/js";

const securityRules = {
  // Refuse any URL template / fetch call that puts ?email= in the
  // querystring. The audit's C3 finding (email-in-URL) was the
  // single pattern most prone to regression — a copy-paste from a
  // pre-fix file would re-introduce it silently.
  "no-restricted-syntax": [
    "error",
    {
      selector: "Literal[value=/[?&]email=/]",
      message:
        "PII-in-URL: fetch URLs must not include `?email=`. Use MOAuth.fetch and let the worker derive identity from the JWT (payload.sub).",
    },
    {
      selector: "TemplateElement[value.raw=/[?&]email=/]",
      message:
        "PII-in-URL: template literals must not contain `?email=`. Use MOAuth.fetch and let the worker derive identity from the JWT.",
    },
    // Pre-D1 pattern: window.MOAdminAuth.* is gone. Catch any stale
    // references that re-introduce the public-API token getter.
    {
      selector:
        "MemberExpression[object.object.name='window'][object.property.name='MOAdminAuth']",
      message:
        "MOAdminAuth was removed in D1. Use window.MOAuth.fetch(url, init) — the bearer JWT stays inside the closure.",
    },
    {
      selector:
        "MemberExpression[object.name='MOAdminAuth']",
      message:
        "MOAdminAuth was removed in D1. Use window.MOAuth.fetch(url, init).",
    },
    // Direct window.location.href = "..." or window.location = "..."
    // navigates to attacker-supplied URLs unchecked. Use
    // MOSafeRedirect.go(url) (Stripe-host allowlist) or set the href
    // via MOSafeHref.set / MOSafeHref.sanitize.
    {
      selector:
        "AssignmentExpression[left.type='MemberExpression'][left.object.type='MemberExpression'][left.object.object.name='window'][left.object.property.name='location'][left.property.name='href']",
      message:
        "Direct window.location.href assignment skips scheme validation. Use MOSafeRedirect.go(url) for Stripe redirects, or MOSafeHref.sanitize(url) for general links.",
    },
    {
      selector:
        "AssignmentExpression[left.type='MemberExpression'][left.object.name='window'][left.property.name='location']",
      message:
        "Direct window.location assignment skips scheme validation. Use MOSafeRedirect.go(url).",
    },
    {
      selector:
        "CallExpression[callee.object.object.name='window'][callee.object.property.name='location'][callee.property.name='assign']",
      message:
        "window.location.assign skips scheme validation. Use MOSafeRedirect.go(url).",
    },
    {
      selector:
        "CallExpression[callee.object.object.name='window'][callee.object.property.name='location'][callee.property.name='replace']",
      message:
        "window.location.replace skips scheme validation. Use MOSafeRedirect.go(url).",
    },
  ],
};

export default [
  js.configs.recommended,
  {
    files: ["assets/js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        fetch: "readonly",
        Headers: "readonly",
        Response: "readonly",
        Request: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        File: "readonly",
        sessionStorage: "readonly",
        localStorage: "readonly",
        navigator: "readonly",
        crypto: "readonly",
        atob: "readonly",
        btoa: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        AbortController: "readonly",
        ResizeObserver: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        console: "readonly",
        // Theme-provided globals
        MOAuth: "readonly",
        MOSafeRedirect: "readonly",
        MOSafeHref: "readonly",
        DOMPurify: "readonly",
        // React in admin digest tool
        React: "readonly",
        ReactDOM: "readonly",
      },
    },
    rules: {
      ...securityRules,
      // Permissive on noise — this isn't a code-quality lint pass.
      "no-unused-vars": "off",
      "no-empty": "off",
      "no-prototype-builtins": "off",
      "no-cond-assign": "off",
      "no-useless-escape": "off",
      "no-inner-declarations": "off",
      "no-undef": "off",
      "no-redeclare": "off",

      // Modernization rules — see SECURITY-AGENT.md §6.21. Most are
      // auto-fixable; running `npm run lint:fix` modernizes the file
      // (var → const/let, function → arrow, string concat → template
      // literals, Object.assign → spread, etc.).
      //
      // These are at "error" level so CI catches regressions, but
      // running --fix makes them go away. Per-line exceptions go
      // through the standard eslint-disable-next-line.
      "no-var": "error",
      "prefer-const": ["error", { destructuring: "all" }],
      "prefer-arrow-callback": ["error", { allowNamedFunctions: true }],
      "prefer-template": "error",
      "prefer-rest-params": "error",
      "prefer-spread": "error",
      "object-shorthand": ["error", "always", { avoidExplicitReturnArrows: true }],
      "prefer-object-spread": "error",
      "prefer-numeric-literals": "error",
      "prefer-exponentiation-operator": "error",
      "no-useless-concat": "error",
      "no-useless-rename": "error",
      "no-useless-computed-key": "error",
      "no-useless-constructor": "error",
      "no-lonely-if": "error",
      "no-implicit-coercion": ["warn", { allow: ["!!"] }],

      // Cosmetic: ESLint's prefer-template auto-fix sometimes leaves
      // ${  x  } (extra spaces). Tighten that.
      "template-curly-spacing": ["error", "never"],
      "no-multi-spaces": "error",

      // Encourage modern DOM usage where reasonable. These are
      // hard to auto-fix; keep at warn so the agent surfaces them
      // during /security-check without blocking CI.
      "prefer-destructuring": [
        "warn",
        {
          VariableDeclarator: { array: false, object: true },
          AssignmentExpression: { array: false, object: false },
        },
      ],
    },
  },
  {
    // Vendored libs and esbuild-compiled JSX outputs aren't our code.
    // The .jsx sources are also skipped — they're admin tools that
    // were written in their own style and aren't worth modernizing
    // since esbuild compiles them at deploy and the .js outputs ship.
    ignores: [
      "assets/js/vendor/**",
      "assets/js/digest/**",
    ],
  },
];
