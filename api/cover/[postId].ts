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
 * import/export, and do NOT require local `lib/*` modules. The Lambda runs
 * this as CommonJS; any local .ts compiles to an ES module and fails to load,
 * which 500s every request. Only npm packages and Node builtins are safe here.
 * That is why the BigQuery + GCS logic is duplicated from lib/ rather than
 * imported. Keep it consistent with lib/gcs.ts and lib/bigquery.ts.
 *
 * GET /api/cover/<postId>[.jpg|.jpeg|.webp|.png|.gif]
 *   1. Look up coverJpeg ref for postId in BigQuery
 *   2. Sign the GCS URL server-side
 *   3. Fetch the bytes from GCS
 *   4. Detect the real image format and stream back with edge cache headers
 *
 * FORMAT NOTE: the column is called `coverJpeg` for historical reasons but the
 * objects are NOT all JPEGs. `Download content` uploads covers as `.webp`, and
 * some objects are actually PNG regardless of their name. The extension in the
 * request URL is decorative and is IGNORED for content negotiation: the
 * Content-Type is derived from the actual bytes. There is no transcode, so a
 * `.jpg` URL can legitimately return `image/webp` or `image/png`.
 *
 * One job: turn a postId into a permanent, correctly-typed image URL.
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

// Extensions the route accepts on the URL. Decorative only.
const URL_EXT_RE = /\.(jpe?g|webp|png|gif)$/i;

const MIME_BY_EXT: Record<string, string> = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  png:  'image/png',
  gif:  'image/gif',
};

const ALLOWED_MIMES = new Set(Object.values(MIME_BY_EXT));

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

// ── GCS reference parsing ─────────────────────────────────────────────────────

/**
 * Parses a GCS object reference into { bucketName, objectPath }.
 * Handles four shapes:
 *   1. https://storage.googleapis.com/download/storage/v1/b/{bucket}/o/{encoded}?alt=media
 *      and https://www.googleapis.com/storage/v1/b/{bucket}/o/{encoded}  (upload selfLink)
 *   2. https://storage.googleapis.com/{bucket}/{path}
 *   3. gs://{bucket}/{path}
 *   4. https://storage.cloud.google.com/{bucket}/{path}  (console/browser URL)
 */
function parseGcsRef(ref: string): { bucketName: string; objectPath: string } | null {
  if (!ref) return null;

  // Format 1 — JSON API object URL. Covers both the /download/ media variant
  // and the bare selfLink returned by the GCS upload API, on either the
  // storage.googleapis.com or www.googleapis.com host. Must be tested BEFORE
  // Format 2, which would otherwise mis-parse 'storage' as the bucket name.
  const apiMatch = ref.match(
    /googleapis\.com\/(?:download\/)?storage\/v1\/b\/([^/]+)\/o\/([^?]+)/,
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

// ── Format detection ──────────────────────────────────────────────────────────

/**
 * Identify an image format from its magic bytes. Authoritative: it reads the
 * file itself rather than trusting object metadata or the filename, both of
 * which are wrong for a meaningful share of this bucket.
 * Returns null when the bytes match no known image signature.
 */
function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;

  // JPEG — FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG — 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP — 'RIFF' ....  'WEBP'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }

  // GIF — 'GIF8'
  if (buf.toString('ascii', 0, 4) === 'GIF8') {
    return 'image/gif';
  }

  return null;
}

/** Map a stored GCS ref's file extension to a MIME type, ignoring any query string. */
function mimeFromRef(ref: string): string | null {
  const withoutQuery = ref.split('?')[0];
  const match = withoutQuery.match(/\.([a-z0-9]+)$/i);
  if (!match) return null;
  return MIME_BY_EXT[match[1].toLowerCase()] ?? null;
}

/** Accept an upstream Content-Type only if it is one we recognise. */
function mimeFromUpstream(header: string | null): string | null {
  if (!header) return null;
  const base = header.split(';')[0].trim().toLowerCase();
  return ALLOWED_MIMES.has(base) ? base : null;
}

/**
 * Resolve the Content-Type to send back.
 * Priority: actual bytes > stored object extension > upstream header.
 * Falls back to application/octet-stream so a non-image never masquerades as
 * one, and logs it so the bad row is findable.
 */
function resolveContentType(
  buf: Buffer,
  ref: string,
  upstreamHeader: string | null,
  postId: string,
): { contentType: string; source: string } {
  const sniffed = sniffImageMime(buf);
  if (sniffed) return { contentType: sniffed, source: 'bytes' };

  const byExt = mimeFromRef(ref);
  if (byExt) return { contentType: byExt, source: 'extension' };

  const byHeader = mimeFromUpstream(upstreamHeader);
  if (byHeader) return { contentType: byHeader, source: 'upstream' };

  console.warn(`[/api/cover] unrecognised image format for postId=${postId} ref=${ref}`);
  return { contentType: 'application/octet-stream', source: 'fallback' };
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async function handler(
  req: import('@vercel/node').VercelRequest,
  res: import('@vercel/node').VercelResponse,
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).send('Method not allowed');
    return;
  }

  // Vercel parses `[postId]` from the filename into req.query.postId.
  // The extension is decorative: stripped, never used for content negotiation.
  const raw = String(req.query.postId ?? '');
  const postId = raw.replace(URL_EXT_RE, '');

  if (!POST_ID_RE.test(postId)) {
    res.status(400).send('Invalid postId');
    return;
  }

  try {
    // 1. Look up the GCS ref. postId is regex-validated as digits-only,
    //    so it is safe to interpolate into the SQL.
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

    // 2. Sign the GCS URL. Consumed server-side within this request, so the
    //    TTL barely matters; 5 minutes is generous.
    const signedUrl = await signGcsUrl(ref, 5 * 60 * 1000);

    // 3. Fetch the bytes from GCS.
    const upstream = await fetch(signedUrl);
    if (!upstream.ok) {
      console.warn(
        `[/api/cover] upstream ${upstream.status} for postId=${postId} ref=${ref}`,
      );
      res.status(502).send('Upstream error');
      return;
    }
    const imageBuffer = Buffer.from(await upstream.arrayBuffer());

    // 4. Work out what the bytes actually are, then stream them back.
    //    No transcode, so a .jpg URL may legitimately return image/webp.
    const { contentType, source } = resolveContentType(
      imageBuffer,
      ref,
      upstream.headers.get('content-type'),
      postId,
    );

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(imageBuffer.length));
    res.setHeader('X-Cover-Type-Source', source);
    res.setHeader('Vary', 'Accept');
    // 1 day at the client, 30 days at the edge, 7 day SWR
    res.setHeader(
      'Cache-Control',
      'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800',
    );
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'HEAD') {
      res.status(200).end();
      return;
    }

    res.status(200).send(imageBuffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/cover] error:', msg);
    res.status(500).send('Internal server error');
  }
};