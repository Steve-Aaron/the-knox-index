import React from 'react';
import { Text, Pressable, StyleSheet, Platform, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, glass } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * GoogleSignInButton
 * -------------------
 * One-tap Google sign-in trigger. A full-page navigation to
 * /api/auth/google/start kicks off the OAuth flow; the server completes it,
 * sets the session cookie, and redirects home.
 *
 * Web only — native builds have no browser auth (see hooks/useAuth.ts), so
 * this renders nothing off web.
 *
 * Glassmorphic dark surface to match the unlock modal, with a subtle press
 * scale for tactile feedback.
 *
 * One job: start the Google sign-in flow.
 */

interface Props {
  /** Idle → busy lock so a double-tap can't fire two navigations. */
  disabled?: boolean;
  /** Override the default navigation (e.g. for tests / analytics wrappers). */
  onPress?:  () => void;
  /** Label text. */
  label?:    string;
  style?:    ViewStyle | ViewStyle[];
}

/** Official 4-colour Google "G", drawn on a 48×48 grid. */
function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <Path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <Path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <Path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-0.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </Svg>
  );
}

export function GoogleSignInButton({
  disabled = false,
  onPress,
  label = 'Continue with Google',
  style,
}: Props) {
  // Native builds have no browser-based auth — render nothing.
  if (Platform.OS !== 'web') return null;

  function handlePress() {
    if (disabled) return;
    if (onPress) { onPress(); return; }
    // Full-page navigation so the OAuth redirect chain owns the tab.
    if (typeof window !== 'undefined') {
      window.location.assign('/api/auth/google/start');
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        // Tactile feedback: lift on hover, press in on tap.
        pressed && !disabled ? { transform: [{ scale: 0.98 }], opacity: 0.92 } : {},
        disabled && { opacity: 0.6 },
        style as any,
      ]}
    >
      <DevLabel name="GoogleSignInButton" />
      <View style={styles.inner}>
        <GoogleMark size={18} />
        <Text style={styles.text}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor:   glass.fillHi,
    borderWidth:       1,
    borderColor:       glass.borderHi,
    borderRadius:      radius.pill,
    paddingVertical:   13,
    paddingHorizontal: spacing.xl,
    alignItems:        'center',
    justifyContent:    'center',
    ...Platform.select({
      web: { cursor: 'pointer', transitionProperty: 'transform, opacity', transitionDuration: '120ms' } as any,
      default: {},
    }),
  },
  inner: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  text: {
    fontFamily:    font.bold,
    fontSize:      15,
    color:         neutral.text,
    letterSpacing: 0.2,
  },
});
