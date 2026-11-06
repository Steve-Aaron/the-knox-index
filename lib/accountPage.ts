/**
 * lib/accountPage.ts
 * -------------------
 * Builds the account page view-model (data/account/types.ts) from rows the
 * /api/account-page route has already fetched. Server-side, no I/O.
 *
 * Platform-agnostic: the route passes rows from whichever platforms the
 * filter selects (TikTok, X or both, see app/api/account-page+api.ts).
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
  StandingRow,
} from '@/data/account/types';
import { postEngagementRate } from '@/lib/postMetrics';
import { fmtTopic } from '@/lib/topicLabel';
import { toTweetData, type RawTweet } from '@/lib/xPosts';

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
  /** The topics on the final list: parent plus subtopic (null when the tag is
   *  the parent itself). A null parent is an old TikTok topic with no map. */
  subjects?:    { parent: string | null; sub: string | null }[] | null;
  /** Set on X rows (lib/xQueries.ts buildXAccountPagePostsSQL). */
  platform?:    'tiktok' | 'x';
  tweetJson?:   string | null;
  /** video, photo, poll, quote, link or text. TikTok rows are all video. */
  contentType?: string | null;
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
    // One link per platform account behind the person.
    socials:    politician.platforms?.length
      ? politician.platforms.map(pr => ({ platform: pr.platform, handle: `@${pr.handle.replace(/^@/, '')}`, url: pr.url }))
      : [{ platform: 'tiktok', handle: `@${handle}`, url: `https://www.tiktok.com/@${handle}` }],
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

/** Standings tab name for each account type. */
const TYPE_TAB: Partial<Record<AccountType, string>> = {
  prime_minister:          'Leaders',
  party_leader:            'Leaders',
  cabinet_minister:        'Cabinet',
  shadow_cabinet_minister: 'Shadow cabinet',
  member_of_parliament:    'MPs',
  council:                 'Councils',
  political_party:         'Party pages',
};

/** Rows shown either side of the account in a standings window. */
const WINDOW_EACH_SIDE = 2;

function standingRow(p: Politician, rank: number, target: Politician): StandingRow {
  return {
    rank,
    name:       p.name,
    slug:       p.slug ?? p.handle.replace(/^@/, ''),
    avatarUrl:  p.avatarUrl,
    initials:   p.avatarInitials,
    groupKey:   p.groupKey,
    groupLabel: p.groupLabel,
    knoxFactor: p.scores.knoxFactor,
    isTarget:   p.id === target.id,
  };
}

/**
 * Rank by Knox Factor inside one peer group (the target is always a member),
 * with the accounts just above and below. The window keeps five rows at the
 * top and bottom of the table by shifting rather than shrinking.
 */
function rankWithin(id: KeyStatRank['id'], label: string, short: string, target: Politician, peers: Politician[]): KeyStatRank {
  const sorted = [...peers].sort((a, b) => b.scores.knoxFactor - a.scores.knoxFactor);
  const at = sorted.findIndex(p => p.id === target.id);
  const size = WINDOW_EACH_SIDE * 2 + 1;
  const start = Math.max(0, Math.min(at - WINDOW_EACH_SIDE, sorted.length - size));
  const neighbours = sorted.slice(start, start + size).map((p, i) => standingRow(p, start + i + 1, target));
  return { id, label, short, rank: at + 1, total: sorted.length, neighbours };
}

/**
 * Peer-group ranks. Similar followers = between half and double the target's
 * count (follower counts are spread over four orders of magnitude, so fixed
 * bands would lump most accounts together). The third group is the tenant's
 * own grouping: party on The Knox Index, region on World Leaders.
 */
export function buildKeyStats(target: Politician, all: Politician[], grouping: GroupingMode): KeyStatRank[] {
  const stats: KeyStatRank[] = [];

  stats.push(rankWithin(
    grouping === 'region' ? 'same_region' : 'same_party',
    grouping === 'region' ? 'Among accounts from the same region' : 'Among accounts from the same party',
    grouping === 'region' ? 'Region' : 'Party',
    target,
    all.filter(p => p.groupKey === target.groupKey),
  ));

  stats.push(rankWithin('all', 'Among all tracked accounts', 'All', target, all));

  // 'other' is the fallback type, so on a dashboard without a taxonomy
  // (World Leaders) the type group is everyone: leave it out there.
  const type = primaryType(target);
  if (type && type !== 'other') {
    const typeTab = rankWithin('same_type', 'Among accounts of the same type', TYPE_TAB[type] ?? 'Type', target, all.filter(p => primaryType(p) === type));
    // A party's own page compares first with other party pages
    if (type === 'political_party') stats.unshift(typeTab); else stats.push(typeTab);
  }

  const f = target.totals.followers;
  stats.push(rankWithin(
    'same_followers',
    'Among accounts with a similar number of followers',
    'Size',
    target,
    all.filter(p => p.id === target.id || (p.totals.followers >= f / 2 && p.totals.followers <= f * 2)),
  ));

  return stats;
}

// ── Period data ───────────────────────────────────────────────────────────────

/** Bucket for old TikTok topics not yet mapped onto the final topic list. */
const UNMAPPED_KEY = 'unmapped';

/**
 * A subtopic gets its own slice (e.g. Sudan, not Foreign affairs) once it is
 * used on at least this many posts and this share of the account's subject
 * tags in the period. Agreed 29 Oct: parent topics, with standouts.
 */
const STANDOUT_MIN_POSTS = 3;
const STANDOUT_MIN_SHARE = 0.15;
/** Below this many tagged posts no subtopic stands out: the sample is too small. */
const STANDOUT_MIN_SAMPLE = 10;

/** Stored topic or style name → display label; 'Other' when nothing is left. */
function tagLabel(name: string): string {
  return fmtTopic(name) || 'Other';
}

/** A standout subtopic's key keeps its parent: 'ELECTIONS/CAMPAIGNS'. */
const SUB_SEP = '/';

function sliceLabel(key: string): string {
  if (key === UNMAPPED_KEY) return 'Other topics';
  const [parent, sub] = key.split(SUB_SEP);
  return sub ? `${tagLabel(parent)} · ${tagLabel(sub)}` : tagLabel(parent);
}

type TagFn = (row: BQAccountPagePostRow) => string[];

/**
 * Tag uses per tag, and the full views of the posts that carry it. A post
 * counts once per distinct tag; views are not split across tags, so they
 * feed an average, never a share. Untagged posts are counted apart.
 */
function tally(rows: BQAccountPagePostRow[], tags: TagFn) {
  const byTag = new Map<string, { posts: number; views: number }>();
  let uses = 0;
  let untagged = 0;
  for (const row of rows) {
    const keys = [...new Set(tags(row))];
    if (keys.length === 0) { untagged += 1; continue; }
    for (const key of keys) {
      const t = byTag.get(key) ?? { posts: 0, views: 0 };
      t.posts += 1;
      t.views += row.views;
      byTag.set(key, t);
      uses += 1;
    }
  }
  return { byTag, uses, untagged };
}

/**
 * Every tag as a slice, by share of tag uses (what the account mostly posts
 * about), largest first. Grouping the tail into "Other" for the donut is a
 * display rule, so it happens client-side (contentGroups.ts).
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

  const share     = (n: number, total: number) => (total > 0 ? n / total : 0);
  const prevShare = (key: string) => share(prev.byTag.get(key)?.posts ?? 0, prev.uses);

  const slices: ContentSlice[] = [...cur.byTag.entries()]
    .sort((a, b) => b[1].posts - a[1].posts || b[1].views - a[1].views)
    .map(([key, t]) => ({
      key,
      label:    sliceLabel(key),
      posts:    t.posts,
      views:    t.views,
      avgViews: Math.round(t.views / t.posts),
      share:    share(t.posts, cur.uses),
      deltaPp:  prev.uses > 0 ? (share(t.posts, cur.uses) - prevShare(key)) * 100 : null,
    }));

  return {
    totalPosts:         current.length,
    taggedPosts:        current.length - cur.untagged,
    untaggedPosts:      cur.untagged,
    avgViewsPerPost:    current.length ? Math.round(totalViews / current.length) : 0,
    totalViews,
    totalViewsDeltaPct: prevViews > 0 ? ((totalViews - prevViews) / prevViews) * 100 : 0,
    slices,
  };
}

/**
 * Subject keys per post: the parent topic, or the subtopic itself when it
 * stands out in `rows` (see STANDOUT_MIN_*). The same choice is applied to
 * the previous period so the deltas compare like with like.
 */
function subjectTags(rows: BQAccountPagePostRow[]): TagFn {
  const subPosts = new Map<string, number>();
  let uses = 0;
  let tagged = 0;
  for (const row of rows) {
    const list = row.subjects ?? [];
    if (list.length) tagged += 1;
    uses += new Set(list.map(t => t.parent ?? UNMAPPED_KEY)).size;
    for (const sub of new Set(list.map(t => t.sub).filter((x): x is string => !!x))) {
      subPosts.set(sub, (subPosts.get(sub) ?? 0) + 1);
    }
  }
  const standout = new Set(
    tagged < STANDOUT_MIN_SAMPLE ? [] : [...subPosts.entries()]
      .filter(([, n]) => n >= STANDOUT_MIN_POSTS && uses > 0 && n / uses >= STANDOUT_MIN_SHARE)
      .map(([sub]) => sub),
  );
  return r => {
    const list = r.subjects ?? [];
    // On a post with a standout, the standout replaces its parent
    const replaced = new Set(list.filter(t => t.sub && t.parent && standout.has(t.sub)).map(t => t.parent));
    return list.flatMap(t => {
      if (t.sub && t.parent && standout.has(t.sub)) return [`${t.parent}${SUB_SEP}${t.sub}`];
      if (t.parent && replaced.has(t.parent)) return [];
      return [t.parent ?? UNMAPPED_KEY];
    });
  };
}

const CONTENT_TAGS: Record<Exclude<ContentDimension, 'subjects'>, TagFn> = {
  // Every TikTok post is a video; X posts carry their own format.
  type:     r => [r.contentType ?? 'video'],
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
    platform:       row.platform ?? 'tiktok',
    tweet:          row.tweetJson ? toTweetData(JSON.parse(row.tweetJson) as RawTweet) : undefined,
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

export function buildPeriod(
  politician: Politician,
  rows: BQAccountPagePostRow[],
  /** One row per platform in the filter; each becomes a radar series. */
  platformRows: Politician[] = [politician],
): AccountPeriodData {
  const current  = rows.filter(r => r.period === 'current');
  const previous = rows.filter(r => r.period === 'previous');
  const followers = politician.totals.followers;

  const radar: AccountPeriodData['radar'] = {};
  for (const row of platformRows) {
    const s = row.scores;
    radar[row.platform === 'x' ? 'x' : 'tiktok'] =
      { virality: s.virality, activity: s.frequency, engagement: s.engagement, followers: s.followers, knoxFactor: s.knoxFactor };
  }

  return {
    kpis:  buildKpis(current, followers),
    // Filled in by the route, which reads the follower snapshots
    followerGrowth: null,
    radar,
    content: {
      type:     buildBreakdown(current, previous, CONTENT_TAGS.type),
      subjects: buildBreakdown(current, previous, subjectTags(current)),
      styles:   buildBreakdown(current, previous, CONTENT_TAGS.styles),
    },
    posts: [...current]
      .sort((a, b) => b.views - a.views)
      .slice(0, MAX_POSTS)
      .map(r => toAccountPost(r, followers)),
  };
}
