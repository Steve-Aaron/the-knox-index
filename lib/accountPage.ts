/**
 * lib/accountPage.ts
 * -------------------
 * Builds the account page view-model (data/account/types.ts) from rows the
 * /api/account-page route has already fetched. Server-side, no I/O.
 *
 * TikTok is the only platform with data today: X appears in the contract but
 * is never filled, so the page hides it.
 *
 * One job: turn politicians + one account's posts into AccountPageApiResponse.
 */

import type { Politician } from '@/data/types';
import type {
  AccountKpis,
  AccountPeriodData,
  AccountPost,
  AccountProfile,
  ContentBreakdown,
  ContentDimension,
  ContentSlice,
  ComparisonRow,
} from '@/data/account/types';
import { postEngagementRate } from '@/lib/postMetrics';

/** One row of buildAccountPagePostsSQL. */
export interface BQAccountPagePostRow {
  postId:       string;
  period:       'current' | 'previous';
  caption:      string | null;
  videoSummary: string | null;
  views:        number;
  likes:        number;
  comments:     number;
  shares:       number;
  saves:        number;
  postDate:     string | null;
  postUrl:      string | null;
  coverJpeg:    string | null;
  videoMp4:     string | null;
  /** 'Video', 'Carousel' or 'Image with Audio'; null on a few posts. */
  postType:     string | null;
  styles:       string[] | null;
  topics:       string[] | null;
}

// ── Profile ───────────────────────────────────────────────────────────────────

export function buildProfile(
  politician: Politician,
  all: Politician[],
  lastPostDate: string | null,
): AccountProfile {
  const handle = politician.handle.replace(/^@/, '');
  return {
    politician,
    // No score history yet, so there is nothing to compare against.
    knoxFactor:  { score: politician.scores.knoxFactor, deltaVsPrev: null },
    affiliation: {
      label:       politician.groupLabel,
      memberCount: all.filter(p => p.groupKey === politician.groupKey).length,
    },
    socials:    [{ platform: 'tiktok', handle: `@${handle}`, url: `https://www.tiktok.com/@${handle}` }],
    lastPostAt: lastPostDate ?? '',
  };
}

// ── Comparison ────────────────────────────────────────────────────────────────

/** Rows on the Comparison card: the account and two either side. */
const COMPARISON_ROWS = 5;

/**
 * The account's slice of the main-page Knox Factor leaderboard (RankBoard
 * with no filters): accounts that posted in the range, by Knox Factor. The
 * window shifts at either end so it always holds COMPARISON_ROWS rows when
 * there are enough accounts. Empty when the account has no posts in range.
 */
export function buildComparison(target: Politician, all: Politician[]): ComparisonRow[] {
  const ranked = all
    .filter(p => p.totals.postsInRange > 0)
    .sort((a, b) => b.scores.knoxFactor - a.scores.knoxFactor);
  const at = ranked.findIndex(p => p.id === target.id);
  if (at < 0) return [];

  const start = Math.max(0, Math.min(at - 2, ranked.length - COMPARISON_ROWS));
  return ranked.slice(start, start + COMPARISON_ROWS).map((p, i) => ({
    rank:           start + i + 1,
    handle:         p.handle.replace(/^@+/, ''),
    name:           p.name,
    partyLabel:     p.partyLabel,
    groupKey:       p.groupKey,
    avatarInitials: p.avatarInitials,
    avatarUrl:      p.avatarUrl,
    knoxFactor:     Math.round(p.scores.knoxFactor),
    isSelf:         p.id === target.id,
  }));
}

// ── Period data ───────────────────────────────────────────────────────────────

/** Bucket for posts with no tag in the dimension. */
const UNTAGGED_KEY = 'untagged';

/** 'COST_OF_LIVING' → 'Cost of living'. Drops stray HTML entities and symbols. */
function tagLabel(name: string): string {
  const words = name.replace(/&[a-z]+;/gi, '').replace(/[^A-Za-z0-9_ ]/g, '').replace(/_/g, ' ').trim().toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Other';
}

type TagFn = (row: BQAccountPagePostRow) => string[];

/**
 * Views per tag, with each post's views split evenly across its tags so the
 * shares add up to 100%. Untagged posts get their own bucket. Post counts
 * stay whole: a post with three topics counts once in each.
 */
function tally(rows: BQAccountPagePostRow[], tags: TagFn) {
  const byTag = new Map<string, { posts: number; views: number }>();
  for (const row of rows) {
    const list = tags(row);
    const keys = list.length ? list : [UNTAGGED_KEY];
    for (const key of keys) {
      const t = byTag.get(key) ?? { posts: 0, views: 0 };
      t.posts += 1;
      t.views += row.views / keys.length;
      byTag.set(key, t);
    }
  }
  return byTag;
}

/**
 * Every tag as a slice, largest first. Grouping the tail into "Other" for the
 * donut is a display rule, so it happens client-side (contentGroups.ts) and
 * the table can still list every tag.
 */
function buildBreakdown(
  current: BQAccountPagePostRow[],
  previous: BQAccountPagePostRow[],
  tags: TagFn,
): ContentBreakdown {
  const totalViews = current.reduce((s, r) => s + r.views, 0);
  const prevViews  = previous.reduce((s, r) => s + r.views, 0);
  const cur  = tally(current, tags);
  const prev = tally(previous, tags);

  const share     = (v: number, total: number) => (total > 0 ? v / total : 0);
  const prevShare = (key: string) => share(prev.get(key)?.views ?? 0, prevViews);

  const slices: ContentSlice[] = [...cur.entries()]
    .sort((a, b) => b[1].views - a[1].views)
    .map(([key, t]) => ({
      key,
      label:   key === UNTAGGED_KEY ? 'Untagged' : tagLabel(key),
      posts:   t.posts,
      views:   Math.round(t.views),
      share:   share(t.views, totalViews),
      deltaPp: prevViews > 0 ? (share(t.views, totalViews) - prevShare(key)) * 100 : 0,
    }));

  return {
    totalPosts:         current.length,
    avgViewsPerPost:    current.length ? Math.round(totalViews / current.length) : 0,
    totalViews,
    totalViewsDeltaPct: prevViews > 0 ? ((totalViews - prevViews) / prevViews) * 100 : 0,
    slices,
  };
}

const CONTENT_TAGS: Record<ContentDimension, TagFn> = {
  // A post has one format; posts without one go to Untagged.
  type:     r => (r.postType ? [r.postType] : []),
  subjects: r => r.topics ?? [],
  styles:   r => r.styles ?? [],
};

function buildKpis(current: BQAccountPagePostRow[], followers: number): AccountKpis {
  const sum = (k: 'views' | 'likes' | 'comments' | 'shares' | 'saves') => current.reduce((s, r) => s + r[k], 0);
  const views = sum('views');
  return {
    posts:           current.length,
    followers,
    avgViewsPerPost: current.length ? Math.round(views / current.length) : 0,
    totalLikes:      sum('likes'),
    engagementRate:  postEngagementRate({
      views, likes: sum('likes'), comments: sum('comments'), shares: sum('shares'), saves: sum('saves'),
    }),
  };
}

function toAccountPost(row: BQAccountPagePostRow, followers: number): AccountPost {
  return {
    id:             row.postId,
    platform:       'tiktok',
    caption:        row.caption ?? '',
    postDate:       row.postDate ?? '',
    views:          row.views,
    likes:          row.likes,
    comments:       row.comments,
    shares:         row.shares,
    saves:          row.saves,
    engagementRate: postEngagementRate(row),
    virality:       followers > 0 ? row.views / followers : 0,
    summary:        row.videoSummary || undefined,
    styles:         row.styles ?? [],
    topics:         row.topics ?? [],
    coverJpeg:      row.coverJpeg || undefined,
    videoMp4:       row.videoMp4 || undefined,
    postUrl:        row.postUrl ?? '',
  };
}

/** Best posts return at most this many (by views), to keep lifetime responses small. */
const MAX_POSTS = 500;

export function buildPeriod(politician: Politician, rows: BQAccountPagePostRow[]): AccountPeriodData {
  const current  = rows.filter(r => r.period === 'current');
  const previous = rows.filter(r => r.period === 'previous');
  const followers = politician.totals.followers;
  const s = politician.scores;

  return {
    kpis:  buildKpis(current, followers),
    radar: {
      tiktok: { virality: s.virality, activity: s.frequency, engagement: s.engagement, followers: s.followers, knoxFactor: s.knoxFactor },
    },
    content: {
      type:     buildBreakdown(current, previous, CONTENT_TAGS.type),
      subjects: buildBreakdown(current, previous, CONTENT_TAGS.subjects),
      styles:   buildBreakdown(current, previous, CONTENT_TAGS.styles),
    },
    posts: [...current]
      .sort((a, b) => b.views - a.views)
      .slice(0, MAX_POSTS)
      .map(r => toAccountPost(r, followers)),
  };
}
