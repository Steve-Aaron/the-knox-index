import type { Politician, PostBenchmarks } from '@/data/types';
import type { TimeRange } from '@/components/dashboard/TimeRangePicker';

/**
 * data/account/types.ts
 * ----------------------
 * View-model for the account page (/account/[handle]). This is the contract
 * the page renders from. It is filled by mocks today (./mockAccount.ts) and
 * is the shape the future /api/account response should be mapped into.
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
  /** Points vs the previous week. Positive = improved. */
  deltaVsPrev:  number;
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
  rank:  number;
  total: number;
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
  key:     string;
  label:   string;
  posts:   number;
  views:   number;
  /** Share of total views, 0..1. */
  share:   number;
  /** Change in share vs the previous period, in percentage points. */
  deltaPp: number;
}

export interface ContentBreakdown {
  totalPosts:         number;
  avgViewsPerPost:    number;
  totalViews:         number;
  /** % change of total views vs the previous period. */
  totalViewsDeltaPct: number;
  /** Sorted by views, descending. */
  slices:             ContentSlice[];
}

export interface AccountPost {
  id:             string;
  platform:       SocialPlatform;
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
  /** One entry per platform shown on the radar. */
  radar:   Partial<Record<SocialPlatform, RadarScores>>;
  content: Record<ContentDimension, ContentBreakdown>;
  posts:   AccountPost[];
}

export interface AccountPageData {
  profile:  AccountProfile;
  keyStats: KeyStatRank[];
  period:   AccountPeriodData;
  /** Distribution of every tracked post — places one post in the dataset. */
  postBenchmarks: PostBenchmarks;
}
