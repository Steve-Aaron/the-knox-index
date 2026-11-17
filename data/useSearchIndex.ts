/**
 * data/useSearchIndex.ts
 * -----------------------
 * Loads the header search index from /api/search when `enabled` turns true
 * (the user opens the search). One request is shared by every header on the
 * page and reused for TTL_MS; the next open after that refetches, so signed
 * avatar URLs and lock flags never go stale.
 *
 * Fails soft: `failed` is set and `retry()` tries again.
 */

import { useCallback, useEffect, useState } from 'react';
import { fetchWithRetry } from './fetchWithRetry';
import type { SearchIndex } from '@/lib/search';

/** Matches the CDN's 30-min freshness (CDN_DATA in lib/cacheHeaders.ts). */
const TTL_MS = 30 * 60 * 1000;

let entry: { at: number; promise: Promise<SearchIndex> } | null = null;

function loadIndex(): Promise<SearchIndex> {
  if (!entry || Date.now() - entry.at > TTL_MS) {
    const promise = fetchWithRetry('/api/search').then(r => r.json() as Promise<SearchIndex>);
    entry = { at: Date.now(), promise };
    // A failed load must not be reused.
    promise.catch(() => { if (entry?.promise === promise) entry = null; });
  }
  return entry.promise;
}

export function useSearchIndex(enabled: boolean) {
  const [index, setIndex]   = useState<SearchIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setFailed(false);
    loadIndex().then(
      data => { if (!cancelled) setIndex(data); },
      ()   => { if (!cancelled) setFailed(true); },
    );
    return () => { cancelled = true; };
  }, [enabled, attempt]);

  const retry = useCallback(() => setAttempt(a => a + 1), []);
  return { index, failed, retry };
}
