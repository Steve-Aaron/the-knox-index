import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Svg, { G, Path, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { DevLabel } from '@/components/primitives/DevLabel';
import { UK_MAP_PATHS, UK_MAP_VIEWBOX, UK_MAP_TRANSFORM } from '@/lib/uk-map-paths';
import { knox, accent } from '@/theme/colors';

/**
 * UkMapSvg
 * ---------
 * Pure presentational SVG of the UK silhouette. Knows nothing about markers
 * or animations — they sit absolutely positioned on top in the parent View.
 *
 * Colour treatment: faint indigo glow behind, semi-translucent indigo fill,
 * pink stroke — matches the brand gradient and the rest of the hero.
 *
 * One job: render the country shape.
 */

interface Props {
  /** Override colours if a different surface needs the map. */
  fillColor?:   string;
  strokeColor?: string;
  glowColor?:   string;
}

export function UkMapSvg({
  fillColor   = 'rgba(124, 131, 255, 0.18)',   // accent.indigo @ 18%
  strokeColor = '#F4F5FF',
  glowColor   = accent.indigo,
}: Props) {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <DevLabel name="UkMapSvg" />
      <Svg
        viewBox={UK_MAP_VIEWBOX}
        style={StyleSheet.absoluteFill}
        preserveAspectRatio="xMidYMid meet"
      >
        <Defs>
          <RadialGradient id="ukGlow" cx="0.5" cy="0.55" r="0.55">
            <Stop offset="0%"   stopColor={glowColor} stopOpacity="0.22" />
            <Stop offset="60%"  stopColor={glowColor} stopOpacity="0.05" />
            <Stop offset="100%" stopColor={glowColor} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Glow halo behind the country */}
        <Rect x="0" y="0" width="1024" height="1024" fill="url(#ukGlow)" />

        {/* All paths share the potrace transform so they line up. */}
        <G transform={UK_MAP_TRANSFORM}>
          {UK_MAP_PATHS.map((d, i) => (
            <Path
              key={i}
              d={d}
              fill={fillColor}
              stroke={strokeColor}
              strokeOpacity={0.5}
              strokeWidth={5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    ...Platform.select({
      web: {
        filter: 'drop-shadow(0 0 24px rgba(124,131,255,0.18))',
      } as any,
      default: {},
    }),
  },
});
