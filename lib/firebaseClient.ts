/**
 * lib/firebaseClient.ts
 * ---------------------
 * Client-side Firebase Auth wrapper. Web only — every entry point no-ops off
 * web. Firebase modules are loaded with dynamic import() so native bundles
 * never execute Firebase code.
 *
 * Config comes from EXPO_PUBLIC_FIREBASE_* env vars (safe to expose — these
 * identify the project, they do not grant access).
 *
 * Flows provided:
 *   - signInWithGoogle()          → popup → ID token
 *   - completeMagicLinkSignIn()   → consumes the email link → ID token
 *   - establishSession(idToken)   → POSTs to /api/auth/session (httpOnly cookie)
 *   - mintSessionSilently()       → re-mints the cookie if Firebase still has
 *                                   a signed-in user (rolling sessions)
 *   - firebaseSignOut()           → client-side sign-out
 *
 * One job: be the only module that talks to the Firebase client SDK.
 */

import { Platform } from 'react-native';

const config = {
  apiKey:     process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId:      process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/** localStorage key holding the email a magic link was requested for. */
export const PENDING_EMAIL_KEY = 'tki_pending_email';

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

// ── SDK loading (lazy, web only) ───────────────────────────────────────────────

async function getClientAuth() {
  if (Platform.OS !== 'web') throw new Error('Firebase client auth is web only');
  if (!isFirebaseConfigured()) throw new Error('EXPO_PUBLIC_FIREBASE_* env vars are not set');

  const { initializeApp, getApps } = await import('firebase/app');
  const { getAuth } = await import('firebase/auth');

  const app = getApps().length ? getApps()[0] : initializeApp(config);
  return getAuth(app);
}

// ── Sign-in flows ──────────────────────────────────────────────────────────────

/**
 * Google sign-in via popup. Resolves with a fresh ID token, or null if the
 * user closed the popup.
 */
export async function signInWithGoogle(): Promise<string | null> {
  const auth = await getClientAuth();
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');

  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    return result.user.getIdToken();
  } catch (err: any) {
    if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
      return null;
    }
    throw err;
  }
}

/** True when the current URL is a Firebase email sign-in link. */
export async function isMagicLink(href: string): Promise<boolean> {
  if (Platform.OS !== 'web' || !isFirebaseConfigured()) return false;
  const auth = await getClientAuth();
  const { isSignInWithEmailLink } = await import('firebase/auth');
  return isSignInWithEmailLink(auth, href);
}

/**
 * Completes passwordless sign-in from the magic link in `href`.
 * Resolves with a fresh ID token. Throws on invalid/expired/used links.
 */
export async function completeMagicLinkSignIn(email: string, href: string): Promise<string> {
  const auth = await getClientAuth();
  const { signInWithEmailLink } = await import('firebase/auth');
  const result = await signInWithEmailLink(auth, email, href);
  localStorage.removeItem(PENDING_EMAIL_KEY);
  return result.user.getIdToken();
}

// ── Session bridge (client SDK → httpOnly cookie) ─────────────────────────────

/**
 * Exchanges an ID token for the httpOnly session cookie.
 * Returns the authenticated email on success.
 */
export async function establishSession(idToken: string): Promise<string> {
  const res = await fetch('/api/auth/session', {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body:        JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? 'Failed to establish session');
  }
  const data: { email: string } = await res.json();
  return data.email;
}

/**
 * Rolling sessions: if the session cookie has lapsed (14-day Firebase limit)
 * but the client SDK still holds a signed-in user, silently re-mint the
 * cookie. Returns the email on success, null if there is no Firebase user.
 */
export async function mintSessionSilently(): Promise<string | null> {
  if (Platform.OS !== 'web' || !isFirebaseConfigured()) return null;

  const auth = await getClientAuth();
  const { onAuthStateChanged } = await import('firebase/auth');

  // Wait for the SDK to restore persistence before reading currentUser.
  const user = await new Promise<import('firebase/auth').User | null>(resolve => {
    const unsub = onAuthStateChanged(auth, u => { unsub(); resolve(u); });
  });
  if (!user) return null;

  try {
    const idToken = await user.getIdToken(true); // force-refresh → fresh auth_time not guaranteed
    return await establishSession(idToken);
  } catch {
    return null;
  }
}

/** Signs out of the Firebase client SDK (cookie clearing is the server's job). */
export async function firebaseSignOut(): Promise<void> {
  if (Platform.OS !== 'web' || !isFirebaseConfigured()) return;
  const auth = await getClientAuth();
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}
