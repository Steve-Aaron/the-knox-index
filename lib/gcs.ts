/**
 * lib/gcs.ts
 * -----------
 * Thin wrapper around @google-cloud/storage for generating signed URLs.
 * Credentials are loaded once from the service account key file.
 * One job: turn a raw GCS URL into a time-limited signed URL.
 */

import { Storage } from '@google-cloud/storage';
import path from 'path';

/**
 * Credential resolution order (matches lib/bigquery.ts pattern):
 *   1. GOOGLE_APPLICATION_CREDENTIALS = JSON string  → parse and use as credentials object
 *   2. GOOGLE_APPLICATION_CREDENTIALS = file path    → use as keyFilename
 *   3. Fallback to the local dev key file
 * This means the key file NEVER needs to be committed to git; set the
 * env var to the JSON content in Vercel / CI instead.
 */
function makeStorage(): Storage {
  const creds = (process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '').trim();
  if (creds) {
    // Mirror lib/bigquery.ts: refuse to silently fall through to keyFilename
    // when the value looks like JSON, because the SDK would otherwise embed
    // the entire malformed JSON (including private_key) into its errors.
    if (creds.startsWith('{')) {
      try {
        return new Storage({ credentials: JSON.parse(creds) });
      } catch {
        throw new Error(
          'GOOGLE_APPLICATION_CREDENTIALS looks like JSON but failed to parse. ' +
          'Newlines inside private_key must be escaped as \\n, not raw line breaks.',
        );
      }
    }
    return new Storage({ keyFilename: creds });
  }
  // Local dev fallback — looks for any service-account JSON in keys/
  const keyFile = path.resolve(process.cwd(), 'keys/service-account.json');
  return new Storage({ keyFilename: keyFile });
}

let _storage: Storage | null = null;
function getStorage(): Storage {
  if (!_storage) _storage = makeStorage();
  return _storage;
}

/**
 * Parses a GCS object reference into { bucketName, objectPath }.
 * Handles four common formats:
 *   1. https://storage.googleapis.com/download/storage/v1/b/{bucket}/o/{encodedPath}?alt=media
 *   2. https://storage.googleapis.com/{bucket}/{path}
 *   3. gs://{bucket}/{path}
 *   4. https://storage.cloud.google.com/{bucket}/{path}  (console/browser URL — no CORS headers)
 */
function parseGcsRef(ref: string): { bucketName: string; objectPath: string } | null {
  if (!ref) return null;

  // Format 1 — authenticated GCS download URL
  const apiMatch = ref.match(
    /storage\.googleapis\.com\/download\/storage\/v1\/b\/([^/]+)\/o\/([^?]+)/
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

/**
 * Returns a signed URL valid for `ttlMs` milliseconds (default 1 hour).
 * Falls back to the original `ref` string if parsing or signing fails,
 * so the rest of the pipeline never throws on a bad URL.
 */
export async function signGcsUrl(
  ref: string,
  ttlMs = 60 * 60 * 1000,
): Promise<string> {
  if (!ref) return ref;

  const parsed = parseGcsRef(ref);
  if (!parsed) return ref;   // unrecognised format — pass through as-is

  try {
    const [url] = await getStorage()
      .bucket(parsed.bucketName)
      .file(parsed.objectPath)
      .getSignedUrl({
        action:  'read',
        expires: Date.now() + ttlMs,
      });
    return url;
  } catch (err) {
    console.warn('[gcs] signing failed:', err instanceof Error ? err.message : 'unknown error');
    return ref;   // degrade gracefully rather than blowing up the whole response
  }
}

/**
 * Signs both `coverJpeg` and `videoMp4` fields of a record in parallel.
 * Returns a new object with signed URLs; original is not mutated.
 */
export async function signMediaFields<T extends { coverJpeg?: string; videoMp4?: string }>(
  record: T,
  ttlMs = 60 * 60 * 1000,
): Promise<T> {
  const [coverJpeg, videoMp4] = await Promise.all([
    signGcsUrl(record.coverJpeg ?? '', ttlMs),
    signGcsUrl(record.videoMp4  ?? '', ttlMs),
  ]);
  return { ...record, coverJpeg, videoMp4 };
}
