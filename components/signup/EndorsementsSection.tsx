import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { neutral, glass } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { LogoScroller } from './LogoScroller';

/**
 * EndorsementsSection
 * --------------------
 * "Read by professionals working at" heading + animated logo scroller.
 * Logos are driven by assets/logos/index.ts — add files there, they appear here.
 */

export function EndorsementsSection() {
  return (
    <View style={styles.section}>
      {/* Top border */}
      <View style={styles.divider} />

      <Text style={styles.label}>READ BY PROFESSIONALS WORKING AT</Text>

      <LogoScroller />

      {/* Bottom border */}
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width:             '100%',
    paddingVertical:   spacing.xxl,
    paddingHorizontal: '5%',
    gap:               spacing.xl,
    alignItems:        'center',
  },

  divider: {
    width:           '100%',
    height:          1,
    backgroundColor: glass.border,
  },

  label: {
    fontFamily:    font.bold,
    fontSize:      11,
    letterSpacing: 3,
    color:         neutral.textMid,
    textTransform: 'uppercase',
    textAlign:     'center',
  },
});
