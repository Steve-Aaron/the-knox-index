import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';
import { DevLabel } from '@/components/primitives/DevLabel';
import { track } from '@/lib/analytics';
import { neutral } from '@/theme/colors';
import { font } from '@/theme/typography';
import { polar } from '../geometry';
import { RadarGrid } from './RadarGrid';
import { RadarShape } from './RadarShape';

/**
 * RadarChart
 * -----------
 * Generic multi-series radar. Knows nothing about politicians or platforms:
 * give it axes and series (values 0..maxValue) and it draws them.
 *
 * Unlike card/RadialScoreChart (single politician), this one overlays
 * several series for comparison, e.g. TikTok vs X. Dots work the same way:
 * hover enlarges one, press opens an overlay with that series' score on
 * that axis, ✕ closes it.
 *
 * One job: draw N series on a shared set of axes.
 */
export interface RadarAxis<K extends string> {
  key:   K;
  label: string;
  /** One-line explanation shown under the value in the dot overlay. */
  desc?: string;
}

export interface RadarSeries<K extends string> {
  id:     string;
  color:  string;
  values: Record<K, number>;
  /** Series name in the dot overlay, e.g. 'TikTok'. */
  label?: string;
}

/** One series' dot on one axis. */
interface DotRef {
  seriesId: string;
  idx:      number;
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

  const [hoverDot,  setHoverDot]  = useState<DotRef | null>(null);
  const [activeDot, setActiveDot] = useState<DotRef | null>(null);

  const openDot = (seriesId: string, idx: number) => {
    setActiveDot({ seriesId, idx });
    // Same topic shape as RadialScoreChart so dot clicks count together.
    track('helper_clicked', { topic: `radar_dot_${axes[idx]?.key ?? 'unknown'}`, series_id: seriesId });
  };

  const dotIdxFor = (seriesId: string): number | null => {
    if (activeDot?.seriesId === seriesId) return activeDot.idx;
    if (hoverDot?.seriesId === seriesId) return hoverDot.idx;
    return null;
  };

  const activeSeries = activeDot ? series.find(s => s.id === activeDot.seriesId) : undefined;
  const activeAxis   = activeDot ? axes[activeDot.idx] : undefined;

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
            activeIdx={dotIdxFor(s.id)}
            onDotPress={idx => openDot(s.id, idx)}
            onDotHover={idx => setHoverDot(idx == null ? null : { seriesId: s.id, idx })}
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

      {activeSeries && activeAxis ? (
        <View style={styles.overlay}>
          <View style={styles.overlayHeader}>
            <Text style={styles.overlayKicker}>
              {activeAxis.label}{activeSeries.label ? ` · ${activeSeries.label}` : ''}
            </Text>
            <Pressable
              onPress={() => setActiveDot(null)}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.closeBtn, Platform.OS === 'web' && ({ cursor: 'pointer' } as any)]}
            >
              <Text style={styles.closeX}>{'✕'}</Text>
            </Pressable>
          </View>
          <View style={styles.overlayBody}>
            <Text style={[styles.value, { color: activeSeries.color }]}>
              {Math.round(activeSeries.values[activeAxis.key] ?? 0)} / {maxValue}
            </Text>
            {activeAxis.desc ? <Text style={styles.desc}>{activeAxis.desc}</Text> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// Overlay styles mirror card/RadialScoreChart's dot overlay.
const styles = StyleSheet.create({
  overlay: {
    position:          'absolute',
    top:               0,
    left:              0,
    right:             0,
    bottom:            0,
    backgroundColor:   neutral.felt,
    borderRadius:      16,
    paddingHorizontal: 16,
    paddingTop:        8,
    paddingBottom:     16,
  },
  overlayHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    minHeight:      24,
  },
  overlayKicker: {
    fontFamily:    font.ui,
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 1.5,
    color:         neutral.textDim,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width:           24,
    height:          24,
    borderRadius:    12,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  closeX: {
    fontFamily: font.ui,
    fontSize:   12,
    fontWeight: '700',
    color:      neutral.text,
    lineHeight: 12,
  },
  overlayBody: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    paddingHorizontal: 12,
  },
  value: {
    fontFamily:    font.mono,
    fontSize:      24,
    fontWeight:    '700',
    lineHeight:    28,
    letterSpacing: -0.3,
  },
  desc: {
    fontFamily: font.ui,
    fontSize:   14,
    color:      neutral.textMid,
    lineHeight: 18,
    textAlign:  'center',
  },
});
