/**
 * app/api/auth/session+api.ts
 * ----------------------------
 * POST /api/auth/session
 * Body: { idToken: string }
 *
 * Exchanges a freshly-minted Firebase ID token (from magic link or Google
 * popup sign-in) for a 14-day httpOnly session cookie. Tokens older than
 * five minutes are rejected — a leaked stale token must not become a
 * long-lived session.
 *
 * One job: bridge client-side Firebase sign-in to the cookie session.
 */

import { createSessionFromIdToken } from '@/lib/firebaseAdmin';

export async function POST(request: Request): Promise<Response> {
  let body: any;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const idToken: string = body?.idToken ?? '';
  if (!idToken) {
    return Response.json({ error: 'Missing idToken' }, { status: 400 });
  }

  try {
    const { setCookie, user } = await createSessionFromIdToken(idToken);
    return Response.json(
      { ok: true, email: user.email, profiled: user.profiled },
      {
        headers: {
          'Set-Cookie':    setCookie,
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    console.error('[/api/auth/session] Session mint failed', err?.message ?? err);
    return Response.json({ error: 'Invalid or expired sign-in. Please try again.' }, { status: 401 });
  }
}
