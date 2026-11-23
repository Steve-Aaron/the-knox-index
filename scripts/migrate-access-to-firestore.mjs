#!/usr/bin/env node
/**
 * scripts/migrate-access-to-firestore.mjs
 * ----------------------------------------
 * One-off: move the old BigQuery `tenant_access` rows into Firestore, keyed by
 * Firebase uid, with no identifying fields (the new model — lib/tenantAccess.ts).
 *
 * For each row it resolves the email to a Firebase uid and writes one Firestore
 * doc `tenantAccess/<uid>__<tenantId>` { firebaseUid, tenantId, status,
 * requestedAt, decidedAt, decidedBy }. The requester's name, company and the
 * rest stay in Brevo — they are not copied here.
 *
 * A row whose email has NO Firebase account cannot be keyed by uid. Those are
 * listed, not guessed: a person approved under the old email-only flow who has
 * never signed in has no uid yet. Decide per person (re-approve on next sign-in,
 * or create an account) — the script does not create accounts.
 *
 * Reads credentials from the same env the app uses (FIREBASE_SERVICE_ACCOUNT,
 * BIGQUERY_* ). Dry-run by default; pass --commit to write.
 *
 *   node scripts/migrate-access-to-firestore.mjs            # dry run
 *   node scripts/migrate-access-to-firestore.mjs --commit   # write
 */

import './metadata/loadEnv.mjs';
import { BigQuery } from '@google-cloud/bigquery';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const COMMIT  = process.argv.includes('--commit');
const PROJECT = process.env.BIGQUERY_PROJECT_ID ?? 'project-ariadne';
const DATASET = process.env.BIGQUERY_DATASET    ?? 'ariadne_tiktok_demo';

function firebase() {
  if (getApps().length) return getApps()[0];
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT ?? '').trim();
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  return initializeApp({ credential: cert(raw.startsWith('{') ? JSON.parse(raw) : raw) });
}

async function main() {
  const app  = firebase();
  const auth = getAuth(app);
  const db   = getFirestore(app);
  const bq   = new BigQuery({ projectId: PROJECT });

  console.log(`\nMigrate tenant_access → Firestore  (${COMMIT ? 'COMMIT' : 'dry run'})\n`);

  let rows;
  try {
    [rows] = await bq.query({
      query: `SELECT email, tenantId, status,
                     CAST(requestedAt AS STRING) AS requestedAt,
                     CAST(decidedAt   AS STRING) AS decidedAt,
                     decidedBy
              FROM \`${PROJECT}.${DATASET}.tenant_access\``,
      location: 'EU',
    });
  } catch (err) {
    console.error('Could not read tenant_access (already migrated and dropped?):', err?.message ?? err);
    process.exit(1);
  }

  const migrated = [];
  const orphans  = [];

  for (const r of rows) {
    const email = String(r.email ?? '').trim().toLowerCase();
    if (!email) continue;
    let uid;
    try {
      uid = (await auth.getUserByEmail(email)).uid;
    } catch {
      orphans.push({ email, status: r.status });
      continue;
    }
    const tenantId = String(r.tenantId);
    const doc = {
      firebaseUid: uid,
      tenantId,
      status:      String(r.status),
      requestedAt: r.requestedAt ?? null,
      decidedAt:   r.decidedAt ?? null,
      decidedBy:   r.decidedBy ?? null,  // legacy: an admin email, not a uid
      note:        null,
    };
    if (COMMIT) await db.collection('tenantAccess').doc(`${uid}__${tenantId}`).set(doc, { merge: true });
    migrated.push({ email, uid, tenantId, status: doc.status });
  }

  console.log(`Migrated ${migrated.length} row(s)${COMMIT ? '' : ' (dry run — nothing written)'}:`);
  migrated.forEach(m => console.log(`  ${m.status.padEnd(9)} ${m.email}  →  ${m.uid}  (tenant ${m.tenantId})`));

  if (orphans.length) {
    console.log(`\n${orphans.length} row(s) have NO Firebase account — decide per person, not migrated:`);
    orphans.forEach(o => console.log(`  ${o.status.padEnd(9)} ${o.email}`));
  }

  console.log(COMMIT
    ? '\nDone. Verify in Firestore, then the BigQuery tenant_access table can be retired.\n'
    : '\nDry run complete. Re-run with --commit to write to Firestore.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
