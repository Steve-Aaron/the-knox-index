import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { KnoxLogo } from '@/components/primitives/KnoxLogo';
import { GlassSurface } from '@/components/primitives/GlassSurface';
import { DevLabel } from '@/components/primitives/DevLabel';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { WorldLeadersAccess } from '@/components/admin/WorldLeadersAccess';
import { useAuth } from '@/hooks/useAuth';
import { neutral, brand, glass } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * AdminScreen  (/admin)
 * ----------------------
 * Who may see the full World Leaders dashboard: approve waitlist requests,
 * revoke access, give someone access directly. Nothing else; the old panel
 * (tracked profiles, account types, CSV import, account tie-ins) is gone.
 *
 * Signed out → sign in with Google here. Signed in but not on ADMIN_EMAILS →
 * told so. The server checks the allowlist on every request regardless.
 *
 * One job: frame the World Leaders access panel behind an admin sign-in.
 */

export default function AdminScreen() {
  const { isRegistered, email, loading } = useAuth();
  const [forbidden, setForbidden] = useState(false);
  const onForbidden = useCallback(() => setForbidden(true), []);
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(880, width - spacing.md * 2);

  if (loading) {
    return (
      <AuthScreen kicker="ADMIN" title="Checking your access…" frameless>
        <View style={styles.spinner}><ActivityIndicator color={neutral.textMid} /></View>
      </AuthScreen>
    );
  }

  if (!isRegistered) {
    return (
      <AuthScreen
        kicker="ADMIN"
        title="Sign in to manage access"
        subtitle="Use the Knox Google account that's on the admin list."
      >
        <AdminGoogleSignIn />
      </AuthScreen>
    );
  }

  if (forbidden) {
    return (
      <AuthScreen
        kicker="ADMIN"
        title="Not an admin account"
        subtitle={`${email ?? 'This account'} isn't on the admin list. Ask Steve to add it to ADMIN_EMAILS in Vercel, then reload this page.`}
      >
        <Pressable onPress={() => router.replace('/worldleaders' as any)} style={styles.backLink}>
          <Text style={styles.backText}>← Back to World Leaders</Text>
        </Pressable>
      </AuthScreen>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <DevLabel name="AdminScreen" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={{ width: pageWidth, gap: spacing.lg }}>
          <View style={styles.header}>
            <KnoxLogo width={110} />
            <Pressable onPress={() => router.replace('/worldleaders' as any)}>
              <Text style={styles.backText}>World Leaders →</Text>
            </Pressable>
          </View>

          <GlassSurface radius={radius.lg} flatTop topAccent={brand.gradient as any}>
            <View style={styles.panel}>
              <Text style={styles.kicker}>ADMIN · SIGNED IN AS {(email ?? '').toUpperCase()}</Text>
              <Text style={styles.title}>World Leaders access</Text>
              <WorldLeadersAccess onForbidden={onForbidden} />
            </View>
          </GlassSurface>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Google sign-in that comes back to /admin rather than a dashboard. */
function AdminGoogleSignIn() {
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { signInWithGoogle, establishSession } = await import('@/lib/firebaseClient');
      const idToken = await signInWithGoogle();
      if (!idToken) { setBusy(false); return; }
      await establishSession(idToken);
      if (Platform.OS === 'web') window.location.assign('/admin');
    } catch (err: any) {
      setError(err?.message ?? 'Sign-in failed');
      setBusy(false);
    }
  }, []);

  return (
    <View style={{ gap: spacing.sm }}>
      <Pressable
        onPress={() => { void signIn(); }}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => [styles.googleBtn, (pressed || busy) && { opacity: 0.75 }]}
      >
        <Text style={styles.googleText}>{busy ? 'Signing in…' : 'Continue with Google'}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: neutral.felt },
  scroll:  { alignItems: 'center', paddingVertical: spacing.xl },
  spinner: { paddingVertical: spacing.lg, alignItems: 'center' },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panel:   { padding: spacing.lg, gap: spacing.md },
  kicker:  { fontFamily: font.bold, fontSize: 10, letterSpacing: 1.6, color: neutral.textMid },
  title:   { fontFamily: font.bold, fontSize: 24, color: neutral.text },
  backLink: { marginTop: spacing.md },
  backText: { fontFamily: font.ui, fontSize: 13, color: neutral.textMid },
  googleBtn: {
    marginTop:       spacing.md,
    paddingVertical: 12,
    borderRadius:    radius.pill,
    borderWidth:     1,
    borderColor:     glass.borderHi,
    backgroundColor: glass.fillHi,
    alignItems:      'center',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  googleText: { fontFamily: font.bold, fontSize: 14, color: neutral.text },
  error:      { fontFamily: font.ui, fontSize: 12, color: '#FF4F6E' },
});
