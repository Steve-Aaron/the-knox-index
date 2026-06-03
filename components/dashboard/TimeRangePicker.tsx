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
import { neutral, accent } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { type } from '@/theme/typography';
import { spring } from '@/theme/motion';

/**
 * TimeRangePicker
 * ----------------
 * Segmented pill for the five time ranges. The "selected" highlight is a single
 * translated element behind the labels — shared-element feel.
 * month / year / lifetime are locked behind registration.
 * One job: pick a time range.
 */
export type TimeRange = 'yesterday' | 'week' | 'month' | 'year' | 'lifetime';

interface Props {
  value:         TimeRange;
  onChange:      (next: TimeRange) => void;
  isRegistered?: boolean;
  /** Fired when an unregistered user taps a locked range. Parent decides
   *  how to handle (typically: show the registration interstitial). */
  onLockedTap?:  (range: TimeRange) => void;
}

const OPTIONS: { key: TimeRange; label: string }[] = [
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week',      label: 'This week' },
  { key: 'month',     label: 'This month' },
  { key: 'year',      label: 'This year' },
  { key: 'lifetime',  label: 'Lifetime' },
];

const LOCKED_RANGES = new Set<TimeRange>(['month', 'year', 'lifetime']);

export function TimeRangePicker({ value, onChange, isRegistered = false, onLockedTap }: Props) {
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
      <View style={styles.outer}>
      <View style={styles.row}>
        <Animated.View style={[styles.highlight, highlightStyle]}>
          <View style={styles.highlightInner} />
        </Animated.View>
        {OPTIONS.map(opt => {
          const active = opt.key === value;
          const locked = !isRegistered && LOCKED_RANGES.has(opt.key);
          return (
            <Pressable
              key={opt.key}
              onPress={() => {
                if (locked) onLockedTap?.(opt.key);
                else onChange(opt.key);
              }}
              style={[styles.option, locked && styles.optionLocked]}
            >
              <Text style={[styles.label, { color: active ? neutral.text : neutral.textMid }]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
  },
  outer: {
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    position: 'relative',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    padding: 2,
  },
  highlightInner: {
    flex: 1,
    backgroundColor: 'rgba(95,100,189,0.18)',
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
  optionLocked: {
    opacity: 0.4,
  },
  label: {
    ...type.caption,
    fontSize: 12,
  },
});
