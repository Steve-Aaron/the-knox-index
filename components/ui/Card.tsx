/**
 * Card
 * -----
 * Canonical dark glassmorphic surface. Replaces 13 per-screen `card: {...}`
 * redefinitions that each set the same background / border / radius / blur.
 *
 * Variants:
 *  - default: glass.fill background, glass.border border, radius.lg
 *  - high:    glass.fillHi background, glass.borderHi border (more emphasis)
 *  - inner:   glass.card background — for inner content panels sitting on
 *             the Knox Product Gradient
 *
 * Usage:
 *   <Card><Text>...</Text></Card>
 *   <Card variant='high' padded><Form /></Card>
 *   <Card style={{ marginTop: spacing.lg }}>...</Card>
 *
 * Notes:
 *  - Web-only `backdropFilter` blur is applied automatically via Platform.select.
 *  - Pass `padded` to add base spacing inside; omit for tighter compositions.
 */
import React from 'react';
import { Platform, StyleSheet, View, type ViewStyle, type ViewProps } from 'react-native';

import { glass } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';

type CardVariant = 'default' | 'high' | 'inner';

type CardProps = Omit<ViewProps, 'children' | 'style'> & {
  children: React.ReactNode;
  variant?: CardVariant;
  /** Add base padding inside the card. */
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
};

const baseBlur = Platform.select<ViewStyle>({
  web: ({
    backdropFilter:       'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  } as unknown) as ViewStyle,
  default: {},
});

const styles = StyleSheet.create({
  base: {
    borderWidth:  1,
    borderRadius: radius.lg,
    overflow:     'hidden',
    ...baseBlur,
  },
  default: {
    backgroundColor: glass.fill,
    borderColor:     glass.border,
  },
  high: {
    backgroundColor: glass.fillHi,
    borderColor:     glass.borderHi,
  },
  inner: {
    backgroundColor: glass.card,
    borderColor:     glass.border,
  },
  padded: {
    padding: spacing.lg,
  },
});

export function Card({ children, variant = 'default', padded = false, style, ...rest }: CardProps) {
  const variantStyle =
    variant === 'high'  ? styles.high  :
    variant === 'inner' ? styles.inner :
                          styles.default;
  return (
    <View {...rest} style={[styles.base, variantStyle, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

export default Card;
