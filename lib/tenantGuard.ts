/**
 * lib/tenantGuard.ts
 * -------------------
 * The single gate every tenant-scoped API route calls first. Server-side only.
 *
 * It does two things in one pass:
 *   1. Resolves the tenant from the request host (lib/tenantRequest.ts)
 *   2. Decides whether this caller may read it (lib/tenantAccess.ts)
 *
 * On a public tenant it short-circuits before touching Firebase or BigQuery,
 * so The Knox Index pays nothing for the gate that protects World Leaders.
 *
 * One job: return the tenant, or the Response that refuses the request.
 */

import { verifySession } from '@/lib/firebaseAdmin';
import { tenantFromRequest } from '@/lib/tenantRequest';
import { decideAccess, type AccessDecision } from '@/lib/tenantAccess';
import type { TenantConfig } from '@/lib/tenants';
import { devSessionEmail } from '@/lib/devIdentity';

export interface TenantGuard {
  tenant:   TenantConfig;
  email:    string | null;
  decision: AccessDecision;
  /** Non-null when the request must be refused — return it straight from the route. */
  denied:   Response | null;
}

export async function guardTenant(request: Request): Promise<TenantGuard> {
  const tenant = tenantFromRequest(request);

  if (tenant.access.mode === 'public') {
    return {
      tenant,
      email:    null,
      decision: { allowed: true, reason: 'public' },
      denied:   null,
    };
  }

  let email: string | null = null;
  try {
    const user = await verifySession(request.headers.get('Cookie'));
    email = user?.email ?? null;
  } catch {
    email = null;
  }

  // Development only: stand in for a session cookie so a gated dashboard can be
  // opened on localhost, where magic-link sign-in is impractical. The access
  // rules below still run in full against this address.
  if (!email) email = devSessionEmail();

  const decision = await decideAccess(email, tenant);
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
