import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Circle, Defs, G, Polygon, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { neutral } from '@/theme/colors';
import type { Point } from '../geometry';

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

/**
 * RadarShape
 * -----------
 * One series on the radar: a filled polygon that grows out from the centre,
 * plus a dot on each vertex. Hovering a dot (tapping on touch) enlarges it
 * and shows its axis and value. Lives in its own component so every series
 * gets its own animation and hover state.
 */
interface Props {
  id:     string;
  color:  string;
  cx:     number;
  cy:     number;
  points: Point[];
  /** Axis label per point, for the hover tip. */
  labels: string[];
  /** Value per point, for the hover tip. */
  values: number[];
  fontFamily?: string;
  /** Stagger between series, ms. */
  delay?: number;
}

const TIP_FONT_SIZE = 11;
const TIP_HEIGHT = 20;
/** Rough width of one uppercase glyph, as a share of the font size. Errs wide. */
const TIP_GLYPH_WIDTH = 0.68;

export function RadarShape({ id, color, cx, cy, points, labels, values, fontFamily, delay = 0 }: Props) {
  const progress = useSharedValue(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

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
      {points.map((p, i) => {
        const hovered = hoverIdx === i;
        return (
          <G key={`dot-${i}`}>
            <Circle
              cx={p.x}
              cy={p.y}
              r={hovered ? 6 : 3}
              fill={color}
              stroke={hovered ? neutral.text : 'none'}
              strokeWidth={hovered ? 1.5 : 0}
            />
            {/* Invisible target centred on the dot: easier to hit than 3px. */}
            <Rect
              x={p.x - 12}
              y={p.y - 12}
              width={24}
              height={24}
              fill="transparent"
              onPress={() => setHoverIdx(hovered ? null : i)}
              {...(Platform.OS === 'web' ? {
                onMouseEnter: () => setHoverIdx(i),
                onMouseLeave: () => setHoverIdx(null),
                style: { cursor: 'pointer' },
              } as any : {})}
            />
          </G>
        );
      })}
      {hoverIdx !== null ? (
        <DotTip
          point={points[hoverIdx]}
          text={`${labels[hoverIdx].toUpperCase()} · ${Math.round(values[hoverIdx])}`}
          color={color}
          bounds={cx * 2}
          fontFamily={fontFamily}
        />
      ) : null}
    </G>
  );
}

/** Pill above the dot (below it near the top edge), kept inside the chart. */
function DotTip({ point, text, color, bounds, fontFamily }: {
  point: Point; text: string; color: string; bounds: number; fontFamily?: string;
}) {
  const width = text.length * TIP_FONT_SIZE * TIP_GLYPH_WIDTH + 16;
  // 1px inset so the stroke is not clipped at the chart edge.
  const x = Math.min(Math.max(point.x - width / 2, 1), bounds - width - 1);
  const above = point.y - 12 - TIP_HEIGHT;
  const y = above >= 0 ? above : point.y + 12;
  return (
    <G pointerEvents="none">
      <Rect
        x={x}
        y={y}
        width={width}
        height={TIP_HEIGHT}
        rx={TIP_HEIGHT / 2}
        fill={neutral.ink}
        stroke={color}
        strokeWidth={1}
      />
      <SvgText
        x={x + width / 2}
        y={y + TIP_HEIGHT / 2}
        fontSize={TIP_FONT_SIZE}
        fontFamily={fontFamily}
        fontWeight="600"
        fill={neutral.text}
        textAnchor="middle"
        alignmentBaseline="middle"
      >
        {text}
      </SvgText>
    </G>
  );
}
