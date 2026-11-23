/**
 * lib/deviceAuthCache.ts
 * -----------------------
 * The per-identity things this browser caches for convenience: the registered
 * and profiled flags, the pre-fill of the profiling form, and the 'joined this
 * waitlist' hints. None of it is authority. Access is decided server-side by
 * uid; these are only read to avoid re-asking or to pre-fill a form.
 *
 * Because they are device-scoped and written once, they must be cleared when a
 * session ends, or the next visitor on this browser inherits the last one's
 * registered / profiled / waitlist status and details. useAuth calls this the
 * moment a session is confirmed gone.
 *
 * One job: wipe the signed-out-stale auth cache on sign-out.
 */

/** Exact keys written by useAuth and the profiling form (StickyUnlock). */
const EXACT_KEYS = [
  'tki_registered',
  'tki_email',
  'tki_profiled',
  'tki_firstname',
  'tki_lastname',
  'tki_company',
  'tki_linkedin',
  'tki_segment',
  'tki_interests',
  'tki_consent_updates',
  'tki_consent_briefing',
  'tki_consent_weekly_briefing',
  'tki_consent_knox',
];

/** Prefix for the per-tenant 'joined this waitlist' hint (useWaitlistJoined). */
const JOINED_PREFIX = 'tki_waitlist_joined:';

/**
 * Remove every per-identity convenience flag this browser holds, across all
 * tenants. Safe to call when storage is blocked or unavailable.
 */
export function clearSignedOutCache(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    for (const k of EXACT_KEYS) localStorage.removeItem(k);
    // Sweep every tenant's waitlist-join hint, whatever the id.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(JOINED_PREFIX)) localStorage.removeItem(key);
    }
  } catch { /* storage blocked */ }
}
