/**
 * app/api/contact+api.ts
 * -----------------------
 * Sends a bespoke enquiry email from the ContactFooter form.
 *
 * POST /api/contact
 * Body: { name: string, email: string, message: string }
 *
 * Actions:
 *   1. Sends the enquiry to steve+tki@knoxdigi.com via Brevo
 *   2. Sends an auto-reply to the sender confirming receipt
 */

import { BRAND } from '@/brand/constants';

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? '';
const BREVO_BASE    = 'https://api.brevo.com/v3';
const NOTIFY_EMAIL  = BRAND.contact.email;
const FROM_EMAIL    = 'hello@knoxdigi.com';
const FROM_NAME     = 'The Knox Index';
const EMAIL_RE      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function brevo(path: string, body: unknown) {
  return fetch(`${BREVO_BASE}${path}`, {
    method:  'POST',
    headers: {
      'api-key':      BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!BREVO_API_KEY) {
    return Response.json({ error: 'Contact unavailable' }, { status: 503 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name:    string = String(body?.name    ?? '').trim().slice(0, 128);
  const email:   string = String(body?.email   ?? '').trim().toLowerCase().slice(0, 256);
  const message: string = String(body?.message ?? '').trim().slice(0, 2000);

  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400 });
  }
  if (!message) {
    return Response.json({ error: 'Message is required' }, { status: 400 });
  }

  // 1. Notify steve
  const notifyRes = await brevo('/smtp/email', {
    sender: { name: FROM_NAME, email: FROM_EMAIL },
    to:     [{ name: 'Knox Index Enquiries', email: NOTIFY_EMAIL }],
    replyTo: { name: name || email, email },
    subject: `TKI enquiry from ${name || email}`,
    htmlContent: enquiryHtml(name, email, message),
    textContent: enquiryText(name, email, message),
  });

  if (!notifyRes.ok) {
    const j = await notifyRes.json().catch(() => ({}));
    console.error('contact: Brevo notify error', notifyRes.status, j);
    return Response.json({ error: 'Failed to send message' }, { status: 502 });
  }

  // 2. Auto-reply to sender (fire-and-forget)
  brevo('/smtp/email', {
    sender: { name: FROM_NAME, email: FROM_EMAIL },
    to:     [{ name: name || email, email }],
    subject: 'We got your message — The Knox Index',
    htmlContent: replyHtml(name),
    textContent: replyText(name),
  }).catch((e: any) => console.error('contact: auto-reply error', e));

  return Response.json({ ok: true }, { status: 200 });
}

// ── Templates ─────────────────────────────────────────────────────────────────

function enquiryHtml(name: string, email: string, message: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui;padding:20px;color:#333;">
  <h2>Bespoke enquiry — The Knox Index</h2>
  <p><strong>From:</strong> ${escHtml(name)} &lt;${escHtml(email)}&gt;</p>
  <hr style="border:1px solid #eee;margin:16px 0;">
  <p style="white-space:pre-wrap;line-height:1.6;">${escHtml(message)}</p>
  </body></html>`;
}

function enquiryText(name: string, email: string, message: string): string {
  return `Bespoke enquiry\nFrom: ${name} <${email}>\n\n${message}`;
}

function replyHtml(name: string): string {
  const salutation = name ? `Hi ${escHtml(name)},` : 'Hi,';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0D0D18;font-family:system-ui,sans-serif;color:#E2E2F0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
    <table width="520" cellpadding="0" cellspacing="0"
           style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
      <tr><td style="height:3px;background:#7C83FF;"></td></tr>
      <tr><td style="padding:40px;">
        <p style="margin:0 0 8px;font-size:10px;letter-spacing:2px;color:#7C83FF;">THE KNOX INDEX</p>
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#fff;">Message received.</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#9090B0;">
          ${salutation}<br><br>
          Thanks for getting in touch. We'll review your enquiry and come back to you shortly.
        </p>
        <p style="margin:0;font-size:11px;color:#55556A;">The Knox Index team · Knox Digital · London, UK</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function replyText(name: string): string {
  const salutation = name ? `Hi ${name},` : 'Hi,';
  return `${salutation}\n\nThanks for getting in touch. We'll review your enquiry and come back to you shortly.\n\nThe Knox Index team`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
