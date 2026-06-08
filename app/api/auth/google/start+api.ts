/**
 * app/api/auth/google/start+api.ts
 * ---------------------------------
 * GET /api/auth/google/start
 *
 * Kicks off the Google OAuth 2.0 authorization-code flow:
 *   1. Generates a one-time `state` nonce + binds it to a short-lived cookie
 *   2. Redirects the browser to Google's consent screen
 *
 * The browser comes back to /api/auth/google/callback with a `code`.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID      — OAuth 2.0 client ID from Google Cloud Console
 *   (GOOGLE_CLIENT_SECRET is only needed by the callback)
 *
 * The redirect URI is derived from the request host, so it works in local
 * dev and on Vercel without configuration — but the exact URI
 * (e.g. https://your-domain/api/auth/google/callback) must be registered as
 * an "Authorized redirect URI" in the Google Cloud OAuth client.
 */

import { createOAuthState } from '@/lib/auth';

const GOOGLE_AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';

export async function GET(request: Request): Promise<Response> {
  const url  = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;

  if (!GOOGLE_CLIENT_ID) {
    console.error('[/api/auth/google/start] GOOGLE_CLIENT_ID not set');
    return Response.redirect(`${base}/?auth=google_unconfigured`, 302);
  }

  const { state, cookie } = createOAuthState();

  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  `${base}/api/auth/google/callback`,
    response_type: 'code',
    scope:         'openid email',
    state,
    access_type:   'online',
    prompt:        'select_account',
  });

  return new Response(null, {
    status: 302,
    headers: {
      'Location':   `${GOOGLE_AUTH_URL}?${params.toString()}`,
      'Set-Cookie': cookie,
    },
  });
}
