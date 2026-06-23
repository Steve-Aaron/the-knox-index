/**
 * scripts/migrate-daily-to-weekly.mjs
 * -----------------------------------
 * One-off migration: move every contact off the Daily Briefing list and onto
 * the Weekly Briefing list, keeping the CONSENT_* mirror attributes in sync.
 *
 * The daily cadence has been retired from the product (the picker now only
 * offers Weekly / None, and 'yesterday' is gone from the dashboard). This
 * script brings the live Brevo audience in line with that decision.
 *
 * What it does, in order:
 *   1. Pages through every contact on the Daily list (default #4).
 *   2. Bulk-adds them to the Weekly list (default #9).
 *   3. Bulk-removes them from the Daily list.
 *   4. (unless --skip-attributes) Sets CONSENT_DAILY_BRIEFING=false and
 *      CONSENT_WEEKLY_BRIEFING=true on each contact so the attribute mirror
 *      matches list membership.
 *
 * Brevo list membership is the canonical subscription state (see lib/brevo.ts),
 * so steps 2–3 are the substantive change; step 4 keeps the mirror honest.
 *
 * Usage (from project root):
 *   node scripts/migrate-daily-to-weekly.mjs --dry-run     # inspect, change nothing
 *   node scripts/migrate-daily-to-weekly.mjs               # run the migration
 *   node scripts/migrate-daily-to-weekly.mjs --skip-attributes
 *
 * Env (from the shell or .env.local):
 *   BREVO_API_KEY              required
 *   BREVO_LIST_DAILY_BRIEFING  optional, default 4
 *   BREVO_LIST_WEEKLY_BRIEFING optional, default 9
 *
 * Exit code 0 = success (or clean dry-run), 1 = error.
 *
 * SAFETY: always run with --dry-run first. This script mutates the live
 * Brevo audience and is not transactional — if it fails part-way, re-running
 * it is safe (adds/removes are idempotent).
 */

import { readFileSync } from 'fs';

// ── Config ────────────────────────────────────────────────────────────────────

const BREVO_BASE = 'https://api.brevo.com/v3';
const PAGE_SIZE  = 500;   // Brevo max for list-contacts is 500
const BULK_CHUNK = 150;   // Brevo max emails per add/remove call is 150
const ATTR_DELAY_MS = 120; // ~8 req/s — stays under Brevo's rate limit

const args            = process.argv.slice(2);
const DRY_RUN         = args.includes('--dry-run');
const SKIP_ATTRIBUTES = args.includes('--skip-attributes');

// ── Env loading: prefer real env, fall back to .env.local ─────────────────────

function loadEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const line = readFileSync('.env.local', 'utf8')
      .split('\n')
      .find(l => l.trim().startsWith(`${key}=`));
    if (line) return line.slice(line.indexOf('=') + 1).trim();
  } catch { /* no .env.local — fine */ }
  return undefined;
}

const BREVO_API_KEY = loadEnv('BREVO_API_KEY');
const DAILY_LIST    = Number(loadEnv('BREVO_LIST_DAILY_BRIEFING')  ?? 4);
const WEEKLY_LIST   = Number(loadEnv('BREVO_LIST_WEEKLY_BRIEFING') ?? 9);

if (!BREVO_API_KEY) {
  console.error('FAIL: BREVO_API_KEY not set (shell env or .env.local).');
  process.exit(1);
}

// ── Brevo fetch helper with 429 back-off ──────────────────────────────────────

async function brevo(path, { method = 'GET', body } = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${BREVO_BASE}${path}`, {
      method,
      headers: {
        'api-key':      BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after')) || 2;
      console.warn(`  rate-limited, waiting ${retryAfter}s…`);
      await sleep(retryAfter * 1000);
      continue;
    }

    const text = await res.text();
    const json = text ? safeJson(text) : null;
    return { ok: res.ok || res.status === 204, status: res.status, json };
  }
  return { ok: false, status: 429, json: null };
}

const safeJson = t => { try { return JSON.parse(t); } catch { return null; } };
const sleep    = ms => new Promise(r => setTimeout(r, ms));
const chunk    = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// ── Step 1: collect every email on the Daily list ─────────────────────────────

async function collectDailyContacts() {
  const emails = [];
  let offset = 0;
  for (;;) {
    const { ok, status, json } = await brevo(
      `/contacts/lists/${DAILY_LIST}/contacts?limit=${PAGE_SIZE}&offset=${offset}&sort=desc`
    );
    if (!ok) throw new Error(`list fetch failed (HTTP ${status}) at offset ${offset}`);

    const batch = json?.contacts ?? [];
    for (const c of batch) if (c.email) emails.push(c.email);

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return emails;
}

// ── Step 2/3: bulk list add + remove ──────────────────────────────────────────

async function bulkList(listId, op, emails) {
  for (const part of chunk(emails, BULK_CHUNK)) {
    const { ok, status } = await brevo(
      `/contacts/lists/${listId}/contacts/${op}`,
      { method: 'POST', body: { emails: part } }
    );
    if (!ok) throw new Error(`list ${op} (list ${listId}) failed: HTTP ${status}`);
    process.stdout.write(`  ${op} ${part.length} → list ${listId}\n`);
  }
}

// ── Step 4: mirror the consent attributes per contact ─────────────────────────

async function syncAttributes(emails) {
  let done = 0;
  for (const email of emails) {
    const { ok, status } = await brevo(`/contacts/${encodeURIComponent(email)}`, {
      method: 'PUT',
      body: {
        attributes: {
          CONSENT_DAILY_BRIEFING:  false,
          CONSENT_WEEKLY_BRIEFING: true,
        },
      },
    });
    // 404 = contact vanished between steps; not fatal for a one-off migration.
    if (!ok && status !== 404) console.warn(`  attr update failed for ${email}: HTTP ${status}`);
    if (++done % 100 === 0) console.log(`  attributes synced: ${done}/${emails.length}`);
    await sleep(ATTR_DELAY_MS);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Brevo daily→weekly migration  (daily list #${DAILY_LIST} → weekly list #${WEEKLY_LIST})`);
  console.log(DRY_RUN ? 'MODE: dry-run (no writes)\n' : 'MODE: LIVE\n');

  console.log('Collecting contacts on the Daily list…');
  const emails = await collectDailyContacts();
  console.log(`Found ${emails.length} daily contact(s).`);

  if (emails.length === 0) {
    console.log('Nothing to migrate. Done.');
    return;
  }

  if (DRY_RUN) {
    console.log('\nSample (first 10):');
    emails.slice(0, 10).forEach(e => console.log(`  ${e}`));
    console.log('\nDry-run complete — no changes made. Re-run without --dry-run to migrate.');
    return;
  }

  console.log('\nAdding to Weekly list…');
  await bulkList(WEEKLY_LIST, 'add', emails);

  console.log('Removing from Daily list…');
  await bulkList(DAILY_LIST, 'remove', emails);

  if (SKIP_ATTRIBUTES) {
    console.log('\nSkipping attribute mirror (--skip-attributes). List membership is migrated.');
  } else {
    console.log('\nSyncing CONSENT_* attributes…');
    await syncAttributes(emails);
  }

  console.log(`\nDone. Migrated ${emails.length} contact(s) from daily to weekly.`);
}

main().catch(e => {
  console.error('\nMigration aborted:', e.message);
  console.error('Re-running is safe — list add/remove operations are idempotent.');
  process.exit(1);
});
