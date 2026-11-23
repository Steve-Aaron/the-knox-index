import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { DevLabel } from '@/components/primitives/DevLabel';
import { glass, neutral } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { type } from '@/theme/typography';

/**
 * SegmentedControl
 * -----------------
 * Compact pill of mutually exclusive tabs (e.g. TYPE / SUBJECTS / STYLES).
 * Sized to its content, unlike TimeRangePicker which stretches full width.
 *
 * One job: switch between a few views of the same widget.
 */
export interface Segment<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  segments: Segment<T>[];
  value:    T;
  onChange: (next: T) => void;
}

export function SegmentedControl<T extends string>({ segments, value, onChange }: Props<T>) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      <DevLabel name="SegmentedControl" />
      {segments.map(seg => {
        const active = seg.value === value;
        return (
          <Pressable
            key={seg.value}
            onPress={() => onChange(seg.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{seg.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection:   'row',
    alignSelf:       'flex-start',
    padding:         4,
    gap:             2,
    borderRadius:    radius.pill,
    borderWidth:     1,
    borderColor:     glass.border,
    backgroundColor: glass.fill,
  },
  segment: {
    paddingHorizontal: spacing.base,
    paddingVertical:   6,
    borderRadius:      radius.pill,
    borderWidth:       1,
    borderColor:       'transparent',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  segmentActive: {
    backgroundColor: glass.fillHi,
    borderColor:     glass.borderHi,
  },
  label: {
    ...type.caption,
    fontSize: 11,
    color:    neutral.textMid,
  },
  labelActive: {
    color: neutral.text,
  },
});
