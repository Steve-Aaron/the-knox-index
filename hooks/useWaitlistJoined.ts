/**
 * hooks/useWaitlistJoined.ts
 * ---------------------------
 * Remembers, in this browser, that a visitor joined an index's waitlist
 * without signing in, so the page can say 'You're on the waitlist' on later
 * visits instead of inviting them again. Per index. A convenience only: the
 * request itself is stored server-side, and access is never decided from it.
 *
 * One job: remember the address this browser joined the waitlist with.
 */

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

const key = (tenantId: string) => `tki_waitlist_joined:${tenantId}`;

export function useWaitlistJoined(tenantId: string): {
  joinedEmail: string | null;
  markJoined:  (email: string) => void;
} {
  const [joinedEmail, setJoinedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try { setJoinedEmail(localStorage.getItem(key(tenantId))); } catch { /* storage blocked */ }
  }, [tenantId]);

  const markJoined = useCallback((email: string) => {
    setJoinedEmail(email);
    if (Platform.OS !== 'web') return;
    try { localStorage.setItem(key(tenantId), email); } catch { /* storage blocked */ }
  }, [tenantId]);

  return { joinedEmail, markJoined };
}
