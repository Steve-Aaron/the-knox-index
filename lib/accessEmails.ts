/**
 * lib/accessEmails.ts
 * --------------------
 * The three emails an access request generates:
 *
 *   1. notifyKnoxOfRequest       → Knox, when someone asks
 *   2. confirmRequestToRequester → the requester, acknowledging it
 *   3. notifyDecision            → the requester, when an admin decides
 *
 * The access store (Firestore) holds no identifying fields, so these take the
 * person's email and details from the caller: at request time from the signed-
 * in session and the form body, at decision time from Firebase Auth by uid.
 *
 * All three are best-effort: a send failure is logged and swallowed, because
 * the stored decision is the source of truth and a form must never fail on a
 * mail-provider hiccup.
 *
 * One job: turn an access event into the right message.
 */

import { sendEmail, emailShell, escHtml } from '@/lib/transactionalEmail';
import { BRAND } from '@/brand/constants';
import { ROOT_HOST, SITE_ORIGIN, tenantFullName, type TenantConfig } from '@/lib/tenants';
import { createAccessToken } from '@/lib/accessLink';

const KICKER = 'THE KNOX INDEX';

/** Who asked, assembled by the caller from the session and the form body. */
export interface Requester {
  email: string;
  /** Display name, or '' when not given. */
  name:  string;
  /** Pre-labelled plain-text lines for the internal alert (no PII rules here). */
  details: string[];
}

/**
 * The site an email's links should open: the one the request was made on, so
 * staging (the Vercel dev preview) links to staging and the live site to the
 * live site. Only Knox's own hosts are trusted; anything else (a forged Host
 * header) falls back to the live site, so an email can never link elsewhere.
 */
export function emailOrigin(request: Request): string {
  try {
    const { protocol, host, hostname } = new URL(request.url);
    const ours =
      hostname === ROOT_HOST ||
      hostname.endsWith(`.${ROOT_HOST}`) ||
      hostname === 'theknoxindex.knox.digital' ||
      (hostname.startsWith('theknoxindex') && hostname.endsWith('.vercel.app')) ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1';
    return ours ? `${protocol}//${host}` : SITE_ORIGIN;
  } catch {
    return SITE_ORIGIN;
  }
}

/** 1. Knox gets told someone is waiting. Plain text: an internal alert. */
export async function notifyKnoxOfRequest(who: Requester, tenant: TenantConfig, origin: string = SITE_ORIGIN): Promise<void> {
  await sendEmail({
    to:       [{ email: BRAND.contact.email, name: 'Knox Index Access' }],
    replyTo:  { email: who.email, name: who.name || who.email },
    subject:  `Waitlist request: ${tenant.brand.nameShort}: ${who.name || who.email}`,
    textContent: [
      `New access request for ${tenantFullName(tenant)}`,
      '',
      `Email: ${who.email}`,
      ...who.details,
      '',
      `Approve or refuse it here: ${origin}/admin`,
    ].join('\n'),
  });
}

/** 2. The requester gets an acknowledgement. */
export async function confirmRequestToRequester(who: Requester, tenant: TenantConfig): Promise<void> {
  const salutation = who.name ? `Hi ${escHtml(who.name)},` : 'Hi,';
  const body = `
    <p style="margin:0 0 16px;">${salutation}</p>
    <p style="margin:0 0 16px;">Thanks for asking for access to <strong style="color:#F4F5FF;">${escHtml(tenantFullName(tenant))}</strong>. Your request is with the Knox team and we will email you as soon as it has been reviewed.</p>
    <p style="margin:0;">We have recorded it against <strong style="color:#F4F5FF;">${escHtml(who.email)}</strong>, so sign in with that address once you hear from us.</p>`;

  await sendEmail({
    to:      [{ email: who.email, name: who.name || who.email }],
    subject: `Access requested — ${tenant.brand.nameShort}`,
    htmlContent: emailShell({ kicker: KICKER, title: 'Request received', body }),
    textContent: `Thanks for asking for access to ${tenantFullName(tenant)}. Your request is with the Knox team and we will email you once it has been reviewed. It is recorded against ${who.email}.`,
  });
}

/** Who to tell about a decision — resolved from the uid by the admin route. */
export interface DecisionRecipient {
  /** The uid the approval link signs in. */
  uid:   string;
  email: string;
  name:  string;
}

/** 3. The requester is told the outcome. Only 'approved' and 'denied' send. */
export async function notifyDecision(
  who: DecisionRecipient,
  tenant: TenantConfig,
  status: 'approved' | 'denied' | 'pending',
  /** The site the button opens; see emailOrigin(). */
  origin: string = SITE_ORIGIN,
): Promise<void> {
  if (status === 'pending') return;

  const salutation = who.name ? `Hi ${escHtml(who.name)},` : 'Hi,';
  const approved   = status === 'approved';
  // The button signs them straight in. The token carries their uid, the key
  // the access store uses; access-link re-checks approval before minting.
  const signInUrl = approved
    ? `${origin}/login?tenant=${encodeURIComponent(tenant.id)}&access=${encodeURIComponent(createAccessToken(who.uid, String(tenant.dashboardId)))}`
    : '';

  const body = approved
    ? `<p style="margin:0 0 16px;">${salutation}</p>
       <p style="margin:0 0 16px;">You now have access to <strong style="color:#F4F5FF;">${escHtml(tenant.brand.nameShort)}</strong>. Click below to open it.</p>`
    : `<p style="margin:0 0 16px;">${salutation}</p>
       <p style="margin:0 0 16px;">We are not able to grant access to <strong style="color:#F4F5FF;">${escHtml(tenantFullName(tenant))}</strong> for ${escHtml(who.email)} at the moment.</p>
       <p style="margin:0;">If you think that is a mistake, reply to this email and we will take another look.</p>`;

  await sendEmail({
    to:      [{ email: who.email, name: who.name || who.email }],
    replyTo: { email: BRAND.contact.email, name: 'The Knox Index' },
    subject: approved
      ? `You now have access to ${tenant.brand.nameShort}`
      : `Access request update — ${tenant.brand.nameShort}`,
    htmlContent: emailShell({
      kicker: KICKER,
      title:  approved ? 'You are in' : 'Access not granted',
      body,
      cta:    approved ? { label: `Open ${tenant.brand.nameShort}`, url: signInUrl } : undefined,
    }),
    textContent: approved
      ? `You now have access to ${tenant.brand.nameShort}. Click below to open it:\n\n${signInUrl}`
      : `We are not able to grant access to ${tenantFullName(tenant)} for ${who.email} at the moment. Reply to this email if you think that is a mistake.`,
  });
}
