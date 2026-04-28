import type { Politician } from './types';

/**
 * Seed fixture — illustrative only. Scores: views | frequency | engagement | followers
 * all normalised 0..100 relative to dataset max. knoxFactor = average of the four.
 */
export const politicians: Politician[] = [
  {
    id: 'p_001',
    name: 'Angela Rayner',
    handle: '@angelarayner',
    role: 'MP, Ashton-under-Lyne',
    partyKey: 'labour',
    partyLabel: 'Labour',
    country: 'UK',
    avatarInitials: 'AR',
    totals: { posts: 142, followers: 318_400, followerChange: 1_200, likes: 2_140_000, views24h: 612_000, likesToday: 38_200, commentsToday: 1_400, savesToday: 820, postsToday: 4, postsThisWeek: 18 },
    scores: {
      views:      74,
      frequency:  82,
      engagement: 71,
      followers:  62,
      knoxFactor: 72,
    },
    recentPosts: [
      { postId: 'a1', caption: 'Out on the doorstep in Tameside — housing came up on every street.', views: 412_000, likes: 38_200, comments: 2_100, shares: 1_400 },
      { postId: 'a2', caption: "Reacting to the autumn statement — the maths doesn't add up.", views: 298_000, likes: 22_410, comments: 1_650, shares: 980 },
      { postId: 'a3', caption: 'Sunday roast verdict: Yorkshire pudding supremacy.', views: 187_000, likes: 31_700, comments: 2_410, shares: 3_200 },
    ],
  },
  {
    id: 'p_002',
    name: 'Rishi Sunak',
    handle: '@rishisunak',
    role: 'MP, Richmond and Northallerton',
    partyKey: 'conservative',
    partyLabel: 'Conservative',
    country: 'UK',
    avatarInitials: 'RS',
    totals: { posts: 88, followers: 512_200, followerChange: -340, likes: 1_820_000, views24h: 334_000, likesToday: 9_200, commentsToday: 410, savesToday: 280, postsToday: 2, postsThisWeek: 9 },
    scores: {
      views:      61,
      frequency:  54,
      engagement: 44,
      followers:  100,
      knoxFactor: 65,
    },
    recentPosts: [
      { postId: 'b1', caption: 'Visiting a science lab in Teesside — AI is changing British industry.', views: 221_000, likes: 14_300, comments: 720, shares: 410 },
      { postId: 'b2', caption: 'Answering your questions on the economy — direct and unfiltered.', views: 184_000, likes: 9_200, comments: 540, shares: 220 },
      { postId: 'b3', caption: 'On the train back to London — diary update from a busy week.', views: 98_000, likes: 6_800, comments: 310, shares: 95 },
    ],
  },
  {
    id: 'p_003',
    name: 'Ed Davey',
    handle: '@eddavey',
    role: 'MP, Kingston and Surbiton',
    partyKey: 'libdem',
    partyLabel: 'Liberal Democrats',
    country: 'UK',
    avatarInitials: 'ED',
    totals: { posts: 204, followers: 156_800, followerChange: 4_100, likes: 2_890_000, views24h: 812_000, likesToday: 201_000, commentsToday: 8_400, savesToday: 3_200, postsToday: 5, postsThisWeek: 24 },
    scores: {
      views:      100,
      frequency:  94,
      engagement: 88,
      followers:  31,
      knoxFactor: 78,
    },
    recentPosts: [
      { postId: 'c1', caption: 'Falling into Lake Windermere. For clean rivers.', views: 2_100_000, likes: 312_000, comments: 14_200, shares: 22_400 },
      { postId: 'c2', caption: 'Dancing with care workers to mark Carers Week.', views: 1_480_000, likes: 201_000, comments: 9_100, shares: 11_200 },
      { postId: 'c3', caption: "Bungee jumping off a crane — because the polls need a jolt.", views: 980_000, likes: 144_000, comments: 6_400, shares: 8_900 },
    ],
  },
];
