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
 * One job: tell the rest of the app whether the user is registered.
 */

import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

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

    // Always verify with the server — stale localStorage + cleared cookie
    // would otherwise let a session-expired user think they're still in.
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(async r => {
        if (r.ok) {
          const data: { email: string } = await r.json();
          setEmail(data.email);
          localStorage.setItem(LS_REGISTERED, '1');
          localStorage.setItem(LS_EMAIL, data.email);
        } else {
          // 401 — cookie gone or tampered, clear the cache
          setEmail(null);
          localStorage.removeItem(LS_REGISTERED);
          localStorage.removeItem(LS_EMAIL);
        }
      })
      .catch(() => {
        // Network error — preserve whatever the optimistic state was
      })
      .finally(() => setLoading(false));
  }, []);

  return {
    isRegistered: email !== null,
    email,
    loading,
  };
}
