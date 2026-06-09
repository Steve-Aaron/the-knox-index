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

import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

const SECRET               = process.env.AUTH_SECRET ?? 'dev-secret-change-me-in-production';
const MAGIC_EXPIRY_MS      = 60 * 60 * 1000;       // 1 hour
const SESSION_EXPIRY_S     = 30 * 24 * 60 * 60;    // 30 days
const SESSION_COOKIE_NAME  = 'tki_auth';
const OAUTH_STATE_COOKIE   = 'tki_oauth_state';
const OAUTH_STATE_EXPIRY_S = 10 * 60;              // 10 minutes

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

  // Server-side sliding expiry: a session is only valid for SESSION_EXPIRY_S
  // from when it was last issued. The cookie's Max-Age handles the browser
  // side, but checking `issued` here closes the gap where a cookie is replayed
  // after the intended lifetime (e.g. exported/restored cookies).
  const issuedAt = parseInt(issued, 10);
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > SESSION_EXPIRY_S * 1000) return null;

  return email;
}

/**
 * Re-issues a session cookie for an already-authenticated user.
 *
 * Called on each authenticated request so the 30-day window slides forward
 * on every visit — active users effectively never get logged out, while a
 * genuinely idle session still lapses after SESSION_EXPIRY_S. This is the
 * "rolling session" behaviour. Identical output to createSessionCookie; the
 * separate name documents intent at the call site.
 */
export function refreshSessionCookie(email: string): string {
  return createSessionCookie(email);
}

/**
 * Produces a Set-Cookie header that immediately expires the session cookie.
 */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;
}

// ── OAuth state (CSRF protection for the Google flow) ───────────────────────────

const OAUTH_STATE_NAME = OAUTH_STATE_COOKIE;

/**
 * Generates a one-time OAuth `state` value plus the Set-Cookie header that
 * binds it to this browser. The same random nonce is sent to Google as the
 * `state` query param and stored in a short-lived httpOnly cookie; on callback
 * the two must match, which blocks login-CSRF and mismatched callbacks.
 *
 * Returns { state, cookie } — put `state` on the auth URL, send `cookie` back.
 */
export function createOAuthState(): { state: string; cookie: string } {
  const state = randomBytes(16).toString('base64url');

  const directives = [
    `${OAUTH_STATE_NAME}=${state}`,
    `Max-Age=${OAUTH_STATE_EXPIRY_S}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') directives.push('Secure');

  return { state, cookie: directives.join('; ') };
}

/**
 * Confirms the `state` returned by Google matches the nonce we stored in the
 * cookie. Returns true only on an exact, constant-time match.
 */
export function verifyOAuthState(cookieHeader: string | null, stateParam: string | null): boolean {
  if (!cookieHeader || !stateParam) return false;

  const match = cookieHeader
    .split(';')
    .map(s => s.trim())
    .find(s => s.startsWith(`${OAUTH_STATE_NAME}=`));

  if (!match) return false;
  const cookieState = match.slice(OAUTH_STATE_NAME.length + 1);
  if (!cookieState) return false;

  return safeEqual(cookieState, stateParam);
}

/**
 * Set-Cookie header that immediately clears the OAuth state cookie — called
 * on the callback so the one-time nonce can't be replayed.
 */
export function clearOAuthState(): string {
  return `${OAUTH_STATE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;
}
