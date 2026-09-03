# Getting started

Ariadne / Knox Index API. This page takes you from nothing to an authenticated
admin request. Read `usage-policy.md` before you start sending traffic.

## 1. Base URL

| Environment | Base URL |
|---|---|
| Production | `https://index.knox.digital` |
| Local Expo dev server | `http://localhost:8081` |

All endpoints are prefixed `/api`. Every route is served by a single Vercel
catch-all function (`api/[...all].ts`, 30s max duration), except
`/api/cover/{postId}`, which is a native Vercel Node function (15s).

## 2. First request, no auth needed

Several read endpoints are unauthenticated. Start here to confirm connectivity:

```bash
curl -s 'https://index.knox.digital/api/posts?limit=5&sortKey=views' | jq
```

Other unauthenticated reads:

| Endpoint | Returns |
|---|---|
| `GET /api/ariadne` | Full dashboard payload: all gated accounts, global totals, lifetime top post |
| `GET /api/posts` | Paginated, filterable post feed |
| `GET /api/account` | One account profile, rankings, full post history |
| `GET /api/leagues` | League table rankings |
| `GET /api/benchmarks` | Benchmark aggregates |
| `GET /api/cover/{postId}` | Post cover JPEG proxy |

Two points that catch people out:

- Invalid filter values are silently ignored rather than returning 400. A
  malformed `since` or an unknown `sortKey` falls back to the default, so a
  200 does not prove your query was understood
- `total` in the `/api/posts` response is only computed on the first page
  (`offset=0`) and is `null` on every subsequent page. Use `hasMore` to page

## 3. Authenticating

Authentication is a Firebase magic link exchanged for a session cookie. There
is no API key. Three steps.

### Step 1: request a magic link

```bash
curl -s -X POST 'https://index.knox.digital/api/auth/request' \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com"}'
```

Always returns 200 for a valid email address whether or not an account exists,
so it cannot be used to enumerate users. The email arrives from
hello@knoxdigi.com and lands on `/login`.

### Step 2: turn the link into a Firebase ID token

This step cannot be done with curl. The link must be completed by the Firebase
client SDK, which returns an ID token. Use the client config supplied to you:

```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_APP_ID
```

Minimal browser example:

```js
import { initializeApp } from 'firebase/app';
import { getAuth, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';

const auth = getAuth(initializeApp(firebaseConfig));

if (isSignInWithEmailLink(auth, window.location.href)) {
  const cred = await signInWithEmailLink(auth, email, window.location.href);
  const idToken = await cred.user.getIdToken();
  console.log(idToken);
}
```

### Step 3: exchange the ID token for a session cookie

```bash
curl -s -X POST 'https://index.knox.digital/api/auth/session' \
  -H 'Content-Type: application/json' \
  -c cookies.txt \
  -d '{"idToken":"<paste the token from step 2>"}'
```

Constraints, all of which return 401 rather than a descriptive error:

- The token must be under 5 minutes old, measured on the `auth_time` claim.
  Copy and paste quickly, or script steps 2 and 3 together
- It must carry an email claim
- It must verify against the project

On success you get `{ ok: true, email, profiled }` and a `Set-Cookie` header
for `tki_auth`: httpOnly, SameSite=Lax, Secure in production, 14 day lifetime.
Verified with revocation checking on every request.

### Step 4: use the session

```bash
curl -s 'https://index.knox.digital/api/auth/me' -b cookies.txt
```

Session-protected endpoints include `/api/auth/me`, `/api/account`,
`/api/preferences`, `/api/brief` and `/api/briefs`.

To end a session:

```bash
curl -s -X POST 'https://index.knox.digital/api/auth/logout' -b cookies.txt
```

Logout revokes all Firebase refresh tokens for the uid, so every session for
that user dies, not just the one you are holding.

## 4. Admin endpoints

Admin routes operate on the ungated BigQuery base tables and include writes.
Two conditions must both hold:

1. A valid `tki_auth` session cookie, obtained exactly as above
2. The session email appears in the server's `ADMIN_EMAILS` allowlist

The allowlist is comma-separated, trimmed and compared case-insensitively, and
fails closed: if it is unset, nobody is an admin. Ask Knox Digital to add your
address. It must be an address you can receive the magic link at, since the
check is against the signed-in session, not a header you can set.

Failure returns `403 {"error":"Forbidden"}`. That is indistinguishable from
being signed out, so check `GET /api/admin/me` first:

```bash
curl -s 'https://index.knox.digital/api/admin/me' -b cookies.txt
```

| Endpoint | Method | Effect |
|---|---|---|
| `/api/admin/me` | GET | Is this session an admin? UI hint only |
| `/api/admin/accounts` | GET | List all accounts, ungated, with types |
| `/api/admin/accounts` | POST | Create a tracked account |
| `/api/admin/accounts/{id}` | PATCH | Partially update an account |
| `/api/admin/account-types` | GET | List account types |
| `/api/admin/account-types/{id}` | PATCH | Rename an account type |
| `/api/admin/account-types/{id}` | DELETE | Delete an account type |
| `/api/admin/post-summary` | POST | Overwrite a post's `videoSummary` |

These are destructive. There is no staging environment and no soft delete.
Deleting an account type or overwriting a summary changes production data
immediately. Read `usage-policy.md` section on admin conduct before writing.

## 5. Errors

Expo routes return JSON of the shape:

```json
{ "error": "Human-readable label", "detail": "optional" }
```

`detail`, when present, is always one of exactly three redacted strings:

- `Authentication error contacting upstream service`
- `Upstream service unreachable`
- `Internal server error`

Raw upstream errors are never leaked, so `detail` tells you the class of
failure and nothing more. The `/api/cover/*` and `/api/mp/*` proxies return
plain-text bodies instead of JSON.

## 6. Browser calls and CORS

CORS is a browser rule. If you are calling from server-side code, curl or
Postman, none of this applies to you and every endpoint works.

If you are calling from browser JavaScript, your origin must be on the
allowlist. The API reads `CORS_ALLOWED_ORIGINS` and responds to allowlisted
origins with `Access-Control-Allow-Origin: <your origin>` and
`Access-Control-Allow-Credentials: true`, which means the session cookie
travels and authenticated calls work. The cookie is `SameSite=None; Secure` in
production for this reason. Preflight `OPTIONS` is answered directly.

To get your origin added, email hello@knoxdigi.com with the exact scheme and
host, for example `https://app.example.com`. No trailing slash, no path. The
allowlist is deliberately narrow because widening it widens CSRF exposure.

Three caveats:

- The allowlist is applied by the Vercel entry point, which the local Expo dev
  server does not use. Cross-origin browser calls against
  `http://localhost:8081` will fail even though the same call succeeds against
  production. Use curl locally, or run your client on the same origin
- `/api/cover/*` and `/api/mp/*` are unauthenticated media proxies and set
  `Access-Control-Allow-Origin: *`. They work from anywhere
- The 'Try it' button in these docs routes through Scalar's proxy, so the
  request does not come from your browser and carries no cookie. Unauthenticated
  endpoints work; authenticated ones do not. Use curl for anything behind a
  session

## 7. Data gating

Public reads of accounts and posts go through the derived tables `ACCOUNT_WEB`
and `POST_WEB`, which restrict rows to accounts joined to `account_x_dashboard`
with `dashboardId = 1`. The handle `ukgov` is additionally hidden from all
public reads. Admin routes bypass this and see everything, so figures from
admin endpoints will not match public ones.

Media URLs (`avatarUrl`, `coverJpeg`, `videoMp4`) are Google Cloud Storage
signed URLs re-signed at read time with a default 1 hour TTL. Do not cache or
store them; re-fetch the parent resource instead.

## 8. Reference

- `openapi.yaml` for the full endpoint contract, all 25 routes
- `database.md` for the BigQuery schema behind the API
- `usage-policy.md` for limits and acceptable use

Support: hello@knoxdigi.com
