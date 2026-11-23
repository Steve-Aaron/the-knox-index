/**
 * lib/tenantGuard.ts
 * -------------------
 * The single gate every tenant-scoped API route calls first. Server-side only.
 *
 * It does two things in one pass:
 *   1. Resolves the tenant from the request host (lib/tenantRequest.ts)
 *   2. Decides whether this caller may read it (lib/tenantAccess.ts)
 *
 * On a public tenant it short-circuits before touching Firebase or Firestore,
 * so The Knox Index pays nothing for the gate that protects World Leaders.
 *
 * One job: return the tenant, or the Response that refuses the request.
 */

import { tenantFromRequest } from '@/lib/tenantRequest';
import { decideAccess, type AccessDecision } from '@/lib/tenantAccess';
import { identityFromRequest } from '@/lib/sessionIdentity';
import type { TenantConfig } from '@/lib/tenants';
import { previewFullAccess } from '@/lib/devIdentity';

export interface TenantGuard {
  tenant:   TenantConfig;
  email:    string | null;
  decision: AccessDecision;
  /** Non-null when the request must be refused — return it straight from the route. */
  denied:   Response | null;
}

export async function guardTenant(
  request: Request,
  opts: { requireFullAccess?: boolean } = {},
): Promise<TenantGuard> {
  const tenant = tenantFromRequest(request);

  // Public tenants are always an open read.
  if (tenant.access.mode === 'public') {
    return {
      tenant,
      email:    null,
      decision: { allowed: true, reason: 'public' },
      denied:   null,
    };
  }

  // A waitlist index serves its SHARED routes the way The Knox Index does: the
  // guest limits (top 5, short ranges, no post feed) are applied in the client,
  // so the read itself is open. Detail routes that are NOT part of the guest
  // view (the per-account page) pass requireFullAccess, which drops through to
  // the real decision below — so that data is refused without approval, even on
  // a direct API call.
  if (tenant.access.mode === 'waitlist' && !opts.requireFullAccess) {
    return {
      tenant,
      email:    null,
      decision: { allowed: true, reason: 'public' },
      denied:   null,
    };
  }

  // Vercel preview only: the reviewer turned on full access in the preview bar
  if (previewFullAccess(request.headers.get('Cookie'))) {
    return { tenant, email: null, decision: { allowed: true, reason: 'dev-bypass' }, denied: null };
  }

  // The signed-in caller (uid + email), or null. Dev stand-in handled inside.
  const identity = await identityFromRequest(request);
  const email    = identity?.email ?? null;

  const decision = await decideAccess(identity, tenant);
  if (decision.allowed) return { tenant, email, decision, denied: null };

  const status = decision.reason === 'unauthenticated' ? 401 : 403;
  const denied = Response.json(
    {
      error:  decision.reason === 'unauthenticated'
        ? 'Sign in required'
        : 'This dashboard is restricted',
      reason: decision.reason,
      tenant: tenant.id,
    },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );

  return { tenant, email, decision, denied };
}
