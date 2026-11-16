import React from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTenant } from '@/hooks/useTenant';
import { homeHref } from '@/lib/indexPaths';
import { glass, neutral } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';

/**
 * BackToDashboard
 * ----------------
 * '← Back to UK' / '← Back to World Leaders' pill: returns to the dashboard
 * of the index this page belongs to (the one you came from on pages without
 * an index in their address, like Preferences and account pages).
 *
 * One job: a way back to the dashboard.
 */
export function BackToDashboard() {
  const tenant = useTenant();
  const label = `←  Back to ${tenant.brand.switcherLabel}`;

  const go = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(homeHref(tenant));
    else router.replace(homeHref(tenant) as any);
  };

  return (
    <Pressable
      onPress={go}
      accessibilityRole="link"
      accessibilityLabel={`Back to the ${tenant.brand.switcherLabel} dashboard`}
      style={({ pressed, hovered }: any) => [styles.back, hovered && styles.hover, pressed && styles.pressed]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf:         'flex-start',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       glass.border,
    backgroundColor:   glass.fill,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  hover:   { borderColor: glass.borderHi },
  pressed: { opacity: 0.75 },
  text: {
    ...type.caption,
    color: neutral.textMid,
  },
});
