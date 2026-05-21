/**
 * hooks/useAuth.ts
 * -----------------
 * Client-side auth state. Hits /api/auth/me on mount to verify the session
 * cookie, then caches the result in localStorage for instant re-hydration
 * on subsequent renders.
 *
 * Rules:
 *   - If the server says authenticated → trust it, update localStorage cache
 *   - If the server says 401           → clear stale localStorage cache
 *   - If the network fails             → keep whatever localStorage says
 *     (avoids logging out users on flaky connections)
 *
 * Analytics fired here:
 *   - identify()         — links all subsequent events to the user's email in MixPanel
 *   - setSuperProperties — stamps is_registered on every event from this point
 *   - user_registered    — first time a browser confirms registration (no cached LS entry)
 *   - user_returned      — subsequent authenticated sessions (LS entry already present)
 *
 * One job: tell the rest of the app whether the user is registered.
 */

import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { identify, setSuperProperties, track } from '@/lib/analytics';
import { getDevPreview } from '@/lib/devPreview';

export interface AuthState {
  isRegistered: boolean;
  email:        string | null;
  loading:      boolean;
}

const LS_REGISTERED = 'tki_registered';
const LS_EMAIL      = 'tki_email';

export function useAuth(): AuthState {
  const [email,   setEmail]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Native builds: no auth, no localStorage
    if (Platform.OS !== 'web') {
      setLoading(false);
      return;
    }

    // Optimistic hydration from localStorage — shows registered state instantly
    // without waiting for the network round-trip.
    const cached      = localStorage.getItem(LS_REGISTERED) === '1';
    const cachedEmail = localStorage.getItem(LS_EMAIL) ?? null;
    if (cached && cachedEmail) {
      setEmail(cachedEmail);
    }

    // Dev preview: skip server verification entirely — no real cookie exists
    // in local dev, so /api/auth/me would return 401 and undo the seeded state.
    const devPreview = getDevPreview();
    if (devPreview === 'signup' || devPreview === 'full') {
      setSuperProperties({ is_registered: true });
      setLoading(false);
      return;
    }

    // Always verify with the server — stale localStorage + cleared cookie
    // would otherwise let a session-expired user think they're still in.
    fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' })
      .then(async r => {
        if (r.ok) {
          const data: { email: string } = await r.json();

          // Determine if this is a brand-new registration or a returning session.
          // If LS_REGISTERED was not already set, this is the first confirmation.
          const isNewRegistration = localStorage.getItem(LS_REGISTERED) !== '1';

          setEmail(data.email);
          localStorage.setItem(LS_REGISTERED, '1');
          localStorage.setItem(LS_EMAIL, data.email);

          // ── Analytics ──────────────────────────────────────────────────────
          // Link all future events to this identity in MixPanel.
          identify(data.email);
          // Stamp every subsequent event with registration status.
          setSuperProperties({ is_registered: true });
          // Fire the appropriate conversion event.
          if (isNewRegistration) {
            track('user_registered');
          } else {
            track('user_returned');
          }
        } else {
          // 401 — cookie gone or tampered, clear the cache
          setEmail(null);
          localStorage.removeItem(LS_REGISTERED);
          localStorage.removeItem(LS_EMAIL);
          setSuperProperties({ is_registered: false });
        }
      })
      .catch(() => {
        // Network error — preserve whatever the optimistic state was.
        // Stamp super property based on cached state so events are labelled correctly.
        setSuperProperties({ is_registered: cached });
      })
      .finally(() => setLoading(false));
  }, []);

  return {
    isRegistered: email !== null,
    email,
    loading,
  };
}
