/**
 * lib/firebaseAdmin.ts
 * --------------------
 * Server-side Firebase Admin SDK wrapper. Replaces the HMAC token system in
 * the old lib/auth.ts with Firebase-managed identity.
 *
 * Responsibilities:
 *   - Initialise the admin app once (lazy singleton)
 *   - Generate passwordless sign-in links (sent via Brevo, not Firebase)
 *   - Mint / verify / clear the httpOnly session cookie
 *   - Revoke sessions on logout
 *
 * Credential parsing follows the same rule as lib/gcs.ts:
 *   1. FIREBASE_SERVICE_ACCOUNT starts with `{` → parsed as single-line JSON
 *   2. Otherwise → treated as a path on disk (local dev: ./keys/firebase.json)
 *
 * Session cookie: name `tki_auth` (unchanged), 14 days (Firebase maximum),
 * httpOnly, SameSite=Lax, Secure in production.
 *
 * One job: be the only module that talks to firebase-admin.
 */

import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

const SESSION_COOKIE_NAME = 'tki_auth';
const SESSION_EXPIRY_MS   = 14 * 24 * 60 * 60 * 1000; // Firebase max: 14 days
/** ID tokens older than this cannot be exchanged for a session cookie. */
const MAX_TOKEN_AGE_S     = 5 * 60;

// ── Admin app singleton ────────────────────────────────────────────────────────

let app: App | null = null;

function getAdminApp(): App {
  if (app) return app;
  if (getApps().length) { app = getApps()[0]; return app; }

  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT ?? '').trim();
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT is not set. Provide the service account JSON ' +
      '(single-line) or a path to the key file.'
    );
  }

  if (raw.startsWith('{')) {
    let creds: object;
    try {
      creds = JSON.parse(raw);
    } catch {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT looks like JSON but failed to parse. ' +
        'Ensure it is single-line JSON with \\n escapes inside private_key.'
      );
    }
    app = initializeApp({ credential: cert(creds as any) });
  } else {
    app = initializeApp({ credential: cert(raw) });
  }
  return app;
}

function adminAuth() {
  return getAuth(getAdminApp());
}

// ── Magic link generation (delivery stays with Brevo) ──────────────────────────

/**
 * Generates a Firebase passwordless sign-in link for `email`. The link lands
 * on `${continueUrl}` where the client SDK completes sign-in.
 * Firebase enforces single use and expiry on the embedded oobCode.
 */
export async function generateMagicLink(email: string, continueUrl: string): Promise<string> {
  return adminAuth().generateSignInWithEmailLink(email, {
    url:             continueUrl,
    handleCodeInApp: true,
  });
}

// ── Session cookie ─────────────────────────────────────────────────────────────

export interface SessionUser {
  uid:      string;
  email:    string;
  /** True once the user has completed profiling (Firebase custom claim). */
  profiled: boolean;
}

/**
 * Exchanges a freshly-minted Firebase ID token for a 14-day session cookie.
 * Rejects tokens older than MAX_TOKEN_AGE_S — a stolen old token must not be
 * able to mint a long-lived session.
 *
 * Returns the Set-Cookie header value plus the verified user.
 */
export async function createSessionFromIdToken(
  idToken: string
): Promise<{ setCookie: string; user: SessionUser }> {
  const decoded: DecodedIdToken = await adminAuth().verifyIdToken(idToken, true);

  const ageS = Date.now() / 1000 - decoded.auth_time;
  if (ageS > MAX_TOKEN_AGE_S) {
    throw new Error('Recent sign-in required');
  }
  if (!decoded.email) {
    throw new Error('Token has no email claim');
  }

  const cookieValue = await adminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRY_MS,
  });

  return {
    setCookie: buildCookie(cookieValue, SESSION_EXPIRY_MS / 1000),
    user:      { uid: decoded.uid, email: decoded.email, profiled: decoded.profiled === true },
  };
}

/**
 * Reads and verifies the session cookie from a Cookie header.
 * `checkRevoked: true` — a revoked refresh token kills the session server-side.
 * Returns the user on success, null on any failure (absent, expired, revoked).
 */
export async function verifySession(cookieHeader: string | null): Promise<SessionUser | null> {
  const value = readCookie(cookieHeader, SESSION_COOKIE_NAME);
  if (!value) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(value, true);
    if (!decoded.email) return null;
    // `profiled` is baked into the cookie at mint time, so it can read stale-
    // false right after profiling completes. Callers treat true as canonical
    // and never un-profile on false (see hooks/useAuth.ts).
    return { uid: decoded.uid, email: decoded.email, profiled: decoded.profiled === true };
  } catch {
    return null;
  }
}

/**
 * Marks a user as having completed profiling. Stored as a custom claim, so
 * it survives devices, browsers, and cleared localStorage. Idempotent.
 */
export async function markProfiled(uid: string): Promise<void> {
  const user = await adminAuth().getUser(uid);
  await adminAuth().setCustomUserClaims(uid, { ...user.customClaims, profiled: true });
}

/** Revokes all refresh tokens for a user — invalidates every session cookie. */
export async function revokeSessions(uid: string): Promise<void> {
  await adminAuth().revokeRefreshTokens(uid);
}

/** Set-Cookie header that immediately expires the session cookie. */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;
}

// ── Cookie helpers ─────────────────────────────────────────────────────────────

function buildCookie(value: string, maxAgeS: number): string {
  const directives = [
    `${SESSION_COOKIE_NAME}=${value}`,
    `Max-Age=${maxAgeS}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') directives.push('Secure');
  return directives.join('; ');
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(';')
    .map(s => s.trim())
    .find(s => s.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}
