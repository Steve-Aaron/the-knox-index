/**
 * scripts/metadata/loadEnv.mjs
 * -----------------------------
 * Loads .env.local into process.env, so these scripts work when run directly
 * with `node scripts/...` and not only through an npm script with the env
 * already exported.
 *
 * Without this, BigQuery falls back to application default credentials, which
 * are not set up on a dev machine, and the failure reads as an auth problem
 * rather than a missing file.
 *
 * Existing environment variables win, so CI and one-off overrides still work.
 *
 * One job: make the scripts runnable straight from the repo.
 */

import { existsSync, readFileSync } from 'node:fs';

for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;

  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;

    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
