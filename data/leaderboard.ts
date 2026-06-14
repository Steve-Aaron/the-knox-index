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
 * Raw (unclamped) reach-per-follower ratio. Used ONLY as a leaderboard
 * tie-breaker so accounts that clamp to the same virality score still order by
 * true reach. Never feeds the displayed score or Knox.
 */
export function viralityRatioFor(p: Politician, isLifetime: boolean): number {
  const f = p.totals.followers;
  if (f <= 0) return 0;
  const views = isLifetime ? p.totals.views : p.totals.viewsInRange;
  const posts = isLifetime ? p.totals.posts : p.totals.postsInRange;
  return posts > 0 ? views / posts / f : 0;
}
