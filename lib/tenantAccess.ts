/**
 * lib/tenantAccess.ts
 * --------------------
 * Who may read a gated tenant. Server-side only. Backed by Firestore.
 *
 * Two independent ways in, checked in this order:
 *   1. EMAIL DOMAIN — the signed-in address ends in one of the tenant's
 *      `allowedDomains` (lib/tenants.ts). No record needed: every
 *      @knoxdigi.com / @knox.digital user is in by default.
 *   2. APPROVAL — an `approved` access doc for that (firebaseUid, tenantId).
 *      This is the mechanism for clients and anyone outside the domains.
 *
 * Anything else — no doc, a `pending` doc, or a `denied` doc — is refused.
 *
 * Access is keyed on the Firebase UID, never on email or name: this store
 * holds no identifying information. The person's details live in Brevo, tied
 * back by the same UID (Brevo's FIREBASE_UID attribute). A person is only ever
 * recorded once signed in, so the UID always exists.
 *
 * Reads are cached in-process for CACHE_TTL_MS, so a page load costs at most
 * one Firestore read per user per tenant per TTL. A write on this instance
 * clears the entry at once; an approval made on another instance is seen
 * within the TTL.
 *
 * One job: answer `may this signed-in user read this tenant?`.
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { isAllowedDomain, tenantById, type TenantConfig } from '@/lib/tenants';
import { devAccessBypass } from '@/lib/devIdentity';
import type { Firestore, Query } from 'firebase-admin/firestore';

export type AccessStatus = 'approved' | 'pending' | 'denied' | 'none';

/** A signed-in caller. The gate needs the email (domain rule) and the uid (key). */
export interface AccessIdentity {
  uid:   string;
  email: string;
}

/**
 * One access doc. No identifying fields: name, company and email live only in
 * Brevo, tied to this by `firebaseUid`.
 */
export interface AccessRecord {
  firebaseUid: string;
  /** Dashboard id as a string, as stored on the doc. See canonicalTenantId. */
  tenantId:    string;
  status:      Exclude<AccessStatus, 'none'>;
  requestedAt: string | null;
  decidedAt:   string | null;
  /** The Firebase UID of the admin who decided — not their email. */
  decidedBy:   string | null;
  note:        string | null;
}

/** How the caller got in (or didn't) — surfaced to the client for messaging. */
export type AccessDecision =
  | { allowed: true;  reason: 'public' | 'domain' | 'approved' | 'dev-bypass' }
  | { allowed: false; reason: 'unauthenticated' | 'pending' | 'denied' | 'none' };

const COLLECTION = 'tenantAccess';

/**
 * The dashboard id, as a string, is what a doc is keyed and filtered by — the
 * data itself is keyed by dashboard id (`account_x_dashboard`), so it never
 * depends on a slug that could be renamed. Slugs are accepted on the way in.
 */
function canonicalTenantId(tenant: TenantConfig | string | number): string {
  const config = typeof tenant === 'object' ? tenant : tenantById(tenant);
  return String(config.dashboardId);
}

/** Doc id for a (uid, tenant) pair. '__' never appears in a Firebase uid. */
function docId(uid: string, tenantId: string): string {
  return `${uid}__${tenantId}`;
}

function col(db: Firestore) {
  return db.collection(COLLECTION);
}

// ── In-process cache ────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { status: AccessStatus; expires: number }>();

function cacheKey(uid: string, tenantId: string): string {
  return `${tenantId}:${uid}`;
}
function invalidate(uid: string, tenantId: string): void {
  cache.delete(cacheKey(uid, tenantId));
}

// ── Reads ───────────────────────────────────────────────────────────────────

/** A stored status, or 'none'. Isomorphic guard against stray values. */
function asStatus(raw: unknown): AccessStatus {
  return raw === 'approved' || raw === 'pending' || raw === 'denied' ? raw : 'none';
}

/** Raw status for one (uid, tenant) pair. 'none' when there is no doc. */
export async function getAccessStatus(uid: string, tenant: string | number | TenantConfig): Promise<AccessStatus> {
  const tenantId = canonicalTenantId(tenant);
  const key      = cacheKey(uid, tenantId);

  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.status;

  let status: AccessStatus = 'none';
  try {
    const snap = await col(getAdminFirestore()).doc(docId(uid, tenantId)).get();
    status = snap.exists ? asStatus(snap.get('status')) : 'none';
  } catch (err: unknown) {
    // A Firestore outage must not hand out access. Fail CLOSED and log loudly.
    console.error('[tenantAccess] status lookup failed — denying:', (err as Error)?.message ?? err);
    return 'none';
  }

  cache.set(key, { status, expires: Date.now() + CACHE_TTL_MS });
  return status;
}

/**
 * The full decision for a tenant and a signed-in caller.
 * `identity` is null for an unauthenticated request.
 */
export async function decideAccess(
  identity: AccessIdentity | null,
  tenant: TenantConfig,
): Promise<AccessDecision> {
  if (tenant.access.mode === 'public') return { allowed: true, reason: 'public' };

  // Local preview escape hatch: DEV_TENANT_BYPASS=1 skips the decision so
  // `npm run dev` can show a gated dashboard with real data (lib/devIdentity.ts).
  if (devAccessBypass())                        return { allowed: true, reason: 'dev-bypass' };
  if (!identity)                                return { allowed: false, reason: 'unauthenticated' };
  if (isAllowedDomain(identity.email, tenant))  return { allowed: true, reason: 'domain' };
  if (!tenant.access.requireApproval)           return { allowed: true, reason: 'approved' };

  const status = await getAccessStatus(identity.uid, tenant);
  if (status === 'approved') return { allowed: true, reason: 'approved' };
  return { allowed: false, reason: status === 'none' ? 'none' : status };
}

// ── Writes ──────────────────────────────────────────────────────────────────

/**
 * Record a pending request for a signed-in person.
 *
 * Idempotent on the DECISION: an existing approved or denied doc is left
 * alone, so a denied user cannot reset themselves to pending and an approved
 * user cannot lose access by asking again. A new or pending doc becomes
 * pending with a fresh timestamp. The returned status reflects the result.
 */
export async function requestAccess(
  identity: AccessIdentity,
  tenant: string | number | TenantConfig,
): Promise<AccessStatus> {
  const tenantId = canonicalTenantId(tenant);
  const ref      = col(getAdminFirestore()).doc(docId(identity.uid, tenantId));

  const result = await getAdminFirestore().runTransaction(async (tx) => {
    const snap    = await tx.get(ref);
    const current = snap.exists ? asStatus(snap.get('status')) : 'none';

    // A settled decision stands.
    if (current === 'approved' || current === 'denied') return current;

    tx.set(ref, {
      firebaseUid: identity.uid,
      tenantId,
      status:      'pending',
      requestedAt: new Date().toISOString(),
      decidedAt:   null,
      decidedBy:   null,
      note:        null,
    }, { merge: true });
    return 'pending' as AccessStatus;
  });

  invalidate(identity.uid, tenantId);
  return result;
}

/** Admin decision — approve or deny a uid for a tenant. Upserts. */
export async function setAccessStatus(
  uid: string,
  tenant: string | number | TenantConfig,
  status: Exclude<AccessStatus, 'none'>,
  /** The deciding admin's Firebase UID, for the audit trail. */
  decidedBy: string,
  note: string | null = null,
): Promise<void> {
  const tenantId = canonicalTenantId(tenant);
  const ref      = col(getAdminFirestore()).doc(docId(uid, tenantId));

  await getAdminFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const base = snap.exists
      ? {}
      : { firebaseUid: uid, tenantId, requestedAt: new Date().toISOString() };
    tx.set(ref, {
      ...base,
      status,
      decidedAt: new Date().toISOString(),
      decidedBy,
      note,
    }, { merge: true });
  });

  invalidate(uid, tenantId);
}

/** Every access doc for a tenant (or all), newest decision or request first. */
export async function listAccess(tenant?: string | number | TenantConfig): Promise<AccessRecord[]> {
  let q: Query = col(getAdminFirestore());
  if (tenant !== undefined) q = q.where('tenantId', '==', canonicalTenantId(tenant));

  const snap = await q.get();
  const rows = snap.docs.map(d => d.data() as AccessRecord);
  // Sort in memory: a composite Firestore index is overkill for an admin list
  // of this size, and either timestamp may be null.
  return rows
    .sort((a, b) => (b.decidedAt ?? b.requestedAt ?? '').localeCompare(a.decidedAt ?? a.requestedAt ?? ''))
    .slice(0, 500);
}
