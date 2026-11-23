import React from 'react';
import { Circle, G, Line } from 'react-native-svg';
import { neutral } from '@/theme/colors';
import type { Point } from '../geometry';

/**
 * RadarGrid
 * ----------
 * Concentric rings + spokes behind the radar polygons. Pure SVG, no state.
 */
interface Props {
  cx:      number;
  cy:      number;
  rings:   number[];
  spokes:  Point[];
}

export function RadarGrid({ cx, cy, rings, spokes }: Props) {
  return (
    <G>
      {rings.map((r, i) => (
        <Circle
          key={`ring-${i}`}
          cx={cx}
          cy={cy}
          r={r}
          stroke={neutral.stroke}
          strokeOpacity={0.55}
          strokeWidth={1}
          fill="none"
        />
      ))}
      {spokes.map((p, i) => (
        <Line
          key={`spoke-${i}`}
          x1={cx}
          y1={cy}
          x2={p.x}
          y2={p.y}
          stroke={neutral.stroke}
          strokeOpacity={0.45}
          strokeWidth={1}
        />
      ))}
    </G>
  );
}
