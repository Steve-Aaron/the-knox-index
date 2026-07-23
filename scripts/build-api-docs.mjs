#!/usr/bin/env node
/**
 * Build standalone API docs (Scalar, free/MIT CDN build) from docs/api/openapi.yaml.
 * Output: docs/api/ariadne-api-docs.html — single file, double-click to open.
 * Usage: npm run docs:build
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const specPath = join(root, 'docs/api/openapi.yaml');
const outPath = join(root, 'docs/api/ariadne-api-docs.html');

const yaml = readFileSync(specPath, 'utf8');
// Embed raw YAML in a JSON string literal; escape </ so it cannot close the script tag
const embedded = JSON.stringify(yaml).replaceAll('</', '<\\/');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ariadne / Knox Index — API Documentation</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; }
  </style>
</head>
<body data-component="apiDocsScalar">
  <div id="app"></div>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  <script>
    Scalar.createApiReference('#app', {
      content: ${embedded},
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

writeFileSync(outPath, html);
console.log(`Wrote ${outPath} (${html.length} bytes)`);
