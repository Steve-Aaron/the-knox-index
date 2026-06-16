/**
 * api/cover/[postId].ts
 * ----------------------
 * Public proxy for post cover thumbnails.
 *
 * Lives in the Vercel-native `/api/` directory (NOT `app/api/`) so Vercel
 * bundles it as a plain Node.js serverless function, served directly by
 * filesystem routing.
 *
 * WRITTEN IN SELF-CONTAINED COMMONJS ON PURPOSE — do not convert to
 * import/export, and do NOT require local `lib/*` modules.
 *
 * Why: the Lambda executes this compiled file as CommonJS (.js, no
 * "type": "module"). Under the project tsconfig (module: esnext) every
 * local .ts compiles to an ES module, so:
 *   - ESM `import` syntax here -> the file itself fails to load
 *   - `require('../../lib/gcs')` -> that ESM file fails to load
 * Both surface as 'Failed to load the ES module ... .js' and 500 EVERY
 * request. The only safe dependencies from this island are npm packages
 * (published as CommonJS) and Node builtins. That is why the BigQuery +
 * GCS logic is inlined below rather than imported from lib/. Keep this
 * file consistent with the sibling api/[...all].ts handler.
 *
 * Vercel's filesystem routing serves this file directly for any request
 * matching /api/cover/<postId>, BEFORE the catch-all rewrite in
 * vercel.json forwards everything else to the Expo handler.
 *
 * GET /api/cover/<postId>.jpg
 *   1. Look up coverJpeg ref for postId in BigQuery
 *   2. Sign the GCS URL server-side
 *   3. Fetch the bytes from GCS
 *   4. Stream back with edge cache headers (1 day client / 30 day edge)
 *
 * The stored objects are already JPEGs
 * (tiktok-content-scraper/{profile}/{date}/{postId}.jpeg), so the bytes are
 * passed straight through. No transcode, and therefore no native image
 * dependency.
 *
 * One job: turn a postId into a permanent, inbox-friendly jpg URL.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');
const path = require('node:path');

// ── Config (mirrors lib/bigquery.ts + lib/gcs.ts; kept inline by design) ──────
const PROJECT_ID = process.env.BIGQUERY_PROJECT_ID ?? 'project-ariadne';
const DATASET = process.env.BIGQUERY_DATASET ?? 'ariadne_tiktok_demo';
const QUERY_LOCATION = 'EU';

// TikTok post IDs are 19-digit numeric strings. Stricter than necessary, but
// guarantees no SQL injection via the path segment and bounds the query.
const POST_ID_RE = /^\d{1,25}$/;

/**
 * Shared GCP credential resolution (matches lib/bigquery.ts + lib/gcs.ts):
 *   1. GOOGLE_APPLICATION_CREDENTIALS = JSON string -> credentials object
 *   2. GOOGLE_APPLICATION_CREDENTIALS = file path   -> keyFilename
 *   3. Local dev fallback to keys/service-account.json
 */
function gcpCredentialOpts(): Record<string, unknown> {
  const creds = (process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '').trim();
  if (creds) {
    if (creds.startsWith('{')) {
      try {
        return { credentials: JSON.parse(creds) };
      } catch {
        throw new Error(
          'GOOGLE_APPLICATION_CREDENTIALS looks like JSON but failed to parse. ' +
          'Newlines inside private_key must be escaped as \\n, not raw line breaks.',
        );
      }
    }
    return { keyFilename: creds };
  }
  return { keyFilename: path.resolve(process.cwd(), 'keys/service-account.json') };
}

// ── Lazy singletons — reused across requests in a warm Lambda ─────────────────
let _bq: any = null;
function getBigQuery(): any {
  if (!_bq) _bq = new BigQuery({ projectId: PROJECT_ID, ...gcpCredentialOpts() });
  return _bq;
}

let _storage: any = null;
function getStorage(): any {
  if (!_storage) _storage = new Storage(gcpCredentialOpts());
  return _storage;
}

/** Parse a GCS object reference into { bucketName, objectPath }. */
function parseGcsRef(ref: string): { bucketName: string; objectPath: string } | null {
  if (!ref) return null;

  // Format 1 — authenticated GCS download URL
  const apiMatch = ref.match(
    /storage\.googleapis\.com\/download\/storage\/v1\/b\/([^/]+)\/o\/([^?]+)/,
  );
  if (apiMatch) {
    return {
      bucketName: decodeURIComponent(apiMatch[1]),
      objectPath: decodeURIComponent(apiMatch[2]),
    };
  }

  // Format 2 — public-style googleapis URL
  const publicMatch = ref.match(/storage\.googleapis\.com\/([^/]+)\/(.+)/);
  if (publicMatch) {
    return {
      bucketName: decodeURIComponent(publicMatch[1]),
      objectPath: decodeURIComponent(publicMatch[2]),
    };
  }

  // Format 3 — gs:// URI
  const gsMatch = ref.match(/^gs:\/\/([^/]+)\/(.+)/);
  if (gsMatch) {
    return { bucketName: gsMatch[1], objectPath: gsMatch[2] };
  }

  // Format 4 — storage.cloud.google.com (browser console URL)
  const cloudMatch = ref.match(/storage\.cloud\.google\.com\/([^/]+)\/(.+)/);
  if (cloudMatch) {
    return {
      bucketName: decodeURIComponent(cloudMatch[1]),
      objectPath: decodeURIComponent(cloudMatch[2]),
    };
  }

  return null;
}

/** Returns a signed read URL valid for `ttlMs`, or the original ref on failure. */
async function signGcsUrl(ref: string, ttlMs: number): Promise<string> {
  if (!ref) return ref;
  const parsed = parseGcsRef(ref);
  if (!parsed) return ref;

  try {
    const [url] = await getStorage()
      .bucket(parsed.bucketName)
      .file(parsed.objectPath)
      .getSignedUrl({ action: 'read', expires: Date.now() + ttlMs });
    return url;
  } catch (err: unknown) {
    console.warn('[/api/cover] signing failed:', err instanceof Error ? err.message : 'unknown error');
    return ref;
  }
}

module.exports = async function handler(
  req: import('@vercel/node').VercelRequest,
  res: import('@vercel/node').VercelResponse,
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).send('Method not allowed');
    return;
  }

  // Vercel parses `[postId]` from the filename into req.query.postId
  const raw = String(req.query.postId ?? '');
  const postId = raw.replace(/\.(jpe?g|webp|png)$/i, '');

  if (!POST_ID_RE.test(postId)) {
    res.status(400).send('Invalid postId');
    return;
  }

  try {
    // 1. Look up the GCS ref for this postId. postId is regex-validated
    //    as digits-only, so safe to interpolate into the SQL.
    const sql = `
      SELECT COALESCE(coverJpeg, '') AS coverJpeg
      FROM \`${PROJECT_ID}.${DATASET}.post\`
      WHERE CAST(postId AS STRING) = '${postId}'
      LIMIT 1
    `;
    const [rows] = await getBigQuery().query({ query: sql, location: QUERY_LOCATION });

    const ref: string = rows?.[0]?.coverJpeg ?? '';
    if (!ref) {
      res.status(404).send('Cover not found');
      return;
    }

    // 2. Sign the GCS URL. TTL barely matters because we consume it
    //    server-side within this request; 5 minutes is generous.
    const signedUrl = await signGcsUrl(ref, 5 * 60 * 1000);

    // 3. Fetch the bytes from GCS.
    const upstream = await fetch(signedUrl);
    if (!upstream.ok) {
      console.warn(`[/api/cover] upstream ${upstream.status} for postId=${postId}`);
      res.status(502).send('Upstream error');
      return;
    }
    const imageBuffer = Buffer.from(await upstream.arrayBuffer());

    // 4. Stream the bytes straight back. The stored object is already a JPEG,
    //    so there is nothing to transcode — just forward it with the right
    //    content type and aggressive edge caching.
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', String(imageBuffer.length));
    // 1 day at the client, 30 days at the edge, 7 day SWR
    res.setHeader(
      'Cache-Control',
      'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800',
    );
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(imageBuffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/cover] error:', msg);
    res.status(500).send('Internal server error');
  }
};
