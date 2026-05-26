/**
 * app/api/summarise+api.ts
 * --------------------------
 * Generates an AI summary for a single post using Gemini 1.5 Flash.
 *
 * POST /api/summarise
 * Body: { postId: string }
 *
 * Strategy:
 *   1. Fetch the post's metadata from BigQuery.
 *   2. If the post has a videoMp4, convert it to a gs:// URI and send the
 *      actual video to Gemini via Vertex AI (private GCS access via service acct).
 *   3. If no video is available, fall back to text-only summarisation using
 *      caption + topics + style + engagement metrics.
 *   4. Optionally write the summary back to BigQuery.
 *
 * Returns: { summary: string, source: 'video' | 'text' }
 */

import { query, tableRef } from '@/lib/bigquery';
import { generateContent } from '@/lib/gemini';
import { safeErrorDetail } from '@/lib/errors';

interface PostRow {
  postId:        string;
  profile:       string;
  name:          string;
  party:         string;
  caption:       string;
  videoMp4:      string;
  style:         string;
  topics:        string[];
  views:         number;
  likes:         number;
  comments:      number;
  saves:         number;
  shares:        number;
}

const FETCH_SQL = (postId: string) => `
  SELECT
    CAST(p.postId AS STRING) AS postId,
    p.profile,
    a.name,
    a.party,
    p.caption,
    COALESCE(p.videoMp4, '') AS videoMp4,
    COALESCE(p.style,    '') AS style,
    COALESCE(p.views,    0)  AS views,
    COALESCE(p.likes,    0)  AS likes,
    COALESCE(p.comments, 0)  AS comments,
    COALESCE(p.saves,    0)  AS saves,
    COALESCE(p.shares,   0)  AS shares,
    ARRAY_AGG(DISTINCT t.name IGNORE NULLS) AS topics
  FROM ${tableRef('post')} p
  LEFT JOIN ${tableRef('account')} a ON LTRIM(p.profile, '@') = LTRIM(a.profile, '@')
  LEFT JOIN ${tableRef('post_x_topic')} pt ON p.postId = pt.postId
  LEFT JOIN ${tableRef('topic')} t ON pt.topicId = t.id
  WHERE p.postId = ${postId}
  GROUP BY p.postId, p.profile, a.name, a.party,
           p.caption, p.videoMp4, p.style,
           p.views, p.likes, p.comments, p.saves, p.shares
  LIMIT 1
`;

const TEXT_PROMPT = (post: PostRow) => `You are an analyst for a political intelligence dashboard. A UK politician posted a TikTok video with the following metadata:

Politician: ${post.name} (${post.party})
Caption: "${post.caption}"
Content style: ${post.style || 'unknown'}
Topics: ${(post.topics ?? []).join(', ') || 'none tagged'}
Performance: ${post.views.toLocaleString()} views · ${post.likes.toLocaleString()} likes · ${post.comments.toLocaleString()} comments · ${post.shares.toLocaleString()} shares
Engagement rate: ${post.views > 0 ? +((post.likes + post.comments + post.saves + post.shares) / post.views * 100).toFixed(2) : '0'}%

Write exactly 2–3 sentences summarising:
1. What the politician is likely doing or addressing in this video based on the caption and topics
2. What political message they appear to be conveying
3. Why this content might be engaging or notable

Be factual, precise and neutral. Start directly with the content — no "Based on the metadata" preamble.`;

export async function POST(request: Request): Promise<Response> {
  let postId: string;
  try {
    const body = await request.json() as { postId?: string };
    postId = String(body.postId ?? '').trim();
    if (!postId) return Response.json({ error: 'postId required' }, { status: 400 });
    // Validate numeric-only before interpolating into SQL
    if (!/^\d+$/.test(postId)) return Response.json({ error: 'Invalid postId' }, { status: 400 });
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const rows = await query<PostRow>(FETCH_SQL(postId));
    if (!rows.length) {
      return Response.json({ error: `Post ${postId} not found` }, { status: 404 });
    }
    const post = rows[0];

    // Text-based summarisation using caption + topics + metrics.
    // Video-based summarisation (Vertex AI) requires OAuth which conflicts
    // with the Expo server fetch polyfill — text is reliable and fast.
    const summary = await generateContent([{ text: TEXT_PROMPT(post) }]);
    const source: 'video' | 'text' = 'text';

    return Response.json({ summary, source });

  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/summarise] error:', logMessage);
    return Response.json({ error: 'Summarisation failed', detail: clientDetail }, { status: 500 });
  }
}
