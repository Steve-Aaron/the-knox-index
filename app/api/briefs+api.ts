/**
 * app/api/briefs+api.ts
 * ----------------------
 * Serves the most recent editorial briefing stored in the BigQuery
 * `ariadne_tiktok_demo.brief` table (written by the n8n workflow).
 *
 * GET /api/briefs
 *   Returns { brief: StoredBrief, isToday: boolean }
 *   isToday is false when no brief has been generated yet today — the
 *   caller can surface a staleness warning if desired.
 *
 * No writes happen here. n8n owns generation and persistence.
 */

import { query, tableRef } from '@/lib/bigquery';
import { safeErrorDetail } from '@/lib/errors';
import type { StoredBrief, BriefsApiResponse } from '@/data/types';

interface BriefRow {
  briefDate:             string;
  briefDailySummary:     string;
  briefWeeklySummary:    string;
  topNarrativesThisWeek: string | null;   // BigQuery JSON columns arrive as strings
}

const LATEST_BRIEF_SQL = `
  SELECT
    FORMAT_DATE('%Y-%m-%d', briefDate) AS briefDate,
    briefDailySummary,
    briefWeeklySummary,
    TO_JSON_STRING(topNarrativesThisWeek) AS topNarrativesThisWeek
  FROM ${tableRef('brief')}
  ORDER BY briefDate DESC
  LIMIT 1
`;

export async function GET(_request: Request): Promise<Response> {
  try {
    const rows = await query<BriefRow>(LATEST_BRIEF_SQL);

    if (rows.length === 0) {
      return Response.json(
        { error: 'No briefings found', detail: 'The brief table is empty.' },
        { status: 404 },
      );
    }

    const row = rows[0];

    // Parse the JSON column — n8n stores it as a JSON object; TO_JSON_STRING
    // serialises it back to a string for safe transport.
    let narratives: Array<{ headline: string; body: string }> = [];
    if (row.topNarrativesThisWeek) {
      try {
        const parsed = JSON.parse(row.topNarrativesThisWeek);
        // Support both an array at root and { narratives: [...] }
        narratives = Array.isArray(parsed) ? parsed : (parsed.narratives ?? []);
      } catch {
        // Non-fatal — surface an empty narratives list rather than a 500
        console.warn('[/api/briefs] Failed to parse topNarrativesThisWeek JSON');
      }
    }

    const today = new Date().toISOString().slice(0, 10);

    const brief: StoredBrief = {
      briefDate:             row.briefDate,
      briefDailySummary:     row.briefDailySummary  ?? '',
      briefWeeklySummary:    row.briefWeeklySummary ?? '',
      topNarrativesThisWeek: narratives,
    };

    const payload: BriefsApiResponse = {
      brief,
      isToday: row.briefDate === today,
    };

    return Response.json(
      payload,
      // Short cache — stale data should refresh within a few minutes.
      // n8n writes once per day so there's no value in a long TTL.
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' } },
    );

  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/briefs] error:', logMessage);
    return Response.json(
      { error: 'Failed to load briefing', detail: clientDetail },
      { status: 500 },
    );
  }
}
