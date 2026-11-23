import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { PrimaryButton } from '@/components/primitives/PrimaryButton';
import { AccessRequestForm } from '@/components/auth/AccessRequestForm';
import { DevLabel } from '@/components/primitives/DevLabel';
import { DevPanel } from '@/components/primitives/DevPanel';
import { useTenantAccess } from '@/hooks/useTenantAccess';
import { useTenant } from '@/hooks/useTenant';
import { neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * TenantGate
 * -----------
 * Wraps a screen on a gated tenant and renders it only when the server says
 * this visitor may read it. On a public tenant it is a pass-through. On a
 * waitlist tenant it is a pass-through too (the dashboard shows the guest view
 * and handles the waitlist via StickyUnlock) UNLESS requireFullAccess is set,
 * which the account page passes so its per-account data stays behind approval.
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
  /** Require the FULL (approved) view even on a waitlist tenant. Used by the
   *  account page, whose per-account data is not part of the open guest view. */
  requireFullAccess?: boolean;
}

/**
 * Every locked screen also carries the dev / preview bar, so a reviewer on a
 * Vercel preview can turn on 'Full' access without signing in. The bar
 * renders nothing on the live site.
 */
function withPreviewBar(node: React.ReactNode): React.ReactElement {
  return <>{node}<DevPanel /></>;
}

export function TenantGate({ children, requireFullAccess = false }: Props) {
  const tenant = useTenant();
  const gated =
    tenant.access.mode === 'authenticated' ||
    (requireFullAccess && tenant.access.mode === 'waitlist');
  if (!gated) return <>{children}</>;
  return <LockedTenantGate>{children}</LockedTenantGate>;
}

function LockedTenantGate({ children }: Props) {
  const { tenant, loading, allowed, reason, email, error, refresh } = useTenantAccess();

  if (allowed) return <>{children}</>;

  if (loading) {
    return withPreviewBar(
      <AuthScreen kicker={tenant.brand.kicker} title="Checking your access…" frameless>
        <View style={styles.spinnerWrap}>
          <ActivityIndicator color={neutral.textMid} />
        </View>
      </AuthScreen>
    );
  }

  if (reason === 'unauthenticated') {
    return withPreviewBar(
      <AuthScreen
        kicker={tenant.brand.kicker}
        title="Sign in to continue"
        subtitle={`${tenant.brand.subtitle ?? tenant.brand.nameShort} is available to approved users. Sign in with your email to continue. If you don't have access yet, you can request it after signing in.`}
      >
        <DevLabel name="TenantGate" />
        <PrimaryButton label="Sign in" onPress={() => router.push('/login')} style={styles.action} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </AuthScreen>
    );
  }

  if (reason === 'none') {
    return withPreviewBar(
      <AuthScreen
        kicker={tenant.brand.kicker}
        title="Request access"
        subtitle={`${tenant.brand.subtitle ?? tenant.brand.nameShort} is available to approved users. Tell us a little about yourself and what you're looking for, and we'll get back to you by email.`}
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
    return withPreviewBar(
      <AuthScreen
        kicker={tenant.brand.kicker}
        title="Access requested"
        subtitle={`Thanks, we've received your request for ${email ?? 'this address'}. We've emailed you a confirmation and will be in touch once it's been reviewed.`}
      >
        <DevLabel name="TenantGate" />
      </AuthScreen>
    );
  }

  return withPreviewBar(
    <AuthScreen
      kicker={tenant.brand.kicker}
      title="Access not granted"
      subtitle={`We weren't able to approve access for ${email ?? 'this address'}. If you think this is a mistake, please get in touch.`}
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
