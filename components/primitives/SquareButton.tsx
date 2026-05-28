import React, { useState } from 'react';
import { Pressable, Text, View, StyleSheet, Platform, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { MotiView } from 'moti';
import { knox, neutral, glass } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { font, type } from '@/theme/typography';

/**
 * SquareButton
 * -------------
 * One job: a sharp-cornered button whose fill rises from the bottom on hover.
 *
 * No border-radius. The 'sizzle' is a tinted layer that animates from 0% to
 * 100% height, anchored to the bottom edge — like a tide rolling in. Works
 * on web via Pressable's hover state, falls back to a press-only highlight
 * on native.
 *
 * Variants:
 *   primary — solid knox primaryPink border, fills with primaryPink on hover
 *   ghost   — subtle glass border, fills with primaryPink on hover
 *   live    — primaryOrange border + dot, used for status pills
 */

type Variant = 'primary' | 'ghost' | 'live';

interface Props {
  label:    string;
  onPress?: () => void;
  variant?: Variant;
  /** Optional small leading element — usually a dot or icon. */
  leading?: React.ReactNode;
  /** Optional trailing element. */
  trailing?: React.ReactNode;
  style?:   StyleProp<ViewStyle>;
  /** Stretch to fill the parent container width. */
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, { border: string; fill: string; idleText: string; hoverText: string }> = {
  primary: {
    border:    knox.primaryPink,
    fill:      knox.primaryPink,
    idleText:  neutral.text,
    hoverText: '#fff',
  },
  ghost: {
    border:    glass.borderHi,
    fill:      knox.primaryPink,
    idleText:  neutral.textMid,
    hoverText: '#fff',
  },
  live: {
    border:    knox.primaryOrange,
    fill:      knox.primaryOrange,
    idleText:  knox.primaryOrange,
    hoverText: '#1F1D1D',
  },
};

export function SquareButton({ label, onPress, variant = 'primary', leading, trailing, style, fullWidth }: Props) {
  const [hover, setHover] = useState(false);
  const v = VARIANTS[variant];

  return (
    <Pressable
      onPress={onPress}
      // Pressable supports onHoverIn/Out on RN Web; no-ops on native
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={({ pressed }) => [
        styles.btn,
        { borderColor: v.border },
        fullWidth && styles.btnFull,
        pressed && { opacity: 0.85 },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {/* Tide-fill layer — anchored bottom, animates 0% → 100% height on hover */}
      <MotiView
        from={{ height: '0%' as any }}
        animate={{ height: hover ? '100%' as any : '0%' as any }}
        transition={{ type: 'timing', duration: 240 }}
        style={[styles.fill, { backgroundColor: v.fill }]}
        pointerEvents="none"
      />

      <View style={styles.inner}>
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <Text
          style={[
            styles.label,
            { color: hover ? v.hoverText : v.idleText },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position:    'relative',
    overflow:    'hidden',
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    alignSelf:   'flex-start',
    ...Platform.select({
      web: {
        cursor:             'pointer',
        transitionProperty: 'border-color',
        transitionDuration: '180ms',
      } as any,
      default: {},
    }),
  },
  btnFull: { alignSelf: 'stretch' as any, alignItems: 'center' },

  // Bottom-anchored fill — width:100% + bottom:0 + animated height
  fill: {
    position: 'absolute' as any,
    left:     0,
    right:    0,
    bottom:   0,
    width:    '100%' as any,
  },

  inner: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    // zIndex keeps the label above the fill layer on web (RN sorts by order)
    zIndex: 2,
  },
  leading:  { flexShrink: 0 },
  trailing: { flexShrink: 0 },
  label: {
    fontFamily:    font.bold,
    fontSize:      12,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    ...Platform.select({
      web: {
        transitionProperty: 'color',
        transitionDuration: '180ms',
      } as any,
      default: {},
    }),
  },
});
