/**
 * lib/transactionalEmail.ts
 * --------------------------
 * One place that sends a transactional email through Brevo, and one place that
 * renders the dark Knox email shell around a body. Server-side only.
 *
 * Extracted so every route that emails a human (contact enquiry, access
 * request, access decision) produces the same-looking message and handles
 * failures the same way. Marketing list state stays in lib/brevo.ts.
 *
 * One job: send a styled transactional email.
 */

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? '';
const BREVO_BASE    = 'https://api.brevo.com/v3';

export const FROM_EMAIL = 'hello@knoxdigi.com';
export const FROM_NAME  = 'The Knox Index';

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface TransactionalEmail {
  to:          EmailRecipient[];
  subject:     string;
  htmlContent: string;
  textContent: string;
  replyTo?:    EmailRecipient;
  fromName?:   string;
}

/** True when Brevo is configured. Callers degrade rather than 500 when false. */
export function canSendEmail(): boolean {
  return BREVO_API_KEY.length > 0;
}

/**
 * Sends one email. Never throws — returns ok:false with the status so the
 * caller can decide whether the failure is fatal (a form the user is waiting
 * on) or cosmetic (a notification copy).
 */
export async function sendEmail(email: TransactionalEmail): Promise<{ ok: boolean; status: number }> {
  if (!canSendEmail()) {
    console.warn('[email] BREVO_API_KEY not set — skipping send:', email.subject);
    return { ok: false, status: 503 };
  }

  try {
    const res = await fetch(`${BREVO_BASE}/smtp/email`, {
      method:  'POST',
      headers: {
        'api-key':      BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      body: JSON.stringify({
        sender:      { name: email.fromName ?? FROM_NAME, email: FROM_EMAIL },
        to:          email.to,
        replyTo:     email.replyTo,
        subject:     email.subject,
        htmlContent: email.htmlContent,
        textContent: email.textContent,
      }),
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      console.error('[email] Brevo rejected the send', res.status, detail);
    }
    return { ok: res.ok, status: res.status };
  } catch (err: unknown) {
    console.error('[email] send failed:', (err as Error)?.message ?? err);
    return { ok: false, status: 0 };
  }
}

/** Escape user-supplied text before it goes anywhere near an HTML template. */
export function escHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ShellOptions {
  kicker:  string;
  title:   string;
  /** Pre-escaped HTML for the body. */
  body:    string;
  /** Optional call-to-action button. */
  cta?:    { label: string; url: string };
  footer?: string;
}

/**
 * The dark glass email shell used by every Knox transactional message.
 * Table-based and inline-styled because that is what email clients render.
 */
export function emailShell({ kicker, title, body, cta, footer }: ShellOptions): string {
  const button = cta
    ? `<table cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
         <tr><td style="background:#E83C91;border-radius:8px;">
           <a href="${escHtml(cta.url)}"
              style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
             ${escHtml(cta.label)}
           </a>
         </td></tr>
       </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#1F1D1D;font-family:system-ui,sans-serif;color:#F4F5FF;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
    <table width="560" cellpadding="0" cellspacing="0"
           style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
      <tr><td style="height:3px;background:#E83C91;"></td></tr>
      <tr><td style="padding:40px;">
        <p style="margin:0 0 8px;font-size:10px;letter-spacing:2px;color:#FF9363;">${escHtml(kicker)}</p>
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#ffffff;">${escHtml(title)}</h1>
        <div style="font-size:14px;line-height:22px;color:#9FA8B5;">${body}</div>
        ${button}
        <p style="margin:24px 0 0;font-size:11px;color:#55556A;">${escHtml(footer ?? 'The Knox Index · Knox Digital · London, UK')}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}
