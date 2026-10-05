import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { PrimaryButton } from '@/components/primitives/PrimaryButton';
import { AccessRequestForm } from '@/components/auth/AccessRequestForm';
import { DevLabel } from '@/components/primitives/DevLabel';
import { useTenantAccess } from '@/hooks/useTenantAccess';
import { tenantFullName } from '@/lib/tenants';
import { neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * TenantGate
 * -----------
 * Wraps a screen on a gated tenant and renders it only when the server says
 * this visitor may read it. On a public tenant it is a pass-through with no
 * network call, so The Knox Index is untouched.
 *
 * Four locked states, one screen each:
 *   unauthenticated → sign in
 *   none            → request access (posts a pending record)
 *   pending         → awaiting approval
 *   denied          → refused
 *
 * This is presentation only. The real enforcement is server-side in
 * lib/tenantGuard.ts, which every data route calls before it queries.
 *
 * One job: show the right door when the dashboard is locked.
 */

interface Props {
  children: React.ReactNode;
}

export function TenantGate({ children }: Props) {
  const { tenant, loading, allowed, reason, email, error, refresh } = useTenantAccess();

  if (allowed) return <>{children}</>;

  if (loading) {
    return (
      <AuthScreen kicker={tenant.brand.kicker} title="Checking your access…" frameless>
        <View style={styles.spinnerWrap}>
          <ActivityIndicator color={neutral.textMid} />
        </View>
      </AuthScreen>
    );
  }

  const domains = tenant.access.allowedDomains.map(d => `@${d}`).join(' or ');

  if (reason === 'unauthenticated') {
    return (
      <AuthScreen
        kicker={tenant.brand.kicker}
        title="Sign in to continue"
        subtitle={`${tenantFullName(tenant)} is a restricted dashboard. Sign in with your work email — ${domains} accounts are admitted automatically.`}
      >
        <DevLabel name="TenantGate" />
        <PrimaryButton label="Sign in" onPress={() => router.push('/login')} style={styles.action} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </AuthScreen>
    );
  }

  if (reason === 'none') {
    return (
      <AuthScreen
        kicker={tenant.brand.kicker}
        title="Request access"
        subtitle={`${tenantFullName(tenant)} is restricted. ${domains} accounts are admitted automatically; anyone else is reviewed by the Knox team. Tell us a little about you and we will come back by email.`}
      >
        <DevLabel name="TenantGate" />
        <AccessRequestForm
          email={email}
          tenantName={tenant.brand.nameShort}
          onSubmitted={refresh}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </AuthScreen>
    );
  }

  if (reason === 'pending') {
    return (
      <AuthScreen
        kicker={tenant.brand.kicker}
        title="Access requested"
        subtitle={`Your request for ${email ?? 'this address'} is with the Knox team. We have emailed you a confirmation, and you will hear from us once it has been reviewed.`}
      >
        <DevLabel name="TenantGate" />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      kicker={tenant.brand.kicker}
      title="Access not granted"
      subtitle={`${email ?? 'This address'} is not approved for ${tenantFullName(tenant)}. If that looks wrong, contact the Knox team.`}
    >
      <DevLabel name="TenantGate" />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  spinnerWrap: { paddingVertical: spacing.lg, alignItems: 'center' },
  action:      { marginTop: spacing.md },
  error: {
    marginTop:  spacing.sm,
    fontFamily: font.ui,
    fontSize:   13,
    color:      neutral.textMid,
    textAlign:  'center',
  },
});
