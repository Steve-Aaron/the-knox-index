/**
 * hooks/useMagicLinkCompletion.ts
 * --------------------------------
 * Detects whether the current URL is a Firebase email sign-in link and, if
 * so, completes the sign-in: consume the link → fresh ID token → exchange
 * for the httpOnly session cookie → report success so the page can redirect.
 *
 * Cross-device case: the email used to request the link is stored in
 * localStorage on the requesting device. If it is missing here (link opened
 * on another device), status becomes 'needs-email' and the page collects it
 * via submitEmail().
 *
 * Statuses:
 *   idle         — not a magic link URL (normal /login visit)
 *   completing   — sign-in in flight
 *   needs-email  — link is valid but we don't know whose it is
 *   done         — session cookie set; redirect now
 *   error        — link invalid / expired / already used
 *
 * One job: turn a clicked magic link into a session.
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { track } from '@/lib/analytics';
import {
  isMagicLink,
  completeMagicLinkSignIn,
  establishSession,
  PENDING_EMAIL_KEY,
} from '@/lib/firebaseClient';

export type CompletionStatus = 'idle' | 'completing' | 'needs-email' | 'done' | 'error';

export interface MagicLinkCompletion {
  status:      CompletionStatus;
  error:       string | null;
  /** Supply the email manually for cross-device link opens. */
  submitEmail: (email: string) => void;
}

export function useMagicLinkCompletion(): MagicLinkCompletion {
  const [status, setStatus] = useState<CompletionStatus>('idle');
  const [error,  setError]  = useState<string | null>(null);

  const complete = useCallback(async (email: string) => {
    setStatus('completing');
    try {
      const idToken = await completeMagicLinkSignIn(email, window.location.href);
      await establishSession(idToken);
      track('magic_link_completed');
      setStatus('done');
    } catch (err: any) {
      track('magic_link_completion_failed', { code: err?.code ?? 'unknown' });
      setError(
        err?.code === 'auth/invalid-action-code'
          ? 'This link has expired or already been used. Request a fresh one below.'
          : 'Sign-in failed. Request a fresh link below.'
      );
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    (async () => {
      if (!(await isMagicLink(window.location.href).catch(() => false))) return;

      const pending = localStorage.getItem(PENDING_EMAIL_KEY);
      if (pending) {
        complete(pending);
      } else {
        setStatus('needs-email');
      }
    })();
  }, [complete]);

  const submitEmail = useCallback((email: string) => {
    complete(email.trim().toLowerCase());
  }, [complete]);

  return { status, error, submitEmail };
}
