import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { neutral } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';

/**
 * RadarLegend
 * ------------
 * Coloured dot + label per series ('● TikTok  ● X').
 *
 * One job: name the radar series.
 */
export interface LegendItem {
  id:    string;
  label: string;
  color: string;
}

export function RadarLegend({ items }: { items: LegendItem[] }) {
  return (
    <View style={styles.row}>
      {items.map(item => (
        <View key={item.id} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap:           spacing.base,
  },
  item: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  dot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  label: {
    ...type.body,
    fontSize: 12,
    color:    neutral.text,
  },
});
