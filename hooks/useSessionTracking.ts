/**
 * hooks/useSessionTracking.ts
 * ----------------------------
 * Area 1: App Session tracking.
 *
 * On mount:
 *   - Sets super properties for platform and screen_category so every
 *     subsequent event in the session carries those dimensions automatically.
 *   - Fires `session_started` with referrer (web only) and screen info.
 *   - Starts the 'session' timer.
 *
 * On page visibility change:
 *   - `session_ended`  when the tab goes to background/close (visibilitychange → hidden).
 *   - `session_resumed` when the tab returns to the foreground.
 *
 * On unmount (native navigate-away):
 *   - `session_ended` with session duration.
 *
 * One job: bookend each visit so session-level metrics are available in Mixpanel.
 */

import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { track, setSuperProperties, startTimer, stopTimer, elapsedMs } from '@/lib/analytics';
import { breakpoints } from '@/theme/breakpoints';

function screenCategory(width: number): 'mobile' | 'tablet' | 'desktop' {
  if (width >= breakpoints.desktop) return 'desktop';
  if (width >= breakpoints.tablet)  return 'tablet';
  return 'mobile';
}

export function useSessionTracking(): void {
  const { width } = useWindowDimensions();
  const category  = screenCategory(width);

  useEffect(() => {
    // ── Super properties: stamped on every event this session ──────────────
    setSuperProperties({
      platform:        Platform.OS,
      screen_category: category,
    });

    // ── session_started ────────────────────────────────────────────────────
    startTimer('session');

    const referrer = Platform.OS === 'web'
      ? (typeof document !== 'undefined' ? document.referrer || null : null)
      : null;

    track('session_started', {
      platform:          Platform.OS,
      screen_category:   category,
      screen_width_px:   width,
      ...(referrer != null ? { referrer } : {}),
    });

    // ── Visibility-based events (web only) ─────────────────────────────────
    let lastHidden = 0;

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        lastHidden = Date.now();
        track('session_ended', {
          session_duration_s: Math.round(elapsedMs('session') / 1000),
          reason:             'tab_hidden',
        });
      } else if (document.visibilityState === 'visible' && lastHidden > 0) {
        const away_s = Math.round((Date.now() - lastHidden) / 1000);
        track('session_resumed', {
          away_duration_s: away_s,
        });
        lastHidden = 0;
      }
    }

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // ── Cleanup (native or hard unmount) ───────────────────────────────────
    return () => {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      track('session_ended', {
        session_duration_s: Math.round(stopTimer('session') / 1000),
        reason:             'unmount',
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
