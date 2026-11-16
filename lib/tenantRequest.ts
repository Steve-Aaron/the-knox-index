/**
 * lib/tenantRequest.ts
 * ---------------------
 * Server-side tenant resolution. ONE job: turn an incoming Request into the
 * TenantConfig it belongs to, so every query and gate downstream is scoped to
 * the right dashboard.
 *
 * Never import from a client component — API routes only.
 *
 * Host precedence:
 *   1. x-forwarded-host  (Vercel sets this; it is the domain the user typed)
 *   2. host              (direct / local dev)
 *
 * The page names its index (/uk, /worldleaders; lib/indexPaths.ts) and sends
 * it as `?tenant=` and an `x-knox-tenant` header; that wins over the host on
 * every site. Naming an index never grants access to it: every data route
 * calls guardTenant (lib/tenantGuard.ts), which applies that index's own
 * access rules, so World Leaders still needs sign-in.
 */

import { resolveTenant, tenantById, isKnownTenant, type TenantConfig } from '@/lib/tenants';

export function tenantFromRequest(request: Request): TenantConfig {
  const headerOverride = request.headers.get('x-knox-tenant');
  let queryOverride: string | null = null;
  try { queryOverride = new URL(request.url).searchParams.get('tenant'); } catch { /* non-absolute URL */ }
  const override = queryOverride ?? headerOverride;
  if (override && isKnownTenant(override)) return tenantById(override);

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  return resolveTenant(host);
}

/** The dashboard id every gated SQL builder needs. Convenience wrapper. */
export function dashboardIdFromRequest(request: Request): number {
  return tenantFromRequest(request).dashboardId;
}
