/**
 * app/api/admin/people+api.ts
 * ----------------------------
 * Creating a person from the tie-in queue, for an account that has none.
 *
 * GET  /api/admin/people   → { countries }  the country reference for the form
 * POST /api/admin/people   → { name, displayJobTitle?, party?, wing?,
 *                              countryIso2?, constituency?,
 *                              linkId, platform, accountId, handle? }
 *
 * The POST creates the person AND confirms the link in one action, because a
 * person created here exists for exactly one reason: to be the other end of
 * that link. Creating one and leaving it unattached would be a bug, not a
 * state worth supporting.
 *
 * Admin = valid session cookie AND an email on ADMIN_EMAILS, as every other
 * /api/admin/* route.
 */

import { isAdminRequest } from '@/lib/adminAuth';
import { verifySession } from '@/lib/firebaseAdmin';
import { devSessionEmail } from '@/lib/devIdentity';
import { createPerson, COUNTRY_LIST, type PersonOrigin } from '@/lib/people';
import { decideLink } from '@/lib/accountLinks';
import { safeErrorDetail } from '@/lib/errors';

const NO_STORE = { 'Cache-Control': 'no-store' };
const PLATFORMS: readonly PersonOrigin[] = ['tiktok', 'x', 'manual'];

const forbidden = () => Response.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
const bad = (error: string) => Response.json({ error }, { status: 400, headers: NO_STORE });

async function reviewerEmail(request: Request): Promise<string> {
  try {
    const user = await verifySession(request.headers.get('Cookie'));
    if (user?.email) return user.email.toLowerCase();
  } catch { /* fall through to the dev identity */ }
  return devSessionEmail() ?? 'admin';
}

export async function GET(request: Request): Promise<Response> {
  if (!(await isAdminRequest(request))) return forbidden();
  return Response.json({ countries: COUNTRY_LIST }, { headers: NO_STORE });
}

export async function POST(request: Request): Promise<Response> {
  if (!(await isAdminRequest(request))) return forbidden();

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return bad('Body must be JSON'); }

  const str = (key: string): string => String(body[key] ?? '').trim();

  const name      = str('name');
  const linkId    = str('linkId');
  const accountId = str('accountId');
  const platform  = str('platform') as PersonOrigin;

  if (!name)      return bad('A name is required');
  if (!linkId)    return bad('linkId is required');
  if (!accountId) return bad('accountId is required');
  if (!PLATFORMS.includes(platform)) return bad(`platform must be one of ${PLATFORMS.join(', ')}`);

  const createdBy = await reviewerEmail(request);

  try {
    const person = await createPerson({
      name,
      displayJobTitle: str('displayJobTitle'),
      party:           str('party'),
      wing:            str('wing'),
      countryIso2:     str('countryIso2'),
      constituency:    str('constituency'),
      platform,
      accountId,
      handle:          str('handle'),
      createdBy,
    });

    await decideLink({ linkId, status: 'confirmed', personId: person.personId, reviewer: createdBy });

    return Response.json({ ok: true, person }, { headers: NO_STORE });
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/admin/people] POST failed:', logMessage);
    return Response.json({ error: 'Could not create the person', detail: clientDetail }, { status: 500, headers: NO_STORE });
  }
}
