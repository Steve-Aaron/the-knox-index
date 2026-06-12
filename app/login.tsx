import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { router } from 'expo-router';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { MagicLinkForm } from '@/components/auth/MagicLinkForm';
import { GoogleSignInButton } from '@/components/primitives/GoogleSignInButton';
import { LabeledInput } from '@/components/primitives/LabeledInput';
import { PrimaryButton } from '@/components/primitives/PrimaryButton';
import { useMagicLinkCompletion } from '@/hooks/useMagicLinkCompletion';
import { useRegisteredFlag } from '@/hooks/useRegisteredFlag';
import { neutral, glass } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * LoginScreen  (/login)
 * ----------------------
 * Two jobs, one URL:
 *   1. Normal visit  → magic link form + Google sign-in
 *   2. Magic link landing — Firebase email links point here; the completion
 *      hook consumes the link, mints the session cookie, and redirects home
 *
 * Composed of: AuthScreen (frame) + MagicLinkForm + GoogleSignInButton +
 * useMagicLinkCompletion (link landing).
 */

/** Divider with 'or' between the two sign-in methods. */
function OrDivider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

/** Email prompt for magic links opened on a different device. */
function CrossDeviceEmailPrompt({ onSubmit }: { onSubmit: (email: string) => void }) {
  const [email, setEmail] = useState('');
  return (
    <View>
      <Text style={styles.note}>
        Confirm the email address this sign-in link was sent to.
      </Text>
      <LabeledInput
        label="Email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        inputProps={{ autoCapitalize: 'none', keyboardType: 'email-address' }}
      />
      <PrimaryButton
        label="Confirm and sign in"
        onPress={() => onSubmit(email)}
        disabled={!email.trim()}
        style={{ marginTop: spacing.md }}
      />
    </View>
  );
}

export default function LoginScreen() {
  const { status, error, submitEmail } = useMagicLinkCompletion();
  const isRegistered = useRegisteredFlag();

  // Session cookie is set — land on the dashboard fully signed in.
  useEffect(() => {
    if (status === 'done') router.replace('/');
  }, [status]);

  const copy = {
    kicker:   'SIGN IN',
    title:    'Welcome back',
    subtitle: 'No passwords here — we email you a single-use sign-in link, or use Google.',
  };

  if (status === 'completing' || status === 'done') {
    return (
      <AuthScreen kicker="SIGN IN" title="Signing you in…">
        <View style={styles.spinnerWrap}>
          <ActivityIndicator color={neutral.textMid} />
        </View>
      </AuthScreen>
    );
  }

  if (status === 'needs-email') {
    return (
      <AuthScreen kicker="SIGN IN" title="Almost there">
        <CrossDeviceEmailPrompt onSubmit={submitEmail} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen kicker={copy.kicker} title={copy.title} subtitle={copy.subtitle}>
      {/* Already signed in (e.g. bookmarked /login) — offer the way home.
          The form stays available below for switching accounts. */}
      {isRegistered && (
        <Pressable onPress={() => router.replace('/')} style={styles.signedInBanner}>
          <Text style={styles.signedInText}>You're already signed in — go to the dashboard →</Text>
        </Pressable>
      )}
      {status === 'error' && error ? <Text style={styles.error}>{error}</Text> : null}
      <MagicLinkForm />
      <OrDivider />
      <GoogleSignInButton />
      <Pressable onPress={() => router.push('/forgot-password')} style={styles.footerLink}>
        <Text style={styles.footerText}>Forgotten your password?</Text>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  dividerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing.md,
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex:            1,
    height:          1,
    backgroundColor: glass.borderHi,
  },
  dividerText: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      neutral.textMid,
  },
  spinnerWrap: {
    paddingVertical: spacing.xl,
    alignItems:      'center',
  },
  note: {
    fontFamily:   font.ui,
    fontSize:     13,
    lineHeight:   20,
    color:        neutral.textMid,
    marginBottom: spacing.md,
  },
  error: {
    fontFamily:   font.ui,
    fontSize:     13,
    lineHeight:   19,
    color:        '#FF6B6B',
    marginBottom: spacing.md,
  },
  signedInBanner: {
    backgroundColor:   glass.fillHi,
    borderWidth:       1,
    borderColor:       glass.borderHi,
    borderRadius:      8,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom:      spacing.md,
  },
  signedInText: {
    fontFamily: font.ui,
    fontSize:   13,
    color:      neutral.text,
  },
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
