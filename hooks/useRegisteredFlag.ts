/**
 * hooks/useRegisteredFlag.ts
 * ---------------------------
 * Lightweight signed-in check for passive display components (navbar,
 * footer, login banner). Reads the localStorage flag that hooks/useAuth.ts
 * maintains, deliberately NOT useAuth itself — a second useAuth instance
 * would double-fire /api/auth/me and its Mixpanel events.
 *
 * Subscribes to lib/authEvents so consumers flip the moment a session is
 * confirmed, cleared, or changed in another tab.
 *
 * One job: say whether the user is signed in, reactively, without side
 * effects. Not a security boundary — the session cookie is.
 */

import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { onAuthChanged } from '@/lib/authEvents';

export function useRegisteredFlag(): boolean {
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
    const read = () => setRegistered(localStorage.getItem('tki_registered') === '1');
    read();
    return onAuthChanged(read);
  }, []);

  return registered;
}
