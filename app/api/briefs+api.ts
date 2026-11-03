/**
 * app/api/briefs+api.ts
 * ----------------------
 * Serves the most recent editorial briefing for the active dashboard and
 * platform. Briefs are written by the n8n workflow 'Brief writer (all
 * dashboards)' into `metadata.brief`, one row per date × dashboard × platform.
 *
 * GET /api/briefs?platform=all|tiktok|x   (no param = tiktok)
 *   Returns { brief: StoredBrief, isToday: boolean }
 *   isToday is false when no brief has been generated yet today — the
 *   caller can surface a staleness warning if desired.
 *
 * The Knox Index on TikTok falls back to the legacy `ariadne_tiktok_demo.brief`
 * table (UK-only, written by 'Create briefs') until the new workflow runs daily.
 *
 * No writes happen here. n8n owns generation and persistence.
 */

import { query, queryParams, tableRef, metadataRef } from '@/lib/bigquery';
import { guardTenant } from '@/lib/tenantGuard';
import { safeErrorDetail } from '@/lib/errors';
import { parsePlatformFilter } from '@/lib/platforms';
import type { StoredBrief, BriefsApiResponse } from '@/data/types';

interface BriefRow {
  briefDate:             string;
  briefDailySummary:     string;
  briefWeeklySummary:    string;
  topNarrativesThisWeek: string | null;   // BigQuery JSON columns arrive as strings
}

const BRIEF_COLUMNS = `
    FORMAT_DATE('%Y-%m-%d', briefDate) AS briefDate,
    briefDailySummary,
    briefWeeklySummary,
    TO_JSON_STRING(topNarrativesThisWeek) AS topNarrativesThisWeek`;

/** Latest brief for one dashboard and platform. */
const LATEST_BRIEF_SQL = `
  SELECT ${BRIEF_COLUMNS}
  FROM ${metadataRef('brief')}
  WHERE dashboardId = @dashboardId AND platform = @platform
  ORDER BY briefDate DESC
  LIMIT 1
`;

/** Legacy UK TikTok brief (no dashboard or platform column). */
const LEGACY_BRIEF_SQL = `
  SELECT ${BRIEF_COLUMNS}
  FROM ${tableRef('brief')}
  ORDER BY briefDate DESC
  LIMIT 1
`;

export async function GET(request: Request): Promise<Response> {
  const { tenant, denied } = await guardTenant(request);
  if (denied) return denied;

  // No param = TikTok, so the UK site's existing call is unchanged
  const raw = new URL(request.url).searchParams.get('platform');
  const platform = raw ? parsePlatformFilter(raw) : 'tiktok';

  try {
    let rows = await queryParams<BriefRow>(LATEST_BRIEF_SQL, { dashboardId: tenant.dashboardId, platform });
    // The legacy table is still written daily, so take it whenever it is newer
    if (tenant.dashboardId === 1 && platform === 'tiktok') {
      const legacy = await query<BriefRow>(LEGACY_BRIEF_SQL);
      if (legacy.length && (rows.length === 0 || legacy[0].briefDate > rows[0].briefDate)) rows = legacy;
    }

    if (rows.length === 0) {
      return Response.json(
        { error: 'No briefings found', detail: `No ${platform} briefing yet for ${tenant.brand.name}.` },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const row = rows[0];

    // Parse the JSON column — n8n stores it as a JSON object; TO_JSON_STRING
    // serialises it back to a string for safe transport.
    let narratives: Array<{ headline: string; body: string }> = [];
    if (row.topNarrativesThisWeek) {
      try {
        let parsed = JSON.parse(row.topNarrativesThisWeek);
        // The legacy table double-encodes: a JSON string holding the array
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
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
