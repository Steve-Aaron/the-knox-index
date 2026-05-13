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

import { verifySessionCookie } from '@/lib/auth';

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
        // Short cache — lets the browser avoid hammering this on every render
        // while still detecting a newly-set cookie within 30 seconds.
        'Cache-Control': 'private, max-age=30',
      },
    }
  );
}
