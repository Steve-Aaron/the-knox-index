import type { Politician, PostBenchmarks } from '@/data/types';
import { postEngagementRate } from '@/lib/postMetrics';
import type {
  AccountKpis,
  AccountPageData,
  AccountPeriodData,
  AccountPlatform,
  AccountPost,
  AccountProfile,
  ContentBreakdown,
  ContentDimension,
  KeyStatRank,
  RadarScores,
  SocialPlatform,
  TimeRange,
} from './types';

/**
 * data/account/mockAccount.ts
 * ----------------------------
 * Deterministic fake data for the account page. No network. The numbers are
 * shaped to react plausibly to the range and platform filters so every widget
 * can be built and reviewed before the API exists.
 *
 * Delete this file once useAccountPage() is wired to /api/account.
 */

// ── Deterministic randomness ─────────────────────────────────────────────────

/** Small seeded PRNG (mulberry32) so mocks are stable across renders. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// ── Per-platform baselines (one week) ────────────────────────────────────────

interface PlatformBaseline {
  postsPerWeek:   number;
  followers:      number;
  avgViews:       number;
  likeRate:       number;   // likes / views
  engagementRate: number;   // %
  radar:          RadarScores;
}

const BASELINE: Record<SocialPlatform, PlatformBaseline> = {
  tiktok: {
    postsPerWeek:   12,
    followers:      46_000,
    avgViews:       11_000,
    likeRate:       0.06,
    engagementRate: 21,
    radar: { virality: 78, activity: 62, engagement: 85, followers: 48, knoxFactor: 84 },
  },
  x: {
    postsPerWeek:   28,
    followers:      182_000,
    avgViews:       3_400,
    likeRate:       0.02,
    engagementRate: 4.5,
    radar: { virality: 34, activity: 88, engagement: 40, followers: 82, knoxFactor: 61 },
  },
};

/** How much longer than a week each range is. */
const RANGE_WEEKS: Record<TimeRange, number> = {
  yesterday: 1 / 7,
  week:      1,
  month:     30 / 7,
  year:      42,
  lifetime:  130,
};

/** Small drift so the radar visibly moves when the range changes. */
const RANGE_RADAR_NUDGE: Record<TimeRange, number> = {
  yesterday: -6,
  week:      0,
  month:     3,
  year:      5,
  lifetime:  7,
};

const ALL_PLATFORMS: SocialPlatform[] = ['tiktok', 'x'];

function platformsFor(platform: AccountPlatform): SocialPlatform[] {
  return platform === 'all' ? ALL_PLATFORMS : [platform];
}

// ── Builders ─────────────────────────────────────────────────────────────────

function buildKpis(range: TimeRange, platforms: SocialPlatform[]): AccountKpis {
  let posts = 0;
  let followers = 0;
  let views = 0;
  let likes = 0;
  let engagementWeighted = 0;

  for (const p of platforms) {
    const b = BASELINE[p];
    const platformPosts = Math.max(1, Math.round(b.postsPerWeek * RANGE_WEEKS[range]));
    const platformViews = platformPosts * b.avgViews;
    posts     += platformPosts;
    followers += b.followers;
    views     += platformViews;
    likes     += Math.round(platformViews * b.likeRate);
    engagementWeighted += b.engagementRate * platformViews;
  }

  return {
    posts,
    followers,
    avgViewsPerPost: posts > 0 ? Math.round(views / posts) : 0,
    totalLikes:      likes,
    engagementRate:  views > 0 ? Math.round(engagementWeighted / views) : 0,
  };
}

function buildRadar(range: TimeRange, platforms: SocialPlatform[]): AccountPeriodData['radar'] {
  const nudge = RANGE_RADAR_NUDGE[range];
  const radar: AccountPeriodData['radar'] = {};
  for (const p of platforms) {
    const base = BASELINE[p].radar;
    radar[p] = {
      virality:   clamp(base.virality + nudge, 0, 100),
      activity:   clamp(base.activity - nudge, 0, 100),
      engagement: clamp(base.engagement + nudge / 2, 0, 100),
      followers:  base.followers,
      knoxFactor: clamp(base.knoxFactor + nudge / 2, 0, 100),
    };
  }
  return radar;
}

/** Label sets per content dimension, with a rough relative weight each. */
const CONTENT_LABELS: Record<ContentDimension, { key: string; label: string; weight: number }[]> = {
  type: [
    { key: 'video',    label: 'Video',    weight: 6 },
    { key: 'image',    label: 'Image',    weight: 2 },
    { key: 'text',     label: 'Text',     weight: 1.5 },
    { key: 'carousel', label: 'Carousel', weight: 1 },
    { key: 'link',     label: 'Link',     weight: 0.6 },
  ],
  subjects: [
    { key: 'defense',        label: 'Defense',        weight: 5 },
    { key: 'economy',        label: 'Economy',        weight: 3.2 },
    { key: 'foreign_policy', label: 'Foreign Policy', weight: 2.6 },
    { key: 'immigration',    label: 'Immigration',    weight: 2.2 },
    { key: 'crime',          label: 'Crime',          weight: 1.8 },
    { key: 'health',         label: 'Health',         weight: 1.4 },
    { key: 'housing',        label: 'Housing',        weight: 1.1 },
    { key: 'other',          label: 'Other',          weight: 2.4 },
  ],
  styles: [
    { key: 'talking_head', label: 'Talking Head', weight: 5 },
    { key: 'speech_clip',  label: 'Speech Clip',  weight: 3 },
    { key: 'interview',    label: 'Interview',    weight: 2.4 },
    { key: 'explainer',    label: 'Explainer',    weight: 1.6 },
    { key: 'skit',         label: 'Skit',         weight: 0.9 },
    { key: 'behind_scenes', label: 'Behind the Scenes', weight: 0.7 },
  ],
};

function buildContent(kpis: AccountKpis, rand: () => number): Record<ContentDimension, ContentBreakdown> {
  const totalViews = kpis.posts * kpis.avgViewsPerPost;

  const build = (dimension: ContentDimension): ContentBreakdown => {
    const labels = CONTENT_LABELS[dimension];
    const jittered = labels.map(l => ({ ...l, weight: l.weight * (0.8 + rand() * 0.4) }));
    const weightSum = jittered.reduce((s, l) => s + l.weight, 0);

    const slices = jittered
      .map(l => {
        const share = l.weight / weightSum;
        return {
          key:     l.key,
          label:   l.label,
          posts:   Math.max(1, Math.round(kpis.posts * share)),
          views:   Math.round(totalViews * share),
          share,
          deltaPp: Math.round((rand() * 4 - 2) * 10) / 10,
        };
      })
      .sort((a, b) => b.views - a.views);

    return {
      totalPosts:         kpis.posts,
      avgViewsPerPost:    kpis.avgViewsPerPost,
      totalViews,
      totalViewsDeltaPct: Math.round((rand() * 16 - 4) * 10) / 10,
      slices,
    };
  };

  return { type: build('type'), subjects: build('subjects'), styles: build('styles') };
}

/** Caption, AI summary and tags travel together so each mock post reads true. */
const POST_TEMPLATES: { caption: string; summary: string; styles: string[]; topics: string[] }[] = [
  {
    caption: 'We must return the boats back to France.',
    summary: 'In this news clip from central London, Reform UK figure Zia Yusuf argues that the UK navy should be deployed to stop cross-channel migration and return boats to France. He claims that international treaties obligate authorities to rescue migrants on hazardous crossings, and calls for leaving them.',
    styles:  ['INTERVIEW', 'NEWS_CLIP'],
    topics:  ['CITY', 'MIGRANTS'],
  },
  {
    caption: 'Our borders are not a suggestion. Here is what we would do on day one.',
    summary: 'Zia Yusuf speaks directly to camera outside Westminster, setting out a day-one plan for border enforcement. On-screen captions list each policy as he names it, with quick cuts between points.',
    styles:  ['TALKING_HEAD', 'EXPLAINER'],
    topics:  ['IMMIGRATION', 'POLICY'],
  },
  {
    caption: 'Asked the Home Secretary a simple question today. Still waiting for an answer.',
    summary: 'A clip from a televised debate in which Yusuf presses the Home Secretary on asylum hotel costs. The video zooms in on the exchange and overlays the figures he quotes.',
    styles:  ['SPEECH_CLIP'],
    topics:  ['ASYLUM', 'GOVERNMENT'],
  },
  {
    caption: 'Knife crime is up again in London. This is not normal.',
    summary: 'Filmed on a high street in east London, Yusuf walks past shuttered shops while describing recent knife crime figures. Short interviews with local residents are cut in between.',
    styles:  ['BEHIND_SCENES', 'INTERVIEW'],
    topics:  ['CRIME', 'LONDON'],
  },
  {
    caption: 'Three numbers every taxpayer should know about the asylum budget.',
    summary: 'A fast explainer with three large on-screen numbers, each followed by a short breakdown from Yusuf. Ends with a call to share the video.',
    styles:  ['EXPLAINER'],
    topics:  ['ECONOMY', 'ASYLUM'],
  },
  {
    caption: 'Live from the conference floor — the room is full.',
    summary: 'Handheld footage from the party conference showing a packed hall before Yusuf takes the stage. Crowd noise and applause dominate the audio.',
    styles:  ['BEHIND_SCENES'],
    topics:  ['CONFERENCE', 'REFORM_UK'],
  },
  {
    caption: 'Why the defence budget matters more than ever.',
    summary: 'Yusuf explains to camera why he backs a higher defence budget, using a map graphic of recent naval incidents in the Channel and the North Sea.',
    styles:  ['TALKING_HEAD', 'EXPLAINER'],
    topics:  ['DEFENCE', 'NAVY'],
  },
  {
    caption: 'Replying to your comments on housing — part 2.',
    summary: 'A reply-to-comment video: viewer comments about rent and house prices appear on screen and Yusuf answers each one in turn.',
    styles:  ['TALKING_HEAD'],
    topics:  ['HOUSING', 'COST_OF_LIVING'],
  },
];

/** Fixed 'now' so mock dates never drift between sessions. */
const MOCK_NOW = Date.parse('2026-10-19T12:00:00Z');
const DAY_MS = 86_400_000;

function buildPosts(
  range: TimeRange,
  platforms: SocialPlatform[],
  kpis: AccountKpis,
  rand: () => number,
): AccountPost[] {
  const count = Math.min(kpis.posts, 40);
  const spanDays = Math.max(1, Math.round(RANGE_WEEKS[range] * 7));

  return Array.from({ length: count }, (_, i) => {
    const platform = platforms[i % platforms.length];
    const base = BASELINE[platform];
    const template = POST_TEMPLATES[i % POST_TEMPLATES.length];
    const views = Math.round(base.avgViews * (0.15 + rand() * rand() * 6));
    const likes = Math.round(views * base.likeRate * (0.6 + rand() * 0.8));
    const comments = Math.round(likes * (0.04 + rand() * 0.08));
    const shares = Math.round(likes * (0.02 + rand() * 0.1));
    const saves = Math.round(likes * (0.01 + rand() * 0.05));
    const id = `${platform}-${range}-${i}`;
    return {
      id,
      platform,
      caption:        template.caption,
      postDate:       new Date(MOCK_NOW - Math.floor(rand() * spanDays) * DAY_MS).toISOString(),
      views,
      likes,
      comments,
      shares,
      saves,
      engagementRate: postEngagementRate({ views, likes, comments, shares, saves }),
      virality:       views / base.followers,
      summary:        template.summary,
      styles:         template.styles,
      topics:         template.topics,
      postUrl:        platform === 'tiktok'
        ? `https://www.tiktok.com/@ziayusuf/video/${id}`
        : `https://x.com/ZiaYusufUK/status/${id}`,
    };
  });
}

/** Dataset-wide distributions (all tracked posts), close to the live figures. */
const POST_BENCHMARKS: PostBenchmarks = {
  views:      { min: 40, p25: 805, median: 1_500, mean: 28_300, p75: 7_100, max: 7_100_000 },
  engagement: { min: 0,  p25: 3.1, median: 5.3,   mean: 6.0,    p75: 8.1,   max: 40 },
};

// ── Profile (range-independent) ──────────────────────────────────────────────

function buildPolitician(handle: string): Politician {
  return {
    id:              'mock-zia-yusuf',
    name:            'Zia Yusuf',
    handle:          `@${handle.replace(/^@/, '')}`,
    role:            'Home Affairs Spokesperson',
    displayJobTitle: 'Reform UK Home Affairs Spokesperson',
    groupKey:        'reform',
    groupLabel:      'Reform',
    partyLabel:      'Reform UK',
    country:         'UK',
    avatarInitials:  'ZY',
    avatarUrl:       undefined,
    accountTypes:    ['shadow_cabinet_minister'],
    totals: {
      posts:                    412,
      followers:                46_000,
      followerChange:           310,
      likes:                    1_240_000,
      views:                    18_600_000,
      views24h:                 52_000,
      likesToday:               3_100,
      commentsToday:            240,
      savesToday:               120,
      postsToday:               2,
      postsThisWeek:            16,
      postsInRange:             16,
      viewsInRange:             176_000,
      likesInRange:             10_500,
      commentsInRange:          820,
      savesInRange:             400,
      sharesInRange:            610,
      lifetimePostViews:        18_600_000,
      lifetimePostCount:        412,
      lifetimePostInteractions: 1_420_000,
    },
    scores: { virality: 78, frequency: 62, engagement: 85, followers: 48, knoxFactor: 84 },
    // Feeds FollowerQualityFlag: ~790 avg views on 46K followers ≈ 1.7% → amber.
    recentPosts: [620, 940, 710, 880].map((views, i) => ({
      postId:   `recent-${i}`,
      caption:  POST_TEMPLATES[i].caption,
      views,
      likes:    Math.round(views * 0.06),
      comments: 4,
      shares:   2,
    })),
  };
}

function buildProfile(handle: string): AccountProfile {
  const clean = handle.replace(/^@/, '');
  return {
    politician:  buildPolitician(clean),
    knoxFactor:  { score: 84, deltaVsPrev: 4 },
    affiliation: { label: 'Reform', memberCount: 20 },
    socials: [
      { platform: 'tiktok', handle: `@${clean}`,   url: `https://www.tiktok.com/@${clean}` },
      { platform: 'x',      handle: '@ZiaYusufUK', url: 'https://x.com/ZiaYusufUK' },
    ],
    lastPostAt: new Date(MOCK_NOW - 5 * DAY_MS).toISOString(),
  };
}

const KEY_STATS: KeyStatRank[] = [
  { id: 'same_type',      label: 'Among accounts of the same type',                 rank: 16, total: 55 },
  { id: 'same_followers', label: 'Among accounts with a similar number of followers', rank: 9,  total: 28 },
  { id: 'same_region',    label: 'Among accounts from the same region',             rank: 2,  total: 14 },
];

// ── Public API ───────────────────────────────────────────────────────────────

export function getMockAccountPage(
  handle: string,
  range: TimeRange,
  platform: AccountPlatform,
): AccountPageData {
  const platforms = platformsFor(platform);
  const rand = seededRandom(hashString(`${handle}|${range}|${platform}`));
  const kpis = buildKpis(range, platforms);

  return {
    profile:  buildProfile(handle),
    keyStats: KEY_STATS,
    period: {
      kpis,
      radar:   buildRadar(range, platforms),
      content: buildContent(kpis, rand),
      posts:   buildPosts(range, platforms, kpis, rand),
    },
    postBenchmarks: POST_BENCHMARKS,
  };
}
