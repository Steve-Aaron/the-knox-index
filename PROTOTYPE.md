# World Leaders: TikTok + X prototype

Local experiment on branch `prototype/world-leaders-x`, cut from `feat/account-page-api` (dev plus KitSoft's account page). Not pushed.

## Run

From the folder above this one, the preview config runs:

```bash
NODE_OPTIONS=--max-old-space-size=8192 npm run web -- --port 8081
```

Open http://localhost:8081/?tenant=world. `.env.local` (git-excluded) points at the BigQuery key in `~/Desktop/BQapikey/` and sets `DEV_TENANT_BYPASS=1`. Use the dev panel's 'Full' setting for the signed-in view.

This folder ends in `.nosync` so iCloud Desktop sync leaves it alone. With the disk nearly full, iCloud was evicting files minutes after they were written.

## What changed

**Data (server)**
- `lib/xQueries.ts`: X twins of the TikTok SQL builders, in the same row shapes, so the original transformer and Knox Factor score X unchanged. Membership is person-level (`metadata.person_x_dashboard`); accounts come from confirmed `metadata.account_link` rows
- `lib/platformMerge.ts`: 'All platforms' merges a person's rows. Counts are summed; 0–100 scores are the mean of per-platform scores (each scored within its own platform). Provisional until the cross-platform Knox Score is defined
- `lib/xPosts.ts`: tweet row → `TweetData`, media signing
- `/api/ariadne`, `/api/posts`, `/api/leagues`: `?platform=all|tiktok|x`. **No param = TikTok only**, so the UK site is untouched
- `/api/benchmarks`: adds `byPlatform` so an X post is compared with X posts
- `/api/account-page`: `handle` may be a TikTok handle, X handle or person slug; `?platform=` drives KPIs, peer ranks, radar series, content and posts

**UI**
- Tenant config gains `platforms` (World Leaders: TikTok + X) and `briefing: 'placeholder'`
- Home page: PLATFORM chips above SORT BY; feed, leaderboard, globe, leagues follow them
- `components/post/tweet/*`: an X post rebuilt in the shape of a tweet, in Knox branding, used wherever the post detail shows (feed and account pop-up)
- Detail panel: one link pill and one profile button per platform, plus 'View full profile' to the account page
- Account page: KitSoft's All / TikTok / X chips now work; the Content 'Type' tab shows X formats

**World Leaders fixes**
- Briefing panel: sample copy with a SAMPLE badge at full size (no briefs exist for this dashboard)
- UK account-type tabs hidden on region-grouped dashboards
- Region chips and feed cards show region labels, not raw keys

## Data rules

- X engagements = likes + replies + reposts + quotes + bookmarks; reposts of other accounts excluded (they carry the original's numbers)
- X 'comments' = replies, 'shares' = reposts + quotes, 'saves' = bookmarks
- `@AndyBurnhamGM` excluded in favour of `@andyburnham`
- Totals checked against an independent query on 2026-10-26 (week): X 1,245 posts / 252,027,663 views; TikTok 509 / 121,874,356. Exact match
- Only ~19% of World Leaders X posts have an AI summary (`postSummary`), so most X pop-ups say 'No summary yet'
