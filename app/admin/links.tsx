/**
 * app/admin/links.tsx
 * --------------------
 * Admin route for confirming account tie-ins: which TikTok and X account
 * belongs to which person in metadata.person.
 *
 * Access is enforced SERVER-SIDE by /api/admin/links, exactly like the rest of
 * the admin area. A 403 on the first fetch renders the not-authorised gate,
 * which on localhost usually means DEV_TENANT_EMAIL is not on ADMIN_EMAILS.
 * Web-only — never rendered on native.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AccountLinkPanel } from '@/components/admin/AccountLinkPanel';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, knox } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

export default function AdminLinksPage() {
  const router = useRouter();
  const [forbidden, setForbidden] = useState(false);
  const [checked,   setChecked]   = useState(false);

  // One cheap probe before rendering the panel, so an unauthorised visitor sees
  // the gate rather than a panel full of failing requests.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/links?limit=1', { credentials: 'same-origin' });
        setForbidden(res.status === 403);
      } catch { /* leave the panel to report a real failure */ }
      setChecked(true);
    })();
  }, []);

  if (checked && forbidden) {
    return (
      <View style={[styles.root, styles.center]}>
        <DevLabel name="AdminLinksGate" />
        <Text style={styles.heading}>Not authorised</Text>
        <Text style={styles.dim}>This area is restricted. Sign in with an admin account, then try again.</Text>
        <Pressable style={styles.primary} onPress={() => router.replace('/login')}>
          <Text style={styles.primaryText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <DevLabel name="AdminLinksPage" />

      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/admin')} style={styles.back}>
          <Text style={styles.backText}>← Admin</Text>
        </Pressable>
        <Text style={styles.heading}>Account tie-ins</Text>
        <Text style={styles.dim}>Confirm which platform account belongs to which person</Text>
      </View>

      {checked ? <AccountLinkPanel /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: neutral.felt },
  content: { padding: spacing.xl, gap: spacing.xl, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  center:  { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  header:  { gap: spacing.xs },
  heading: { color: neutral.text, fontSize: 26, fontWeight: '700' },
  dim:     { color: neutral.textMid, fontSize: 14 },
  back:    { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  backText:{ color: neutral.textMid, fontSize: 13 },
  primary: {
    backgroundColor: knox.primaryOrange, paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg, borderRadius: radius.pill,
  },
  primaryText: { color: neutral.felt, fontWeight: '700' },
});
