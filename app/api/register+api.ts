/**
 * app/api/register+api.ts
 * ------------------------
 * Handles new user registrations for The Knox Index.
 *
 * POST /api/register
 * Body: { email: string, segment?: string, interests?: string[] }
 *
 * Actions:
 *   1. Adds the contact to the Brevo list (upsert — safe to re-submit)
 *   2. Sends a confirmation email to the registrant via Brevo
 *   3. Sends an internal notification to steve+tki@knoxdigi.com
 */

import { BRAND } from '@/brand/constants';

const BREVO_API_KEY   = process.env.BREVO_API_KEY ?? '';
const BREVO_BASE      = 'https://api.brevo.com/v3';
const NOTIFY_EMAIL    = BRAND.contact.email;   // steve+tki@knoxdigi.com
const NOTIFY_NAME     = 'Knox Index Alerts';
const FROM_EMAIL      = 'hello@knoxdigi.com';
const FROM_NAME       = 'The Knox Index';

// Basic email regex — not exhaustive, just blocks obvious garbage
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Helper: POST to Brevo ─────────────────────────────────────────────────────

async function brevo(path: string, body: unknown): Promise<{ ok: boolean; status: number; json: any }> {
  const res = await fetch(`${BREVO_BASE}${path}`, {
    method:  'POST',
    headers: {
      'api-key':      BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    body: JSON.stringify(body),
  });
  let json: any = {};
  try { json = await res.json(); } catch { /* noop */ }
  return { ok: res.ok || res.status === 204, status: res.status, json };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  if (!BREVO_API_KEY) {
    console.error('register: BREVO_API_KEY not set');
    return Response.json({ error: 'Registration unavailable' }, { status: 503 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email: string = (body?.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const segment:   string   = String(body?.segment   ?? '').slice(0, 64);
  const interests: string[] = Array.isArray(body?.interests)
    ? body.interests.map((x: any) => String(x).slice(0, 64)).slice(0, 10)
    : [];

  // 1. Upsert contact into Brevo
  const contactRes = await brevo('/contacts', {
    email,
    updateEnabled: true,
    attributes: {
      SEGMENT:   segment   || undefined,
      INTERESTS: interests.join(', ') || undefined,
      SOURCE:    'TKI dashboard',
    },
  });

  if (!contactRes.ok && contactRes.status !== 204) {
    console.error('register: Brevo contacts error', contactRes.status, contactRes.json);
    // Non-fatal — continue with confirmation emails
  }

  // 2. Confirmation to registrant
  const confirmRes = await brevo('/smtp/email', {
    sender:     { name: FROM_NAME, email: FROM_EMAIL },
    to:         [{ email }],
    subject:    'Welcome to The Knox Index',
    htmlContent: confirmHtml(email, segment, interests),
    textContent: confirmText(email),
  });

  if (!confirmRes.ok) {
    console.error('register: Brevo confirmation email error', confirmRes.status, confirmRes.json);
  }

  // 3. Internal notification
  brevo('/smtp/email', {
    sender:     { name: FROM_NAME, email: FROM_EMAIL },
    to:         [{ name: NOTIFY_NAME, email: NOTIFY_EMAIL }],
    subject:    `New TKI registration: ${email}`,
    htmlContent: notifyHtml(email, segment, interests),
    textContent: notifyText(email, segment, interests),
  }).catch((e: any) => console.error('register: notify email error', e));

  return Response.json({ ok: true }, { status: 200 });
}

// ── Email templates ───────────────────────────────────────────────────────────

function confirmHtml(email: string, segment: string, interests: string[]): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0D0D18;font-family:system-ui,sans-serif;color:#E2E2F0;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="520" cellpadding="0" cellspacing="0" role="presentation"
             style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
        <tr><td style="height:3px;background:#7C83FF;"></td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 8px;font-size:10px;letter-spacing:2px;color:#7C83FF;text-transform:uppercase;">
            THE KNOX INDEX
          </p>
          <h1 style="margin:0 0 16px;font-size:28px;font-weight:700;color:#FFFFFF;">
            You're in.
          </h1>
          <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#9090B0;">
            Thanks for registering — you now have full access to The Knox Index daily intelligence on UK politicians' TikTok performance.
          </p>
          <a href="${BRAND.contact.website}"
             style="display:inline-block;background:#7C83FF;color:#fff;text-decoration:none;
                    padding:12px 28px;border-radius:100px;font-size:12px;font-weight:700;letter-spacing:1px;">
            OPEN THE DASHBOARD →
          </a>
          <p style="margin:32px 0 0;font-size:11px;color:#55556A;line-height:18px;">
            You registered with ${email}. If this wasn't you, ignore this email.<br>
            Knox Digital · London, UK
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function confirmText(email: string): string {
  return `Welcome to The Knox Index\n\nYou now have full access.\n\n${BRAND.contact.website}\n\nRegistered with: ${email}`;
}

function notifyHtml(email: string, segment: string, interests: string[]): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui;padding:20px;color:#333;">
  <h2>New TKI registration</h2>
  <p><strong>Email:</strong> ${email}</p>
  <p><strong>Segment:</strong> ${segment || 'not provided'}</p>
  <p><strong>Interests:</strong> ${interests.length ? interests.join(', ') : 'not provided'}</p>
  </body></html>`;
}

function notifyText(email: string, segment: string, interests: string[]): string {
  return `New TKI registration\nEmail: ${email}\nSegment: ${segment || 'n/a'}\nInterests: ${interests.join(', ') || 'n/a'}`;
}
