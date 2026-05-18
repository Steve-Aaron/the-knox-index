# Ariadne brief — audit and component map

Working scratchpad for the brief in `ariadne_brief.md`. Each row maps a brief item to the component that answers it.

Status legend:

- `OK` shipped, verified
- `OK*` shipped this session
- `BACKEND` lives in n8n / BigQuery / cron, out of scope for the React app
- `DEFER` not v1 critical, parking lot
- `BLOCKED` cannot ship without a data-side change

## Frontend dashboard checklist

| # | Brief question / problem | Component(s) that answer it | How it answers it | Status |
| --- | --- | --- | --- | --- |
| F1 | Which Party is doing best on TikTok? | `PartyLeaderboard` | Aggregates per-party totals (yesterday views, weekly posts, engagement, accounts) and ranks parties with a bar chart per row. Sortable | OK* |
| F2 | Which Party is most active on TikTok? | `PartyLeaderboard` (Activity sort) | Same component sorted by `postsThisWeek` summed across the party | OK* |
| F3 | Which MPs are leading the way in their party? | `RankBoard` + new party filter chips | The leaderboard now has party chips above the list. Tapping a party scopes the ranking to its members | OK* |
| F4 | Top Trump view (Week / Month / Year / Lifetime) | `RankBoard` + `PoliticianDetailPanel` + `TimeRangePicker` | Range filter affects the post feed and posting activity tiles. Top Trump card lives in `components/card/PoliticianCard.tsx` and is documented but not yet on the dashboard | DEFER |
| F5 | Radial chart on five axes | `RadialScoreChart` inside `PoliticianDetailPanel` | 5-axis spider chart with raw values revealed on hover. Knox Factor is the average | OK |
| F6 | What content would go viral? | `SummaryPanel` top-bangers strip + `PostsTable` Virality sort | Bangers strip lists top 6 posts. PostsTable now exposes a Virality sort = views ÷ followers, surfacing small accounts that punched up | OK* |
| F7 | Which Councils on TikTok? | None yet | The data has no `entityType` column distinguishing MPs from councils. Need a backend tag, or a name-pattern heuristic | BLOCKED |
| F8 | How well are these MPs doing versus other MPs? | `RankBoard` | Ranks all politicians by a chosen score key | OK |
| F9 | What are people TikTokking about this year? | `TopicCloud` | Aggregates `topics[]` across the visible feed; sized + tinted pills by frequency | OK* |
| F10 | What TikToks were popular yesterday? | `PostsTable` + `TimeRangePicker` (yesterday) | Sorts posts by views in the chosen range | OK |
| F11 | What TikToks went viral yesterday? | `PostsTable` Virality sort | New sort key = views ÷ account followers, scoped by time range | OK* |
| F12 | What style of TikToks do MPs make? | `StyleBreakdown` | Counts each `style` across the visible feed and renders a horizontal bar chart with shares | OK* |
| F13 | How does this MP perform on TikTok? How engaged are their followers? | `PoliticianDetailPanel` | Radar + totals + yesterday block. Recent post cards now show summary, comments, shares, and engagement rate | OK* |
| F14 | Has this MP bought followers (abroad)? | `FollowerQualityFlag` | Heuristic in detail panel. Flags accounts with avg-views÷followers below 1% (red) or 3% (amber) when followers ≥ 25k | OK* |
| F15 | What subjects are being talked about? | `TopicCloud` | Same component as F9 | OK* |
| F16 | Who's gone silent? | `RankBoardRow` SILENT badge | Already flags accounts with knoxFactor 0 + no recent post / view activity | OK |
| F17 | How to get in touch for more bespoke information | `ContactFooter` | Final-row CTA with mailto + LinkedIn link. Footer of the dashboard | OK* |
| F18 | Per-page: account name, party, view, totals, followers, likes, views24h | `PoliticianDetailPanel` | All present in `CardHeader` + totals grid + Yesterday section | OK |
| F19 | Per-post in the feed: views, likes, summary, engagement rate, comments, shares, caption, link | `PostsTable` PostCard | All fields present and rendered | OK |
| F20 | Per-post in detail panel: same fields as F19 | `PoliticianDetailPanel` post card | Now renders summary, views, likes, comments, shares, engagement rate, caption, postUrl. Required adding `comments` + `shares` to `RecentPost` type, BQ projection, and transformer | OK* |
| F21 | Filter: Account name | `PostsTable` `activePoliticianName` | Wired via leaderboard click + clearable pill | OK |
| F22 | Filter: Party | `PostsTable` party chips | Already implemented | OK |
| F23 | Filter: Political view (left / right / independent) | `PostsTable` wing chips | Already implemented | OK |
| F24 | Filter: Minimum views | `PostsTable` MIN VIEWS chips | New chip strip with `Any / 1k / 10k / 100k / 1M` thresholds | OK* |
| F25 | Filter: Minimum likes | `PostsTable` MIN LIKES chips | New chip strip with `Any / 100 / 1k / 10k / 100k` thresholds | OK* |
| F26 | Sort by total views or total likes | `PostsTable` sort chips | Already had Views + Likes; also Comments / Shares / Date / Virality | OK |

## Headlines / press angles

These are content prompts, not components. Each is supported by the existing surfaces.

| Headline | Component that supports it | Status |
| --- | --- | --- |
| "This MP has done the best on TikTok this week — here's why…" | `RankBoard` (#1 row) + `PoliticianDetailPanel` (radar + totals + posts) | OK |
| "How TikTok-obsessed is your MP?" | `PoliticianDetailPanel` (postsToday + postsThisWeek + totalPosts) | OK |
| "Six MPs have made more TikToks this month than appearances in Parliament" | Needs a Hansard data join. Out of scope | DEFER |
| "Why are Parliament speeches being TikTokified…" | Editorial angle served by `SummaryPanel` Gemini brief once the model sees enough data | OK |
| "Dr Luke Evans is a silent hit — here's what he's been posting" | `PoliticianDetailPanel` discovery via `RankBoard` Knox Factor sort + recent posts | OK |

## Paywall / premium options

| Item | Status |
| --- | --- |
| Other countries' data | BACKEND |
| White-label data exports | BACKEND |
| Download video / cover files | BACKEND |
| Long-period data download | BACKEND |

## Backend / system items

All marked `BACKEND` — owned by the n8n workflow + BigQuery, not the React app.

| Item | Status |
| --- | --- |
| Daily run, <30 min | BACKEND |
| 24h TikToks for UK MPs / party heads / councils | BACKEND |
| 24h TikToks for one leader in UK / FR / IT / DE / US / AU / NZ / NL / HU | BACKEND |
| n8n writes post / account / accountMetrics / style / topic / affiliation / videoSummary | BACKEND |
| Run at 5am, support manual page-add trigger | BACKEND |
| CSV export of last 24h post data (no urls/jpegs) | BACKEND (could surface a download button later) |

## Email component

Separate workstream (cron + transactional email).

| Item | Status |
| --- | --- |
| Daily count of MP TikToks | BACKEND |
| Most-seen videos | BACKEND |
| Viral-relative-to-audience videos | BACKEND |
| What people are saying | BACKEND (re-uses `/api/brief`) |
| Top narratives + reach + style | BACKEND |

## Build queue — final state

1. ✅ `PoliticianDetailPanel` post cards now render summary + comments + shares + engagement rate (required adding `comments` and `shares` to the `RecentPost` type, the BQ projection, and the transformer)
2. ✅ `PostsTable` MIN VIEWS + MIN LIKES chip filters
3. ✅ `PostsTable` Virality sort (added `accountFollowers` to `PostRecord` + `/api/posts` SQL)
4. ✅ `PartyLeaderboard` new component, mounted between KeyFindingsBar and PostsTable
5. ✅ `StyleBreakdown` new component
6. ✅ `TopicCloud` new component
7. ⏭ `RankBoard` MPs / Councils toggle — BLOCKED, marked above
8. ✅ `RankBoard` party filter chips
9. ✅ `FollowerQualityFlag` mounted inside `PoliticianDetailPanel`
10. ✅ `ContactFooter` mounted at the bottom of the dashboard
11. ✅ All new components wired into `app/index.tsx`
12. ✅ Typecheck clean (`npx tsc --noEmit` → 0 errors)
13. ✅ `expo export --platform web` builds clean (5 API routes + 3 static)

## Files touched this session

- `data/types.ts` — added `comments`, `shares` to `RecentPost`; `accountFollowers` to `PostRecord`
- `data/transformers.ts` — pass `comments`, `shares` through `transformPost`
- `data/politicians.ts` — extended mock posts with `comments`, `shares`
- `data/usePostsData.ts` — supply `accountFollowers` from politician totals in mock fallback
- `app/api/posts+api.ts` — select `a.totalFollowers` AS `accountFollowers`, add to row interface and mapping
- `components/dashboard/PoliticianDetailPanel.tsx` — render summary + 4 stats + engagement rate per post; mount `FollowerQualityFlag`
- `components/dashboard/PostsTable.tsx` — MIN VIEWS / MIN LIKES filters, Virality sort
- `components/dashboard/RankBoard.tsx` — party filter chips
- `components/dashboard/PartyLeaderboard.tsx` — new
- `components/dashboard/StyleBreakdown.tsx` — new
- `components/dashboard/TopicCloud.tsx` — new
- `components/dashboard/FollowerQualityFlag.tsx` — new
- `components/dashboard/ContactFooter.tsx` — new
- `app/index.tsx` — mount all new sections in order
- `ariadne_review.md` — this scratchpad

## Items needing a follow-up data-side change

These are flagged so they are not lost:

- **F7 (Councils on TikTok)**: BigQuery has no `entityType` distinguishing MPs from councils. Cleanest fix is an `accountType` column on the `account` table, populated during n8n ingestion (regex on profile handle + name suffix). Once the column exists, RankBoard gains an MPs / Councils toggle next to the party chips
- **F4 (Top Trump card on the dashboard)**: `PoliticianCard` exists in `components/card/` but the dashboard uses `PoliticianDetailPanel` instead. Either deprecate the unused `PoliticianCard` file or expose a "view Top Trump" button in the detail panel that swaps in the card. Editorial decision, not a data block
- The `BQPostRow` and `BQAccountRow` interfaces still type `profile`, `caption`, etc. as `string` even though production rows can be `null`. Tightening to `string | null` would catch the next null-replace bug at compile time
