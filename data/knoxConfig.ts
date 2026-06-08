/**
 * data/knoxConfig.ts
 * -------------------
 * Knox Factor formula configuration — single file to control all scoring.
 *
 * Knox Factor is The Knox Index's composite performance score (0–100) that
 * combines four normalised metrics into a single headline number.
 *
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
    virality:    20,
    engagement:  50,
    frequency:   55,
    followers:   45,
  } satisfies KnoxCaps,

  curveStrength: 1.3,

  /** Minimum displayed score for any account with ≥1 post this week. */
  minScore: 5,

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

/** ─────────────────────────────────────────────────────────────────────────── */

/**
 * Compute Knox Factor from four normalised component scores (each 0–100).
 * Returns a rounded integer 0–100.
 *
 * Step 1: sum per-axis contributions, where each contribution = (axis/100) · cap.
 * Step 2: clamp composite to 100.
 * Step 3: apply compression curve around the 50 pivot (Moz-DA-style).
 * Step 4: apply minScore floor if any axis has signal.
 */
export function computeKnoxFactor(
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

  // Compress toward 50 — slight reward below pivot, slight punishment above.
  // f(x) = 50 + sign(x − 50) · 50 · |(x − 50) / 50|^curveStrength
  const PIVOT = 50;
  const delta = clamped - PIVOT;
  const normDelta = Math.abs(delta) / PIVOT;                    // 0..1
  const compressed = Math.pow(normDelta, KNOX_OPTIONS.curveStrength) * PIVOT;
  const curved = PIVOT + Math.sign(delta) * compressed;

  // Apply floor only when at least one axis has any signal
  const hasActivity = virality + engagement + followers + frequency > 0;
  const floored = hasActivity ? Math.max(curved, KNOX_OPTIONS.minScore) : curved;

  return Math.round(Math.min(100, Math.max(0, floored)));
}


// ─────────────────────────────────────────────────────────────────────────────
// FOLLOWER QUALITY FLAG
// ─────────────────────────────────────────────────────────────────────────────
//
// Heuristic that flags accounts whose recent reach looks anomalously low for
// their follower base — surfaces possible bought-followers / dead-audience
// situations without making an accusation. The dashboard shows the ratio and
// a colour-coded verdict; thresholds below decide which colour shows.
//
// Calculation:
//   ratio = avgViewsPerPost / totalFollowers
//   where avgViewsPerPost is the mean across the account's recentPosts
//
// Interpretation (current defaults):
//   ratio >= 0.03   → green   'Reach looks healthy for size'
//   ratio  < 0.03   → amber   'Reach low for follower count'
//   ratio  < 0.01   → red     'Unusually low reach for follower count'
//
// 100% ratio (= 1.0) means an average post reaches exactly the follower count
// in views. TikTok's algorithm regularly pushes good content far past 100%
// because non-followers receive it via the For You feed — so high ratios are
// good news, not a flag.
//
// Below MIN_FOLLOWERS_GATE the sample is too small to judge reliably — the
// component returns a neutral verdict instead of a colour.

export const FOLLOWER_QUALITY = {
  /** Below this ratio → amber-flagged ('reach low for follower count'). */
  suspiciousRatio:     0.03,
  /** Below this ratio → red-flagged ('unusually low reach'). */
  verySuspiciousRatio: 0.01,
  /** Below this follower count the ratio is too noisy to flag at all. */
  minFollowersGate:    1_000,
} as const;

export type FollowerQualityTone = 'green' | 'amber' | 'red' | 'neutral';

export interface FollowerQualityVerdict {
  /** Ratio of average post views to follower count (0..∞), or null when ungradeable. */
  ratio:   number | null;
  /** Colour-coded verdict. 'neutral' means the sample is too small to grade. */
  tone:    FollowerQualityTone;
  /** Reason the verdict came back as neutral, if applicable. */
  neutralReason?: 'low_followers' | 'no_posts';
}

/**
 * Compute the follower-quality ratio and a colour verdict.
 *
 * `avgViews` should be the mean view count across an account's recent posts
 * (use 0 if there are no posts — gates to neutral).
 */
export function computeFollowerQuality(
  avgViews: number,
  followers: number,
  postCount: number,
): FollowerQualityVerdict {
  if (followers < FOLLOWER_QUALITY.minFollowersGate) {
    return { ratio: null, tone: 'neutral', neutralReason: 'low_followers' };
  }
  if (postCount === 0) {
    return { ratio: null, tone: 'neutral', neutralReason: 'no_posts' };
  }
  const ratio = avgViews / followers;
  if (ratio < FOLLOWER_QUALITY.verySuspiciousRatio) return { ratio, tone: 'red'   };
  if (ratio < FOLLOWER_QUALITY.suspiciousRatio)     return { ratio, tone: 'amber' };
  return { ratio, tone: 'green' };
}