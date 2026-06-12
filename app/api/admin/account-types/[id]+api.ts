/**
 * app/api/admin/account-types/[id]+api.ts
 * -----------------------------------------
 * PATCH  /api/admin/account-types/:id  — rename a type
 * DELETE /api/admin/account-types/:id  — delete a type + clean junction rows
 *
 * Protected: Firebase session + ADMIN_EMAILS allowlist (lib/adminAuth).
 *
 * DELETE order is critical:
 *   1. Remove all account_x_accountType rows where accountTypeId = id
 *   2. Then remove the accountType row itself
 * BigQuery does not enforce foreign keys so step 1 must be explicit.
 */

import { getBigQuery, tableRef } from '@/lib/bigquery';
import { safeErrorDetail } from '@/lib/errors';
import { isAdminRequest } from '@/lib/adminAuth';


// ── PATCH — rename ────────────────────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { id: rawId }: { id: string }
): Promise<Response> {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    return Response.json({ error: 'Invalid id' }, { status: 400 });
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
    await bq.query({
      query:    `UPDATE ${tableRef('accountType')} SET name = @name WHERE id = @id`,
      params:   { name: name.trim(), id },
      location: 'EU',
    });
    return Response.json({ success: true });
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error(`[/api/admin/account-types/${id} PATCH]`, logMessage);
    return Response.json({ error: 'Failed to rename account type', detail: clientDetail }, { status: 500 });
  }
}

// ── DELETE — remove type + junction rows ──────────────────────────────────────

export async function DELETE(
  request: Request,
  { id: rawId }: { id: string }
): Promise<Response> {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    return Response.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const bq = getBigQuery();

    // Step 1 — clear junction rows first (no FK enforcement in BigQuery)
    await bq.query({
      query:    `DELETE FROM ${tableRef('account_x_accountType')} WHERE accountTypeId = @id`,
      params:   { id },
      location: 'EU',
    });

    // Step 2 — delete the type itself
    await bq.query({
      query:    `DELETE FROM ${tableRef('accountType')} WHERE id = @id`,
      params:   { id },
      location: 'EU',
    });

    return Response.json({ success: true });
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error(`[/api/admin/account-types/${id} DELETE]`, logMessage);
    return Response.json({ error: 'Failed to delete account type', detail: clientDetail }, { status: 500 });
  }
}
