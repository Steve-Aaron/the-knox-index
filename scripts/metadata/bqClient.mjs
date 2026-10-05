/**
 * scripts/metadata/bqClient.mjs
 * -----------------------------
 * One BigQuery client for the metadata scripts, configured the same way the
 * app is: BIGQUERY_PROJECT_ID / BIGQUERY_DATASET / GOOGLE_APPLICATION_CREDENTIALS
 * from .env.local, EU location on every query.
 *
 * One job: hand out a configured client and the table names.
 */

import './loadEnv.mjs';
import { BigQuery } from '@google-cloud/bigquery';

export const PROJECT_ID   = process.env.BIGQUERY_PROJECT_ID ?? 'project-ariadne';
export const TIKTOK_SET   = process.env.BIGQUERY_DATASET    ?? 'ariadne_tiktok_demo';
export const METADATA_SET = process.env.BIGQUERY_METADATA_DATASET ?? 'metadata';
export const LOCATION     = 'EU';

const CREDS = (process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '').trim();

const opts = { projectId: PROJECT_ID };
if (CREDS) {
  if (CREDS.startsWith('{')) opts.credentials = JSON.parse(CREDS);
  else opts.keyFilename = CREDS;
}

export const bq = new BigQuery(opts);

/** Fully-qualified table name for a template literal. */
export const tiktok   = t => `\`${PROJECT_ID}.${TIKTOK_SET}.${t}\``;
export const metadata = t => `\`${PROJECT_ID}.${METADATA_SET}.${t}\``;

export async function query(sql, params) {
  const [rows] = await bq.query(params ? { query: sql, params, location: LOCATION } : { query: sql, location: LOCATION });
  return rows;
}
