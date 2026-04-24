import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { GlassSurface } from '@/components/primitives/GlassSurface';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral, accent, glass } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type } from '@/theme/typography';
import { spring } from '@/theme/motion';

/**
 * TimeRangePicker
 * ----------------
 * Segmented pill for the four Top Trump time ranges. The "selected" highlight
 * is a single translated element behind the labels — shared-element feel.
 * One job: pick a time range.
 */
export type TimeRange = 'yesterday' | 'week' | 'month' | 'year' | 'lifetime';

interface Props {
  value: TimeRange;
  onChange: (next: TimeRange) => void;
}

const OPTIONS: { key: TimeRange; label: string }[] = [
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week',      label: 'This week' },
  { key: 'month',     label: 'This month' },
  { key: 'year',      label: 'This year' },
  { key: 'lifetime',  label: 'Lifetime' },
];

export function TimeRangePicker({ value, onChange }: Props) {
  const index = OPTIONS.findIndex(o => o.key === value);
  const xPct = useSharedValue(index);

  useEffect(() => {
    xPct.value = withSpring(index, spring.snappy);
  }, [index, xPct]);

  const highlightStyle = useAnimatedStyle(() => ({
    left: `${(xPct.value / OPTIONS.length) * 100}%`,
    width: `${100 / OPTIONS.length}%`,
  } as any));

  return (
    <GlassSurface style={styles.wrap} radius={radius.pill}>
      <DevLabel name="TimeRangePicker" />
      <View style={styles.row}>
        <Animated.View style={[styles.highlight, highlightStyle]}>
          <View style={styles.highlightInner} />
        </Animated.View>
        {OPTIONS.map(opt => {
          const active = opt.key === value;
          return (
            <Pressable
              key={opt.key}
              onPress={() => onChange(opt.key)}
              style={styles.option}
            >
              <Text
                style={[
                  styles.label,
                  { color: active ? neutral.text : neutral.textMid },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: 4,
    position: 'relative',
  },
  highlight: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    padding: 2,
  },
  highlightInner: {
    flex: 1,
    backgroundColor: 'rgba(124,131,255,0.18)',
    borderWidth: 1,
    borderColor: accent.indigo,
    borderRadius: radius.pill,
    ...Platform.select({
      web: { boxShadow: `0 0 12px ${accent.indigo}73` } as any,
      default: {
        shadowColor: accent.indigo,
        shadowOpacity: 0.45,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
      },
    }),
  },
  option: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  label: {
    ...type.caption,
    fontSize: 11,
  },
});
