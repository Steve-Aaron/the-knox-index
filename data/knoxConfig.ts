/**
 * data/knoxConfig.ts
 * -------------------
 * CLIENT-SAFE helper that sits alongside Knox but is NOT the Knox Factor
 * calculation: the follower-quality flag (colour-coded reach-vs-followers).
 *
 * The Knox Factor formula itself (caps, curve, penalties, normalisation limits
 * and the confidential bonus) lives in the SERVER-ONLY module
 * data/knoxFactor.server.ts and never ships to the client. Do not move scoring
 * logic back here — this file is bundled into the client.
 */

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
// This is a separate heuristic from the Knox Factor and is intentionally
// client-side. Below MIN_FOLLOWERS_GATE the sample is too small to judge
// reliably — a neutral verdict is returned instead of a colour.

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
