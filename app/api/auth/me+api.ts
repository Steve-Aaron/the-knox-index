/**
 * app/api/auth/me+api.ts
 * -----------------------
 * GET /api/auth/me
 *
 * Verifies the Firebase session cookie (including server-side revocation
 * check) and returns the current user's email. 401 if absent, expired,
 * tampered, or revoked.
 *
 * Rolling sessions are handled client-side: on a 401, useAuth silently
 * re-mints the cookie via /api/auth/session if the Firebase client SDK
 * still holds a signed-in user.
 */

import { verifySession } from '@/lib/firebaseAdmin';

export async function GET(request: Request): Promise<Response> {
  const user = await verifySession(request.headers.get('Cookie'));

  if (!user) {
    return Response.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  return Response.json(
    { email: user.email, profiled: user.profiled },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
