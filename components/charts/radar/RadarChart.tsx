import React, { useMemo } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';
import { DevLabel } from '@/components/primitives/DevLabel';
import { neutral } from '@/theme/colors';
import { polar } from '../geometry';
import { RadarGrid } from './RadarGrid';
import { RadarShape } from './RadarShape';

/**
 * RadarChart
 * -----------
 * Generic multi-series radar. Knows nothing about politicians or platforms:
 * give it axes and series (values 0..maxValue) and it draws them.
 *
 * Unlike card/RadialScoreChart (single politician, click-to-inspect dots),
 * this one overlays several series for comparison, e.g. TikTok vs X.
 *
 * One job: draw N series on a shared set of axes.
 */
export interface RadarAxis<K extends string> {
  key:   K;
  label: string;
}

export interface RadarSeries<K extends string> {
  id:     string;
  color:  string;
  values: Record<K, number>;
}

interface Props<K extends string> {
  axes:       RadarAxis<K>[];
  series:     RadarSeries<K>[];
  size:       number;
  maxValue?:  number;
  ringCount?: number;
}

const SVG_FONT = Platform.select({ web: 'Figtree, sans-serif', default: 'Figtree_600SemiBold' });

const LABEL_FONT_SIZE = 10;
/** Distance from the outer ring to the centre of an axis label. */
const LABEL_OFFSET = 18;
/** Rough width of one uppercase glyph, as a share of the font size. Errs wide. */
const GLYPH_WIDTH = 0.7;

/**
 * Largest plot radius that keeps every axis label inside the square. Each
 * label is centred on its spoke, so it needs half its width sideways and half
 * a line vertically — sized from the actual labels instead of a fixed margin,
 * so short labels give a bigger plot.
 */
function plotRadius(labels: string[], size: number, step: number): number {
  const half = size / 2;
  const halfLine = LABEL_FONT_SIZE / 2 + 2;
  return labels.reduce((r, label, i) => {
    const a = ((step * i) * Math.PI) / 180;
    const sin = Math.abs(Math.sin(a));
    const cos = Math.abs(Math.cos(a));
    const halfWidth = (label.length * LABEL_FONT_SIZE * GLYPH_WIDTH) / 2;
    const fitX = sin > 0.01 ? (half - halfWidth) / sin - LABEL_OFFSET : Infinity;
    const fitY = cos > 0.01 ? (half - halfLine) / cos - LABEL_OFFSET : Infinity;
    return Math.min(r, fitX, fitY);
  }, half - LABEL_OFFSET);
}

export function RadarChart<K extends string>({
  axes,
  series,
  size,
  maxValue = 100,
  ringCount = 4,
}: Props<K>) {
  const cx = size / 2;
  const cy = size / 2;
  const step = 360 / axes.length;
  const maxR = useMemo(
    () => Math.max(0, plotRadius(axes.map(a => a.label), size, step)),
    [axes, size, step],
  );

  const grid = useMemo(() => ({
    rings:  Array.from({ length: ringCount }, (_, i) => ((i + 1) / ringCount) * maxR),
    spokes: axes.map((_, i) => polar(cx, cy, maxR, step * i)),
    labels: axes.map((_, i) => polar(cx, cy, maxR + LABEL_OFFSET, step * i)),
  }), [axes, ringCount, maxR, cx, cy, step]);

  const shapes = useMemo(() => series.map(s => ({
    ...s,
    points: axes.map((a, i) => {
      const ratio = Math.min(1, Math.max(0, (s.values[a.key] ?? 0) / maxValue));
      return polar(cx, cy, maxR * ratio, step * i);
    }),
  })), [series, axes, maxValue, maxR, cx, cy, step]);

  return (
    <View style={{ width: size, height: size }}>
      <DevLabel name="RadarChart" />
      <Svg width={size} height={size}>
        <RadarGrid cx={cx} cy={cy} rings={grid.rings} spokes={grid.spokes} />

        {shapes.map((s, i) => (
          <RadarShape
            key={s.id}
            id={s.id}
            color={s.color}
            cx={cx}
            cy={cy}
            points={s.points}
            delay={i * 120}
          />
        ))}

        {grid.labels.map((p, i) => (
          <SvgText
            key={`label-${axes[i].key}`}
            x={p.x}
            y={p.y}
            fontSize={LABEL_FONT_SIZE}
            fontFamily={SVG_FONT}
            fontWeight="600"
            fill={neutral.textDim}
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {axes[i].label.toUpperCase()}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
