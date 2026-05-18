/**
 * lib/devPreview.ts
 * ------------------
 * Dev-only preview state. Forces specific auth/UI states in local dev so you
 * can inspect every screen without clicking a real magic link.
 *
 * States:
 *   off    — normal behaviour (default)
 *   gate   — unregistered user who has hit the scroll threshold (shows CTA bar)
 *   signup — registered but not yet profiled (shows profiling modal)
 *   full   — registered and profiled (fully unlocked dashboard)
 *
 * Only ever reads/writes in __DEV__ mode. Production builds get a no-op.
 * Changing state triggers a full page reload so all hooks re-hydrate cleanly.
 *
 * One job: be the single source of truth for dev preview state.
 */

export type DevPreviewState = 'off' | 'gate' | 'signup' | 'full';

const KEY = '__tki_dev_preview__';

export function getDevPreview(): DevPreviewState {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return 'off';
  if (typeof localStorage === 'undefined') return 'off';
  return (localStorage.getItem(KEY) as DevPreviewState) ?? 'off';
}

export function setDevPreview(state: DevPreviewState): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;

  // Wipe any residual auth/profile keys so hooks re-hydrate from scratch
  localStorage.removeItem('tki_registered');
  localStorage.removeItem('tki_email');
  localStorage.removeItem('tki_profiled');

  if (state === 'off') {
    localStorage.removeItem(KEY);
  } else {
    localStorage.setItem(KEY, state);

    // Pre-seed localStorage so hooks read the right state immediately
    if (state === 'signup' || state === 'full') {
      localStorage.setItem('tki_registered', '1');
      localStorage.setItem('tki_email', 'dev@preview.local');
    }
    if (state === 'full') {
      localStorage.setItem('tki_profiled', '1');
    }
  }

  // Reload so useAuth, StickyUnlock etc. all re-hydrate from fresh localStorage
  window.location.reload();
}
