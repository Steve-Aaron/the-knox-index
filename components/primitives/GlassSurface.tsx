import React from 'react';
import { View, StyleSheet, Platform, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { glass, neutral } from '@/theme';

/**
 * GlassSurface
 * -------------
 * A single-purpose glass panel. It is the only place in the app that knows
 * how to render a frosted dark card — everything else composes on top.
 * Layers, bottom→top:
 *   1. BlurView (native) or saturated dark background (web fallback)
 *   2. Dark-ink linear gradient for depth
 *   3. Low-alpha white fill for the "glass" read
 *   4. Hairline border
 */
interface Props {
  children?: React.ReactNode;
  radius?: number;
  style?: ViewStyle;
  intensity?: number; // blur intensity (native only)
}

export function GlassSurface({ children, radius = 22, style, intensity = 40 }: Props) {
  const inner = (
    <>
      <LinearGradient
        colors={[neutral.ink, neutral.night]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fill }]} />
      <View style={[StyleSheet.absoluteFill, styles.border, { borderRadius: radius }]} />
      {children}
    </>
  );

  // BlurView on web is unreliable and can wash out content; we skip it there.
  if (Platform.OS === 'web') {
    return (
      <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
        {inner}
      </View>
    );
  }

  return (
    <BlurView
      intensity={intensity}
      tint="dark"
      style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
    >
      {inner}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  border: {
    borderWidth: 1,
    borderColor: glass.border,
  },
});
