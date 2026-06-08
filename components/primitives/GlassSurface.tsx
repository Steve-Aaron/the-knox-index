import React from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { glass, brand } from '@/theme';
import { DevLabel } from '@/components/primitives/DevLabel';

/**
 * GlassSurface
 * -------------
 * Knox-branded container surface. Layers, bottom→top:
 *   1. Knox Product Gradient (#1F1D1D → #35393B)
 *   2. Low-alpha white glass fill
 *   3. Hairline border
 *   4. Optional 6px top accent bar (solid colour or horizontal gradient)
 *   5. Children
 *
 * Props:
 *   topAccent  — solid colour string or array of colours for a gradient bar
 *   flatTop    — true = square top corners, curved bottom only
 *
 * One job: be the single surface primitive.
 */
interface Props {
  children?:  React.ReactNode;
  radius?:    number;
  style?:     ViewStyle;
  intensity?: number;
  /** Solid hex string for a flat bar, or string[] for a horizontal gradient. */
  topAccent?: string | readonly string[];
  /** When true, top corners are square; bottom corners get full radius. */
  flatTop?:   boolean;
}

export function GlassSurface({
  children,
  radius    = 22,
  style,
  intensity = 40,
  topAccent,
  flatTop   = false,
}: Props) {
  const shapeStyle = flatTop
    ? {
        borderTopLeftRadius:     0,
        borderTopRightRadius:    0,
        borderBottomLeftRadius:  radius,
        borderBottomRightRadius: radius,
      }
    : { borderRadius: radius };

  const isGradientAccent = Array.isArray(topAccent) && topAccent.length > 1;

  const inner = (
    <>
      <DevLabel name="GlassSurface" />
      {/* Knox Product Gradient background — 50% opacity so the page surface shows through */}
      <LinearGradient
        colors={brand.productGradient as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
      />

      {/* Glass sheen */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fill }]} />

      {/* Hairline border — same shape as container */}
      <View style={[StyleSheet.absoluteFill, styles.border, shapeStyle]} />

      {/* Content */}
      {children}

      {/* Top accent bar — rendered last so it sits above content */}
      {topAccent && (
        isGradientAccent ? (
          <LinearGradient
            colors={topAccent as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.topBar}
          />
        ) : (
          <View style={[styles.topBar, { backgroundColor: topAccent as string }]} />
        )
      )}
    </>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[shapeStyle, { overflow: 'hidden' }, style]}>
        {inner}
      </View>
    );
  }

  return (
    <BlurView
      intensity={intensity}
      tint="dark"
      style={[shapeStyle, { overflow: 'hidden' }, style]}
    >
      {inner}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  border: {
    borderWidth:  1,
    borderColor:  glass.border,
  },
  topBar: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    height:   6,
  },
});
