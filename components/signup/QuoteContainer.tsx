import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing } from '@/theme/spacing';

/**
 * QuoteContainer
 * ---------------
 * Wraps any number of <QuoteCard /> components into a responsive row
 * that wraps naturally. Cards stretch to fill available space.
 *
 * Usage:
 *   <QuoteContainer>
 *     <QuoteCard ... />
 *     <QuoteCard ... />
 *     <QuoteCard ... />
 *   </QuoteContainer>
 *
 * To add a 4th, 5th, or 6th card: just add another <QuoteCard />.
 * The grid reflows automatically — no config needed.
 */

interface QuoteContainerProps {
  children: React.ReactNode;
}

export function QuoteContainer({ children }: QuoteContainerProps) {
  return (
    <View style={styles.container}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.base,
    width:         '100%',
  },
});
