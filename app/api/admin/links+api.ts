/**
 * app/api/admin/links+api.ts
 * ---------------------------
 * The account tie-in review queue behind /admin/links.
 *
 * GET  /api/admin/links?platform=x&status=proposed&confidence=high
 *      → { rows, counts, people }
 * POST /api/admin/links
 *      → { linkId, status: 'confirmed' | 'rejected' | 'proposed', personId? }
 *
 * Admin = valid session cookie AND an email on ADMIN_EMAILS (lib/adminAuth.ts),
 * exactly as every other /api/admin/* route. The matcher only ever proposes;
 * this route is the only way a link becomes confirmed, and it records who did it.
 */

import { isAdminRequest } from '@/lib/adminAuth';
import { verifySession } from '@/lib/firebaseAdmin';
import { devSessionEmail } from '@/lib/devIdentity';
import {
  listLinks, linkCounts, decideLink, listPeople,
  LINK_STATUSES, LINK_CONFIDENCES,
  type LinkPlatform, type LinkStatus, type LinkConfidence,
} from '@/lib/accountLinks';
import { signGcsUrl } from '@/lib/gcs';
import { safeErrorDetail } from '@/lib/errors';

const NO_STORE = { 'Cache-Control': 'no-store' };
const PLATFORMS: readonly LinkPlatform[] = ['tiktok', 'x'];

const forbidden = () => Response.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });

/** A query value, but only when it is one this route recognises. */
function pick<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** Who is making the call, for the audit trail on the row. */
async function reviewerEmail(request: Request): Promise<string> {
  try {
    const user = await verifySession(request.headers.get('Cookie'));
    if (user?.email) return user.email.toLowerCase();
  } catch { /* fall through to the dev identity */ }
  return devSessionEmail() ?? 'admin';
}

export async function GET(request: Request): Promise<Response> {
  if (!(await isAdminRequest(request))) return forbidden();

  const q = new URL(request.url).searchParams;

  try {
    const [rows, counts, people] = await Promise.all([
      listLinks({
        platform:   pick<LinkPlatform>(q.get('platform'), PLATFORMS),
        status:     pick<LinkStatus>(q.get('status'), LINK_STATUSES),
        confidence: pick<LinkConfidence>(q.get('confidence'), LINK_CONFIDENCES),
        limit:      Number(q.get('limit')) || undefined,
      }),
      linkCounts(),
      listPeople(),
    ]);
    // TikTok avatars live in our own bucket and are not publicly readable, so
    // every photo on either side is signed before it reaches the browser. X
    // pictures are already public URLs and pass through untouched.
    const signed = await Promise.all(rows.map(async row => ({
      ...row,
      accountPhoto: row.accountPhoto ? await signGcsUrl(row.accountPhoto) : null,
      personPhoto:  row.personPhoto  ? await signGcsUrl(row.personPhoto)  : null,
    })));

    return Response.json({ rows: signed, counts, people }, { headers: NO_STORE });
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/admin/links] GET failed:', logMessage);
    return Response.json({ error: 'Could not list links', detail: clientDetail }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!(await isAdminRequest(request))) return forbidden();

  let body: { linkId?: string; status?: string; personId?: string | null };
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Body must be JSON' }, { status: 400, headers: NO_STORE }); }

  const linkId = (body.linkId ?? '').trim();
  const status = pick<LinkStatus>(body.status ?? null, LINK_STATUSES);

  if (!linkId) return Response.json({ error: 'linkId is required' }, { status: 400, headers: NO_STORE });
  if (!status) return Response.json({ error: `status must be one of ${LINK_STATUSES.join(', ')}` }, { status: 400, headers: NO_STORE });

  // A confirmed link that points at nobody would reach the photo view and the
  // writeback looking like a decision. Refuse it rather than store it.
  const personId = body.personId === undefined ? undefined : (body.personId || null);
  if (status === 'confirmed' && personId === null) {
    return Response.json({ error: 'Cannot confirm a link with no person attached' }, { status: 400, headers: NO_STORE });
  }

  try {
    await decideLink({ linkId, status, personId, reviewer: await reviewerEmail(request) });
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/admin/links] POST failed:', logMessage);
    return Response.json({ error: 'Could not save the decision', detail: clientDetail }, { status: 500, headers: NO_STORE });
  }
}
