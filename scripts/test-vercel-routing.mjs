/**
 * scripts/test-vercel-routing.mjs
 *
 * Spins up a local HTTP server that mirrors Vercel's afterFiles rewrite
 * behaviour, then makes real requests against it and checks responses.
 *
 * Server logic:
 *   1. Try to serve the path as a static file from outputDirectory
 *   2. If the file exists → respond 200 with its content (static)
 *   3. If not → respond 200 with "SSR::<path>" (simulating the SSR catch-all)
 *
 * Tests assert that static assets get status 200 with real file bytes,
 * and that page/API paths get routed to SSR (not served as a static file).
 *
 * Run:  node scripts/test-vercel-routing.mjs
 */

import http          from 'node:http';
import { createReadStream, existsSync, statSync, readdirSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

// ── Config ────────────────────────────────────────────────────────────────────

const config    = JSON.parse(readFileSync('./vercel.json', 'utf8'));
const OUTPUT    = config.outputDirectory;   // dist/client
const PORT      = 19876;
const BASE      = `http://localhost:${PORT}`;

const MIME = {
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.ico':  'image/x-icon',
  '.ttf':  'font/ttf',
  '.png':  'image/png',
  '.html': 'text/html',
  '.json': 'application/json',
};

// ── Server ────────────────────────────────────────────────────────────────────

function isFile(p) {
  try { return statSync(p).isFile(); } catch { return false; }
}

const server = http.createServer((req, res) => {
  const urlPath  = req.url.split('?')[0];
  const filePath = join(OUTPUT, urlPath);

  if (isFile(filePath)) {
    // Vercel serves static file directly
    const ext  = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    createReadStream(filePath).pipe(res);
  } else {
    // Vercel rewrite fires → SSR catch-all
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`SSR::${urlPath}`);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject);
  });
}

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓  ${label}`);
    return true;
  }
  console.error(`  ✗  ${label}${detail ? ` — ${detail}` : ''}`);
  return false;
}

// ── Discover real asset paths ─────────────────────────────────────────────────

const jsDir    = join(OUTPUT, '_expo/static/js/web');
const jsFiles  = existsSync(jsDir) ? readdirSync(jsDir) : [];
const jsBundle = jsFiles[0];

const fontBase = 'assets/node_modules/@expo-google-fonts/montserrat/400Regular';
const fontDir  = join(OUTPUT, fontBase);
const fonts    = existsSync(fontDir) ? readdirSync(fontDir) : [];
const fontFile = fonts[0];

// ── Run tests ─────────────────────────────────────────────────────────────────

async function run() {
  let passed = 0; let failed = 0;

  function ok(label, cond, detail = '') {
    const result = assert(label, cond, detail);
    result ? passed++ : failed++;
    return result;
  }

  // ── 1. Static assets — must return real file bytes, not "SSR::" ────────────
  console.log('\n[1] Static assets (must be served from dist/client, NOT routed to SSR)');

  if (jsBundle) {
    const r = await get(`/_expo/static/js/web/${jsBundle}`);
    ok('JS bundle HTTP 200',                     r.status === 200);
    ok('JS bundle is JavaScript content',        r.headers['content-type']?.includes('javascript'));
    ok('JS bundle body is not SSR placeholder',  !r.body.startsWith('SSR::'));
    ok('JS bundle has real content (>1 KB)',      r.body.length > 1024, `${r.body.length} bytes`);
  } else {
    console.error('  ⚠  No JS bundle found in dist/client/_expo/static/js/web/');
    failed++;
  }

  const favicon = await get('/favicon.ico');
  ok('favicon.ico HTTP 200',                  favicon.status === 200);
  ok('favicon.ico is not SSR placeholder',    !favicon.body.startsWith('SSR::'));

  const brand = await get('/brand/tokens.css');
  ok('brand/tokens.css HTTP 200',             brand.status === 200);
  ok('brand/tokens.css is CSS',               brand.headers['content-type']?.includes('css'));
  ok('brand/tokens.css not SSR placeholder',  !brand.body.startsWith('SSR::'));

  if (fontFile) {
    const font = await get(`/${fontBase}/${fontFile}`);
    ok('Font asset HTTP 200',                 font.status === 200);
    ok('Font asset not SSR placeholder',      !font.body.startsWith('SSR::'));
  }

  // ── 2. Page routes — must be forwarded to SSR, not served as static ────────
  console.log('\n[2] Page and API routes (must reach SSR catch-all)');

  const root = await get('/');
  ok('/ routed to SSR',                       root.body === 'SSR::/');

  const deep = await get('/some/deep/path');
  ok('/some/deep/path routed to SSR',         deep.body === 'SSR::/some/deep/path');

  const api = await get('/api/ariadne');
  ok('/api/ariadne routed to SSR',            api.body === 'SSR::/api/ariadne');

  const auth = await get('/api/auth/me');
  ok('/api/auth/me routed to SSR',            auth.body === 'SSR::/api/auth/me');

  // ── 3. SSR must NOT get asset paths (double-check inverse) ────────────────
  console.log('\n[3] Safety checks (assets must never hit SSR)');

  if (jsBundle) {
    const r = await get(`/_expo/static/js/web/${jsBundle}`);
    ok('JS bundle does not hit SSR',           !r.body.startsWith('SSR::'));
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log(`${passed} passed  ${failed} failed`);
  if (failed > 0) {
    console.error('\n❌  Test FAILED — do not push.\n');
    return false;
  }
  console.log('\n✅  All tests passed — safe to push.\n');
  return true;
}

// ── Entry ─────────────────────────────────────────────────────────────────────

console.log(`\nVercel routing integration test`);
console.log(`outputDirectory: ${OUTPUT}`);
console.log(`Server: ${BASE}`);

server.listen(PORT, async () => {
  let exitCode = 0;
  try {
    const ok = await run();
    exitCode = ok ? 0 : 1;
  } catch (e) {
    console.error('Test runner error:', e);
    exitCode = 1;
  } finally {
    server.close();
    process.exit(exitCode);
  }
});
