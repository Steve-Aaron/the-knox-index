/**
 * app/api/account+api.ts
 * -----------------------
 * GET /api/account?handle=keirstarmer&range=week
 *
 * Returns a single politician's full profile plus per-metric peer rankings
 * computed across the entire dataset. Used exclusively by the account page.
 *
 * Response: AccountPageResponse (see data/types.ts)
 */

import { query } from '@/lib/bigquery';
import { signMediaFields, signGcsUrl } from '@/lib/gcs';
import { safeErrorDetail } from '@/lib/errors';
import { transformToPoliticians } from '@/data/transformers';
import {
  parseRange,
  sanitiseHandle,
  buildAccountsSQL,
  buildAccountPostsSQL,
  buildAllAccountPostsSQL,
  RANGE_LABELS,
} from '@/lib/bqQueries';
import type { BQAccountRow, BQPostRow } from '@/data/transformers';
import type {
  Politician,
  ScoreKey,
  AccountRanking,
  AccountRankEntry,
  AccountPageResponse,
  RecentPost,
} from '@/data/types';

// ── Ranking helpers ───────────────────────────────────────────────────────────

const SCORE_KEYS: ScoreKey[] = ['knoxFactor', 'views', 'engagement', 'frequency', 'followers'];

function toRankEntry(p: Politician, key: ScoreKey): AccountRankEntry {
  return {
    id:             p.id,
    name:           p.name,
    handle:         p.handle,
    partyKey:       p.partyKey,
    avatarUrl:      p.avatarUrl,
    avatarInitials: p.avatarInitials,
    score:          p.scores[key],
  };
}

function computeRankings(
  targetId: string,
  allPoliticians: Politician[],
): Record<ScoreKey, AccountRanking> {
  const result = {} as Record<ScoreKey, AccountRanking>;

  for (const key of SCORE_KEYS) {
    const sorted       = [...allPoliticians].sort((a, b) => b.scores[key] - a.scores[key]);
    const rankIndex    = sorted.findIndex(p => p.id === targetId);
    const rank         = rankIndex + 1;
    const top5         = sorted.slice(0, 5).map(p => toRankEntry(p, key));
    const targetInTop5 = rankIndex < 5;

    // When outside top 5: two entries above + target + two entries below
    let contextRows: { entry: AccountRankEntry; rank: number }[] | undefined;
    if (!targetInTop5) {
      contextRows = [];
      for (let offset = -2; offset <= 2; offset++) {
        const idx = rankIndex + offset;
        if (idx >= 5 && idx < sorted.length) {
          contextRows.push({ entry: toRankEntry(sorted[idx], key), rank: idx + 1 });
        }
      }
    }

    result[key] = {
      rank,
      total: sorted.length,
      top5,
      targetInTop5,
      contextRows,
    };
  }

  return result;
}

// ── Post transformer (mirrors transformers.ts transformPost) ──────────────────

function toDateStr(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') return v;
  const bqDate = v as { value?: string };
  if (typeof bqDate.value === 'string') return bqDate.value;
  return undefined;
}

function transformPost(row: BQPostRow): RecentPost {
  return {
    postId:    String(row.postId),
    caption:   row.caption      ?? '(no caption)',
    views:     row.views        ?? 0,
    likes:     row.likes        ?? 0,
    comments:  row.comments     ?? 0,
    shares:    row.shares       ?? 0,
    saves:     row.saves        ?? 0,
    summary:   row.videoSummary || undefined,
    styles:    Array.isArray(row.styles) ? row.styles.filter(Boolean) : undefined,
    coverJpeg: row.coverJpeg    || undefined,
    videoMp4:  row.videoMp4     || undefined,
    postUrl:   row.postUrl      || undefined,
    postDate:  toDateStr(row.postDate),
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const params    = new URL(request.url).searchParams;
  const rawHandle = params.get('handle') ?? '';
  const handle    = sanitiseHandle(rawHandle);
  const range     = parseRange(params.get('range'), 'week');

  if (!handle) {
    return Response.json({ error: 'Missing handle parameter' }, { status: 400 });
  }

  try {
    // Run three queries in parallel:
    // 1. All accounts — needed for accurate normalised scores + peer rankings
    // 2. Range posts — feeds the scoring transformer (5 per account max)
    // 3. All posts for this account — full history, no date filter, for the post feed
    const [accountRows, rangePostRows, allPostRows] = await Promise.all([
      query<BQAccountRow>(buildAccountsSQL(range)),
      query<BQPostRow>(buildAccountPostsSQL(handle, range, 5)),
      query<BQPostRow>(buildAllAccountPostsSQL(handle, 200)),
    ]);

    // Transform full dataset for scores + rankings.
    const allPoliticians = transformToPoliticians(accountRows, rangePostRows);

    // Find target by normalised handle.
    const normalised = handle.replace(/^@/, '').toLowerCase();
    const politician  = allPoliticians.find(
      p => p.handle.replace(/^@/, '').toLowerCase() === normalised
    );

    if (!politician) {
      return Response.json(
        { error: `No account found for handle: ${handle}` },
        { status: 404 }
      );
    }

    // Build full post list from the all-posts query and sign media.
    const allPosts: RecentPost[] = allPostRows.map(transformPost);

    // Sign media for all posts and the avatar in parallel.
    await Promise.all([
      ...allPosts.map(async (post, i) => {
        allPosts[i] = await signMediaFields(post);
      }),
      (async () => {
        if (politician.avatarUrl) {
          politician.avatarUrl = await signGcsUrl(politician.avatarUrl);
        }
      })(),
    ]);

    const rankings    = computeRankings(politician.id, allPoliticians);
    const overallRank = rankings.knoxFactor.rank;

    const body: AccountPageResponse = {
      politician,
      rankings,
      overallRank,
      allPosts,
      rangeLabel: RANGE_LABELS[range],
    };

    return Response.json(body, {
      headers: { 'Cache-Control': 'private, max-age=900, stale-while-revalidate=120' },
    });

  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/account] error:', logMessage);
    return Response.json(
      { error: 'Failed to load account data', detail: clientDetail },
      { status: 500 }
    );
  }
}
