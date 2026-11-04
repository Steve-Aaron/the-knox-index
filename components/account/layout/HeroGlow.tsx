import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { accent } from '@/theme/colors';

/**
 * HeroGlow
 * ---------
 * Soft indigo glow behind the range picker and KPI figures, from the Figma
 * hero (1379×852 radial, centre at 50% / 55%). Sits behind the main column,
 * reaching up past it and left over the sidebar's edge; the right edge lines
 * up with the column, so it scales with the column's width.
 *
 * One job: paint the hero background glow.
 */
export function HeroGlow() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="account-hero-glow" cx="50%" cy="55%" r="55%">
            <Stop offset="0" stopColor={accent.indigo} stopOpacity={0.22} />
            <Stop offset="0.6" stopColor={accent.indigo} stopOpacity={0.05} />
            <Stop offset="1" stopColor={accent.indigo} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#account-hero-glow)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // Offsets from the Figma frame: the glow starts 186px left of and 221px
  // above the main column.
  wrap: {
    position: 'absolute',
    top:      -221,
    left:     -186,
    right:    0,
    height:   852,
  },
});
