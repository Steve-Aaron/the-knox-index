/**
 * app/api/auth/logout+api.ts
 * ---------------------------
 * POST /api/auth/logout
 *
 * Revokes the user's Firebase refresh tokens (kills every session cookie,
 * everywhere) and clears the cookie on this browser. Safe to call while
 * unauthenticated — always returns 200 with a cleared cookie.
 *
 * One job: end the session, definitively.
 */

import { verifySession, revokeSessions, clearSessionCookie } from '@/lib/firebaseAdmin';

export async function POST(request: Request): Promise<Response> {
  const user = await verifySession(request.headers.get('Cookie'));

  if (user) {
    try {
      await revokeSessions(user.uid);
    } catch (err: any) {
      // Still clear the cookie — local logout must not fail on upstream errors.
      console.error('[/api/auth/logout] Revocation failed', err?.message ?? err);
    }
  }

  return Response.json(
    { ok: true },
    {
      headers: {
        'Set-Cookie':    clearSessionCookie(),
        'Cache-Control': 'no-store',
      },
    }
  );
}
