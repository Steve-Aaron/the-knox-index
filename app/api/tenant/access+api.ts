/**
 * app/api/tenant/access+api.ts
 * -----------------------------
 * The client's view of its own access to the current tenant.
 *
 * GET  /api/tenant/access  → { tenant, mode, email, allowed, reason }
 * POST /api/tenant/access  → records a pending access request and alerts
 *                            Knox. On a waitlist index a visitor needs no
 *                            sign-in, only an email (see POST below)
 *
 * Never 401s: the gate UI needs to know WHY it is locked in order to show the
 * right screen (sign in / awaiting approval / refused), so the state is always
 * returned with a 200.
 */

import { verifySession } from '@/lib/firebaseAdmin';
import { devSessionEmail, previewFullAccess } from '@/lib/devIdentity';
import { tenantFromRequest } from '@/lib/tenantRequest';
import { isAllowedDomain, tenantFullName } from '@/lib/tenants';
import { decideAccess, requestAccess, getAccessRecord, getAccessStatus, type AccessRequestDetails } from '@/lib/tenantAccess';
import { notifyKnoxOfRequest, confirmRequestToRequester, emailOrigin } from '@/lib/accessEmails';
import { REGION_KEYS } from '@/lib/regions';
import { safeErrorDetail } from '@/lib/errors';
import { readProfileAnswers, saveProfileToBrevo, type ProfileAnswers } from '@/lib/brevoProfile';
import { segmentLabel, interestLabels } from '@/data/profileOptions';

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
    // Vercel preview only: full access turned on in the preview bar (same rule as lib/tenantGuard.ts)
    const decision = previewFullAccess(request.headers.get('Cookie'))
      ? { allowed: true as const, reason: 'dev-bypass' as const }
      : await decideAccess(email, tenant);
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

/**
 * The World Leaders waitlist uses the UK profile form ('Help us tailor your
 * experience'). Its answers go into the existing tenant_access columns so the
 * admin panel can show them, with no schema change:
 *   requesterName ← first + last name   organisation ← company
 *   jobRole       ← 'Who are you?'      reason       ← 'What do you want to do?' + LinkedIn
 */
function detailsFromProfile(a: ProfileAnswers): AccessRequestDetails {
  const wants = a.interests.length ? `Wants to: ${interestLabels(a.interests)}` : '';
  return {
    requesterName: [a.firstName, a.lastName].filter(Boolean).join(' ').slice(0, 128),
    organisation:  a.company,
    jobRole:       a.segment ? segmentLabel(a.segment).slice(0, 128) : '',
    reason:        [wants, a.linkedin ? `LinkedIn: ${a.linkedin}` : ''].filter(Boolean).join('\n').slice(0, 1000),
  };
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST — join the waitlist / ask for access.
 *
 * Waitlist index (World Leaders): no sign-in needed. The visitor gives an
 * email (plus optional details); we store a pending row and alert Knox. They
 * hear nothing more until Knox decides; the approval email signs them in
 * (lib/accessLink.ts). The reply never says whether an address was already
 * approved or refused, so the form cannot be used to look people up.
 *
 * Authenticated index: the signed-in address only, with name and reason
 * required, as before.
 */
export async function POST(request: Request): Promise<Response> {
  const tenant = tenantFromRequest(request);
  const base   = { dashboardId: tenant.dashboardId, tenant: tenant.id };

  if (tenant.access.mode === 'public') {
    return Response.json({ ...base, allowed: true, reason: 'public' }, { headers: NO_STORE });
  }

  let body: any = {};
  try { body = await request.json(); } catch { /* an empty body is still a valid request */ }

  const isWaitlist   = tenant.access.mode === 'waitlist';
  const sessionEmail = await currentEmail(request);
  const typedEmail   = String(body?.email ?? '').trim().toLowerCase();
  const email        = sessionEmail ?? (isWaitlist && EMAIL_RE.test(typedEmail) ? typedEmail : null);

  if (!email) {
    return isWaitlist
      ? Response.json({ error: 'Enter a valid email address', field: 'email' }, { status: 400, headers: NO_STORE })
      : Response.json({ ...base, allowed: false, reason: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  }

  // Knox addresses are let in by domain: they only need to sign in.
  if (isAllowedDomain(email, tenant)) {
    return Response.json({ ...base, status: 'signin' }, { headers: NO_STORE });
  }

  // A signed-in person who is already in has nothing to request (a stale tab,
  // a direct POST). Only said to the signed-in owner of the address.
  if (sessionEmail) {
    const existing = await decideAccess(email, tenant);
    if (existing.allowed) {
      return Response.json({ ...base, email, status: 'approved', allowed: true, reason: existing.reason }, { headers: NO_STORE });
    }
  }

  // The waitlist sends the UK profile form; the gated index its own form.
  const profile = isWaitlist ? readProfileAnswers(body) : null;
  const details = profile ? detailsFromProfile(profile) : readDetails(body);

  // On a gated index, name and reason are what make a request reviewable.
  // The waitlist asks for an email only; the rest is optional.
  if (!isWaitlist && (!details.requesterName || !details.reason)) {
    return Response.json(
      { error: 'Your name and a reason for access are required', field: !details.requesterName ? 'name' : 'reason' },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const before = await getAccessStatus(email, tenant);
    // A guest can only add a new request. Typing someone else's address must
    // not overwrite the details on their waiting request.
    const status = sessionEmail || before === 'none'
      ? await requestAccess(email, tenant, details)
      : before;

    // Alert Knox once per new request, not on every resubmission.
    // Best-effort: the row is stored, and it is what the admin panel reads.
    // Into Brevo like a UK sign-up, with the consents they ticked. Only for a
    // new request (or the signed-in owner), so typing someone else's address
    // cannot change their Brevo record. The waitlist form has no briefing
    // option, so briefing lists are left alone.
    if (profile && (sessionEmail || before === 'none')) {
      const saved = await saveProfileToBrevo(email, profile, { includeBriefing: false, source: 'World Leaders waitlist' });
      if (!saved.ok) console.error('[/api/tenant/access] Brevo save failed', saved.status, saved.detail ?? '');
    }

    if (status === 'pending' && before === 'none') {
      const record = await getAccessRecord(email, tenant);
      if (record) {
        const sends = [notifyKnoxOfRequest(record, tenant, emailOrigin(request))];
        // The gated index also acknowledges; the waitlist stays quiet until
        // the decision, which is the email that matters.
        if (!isWaitlist) sends.push(confirmRequestToRequester(record, tenant));
        const results = await Promise.allSettled(sends);
        results.forEach(r => {
          if (r.status === 'rejected') console.error('[/api/tenant/access] email failed:', r.reason?.message ?? r.reason);
        });
      }
    }

    if (!sessionEmail) {
      // Guests learn only that the request was received.
      return Response.json({ ...base, email, status: 'received' }, { headers: NO_STORE });
    }
    const decision = await decideAccess(email, tenant);
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
