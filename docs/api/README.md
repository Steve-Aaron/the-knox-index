# Ariadne API documentation

Developer-facing documentation for the Ariadne / Knox Index API, deployed as its
own Vercel project so it can never ship with the live app.

## Sources — edit these

| File | Contents |
|---|---|
| `openapi.yaml` | The API contract. OpenAPI 3.0, 25 routes. Single source of truth |
| `getting-started.md` | Developer onboarding: base URL, first request, auth flow, admin access |
| `usage-policy.md` | Rate limits, acceptable use, data handling, revocation |
| `database.md` | BigQuery schema and data layer reference |

## Generated — do not hand-edit

Run `npm run docs:build` from the repo root after changing any source above.

| File | Built from |
|---|---|
| `ariadne-api-docs.html` | `openapi.yaml`, embedded, rendered by Scalar |
| `getting-started.html` | `getting-started.md`, rendered client-side by marked |
| `usage-policy.html` | `usage-policy.md`, rendered client-side by marked |
| `index.html` | Redirect to the API reference so the domain root is not a 404 |

All three pages share a nav bar and carry `noindex, nofollow`. Both CDN scripts
come from jsdelivr; if the CDN is blocked, the markdown pages degrade to plain
text rather than rendering blank.

## Keeping the spec honest

`openapi.yaml` is hand-maintained and can drift from the handlers in `app/api/`.
When adding or changing a route, update the spec in the same commit. To check
current state, compare the route files against the spec paths:

```
find app/api api -name '*.ts' | sort
grep -oE '^  /api[^:]*' docs/api/openapi.yaml | sort
```

## Deployment

Deployed as its own Vercel project (`knox-index-api-docs`) at
`docs.index.knox.digital`, entirely separate from the `theknoxindex` app project.
The app's build output is `dist/client` and never includes this folder.

To deploy manually from this folder:

```
npx vercel deploy --prod
```

`vercel.json` here sets `cleanUrls` and the noindex headers for that project.

## Related configuration

The API's CORS allowlist (`CORS_ALLOWED_ORIGINS`) must include this docs origin
for the Scalar 'Try it' feature to reach the API from a browser. Note that
Scalar's proxy strips cookies, so authenticated 'Try it' will not work
regardless. See `getting-started.md` section 6.
