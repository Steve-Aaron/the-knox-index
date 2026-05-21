import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { spacing } from '@/theme/spacing';
import { breakpoints } from '@/theme/breakpoints';
import { HeroLeft } from './HeroLeft';
import { HeroRight } from './HeroRight';

/**
 * HeroSection
 * ------------
 * Responsive two-column hero. On desktop: HeroLeft and HeroRight
 * sit side by side (50/50). On tablet and below they stack vertically,
 * with HeroRight hidden on mobile to keep things clean.
 *
 * Column sizing uses flex rather than fixed pixels so it adapts
 * fluidly to any viewport width.
 */

export function HeroSection() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= breakpoints.desktop;
  const isTablet  = width >= breakpoints.tablet;

  return (
    <View style={[
      styles.section,
      isDesktop ? styles.sectionRow : styles.sectionCol,
    ]}>
      {/* Left: HeroText + NewsletterForm */}
      <View style={[styles.col, isDesktop && styles.colLeft]}>
        <HeroLeft />
      </View>

      {/* Right: phone mockup — hidden on mobile, shown from tablet up */}
      {isTablet && (
        <View style={[styles.col, isDesktop && styles.colRight]}>
          <HeroRight />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width:             '100%',
    paddingHorizontal: '5%',
    paddingVertical:   spacing.xxxl,
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           '4%',
  },

  sectionCol: {
    flexDirection: 'column',
    gap:           spacing.xxl,
  },

  col: {
    flex: 1,
  },

  colLeft: {
    flex: 1,        // equal split — change to flex: 1.2 to give left more space
  },

  colRight: {
    flex: 1,
  },
});
