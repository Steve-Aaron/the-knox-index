/**
 * lib/keyFindings.ts
 * -------------------
 * Pure aggregation for the headline stats strip (KeyFindingsBar).
 *
 * Kept free of React / React Native so the maths can be unit-tested in
 * isolation. The component is responsible for presentation only; this
 * module owns the numbers.
 *
 * One job: turn a list of politicians into the five headline figures.
 */

import type { Politician, RecentPost } from '@/data/types';

/** A post with a back-reference to the politician who posted it. */
export interface PostWithOwner extends RecentPost {
  politician: Politician;
}

/** The five headline figures surfaced by KeyFindingsBar. */
export interface KeyFindings {
  /** Number of political accounts being tracked. */
  politicianCount: number;
  /** Lifetime views across every post from all tracked accounts. */
  totalViews: number;
  /** Lifetime mean views per post (0 when there are no posts). */
  avgViewsPerPost: number;
  /** Lifetime total number of tracked posts. */
  totalPosts: number;
  /** The single most-viewed post among those loaded, or null when there are none. */
  topPost: PostWithOwner | null;
}

/**
 * Compute the five headline figures from a set of politicians.
 *
 * The scorecard reports LIFETIME figures, so the aggregates are summed from
 * each account's cumulative `totals` (totals.views / totals.posts) rather than
 * the range-scoped `recentPosts`. This makes the strip independent of the
 * dashboard's time-range picker.
 *
 * "Top performing post" is the most-viewed post among those currently loaded
 * (recentPosts) — there is no lifetime post-level feed in the payload, so this
 * is the best available rather than a strict all-time maximum.
 */
export function computeKeyFindings(politicians: Politician[]): KeyFindings {
  const allPosts: PostWithOwner[] = politicians.flatMap(p =>
    (p.recentPosts ?? []).map(post => ({ ...post, politician: p }))
  );

  // Lifetime aggregates — cumulative per-account totals, not range-scoped posts.
  const totalViews = politicians.reduce((sum, p) => sum + (p.totals?.views ?? 0), 0);
  const totalPosts = politicians.reduce((sum, p) => sum + (p.totals?.posts ?? 0), 0);
  const avgViewsPerPost = totalPosts > 0 ? Math.round(totalViews / totalPosts) : 0;

  const topPost =
    allPosts.length > 0
      ? allPosts.reduce((best, p) => (p.views > best.views ? p : best))
      : null;

  return {
    politicianCount: politicians.length,
    totalViews,
    avgViewsPerPost,
    totalPosts,
    topPost,
  };
}
