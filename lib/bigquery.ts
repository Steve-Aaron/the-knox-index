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
    try {
      // Cloud / CI environments pass the full JSON as the env var value
      opts.credentials = JSON.parse(CREDS_ENV);
    } catch {
      // Local dev: GOOGLE_APPLICATION_CREDENTIALS is a file path
      opts.keyFilename = CREDS_ENV;
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

/** Run a parameterised query and return typed rows. */
export async function query<T>(sql: string): Promise<T[]> {
  const bq = getBigQuery();
  const [rows] = await bq.query({ query: sql, location: 'EU' });
  return rows as T[];
}
