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
 * Works in __DEV__ and on Vercel preview deployments, so reviewers of the dev
 * branch can see the whole site. On a preview, 'full' also sets a cookie that
 * the server accepts as full access to gated dashboards, but only when Vercel
 * says the build is a preview (lib/devIdentity.ts). The live site gets a
 * no-op. Changing state triggers a full page reload so all hooks re-hydrate.
 *
 * One job: be the single source of truth for dev preview state.
 */

import { isPreviewSite } from '@/lib/devTenant';

export type DevPreviewState = 'off' | 'gate' | 'signup' | 'full';

const KEY = '__tki_dev_preview__';

/** Cookie the server reads (on a preview build only) as full access to gated dashboards. */
export const PREVIEW_FULL_ACCESS_COOKIE = 'tki_preview_full';

/** Local development or a Vercel preview: where the preview states may be used. */
export function devPreviewEnabled(): boolean {
  return (typeof __DEV__ !== 'undefined' && __DEV__) || isPreviewSite();
}

export function getDevPreview(): DevPreviewState {
  if (!devPreviewEnabled()) return 'off';
  if (typeof localStorage === 'undefined') return 'off';
  return (localStorage.getItem(KEY) as DevPreviewState) ?? 'off';
}

export function setDevPreview(state: DevPreviewState): void {
  if (!devPreviewEnabled()) return;

  // Preview builds: 'full' also opens gated dashboards (the server checks the build)
  if (isPreviewSite()) {
    document.cookie = state === 'full'
      ? `${PREVIEW_FULL_ACCESS_COOKIE}=1; Path=/; SameSite=Lax; Secure`
      : `${PREVIEW_FULL_ACCESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
  }

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
