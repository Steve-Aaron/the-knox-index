/**
 * lib/devTenant.ts
 * -----------------
 * Index paths for one-address setups: local development and Vercel preview
 * deployments, where there is no worldleaders subdomain. The live site uses
 * its subdomains and none of this runs there.
 *
 * The address says which index you are on, and every page has one:
 *
 *   /uk                          UK dashboard
 *   /uk/andy-burnham             UK account page
 *   /world-leaders               World Leaders dashboard
 *   /world-leaders/lula-da-silva World Leaders account page
 *   /                            goes to the last index used in the tab (UK first)
 *
 * Pages without an index in their path (privacy, preferences, sign-in, admin)
 * keep the index you came from: the tab remembers the last index path.
 * The old `?tenant=world` still works and lands on the matching path.
 *
 * The browser alone cannot pick the data, so this module also patches fetch:
 * same-origin /api/ calls carry `x-knox-tenant` and `?tenant=` (the query
 * keeps the indexes apart in the browser cache). The server only honours them
 * locally or when Vercel says the build is a preview (lib/tenantRequest.ts),
 * and gated indexes still need sign-in or preview Full access.
 *
 * One job: map addresses to indexes where one address serves both.
 */

import type { Href } from 'expo-router';
import { tenantById, tenantByPath, DEFAULT_TENANT, type TenantConfig } from '@/lib/tenants';

/** The tab's last index (tenant id), for pages without an index in their path. */
const STORAGE_KEY = 'knox_index';
const HEADER      = 'x-knox-tenant';

/** Production's own vercel.app names, which are not previews. */
const PRODUCTION_VERCEL_HOSTS = new Set(['theknoxindex.vercel.app', 'theknoxindex-steveaarons-projects.vercel.app']);

/**
 * A Vercel preview address: *.vercel.app, but not production's own names or
 * the main branch's alias. Only decides what the browser offers; the server
 * decides for itself whether to honour it.
 */
function isPreviewHost(host: string): boolean {
  const h = host.toLowerCase();
  return h.endsWith('.vercel.app') && !PRODUCTION_VERCEL_HOSTS.has(h) && !h.includes('-git-main-');
}

function hasWindow(): boolean {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined';
}

/** True on a Vercel preview address in a production build (never locally, never live). */
export function isPreviewSite(): boolean {
  return hasWindow() && process.env.NODE_ENV === 'production' && isPreviewHost(window.location.hostname);
}

/** True where index paths are used: local development or a Vercel preview. */
export function tenantSwitchAllowed(): boolean {
  if (!hasWindow()) return false;
  return process.env.NODE_ENV !== 'production' || isPreviewHost(window.location.hostname);
}

/** The index named by the first segment of a path, or null. */
export function tenantFromPathname(pathname: string): TenantConfig | null {
  return tenantByPath(pathname.split('/').filter(Boolean)[0]);
}

function remember(tenant: TenantConfig): void {
  try { window.sessionStorage.setItem(STORAGE_KEY, tenant.id); } catch { /* private mode */ }
}

function remembered(): TenantConfig | null {
  try {
    const id = window.sessionStorage.getItem(STORAGE_KEY);
    return id ? tenantById(id) : null;
  } catch { return null; }
}

/**
 * The index this page is on (tenant id), or null to resolve from the
 * hostname. Order: the path, then an old `?tenant=` link, then the tab's
 * last index for pages without one in their path.
 */
export function readDevTenantOverride(): string | null {
  if (!tenantSwitchAllowed()) return null;

  const fromPath = tenantFromPathname(window.location.pathname);
  if (fromPath) {
    remember(fromPath);
    return fromPath.id;
  }

  let fromQuery: string | null = null;
  try { fromQuery = new URLSearchParams(window.location.search).get('tenant'); } catch { /* malformed */ }
  if (fromQuery) {
    const t = tenantById(fromQuery);
    remember(t);
    return t.id;
  }

  return remembered()?.id ?? null;
}

/** Where '/' goes when index paths are used: the tab's last index, else UK. */
export function rootIndexPath(): string {
  const t = readDevTenantOverride();
  return `/${(t ? tenantById(t) : DEFAULT_TENANT).path}`;
}

/** Home of the current index: '/uk' or '/world-leaders' here, '/' on the live site. */
export function homeHref(tenant?: TenantConfig): string {
  if (!tenantSwitchAllowed()) return '/';
  const current = readDevTenantOverride();
  const t = tenant ?? (current ? tenantById(current) : DEFAULT_TENANT);
  return `/${t.path}`;
}

/** An account page on the current index: '/uk/andy-burnham' here, '/account/andy-burnham' live. */
export function accountHref(slug: string): Href {
  const clean = encodeURIComponent(slug.replace(/^@/, ''));
  return (tenantSwitchAllowed() ? `${homeHref()}/${clean}` : `/account/${clean}`) as Href;
}

let patched = false;

/**
 * Patches window.fetch so same-origin /api/ calls carry the index. Idempotent,
 * and a no-op on the live site or when the page resolves from its hostname.
 */
export function installDevTenantFetch(): void {
  if (!tenantSwitchAllowed() || patched) return;

  const tenant = readDevTenantOverride();
  if (!tenant) return;

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

    // In the URL as well as the header: the browser caches /api/ responses by
    // URL alone, so without it a UK response would be reused for World Leaders.
    // A call that names its own tenant (the admin access panel) keeps it.
    if (!url.searchParams.has('tenant')) url.searchParams.set('tenant', tenant);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(HEADER, tenant);
    const target = typeof input === 'string' || input instanceof URL ? url.toString() : new Request(url.toString(), input as Request);
    return original(target as any, { ...init, headers });
  };

  patched = true;
}
