import type { Politician, PostBenchmarks } from '@/data/types';
import type { TimeRange } from '@/components/dashboard/TimeRangePicker';

/**
 * data/account/types.ts
 * ----------------------
 * View-model for the account page (/account/[handle]). This is the contract
 * the page renders from. GET /api/account-page returns everything except
 * postBenchmarks, which comes from /api/benchmarks (see ./useAccountPage.ts).
 *
 * Split in two:
 *   - range-independent: profile + key stats (who the account is)
 *   - range/platform-scoped: AccountPeriodData (how it performed)
 */

export type { TimeRange };

/** Platform filter on the page. 'all' merges every connected platform. */
export type AccountPlatform = 'all' | 'tiktok' | 'x';

/** A concrete social platform — never 'all'. */
export type SocialPlatform = Exclude<AccountPlatform, 'all'>;

// ── Profile ──────────────────────────────────────────────────────────────────

export interface KnoxFactorSnapshot {
  /** 0..100 */
  score:        number;
  /** Points vs the previous week. Positive = improved. null = not tracked
   *  yet (no score history), and the trend line is hidden. */
  deltaVsPrev:  number | null;
}

export interface SocialProfile {
  platform: SocialPlatform;
  handle:   string;
  url:      string;
}

export interface AccountAffiliation {
  /** Display name of the group, e.g. 'Reform'. */
  label:       string;
  /** Tracked accounts in that group. */
  memberCount: number;
}

export interface AccountProfile {
  /** Identity, colour key and totals. Same shape the dashboard uses, so
   *  shared components (CardAvatar, FollowerQualityFlag) work unchanged. */
  politician:  Politician;
  knoxFactor:  KnoxFactorSnapshot;
  affiliation: AccountAffiliation;
  socials:     SocialProfile[];
  /** ISO timestamp of the most recent post on any platform. */
  lastPostAt:  string;
}

// ── Key stats ────────────────────────────────────────────────────────────────

export interface KeyStatRank {
  id:    string;
  /** Peer group the rank is computed in, e.g. 'Among accounts of the same type'. */
  label: string;
  /** Short tab name for the standings card, e.g. 'Party'. */
  short: string;
  rank:  number;
  total: number;
  /** The account and the accounts ranked just above and below it. */
  neighbours: StandingRow[];
}

/** One row of a standings window. */
export interface StandingRow {
  rank:       number;
  name:       string;
  /** Account page slug. */
  slug:       string;
  avatarUrl?: string;
  initials:   string;
  groupKey:   string;
  groupLabel: string;
  knoxFactor: number;
  isTarget:   boolean;
}

/** Followers gained over the period, TikTok and X added together. */
export interface FollowerGrowth {
  gained: number;
  /** gained / start, 0..n. */
  pct:    number;
  /** First snapshot used, YYYY-MM-DD. */
  since:  string;
}

// ── Period-scoped data ───────────────────────────────────────────────────────

export interface AccountKpis {
  posts:           number;
  followers:       number;
  avgViewsPerPost: number;
  totalLikes:      number;
  /** Percentage, e.g. 21 = 21%. */
  engagementRate:  number;
}

export type RadarAxisKey = 'virality' | 'activity' | 'engagement' | 'followers' | 'knoxFactor';

/** Radar scores per axis, each normalised 0..100. */
export type RadarScores = Record<RadarAxisKey, number>;

export type ContentDimension = 'type' | 'subjects' | 'styles';

export interface ContentSlice {
  key:      string;
  label:    string;
  /** Posts carrying this tag. */
  posts:    number;
  /** Total views of those posts (not split across their other tags). */
  views:    number;
  /** views / posts: how posts on this tag perform. */
  avgViews: number;
  /** Share of all tag uses in the period, 0..1: what the account posts about. */
  share:    number;
  /** Change in share vs the previous period, in percentage points. Null
   *  when the previous period has nothing to compare with. */
  deltaPp:  number | null;
}

export interface ContentBreakdown {
  totalPosts:         number;
  /** Posts with at least one tag in this dimension. */
  taggedPosts:        number;
  /** Posts not tagged yet (left out of the shares). */
  untaggedPosts:      number;
  avgViewsPerPost:    number;
  totalViews:         number;
  /** % change of total views vs the previous period. */
  totalViewsDeltaPct: number;
  /** Sorted by share, descending. */
  slices:             ContentSlice[];
}

export interface AccountPost {
  id:             string;
  platform:       SocialPlatform;
  /** Set on X posts: the tweet as the card draws it. */
  tweet?:         import('@/data/types').TweetData;
  caption:        string;
  /** ISO date. */
  postDate:       string;
  views:          number;
  likes:          number;
  comments:       number;
  shares:         number;
  saves:          number;
  /** Percentage — (likes + comments + saves + shares) / views. */
  engagementRate: number;
  /** Views per follower. */
  virality:       number;
  /** AI-generated description of the video. */
  summary?:       string;
  /** Content-style tags (e.g. 'interview'). */
  styles:         string[];
  /** Topic tags (e.g. 'migrants'). */
  topics:         string[];
  coverJpeg?:     string;
  videoMp4?:      string;
  postUrl:        string;
}

export interface AccountPeriodData {
  kpis:    AccountKpis;
  /** Null when there is no snapshot near the start of the period. */
  followerGrowth: FollowerGrowth | null;
  /** One entry per platform shown on the radar. */
  radar:   Partial<Record<SocialPlatform, RadarScores>>;
  content: Record<ContentDimension, ContentBreakdown>;
  posts:   AccountPost[];
}

export interface AccountPageData {
  profile:  AccountProfile;
  /** Platforms with data, in display order. The platform filter shows only
   *  when there is more than one. */
  platforms: SocialPlatform[];
  keyStats: KeyStatRank[];
  period:   AccountPeriodData;
  /** Distribution of every tracked post — places one post in the dataset.
   *  null while loading or when /api/benchmarks fails. */
  postBenchmarks: PostBenchmarks | null;
  /** Per platform, so an X post is compared with X posts. */
  postBenchmarksByPlatform: Record<SocialPlatform, PostBenchmarks | null>;
}

/** GET /api/account-page response. */
export type AccountPageApiResponse = Omit<AccountPageData, 'postBenchmarks' | 'postBenchmarksByPlatform'>;
