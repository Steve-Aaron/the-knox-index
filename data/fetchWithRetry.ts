/**
 * data/fetchWithRetry.ts
 * -----------------------
 * Thin fetch wrapper with exponential back-off.
 * Retries on network errors and 5xx server errors.
 * 4xx client errors are surfaced immediately — retrying won't help.
 *
 * Default schedule: 3 retries → 1 s, 2 s, 4 s delays (4 attempts total).
 * One job: turn a flaky fetch into a resilient one without touching business logic.
 */

const DEFAULT_DELAYS_MS = [1000, 2000, 4000];

export interface RetryProgress {
  /** 1-based retry number (i.e. 1 = first retry, after first attempt failed). */
  attempt: number;
  /** Total retries that will be attempted (= delays.length). */
  total:   number;
}

/**
 * Fetch `url` with optional `init`, retrying up to `delays.length` times
 * on network failure or 5xx response before throwing.
 *
 * @param onRetry - Called before each retry with current progress so callers
 *                  can surface 'Retrying 1/3…' feedback in the UI.
 * @throws The last error encountered once all attempts are exhausted.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  delays: number[] = DEFAULT_DELAYS_MS,
  onRetry?: (progress: RetryProgress) => void,
): Promise<Response> {
  const maxAttempts = delays.length + 1;
  let lastError: Error = new Error('Fetch failed');

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);

      if (res.ok) return res;

      // 4xx — client error, not transient. Fail immediately.
      if (res.status >= 400 && res.status < 500) {
        throw new Error(`HTTP ${res.status}`);
      }

      // 5xx — server error, worth retrying.
      lastError = new Error(`HTTP ${res.status}`);

    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Network error');

      // Never retry 4xx — they were thrown intentionally above.
      if (/^HTTP 4\d\d$/.test(lastError.message)) throw lastError;
    }

    if (attempt < maxAttempts - 1) {
      onRetry?.({ attempt: attempt + 1, total: delays.length });
      await new Promise<void>(resolve => setTimeout(resolve, delays[attempt]));
    }
  }

  throw lastError;
}
