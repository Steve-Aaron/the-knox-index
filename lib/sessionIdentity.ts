/**
 * lib/sessionIdentity.ts
 * -----------------------
 * The signed-in caller behind a request: their Firebase uid and email. One
 * place so the gate, the access API and the admin API all resolve identity
 * the same way, including the local-dev stand-in.
 *
 * The access store keys on uid; the domain rule needs the email. Both come
 * from here, or null when no one is signed in.
 *
 * One job: turn a request into the signed-in identity, or null.
 */

import { verifySession } from '@/lib/firebaseAdmin';
import { devSessionEmail } from '@/lib/devIdentity';
import type { AccessIdentity } from '@/lib/tenantAccess';

export async function identityFromRequest(request: Request): Promise<AccessIdentity | null> {
  try {
    const user = await verifySession(request.headers.get('Cookie'));
    if (user?.uid && user.email) return { uid: user.uid, email: user.email };
  } catch { /* no or invalid cookie */ }

  // Development only: DEV_TENANT_EMAIL stands in for a session cookie on
  // localhost. A deterministic dev uid keeps its access doc stable across
  // requests. The access rules still run in full (lib/devIdentity.ts).
  const devEmail = devSessionEmail();
  if (devEmail) return { uid: `dev:${devEmail}`, email: devEmail };

  return null;
}
