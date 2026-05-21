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
 *   consentBriefing    boolean  — daily briefing emails
 *   consentUpdates     boolean  — product update emails
 *   consentKnox        boolean  — wider Knox Digital contact
 *
 * Actions:
 *   1. Upserts Brevo contact with attributes + list membership
 *   2. Sends a welcome confirmation email to the subscriber
 *   3. Fires an internal notification (fire-and-forget)
 *
 * Always returns 200 to the client — errors are logged server-side so we
 * never show Brevo internals or enumerate whether an email is known.
 */

import { BRAND } from '@/brand/constants';

const BREVO_API_KEY    = process.env.BREVO_API_KEY ?? '';
const BREVO_BASE       = 'https://api.brevo.com/v3';
const FROM_EMAIL       = 'hello@knoxdigi.com';
const FROM_NAME        = BRAND.name;
const NOTIFY_EMAIL     = BRAND.contact.email;   // steve+tki@knoxdigi.com
const EMAIL_RE         = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Brevo list ID for the public newsletter. Set BREVO_SIGNUP_LIST_ID in your
// environment (.env / Vercel project settings) to automatically add subscribers
// to a specific list. Leave unset to skip list assignment.
const LIST_ID = process.env.BREVO_SIGNUP_LIST_ID
  ? [Number(process.env.BREVO_SIGNUP_LIST_ID)]
  : [];

// ── Helper: POST to Brevo ─────────────────────────────────────────────────────

async function brevo(path: string, body: unknown): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(`${BREVO_BASE}${path}`, {
    method:  'POST',
    headers: {
      'api-key':      BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    body: JSON.stringify(body),
  });
  return { ok: res.ok || res.status === 204, status: res.status };
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
  const consentBriefing:  boolean  = Boolean(body?.consentBriefing);
  const consentUpdates:   boolean  = Boolean(body?.consentUpdates);
  const consentKnox:      boolean  = Boolean(body?.consentKnox);

  // 1. Upsert Brevo contact
  const contactPayload: Record<string, unknown> = {
    email,
    updateEnabled: true,
    attributes: {
      SOURCE:          'TKI signup page',
      COMPANY:         company   || undefined,
      SEGMENT:         segment   || undefined,
      INTERESTS:       interests.length ? interests.join(', ') : undefined,
      PERM_DAILY:      consentBriefing ? 'yes' : 'no',
      PERM_REPORT:     consentUpdates  ? 'yes' : 'no',
      PERM_WIDER:      consentKnox     ? 'yes' : 'no',
    },
  };
  if (LIST_ID.length) contactPayload.listIds = LIST_ID;

  brevo('/contacts', contactPayload)
    .catch((e: any) => console.error('[/api/signup] Brevo upsert error', e));

  // 2. Welcome email to subscriber
  const welcomeRes = await brevo('/smtp/email', {
    sender:      { name: FROM_NAME, email: FROM_EMAIL },
    to:          [{ email }],
    subject:     'You\'re subscribed to The Knox Index',
    htmlContent: welcomeHtml(email, consentBriefing),
    textContent: welcomeText(email),
  });

  if (!welcomeRes.ok) {
    console.error('[/api/signup] Brevo welcome email error', welcomeRes.status);
  }

  // 3. Internal notification (fire-and-forget)
  brevo('/smtp/email', {
    sender:      { name: FROM_NAME, email: FROM_EMAIL },
    to:          [{ email: NOTIFY_EMAIL }],
    subject:     `New signup: ${email}`,
    htmlContent: notifyHtml({ email, company, segment, interests, consentBriefing, consentUpdates, consentKnox }),
    textContent: notifyText({ email, company, segment, interests, consentBriefing, consentUpdates, consentKnox }),
  }).catch((e: any) => console.error('[/api/signup] Brevo notify error', e));

  return Response.json({ ok: true }, { status: 200 });
}

// ── Email templates ───────────────────────────────────────────────────────────

function welcomeHtml(email: string, consentBriefing: boolean): string {
  const briefingLine = consentBriefing
    ? '<p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#A8A8BA;">Your first briefing will land at <strong style="color:#ECECF2;">8:00AM tomorrow</strong>.</p>'
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
            TikTok insights on UK politicians — in your inbox every morning at 8:00AM.
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

function welcomeText(email: string): string {
  return `You're subscribed to The Knox Index.\n\nTikTok insights on UK politicians — in your inbox every morning at 8:00AM.\n\n${BRAND.contact.website}\n\nSigned up with: ${email}\nKnox Digital · London, UK`;
}

interface NotifyPayload {
  email:            string;
  company:          string;
  segment:          string;
  interests:        string[];
  consentBriefing:  boolean;
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
    <tr><td style="padding:6px 0;color:#555;">Daily briefing</td><td style="padding:6px 0;">${flag(p.consentBriefing)}</td></tr>
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
    `Daily briefing:  ${flag(p.consentBriefing)}`,
    `Product updates: ${flag(p.consentUpdates)}`,
    `Knox Digital:    ${flag(p.consentKnox)}`,
  ].join('\n');
}
