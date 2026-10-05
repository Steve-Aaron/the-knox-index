/**
 * lib/bigquery.ts
 * ----------------
 * Server-side only. BigQuery client singleton + typed query helpers.
 * Never import this from client-side React components — it will fail.
 * Only used inside app/api/* routes.
 */

import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.BIGQUERY_PROJECT_ID ?? 'project-ariadne';
const DATASET    = process.env.BIGQUERY_DATASET    ?? 'ariadne_tiktok_demo';
const METADATA_DATASET = process.env.BIGQUERY_METADATA_DATASET ?? 'metadata';
const CREDS_ENV  = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '';

function makeClient(): BigQuery {
  const opts: ConstructorParameters<typeof BigQuery>[0] = { projectId: PROJECT_ID };
  if (CREDS_ENV) {
    const trimmed = CREDS_ENV.trim();

    // If the value LOOKS like JSON (starts with `{`) it must parse cleanly.
    // We refuse to fall through to keyFilename in that case because the SDK
    // would otherwise embed the entire malformed JSON — including the
    // private_key — into its error messages.
    if (trimmed.startsWith('{')) {
      try {
        opts.credentials = JSON.parse(trimmed);
      } catch {
        throw new Error(
          'GOOGLE_APPLICATION_CREDENTIALS looks like JSON but failed to parse. ' +
          'Newlines inside private_key must be escaped as \\n, not raw line breaks.',
        );
      }
    } else {
      // Treat as a file path on disk. The BigQuery SDK resolves relative paths
      // against process.cwd(), which is always the project root when running
      // via `npm run web` or Expo CLI. Use an absolute path in .env.local to
      // remove any ambiguity (e.g. GOOGLE_APPLICATION_CREDENTIALS=/abs/path/key.json).
      opts.keyFilename = trimmed;
    }
  }
  return new BigQuery(opts);
}

// Singleton — reuse across requests in the same process
let _client: BigQuery | null = null;
export function getBigQuery(): BigQuery {
  if (!_client) _client = makeClient();
  return _client;
}

/** Fully-qualified table ref in the platform dataset: `project.dataset.table` */
export function tableRef(table: string): string {
  return `\`${PROJECT_ID}.${DATASET}.${table}\``;
}

/**
 * Fully-qualified ref in the shared metadata dataset, which holds the people
 * and organisations behind the accounts, plus topics and hooks. It must live in
 * the same BigQuery location as the platform dataset or no query can join them.
 */
export function metadataRef(table: string): string {
  return `\`${PROJECT_ID}.${METADATA_DATASET}.${table}\``;
}

// ── Dashboard membership gate ─────────────────────────────────────────────────
//
// A PUBLIC WEBSITE READ must only ever surface accounts mapped to the tenant's
// dashboard, and only posts whose parent account is. Membership lives in the
// external `account_x_dashboard` table (managed manually at source — a Sheet).
//
// These two gated sources are the SINGLE chokepoint: every website read of
// accounts/posts selects FROM them instead of the base `account`/`post` tables,
// so the dashboardId filter is defined in exactly one place and can't be
// bypassed by an individual query. Admin APIs and the ingest pipeline keep
// using the base tables (admin must see accounts NOT yet on a dashboard).
//
// The id is REQUEST-SCOPED: lib/tenantRequest.ts resolves it from the request's
// host (index.knox.digital → 1, worldleaders.index.knox.digital → 2) and each
// route passes it down. There is deliberately no default — a caller that forgets
// to pass one gets a type error rather than silently leaking dashboard 1.

/** Reject anything that isn't a positive integer before it reaches SQL. */
function assertDashboardId(dashboardId: number): number {
  if (!Number.isInteger(dashboardId) || dashboardId < 1) {
    throw new Error(`Invalid dashboardId: ${String(dashboardId)}`);
  }
  return dashboardId;
}

/**
 * Gated account source — accounts mapped to this dashboard, with the editorial
 * fields from `metadata.person` joined on. Use as a derived table, e.g.
 * `FROM ${accountWeb(id)} a`.
 *
 * The join is a LEFT JOIN on purpose: an account ingested but not yet linked to
 * a person still appears, with empty person fields, rather than vanishing from
 * the dashboard. `person_id IS NULL` is a data task, not an outage.
 */
export function accountWeb(dashboardId: number): string {
  const id = assertDashboardId(dashboardId);
  return `(
  SELECT
    a.*,
    p.slug                   AS person_slug,
    p.name                   AS person_name,
    p.display_job_title      AS person_job_title,
    p.party                  AS person_party,
    p.wing                   AS person_wing,
    p.location.country       AS person_country,
    p.location.region        AS person_region,
    p.location.constituency  AS person_constituency,
    p.location.latitude      AS person_latitude,
    p.location.longitude     AS person_longitude
  FROM ${tableRef('account')} a
  JOIN ${tableRef('account_x_dashboard')} d
    ON CAST(d.accountId AS STRING) = CAST(a.id AS STRING)
  LEFT JOIN ${metadataRef('person')} p
    ON p.person_id = a.person_id
  WHERE d.dashboardId = ${id}
)`;
}

/** Gated post source — posts whose parent account is mapped to this dashboard
 *  (matched on the profile link). Use as a derived table, e.g.
 *  `FROM ${postWeb(id)} p`. */
export function postWeb(dashboardId: number): string {
  const id = assertDashboardId(dashboardId);
  return `(
  SELECT p.*
  FROM ${tableRef('post')} p
  WHERE LTRIM(LOWER(p.profile), '@') IN (
    SELECT LTRIM(LOWER(a.profile), '@')
    FROM ${tableRef('account')} a
    JOIN ${tableRef('account_x_dashboard')} d
      ON CAST(d.accountId AS STRING) = CAST(a.id AS STRING)
    WHERE d.dashboardId = ${id}
  )
)`;
}

/** Run a query and return typed rows. */
export async function query<T>(sql: string): Promise<T[]> {
  const bq = getBigQuery();
  const [rows] = await bq.query({ query: sql, location: 'EU' });
  return rows as T[];
}

/**
 * Run a query with NAMED PARAMETERS and return typed rows.
 * Use this whenever a value originates from user input (emails, handles typed
 * by a person) — the value never becomes part of the SQL text, so it cannot
 * change the shape of the query.
 */
export async function queryParams<T>(
  sql: string,
  params: Record<string, unknown>,
  /**
   * BigQuery cannot infer the type of a null, so any parameter that may be null
   * must declare one here ('STRING', 'FLOAT64', 'INT64', 'BOOL', 'TIMESTAMP').
   * Parameters that are never null can be left out.
   */
  types?: Record<string, string>,
): Promise<T[]> {
  const bq = getBigQuery();
  const [rows] = await bq.query(
    types ? { query: sql, params, types, location: 'EU' }
          : { query: sql, params, location: 'EU' },
  );
  return rows as T[];
}
