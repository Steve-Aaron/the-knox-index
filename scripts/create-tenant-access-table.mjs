#!/usr/bin/env node
/**
 * scripts/create-tenant-access-table.mjs
 * --------------------------------------
 * Creates the `tenant_access` table that gates non-public tenants
 * (see lib/tenantAccess.ts). Idempotent — safe to re-run.
 *
 * One row per (email, tenantId):
 *   status = 'pending'  → asked for access, nobody has decided yet
 *   status = 'approved' → may read the tenant
 *   status = 'denied'   → refused; re-requesting does not reset it
 *
 * Users on a tenant's allowedDomains (lib/tenants.ts) never need a row.
 *
 * Run: node scripts/create-tenant-access-table.mjs
 */

import { BigQuery } from '@google-cloud/bigquery';

const PROJECT_ID = process.env.BIGQUERY_PROJECT_ID ?? 'project-ariadne';
const DATASET    = process.env.BIGQUERY_DATASET    ?? 'ariadne_tiktok_demo';
const CREDS      = (process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '').trim();

const opts = { projectId: PROJECT_ID };
if (CREDS) {
  if (CREDS.startsWith('{')) opts.credentials = JSON.parse(CREDS);
  else opts.keyFilename = CREDS;
}

const bq = new BigQuery(opts);

const SQL = `
CREATE TABLE IF NOT EXISTS \`${PROJECT_ID}.${DATASET}.tenant_access\` (
  email       STRING    NOT NULL OPTIONS(description="Sign-in address, lower-cased"),
  tenantId    STRING    NOT NULL OPTIONS(description="TenantId from lib/tenants.ts, e.g. 'world'"),
  status      STRING    NOT NULL OPTIONS(description="pending | approved | denied"),
  requestedAt TIMESTAMP OPTIONS(description="When the user asked for access"),
  decidedAt   TIMESTAMP OPTIONS(description="When an admin approved or denied"),
  decidedBy   STRING    OPTIONS(description="Admin email that made the decision"),
  note        STRING    OPTIONS(description="Free-text note from the admin")
)
OPTIONS(description="Per-tenant access approvals for gated Knox Index dashboards")
`;

const [job] = await bq.createQueryJob({ query: SQL, location: 'EU' });
await job.getQueryResults();
console.log(`✓ ${PROJECT_ID}.${DATASET}.tenant_access ready`);

// ── Form answers ──────────────────────────────────────────────────────────────
// Added after the first cut: the access request is a form, not a bare button,
// so the reviewer can see who is asking and why. Separate ALTER so existing
// deployments pick the columns up without recreating the table.
const ALTERS = [
  'requesterName   STRING OPTIONS(description="Full name given on the request form")',
  'organisation    STRING OPTIONS(description="Company or institution")',
  'jobRole         STRING OPTIONS(description="Job title or role")',
  'reason          STRING OPTIONS(description="Why they want access")',
  'areasOfInterest STRING OPTIONS(description="Comma-separated region keys the requester is interested in. Editorial interest only — it does NOT scope what they can see")',
  'referralSource  STRING OPTIONS(description="How they heard about the dashboard")',
].map(col => `ALTER TABLE \`${PROJECT_ID}.${DATASET}.tenant_access\` ADD COLUMN IF NOT EXISTS ${col};`).join('\n');

const [alterJob] = await bq.createQueryJob({ query: ALTERS, location: 'EU' });
await alterJob.getQueryResults();
console.log('✓ tenant_access form columns ready');
