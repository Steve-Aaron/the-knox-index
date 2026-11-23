/**
 * app/api/tenant/access+api.ts
 * -----------------------------
 * The client's view of its own access to the current tenant.
 *
 * GET  /api/tenant/access  → { tenant, mode, email, allowed, reason }
 * POST /api/tenant/access  → records a pending request for the SIGNED-IN
 *                            caller and alerts Knox. A guest (no session) is
 *                            refused with 401: joining needs a verified
 *                            sign-in, so the request is always tied to a real
 *                            Firebase uid and the email in the body is ignored.
 *
 * GET never 401s: the gate UI needs to know WHY it is locked to show the right
 * screen, so the state is always returned with a 200.
 */

import { previewFullAccess } from '@/lib/devIdentity';
import { tenantFromRequest } from '@/lib/tenantRequest';
import { identityFromRequest } from '@/lib/sessionIdentity';
import { isAllowedDomain, tenantFullName } from '@/lib/tenants';
import { decideAccess, requestAccess, getAccessStatus } from '@/lib/tenantAccess';
import { notifyKnoxOfRequest, confirmRequestToRequester, emailOrigin, type Requester } from '@/lib/accessEmails';
import { safeErrorDetail } from '@/lib/errors';
import { readProfileAnswers, saveProfileToBrevo, type ProfileAnswers } from '@/lib/brevoProfile';
import { segmentLabel, interestLabels } from '@/data/profileOptions';
import { addToIndexList } from '@/lib/brevoIndexList';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: Request): Promise<Response> {
  const tenant   = tenantFromRequest(request);
  const identity = tenant.access.mode === 'public' ? null : await identityFromRequest(request);

  try {
    // Vercel preview only: full access turned on in the preview bar (same rule as lib/tenantGuard.ts)
    const decision = previewFullAccess(request.headers.get('Cookie'))
      ? { allowed: true as const, reason: 'dev-bypass' as const }
      : await decideAccess(identity, tenant);
    return Response.json(
      {
        // The dashboard id is the identifier; the slug is along for readability.
        dashboardId: tenant.dashboardId,
        tenant:      tenant.id,
        name:        tenantFullName(tenant),
        mode:        tenant.access.mode,
        email:       identity?.email ?? null,
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

// ── Building the Knox alert from what the caller sent ───────────────────────

/** The waitlist's 'Help us tailor your experience' answers → an alert. */
function requesterFromProfile(email: string, a: ProfileAnswers): Requester {
  const name = [a.firstName, a.lastName].filter(Boolean).join(' ').slice(0, 128);
  return {
    email,
    name,
    details: [
      `Name: ${name || 'Not given'}`,
      `Company: ${a.company || 'Not given'}`,
      `Who they are: ${a.segment ? segmentLabel(a.segment) : 'Not given'}`,
      `Wants to: ${a.interests.length ? interestLabels(a.interests) : 'Not given'}`,
      `LinkedIn: ${a.linkedin || 'Not given'}`,
    ],
  };
}

/** The gated index's own form (name + reason required). */
function requesterFromBody(email: string, body: any): { who: Requester; name: string; reason: string } {
  const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
  const name   = text(body?.name, 128);
  const org    = text(body?.organisation, 160);
  const role   = text(body?.role, 128);
  const reason = text(body?.reason, 1000);
  return {
    who: {
      email,
      name,
      details: [
        `Name: ${name || 'Not given'}`,
        `Organisation: ${org || 'Not given'}`,
        `Role: ${role || 'Not given'}`,
        '',
        `Reason: ${reason || 'Not given'}`,
      ],
    },
    name,
    reason,
  };
}

/**
 * POST — join the waitlist / ask for access. Signed-in callers only.
 *
 * Waitlist (World Leaders): the person has already signed in (verified email),
 * so the request is filed against their Firebase uid in Firestore and their
 * details go to Brevo, tied back by that uid. Nothing identifying is stored in
 * the access layer. Knox is alerted; the approval email signs them straight in.
 *
 * Authenticated index: the signed-in caller, with name and reason required.
 */
export async function POST(request: Request): Promise<Response> {
  const tenant = tenantFromRequest(request);
  const base   = { dashboardId: tenant.dashboardId, tenant: tenant.id };

  if (tenant.access.mode === 'public') {
    return Response.json({ ...base, allowed: true, reason: 'public' }, { headers: NO_STORE });
  }

  const identity = await identityFromRequest(request);
  if (!identity) {
    return Response.json(
      { ...base, error: 'Sign in to join', allowed: false, reason: 'unauthenticated' },
      { status: 401, headers: NO_STORE },
    );
  }
  const { uid, email } = identity;

  let body: any = {};
  try { body = await request.json(); } catch { /* an empty body is still a valid request */ }

  const isWaitlist = tenant.access.mode === 'waitlist';

  try {
    // Knox addresses are in by domain: they only need to sign in.
    if (isAllowedDomain(email, tenant)) {
      return Response.json({ ...base, email, status: 'signin', allowed: true, reason: 'domain' }, { headers: NO_STORE });
    }

    // Already approved (a stale tab, a direct POST): nothing to request.
    const existing = await decideAccess(identity, tenant);
    if (existing.allowed) {
      return Response.json({ ...base, email, status: 'approved', allowed: true, reason: existing.reason }, { headers: NO_STORE });
    }

    // Collect the answers and check the required ones.
    const profile = isWaitlist ? readProfileAnswers(body) : null;
    let who: Requester;

    if (isWaitlist) {
      if (!profile!.segment && profile!.interests.length === 0) {
        return Response.json({ error: 'Tell us a little about yourself', field: 'segment' }, { status: 400, headers: NO_STORE });
      }
      who = requesterFromProfile(email, profile!);
    } else {
      const parsed = requesterFromBody(email, body);
      if (!parsed.name || !parsed.reason) {
        return Response.json(
          { error: 'Your name and a reason for access are required', field: !parsed.name ? 'name' : 'reason' },
          { status: 400, headers: NO_STORE },
        );
      }
      who = parsed.who;
    }

    const before = await getAccessStatus(uid, tenant);
    const status = await requestAccess(identity, tenant);

    // Waitlist: save the details to Brevo, tied to the uid, then add to the
    // World Leaders list. Best-effort — the access decision is already stored.
    if (isWaitlist && profile) {
      const saved = await saveProfileToBrevo(email, profile, { includeBriefing: false, firebaseUid: uid });
      if (!saved.ok) console.error('[/api/tenant/access] Brevo save failed', saved.status, saved.detail ?? '');
      else await addToIndexList(email, tenant);
    }

    // Alert Knox once per new request. The gated index also acknowledges; the
    // waitlist stays quiet until the decision.
    if (status === 'pending' && before === 'none') {
      const sends = [notifyKnoxOfRequest(who, tenant, emailOrigin(request))];
      if (!isWaitlist) sends.push(confirmRequestToRequester(who, tenant));
      const results = await Promise.allSettled(sends);
      results.forEach(r => {
        if (r.status === 'rejected') console.error('[/api/tenant/access] email failed:', r.reason?.message ?? r.reason);
      });
    }

    const decision = await decideAccess(identity, tenant);
    return Response.json(
      { ...base, email, status, allowed: decision.allowed, reason: decision.reason },
      { headers: NO_STORE },
    );
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/tenant/access] POST failed:', logMessage);
    return Response.json({ error: 'Could not record the request', detail: clientDetail }, { status: 500, headers: NO_STORE });
  }
}
