/**
 * data/leaderboard.ts
 * -------------------
 * CLIENT-SAFE leaderboard selectors. Pure pickers over already-computed
 * Politician data — they contain NO Knox Factor formula, only the logic for
 * choosing/ordering the precomputed values the leaderboard shows.
 *
 * Kept apart from data/transformers.ts on purpose: transformers imports the
 * server-only formula (data/knoxFactor.server.ts), so importing anything from
 * it into a client component would drag the whole formula into the client
 * bundle. RankBoard / RankBoardRow / app/index import from HERE instead.
 */

import type { Politician, LeaderboardSortKey } from './types';

/**
 * The value the leaderboard ranks and displays for a given sort key.
 *
 * SINGLE source of scoring: virality / engagement / frequency / followers /
 * Knox all read the one canonical `scores` set (matching the SQL), under every
 * date filter. `views` is the one non-score sort — a raw count from the active
 * range. The trailing arg is kept for call-site compatibility and is ignored.
 */
export function leaderboardScore(p: Politician, key: LeaderboardSortKey, _isLifetime?: boolean): number {
  if (key === 'views') return p.totals.viewsInRange;
  return p.scores[key];
}

/**
 * Views display score (0–100), DISPLAY-ONLY. Scored relative to the top page on
 * a log2 scale: the top page (maxViews) = 100, and every halving of views drops
 * the score by 10 (so half the top's views → 90, a quarter → 80, …), floored at
 * 0. Never feeds Knox. Pass the max viewsInRange across the leaderboard list.
 */
export function viewsScore(views: number, maxViews: number): number {
  if (maxViews <= 0 || views <= 0) return 0;
  const s = 100 + 10 * (Math.log(views / maxViews) / Math.log(2));
  return Math.round(Math.min(100, Math.max(0, s)));
}

// ── Engagement display score (DISPLAY-ONLY, never feeds Knox) ────────────────
//
// Raw engagement rate of an account, from the in-range post aggregates:
// (likes + comments + saves + shares) / views × 100.
export function engagementRate(p: Politician): number {
  const v = p.totals.viewsInRange;
  if (v <= 0) return 0;
  const inter = p.totals.likesInRange + p.totals.commentsInRange
              + p.totals.savesInRange + p.totals.sharesInRange;
  return (inter / v) * 100;
}

// Smooth monotone cubic (PCHIP) through 0%→0, 2%→10, 6%→50, 15%→100.
const ENG_X = [0, 2, 6, 15];
const ENG_Y = [0, 10, 50, 100];
const ENG_H: number[] = [];
const ENG_D: number[] = [];
for (let i = 0; i < ENG_X.length - 1; i++) { ENG_H[i] = ENG_X[i + 1] - ENG_X[i]; ENG_D[i] = (ENG_Y[i + 1] - ENG_Y[i]) / ENG_H[i]; }
const ENG_M: number[] = [];
ENG_M[0] = ENG_D[0];
ENG_M[ENG_X.length - 1] = ENG_D[ENG_X.length - 2];
for (let i = 1; i < ENG_X.length - 1; i++) {
  if (ENG_D[i - 1] * ENG_D[i] <= 0) ENG_M[i] = 0;
  else { const w1 = 2 * ENG_H[i] + ENG_H[i - 1], w2 = ENG_H[i] + 2 * ENG_H[i - 1]; ENG_M[i] = (w1 + w2) / (w1 / ENG_D[i - 1] + w2 / ENG_D[i]); }
}
function engCubic(e: number): number {
  const n = ENG_X.length;
  if (e <= ENG_X[0]) return 0;
  if (e >= ENG_X[n - 1]) return 100;
  let i = 0; while (e > ENG_X[i + 1]) i++;
  const t = (e - ENG_X[i]) / ENG_H[i], t2 = t * t, t3 = t2 * t;
  const v = (2 * t3 - 3 * t2 + 1) * ENG_Y[i] + (t3 - 2 * t2 + t) * ENG_H[i] * ENG_M[i]
          + (-2 * t3 + 3 * t2) * ENG_Y[i + 1] + (t3 - t2) * ENG_H[i] * ENG_M[i + 1];
  return Math.max(0, Math.min(100, v));
}

/**
 * Engagement display score (0–100), DISPLAY-ONLY. The 100/100 reference rate is
 * min(referenceRate, 15%) — i.e. the top engagement rate in the current set,
 * but never requiring more than 15% to top out. The approved cubic shape is
 * kept by scaling the input rate so the reference lands on the 15%→100 anchor.
 */
export function engagementScore(rate: number, referenceRate: number): number {
  const ref = Math.min(referenceRate, 15);
  if (ref <= 0) return 0;
  return Math.round(engCubic(rate * 15 / ref));
}

/**
 * Virality display score (0–100), DISPLAY-ONLY. Avg-views-per-follower ratio on
 * a log10 scale anchored so 0.2× reach = 50 (the midpoint), at 25 points per
 * 10× of reach: 0.02×→25, 0.2×→50, 2×→75, 20×→100. Absolute (NOT
 * dataset-relative), so the leaderboard agrees with the radar instead of
 * clustering near 100. Never feeds the Knox Factor.
 */
const VIRALITY_DISPLAY_ANCHOR = 0.2;   // reach ratio that maps to the 50 midpoint
const VIRALITY_DISPLAY_SLOPE  = 25;    // points added per 10× of reach

export function viralityScoreDisplay(ratio: number): number {
  if (ratio <= 0) return 0;
  const s = 50 + VIRALITY_DISPLAY_SLOPE * (Math.log10(ratio) - Math.log10(VIRALITY_DISPLAY_ANCHOR));
  return Math.round(Math.max(0, Math.min(100, s)));
}

/**
 * Raw (unclamped) reach-per-follower ratio for a window. Feeds the virality
 * display score above and the leaderboard sort. Never feeds Knox.
 */
export function viralityRatioFor(p: Politician, isLifetime: boolean): number {
  const f = p.totals.followers;
  if (f <= 0) return 0;
  const views = isLifetime ? p.totals.views : p.totals.viewsInRange;
  const posts = isLifetime ? p.totals.posts : p.totals.postsInRange;
  return posts > 0 ? views / posts / f : 0;
}
