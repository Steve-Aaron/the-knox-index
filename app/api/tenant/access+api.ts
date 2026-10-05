/**
 * app/api/tenant/access+api.ts
 * -----------------------------
 * The client's view of its own access to the current tenant.
 *
 * GET  /api/tenant/access  → { tenant, mode, email, allowed, reason }
 * POST /api/tenant/access  → records a pending access request for the
 *                            signed-in user from the request form, emails
 *                            Knox and the requester, then returns the same
 *                            shape as GET
 *
 * Never 401s: the gate UI needs to know WHY it is locked in order to show the
 * right screen (sign in / awaiting approval / refused), so the state is always
 * returned with a 200.
 */

import { verifySession } from '@/lib/firebaseAdmin';
import { devSessionEmail } from '@/lib/devIdentity';
import { tenantFromRequest } from '@/lib/tenantRequest';
import { tenantFullName } from '@/lib/tenants';
import { decideAccess, requestAccess, getAccessRecord, type AccessRequestDetails } from '@/lib/tenantAccess';
import { notifyKnoxOfRequest, confirmRequestToRequester } from '@/lib/accessEmails';
import { REGION_KEYS } from '@/lib/regions';
import { safeErrorDetail } from '@/lib/errors';

const NO_STORE = { 'Cache-Control': 'no-store' };

async function currentEmail(request: Request): Promise<string | null> {
  try {
    const user = await verifySession(request.headers.get('Cookie'));
    if (user?.email) return user.email;
  } catch { /* no or invalid cookie */ }

  // Development only: DEV_TENANT_EMAIL stands in for the session cookie so the
  // request form can be exercised on localhost. See lib/devIdentity.ts.
  return devSessionEmail();
}

export async function GET(request: Request): Promise<Response> {
  const tenant = tenantFromRequest(request);
  const email  = tenant.access.mode === 'public' ? null : await currentEmail(request);

  try {
    const decision = await decideAccess(email, tenant);
    return Response.json(
      {
        // The dashboard id is the identifier; the slug is along for readability.
        dashboardId: tenant.dashboardId,
        tenant:      tenant.id,
        name:        tenantFullName(tenant),
        mode:        tenant.access.mode,
        email,
        allowed:     decision.allowed,
        reason:      decision.reason,
      },
      { headers: NO_STORE },
    );
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/tenant/access] GET failed:', logMessage);
    return Response.json({ error: 'Access check failed', detail: clientDetail }, { status: 500, headers: NO_STORE });
  }
}

/**
 * Whitelist the region keys so a hand-rolled POST cannot store arbitrary
 * strings. These are AREAS OF INTEREST — what the requester wants to read
 * about. They have nothing to do with what an approved user may see.
 */
function cleanAreasOfInterest(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(REGION_KEYS as readonly string[]);
  return raw.map(r => String(r)).filter(r => allowed.has(r)).slice(0, 8);
}

function readDetails(body: any): AccessRequestDetails {
  const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
  return {
    requesterName:  text(body?.name,           128),
    organisation:   text(body?.organisation,   160),
    jobRole:        text(body?.role,           128),
    reason:         text(body?.reason,        1000),
    referralSource:  text(body?.referralSource, 120),
    areasOfInterest: cleanAreasOfInterest(body?.areasOfInterest),
  };
}

export async function POST(request: Request): Promise<Response> {
  const tenant = tenantFromRequest(request);

  if (tenant.access.mode === 'public') {
    return Response.json({ dashboardId: tenant.dashboardId, tenant: tenant.id, allowed: true, reason: 'public' }, { headers: NO_STORE });
  }

  const email = await currentEmail(request);
  if (!email) {
    return Response.json(
      { dashboardId: tenant.dashboardId, tenant: tenant.id, allowed: false, reason: 'unauthenticated' },
      { status: 401, headers: NO_STORE },
    );
  }

  let body: any = {};
  try { body = await request.json(); } catch { /* an empty body is still a valid request */ }

  // Someone who is already in has nothing to request. Domain-allowed staff can
  // reach this endpoint (a stale tab, a direct POST), and writing them a
  // pending row would put a request in the admin queue that nobody can action
  // and that says nothing about their access.
  const existing = await decideAccess(email, tenant);
  if (existing.allowed) {
    return Response.json(
      { dashboardId: tenant.dashboardId, tenant: tenant.id, email, status: 'approved', allowed: true, reason: existing.reason },
      { headers: NO_STORE },
    );
  }

  const details = readDetails(body);

  // Name and reason are what make a request reviewable; the rest is optional.
  if (!details.requesterName || !details.reason) {
    return Response.json(
      { error: 'Your name and a reason for access are required', field: !details.requesterName ? 'name' : 'reason' },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const status   = await requestAccess(email, tenant, details);
    const decision = await decideAccess(email, tenant);

    // Emails are best-effort and must not fail the submission — the row is
    // already stored, and it is what the admin panel reads.
    if (status === 'pending') {
      const record = await getAccessRecord(email, tenant);
      if (record) {
        await Promise.allSettled([
          notifyKnoxOfRequest(record, tenant),
          confirmRequestToRequester(record, tenant),
        ]);
      }
    }

    return Response.json(
      { dashboardId: tenant.dashboardId, tenant: tenant.id, email, status, allowed: decision.allowed, reason: decision.reason },
      { headers: NO_STORE },
    );
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/tenant/access] POST failed:', logMessage);
    return Response.json({ error: 'Could not record the request', detail: clientDetail }, { status: 500, headers: NO_STORE });
  }
}
