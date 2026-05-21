import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { neutral, accent } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font } from '@/theme/typography';

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
      <Text style={styles.kicker}>REVIEWS</Text>
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

  kicker: {
    fontFamily:    font.bold,
    fontSize:      11,
    letterSpacing: 3,
    color:         accent.indigo,
    textTransform: 'uppercase',
    textAlign:     'center',
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
