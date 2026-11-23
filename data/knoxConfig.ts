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
// Calculation, per platform (an account on TikTok and X is judged on each):
//   ratio = avgViewsPerPost / followers on that platform
//
// TikTok: fixed thresholds.
//   ratio >= 0.03   → green   'Reach looks healthy for size'
//   ratio  < 0.03   → amber   'Reach low for follower count'
//   ratio  < 0.01   → red     'Unusually low reach for follower count'
//
// X: relative to the typical ratio for X accounts of the same size. On X the
// share of followers who see a post falls steeply as accounts grow (a 10M+
// account typically reaches ~1.4% of followers per post, a 1–10k account
// ~11%), so one fixed line flagged every large account.
//   ratio < typical × 0.25  → amber
//   ratio < typical × 0.10  → red
//
// This is a separate heuristic from the Knox Factor and is intentionally
// client-side. Below MIN_FOLLOWERS_GATE the sample is too small to judge
// reliably — a neutral verdict is returned instead of a colour.

export type ReachPlatform = 'tiktok' | 'x';

/**
 * Typical (median) avg-views-per-post ÷ followers on X, by follower band.
 * From the UK and World Leaders X accounts over the 30 days to 17 Nov 2026
 * (609 accounts, last five posts each). The 10M+ band rests on 8 accounts;
 * re-check it as more large accounts are added.
 */
const X_TYPICAL_RATIO: readonly { minFollowers: number; ratio: number }[] = [
  { minFollowers: 10_000_000, ratio: 0.014 },
  { minFollowers: 1_000_000,  ratio: 0.05  },
  { minFollowers: 10_000,     ratio: 0.06  },
  { minFollowers: 0,          ratio: 0.11  },
];

export const FOLLOWER_QUALITY = {
  /** TikTok: below this ratio → amber-flagged ('reach low for follower count'). */
  suspiciousRatio:     0.03,
  /** TikTok: below this ratio → red-flagged ('unusually low reach'). */
  verySuspiciousRatio: 0.01,
  /** X: amber below this share of the typical ratio for the account's size. */
  xSuspiciousShare:     0.25,
  /** X: red below this share of the typical ratio for the account's size. */
  xVerySuspiciousShare: 0.10,
  /** Below this follower count the ratio is too noisy to flag at all. */
  minFollowersGate:    1_000,
} as const;

export interface ReachThresholds {
  /** Below this ratio → amber. */
  amber: number;
  /** Below this ratio → red. */
  red:   number;
  /** The typical ratio for accounts this size, when the platform uses one. */
  typical: number | null;
}

/** The amber and red lines for an account of this size on this platform. */
export function reachThresholds(platform: ReachPlatform, followers: number): ReachThresholds {
  if (platform === 'x') {
    const typical = (X_TYPICAL_RATIO.find(b => followers >= b.minFollowers) ?? X_TYPICAL_RATIO[X_TYPICAL_RATIO.length - 1]).ratio;
    return {
      amber:   typical * FOLLOWER_QUALITY.xSuspiciousShare,
      red:     typical * FOLLOWER_QUALITY.xVerySuspiciousShare,
      typical,
    };
  }
  return {
    amber:   FOLLOWER_QUALITY.suspiciousRatio,
    red:     FOLLOWER_QUALITY.verySuspiciousRatio,
    typical: null,
  };
}

export type FollowerQualityTone = 'green' | 'amber' | 'red' | 'neutral';

export interface FollowerQualityVerdict {
  /** Ratio of average post views to follower count (0..∞), or null when ungradeable. */
  ratio:   number | null;
  /** Colour-coded verdict. 'neutral' means the sample is too small to grade. */
  tone:    FollowerQualityTone;
  /** The lines the ratio was judged against. */
  thresholds: ReachThresholds;
  /** Reason the verdict came back as neutral, if applicable. */
  neutralReason?: 'low_followers' | 'no_posts';
}

/**
 * Compute the follower-quality ratio and a colour verdict for one platform.
 *
 * `avgViews` should be the mean view count across the account's recent posts
 * on that platform, and `followers` its follower count there (use 0 views if
 * there are no posts — gates to neutral).
 */
export function computeFollowerQuality(
  avgViews: number,
  followers: number,
  postCount: number,
  platform: ReachPlatform = 'tiktok',
): FollowerQualityVerdict {
  const thresholds = reachThresholds(platform, followers);
  if (followers < FOLLOWER_QUALITY.minFollowersGate) {
    return { ratio: null, tone: 'neutral', thresholds, neutralReason: 'low_followers' };
  }
  if (postCount === 0) {
    return { ratio: null, tone: 'neutral', thresholds, neutralReason: 'no_posts' };
  }
  const ratio = avgViews / followers;
  if (ratio < thresholds.red)   return { ratio, tone: 'red',   thresholds };
  if (ratio < thresholds.amber) return { ratio, tone: 'amber', thresholds };
  return { ratio, tone: 'green', thresholds };
}
