import React, { useMemo } from 'react';
import { StyleSheet, Platform, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { DevLabel } from '@/components/primitives/DevLabel';
import { buildLandPath, buildGraticulePath, type GlobeView } from '@/lib/globe';
import { WORLD_RINGS } from '@/lib/world-geometry';
import { accent, knox } from '@/theme/colors';

/**
 * GlobeSvg
 * ---------
 * Pure presentational globe: ocean disc, graticule, landmasses, rim light.
 * Knows nothing about gestures or markers — the parent owns rotation and
 * positions pins on top in the same coordinate space.
 *
 * Land is ONE Path holding every coastline as a subpath. A spinning globe
 * re-renders on each frame, and 258 separate elements per frame is the
 * difference between smooth and stuttering.
 *
 * One job: draw the sphere for a given view.
 */

interface Props {
  view:   GlobeView;
  width:  number;
  height: number;
}

export function GlobeSvg({ view, width, height }: Props) {
  const land      = useMemo(() => buildLandPath(view, WORLD_RINGS), [view]);
  const graticule = useMemo(() => buildGraticulePath(view), [view]);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <DevLabel name="GlobeSvg" />
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Ocean: lit from the upper left, falling into shadow at the limb. */}
          <RadialGradient id="globeOcean" cx="0.38" cy="0.32" r="0.78">
            <Stop offset="0%"   stopColor="#35393B" stopOpacity="0.95" />
            <Stop offset="55%"  stopColor="#23262B" stopOpacity="0.92" />
            <Stop offset="100%" stopColor="#141517" stopOpacity="0.96" />
          </RadialGradient>
          {/* Atmosphere bloom just outside the disc. */}
          <RadialGradient id="globeAtmosphere" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="82%"  stopColor={accent.indigo} stopOpacity="0" />
            <Stop offset="96%"  stopColor={accent.indigo} stopOpacity="0.22" />
            <Stop offset="100%" stopColor={accent.indigo} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Circle cx={view.cx} cy={view.cy} r={view.radius * 1.14} fill="url(#globeAtmosphere)" />
        <Circle cx={view.cx} cy={view.cy} r={view.radius} fill="url(#globeOcean)" />

        <Path d={graticule} stroke="#F4F5FF" strokeOpacity={0.09} strokeWidth={0.6} fill="none" />

        <Path
          d={land}
          fill="rgba(124, 131, 255, 0.20)"
          stroke="#F4F5FF"
          strokeOpacity={0.45}
          strokeWidth={0.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Rim light — reads as the edge of a sphere rather than a flat disc. */}
        <Circle
          cx={view.cx}
          cy={view.cy}
          r={view.radius}
          fill="none"
          stroke={knox.primaryPink}
          strokeOpacity={0.35}
          strokeWidth={1}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    ...Platform.select({
      web: { filter: 'drop-shadow(0 0 30px rgba(124,131,255,0.20))' } as any,
      default: {},
    }),
  },
});
