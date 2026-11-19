/**
 * lib/brevoIndexList.ts
 * ----------------------
 * The 'Knox Index World Leaders' Brevo list, so World Leaders waitlist
 * sign-ups can be told apart from UK ones. Unlike the SOURCE attribute, which
 * the latest sign-up overwrites, list membership sticks.
 *
 * UK sign-ups already have their own lists in Brevo; this module never
 * touches them. It only ever looks up, creates or adds to the World Leaders
 * list.
 *
 * The list lives in the Knox Index folder beside the briefing lists. It is
 * found by name, or created if missing, the first time it is needed, and the
 * id is kept for the life of the server. BREVO_LIST_INDEX_WORLD pins an id
 * instead.
 *
 * Server-side only. Never throws: a Brevo hiccup must not fail a sign-up.
 *
 * One job: put a World Leaders sign-up in the World Leaders list.
 */

import type { TenantConfig } from '@/lib/tenants';

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? '';
const BREVO_BASE    = 'https://api.brevo.com/v3';
/** 'Knox Index' folder, which holds the briefing and updates lists. */
const FOLDER_ID     = Number(process.env.BREVO_FOLDER_KNOX_INDEX ?? 3);

// World Leaders only. UK has its own lists and must not be touched here.
const LISTS: Record<string, { name: string; env: string | undefined }> = {
  world: { name: 'Knox Index World Leaders', env: process.env.BREVO_LIST_INDEX_WORLD },
};

const cache = new Map<string, Promise<number | null>>();

async function brevo(method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ ok: boolean; status: number; json: any }> {
  const res = await fetch(`${BREVO_BASE}${path}`, {
    method,
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function findOrCreate(name: string): Promise<number | null> {
  // Find by exact name (a few pages covers any realistic account).
  for (let offset = 0; offset < 500; offset += 50) {
    const page = await brevo('GET', `/contacts/lists?limit=50&offset=${offset}`);
    if (!page.ok) throw new Error(`list lookup ${page.status}`);
    const lists: { id: number; name: string }[] = page.json?.lists ?? [];
    const hit = lists.find(l => l.name === name);
    if (hit) return hit.id;
    if (lists.length < 50) break;
  }
  const created = await brevo('POST', '/contacts/lists', { name, folderId: FOLDER_ID });
  if (!created.ok || typeof created.json?.id !== 'number') {
    throw new Error(`list create ${created.status} ${JSON.stringify(created.json).slice(0, 200)}`);
  }
  console.log(`[brevoIndexList] created Brevo list '${name}' (id ${created.json.id})`);
  return created.json.id;
}

function listIdFor(tenantId: string): Promise<number | null> {
  const def = LISTS[tenantId];
  if (!def) return Promise.resolve(null);
  const pinned = Number(def.env);
  if (Number.isInteger(pinned) && pinned > 0) return Promise.resolve(pinned);

  let pending = cache.get(tenantId);
  if (!pending) {
    pending = findOrCreate(def.name).catch(err => {
      cache.delete(tenantId); // try again next time
      console.error(`[brevoIndexList] ${def.name}:`, err?.message ?? err);
      return null;
    });
    cache.set(tenantId, pending);
  }
  return pending;
}

/** Adds an existing Brevo contact to its index's list. Logs and moves on if it cannot. */
export async function addToIndexList(email: string, tenant: TenantConfig): Promise<void> {
  if (!BREVO_API_KEY) return;
  try {
    const listId = await listIdFor(tenant.id);
    if (!listId) return;
    const res = await brevo('POST', `/contacts/lists/${listId}/contacts/add`, { emails: [email.trim().toLowerCase()] });
    // 400 'Contact already in list' is fine.
    if (!res.ok && !/already/i.test(JSON.stringify(res.json))) {
      console.error(`[brevoIndexList] add to ${tenant.id} list failed`, res.status, JSON.stringify(res.json).slice(0, 200));
    }
  } catch (err: any) {
    console.error('[brevoIndexList] failed:', err?.message ?? err);
  }
}
