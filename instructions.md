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
