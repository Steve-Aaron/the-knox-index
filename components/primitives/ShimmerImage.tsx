import React, { useState } from 'react';
import { View, Image, StyleSheet, ImageStyle, ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { DevLabel } from '@/components/primitives/DevLabel';

/**
 * ShimmerImage
 * -------------
 * Drop-in replacement for Image that shows a pulsing shimmer while the
 * remote image is loading, then fades in the image on load.
 * One job: handle the blank-gap problem for remote covers.
 */
interface Props {
  uri?:          string;
  style?:        ImageStyle;
  wrapStyle?:    ViewStyle;
  resizeMode?:   'cover' | 'contain' | 'stretch' | 'center';
  accentColour?: string;   // tints the shimmer sweep
  fallback?:     React.ReactNode;
}

export function ShimmerImage({
  uri,
  style,
  wrapStyle,
  resizeMode = 'cover',
  accentColour = '#7C83FF',
  fallback,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const showShimmer = !loaded && !errored && !!uri;
  const showFallback = errored || !uri;

  return (
    <View style={[styles.wrap, wrapStyle]}>
      <DevLabel name="ShimmerImage" />
      {/* Shimmer skeleton */}
      {showShimmer && (
        <View style={[StyleSheet.absoluteFill, styles.shimmerBase]}>
          {/* Pulsing base */}
          <MotiView
            style={StyleSheet.absoluteFill}
            from={{ opacity: 0.3 }}
            animate={{ opacity: 0.7 }}
            transition={{
              type: 'timing',
              duration: 900,
              easing: Easing.inOut(Easing.ease),
              loop: true,
              repeatReverse: true,
            }}
          >
            <LinearGradient
              colors={['#1a1a2e', accentColour + '22', '#1a1a2e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </MotiView>

          {/* Sweep highlight — slides across */}
          <MotiView
            style={[styles.sweep]}
            from={{ translateX: -200 }}
            animate={{ translateX: 300 }}
            transition={{
              type: 'timing',
              duration: 1200,
              easing: Easing.inOut(Easing.ease),
              loop: true,
              delay: 200,
            }}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.07)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.sweepGrad}
            />
          </MotiView>
        </View>
      )}

      {/* Actual image */}
      {uri && !errored && (
        <MotiView
          style={StyleSheet.absoluteFill}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ type: 'timing', duration: 280 }}
        >
          <Image
            source={{ uri }}
            style={[styles.image, style]}
            resizeMode={resizeMode}
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
          />
        </MotiView>
      )}

      {/* Fallback slot (error or no URI) */}
      {showFallback && fallback ? (
        <View style={StyleSheet.absoluteFill}>{fallback}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  shimmerBase: {
    backgroundColor: '#1a1a2e',
    overflow: 'hidden',
  },
  sweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
  },
  sweepGrad: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
