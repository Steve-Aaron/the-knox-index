/**
 * app/api/admin/accounts+api.ts
 * --------------------------------
 * GET  /api/admin/accounts  — list all accounts with full fields + accountTypes
 * POST /api/admin/accounts  — insert a new account and fire the N8N webhook
 *
 * Protected: Firebase session + ADMIN_EMAILS allowlist (lib/adminAuth).
 */

import { getBigQuery, tableRef, query } from '@/lib/bigquery';
import { safeErrorDetail } from '@/lib/errors';
import { isAdminRequest } from '@/lib/adminAuth';


// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminAccountRow {
  id:               string;
  name:             string | null;
  profile:          string | null;
  party:            string | null;
  affiliation:      string | null;
  avatar:           string | null;
  displayName:      string | null;
  displayJobTitle:  string | null;
  isActive:         boolean | null;
  accountTypeIds:   string | null;   // comma-separated IDs from STRING_AGG
  accountTypeNames: string | null;   // comma-separated names from STRING_AGG
}

export interface AdminAccountType {
  id:   number;
  name: string;
}

// ── GET — list all accounts ────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const [accounts, accountTypes] = await Promise.all([
      query<AdminAccountRow>(`
        SELECT
          CAST(a.id AS STRING) AS id,
          a.name,
          a.profile,
          a.party,
          a.affiliation,
          a.avatar,
          a.displayName,
          a.displayJobTitle,
          a.isActive,
          STRING_AGG(CAST(axat.accountTypeId AS STRING), ',' ORDER BY axat.accountTypeId) AS accountTypeIds,
          STRING_AGG(atype.name,                         ',' ORDER BY axat.accountTypeId) AS accountTypeNames
        FROM ${tableRef('account')} a
        LEFT JOIN ${tableRef('account_x_accountType')} axat ON a.id = axat.accountId
        LEFT JOIN ${tableRef('accountType')} atype ON axat.accountTypeId = atype.id
        GROUP BY
          CAST(a.id AS STRING), a.name, a.profile, a.party, a.affiliation,
          a.avatar, a.displayName, a.displayJobTitle, a.isActive
        ORDER BY a.name
      `),
      query<AdminAccountType>(`
        SELECT id, name FROM ${tableRef('accountType')} ORDER BY id
      `),
    ]);

    return Response.json({ accounts, accountTypes });
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/admin/accounts GET]', logMessage);
    return Response.json({ error: 'Failed to fetch accounts', detail: clientDetail }, { status: 500 });
  }
}

// ── POST — create new account ─────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    name,
    profile,
    party        = null,
    affiliation  = null,
    displayName = null,
    displayJobTitle        = null,
    accountTypeIds = [],
  } = body as {
    name:           string;
    profile:        string;
    party?:         string | null;
    affiliation?:   string | null;
    displayName?:  string | null;
    displayJobTitle?:         string | null;
    accountTypeIds?: number[];
  };

  if (!name?.trim() || !profile?.trim()) {
    return Response.json({ error: '"name" and "profile" are required' }, { status: 400 });
  }

  // Normalise handle — ensure it has a leading @
  const normProfile = profile.trim().startsWith('@')
    ? profile.trim()
    : `@${profile.trim()}`;

  try {
    const bq = getBigQuery();

    // Insert new account; id is a placeholder UUID until N8N resolves the real
    // TikTok ID during the backfill scrape.
    await bq.query({
      query: `
        INSERT INTO ${tableRef('account')}
          (id, name, profile, party, affiliation, displayName, displayJobTitle)
        VALUES
          (GENERATE_UUID(), @name, @profile, @party, @affiliation, @displayName, @displayJobTitle)
      `,
      params: { name: name.trim(), profile: normProfile, party, affiliation, displayName, displayJobTitle },
      location: 'EU',
    });

    // Retrieve the generated ID so we can wire up the junction rows and return it
    const [idRows] = await bq.query({
      query:    `SELECT id FROM ${tableRef('account')} WHERE profile = @profile ORDER BY id LIMIT 1`,
      params:   { profile: normProfile },
      location: 'EU',
    });
    const newId = (idRows[0] as { id: string } | undefined)?.id ?? null;

    // Insert accountType junction rows
    if (newId && Array.isArray(accountTypeIds) && accountTypeIds.length > 0) {
      const values = accountTypeIds.map((typeId: number) => `('${newId}', ${typeId})`).join(', ');
      await bq.query({
        query:    `INSERT INTO ${tableRef('account_x_accountType')} (accountId, accountTypeId) VALUES ${values}`,
        location: 'EU',
      });
    }

    // Fire N8N webhook — fire-and-forget; account insertion already succeeded
    const webhookUrl = process.env.N8N_WEBHOOK_NEW_ACCOUNT;
    if (webhookUrl) {
      fetch(webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:             newId,
          name:           name.trim(),
          profile:        normProfile,
          party,
          affiliation,
          displayName,
          displayJobTitle,
          accountTypeIds: accountTypeIds ?? []
        }),
      }).catch(err => console.warn('[/api/admin/accounts POST] N8N webhook failed:', err));
    } else {
      console.warn('[/api/admin/accounts POST] N8N_WEBHOOK_NEW_ACCOUNT not set — skipping webhook');
    }

    return Response.json({ success: true, id: newId }, { status: 201 });
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/admin/accounts POST]', logMessage);
    return Response.json({ error: 'Failed to create account', detail: clientDetail }, { status: 500 });
  }
}
