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
 * In development only, DEV_TENANT_EMAIL can stand in for the session cookie
 * (lib/devIdentity.ts). The allowlist check is unchanged, so it cannot admit
 * an address that a real sign-in would not.
 *
 * One job: decide whether a request may use the admin API.
 */

import { verifySession } from '@/lib/firebaseAdmin';
import { devSessionEmail } from '@/lib/devIdentity';

export async function isAdminRequest(request: Request): Promise<boolean> {
  const allowlist = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length === 0) return false;

  try {
    const user = await verifySession(request.headers.get('Cookie'));
    if (user) return allowlist.includes(user.email.toLowerCase());
  } catch { /* no or invalid cookie */ }

  // Development only: DEV_TENANT_EMAIL stands in for the cookie so the admin
  // panel can be opened on localhost. The ADMIN_EMAILS allowlist still decides,
  // so this grants nothing that a real sign-in would not.
  const devEmail = devSessionEmail();
  return devEmail !== null && allowlist.includes(devEmail);
}
