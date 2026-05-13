/**
 * lib/analytics.ts
 * -----------------
 * Lazy-initialised Mixpanel wrapper.
 *
 * Public API:
 *   track(event, properties)   — fire an event
 *   identify(userId)           — tie events to a known user
 *   setSuperProperties(props)  — merge props into every subsequent event
 *   startTimer(label)          — begin a named stopwatch
 *   elapsedMs(label)           — read ms since startTimer, without stopping it
 *   stopTimer(label)           — read ms and clear the stopwatch
 *
 * Token is a public Mixpanel project token (safe to ship in client code).
 * useNative: false ensures pure-JS path — works on web + native with no link step.
 * All calls are try/catch wrapped — analytics must never crash the app.
 */

import { Mixpanel } from 'mixpanel-react-native';

const TOKEN = 'fd4826c41ed1184899b0350f4507593d';

export type Properties = Record<string, string | number | boolean | null | undefined>;

// ── Queue: buffer events that arrive before init resolves ─────────────────────

interface QueueItem {
  event:      string;
  properties: Properties;
}

let _instance:    Mixpanel | null = null;
let _initPromise: Promise<void>  | null = null;
const _queue: QueueItem[] = [];
const _superProps: Properties = {};

function init(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const mp = new Mixpanel(TOKEN, /* trackAutomaticEvents */ false, /* useNative */ false);
      await mp.init();
      _instance = mp;

      // Apply any super properties that were set before init completed.
      if (Object.keys(_superProps).length) {
        mp.registerSuperProperties(_superProps);
      }

      // Flush buffered events.
      for (const item of _queue.splice(0)) {
        mp.track(item.event, item.properties);
      }
    } catch {
      // Never block the app on analytics failure.
    }
  })();

  return _initPromise;
}

// Kick off initialisation eagerly so it's warm by the time events fire.
void init();

// ── Timers ────────────────────────────────────────────────────────────────────

const _timers: Map<string, number> = new Map();

/**
 * Start a named stopwatch. Call elapsedMs / stopTimer to read it.
 * Calling startTimer again with the same label resets the clock.
 */
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
 * Merge `props` into the super-properties bag. Every subsequent `track()` call
 * will automatically include these properties alongside its own.
 */
export function setSuperProperties(props: Properties): void {
  try {
    Object.assign(_superProps, props);
    if (_instance) _instance.registerSuperProperties(props);
    // If not yet initialised, _superProps is applied inside init() once ready.
  } catch {
    // Never throw from analytics.
  }
}

/**
 * Track an event. Safe to call before init completes — queued and flushed
 * once Mixpanel is ready.
 */
export function track(event: string, properties: Properties = {}): void {
  try {
    const merged = { ..._superProps, ...properties };
    if (_instance) {
      _instance.track(event, merged);
    } else {
      _queue.push({ event, properties: merged });
    }
  } catch {
    // Never throw from analytics.
  }
}

/**
 * Associate all subsequent events with a user identity.
 * Call after login or registration with the user's email or unique ID.
 */
export function identify(userId: string): void {
  try {
    if (_instance) void _instance.identify(userId);
  } catch {
    // Never throw from analytics.
  }
}
