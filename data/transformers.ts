/**
 * data/transformers.ts
 * ----------------------
 * Converts raw BigQuery rows into the Politician[] shape used by all
 * components. Field names match the confirmed ariadne_tiktok_demo schema.
 */

import type { Politician, TopTrumpScores, RecentPost } from './types';
import type { PartyKey } from '@/theme/colors';
import { toPartyKeyPublic } from './partyUtils';
import { computeKnoxFactor } from './knoxConfig';

// ── Raw BQ row shapes ─────────────────────────────────────────────────────────

/** account JOIN accountMetrics (latest dateUpdated) */
export interface BQAccountRow {
  // account
  id:              number;
  name:            string;    // display name
  profile:         string;    // TikTok handle — also the join key to post.profile
  party:           string;
  affiliation:     string;    // e.g. 'MP, Ashton-under-Lyne'
  totalFollowing:  number;
  totalFollowers:  number;
  // accountMetrics (latest row)
  totalPosts:      number;
  totalLikes:      number;
  totalViews:      number;
  totalComments:   number;
  totalShares:     number;
  totalSaves:      number;
  postsToday:      number;
  postsThisWeek:   number;
  viewsToday:      number;
  likesToday:      number;
  commentsToday:   number;
  savesToday:      number;
  followerChange:  number | null;
}

/** post rows — linked to account via post.profile = account.profile */
export interface BQPostRow {
  postId:        number;
  profile:       string;    // matches account.profile
  caption:       string;
  videoSummary:  string;
  views:         number;
  likes:         number;
  comments:      number;
  shares:        number;
  saves:         number;
  reposts:       number;
  postDate:      string;
  postUrl:       string;
  coverJpeg:     string;
  videoMp4:      string;
  style:         string;
}

// Re-export for backward compat; use toPartyKeyPublic from partyUtils for new code.
const toPartyKey = toPartyKeyPublic;

/**
 * Normalise a profile handle: strip a leading '@' and tolerate null / undefined.
 * BigQuery LTRIM(null, '@') returns null, and some post / account rows can have
 * a null profile, so a plain string.replace would throw
 * 'Cannot read properties of null (reading replace)'.
 */
function normProfile(p: string | null | undefined): string {
  return (p ?? '').replace(/^@/, '');
}

function toInitials(name: string): string {
  if (!name) return '';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ── Score normalisation ───────────────────────────────────────────────────────

function normalise(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round(Math.min(100, (value / max) * 100));
}

interface ScoreMaxValues {
  avgViews:        number;
  engagementRate:  number;   // (likes + comments + shares) / views
  postsThisWeek:   number;   // posts in the past 7 days
  totalFollowers:  number;
}

function computeMaxValues(
  rows: BQAccountRow[],
  postsByProfile: Map<string, BQPostRow[]>
): ScoreMaxValues {
  let maxAvgViews = 1, maxEngRate = 1, maxPostsThisWeek = 1, maxFollowers = 1;

  for (const acc of rows) {
    const posts      = postsByProfile.get(normProfile(acc.profile)) ?? [];
    const totalViews = posts.reduce((s, p) => s + (p.views ?? 0), 0);
    const avgViews   = posts.length > 0 ? totalViews / posts.length : 0;
    const engViews   = Math.max(acc.totalViews ?? 1, 1);
    const engRate    = ((acc.totalLikes + acc.totalComments + acc.totalShares) / engViews) * 100;

    if (avgViews              > maxAvgViews)       maxAvgViews       = avgViews;
    if (engRate               > maxEngRate)        maxEngRate        = engRate;
    if (acc.postsThisWeek     > maxPostsThisWeek)  maxPostsThisWeek  = acc.postsThisWeek;
    if (acc.totalFollowers    > maxFollowers)       maxFollowers      = acc.totalFollowers;
  }

  return { avgViews: maxAvgViews, engagementRate: maxEngRate, postsThisWeek: maxPostsThisWeek, totalFollowers: maxFollowers };
}

function computeScores(
  acc: BQAccountRow,
  posts: BQPostRow[],
  max: ScoreMaxValues
): TopTrumpScores {
  const totalViews = posts.reduce((s, p) => s + (p.views ?? 0), 0);
  const avgViews   = posts.length > 0 ? totalViews / posts.length : 0;
  const engViews   = Math.max(acc.totalViews ?? 1, 1);
  const engRate    = ((acc.totalLikes + acc.totalComments + acc.totalShares) / engViews) * 100;

  const views      = normalise(avgViews,          max.avgViews);
  const engagement = normalise(engRate,            max.engagementRate);
  const frequency  = normalise(acc.postsThisWeek,  max.postsThisWeek);
  const followers  = normalise(acc.totalFollowers, max.totalFollowers);

  const knoxFactor = computeKnoxFactor(views, engagement, frequency, followers);

  return { views, engagement, frequency, followers, knoxFactor };
}

// ── Post transformer ──────────────────────────────────────────────────────────

/** Safely coerce a BigQuery DATE value to a plain string.
 *  The BQ Node client returns DATE fields as { value: 'YYYY-MM-DD' }
 *  when not explicitly CAST to STRING in the SQL. */
function toDateStr(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  // BigQuery Date object: { value: 'YYYY-MM-DD' }
  const bqDate = v as { value?: string };
  if (typeof bqDate.value === 'string') return bqDate.value;
  return undefined;
}

function transformPost(row: BQPostRow): RecentPost {
  return {
    postId:    String(row.postId),
    caption:   row.caption      ?? '(no caption)',
    views:     row.views        ?? 0,
    likes:     row.likes        ?? 0,
    summary:   row.videoSummary || undefined,
    style:     row.style        || undefined,
    coverJpeg: row.coverJpeg    || undefined,
    videoMp4:  row.videoMp4     || undefined,
    postUrl:   row.postUrl      || undefined,
    postDate:  toDateStr(row.postDate),
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function transformToPoliticians(
  accountRows: BQAccountRow[],
  postRows:    BQPostRow[]
): Politician[] {
  // Group posts by normalised profile handle.
  // account.profile = '@uklabour', post.profile = 'uklabour' — strip the
  // leading '@' on both sides so the lookup always matches.
  // Skip posts with no profile, they can't link back to an account anyway.
  const postsByProfile = new Map<string, BQPostRow[]>();
  for (const post of postRows) {
    const key = normProfile(post.profile);
    if (!key) continue;
    const bucket = postsByProfile.get(key) ?? [];
    bucket.push(post);
    postsByProfile.set(key, bucket);
  }

  const max = computeMaxValues(accountRows, postsByProfile);

  return accountRows.map((acc): Politician => {
    const posts = (postsByProfile.get(normProfile(acc.profile)) ?? []).slice(0, 5);
    const scores      = computeScores(acc, posts, max);

    return {
      id:             String(acc.id),
      name:           acc.name ?? '',
      handle:         acc.profile ?? '',
      role:           acc.affiliation ?? '',
      partyKey:       toPartyKey(acc.party),
      partyLabel:     acc.party ?? 'Unknown',
      country:        'UK',
      avatarInitials: toInitials(acc.name ?? ''),
      totals: {
        posts:          acc.totalPosts     ?? 0,
        followers:      acc.totalFollowers ?? 0,
        followerChange: acc.followerChange ?? null,
        likes:          acc.totalLikes     ?? 0,
        views24h:       acc.viewsToday     ?? 0,
        likesToday:     acc.likesToday     ?? 0,
        commentsToday:  acc.commentsToday  ?? 0,
        savesToday:     acc.savesToday     ?? 0,
        postsToday:     acc.postsToday     ?? 0,
        postsThisWeek:  acc.postsThisWeek  ?? 0,
      },
      scores,
      recentPosts: posts.map(transformPost),
    };
  });
}
