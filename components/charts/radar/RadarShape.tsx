import React, { useEffect } from 'react';
import { Circle, Defs, G, Polygon, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { Point } from '../geometry';

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

/**
 * RadarShape
 * -----------
 * One series on the radar: a filled polygon that grows out from the centre,
 * plus a dot on each vertex. Lives in its own component so every series gets
 * its own animation hooks.
 */
interface Props {
  id:     string;
  color:  string;
  cx:     number;
  cy:     number;
  points: Point[];
  /** Stagger between series, ms. */
  delay?: number;
}

export function RadarShape({ id, color, cx, cy, points, delay = 0 }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 900, easing: Easing.out(Easing.back(1.08)) }),
    );
  }, [points, delay, progress]);

  const animatedProps = useAnimatedProps(() => {
    const t = progress.value;
    const pts = points.map(p => `${cx + (p.x - cx) * t},${cy + (p.y - cy) * t}`);
    return { points: pts.join(' ') } as any;
  });

  const gradientId = `radar-fill-${id}`;

  return (
    <G>
      <Defs>
        <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={0.45} />
          <Stop offset="100%" stopColor={color} stopOpacity={0.12} />
        </RadialGradient>
      </Defs>
      <AnimatedPolygon
        animatedProps={animatedProps}
        fill={`url(#${gradientId})`}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r={3} fill={color} />
      ))}
    </G>
  );
}
