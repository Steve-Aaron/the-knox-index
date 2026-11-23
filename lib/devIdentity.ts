/**
 * lib/devIdentity.ts
 * -------------------
 * A pretend signed-in user, for local development only. Server-side only.
 *
 * Firebase sign-in needs a magic link delivered by email, which is a poor fit
 * for `localhost`: you cannot see a gated dashboard, the access request form,
 * or the admin panel without going through a real inbox first.
 *
 * `DEV_TENANT_EMAIL=someone@example.com` makes the server treat requests as
 * coming from that address. Everything downstream then runs FOR REAL — the
 * domain allowlist, the tenant_access lookup, the admin allowlist — so what
 * you see locally is the behaviour you get in production, not a skipped gate:
 *
 *   DEV_TENANT_EMAIL=you@knoxdigi.com    → admitted by domain, dashboard opens
 *   DEV_TENANT_EMAIL=someone@client.com  → the request form, then pending
 *   (also on ADMIN_EMAILS)               → the admin panel opens too
 *
 * The blunter `DEV_TENANT_BYPASS=1` skips the access decision entirely and is
 * only for looking at the dashboard itself.
 *
 * Both are inert in production: the check is on NODE_ENV, not on the flag, so
 * setting the variable on a production deployment does nothing.
 *
 * One job: the development stand-in for a session cookie.
 */

import { PREVIEW_FULL_ACCESS_COOKIE } from '@/lib/devPreview';

export function isDevEnvironment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/** The pretend signed-in address, or null when unset or in production. */
export function devSessionEmail(): string | null {
  if (!isDevEnvironment()) return null;
  const email = (process.env.DEV_TENANT_EMAIL ?? '').trim().toLowerCase();
  return email.includes('@') ? email : null;
}

/** True when the access decision itself should be skipped (dev only). */
export function devAccessBypass(): boolean {
  return isDevEnvironment() && process.env.DEV_TENANT_BYPASS === '1';
}

/**
 * Full access on a Vercel PREVIEW deployment, for reviewing the dev branch:
 * the reviewer turns on 'Full' in the preview bar, which sets a cookie. Only
 * honoured when Vercel reports the build as a preview (VERCEL_ENV), so the
 * cookie does nothing on the live site. Preview addresses sit behind Vercel's
 * own login, so only people on the Vercel team can reach them.
 */
export function previewFullAccess(cookieHeader: string | null): boolean {
  if (process.env.VERCEL_ENV !== 'preview' || !cookieHeader) return false;
  return cookieHeader.split(';').some(c => c.trim() === `${PREVIEW_FULL_ACCESS_COOKIE}=1`);
}
