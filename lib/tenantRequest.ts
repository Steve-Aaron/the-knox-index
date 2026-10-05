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
 * Development only: `?tenant=world` or an `x-knox-tenant: world` header force a
 * tenant, so both sites can be exercised from a single localhost origin. The
 * override is ignored in production — otherwise anyone could read a gated
 * dashboard by adding a query string.
 */

import { resolveTenant, tenantById, type TenantConfig } from '@/lib/tenants';

export function tenantFromRequest(request: Request): TenantConfig {
  if (process.env.NODE_ENV !== 'production') {
    const headerOverride = request.headers.get('x-knox-tenant');
    let queryOverride: string | null = null;
    try { queryOverride = new URL(request.url).searchParams.get('tenant'); } catch { /* non-absolute URL */ }
    const override = queryOverride ?? headerOverride;
    if (override) return tenantById(override);
  }

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  return resolveTenant(host);
}

/** The dashboard id every gated SQL builder needs. Convenience wrapper. */
export function dashboardIdFromRequest(request: Request): number {
  return tenantFromRequest(request).dashboardId;
}
