import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { LOGOS } from '@/assets/logos';
import { spacing } from '@/theme/spacing';

/**
 * LogoScroller
 * -------------
 * Infinite-scrolling marquee of endorsement logos.
 * Driven entirely by assets/logos/index.ts — add or remove entries there.
 *
 * Logos are rendered greyscale + reduced opacity so they sit quietly
 * in the dark theme without any one logo demanding attention.
 *
 * On web:  GPU-composited CSS transform via Animated (useNativeDriver: true).
 * Native:  same Animated.loop approach.
 */

/** Height of each logo in the strip */
const LOGO_HEIGHT = 28;
/** Fixed width slot per logo — adjust if logos are very wide or narrow */
const LOGO_SLOT_WIDTH = 140;
/** Gap between logo slots */
const LOGO_GAP = spacing.xxxl;
/** Total width of one full set of logos */
const TRACK_WIDTH = (LOGO_SLOT_WIDTH + LOGO_GAP) * LOGOS.length;
/** Scroll duration in ms — higher = slower */
const SCROLL_DURATION_MS = 28000;

export function LogoScroller() {
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue:         -TRACK_WIDTH,
        duration:        SCROLL_DURATION_MS,
        easing:          Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // Render logos twice side-by-side for a seamless loop
  const doubled = [...LOGOS, ...LOGOS];

  return (
    <View style={styles.viewport}>
      {/* Left edge fade */}
      <View style={[styles.fade, styles.fadeLeft]} pointerEvents="none" />

      <Animated.View
        style={[styles.track, { transform: [{ translateX }] }]}
      >
        {doubled.map((logo, i) => (
          <View key={`${logo.name}-${i}`} style={styles.logoSlot}>
            <Image
              source={logo.source}
              accessibilityLabel={logo.name}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        ))}
      </Animated.View>

      {/* Right edge fade */}
      <View style={[styles.fade, styles.fadeRight]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    width:    '100%',
    height:   LOGO_HEIGHT + spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },

  track: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           LOGO_GAP,
    position:      'absolute',
    top:           0,
    left:          0,
    height:        '100%',
  },

  logoSlot: {
    width:          LOGO_SLOT_WIDTH,
    alignItems:     'center',
    justifyContent: 'center',
  },

  logoImage: {
    width:    LOGO_SLOT_WIDTH,
    height:   LOGO_HEIGHT,
    // Logos are already white on transparent — dim slightly so they sit quietly
    // on the dark background without demanding attention.
    ...Platform.select({
      web: {
        opacity:   0.55,
        objectFit: 'contain',
      } as any,
      default: {
        opacity: 0.55,
      },
    }),
  },

  fade: {
    position:      'absolute',
    top:           0,
    bottom:        0,
    width:         '10%',
    zIndex:        1,
  },

  fadeLeft: {
    left: 0,
    ...Platform.select({
      web: { background: 'linear-gradient(to right, #1F1D1D 0%, transparent 100%)' } as any,
      default: {},
    }),
  },

  fadeRight: {
    right: 0,
    ...Platform.select({
      web: { background: 'linear-gradient(to left, #1F1D1D 0%, transparent 100%)' } as any,
      default: {},
    }),
  },
});
