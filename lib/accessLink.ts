/**
 * lib/accessLink.ts
 * ------------------
 * The sign-in link in a waitlist approval email. Server-side only.
 *
 * Waitlist sign-ups never confirm their email, so the approval email is the
 * first time we know the address is theirs. Its button carries a signed token
 * (email, dashboard, expiry) that /api/auth/access-link swaps for a Firebase
 * session, so one click signs them in and opens the dashboard.
 *
 * Unlike a Firebase magic link it is not single-use and does not have to be
 * opened in the browser that asked for it, so it still works days later or
 * after an email scanner has visited it. It stops working after
 * TOKEN_TTL_DAYS, and access is re-checked when it is used, so a later
 * refusal wins over an old email.
 *
 * Signing key: ACCESS_LINK_SECRET when set, otherwise derived from the
 * Firebase service account (already secret, already on every deployment).
 *
 * One job: make and check approval-email sign-in tokens.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';

const TOKEN_TTL_DAYS = 30;

let cachedKey: Buffer | null = null;

function signingKey(): Buffer {
  if (cachedKey) return cachedKey;
  const explicit = (process.env.ACCESS_LINK_SECRET ?? '').trim();
  let material = explicit;
  if (!material) {
    const raw = (process.env.FIREBASE_SERVICE_ACCOUNT ?? '').trim();
    if (!raw) throw new Error('No signing key: set ACCESS_LINK_SECRET or FIREBASE_SERVICE_ACCOUNT');
    material = raw.startsWith('{') ? raw : readFileSync(raw, 'utf8');
  }
  cachedKey = createHash('sha256').update(`tki-access-link:${material}`).digest();
  return cachedKey;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function sign(payload: string): string {
  return b64url(createHmac('sha256', signingKey()).update(payload).digest());
}

export interface AccessLinkClaims {
  email:    string;
  /** Dashboard id as a string, as stored in tenant_access.tenantId. */
  tenantId: string;
}

/** A token for `email` on `tenantId`, valid for TOKEN_TTL_DAYS. */
export function createAccessToken(email: string, tenantId: string): string {
  const payload = b64url(JSON.stringify({
    e: email.trim().toLowerCase(),
    t: tenantId,
    x: Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  }));
  return `${payload}.${sign(payload)}`;
}

/** The claims in a valid, unexpired token; null for anything else. */
export function verifyAccessToken(token: string): AccessLinkClaims | null {
  const [payload, sig] = String(token ?? '').split('.');
  if (!payload || !sig) return null;

  const expected = Buffer.from(sign(payload));
  const given    = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const { e, t, x } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof e !== 'string' || typeof t !== 'string' || typeof x !== 'number') return null;
    if (Date.now() > x) return null;
    return { email: e, tenantId: t };
  } catch {
    return null;
  }
}
