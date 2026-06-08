/**
 * app/api/auth/me+api.ts
 * -----------------------
 * GET /api/auth/me
 *
 * Reads the session cookie and returns the current user's email.
 * Returns 401 if the cookie is absent, expired, or tampered.
 *
 * Used by the client-side useAuth hook on every page load to
 * hydrate auth state without relying on localStorage alone.
 */

import { verifySessionCookie, refreshSessionCookie } from '@/lib/auth';

export async function GET(request: Request): Promise<Response> {
  const cookieHeader = request.headers.get('Cookie');
  const email        = verifySessionCookie(cookieHeader);

  if (!email) {
    return Response.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  return Response.json(
    { email },
    {
      headers: {
        // Rolling session: slide the 30-day window forward on every visit so
        // active users never get logged out.
        'Set-Cookie':    refreshSessionCookie(email),
        // No caching — the response carries a fresh Set-Cookie each time, and
        // a cached 200 could otherwise mask a server-side session expiry.
        'Cache-Control': 'no-store',
      },
    }
  );
}
