import React from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { MagicLinkForm } from '@/components/auth/MagicLinkForm';
import { neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * ForgotPasswordScreen  (/forgot-password)
 * -----------------------------------------
 * The Knox Index is passwordless — there is no password to reset. This page
 * exists because users will look for it anyway: it explains the model and
 * hands them the same magic link form as /login.
 *
 * Composed of: AuthScreen (frame) + MagicLinkForm.
 */

export default function ForgotPasswordScreen() {
  return (
    <AuthScreen
      kicker="ACCOUNT ACCESS"
      title="No password needed"
      subtitle="The Knox Index is passwordless, so there's nothing to reset. Enter your email and we'll send you a single-use sign-in link."
    >
      <MagicLinkForm buttonLabel="Send me a sign-in link" />
      <Pressable onPress={() => router.push('/login')} style={styles.footerLink}>
        <Text style={styles.footerText}>← Back to sign in</Text>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  footerLink: {
    marginTop:  spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    fontFamily:         font.ui,
    fontSize:           13,
    color:              neutral.textMid,
    textDecorationLine: 'underline',
  },
});
