/**
 * app/api/brief+api.ts
 * ----------------------
 * Generates the weekly editorial briefing shown in SummaryPanel using Gemini.
 * Queries live BigQuery stats, builds a structured data snapshot, then asks
 * Gemini to produce a JSON response with:
 *   - narrative:  a 2–3 sentence executive overview paragraph
 *   - insights:   array of 3 { headline, body } objects — top talking points
 *
 * GET /api/brief
 * Cached 1 hour — expensive but infrequently needed.
 */

import { query, tableRef } from '@/lib/bigquery';
import { generateContent } from '@/lib/gemini';
import { safeErrorDetail } from '@/lib/errors';
import type { BriefResponse } from '@/data/types';

interface TopPolitician {
  name:           string;
  party:          string;
  followers:      number;
  followerChange: number;
  views24h:       number;
  likesToday:     number;
  commentsToday:  number;
  savesToday:     number;
  postsThisWeek:  number;
}

interface TopPost {
  name:            string;
  party:           string;
  views:           number;
  caption:         string;
  style:           string;
  totalFollowers:  number;
  viralityScore:   number;   // views / totalFollowers
}

const STATS_SQL = `
  SELECT
    a.name,
    a.party,
    COALESCE(m.totalFollowers,  0)  AS followers,
    COALESCE(m.followerChange,  0)  AS followerChange,
    COALESCE(m.viewsToday,      0)  AS views24h,
    COALESCE(m.likesToday,      0)  AS likesToday,
    COALESCE(m.commentsToday,   0)  AS commentsToday,
    COALESCE(m.savesToday,      0)  AS savesToday,
    COALESCE(pw.postsThisWeek,  0)  AS postsThisWeek,
    COALESCE(m.totalViews,      0)  AS totalViews
  FROM ${tableRef('account')} a
  LEFT JOIN (
    SELECT * FROM ${tableRef('accountMetrics')}
    WHERE dateUpdated = (
      SELECT MAX(dateUpdated) FROM ${tableRef('accountMetrics')}
      WHERE dateUpdated <= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
    )
  ) m ON a.id = m.pageId
  LEFT JOIN (
    SELECT LTRIM(profile, '@') AS profile, COUNT(*) AS postsThisWeek
    FROM ${tableRef('post')}
    WHERE postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    GROUP BY LTRIM(profile, '@')
  ) pw ON LTRIM(a.profile, '@') = pw.profile
  ORDER BY m.totalViews DESC
  LIMIT 20
`;

const TOP_POSTS_SQL = `
  SELECT
    a.name, a.party,
    p.views, p.caption,
    COALESCE(p.style,           '')  AS style,
    COALESCE(a.totalFollowers,   0)  AS totalFollowers,
    SAFE_DIVIDE(p.views, NULLIF(a.totalFollowers, 0)) AS viralityScore
  FROM ${tableRef('post')} p
  LEFT JOIN ${tableRef('account')} a
    ON LTRIM(p.profile, '@') = LTRIM(a.profile, '@')
  WHERE p.postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    AND a.totalFollowers > 0
  ORDER BY viralityScore DESC
  LIMIT 5
`;

function buildPrompt(politicians: TopPolitician[], posts: TopPost[]): string {
  const topByViews = politicians.slice(0, 5);
  const topByEngagement = [...politicians]
    .filter(p => p.views24h > 0)
    .sort((a, b) =>
      ((b.likesToday + b.commentsToday + b.savesToday) / b.views24h) -
      ((a.likesToday + a.commentsToday + a.savesToday) / a.views24h)
    )
    .slice(0, 3);
  const followerMovers = [...politicians]
    .filter(p => p.followerChange !== 0)
    .sort((a, b) => Math.abs(b.followerChange) - Math.abs(a.followerChange))
    .slice(0, 3);

  const snapshot = `
TOP PERFORMERS YESTERDAY (by views):
${topByViews.map((p, i) =>
  `${i + 1}. ${p.name} (${p.party}) — ${p.views24h.toLocaleString()} views, ${p.likesToday.toLocaleString()} likes, ${p.commentsToday.toLocaleString()} comments, ${p.savesToday.toLocaleString()} saves, ${p.postsThisWeek} posts this week, ${p.followers.toLocaleString()} followers`
).join('\n')}

HIGHEST ENGAGEMENT RATES YESTERDAY (likes + comments + saves / views):
${topByEngagement.map(p => {
  const rate = ((p.likesToday + p.commentsToday + p.savesToday) / Math.max(p.views24h, 1) * 100).toFixed(2);
  return `• ${p.name} (${p.party}) — ${rate}% engagement rate`;
}).join('\n')}

BIGGEST FOLLOWER CHANGES YESTERDAY:
${followerMovers.map(p =>
  `• ${p.name} (${p.party}) — ${p.followerChange > 0 ? '+' : ''}${p.followerChange.toLocaleString()} followers`
).join('\n')}

MOST VIRAL POSTS THIS WEEK (ranked by views ÷ account followers — small accounts punching above their weight rank highest):
${posts.map((p, i) =>
  `${i + 1}. ${p.name} (${p.party}): "${p.caption.slice(0, 80)}…" — ${p.views.toLocaleString()} views, ${p.totalFollowers.toLocaleString()} followers, virality ratio ${p.viralityScore.toFixed(2)}× [style: ${p.style || 'unknown'}]`
).join('\n')}
`.trim();

  return `You are the lead analyst for a political intelligence dashboard monitoring UK politicians on TikTok. Based on the following live data snapshot, produce a JSON response with this structure:

{
  "narrative": "A single paragraph (2-3 sentences) giving a plain-English executive overview of this week's political TikTok activity. Be specific about politicians, parties and numbers. Write for a non-technical political professional.",
  "insights": [
    { "headline": "Short punchy headline (max 8 words)", "body": "One or two sentences expanding on this point with specific data." }
  ]
}

Produce as many insights as the data warrants — typically 3 to 6. Focus on: who is dominating, what content styles are working, notable trends or shifts, and anyone who has gone viral relative to their audience size (high virality ratio). Be direct, specific and neutral.

DATA SNAPSHOT:
${snapshot}

Return ONLY valid JSON. No markdown fences, no commentary.`;
}

export async function GET(_request: Request): Promise<Response> {
  try {
    const [politicianRows, postRows] = await Promise.all([
      query<TopPolitician>(STATS_SQL),
      query<TopPost>(TOP_POSTS_SQL),
    ]);

    const prompt = buildPrompt(politicianRows, postRows);
    const raw    = await generateContent([{ text: prompt }]);

    // Strip markdown fences, then extract the JSON object robustly.
    // Gemini occasionally wraps the output or includes trailing commentary.
    let json = raw.replace(/^```json?\s*/i, '').replace(/\s*```[\s\S]*$/i, '').trim();

    // If the string doesn't start with {, find the first { … } block
    if (!json.startsWith('{')) {
      const match = json.match(/\{[\s\S]*\}/);
      if (match) json = match[0];
    }

    const brief = JSON.parse(json) as BriefResponse;

    return Response.json(
      { brief },
      // Cache for 12 hours, with a 1-hour grace window where stale content is
      // served instantly while a fresh one regenerates in the background.
      { headers: { 'Cache-Control': 'public, max-age=43200, stale-while-revalidate=3600' } }
    );

  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/brief] error:', logMessage);
    return Response.json({ error: 'Failed to generate brief', detail: clientDetail }, { status: 500 });
  }
}
