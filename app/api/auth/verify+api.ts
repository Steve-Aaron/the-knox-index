/**
 * app/api/auth/verify+api.ts
 * ---------------------------
 * GET /api/auth/verify?token=<magic-token>
 *
 * Validates the magic link token, sets a 30-day httpOnly session cookie,
 * and redirects the user to the dashboard root.
 *
 * On failure: redirects to /?auth=error so the client can show a message.
 */

import { verifyMagicToken, createSessionCookie } from '@/lib/auth';

export async function GET(request: Request): Promise<Response> {
  const url   = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';

  const email = verifyMagicToken(token);

  if (!email) {
    // Expired or tampered — redirect with an error hint
    const base = `${url.protocol}//${url.host}`;
    return Response.redirect(`${base}/?auth=error`, 302);
  }

  const base      = `${url.protocol}//${url.host}`;
  const setCookie = createSessionCookie(email);

  return new Response(null, {
    status: 302,
    headers: {
      'Location':   base,
      'Set-Cookie': setCookie,
    },
  });
}
