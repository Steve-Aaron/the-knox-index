import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import { MotiView } from 'moti';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * AuthToast
 * ----------
 * Temporary auth feedback toast, driven by URL query params so it survives
 * the full-page reloads our auth flows use. Shows for a few seconds on the
 * destination page, cleans the param from the URL, then fades out.
 *
 * Recognised params:
 *   ?auth=error    — magic link expired / already used
 *   ?logged_out=1  — sign-out confirmation
 *
 * One job: confirm an auth event after a page transition, briefly.
 */

const TOAST_MS = 3500;

type ToastKind = 'error' | 'loggedOut';

const MESSAGES: Record<ToastKind, string> = {
  error:     'That link has expired. Please request a new one.',
  loggedOut: "You've been signed out. See you soon.",
};

export function AuthToast() {
  const [kind, setKind] = useState<ToastKind | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const params = new URLSearchParams(window.location.search);
    let detected: ToastKind | null = null;
    if (params.get('auth') === 'error')     detected = 'error';
    if (params.get('logged_out') === '1')   detected = 'loggedOut';
    if (!detected) return;

    setKind(detected);
    // Clean the URL so refresh / share / back-button never re-triggers it
    window.history.replaceState({}, '', window.location.pathname);

    const t = setTimeout(() => setKind(null), TOAST_MS);
    return () => clearTimeout(t);
  }, []);

  if (!kind) return null;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 240 }}
      style={[styles.toast, kind === 'error' ? styles.toastError : styles.toastInfo]}
      pointerEvents="none"
    >
      <Text style={styles.text}>{MESSAGES[kind]}</Text>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  toast: {
    position:          'absolute' as any,
    top:               spacing.xl,
    alignSelf:         'center',
    zIndex:            1000,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderRadius:      radius.pill,
    borderWidth:       1,
    backgroundColor:   'rgba(12,12,28,0.96)',
    ...Platform.select({
      web: {
        position:             'fixed',
        backdropFilter:       'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow:            '0 6px 24px rgba(0,0,0,0.4)',
      } as any,
      default: {},
    }),
  },
  toastInfo:  { borderColor: accent.indigo },
  toastError: { borderColor: '#FF6B6B' },
  text: {
    fontFamily: font.ui,
    fontSize:   13,
    color:      neutral.text,
  },
});
