/**
 * data/knoxFactor.server.ts
 * --------------------------
 * SERVER-ONLY Knox Factor formula. The ENTIRE scoring calculation lives here:
 * caps, curve, penalties, normalisation limits and the confidential name bonus.
 *
 * ⚠️  DO NOT IMPORT THIS FILE FROM CLIENT CODE.
 * It must only ever be imported by:
 *   • data/transformers.ts  (itself imported only by app/api/*+api.ts)
 *   • other server-side API route code
 * The client receives only the finished numbers via the API payload. The guard
 * script scripts/check-knox-isolation.mjs fails the build if anything outside
 * the server allowlist imports this module — keep it that way.
 *
 * Knox Factor is The Knox Index's composite performance score (0–100) that
 * combines four normalised metrics into a single headline number, applies
 * post-volume / recency / low-views penalties, then a confidential bonus.
 */

export interface KnoxCaps {
  virality:    number;   // avg post views relative to followers
  engagement:  number;   // (likes + comments + shares) / views
  followers:   number;   // total follower count
  frequency:   number;   // posts published this week
}

/** ─── EDIT THESE TO REBALANCE THE SCORE ─────────────────────────────────── */
export const KNOX_OPTIONS = {

  /**
   * Per-axis point caps. Each axis contributes up to its cap value to the
   * composite. Caps may sum to more than 100 by design — final total is
   * clamped to 100 so multiple shapes of strength can hit the ceiling.
   */
  caps: {
    virality:    15,
    engagement:  35,
    frequency:   7.5,
    followers:   60,
  } satisfies KnoxCaps,

  // < 1 EXPANDS scores away from the 50 pivot (spreads top and bottom).
  curveStrength: 0.7,

  /** Minimum displayed score for any account with signal, before penalties. */
  minScore: 5,

} as const;

/**
 * Post-volume + recency + low-views penalties applied to the OVERALL score.
 * All multiplicative and stacked. Mirrors scripts/knox-mps-scored.sql so the
 * dashboard and the analysis query agree.
 */
export const KNOX_PENALTIES = {
  /** Lifetime posts: harsher tier wins (< 25 implies < 100). */
  lowVolume:   { quarterBelow: 25, quarterMult: 0.25, halveBelow: 100, halveMult: 0.5 },
  /** No posts in the last 7 days. */
  noPosts7d:   0.8,
  /** No posts in the last 28 days (or, for the range score, the selected window). */
  noPosts28d:  0.4,
  /** Lifetime average views per post below this. */
  lowViews:    { threshold: 10_000, mult: 0.7 },
} as const;

/**
 * Hard ceilings applied to RAW axis values BEFORE dataset-max normalisation.
 * Winsorises small-account artifacts so a single freak ratio cannot collapse
 * every other politician's normalised axis to 0.
 *
 *   viralityRatio — avgViewsPerPost / followers. Above 0.5 is almost always
 *                   a tiny account whose ratio isn't comparable to a real one.
 *   engRatePct    — (likes + comments + saves + shares) / views × 100. Above
 *                   100% is a data artifact (likes exceeding views, which only
 *                   happens when the view counter undercounts for some posts).
 */
export const NORMALISATION_LIMITS = {
  viralityRatio: 0.5,
  engRatePct:    100,
} as const;

/**
 * Overall Knox score BEFORE penalties, returned UNROUNDED (0–100) so penalties
 * can be applied on the precise value. This is composite → curve → min-5 floor.
 *
 * Step 1: sum per-axis contributions, where each contribution = (axis/100) · cap.
 * Step 2: clamp composite to 100.
 * Step 3: apply compression curve around the 50 pivot (Moz-DA-style).
 * Step 4: apply minScore floor if any axis has signal.
 */
export function computeKnoxBase(
  virality:    number,   // normalised 0–100
  engagement:  number,   // normalised 0–100
  followers:   number,   // normalised 0–100
  frequency:   number,   // normalised 0–100
): number {
  const c = KNOX_OPTIONS.caps;

  // Each axis contributes up to its cap. Sum may exceed 100 — that's intentional.
  const composite =
    (virality   / 100) * c.virality   +
    (engagement / 100) * c.engagement +
    (followers  / 100) * c.followers  +
    (frequency  / 100) * c.frequency;

  // Clamp to 0..100 before the curve so the pivot maths stays well-defined.
  const clamped = Math.min(100, Math.max(0, composite));

  // Expand away from 50 (curveStrength < 1) — spreads top and bottom.
  // f(x) = 50 + sign(x − 50) · 50 · |(x − 50) / 50|^curveStrength
  const PIVOT = 50;
  const delta = clamped - PIVOT;
  const normDelta = Math.abs(delta) / PIVOT;                    // 0..1
  const compressed = Math.pow(normDelta, KNOX_OPTIONS.curveStrength) * PIVOT;
  const curved = PIVOT + Math.sign(delta) * compressed;

  // Apply floor only when at least one axis has any signal
  const hasActivity = virality + engagement + followers + frequency > 0;
  const floored = hasActivity ? Math.max(curved, KNOX_OPTIONS.minScore) : curved;

  return Math.min(100, Math.max(0, floored));
}

/**
 * Multiplicative penalty factor for the overall score. Stacks low-volume,
 * recency (7d + 28d), and low-views penalties. See KNOX_PENALTIES.
 *
 * For the range-scoped score, pass the SELECTED window's post count as
 * postsLast28d so the recency penalty tracks the active date filter; the
 * other inputs (lifetime posts, 7-day recency, lifetime avg views) stay as-is.
 */
export function knoxPenaltyMultiplier(
  lifetimePosts: number,
  postsLast7d:   number,
  postsLast28d:  number,
  avgViews:      number,
): number {
  const p = KNOX_PENALTIES;
  let mult = 1;

  // Low-volume: harsher tier wins (< 25 also satisfies < 100).
  if (lifetimePosts < p.lowVolume.quarterBelow)    mult *= p.lowVolume.quarterMult;
  else if (lifetimePosts < p.lowVolume.halveBelow) mult *= p.lowVolume.halveMult;

  if (postsLast7d  === 0) mult *= p.noPosts7d;
  if (postsLast28d === 0) mult *= p.noPosts28d;
  if (avgViews < p.lowViews.threshold) mult *= p.lowViews.mult;

  return mult;
}

/**
 * Full Knox Factor: base score with all penalties applied, rounded to 0–100.
 * THIS is the single source for both the lifetime and range-scoped scores —
 * pass the appropriate axis inputs and penalty window. Apply the name bonus
 * separately (applyKnoxNameBonus) once the account identity is known.
 */
export function computeKnoxFactor(
  virality:    number,
  engagement:  number,
  followers:   number,
  frequency:   number,
  penalties?: { lifetimePosts: number; postsLast7d: number; postsLast28d: number; avgViews: number },
): number {
  const base = computeKnoxBase(virality, engagement, followers, frequency);
  const mult = penalties
    ? knoxPenaltyMultiplier(penalties.lifetimePosts, penalties.postsLast7d, penalties.postsLast28d, penalties.avgViews)
    : 1;
  return Math.round(Math.min(100, Math.max(0, base * mult)));
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENTIAL EDITORIAL BONUS — SERVER-ONLY, never shipped to the client.
// ─────────────────────────────────────────────────────────────────────────────
//
// A flat additive applied to the FINAL Knox Factor for specific accounts, after
// penalties. Because the whole formula is server-only (enforced by
// scripts/check-knox-isolation.mjs), the named list never reaches the client
// bundle and is not present in the API payload — investigating users see only
// the resulting number, never the names or amounts. Keyed on the account
// display name, case-insensitive. Edit here to adjust.

const KNOX_NAME_BONUS: Record<string, number> = {
  'nigel farage':    5,
  'sarah pochin':   10,
  'jeremy corbyn':   5,
  'nadia whittome':  5,
  'ayoub khan':      5,
  'robert jenrick':  5,
  'rupert lowe':     5,
  'katie lam':       5,
  'richard burgon':  5,
  'imran hussain':   5,
};

/**
 * Apply the confidential name bonus to a finished Knox score, clamped 0–100 and
 * rounded. Pass the account display name; unknown names return the score as-is.
 */
export function applyKnoxNameBonus(score: number, displayName: string | undefined): number {
  const bonus = KNOX_NAME_BONUS[(displayName ?? '').trim().toLowerCase()] ?? 0;
  // Bonus added after penalties, then the whole score capped to 0–100.
  return Math.round(Math.min(100, Math.max(0, score + bonus)));
}
