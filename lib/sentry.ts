/**
 * lib/sentry.ts
 * --------------
 * Lazy-initialised Sentry wrapper.
 * Initialises once on first captureException call if EXPO_PUBLIC_SENTRY_DSN
 * is set; otherwise every call is a silent no-op so the app never throws
 * when Sentry isn't configured (e.g. local dev without a DSN).
 *
 * One job: forward unhandled errors to Sentry without coupling Sentry
 * initialisation to the app boot path.
 */

import * as Sentry from '@sentry/react-native';

let _initialised = false;

function ensureInit(): boolean {
  if (_initialised) return true;

  const dsn = process.env['EXPO_PUBLIC_SENTRY_DSN'];
  if (!dsn) return false;

  Sentry.init({
    dsn,
    // Only include structured breadcrumbs — never log raw console output which
    // could contain PII or partial credentials.
    integrations: integrations =>
      integrations.filter(i => i.name !== 'Console'),
  });

  _initialised = true;
  return true;
}

/**
 * Send an error to Sentry with optional extra context.
 * Safe to call unconditionally — is a no-op when DSN is absent.
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!ensureInit()) return;

  Sentry.captureException(
    error,
    context ? { extra: context } : undefined,
  );
}
