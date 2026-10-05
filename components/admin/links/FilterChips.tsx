import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, knox } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

/**
 * FilterChips
 * ------------
 * A single row of mutually exclusive filters. Generic over the value so the
 * platform, status and confidence filters are all this one component rather
 * than three near-identical ones.
 *
 * One job: pick one of a set, or none.
 */

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface Props<T extends string> {
  label:    string;
  options:  ReadonlyArray<ChipOption<T>>;
  value:    T | null;
  onChange: (value: T | null) => void;
  /** Label for the 'no filter' chip. Omit to hide it. */
  allLabel?: string;
}

export function FilterChips<T extends string>({ label, options, value, onChange, allLabel = 'All' }: Props<T>) {
  const chips: Array<ChipOption<T> | null> = allLabel ? [null, ...options] : [...options];

  return (
    <View style={styles.row}>
      <DevLabel name="FilterChips" />
      <Text style={styles.label}>{label}</Text>
      {chips.map(opt => {
        const selected = (opt?.value ?? null) === value;
        return (
          <Pressable
            key={opt?.value ?? '__all'}
            onPress={() => onChange(opt?.value ?? null)}
            style={[styles.chip, selected && styles.chipOn]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextOn]}>
              {opt ? opt.label : allLabel}
              {opt?.count !== undefined ? ` ${opt.count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  label:      { color: neutral.textMid, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginRight: spacing.xs },
  chip:       { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: neutral.stroke },
  chipOn:     { borderColor: knox.primaryOrange, backgroundColor: 'rgba(255, 147, 99, 0.12)' },
  chipText:   { color: neutral.textMid, fontSize: 12 },
  chipTextOn: { color: neutral.text, fontWeight: '600' },
});
