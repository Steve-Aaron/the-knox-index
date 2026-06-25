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

/** Fully-qualified table ref: `project.dataset.table` */
export function tableRef(table: string): string {
  return `\`${PROJECT_ID}.${DATASET}.${table}\``;
}

// ── Dashboard membership gate ─────────────────────────────────────────────────
//
// The PUBLIC WEBSITE must only ever surface accounts that are mapped to
// dashboard 1, and only posts whose parent account is. Membership lives in the
// external `account_x_dashboard` table (managed manually at source — a Sheet).
//
// These two gated sources are the SINGLE chokepoint: every website read of
// accounts/posts selects FROM them instead of the base `account`/`post` tables,
// so the dashboardId = 1 filter is defined in exactly one place and can't be
// bypassed by an individual query. Admin APIs and the ingest pipeline keep
// using the base tables (admin must see accounts NOT yet on the dashboard).
//
// Nothing changes visibly while every account is on dashboard 1; the gate only
// hides accounts (and their posts) that are absent from the membership table.
const DASHBOARD_ID = 1;

/** Gated account source — accounts mapped to dashboard 1. Use as a derived
 *  table, e.g. `FROM ${ACCOUNT_WEB} a`. */
export const ACCOUNT_WEB = `(
  SELECT a.*
  FROM ${tableRef('account')} a
  JOIN ${tableRef('account_x_dashboard')} d
    ON CAST(d.accountId AS STRING) = CAST(a.id AS STRING)
  WHERE d.dashboardId = ${DASHBOARD_ID}
)`;

/** Gated post source — posts whose parent account is mapped to dashboard 1
 *  (matched on the profile link). Use as a derived table, e.g.
 *  `FROM ${POST_WEB} p`. */
export const POST_WEB = `(
  SELECT p.*
  FROM ${tableRef('post')} p
  WHERE LTRIM(LOWER(p.profile), '@') IN (
    SELECT LTRIM(LOWER(a.profile), '@')
    FROM ${tableRef('account')} a
    JOIN ${tableRef('account_x_dashboard')} d
      ON CAST(d.accountId AS STRING) = CAST(a.id AS STRING)
    WHERE d.dashboardId = ${DASHBOARD_ID}
  )
)`;

/** Run a parameterised query and return typed rows. */
export async function query<T>(sql: string): Promise<T[]> {
  const bq = getBigQuery();
  const [rows] = await bq.query({ query: sql, location: 'EU' });
  return rows as T[];
}
