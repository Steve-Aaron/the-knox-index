import React from 'react';
import Svg, { Path } from 'react-native-svg';

/**
 * TrendIcon
 * ----------
 * Zig-zag trend arrow, up or down, drawn on a 24×24 grid. Source artwork
 * lives in assets/icons/; paths are inlined so the colour can be set per use.
 *
 * One job: draw a trend direction.
 */
interface Props {
  direction: 'up' | 'down';
  color:     string;
  size?:     number;
}

const PATHS: Record<Props['direction'], string> = {
  up:   'M15.7098 14.9902C15.6173 15.0829 15.5074 15.1565 15.3864 15.2067C15.2655 15.2568 15.1358 15.2827 15.0048 15.2827C14.8738 15.2827 14.7442 15.2568 14.6232 15.2067C14.5022 15.1565 14.3923 15.0829 14.2998 14.9902L10.0098 10.7002L3.7098 16.9902L2.2998 15.5802L9.2998 8.58023C9.4998 8.38023 9.7498 8.29023 10.0098 8.29023C10.2698 8.29023 10.5198 8.39023 10.7198 8.58023L15.0098 12.8702L18.2998 9.58023L16.0098 7.29023H22.0098V13.2902L19.7198 11.0002L15.7198 15.0002L15.7098 14.9902Z',
  down: 'M15.7098 9.29004C15.6173 9.19734 15.5074 9.12379 15.3864 9.07361C15.2655 9.02342 15.1358 8.99759 15.0048 8.99759C14.8738 8.99759 14.7442 9.02342 14.6232 9.07361C14.5022 9.12379 14.3923 9.19734 14.2998 9.29004L10.0098 13.58L3.7098 7.29004L2.2998 8.70004L9.2998 15.7C9.4998 15.9 9.7498 15.99 10.0098 15.99C10.2698 15.99 10.5198 15.89 10.7198 15.7L15.0098 11.41L18.2998 14.7L16.0098 16.99H22.0098V10.99L19.7198 13.28L15.7198 9.28004L15.7098 9.29004Z',
};

export function TrendIcon({ direction, color, size = 16 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel={direction === 'up' ? 'Trending up' : 'Trending down'}>
      <Path d={PATHS[direction]} fill={color} />
    </Svg>
  );
}
