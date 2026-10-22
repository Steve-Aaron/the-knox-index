import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { glass, neutral } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';

/**
 * AccountPageHeader
 * ------------------
 * '← Dashboards' back pill and the 'ACCOUNT' page title.
 *
 * One job: page heading + way back.
 */
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function AccountPageHeader() {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={goBack}
        accessibilityRole="link"
        accessibilityLabel="Back to dashboards"
        style={({ pressed, hovered }: any) => [
          styles.back,
          hovered && styles.backHover,
          pressed && styles.backPressed,
        ]}
      >
        <Text style={styles.backText}>←  Dashboards</Text>
      </Pressable>
      <Text style={styles.title} accessibilityRole="header">Account</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xl,
  },
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
  backHover: {
    borderColor: glass.borderHi,
  },
  backPressed: {
    opacity: 0.75,
  },
  backText: {
    ...type.caption,
    color: neutral.textMid,
  },
  title: {
    ...type.title,
    color:         neutral.text,
    textTransform: 'uppercase',
  },
});
