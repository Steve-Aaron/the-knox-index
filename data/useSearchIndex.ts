/**
 * data/useSearchIndex.ts
 * -----------------------
 * Loads the header search index from /api/search the first time `enabled`
 * turns true (the user focuses the search), then keeps it for the session so
 * every page's header shares one fetch.
 *
 * Fails soft: on error the index stays null and the next focus retries.
 */

import { useEffect, useState } from 'react';
import { fetchWithRetry } from './fetchWithRetry';
import type { SearchIndex } from '@/lib/search';

let cached:   SearchIndex | null = null;
let inFlight: Promise<SearchIndex> | null = null;

function loadIndex(): Promise<SearchIndex> {
  inFlight ??= fetchWithRetry('/api/search')
    .then(r => {
      if (!r.ok) throw new Error(`/api/search ${r.status}`);
      return r.json() as Promise<SearchIndex>;
    })
    .then(data => {
      cached = {
        people: Array.isArray(data.people) ? data.people : [],
        groups: Array.isArray(data.groups) ? data.groups : [],
      };
      return cached;
    })
    .finally(() => { inFlight = null; });
  return inFlight;
}

export function useSearchIndex(enabled: boolean): { index: SearchIndex | null; loading: boolean } {
  const [index, setIndex]     = useState<SearchIndex | null>(cached);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || index) return;
    let cancelled = false;
    setLoading(true);
    loadIndex()
      .then(data => { if (!cancelled) setIndex(data); })
      .catch(() => { /* stays null; the next focus retries */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, index]);

  return { index, loading };
}
