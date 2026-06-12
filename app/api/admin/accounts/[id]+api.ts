/**
 * app/api/admin/accounts/[id]+api.ts
 * ------------------------------------
 * PATCH /api/admin/accounts/:id
 *
 * Updates editable fields on an account row and syncs the
 * account_x_accountType junction table in one logical operation.
 *
 * Protected: Firebase session + ADMIN_EMAILS allowlist (lib/adminAuth).
 */

import { getBigQuery, tableRef } from '@/lib/bigquery';
import { safeErrorDetail } from '@/lib/errors';
import { isAdminRequest } from '@/lib/adminAuth';


// ── PATCH ──────────────────────────────────────────────────────────────────────

export async function PATCH(request: Request, { id }: { id: string }): Promise<Response> {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!id?.trim()) {
    return Response.json({ error: 'Missing account id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    name,
    displayName,
    displayJobTitle,
    party,
    affiliation,
    isActive,
    accountTypeIds,
  } = body as {
    name?:            string | null;
    displayName?:     string | null;
    displayJobTitle?: string | null;
    party?:           string | null;
    affiliation?:     string | null;
    isActive?:        boolean;
    accountTypeIds?:  number[];
  };

  try {
    const bq = getBigQuery();

    // Update scalar fields — only SET what was included in the payload
    // Build the SET clause dynamically so callers can patch a single field
    // BigQuery SDK cannot infer the type of a null parameter, so we write
    // NULL directly into the SQL for null values and only parameterise
    // non-null scalars.
    const setClauses: string[] = [];
    const queryParams: Record<string, unknown> = { id };

    function addClause(col: string, val: string | boolean | null | undefined) {
      if (val === undefined) return;
      if (val === null) {
        setClauses.push(`${col} = NULL`);
      } else {
        const p = col.replace(/\s/g, '');   // strip spaces for param name
        setClauses.push(`${col} = @${p}`);
        queryParams[p] = val;
      }
    }

    addClause('name',            name);
    addClause('displayName',     displayName);
    addClause('displayJobTitle', displayJobTitle);
    addClause('party',           party);
    addClause('affiliation',     affiliation);
    addClause('isActive',        isActive);

    if (setClauses.length > 0) {
      await bq.query({
        query: `
          UPDATE ${tableRef('account')}
          SET ${setClauses.join(', ')}
          WHERE CAST(id AS STRING) = @id
        `,
        params:   queryParams,
        location: 'EU',
      });
    }

    // Sync accountType junction if the caller included accountTypeIds
    if (accountTypeIds !== undefined) {
      console.log(`[PATCH junction] id=${id} typeIds=${JSON.stringify(accountTypeIds)}`);

      const [deleteResult] = await bq.query({
        query:    `DELETE FROM ${tableRef('account_x_accountType')} WHERE CAST(accountId AS STRING) = @id`,
        params:   { id },
        location: 'EU',
      });
      console.log(`[PATCH junction] delete done, metadata:`, JSON.stringify((deleteResult as any)?.statistics ?? {}));

      if (Array.isArray(accountTypeIds) && accountTypeIds.length > 0) {
        const typeList = accountTypeIds.join(', ');
        const insertQuery = `
            INSERT INTO ${tableRef('account_x_accountType')} (accountId, accountTypeId)
            SELECT a.id, typeId
            FROM ${tableRef('account')} a
            CROSS JOIN UNNEST([${typeList}]) AS typeId
            WHERE CAST(a.id AS STRING) = @id
          `;
        console.log(`[PATCH junction] insert query:`, insertQuery.trim());
        await bq.query({ query: insertQuery, params: { id }, location: 'EU' });
        console.log(`[PATCH junction] insert done`);
      }
    }

    return Response.json({ success: true });
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error(`[/api/admin/accounts/${id} PATCH]`, logMessage);
    return Response.json({ error: 'Failed to update account', detail: clientDetail }, { status: 500 });
  }
}
