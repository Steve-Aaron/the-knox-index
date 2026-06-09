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

/** The headline figures surfaced by KeyFindingsBar. */
export interface KeyFindings {
  /** Number of political accounts being tracked. */
  politicianCount: number;
  /** Total views summed across the posts that are actually shown (recentPosts). */
  totalViews: number;
  /** Mean views across the shown posts (0 when there are none). */
  avgViewsPerPost: number;
  /** Number of posts shown (basis for totalViews / avgViewsPerPost). */
  shownPostCount: number;
  /** Lifetime total number of tracked posts (fallback for the Total posts tile). */
  totalPosts: number;
  /** The single most-viewed post among those shown, or null when there are none. */
  topPost: PostWithOwner | null;
}

/**
 * Compute the headline figures from a set of politicians.
 *
 * totalViews / avgViewsPerPost are summed from the posts that actually SHOW
 * (recentPosts), so the headline matches what a user gets by adding up the
 * visible posts — not the separate cumulative `accountMetrics` totals.
 *
 * totalPosts stays as the cumulative per-account count, used only as a fallback
 * for the "Total posts" tile when the DB-wide count isn't supplied.
 */
export function computeKeyFindings(politicians: Politician[]): KeyFindings {
  const allPosts: PostWithOwner[] = politicians.flatMap(p =>
    (p.recentPosts ?? []).map(post => ({ ...post, politician: p }))
  );

  // Sum the posts that show, so the figure reconciles with the visible feed.
  const totalViews = allPosts.reduce((sum, p) => sum + (p.views ?? 0), 0);
  const shownPostCount = allPosts.length;
  const avgViewsPerPost = shownPostCount > 0 ? Math.round(totalViews / shownPostCount) : 0;

  const totalPosts = politicians.reduce((sum, p) => sum + (p.totals?.posts ?? 0), 0);

  const topPost =
    allPosts.length > 0
      ? allPosts.reduce((best, p) => (p.views > best.views ? p : best))
      : null;

  return {
    politicianCount: politicians.length,
    totalViews,
    avgViewsPerPost,
    shownPostCount,
    totalPosts,
    topPost,
  };
}
