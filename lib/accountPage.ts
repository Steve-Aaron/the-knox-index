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

import type { AccountType, Politician } from '@/data/types';
import type { GroupingMode } from '@/lib/tenants';
import type {
  AccountKpis,
  AccountPeriodData,
  AccountPost,
  AccountProfile,
  ContentBreakdown,
  ContentDimension,
  ContentSlice,
  KeyStatRank,
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

// ── Key stats ─────────────────────────────────────────────────────────────────

/** Most specific role first; an account with several types ranks by its top one. */
const TYPE_PRIORITY: AccountType[] = [
  'prime_minister',
  'party_leader',
  'cabinet_minister',
  'shadow_cabinet_minister',
  'member_of_parliament',
  'council',
  'political_party',
  'other',
];

function primaryType(p: Politician): AccountType | undefined {
  const types = p.accountTypes ?? [];
  return TYPE_PRIORITY.find(t => types.includes(t)) ?? types[0];
}

/** Rank by Knox Factor inside one peer group (the target is always a member). */
function rankWithin(id: KeyStatRank['id'], label: string, target: Politician, peers: Politician[]): KeyStatRank {
  const sorted = [...peers].sort((a, b) => b.scores.knoxFactor - a.scores.knoxFactor);
  return { id, label, rank: sorted.findIndex(p => p.id === target.id) + 1, total: sorted.length };
}

/**
 * Peer-group ranks. Similar followers = between half and double the target's
 * count (follower counts are spread over four orders of magnitude, so fixed
 * bands would lump most accounts together). The third group is the tenant's
 * own grouping: party on The Knox Index, region on World Leaders.
 */
export function buildKeyStats(target: Politician, all: Politician[], grouping: GroupingMode): KeyStatRank[] {
  const stats: KeyStatRank[] = [];

  const type = primaryType(target);
  if (type) {
    stats.push(rankWithin('same_type', 'Among accounts of the same type', target, all.filter(p => primaryType(p) === type)));
  }

  const f = target.totals.followers;
  stats.push(rankWithin(
    'same_followers',
    'Among accounts with a similar number of followers',
    target,
    all.filter(p => p.id === target.id || (p.totals.followers >= f / 2 && p.totals.followers <= f * 2)),
  ));

  stats.push(rankWithin(
    grouping === 'region' ? 'same_region' : 'same_party',
    grouping === 'region' ? 'Among accounts from the same region' : 'Among accounts from the same party',
    target,
    all.filter(p => p.groupKey === target.groupKey),
  ));

  return stats;
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
  // Every TikTok post is a video. Other formats arrive with other platforms.
  type:     () => ['video'],
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
