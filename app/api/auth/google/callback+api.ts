/**
 * app/api/auth/google/callback+api.ts
 * ------------------------------------
 * GET /api/auth/google/callback?code=...&state=...
 *
 * Completes the Google OAuth 2.0 flow:
 *   1. Verifies the `state` nonce against the cookie set in /start (CSRF)
 *   2. Exchanges the authorization `code` for tokens
 *   3. Fetches the user's verified email from Google's userinfo endpoint
 *   4. Issues the same 30-day session cookie used by the magic-link flow
 *   5. Best-effort upserts the contact into Brevo, then redirects home
 *
 * On any failure the user is redirected to /?auth=error so the client can
 * surface a friendly message — Google internals are never exposed.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 */

import {
  createSessionCookie,
  verifyOAuthState,
  clearOAuthState,
} from '@/lib/auth';

const GOOGLE_TOKEN_URL    = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const CLIENT_ID           = process.env.GOOGLE_CLIENT_ID ?? '';
const CLIENT_SECRET       = process.env.GOOGLE_CLIENT_SECRET ?? '';
const BREVO_API_KEY       = process.env.BREVO_API_KEY ?? '';
const BREVO_BASE          = 'https://api.brevo.com/v3';

/** Redirect helper that always clears the one-time state cookie. */
function redirect(base: string, path: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      'Location':   `${base}${path}`,
      'Set-Cookie': clearOAuthState(),
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const url  = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('[/api/auth/google/callback] Google OAuth env vars not set');
    return redirect(base, '/?auth=google_unconfigured');
  }

  const code        = url.searchParams.get('code');
  const stateParam  = url.searchParams.get('state');
  const cookieHdr   = request.headers.get('Cookie');

  // The user may have cancelled at Google's consent screen.
  if (url.searchParams.get('error')) {
    return redirect(base, '/?auth=cancelled');
  }

  // CSRF: the state must match the cookie we set in /start.
  if (!verifyOAuthState(cookieHdr, stateParam)) {
    console.error('[/api/auth/google/callback] State mismatch');
    return redirect(base, '/?auth=error');
  }

  if (!code) {
    return redirect(base, '/?auth=error');
  }

  try {
    // 1. Exchange the authorization code for tokens.
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri:  `${base}/api/auth/google/callback`,
        grant_type:    'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text().catch(() => '');
      console.error('[/api/auth/google/callback] Token exchange failed', tokenRes.status, detail.slice(0, 300));
      return redirect(base, '/?auth=error');
    }

    const tokens: { access_token?: string } = await tokenRes.json();
    if (!tokens.access_token) {
      console.error('[/api/auth/google/callback] No access_token in token response');
      return redirect(base, '/?auth=error');
    }

    // 2. Fetch the verified email from the userinfo endpoint.
    const infoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!infoRes.ok) {
      console.error('[/api/auth/google/callback] userinfo failed', infoRes.status);
      return redirect(base, '/?auth=error');
    }

    const info: { email?: string; email_verified?: boolean } = await infoRes.json();
    const email = (info.email ?? '').trim().toLowerCase();

    // Only accept Google-verified emails.
    if (!email || info.email_verified === false) {
      console.error('[/api/auth/google/callback] Missing or unverified email');
      return redirect(base, '/?auth=error');
    }

    // 3. Best-effort Brevo upsert (never blocks login).
    if (BREVO_API_KEY) {
      fetch(`${BREVO_BASE}/contacts`, {
        method:  'POST',
        headers: {
          'api-key':      BREVO_API_KEY,
          'Content-Type': 'application/json',
          'Accept':       'application/json',
        },
        body: JSON.stringify({
          email,
          updateEnabled: true,
          attributes:    { SOURCE: 'TKI Google sign-in' },
        }),
      }).catch((e: any) => console.error('[/api/auth/google/callback] Brevo upsert threw', e?.message ?? e));
    }

    // 4. Issue the session cookie and clear the one-time state cookie.
    // Note: two Set-Cookie values must be sent as separate header entries,
    // so we build the Headers object explicitly with .append().
    const headers = new Headers();
    headers.append('Location', base);
    headers.append('Set-Cookie', createSessionCookie(email));
    headers.append('Set-Cookie', clearOAuthState());

    return new Response(null, { status: 302, headers });

  } catch (err: any) {
    console.error('[/api/auth/google/callback] Unhandled error', err?.message ?? err);
    return redirect(base, '/?auth=error');
  }
}
