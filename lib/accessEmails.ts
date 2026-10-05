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
import { tenantOrigin, tenantFullName, type TenantConfig } from '@/lib/tenants';
import { REGION_LABELS, type RegionKey } from '@/lib/regions';
import type { AccessRecord } from '@/lib/tenantAccess';

const KICKER = 'THE KNOX INDEX';

/** The stored region keys as readable labels. Editorial interest, not access. */
function areaLabels(areas: string | null): string {
  if (!areas) return '—';
  return areas
    .split(',')
    .map(r => r.trim())
    .filter(Boolean)
    .map(r => REGION_LABELS[r as RegionKey] ?? r)
    .join(', ') || '—';
}

function detailRows(record: AccessRecord): string {
  const rows: [string, string][] = [
    ['Email',        record.email],
    ['Name',         record.requesterName  || '—'],
    ['Organisation', record.organisation   || '—'],
    ['Role',         record.jobRole        || '—'],
    ['Areas of interest', areaLabels(record.areasOfInterest)],
    ['Heard via',    record.referralSource || '—'],
  ];

  return `<table cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 16px;">
    ${rows.map(([label, value]) => `
      <tr>
        <td style="padding:6px 12px 6px 0;font-size:12px;color:#55556A;white-space:nowrap;vertical-align:top;">${escHtml(label)}</td>
        <td style="padding:6px 0;font-size:13px;color:#F4F5FF;">${escHtml(value)}</td>
      </tr>`).join('')}
  </table>`;
}

function detailText(record: AccessRecord): string {
  return [
    `Email: ${record.email}`,
    `Name: ${record.requesterName || '—'}`,
    `Organisation: ${record.organisation || '—'}`,
    `Role: ${record.jobRole || '—'}`,
    `Areas of interest: ${areaLabels(record.areasOfInterest)}`,
    `Heard via: ${record.referralSource || '—'}`,
    '',
    `Reason: ${record.reason || '—'}`,
  ].join('\n');
}

/** 1. Knox gets told someone is waiting. */
export async function notifyKnoxOfRequest(record: AccessRecord, tenant: TenantConfig): Promise<void> {
  const body = `
    <p style="margin:0 0 8px;">Someone has asked for access to <strong style="color:#F4F5FF;">${escHtml(tenantFullName(tenant))}</strong>.</p>
    ${detailRows(record)}
    <p style="margin:0 0 6px;font-size:12px;color:#55556A;">Reason given</p>
    <p style="margin:0;white-space:pre-wrap;color:#F4F5FF;">${escHtml(record.reason || '—')}</p>`;

  await sendEmail({
    to:       [{ email: BRAND.contact.email, name: 'Knox Index Access' }],
    replyTo:  { email: record.email, name: record.requesterName || record.email },
    subject:  `Access request — ${tenant.brand.nameShort} — ${record.requesterName || record.email}`,
    htmlContent: emailShell({
      kicker: KICKER,
      title:  'New access request',
      body,
      cta:    { label: 'Review in admin', url: `${tenantOrigin(tenant)}/admin` },
    }),
    textContent: `New access request for ${tenantFullName(tenant)}\n\n${detailText(record)}\n\nReview: ${tenantOrigin(tenant)}/admin`,
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

  const body = approved
    ? `<p style="margin:0 0 16px;">${salutation}</p>
       <p style="margin:0 0 16px;">You now have access to <strong style="color:#F4F5FF;">${escHtml(tenantFullName(tenant))}</strong>. Sign in with <strong style="color:#F4F5FF;">${escHtml(record.email)}</strong> and the dashboard will open.</p>`
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
      cta:    approved ? { label: `Open ${tenant.brand.nameShort}`, url: tenantOrigin(tenant) } : undefined,
    }),
    textContent: approved
      ? `You now have access to ${tenantFullName(tenant)}. Sign in with ${record.email}: ${tenantOrigin(tenant)}`
      : `We are not able to grant access to ${tenantFullName(tenant)} for ${record.email} at the moment. Reply to this email if you think that is a mistake.`,
  });
}
