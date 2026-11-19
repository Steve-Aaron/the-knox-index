import type { GroupKey } from '@/theme/colors';

/**
 * Top-Trump score axis. All normalised 0..100 relative to dataset maximum.
 * knoxFactor = weighted composite of the four axes, then compressed around 50
 *              via the Moz-DA-style curve in data/knoxConfig.ts.
 */
export interface TopTrumpScores {
  virality:    number;   // 0..100  normalised (avgViews / followers) — per-post reach as fraction of audience
  frequency:   number;   // 0..100  normalised posting frequency (posts today)
  engagement:  number;   // 0..100  normalised (likes + comments + saves + shares) / views rate
  followers:   number;   // 0..100  normalised total follower count
  knoxFactor:  number;   // 0..100  weighted + curve-compressed composite (see knoxConfig.ts)
}

export type ScoreKey = keyof TopTrumpScores;

/**
 * Leaderboard sort keys: the five score axes plus 'views' (range-scoped view
 * count). 'views' is a leaderboard sort/filter only — it is not a radar axis
 * and not part of TopTrumpScores.
 */
export type LeaderboardSortKey = ScoreKey | 'views';

// ── Account page types ────────────────────────────────────────────────────────

/** A single entry in a per-metric leaderboard. */
export interface AccountRankEntry {
  id:             string;
  name:           string;
  handle:         string;
  groupKey:       GroupKey;
  avatarUrl?:     string;
  avatarInitials: string;
  score:          number;
}

/** Ranking data for one score metric on an account page. */
export interface AccountRanking {
  rank:         number;
  total:        number;
  top5:         AccountRankEntry[];
  targetInTop5: boolean;
  /**
   * When target is outside the top 5: the two entries above, the target,
   * and the two entries below — each paired with their absolute rank.
   */
  contextRows?: { entry: AccountRankEntry; rank: number }[];
}

/** Full response shape returned by GET /api/account */
export interface AccountPageResponse {
  politician: Politician;
  rankings:   Record<ScoreKey, AccountRanking>;
  /** Overall rank by Knox Factor across all accounts — used in the hero. */
  overallRank: number;
  /** All processed posts for this account, newest first, no date filter. */
  allPosts:   RecentPost[];
  rangeLabel: string;
}

/**
 * An X post rebuilt from twitter.post + twitter.media, carried alongside the
 * shared post fields so the UI can draw it in the shape of a tweet.
 */
export interface TweetData {
  authorName:  string;
  handle:      string;
  avatarUrl?:  string;
  verified:    boolean;
  /** Full ISO timestamp (postDate on the shared shape is the day only). */
  createdAt:   string;
  replyTo?:    string;
  likes:       number;
  reposts:     number;
  replies:     number;
  quotes:      number;
  bookmarks:   number;
  views:       number;
  /** Signed URLs. Types: photo, video, gif, *Thumbnail, linkPreview. */
  media:       { url: string; type: string }[];
  link?:       { url: string; title?: string; domain?: string };
  poll?:       { question?: string; closed: boolean; options: { label: string; votes: number }[] };
  quoted?:     { handle: string; name?: string; avatarUrl?: string; text: string; createdAt?: string };
}

export interface RecentPost {
  /** Absent on TikTok-only reads, which predate multi-platform. */
  platform?: 'tiktok' | 'x';
  tweet?:    TweetData;
  postId:    string;
  caption:   string;
  views:     number;
  likes:     number;
  comments:  number;
  shares:    number;
  saves?:    number;
  summary?:  string;    // AI-generated summary from n8n / Gemini
  styles?:   string[];
  topic?:    string;
  coverJpeg?: string;
  videoMp4?:  string;
  postUrl?:   string;
  postDate?:  string;
}

/**
 * The single most-viewed post across the whole dataset, all time. Surfaced by
 * /api/ariadne (range-independent) for the KeyFindingsBar "Top performing post"
 * tile. groupKey is resolved server-side so the client can colour it directly.
 */
export interface LifetimeTopPost {
  postId:      string;
  caption:     string;
  views:       number;
  /** Direct TikTok URL for the post — used to make the headline tile clickable. */
  postUrl:     string;
  accountName: string;
  groupKey:    GroupKey;
}

/** Full post record used by the PostsTable section. */
export interface PostRecord {
  platform?:       'tiktok' | 'x';
  tweet?:          TweetData;
  postId:          string;
  profile:         string;
  politicianName:  string;
  groupKey:        import('@/theme/colors').GroupKey;
  caption:         string;
  videoSummary:    string;
  coverJpeg:       string;
  videoMp4:        string;
  postUrl:         string;
  postDate:        string;
  styles:          string[];
  topics?:         string[];
  views:           number;
  likes:           number;
  comments:        number;
  shares:          number;
  saves:           number;
  accountFollowers: number;   // for virality = views / followers ratio
}

/**
 * Statistical distribution benchmarks for a metric across the full post dataset.
 * Used to render box-and-whisker plots per post.
 */
export interface MetricBenchmark {
  min:    number;
  p25:    number;
  median: number;
  mean:   number;
  p75:    number;
  max:    number;
}

/** Weekly briefing generated by Gemini — returned by /api/brief (legacy on-demand) */
export interface BriefResponse {
  narrative: string;
  insights:  Array<{ headline: string; body: string }>;
}

/** Row shape as stored in ariadne_tiktok_demo.brief by n8n */
export interface StoredBrief {
  briefDate:             string;   // 'yyyy-mm-dd'
  briefDailySummary:     string;
  briefWeeklySummary:    string;
  topNarrativesThisWeek: Array<{ headline: string; body: string }>;
}

/** Response from GET /api/briefs */
export interface BriefsApiResponse {
  brief:     StoredBrief;
  isToday:   boolean;   // false if the latest row is from a previous day
}

export interface PostBenchmarks {
  views:      MetricBenchmark;
  engagement: MetricBenchmark;  // (likes + comments + saves + shares) / views × 100
}

/**
 * Account type — raw DB values from accountType.name (snake_case).
 * These are the canonical values returned by inferAccountType() and stored
 * on every Politician record. 'council' and 'other' are fallback types used
 * when no DB match is found and regex inference is applied instead.
 */
export type AccountType =
  | 'member_of_parliament'
  | 'political_party'
  | 'party_leader'
  | 'prime_minister'
  | 'cabinet_minister'
  | 'shadow_cabinet_minister'
  | 'council'
  | 'other';

/** One platform account behind a Politician row (see Politician.platforms). */
export interface PlatformPresence {
  platform:   'tiktok' | 'x';
  handle:     string;
  url:        string;
  followers:  number;
  knoxFactor: number;
}

export interface Politician {
  id: string;
  /** metadata.person.person_id — the key that joins a person's platforms. */
  personId?: string;
  /** metadata.person.slug, e.g. 'lula-da-silva'. Addresses the person's account page. */
  slug?: string;
  /** Which platform this row was built from; 'all' when merged per person. */
  platform?: 'tiktok' | 'x' | 'all';
  /** Every platform account behind the row, in display order. */
  platforms?: PlatformPresence[];
  name: string;
  handle: string;           // e.g. "@rishisunak"
  role: string;             // e.g. "MP, Richmond"
  displayJobTitle: string;  // curated job title, e.g. "MP for Ipswich"
  /** Colour + grouping key for the ACTIVE tenant: a party key on The Knox
   *  Index, a region key on World Leaders. See data/grouping.ts. */
  groupKey: GroupKey;
  /** Human-readable name of that group, e.g. 'Labour' or 'Europe'. */
  groupLabel: string;
  /** Always the political party, whatever the tenant groups by. */
  partyLabel: string;
  /** Country name on a region-grouped tenant, 'UK' on The Knox Index. */
  country: string;
  /** Country centroid from metadata.person, in degrees. Plotted by the globe. */
  coordinates?: { lat: number; lng: number };
  avatarInitials: string;   // two-letter fallback
  avatarUrl?: string;       // signed GCS photo URL from account.avatar
  accountTypes?: AccountType[];  // all types — a politician may have several (e.g. party_leader + member_of_parliament)
  totals: {
    posts:          number;
    followers:      number;
    followerChange: number | null;  // daily delta — positive = growth
    likes:          number;
    /** Lifetime view count across all the account's posts, sourced from accountMetrics.totalViews. */
    views:          number;
    views24h:       number;
    likesToday:     number;
    commentsToday:  number;
    savesToday:     number;
    postsToday:     number;
    postsThisWeek:  number;
    /** Posts within the currently selected range — matches the active API ?range= param. */
    postsInRange:   number;
    /** Range-specific aggregates from the post table — zero when no posts exist in range. */
    viewsInRange:    number;
    likesInRange:    number;
    commentsInRange: number;
    savesInRange:    number;
    sharesInRange:   number;
    /** Lifetime post-table aggregates (range-independent) — sum/count over ALL
     *  posts we hold. Used for avg-views-per-video so it reflects our data, not
     *  the accountMetrics totals. */
    lifetimePostViews: number;
    lifetimePostCount: number;
    /** Lifetime sum of likes + comments + saves + shares over all posts we hold.
     *  Numerator for the all-time engagement rate in the accounts list. */
    lifetimePostInteractions: number;
  };
  scores: TopTrumpScores;
  /**
   * Knox Factor over the selected period only (same formula, the period's
   * posts as inputs). Used by the account page's Standings so its ranking
   * follows the period tabs; everything else shows scores.knoxFactor.
   */
  periodKnoxFactor?: number;
  recentPosts?: RecentPost[];
}
