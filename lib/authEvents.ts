/**
 * lib/authEvents.ts
 * ------------------
 * Tiny pub/sub for client auth state changes. useAuth and establishSession
 * emit after updating the localStorage auth cache; passive readers like
 * HeaderNav subscribe instead of re-reading localStorage on a timer.
 *
 * One job: tell passive components that auth state changed.
 */

export const AUTH_CHANGED_EVENT = 'tki-auth-changed';

export function emitAuthChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

/** Subscribe to auth changes (same tab + cross-tab). Returns unsubscribe. */
export function onAuthChanged(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(AUTH_CHANGED_EVENT, handler);
  window.addEventListener('storage', handler); // cross-tab localStorage writes
  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
