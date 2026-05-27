/**
 * app/api/sign-coverjpeg+api.ts
 * ------------------------------
 * POST /api/sign-coverjpeg
 *
 * Takes one or more GCS references (gs://, storage.googleapis.com/...)
 * and returns time-limited signed URLs that any email client can fetch.
 * Used by the n8n daily briefing workflow before sending — raw GCS
 * references won't render in inboxes, signed URLs will.
 *
 * Auth: shared bearer token from INTERNAL_API_TOKEN env var. n8n stores
 *       it in a Header Auth credential; nobody else should ever call this.
 *
 * Body (one of):
 *   { "ref":  "gs://...",  "ttlHours"?: number }   ← single
 *   { "refs": ["gs://..."], "ttlHours"?: number }  ← batch (preferred for n8n)
 *
 * Response:
 *   200 { "signed":  "https://..." }              ← when called with `ref`
 *   200 { "signed":  ["https://...", ...] }       ← when called with `refs`
 *   400 { "error": "..." }
 *   401 { "error": "Unauthorized" }
 *   503 { "error": "Service unavailable" }
 *
 * One job: turn opaque storage references into URLs an inbox can load.
 */

import { signGcsUrl } from '@/lib/gcs';

const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN ?? '';
const DEFAULT_TTL_HOURS  = 24;
const MAX_TTL_HOURS      = 24 * 7;   // 7 days — Brevo's recommended outbound link lifespan
const MAX_BATCH_SIZE     = 50;       // upper bound to keep response < ~50 KB and signing < 5s

// ── Auth helper ───────────────────────────────────────────────────────────────

function isAuthorised(request: Request): boolean {
  if (!INTERNAL_API_TOKEN) return false;
  const auth = request.headers.get('authorization') ?? '';
  const m    = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] === INTERNAL_API_TOKEN : false;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  if (!INTERNAL_API_TOKEN) {
    console.error('[/api/sign-coverjpeg] INTERNAL_API_TOKEN not set');
    return Response.json({ error: 'Service unavailable' }, { status: 503 });
  }
  if (!isAuthorised(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Resolve TTL — clamp to sane bounds
  const ttlHours = Math.max(
    1,
    Math.min(MAX_TTL_HOURS, Number(body?.ttlHours) || DEFAULT_TTL_HOURS),
  );
  const ttlMs = ttlHours * 60 * 60 * 1000;

  // Single ref shorthand → return a single signed URL string
  if (typeof body?.ref === 'string') {
    const signed = await signGcsUrl(body.ref, ttlMs);
    return Response.json({ signed }, { status: 200 });
  }

  // Batch — return parallel array of signed URLs
  if (Array.isArray(body?.refs)) {
    const refs: string[] = body.refs.map((r: unknown) => String(r ?? ''));
    if (refs.length === 0) {
      return Response.json({ signed: [] }, { status: 200 });
    }
    if (refs.length > MAX_BATCH_SIZE) {
      return Response.json(
        { error: `Too many refs — max ${MAX_BATCH_SIZE} per request` },
        { status: 400 },
      );
    }
    const signed = await Promise.all(refs.map(r => signGcsUrl(r, ttlMs)));
    return Response.json({ signed }, { status: 200 });
  }

  return Response.json(
    { error: 'Body must contain `ref` (string) or `refs` (array of strings)' },
    { status: 400 },
  );
}
