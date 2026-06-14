/**
 * data/leaderboard.ts
 * -------------------
 * CLIENT-SAFE leaderboard selector. A pure picker over already-computed
 * Politician data — it contains NO Knox Factor formula, only the logic for
 * choosing which precomputed score the leaderboard ranks/displays.
 *
 * Kept apart from data/transformers.ts on purpose: transformers imports the
 * server-only formula (data/knoxFactor.server.ts), so importing anything from
 * it into a client component would drag the whole formula into the client
 * bundle. RankBoard / RankBoardRow import from HERE instead.
 */

import type { Politician, TopTrumpScores } from './types';

/**
 * The score the leaderboard ranks and displays for a given sort key.
 *
 * SINGLE source of scoring: this always reads the SQL-matching `scores`. There
 * is no range-scoped recompute — every axis and the Knox Factor come from the
 * one calculation in data/transformers.ts, so the leaderboard shows the same
 * numbers as the canonical query under every date filter. The trailing arg is
 * kept only for call-site compatibility and is ignored.
 */
export function leaderboardScore(p: Politician, key: keyof TopTrumpScores, _isLifetime?: boolean): number {
  return p.scores[key];
}
