# Project instructions

## Knox Factor — DO NOT re-formulate

The Knox Factor calculation is **final**. It must never be re-formulated,
re-derived, re-weighted, or recalculated anywhere. Always use the current
formulation exactly as it exists in:

- `data/knoxConfig.ts` — the per-axis caps, the compression curve, the penalty
  multipliers/thresholds, and the `computeKnoxFactor` / `computeKnoxBase` /
  `knoxPenaltyMultiplier` functions.
- `data/transformers.ts` — how the four axis inputs are produced (`rawAxes`,
  `computeScores`) and the single place `computeKnoxFactor` is called.

Rules:

- Do not change the per-axis caps, the curve strength, the penalty multipliers
  or thresholds, the normalisation (log vs linear), or the metric windows.
- `computeKnoxFactor` is the **single source** of the Knox Factor. Never add a
  second or alternative Knox calculation anywhere in the app or in SQL.
- Display-only transforms are presentation and must NOT feed back into the Knox
  Factor. These live in the view layer (e.g. `components/card/RadialScoreChart.tsx`)
  and read display values; they never re-derive the score. Current examples:
  - the radar virality curve (`viralityDisplay`),
  - the radar activity step scale (`activityScore`),
  - the radar log-scaled followers.
- If the model genuinely must change, it is edited in `knoxConfig.ts` **only**,
  with explicit sign-off — never silently recomputed elsewhere.

## Amendment — range-scoped Knox (signed off by Steve, 2026-06-12)

The leaderboard's Knox column is now date-sensitive. When the time filter is
anything other than 'Lifetime', the leaderboard ranks and displays
`computeRangeKnox` (in `knoxConfig.ts`): the identical caps, curve and
minScore floor via `computeKnoxBase`, fed with axis inputs computed from posts
inside the selected range (`rangeAxes` in `transformers.ts`). Followers stays
lifetime. The lifetime penalty multipliers do not apply to range scores —
their windows are lifetime-defined.

Scope rules:

- LEADERBOARD ONLY (`RankBoard` / `RankBoardRow` via `leaderboardScore`).
  Account pages, radar charts, summary panels and rankings keep lifetime Knox
- `computeKnoxFactor` remains the single source of the lifetime Knox Factor
  and is unchanged
- The 'This year' filter means the current calendar year (`bqQueries.ts`),
  not a rolling 365 days
