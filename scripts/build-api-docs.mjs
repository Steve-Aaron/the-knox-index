#!/usr/bin/env node
/**
 * scripts/build-api-docs.mjs
 * --------------------------
 * Builds the developer documentation site in docs/api/ from source files.
 *
 * Sources (single source of truth, edit these):
 *   docs/api/openapi.yaml        the API contract
 *   docs/api/getting-started.md  developer onboarding
 *   docs/api/usage-policy.md     limits and acceptable use
 *
 * Outputs (generated, do not hand-edit):
 *   docs/api/ariadne-api-docs.html  standalone reference, spec embedded
 *   docs/api/getting-started.html   rendered from the markdown
 *   docs/api/usage-policy.html      rendered from the markdown
 *   docs/api/index.html             Scalar viewer loading ./openapi.yaml
 *
 * The markdown pages embed their source and render it client-side with marked
 * from the same CDN Scalar uses, so there is no build-time dependency and the
 * markdown files stay the only copy of that content.
 *
 * Usage: npm run docs:build
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docs = join(root, 'docs/api');

/** Embeds a string in a page as a JSON literal, safe against tag injection. */
const embed = str => JSON.stringify(str).replaceAll('</', '<\\/');

/** Pages in the site, in nav order. `file` is the output filename. */
const NAV = [
  { file: 'ariadne-api-docs.html', label: 'API reference' },
  { file: 'getting-started.html', label: 'Getting started' },
  { file: 'usage-policy.html', label: 'Usage policy' },
];

/** Shared nav bar. `current` is the filename of the page being rendered. */
const navBar = current => `
  <nav data-component="docsNav">
    ${NAV.map(p =>
      p.file === current
        ? `<span class="current">${p.label}</span>`
        : `<a href="./${p.file}">${p.label}</a>`,
    ).join('')}
  </nav>`;

/** Styles shared by the generated pages. Dark, matching Scalar's deepSpace. */
const SHARED_CSS = `
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #0b0d12;
      color: #c9d1d9;
      font: 16px/1.65 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    [data-component='docsNav'] {
      position: sticky; top: 0; z-index: 10;
      display: flex; gap: 4px; align-items: center;
      padding: 12px 24px;
      background: rgba(11, 13, 18, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid #21262d;
    }
    [data-component='docsNav'] a,
    [data-component='docsNav'] .current {
      padding: 6px 12px; border-radius: 6px;
      font-size: 14px; text-decoration: none;
      transition: background 120ms ease, color 120ms ease;
    }
    [data-component='docsNav'] a { color: #8b949e; }
    [data-component='docsNav'] a:hover { background: #161b22; color: #e6edf3; }
    [data-component='docsNav'] .current { background: #1f6feb; color: #fff; }`;

/** Extra styles for the markdown pages only. */
const MARKDOWN_CSS = `
    main { max-width: 820px; margin: 0 auto; padding: 40px 24px 96px; }
    h1, h2, h3 { color: #e6edf3; line-height: 1.25; margin-top: 2em; }
    h1 { margin-top: 0; font-size: 2rem; }
    h2 { font-size: 1.4rem; padding-bottom: .3em; border-bottom: 1px solid #21262d; }
    h3 { font-size: 1.1rem; }
    a { color: #58a6ff; }
    code {
      background: #161b22; border: 1px solid #21262d; border-radius: 4px;
      padding: .15em .4em; font-size: .875em;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    pre {
      background: #161b22; border: 1px solid #21262d; border-radius: 8px;
      padding: 16px; overflow-x: auto;
    }
    pre code { background: none; border: 0; padding: 0; font-size: .85rem; }
    table { border-collapse: collapse; width: 100%; margin: 1.2em 0; display: block; overflow-x: auto; }
    th, td { border: 1px solid #21262d; padding: 8px 12px; text-align: left; font-size: .9rem; }
    th { background: #161b22; color: #e6edf3; }
    blockquote { margin: 1.2em 0; padding: .5em 1em; border-left: 3px solid #1f6feb; background: #10141b; }
    hr { border: 0; border-top: 1px solid #21262d; margin: 2.5em 0; }`;

/** A page that renders one markdown file client-side. */
function markdownPage({ file, title, markdown }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${title} — Ariadne / Knox Index API</title>
  <style>${SHARED_CSS}${MARKDOWN_CSS}
  </style>
</head>
<body data-component="apiDocsMarkdown">
  ${navBar(file)}
  <main id="content">Loading…</main>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script>
    (function () {
      var source = ${embed(markdown)};
      var target = document.getElementById('content');
      if (window.marked && typeof window.marked.parse === 'function') {
        target.innerHTML = window.marked.parse(source);
      } else {
        // CDN blocked or offline: show the markdown as plain text rather than
        // an empty page. Still readable, just unstyled.
        var pre = document.createElement('pre');
        pre.textContent = source;
        target.replaceChildren(pre);
      }
    })();
  </script>
</body>
</html>
`;
}

/** The standalone API reference, with the spec embedded. */
function referencePage(spec) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Ariadne / Knox Index — API Documentation</title>
  <style>${SHARED_CSS}
  </style>
</head>
<body data-component="apiDocsScalar">
  ${navBar('ariadne-api-docs.html')}
  <div id="app"></div>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  <script>
    Scalar.createApiReference('#app', {
      content: ${embed(spec)},
      theme: 'deepSpace',
      darkMode: true,
      hideDarkModeToggle: false,
      proxyUrl: 'https://proxy.scalar.com',
      metaData: { title: 'Ariadne / Knox Index — API Documentation' },
    });
  </script>
</body>
</html>
`;
}

/** Root page: redirects to the reference so the domain root is not a 404. */
function indexPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="robots" content="noindex, nofollow" />
  <meta http-equiv="refresh" content="0; url=./ariadne-api-docs.html" />
  <title>Ariadne / Knox Index — API Documentation</title>
</head>
<body>
  <p><a href="./ariadne-api-docs.html">API documentation</a></p>
</body>
</html>
`;
}

// ── Build ─────────────────────────────────────────────────────────────────────

const spec = readFileSync(join(docs, 'openapi.yaml'), 'utf8');

const outputs = [
  ['ariadne-api-docs.html', referencePage(spec)],
  ['getting-started.html', markdownPage({
    file: 'getting-started.html',
    title: 'Getting started',
    markdown: readFileSync(join(docs, 'getting-started.md'), 'utf8'),
  })],
  ['usage-policy.html', markdownPage({
    file: 'usage-policy.html',
    title: 'Usage policy',
    markdown: readFileSync(join(docs, 'usage-policy.md'), 'utf8'),
  })],
  ['index.html', indexPage()],
];

for (const [name, html] of outputs) {
  writeFileSync(join(docs, name), html);
  console.log(`Wrote docs/api/${name} (${(html.length / 1024).toFixed(1)} KB)`);
}
