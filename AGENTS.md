# Ariadne App — Agent Context

This file provides context for AI coding agents (Claude, Cursor, Copilot, etc.) working in this repo.

---

## Mixpanel Analytics

**Token:** `fd4826c41ed1184899b0350f4507593d`  
**Project:** The Knox Index  
**SDK:** `mixpanel-browser` (web), `mixpanel-react-native` (native)

### Platform Split

The codebase uses Expo's platform-specific file resolution:

| File | Used on |
|---|---|
| `lib/analytics.web.ts` | Web (Vercel) — uses `mixpanel-browser` |
| `lib/analytics.ts` | Native (iOS/Android) — uses `mixpanel-react-native` |

Both files export the same public API:
```typescript
track(event: string, properties?: Properties): void
identify(userId: string): void
setSuperProperties(props: Properties): void
startTimer(label: string): void
elapsedMs(label: string): number
stopTimer(label: string): number
```

### Ad-blocker Bypass (Web)

`analytics.web.ts` sets `api_host` to `${window.location.origin}/mp`. Vercel proxies this to Mixpanel:

```json
{ "source": "/mp/:path*", "destination": "https://api.mixpanel.com/:path*" }
```

**Do not remove this rewrite from `vercel.json`** — direct calls to `api.mixpanel.com` are blocked by common ad-blockers and privacy extensions.

### Tracking Plan (10 Areas)

| Area | Key Events |
|---|---|
| 1. Session lifecycle | `session_started`, `session_ended`, `session_resumed` |
| 2. Data load performance | `data_loaded` (time_to_load_ms), `data_load_failed` |
| 3. Politician engagement | `politician_selected`, `politician_dwell` (dwell_ms) |
| 4. Filter interactions | `filter_changed` (filter_type, old_value, new_value, result_count) |
| 5. Sort interactions | `sort_changed` (sort_key, old_sort_key) |
| 6. Post card & video | `post_card_opened`, `video_opened`, `tiktok_link_tapped` |
| 7. Registration funnel | `cta_bar_shown`, `cta_bar_tapped`, `unlock_modal_opened`, `registration_submit_attempted`, `registration_succeeded`, `registration_failed` |
| 8. Error recovery | `error_recovered` (recovery_ms), `posts_error_shown`, `posts_error_recovered` |
| 9. Scroll depth | `section_reached` (section, method) |
| 10. Navigation | `date_range_changed`, `wing_changed` |

### Super Properties

Set on every event via `setSuperProperties`:
- `platform` — `'web'` | `'ios'` | `'android'`
- `screen_category` — `'dashboard'`

### Do Not Track

`ignore_dnt: false` — the SDK respects the browser's Do Not Track header. Do not change this without legal review. The Knox Index has a UK audience and may fall under UK GDPR / UK PECR obligations.

### Adding New Events

1. Call `track('event_name', { ...props })` from the relevant component or hook
2. Keep event names `snake_case`
3. Include contextual props (e.g., `politician_id`, `party`, `sort_key`) — avoid PII
4. Document new events in the tracking plan table above

---

## Stack

- **Framework:** Expo SDK 52 / expo-router 4
- **Deployment:** Vercel (web), EAS (native)
- **Language:** TypeScript strict
- **Styling:** React Native StyleSheet + Expo Linear Gradient + glassmorphism patterns
- **Error tracking:** Sentry (`lib/sentry.ts`, reads `EXPO_PUBLIC_SENTRY_DSN`)
- **Data:** BigQuery via `/api` routes; GCS bucket for post data

## Key Conventions

- One job per component/hook; compose upward for complexity
- Analytics calls are always try/catch wrapped — never allowed to crash the app
- `fetchWithRetry` (`data/fetchWithRetry.ts`) for all API calls — retries 3× on network errors and 5xx
- Dark glassmorphist design language; tactile haptics via `expo-haptics`
