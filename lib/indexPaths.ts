/**
 * lib/indexPaths.ts
 * ------------------
 * Which index (UK or World Leaders) a page belongs to, from its address. The
 * same on every site: the live domain, Vercel previews and local development.
 *
 *   /uk                      UK dashboard
 *   /worldleaders            World Leaders dashboard
 *   /account/andy-burnham    an account page, on the index you came from
 *   /                        goes to the last index used in the tab (UK first)
 *
 * Account pages have no index in their path, so the tab remembers the last
 * index it was on (sessionStorage). A direct visit with nothing remembered
 * opens on UK, and the account page moves to the other index if the person
 * is only there (components/account/AccountScreen.tsx).
 *
 * Older links still work: /world-leaders goes to /worldleaders, and
 * `?tenant=world` to the matching path.
 *
 * The browser alone cannot pick the data, so fetch is patched: same-origin
 * /api/ calls carry `x-knox-tenant` and `?tenant=` (the query keeps the two
 * indexes apart in the browser cache). The server re-checks access for
 * whichever index is asked for (lib/tenantGuard.ts), so naming World
 * Leaders here never skips its sign-in.
 *
 * One job: map addresses to indexes.
 */

import Constants from 'expo-constants';
import type { Href } from 'expo-router';
import { tenantById, tenantByPath, resolveTenant, DEFAULT_TENANT, type TenantConfig } from '@/lib/tenants';

/** The tab's last index (tenant id), for pages without one in their path. */
const STORAGE_KEY = 'knox_index';
const HEADER      = 'x-knox-tenant';

function hasWindow(): boolean {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined';
}

/**
 * True only on a Vercel PREVIEW build (e.g. the dev branch), never on a
 * production build at any address and never locally. Vercel's VERCEL_ENV is
 * written into the build by app.config.js, so a production build cannot
 * claim to be a preview whatever address it is served from.
 */
export function isPreviewSite(): boolean {
  const vercelEnv = (Constants.expoConfig?.extra as { vercelEnv?: string } | undefined)?.vercelEnv;
  return hasWindow() && process.env.NODE_ENV === 'production' && vercelEnv === 'preview';
}

/** The index named by the first segment of a path, or null. */
export function tenantFromPathname(pathname: string): TenantConfig | null {
  return tenantByPath(pathname.split('/').filter(Boolean)[0]);
}

/** Remembers the index for pages without one in their path. */
export function rememberIndex(tenant: TenantConfig): void {
  try { window.sessionStorage.setItem(STORAGE_KEY, tenant.id); } catch { /* private mode */ }
}

function remembered(): TenantConfig | null {
  try {
    const id = window.sessionStorage.getItem(STORAGE_KEY);
    return id ? tenantById(id) : null;
  } catch { return null; }
}

/**
 * The index this page is on. Order: the path, an old `?tenant=` link, the
 * tab's last index, then the hostname (a worldleaders subdomain, if one is
 * ever set up).
 */
export function currentIndex(): TenantConfig {
  if (!hasWindow()) return DEFAULT_TENANT;

  const fromPath = tenantFromPathname(window.location.pathname);
  if (fromPath) { rememberIndex(fromPath); return fromPath; }

  let fromQuery: string | null = null;
  try { fromQuery = new URLSearchParams(window.location.search).get('tenant'); } catch { /* malformed */ }
  if (fromQuery) { const t = tenantById(fromQuery); rememberIndex(t); return t; }

  return remembered() ?? resolveTenant(window.location.hostname);
}

/** Home of an index: '/uk' or '/worldleaders'. Defaults to the current one. */
export function homeHref(tenant?: TenantConfig): string {
  return `/${(tenant ?? currentIndex()).path}`;
}

/** An account page. The same address whichever index it is on. */
export function accountHref(slug: string): Href {
  return `/account/${encodeURIComponent(slug.replace(/^@/, ''))}` as Href;
}

let patched = false;

/** Patches window.fetch so same-origin /api/ calls carry the current index. Idempotent. */
export function installIndexFetch(): void {
  if (!hasWindow() || patched) return;
  const tenant = currentIndex().id;
  const original = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let url: URL | null = null;
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      url = new URL(raw, window.location.origin);
    } catch { /* exotic input — fall through unmodified */ }

    if (!url || url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
      return original(input as any, init);
    }

    // A call that names its own tenant (admin panel, account fallback) keeps it.
    if (!url.searchParams.has('tenant')) url.searchParams.set('tenant', tenant);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has(HEADER)) headers.set(HEADER, url.searchParams.get('tenant') ?? tenant);
    const target = typeof input === 'string' || input instanceof URL ? url.toString() : new Request(url.toString(), input as Request);
    return original(target as any, { ...init, headers });
  };

  patched = true;
}
