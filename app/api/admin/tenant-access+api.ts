/**
 * app/api/admin/tenant-access+api.ts
 * -----------------------------------
 * Admin control over who may read a gated tenant.
 *
 * GET  /api/admin/tenant-access?tenant=2      → every access record
 * POST /api/admin/tenant-access               → { email, tenant, status, note? }
 *      status: 'approved' | 'pending' | 'denied'
 *
 * `tenant` is the DASHBOARD ID (1, 2, …). The slug ('uk', 'world') is accepted
 * too, since both resolve through tenantById().
 *
 * Admin = valid session cookie AND an email on ADMIN_EMAILS (lib/adminAuth.ts).
 * Users on a tenant's allowedDomains never need a record here.
 */

import { isAdminRequest } from '@/lib/adminAuth';
import { verifySession } from '@/lib/firebaseAdmin';
import { devSessionEmail } from '@/lib/devIdentity';
import { listAccess, setAccessStatus, getAccessRecord, type AccessStatus } from '@/lib/tenantAccess';
import { notifyDecision } from '@/lib/accessEmails';
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
    return Response.json(
      {
        records,
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

  const email    = String(body?.email ?? '').trim().toLowerCase();
  const tenantRef = String(body?.tenant ?? '').trim();
  const status   = String(body?.status ?? '').trim() as AccessStatus;
  const note     = typeof body?.note === 'string' ? body.note.slice(0, 500) : '';
  // Default true: deciding on a request should tell the person who asked.
  const notify   = body?.notify !== false;

  if (!email || !email.includes('@')) {
    return Response.json({ error: 'A valid email is required' }, { status: 400, headers: NO_STORE });
  }
  if (!isKnownTenant(tenantRef)) {
    return Response.json({ error: `Unknown tenant: ${tenantRef}` }, { status: 400, headers: NO_STORE });
  }
  const tenant = tenantById(tenantRef);
  if (!DECIDABLE.includes(status)) {
    return Response.json({ error: `status must be one of ${DECIDABLE.join(', ')}` }, { status: 400, headers: NO_STORE });
  }

  try {
    // Who decided. isAdminRequest() has already verified this caller is an
    // admin; devSessionEmail() covers the local case where the identity comes
    // from DEV_TENANT_EMAIL rather than a cookie, so the audit trail is right
    // either way.
    const admin     = await verifySession(request.headers.get('Cookie'));
    const decidedBy = admin?.email ?? devSessionEmail() ?? 'unknown';
    await setAccessStatus(email, tenant, status as Exclude<AccessStatus, 'none'>, decidedBy, note);

    // Tell the requester. Best-effort: the decision is already stored, so a
    // mail failure must not read as a failed decision.
    let emailed = false;
    if (notify && status !== 'pending') {
      const record = await getAccessRecord(email, tenant);
      if (record) {
        const [result] = await Promise.allSettled([
          notifyDecision(record, tenant, status as 'approved' | 'denied'),
        ]);
        emailed = result.status === 'fulfilled';
      }
    }

    return Response.json(
      { ok: true, email, dashboardId: tenant.dashboardId, tenant: tenant.id, status, emailed },
      { headers: NO_STORE },
    );
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/admin/tenant-access] POST failed:', logMessage);
    return Response.json({ error: 'Could not update access', detail: clientDetail }, { status: 500, headers: NO_STORE });
  }
}
