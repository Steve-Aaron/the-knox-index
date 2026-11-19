/**
 * app/api/auth/access-link+api.ts
 * --------------------------------
 * POST /api/auth/access-link   Body: { token }
 *   → { customToken, tenant }   (200)
 *   → { error }                 (400 bad or expired link, 403 no longer approved)
 *
 * The button in a waitlist approval email lands on /login?access=<token>.
 * The page posts the token here; we check it (lib/accessLink.ts), re-check
 * that the person is still approved, and hand back a Firebase custom token.
 * The client signs in with it and mints the usual session cookie.
 *
 * One job: swap an approval-email token for a Firebase sign-in.
 */

import { verifyAccessToken } from '@/lib/accessLink';
import { customTokenForEmail } from '@/lib/firebaseAdmin';
import { decideAccess } from '@/lib/tenantAccess';
import { tenantById } from '@/lib/tenants';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: Request): Promise<Response> {
  let body: any = {};
  try { body = await request.json(); } catch { /* handled below */ }

  const claims = verifyAccessToken(String(body?.token ?? ''));
  if (!claims) {
    return Response.json({ error: 'This link is invalid or has expired' }, { status: 400, headers: NO_STORE });
  }

  const tenant = tenantById(claims.tenantId);
  try {
    // The email may be old: a refusal since then must win.
    const decision = await decideAccess(claims.email, tenant);
    if (!decision.allowed) {
      return Response.json({ error: 'Access is no longer approved', tenant: tenant.id }, { status: 403, headers: NO_STORE });
    }
    const customToken = await customTokenForEmail(claims.email);
    return Response.json({ customToken, tenant: tenant.id }, { headers: NO_STORE });
  } catch (err: any) {
    console.error('[/api/auth/access-link] failed:', err?.message ?? err);
    return Response.json({ error: 'Sign-in failed' }, { status: 500, headers: NO_STORE });
  }
}
