/**
 * lib/cacheHeaders.ts
 * -------------------
 * Cache-Control for successful tenant-scoped data responses. Server-side only.
 *
 * Vercel's CDN keys its cache on host + path + query. The session cookie is
 * NOT part of the key, and a cached hit never reaches the function, so
 * guardTenant() does not run. A shared copy of a gated tenant's response
 * would therefore be served to anyone. Only public tenants get a CDN copy.
 *
 * One job: pick the cache headers a tenant's data response may carry.
 */

import type { TenantConfig } from '@/lib/tenants';

/**
 * Default CDN policy: 30 min fresh, then one request gets the stale copy while
 * the CDN refetches in the background (up to 1h). The n8n pipeline writes to
 * BigQuery only ~3 times a day, so visitors see an update within ~30 min, as
 * they did with the old 30-min browser cache.
 * Responses embedding signed GCS URLs rely on this staying well below
 * SIGNED_URL_TTL_MS in lib/gcs.ts (worst case ~1.6h vs a 24h signature).
 */
export const CDN_DATA = 's-maxage=1800, stale-while-revalidate=3600';

/** Gated tenants: browser-only cache, never a shared copy. */
const PRIVATE_HEADERS = { 'Cache-Control': 'private, max-age=1800' };

export function dataCacheHeaders(
  tenant: TenantConfig,
  cdn: string = CDN_DATA,
): Record<string, string> {
  if (tenant.access.mode !== 'public') return PRIVATE_HEADERS;
  return {
    'Cache-Control':            'public, max-age=300',
    'Vercel-CDN-Cache-Control': cdn,
  };
}
