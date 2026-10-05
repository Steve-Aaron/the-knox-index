#!/usr/bin/env node
/**
 * scripts/metadata/006-person-origin.mjs
 * --------------------------------------
 * Adds two columns to metadata.person so a person created by hand is
 * distinguishable from one the backfill built:
 *
 *   source_platform  'tiktok' when 002 built them from a TikTok account,
 *                    'x' when they were created from an X account on
 *                    /admin/links, 'manual' when neither
 *   created_by       the admin who created them, NULL for backfilled rows
 *
 * Both are additive. Existing rows are stamped 'tiktok', which is what they
 * all are today.
 *
 * Run: npm run meta:origin
 */

import { query, metadata } from './bqClient.mjs';

await query(`ALTER TABLE ${metadata('person')}
  ADD COLUMN IF NOT EXISTS source_platform STRING,
  ADD COLUMN IF NOT EXISTS created_by      STRING`);
console.log('  ✓ columns present on metadata.person');

const [before] = await query(`SELECT COUNTIF(source_platform IS NULL) AS n FROM ${metadata('person')}`);

// Everything that exists today came from a TikTok account via 002.
await query(`UPDATE ${metadata('person')}
  SET source_platform = 'tiktok'
  WHERE source_platform IS NULL AND source_account_id IS NOT NULL`);

const [after] = await query(`
  SELECT source_platform, COUNT(*) AS n FROM ${metadata('person')}
  GROUP BY 1 ORDER BY 2 DESC`);

console.log(`  ✓ stamped ${before.n} existing rows as 'tiktok'`);
console.log(`\n  ${JSON.stringify(after)}\n`);
