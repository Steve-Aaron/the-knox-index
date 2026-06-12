/**
 * lib/adminAuth.ts
 * -----------------
 * Server-side admin check for the /api/admin/* routes.
 *
 * A request is admin when BOTH are true:
 *   1. It carries a valid Firebase session cookie (signed in, not revoked)
 *   2. That session's email is on the ADMIN_EMAILS allowlist
 *      (comma-separated env var, e.g. "steve@knoxdigi.com")
 *
 * Fails closed: no ADMIN_EMAILS set → nobody is admin. The old admin_panel=1
 * cookie is ignored — anyone could set that themselves in DevTools.
 *
 * One job: decide whether a request may use the admin API.
 */

import { verifySession } from '@/lib/firebaseAdmin';

export async function isAdminRequest(request: Request): Promise<boolean> {
  const allowlist = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length === 0) return false;

  try {
    const user = await verifySession(request.headers.get('Cookie'));
    return !!user && allowlist.includes(user.email.toLowerCase());
  } catch {
    return false;
  }
}
