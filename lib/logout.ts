/**
 * lib/logout.ts
 * --------------
 * Single client-side entry point for signing out. Order matters:
 *   1. POST /api/auth/logout — revokes Firebase refresh tokens (kills the
 *      session everywhere) and clears the httpOnly cookie
 *   2. Sign out of the Firebase client SDK — otherwise useAuth would
 *      silently re-mint a fresh session cookie on the next 401
 *   3. Clear cached auth state from localStorage
 *   4. Full reload so every hook re-hydrates signed-out
 *
 * One job: end the session completely, client and server.
 */

import { Platform } from 'react-native';
import { firebaseSignOut } from '@/lib/firebaseClient';
import { track, setSuperProperties } from '@/lib/analytics';

export async function logout(): Promise<void> {
  if (Platform.OS !== 'web') return;

  track('logout_tapped');

  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch { /* cookie clearing is best-effort — continue */ }

  try {
    await firebaseSignOut();
  } catch { /* SDK may be unconfigured in dev — continue */ }

  localStorage.removeItem('tki_registered');
  localStorage.removeItem('tki_email');
  localStorage.removeItem('tki_profiled');
  setSuperProperties({ is_registered: false });

  // Land on the dashboard with a temporary confirmation toast (see AuthToast)
  window.location.assign('/?logged_out=1');
}
