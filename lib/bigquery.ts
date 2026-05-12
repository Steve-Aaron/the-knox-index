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

/** Run a parameterised query and return typed rows. */
export async function query<T>(sql: string): Promise<T[]> {
  const bq = getBigQuery();
  const [rows] = await bq.query({ query: sql, location: 'EU' });
  return rows as T[];
}
