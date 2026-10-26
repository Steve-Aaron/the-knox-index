/**
 * lib/platformMerge.ts
 * ---------------------
 * Builds the 'All platforms' view: one Politician per PERSON, from that
 * person's TikTok and X rows. Pure — no I/O.
 *
 * KitSoft's discovery doc (section 7.1.1) asks for an aggregation rule per
 * metric rather than one blanket answer. The rules used here, provisional
 * until the cross-platform scoring algorithm is defined:
 *
 *   counts (posts, views, likes, comments, saves, shares, followers)
 *       → summed. Views are 'times the post was shown' on both platforms.
 *         Followers are summed audiences; people who follow on both are
 *         counted twice, so the label says 'combined followers'.
 *   score axes and Knox Factor (0..100)
 *       → mean of the person's per-platform scores. Each platform is scored
 *         against its own dataset first, so the two are on the same scale.
 *         A person on one platform keeps that platform's score.
 *   identity (name, photo, title, region, coordinates)
 *       → the TikTok row when there is one, else the X row (same as the
 *         metadata.person_photo view: TikTok first, X as fallback).
 *   recent posts → both platforms, newest first, five kept.
 *
 * One job: merge a person's platform rows.
 */

import type { Politician, TopTrumpScores } from '@/data/types';

type Totals = Politician['totals'];

const SUMMED: (keyof Totals)[] = [
  'posts', 'followers', 'likes', 'views', 'views24h', 'likesToday', 'commentsToday',
  'savesToday', 'postsToday', 'postsThisWeek', 'postsInRange', 'viewsInRange',
  'likesInRange', 'commentsInRange', 'savesInRange', 'sharesInRange',
  'lifetimePostViews', 'lifetimePostCount', 'lifetimePostInteractions',
];

const SCORE_KEYS: (keyof TopTrumpScores)[] = ['virality', 'frequency', 'engagement', 'followers', 'knoxFactor'];

function mergePerson(rows: Politician[]): Politician {
  const primary = rows.find(r => r.platform === 'tiktok') ?? rows[0];
  if (rows.length === 1) return { ...primary, platform: 'all' };

  const totals = { ...primary.totals };
  for (const key of SUMMED) {
    (totals[key] as number) = rows.reduce((t, r) => t + ((r.totals[key] as number) ?? 0), 0);
  }
  const changes = rows.map(r => r.totals.followerChange).filter((c): c is number => c != null);
  totals.followerChange = changes.length ? changes.reduce((a, b) => a + b, 0) : null;

  const scores = { ...primary.scores };
  for (const key of SCORE_KEYS) {
    scores[key] = Math.round(rows.reduce((t, r) => t + r.scores[key], 0) / rows.length);
  }

  const recentPosts = rows
    .flatMap(r => r.recentPosts ?? [])
    .sort((a, b) => (b.tweet?.createdAt ?? b.postDate ?? '').localeCompare(a.tweet?.createdAt ?? a.postDate ?? ''))
    .slice(0, 5);

  return {
    ...primary,
    id:          `person:${primary.personId}`,
    avatarUrl:   primary.avatarUrl ?? rows.find(r => r.avatarUrl)?.avatarUrl,
    platform:    'all',
    platforms:   rows.flatMap(r => r.platforms ?? []),
    totals,
    scores,
    recentPosts,
  };
}

/**
 * One row per person. Rows without a personId cannot be matched across
 * platforms and pass through on their own.
 */
export function mergeByPerson(...platformRows: Politician[][]): Politician[] {
  const byPerson = new Map<string, Politician[]>();
  const unlinked: Politician[] = [];
  for (const row of platformRows.flat()) {
    if (!row.personId) { unlinked.push({ ...row, platform: 'all' }); continue; }
    byPerson.set(row.personId, [...(byPerson.get(row.personId) ?? []), row]);
  }
  return [...[...byPerson.values()].map(mergePerson), ...unlinked];
}
