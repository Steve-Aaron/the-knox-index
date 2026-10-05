/**
 * lib/tenantAccess.ts
 * --------------------
 * Who may read a gated tenant. Server-side only.
 *
 * Two independent ways in, checked in this order:
 *   1. EMAIL DOMAIN — the signed-in address ends in one of the tenant's
 *      `allowedDomains` (see lib/tenants.ts). No record needed, nothing to
 *      administer: every @knoxdigi.com / @knox.digital user is in by default.
 *   2. APPROVAL — an `approved` row in the `tenant_access` BigQuery table for
 *      that (email, tenantId) pair. This is the mechanism for clients and
 *      anyone else outside the allowed domains.
 *
 * Anything else — no row, a `pending` row, or a `denied` row — is refused.
 *
 * Reads are cached in-process for CACHE_TTL_MS so a page load costs at most
 * one BigQuery lookup per user per minute. Writes clear the entry immediately,
 * so an approval takes effect on the user's next request.
 *
 * One job: answer `may this email read this tenant?`.
 */

import { queryParams, tableRef } from '@/lib/bigquery';
import { isAllowedDomain, tenantById, type TenantConfig } from '@/lib/tenants';
import { devAccessBypass } from '@/lib/devIdentity';

export type AccessStatus = 'approved' | 'pending' | 'denied' | 'none';

export interface AccessRecord {
  email:       string;
  /** The dashboard id this record grants, as a string. See canonicalTenantId. */
  tenantId:    string;
  status:      AccessStatus;
  requestedAt: string | null;
  decidedAt:   string | null;
  decidedBy:   string | null;
  note:        string | null;
  /** Answers from the access request form (components/auth/AccessRequestForm.tsx). */
  requesterName:  string | null;
  organisation:   string | null;
  jobRole:        string | null;
  reason:         string | null;
  /**
   * Comma-separated region keys the requester said they care about.
   * EDITORIAL ONLY: an approved user sees the whole dashboard. This never
   * scopes access, and no query filters on it.
   */
  areasOfInterest: string | null;
  referralSource: string | null;
}

/** What the request form sends. Every field is optional except the ones the
 *  form itself marks required — the server re-checks those. */
export interface AccessRequestDetails {
  requesterName?:  string;
  organisation?:   string;
  jobRole?:        string;
  reason?:         string;
  /** Regions of editorial interest. Does not affect what they can see. */
  areasOfInterest?: string[];
  referralSource?: string;
}

/** How the caller got in (or didn't) — surfaced to the client for messaging. */
export type AccessDecision =
  | { allowed: true;  reason: 'public' | 'domain' | 'approved' | 'dev-bypass' }
  | { allowed: false; reason: 'unauthenticated' | 'pending' | 'denied' | 'none' };

const TABLE = 'tenant_access';

/**
 * The value stored in `tenant_access.tenantId`: the DASHBOARD ID as a string.
 *
 * The dashboard id is what the data itself is keyed by (`account_x_dashboard`),
 * so a record says which dashboard it grants without depending on a slug that
 * could be renamed. Slugs are still accepted on the way in.
 */
function canonicalTenantId(tenant: TenantConfig | string | number): string {
  const config = typeof tenant === 'object' ? tenant : tenantById(tenant);
  return String(config.dashboardId);
}
const CACHE_TTL_MS = 60_000;

const cache = new Map<string, { status: AccessStatus; expires: number }>();

function cacheKey(email: string, tenantId: string): string {
  return `${tenantId}:${email.toLowerCase()}`;
}

function invalidate(email: string, tenantId: string): void {
  cache.delete(cacheKey(email, tenantId));
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Shared projection — one shape for every record read. */
const SELECT_RECORD = `
  SELECT
    email,
    tenantId,
    status,
    CAST(requestedAt AS STRING) AS requestedAt,
    CAST(decidedAt   AS STRING) AS decidedAt,
    decidedBy,
    note,
    requesterName,
    organisation,
    jobRole,
    reason,
    areasOfInterest,
    referralSource
  FROM ${tableRef(TABLE)}`;

/** Raw status for one (email, tenant) pair. 'none' when there is no row. */
export async function getAccessStatus(email: string, tenant: string | number | TenantConfig): Promise<AccessStatus> {
  const addr     = normaliseEmail(email);
  const tenantId = canonicalTenantId(tenant);
  const key      = cacheKey(addr, tenantId);

  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.status;

  let status: AccessStatus = 'none';
  try {
    const rows = await queryParams<{ status: string }>(
      `SELECT status
       FROM ${tableRef(TABLE)}
       WHERE LOWER(email) = @email AND tenantId = @tenantId
       ORDER BY COALESCE(decidedAt, requestedAt) DESC
       LIMIT 1`,
      { email: addr, tenantId },
    );
    const raw = rows[0]?.status?.toLowerCase();
    if (raw === 'approved' || raw === 'pending' || raw === 'denied') status = raw;
  } catch (err: unknown) {
    // A missing table (first deploy, before scripts/create-tenant-access-table.mjs
    // has run) must not hand out access. Fail CLOSED and log loudly.
    console.error('[tenantAccess] status lookup failed — denying:', (err as Error)?.message ?? err);
    return 'none';
  }

  cache.set(key, { status, expires: Date.now() + CACHE_TTL_MS });
  return status;
}

/**
 * The full decision for a tenant + signed-in email.
 * `email` is null for an unauthenticated request.
 */
export async function decideAccess(
  email: string | null,
  tenant: TenantConfig,
): Promise<AccessDecision> {
  if (tenant.access.mode === 'public') return { allowed: true, reason: 'public' };

  // Local preview escape hatch: DEV_TENANT_BYPASS=1 skips the decision entirely
  // so `npm run dev` can show a gated dashboard with real data. Prefer
  // DEV_TENANT_EMAIL, which exercises the real rules. See lib/devIdentity.ts.
  if (devAccessBypass()) return { allowed: true, reason: 'dev-bypass' };
  if (!email)                          return { allowed: false, reason: 'unauthenticated' };
  if (isAllowedDomain(email, tenant))  return { allowed: true, reason: 'domain' };
  if (!tenant.access.requireApproval)  return { allowed: true, reason: 'approved' };

  const status = await getAccessStatus(email, tenant);
  if (status === 'approved') return { allowed: true, reason: 'approved' };
  return { allowed: false, reason: status === 'none' ? 'none' : status };
}

/** Trim, cap and default a free-text field so nothing unbounded reaches SQL. */
function clean(value: string | undefined, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

/**
 * Record a request for access, with the form's answers.
 *
 * Idempotent on the DECISION: an existing approved or denied row keeps its
 * status, so a denied user cannot reset themselves to pending and an approved
 * user cannot lose access by submitting again. A pending row DOES take the
 * newer answers — someone correcting their own submission is reasonable.
 */
export async function requestAccess(
  email: string,
  tenant: string | number | TenantConfig,
  details: AccessRequestDetails = {},
): Promise<AccessStatus> {
  const addr     = normaliseEmail(email);
  const tenantId = canonicalTenantId(tenant);

  const params = {
    email:          addr,
    tenantId,
    requesterName:  clean(details.requesterName, 128),
    organisation:   clean(details.organisation, 160),
    jobRole:        clean(details.jobRole, 128),
    reason:         clean(details.reason, 1000),
    areasOfInterest: (details.areasOfInterest ?? []).map(r => clean(r, 24)).filter(Boolean).slice(0, 8).join(','),
    referralSource: clean(details.referralSource, 120),
  };

  await queryParams(
    `MERGE ${tableRef(TABLE)} T
     USING (SELECT @email AS email, @tenantId AS tenantId) S
     ON LOWER(T.email) = S.email AND T.tenantId = S.tenantId
     WHEN MATCHED AND T.status = 'pending' THEN UPDATE SET
       requestedAt    = CURRENT_TIMESTAMP(),
       requesterName  = @requesterName,
       organisation   = @organisation,
       jobRole        = @jobRole,
       reason          = @reason,
       areasOfInterest = @areasOfInterest,
       referralSource  = @referralSource
     WHEN NOT MATCHED THEN
       INSERT (email, tenantId, status, requestedAt, requesterName, organisation, jobRole, reason, areasOfInterest, referralSource)
       VALUES (S.email, S.tenantId, 'pending', CURRENT_TIMESTAMP(), @requesterName, @organisation, @jobRole, @reason, @areasOfInterest, @referralSource)`,
    params,
  );

  invalidate(addr, tenantId);
  return getAccessStatus(addr, tenantId);
}

/** One record by email + tenant, including the form answers. Null when absent. */
export async function getAccessRecord(
  email: string,
  tenant: string | number | TenantConfig,
): Promise<AccessRecord | null> {
  const rows = await queryParams<AccessRecord>(
    `${SELECT_RECORD}
     WHERE LOWER(email) = @email AND tenantId = @tenantId
     LIMIT 1`,
    { email: normaliseEmail(email), tenantId: canonicalTenantId(tenant) },
  );
  return rows[0] ?? null;
}

/** Admin decision — approve or deny an address for a tenant. Upserts. */
export async function setAccessStatus(
  email: string,
  tenant: string | number | TenantConfig,
  status: Exclude<AccessStatus, 'none'>,
  decidedBy: string,
  // Empty string rather than null: a NULL named parameter has no inferable
  // type in BigQuery and would be rejected before the statement runs.
  note = '',
): Promise<void> {
  const addr     = normaliseEmail(email);
  const tenantId = canonicalTenantId(tenant);

  await queryParams(
    `MERGE ${tableRef(TABLE)} T
     USING (SELECT @email AS email, @tenantId AS tenantId) S
     ON LOWER(T.email) = S.email AND T.tenantId = S.tenantId
     WHEN MATCHED THEN UPDATE SET
       status = @status, decidedAt = CURRENT_TIMESTAMP(), decidedBy = @decidedBy, note = @note
     WHEN NOT MATCHED THEN
       INSERT (email, tenantId, status, requestedAt, decidedAt, decidedBy, note)
       VALUES (S.email, S.tenantId, @status, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP(), @decidedBy, @note)`,
    { email: addr, tenantId, status, decidedBy, note },
  );

  invalidate(addr, tenantId);
}

/** Every access record, newest first. Admin list view. */
export async function listAccess(tenant?: string | number | TenantConfig): Promise<AccessRecord[]> {
  // Two queries rather than one with a nullable parameter: BigQuery cannot
  // infer a type for a NULL named parameter, and an untyped param is an error.
  const order = `ORDER BY COALESCE(decidedAt, requestedAt) DESC LIMIT 500`;

  return tenant !== undefined
    ? queryParams<AccessRecord>(`${SELECT_RECORD} WHERE tenantId = @tenantId ${order}`, { tenantId: canonicalTenantId(tenant) })
    : queryParams<AccessRecord>(`${SELECT_RECORD} ${order}`, {});
}
