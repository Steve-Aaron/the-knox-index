/**
 * app/api/preferences+api.ts
 * ---------------------------
 * POST /api/preferences
 *
 * Saves user profile preferences to Brevo. Requires an active session
 * cookie — unauthenticated requests are rejected with 401.
 *
 * Body: {
 *   firstName?:             string,
 *   lastName?:              string,
 *   company?:               string,
 *   linkedin?:              string,
 *   segment?:               string,
 *   interests?:             string[],
 *   consentKnoxUpdates?:    boolean,
 *   consentDailyBriefing?:  boolean,
 *   consentKnoxDigital?:    boolean,
 * }
 *
 * Brevo attributes updated:
 *   FIRSTNAME, LASTNAME, COMPANY, LINKEDIN,
 *   JOB_ROLE, WHY_USE_KNOX_INDEX (array → multiple-choice),
 *   CONSENT_KNOX_INDEX_UPDATES, CONSENT_DAILY_BRIEFING, CONSENT_KNOX_DIGITAL
 *
 * One job: persist user preferences to Brevo on behalf of an authenticated user.
 */

import { verifySessionCookie } from '@/lib/auth';
import { upsertWithConsent, type BrevoValue } from '@/lib/brevo';

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? '';

export async function POST(request: Request): Promise<Response> {
  // Auth check
  const cookieHeader = request.headers.get('Cookie');
  const email        = verifySessionCookie(cookieHeader);
  if (!email) {
    return Response.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  if (!BREVO_API_KEY) {
    console.error('[/api/preferences] BREVO_API_KEY not set');
    return Response.json({ error: 'Service unavailable' }, { status: 503 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const firstName: string = String(body?.firstName ?? '').trim().slice(0, 64);
  const lastName:  string = String(body?.lastName  ?? '').trim().slice(0, 64);
  const company:   string = String(body?.company   ?? '').trim().slice(0, 128);
  const linkedin:  string = String(body?.linkedin  ?? '').trim().slice(0, 256);
  const segment:   string = String(body?.segment   ?? '').slice(0, 64);

  // WHY_USE_KNOX_INDEX: send as string[] to match Brevo multiple-choice options
  const interests: string[] = Array.isArray(body?.interests)
    ? body.interests.map((x: any) => String(x).slice(0, 64)).slice(0, 10)
    : [];

  const consentKnoxUpdates:   boolean = !!body?.consentKnoxUpdates;
  const consentDailyBriefing: boolean = !!body?.consentDailyBriefing;
  const consentKnoxDigital:   boolean = !!body?.consentKnoxDigital;

  const attributes: Record<string, BrevoValue> = {};
  if (firstName)        attributes.FIRSTNAME              = firstName;
  if (lastName)         attributes.LASTNAME               = lastName;
  if (company)          attributes.COMPANY                = company;
  if (linkedin)         attributes.LINKEDIN               = linkedin;
  if (segment)          attributes.JOB_ROLE               = segment;
  if (interests.length) attributes.WHY_USE_KNOX_INDEX     = interests;

  // Always write consent flags — even false is meaningful. These mirror
  // Brevo list membership (lists #4 / #7 / #8) which is the source of truth.
  attributes.CONSENT_KNOX_INDEX_UPDATES = consentKnoxUpdates;
  attributes.CONSENT_DAILY_BRIEFING     = consentDailyBriefing;
  attributes.CONSENT_KNOX_DIGITAL       = consentKnoxDigital;

  const result = await upsertWithConsent(
    email,
    attributes,
    {
      CONSENT_DAILY_BRIEFING:     consentDailyBriefing,
      CONSENT_KNOX_INDEX_UPDATES: consentKnoxUpdates,
      CONSENT_KNOX_DIGITAL:       consentKnoxDigital,
    },
  ).catch(e => {
    console.error('[/api/preferences] Brevo error', e);
    return { ok: false, status: 500 };
  });

  if (!result.ok) {
    console.error('[/api/preferences] Brevo responded', result.status);
    // Non-fatal from client perspective — preferences saved locally
  }

  return Response.json({ ok: true }, { status: 200 });
}
