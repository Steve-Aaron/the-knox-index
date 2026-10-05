/**
 * lib/devTenant.ts
 * -----------------
 * Local-preview support for tenants you cannot reach by hostname.
 *
 * `worldleaders.localhost:8081` works in Chrome and Firefox, which map every
 * *.localhost name to loopback. Safari does not, and neither does a machine
 * with a strict resolver — so `?tenant=world` is the fallback.
 *
 * A query string alone is not enough, though: the page would render the World
 * Leaders brand while its fetches to /api/* still carried the localhost Host
 * header and came back with Knox Index data. So this module does two things:
 *
 *   1. remembers the override for the tab (sessionStorage), so it survives
 *      client-side navigation that drops the query string
 *   2. patches fetch to send `x-knox-tenant` on same-origin /api/ calls, which
 *      is the same header lib/tenantRequest.ts already honours in development
 *
 * Every path here is dead in production: the checks are on NODE_ENV, not on
 * the presence of the flag, and the server ignores the header when built for
 * production regardless.
 *
 * One job: make `?tenant=<id>` a truthful local preview.
 */

const STORAGE_KEY = 'knox_dev_tenant';
const HEADER      = 'x-knox-tenant';
/** Values that mean 'stop overriding', so the URL can undo itself. */
const CLEAR_VALUES = new Set(['off', 'clear', 'none', 'reset', '']);

function isDevWeb(): boolean {
  return process.env.NODE_ENV !== 'production'
    && typeof window !== 'undefined'
    && typeof window.location !== 'undefined';
}

/** The forced tenant id for this tab, or null. Query string wins, then the tab's memory. */
export function readDevTenantOverride(): string | null {
  if (!isDevWeb()) return null;

  let fromQuery: string | null = null;
  try {
    fromQuery = new URLSearchParams(window.location.search).get('tenant');
  } catch { /* malformed query string */ }

  if (fromQuery !== null) {
    // ?tenant=off (or clear/none/reset) removes the override for the tab.
    if (CLEAR_VALUES.has(fromQuery.trim().toLowerCase())) {
      clearDevTenantOverride();
      return null;
    }
    try { window.sessionStorage.setItem(STORAGE_KEY, fromQuery); } catch { /* private mode */ }
    return fromQuery;
  }

  try { return window.sessionStorage.getItem(STORAGE_KEY); } catch { return null; }
}

/** Clears the override for this tab. */
export function clearDevTenantOverride(): void {
  if (!isDevWeb()) return;
  try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
}

let patched = false;

/**
 * Patches window.fetch so same-origin /api/ calls carry the override header.
 * Idempotent, and a no-op when there is no override or outside development.
 */
export function installDevTenantFetch(): void {
  if (!isDevWeb() || patched) return;

  const tenant = readDevTenantOverride();
  if (!tenant) return;

  const original = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let path = '';
    try {
      path = typeof input === 'string'
        ? input
        : input instanceof URL ? input.pathname : (input as Request).url;
    } catch { /* exotic input — fall through unmodified */ }

    const sameOriginApi = path.startsWith('/api/')
      || path.startsWith(`${window.location.origin}/api/`);

    if (!sameOriginApi) return original(input as any, init);

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(HEADER, tenant);
    return original(input as any, { ...init, headers });
  };

  patched = true;
  // Loud on purpose: this line is the difference between 'the data looks wrong'
  // and 'oh, I am in override mode'. The on-screen badge says the same thing
  // for anyone not watching the console.
  console.info(`[dev] tenant override active → ${tenant}. Visit ?tenant=off, or use the badge, to clear it.`);
}

/**
 * Drops the override and reloads on the current path with no query string, so
 * the tab goes back to resolving the tenant from the hostname.
 */
export function exitDevTenantOverride(): void {
  if (!isDevWeb()) return;
  clearDevTenantOverride();
  window.location.replace(window.location.pathname);
}
