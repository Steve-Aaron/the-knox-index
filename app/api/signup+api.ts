/**
 * app/api/signup+api.ts
 * ----------------------
 * POST /api/signup
 *
 * Public signup endpoint for the /signup landing page.
 *
 * Body:
 *   email              string   — required
 *   company            string   — optional
 *   segment            string   — optional (from SEGMENTS data)
 *   interests          string[] — optional (from INTERESTS data)
 *   consentDailyBriefing / consentWeeklyBriefing  boolean — briefing
 *                      frequency, lists #4 / #9, never both (consentBriefing
 *                      is the older daily-only name and is still accepted)
 *   consentUpdates     boolean  — product update emails (mirrors list #7)
 *   consentKnox        boolean  — wider Knox Digital contact (mirrors list #8)
 *
 * Actions:
 *   1. Upserts Brevo contact with attributes + list membership in one call
 *      (via lib/brevo.ts — list IDs are the canonical subscription state)
 *   2. Sends a welcome confirmation email to the subscriber
 *   3. Fires an internal notification (fire-and-forget)
 *
 * Always returns 200 to the client — errors are logged server-side so we
 * never show Brevo internals or enumerate whether an email is known.
 */

import { BRAND } from '@/brand/constants';
import { upsertWithConsent, type BriefingFrequency } from '@/lib/brevo';

const BREVO_API_KEY    = process.env.BREVO_API_KEY ?? '';
const BREVO_BASE       = 'https://api.brevo.com/v3';
const FROM_EMAIL       = 'hello@knoxdigi.com';
const FROM_NAME        = BRAND.name;
const NOTIFY_EMAIL     = BRAND.contact.email;   // steve+tki@knoxdigi.com
const EMAIL_RE         = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Helper: POST transactional email to Brevo ─────────────────────────────────
// (Contact upserts go through lib/brevo.ts — this is only used for emails.)

async function sendEmail(body: unknown): Promise<{ ok: boolean; status: number; detail?: string }> {
  try {
    const res = await fetch(`${BREVO_BASE}/smtp/email`, {
      method:  'POST',
      headers: {
        'api-key':      BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      body: JSON.stringify(body),
    });
    const ok = res.ok || res.status === 204;
    const detail = ok ? undefined : (await res.text().catch(() => '')).slice(0, 300);
    return { ok, status: res.status, detail };
  } catch (err: unknown) {
    return { ok: false, status: 0, detail: (err as Error)?.message ?? String(err) };
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  if (!BREVO_API_KEY) {
    console.error('[/api/signup] BREVO_API_KEY not set');
    return Response.json({ error: 'Service unavailable' }, { status: 503 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email: string = (body?.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const company:          string   = String(body?.company   ?? '').trim().slice(0, 128);
  const segment:          string   = String(body?.segment   ?? '').trim().slice(0, 64);
  const interests:        string[] = Array.isArray(body?.interests)
    ? body.interests.map((x: any) => String(x).slice(0, 64)).slice(0, 10)
    : [];
  // Briefing frequency: daily OR weekly, never both (daily wins a tie, as in
  // /api/preferences). The form sends both flags; older clients send only
  // consentBriefing, which means daily.
  const consentDaily:     boolean  = Boolean(body?.consentDailyBriefing ?? body?.consentBriefing);
  const consentWeekly:    boolean  = Boolean(body?.consentWeeklyBriefing) && !consentDaily;
  const briefing: BriefingFrequency = consentDaily ? 'daily' : consentWeekly ? 'weekly' : 'none';
  const consentUpdates:   boolean  = Boolean(body?.consentUpdates);
  const consentKnox:      boolean  = Boolean(body?.consentKnox);

  // 1. Upsert Brevo contact — attributes + list membership in one call.
  //    List membership (lists #4 / #7 / #8 / #9) is the canonical subscription state;
  //    the CONSENT_* attributes are mirrors so downstream readers don't need
  //    a second Brevo round-trip to see consent.
  //    Every Brevo call is awaited: on Vercel, work still running after the
  //    response is sent can be cut off, and this one IS the subscription.
  const upsertRes = await upsertWithConsent(
    email,
    {
      SOURCE:                     'TKI signup page',
      COMPANY:                    company || undefined,
      JOB_ROLE:                   segment || undefined,
      WHY_USE_KNOX_INDEX:         interests.length ? interests : undefined,
      CONSENT_DAILY_BRIEFING:     consentDaily,
      CONSENT_WEEKLY_BRIEFING:    consentWeekly,
      CONSENT_KNOX_INDEX_UPDATES: consentUpdates,
      CONSENT_KNOX_DIGITAL:       consentKnox,
    },
    {
      CONSENT_DAILY_BRIEFING:     consentDaily,
      CONSENT_WEEKLY_BRIEFING:    consentWeekly,
      CONSENT_KNOX_INDEX_UPDATES: consentUpdates,
      CONSENT_KNOX_DIGITAL:       consentKnox,
    },
  );

  // The list upsert IS the subscription: if Brevo refused it, say so before
  // sending a welcome for a subscription that does not exist
  if (!upsertRes.ok) {
    return Response.json({ error: 'We could not complete your sign-up. Please try again.' }, { status: 502 });
  }

  // 2. Welcome email to subscriber
  const welcomeRes = await sendEmail({
    sender:      { name: FROM_NAME, email: FROM_EMAIL },
    to:          [{ email }],
    subject:     'You\'re subscribed to The Knox Index',
    htmlContent: welcomeHtml(email, briefing),
    textContent: welcomeText(email, briefing),
  });

  if (!welcomeRes.ok) {
    console.error('[/api/signup] Brevo welcome email error', welcomeRes.status, welcomeRes.detail ?? '');
  }

  // 3. Internal notification (awaited, but its failure does not fail the sign-up)
  const notifyRes = await sendEmail({
    sender:      { name: FROM_NAME, email: FROM_EMAIL },
    to:          [{ email: NOTIFY_EMAIL }],
    subject:     `New signup: ${email}`,
    htmlContent: notifyHtml({ email, company, segment, interests, briefing, consentUpdates, consentKnox }),
    textContent: notifyText({ email, company, segment, interests, briefing, consentUpdates, consentKnox }),
  });
  if (!notifyRes.ok) {
    console.error('[/api/signup] Brevo notify error', notifyRes.status, notifyRes.detail ?? '');
  }

  return Response.json({ ok: true }, { status: 200 });
}

// ── Email templates ───────────────────────────────────────────────────────────

function welcomeHtml(email: string, briefing: BriefingFrequency): string {
  const briefingLine = briefing === 'daily'
    ? '<p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#A8A8BA;">Your first briefing will land at <strong style="color:#ECECF2;">8:00AM tomorrow</strong>.</p>'
    : briefing === 'weekly'
    ? '<p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#A8A8BA;">Your first <strong style="color:#ECECF2;">weekly briefing</strong> will land with the next edition.</p>'
    : '<p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#A8A8BA;">You can update your preferences at any time from your account settings.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#07070B;font-family:system-ui,sans-serif;color:#ECECF2;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:48px 20px;">
      <table width="520" cellpadding="0" cellspacing="0" role="presentation"
             style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
        <tr><td style="height:3px;background:#7C83FF;"></td></tr>
        <tr><td style="padding:40px 40px 32px;">

          <p style="margin:0 0 6px;font-size:10px;letter-spacing:2px;color:#7C83FF;text-transform:uppercase;">
            THE KNOX INDEX
          </p>
          <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.2;">
            You're subscribed.
          </h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#A8A8BA;">
            TikTok insights on UK politicians, direct to your inbox.
          </p>
          ${briefingLine}

          <a href="${BRAND.contact.website}/signup"
             style="display:inline-block;background:#7C83FF;color:#fff;text-decoration:none;
                    padding:14px 32px;border-radius:100px;font-size:13px;font-weight:700;
                    letter-spacing:0.5px;">
            OPEN THE KNOX INDEX →
          </a>

          <p style="margin:28px 0 0;font-size:11px;color:#6C6C82;line-height:18px;">
            You signed up with ${email}. If this wasn't you, ignore this email.<br>
            Knox Digital · London, UK · <a href="${BRAND.contact.website}/unsubscribe" style="color:#6C6C82;">Unsubscribe</a>
          </p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function welcomeText(email: string, briefing: BriefingFrequency): string {
  const when = briefing === 'daily'
    ? 'Social media insights on UK politicians, in your inbox every morning at 8:00AM.'
    : briefing === 'weekly'
    ? 'Social media insights on UK politicians, in your inbox every week.'
    : 'You can update your preferences at any time from your account settings.';
  return `You're subscribed to The Knox Index.\n\n${when}\n\n${BRAND.contact.website}\n\nSigned up with: ${email}\nKnox Digital · London, UK`;
}

interface NotifyPayload {
  email:            string;
  company:          string;
  segment:          string;
  interests:        string[];
  briefing:         BriefingFrequency;
  consentUpdates:   boolean;
  consentKnox:      boolean;
}

function flag(v: boolean) { return v ? '✓' : '✗'; }

function notifyHtml(p: NotifyPayload): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui;padding:24px;color:#1a1a1a;max-width:520px;">
  <h2 style="margin:0 0 16px;">New Knox Index signup</h2>
  <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:6px 0;color:#555;width:140px;">Email</td><td style="padding:6px 0;font-weight:600;">${p.email}</td></tr>
    <tr><td style="padding:6px 0;color:#555;">Company</td><td style="padding:6px 0;">${p.company || '—'}</td></tr>
    <tr><td style="padding:6px 0;color:#555;">Segment</td><td style="padding:6px 0;">${p.segment || '—'}</td></tr>
    <tr><td style="padding:6px 0;color:#555;">Interests</td><td style="padding:6px 0;">${p.interests.join(', ') || '—'}</td></tr>
    <tr><td style="padding:6px 0;color:#555;">Briefing</td><td style="padding:6px 0;">${p.briefing}</td></tr>
    <tr><td style="padding:6px 0;color:#555;">Product updates</td><td style="padding:6px 0;">${flag(p.consentUpdates)}</td></tr>
    <tr><td style="padding:6px 0;color:#555;">Knox Digital</td><td style="padding:6px 0;">${flag(p.consentKnox)}</td></tr>
  </table>
</body></html>`;
}

function notifyText(p: NotifyPayload): string {
  return [
    `New Knox Index signup`,
    `Email:    ${p.email}`,
    `Company:  ${p.company || '—'}`,
    `Segment:  ${p.segment || '—'}`,
    `Interests: ${p.interests.join(', ') || '—'}`,
    `Briefing:        ${p.briefing}`,
    `Product updates: ${flag(p.consentUpdates)}`,
    `Knox Digital:    ${flag(p.consentKnox)}`,
  ].join('\n');
}
