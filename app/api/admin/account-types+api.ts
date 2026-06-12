/**
 * app/api/admin/account-types+api.ts
 * ------------------------------------
 * GET  /api/admin/account-types  — list all account types
 * POST /api/admin/account-types  — create a new type
 *
 * Protected: Firebase session + ADMIN_EMAILS allowlist (lib/adminAuth).
 */

import { getBigQuery, tableRef, query } from '@/lib/bigquery';
import { safeErrorDetail } from '@/lib/errors';
import { isAdminRequest } from '@/lib/adminAuth';


export interface AccountTypeRow {
  id:   number;
  name: string;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const types = await query<AccountTypeRow>(
      `SELECT id, name FROM ${tableRef('accountType')} ORDER BY id`
    );
    return Response.json({ types });
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/admin/account-types GET]', logMessage);
    return Response.json({ error: 'Failed to fetch account types', detail: clientDetail }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

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

  const { name } = body as { name?: string };
  if (!name?.trim()) {
    return Response.json({ error: '"name" is required' }, { status: 400 });
  }

  try {
    const bq = getBigQuery();

    // Derive next ID — BigQuery has no SERIAL/AUTO_INCREMENT
    const [maxRows] = await bq.query({
      query:    `SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM ${tableRef('accountType')}`,
      location: 'EU',
    });
    const nextId = (maxRows[0] as { nextId: number }).nextId;

    await bq.query({
      query:    `INSERT INTO ${tableRef('accountType')} (id, name) VALUES (@id, @name)`,
      params:   { id: nextId, name: name.trim() },
      location: 'EU',
    });

    return Response.json({ success: true, id: nextId, name: name.trim() }, { status: 201 });
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/admin/account-types POST]', logMessage);
    return Response.json({ error: 'Failed to create account type', detail: clientDetail }, { status: 500 });
  }
}
