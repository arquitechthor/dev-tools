# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Dev Tools**: small developer utilities by arquitechthor, served by GitHub Pages at
`https://arquitechthor.github.io/dev-tools/` (repo `arquitechthor/dev-tools`, public, published from `main`, root folder —
every push redeploys; commit straight to `main`). Plain HTML/CSS/JS, no build step, no dependencies, no CDN.
`.nojekyll` disables Jekyll.

**The promise of the site is trust** (the README: "ya existen cosas parecidas, pero no confío en ellas"):
everything runs in the browser. Never add network calls, analytics, cookies, third-party scripts/fonts or a
backend, and never store the user's input (only preferences, in `localStorage`, wrapped in try/catch). If a
future tool truly needs the network, say so on its page.

```
index.html            # home: hero → #herramientas (one card per tool) → #por-que
json-formatter.html   # JSON formatter
aviso-legal.html      # legal + privacy
sitemap.xml           # by hand: one <url> per page (listed in the user site's /robots.txt)
styles.css            # palette/tokens and base components copied from Tech Spider (kopi-web → aws-cert-study → Spider), then the site's own blocks
assets/
  logo.svg            # own logo ({ } in the brand gradient); also the favicon
  nav.js              # same nav script as Tech Spider (mobile toggle, .nav-menu dropdowns, active link)
  json.js             # JSON parser + printer, no JSON.parse: Spanish errors with line/column, lossless numbers/strings, duplicate-key warnings. UMD-ish: window.DevJson / module.exports
  json-formatter.js   # UI of json-formatter.html
scripts/probar-json.mjs  # tests of assets/json.js: `node scripts/probar-json.mjs` (run after touching json.js)
```

## Adding a tool

1. `<tool>.html` copying the shell of `json-formatter.html` (same nav, footer, `.herramienta` section).
2. Its logic in `assets/<tool>.js`; pure logic in a separate file testable from Node, with tests in `scripts/`.
3. Add it to the "Herramientas" dropdown of **every** page, a card in `index.html#herramientas`, `sitemap.xml` and a line in the README.
4. Add it to the Dev Tools card of the personal site (`../arquitechthor.github.io/index.html#dev-tools`) if worth it.

## Look and feel

Same palette, nav and footer as the owner's other sites (policy "Mismo menú y pie"): menu
`Inicio · Herramientas ▾ · Arquitechthor` (Arquitechthor always last) and the shared `.footer-sitios` line, which
here includes "Dev Tools" with `aria-current`. Dark theme only, like the other sites. All UI text is in **Spanish**.
