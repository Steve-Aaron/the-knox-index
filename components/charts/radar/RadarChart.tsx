import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { DevLabel } from '@/components/primitives/DevLabel';
import { useInViewport } from '@/hooks/useInViewport';
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
 * that axis, ✕ closes it. Shapes grow out once the chart scrolls into view.
 *
 * Hover and press go through one transparent layer over the whole chart that
 * picks the dot nearest the pointer, so a shape drawn on top never hides the
 * dots of the one below. Dots that sit on top of each other open together.
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
/** How close the pointer must be to a dot to hover or press it. */
const HIT_RADIUS = 14;
/** Dots closer than this are treated as one spot and open together. */
const SAME_SPOT = 6;

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

  const [viewRef, seen] = useInViewport();
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

  /** The dot nearest (x, y) within HIT_RADIUS, across every series. */
  const nearestDot = (x: number, y: number): DotRef | null => {
    let best: DotRef | null = null;
    let bestDist = HIT_RADIUS;
    for (const s of shapes) {
      s.points.forEach((p, idx) => {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d <= bestDist) { best = { seriesId: s.id, idx }; bestDist = d; }
      });
    }
    return best;
  };

  /** Pointer position inside the chart, from a web mouse event. */
  const webPoint = (e: any): { x: number; y: number } | null => {
    const svg = e?.currentTarget?.ownerSVGElement ?? e?.currentTarget;
    if (!svg?.getBoundingClientRect) return null;
    const r = svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const hitProps = Platform.OS === 'web' ? {
    onMouseMove: (e: any) => {
      const pt = webPoint(e);
      setHoverDot(pt ? nearestDot(pt.x, pt.y) : null);
    },
    onMouseLeave: () => setHoverDot(null),
    // react-native-svg on web only passes presses through onPress: open the
    // dot the pointer is already over
    onPress: () => { if (hoverDot) openDot(hoverDot.seriesId, hoverDot.idx); },
    style: { cursor: hoverDot ? 'pointer' : 'default' },
  } : {
    onPress: (e: any) => {
      const dot = nearestDot(e.nativeEvent.locationX, e.nativeEvent.locationY);
      if (dot) openDot(dot.seriesId, dot.idx);
    },
  };

  const activeAxis = activeDot ? axes[activeDot.idx] : undefined;
  // The pressed dot first, then any other series' dot sitting on the same spot
  const activeGroup = useMemo(() => {
    if (!activeDot) return [];
    const at = shapes.find(s => s.id === activeDot.seriesId)?.points[activeDot.idx];
    if (!at) return [];
    return shapes
      .filter(s => s.id === activeDot.seriesId
        || Math.hypot(s.points[activeDot.idx].x - at.x, s.points[activeDot.idx].y - at.y) <= SAME_SPOT)
      .sort((a, b) => Number(b.id === activeDot.seriesId) - Number(a.id === activeDot.seriesId));
  }, [activeDot, shapes]);

  return (
    <View ref={viewRef} style={{ width: size, height: size }}>
      <DevLabel name="RadarChart" />
      <Svg width={size} height={size}>
        <RadarGrid cx={cx} cy={cy} rings={grid.rings} spokes={grid.spokes} />

        {/* Labels before the shapes: a dot near 100 sits on its label, and the
            dot must stay on top to be hoverable and pressable. */}
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
            pointerEvents="none"
          >
            {axes[i].label.toUpperCase()}
          </SvgText>
        ))}

        {shapes.map((s, i) => (
          <RadarShape
            key={s.id}
            id={s.id}
            color={s.color}
            cx={cx}
            cy={cy}
            points={s.points}
            replayKey={axes.map(a => s.values[a.key]).join()}
            delay={i * 120}
            play={seen}
            activeIdx={dotIdxFor(s.id)}
          />
        ))}

        {/* One hit layer for every series' dots, on top of all the shapes */}
        <Rect x={0} y={0} width={size} height={size} fill="transparent" {...(hitProps as any)} />
      </Svg>

      {activeGroup.length > 0 && activeAxis ? (
        <View style={styles.overlay}>
          <View style={styles.overlayHeader}>
            <Text style={styles.overlayKicker}>
              {activeAxis.label}{activeGroup.length === 1 && activeGroup[0].label ? ` · ${activeGroup[0].label}` : ''}
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
            {activeGroup.map(s => (
              <Text key={s.id} style={[styles.value, { color: s.color }]}>
                {activeGroup.length > 1 && s.label ? `${s.label} ` : ''}{Math.round(s.values[activeAxis.key] ?? 0)} / {maxValue}
              </Text>
            ))}
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
