/**
 * Kicker
 * -------
 * Single source of truth for the uppercase eyebrow label sitting above
 * section headings ('THE KNOX INDEX', 'LEGAL', 'YOUR ACCOUNT', etc.).
 *
 * Replaces every per-screen `styles.kicker` definition. If the brand needs
 * to change letter-spacing, colour or weight, do it here once.
 *
 * Usage:
 *   <Kicker>The Knox Index</Kicker>
 *   <Kicker tone='dim'>Legal</Kicker>
 *   <Kicker style={{ marginBottom: spacing.sm }}>Section</Kicker>
 */
import React from 'react';
import { StyleSheet, Text, type TextStyle, type TextProps } from 'react-native';

import { accent, neutral } from '../../theme/colors';
import { type as typeTokens } from '../../theme/typography';

type KickerTone = 'accent' | 'dim';

type KickerProps = Omit<TextProps, 'children'> & {
  children: React.ReactNode;
  /**
   * Visual tone.
   *  - accent: brand accent colour (default — used for product surfaces)
   *  - dim:    secondary text colour (used on cards / muted contexts)
   */
  tone?: KickerTone;
  /** Override or extend the canonical style. */
  style?: TextStyle | TextStyle[];
};

/**
 * Canonical Kicker style. Pulled from `type.caption` (Figtree / semibold /
 * 12px / 0.8 letter-spacing / uppercase) so it stays in lockstep with the
 * design-system caption role. Colour is the only per-tone override.
 */
const baseStyle: TextStyle = {
  ...typeTokens.caption,
  textTransform: 'uppercase',
};

const styles = StyleSheet.create({
  base:   baseStyle,
  accent: { color: accent.indigo },
  dim:    { color: neutral.textDim },
});

export function Kicker({ children, tone = 'accent', style, ...rest }: KickerProps) {
  const toneStyle = tone === 'dim' ? styles.dim : styles.accent;
  return (
    <Text {...rest} style={[styles.base, toneStyle, style]}>
      {children}
    </Text>
  );
}

export default Kicker;
