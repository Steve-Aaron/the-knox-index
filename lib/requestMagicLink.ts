/**
 * lib/requestMagicLink.ts
 * ------------------------
 * Single client-side entry point for requesting a magic link email.
 *
 * Firebase's signInWithEmailLink requires the same email at completion time,
 * so this helper stores it in localStorage (PENDING_EMAIL_KEY) before the
 * request — /login reads it back when the user returns on the same device.
 * Cross-device clicks fall back to an email prompt on /login.
 *
 * Throws on failure; callers own their error UI.
 *
 * One job: request a magic link and remember who it was for.
 */

import { PENDING_EMAIL_KEY } from '@/lib/firebaseClient';

export async function requestMagicLink(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PENDING_EMAIL_KEY, email);
  }

  const res = await fetch('/api/auth/request', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
