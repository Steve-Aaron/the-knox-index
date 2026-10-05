import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { readDevTenantOverride, exitDevTenantOverride } from '@/lib/devTenant';
import { tenantById } from '@/lib/tenants';
import { neutral, knox, glass } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * DevTenantBadge
 * ---------------
 * Says, on screen, that this tab is pinned to a tenant by `?tenant=`.
 *
 * The override is remembered for the tab so client-side navigation keeps it —
 * which means a plain `http://localhost:8081/` can be showing World Leaders
 * with nothing in the URL to say so. This badge is what stops that being a
 * mystery, and clicking it puts the tab back on the hostname's own tenant.
 *
 * Development only: renders nothing in production and nothing when no override
 * is set, so it can never appear on a live site.
 *
 * One job: make the dev tenant override visible and reversible.
 */
export function DevTenantBadge() {
  // Read once on mount: the override cannot change without a reload.
  const [override] = useState(() => readDevTenantOverride());

  if (process.env.NODE_ENV === 'production' || Platform.OS !== 'web' || !override) return null;

  const tenant = tenantById(override);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={exitDevTenantOverride}
        accessibilityRole="button"
        accessibilityLabel="Clear the development tenant override"
        style={({ pressed, hovered }: any) => [
          styles.badge,
          hovered && styles.badgeHover,
          pressed && { opacity: 0.8 },
        ]}
      >
        <View style={styles.dot} />
        <Text style={styles.text}>
          DEV · pinned to dashboard {tenant.dashboardId} · {tenant.brand.nameShort}
        </Text>
        <Text style={styles.action}>clear</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left:     spacing.md,
    bottom:   spacing.md,
    zIndex:   9999,
  },
  badge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: spacing.sm,
    paddingVertical:   6,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       knox.primaryPink,
    backgroundColor:   'rgba(31,29,29,0.88)',
    ...Platform.select({
      web: {
        cursor:               'pointer',
        backdropFilter:       'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      } as any,
      default: {},
    }),
  },
  badgeHover: { borderColor: knox.primaryOrange, backgroundColor: glass.fillHi },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: knox.primaryPink,
  },
  text: {
    fontFamily:    font.bold,
    fontSize:      10,
    letterSpacing: 0.8,
    color:         neutral.text,
  },
  action: {
    fontFamily: font.ui,
    fontSize:   10,
    color:      neutral.textMid,
    textDecorationLine: 'underline',
  },
});
