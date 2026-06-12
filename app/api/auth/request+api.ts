/**
 * app/api/auth/request+api.ts
 * ----------------------------
 * POST /api/auth/request
 * Body: { email: string }
 *
 * 1. Validates the email
 * 2. Generates a Firebase passwordless sign-in link (single-use, Firebase-managed expiry)
 * 3. Upserts the contact into Brevo
 * 4. Sends the magic link email via Brevo SMTP (branded — Firebase never emails the user)
 *
 * The link lands on /login, where the client SDK completes sign-in and
 * exchanges the resulting ID token for the httpOnly session cookie.
 *
 * Returns 200 regardless of whether the email exists — no enumeration.
 */

import { generateMagicLink } from '@/lib/firebaseAdmin';
import { BRAND } from '@/brand/constants';

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? '';
const BREVO_BASE    = 'https://api.brevo.com/v3';
const FROM_EMAIL    = 'hello@knoxdigi.com';
const FROM_NAME     = BRAND.name;
const EMAIL_RE      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Minimal Brevo POST wrapper.
 *
 * Returns `{ ok, status, detail }` and never throws — fetch-level errors
 * (DNS failures, socket hang-ups during a Vercel cold start) are surfaced
 * as `ok: false, status: 0` so the caller can decide whether to abort.
 *
 * `detail` carries Brevo's response body (truncated). Brevo's failure
 * messages are specific ("Sender not verified", "List does not exist",
 * etc.) — logging just the status code makes production debugging
 * effectively impossible, which is the trap this version exists to close.
 */
async function brevo(path: string, body: unknown): Promise<{ ok: boolean; status: number; detail?: string }> {
  try {
    const res    = await fetch(`${BREVO_BASE}${path}`, {
      method:  'POST',
      headers: {
        'api-key':      BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      body: JSON.stringify(body),
    });
    const ok = res.ok || res.status === 204;
    if (ok) return { ok, status: res.status };
    // Capture the failure body so logs name the actual cause.
    const text = await res.text().catch(() => '');
    return { ok: false, status: res.status, detail: text.slice(0, 500) };
  } catch (err: any) {
    return { ok: false, status: 0, detail: err?.message ?? 'fetch failed' };
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!BREVO_API_KEY) {
      console.error('[/api/auth/request] BREVO_API_KEY not set');
      return Response.json({ error: 'Email service is not configured' }, { status: 503 });
    }

    let body: any;
    try { body = await request.json(); } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const email: string = (body?.email ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Derive base URL from the request (works on Vercel + local dev)
    const url     = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    // Firebase mints the single-use sign-in link; we only deliver it.
    // Any admin SDK failure (bad service account, provider not enabled)
    // surfaces as a clean 500 rather than a generic Vercel error.
    let link: string;
    try {
      link = await generateMagicLink(email, `${baseUrl}/login`);
    } catch (err: any) {
      console.error('[/api/auth/request] Firebase link generation failed', err?.message ?? err);
      return Response.json({ error: 'Sign-in link generation failed' }, { status: 500 });
    }

    // 1. Upsert into Brevo (non-fatal — never blocks email delivery)
    brevo('/contacts', {
      email,
      updateEnabled: true,
      attributes: { SOURCE: 'TKI magic link' },
    }).then(r => {
      if (!r.ok) console.error('[/api/auth/request] Brevo upsert non-ok', r.status, r.detail ?? '');
    }).catch((e: any) => console.error('[/api/auth/request] Brevo upsert threw', e?.message ?? e));

    // 2. Send the magic link email
    const emailRes = await brevo('/smtp/email', {
      sender:      { name: FROM_NAME, email: FROM_EMAIL },
      to:          [{ email }],
      subject:     'Your Knox Index access link',
      htmlContent: magicLinkHtml(link),
      textContent: magicLinkText(link),
    });

    if (!emailRes.ok) {
      // Log the upstream detail every time so Vercel logs contain the actual
      // Brevo failure (e.g. "Sender not verified", "Permission denied").
      console.error(
        '[/api/auth/request] Brevo email failed',
        'status=', emailRes.status,
        'detail=', emailRes.detail ?? '(no body)',
      );
      // 502 — upstream failure. Distinguishes Brevo-side errors from local bugs.
      return Response.json(
        { error: 'Failed to send email — please try again in a moment.' },
        { status: 502 },
      );
    }

    return Response.json({ ok: true }, { status: 200 });

  } catch (err: any) {
    // Last-resort guard: anything else that can throw (JSON parse edge cases,
    // env var initialisation, Vercel runtime quirks) must NOT escape as an
    // opaque Vercel 500 with no body. The client expects JSON either way.
    console.error('[/api/auth/request] Unhandled error', err?.stack ?? err?.message ?? err);
    return Response.json({ error: 'Unexpected error' }, { status: 500 });
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

function magicLinkHtml(link: string): string {
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
            Your access link
          </h1>
          <p style="margin:0 0 28px;font-size:14px;line-height:22px;color:#A8A8BA;">
            Click the button below to sign in. This link can only be used once and expires after a few hours.
          </p>

          <a href="${link}"
             style="display:inline-block;background:#7C83FF;color:#fff;text-decoration:none;
                    padding:14px 32px;border-radius:100px;font-size:13px;font-weight:700;
                    letter-spacing:0.5px;">
            OPEN THE KNOX INDEX →
          </a>

          <p style="margin:28px 0 0;font-size:11px;color:#6C6C82;line-height:18px;">
            If the button doesn't work, copy this link into your browser:<br>
            <span style="color:#A8A8BA;word-break:break-all;">${link}</span>
          </p>
          <p style="margin:16px 0 0;font-size:11px;color:#6C6C82;">
            If you didn't request this, you can safely ignore this email.<br>
            Knox Digital · London, UK
          </p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function magicLinkText(link: string): string {
  return `Your Knox Index access link\n\nClick here to sign in:\n${link}\n\nThis link is single-use and expires after a few hours.\n\nIf you didn't request this, ignore this email.\n\nKnox Digital`;
}
