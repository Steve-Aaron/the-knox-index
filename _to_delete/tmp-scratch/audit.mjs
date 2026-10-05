import { query, metadata } from '../../scripts/metadata/bqClient.mjs';
console.log(await query(`SELECT status, COUNT(*) n FROM ${metadata('account_link')} WHERE platform='x' GROUP BY 1`));
console.log(await query(`SELECT platform_handle, person_id IS NOT NULL AS has_person, reviewed_by, reviewed_at
  FROM ${metadata('account_link')} WHERE platform='x' AND status='confirmed' ORDER BY reviewed_at DESC LIMIT 30`));
