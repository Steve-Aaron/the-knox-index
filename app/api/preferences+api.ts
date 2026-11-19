/**
 * app/api/preferences+api.ts
 * ---------------------------
 * POST /api/preferences
 *
 * Saves user profile preferences to Brevo. Requires an active session
 * cookie — unauthenticated requests are rejected with 401.
 *
 * Body: {
 *   firstName?:              string,
 *   lastName?:               string,
 *   company?:                string,
 *   linkedin?:               string,
 *   segment?:                string,
 *   interests?:              string[],
 *   consentKnoxUpdates?:     boolean,
 *   consentDailyBriefing?:   boolean,
 *   consentWeeklyBriefing?:  boolean,
 *   consentKnoxDigital?:     boolean,
 * }
 *
 * Daily and Weekly are mutually exclusive (UI enforces this; we coerce
 * defensively below so a malformed client can't end up on both lists).
 *
 * Brevo attributes updated:
 *   FIRSTNAME, LASTNAME, COMPANY, LINKEDIN,
 *   JOB_ROLE, WHY_USE_KNOX_INDEX (array → multiple-choice),
 *   CONSENT_KNOX_INDEX_UPDATES, CONSENT_DAILY_BRIEFING,
 *   CONSENT_WEEKLY_BRIEFING, CONSENT_KNOX_DIGITAL
 *
 * One job: persist user preferences to Brevo on behalf of an authenticated user.
 */

import { verifySession, markProfiled } from '@/lib/firebaseAdmin';
import { readProfileAnswers, saveProfileToBrevo } from '@/lib/brevoProfile';

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? '';

export async function POST(request: Request): Promise<Response> {
  // Auth check (Firebase session cookie, revocation-aware)
  const user = await verifySession(request.headers.get('Cookie'));
  if (!user) {
    return Response.json({ error: 'Unauthenticated' }, { status: 401 });
  }
  const email = user.email;

  if (!BREVO_API_KEY) {
    console.error('[/api/preferences] BREVO_API_KEY not set');
    return Response.json({ error: 'Service unavailable' }, { status: 503 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Same parsing and Brevo write as the World Leaders waitlist (lib/brevoProfile.ts).
  const result = await saveProfileToBrevo(email, readProfileAnswers(body), { includeBriefing: true });

  if (!result.ok) {
    console.error('[/api/preferences] Brevo responded', result.status);
    // Non-fatal from client perspective — preferences saved locally
  }

  // Persist 'profiled' on the Firebase user so the profiling modal never
  // re-prompts on a new device/browser. Non-fatal — Brevo holds the data.
  try {
    await markProfiled(user.uid);
  } catch (err: any) {
    console.error('[/api/preferences] markProfiled failed', err?.message ?? err);
  }

  return Response.json({ ok: true }, { status: 200 });
}
