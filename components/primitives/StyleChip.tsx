import React from 'react';
import { Pressable, Text, View, StyleSheet, Platform, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { neutral, accent, glass } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { font } from '@/theme/typography';
import { fmtLabel } from '@/lib/format';
import { DevLabel } from '@/components/primitives/DevLabel';

/**
 * StyleChip
 * ----------
 * One job: render a single content-style tag as a pill.
 *
 * Used wherever a post's style needs to surface — post cards, the video
 * modal, banger carousel, politician detail panel. Pressable by default
 * (clicking is harmless when no onPress is supplied), and supports an
 * active state for use as a filter chip.
 */

interface Props {
  label:        string;
  /** Optional tint — defaults to indigo. Pass a party.glow / accent value to colour the chip. */
  tint?:        string;
  /** When true, renders with a stronger fill + border to indicate it is the active filter. */
  active?:      boolean;
  /** When true, renders smaller (used inside dense cards like PostBangerCard). */
  compact?:     boolean;
  onPress?:     PressableProps['onPress'];
  style?:       StyleProp<ViewStyle>;
}

export function StyleChip({ label, tint, active = false, compact = false, onPress, style }: Props) {
  const colour     = tint ?? accent.indigo;
  const isPressable = !!onPress;

  const chipBody = (
    <View
      style={[
        styles.chip,
        compact && styles.chipCompact,
        {
          borderColor:     active ? colour : `${colour}55`,
          backgroundColor: active ? `${colour}33` : `${colour}1a`,
        },
        style,
      ]}
    >
      <DevLabel name="StyleChip" />
      <Text style={[
        styles.text,
        compact && styles.textCompact,
        { color: active ? colour : neutral.text },
      ]}>
        {fmtLabel(label)}
      </Text>
    </View>
  );

  if (!isPressable) {
    return chipBody;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={`Filter by style ${fmtLabel(label)}`}
    >
      {chipBody}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth:       1,
    borderRadius:      radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical:   4,
    ...Platform.select({
      web: {
        transitionProperty: 'border-color, background-color',
        transitionDuration: '160ms',
        cursor:             'pointer',
      } as any,
      default: {},
    }),
  },
  chipCompact: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  text: {
    fontFamily:    font.bold,
    fontSize:      12,
    letterSpacing: 0.4,
  },
  textCompact: {
    fontSize:      11,
    letterSpacing: 0.3,
  },
});
