import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackToDashboard } from '@/components/primitives/BackToDashboard';
import { neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';

/**
 * AccountPageHeader
 * ------------------
 * The back-to-dashboard pill and the 'ACCOUNT' page title.
 *
 * One job: page heading + way back.
 */
export function AccountPageHeader() {
  return (
    <View style={styles.wrap}>
      <BackToDashboard />
      <Text style={styles.title} accessibilityRole="header">Account</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xl,
  },
  title: {
    ...type.title,
    color:         neutral.text,
    textTransform: 'uppercase',
  },
});
