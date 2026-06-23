/**
 * hooks/useIsAdmin.ts
 * --------------------
 * Client-side admin flag. Hits /api/admin/me once on mount to ask the server
 * whether the current Firebase session belongs to an ADMIN_EMAILS user.
 *
 * Web-only (no admin surface on native builds). Fails closed: any error, 403,
 * or offline state leaves the flag false. This only gates UI affordances — the
 * actual write route re-checks admin status server-side.
 *
 * One job: tell the feed whether to show admin editing controls.
 */

import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

export function useIsAdmin(): boolean {
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cancelled = false;

    fetch('/api/admin/me', { credentials: 'same-origin', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { admin: false }))
      .then((d: { admin?: boolean }) => { if (!cancelled) setAdmin(!!d.admin); })
      .catch(() => { /* not admin / offline → stay false */ });

    return () => { cancelled = true; };
  }, []);

  return admin;
}
