/**
 * app/api/admin/post-summary+api.ts
 * ----------------------------------
 * POST /api/admin/post-summary
 * Body: { postId: string, summary: string }
 *
 * Overwrites a single post's videoSummary in BigQuery. Admin-only.
 *
 * Protected: Firebase session + ADMIN_EMAILS allowlist (lib/adminAuth).
 *
 * NOTE on BigQuery DML: `post` is an analytics table. BigQuery cannot UPDATE
 * rows that are still in the streaming buffer, and DML statements are subject
 * to per-table quotas. A summary edit on a freshly-ingested post may therefore
 * fail or 5xx — that is an accepted trade-off of writing the main table
 * directly rather than via a separate overrides table. `summary` is passed as
 * a query parameter (not interpolated) to prevent SQL injection.
 */

import { getBigQuery, tableRef } from '@/lib/bigquery';
import { safeErrorDetail } from '@/lib/errors';
import { isAdminRequest } from '@/lib/adminAuth';

const MAX_SUMMARY_LEN = 5000;

export async function POST(request: Request): Promise<Response> {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let postId: string;
  let summary: string;
  try {
    const body = (await request.json()) as { postId?: string; summary?: string };
    postId  = String(body.postId ?? '').trim();
    summary = String(body.summary ?? '').trim();

    // postId is interpolated indirectly via a parameter, but we still validate
    // it is numeric-only to match the post table's key shape and fail fast.
    if (!/^\d+$/.test(postId)) {
      return Response.json({ error: 'Invalid postId' }, { status: 400 });
    }
    if (summary.length === 0) {
      return Response.json({ error: 'Summary cannot be empty' }, { status: 400 });
    }
    if (summary.length > MAX_SUMMARY_LEN) {
      return Response.json({ error: `Summary too long (max ${MAX_SUMMARY_LEN} chars)` }, { status: 400 });
    }
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const bq = getBigQuery();
    await bq.query({
      query: `
        UPDATE ${tableRef('post')}
        SET videoSummary = @summary
        WHERE CAST(postId AS STRING) = @postId
      `,
      params:   { summary, postId },
      location: 'EU',
    });

    return Response.json({ success: true, summary });
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/admin/post-summary POST]', logMessage);
    return Response.json(
      { error: 'Failed to update summary', detail: clientDetail },
      { status: 500 },
    );
  }
}
