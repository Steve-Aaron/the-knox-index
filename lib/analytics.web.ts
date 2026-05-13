/**
 * lib/analytics.web.ts
 * ---------------------
 * Web-specific Mixpanel wrapper using mixpanel-browser.
 *
 * Metro/webpack resolves this file over analytics.ts on web builds (Expo
 * platform-split via .web.ts extension). Native builds continue to use
 * analytics.ts (mixpanel-react-native).
 *
 * ── Ownership split ──────────────────────────────────────────────────────────
 *   GTM    — calls mixpanel.init() via a Custom HTML tag gated on
 *            analytics_storage consent (Silktide). See AGENTS.md for the
 *            exact GTM tag configuration.
 *   Code   — owns all track() / identify() / setSuperProperties() calls.
 *            mixpanel-browser queues these internally and flushes them
 *            automatically once GTM fires init.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ad-blocker bypass: GTM's init tag sets api_host to window.location.origin
 * + '/mp', which Vercel rewrites to https://api.mixpanel.com (see vercel.json).
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

// ── GTM bridge ───────────────────────────────────────────────────────────────
//
// Expose the bundled mixpanel instance as window.mixpanel so GTM's init tag
// operates on this exact object. When GTM calls mixpanel.init(...), it inits
// the same instance that all the track() calls below use — no double instance.
//
// DO NOT call mixpanel.init() here. GTM owns that call.
// mixpanel-browser queues all track/identify/register calls internally and
// flushes them once init fires, so events sent before consent is granted
// are not lost — they fire as soon as the user accepts analytics.
//
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).mixpanel = mixpanel;
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
 * Safe to call before init — mixpanel-browser queues register() internally.
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
 * Safe to call before GTM fires init — events queue and flush on init.
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
