# Usage policy

Applies to all access to the Ariadne / Knox Index API. By using the API you
accept these terms. Knox Digital may revoke access at any time.

Status note: the limits below are a contract, but enforcement is not yet
implemented server-side. There is currently no rate limiting. Treat the limits
as binding regardless. Enforcement is a scheduled follow-up, and clients that
exceed these figures once it lands will start receiving 429 responses.

## 1. Rate limits

Per credential, or per IP address for unauthenticated access.

| Endpoint group | Limit | Burst |
|---|---|---|
| Public reads (`/api/posts`, `/api/account`, `/api/leagues`, `/api/benchmarks`) | 60 req/min | 20 |
| Dashboard payload (`/api/ariadne`) | 10 req/min | 5 |
| AI generation (`/api/brief`, `/api/briefs`, `/api/summarise`) | 10 req/min | 3 |
| Auth (`/api/auth/request`) | 5 req/min | 5 |
| Admin (`/api/admin/*`) | 30 req/min | 10 |
| Media proxy (`/api/cover/*`, `/api/mp/*`) | 300 req/min | 100 |

Daily ceiling: 20,000 requests per credential per 24 hours.

`/api/ariadne` is deliberately low. It runs a multi-query BigQuery aggregation
across every tracked account and is the most expensive route in the system.
The AI routes are low because they invoke Gemini per call and cost money on
every request.

## 2. Caching

Respect the `Cache-Control` headers we send. Most read endpoints return
`private, max-age=1800`, meaning a 30 minute window. Polling faster than that
returns identical data and counts against your limit for nothing.

- Do not poll `/api/ariadne` more than twice an hour
- Underlying data refreshes on a daily pipeline, so sub-daily polling of post
  metrics gains you nothing
- Cache responses on your side. Do not cache signed media URLs, which expire
  after 1 hour; re-fetch the parent resource

## 3. Acceptable use

Permitted:

- Building applications, dashboards and analyses that consume the API
- Storing derived aggregates and analysis outputs
- Internal reporting and research

Not permitted:

- Bulk extraction of the dataset, whether by pagination sweeps, parallel
  workers or distributed clients. Systematic enumeration intended to
  reconstruct the underlying tables is prohibited regardless of request rate
- Redistribution or resale of raw API responses, in whole or in substantial
  part, to third parties
- Reverse engineering the Knox Factor or any other proprietary score
- Presenting Knox Index data as your own, or as an official record of the
  accounts covered
- Sharing credentials, session cookies or magic links with anyone outside the
  team the access was granted to
- Circumventing dashboard gating, the `ukgov` exclusion, or any access control,
  including via the media proxies
- Proxying API calls through a third-party service in order to bypass the CORS
  allowlist. Request that your origin be allowlisted instead
- Automated traffic that degrades service for other users

## 4. Attribution

Public-facing use of Knox Index data requires visible attribution to
The Knox Index, with a link to https://index.knox.digital. Scores including the
Knox Factor must be labelled as Knox Index figures and not restated as neutral
or official measures.

## 5. Data handling

The dataset covers TikTok activity by UK political accounts. It concerns
identifiable public figures and their published content.

- Use the data for analysis of public political communication, not for
  profiling, targeting or harassment of individuals
- Do not combine it with other datasets in order to identify or track private
  individuals appearing in the content
- Post content, cover images and video remain the property of their original
  creators. The API provides access, not a licence to republish
- If you cache personal data, you are the controller of that copy and
  responsible for your own UK GDPR compliance, including retention limits and
  deletion requests

## 6. Admin access conduct

Admin credentials operate on ungated production tables and permit writes.
There is no staging environment, no soft delete and no undo.

- Use read endpoints to explore. Do not test write endpoints against
  production to see what happens
- Do not delete account types or overwrite post summaries unless the change
  has been agreed with Knox Digital
- Admin access is granted to named individuals via the `ADMIN_EMAILS`
  allowlist. Do not share a session with a colleague; ask for them to be added
- Report anything you break immediately to hello@knoxdigi.com. Fixing a
  reported mistake is straightforward; finding an unreported one is not

## 7. Availability

No uptime commitment is offered. The API runs on serverless functions with a
30 second execution ceiling (15 seconds on `/api/cover/*`). Long-running
BigQuery aggregations can time out under load.

- Handle 5xx responses and timeouts with exponential backoff, minimum 1 second
  initial delay
- Do not retry 4xx responses. They will fail identically
- Do not retry more than 3 times

Breaking changes may be made without notice while the API is at version 0.x.

## 8. Security

- Never commit credentials, `.env` files or session cookies to a repository
- The session cookie is `SameSite=None; Secure` in production, which means the
  browser's built-in CSRF protection does not apply to it. The CORS allowlist is
  what stands in its place. Do not ask for a wildcard origin, and do not host
  allowlisted origins on shared or user-controlled domains
- The `INTERNAL_API_TOKEN` bearer used by `/api/sign-coverjpeg` is a
  machine-to-machine secret and is not issued to developers. If you have been
  given it, you have been given it in error; report that
- Report suspected vulnerabilities privately to hello@knoxdigi.com. Do not
  test them against production or disclose them publicly first

## 9. Revocation

Access may be withdrawn without notice for breach of this policy, for security
reasons, or at Knox Digital's discretion. On revocation, delete any cached
copies of API data on request.

Questions: hello@knoxdigi.com
