/**
 * scripts/freq-diag.ts
 * ---------------------
 * Diagnostic: explains the frequency score for one politician.
 *
 * Frequency is normalised against the busiest account in the dataset, so the
 * top poster always scores 100. This script prints, per range, each account's
 * post count, the dataset max, and the resulting frequency score.
 *
 * Run from the project root (where .env.local + the BigQuery key resolve):
 *   npx tsx scripts/freq-diag.ts "luke evans"
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { BigQuery } from '@google-cloud/bigquery';

// Load .env.local into process.env before constructing the BigQuery client.
try {
  const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  console.warn('Could not read .env.local — relying on existing environment.');
}

const PROJECT_ID = process.env.BIGQUERY_PROJECT_ID ?? 'project-ariadne';
const DATASET    = process.env.BIGQUERY_DATASET    ?? 'ariadne_tiktok_demo';
const CREDS      = (process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '').trim();
const NEEDLE     = (process.argv[2] ?? 'luke evans').toLowerCase();

function makeClient(): BigQuery {
  const opts: ConstructorParameters<typeof BigQuery>[0] = { projectId: PROJECT_ID };
  if (CREDS.startsWith('{')) opts.credentials = JSON.parse(CREDS);
  else if (CREDS)            opts.keyFilename = CREDS;
  return new BigQuery(opts);
}

const bq = makeClient();
const tableRef = (t: string) => `\`${PROJECT_ID}.${DATASET}.${t}\``;
async function query<T>(sql: string): Promise<T[]> {
  const [rows] = await bq.query({ query: sql, location: 'EU' });
  return rows as T[];
}

const norm = (v: number, max: number) =>
  max <= 0 ? 0 : Math.round(Math.min(100, (v / max) * 100));

async function main() {
  const acct = await query<any>(`
    SELECT id, COALESCE(displayName, name) AS name, profile,
           COALESCE(totalFollowers,0) AS totalFollowers
    FROM ${tableRef('account')}
    WHERE LOWER(name) LIKE '%${NEEDLE}%'
       OR LOWER(COALESCE(displayName,'')) LIKE '%${NEEDLE}%'
       OR LOWER(profile) LIKE '%${NEEDLE.replace(/\s+/g, '')}%'
  `);

  console.log(`\n── Account match for "${NEEDLE}" ──`);
  console.table(acct);
  if (!acct.length) return;

  const profiles = acct.map((a: any) => (a.profile || '').replace(/^@/, '').toLowerCase());

  const ranges: Record<string, string> = {
    yesterday: `postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)`,
    week:      `postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)`,
    month:     `postDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)`,
    lifetime:  `postDate IS NOT NULL`,
  };

  for (const [name, filter] of Object.entries(ranges)) {
    const rows = await query<any>(`
      SELECT LTRIM(profile,'@') AS profile, COUNT(*) AS posts
      FROM ${tableRef('post')}
      WHERE ${filter}
      GROUP BY LTRIM(profile,'@')
      ORDER BY posts DESC
    `);
    const maxPosts = rows.length ? Math.max(...rows.map((r: any) => Number(r.posts))) : 1;
    const luke = rows.find((r: any) => profiles.includes((r.profile || '').toLowerCase()));
    const lukePosts = luke ? Number(luke.posts) : 0;

    console.log(`\n── range='${name}' ── maxPostsAcrossAccounts=${maxPosts}, accountsWithPosts=${rows.length}`);
    console.log(`   "${NEEDLE}" posts=${lukePosts} → frequency = round(min(100, ${lukePosts}/${maxPosts}*100)) = ${norm(lukePosts, maxPosts)}`);
    console.table(rows.slice(0, 5).map((r: any) => ({
      profile: r.profile,
      posts:   Number(r.posts),
      freq:    norm(Number(r.posts), maxPosts),
    })));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error('ERROR', e?.message ?? e); process.exit(1); });
