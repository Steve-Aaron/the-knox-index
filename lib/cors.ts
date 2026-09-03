/**
 * lib/cors.ts
 * -----------
 * Cross-origin access policy for the public API.
 *
 * WHY THIS EXISTS
 * The API is served from index.knox.digital. The developer documentation is
 * served from docs.index.knox.digital. Those are different origins, so any
 * browser call from the docs page to the API is cross-origin and the browser
 * discards the response unless the API says otherwise. This module is the
 * single place that decides which origins are allowed to do that.
 *
 * ALLOWLIST, NOT WILDCARD
 * `Access-Control-Allow-Origin: *` is illegal alongside
 * `Access-Control-Allow-Credentials: true`, and the API authenticates with a
 * cookie. So the response must echo one specific origin. The allowlist comes
 * from the CORS_ALLOWED_ORIGINS env var (comma-separated) and fails closed:
 * unset means no cross-origin browser access at all.
 *
 * NOT COVERED HERE
 * `/api/cover/*` and `/api/mp/*` are public media proxies that set their own
 * `Access-Control-Allow-Origin: *`. They carry no credentials, so the wildcard
 * is correct for them and they are deliberately left alone.
 *
 * One job: decide the CORS headers for a given request origin.
 */

/** Methods the API exposes across every route. */
const ALLOWED_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';

/** Request headers a cross-origin caller may send. */
const ALLOWED_HEADERS = 'Content-Type, Authorization';

/** How long a browser may cache a preflight result, in seconds. */
const PREFLIGHT_MAX_AGE = '86400';

/**
 * Parses CORS_ALLOWED_ORIGINS into a normalised set.
 * Read per call rather than at module load so a redeploy is not required
 * for the value to take effect in long-lived Lambda instances.
 */
export function allowedOrigins(): string[] {
  return (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o: string) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/** Is this Origin header value permitted to make credentialed browser calls? */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return allowedOrigins().includes(origin.replace(/\/$/, ''));
}

/**
 * CORS response headers for a given origin.
 * Returns an empty object when the origin is absent or not allowlisted, so a
 * disallowed caller gets no CORS headers rather than a permissive default.
 *
 * `Vary: Origin` is always returned, allowlisted or not: the response body
 * does not vary by origin but the headers do, and without Vary a CDN can
 * serve one origin's cached headers to another.
 */
export function corsHeaders(origin: string | null | undefined): Record<string, string> {
  if (!isAllowedOrigin(origin)) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': (origin as string).replace(/\/$/, ''),
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Type',
    Vary: 'Origin',
  };
}

/** Additional headers a preflight (OPTIONS) response needs on top of the above. */
export function preflightHeaders(origin: string | null | undefined): Record<string, string> {
  const base = corsHeaders(origin);
  if (!('Access-Control-Allow-Origin' in base)) return base;
  return {
    ...base,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Max-Age': PREFLIGHT_MAX_AGE,
  };
}
