/**
 * api/[...all].ts
 * ---------------
 * Vercel serverless function entry point.
 * Catches all requests and delegates to the Expo Router server bundle,
 * which handles both API routes and HTML serving.
 *
 * WRITTEN IN COMMONJS ON PURPOSE — do not convert to import/export.
 * The Lambda executes the compiled file as CommonJS (.js, no
 * "type": "module"). ESM `import` syntax here compiles to an import
 * statement under the project tsconfig (module: esnext) and crashes EVERY
 * request with 'SyntaxError: Cannot use import statement outside a module'.
 * require() survives any tsconfig module setting.
 *
 * For the same reason this file must NOT require local `lib/*` modules —
 * they compile to ES modules and fail to load. The CORS logic below is
 * therefore duplicated from lib/cors.ts by necessity. Keep the two in sync.
 *
 * `build` must be a path string pointing at the dist/server directory —
 * NOT a require() call, since dist/server has no index.js entry point.
 *
 * CORS
 * Applied here rather than per route so there is one policy for all 23 Expo
 * API routes. Note this wrapper only runs on Vercel: the local Expo dev
 * server serves app/api routes directly and does not pass through this file,
 * so cross-origin browser calls are a production-only capability.
 * `/api/cover/*` is a separate native function and sets its own wildcard.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { createRequestHandler } = require('@expo/server/adapter/vercel');
const { join } = require('node:path');

const handler = createRequestHandler({
  build: join(__dirname, '../dist/server'),
});

// ── CORS (mirrors lib/cors.ts; kept inline by design) ─────────────────────────

const ALLOWED_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization';
const PREFLIGHT_MAX_AGE = '86400';

/** Allowlisted origins from env. Fails closed: unset means no CORS. */
function allowedOrigins(): string[] {
  return (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o: string) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return false;
  return allowedOrigins().indexOf(origin.replace(/\/$/, '')) !== -1;
}

module.exports = function corsWrappedHandler(req: any, res: any) {
  const origin: string | undefined = req.headers && req.headers.origin;

  // Always Vary on Origin: the headers differ by origin even when the body
  // does not, and without this a CDN can leak one origin's headers to another.
  res.setHeader('Vary', 'Origin');

  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', (origin as string).replace(/\/$/, ''));
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  }

  // Answer preflight here. It never needs to reach the Expo router, and an
  // unhandled OPTIONS would 405 before any CORS headers were read.
  if (req.method === 'OPTIONS') {
    if (isAllowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
      res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      res.setHeader('Access-Control-Max-Age', PREFLIGHT_MAX_AGE);
    }
    res.statusCode = 204;
    res.end();
    return;
  }

  return handler(req, res);
};
