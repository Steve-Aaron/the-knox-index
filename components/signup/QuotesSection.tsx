import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { neutral, accent } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { Kicker } from '@/components/ui/Kicker';

/**
 * QuotesSection
 * --------------
 * Section wrapper with kicker label and heading above a QuoteContainer.
 *
 * Usage:
 *   <QuotesSection>
 *     <QuoteCard ... />
 *     <QuoteCard ... />
 *   </QuotesSection>
 */

interface QuotesSectionProps {
  children: React.ReactNode;
}

export function QuotesSection({ children }: QuotesSectionProps) {
  return (
    <View style={styles.section}>
      <Kicker style={{ fontSize: 11, letterSpacing: 3, textAlign: 'center' }}>REVIEWS</Kicker>
      <Text style={styles.heading}>What professionals are saying</Text>
      <View style={styles.cardsWrapper}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width:             '100%',
    paddingVertical:   spacing.xxxl,
    paddingHorizontal: '5%',
    gap:               spacing.xl,
  },

  heading: {
    fontFamily:    font.bold,
    fontSize:      32,
    color:         neutral.text,
    textAlign:     'center',
    letterSpacing: -0.5,
  },

  cardsWrapper: {
    width:         '100%',
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.base,
  },
});
