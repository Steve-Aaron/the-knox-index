/**
 * lib/brevo.ts
 * ------------
 * Single source of truth for talking to Brevo from server-side routes.
 *
 * Subscription model: list membership is canonical. The CONSENT_* attributes
 * are mirrors kept in sync on every write so other systems (the app, BigQuery
 * exports) can see consent state without an extra Brevo call.
 *
 * One job per export:
 *   - BREVO_LISTS          map of consent key → list ID (env-driven)
 *   - upsertContact()      attribute-only upsert (no list change)
 *   - syncConsentLists()   add/remove list membership from a consent flag map
 *   - upsertWithConsent()  one-call combination of the two above
 *
 * No marketing transactional sends live here — see app/api/signup+api.ts.
 */

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? '';
const BREVO_BASE    = 'https://api.brevo.com/v3';

/**
 * Brevo numeric list IDs, mapped by consent attribute name. Override per
 * environment via .env. Defaults match the live Brevo workspace:
 *   4 → Knox Index Daily Briefing
 *   7 → Knox Index Updates (product news, reports)
 *   8 → Knox Digital (wider company contact)
 */
export const BREVO_LISTS: Readonly<Record<string, number>> = {
  CONSENT_DAILY_BRIEFING:     Number(process.env.BREVO_LIST_DAILY_BRIEFING   ?? 4),
  CONSENT_KNOX_INDEX_UPDATES: Number(process.env.BREVO_LIST_KNOX_UPDATES     ?? 7),
  CONSENT_KNOX_DIGITAL:       Number(process.env.BREVO_LIST_KNOX_DIGITAL     ?? 8),
};

export type BrevoValue = string | string[] | boolean | number;
export type BrevoResult = { ok: boolean; status: number };

/** Low-level POST to Brevo. Used by helpers below; rarely called directly. */
async function post(path: string, body: unknown): Promise<BrevoResult> {
  if (!BREVO_API_KEY) {
    return { ok: false, status: 0 };
  }
  const res = await fetch(`${BREVO_BASE}${path}`, {
    method:  'POST',
    headers: {
      'api-key':      BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    body: JSON.stringify(body),
  });
  return { ok: res.ok || res.status === 204, status: res.status };
}

/**
 * Upsert a Brevo contact. Updates only the attributes you pass — list
 * membership is unchanged. For consent-driven list sync, prefer
 * `upsertWithConsent`.
 */
export async function upsertContact(
  email:      string,
  attributes: Record<string, BrevoValue | undefined>,
): Promise<BrevoResult> {
  const cleaned = stripUndefined(attributes);
  return post('/contacts', { email, updateEnabled: true, attributes: cleaned });
}

/**
 * Translate a consent flag map into Brevo list add/remove instructions and
 * apply them in a single upsert call. Keys must match `BREVO_LISTS`.
 *
 * Example:
 *   syncConsentLists('a@b.com', { CONSENT_DAILY_BRIEFING: true, CONSENT_KNOX_DIGITAL: false })
 *   → adds the contact to list 4, removes from list 8, leaves list 7 alone.
 */
export async function syncConsentLists(
  email:    string,
  consents: Partial<Record<keyof typeof BREVO_LISTS, boolean>>,
): Promise<BrevoResult> {
  const { listIds, unlinkListIds } = consentsToListOps(consents);
  if (!listIds.length && !unlinkListIds.length) {
    return { ok: true, status: 204 };
  }
  return post('/contacts', {
    email,
    updateEnabled: true,
    ...(listIds.length        ? { listIds }        : {}),
    ...(unlinkListIds.length  ? { unlinkListIds }  : {}),
  });
}

/**
 * Combined upsert: writes attributes and applies list membership from the
 * consent flags in a single POST. The canonical entry point for signup +
 * preferences routes.
 *
 * Returns the raw Brevo result. Network/Brevo errors are surfaced as
 * `{ ok: false, status: ... }` rather than thrown, so callers can log
 * without breaking their happy path.
 */
export async function upsertWithConsent(
  email:      string,
  attributes: Record<string, BrevoValue | undefined>,
  consents:   Partial<Record<keyof typeof BREVO_LISTS, boolean>>,
): Promise<BrevoResult> {
  const cleaned = stripUndefined(attributes);
  const { listIds, unlinkListIds } = consentsToListOps(consents);
  return post('/contacts', {
    email,
    updateEnabled: true,
    attributes: cleaned,
    ...(listIds.length       ? { listIds }       : {}),
    ...(unlinkListIds.length ? { unlinkListIds } : {}),
  });
}

/** Internal: split a consent map into Brevo's listIds / unlinkListIds arrays. */
function consentsToListOps(
  consents: Partial<Record<keyof typeof BREVO_LISTS, boolean>>,
): { listIds: number[]; unlinkListIds: number[] } {
  const listIds:       number[] = [];
  const unlinkListIds: number[] = [];
  for (const [key, value] of Object.entries(consents)) {
    const listId = BREVO_LISTS[key as keyof typeof BREVO_LISTS];
    if (!listId || value === undefined) continue;
    (value ? listIds : unlinkListIds).push(listId);
  }
  return { listIds, unlinkListIds };
}

/** Internal: drop undefined entries from an attribute bag before sending. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, BrevoValue> {
  const out: Record<string, BrevoValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v as BrevoValue;
  }
  return out;
}
