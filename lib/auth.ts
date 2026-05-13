/**
 * lib/auth.ts
 * -----------
 * Stateless HMAC-SHA256 token utilities for magic link auth.
 * No database required — expiry and signature are encoded in the token itself.
 *
 * Two token types:
 *   Magic link  — short-lived (1 hour), sent via email, one-time use*
 *   Session     — long-lived (30 days), stored in an httpOnly cookie
 *
 * * "one-time" is enforced by expiry only (no revocation list).
 *   Acceptable for a soft-gate dashboard; add a KV store if you need true
 *   single-use invalidation.
 *
 * Required env var: AUTH_SECRET (any long random string)
 */

import { createHmac, timingSafeEqual } from 'crypto';

const SECRET               = process.env.AUTH_SECRET ?? 'dev-secret-change-me-in-production';
const MAGIC_EXPIRY_MS      = 60 * 60 * 1000;       // 1 hour
const SESSION_EXPIRY_S     = 30 * 24 * 60 * 60;    // 30 days
const SESSION_COOKIE_NAME  = 'tki_auth';

// ── Internals ──────────────────────────────────────────────────────────────────

function hmac(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

function encode(parts: string[]): string {
  return Buffer.from(parts.join('|')).toString('base64url');
}

function decode(token: string): string[] | null {
  try {
    return Buffer.from(token, 'base64url').toString('utf8').split('|');
  } catch {
    return null;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// ── Magic link token ───────────────────────────────────────────────────────────

/**
 * Creates a signed token encoding email + expiry.
 * Format (base64url): email|expiry|sig
 */
export function createMagicToken(email: string): string {
  const expiry  = String(Date.now() + MAGIC_EXPIRY_MS);
  const payload = `${email}|${expiry}`;
  const sig     = hmac(payload);
  return encode([email, expiry, sig]);
}

/**
 * Verifies a magic token. Returns the email on success, null on failure.
 */
export function verifyMagicToken(token: string): string | null {
  const parts = decode(token);
  if (!parts || parts.length !== 3) return null;
  const [email, expiry, sig] = parts;
  const payload = `${email}|${expiry}`;
  if (!safeEqual(sig, hmac(payload))) return null;
  if (Date.now() > parseInt(expiry, 10)) return null;
  return email;
}

// ── Session cookie ─────────────────────────────────────────────────────────────

/**
 * Creates the Set-Cookie header value for a session cookie.
 * Format (base64url): email|issued|sig
 */
export function createSessionCookie(email: string): string {
  const issued  = String(Date.now());
  const payload = `${email}|${issued}`;
  const sig     = hmac(payload);
  const value   = encode([email, issued, sig]);

  const directives = [
    `${SESSION_COOKIE_NAME}=${value}`,
    `Max-Age=${SESSION_EXPIRY_S}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];

  // Secure flag: only in production (Vercel sets NODE_ENV=production automatically)
  if (process.env.NODE_ENV === 'production') {
    directives.push('Secure');
  }

  return directives.join('; ');
}

/**
 * Reads and verifies the session cookie from a Cookie header string.
 * Returns the email on success, null if missing/invalid/tampered.
 */
export function verifySessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const match = cookieHeader
    .split(';')
    .map(s => s.trim())
    .find(s => s.startsWith(`${SESSION_COOKIE_NAME}=`));

  if (!match) return null;

  const value = match.slice(SESSION_COOKIE_NAME.length + 1);
  const parts = decode(value);
  if (!parts || parts.length !== 3) return null;

  const [email, issued, sig] = parts;
  const payload = `${email}|${issued}`;
  if (!safeEqual(sig, hmac(payload))) return null;

  return email;
}

/**
 * Produces a Set-Cookie header that immediately expires the session cookie.
 */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;
}
