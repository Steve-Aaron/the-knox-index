import type { Politician } from './types';

/**
 * Seed fixture — used as a fallback when /api/ariadne can't be reached
 * (e.g. running `npm run web` locally without GCP credentials).
 *
 * Posts now include public sample mp4s and Picsum cover images so the
 * full UX works end-to-end with no creds: leaderboard → detail panel →
 * video modal → playback. Big Buck Bunny / Sintel / Elephants Dream
 * are open-licensed shorts hosted by Google's gtv-videos-bucket and
 * stream reliably with the right Content-Type headers.
 *
 * Scores: views | frequency | engagement | followers all normalised
 * 0..100 relative to dataset max. knoxFactor = average of the four.
 */

const SAMPLE_MP4 = {
  bunny:    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  sintel:   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  elephant: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  forJoy:   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  forBlaze: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  forFun:   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  forMeet:  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  tears:    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  warship:  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
};

// Stable per-post cover images via picsum.photos seed URLs (9:16 portrait)
const COVER = (seed: string) => `https://picsum.photos/seed/${seed}/360/640`;

// Realistic-looking ISO date strings sliding back from "today"
const DATE = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

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
    scores: { views: 74, frequency: 82, engagement: 71, followers: 62, knoxFactor: 72 },
    recentPosts: [
      {
        postId: 'a1',
        caption: 'Out on the doorstep in Tameside — housing came up on every street.',
        summary: 'Direct-to-camera doorstep clip framing housing as the local issue cutting through this week. Energetic delivery, single venue, single message.',
        style: 'doorstep',
        topic: 'housing',
        views: 412_000, likes: 38_200, comments: 2_100, shares: 1_400,
        videoMp4: SAMPLE_MP4.bunny,
        coverJpeg: COVER('rayner-1'),
        postUrl: 'https://www.tiktok.com/@angelarayner/video/00000001',
        postDate: DATE(1),
      },
      {
        postId: 'a2',
        caption: "Reacting to the autumn statement — the maths doesn't add up.",
        summary: 'Studio reaction-style breakdown of the Treasury numbers, with overlay graphics. Tighter edit than her usual doorstep clips.',
        style: 'reaction',
        topic: 'economy',
        views: 298_000, likes: 22_410, comments: 1_650, shares: 980,
        videoMp4: SAMPLE_MP4.sintel,
        coverJpeg: COVER('rayner-2'),
        postUrl: 'https://www.tiktok.com/@angelarayner/video/00000002',
        postDate: DATE(3),
      },
      {
        postId: 'a3',
        caption: 'Sunday roast verdict: Yorkshire pudding supremacy.',
        summary: 'Personality piece, off-message and humour-led. Performed unusually well for a non-policy clip — comments are about the food, not politics.',
        style: 'lifestyle',
        topic: 'culture',
        views: 187_000, likes: 31_700, comments: 2_410, shares: 3_200,
        videoMp4: SAMPLE_MP4.elephant,
        coverJpeg: COVER('rayner-3'),
        postUrl: 'https://www.tiktok.com/@angelarayner/video/00000003',
        postDate: DATE(5),
      },
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
    scores: { views: 61, frequency: 54, engagement: 44, followers: 100, knoxFactor: 65 },
    recentPosts: [
      {
        postId: 'b1',
        caption: 'Visiting a science lab in Teesside — AI is changing British industry.',
        summary: 'Polished site visit format. Sound bite about AI investment, B-roll of equipment, no direct-to-camera. Engagement low for the size of audience.',
        style: 'visit',
        topic: 'technology',
        views: 221_000, likes: 14_300, comments: 720, shares: 410,
        videoMp4: SAMPLE_MP4.forJoy,
        coverJpeg: COVER('sunak-1'),
        postUrl: 'https://www.tiktok.com/@rishisunak/video/00000001',
        postDate: DATE(2),
      },
      {
        postId: 'b2',
        caption: 'Answering your questions on the economy — direct and unfiltered.',
        summary: 'Q&A montage cut from a longer Instagram Live. Numbers-heavy answers; viewers drop off after the first question.',
        style: 'q-and-a',
        topic: 'economy',
        views: 184_000, likes: 9_200, comments: 540, shares: 220,
        videoMp4: SAMPLE_MP4.forBlaze,
        coverJpeg: COVER('sunak-2'),
        postUrl: 'https://www.tiktok.com/@rishisunak/video/00000002',
        postDate: DATE(4),
      },
      {
        postId: 'b3',
        caption: 'On the train back to London — diary update from a busy week.',
        summary: 'Vlog-style selfie format. Soft delivery, no strong message, used to humanise. Engagement metrics are below his weekly baseline.',
        style: 'vlog',
        topic: 'personal',
        views: 98_000, likes: 6_800, comments: 310, shares: 95,
        videoMp4: SAMPLE_MP4.forFun,
        coverJpeg: COVER('sunak-3'),
        postUrl: 'https://www.tiktok.com/@rishisunak/video/00000003',
        postDate: DATE(6),
      },
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
    scores: { views: 100, frequency: 94, engagement: 88, followers: 31, knoxFactor: 78 },
    recentPosts: [
      {
        postId: 'c1',
        caption: 'Falling into Lake Windermere. For clean rivers.',
        summary: 'Stunt-led campaign clip. High virality ratio for a sub-200k account. Cleared 2M views inside 24h, share rate triple his average.',
        style: 'stunt',
        topic: 'environment',
        views: 2_100_000, likes: 312_000, comments: 14_200, shares: 22_400,
        videoMp4: SAMPLE_MP4.forMeet,
        coverJpeg: COVER('davey-1'),
        postUrl: 'https://www.tiktok.com/@eddavey/video/00000001',
        postDate: DATE(1),
      },
      {
        postId: 'c2',
        caption: 'Dancing with care workers to mark Carers Week.',
        summary: 'On-message stunt with a clear partnership tie-in. Strong engagement, particularly saves — viewers are bookmarking the cause not just the dance.',
        style: 'stunt',
        topic: 'social-care',
        views: 1_480_000, likes: 201_000, comments: 9_100, shares: 11_200,
        videoMp4: SAMPLE_MP4.tears,
        coverJpeg: COVER('davey-2'),
        postUrl: 'https://www.tiktok.com/@eddavey/video/00000002',
        postDate: DATE(3),
      },
      {
        postId: 'c3',
        caption: "Bungee jumping off a crane — because the polls need a jolt.",
        summary: "Self-aware stunt clip with a one-liner caption. Performs well within his own catalogue; comments split between approval and 'is this serious'.",
        style: 'stunt',
        topic: 'campaign',
        views: 980_000, likes: 144_000, comments: 6_400, shares: 8_900,
        videoMp4: SAMPLE_MP4.warship,
        coverJpeg: COVER('davey-3'),
        postUrl: 'https://www.tiktok.com/@eddavey/video/00000003',
        postDate: DATE(5),
      },
    ],
  },
];
