import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { InfoTip } from '@/components/primitives/InfoTip';
import { accent, glass, neutral } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';

/**
 * ChipGroup
 * ----------
 * Single-select row of pill chips with an optional leading label and helper,
 * e.g. 'PLATFORM  [All] [TikTok] [X]' or 'MIN VIEWS  [Any] [1K+] …'.
 * Visual language matches the PostsTable sort / threshold chips.
 *
 * One job: pick one value from a short list.
 */
export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  options:   ChipOption<T>[];
  value:     T;
  onChange:  (next: T) => void;
  label?:    string;
  infoText?: string;
  /** Scroll horizontally instead of wrapping (long lists on mobile). */
  scroll?:   boolean;
}

export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  label,
  infoText,
  scroll = false,
}: Props<T>) {
  const chips = options.map(opt => {
    const active = opt.value === value;
    return (
      <Pressable
        key={String(opt.value)}
        onPress={() => onChange(opt.value)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        style={({ pressed }) => [
          styles.chip,
          active && styles.chipActive,
          pressed && styles.chipPressed,
        ]}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
      </Pressable>
    );
  });

  return (
    <View style={styles.row}>
      <DevLabel name="ChipGroup" />
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {infoText ? <InfoTip text={infoText} /> : null}
        </View>
      ) : null}
      {scroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {chips}
        </ScrollView>
      ) : (
        <View style={[styles.chips, styles.chipsWrap]}>{chips}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    gap:           spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  label: {
    ...type.caption,
    color:    neutral.textDim,
    fontSize: 12,
  },
  chips: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  chipsWrap: {
    flexWrap: 'wrap',
  },
  chip: {
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       glass.border,
    backgroundColor:   glass.fill,
    paddingHorizontal: spacing.md,
    paddingVertical:   5,
    ...Platform.select({
      web: {
        cursor:             'pointer',
        transitionProperty: 'border-color, background-color',
        transitionDuration: '160ms',
      } as any,
      default: {},
    }),
  },
  chipActive: {
    borderColor:     accent.indigo,
    backgroundColor: 'rgba(95,100,189,0.12)',
  },
  chipPressed: {
    opacity: 0.75,
  },
  chipText: {
    ...type.caption,
    color:    neutral.textMid,
    fontSize: 12,
  },
  chipTextActive: {
    color: accent.indigo,
  },
});
