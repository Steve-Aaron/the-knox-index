import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { neutral, accent } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { breakpoints } from '@/theme/breakpoints';
import { DevLabel } from '@/components/primitives/DevLabel';
import { Kicker } from '@/components/ui/Kicker';

/**
 * HeroText
 * ---------
 * Renders the hero headline block: kicker, heading (with accent highlight),
 * and body copy. Responsive font sizes — larger on desktop.
 *
 * Edit the copy constants below to update messaging without touching structure.
 */

const COPY = {
  // Daily cadence is paused for now — weekly is the default. Old daily copy:
  //   kicker: 'INSIGHTS SENT 8:00AM EVERY DAY',
  //   line1:  'Your daily intelligence on',
  kicker:    'INSIGHTS SENT EVERY WEEK',
  line1:     'Your weekly intelligence on',
  highlight: 'UK politicians',
  line2:     'on TikTok — free.',
  body:      'Get TikTok insights in your inbox that you won\'t get anywhere else.',
};

export function HeroText() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= breakpoints.desktop;

  return (
    <View style={styles.wrap}>
      <DevLabel name="HeroText" />
      <Kicker style={{ fontSize: 11, letterSpacing: 3 }}>{COPY.kicker}</Kicker>

      <Text style={[styles.heading, isDesktop && styles.headingLg]}>
        {COPY.line1}
        {'\n'}
        <Text style={styles.headingHighlight}>{COPY.highlight}</Text>
        {'\n'}
        {COPY.line2}
      </Text>

      <Text style={styles.body}>{COPY.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.lg,
  },

  heading: {
    fontFamily:    font.bold,
    fontSize:      36,           // mobile default
    lineHeight:    42,
    color:         neutral.text,
    letterSpacing: -0.8,
  },

  headingLg: {
    fontSize:   52,              // desktop
    lineHeight: 60,
  },

  headingHighlight: {
    color:           accent.indigo,
    backgroundColor: 'rgba(124, 131, 255, 0.14)',
    borderRadius:    4,
    // Note: borderRadius on inline Text only clips on web.
    // On native it has no effect, but the colour still stands out.
  },

  body: {
    fontFamily: font.ui,
    fontSize:   16,
    lineHeight: 26,
    color:      neutral.textMid,
    maxWidth:   520,
  },
});
