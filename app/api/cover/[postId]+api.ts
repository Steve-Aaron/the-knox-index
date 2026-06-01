/**
 * app/api/cover/[postId]+api.ts
 * ------------------------------
 * Public proxy for post cover thumbnails.
 *
 * GET /api/cover/<postId>.jpg
 *   1. Look up coverJpeg ref for postId in BigQuery
 *   2. Sign the GCS URL server-side (using the same SA the website uses)
 *   3. Fetch the bytes from GCS
 *   4. Transcode webp -> jpg (so Outlook + Apple Mail render the image)
 *   5. Stream back with long edge-cache headers
 *
 * Why it exists: Brevo emails need stable, public, time-unbounded URLs that
 * any inbox can fetch. Signed GCS URLs expire after their TTL; raw `gs://`
 * refs are unfetchable; `storage.cloud.google.com` URLs require a Google
 * login. This route hides all three problems behind a single permanent URL
 * that the email template references directly.
 *
 * Caching: max-age=86400 (1d) at the client, s-maxage=2592000 (30d) at the
 * Vercel edge. The cover image for a given postId never changes after the
 * scrape, so we cache aggressively. The edge absorbs almost all traffic;
 * GCS sees roughly one read per postId per month.
 *
 * One job: turn a postId into a permanent, inbox-friendly jpg URL.
 */

import sharp from 'sharp';
import { signGcsUrl } from '@/lib/gcs';
import { query, tableRef } from '@/lib/bigquery';
import { safeErrorDetail } from '@/lib/errors';

// TikTok post IDs are 19-digit numeric strings. Stricter than necessary, but
// guarantees no SQL injection via the path segment and bounds the query.
const POST_ID_RE = /^\d{1,25}$/;

interface CoverRow {
  coverJpeg: string;
}

export async function GET(
  _request: Request,
  params: { postId?: string },
): Promise<Response> {
  // Strip any extension the caller appended (e.g. /api/cover/123.jpg)
  const raw = String(params?.postId ?? '');
  const postId = raw.replace(/\.(jpe?g|webp|png)$/i, '');

  if (!POST_ID_RE.test(postId)) {
    return new Response('Invalid postId', { status: 400 });
  }

  try {
    // 1. Look up the GCS ref for this postId.
    //    postId is regex-validated as digits-only, so safe to interpolate.
    const rows = await query<CoverRow>(`
      SELECT COALESCE(coverJpeg, '') AS coverJpeg
      FROM ${tableRef('post')}
      WHERE CAST(postId AS STRING) = '${postId}'
      LIMIT 1
    `);

    const ref = rows[0]?.coverJpeg;
    if (!ref) {
      return new Response('Cover not found', { status: 404 });
    }

    // 2. Sign the GCS URL. TTL barely matters because we consume it
    //    server-side within this request; 5 minutes is generous.
    const signedUrl = await signGcsUrl(ref, 5 * 60 * 1000);

    // 3. Fetch the bytes from GCS.
    const upstream = await fetch(signedUrl);
    if (!upstream.ok) {
      console.warn(`[/api/cover] upstream ${upstream.status} for postId=${postId}`);
      return new Response('Upstream error', { status: 502 });
    }
    const inputBuffer = Buffer.from(await upstream.arrayBuffer());

    // 4. Always re-encode through sharp:
    //      - webp -> jpg for Outlook + Apple Mail compatibility
    //      - jpg -> jpg ensures consistent quality, strips EXIF, normalises
    //        colour profile. Cheap (~10ms).
    const jpgBuffer = await sharp(inputBuffer)
      .jpeg({ quality: 85, progressive: true, mozjpeg: true })
      .toBuffer();

    // 5. Stream back with edge cache headers.
    return new Response(jpgBuffer, {
      status: 200,
      headers: {
        'Content-Type':                'image/jpeg',
        // 1 day at the client, 30 days at the edge, 7 days SWR
        'Cache-Control':               'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800',
        // Email-client image proxies fetch from arbitrary origins
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: unknown) {
    const { clientDetail, logMessage } = safeErrorDetail(err);
    console.error('[/api/cover] error:', logMessage);
    return new Response(clientDetail, { status: 500 });
  }
}
