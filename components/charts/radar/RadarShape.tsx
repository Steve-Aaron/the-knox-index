import React from 'react';
import { Circle, Defs, G, Polygon, RadialGradient, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import type { Point } from '../geometry';
import { useEntryProgress } from '../useEntryProgress';

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
const AnimatedCircle  = Animated.createAnimatedComponent(Circle);

/**
 * RadarShape
 * -----------
 * One series on the radar: a filled polygon that grows out from the centre,
 * plus a dot on each vertex riding along with it. Lives in its own component
 * so every series gets its own animation hooks. Draws only: hover and press
 * are handled once for all series by RadarChart, so a shape drawn on top
 * never blocks the dots of the one below.
 */
interface Props {
  id:     string;
  color:  string;
  cx:     number;
  cy:     number;
  points: Point[];
  /** Changes when the data does; replays the grow-out. Resizing doesn't. */
  replayKey: string;
  /** Stagger between series, ms. */
  delay?: number;
  /** Grow out once true (the chart is in view); held at the centre before. */
  play?:  boolean;
  /** Highlight colour for an enlarged dot. Defaults to `color`. */
  glow?:  string;
  /** Vertex index drawn enlarged (hovered or open), if any. */
  activeIdx?: number | null;
}

const GROW = { duration: 900, easing: Easing.out(Easing.back(1.08)) };

export function RadarShape({
  id, color, cx, cy, points, replayKey, delay = 0, play = true, glow = color, activeIdx = null,
}: Props) {
  const progress = useEntryProgress(play, replayKey, { ...GROW, delay });

  const animatedProps = useAnimatedProps(() => {
    const t = progress.value;
    const pts = points.map(p => `${cx + (p.x - cx) * t},${cy + (p.y - cy) * t}`);
    return { points: pts.join(' ') } as any;
  });

  const gradientId = `radar-fill-${id}`;

  return (
    <G pointerEvents="none">
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
      {points.map((p, i) => {
        const isActive = activeIdx === i;
        return (
          <RadarDot
            key={`dot-${i}`}
            point={p}
            cx={cx}
            cy={cy}
            progress={progress}
            r={isActive ? 6 : 3}
            fill={isActive ? glow : color}
            stroke={isActive ? '#fff' : 'none'}
            strokeWidth={isActive ? 1.5 : 0}
          />
        );
      })}
    </G>
  );
}

/** A vertex dot that rides along with the polygon as it grows. */
function RadarDot({ point, cx, cy, progress, ...circle }: {
  point:       Point;
  cx:          number;
  cy:          number;
  progress:    SharedValue<number>;
  r:           number;
  fill:        string;
  stroke:      string;
  strokeWidth: number;
}) {
  const animatedProps = useAnimatedProps(() => ({
    cx: cx + (point.x - cx) * progress.value,
    cy: cy + (point.y - cy) * progress.value,
  }));
  return <AnimatedCircle animatedProps={animatedProps} {...circle} />;
}
