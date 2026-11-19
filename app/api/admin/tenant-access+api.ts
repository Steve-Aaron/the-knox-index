/**
 * app/api/admin/tenant-access+api.ts
 * -----------------------------------
 * Admin control over who may read a gated tenant.
 *
 * GET  /api/admin/tenant-access?tenant=2  → access records, each enriched with
 *      the person's email read live from Firebase Auth (the store holds none)
 * POST /api/admin/tenant-access           → { uid | email, tenant, status, note? }
 *      status: 'approved' | 'pending' | 'denied'
 *      Act on a record's `uid`; `email` is accepted for a direct grant and is
 *      resolved to a uid (a Firebase user is created if none exists).
 *
 * `tenant` is the DASHBOARD ID (1, 2, …). The slug ('uk', 'world') is accepted
 * too, since both resolve through tenantById().
 *
 * Admin = valid session cookie AND an email on ADMIN_EMAILS (lib/adminAuth.ts).
 * Users on a tenant's allowedDomains never need a record here.
 */

import { isAdminRequest } from '@/lib/adminAuth';
import { emailForUid, emailsForUids, uidForEmail } from '@/lib/firebaseAdmin';
import { identityFromRequest } from '@/lib/sessionIdentity';
import { listAccess, setAccessStatus, type AccessStatus } from '@/lib/tenantAccess';
import { notifyDecision, emailOrigin } from '@/lib/accessEmails';
import { TENANTS, tenantById, isKnownTenant, tenantFullName } from '@/lib/tenants';
import { safeErrorDetail } from '@/lib/errors';

const NO_STORE = { 'Cache-Control': 'no-store' };
const DECIDABLE: AccessStatus[] = ['approved', 'pending', 'denied'];

function forbidden(): Response {
  return Response.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
}

export async function GET(request: Request): Promise<Response> {
  if (!(await isAdminRequest(request))) return forbidden();

  const requested = new URL(request.url).searchParams.get('tenant');

  try {
    const records = requested ? await listAccess(requested) : await listAccess();
    // Names and emails live in Firebase Auth / Brevo, not in the access store.
    // Attach each person's email for display, read live by uid.
    const uids   = records.flatMap(r => [r.firebaseUid, r.decidedBy].filter(Boolean) as string[]);
    const emails = await emailsForUids(uids);
    const enriched = records.map(r => ({
      ...r,
      email:          emails.get(r.firebaseUid) ?? null,
      decidedByEmail: r.decidedBy ? emails.get(r.decidedBy) ?? null : null,
    }));
    return Response.json(
      {
        records: enriched,
        tenants: TENANTS.map(t => ({
          dashboardId:    t.dashboardId,
          id:             t.id,
          name:           tenantFullName(t),
          mode:           t.access.mode,
          allowedDomains: t.access.allowedDomains,
        })),
      },
      { headers: NO_STORE },
    );
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/admin/tenant-access] GET failed:', logMessage);
    return Response.json({ error: 'Could not list access records', detail: clientDetail }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!(await isAdminRequest(request))) return forbidden();

  let body: any;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: NO_STORE });
  }

  const bodyUid   = String(body?.uid ?? '').trim();
  const bodyEmail = String(body?.email ?? '').trim().toLowerCase();
  const tenantRef = String(body?.tenant ?? '').trim();
  const status   = String(body?.status ?? '').trim() as AccessStatus;
  const note     = typeof body?.note === 'string' ? body.note.slice(0, 500) : null;
  // Default true: deciding on a request should tell the person who asked.
  const notify   = body?.notify !== false;

  if (!bodyUid && !(bodyEmail && bodyEmail.includes('@'))) {
    return Response.json({ error: 'A uid or a valid email is required' }, { status: 400, headers: NO_STORE });
  }
  if (!isKnownTenant(tenantRef)) {
    return Response.json({ error: `Unknown tenant: ${tenantRef}` }, { status: 400, headers: NO_STORE });
  }
  const tenant = tenantById(tenantRef);
  if (!DECIDABLE.includes(status)) {
    return Response.json({ error: `status must be one of ${DECIDABLE.join(', ')}` }, { status: 400, headers: NO_STORE });
  }

  try {
    // Resolve the target uid. A record action sends a uid; a direct grant
    // sends an email, which creates a Firebase user if there isn't one, since
    // the access store needs a uid to key on.
    const uid = bodyUid || await uidForEmail(bodyEmail, { create: true });
    if (!uid) {
      return Response.json({ error: 'Could not resolve that person' }, { status: 400, headers: NO_STORE });
    }

    // The deciding admin's uid, for the audit trail. isAdminRequest() has
    // already verified this caller; identityFromRequest also covers the local
    // DEV_TENANT_EMAIL stand-in.
    const admin     = await identityFromRequest(request);
    const decidedBy = admin?.uid ?? 'unknown';
    await setAccessStatus(uid, tenant, status as Exclude<AccessStatus, 'none'>, decidedBy, note);

    // Tell the requester. Best-effort: the decision is already stored, so a
    // mail failure must not read as a failed decision. Their email is read
    // live from Firebase Auth.
    let emailed = false;
    if (notify && status !== 'pending') {
      const email = await emailForUid(uid);
      if (email) {
        const [result] = await Promise.allSettled([
          notifyDecision({ uid, email, name: '' }, tenant, status as 'approved' | 'denied', emailOrigin(request)),
        ]);
        emailed = result.status === 'fulfilled';
      }
    }

    return Response.json(
      { ok: true, uid, dashboardId: tenant.dashboardId, tenant: tenant.id, status, emailed },
      { headers: NO_STORE },
    );
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/admin/tenant-access] POST failed:', logMessage);
    return Response.json({ error: 'Could not update access', detail: clientDetail }, { status: 500, headers: NO_STORE });
  }
}
