/**
 * api/cover/[postId].ts
 * ----------------------
 * Public proxy for post cover thumbnails.
 *
 * Lives in the Vercel-native `/api/` directory (NOT `app/api/`) so Vercel
 * bundles it as a plain Node.js serverless function, served directly by
 * filesystem routing. It originally needed to sit here to use sharp (a
 * native dep Expo Router's Metro bundler cannot externalise); sharp has
 * since been removed (covers are already JPEGs), but the route is kept here
 * because the direct filesystem routing and cache behaviour are convenient.
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
 * dependency, which keeps this function able to cold-start cleanly on Vercel.
 *
 * Cache: aggressively. The cover image for a given postId never changes
 * after the scrape, so the edge absorbs almost all traffic.
 *
 * One job: turn a postId into a permanent, inbox-friendly jpg URL.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { signGcsUrl } from '../../lib/gcs';
import { query, tableRef } from '../../lib/bigquery';

// TikTok post IDs are 19-digit numeric strings. Stricter than necessary, but
// guarantees no SQL injection via the path segment and bounds the query.
const POST_ID_RE = /^\d{1,25}$/;

interface CoverRow {
  coverJpeg: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
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
    const rows = await query<CoverRow>(`
      SELECT COALESCE(coverJpeg, '') AS coverJpeg
      FROM ${tableRef('post')}
      WHERE CAST(postId AS STRING) = '${postId}'
      LIMIT 1
    `);

    const ref = rows[0]?.coverJpeg;
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
}
