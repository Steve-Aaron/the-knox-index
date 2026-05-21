# Ariadne — MixPanel Analytics Plan

> **How to use this document**
> The 'Backend changes' section is implemented by the agent and committed to the codebase.
> The 'MixPanel setup' sections are worked through together, one report at a time, in the live MixPanel UI.

---

## Event inventory — what already exists

| Event | Key properties | Source |
|---|---|---|
| `session_started` | platform, screen_category, screen_width_px, referrer | useSessionTracking |
| `session_ended` | session_duration_s, reason | useSessionTracking |
| `session_resumed` | away_duration_s | useSessionTracking |
| `dashboard_viewed` | account_count | index.tsx |
| `politician_selected` | politician_id | index.tsx |
| `politician_dwell` | politician_id, dwell_ms | index.tsx |
| `time_range_changed` | range, previous_range | index.tsx |
| `dashboard_sort_changed` | sort_key, previous_sort_key | index.tsx |
| `post_sort_changed` | sort_key, previous_sort_key | PostsTable |
| `post_card_opened` | post_id, politician_name, party, views, likes, has_video, position_in_feed, sort_key | PostsTable |
| `alignment_filter_changed` | wing, result_count | PostsTable |
| `party_filter_changed` | party, result_count | PostsTable |
| `view_threshold_changed` | threshold, result_count | PostsTable |
| `like_threshold_changed` | threshold, result_count | PostsTable |
| `video_opened` | has_video, has_cover, post_id, politician_name, party, views | VideoModal |
| `video_cover_fallback` | post_id, politician_name, party | VideoModal |
| `tiktok_link_tapped` | post_id, politician_name, party | VideoModal |
| `cta_bar_shown` | scroll_y | StickyUnlock |
| `cta_bar_tapped` | — | StickyUnlock |
| `unlock_modal_opened` | — | StickyUnlock |
| `registration_submit_attempted` | email* | StickyUnlock |
| `magic_link_sent` | — | StickyUnlock |
| `magic_link_failed` | — | StickyUnlock |
| `email_field_focused` | — | StickyUnlock |
| `error_shown` | context, message | index.tsx |
| `error_recovered` | context, time_to_recovery_ms | index.tsx |

> *`registration_submit_attempted` sends raw email as a property. This may constitute personal data under your AI usage policy and GDPR obligations — consider whether you need this property or whether a hashed/anonymised form would suffice.

---

## New events added by backend implementation

| Event | Key properties | Source |
|---|---|---|
| `politician_selected` *(enriched)* | + politician_name, party_key, party_label, rank, sort_key | index.tsx |
| `politician_dwell` *(enriched)* | + politician_name, party_key | index.tsx |
| `party_leaderboard_row_tapped` | party_key, party_label, rank, sort_key, total_views, total_posts, engagement_rate | PartyLeaderboard |
| `video_play_started` | post_id, politician_name, party | VideoModal |
| `video_closed` | post_id, politician_name, party, watch_duration_s, had_video | VideoModal |
| `summary_hover_2s` | — | SummaryPanel |
| `radial_chart_hovered` | axis_key, politician_name, party_key | RadialScoreChart |
| `user_registered` | — | useAuth |
| `user_returned` | — | useAuth |
| `user_profiled` | segment, interests (array), interests_count | StickyUnlock |

> Super properties added: `is_registered` (boolean) — stamped on every event once auth resolves.
> `identify()` is called with the user's email when they are found to be registered, linking all their events in MixPanel.

---

## Report implementation plans

---

### MP REPORT
*Which MPs people are clicking on, and which MPs' videos they are watching*

**Events to use:**
- `politician_selected` → who they click (name, party, rank, sort_key)
- `politician_dwell` → how long they spend on each MP (dwell_ms)
- `video_opened` → which MP videos they open (politician_name, party)
- `video_play_started` → which they actually watch
- `video_closed` → watch_duration_s per MP

**MixPanel setup — do together:**
1. Insights → Bar chart → Event: `politician_selected` → breakdown by `politician_name` → "Most clicked MPs"
2. Insights → Bar chart → Event: `video_opened` → breakdown by `politician_name` → "Most viewed MP videos"
3. Insights → Table → `politician_dwell` → breakdown by `politician_name` → avg `dwell_ms` → "Most engaging MPs"
4. Funnels → `politician_selected` → `video_opened` (same `politician_name`) → "Click-to-watch rate per MP"
5. Add all four charts to an 'MP Report' dashboard board

---

### PARTY REPORT
*Which parties people are clicking on, and which party videos they are watching*

**Events to use:**
- `party_leaderboard_row_tapped` → direct party clicks from the leaderboard widget
- `party_filter_changed` → party filter selections in the post feed
- `video_opened` → party breakdown on videos opened (party property)
- `video_closed` → watch duration per party

**MixPanel setup — do together:**
1. Insights → Bar chart → `party_leaderboard_row_tapped` → breakdown by `party_label` → "Party leaderboard tap rate"
2. Insights → Bar chart → `party_filter_changed` → breakdown by `party` → "Party filter selections"
3. Insights → Bar chart → `video_opened` → breakdown by `party` → "Video opens by party"
4. Insights → Table → `video_closed` → breakdown by `party` → avg `watch_duration_s` → "Watch time by party"
5. Add to 'Party Report' board

---

### VIDEO REPORT
*Which videos people click on, which they watch, and for how long*

**Events to use:**
- `post_card_opened` → post clicked in the feed (post_id, politician_name, party, views, has_video)
- `video_opened` → modal opened
- `video_play_started` → video actually started playing
- `video_closed` → closed, with watch_duration_s
- `tiktok_link_tapped` → clicked through to TikTok

**MixPanel setup — do together:**
1. Insights → Table → `post_card_opened` → breakdown by `post_id` → top 50 → "Most clicked posts"
2. Funnels → `post_card_opened` → `video_play_started` → `tiktok_link_tapped` → "Video engagement funnel"
3. Insights → Histogram → `video_closed` property `watch_duration_s` → "Watch time distribution"
4. Insights → Line chart → `video_play_started` over time → "Video watch volume trend"
5. Insights → Bar chart → `post_card_opened` filter `has_video = true` vs `false` → "Video vs non-video click rate"
6. Add to 'Video Report' board

---

### USER REPORT
*How engaged are users; hover, click, and interaction depth*

**Events to use:**
- `session_started` → total user count, platform, screen category
- `dashboard_viewed` → dashboard load count
- `summary_hover_2s` → users reading the AI briefing carefully
- `politician_selected` → leaderboard clicks (with rank)
- `post_card_opened` → post clicks
- `radial_chart_hovered` → radar chart interactions
- `section_viewed` (from useSectionTracking) → scroll depth per section

**MixPanel setup — do together:**
1. Insights → Line chart → `session_started` (Unique users) → "DAU/WAU/MAU"
2. Insights → Bar chart → `dashboard_viewed` → "Dashboard loads over time"
3. Insights → Bar chart → `summary_hover_2s` (Unique users) → "Users reading the briefing deeply"
4. Insights → Bar chart → `politician_selected` (Unique users) → "Users clicking a leaderboard row"
5. Insights → Bar chart → `post_card_opened` (Unique users) → "Users clicking a post"
6. Insights → Bar chart → `radial_chart_hovered` (Unique users) → "Users interacting with radar chart"
7. Retention → First event: `session_started` → Returning event: `session_started` → "User retention"
8. Add to 'User Engagement Report' board

---

### CONVERSION REPORT
*Auth funnel: anonymous → registered → profiled → returning*

**Events to use:**
- `session_started` → all visits (with `is_registered` super property)
- `cta_bar_shown` → unlock CTA visible
- `cta_bar_tapped` → CTA clicked
- `unlock_modal_opened` → modal seen
- `magic_link_sent` → email submitted
- `user_registered` → first verified login (magic link clicked)
- `user_returned` → subsequent authenticated visits
- `user_profiled` → profile survey completed (segment, interests)

**MixPanel setup — do together:**
1. Funnels → `cta_bar_shown` → `cta_bar_tapped` → `unlock_modal_opened` → `magic_link_sent` → `user_registered` → "Full registration funnel"
2. Insights → Pie chart → `session_started` breakdown by `is_registered` → "Registered vs anonymous split"
3. Insights → Bar chart → `user_profiled` → breakdown by `segment` → "Who is registering"
4. Insights → Bar chart → `user_profiled` → breakdown by `interests` (multi-value) → "Why they registered"
5. Retention → `user_registered` → `session_started` (is_registered=true) → "Return rate post-registration"
6. Insights → Line chart → `user_registered` over time → "Registration volume trend"
7. Add to 'Conversion Report' board

---

## Implementation file map

| File | Changes |
|---|---|
| `app/index.tsx` | Enrich `politician_selected` + `politician_dwell` with name, party, rank |
| `components/dashboard/PartyLeaderboard.tsx` | Make rows Pressable, fire `party_leaderboard_row_tapped` |
| `components/dashboard/VideoModal.tsx` | Fire `video_play_started` + `video_closed` with duration |
| `components/dashboard/SummaryPanel.tsx` | Fire `summary_hover_2s` after 2s pointer dwell |
| `components/card/RadialScoreChart.tsx` | Fire `radial_chart_hovered` on axis interaction |
| `components/auth/StickyUnlock.tsx` | Fire `user_profiled` in ProfilingModal on submit |
| `hooks/useAuth.ts` | Fire `user_registered`/`user_returned`, call `identify()`, set `is_registered` super prop |
