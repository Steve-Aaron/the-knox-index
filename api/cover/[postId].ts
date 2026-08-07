/**
 * Parses a GCS object reference into { bucketName, objectPath }.
 * Handles five formats:
 *   1. https://storage.googleapis.com/download/storage/v1/b/{bucket}/o/{encodedPath}?alt=media
 *      and https://www.googleapis.com/storage/v1/b/{bucket}/o/{encodedPath}   (upload selfLink)
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

  // Format 4 — storage.cloud.google.com (browser console URL, no CORS headers,
  // must be converted to a signed URL before sending to the client)
  const cloudMatch = ref.match(/storage\.cloud\.google\.com\/([^/]+)\/(.+)/);
  if (cloudMatch) {
    return {
      bucketName: decodeURIComponent(cloudMatch[1]),
      objectPath: decodeURIComponent(cloudMatch[2]),
    };
  }

  return null;
}