/**
 * lib/accessEmails.ts
 * --------------------
 * The three emails an access request generates:
 *
 *   1. notifyKnoxOfRequest       → Knox, when someone asks
 *   2. confirmRequestToRequester → the requester, acknowledging it
 *   3. notifyDecision            → the requester, when an admin decides
 *
 * All three are best-effort: a send failure is logged and swallowed, because
 * the record in BigQuery is the source of truth and a form must never fail on
 * a mail-provider hiccup.
 *
 * One job: turn an access record into the right message.
 */

import { sendEmail, emailShell, escHtml } from '@/lib/transactionalEmail';
import { BRAND } from '@/brand/constants';
import { SITE_ORIGIN, tenantFullName, type TenantConfig } from '@/lib/tenants';
import { createAccessToken } from '@/lib/accessLink';
import { REGION_LABELS, type RegionKey } from '@/lib/regions';
import type { AccessRecord } from '@/lib/tenantAccess';

const KICKER = 'THE KNOX INDEX';

/** The stored region keys as readable labels. Editorial interest, not access. */
function areaLabels(areas: string | null): string {
  if (!areas) return 'Not given';
  return areas
    .split(',')
    .map(r => r.trim())
    .filter(Boolean)
    .map(r => REGION_LABELS[r as RegionKey] ?? r)
    .join(', ') || 'Not given';
}

function detailText(record: AccessRecord): string {
  return [
    `Email: ${record.email}`,
    `Name: ${record.requesterName || 'Not given'}`,
    `Organisation: ${record.organisation || 'Not given'}`,
    `Role: ${record.jobRole || 'Not given'}`,
    `Areas of interest: ${areaLabels(record.areasOfInterest)}`,
    `Heard via: ${record.referralSource || 'Not given'}`,
    '',
    `Reason: ${record.reason || 'Not given'}`,
  ].join('\n');
}

/** 1. Knox gets told someone is waiting. Plain text: an internal alert. */
export async function notifyKnoxOfRequest(record: AccessRecord, tenant: TenantConfig): Promise<void> {
  await sendEmail({
    to:       [{ email: BRAND.contact.email, name: 'Knox Index Access' }],
    replyTo:  { email: record.email, name: record.requesterName || record.email },
    subject:  `Waitlist request: ${tenant.brand.nameShort}: ${record.requesterName || record.email}`,
    textContent: [
      `New access request for ${tenantFullName(tenant)}`,
      '',
      detailText(record),
      '',
      `Approve or refuse it here: ${SITE_ORIGIN}/admin`,
    ].join('\n'),
  });
}

/** 2. The requester gets an acknowledgement. */
export async function confirmRequestToRequester(record: AccessRecord, tenant: TenantConfig): Promise<void> {
  const salutation = record.requesterName ? `Hi ${escHtml(record.requesterName)},` : 'Hi,';
  const body = `
    <p style="margin:0 0 16px;">${salutation}</p>
    <p style="margin:0 0 16px;">Thanks for asking for access to <strong style="color:#F4F5FF;">${escHtml(tenantFullName(tenant))}</strong>. Your request is with the Knox team and we will email you as soon as it has been reviewed.</p>
    <p style="margin:0;">We have recorded it against <strong style="color:#F4F5FF;">${escHtml(record.email)}</strong>, so sign in with that address once you hear from us.</p>`;

  await sendEmail({
    to:      [{ email: record.email, name: record.requesterName || record.email }],
    subject: `Access requested — ${tenant.brand.nameShort}`,
    htmlContent: emailShell({ kicker: KICKER, title: 'Request received', body }),
    textContent: `Thanks for asking for access to ${tenantFullName(tenant)}. Your request is with the Knox team and we will email you once it has been reviewed. It is recorded against ${record.email}.`,
  });
}

/** 3. The requester is told the outcome. Only 'approved' and 'denied' send. */
export async function notifyDecision(
  record: AccessRecord,
  tenant: TenantConfig,
  status: 'approved' | 'denied' | 'pending',
): Promise<void> {
  if (status === 'pending') return;

  const salutation = record.requesterName ? `Hi ${escHtml(record.requesterName)},` : 'Hi,';
  const approved   = status === 'approved';
  // The button signs them straight in: waitlist sign-ups never confirmed
  // their email, and this email is the proof the address is theirs.
  const signInUrl = approved
    ? `${SITE_ORIGIN}/login?tenant=${encodeURIComponent(tenant.id)}&access=${encodeURIComponent(createAccessToken(record.email, String(tenant.dashboardId)))}`
    : '';

  const body = approved
    ? `<p style="margin:0 0 16px;">${salutation}</p>
       <p style="margin:0 0 16px;">You now have access to <strong style="color:#F4F5FF;">${escHtml(tenantFullName(tenant))}</strong>. The button below signs you in as <strong style="color:#F4F5FF;">${escHtml(record.email)}</strong> and opens the dashboard. It works for 30 days; after that, sign in from the site with this address.</p>`
    : `<p style="margin:0 0 16px;">${salutation}</p>
       <p style="margin:0 0 16px;">We are not able to grant access to <strong style="color:#F4F5FF;">${escHtml(tenantFullName(tenant))}</strong> for ${escHtml(record.email)} at the moment.</p>
       <p style="margin:0;">If you think that is a mistake, reply to this email and we will take another look.</p>`;

  await sendEmail({
    to:      [{ email: record.email, name: record.requesterName || record.email }],
    replyTo: { email: BRAND.contact.email, name: 'The Knox Index' },
    subject: approved
      ? `Access approved — ${tenant.brand.nameShort}`
      : `Access request update — ${tenant.brand.nameShort}`,
    htmlContent: emailShell({
      kicker: KICKER,
      title:  approved ? 'You are in' : 'Access not granted',
      body,
      cta:    approved ? { label: `Open ${tenant.brand.nameShort}`, url: signInUrl } : undefined,
    }),
    textContent: approved
      ? `You now have access to ${tenantFullName(tenant)}. Open this link to sign in as ${record.email}: ${signInUrl}`
      : `We are not able to grant access to ${tenantFullName(tenant)} for ${record.email} at the moment. Reply to this email if you think that is a mistake.`,
  });
}
