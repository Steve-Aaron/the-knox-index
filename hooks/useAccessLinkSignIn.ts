/**
 * hooks/useAccessLinkSignIn.ts
 * -----------------------------
 * Completes sign-in from a waitlist approval email: /login?access=<token>.
 * Swaps the token for a Firebase sign-in (lib/firebaseClient.ts
 * signInWithAccessLink), mints the session cookie, then reports 'done' so the
 * page can open the dashboard.
 *
 * Statuses:
 *   idle        no access token in the URL (normal /login visit)
 *   completing  sign-in in flight
 *   done        session cookie set; redirect now
 *   error       link invalid, expired or access withdrawn
 *
 * One job: turn a clicked approval link into a session.
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { track } from '@/lib/analytics';
import { establishSession, signInWithAccessLink } from '@/lib/firebaseClient';

export type AccessLinkStatus = 'idle' | 'completing' | 'done' | 'error';

export function useAccessLinkSignIn(): { status: AccessLinkStatus; error: string | null } {
  const [status, setStatus] = useState<AccessLinkStatus>('idle');
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let token: string | null = null;
    try { token = new URLSearchParams(window.location.search).get('access'); } catch { /* malformed */ }
    if (!token) return;

    setStatus('completing');
    (async () => {
      try {
        const idToken = await signInWithAccessLink(token!);
        await establishSession(idToken);
        track('access_link_completed');
        setStatus('done');
      } catch (err: any) {
        track('access_link_failed');
        setError(`${err?.message ?? 'Sign-in failed'}. Sign in below with the address you joined the waitlist with.`);
        setStatus('error');
      }
    })();
  }, []);

  return { status, error };
}
