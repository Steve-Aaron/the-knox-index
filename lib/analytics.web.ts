/**
 * lib/analytics.web.ts
 * ---------------------
 * Web-specific Mixpanel wrapper using mixpanel-browser.
 *
 * Metro/webpack resolves this file over analytics.ts on web builds (Expo
 * platform-split via .web.ts extension). Native builds continue to use
 * analytics.ts (mixpanel-react-native).
 *
 * init() is called here directly. The GTM Custom HTML tag is no longer
 * needed and can be removed — calling init() via GTM after module-imported
 * track() calls silently drops all pre-init events because mixpanel-browser
 * does NOT queue calls made before init() when imported as a module.
 *
 * Ad-blocker bypass: api_host points to the server-side proxy at /api/mp,
 * which forwards to https://api.mixpanel.com. Direct calls are blocked by
 * common privacy extensions.
 *
 * Public API (identical signature to analytics.ts):
 *   track(event, properties)   — fire an event
 *   identify(userId)           — tie events to a known user
 *   setSuperProperties(props)  — merge props into every subsequent event
 *   startTimer(label)          — begin a named stopwatch
 *   elapsedMs(label)           — read ms since startTimer, without stopping it
 *   stopTimer(label)           — read ms and clear the stopwatch
 */

import mixpanel from 'mixpanel-browser';

export type Properties = Record<string, string | number | boolean | null | undefined>;

// ── Initialise ────────────────────────────────────────────────────────────────
//
// Must run before any track() call. Safe to call on every module load —
// mixpanel-browser no-ops duplicate init calls on the same token.

if (typeof window !== 'undefined') {
  mixpanel.init('fd4826c41ed1184899b0350f4507593d', {
    api_host:    window.location.origin + '/api/mp',
    persistence: 'localStorage',
    ignore_dnt:  true,   // respect user privacy but don't let DNT silently kill events

    // ── Heatmaps + Session Replay (web only) ────────────────────────────────
    // Heatmaps are derived from session-replay data, so enabling replay is
    // what unlocks heatmaps in the MixPanel UI. Requires a Growth / Enterprise
    // plan to view; data collection still happens on lower plans but the UI
    // will not surface it.
    //
    // Privacy defaults below are tuned for a UK political audience under UK
    // GDPR. They are conservative on purpose — input fields are masked, the
    // signup form is fully blocked, sensitive copy can be opted out by adding
    // the `mp-no-record` class to any element.
    record_sessions_percent: 100,
    record_mask_text_selector: 'input, textarea, [data-mp-mask], .mp-mask',
    record_block_selector:     '.mp-no-record, [data-mp-no-record]',
    record_collect_fonts:      true,

    loaded: (mp) => {
      // Ensure any stale opt-out state from a previous session does not persist.
      // opt_in_tracking() is a no-op if the user was already opted in.
      mp.opt_in_tracking();
    },
  });
}

// ── Timers ────────────────────────────────────────────────────────────────────

const _timers: Map<string, number> = new Map();

/** Start a named stopwatch. Calling again with the same label resets the clock. */
export function startTimer(label: string): void {
  _timers.set(label, Date.now());
}

/** Return ms since startTimer(label) without clearing the timer. Returns 0 if never started. */
export function elapsedMs(label: string): number {
  const t = _timers.get(label);
  return t != null ? Date.now() - t : 0;
}

/** Return ms since startTimer(label) and clear the timer. Returns 0 if never started. */
export function stopTimer(label: string): number {
  const ms = elapsedMs(label);
  _timers.delete(label);
  return ms;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Merge props into super-properties stamped on every subsequent event.
 */
export function setSuperProperties(props: Properties): void {
  try {
    mixpanel.register(props as Record<string, unknown>);
  } catch {
    // Never throw from analytics.
  }
}

/**
 * Fire a named event with optional properties.
 */
export function track(event: string, properties: Properties = {}): void {
  try {
    mixpanel.track(event, properties as Record<string, unknown>);
  } catch {
    // Never throw from analytics.
  }
}

/**
 * Associate all subsequent events with a known user identity.
 * Call after registration or login with the user's email or unique ID.
 */
export function identify(userId: string): void {
  try {
    mixpanel.identify(userId);
  } catch {
    // Never throw from analytics.
  }
}
