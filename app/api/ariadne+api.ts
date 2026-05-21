/**
 * app/api/ariadne+api.ts
 * -----------------------
 * Expo Router server API route. Runs in Node.js only — never sent to the browser.
 * Queries BigQuery and returns a Politician[] JSON array.
 *
 * GET  /api/ariadne               → full politician list (defaults to yesterday)
 * GET  /api/ariadne?range=week    → week-range aggregates
 * GET  /api/ariadne?debug=1       → returns raw field names + sample rows for schema verification
 */

import { query, tableRef } from '@/lib/bigquery';
import { signMediaFields, signGcsUrl } from '@/lib/gcs';
import { safeErrorDetail } from '@/lib/errors';
import { transformToPoliticians } from '@/data/transformers';
import { parseRange, buildAccountsSQL, buildPostsSQL } from '@/lib/bqQueries';
import type { BQAccountRow, BQPostRow } from '@/data/transformers';

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const params  = new URL(request.url).searchParams;
  const isDebug = params.get('debug') === '1';
  const isDiag  = params.get('diag')  === '1';
  const range   = parseRange(params.get('range'));

  // Debug mode: return raw schema info independently of the main query
  if (isDebug) {
    try {
      const DEBUG = (t: string) => `SELECT * FROM ${tableRef(t)} LIMIT 1`;
      const [acc, post, metrics] = await Promise.all([
        query<Record<string, unknown>>(DEBUG('account')),
        query<Record<string, unknown>>(DEBUG('post')),
        query<Record<string, unknown>>(DEBUG('accountMetrics')),
      ]);
      return Response.json({
        accountFields:  Object.keys(acc[0]    ?? {}),
        postFields:     Object.keys(post[0]   ?? {}),
        metricsFields:  Object.keys(metrics[0] ?? {}),
        accountSample:  acc[0],
        postSample:     post[0],
      });
    } catch (err: unknown) {
      const { clientDetail, logMessage } = safeErrorDetail(err);
      console.error('[/api/ariadne?debug=1] error:', logMessage);
      return Response.json(
        { error: 'Debug query failed', detail: clientDetail },
        { status: 500 }
      );
    }
  }

  // Diagnostic mode: run each pipeline step in isolation to identify failures.
  if (isDiag) {
    const steps: Record<string, unknown> = {};

    try {
      const rows = await query<Record<string, unknown>>(buildAccountsSQL(range));
      steps['accounts_sql'] = { ok: true, row_count: rows.length, sample: rows[0] };
    } catch (err: unknown) {
      steps['accounts_sql'] = { ok: false, error: String(err) };
    }

    try {
      const rows = await query<Record<string, unknown>>(buildPostsSQL(range));
      steps['posts_sql'] = { ok: true, row_count: rows.length, sample: rows[0] };
    } catch (err: unknown) {
      steps['posts_sql'] = { ok: false, error: String(err) };
    }

    try {
      const rows = await query<Record<string, unknown>>(
        `SELECT * FROM ${tableRef('account_x_accountType')} LIMIT 1`
      );
      steps['account_x_accountType'] = { ok: true, row_count: rows.length, fields: Object.keys(rows[0] ?? {}) };
    } catch (err: unknown) {
      steps['account_x_accountType'] = { ok: false, error: String(err) };
    }

    try {
      const rows = await query<Record<string, unknown>>(
        `SELECT * FROM ${tableRef('accountType')} ORDER BY id`
      );
      steps['accountType'] = { ok: true, rows };
    } catch (err: unknown) {
      steps['accountType'] = { ok: false, error: String(err) };
    }

    return Response.json({ steps });
  }

  // Main data fetch
  try {
    const [accountRows, postRows] = await Promise.all([
      query<BQAccountRow>(buildAccountsSQL(range)),
      query<BQPostRow>(buildPostsSQL(range)),
    ]);

    const politicians = transformToPoliticians(accountRows, postRows);

    await Promise.all([
      ...politicians.flatMap(p =>
        p.recentPosts.map(async (post, i) => {
          const signed = await signMediaFields(post);
          p.recentPosts[i] = signed;
        })
      ),
      ...politicians.map(async p => {
        if (p.avatarUrl) {
          p.avatarUrl = await signGcsUrl(p.avatarUrl);
        }
      }),
    ]);

    return Response.json(
      { politicians },
      { headers: { 'Cache-Control': 'private, max-age=1800, stale-while-revalidate=120' } }
    );

  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/ariadne] BigQuery error:', logMessage);
    return Response.json(
      { error: 'Failed to fetch data from BigQuery', detail: clientDetail },
      { status: 500 }
    );
  }
}
