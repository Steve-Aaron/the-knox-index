import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { neutral, glass, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';

/**
 * QuoteCard
 * ----------
 * A single testimonial card. Composed inside QuoteContainer.
 *
 * Usage:
 *   <QuoteCard
 *     quote="This has become my secret weapon in monday morning meetings."
 *     jobType="Senior Digital Manager, PR Agency"
 *   />
 *
 * Props:
 *   quote   — the testimonial text
 *   jobType — reader's role type and sector, shown as a pill badge
 */

export interface QuoteCardProps {
  quote:   string;
  jobType: string;
}

export function QuoteCard({ quote, jobType }: QuoteCardProps) {
  return (
    <Card padded style={{ flex: 1, minWidth: '28%' as any, padding: spacing.xl, gap: spacing.md } as any}>
      {/* Quote mark */}
      <Text style={styles.quoteMark}>&ldquo;</Text>

      {/* Quote body */}
      <Text style={styles.quoteText}>{quote}</Text>

      {/* Job type pill */}
      <View style={styles.pill}>
        <Text style={styles.pillText}>{jobType}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  quoteMark: {
    fontFamily: font.bold,
    fontSize:   48,
    lineHeight: 40,
    color:      accent.indigo,
    opacity:    0.6,
  },

  quoteText: {
    fontFamily: font.ui,
    fontSize:   16,
    lineHeight: 24,
    color:      neutral.text,
    flex:       1,
  },

  pill: {
    alignSelf:       'flex-start',
    backgroundColor: 'rgba(124, 131, 255, 0.12)',
    borderWidth:     1,
    borderColor:     'rgba(124, 131, 255, 0.25)',
    borderRadius:    radius.full ?? 999,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    marginTop:       spacing.sm,
  },

  pillText: {
    fontFamily: font.ui,
    fontSize:   12,
    color:      accent.indigo,
    lineHeight: 18,
  },
});
