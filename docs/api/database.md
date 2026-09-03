# Ariadne — Database and Data Layer Reference

Companion to `openapi.yaml`. This document describes every data store, table, column and relationship behind the API.

## 1. Overview of stores

| Store | Purpose | Configured in |
|---|---|---|
| BigQuery `project-ariadne.ariadne_tiktok_demo` | The analytics warehouse: accounts, posts, metrics, tags, briefings | `lib/bigquery.ts`, `.env.example` |
| Google Cloud Storage | Post cover JPEGs, post MP4s, account avatars | `lib/gcs.ts`, `api/cover/[postId].ts` |
| Firebase Authentication | Identity only (magic link / Google). No Firestore is used anywhere | `lib/firebaseAdmin.ts`, `lib/firebaseClient.ts` |
| Brevo (external SaaS) | Canonical email subscription state: contact attributes + list membership | `lib/brevo.ts` |

Note on Firestore: the `firebase` and `firebase-admin` packages are installed, but no application code calls `getFirestore`, `collection()`, `doc()` or any Firestore API. Firebase is used exclusively for authentication.

## 2. BigQuery configuration

```
Project:  BIGQUERY_PROJECT_ID  (default: project-ariadne)
Dataset:  BIGQUERY_DATASET     (default: ariadne_tiktok_demo)
Location: EU (multi-region), set on every query
Auth:     GOOGLE_APPLICATION_CREDENTIALS (JSON string or file path, shared with GCS)
```

All table references are built by `tableRef(t)` in `lib/bigquery.ts` as `` `project-ariadne.ariadne_tiktok_demo.<t>` ``. The cover proxy (`api/cover/[postId].ts`) and the n8n email workflow (`email/n8n/workflow.js`) each re-declare the same project and dataset inline.

The schema itself is managed externally by the n8n ingest pipeline; no DDL lives in this repo. No partitioning or clustering configuration is visible from the code. The natural partition candidates are `post.postDate` (every range filter keys on it) and `accountMetrics.dateUpdated` (the snapshot key).

## 3. The dashboard gate (`ACCOUNT_WEB` / `POST_WEB`)

Every public website read goes through two derived-table SQL fragments defined once in `lib/bigquery.ts`, so the visibility rule lives in exactly one place. Admin routes and the ingest pipeline use the base tables directly.

`ACCOUNT_WEB` — accounts joined to dashboard 1:

```sql
(
  SELECT a.*
  FROM `…account` a
  JOIN `…account_x_dashboard` d
    ON CAST(d.accountId AS STRING) = CAST(a.id AS STRING)
  WHERE d.dashboardId = 1
)
```

`POST_WEB` — posts whose authoring account is on dashboard 1 (matched by handle, not id):

```sql
(
  SELECT p.*
  FROM `…post` p
  WHERE LTRIM(LOWER(p.profile), '@') IN (
    SELECT LTRIM(LOWER(a.profile), '@')
    FROM `…account` a
    JOIN `…account_x_dashboard` d
      ON CAST(d.accountId AS STRING) = CAST(a.id AS STRING)
    WHERE d.dashboardId = 1
  )
)
```

An additional application-level filter hides specific handles from all public reads: `HIDDEN_HANDLES = ['ukgov']` in `lib/bqQueries.ts`, applied as `LOWER(LTRIM(profile, '@')) NOT IN ('ukgov')`.

A post is considered processed and displayable only when `videoSummary IS NOT NULL`. This filter appears in the feed, top-post, benchmarks and leagues queries.

## 4. Tables

### 4.1 `account`

The master record for a tracked TikTok account (an MP, party, party leader, minister, council and so on). Written by the n8n ingest pipeline and by the admin API. The join key to `post` is the profile handle, not the id.

| Column | Type | Meaning |
|---|---|---|
| `id` | STRING or INT64 (opaque) | Primary key. Admin-created rows use `GENERATE_UUID()` as a placeholder until the n8n pipeline resolves the real TikTok id. Always compared via `CAST(... AS STRING)`. FK target for `account_x_accountType.accountId`, `account_x_dashboard.accountId` and `accountMetrics.pageId` |
| `name` | STRING | Raw TikTok username or display name. Reads prefer `COALESCE(displayName, name)` |
| `profile` | STRING | TikTok handle, e.g. `@uklabour`. The join key to `post.profile`, compared case-insensitively with the leading `@` stripped (`LTRIM(LOWER(profile), '@')`) |
| `party` | STRING | Raw party spelling (e.g. `labour`, `conservative`). Normalised to a `PartyKey` at read time; reverse-mapped for the `party` feed filter with regex-normalised comparison |
| `affiliation` | STRING | Human role string, e.g. `MP, Ashton-under-Lyne`. Feeds `Politician.role` and account-type inference |
| `displayName` | STRING, nullable | Curated display name set via the admin UI. Preferred over `name` |
| `displayJobTitle` | STRING, nullable | Curated job title, e.g. `MP for Ipswich`. Editable via admin |
| `avatar` | STRING, nullable | GCS URL for the profile photo; re-signed at read time (1 hour). Becomes `Politician.avatarUrl` |
| `totalFollowers` | INT64 | Follower count. Basis of the followers score axis and the virality denominator (`views / followers`) |
| `totalFollowing` | INT64 | Accounts this account follows |
| `isActive` | BOOL, nullable | Whether the account is actively tracked. Patchable via admin; surfaced in the admin list only |

Admin insert:

```sql
INSERT INTO `…account`
  (id, name, profile, party, affiliation, displayName, displayJobTitle)
VALUES
  (GENERATE_UUID(), @name, @profile, @party, @affiliation, @displayName, @displayJobTitle)
```

Admin-patchable columns: `name`, `displayName`, `displayJobTitle`, `party`, `affiliation`, `isActive`.

### 4.2 `post`

One row per TikTok post. `postId` is a TikTok snowflake id that exceeds `Number.MAX_SAFE_INTEGER`, so it is always handled as a string (`CAST(postId AS STRING)`) and validated as digits-only (`^\d+$`, or `^\d{1,25}$` in the cover proxy) before use.

| Column | Type | Meaning |
|---|---|---|
| `postId` | INT64 (treated as STRING) | Primary key. FK target for `post_x_style.postId` and `post_x_topic.postId` |
| `profile` | STRING | Handle of the authoring account; joins to `account.profile` (lower-cased, `@` stripped) |
| `caption` | STRING | Post caption text |
| `videoSummary` | STRING, nullable | AI-generated summary (Gemini, via n8n). `IS NOT NULL` marks the post as processed and displayable. Overwritable via `POST /api/admin/post-summary` |
| `views` | INT64 | View count |
| `likes` | INT64 | Like count |
| `comments` | INT64 | Comment count |
| `shares` | INT64 | Share count |
| `saves` | INT64 | Save (bookmark) count |
| `reposts` | INT64 | Repost count (read as `COALESCE(reposts, 0)`) |
| `postDate` | DATE | Publication date. Drives every range filter (`postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL N DAY)`). Cast to STRING at read to avoid the BQ `{value: 'YYYY-MM-DD'}` wrapper |
| `postUrl` | STRING | Direct TikTok URL |
| `coverJpeg` | STRING | GCS URL of the cover thumbnail. Object path shape: `tiktok-content-scraper/{profile}/{date}/{postId}.jpeg`. Signed at read, or streamed via `/api/cover/{postId}.jpg` |
| `videoMp4` | STRING | GCS URL of the video. Signed at read; convertible to `gs://` form for Gemini |
| `style` | STRING, nullable (legacy) | Single content-style string on the row itself. Still read by `/api/brief` and `/api/summarise`; coexists with the normalised `style` / `post_x_style` tables |

Derived metrics used everywhere:

- Engagement rate = `(likes + comments + saves + shares) / views`
- Virality = `views / account.totalFollowers`

Caution: `post` receives streamed inserts, so BigQuery DML (e.g. the admin summary UPDATE) can fail on rows still in the streaming buffer.

```sql
UPDATE `…post` SET videoSummary = @summary WHERE CAST(postId AS STRING) = @postId
```

### 4.3 `accountMetrics`

Daily snapshot of per-account aggregates. The latest snapshot is always selected with:

```sql
LEFT JOIN (
  SELECT * FROM `…accountMetrics`
  WHERE dateUpdated = (SELECT MAX(dateUpdated) FROM `…accountMetrics`)
) m ON a.id = m.pageId
```

| Column | Type | Meaning |
|---|---|---|
| `pageId` | matches `account.id` | FK to the account |
| `dateUpdated` | DATE/TIMESTAMP | Snapshot date; `MAX(dateUpdated)` selects the newest. The brief generator uses the newest row on or before yesterday |
| `totalPosts` | INT64 | Lifetime post count (drives the low-volume penalty and average views) |
| `totalLikes` | INT64 | Lifetime likes |
| `totalViews` | INT64 | Lifetime views (`Politician.totals.views`; average-views basis) |
| `totalComments` | INT64 | Lifetime comments |
| `totalShares` | INT64 | Lifetime shares |
| `totalSaves` | INT64 | Lifetime saves |
| `postsToday` | INT64 | Posts in the last day |
| `viewsToday` | INT64 | Views in the last day (surfaced as `views24h`) |
| `likesToday` | INT64 | Likes in the last day |
| `commentsToday` | INT64 | Comments in the last day |
| `savesToday` | INT64 | Saves in the last day |
| `followerChange` | INT64, nullable | Daily follower delta (positive = growth) |
| `totalFollowers` | INT64 | Follower count as of the snapshot (the accounts list prefers `account.totalFollowers`) |

Fields such as `postsThisWeek`, `postsInRange` and `viewsInRange` in API responses are not columns; they are computed live with `COUNT(*)` / `SUM()` subqueries over `post` grouped by profile.

### 4.4 `accountType`

Small lookup of canonical role names.

| Column | Type | Meaning |
|---|---|---|
| `id` | INT64 | Primary key. No auto-increment in BigQuery; new ids come from `SELECT COALESCE(MAX(id), 0) + 1` |
| `name` | STRING | Snake_case role name: `member_of_parliament`, `political_party`, `party_leader`, `prime_minister`, `cabinet_minister`, `shadow_cabinet_minister`. (`council` and `other` exist only as client-side inference fallbacks) |

### 4.5 `account_x_accountType` (junction)

Many-to-many between accounts and types — one account can hold several roles (a party leader who is also an MP).

| Column | Type | Meaning |
|---|---|---|
| `accountId` | matches `account.id` | FK to account |
| `accountTypeId` | INT64 | FK to `accountType.id` |

Read as CSV via `STRING_AGG(atype.name, ',' ORDER BY atype.id)`. Admin updates re-sync the junction wholesale: delete all rows for the account, then insert the new set.

### 4.6 `account_x_dashboard` (junction — the visibility gate)

Controls which accounts appear on the public website. Managed manually at source (a Google Sheet feeding the pipeline).

| Column | Type | Meaning |
|---|---|---|
| `accountId` | STRING | FK to account. Note: `account.id` is INT64, so joins require `CAST(a.id AS STRING) = d.accountId` (schema verified live 2026-07-24) |
| `dashboardId` | INT64 | FK to `dashboard.id`. The public site surfaces only `dashboardId = 1` |

Referenced only inside the `ACCOUNT_WEB` / `POST_WEB` fragments.

### 4.6a `dashboard` (lookup)

Dashboard definitions. Never read by the app (which hardcodes `dashboardId = 1`), but present in the warehouse. Schema and rows verified live on 2026-07-24.

| Column | Type | Meaning |
|---|---|---|
| `id` | INT64 | Primary key. FK target of `account_x_dashboard.dashboardId` |
| `name` | STRING | Dashboard name, e.g. `The Knox Index` (id 1), `World Leaders` (id 2) |
| `isPublic` | BOOL | Whether the dashboard is publicly visible. Id 1 is TRUE, id 2 is FALSE |
| `isActive` | BOOL | Whether the dashboard is active. Id 1 is TRUE, id 2 is FALSE |
| `description` | STRING | Free-text description |

### 4.7 `style` and `post_x_style`

Normalised many-to-many content-style tagging (format of the video: talking head, b-roll and so on). Drives the Style League.

`style`:

| Column | Type | Meaning |
|---|---|---|
| `id` | INT64 | Primary key |
| `name` | STRING | Style label |

`post_x_style`:

| Column | Type | Meaning |
|---|---|---|
| `postId` | matches `post.postId` | FK to post |
| `styleId` | INT64 | FK to `style.id` |

### 4.8 `topic` and `post_x_topic`

Normalised many-to-many topic tagging (subject matter: NHS, housing and so on). Drives the Topic Cloud.

`topic`:

| Column | Type | Meaning |
|---|---|---|
| `id` | INT64 | Primary key |
| `name` | STRING | Topic label |

`post_x_topic`:

| Column | Type | Meaning |
|---|---|---|
| `postId` | matches `post.postId` | FK to post |
| `topicId` | INT64 | FK to `topic.id` |

### 4.9 `brief`

Editorial briefing rows written exclusively by the n8n workflow; the app only reads (via `GET /api/briefs`).

| Column | Type | Meaning |
|---|---|---|
| `briefDate` | DATE | Date of the briefing. Latest row selected by `ORDER BY briefDate DESC LIMIT 1` |
| `briefDailySummary` | STRING | The day's narrative summary |
| `briefWeeklySummary` | STRING | The week's narrative summary |
| `topNarrativesThisWeek` | JSON | Array of `{ headline, body }`. Read via `TO_JSON_STRING(...)` because BigQuery JSON columns arrive as strings; malformed JSON degrades to an empty array |

Read SQL:

```sql
SELECT
  FORMAT_DATE('%Y-%m-%d', briefDate) AS briefDate,
  briefDailySummary,
  briefWeeklySummary,
  TO_JSON_STRING(topNarrativesThisWeek) AS topNarrativesThisWeek
FROM `…brief`
ORDER BY briefDate DESC
LIMIT 1
```

### 4.10 `brief_prepared_for_emails`

A parallel briefing table consumed by the n8n email workflow (`email/n8n/workflow.js`), not by the app.

| Column | Type | Meaning |
|---|---|---|
| `briefDate` | DATE | Latest selected by `ORDER BY briefDate DESC LIMIT 1` |
| `briefDailySummary` | STRING | Becomes the email intro summary |
| `briefWeeklySummary` | STRING | Becomes the email weekly summary |
| `topNarrativesThisWeek` | JSON/ARRAY | Email narratives |
| `topPostIds` | STRUCT | Nested fields `mostViews`, `secondMostViews`, `thirdMostViews`, `mostViralPost`, `highestEngagementPost`, each carrying a `postId` later re-enriched by joining back to `post` and `account` |

## 5. Relationships (join map)

```
account.id ──────< account_x_accountType.accountId >────── accountType.id
account.id ──────< account_x_dashboard.accountId           (dashboardId = 1 gate)
account.id ─────── accountMetrics.pageId                   (latest by MAX(dateUpdated))
account.profile ─< post.profile                            (LTRIM '@', lower-cased — handle, not id)
post.postId ─────< post_x_style.postId  >───── style.id
post.postId ─────< post_x_topic.postId  >───── topic.id
brief / brief_prepared_for_emails                          (standalone, keyed by briefDate)
```

## 6. Firebase Authentication (identity store)

No Firestore. The only records are Firebase Auth user objects, keyed by `uid`:

| Field | Type | Meaning |
|---|---|---|
| `uid` | STRING | Firebase user id |
| `email` | STRING | From the magic link or Google sign-in |
| `customClaims.profiled` | BOOL | Set by `markProfiled(uid)` when the user saves preferences (`POST /api/preferences`). Baked into every ID token and session cookie; read by `verifySession` and `/api/auth/me` |
| refresh tokens | — | Revoked by `revokeSessions(uid)` on logout |

Session cookie `tki_auth`: httpOnly, SameSite=Lax, Secure in production, 14 day lifetime (`Max-Age=1209600`). Minted only from an ID token less than 5 minutes old; verified with `checkRevoked: true` on every request.

Client-side localStorage caches (never a source of truth): `tki_registered`, `tki_email`, `tki_profiled`, `tki_pending_email`, `__tki_dev_preview__`.

Env vars: server `FIREBASE_SERVICE_ACCOUNT`; client `EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` (branded `login.knox.digital`), `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_APP_ID`.

## 7. Google Cloud Storage (object store)

No bucket name is hardcoded in `lib/gcs.ts` — the bucket and object path are parsed out of each stored URL and re-signed on read (`getSignedUrl`, action `read`, default 1 hour TTL). Four URL forms are accepted: Firebase-style authenticated download URLs, `storage.googleapis.com/{bucket}/{path}`, `gs://{bucket}/{path}` and `storage.cloud.google.com/{bucket}/{path}`.

Production bucket: `tiktok-content-scraper`. Object naming:

```
tiktok-content-scraper/{profile}/{date}/{postId}.jpeg
```

Stored URL fields: `account.avatar` (profile photo), `post.coverJpeg` (cover thumbnail, also served publicly via `/api/cover/{postId}.jpg` with 1 day client / 30 day edge caching), `post.videoMp4` (video, also convertible to `gs://` form for Gemini).

## 8. Brevo (subscription state)

Not a database in the classic sense, but the canonical subscription store. List membership is authoritative; the `CONSENT_*` attributes are mirrors.

| Consent key | Env var | Default list id | Meaning |
|---|---|---|---|
| `CONSENT_DAILY_BRIEFING` | `BREVO_LIST_DAILY_BRIEFING` | 4 | Knox Index Daily Briefing (being retired; see `scripts/migrate-daily-to-weekly.mjs`) |
| `CONSENT_KNOX_INDEX_UPDATES` | `BREVO_LIST_KNOX_UPDATES` | 7 | Knox Index product updates |
| `CONSENT_KNOX_DIGITAL` | `BREVO_LIST_KNOX_DIGITAL` | 8 | Knox Digital (wider company) |
| `CONSENT_WEEKLY_BRIEFING` | `BREVO_LIST_WEEKLY_BRIEFING` | 9 | Knox Index Weekly Briefing |

Daily and weekly are mutually exclusive (enforced in `/api/preferences`). Contact attributes written: `FIRSTNAME`, `LASTNAME`, `COMPANY`, `LINKEDIN`, `JOB_ROLE` (from `segment`), `WHY_USE_KNOX_INDEX` (from `interests`), `SOURCE`, `PERM_REPORT` / `PERM_DAILY` / `PERM_WIDER` (register flow), plus the four `CONSENT_*` booleans.

## 9. Domain glossary

- **Account** — a tracked TikTok account belonging to a UK political figure or body. Row in `account`; scored and ranked
- **Post** — a single TikTok video by an account. Row in `post`; displayable once `videoSummary IS NOT NULL`
- **Account type** — the political role classification, stored many-to-many so one account can hold several
- **Party** — raw string in `account.party`, normalised to a `PartyKey` for colours and labels
- **Style** — the format of a post's content (talking head, b-roll); drives the Style League
- **Topic** — the subject of a post (NHS, housing); drives the Topic Cloud
- **Brief** — the editorial daily and weekly narrative generated by n8n/Gemini. `/api/brief` is a legacy live-Gemini version; `/api/briefs` reads the stored table
- **Benchmark** — min/p25/median/mean/p75/max distribution of views and engagement rate across all posts, for box-and-whisker rendering
- **League** — a ranked aggregation: post counts per style or topic in a range, or accounts ranked by score axis
- **Knox Factor** — the proprietary composite score (0 to 100), computed server-side only in `data/knoxFactor.server.ts` (isolation enforced by `scripts/check-knox-isolation.mjs`). Combines four capped, normalised axes with a compression curve, a minimum floor, stacked recency and volume penalties, and a confidential per-name bonus that never ships to the client. SQL mirror: `scripts/knox-mps-scored.sql`
- **Score axes** — `virality` (avg views per post over followers, log-scaled), `engagement` ((likes + comments + saves + shares) / views), `frequency` (posts in the last 28 days), `followers` (log-scaled), all normalised 0 to 100 to the dataset maximum
- **Follower-quality flag** — a separate client-safe heuristic (`data/knoxConfig.ts`): average views per post over followers, colour-coded to hint at low-quality audiences; neutral below 1,000 followers
- **Range** — the active date window (`yesterday | week | month | year | lifetime`) mapped to `postDate` predicates
- **Dashboard** — the `account_x_dashboard` membership gate; the public site shows only `dashboardId = 1`

## 10. Environment variables (data layer)

| Variable | Purpose |
|---|---|
| `BIGQUERY_PROJECT_ID` | GCP project (default `project-ariadne`) |
| `BIGQUERY_DATASET` | Dataset (default `ariadne_tiktok_demo`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account JSON (string or path), shared BigQuery + GCS |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase admin credentials |
| `ADMIN_EMAILS` | Comma-separated admin allowlist (fails closed) |
| `INTERNAL_API_TOKEN` | Bearer token for `/api/sign-coverjpeg` |
| `BREVO_API_KEY` | Brevo transactional + contacts API |
| `BREVO_LIST_*` | Brevo list id overrides (see section 8) |
| `GEMINI_API_KEY` | Gemini generation (`/api/brief`, `/api/summarise`) |
| `N8N_WEBHOOK_NEW_ACCOUNT` | Webhook notified on admin account creation |
